// G-1 CheckoutStatusService — unit tests (design §R3.4/§R3.5/§R3.7, §R2.9). Stripe and repositories are mocked;
// every write-capable method is a trap that must never be called (read-only invariant, T-R1B-6).
import { readFileSync } from 'fs';
import { join } from 'path';
import { Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { CheckoutStatusService, truncateSessionId, CHECKOUT_SESSION_ID } from '../../../src/subscriptions/checkout-status.service';

const trap = () => jest.fn(() => { throw new Error('write/side-effect method must never be called'); });

const mockStripe = {
  checkout: { sessions: { retrieve: jest.fn(), create: trap(), expire: trap(), list: trap() } },
  subscriptions: { retrieve: trap(), list: trap(), update: trap(), cancel: trap(), create: trap() },
  customers: { create: trap(), list: trap(), update: trap() },
  invoices: { listLineItems: trap(), pay: trap() },
  refunds: { create: trap() },
  paymentIntents: { capture: trap(), create: trap(), cancel: trap() },
  billingPortal: { sessions: { create: trap() } },
};
jest.mock('stripe', () => jest.fn().mockImplementation(() => mockStripe));

const writeTraps = () => ({ save: trap(), insert: trap(), update: trap(), delete: trap(), remove: trap(), upsert: trap(), query: trap(), increment: trap(), decrement: trap() });
const subRepo = { findOneBy: jest.fn(), ...writeTraps() };
const userBookRepo = { countBy: jest.fn(), ...writeTraps() };
const processedRepo = { countBy: jest.fn(), ...writeTraps() };

const config = (key: string | undefined) => ({ get: jest.fn(() => key) }) as any;
const make = (key: string | null = 'sk_test_x') => new CheckoutStatusService(config(key ?? undefined), subRepo as any, userBookRepo as any, processedRepo as any);

const SID = 'cs_test_a1B2c3D4e5F6g7H8i9J0kLmN';
const USER = { id: 'user-1', stripeCustomerId: 'cus_owner' };
const OTHER = { id: 'user-2', stripeCustomerId: 'cus_other' };

const tokenSession = (o: any = {}) => ({ id: SID, mode: 'payment', status: 'complete', payment_status: 'paid', customer: 'cus_owner', metadata: { tokenPackageId: 'pkg-1', userId: USER.id }, amount_total: 999, currency: 'usd', customer_details: { email: 'owner@test.invalid' }, ...o });
const bookSession = (o: any = {}) => ({ ...tokenSession(), metadata: { bookId: 'book-1', userId: USER.id }, ...o });
const subSession = (o: any = {}) => ({ id: SID, mode: 'subscription', status: 'complete', payment_status: 'paid', customer: 'cus_owner', subscription: 'sub_this', metadata: { noetiaUserId: USER.id, noetiaPlanId: 'plan-1' }, ...o });
const giftSession = (o: any = {}) => ({ id: SID, mode: 'payment', status: 'complete', payment_status: 'paid', customer: null, metadata: { type: 'gift', buyerUserId: '', recipientEmail: 'r@test.invalid', tokenCount: '1' }, ...o });

const stripeReturns = (s: any) => mockStripe.checkout.sessions.retrieve.mockResolvedValue(s);
const keyPresent = (present: boolean) => processedRepo.countBy.mockResolvedValue(present ? 1 : 0);
const ownsBook = (owned: boolean) => userBookRepo.countBy.mockResolvedValue(owned ? 1 : 0);
const subRow = (row: any) => subRepo.findOneBy.mockResolvedValue(row);

const NOT_FOUND = { error: 'checkout_session_not_found' };
const UNAVAILABLE = { error: 'checkout_status_unavailable' };
async function rejection(p: Promise<unknown>) {
  try { await p; } catch (e: any) { return { cls: e.constructor, status: e.getStatus?.(), body: e.getResponse?.() }; }
  throw new Error('expected a rejection');
}

let warn: jest.SpyInstance;
beforeEach(() => {
  jest.clearAllMocks();
  warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  keyPresent(false);
  ownsBook(false);
  subRow(null);
});
afterEach(() => warn.mockRestore());

afterEach(() => {
  // T-R1B-6 read-only invariant, asserted after EVERY test: no write, no other Stripe call.
  for (const repo of [subRepo, userBookRepo, processedRepo]) {
    for (const m of ['save', 'insert', 'update', 'delete', 'remove', 'upsert', 'query', 'increment', 'decrement'] as const) expect((repo as any)[m]).not.toHaveBeenCalled();
  }
  const { checkout, ...rest } = mockStripe;
  for (const fn of [checkout.sessions.create, checkout.sessions.expire, checkout.sessions.list]) expect(fn).not.toHaveBeenCalled();
  for (const group of Object.values(rest)) for (const fn of Object.values(group as any).flatMap((v: any) => (typeof v === 'function' ? [v] : Object.values(v)))) expect(fn).not.toHaveBeenCalled();
});

describe('session id validation and Stripe errors', () => {
  it.each(['', 'abc', 'cs_test_short', 'pi_test_a1B2c3D4e5F6g7H8', 'cs_prod_a1B2c3D4e5F6g7H8i9', `cs_test_${'a'.repeat(201)}`, 'cs_test_a1B2c3D4e5/../x', 'cs_test_a1B2c3D4e5F6 OR 1=1'])(
    'malformed id %p → 404, no Stripe call', async (id) => {
      const r = await rejection(make().getStatus(USER, id));
      expect(r).toEqual({ cls: NotFoundException, status: 404, body: NOT_FOUND });
      expect(mockStripe.checkout.sessions.retrieve).not.toHaveBeenCalled();
    });

  it('accepts live and test ids', () => {
    expect(CHECKOUT_SESSION_ID.test('cs_live_a1B2c3D4e5F6')).toBe(true);
    expect(CHECKOUT_SESSION_ID.test(SID)).toBe(true);
  });

  it('unknown session (Stripe resource_missing) → the uniform 404', async () => {
    mockStripe.checkout.sessions.retrieve.mockRejectedValue(Object.assign(new Error('No such checkout.session: cs_test_…'), { statusCode: 404, code: 'resource_missing', type: 'StripeInvalidRequestError' }));
    expect(await rejection(make().getStatus(USER, SID))).toEqual({ cls: NotFoundException, status: 404, body: NOT_FOUND });
  });

  it('Stripe outage → 503 with a fixed body and no Stripe message; the log has a truncated id only', async () => {
    mockStripe.checkout.sessions.retrieve.mockRejectedValue(Object.assign(new Error('secret internal detail sk_live_leak'), { statusCode: 500, type: 'StripeAPIError' }));
    const r = await rejection(make().getStatus(USER, SID));
    expect(r).toEqual({ cls: ServiceUnavailableException, status: 503, body: UNAVAILABLE });
    const logged = warn.mock.calls.map((c) => String(c[0])).join('\n');
    expect(logged).not.toContain(SID);
    expect(logged).not.toContain('sk_live_leak');
    expect(logged).toContain(truncateSessionId(SID));
  });

  it('payments not configured (no Stripe key) → 503', async () => {
    expect(await rejection(make(null).getStatus(USER, SID))).toEqual({ cls: ServiceUnavailableException, status: 503, body: UNAVAILABLE });
  });

  it('a retrieved object whose id differs from the requested one → 404', async () => {
    stripeReturns(tokenSession({ id: 'cs_test_zzzzzzzzzzzzzzzzzz' }));
    expect((await rejection(make().getStatus(USER, SID))).status).toBe(404);
  });

  it('database failure → 503 without detail', async () => {
    stripeReturns(tokenSession());
    processedRepo.countBy.mockRejectedValue(new Error('connection refused 10.0.0.5:5432 password=x'));
    const r = await rejection(make().getStatus(USER, SID));
    expect(r).toEqual({ cls: ServiceUnavailableException, status: 503, body: UNAVAILABLE });
    expect(warn.mock.calls.map((c) => String(c[0])).join('\n')).not.toMatch(/10\.0\.0\.5|password/);
  });

  it('an unmappable Checkout status → 503 (no claim), never a guessed state', async () => {
    stripeReturns(tokenSession({ status: null }));
    expect((await rejection(make().getStatus(USER, SID))).status).toBe(503);
  });

  it('truncateSessionId keeps only the prefix and the last 6 characters', () => {
    expect(truncateSessionId(SID)).toBe('cs_test_…J0kLmN');
    expect(truncateSessionId('cs_live_abcdefghijklmnop')).toBe('cs_live_…klmnop');
  });
});

describe('ownership, kind and G-b (uniform 404)', () => {
  const cases: Array<[string, any, any]> = [
    ['token session of another user', tokenSession(), OTHER],
    ['book session of another user', bookSession(), OTHER],
    ['subscription session of another user (metadata)', subSession(), OTHER],
    ['token session: metadata user matches but Stripe customer differs', tokenSession({ customer: 'cus_someone' }), USER],
    ['subscription without metadata, customer differs', subSession({ metadata: {}, customer: 'cus_someone' }), USER],
    ['subscription without metadata, caller has no Stripe customer', subSession({ metadata: {} }), { id: USER.id, stripeCustomerId: null }],
    ['subscription metadata names another user even though the customer matches', subSession({ metadata: { noetiaUserId: OTHER.id } }), USER],
    ['anonymous gift (empty buyerUserId)', giftSession(), USER],
    ['gift with buyerUserId = caller', giftSession({ metadata: { type: 'gift', buyerUserId: USER.id } }), USER],
    ['non-Noetia payment session (no metadata)', tokenSession({ metadata: {} }), USER],
    ['payment session with userId but no package/book', tokenSession({ metadata: { userId: USER.id } }), USER],
    ['wrong mode (setup)', tokenSession({ mode: 'setup' }), USER],
    ['metadata missing entirely', tokenSession({ metadata: undefined }), USER],
  ];
  it.each(cases)('%s → 404 with the same body as an unknown id', async (_label, session, caller) => {
    stripeReturns(session);
    expect(await rejection(make().getStatus(caller, SID))).toEqual({ cls: NotFoundException, status: 404, body: NOT_FOUND });
    expect(processedRepo.countBy).not.toHaveBeenCalled();
    expect(userBookRepo.countBy).not.toHaveBeenCalled();
    expect(subRepo.findOneBy).not.toHaveBeenCalled();
  });

  it('a gift session is rejected even when it also carries token metadata', async () => {
    stripeReturns(giftSession({ metadata: { type: 'gift', tokenPackageId: 'pkg', userId: USER.id } }));
    expect((await rejection(make().getStatus(USER, SID))).status).toBe(404);
  });

  it('owner with no Stripe customer on record and metadata match → answered (customer check applies only when both are set)', async () => {
    stripeReturns(tokenSession());
    keyPresent(false);
    expect(await make().getStatus({ id: USER.id, stripeCustomerId: null }, SID)).toEqual({ kind: 'tokens', checkout: 'complete', payment: 'paid', delivery: 'pending' });
  });

  it('expanded customer object is compared by id', async () => {
    stripeReturns(tokenSession({ customer: { id: 'cus_owner' } }));
    expect((await make().getStatus(USER, SID)).kind).toBe('tokens');
  });

  it('legacy subscription session without metadata, matching customer → answered', async () => {
    stripeReturns(subSession({ metadata: null }));
    subRow({ userId: USER.id, stripeSubscriptionId: 'sub_this', status: 'active' });
    expect(await make().getStatus(USER, SID)).toEqual({ kind: 'subscription', checkout: 'complete', entitlement: 'active' });
  });

  it('kind comes from Stripe metadata: token package wins over book (webhook precedence)', async () => {
    stripeReturns(tokenSession({ metadata: { tokenPackageId: 'pkg-1', bookId: 'book-1', userId: USER.id } }));
    expect((await make().getStatus(USER, SID)).kind).toBe('tokens');
  });
});

describe('token packages — R1-B (never delivered)', () => {
  it.each([
    ['open', { status: 'open', payment_status: 'unpaid' }, true, { checkout: 'open', payment: 'unpaid', delivery: null }],
    ['expired', { status: 'expired', payment_status: 'unpaid' }, true, { checkout: 'expired', payment: 'unpaid', delivery: null }],
    ['complete + unpaid WITH a key (simulated anomaly, T-R5a)', { payment_status: 'unpaid' }, true, { checkout: 'complete', payment: 'unpaid', delivery: null }],
    ['complete + no_payment_required (T-R5b)', { payment_status: 'no_payment_required' }, true, { checkout: 'complete', payment: 'no_payment_required', delivery: null }],
    ['complete + unknown payment status', { payment_status: 'weird' }, true, { checkout: 'complete', payment: 'unpaid', delivery: null }],
    ['paid, no key (T-R5c)', {}, false, { checkout: 'complete', payment: 'paid', delivery: 'pending' }],
    ['paid, key present (T-R1B-1)', {}, true, { checkout: 'complete', payment: 'paid', delivery: 'unconfirmed' }],
  ])('%s', async (_l, over, key, expected) => {
    stripeReturns(tokenSession(over));
    keyPresent(key);
    expect(await make().getStatus(USER, SID)).toEqual({ kind: 'tokens', ...expected });
  });

  it('T-R1B-1 negative control: key present, zero tokens issued (package inactive at fulfillment) → unconfirmed, not delivered', async () => {
    stripeReturns(tokenSession());
    keyPresent(true); // the webhook claimed the key, then issued nothing (W-1)
    const r: any = await make().getStatus(USER, SID);
    expect(r.delivery).toBe('unconfirmed');
    expect(processedRepo.countBy).toHaveBeenCalledWith({ eventId: `fulfillment:checkout-session:${SID}` });
  });

  it('T-R1B-1: no token response is ever `delivered`, across every Stripe state × key combination and odd inputs', async () => {
    const statuses = ['open', 'complete', 'expired'];
    const payments = ['paid', 'unpaid', 'no_payment_required', null, 'delivered', 42];
    for (const status of statuses) for (const payment_status of payments) for (const key of [true, false]) {
      stripeReturns(tokenSession({ status, payment_status, metadata: { tokenPackageId: 'pkg', userId: USER.id, delivery: 'delivered' } }));
      keyPresent(key);
      const r: any = await make().getStatus(USER, SID);
      expect(r.kind).toBe('tokens');
      expect(r.delivery).not.toBe('delivered');
      expect(['pending', 'unconfirmed', null]).toContain(r.delivery);
    }
  });

  it('T-R1B-2: the token path reads only the fulfillment key — no user_books, subscription or token data', async () => {
    stripeReturns(tokenSession());
    keyPresent(true);
    await make().getStatus(USER, SID);
    expect(processedRepo.countBy).toHaveBeenCalledTimes(1);
    expect(userBookRepo.countBy).not.toHaveBeenCalled();
    expect(subRepo.findOneBy).not.toHaveBeenCalled();
  });

  it('T-R1B-2 / T-R1B-3: the service has no token_ledger dependency and no timestamp or reason comparison (source audit)', () => {
    const src = readFileSync(join(__dirname, '../../../src/subscriptions/checkout-status.service.ts'), 'utf8');
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''); // comments may mention them; code may not
    expect(code).not.toMatch(/TokenLedger|token_ledger|tokenBalance|processedAt|createdAt|issuedAt|Purchased/);
    // Constructor: config + exactly three repositories (Subscription, UserBook, StripeProcessedEvent).
    expect(CheckoutStatusService.length).toBe(4);
  });

  it('T-R1B-3: earlier tokens / a same-instant unrelated grant cannot change the answer — balances are never consulted', async () => {
    // The service has no way to read them; the only input that changes the answer is the session's own key.
    stripeReturns(tokenSession());
    keyPresent(false);
    expect(((await make().getStatus(USER, SID)) as any).delivery).toBe('pending');
    keyPresent(true);
    expect(((await make().getStatus(USER, SID)) as any).delivery).toBe('unconfirmed');
  });

  it('no WARN log for the normal token `unconfirmed` outcome (R3.4)', async () => {
    stripeReturns(tokenSession());
    keyPresent(true);
    await make().getStatus(USER, SID);
    expect(warn).not.toHaveBeenCalled();
  });

  it('T-R1B-8: the response carries only the contract keys — no amount, currency, e-mail, ids or counts', async () => {
    stripeReturns(tokenSession());
    keyPresent(true);
    const r = await make().getStatus(USER, SID);
    expect(Object.keys(r).sort()).toEqual(['checkout', 'delivery', 'kind', 'payment']);
    expect(JSON.stringify(r)).not.toMatch(/999|usd|@|cus_|cs_|pkg|user-1/);
  });
});

