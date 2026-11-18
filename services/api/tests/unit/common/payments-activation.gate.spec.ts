// Payment activation gate — every purchase / billing / webhook pathway, through the REAL services and controllers.
// REAL: SubscriptionsService, GiftsService, GiftsController, WebhooksController, payments-activation.
// MOCKED: the `stripe` package (constructor + API recorded), repositories, UsersService, PlansService, WebhooksService.
// No network, no database, no Stripe call.
const stripeCtor = jest.fn();
const sessionsCreate = jest.fn().mockResolvedValue({ id: 'cs_test_gate', url: 'https://checkout.stripe.test/gate' });
const customersCreate = jest.fn().mockResolvedValue({ id: 'cus_new' });
const portalCreate = jest.fn().mockResolvedValue({ url: 'https://billing.stripe.test/portal' });
const subsUpdate = jest.fn().mockResolvedValue({ cancel_at: 1_800_000_000 });
const subsRetrieve = jest.fn().mockResolvedValue({ status: 'active', cancel_at_period_end: false, current_period_end: 1_800_000_000, trial_end: null });
const constructEvent = jest.fn().mockReturnValue({ id: 'evt_gate', type: 'checkout.session.completed', data: { object: {} } });
jest.mock('stripe', () => jest.fn().mockImplementation((...args: unknown[]) => {
  stripeCtor(...args);
  return {
    customers: { create: customersCreate },
    checkout: { sessions: { create: sessionsCreate } },
    billingPortal: { sessions: { create: portalCreate } },
    subscriptions: { update: subsUpdate, retrieve: subsRetrieve },
    webhooks: { constructEvent },
  };
}));

import { BadRequestException, INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Book } from '../../../src/books/book.entity';
import { EmailService } from '../../../src/email/email.service';
import { GiftCard } from '../../../src/gifts/gift-card.entity';
import { GiftsController } from '../../../src/gifts/gifts.controller';
import { GiftsService } from '../../../src/gifts/gifts.service';
import { UserBook } from '../../../src/library/user-book.entity';
import { PushService } from '../../../src/push/push.service';
import { PlansService } from '../../../src/subscriptions/plans.service';
import { SubscriptionInvite } from '../../../src/subscriptions/subscription-invite.entity';
import { Subscription } from '../../../src/subscriptions/subscription.entity';
import { SubscriptionsService } from '../../../src/subscriptions/subscriptions.service';
import { TokenLedger } from '../../../src/subscriptions/token-ledger.entity';
import { WebhooksController } from '../../../src/subscriptions/webhooks.controller';
import { WebhooksService } from '../../../src/subscriptions/webhooks.service';
import { User } from '../../../src/users/user.entity';
import { UsersService } from '../../../src/users/users.service';

const LIVE = 'sk_live_51GateLiveKey';
const TEST = 'sk_test_51GateTestKey';
const RESTRICTED = 'rk_live_51GateRestricted';

const handleEvent = jest.fn().mockResolvedValue(undefined);
const repo = (over: object = {}) => ({
  findOneBy: jest.fn(), findOne: jest.fn(), find: jest.fn().mockResolvedValue([]), update: jest.fn(), save: jest.fn(async (x) => x),
  create: jest.fn((x) => x), existsBy: jest.fn(), upsert: jest.fn(), ...over,
});

async function build(flag: unknown, key: unknown) {
  const config = {
    get: (k: string, fallback?: unknown) =>
      k === 'PAYMENTS_ENABLED' ? flag : k === 'STRIPE_SECRET_KEY' ? key : k === 'STRIPE_WEBHOOK_SECRET' ? 'whsec_gate' : fallback,
  };
  const moduleRef = await Test.createTestingModule({
    controllers: [GiftsController, WebhooksController],
    providers: [
      SubscriptionsService, GiftsService,
      { provide: ConfigService, useValue: config },
      { provide: WebhooksService, useValue: { handleEvent } },
      // An existing Stripe customer: every method reaches its Stripe call instead of stopping at an earlier check.
      { provide: UsersService, useValue: { findById: jest.fn().mockResolvedValue({ id: 'u1', email: 'u1@test.invalid', stripeCustomerId: 'cus_existing' }) } },
      { provide: PlansService, useValue: {
        findById: jest.fn().mockResolvedValue({ id: 'plan-1', stripePriceId: 'price_plan_1' }),
        findTokenPackageById: jest.fn().mockResolvedValue({ id: 'pkg-1', stripePriceId: 'price_pkg_1' }),
      } },
      { provide: EmailService, useValue: {} },
      { provide: PushService, useValue: {} },
      { provide: getRepositoryToken(Subscription), useValue: repo({ findOneBy: jest.fn().mockResolvedValue({ id: 's1', userId: 'u1', stripeSubscriptionId: 'sub_1' }) }) },
      { provide: getRepositoryToken(User), useValue: repo() },
      { provide: getRepositoryToken(Book), useValue: repo({ findOneBy: jest.fn().mockResolvedValue({ id: 'b1', title: 'Book', priceCents: 500 }) }) },
      { provide: getRepositoryToken(UserBook), useValue: repo() },
      { provide: getRepositoryToken(TokenLedger), useValue: repo() },
      { provide: getRepositoryToken(SubscriptionInvite), useValue: repo() },
      { provide: getRepositoryToken(GiftCard), useValue: repo() },
    ],
  }).compile();
  return { moduleRef, subs: moduleRef.get(SubscriptionsService), gifts: moduleRef.get(GiftsService), hooks: moduleRef.get(WebhooksController) };
}

