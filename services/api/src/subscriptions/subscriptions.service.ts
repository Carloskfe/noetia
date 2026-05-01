import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import Stripe from 'stripe';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { PlansService } from './plans.service';
import { Subscription, SubscriptionStatus } from './subscription.entity';

@Injectable()
export class SubscriptionsService {
  private readonly stripe: InstanceType<typeof Stripe>;
  private readonly logger = new Logger(SubscriptionsService.name);
  private readonly webUrl: string;

  constructor(
    private readonly config: ConfigService,
    private readonly usersService: UsersService,
    private readonly plansService: PlansService,
    @InjectRepository(Subscription)
    private readonly subRepo: Repository<Subscription>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {
    this.stripe = new Stripe(this.config.getOrThrow('STRIPE_SECRET_KEY'));
    this.webUrl = this.config.get('WEB_URL', 'http://localhost:3000');
  }

  async getOrCreateStripeCustomer(userId: string): Promise<string> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    if (user.stripeCustomerId) return user.stripeCustomerId;

    const customer = await this.stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { noetiaUserId: userId },
    });

    await this.userRepo.update(userId, { stripeCustomerId: customer.id });
    return customer.id;
  }

  async createCheckoutSession(userId: string, planId: string): Promise<{ url: string }> {
    const plan = await this.plansService.findById(planId);
    if (!plan) throw new BadRequestException({ error: 'invalid_plan' });

    const customerId = await this.getOrCreateStripeCustomer(userId);

    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      mode: 'subscription',
      subscription_data: { trial_period_days: 14 },
      success_url: `${this.webUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${this.webUrl}/billing/cancel`,
    });

    return { url: session.url! };
  }

  async createPortalSession(userId: string): Promise<{ url: string }> {
    const user = await this.usersService.findById(userId);
    if (!user?.stripeCustomerId) {
      throw new NotFoundException({ error: 'no_billing_account' });
    }

    const session = await this.stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${this.webUrl}/account/billing`,
    });

    return { url: session.url };
  }

  async getSubscriptionStatus(userId: string) {
    const sub = await this.subRepo.findOne({
      where: { userId },
      relations: ['plan'],
    });
    if (!sub) return { status: 'none' as const };
    return {
      status: sub.status,
      planId: sub.planId,
      currentPeriodEnd: sub.currentPeriodEnd,
      trialEnd: sub.trialEnd,
    };
  }

  async cancelSubscription(userId: string) {
    const sub = await this.subRepo.findOneBy({ userId });
    if (!sub?.stripeSubscriptionId) {
      throw new NotFoundException({ error: 'no_active_subscription' });
    }

    const updated = await this.stripe.subscriptions.update(sub.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    await this.subRepo.update(sub.id, { status: 'canceling' });
    return { cancelAt: new Date(updated.cancel_at! * 1000).toISOString() };
  }

  async resumeSubscription(userId: string) {
    const sub = await this.subRepo.findOneBy({ userId });
    if (!sub?.stripeSubscriptionId) {
      throw new NotFoundException({ error: 'no_active_subscription' });
    }

    await this.stripe.subscriptions.update(sub.stripeSubscriptionId, {
      cancel_at_period_end: false,
    });

    await this.subRepo.update(sub.id, { status: 'active' });
    return this.getSubscriptionStatus(userId);
  }

  async syncSubscription(userId: string) {
    const sub = await this.subRepo.findOneBy({ userId });
    if (!sub?.stripeSubscriptionId) return { status: 'none' };

    const stripeSub = await this.stripe.subscriptions.retrieve(sub.stripeSubscriptionId) as any;
    const status = this.mapStripeStatus(stripeSub.status, stripeSub.cancel_at_period_end);

    await this.subRepo.update(sub.id, {
      status,
      currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
      trialEnd: stripeSub.trial_end ? new Date(stripeSub.trial_end * 1000) : null,
    });

    return this.getSubscriptionStatus(userId);
  }

  async upsertFromWebhook(
    stripeEventId: string,
    stripeCustomerId: string,
    stripeSubscriptionId: string,
    status: SubscriptionStatus,
    currentPeriodEnd: Date,
    trialEnd: Date | null,
    planId?: string | null,
  ): Promise<void> {
    const existing = await this.subRepo.findOneBy({ stripeSubscriptionId });

    if (existing?.stripeEventId === stripeEventId) return;

    const user = await this.userRepo.findOneBy({ stripeCustomerId });
    if (!user) {
      this.logger.warn(`No user found for stripeCustomerId: ${stripeCustomerId}`);
      return;
    }

    await this.subRepo.upsert(
      {
        userId: user.id,
        stripeCustomerId,
        stripeSubscriptionId,
        status,
        currentPeriodEnd,
        trialEnd,
        stripeEventId,
        ...(planId !== undefined ? { planId } : {}),
      },
      { conflictPaths: ['userId'] },
    );
  }

  async cancelFromWebhook(stripeSubscriptionId: string): Promise<void> {
    await this.subRepo.update({ stripeSubscriptionId }, { status: 'canceled' });
  }

  async findPlanByStripePriceId(priceId: string): Promise<string | null> {
    const plans = await this.plansService.findAll();
    return plans.find((p) => p.stripePriceId === priceId)?.id ?? null;
  }

  private mapStripeStatus(
    stripeStatus: string,
    cancelAtPeriodEnd: boolean,
  ): SubscriptionStatus {
    if (cancelAtPeriodEnd) return 'canceling';
    switch (stripeStatus) {
      case 'trialing': return 'trialing';
      case 'active': return 'active';
      case 'past_due': return 'past_due';
      case 'canceled': return 'canceled';
      default: return 'none';
    }
  }
}
