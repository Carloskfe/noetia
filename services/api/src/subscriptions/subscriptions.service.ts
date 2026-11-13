import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import Stripe from 'stripe';
import { EntityManager, In, LessThan, MoreThan, Repository } from 'typeorm';
import { EmailService } from '../email/email.service';
import { PushService } from '../push/push.service';
import { Book } from '../books/book.entity';
import { UserBook } from '../library/user-book.entity';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { PlansService } from './plans.service';
import { annualScheduledCycles, invoicePeriodStart, subscriptionEverStarted } from './billing-cycles';
import { claimStripeKey, fulfillmentKey, lockSubscriptionIdentity } from './stripe-fulfillment-ledger';
import { Subscription, SubscriptionStatus } from './subscription.entity';
import { SubscriptionInvite } from './subscription-invite.entity';
import { TokenLedger } from './token-ledger.entity';

const ACTIVE_STATUSES = ['active', 'trialing', 'canceling'];

/**
 * Local statuses that still hold a billable Stripe subscription. A new subscription checkout is refused for
 * these (and a webhook for a different Stripe subscription may not replace them). Entitlement is unchanged:
 * access is still decided by ACTIVE_STATUSES / SubscriptionGuard.
 */
export const LIVE_SUBSCRIPTION_STATUSES: SubscriptionStatus[] = ['active', 'trialing', 'canceling', 'past_due'];