const notConfigured = (p: Promise<unknown>) => expect(p).rejects.toMatchObject({ status: 400, response: { error: 'payments_not_configured' } });
const noStripeActivity = () => {
  for (const fn of [stripeCtor, sessionsCreate, customersCreate, portalCreate, subsUpdate, subsRetrieve, constructEvent, handleEvent]) expect(fn).not.toHaveBeenCalled();
};

beforeEach(() => jest.clearAllMocks());

// Every state in which payments must stay OFF. Columns: label, PAYMENTS_ENABLED, STRIPE_SECRET_KEY.
const CLOSED_STATES: [string, unknown, unknown][] = [
  ['flag missing + live key', undefined, LIVE],
  ['flag missing + test key', undefined, TEST],
  ['flag missing + restricted live key', undefined, RESTRICTED],
  ['flag missing + no key', undefined, undefined],
  ['flag empty + live key', '', LIVE],
  ['flag empty + no key', '', undefined],
  ['flag false + live key', 'false', LIVE],
  ['flag false + test key', 'false', TEST],
  ['flag false + no key', 'false', undefined],
  ['flag TRUE (malformed) + live key', 'TRUE', LIVE],
  ['flag 1 (malformed) + live key', '1', LIVE],
  ['flag yes (malformed) + test key', 'yes', TEST],
  ['flag typo + live key', 'ture', LIVE],
  ['flag true + no key', 'true', undefined],
  ['flag true + empty key', 'true', ''],
  ['flag true + placeholder key', 'true', 'sk_test_'],
  ['flag true + publishable key', 'true', 'pk_live_51Gate'],
];

describe.each(CLOSED_STATES)('fails closed: %s', (_label, flag, key) => {
  it('builds no Stripe client in any Stripe-owning class', async () => {
    await build(flag, key);
    expect(stripeCtor).not.toHaveBeenCalled();
  });

  it('subscription checkout → 400 payments_not_configured', async () => {
    const { subs } = await build(flag, key);
    await notConfigured(subs.createCheckoutSession('u1', 'plan-1'));
    noStripeActivity();
  });

  it('token-package purchase → 400 payments_not_configured', async () => {
    const { subs } = await build(flag, key);
    await notConfigured(subs.createTokenPackageSession('u1', 'pkg-1'));
    noStripeActivity();
  });

  it('book purchase → 400 payments_not_configured', async () => {
    const { subs } = await build(flag, key);
    await notConfigured(subs.createPurchaseSession('u1', 'b1'));
    noStripeActivity();
  });

  it('gift purchase (anonymous buyer) → 400 payments_not_configured', async () => {
    const { gifts } = await build(flag, key);
    await notConfigured(gifts.createGiftSession(null, 'friend@test.invalid', 1, null, null));
    await notConfigured(gifts.createGiftSession('u1', 'friend@test.invalid', 3, 'hi', 'birthday'));
    noStripeActivity();
  });

  it('billing operations (portal, cancel, resume, sync) → 400 payments_not_configured', async () => {
    const { subs } = await build(flag, key);
    await notConfigured(subs.createPortalSession('u1'));
    await notConfigured(subs.cancelSubscription('u1'));
    await notConfigured(subs.resumeSubscription('u1'));
    await notConfigured(subs.syncSubscription('u1'));
    noStripeActivity();
  });

  it('webhook → rejected before signature verification; nothing is fulfilled', async () => {
    const { hooks } = await build(flag, key);
    const call = hooks.handleStripe({ rawBody: Buffer.from('{"type":"checkout.session.completed"}') } as never, 't=1,v1=forged');
    await expect(call).rejects.toBeInstanceOf(BadRequestException);
    await expect(call).rejects.toMatchObject({ message: 'Stripe is not configured' });
    noStripeActivity();
  });
});

