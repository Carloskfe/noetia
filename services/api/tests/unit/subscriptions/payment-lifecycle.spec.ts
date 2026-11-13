// Payment lifecycle — event-order matrix. REAL WebhooksService + REAL SubscriptionsService; in-memory stand-ins
// for the subscriptions / users / token-ledger / processed-events tables and a stateful fake Stripe client.
// The fake transaction snapshots every table and restores it when the callback throws (rollback), and the
// claim INSERT honours the primary key — so atomicity and crash/retry behaviour are exercised here; true
// concurrency is evidenced against real PostgreSQL (see the PR #60 report, payment-safety harness).
// No database, no network, no real Stripe. Synthetic ids only.
import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Book } from '../../../src/books/book.entity';
import { EmailService } from '../../../src/email/email.service';
import { GiftsService } from '../../../src/gifts/gifts.service';
import { UserBook } from '../../../src/library/user-book.entity';
import { PushService } from '../../../src/push/push.service';
import { PlansService } from '../../../src/subscriptions/plans.service';
import { StripeProcessedEvent } from '../../../src/subscriptions/stripe-processed-event.entity';
import { SubscriptionInvite } from '../../../src/subscriptions/subscription-invite.entity';
import { Subscription } from '../../../src/subscriptions/subscription.entity';
import { SubscriptionsService } from '../../../src/subscriptions/subscriptions.service';
import { TokenLedger } from '../../../src/subscriptions/token-ledger.entity';
import { WebhooksService } from '../../../src/subscriptions/webhooks.service';
import { User } from '../../../src/users/user.entity';
import { UsersService } from '../../../src/users/users.service';

// ── fake Stripe ────────────────────────────────────────────────────────────────
type FakeSub = { id: string; customer: string; status: string; cancel_at_period_end: boolean; current_period_end: number; trial_end: number | null; trial_start?: number | null; current_period_start?: number; billing_cycle_anchor?: number; items: { data: Array<{ price: { id: string } }> } };
const stripeState = { subs: new Map<string, FakeSub>(), sessions: [] as any[], failRetrieve: false };
const fakeStripe = {
  customers: { create: jest.fn(async () => ({ id: 'cus_1' })), list: jest.fn(async () => ({ data: [], has_more: false })) },
  subscriptions: {
    retrieve: jest.fn(async (id: string) => {
      if (stripeState.failRetrieve) throw new Error('stripe unavailable');
      const s = stripeState.subs.get(id);
      if (!s) throw new Error('No such subscription');
      return { ...s };
    }),
    list: jest.fn(async ({ customer, status }: { customer: string; status?: string }) => ({
      // status 'all' = the full history (D1); the default listing omits canceled subscriptions.
      data: [...stripeState.subs.values()].filter((s) => s.customer === customer && (status === 'all' || s.status !== 'canceled')),
      has_more: false,
    })),
    update: jest.fn(),
  },
  checkout: {
    sessions: {
      list: jest.fn(async () => ({ data: stripeState.sessions.filter((s) => s.status === 'open'), has_more: false })),
      expire: jest.fn(async (id: string) => { stripeState.sessions.find((s) => s.id === id).status = 'expired'; }),
      create: jest.fn(async (p: any) => {
        const cs = { id: `cs_${stripeState.sessions.length + 1}`, status: 'open', mode: p.mode, url: `https://checkout.test/${stripeState.sessions.length + 1}`, metadata: p.metadata };
        stripeState.sessions.push(cs);
        return cs;
      }),
    },
  },
  billingPortal: { sessions: { create: jest.fn() } },
};
jest.mock('stripe', () => jest.fn().mockImplementation(() => fakeStripe));
const lastSession = (): any => (fakeStripe.checkout.sessions.create.mock.calls as any[][]).at(-1)![0];

// ── in-memory tables ─────────────────────────────────────────────────────────
const PLAN = { id: 'plan-ind', stripePriceId: 'price_ind', tokensPerCycle: 1, interval: 'month', maxProfiles: 1 };
const PLAN_ANNUAL = { id: 'plan-ind-y', stripePriceId: 'price_ind_y', tokensPerCycle: 1, interval: 'year', maxProfiles: 1 };
const PLANS = [PLAN, PLAN_ANNUAL];
const planOf = (id: string | null) => PLANS.find((p) => p.id === id) ?? null;
let subRow: any; // uq_subscriptions_user: at most one row per user (single synthetic user here)
let tokens: any[];
let processed: Set<string>;
let ownedBooks: Set<string>;
const USER = { id: 'u1', email: 'synthetic@test.invalid', stripeCustomerId: 'cus_1' };
const PACKAGE = { id: 'pkg-1', name: '1 Token', tokenCount: 1, stripePriceId: 'price_pkg_1' };