describe('individual books', () => {
  it.each([
    ['paid, no key → pending', false, false, 'pending'],
    ['paid, no key, row already owned → still pending (conservative)', false, true, 'pending'],
    ['paid, key + ownership row → delivered', true, true, 'delivered'],
    ['paid, key, no ownership row → unconfirmed', true, false, 'unconfirmed'],
  ])('%s', async (_l, key, owned, delivery) => {
    stripeReturns(bookSession());
    keyPresent(key);
    ownsBook(owned);
    expect(await make().getStatus(USER, SID)).toEqual({ kind: 'book', checkout: 'complete', payment: 'paid', delivery });
  });

  it('ownership is checked for the session metadata book and the CALLER only', async () => {
    stripeReturns(bookSession());
    keyPresent(true);
    ownsBook(true);
    await make().getStatus(USER, SID);
    expect(userBookRepo.countBy).toHaveBeenCalledWith({ userId: USER.id, bookId: 'book-1' });
  });

  it('book unconfirmed → exactly one WARN, truncated id, no metadata (T-R1f)', async () => {
    stripeReturns(bookSession());
    keyPresent(true);
    ownsBook(false);
    await make().getStatus(USER, SID);
    expect(warn).toHaveBeenCalledTimes(1);
    const line = String(warn.mock.calls[0][0]);
    expect(line).toContain(truncateSessionId(SID));
    expect(line).not.toContain(SID);
    expect(line).not.toContain('book-1');
  });

  it.each([
    ['open', { status: 'open', payment_status: 'unpaid' }],
    ['expired', { status: 'expired', payment_status: 'unpaid' }],
    ['complete + unpaid with key + row', { payment_status: 'unpaid' }],
  ])('%s → delivery null even with key and ownership row', async (_l, over) => {
    stripeReturns(bookSession(over));
    keyPresent(true);
    ownsBook(true);
    expect(((await make().getStatus(USER, SID)) as any).delivery).toBeNull();
  });
});

