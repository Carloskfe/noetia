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
type FakeSub = { id: string; customer: string; status: string; cancel_at_period_end: boolean; current_period_end: number; trial_end: number | null; items: { data: Array<{ price: { id: string } }> } };
const stripeState = { subs: new Map<string, FakeSub>(), sessions: [] as any[], failRetrieve: false };
const fakeStripe = {
  customers: { create: jest.fn(async () => ({ id: 'cus_1' })) },
  subscriptions: {
    retrieve: jest.fn(async (id: string) => {
      if (stripeState.failRetrieve) throw new Error('stripe unavailable');
      const s = stripeState.subs.get(id);
      if (!s) throw new Error('No such subscription');
      return { ...s };
    }),
    list: jest.fn(async ({ customer }: { customer: string }) => ({
      data: [...stripeState.subs.values()].filter((s) => s.customer === customer && s.status !== 'canceled'),
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

// ── in-memory tables ─────────────────────────────────────────────────────────
const PLAN = { id: 'plan-ind', stripePriceId: 'price_ind', tokensPerCycle: 1, interval: 'month', maxProfiles: 1 };
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
    return { ...subRow, plan: subRow.planId === PLAN.id ? PLAN : null };
  }),
  upsert: jest.fn(async (v: any) => { subRow = { linkedUserIds: [], planId: null, ...(subRow ?? {}), ...v }; }),
  update: jest.fn(async (where: any, v: any) => {
    if (!subRow) return;
    const match = typeof where === 'string' ? where === subRow.id : where.stripeSubscriptionId === subRow.stripeSubscriptionId;
    if (match) subRow = { ...subRow, ...v };
  }),
  createQueryBuilder: jest.fn(() => ({ leftJoinAndSelect() { return this; }, where() { return this; }, andWhere() { return this; }, getOne: async () => null })),
  find: jest.fn(async ({ where }: any) => (subRow && where.stripeSubscriptionId === subRow.stripeSubscriptionId ? [{ ...subRow }] : [])),
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
      { provide: PlansService, useValue: { findById: async (id: string) => (id === PLAN.id ? PLAN : null), findAll: async () => [PLAN], findTokenPackageById: async (id: string) => (id === PACKAGE.id ? PACKAGE : null) } },
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
function stripeHas(id: string, status: string, extra: Partial<FakeSub> = {}) {
  stripeState.subs.set(id, { id, customer: 'cus_1', status, cancel_at_period_end: false, current_period_end: T0 + 30 * 86400, trial_end: status === 'trialing' ? T0 + 14 * 86400 : null, items: { data: [{ price: { id: PLAN.stripePriceId } }] }, ...extra });
}
let seq = 0;
const ev = (type: string, object: any, id = `evt_${++seq}`) => webhooks.handleEvent({ id, type, data: { object } } as any).then(() => id);
const created = (sub: string) => ev('customer.subscription.created', { id: sub, customer: 'cus_1' });
const updated = (sub: string) => ev('customer.subscription.updated', { id: sub, customer: 'cus_1', items: { data: [] } });
const completed = (sub: string) => ev('checkout.session.completed', { mode: 'subscription', subscription: sub, customer: 'cus_1' });
let invoiceSeq = 0;
const invoicePaid = (sub: string, id?: string, invoiceId = `in_${++invoiceSeq}`) =>
  ev('invoice.paid', { id: invoiceId, subscription: sub, customer: 'cus_1' }, id);
const paymentCompleted = (sessionId: string, metadata: Record<string, string>, id?: string) =>
  ev('checkout.session.completed', { id: sessionId, mode: 'payment', metadata }, id);
const deleted = (sub: string) => ev('customer.subscription.deleted', { id: sub });

describe('Event-order matrix (one subscription)', () => {
  it('in-order trial signup: created → completed → $0 invoice.paid → updated(active) → paid invoice', async () => {
    stripeHas('sub_A', 'trialing');
    await created('sub_A');
    expect(subRow).toMatchObject({ stripeSubscriptionId: 'sub_A', status: 'trialing', planId: null });
    await completed('sub_A');
    expect(subRow.status).toBe('trialing'); // previously written as 'active' from the payload
    await invoicePaid('sub_A');
    expect(tokens).toHaveLength(0); // current behaviour, unchanged: planId unknown at the trial invoice → no tokens
    stripeHas('sub_A', 'active');
    await updated('sub_A');
    expect(subRow).toMatchObject({ status: 'active', planId: PLAN.id });
    await invoicePaid('sub_A');
    expect(tokens).toHaveLength(PLAN.tokensPerCycle);
  });

  it('invoice.paid first (before created/completed) → row created from Stripe truth, no extra tokens', async () => {
    stripeHas('sub_A', 'trialing');
    await invoicePaid('sub_A');
    expect(subRow).toMatchObject({ stripeSubscriptionId: 'sub_A', status: 'trialing' });
    await completed('sub_A');
    await created('sub_A');
    expect(subRow.status).toBe('trialing');
    expect(tokens).toHaveLength(0);
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

  it('after the subscription ends, the user can subscribe again', async () => {
    stripeHas('sub_A', 'active');
    await updated('sub_A');
    await expect(subscriptions.createCheckoutSession('u1', PLAN.id)).rejects.toThrow(ConflictException);
    stripeHas('sub_A', 'canceled');
    await deleted('sub_A');
    await expect(subscriptions.createCheckoutSession('u1', PLAN.id)).resolves.toHaveProperty('url');
  });
});

describe('Trial-token behaviour (documented as-is — PO decision pending, NOT changed)', () => {
  it('when customer.subscription.updated arrives BEFORE the $0 trial invoice.paid, the trial receives the cycle tokens (as before)', async () => {
    stripeHas('sub_A', 'trialing');
    await created('sub_A');
    await updated('sub_A'); // e.g. Checkout attaching the default payment method
    await invoicePaid('sub_A'); // $0 trial invoice
    expect(tokens).toHaveLength(PLAN.tokensPerCycle);
  });

  it('when it arrives AFTER, the trial receives none (as before) — the outcome depends on delivery order', async () => {
    stripeHas('sub_A', 'trialing');
    await created('sub_A');
    await invoicePaid('sub_A');
    await updated('sub_A');
    expect(tokens).toHaveLength(0);
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

  it('an invoice that grants nothing today (no plan yet — trial gate) does not consume its fulfillment key', async () => {
    stripeHas('sub_A', 'trialing');
    await created('sub_A');
    await invoicePaid('sub_A', 'evt_t1', 'in_trial');
    expect(processed.has('fulfillment:invoice-tokens:in_trial')).toBe(false);
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