const subRepo = {
  findOneBy: jest.fn(async (w: any) => {
    if (!subRow) return null;
    if (w.userId && w.userId !== subRow.userId) return null;
    if (w.stripeSubscriptionId && w.stripeSubscriptionId !== subRow.stripeSubscriptionId) return null;
    return { ...subRow };
  }),
  findOne: jest.fn(async ({ where }: any) => {
    if (!subRow) return null;
    if (where.stripeSubscriptionId && where.stripeSubscriptionId !== subRow.stripeSubscriptionId) return null;
    if (where.userId && where.userId !== subRow.userId) return null;
    return { ...subRow, plan: planOf(subRow.planId) };
  }),
  upsert: jest.fn(async (v: any) => { subRow = { id: 'row-1', linkedUserIds: [], planId: null, nextTokenIssuanceAt: null, ...(subRow ?? {}), ...v }; }),
  update: jest.fn(async (where: any, v: any) => {
    if (!subRow) return;
    const match = typeof where === 'string' ? where === subRow.id : where.stripeSubscriptionId === subRow.stripeSubscriptionId;
    if (match) subRow = { ...subRow, ...v };
  }),
  createQueryBuilder: jest.fn(() => ({ leftJoinAndSelect() { return this; }, where() { return this; }, andWhere() { return this; }, getOne: async () => null })),
  find: jest.fn(async ({ where }: any) => {
    if (!subRow) return [];
    if (where.stripeSubscriptionId) return where.stripeSubscriptionId === subRow.stripeSubscriptionId ? [{ ...subRow }] : [];
    // annual scheduler candidates: { status: In(['active', 'canceling']) }
    const statuses: string[] = where.status?.value ?? [where.status];
    return statuses.includes(subRow.status) ? [{ ...subRow, plan: planOf(subRow.planId) }] : [];
  }),
  manager: { transaction: (fn: any) => transaction(fn) },
};
const tokenRepo = {
  create: jest.fn((v: any) => v),
  save: jest.fn(async (rows: any[]) => { tokens.push(...rows); }),
  count: jest.fn(async () => tokens.length),
  update: jest.fn(),
};
const userRepo = { findOneBy: async (w: any) => (w.stripeCustomerId === USER.stripeCustomerId ? USER : null), update: jest.fn() };
const userBookRepo = {
  createQueryBuilder: () => ({ insert: () => ({ values: (v: any) => ({ orIgnore: () => ({ execute: async () => { ownedBooks.add(`${v.userId}:${v.bookId}`); } }) }) }) }),
};
const processedRepo = { manager: { transaction: (fn: any) => transaction(fn) } };

// Transaction stand-in: claims honour the primary key; a throw restores every table (rollback).
const lockQueries: string[] = [];
const em = {
  getRepository: (entity: unknown) =>
    entity === Subscription ? subRepo : entity === User ? userRepo : entity === TokenLedger ? tokenRepo : entity === UserBook ? userBookRepo : {},
  query: async (sql: string, params: any[]) => {
    if (sql.includes('INSERT INTO stripe_processed_events')) {
      if (processed.has(params[0])) return [];
      processed.add(params[0]);
      return [{ eventId: params[0] }];
    }
    lockQueries.push(`${sql} ${params?.[0]}`);
    return [];
  },
};
async function transaction(fn: (m: typeof em) => Promise<unknown>) {
  const snap = { subRow: subRow ? { ...subRow } : null, tokens: [...tokens], processed: new Set(processed), ownedBooks: new Set(ownedBooks) };
  try {
    return await fn(em);
  } catch (err) {
    subRow = snap.subRow; tokens = snap.tokens; processed = snap.processed; ownedBooks = snap.ownedBooks;
    throw err;
  }
}
const giftsFake = { fulfillGift: jest.fn() };

let webhooks: WebhooksService;
let subscriptions: SubscriptionsService;
let logError: jest.SpyInstance;
const T0 = 1_800_000_000;

beforeEach(async () => {
  jest.clearAllMocks();
  stripeState.subs.clear();
  stripeState.sessions = [];
  stripeState.failRetrieve = false;
  subRow = null;
  tokens = [];
  processed = new Set();
  ownedBooks = new Set();
  lockQueries.length = 0;
  giftsFake.fulfillGift.mockResolvedValue(null);
  const mod = await Test.createTestingModule({
    providers: [
      SubscriptionsService,
      WebhooksService,
      { provide: ConfigService, useValue: { get: (k: string, d?: string) => (k === 'STRIPE_SECRET_KEY' ? 'sk_test_synthetic' : d ?? '') } },
      { provide: UsersService, useValue: { findById: async () => USER } },
      { provide: PlansService, useValue: { findById: async (id: string) => (id === PLAN.id ? PLAN : null), findAll: async () => PLANS, findTokenPackageById: async (id: string) => (id === PACKAGE.id ? PACKAGE : null) } },
      { provide: EmailService, useValue: {} },
      { provide: PushService, useValue: {} },
      { provide: GiftsService, useValue: giftsFake },
      { provide: getRepositoryToken(Subscription), useValue: subRepo },
      { provide: getRepositoryToken(User), useValue: userRepo },
      { provide: getRepositoryToken(Book), useValue: {} },
      { provide: getRepositoryToken(UserBook), useValue: userBookRepo },
      { provide: getRepositoryToken(TokenLedger), useValue: tokenRepo },
      { provide: getRepositoryToken(SubscriptionInvite), useValue: {} },
      { provide: getRepositoryToken(StripeProcessedEvent), useValue: processedRepo },
    ],
  }).compile();
  webhooks = mod.get(WebhooksService);
  subscriptions = mod.get(SubscriptionsService);
  logError = jest.spyOn((subscriptions as any).logger, 'error').mockImplementation(() => undefined);
  jest.spyOn((subscriptions as any).logger, 'warn').mockImplementation(() => undefined);
  jest.spyOn((webhooks as any).logger, 'log').mockImplementation(() => undefined);
  jest.spyOn((webhooks as any).logger, 'warn').mockImplementation(() => undefined);
});