describe('cannot be bypassed over HTTP on the unauthenticated routes', () => {
  let app: INestApplication;
  let base: string;
  async function boot(flag: unknown, key: unknown) {
    const { moduleRef } = await build(flag, key);
    app = moduleRef.createNestApplication({ rawBody: true, logger: false });
    await app.listen(0, '127.0.0.1');
    base = `http://127.0.0.1:${(app.getHttpServer().address() as { port: number }).port}`;
  }
  afterEach(async () => { await app?.close(); });

  it.each([
    ['flag missing + live key', undefined, LIVE],
    ['flag false + live key', 'false', LIVE],
    ['flag TRUE + test key', 'TRUE', TEST],
    ['flag true + no key', 'true', undefined],
  ])('%s: anonymous POST /gifts/checkout → 400 payments_not_configured, no session', async (_l, flag, key) => {
    await boot(flag, key);
    const res = await fetch(`${base}/gifts/checkout`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipientEmail: 'friend@test.invalid', tokenCount: 1 }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'payments_not_configured' });
    noStripeActivity();
  });

  it.each([
    ['flag missing + live key', undefined, LIVE],
    ['flag false + live key', 'false', LIVE],
    ['flag 1 + live key', '1', LIVE],
  ])('%s: POST /webhooks/stripe with any signature → 400, handler never runs', async (_l, flag, key) => {
    await boot(flag, key);
    const res = await fetch(`${base}/webhooks/stripe`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'stripe-signature': 't=1,v1=anything' },
      body: JSON.stringify({ id: 'evt_x', type: 'invoice.paid' }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).message).toBe('Stripe is not configured');
    noStripeActivity();
  });

  it('positive control: flag true + valid key → the same anonymous gift request DOES create a session', async () => {
    await boot('true', TEST);
    const res = await fetch(`${base}/gifts/checkout`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipientEmail: 'friend@test.invalid', tokenCount: 1 }),
    });
    expect(res.status).toBe(200);
    expect(sessionsCreate).toHaveBeenCalledTimes(1);
  });
});

describe.each([['test key', TEST], ['live key', LIVE], ['restricted live key', RESTRICTED]])(
  'positive control — PAYMENTS_ENABLED=true + %s: existing behaviour is unchanged', (_l, key) => {
    it('builds one client per Stripe-owning class, with that key', async () => {
      await build('true', key);
      expect(stripeCtor).toHaveBeenCalledTimes(3);
      for (const c of stripeCtor.mock.calls) expect(c[0]).toBe(key);
    });

    it('subscription checkout creates a session with the unchanged parameters (14-day trial untouched)', async () => {
      const { subs } = await build('true', key);
      await expect(subs.createCheckoutSession('u1', 'plan-1')).resolves.toEqual({ url: 'https://checkout.stripe.test/gate' });
      expect(sessionsCreate).toHaveBeenCalledWith(expect.objectContaining({
        customer: 'cus_existing', mode: 'subscription', payment_method_types: ['card'],
        line_items: [{ price: 'price_plan_1', quantity: 1 }], subscription_data: { trial_period_days: 14 },
      }));
    });

    it('token package, book and gift checkouts create sessions', async () => {
      const { subs, gifts } = await build('true', key);
      await subs.createTokenPackageSession('u1', 'pkg-1');
      await subs.createPurchaseSession('u1', 'b1');
      await gifts.createGiftSession(null, 'friend@test.invalid', 1, null, null);
      expect(sessionsCreate).toHaveBeenCalledTimes(3);
    });

    it('portal, cancel and sync reach Stripe', async () => {
      const { subs } = await build('true', key);
      await subs.createPortalSession('u1');
      await subs.cancelSubscription('u1');
      await subs.syncSubscription('u1').catch(() => undefined); // status read-back uses mocked repos
      expect(portalCreate).toHaveBeenCalledTimes(1);
      expect(subsUpdate).toHaveBeenCalledWith('sub_1', { cancel_at_period_end: true });
      expect(subsRetrieve).toHaveBeenCalledWith('sub_1');
    });

    it('webhook verifies the signature and dispatches the event', async () => {
      const { hooks } = await build('true', key);
      await expect(hooks.handleStripe({ rawBody: Buffer.from('{}') } as never, 'sig')).resolves.toEqual({ received: true });
      expect(constructEvent).toHaveBeenCalledWith(expect.any(Buffer), 'sig', 'whsec_gate');
      expect(handleEvent).toHaveBeenCalledTimes(1);
    });
  },
);