/** Stripe subscription statuses that can still bill (or are about to): a second checkout would duplicate them. */
const STRIPE_BILLABLE_STATUSES = ['active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'paused'];

const TRIAL_PERIOD_DAYS = 14;
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
    em?: EntityManager,
  ): Promise<void> {
    const tokenRepo = em ? em.getRepository(TokenLedger) : this.tokenRepo;
    const now = new Date();
    const expiryDays =
      type === 'paid' ? TOKEN_EXPIRY_DAYS :
      type === 'promotional' ? PROMOTIONAL_EXPIRY_DAYS :
      COURTESY_EXPIRY_DAYS;

    const expiresAt = new Date(now.getTime() + expiryDays * 24 * 60 * 60 * 1000);

    const entries = Array.from({ length: count }, () =>
      tokenRepo.create({
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

    await tokenRepo.save(entries);
  }

  async getActiveTokenCount(userId: string): Promise<number> {
    await this.expireStaleTokens(userId);
    return this.tokenRepo.count({
      where: { userId, status: 'active', expiresAt: MoreThan(new Date()) },
    });
  }

  private async expireStaleTokens(userId: string, em?: EntityManager): Promise<void> {
    await (em ? em.getRepository(TokenLedger) : this.tokenRepo).update(
      { userId, status: 'active', expiresAt: LessThan(new Date()) },
      { status: 'expired' },
    );
  }

  /**
   * Redeems ONE token for ONE book, atomically (payment-safety correction, PO authorization 2026-11-13).
   *
   * One transaction: pick and consume the oldest active token with a row lock (the user's own pool first, then the
   * pool of the Duo/Family plan the user is linked to — unchanged order), then create the ownership row. If the
   * ownership row cannot be created (already owned — including a concurrent redemption of the same book), the
   * transaction rolls back and the token is NOT consumed. Two concurrent redemptions can therefore never spend one
   * token twice, and two members drawing from one shared pool get distinct tokens. Token economics, expiry and
   * permanent ownership are unchanged. No migration.
   */
  async redeemToken(userId: string, bookId: string): Promise<void> {
    const book = await this.bookRepo.findOneBy({ id: bookId, isPublished: true });
    if (!book) throw new NotFoundException('Book not found');

    await this.subRepo.manager.transaction(async (tx) => {
      // Fast path; the authoritative check is the ON CONFLICT insert below.
      if (await tx.getRepository(UserBook).existsBy({ userId, bookId })) {
        throw new BadRequestException({ error: 'already_owned' });
      }

      await this.expireStaleTokens(userId, tx);
      let consumed = await this.consumeOldestToken(tx, userId, bookId);

      if (!consumed) {
        const ownerSub = await tx.getRepository(Subscription)
          .createQueryBuilder('sub')
          .where(':userId = ANY(sub."linkedUserIds")', { userId })
          .andWhere('sub.status IN (:...statuses)', { statuses: ACTIVE_STATUSES })
          .getOne();
        if (ownerSub) {
          await this.expireStaleTokens(ownerSub.userId, tx);
          consumed = await this.consumeOldestToken(tx, ownerSub.userId, bookId);
        }
      }

      if (!consumed) throw new ForbiddenException({ error: 'no_tokens_remaining' });

      const inserted = await tx.query(
        `INSERT INTO user_books ("userId", "bookId", "purchaseType") VALUES ($1, $2, 'token')
         ON CONFLICT ("userId", "bookId") DO NOTHING RETURNING id`,
        [userId, bookId],
      );
      // Already owned (e.g. a concurrent redemption of the same book won): throwing rolls the token back.
      if (!Array.isArray(inserted) || inserted.length === 0) throw new BadRequestException({ error: 'already_owned' });
    });
  }

  /**
   * Consumes the oldest active, unexpired token of `ownerId` inside `tx`. SKIP LOCKED lets concurrent redemptions
   * take DIFFERENT tokens of a shared pool without waiting. When every remaining candidate is locked by another
   * redemption, it then waits for that one (plain FOR UPDATE): if it committed, the token is gone (none returned);
   * if it rolled back, the token is still active and is consumed here — so a rolled-back competitor never causes a
   * false "no tokens remaining".
   */
  private async consumeOldestToken(tx: EntityManager, ownerId: string, bookId: string): Promise<string | null> {
    const consume = (lockClause: string) => tx.query(
      `UPDATE token_ledger SET status = 'redeemed', "redeemedAt" = now(), "bookId" = $2
        WHERE id = (SELECT id FROM token_ledger
                     WHERE "userId" = $1 AND status = 'active' AND "expiresAt" > now()
                     ORDER BY "issuedAt" ASC, id ASC LIMIT 1 ${lockClause})
        RETURNING id`,
      [ownerId, bookId],
    );
    // TypeORM returns [rows, rowCount] for UPDATE on PostgreSQL.
    const idOf = (res: any): string | null => {
      const rows = Array.isArray(res?.[0]) ? res[0] : res;
      return Array.isArray(rows) && rows.length > 0 ? rows[0].id : null;
    };
    for (let attempt = 0; attempt < 5; attempt++) {
      const free = idOf(await consume('FOR UPDATE SKIP LOCKED'));
      if (free) return free;
      const waited = idOf(await consume('FOR UPDATE'));
      if (waited) return waited;
      // The token we waited for was consumed by the competitor; stop when no active token remains at all.
      const left = await tx.query(
        `SELECT count(*)::int AS n FROM token_ledger WHERE "userId" = $1 AND status = 'active' AND "expiresAt" > now()`,
        [ownerId],
      );
      if (!left?.[0]?.n) return null;
    }
    return null;
  }

  /**
   * Daily scheduler for the annual-plan monthly allocations (D2, D3). Errors are caught per subscription so a
   * failure never crashes the scheduler or blocks other subscribers. Runs at 01:00 (distinct from the 02:00
   * persona cron). Safe to run on any number of API instances and to re-run: see issueDueAnnualCycles.
   */
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async issueAnnualPlanTokensCron(): Promise<void> {
    try {
      await this.issueMonthlyTokensForAnnualPlans();
    } catch (err) {
      this.logger.error(
        'Annual-plan monthly token issuance failed',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  /**
   * Annual plans are billed once a year: the annual invoice grants paid cycle 0 (issueTokensForNewSubscription)
   * and this scheduler grants cycles 1…11 on calendar-month anniversaries of the paid period — exactly 12 paid
   * allocations per annual billing period (D2; the T-1 trial allocation is separate and additional).
   *
   * Candidates are local annual rows that are `active` or `canceling` (D3: a subscription cancelled at period end
   * keeps its allocations until the paid period expires). `nextTokenIssuanceAt` is only a hint — the earliest
   * moment anything can be due — so a subscription is checked with Stripe at most when something may be due.
   */
  async issueMonthlyTokensForAnnualPlans(now: Date = new Date()): Promise<void> {
    const rows = await this.subRepo.find({
      where: { status: In(['active', 'canceling']) },
      relations: ['plan'],
    });
    for (const row of rows) {
      if (row.plan?.interval !== 'year' || !row.stripeSubscriptionId) continue;
      if (row.nextTokenIssuanceAt && row.nextTokenIssuanceAt > now) continue; // nothing can be due yet
      try {
        await this.issueDueAnnualCycles(row.stripeSubscriptionId, now);
      } catch (err) {
        this.logger.error(`[annual-cycles] ${row.stripeSubscriptionId}: ${(err as Error)?.message}`);
      }
    }
  }

  /**
   * Grants the due scheduled cycles of ONE annual subscription's CURRENT paid period.
   *
   * Authoritative data comes from Stripe at run time: status, `current_period_start` / `current_period_end` and
   * `billing_cycle_anchor` (UTC). Cycle k is due at the k-th calendar-month anniversary (monthlyAnniversary:
   * Jan 31 → Feb 28/29…, Feb 29 → Mar 29…), only if strictly inside the paid period — the next period's tokens are
   * never granted early, and nothing is granted once the period has expired (D2, D3).
   *
   * Eligible Stripe statuses: `active` (which includes cancel-at-period-end, D3). Not `past_due`/`unpaid` (failed
   * renewal), `canceled` (immediate termination or expired), or `trialing` (the trial grant is T-1).
   *
   * Exactly once, across any number of scheduler instances and crashes: each cycle is claimed with
   * `fulfillment:annual-cycle:<sub>:<periodStart>:<k>` in the same transaction as its tokens.
   */
  async issueDueAnnualCycles(stripeSubscriptionId: string, now: Date = new Date()): Promise<number> {
    const s = (await this.requireStripe().subscriptions.retrieve(stripeSubscriptionId)) as any;
    const item = s.items?.data?.[0];
    const start = s.current_period_start ?? item?.current_period_start;
    const end = s.current_period_end ?? item?.current_period_end;
    if (s.status !== 'active' || !start || !end) return 0;
    const periodStart = new Date(start * 1000);
    const periodEnd = new Date(end * 1000);
    const anchor = new Date((s.billing_cycle_anchor ?? start) * 1000);
    const cycles = annualScheduledCycles(periodStart, periodEnd, anchor);
    const due = now < periodEnd ? cycles.filter((c) => c.due <= now) : [];
    const upcoming = cycles.find((c) => c.due > now)?.due ?? periodEnd; // next hint: next cycle or renewal

    return this.subRepo.manager.transaction(async (tx) => {
      const subRepo = tx.getRepository(Subscription);
      const row = await subRepo.findOne({ where: { stripeSubscriptionId }, relations: ['plan'] });
      if (!row?.plan || row.plan.interval !== 'year' || !['active', 'canceling'].includes(row.status)) return 0;
      let granted = 0;
      for (const { k } of due) {
        const key = fulfillmentKey('annual-cycle', `${stripeSubscriptionId}:${start}:${k}`);
        if (!(await claimStripeKey(tx, key, 'fulfillment:annual-cycle'))) continue;
        await this.issueTokens(row.userId, row.plan.tokensPerCycle, 'paid', {
          subscriptionId: row.id,
          reason: 'Annual plan monthly issuance',
        }, tx);
        granted++;
      }
      await subRepo.update(row.id, { nextTokenIssuanceAt: upcoming });
      return granted;
    });
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

  /**
   * Creates a subscription Checkout session — only when the user provably holds no billable subscription.
   *
   * Invariant (enforced here, independently of the web client): one Noetia user never starts a second
   * billable Stripe subscription. Under a per-user transaction-scoped advisory lock (no schema change):
   *   1. local record in a live status → 409 `subscription_exists` (fail closed; `POST /subscriptions/sync`
   *      reconciles a stale record);
   *   2. open subscription-mode Checkout sessions are listed BEFORE the subscription check, so a session that
   *      completes mid-request is either still listed (and handled in step 4) or already a subscription (step 3);
   *   3. Stripe is asked for the customer's billable subscriptions — this covers a missing/stale local record
   *      and a delayed webhook. Any Stripe failure → 503 `subscription_status_unavailable`, never "no subscription";
   *   4. an open session for the same plan is reused (repeated clicks, retries); any other open session is
   *      expired first — if it can no longer be expired it may be completing → 409 `checkout_pending`.
   * Nothing is ever cancelled. Price, trial length and terms are unchanged.
   */
  async createCheckoutSession(userId: string, planId: string): Promise<{ url: string }> {
    const plan = await this.plansService.findById(planId);
    if (!plan) throw new BadRequestException({ error: 'invalid_plan' });
    const stripe = this.requireStripe();

    return this.withCheckoutLock(userId, async () => {
      const local = await this.subRepo.findOneBy({ userId });
      if (local && LIVE_SUBSCRIPTION_STATUSES.includes(local.status)) {
        throw new ConflictException({ error: 'subscription_exists', status: local.status });
      }

      const customerId = await this.getOrCreateStripeCustomer(userId);
      const customerIds = [...new Set([customerId, local?.stripeCustomerId].filter((c): c is string => !!c))];

      let openSessions: Array<{ id: string; url: string | null; metadata?: Record<string, string> | null }>;
      let trialEligible: boolean;
      try {
        const sessions = await stripe.checkout.sessions.list({ customer: customerId, status: 'open', limit: 100 });
        // A first page is not an inventory: with more pages, an unseen open session could still complete.
        if (sessions.has_more) throw new Error('checkout session list truncated'); // → 503, fail safe
        openSessions = sessions.data.filter((cs) => cs.mode === 'subscription');
        const user = await this.usersService.findById(userId);
        const history = await this.inspectStripeSubscriptionHistory(stripe, customerIds, user?.email ?? null);
        if (history.billable) {
          const billable = history.billable;
          this.logger.warn(
            `[checkout-guard] blocked: Stripe subscription ${billable.id} (${billable.status}) exists for user ${userId}; ` +
            `local status ${local?.status ?? 'missing'}`,
          );
          throw new ConflictException({ error: 'subscription_exists', status: this.mapStripeStatus(billable.status, billable.cancel_at_period_end) });
        }
        // D1: one 14-day trial per eligible customer — none for anyone with own subscription history.
        trialEligible = !local?.stripeSubscriptionId && !history.started;
      } catch (err) {
        if (err instanceof HttpException) throw err;
        this.logger.error(`[checkout-guard] could not verify Stripe subscription state for user ${userId}: ${(err as Error)?.message}`);
        throw new ServiceUnavailableException({ error: 'subscription_status_unavailable' });
      }

      // Reuse only a session with the same plan AND the same trial offer (a session from before D1 has no
      // `noetiaTrial` tag and carried a trial).
      const trialTag = trialEligible ? 'yes' : 'no';
      const reusable = openSessions.find(
        (cs) => cs.metadata?.noetiaPlanId === planId && (cs.metadata?.noetiaTrial ?? 'yes') === trialTag && cs.url,
      );
      if (reusable) return { url: reusable.url! };
      for (const cs of openSessions) {
        try {
          await stripe.checkout.sessions.expire(cs.id);
        } catch {
          throw new ConflictException({ error: 'checkout_pending' });
        }
      }

      try {
        const session = await stripe.checkout.sessions.create({
          customer: customerId,
          payment_method_types: ['card'],
          line_items: [{ price: plan.stripePriceId, quantity: 1 }],
          mode: 'subscription',
          // D1: the 14-day trial only for an eligible first-time customer; a returning subscriber is billed now.
          ...(trialEligible ? { subscription_data: { trial_period_days: TRIAL_PERIOD_DAYS } } : {}),
          metadata: { noetiaUserId: userId, noetiaPlanId: planId, noetiaTrial: trialTag },
          success_url: `${this.webUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${this.webUrl}/billing/cancel`,
        });
        return { url: session.url! };
      } catch (err) {
        return this.recoverAmbiguousCheckoutCreate(stripe, customerId, planId, userId, err, trialTag);
      }
    });
  }

  /**
   * A create that failed AMBIGUOUSLY (network error/timeout or Stripe 5xx: Stripe may have created the session
   * but the response was lost — stripe-node's own retries already reuse one idempotency key) must not be
   * followed by another create. Still under the checkout lock: re-list open sessions and return the one for
   * this plan if Stripe did create it; otherwise 409 `checkout_pending`, so the user's retry goes through the
   * guard again (which reuses the session once it is visible). A definitive Stripe rejection is re-thrown
   * unchanged (nothing was created).
   */
  private async recoverAmbiguousCheckoutCreate(
    stripe: InstanceType<typeof Stripe>,
    customerId: string,
    planId: string,
    userId: string,
    err: unknown,
    trialTag: 'yes' | 'no' = 'yes',
  ): Promise<{ url: string }> {
    const type = (err as { type?: string } | null)?.type;
    if (type !== 'StripeConnectionError' && type !== 'StripeAPIError') throw err;
    this.logger.warn(`[checkout-guard] ambiguous session create for user ${userId} (${type}); checking for a created session`);
    try {
      const sessions = await stripe.checkout.sessions.list({ customer: customerId, status: 'open', limit: 100 });
      const created = sessions.data.find(
        (cs) => cs.mode === 'subscription' && cs.metadata?.noetiaPlanId === planId && (cs.metadata?.noetiaTrial ?? 'yes') === trialTag && cs.url,
      );
      if (created) return { url: created.url! };
    } catch {
      // fall through: still unknown → do not create
    }
    throw new ConflictException({ error: 'checkout_pending' });
  }

  /**
   * D1 — one Stripe pass over the customer's FULL subscription history (`status: 'all'`, including canceled):
   *   - `billable`: a subscription that can still bill (the duplicate guard, unchanged rule);
   *   - `started`: any subscription that ever started (trial received, or past `incomplete_expired`).
   * Customers searched: every Stripe customer id known for this Noetia user, plus other Stripe customers carrying
   * the same account e-mail (a deterred-but-not-proven signal for a deleted-and-recreated account; only the
   * e-mail the person gave Noetia, no fingerprinting). Only `started` is read from those other customers — a live
   * subscription there belongs to a different Noetia account, not a duplicate of this one.
   * Any truncated list or Stripe error throws → the caller fails safe (no checkout, never a surprise charge).
   */
  private async inspectStripeSubscriptionHistory(
    stripe: InstanceType<typeof Stripe>,
    customerIds: string[],
    email: string | null,
  ): Promise<{ billable: any | null; started: boolean }> {
    let billable: any = null;
    let started = false;
    const scan = async (customer: string, own: boolean) => {
      const subs = await stripe.subscriptions.list({ customer, status: 'all', limit: 100 });
      if (subs.has_more) throw new Error('subscription history truncated'); // cannot prove the history → fail safe
      for (const sub of subs.data as any[]) {
        if (own && !billable && STRIPE_BILLABLE_STATUSES.includes(sub.status)) billable = sub;
        if (subscriptionEverStarted(sub)) started = true;
      }
    };
    for (const customer of customerIds) await scan(customer, true);
    if (email) {
      const others = await stripe.customers.list({ email, limit: 100 });
      if (others.has_more) throw new Error('customer list truncated');
      for (const c of others.data) if (!customerIds.includes(c.id)) await scan(c.id, false);
    }
    return { billable, started };
  }

  /**
   * D1 / D6 — whether a 14-day trial would be offered to this user right now (same rules as checkout, read-only,
   * no lock). `null` when it cannot be verified (Stripe unavailable or not configured): callers must then not
   * advertise a trial, and checkout itself fails safe.
   */
  async getTrialEligibility(userId: string): Promise<boolean | null> {
    const local = await this.subRepo.findOneBy({ userId });
    if (local?.stripeSubscriptionId) return false; // own subscription history in Noetia
    if (!this.stripe) return null;
    try {
      const user = await this.usersService.findById(userId);
      const customerIds = [user?.stripeCustomerId, local?.stripeCustomerId].filter((c): c is string => !!c);
      const history = await this.inspectStripeSubscriptionHistory(this.stripe, [...new Set(customerIds)], user?.email ?? null);
      return !history.started;
    } catch (err) {
      this.logger.warn(`[trial-eligibility] could not verify for user ${userId}: ${(err as Error)?.message}`);
      return null;
    }
  }

  /**
   * Serializes subscription-checkout attempts per user with a PostgreSQL transaction-scoped advisory lock
   * (released on commit/rollback, works across API instances, needs no table or migration).
   */
  private withCheckoutLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
    return this.subRepo.manager.transaction(async (em) => {
      await em.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`subscription-checkout:${userId}`]);
      return fn();
    });
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
      success_url: `${this.webUrl}/billing/success?purchase=book&session_id={CHECKOUT_SESSION_ID}`,
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
      success_url: `${this.webUrl}/billing/success?purchase=tokens&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${this.webUrl}/billing/cancel`,
    });
    return { url: session.url! };
  }

  /** Called inside the webhook transaction, after the Checkout session's fulfillment key was claimed. */
  async issueTokensForPurchasedPackage(tokenPackageId: string, userId: string, em?: EntityManager): Promise<void> {
    const pkg = await this.plansService.findTokenPackageById(tokenPackageId);
    if (!pkg) {
      this.logger.warn(`Token package not found for id: ${tokenPackageId}`);
      return;
    }
    await this.issueTokens(userId, pkg.tokenCount, 'paid', {
      reason: `Purchased ${pkg.name}`,
    }, em);
  }

  /**
   * Idempotent on the (userId, bookId) unique constraint. ON CONFLICT DO NOTHING (not catch-23505) because a
   * failed statement would abort the surrounding webhook transaction.
   */
  async addPurchasedBook(userId: string, bookId: string, em?: EntityManager): Promise<void> {
    const repo = em ? em.getRepository(UserBook) : this.userBookRepo;
    await repo
      .createQueryBuilder()
      .insert()
      .values({ userId, bookId, purchaseType: 'purchase' })
      .orIgnore()
      .execute();
  }

  /**
   * Cycle tokens for an ELIGIBLE invoice — a renewal (`subscription_cycle`, including a valid $0 renewal) or a paid
   * creation without a trial; WebhooksService.handleInvoicePaid classifies (D4, D5). Requires the row's plan.
   *
   * Exactly once per billing period: claims `fulfillment:period-tokens:<sub>:<periodStart>` (the period the invoice
   * pays for) AND the invoice-id key, in the webhook transaction — so duplicate deliveries, different event ids
   * and a voided-and-reissued invoice for the same period all grant once. The period always comes from Stripe: the
   * payload's subscription line, else Stripe's line items for the invoice, else the event fails closed (F-02). Annual plans: this is paid cycle 0 of the
   * period; the scheduler grants cycles 1…11 (its hint is reset so the new period is checked promptly).
   */
  async issueTokensForNewSubscription(
    stripeSubscriptionId: string,
    em?: EntityManager,
    invoiceId?: string | null,
    periodStart?: number | null,
  ): Promise<void> {
    const subRepo = em ? em.getRepository(Subscription) : this.subRepo;
    const sub = await subRepo.findOne({
      where: { stripeSubscriptionId },
      relations: ['plan'],
    });
    if (!sub?.plan) return;

    if (em && !periodStart) {
      // F-02: the webhook payload did not carry the subscription line (Stripe embeds only the first lines, with
      // pending prorations first). Read the billing period from Stripe's own line items for this invoice; if it
      // still cannot be determined, fail CLOSED: throw, so the whole webhook transaction rolls back — nothing is
      // allocated and nothing is recorded as fulfilled — and Stripe retries the event. Never allocate on the
      // invoice id alone, which cannot deduplicate a different invoice for the same period.
      periodStart = invoiceId ? await this.resolveInvoicePeriodStart(invoiceId) : null;
      if (!periodStart) {
        throw new Error(`[invoice-period] billing period of invoice ${invoiceId ?? '(no id)'} (${stripeSubscriptionId}) could not be determined — not allocating; Stripe will retry`);
      }
    }

    if (em && periodStart && !(await claimStripeKey(em, fulfillmentKey('period-tokens', `${stripeSubscriptionId}:${periodStart}`), 'fulfillment:period-tokens'))) {
      this.logger.warn(`Tokens for period ${periodStart} of ${stripeSubscriptionId} already issued — not issuing again`);
      return;
    }
    if (em && invoiceId && !(await claimStripeKey(em, fulfillmentKey('invoice-tokens', invoiceId), 'fulfillment:invoice-tokens'))) {
      this.logger.warn(`Tokens for invoice ${invoiceId} already issued — not issuing again`);
      return;
    }

    await this.issueTokens(sub.userId, sub.plan.tokensPerCycle, 'paid', {
      subscriptionId: sub.id,
      reason: 'Subscription renewal',
    }, em);

    if (sub.plan.interval === 'year') {
      // Paid cycle 0 granted; let the scheduler read the new period from Stripe at its next run.
      await subRepo.update(sub.id, { nextTokenIssuanceAt: null });
    }
  }

  /**
   * @param options.includeTrialEligibility — D6: adds `trialEligible` (true / false / null = unverifiable). Opt-in,
   *   because it may call Stripe; only the pricing page and the mobile paywall ask for it.
   */
  /**
   * F-02 — the billed period's start (unix seconds) from Stripe's paginated line items of `invoiceId` (authoritative;
   * same subscription-line rule as invoicePeriodStart). null when no subscription line exists after reading every
   * page (bounded). A Stripe error propagates (the webhook is retried).
   */
  async resolveInvoicePeriodStart(invoiceId: string): Promise<number | null> {
    const stripe = this.requireStripe();
    let startingAfter: string | undefined;
    for (let page = 0; page < 20; page++) {
      const res = await stripe.invoices.listLineItems(invoiceId, { limit: 100, ...(startingAfter ? { starting_after: startingAfter } : {}) });
      const found = invoicePeriodStart({ lines: { data: res.data } });
      if (found !== null) return found;
      if (!res.has_more || res.data.length === 0) return null;
      startingAfter = res.data[res.data.length - 1].id;
    }
    return null;
  }

  async getSubscriptionStatus(userId: string, options: { includeTrialEligibility?: boolean } = {}) {
    const status = await this.readSubscriptionStatus(userId);
    if (!options.includeTrialEligibility) return status;
    return { ...status, trialEligible: await this.getTrialEligibility(userId) };
  }

  private async readSubscriptionStatus(userId: string) {
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

  /**
   * Applies a webhook-derived subscription state to the user's single subscription row.
   *
   * Identity guard: the row may only switch to a DIFFERENT Stripe subscription when the current one is no
   * longer live AND the incoming one is live (a legitimate re-subscription). Otherwise the event is ignored
   * and logged — never silently overwriting a live subscription (duplicate) and never letting a late event
   * from an old subscription corrupt the current one. Nothing is cancelled or deleted.
   *
   * `planId` is written only when the caller passes it (unchanged behaviour: only
   * `customer.subscription.updated` does — see the trial-token STOP gate in the stabilization report).
   *
   * Atomicity: the read, the identity comparison and the write run in ONE transaction under a per-user
   * advisory lock (`subscription-identity:<userId>`), so two concurrent webhooks for different Stripe
   * subscriptions are serialized — the second one reads the row the first one committed and is rejected.
   * Without the lock both could read "no row / ended row" and the later upsert would silently replace the
   * earlier live subscription. Uses the caller's transaction when given (the webhook transaction).
   *
   * @returns true when the state was applied.
   */
  async upsertFromWebhook(
    stripeEventId: string,
    stripeCustomerId: string,
    stripeSubscriptionId: string,
    status: SubscriptionStatus,
    currentPeriodEnd: Date,
    trialEnd: Date | null,
    planId?: string | null,
    em?: EntityManager,
  ): Promise<boolean> {
    return this.inTransaction(em, async (tx) => {
      const user = await tx.getRepository(User).findOneBy({ stripeCustomerId });
      if (!user) {
        this.logger.warn(`No user found for stripeCustomerId: ${stripeCustomerId}`);
        return false;
      }
      await lockSubscriptionIdentity(tx, user.id);
      const subRepo = tx.getRepository(Subscription);
      // Read AFTER the lock: READ COMMITTED gives this statement every commit made before the lock was granted.
      const existing = await subRepo.findOneBy({ userId: user.id });
      if (existing?.stripeEventId === stripeEventId) return false;

      if (existing?.stripeSubscriptionId && existing.stripeSubscriptionId !== stripeSubscriptionId) {
        const currentLive = LIVE_SUBSCRIPTION_STATUSES.includes(existing.status);
        const incomingLive = LIVE_SUBSCRIPTION_STATUSES.includes(status);
        if (currentLive || !incomingLive) {
          const detail =
            `user=${user.id} current=${existing.stripeSubscriptionId}(${existing.status}) ` +
            `incoming=${stripeSubscriptionId}(${status}) event=${stripeEventId}`;
          if (currentLive && incomingLive) {
            // Two billable subscriptions for one user: needs manual review (refund/cancel is a human decision).
            this.logger.error(`[subscription-identity] DUPLICATE_LIVE_SUBSCRIPTION ${detail}`);
          } else {
            this.logger.warn(`[subscription-identity] IGNORED_OTHER_SUBSCRIPTION_EVENT ${detail}`);
          }
          return false;
        }
      }

      await subRepo.upsert(
        { userId: user.id, stripeCustomerId, stripeSubscriptionId, status, currentPeriodEnd, trialEnd, stripeEventId, ...(planId !== undefined ? { planId } : {}) },
        { conflictPaths: ['userId'] },
      );
      return true;
    });
  }

  /** Runs `fn` in the caller's transaction, or in a new one. */
  private inTransaction<T>(em: EntityManager | undefined, fn: (tx: EntityManager) => Promise<T>): Promise<T> {
    return em ? fn(em) : this.subRepo.manager.transaction(fn);
  }

  /**
   * Re-reads a subscription from Stripe and applies its CURRENT state through the identity guard, so the
   * result does not depend on webhook delivery order (a late or replayed event writes today's truth, not the
   * state captured in its payload). A Stripe failure throws, so the webhook is retried by Stripe.
   *
   * T-1 (PO decision, 2026-11-13): `planId` is recorded from Stripe's current price on EVERY subscription event
   * (previously only `customer.subscription.updated`), and when Stripe reports the subscription `trialing`, the
   * plan's initial cycle of tokens is granted once per Stripe subscription (issueTrialStartTokens) — whichever
   * event (created / checkout completed / updated / the $0 trial invoice) is processed first.
   */
  async applyStripeSubscription(
    stripeEventId: string,
    stripeSubscriptionId: string,
    em?: EntityManager,
  ): Promise<boolean> {
    const sub = (await this.requireStripe().subscriptions.retrieve(stripeSubscriptionId)) as any;
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
    if (!customerId) return false;
    const periodEnd = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end;
    const priceId = sub.items?.data?.[0]?.price?.id;
    const planId = priceId ? await this.findPlanByStripePriceId(priceId) : null;
    const applied = await this.upsertFromWebhook(
      stripeEventId,
      customerId,
      sub.id,
      this.mapStripeStatus(sub.status, !!sub.cancel_at_period_end),
      periodEnd ? new Date(periodEnd * 1000) : new Date(),
      sub.trial_end ? new Date(sub.trial_end * 1000) : null,
      planId,
      em,
    );
    // Only for the subscription the row now tracks (an identity-rejected duplicate gets nothing), and only
    // inside the webhook transaction, so the grant and its fulfillment key commit or roll back together.
    if (applied && em && sub.status === 'trialing' && sub.trial_end) {
      await this.issueTrialStartTokens(sub.id, em);
    }
    return applied;
  }

  /**
   * T-1: the plan's first cycle of tokens when a valid free trial begins — exactly once per Stripe subscription,
   * enforced by the `fulfillment:trial-start-tokens:<stripeSubscriptionId>` key in the webhook transaction
   * (distinct from the per-invoice renewal keys). Same quantity (`tokensPerCycle`), type (`paid`) and 90-day
   * expiry as a renewal grant. Does not touch `nextTokenIssuanceAt`: annual plans start their monthly schedule
   * from the first PAID invoice, exactly as before, so the trial cannot shift or add a scheduled cycle.
   * Nothing is clawed back if the trial is cancelled (cancellation behaviour unchanged).
   *
   * @returns true when tokens were issued by this call.
   */
  async issueTrialStartTokens(stripeSubscriptionId: string, em: EntityManager): Promise<boolean> {
    const row = await em.getRepository(Subscription).findOne({ where: { stripeSubscriptionId }, relations: ['plan'] });
    if (!row?.plan) return false; // unknown price → no plan → nothing to grant (and the key stays unclaimed)
    if (!(await claimStripeKey(em, fulfillmentKey('trial-start-tokens', stripeSubscriptionId), 'fulfillment:trial-start-tokens'))) {
      return false;
    }
    await this.issueTokens(row.userId, row.plan.tokensPerCycle, 'paid', {
      subscriptionId: row.id,
      reason: 'Trial start (initial cycle)',
    }, em);
    return true;
  }

  /** Same per-user identity lock as upsertFromWebhook, so a delete and a concurrent switch are serialized. */
  async cancelFromWebhook(stripeSubscriptionId: string, em?: EntityManager): Promise<void> {
    await this.inTransaction(em, async (tx) => {
      const subRepo = tx.getRepository(Subscription);
      const rows = await subRepo.find({ where: { stripeSubscriptionId } });
      for (const row of rows) {
        await lockSubscriptionIdentity(tx, row.userId);
        // Re-checks the subscription id after the lock: the row may have switched to a newer subscription.
        await subRepo.update({ id: row.id, stripeSubscriptionId }, { status: 'canceled' });
      }
    });
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