// Stripe-side state changes (what the customer / Stripe did), then the webhooks that describe them.
function stripeHas(id: string, status: string, extra: Partial<FakeSub> = {}, priceId = PLAN.stripePriceId) {
  const prev = stripeState.subs.get(id);
  stripeState.subs.set(id, {
    id, customer: 'cus_1', status, cancel_at_period_end: false, current_period_end: T0 + 30 * 86400,
    trial_end: status === 'trialing' ? T0 + 14 * 86400 : null,
    trial_start: status === 'trialing' ? T0 : prev?.trial_start ?? null, // Stripe keeps trial_start for life
    items: { data: [{ price: { id: priceId } }] }, ...extra,
  });
}
let seq = 0;
const ev = (type: string, object: any, id = `evt_${++seq}`) => webhooks.handleEvent({ id, type, data: { object } } as any).then(() => id);
const created = (sub: string) => ev('customer.subscription.created', { id: sub, customer: 'cus_1' });
const updated = (sub: string) => ev('customer.subscription.updated', { id: sub, customer: 'cus_1', items: { data: [] } });
const completed = (sub: string) => ev('checkout.session.completed', { mode: 'subscription', subscription: sub, customer: 'cus_1' });
let invoiceSeq = 0;
const invoicePaid = (sub: string, id?: string, invoiceId = `in_${++invoiceSeq}`, amountPaid = 899) =>
  ev('invoice.paid', { id: invoiceId, subscription: sub, customer: 'cus_1', amount_paid: amountPaid, billing_reason: 'subscription_cycle' }, id);
/** The $0 invoice Stripe issues when a trial subscription is created. */
const trialInvoice = (sub: string, id?: string, invoiceId = `in_${++invoiceSeq}`) =>
  ev('invoice.paid', { id: invoiceId, subscription: sub, customer: 'cus_1', amount_paid: 0, billing_reason: 'subscription_create' }, id);
const paymentCompleted = (sessionId: string, metadata: Record<string, string>, id?: string) =>
  ev('checkout.session.completed', { id: sessionId, mode: 'payment', metadata }, id);
const deleted = (sub: string) => ev('customer.subscription.deleted', { id: sub });

describe('Event-order matrix (one subscription)', () => {
  it('in-order trial signup: created → completed → $0 invoice → updated(active) → first paid invoice (T-1)', async () => {
    stripeHas('sub_A', 'trialing');
    await created('sub_A');
    expect(subRow).toMatchObject({ stripeSubscriptionId: 'sub_A', status: 'trialing', planId: PLAN.id }); // plan recorded at creation
    expect(tokens).toHaveLength(PLAN.tokensPerCycle); // T-1: initial cycle when the trial begins
    await completed('sub_A');
    expect(subRow.status).toBe('trialing'); // previously written as 'active' from the payload
    await trialInvoice('sub_A');
    expect(tokens).toHaveLength(PLAN.tokensPerCycle); // the $0 invoice grants nothing more
    stripeHas('sub_A', 'active');
    await updated('sub_A');
    expect(subRow).toMatchObject({ status: 'active', planId: PLAN.id });
    expect(tokens).toHaveLength(PLAN.tokensPerCycle);
    await invoicePaid('sub_A'); // first paid cycle (day 15)
    expect(tokens).toHaveLength(2 * PLAN.tokensPerCycle);
  });

  it('$0 trial invoice first (before created/completed) → row from Stripe truth, initial cycle once', async () => {
    stripeHas('sub_A', 'trialing');
    await trialInvoice('sub_A');
    expect(subRow).toMatchObject({ stripeSubscriptionId: 'sub_A', status: 'trialing' });
    await completed('sub_A');
    await created('sub_A');
    expect(subRow.status).toBe('trialing');
    expect(tokens).toHaveLength(PLAN.tokensPerCycle);
  });

  it('late checkout.session.completed after the subscription became active cannot regress status, period or plan', async () => {
    stripeHas('sub_A', 'active');
    await updated('sub_A');
    const before = { ...subRow };
    await completed('sub_A'); // delivered late
    expect(subRow.status).toBe('active');
    expect(subRow.planId).toBe(PLAN.id);
    expect(subRow.currentPeriodEnd).toEqual(before.currentPeriodEnd); // no longer reset to "now"
  });

  it('a late, stale updated (payload trialing) after trial end writes Stripe current state (active)', async () => {
    stripeHas('sub_A', 'active');
    await ev('customer.subscription.updated', { id: 'sub_A', customer: 'cus_1', status: 'trialing', items: { data: [] } });
    expect(subRow.status).toBe('active');
  });

  it('duplicated delivery of invoice.paid does not duplicate token grants', async () => {
    stripeHas('sub_A', 'active');
    await updated('sub_A');
    await invoicePaid('sub_A', 'evt_inv_1', 'in_X');
    await invoicePaid('sub_A', 'evt_inv_1', 'in_X'); // Stripe redelivers the same event
    expect(tokens).toHaveLength(PLAN.tokensPerCycle);
  });

  it('Stripe unavailable during a webhook → error (Stripe retries), nothing recorded; retry succeeds', async () => {
    stripeHas('sub_A', 'trialing');
    stripeState.failRetrieve = true;
    await expect(webhooks.handleEvent({ id: 'evt_r', type: 'customer.subscription.created', data: { object: { id: 'sub_A' } } } as any)).rejects.toThrow();
    expect(subRow).toBeNull();
    expect(processed.has('evt_r')).toBe(false);
    stripeState.failRetrieve = false;
    await webhooks.handleEvent({ id: 'evt_r', type: 'customer.subscription.created', data: { object: { id: 'sub_A' } } } as any);
    expect(subRow.stripeSubscriptionId).toBe('sub_A');
  });

  it('invoice.payment_failed → past_due from Stripe (entitlement rule unchanged)', async () => {
    stripeHas('sub_A', 'active');
    await updated('sub_A');
    stripeHas('sub_A', 'past_due');
    await ev('invoice.payment_failed', { subscription: 'sub_A', customer: 'cus_1' });
    expect(subRow.status).toBe('past_due');
  });
});

