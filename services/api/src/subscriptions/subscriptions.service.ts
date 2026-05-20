import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import Stripe from 'stripe';
import { In, LessThan, MoreThan, Repository } from 'typeorm';
import { EmailService } from '../email/email.service';
import { PushService } from '../push/push.service';
import { Book } from '../books/book.entity';
import { UserBook } from '../library/user-book.entity';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { PlansService } from './plans.service';
import { Subscription, SubscriptionStatus } from './subscription.entity';
import { SubscriptionInvite } from './subscription-invite.entity';
import { TokenLedger } from './token-ledger.entity';

const ACTIVE_STATUSES = ['active', 'trialing', 'canceling'];

const TOKEN_EXPIRY_DAYS = 90;
const PROMOTIONAL_EXPIRY_DAYS = 30;
const COURTESY_EXPIRY_DAYS = 30;

@Injectable()
export class SubscriptionsService {
  private readonly stripe: InstanceType<typeof Stripe> | null;
  private readonly logger = new Logger(SubscriptionsService.name);
  private readonly webUrl: string;

  constructor(
    private readonly config: ConfigService,
    private readonly usersService: UsersService,
    private readonly plansService: PlansService,
    private readonly emailService: EmailService,
    private readonly pushService: PushService,
    @InjectRepository(Subscription)
    private readonly subRepo: Repository<Subscription>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Book)
    private readonly bookRepo: Repository<Book>,
    @InjectRepository(UserBook)
    private readonly userBookRepo: Repository<UserBook>,
    @InjectRepository(TokenLedger)
    private readonly tokenRepo: Repository<TokenLedger>,
    @InjectRepository(SubscriptionInvite)
    private readonly inviteRepo: Repository<SubscriptionInvite>,
  ) {
    const stripeKey = this.config.get<string>('STRIPE_SECRET_KEY');
    this.stripe = stripeKey ? new Stripe(stripeKey) : null;
    this.webUrl = this.config.get('WEB_URL', 'http://localhost:3000');
  }

  // ── Token ledger ────────────────────────────────────────────────────────────

  async issueTokens(
    userId: string,
    count: number,
    type: 'paid' | 'promotional' | 'courtesy',
    options: { subscriptionId?: string; reason?: string } = {},
  ): Promise<void> {
    const now = new Date();
    const expiryDays =
      type === 'paid' ? TOKEN_EXPIRY_DAYS :
      type === 'promotional' ? PROMOTIONAL_EXPIRY_DAYS :
      COURTESY_EXPIRY_DAYS;

    const expiresAt = new Date(now.getTime() + expiryDays * 24 * 60 * 60 * 1000);

    const entries = Array.from({ length: count }, () =>
      this.tokenRepo.create({
        userId,
        subscriptionId: options.subscriptionId ?? null,
        type,
        status: 'active',
        issuedAt: now,
        activatedAt: type === 'courtesy' ? now : null,
        expiresAt,
        reason: options.reason ?? null,
      }),
    );

    await this.tokenRepo.save(entries);
  }

  async getActiveTokenCount(userId: string): Promise<number> {
    await this.expireStaleTokens(userId);
    return this.tokenRepo.count({
      where: { userId, status: 'active', expiresAt: MoreThan(new Date()) },
    });
  }

  private async expireStaleTokens(userId: string): Promise<void> {
    await this.tokenRepo.update(
      { userId, status: 'active', expiresAt: LessThan(new Date()) },
      { status: 'expired' },
    );
  }

  async redeemToken(userId: string, bookId: string): Promise<void> {
    const book = await this.bookRepo.findOneBy({ id: bookId, isPublished: true });
    if (!book) throw new NotFoundException('Book not found');

    const alreadyOwned = await this.userBookRepo.existsBy({ userId, bookId });
    if (alreadyOwned) throw new BadRequestException({ error: 'already_owned' });

    await this.expireStaleTokens(userId);

    // Try the user's own token pool first; fall back to linked plan owner's pool
    let tokenOwnerId = userId;
    let token = await this.tokenRepo.findOne({
      where: { userId, status: 'active', expiresAt: MoreThan(new Date()) },
      order: { issuedAt: 'ASC' },
    });

    if (!token) {
      const ownerSub = await this.subRepo
        .createQueryBuilder('sub')
        .where(':userId = ANY(sub."linkedUserIds")', { userId })
        .andWhere('sub.status IN (:...statuses)', { statuses: ACTIVE_STATUSES })
        .getOne();

      if (ownerSub) {
        tokenOwnerId = ownerSub.userId;
        await this.expireStaleTokens(tokenOwnerId);
        token = await this.tokenRepo.findOne({
          where: { userId: tokenOwnerId, status: 'active', expiresAt: MoreThan(new Date()) },
          order: { issuedAt: 'ASC' },
        });
      }
    }

    if (!token) throw new ForbiddenException({ error: 'no_tokens_remaining' });

    await this.tokenRepo.update(token.id, { status: 'redeemed', redeemedAt: new Date(), bookId });
    await this.userBookRepo.insert({ userId, bookId, purchaseType: 'token' });
  }

  async issueMonthlyTokensForAnnualPlans(): Promise<void> {
    const now = new Date();
    const subs = await this.subRepo.find({
      where: { status: 'active', nextTokenIssuanceAt: LessThan(now) },
      relations: ['plan'],
    });

    for (const sub of subs) {
      if (!sub.plan || sub.plan.interval !== 'year') continue;
      await this.issueTokens(sub.userId, sub.plan.tokensPerCycle, 'paid', {
        subscriptionId: sub.id,
        reason: 'Annual plan monthly issuance',
      });
      const next = new Date(sub.nextTokenIssuanceAt!);
      next.setDate(next.getDate() + 30);
      await this.subRepo.update(sub.id, { nextTokenIssuanceAt: next });
    }
  }

  // ── Stripe / subscriptions ──────────────────────────────────────────────────

  private requireStripe(): InstanceType<typeof Stripe> {
    if (!this.stripe) throw new BadRequestException({ error: 'payments_not_configured' });
    return this.stripe;
  }

  async getOrCreateStripeCustomer(userId: string): Promise<string> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    if (user.stripeCustomerId) return user.stripeCustomerId;
    const customer = await this.requireStripe().customers.create({
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
    const session = await this.requireStripe().checkout.sessions.create({
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
    if (!user?.stripeCustomerId) throw new NotFoundException({ error: 'no_billing_account' });
    const session = await this.requireStripe().billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${this.webUrl}/account/billing`,
    });
    return { url: session.url };
  }

  async createPurchaseSession(userId: string, bookId: string): Promise<{ url: string }> {
    const book = await this.bookRepo.findOneBy({ id: bookId, isPublished: true });
    if (!book) throw new NotFoundException('Book not found');
    if (!book.priceCents) throw new BadRequestException({ error: 'book_not_for_sale' });
    const customerId = await this.getOrCreateStripeCustomer(userId);
    const session = await this.requireStripe().checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          unit_amount: book.priceCents,
          product_data: { name: book.title, metadata: { bookId: book.id } },
        },
        quantity: 1,
      }],
      mode: 'payment',
      metadata: { bookId: book.id, userId },
      success_url: `${this.webUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${this.webUrl}/billing/cancel`,
    });
    return { url: session.url! };
  }

  async createTokenPackageSession(userId: string, packageId: string): Promise<{ url: string }> {
    const pkg = await this.plansService.findTokenPackageById(packageId);
    if (!pkg) throw new BadRequestException({ error: 'invalid_token_package' });
    if (!pkg.stripePriceId || pkg.stripePriceId.startsWith('price_token_')) {
      throw new BadRequestException({ error: 'payments_not_configured' });
    }
    const customerId = await this.getOrCreateStripeCustomer(userId);
    const session = await this.requireStripe().checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: pkg.stripePriceId, quantity: 1 }],
      mode: 'payment',
      metadata: { tokenPackageId: pkg.id, userId },
      success_url: `${this.webUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${this.webUrl}/billing/cancel`,
    });
    return { url: session.url! };
  }

  async issueTokensForPurchasedPackage(tokenPackageId: string, userId: string): Promise<void> {
    const pkg = await this.plansService.findTokenPackageById(tokenPackageId);
    if (!pkg) {
      this.logger.warn(`Token package not found for id: ${tokenPackageId}`);
      return;
    }
    await this.issueTokens(userId, pkg.tokenCount, 'paid', {
      reason: `Purchased ${pkg.name}`,
    });
  }

  async addPurchasedBook(userId: string, bookId: string): Promise<void> {
    try {
      await this.userBookRepo.insert({ userId, bookId, purchaseType: 'purchase' });
    } catch (err: any) {
      if (err?.code === '23505') return;
      throw err;
    }
  }

  async issueTokensForNewSubscription(stripeSubscriptionId: string): Promise<void> {
    const sub = await this.subRepo.findOne({
      where: { stripeSubscriptionId },
      relations: ['plan'],
    });
    if (!sub?.plan) return;

    await this.issueTokens(sub.userId, sub.plan.tokensPerCycle, 'paid', {
      subscriptionId: sub.id,
      reason: 'Subscription renewal',
    });

    if (sub.plan.interval === 'year') {
      const next = new Date();
      next.setDate(next.getDate() + 30);
      await this.subRepo.update(sub.id, { nextTokenIssuanceAt: next });
    }
  }

  async getSubscriptionStatus(userId: string) {
    const sub = await this.subRepo.findOne({ where: { userId }, relations: ['plan'] });
    if (!sub) {
      // Check if user is a linked member on someone else's plan
      const ownerSub = await this.subRepo
        .createQueryBuilder('sub')
        .leftJoinAndSelect('sub.plan', 'plan')
        .where(':userId = ANY(sub."linkedUserIds")', { userId })
        .andWhere('sub.status IN (:...statuses)', { statuses: ACTIVE_STATUSES })
        .getOne();
      if (ownerSub) {
        const tokenBalance = await this.getActiveTokenCount(ownerSub.userId);
        return {
          status: ownerSub.status,
          planId: ownerSub.planId,
          planName: ownerSub.plan?.name ?? null,
          maxProfiles: ownerSub.plan?.maxProfiles ?? 1,
          currentPeriodEnd: ownerSub.currentPeriodEnd,
          trialEnd: ownerSub.trialEnd,
          tokenBalance,
          isLinkedMember: true,
        };
      }
      return { status: 'none' as const };
    }
    const tokenBalance = await this.getActiveTokenCount(userId);
    return {
      status: sub.status,
      planId: sub.planId,
      planName: sub.plan?.name ?? null,
      maxProfiles: sub.plan?.maxProfiles ?? 1,
      currentPeriodEnd: sub.currentPeriodEnd,
      trialEnd: sub.trialEnd,
      tokenBalance,
      isLinkedMember: false,
    };
  }

  // ── Invite flow ─────────────────────────────────────────────────────────────

  async inviteUser(ownerId: string, email: string): Promise<{ id: string; email: string; expiresAt: Date }> {
    const sub = await this.subRepo.findOne({ where: { userId: ownerId }, relations: ['plan'] });
    if (!sub || !ACTIVE_STATUSES.includes(sub.status)) {
      throw new ForbiddenException({ error: 'subscription_required' });
    }
    const maxProfiles = sub.plan?.maxProfiles ?? 1;
    if (maxProfiles <= 1) {
      throw new BadRequestException({ error: 'plan_does_not_support_sharing' });
    }
    if (sub.linkedUserIds.length >= maxProfiles - 1) {
      throw new BadRequestException({ error: 'plan_full' });
    }

    // Prevent duplicate pending invites for the same email
    const existing = await this.inviteRepo.findOne({
      where: { subscriptionId: sub.id, invitedEmail: email, status: 'pending' },
    });
    if (existing && existing.expiresAt > new Date()) {
      return { id: existing.id, email: existing.invitedEmail, expiresAt: existing.expiresAt };
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const invite = this.inviteRepo.create({ subscriptionId: sub.id, invitedEmail: email, token, expiresAt });
    await this.inviteRepo.save(invite);

    const owner = await this.usersService.findById(ownerId);
    await this.emailService.sendPlanInvite(
      email,
      owner?.name ?? 'Un usuario',
      sub.plan?.name ?? 'Noetia',
      token,
    );

    return { id: invite.id, email: invite.invitedEmail, expiresAt };
  }

  async acceptInvite(token: string, userId: string): Promise<void> {
    const invite = await this.inviteRepo.findOne({ where: { token }, relations: ['subscription', 'subscription.plan'] });
    if (!invite || invite.status !== 'pending' || invite.expiresAt < new Date()) {
      throw new BadRequestException({ error: 'invite_invalid_or_expired' });
    }

    const sub = invite.subscription;
    if (!ACTIVE_STATUSES.includes(sub.status)) {
      throw new BadRequestException({ error: 'subscription_no_longer_active' });
    }

    const maxProfiles = sub.plan?.maxProfiles ?? 1;
    if (sub.linkedUserIds.length >= maxProfiles - 1) {
      throw new BadRequestException({ error: 'plan_full' });
    }
    if (sub.userId === userId) {
      throw new BadRequestException({ error: 'cannot_join_own_plan' });
    }
    if (sub.linkedUserIds.includes(userId)) {
      throw new BadRequestException({ error: 'already_linked' });
    }

    await this.subRepo.update(sub.id, { linkedUserIds: [...sub.linkedUserIds, userId] });
    await this.inviteRepo.update(invite.id, { status: 'accepted' });

    // Notify plan owner
    this.pushService.sendToUser(sub.userId, 'invite_accepted', {
      planName: sub.plan?.name ?? 'Noetia',
    }).catch(() => {});
  }

  async getLinkedUsers(userId: string) {
    // Works for both the owner and linked members
    const sub = await this.subRepo.findOne({
      where: { userId },
      relations: ['plan'],
    });

    let ownerSub = sub;
    let isOwner = true;

    if (!sub) {
      ownerSub = await this.subRepo
        .createQueryBuilder('sub')
        .leftJoinAndSelect('sub.plan', 'plan')
        .where(':userId = ANY(sub."linkedUserIds")', { userId })
        .getOne();
      isOwner = false;
    }

    if (!ownerSub) return { linkedUsers: [], pendingInvites: [], maxProfiles: 1, isOwner: false };

    const linkedUsers = ownerSub.linkedUserIds.length > 0
      ? await this.userRepo.findBy({ id: In(ownerSub.linkedUserIds) })
      : [];

    const pendingInvites = isOwner
      ? await this.inviteRepo.find({
          where: { subscriptionId: ownerSub.id, status: 'pending' },
          order: { createdAt: 'DESC' },
        })
      : [];

    return {
      linkedUsers: linkedUsers.map(u => ({ id: u.id, name: u.name, email: u.email, avatarUrl: u.avatarUrl })),
      pendingInvites: pendingInvites.map(i => ({ id: i.id, email: i.invitedEmail, expiresAt: i.expiresAt })),
      maxProfiles: ownerSub.plan?.maxProfiles ?? 1,
      isOwner,
    };
  }

  async removeLinkedUser(ownerId: string, targetUserId: string): Promise<void> {
    const sub = await this.subRepo.findOneBy({ userId: ownerId });
    if (!sub) throw new NotFoundException({ error: 'subscription_not_found' });
    if (!sub.linkedUserIds.includes(targetUserId)) {
      throw new BadRequestException({ error: 'user_not_linked' });
    }
    await this.subRepo.update(sub.id, {
      linkedUserIds: sub.linkedUserIds.filter(id => id !== targetUserId),
    });
  }

  async revokeInvite(ownerId: string, inviteId: string): Promise<void> {
    const sub = await this.subRepo.findOneBy({ userId: ownerId });
    if (!sub) throw new NotFoundException({ error: 'subscription_not_found' });
    const invite = await this.inviteRepo.findOneBy({ id: inviteId, subscriptionId: sub.id });
    if (!invite) throw new NotFoundException({ error: 'invite_not_found' });
    await this.inviteRepo.update(invite.id, { status: 'revoked' });
  }

  async cancelSubscription(userId: string) {
    const sub = await this.subRepo.findOneBy({ userId });
    if (!sub?.stripeSubscriptionId) throw new NotFoundException({ error: 'no_active_subscription' });
    const updated = await this.requireStripe().subscriptions.update(sub.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });
    await this.subRepo.update(sub.id, { status: 'canceling' });
    return { cancelAt: new Date(updated.cancel_at! * 1000).toISOString() };
  }

  async resumeSubscription(userId: string) {
    const sub = await this.subRepo.findOneBy({ userId });
    if (!sub?.stripeSubscriptionId) throw new NotFoundException({ error: 'no_active_subscription' });
    await this.requireStripe().subscriptions.update(sub.stripeSubscriptionId, { cancel_at_period_end: false });
    await this.subRepo.update(sub.id, { status: 'active' });
    return this.getSubscriptionStatus(userId);
  }

  async syncSubscription(userId: string) {
    const sub = await this.subRepo.findOneBy({ userId });
    if (!sub?.stripeSubscriptionId) return { status: 'none' };
    const stripeSub = await this.requireStripe().subscriptions.retrieve(sub.stripeSubscriptionId) as any;
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
      { userId: user.id, stripeCustomerId, stripeSubscriptionId, status, currentPeriodEnd, trialEnd, stripeEventId, ...(planId !== undefined ? { planId } : {}) },
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

  private mapStripeStatus(stripeStatus: string, cancelAtPeriodEnd: boolean): SubscriptionStatus {
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
