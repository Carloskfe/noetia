import { Injectable, Logger } from '@nestjs/common';
import { GiftsService } from '../gifts/gifts.service';
import { SubscriptionsService } from './subscriptions.service';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly giftsService: GiftsService,
  ) {}

  async handleEvent(event: any): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed':
        if (event.data.object.mode === 'payment') {
          await this.handlePaymentCompleted(event);
        } else {
          await this.handleCheckoutCompleted(event);
        }
        break;
      case 'invoice.paid':
        await this.handleInvoicePaid(event);
        break;
      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailed(event);
        break;
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event);
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

    const stripeSubId =
      typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription.id;
    const customerId =
      typeof session.customer === 'string' ? session.customer : session.customer.id;

    await this.subscriptionsService.upsertFromWebhook(
      event.id,
      customerId,
      stripeSubId,
      'active',
      new Date(),
      null,
    );
  }

  private async handleInvoicePaid(event: any): Promise<void> {
    const invoice = event.data.object;
    const subId = typeof invoice.subscription === 'string'
      ? invoice.subscription
      : invoice.subscription?.id;
    const customerId = typeof invoice.customer === 'string'
      ? invoice.customer
      : invoice.customer?.id;

    if (!subId || !customerId) return;

    const periodEnd = (invoice as any).lines?.data?.[0]?.period?.end;
    const currentPeriodEnd = periodEnd ? new Date(periodEnd * 1000) : new Date();

    await this.subscriptionsService.upsertFromWebhook(
      event.id,
      customerId,
      subId,
      'active',
      currentPeriodEnd,
      null,
    );
    await this.subscriptionsService.issueTokensForNewSubscription(subId);
  }

  private async handleInvoicePaymentFailed(event: any): Promise<void> {
    const invoice = event.data.object;
    const subId = typeof invoice.subscription === 'string'
      ? invoice.subscription
      : invoice.subscription?.id;
    const customerId = typeof invoice.customer === 'string'
      ? invoice.customer
      : invoice.customer?.id;

    if (!subId || !customerId) return;

    await this.subscriptionsService.upsertFromWebhook(
      event.id,
      customerId,
      subId,
      'past_due',
      new Date(),
      null,
    );
  }

  private async handleSubscriptionUpdated(event: any): Promise<void> {
    const sub = event.data.object;
    const customerId =
      typeof sub.customer === 'string' ? sub.customer : sub.customer.id;

    const status = sub.cancel_at_period_end ? 'canceling'
      : sub.status === 'trialing' ? 'trialing'
      : sub.status === 'active' ? 'active'
      : sub.status === 'past_due' ? 'past_due'
      : 'none';

    const priceId = sub.items.data[0]?.price?.id;
    const planId = priceId
      ? await this.subscriptionsService.findPlanByStripePriceId(priceId)
      : null;

    await this.subscriptionsService.upsertFromWebhook(
      event.id,
      customerId,
      sub.id,
      status as any,
      new Date(sub.current_period_end * 1000),
      sub.trial_end ? new Date(sub.trial_end * 1000) : null,
      planId,
    );
  }

  private async handleSubscriptionDeleted(event: any): Promise<void> {
    const sub = event.data.object;
    await this.subscriptionsService.cancelFromWebhook(sub.id);
  }
}