describe('Subscription identity (two Stripe subscriptions, one Noetia user)', () => {
  it('a second LIVE subscription never replaces the first; it gets no tokens; an error is logged', async () => {
    stripeHas('sub_A', 'active');
    await updated('sub_A');
    stripeHas('sub_B', 'trialing'); // e.g. created outside the guarded checkout
    await created('sub_B');
    await completed('sub_B');
    await updated('sub_B');
    await invoicePaid('sub_B');
    expect(subRow.stripeSubscriptionId).toBe('sub_A');
    expect(subRow.status).toBe('active');
    expect(tokens).toHaveLength(0);
    expect(logError.mock.calls.some(([m]) => String(m).includes('DUPLICATE_LIVE_SUBSCRIPTION'))).toBe(true);
    expect(fakeStripe.subscriptions.update).not.toHaveBeenCalled(); // nothing cancelled automatically
  });

  it('re-subscription after the old one ended replaces the row; late events of the old one are ignored', async () => {
    stripeHas('sub_A', 'active');
    await updated('sub_A');
    stripeHas('sub_A', 'canceled');
    await deleted('sub_A');
    expect(subRow.status).toBe('canceled');
    stripeHas('sub_B', 'trialing');
    await created('sub_B');
    expect(subRow).toMatchObject({ stripeSubscriptionId: 'sub_B', status: 'trialing' });
    await updated('sub_A'); // late update of the OLD subscription
    await deleted('sub_A'); // late delete of the OLD subscription
    expect(subRow).toMatchObject({ stripeSubscriptionId: 'sub_B', status: 'trialing' });
  });
});

describe('Checkout guard across the lifecycle', () => {
  it('new eligible user → checkout; paid but webhook delayed → second checkout refused; after webhooks → refused', async () => {
    const first = await subscriptions.createCheckoutSession('u1', PLAN.id);
    expect(first.url).toBe('https://checkout.test/1');
    // Repeated click while the first session is open → same session, not a new one.
    expect(await subscriptions.createCheckoutSession('u1', PLAN.id)).toEqual(first);
    // Customer completes payment: Stripe now has the subscription, no webhook yet.
    stripeState.sessions[0].status = 'complete';
    stripeHas('sub_A', 'trialing');
    await expect(subscriptions.createCheckoutSession('u1', PLAN.id)).rejects.toThrow(ConflictException);
    await created('sub_A');
    await expect(subscriptions.createCheckoutSession('u1', PLAN.id)).rejects.toThrow(ConflictException);
    expect(fakeStripe.checkout.sessions.create).toHaveBeenCalledTimes(1);
  });

  it('checkout cancelled (customer left Stripe) → the next attempt reuses the still-open session; no subscription exists', async () => {
    const first = await subscriptions.createCheckoutSession('u1', PLAN.id);
    expect(await subscriptions.createCheckoutSession('u1', PLAN.id)).toEqual(first);
    expect(subRow).toBeNull();
  });

  it('after the subscription ends, the user can subscribe again — WITHOUT a new trial (D1)', async () => {
    stripeHas('sub_A', 'active');
    await updated('sub_A');
    await expect(subscriptions.createCheckoutSession('u1', PLAN.id)).rejects.toThrow(ConflictException);
    stripeHas('sub_A', 'canceled');
    await deleted('sub_A');
    await expect(subscriptions.createCheckoutSession('u1', PLAN.id)).resolves.toHaveProperty('url');
    const params = lastSession();
    expect(params).not.toHaveProperty('subscription_data');
    expect(params.metadata.noetiaTrial).toBe('no');
  });
});