describe('subscriptions — entitlement for THIS session only', () => {
  it.each([
    ['trialing', 'active'], ['active', 'active'], ['canceling', 'active'],
    ['past_due', 'payment_problem'], ['canceled', 'ended'], ['none', 'not_recorded'],
  ])('row tracks this subscription, status %s → %s', async (status, entitlement) => {
    stripeReturns(subSession());
    subRow({ userId: USER.id, stripeSubscriptionId: 'sub_this', status });
    expect(await make().getStatus(USER, SID)).toEqual({ kind: 'subscription', checkout: 'complete', entitlement });
  });

  it('an UNRELATED active subscription never confirms this Checkout → superseded, not active', async () => {
    stripeReturns(subSession());
    subRow({ userId: USER.id, stripeSubscriptionId: 'sub_other', status: 'active' });
    expect(((await make().getStatus(USER, SID)) as any).entitlement).toBe('superseded');
  });

  it('row still tracks an ENDED older subscription (new one not recorded yet) → not_recorded (non-terminal)', async () => {
    stripeReturns(subSession());
    subRow({ userId: USER.id, stripeSubscriptionId: 'sub_old', status: 'canceled' });
    expect(((await make().getStatus(USER, SID)) as any).entitlement).toBe('not_recorded');
  });

  it.each([[null], [{ userId: USER.id, stripeSubscriptionId: null, status: 'none' }]])('no row / no tracked id → not_recorded', async (row) => {
    stripeReturns(subSession());
    subRow(row);
    expect(((await make().getStatus(USER, SID)) as any).entitlement).toBe('not_recorded');
  });

  it('complete session without a subscription id → not_recorded, no row read', async () => {
    stripeReturns(subSession({ subscription: null }));
    expect(((await make().getStatus(USER, SID)) as any).entitlement).toBe('not_recorded');
    expect(subRepo.findOneBy).not.toHaveBeenCalled();
  });

  it('expanded subscription object is compared by id', async () => {
    stripeReturns(subSession({ subscription: { id: 'sub_this' } }));
    subRow({ userId: USER.id, stripeSubscriptionId: 'sub_this', status: 'trialing' });
    expect(((await make().getStatus(USER, SID)) as any).entitlement).toBe('active');
  });

  it.each(['open', 'expired'])('checkout %s → entitlement null, no row read', async (status) => {
    stripeReturns(subSession({ status }));
    expect(await make().getStatus(USER, SID)).toEqual({ kind: 'subscription', checkout: status, entitlement: null });
    expect(subRepo.findOneBy).not.toHaveBeenCalled();
  });

  it('reads only the CALLER\'s row', async () => {
    stripeReturns(subSession());
    await make().getStatus(USER, SID);
    expect(subRepo.findOneBy).toHaveBeenCalledWith({ userId: USER.id });
  });

  it('T-R3b: no `payment` field; active before any token allocation still makes no token claim (no token evidence read)', async () => {
    stripeReturns(subSession({ payment_status: 'paid' }));
    subRow({ userId: USER.id, stripeSubscriptionId: 'sub_this', status: 'trialing', tokenBalance: 0 });
    const r = await make().getStatus(USER, SID);
    expect(Object.keys(r).sort()).toEqual(['checkout', 'entitlement', 'kind']);
    expect(processedRepo.countBy).not.toHaveBeenCalled();
    expect(JSON.stringify(r)).not.toMatch(/sub_|cus_|token|plan/i);
  });

  it('out-of-order webhook observations: a later event moved the row to a newer live subscription → superseded; ended → ended', async () => {
    stripeReturns(subSession());
    subRow({ userId: USER.id, stripeSubscriptionId: 'sub_newer', status: 'past_due' });
    expect(((await make().getStatus(USER, SID)) as any).entitlement).toBe('superseded');
    subRow({ userId: USER.id, stripeSubscriptionId: 'sub_this', status: 'canceled' });
    expect(((await make().getStatus(USER, SID)) as any).entitlement).toBe('ended');
  });
});

describe('duplicate / repeated observations', () => {
  it('repeated calls are idempotent reads and never grant value', async () => {
    stripeReturns(tokenSession());
    keyPresent(true);
    const s = make();
    const answers = await Promise.all(Array.from({ length: 5 }, () => s.getStatus(USER, SID)));
    expect(new Set(answers.map((a) => JSON.stringify(a))).size).toBe(1);
    expect(mockStripe.checkout.sessions.retrieve).toHaveBeenCalledTimes(5);
  });
});
