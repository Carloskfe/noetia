import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { GiftsService } from '../gifts/gifts.service';
import { classifyInvoice, grantsCycle, invoicePeriodStart } from './billing-cycles';
import { claimStripeKey, fulfillmentKey } from './stripe-fulfillment-ledger';
import { StripeProcessedEvent } from './stripe-processed-event.entity';
import { SubscriptionsService } from './subscriptions.service';

type AfterCommit = Array<() => Promise<void>>;

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly giftsService: GiftsService,
    @InjectRepository(StripeProcessedEvent)
    private readonly processedRepo: Repository<StripeProcessedEvent>,
  ) {}

  /**
   * Entry point — exactly-once against Stripe's at-least-once (and concurrent) redelivery.
   *
   * ONE database transaction holds, in order:
   *   1. the claim of the Stripe event id in `stripe_processed_events` (INSERT … ON CONFLICT DO NOTHING);
   *   2. every database side effect of the event (subscription row, tokens, purchased book, gift row), plus a
   *      second claim on a per-invoice / per-Checkout-session fulfillment key where money is turned into value.
   * Consequences (see claimStripeKey):
   *   - concurrent deliveries of the same event: the second blocks on the first's uncommitted claim, then
   *     sees the conflict and does nothing;
   *   - crash or error anywhere before COMMIT: everything, including the claim, rolls back → Stripe's retry
   *     re-processes cleanly (never "tokens granted but event not recorded", never "recorded but not granted");
   *   - two different event ids for the same invoice / session: the fulfillment key lets only one grant.
   * Emails are sent only AFTER commit, and only by the delivery that performed the fulfillment.
   */
  async handleEvent(event: any): Promise<void> {
    const afterCommit: AfterCommit = [];
    const processed = await this.processedRepo.manager.transaction(async (em) => {
      if (!(await claimStripeKey(em, event.id, event.type))) return false;
      await this.dispatch(event, em, afterCommit);
      return true;
    });

    if (!processed) {
      this.logger.log(`Stripe event ${event.id} (${event.type}) already processed — skipping duplicate`);
      return;
    }

    // Post-commit notifications are best-effort: the fulfillment is durable and must not be re-run (a throw
    // here would make Stripe retry an event that is already recorded).
    for (const task of afterCommit) {
      try {
        await task();
      } catch (err) {
        this.logger.error(`Post-commit notification failed for Stripe event ${event.id}: ${(err as Error)?.message}`);
      }
    }
  }

  /**
   * Subscription events no longer write the state captured in their payload: each one re-reads the
   * subscription from Stripe and applies it through SubscriptionsService's identity guard, so delayed,
   * duplicated or out-of-order deliveries converge on Stripe's current state and a different Stripe
   * subscription can never silently replace a live one.
   *
   * Tokens (T-1, PO decision 2026-11-13): every subscription event records the plan, and the first one that
   * sees the subscription `trialing` grants the initial cycle once (SubscriptionsService.issueTrialStartTokens).
   * Renewals (incl. valid $0 renewals) and paid creations grant the cycle once per billing period (D4, D5).
   */
  private async dispatch(event: any, em: EntityManager, afterCommit: AfterCommit): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed':
        if (event.data.object.mode === 'payment') {
          await this.handlePaymentCompleted(event, em, afterCommit);
        } else {
          await this.handleCheckoutCompleted(event, em);
        }
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.subscriptionsService.applyStripeSubscription(event.id, event.data.object.id, em);
        break;
      case 'invoice.paid':
        await this.handleInvoicePaid(event, em);
        break;
      case 'invoice.payment_failed': {
        const subId = this.invoiceSubscriptionId(event.data.object);
        if (subId) await this.subscriptionsService.applyStripeSubscription(event.id, subId, em);
        break;
      }
      case 'customer.subscription.deleted':
        // Matches the row by its own stripeSubscriptionId: a late delete of an old subscription cannot touch
        // a newer one.
        await this.subscriptionsService.cancelFromWebhook(event.data.object.id, em);
        break;
      default:
        this.logger.log(`Unhandled Stripe event: ${event.type}`);
    }
  }

  private async handlePaymentCompleted(event: any, em: EntityManager, afterCommit: AfterCommit): Promise<void> {
    const session = event.data.object;
    const { type, bookId, tokenPackageId, userId } = session.metadata ?? {};
    const fulfills = type === 'gift' || (!!userId && (!!tokenPackageId || !!bookId));
    if (!fulfills || !session.id) return;

    // One fulfillment per Checkout session, whatever event id carries it.
    if (!(await claimStripeKey(em, fulfillmentKey('checkout-session', session.id), 'fulfillment:checkout-session'))) {
      this.logger.warn(`Checkout session ${session.id} already fulfilled — event ${event.id} grants nothing`);
      return;
    }

    if (type === 'gift') {
      const notify = await this.giftsService.fulfillGift(session, em);
      if (notify) afterCommit.push(notify);
    } else if (tokenPackageId) {
      await this.subscriptionsService.issueTokensForPurchasedPackage(tokenPackageId, userId, em);
    } else {
      await this.subscriptionsService.addPurchasedBook(userId, bookId, em);
    }
  }

  private async handleCheckoutCompleted(event: any, em: EntityManager): Promise<void> {
    const session = event.data.object;
    if (!session.subscription || !session.customer) return;
    const stripeSubId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
    await this.subscriptionsService.applyStripeSubscription(event.id, stripeSubId, em);
  }

  private async handleInvoicePaid(event: any, em: EntityManager): Promise<void> {
    const invoice = event.data.object;
    const subId = this.invoiceSubscriptionId(invoice);
    if (!subId) return;
    await this.subscriptionsService.applyStripeSubscription(event.id, subId, em);
    // D4/D5: only a renewal (`subscription_cycle`, including a valid $0 renewal) or a paid creation without a trial
    // grants a cycle. The trial's $0 creation invoice (T-1 grants the trial), plan changes / prorations
    // (`subscription_update`) and manual or other invoices never do.
    const invoiceClass = classifyInvoice(invoice);
    if (!grantsCycle(invoiceClass)) {
      this.logger.log(`Invoice ${invoice?.id} (${invoice?.billing_reason ?? 'no billing_reason'}) is ${invoiceClass}: no cycle tokens`);
      return;
    }
    // Looks the row up by this Stripe subscription id and needs its plan (an identity-rejected subscription has no
    // row → nothing). Once per billing period and per invoice id.
    await this.subscriptionsService.issueTokensForNewSubscription(subId, em, invoice?.id ?? null, invoicePeriodStart(invoice));
  }

  private invoiceSubscriptionId(invoice: any): string | null {
    const sub = invoice?.subscription ?? invoice?.parent?.subscription_details?.subscription;
    if (!sub) return null;
    return typeof sub === 'string' ? sub : sub.id ?? null;
  }
}