describe('T-1 — initial cycle of tokens when the 14-day trial begins (PO decision 2026-11-13)', () => {
  const permutations = <T,>(xs: T[]): T[][] => (xs.length <= 1 ? [xs] : xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p])));
  const signupEvents = {
    created: () => created('sub_A'),
    completed: () => completed('sub_A'),
    updated: () => updated('sub_A'),
    trialInvoice: () => trialInvoice('sub_A', undefined, 'in_trial'),
  };

  it.each(permutations(Object.keys(signupEvents) as Array<keyof typeof signupEvents>).map((p) => [p.join(' → '), p]))(
    'any delivery order (%s) grants the initial cycle exactly once',
    async (_label, order) => {
      stripeHas('sub_A', 'trialing');
      for (const name of order as Array<keyof typeof signupEvents>) await signupEvents[name]();
      expect(tokens).toHaveLength(PLAN.tokensPerCycle);
      expect(tokens.every((t) => t.reason === 'Trial start (initial cycle)' && t.type === 'paid')).toBe(true);
      expect(processed.has('fulfillment:trial-start-tokens:sub_A')).toBe(true);
      expect(processed.has('fulfillment:invoice-tokens:in_trial')).toBe(false); // the $0 invoice took no renewal key
    },
  );

  it('the trial grant expires in 90 days (paid-token expiry unchanged)', async () => {
    stripeHas('sub_A', 'trialing');
    await created('sub_A');
    const days = (tokens[0].expiresAt.getTime() - tokens[0].issuedAt.getTime()) / 86_400_000;
    expect(days).toBe(90);
  });

  it('redelivery of every signup event (same ids) and new ids for the same trial grant nothing more', async () => {
    stripeHas('sub_A', 'trialing');
    const ids = [await created('sub_A'), await completed('sub_A'), await trialInvoice('sub_A', undefined, 'in_t')];
    await ev('customer.subscription.created', { id: 'sub_A', customer: 'cus_1' }, ids[0]);
    await ev('checkout.session.completed', { mode: 'subscription', subscription: 'sub_A', customer: 'cus_1' }, ids[1]);
    await trialInvoice('sub_A', ids[2], 'in_t');
    await updated('sub_A');
    await updated('sub_A');
    expect(tokens).toHaveLength(PLAN.tokensPerCycle);
  });

  it('crash after the trial grant, before COMMIT → rolled back; the retry grants once', async () => {
    stripeHas('sub_A', 'trialing');
    const real = subscriptions.issueTokens.bind(subscriptions);
    jest.spyOn(subscriptions, 'issueTokens').mockImplementationOnce(async (...args: Parameters<typeof real>) => {
      await real(...args);
      throw new Error('process crashed before COMMIT');
    });
    await expect(ev('customer.subscription.created', { id: 'sub_A', customer: 'cus_1' }, 'evt_c')).rejects.toThrow('crashed');
    expect(tokens).toHaveLength(0);
    expect(processed.has('fulfillment:trial-start-tokens:sub_A')).toBe(false);
    expect(subRow).toBeNull(); // the row write rolled back with it
    await ev('customer.subscription.created', { id: 'sub_A', customer: 'cus_1' }, 'evt_c');
    await completed('sub_A');
    expect(tokens).toHaveLength(PLAN.tokensPerCycle);
  });

  it('trial cancelled before paying → the initial tokens stay (no claw-back), no paid cycle, nothing more from late events', async () => {
    stripeHas('sub_A', 'trialing');
    await created('sub_A');
    stripeHas('sub_A', 'trialing', { cancel_at_period_end: true });
    await updated('sub_A');
    expect(subRow.status).toBe('canceling');
    stripeHas('sub_A', 'canceled');
    await deleted('sub_A');
    await updated('sub_A');
    await completed('sub_A');
    expect(subRow.status).toBe('canceled');
    expect(tokens).toHaveLength(PLAN.tokensPerCycle);
    expect(tokenRepo.update).not.toHaveBeenCalled(); // no expiry/revocation of the granted tokens
  });

  it('first paid invoice (and its redelivery / a second event id) grants exactly one renewal cycle; the next month one more', async () => {
    stripeHas('sub_A', 'trialing');
    await created('sub_A');
    stripeHas('sub_A', 'active');
    await invoicePaid('sub_A', 'evt_first', 'in_first');
    await invoicePaid('sub_A', 'evt_first', 'in_first');
    await invoicePaid('sub_A', 'evt_first_b', 'in_first');
    expect(tokens).toHaveLength(2 * PLAN.tokensPerCycle);
    await invoicePaid('sub_A', undefined, 'in_second');
    expect(tokens).toHaveLength(3 * PLAN.tokensPerCycle);
  });

  it('D4: proration / upgrade invoices (paid or $0) grant nothing; D5: a valid $0 renewal grants the normal cycle', async () => {
    stripeHas('sub_A', 'active');
    await updated('sub_A');
    await ev('invoice.paid', { id: 'in_up', subscription: 'sub_A', customer: 'cus_1', amount_paid: 450, billing_reason: 'subscription_update' });
    await ev('invoice.paid', { id: 'in_up0', subscription: 'sub_A', customer: 'cus_1', amount_paid: 0, billing_reason: 'subscription_update' });
    await ev('invoice.paid', { id: 'in_manual', subscription: 'sub_A', customer: 'cus_1', amount_paid: 899, billing_reason: 'manual' });
    expect(tokens).toHaveLength(0);
    await invoicePaid('sub_A', undefined, 'in_zero_renewal', 0); // subscription_cycle at $0
    expect(tokens).toHaveLength(PLAN.tokensPerCycle);
  });

  it('D5: a voided-and-reissued invoice for the same billing period grants once', async () => {
    stripeHas('sub_A', 'active');
    await updated('sub_A');
    const line = { lines: { data: [{ type: 'subscription', period: { start: 1_810_000_000 } }] } };
    await ev('invoice.paid', { id: 'in_orig', subscription: 'sub_A', customer: 'cus_1', amount_paid: 899, billing_reason: 'subscription_cycle', ...line });
    await ev('invoice.paid', { id: 'in_reissued', subscription: 'sub_A', customer: 'cus_1', amount_paid: 899, billing_reason: 'subscription_cycle', ...line });
    expect(tokens).toHaveLength(PLAN.tokensPerCycle);
  });

  it('a subscription that is not trialing (no trial) gets no trial grant — its first paid invoice grants as before', async () => {
    stripeHas('sub_A', 'active');
    await created('sub_A');
    expect(tokens).toHaveLength(0);
    await invoicePaid('sub_A');
    expect(tokens).toHaveLength(PLAN.tokensPerCycle);
  });

  it('a second (duplicate) trial subscription for a user with a live one gets no trial grant', async () => {
    stripeHas('sub_A', 'trialing');
    await created('sub_A');
    stripeHas('sub_B', 'trialing');
    await created('sub_B');
    await trialInvoice('sub_B');
    expect(tokens).toHaveLength(PLAN.tokensPerCycle);
    expect(processed.has('fulfillment:trial-start-tokens:sub_B')).toBe(false);
  });

  it('an unknown price → no plan → no trial grant (key stays unclaimed)', async () => {
    stripeHas('sub_A', 'trialing', {}, 'price_unknown');
    await created('sub_A');
    expect(tokens).toHaveLength(0);
    expect(processed.has('fulfillment:trial-start-tokens:sub_A')).toBe(false);
  });

  it('D1: after a cancelled trial the customer re-subscribes WITHOUT a trial — no second T-1 grant; the first paid invoice grants once', async () => {
    stripeHas('sub_A', 'trialing');
    await created('sub_A');
    stripeHas('sub_A', 'canceled');
    await deleted('sub_A');
    expect(tokens).toHaveLength(PLAN.tokensPerCycle); // trial tokens kept (no claw-back)
    await subscriptions.createCheckoutSession('u1', PLAN.id);
    expect(lastSession()).not.toHaveProperty('subscription_data');
    stripeHas('sub_B', 'active'); // billed immediately — Stripe never reports trialing
    await created('sub_B');
    await ev('invoice.paid', { id: 'in_B1', subscription: 'sub_B', customer: 'cus_1', amount_paid: 899, billing_reason: 'subscription_create' });
    await completed('sub_B');
    expect(tokens).toHaveLength(2 * PLAN.tokensPerCycle); // trial cycle (kept) + first paid cycle of sub_B
    expect(processed.has('fulfillment:trial-start-tokens:sub_B')).toBe(false);
  });

  it('D1: a first-time customer gets the trial from checkout', async () => {
    await subscriptions.createCheckoutSession('u1', PLAN.id);
    expect(lastSession().subscription_data).toEqual({ trial_period_days: 14 });
  });
});

