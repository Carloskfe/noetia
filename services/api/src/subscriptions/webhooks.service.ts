import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GiftsService } from '../gifts/gifts.service';
import { StripeProcessedEvent } from './stripe-processed-event.entity';
import { SubscriptionsService } from './subscriptions.service';

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
   * Entry point — idempotent against Stripe's at-least-once redelivery.
   *
   * Design (retry-safe): the `stripe_processed_events` ledger records an event
   * ONLY AFTER its business side effects have fully succeeded. So:
   *   - a redelivered event whose row already exists is skipped (no duplicate
   *     side effects — supplements, does not replace, the path-level guards);
   *   - if dispatch() throws, NO row is written, the controller returns non-2xx,
   *     and Stripe re-delivers → the event is re-processed (a mid-processing
   *     failure/crash never permanently suppresses a legitimate retry).
   * Recording-before-processing was deliberately rejected because a crash between
   * the insert and the side effects would drop the retry (under-fulfillment).
   */
  async handleEvent(event: any): Promise<void> {
    const already = await this.processedRepo.findOne({ where: { eventId: event.id } });
    if (already) {
      this.logger.log(
        `Stripe event ${event.id} (${event.type}) already processed — skipping duplicate`,
      );
      return;
    }

    // Business side effects first — throws here propagate so Stripe retries.
    await this.dispatch(event);

    // Mark completed only on success. `orIgnore` guards the rare check-then-insert
    // race; the PK on eventId is the hard uniqueness guarantee.
    await this.processedRepo
      .createQueryBuilder()
      .insert()
      .values({ eventId: event.id, type: event.type, processedAt: new Date() })
      .orIgnore()
      .execute();
  }

  /**
   * Subscription events no longer write the state captured in their payload: each one re-reads the
   * subscription from Stripe and applies it through SubscriptionsService's identity guard, so delayed,
   * duplicated or out-of-order deliveries converge on Stripe's current state and a different Stripe
   * subscription can never silently replace a live one.
   *
   * Unchanged on purpose (trial-token STOP gate, PO decision pending): `planId` is still written only by
   * `customer.subscription.updated`, and tokens are still issued only from `invoice.paid` via
   * issueTokensForNewSubscription — so when tokens are granted is exactly as before.
   */
  private async dispatch(event: any): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed':
        if (event.data.object.mode === 'payment') {
          await this.handlePaymentCompleted(event);
        } else {
          await this.handleCheckoutCompleted(event);
        }
        break;
      case 'customer.subscription.created':
        await this.subscriptionsService.applyStripeSubscription(event.id, event.data.object.id);
        break;
      case 'customer.subscription.updated':
        await this.subscriptionsService.applyStripeSubscription(event.id, event.data.object.id, { includePlan: true });
        break;
      case 'invoice.paid':
        await this.handleInvoicePaid(event);
        break;
      case 'invoice.payment_failed': {
        const subId = this.invoiceSubscriptionId(event.data.object);
        if (subId) await this.subscriptionsService.applyStripeSubscription(event.id, subId);
        break;
      }
      case 'customer.subscription.deleted':
        // Matches the row by its own stripeSubscriptionId: a late delete of an old subscription cannot touch
        // a newer one.
        await this.subscriptionsService.cancelFromWebhook(event.data.object.id);
        break;
      default:
        this.logger.log(`Unhandled Stripe event: ${event.type}`);
    }
  }

  private async handlePaymentCompleted(event: any): Promise<void> {
    const session = event.data.object;
    const { type, bookId, tokenPackageId, userId } = session.metadata ?? {};

    if (type === 'gift') {
      await this.giftsService.fulfillGift(session);
      return;
    }

    if (!userId) return;

    if (tokenPackageId) {
      await this.subscriptionsService.issueTokensForPurchasedPackage(tokenPackageId, userId);
    } else if (bookId) {
      await this.subscriptionsService.addPurchasedBook(userId, bookId);
    }
  }

  private async handleCheckoutCompleted(event: any): Promise<void> {
    const session = event.data.object;
    if (!session.subscription || !session.customer) return;
    const stripeSubId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
    await this.subscriptionsService.applyStripeSubscription(event.id, stripeSubId);
  }

  private async handleInvoicePaid(event: any): Promise<void> {
    const subId = this.invoiceSubscriptionId(event.data.object);
    if (!subId) return;
    await this.subscriptionsService.applyStripeSubscription(event.id, subId);
    // Token issuance unchanged: looks the row up by this Stripe subscription id and needs its plan. A
    // subscription rejected by the identity guard has no row, so no tokens are attached to an untracked one.
    await this.subscriptionsService.issueTokensForNewSubscription(subId);
  }

  private invoiceSubscriptionId(invoice: any): string | null {
    const sub = invoice?.subscription ?? invoice?.parent?.subscription_details?.subscription;
    if (!sub) return null;
    return typeof sub === 'string' ? sub : sub.id ?? null;
  }
}