describe('D2/D3 — annual plans: exactly 12 paid allocations per annual period (+ T-1)', () => {
  const DAY = 86_400_000;
  const start = Date.UTC(2027, 0, 1, 12, 0, 0); // trial starts 2027-01-01 12:00 UTC
  const sec = (ms: number) => Math.floor(ms / 1000);
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    jest.setSystemTime(start);
  });
  afterEach(() => jest.useRealTimers());
  const at = (ms: number) => jest.setSystemTime(ms);
  /** Runs the daily 01:00 UTC scheduler on every day in [fromDay, toDay]. */
  async function cronDays(fromDay: number, toDay: number, beforeRun?: (runAt: number) => Promise<void>) {
    for (let d = fromDay; d <= toDay; d++) {
      const runAt = Date.UTC(2027, 0, 1 + d, 1, 0, 0);
      if (beforeRun) await beforeRun(runAt);
      at(runAt);
      await subscriptions.issueMonthlyTokensForAnnualPlans();
    }
  }
  const reasons = () => tokens.map((t) => t.reason);
  const paidInPeriod = (fromMs: number, toMs: number) =>
    tokens.filter((t) => t.reason !== 'Trial start (initial cycle)' && t.issuedAt.getTime() >= fromMs && t.issuedAt.getTime() < toMs).length;

  /** Trial (day 0) → first paid annual invoice when the trial ends (day 14); Stripe period [day 14, day 379). */
  async function annualSignup() {
    const trialEnd = start + 14 * DAY;
    stripeHas('sub_Y', 'trialing', { trial_end: sec(trialEnd), current_period_end: sec(trialEnd) }, PLAN_ANNUAL.stripePriceId);
    await created('sub_Y');
    await trialInvoice('sub_Y');
    at(trialEnd);
    const period = { current_period_start: sec(trialEnd), current_period_end: sec(trialEnd + 365 * DAY), billing_cycle_anchor: sec(trialEnd) };
    stripeHas('sub_Y', 'active', period, PLAN_ANNUAL.stripePriceId);
    await ev('invoice.paid', { id: 'in_y1', subscription: 'sub_Y', customer: 'cus_1', amount_paid: 8399, billing_reason: 'subscription_cycle', lines: { data: [{ type: 'subscription', period: { start: period.current_period_start } }] } });
    return { trialEnd, periodEnd: trialEnd + 365 * DAY, period };
  }

  it('full year: T-1 on day 0, paid cycle 0 on day 14, 11 calendar-month cycles, nothing extra before the renewal — 12 paid', async () => {
    const { trialEnd, periodEnd } = await annualSignup();
    expect(reasons()).toEqual(['Trial start (initial cycle)', 'Subscription renewal']);
    await cronDays(14, 378);
    expect(paidInPeriod(trialEnd, periodEnd)).toBe(12);
    expect(tokens).toHaveLength(13); // 12 paid + the T-1 trial allocation
    const scheduled = tokens.filter((t) => t.reason === 'Annual plan monthly issuance').map((t) => t.issuedAt.toISOString().slice(0, 10));
    expect(scheduled).toEqual(['2027-02-16', '2027-03-16', '2027-04-16', '2027-05-16', '2027-06-16', '2027-07-16', '2027-08-16', '2027-09-16', '2027-10-16', '2027-11-16', '2027-12-16']);
    // (each due on the 15th at 12:00 UTC → granted by the next 01:00 UTC run)
  });

  it('renewal: the next period starts with its own paid invoice, never early; year 2 also gets exactly 12', async () => {
    const { periodEnd, period } = await annualSignup();
    await cronDays(14, 378);
    expect(tokens).toHaveLength(13);
    const period2 = { current_period_start: period.current_period_end, current_period_end: sec(periodEnd + 366 * DAY), billing_cycle_anchor: period.billing_cycle_anchor }; // 2028 is a leap year
    await cronDays(379, 379, async () => undefined); // day after the period: Stripe still reports the old period until it renews
    expect(tokens).toHaveLength(13);
    at(periodEnd);
    stripeHas('sub_Y', 'active', period2, PLAN_ANNUAL.stripePriceId);
    await ev('invoice.paid', { id: 'in_y2', subscription: 'sub_Y', customer: 'cus_1', amount_paid: 8399, billing_reason: 'subscription_cycle', lines: { data: [{ type: 'subscription', period: { start: period2.current_period_start } }] } });
    await cronDays(380, 744);
    expect(paidInPeriod(periodEnd, periodEnd + 366 * DAY)).toBe(12);
  });

  it('D3: cancel at period end on day 60 → allocations continue to day 379, none after; no renewal', async () => {
    const { trialEnd, periodEnd, period } = await annualSignup();
    await cronDays(14, 59);
    at(start + 60 * DAY);
    stripeHas('sub_Y', 'active', { ...period, cancel_at_period_end: true }, PLAN_ANNUAL.stripePriceId);
    await updated('sub_Y');
    expect(subRow.status).toBe('canceling');
    await cronDays(60, 420, async (runAt) => {
      if (runAt >= periodEnd && subRow.status !== 'canceled') {
        at(periodEnd);
        stripeHas('sub_Y', 'canceled', period, PLAN_ANNUAL.stripePriceId);
        await deleted('sub_Y');
      }
    });
    expect(paidInPeriod(trialEnd, periodEnd)).toBe(12);
    expect(tokens.filter((t) => t.issuedAt.getTime() >= periodEnd)).toHaveLength(0);
  });

  it('immediate termination on day 100 stops allocations (paid so far kept)', async () => {
    const { period } = await annualSignup();
    await cronDays(14, 99);
    at(start + 100 * DAY);
    stripeHas('sub_Y', 'canceled', period, PLAN_ANNUAL.stripePriceId);
    await deleted('sub_Y');
    await cronDays(100, 400);
    expect(tokens).toHaveLength(1 + 1 + 2); // T-1 + cycle 0 + Feb/Mar (day 100 = Apr 11, before the Apr 15 cycle)
  });

  it('failed renewal payment (past_due) grants nothing in the unpaid period', async () => {
    const { periodEnd, period } = await annualSignup();
    await cronDays(14, 378);
    at(periodEnd);
    stripeHas('sub_Y', 'past_due', { current_period_start: period.current_period_end, current_period_end: sec(periodEnd + 366 * DAY), billing_cycle_anchor: period.billing_cycle_anchor }, PLAN_ANNUAL.stripePriceId);
    await ev('invoice.payment_failed', { subscription: 'sub_Y', customer: 'cus_1' });
    await cronDays(379, 480);
    expect(tokens).toHaveLength(13);
  });

  it('cancellation during the unpaid annual trial: T-1 kept, scheduler never issues', async () => {
    stripeHas('sub_Y', 'trialing', {}, PLAN_ANNUAL.stripePriceId);
    await created('sub_Y');
    at(start + 5 * DAY);
    stripeHas('sub_Y', 'canceled', {}, PLAN_ANNUAL.stripePriceId);
    await deleted('sub_Y');
    await cronDays(5, 120);
    expect(tokens).toHaveLength(1);
  });

  it('January 31 anchor: Feb 28, Mar 31, Apr 30 … — still 12 paid in the period', async () => {
    const anchor = Date.UTC(2027, 0, 31, 8, 0, 0);
    const end = Date.UTC(2028, 0, 31, 8, 0, 0);
    at(anchor);
    stripeHas('sub_J', 'active', { current_period_start: sec(anchor), current_period_end: sec(end), billing_cycle_anchor: sec(anchor) }, PLAN_ANNUAL.stripePriceId);
    await ev('invoice.paid', { id: 'in_j', subscription: 'sub_J', customer: 'cus_1', amount_paid: 8399, billing_reason: 'subscription_create' });
    for (let d = 31; d <= Math.floor((end - start) / DAY) - 1; d++) { at(Date.UTC(2027, 0, 1 + d, 9, 0, 0)); await subscriptions.issueMonthlyTokensForAnnualPlans(); }
    const days = tokens.filter((t) => t.reason === 'Annual plan monthly issuance').map((t) => t.issuedAt.toISOString().slice(5, 10));
    expect(days.slice(0, 4)).toEqual(['02-28', '03-31', '04-30', '05-31']);
    expect(tokens).toHaveLength(12);
  });
});

describe('Exactly-once fulfillment (P0 idempotency correction)', () => {
  it('crash after granting tokens but before the event is recorded → everything rolls back; the retry grants once', async () => {
    stripeHas('sub_A', 'active');
    await updated('sub_A');
    const real = subscriptions.issueTokens.bind(subscriptions);
    jest.spyOn(subscriptions, 'issueTokens').mockImplementationOnce(async (...args: Parameters<typeof real>) => {
      await real(...args);
      expect(tokens).toHaveLength(PLAN.tokensPerCycle); // granted inside the transaction…
      throw new Error('process crashed before COMMIT'); // …then the process dies
    });
    await expect(invoicePaid('sub_A', 'evt_crash', 'in_crash')).rejects.toThrow('process crashed');
    expect(tokens).toHaveLength(0);
    expect(processed.has('evt_crash')).toBe(false);
    expect(processed.has('fulfillment:invoice-tokens:in_crash')).toBe(false);
    await invoicePaid('sub_A', 'evt_crash', 'in_crash'); // Stripe retries the same event
    await invoicePaid('sub_A', 'evt_crash', 'in_crash'); // and once more
    expect(tokens).toHaveLength(PLAN.tokensPerCycle);
  });

  it('two DIFFERENT event ids for the same invoice → tokens granted once', async () => {
    stripeHas('sub_A', 'active');
    await updated('sub_A');
    await invoicePaid('sub_A', 'evt_a', 'in_same');
    await invoicePaid('sub_A', 'evt_b', 'in_same');
    expect(tokens).toHaveLength(PLAN.tokensPerCycle);
    expect(processed.has('evt_a') && processed.has('evt_b')).toBe(true);
  });

  it('distinct invoices of the same subscription still each grant (renewals unchanged)', async () => {
    stripeHas('sub_A', 'active');
    await updated('sub_A');
    await invoicePaid('sub_A', undefined, 'in_m1');
    await invoicePaid('sub_A', undefined, 'in_m2');
    expect(tokens).toHaveLength(2 * PLAN.tokensPerCycle);
  });

  it('a paid invoice whose row has no plan (unknown price) grants nothing and does not consume its fulfillment key', async () => {
    stripeHas('sub_A', 'active', {}, 'price_unknown');
    await created('sub_A');
    await invoicePaid('sub_A', 'evt_np', 'in_np');
    expect(processed.has('fulfillment:invoice-tokens:in_np')).toBe(false);
    expect(tokens).toHaveLength(0);
  });

  it('token package: duplicate delivery AND a different event id for the same Checkout session → tokens once', async () => {
    const md = { tokenPackageId: PACKAGE.id, userId: 'u1' };
    await paymentCompleted('cs_pkg', md, 'evt_p1');
    await paymentCompleted('cs_pkg', md, 'evt_p1');
    await paymentCompleted('cs_pkg', md, 'evt_p2');
    expect(tokens).toHaveLength(PACKAGE.tokenCount);
    expect(tokens[0]).toMatchObject({ userId: 'u1', type: 'paid', reason: `Purchased ${PACKAGE.name}` });
  });

  it('two different token-package sessions each grant (no over-blocking)', async () => {
    await paymentCompleted('cs_p1', { tokenPackageId: PACKAGE.id, userId: 'u1' });
    await paymentCompleted('cs_p2', { tokenPackageId: PACKAGE.id, userId: 'u1' });
    expect(tokens).toHaveLength(2 * PACKAGE.tokenCount);
  });

  it('a failed token-package fulfillment rolls back and the legitimate retry grants once', async () => {
    tokenRepo.save.mockRejectedValueOnce(new Error('db write failed'));
    const md = { tokenPackageId: PACKAGE.id, userId: 'u1' };
    await expect(paymentCompleted('cs_retry', md, 'evt_r1')).rejects.toThrow('db write failed');
    expect(processed.has('fulfillment:checkout-session:cs_retry')).toBe(false);
    await paymentCompleted('cs_retry', md, 'evt_r1');
    expect(tokens).toHaveLength(PACKAGE.tokenCount);
  });

  it('book purchase: different event ids for one session → one ownership insert', async () => {
    await paymentCompleted('cs_book', { bookId: 'b1', userId: 'u1' }, 'evt_b1');
    await paymentCompleted('cs_book', { bookId: 'b1', userId: 'u1' }, 'evt_b2');
    expect([...ownedBooks]).toEqual(['u1:b1']);
  });

  it('gift: different event ids for one session → fulfilled once; the e-mail step runs once, after commit', async () => {
    const order: string[] = [];
    const notify = jest.fn(async () => { order.push(`email (event committed: ${processed.has('evt_g1')})`); });
    giftsFake.fulfillGift.mockImplementation(async () => { order.push('record'); return notify; });
    await paymentCompleted('cs_gift', { type: 'gift', recipientEmail: 'r@test.invalid', tokenCount: '1' }, 'evt_g1');
    await paymentCompleted('cs_gift', { type: 'gift', recipientEmail: 'r@test.invalid', tokenCount: '1' }, 'evt_g2');
    expect(giftsFake.fulfillGift).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['record', 'email (event committed: true)']);
  });

  it('gift: a failure while recording sends no e-mail and the retry fulfills once', async () => {
    const notify = jest.fn(async () => undefined);
    giftsFake.fulfillGift.mockRejectedValueOnce(new Error('db write failed')).mockResolvedValue(notify);
    const md = { type: 'gift', recipientEmail: 'r@test.invalid', tokenCount: '3' };
    await expect(paymentCompleted('cs_gf', md, 'evt_gf')).rejects.toThrow('db write failed');
    expect(notify).not.toHaveBeenCalled();
    await paymentCompleted('cs_gf', md, 'evt_gf');
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('a failing post-commit e-mail does not fail the webhook or undo the fulfillment', async () => {
    giftsFake.fulfillGift.mockResolvedValue(async () => { throw new Error('smtp down'); });
    jest.spyOn((webhooks as any).logger, 'error').mockImplementation(() => undefined);
    await expect(paymentCompleted('cs_ge', { type: 'gift', recipientEmail: 'r@test.invalid', tokenCount: '1' }, 'evt_ge')).resolves.toBe('evt_ge');
    expect(processed.has('fulfillment:checkout-session:cs_ge')).toBe(true);
  });

  it('subscription webhook writes take the per-user identity lock inside the event transaction', async () => {
    stripeHas('sub_A', 'trialing');
    await created('sub_A');
    stripeHas('sub_A', 'canceled');
    await deleted('sub_A');
    expect(lockQueries.filter((q) => q.includes('subscription-identity:u1'))).toHaveLength(2);
  });
});
