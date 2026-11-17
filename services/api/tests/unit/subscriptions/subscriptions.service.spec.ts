import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Book } from '../../../src/books/book.entity';
import { UserBook } from '../../../src/library/user-book.entity';
import { User } from '../../../src/users/user.entity';
import { EmailService } from '../../../src/email/email.service';
import { UsersService } from '../../../src/users/users.service';
import { PlansService } from '../../../src/subscriptions/plans.service';
import { Subscription } from '../../../src/subscriptions/subscription.entity';
import { SubscriptionInvite } from '../../../src/subscriptions/subscription-invite.entity';
import { SubscriptionsService } from '../../../src/subscriptions/subscriptions.service';
import { TokenLedger } from '../../../src/subscriptions/token-ledger.entity';
import { PushService } from '../../../src/push/push.service';

const mockStripe = {
  customers: { create: jest.fn(), list: jest.fn() },
  checkout: { sessions: { create: jest.fn(), list: jest.fn(), expire: jest.fn() } },
  billingPortal: { sessions: { create: jest.fn() } },
  subscriptions: {
    update: jest.fn(),
    retrieve: jest.fn(),
    list: jest.fn(),
  },
  invoices: { listLineItems: jest.fn() },
};
/** Stripe line items with one regular subscription line whose period starts at `start`. */
const subscriptionLineItems = (start: number) => ({
  data: [{ id: 'il_1', parent: { type: 'subscription_item_details', subscription_item_details: { proration: false } }, period: { start } }],
  has_more: false,
});

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => mockStripe);
});

const mockUserRepo = {
  update: jest.fn(),
  findOneBy: jest.fn(),
};

const mockQb = { where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), leftJoinAndSelect: jest.fn().mockReturnThis(), getOne: jest.fn() };
const mockSubRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
  findOneBy: jest.fn(),
  update: jest.fn(),
  upsert: jest.fn(),
  decrement: jest.fn(),
  createQueryBuilder: jest.fn(() => mockQb),
  // Stand-in for PostgreSQL pg_advisory_xact_lock: the transaction holds a per-key mutex until fn settles.
  manager: { transaction: jest.fn() },
};
const lockQueries: Array<[string, unknown[]]> = [];
function installAdvisoryLock() {
  const held = new Map<string, Promise<void>>();
  mockSubRepo.manager.transaction.mockImplementation(async (fn: (em: any) => Promise<unknown>) => {
    let release!: () => void;
    const em = {
      getRepository: (entity: unknown) => repoFor(entity),
      query: async (sql: string, params: unknown[]) => {
        lockQueries.push([sql, params]);
        if (sql.includes('INSERT INTO stripe_processed_events')) return claimResult(String(params[0]));
        const key = String(params[0]);
        while (held.has(key)) await held.get(key);
        held.set(key, new Promise<void>((r) => { release = () => { held.delete(key); r(); }; }));
      },
    };
    try { return await fn(em); } finally { release?.(); }
  });
}

const mockBookRepo = { findOneBy: jest.fn() };

const mockOrIgnoreExecute = jest.fn();
const mockUserBookRepo = {
  existsBy: jest.fn(),
  insert: jest.fn(),
  createQueryBuilder: jest.fn(() => ({ insert: () => ({ values: (v: unknown) => ({ orIgnore: () => ({ execute: () => mockOrIgnoreExecute(v) }) }) }) })),
};
// Fulfillment-key claims (stripe_processed_events PK) seen by issueTokensForNewSubscription.
const claimed = new Set<string>();
function claimResult(key: string) {
  if (claimed.has(key)) return [];
  claimed.add(key);
  return [{ eventId: key }];
}
function repoFor(entity: unknown): any {
  if (entity === Subscription) return mockSubRepo;
  if (entity === User) return mockUserRepo;
  if (entity === TokenLedger) return mockTokenRepo;
  if (entity === UserBook) return mockUserBookRepo;
  return {};
}
/** A plain transaction manager (no lock contention) for calls that receive the webhook transaction. */
const txEm = { getRepository: repoFor, query: jest.fn(async (sql: string, params: unknown[]) => (sql.includes('INSERT INTO stripe_processed_events') ? claimResult(String(params[0])) : [])) };

const mockTokenRepo = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  count: jest.fn(),
  update: jest.fn(),
  find: jest.fn(),
};

const mockInviteRepo = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  update: jest.fn(),
};

const mockEmailService = {
  sendPlanInvite: jest.fn(),
};
const mockPushService = { sendToUser: jest.fn().mockResolvedValue(undefined) };

const mockUsersService = {
  findById: jest.fn(),
};

const mockPlansService = {
  findById: jest.fn(),
  findAll: jest.fn(),
  findTokenPackageById: jest.fn(),
};

const mockConfig = {
  getOrThrow: jest.fn((key: string) => {
    if (key === 'STRIPE_SECRET_KEY') return 'sk_test_mock';
    throw new Error(`Missing config: ${key}`);
  }),
  get: jest.fn((key: string, fallback?: string) => {
    if (key === 'STRIPE_SECRET_KEY') return 'sk_test_mock';
    return fallback ?? '';
  }),
};

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    claimed.clear();
    lockQueries.length = 0;
    installAdvisoryLock();
    mockQb.getOne.mockResolvedValue(null);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        { provide: ConfigService, useValue: mockConfig },
        { provide: UsersService, useValue: mockUsersService },
        { provide: PlansService, useValue: mockPlansService },
        { provide: EmailService, useValue: mockEmailService },
        { provide: PushService, useValue: mockPushService },
        { provide: getRepositoryToken(Subscription), useValue: mockSubRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(Book), useValue: mockBookRepo },
        { provide: getRepositoryToken(UserBook), useValue: mockUserBookRepo },
        { provide: getRepositoryToken(TokenLedger), useValue: mockTokenRepo },
        { provide: getRepositoryToken(SubscriptionInvite), useValue: mockInviteRepo },
      ],
    }).compile();

    service = module.get(SubscriptionsService);
  });

  describe('getOrCreateStripeCustomer', () => {
    it('returns existing stripeCustomerId without creating new customer', async () => {
      mockUsersService.findById.mockResolvedValue({ id: 'u1', stripeCustomerId: 'cus_existing' });
      const result = await service.getOrCreateStripeCustomer('u1');
      expect(result).toBe('cus_existing');
      expect(mockStripe.customers.create).not.toHaveBeenCalled();
    });

    it('creates Stripe customer and saves id when user has none', async () => {
      mockUsersService.findById.mockResolvedValue({ id: 'u1', email: 'a@b.com', stripeCustomerId: null });
      mockStripe.customers.create.mockResolvedValue({ id: 'cus_new' });
      mockUserRepo.update.mockResolvedValue(undefined);

      const result = await service.getOrCreateStripeCustomer('u1');
      expect(result).toBe('cus_new');
      expect(mockStripe.customers.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'a@b.com' }),
      );
      expect(mockUserRepo.update).toHaveBeenCalledWith('u1', { stripeCustomerId: 'cus_new' });
    });

    it('throws NotFoundException when user does not exist', async () => {
      mockUsersService.findById.mockResolvedValue(null);
      await expect(service.getOrCreateStripeCustomer('ghost')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createCheckoutSession — duplicate-subscription protection', () => {
    const PLAN = { id: 'plan1', stripePriceId: 'price_123' };
    const none = { data: [], has_more: false };

    beforeEach(() => {
      lockQueries.length = 0;
      installAdvisoryLock();
      mockUsersService.findById.mockResolvedValue({ id: 'u1', stripeCustomerId: 'cus_1' });
      mockPlansService.findById.mockResolvedValue(PLAN);
      mockSubRepo.findOneBy.mockResolvedValue(null);
      mockStripe.checkout.sessions.list.mockResolvedValue(none);
      mockStripe.subscriptions.list.mockResolvedValue(none);
      mockStripe.checkout.sessions.create.mockResolvedValue({ id: 'cs_new', url: 'https://checkout.stripe.com/new' });
    });

    it('genuinely unsubscribed user → one session with unchanged price, trial and URLs, tagged with plan metadata', async () => {
      const result = await service.createCheckoutSession('u1', 'plan1');
      expect(result).toEqual({ url: 'https://checkout.stripe.com/new' });
      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledTimes(1);
      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(expect.objectContaining({
        customer: 'cus_1',
        line_items: [{ price: 'price_123', quantity: 1 }],
        mode: 'subscription',
        subscription_data: { trial_period_days: 14 },
        metadata: { noetiaUserId: 'u1', noetiaPlanId: 'plan1', noetiaTrial: 'yes' },
      }));
      expect(lockQueries[0]).toEqual(['SELECT pg_advisory_xact_lock(hashtext($1))', ['subscription-checkout:u1']]);
    });

    it('throws BadRequestException for invalid planId (no lock, no Stripe call)', async () => {
      mockPlansService.findById.mockResolvedValue(null);
      await expect(service.createCheckoutSession('u1', 'bad-plan')).rejects.toThrow(BadRequestException);
      expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled();
    });

    it.each(['active', 'trialing', 'canceling', 'past_due'])(
      'local %s subscription → 409 subscription_exists, nothing created',
      async (status) => {
        mockSubRepo.findOneBy.mockResolvedValue({ userId: 'u1', status, stripeSubscriptionId: 'sub_1', planId: null });
        const err = await service.createCheckoutSession('u1', 'plan1').catch((e) => e);
        expect(err).toBeInstanceOf(ConflictException);
        expect(err.getResponse()).toMatchObject({ error: 'subscription_exists', status });
        expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled();
      },
    );

    it('missing planId on a live local record does not bypass protection', async () => {
      mockSubRepo.findOneBy.mockResolvedValue({ userId: 'u1', status: 'trialing', stripeSubscriptionId: 'sub_1', planId: null });
      await expect(service.createCheckoutSession('u1', 'plan1')).rejects.toThrow(ConflictException);
    });

    it.each([
      ['active', false, 'active'],
      ['trialing', false, 'trialing'],
      ['active', true, 'canceling'],
      ['past_due', false, 'past_due'],
      ['unpaid', false, 'none'],
      ['incomplete', false, 'none'],
      ['paused', false, 'none'],
    ])('no local record but Stripe has a %s subscription (cancel_at_period_end=%s) → 409 (delayed webhook)', async (stripeStatus, cape, mapped) => {
      mockStripe.subscriptions.list.mockResolvedValue({ data: [{ id: 'sub_s', status: stripeStatus, cancel_at_period_end: cape }], has_more: false });
      const err = await service.createCheckoutSession('u1', 'plan1').catch((e) => e);
      expect(err).toBeInstanceOf(ConflictException);
      expect(err.getResponse()).toMatchObject({ error: 'subscription_exists', status: mapped });
      expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled();
    });

    it('stale local record (canceled) but Stripe still has a live subscription → 409', async () => {
      mockSubRepo.findOneBy.mockResolvedValue({ userId: 'u1', status: 'canceled', stripeSubscriptionId: 'sub_old', stripeCustomerId: 'cus_1' });
      mockStripe.subscriptions.list.mockResolvedValue({ data: [{ id: 'sub_live', status: 'active', cancel_at_period_end: false }], has_more: false });
      await expect(service.createCheckoutSession('u1', 'plan1')).rejects.toThrow(ConflictException);
    });

    it('checks every known Stripe customer (local record under an older customer id)', async () => {
      mockSubRepo.findOneBy.mockResolvedValue({ userId: 'u1', status: 'none', stripeSubscriptionId: null, stripeCustomerId: 'cus_old' });
      mockStripe.subscriptions.list.mockImplementation(async ({ customer }: any) =>
        customer === 'cus_old' ? { data: [{ id: 'sub_x', status: 'trialing' }], has_more: false } : none);
      await expect(service.createCheckoutSession('u1', 'plan1')).rejects.toThrow(ConflictException);
      expect(mockStripe.subscriptions.list).toHaveBeenCalledWith({ customer: 'cus_old', status: 'all', limit: 100 });
    });

    it('canceled / incomplete_expired Stripe subscriptions do not block a new one', async () => {
      mockStripe.subscriptions.list.mockResolvedValue({ data: [{ id: 'a', status: 'canceled' }, { id: 'b', status: 'incomplete_expired' }], has_more: false });
      await expect(service.createCheckoutSession('u1', 'plan1')).resolves.toEqual({ url: 'https://checkout.stripe.com/new' });
    });

    it('Stripe subscription lookup failure is NOT treated as "no subscription" → 503, nothing created', async () => {
      mockStripe.subscriptions.list.mockRejectedValue(new Error('stripe timeout'));
      const err = await service.createCheckoutSession('u1', 'plan1').catch((e) => e);
      expect(err).toBeInstanceOf(ServiceUnavailableException);
      expect(err.getResponse()).toMatchObject({ error: 'subscription_status_unavailable' });
      expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled();
    });

    it('open-session lookup failure → 503, nothing created', async () => {
      mockStripe.checkout.sessions.list.mockRejectedValue(new Error('stripe 500'));
      await expect(service.createCheckoutSession('u1', 'plan1')).rejects.toThrow(ServiceUnavailableException);
      expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled();
    });

    it('a truncated subscription list cannot prove "none" → 503', async () => {
      mockStripe.subscriptions.list.mockResolvedValue({ data: [{ id: 'old', status: 'canceled' }], has_more: true });
      await expect(service.createCheckoutSession('u1', 'plan1')).rejects.toThrow(ServiceUnavailableException);
    });

    it('repeated click: an open session for the same plan is reused, not duplicated', async () => {
      mockStripe.checkout.sessions.list.mockResolvedValue({
        data: [{ id: 'cs_open', mode: 'subscription', url: 'https://checkout.stripe.com/open', metadata: { noetiaPlanId: 'plan1' } }],
        has_more: false,
      });
      await expect(service.createCheckoutSession('u1', 'plan1')).resolves.toEqual({ url: 'https://checkout.stripe.com/open' });
      expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled();
      expect(mockStripe.checkout.sessions.expire).not.toHaveBeenCalled();
    });

    it('an open session for another plan (or untagged) is expired before the new one is created', async () => {
      mockStripe.checkout.sessions.list.mockResolvedValue({
        data: [
          { id: 'cs_other', mode: 'subscription', url: 'u1', metadata: { noetiaPlanId: 'plan2' } },
          { id: 'cs_legacy', mode: 'subscription', url: 'u2', metadata: {} },
          { id: 'cs_tokens', mode: 'payment', url: 'u3', metadata: {} },
        ],
        has_more: false,
      });
      mockStripe.checkout.sessions.expire.mockResolvedValue({});
      await service.createCheckoutSession('u1', 'plan1');
      expect(mockStripe.checkout.sessions.expire).toHaveBeenCalledWith('cs_other');
      expect(mockStripe.checkout.sessions.expire).toHaveBeenCalledWith('cs_legacy');
      expect(mockStripe.checkout.sessions.expire).not.toHaveBeenCalledWith('cs_tokens'); // token purchases untouched
      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledTimes(1);
    });

    it('an open session that can no longer be expired (completing) → 409 checkout_pending, nothing created', async () => {
      mockStripe.checkout.sessions.list.mockResolvedValue({
        data: [{ id: 'cs_other', mode: 'subscription', url: 'u1', metadata: { noetiaPlanId: 'plan2' } }], has_more: false,
      });
      mockStripe.checkout.sessions.expire.mockRejectedValue(new Error('session is complete'));
      const err = await service.createCheckoutSession('u1', 'plan1').catch((e) => e);
      expect(err).toBeInstanceOf(ConflictException);
      expect(err.getResponse()).toMatchObject({ error: 'checkout_pending' });
      expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled();
    });

    it('open sessions are listed BEFORE subscriptions (a session completing mid-request is never missed)', async () => {
      const order: string[] = [];
      mockStripe.checkout.sessions.list.mockImplementation(async () => { order.push('sessions'); return none; });
      mockStripe.subscriptions.list.mockImplementation(async () => { order.push('subscriptions'); return none; });
      await service.createCheckoutSession('u1', 'plan1');
      expect(order).toEqual(['sessions', 'subscriptions']);
    });

    it('concurrent requests for one user are serialized: exactly one session is created, the other reuses it', async () => {
      const openSessions: any[] = [];
      mockStripe.checkout.sessions.list.mockImplementation(async () => ({ data: [...openSessions], has_more: false }));
      mockStripe.checkout.sessions.create.mockImplementation(async (params: any) => {
        await new Promise((r) => setTimeout(r, 5)); // Stripe latency: the race window without a lock
        const cs = { id: `cs_${openSessions.length + 1}`, mode: 'subscription', url: `https://checkout.stripe.com/${openSessions.length + 1}`, metadata: params.metadata };
        openSessions.push(cs);
        return cs;
      });
      const results = await Promise.all([service.createCheckoutSession('u1', 'plan1'), service.createCheckoutSession('u1', 'plan1')]);
      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledTimes(1);
      expect(results[0]).toEqual(results[1]);
    });

    it('concurrent requests for different plans never leave two open subscription sessions', async () => {
      const openSessions: any[] = [];
      mockStripe.checkout.sessions.list.mockImplementation(async () => ({ data: openSessions.filter((c) => !c.expired), has_more: false }));
      mockStripe.checkout.sessions.expire.mockImplementation(async (id: string) => { openSessions.find((c) => c.id === id).expired = true; });
      mockStripe.checkout.sessions.create.mockImplementation(async (params: any) => {
        await new Promise((r) => setTimeout(r, 5));
        const cs = { id: `cs_${openSessions.length + 1}`, mode: 'subscription', url: 'x', metadata: params.metadata };
        openSessions.push(cs);
        return cs;
      });
      mockPlansService.findById.mockImplementation(async (id: string) => ({ id, stripePriceId: `price_${id}` }));
      await Promise.all([service.createCheckoutSession('u1', 'plan1'), service.createCheckoutSession('u1', 'plan2')]);
      expect(openSessions.filter((c) => !c.expired)).toHaveLength(1);
    });

    it('a request that sees the first checkout completed (delayed webhook) is refused, not duplicated', async () => {
      // 1st request creates a session; the customer pays; Stripe now lists the subscription, the webhook has not arrived.
      await service.createCheckoutSession('u1', 'plan1');
      mockStripe.subscriptions.list.mockResolvedValue({ data: [{ id: 'sub_paid', status: 'trialing' }], has_more: false });
      await expect(service.createCheckoutSession('u1', 'plan1')).rejects.toThrow(ConflictException);
      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledTimes(1);
    });

    it('never cancels or modifies an existing Stripe subscription', async () => {
      mockStripe.subscriptions.list.mockResolvedValue({ data: [{ id: 'sub_s', status: 'active' }], has_more: false });
      await service.createCheckoutSession('u1', 'plan1').catch(() => undefined);
      expect(mockStripe.subscriptions.update).not.toHaveBeenCalled();
    });
  });

  describe('createCheckoutSession — listing truncation and ambiguous create (timeout) recovery', () => {
    const PLAN = { id: 'plan1', stripePriceId: 'price_123' };
    const none = { data: [], has_more: false };
    const stripeErr = (type: string) => Object.assign(new Error(type), { type });

    beforeEach(() => {
      mockUsersService.findById.mockResolvedValue({ id: 'u1', stripeCustomerId: 'cus_1' });
      mockPlansService.findById.mockResolvedValue(PLAN);
      mockSubRepo.findOneBy.mockResolvedValue(null);
      mockStripe.checkout.sessions.list.mockResolvedValue(none);
      mockStripe.subscriptions.list.mockResolvedValue(none);
    });

    it('a first page of 100 open sessions with more pages is not an inventory → 503, nothing created', async () => {
      mockStripe.checkout.sessions.list.mockResolvedValue({
        data: Array.from({ length: 100 }, (_, i) => ({ id: `cs_${i}`, mode: 'payment', url: null, metadata: {} })),
        has_more: true,
      });
      await expect(service.createCheckoutSession('u1', 'plan1')).rejects.toThrow(ServiceUnavailableException);
      expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled();
      expect(mockStripe.checkout.sessions.expire).not.toHaveBeenCalled();
    });

    it('timeout after Stripe created the session → the created session is found and returned; no second create', async () => {
      mockStripe.checkout.sessions.create.mockRejectedValue(stripeErr('StripeConnectionError'));
      mockStripe.checkout.sessions.list
        .mockResolvedValueOnce(none) // guard listing, before the create
        .mockResolvedValueOnce({ data: [{ id: 'cs_made', mode: 'subscription', url: 'https://checkout.stripe.com/made', metadata: { noetiaPlanId: 'plan1' } }], has_more: false });
      await expect(service.createCheckoutSession('u1', 'plan1')).resolves.toEqual({ url: 'https://checkout.stripe.com/made' });
      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledTimes(1);
    });

    it('timeout and no session visible → 409 checkout_pending (no blind re-create); the retry reuses it once visible', async () => {
      mockStripe.checkout.sessions.create.mockRejectedValueOnce(stripeErr('StripeAPIError'));
      await expect(service.createCheckoutSession('u1', 'plan1')).rejects.toMatchObject({ response: { error: 'checkout_pending' } });
      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledTimes(1);
      // User retries; Stripe had in fact created it.
      mockStripe.checkout.sessions.list.mockResolvedValue({ data: [{ id: 'cs_made', mode: 'subscription', url: 'https://checkout.stripe.com/made', metadata: { noetiaPlanId: 'plan1' } }], has_more: false });
      await expect(service.createCheckoutSession('u1', 'plan1')).resolves.toEqual({ url: 'https://checkout.stripe.com/made' });
      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledTimes(1);
    });

    it('timeout and the re-list also fails → 409 checkout_pending', async () => {
      mockStripe.checkout.sessions.create.mockRejectedValue(stripeErr('StripeConnectionError'));
      mockStripe.checkout.sessions.list.mockResolvedValueOnce(none).mockRejectedValueOnce(new Error('network'));
      await expect(service.createCheckoutSession('u1', 'plan1')).rejects.toBeInstanceOf(ConflictException);
    });

    it('a session for ANOTHER plan found after a timeout is not returned for this plan', async () => {
      mockStripe.checkout.sessions.create.mockRejectedValue(stripeErr('StripeConnectionError'));
      mockStripe.checkout.sessions.list.mockResolvedValueOnce(none).mockResolvedValueOnce({ data: [{ id: 'cs_x', mode: 'subscription', url: 'u', metadata: { noetiaPlanId: 'plan2' } }], has_more: false });
      await expect(service.createCheckoutSession('u1', 'plan1')).rejects.toBeInstanceOf(ConflictException);
    });

    it('a definitive Stripe rejection (nothing created) is re-thrown unchanged', async () => {
      const err = stripeErr('StripeInvalidRequestError');
      mockStripe.checkout.sessions.create.mockRejectedValue(err);
      await expect(service.createCheckoutSession('u1', 'plan1')).rejects.toBe(err);
      expect(mockStripe.checkout.sessions.list).toHaveBeenCalledTimes(1); // no recovery listing
    });
  });

  describe('createCheckoutSession — D1 one trial per eligible customer', () => {
    const PLAN = { id: 'plan1', stripePriceId: 'price_123' };
    const none = { data: [], has_more: false };
    const created = () => mockStripe.checkout.sessions.create.mock.calls[0][0];

    beforeEach(() => {
      mockUsersService.findById.mockResolvedValue({ id: 'u1', stripeCustomerId: 'cus_1', email: 'reader@test.invalid' });
      mockPlansService.findById.mockResolvedValue(PLAN);
      mockSubRepo.findOneBy.mockResolvedValue(null);
      mockStripe.checkout.sessions.list.mockResolvedValue(none);
      mockStripe.subscriptions.list.mockResolvedValue(none);
      mockStripe.customers.list.mockResolvedValue(none);
      mockStripe.checkout.sessions.create.mockResolvedValue({ id: 'cs_new', url: 'https://checkout.stripe.com/new' });
    });

    it('first-time customer (no Noetia or Stripe subscription history) → 14-day trial, tagged noetiaTrial=yes', async () => {
      await service.createCheckoutSession('u1', 'plan1');
      expect(created().subscription_data).toEqual({ trial_period_days: 14 });
      expect(created().metadata).toEqual({ noetiaUserId: 'u1', noetiaPlanId: 'plan1', noetiaTrial: 'yes' });
      expect(mockStripe.subscriptions.list).toHaveBeenCalledWith({ customer: 'cus_1', status: 'all', limit: 100 });
      expect(mockStripe.customers.list).toHaveBeenCalledWith({ email: 'reader@test.invalid', limit: 100 });
    });

    it('returning subscriber (ended Noetia subscription row) → may subscribe again, WITHOUT a trial', async () => {
      mockSubRepo.findOneBy.mockResolvedValue({ userId: 'u1', status: 'canceled', stripeSubscriptionId: 'sub_old', stripeCustomerId: 'cus_1' });
      await service.createCheckoutSession('u1', 'plan1');
      expect(created()).not.toHaveProperty('subscription_data');
      expect(created().metadata.noetiaTrial).toBe('no');
    });

    it('cancelled during a previous trial (Stripe: canceled with trial_start) → no new trial', async () => {
      mockStripe.subscriptions.list.mockResolvedValue({ data: [{ id: 'sub_t', status: 'canceled', trial_start: 1 }], has_more: false });
      await service.createCheckoutSession('u1', 'plan1');
      expect(created()).not.toHaveProperty('subscription_data');
    });

    it('a subscription that never started (only incomplete_expired) does not consume eligibility', async () => {
      mockStripe.subscriptions.list.mockResolvedValue({ data: [{ id: 'sub_x', status: 'incomplete_expired', trial_start: null }], has_more: false });
      await service.createCheckoutSession('u1', 'plan1');
      expect(created().subscription_data).toEqual({ trial_period_days: 14 });
    });

    it('gift and token-package purchases alone do not consume eligibility (they are not subscriptions)', async () => {
      // A buyer of one-time payments has a Stripe customer but no subscription history at all.
      await service.createCheckoutSession('u1', 'plan1');
      expect(created().subscription_data).toEqual({ trial_period_days: 14 });
    });

    it('linked Duo/Family member who never held an own subscription stays eligible', async () => {
      mockSubRepo.findOneBy.mockResolvedValue(null); // members have no own row; the owner's row is not theirs
      await service.createCheckoutSession('u1', 'plan1');
      expect(created().subscription_data).toEqual({ trial_period_days: 14 });
    });

    it('deleted-and-recreated account: another Stripe customer with the same e-mail has history → no trial, and its live subscription is NOT a duplicate block', async () => {
      mockStripe.customers.list.mockResolvedValue({ data: [{ id: 'cus_1' }, { id: 'cus_previous' }], has_more: false });
      mockStripe.subscriptions.list.mockImplementation(async ({ customer }: any) =>
        customer === 'cus_previous' ? { data: [{ id: 'sub_prev', status: 'active', trial_start: 1 }], has_more: false } : none);
      await service.createCheckoutSession('u1', 'plan1');
      expect(created()).not.toHaveProperty('subscription_data');
      expect(mockStripe.subscriptions.list).toHaveBeenCalledTimes(2); // own customer + the other one (cus_1 not scanned twice)
    });

    it.each([
      ['a truncated subscription history', () => mockStripe.subscriptions.list.mockResolvedValue({ data: [{ id: 's', status: 'canceled' }], has_more: true })],
      ['a truncated customer list', () => mockStripe.customers.list.mockResolvedValue({ data: [], has_more: true })],
      ['a Stripe error on the customer lookup', () => mockStripe.customers.list.mockRejectedValue(new Error('stripe down'))],
    ])('history cannot be verified (%s) → 503, no session, never a surprise charge', async (_label, arrange) => {
      arrange();
      await expect(service.createCheckoutSession('u1', 'plan1')).rejects.toThrow(ServiceUnavailableException);
      expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled();
    });

    it('an open session carrying a trial is NOT reused for a now-ineligible customer: it is expired and a no-trial session is created', async () => {
      mockSubRepo.findOneBy.mockResolvedValue({ userId: 'u1', status: 'canceled', stripeSubscriptionId: 'sub_old', stripeCustomerId: 'cus_1' });
      mockStripe.checkout.sessions.list.mockResolvedValue({ data: [{ id: 'cs_trial', mode: 'subscription', url: 'u', metadata: { noetiaPlanId: 'plan1' } }], has_more: false });
      mockStripe.checkout.sessions.expire.mockResolvedValue({});
      await service.createCheckoutSession('u1', 'plan1');
      expect(mockStripe.checkout.sessions.expire).toHaveBeenCalledWith('cs_trial');
      expect(created().metadata.noetiaTrial).toBe('no');
    });

    it('a matching open session (same plan, same trial offer) is reused', async () => {
      mockStripe.checkout.sessions.list.mockResolvedValue({ data: [{ id: 'cs_ok', mode: 'subscription', url: 'https://checkout.stripe.com/ok', metadata: { noetiaPlanId: 'plan1', noetiaTrial: 'yes' } }], has_more: false });
      await expect(service.createCheckoutSession('u1', 'plan1')).resolves.toEqual({ url: 'https://checkout.stripe.com/ok' });
      expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled();
    });
  });

  describe('getTrialEligibility / GET /subscriptions/me?trialEligibility=1 (D1, D6)', () => {
    beforeEach(() => {
      mockUsersService.findById.mockResolvedValue({ id: 'u1', stripeCustomerId: 'cus_1', email: 'reader@test.invalid' });
      mockSubRepo.findOneBy.mockResolvedValue(null);
      mockStripe.subscriptions.list.mockResolvedValue({ data: [], has_more: false });
      mockStripe.customers.list.mockResolvedValue({ data: [], has_more: false });
    });

    it('first-time customer → true', async () => {
      await expect(service.getTrialEligibility('u1')).resolves.toBe(true);
    });

    it('own Noetia subscription history → false without calling Stripe', async () => {
      mockSubRepo.findOneBy.mockResolvedValue({ userId: 'u1', stripeSubscriptionId: 'sub_old', status: 'canceled' });
      await expect(service.getTrialEligibility('u1')).resolves.toBe(false);
      expect(mockStripe.subscriptions.list).not.toHaveBeenCalled();
    });

    it('Stripe history only → false', async () => {
      mockStripe.subscriptions.list.mockResolvedValue({ data: [{ id: 's', status: 'canceled', trial_start: 1 }], has_more: false });
      await expect(service.getTrialEligibility('u1')).resolves.toBe(false);
    });

    it('unverifiable (Stripe error) → null, so no trial is advertised', async () => {
      jest.spyOn((service as any).logger, 'warn').mockImplementation(() => undefined);
      mockStripe.subscriptions.list.mockRejectedValue(new Error('down'));
      await expect(service.getTrialEligibility('u1')).resolves.toBeNull();
    });

    it('a user without a Stripe customer is checked by e-mail only', async () => {
      mockUsersService.findById.mockResolvedValue({ id: 'u1', stripeCustomerId: null, email: 'new@test.invalid' });
      await expect(service.getTrialEligibility('u1')).resolves.toBe(true);
      expect(mockStripe.subscriptions.list).not.toHaveBeenCalled();
      expect(mockStripe.customers.list).toHaveBeenCalledWith({ email: 'new@test.invalid', limit: 100 });
    });

    it('getSubscriptionStatus adds trialEligible ONLY when asked (other callers make no Stripe call)', async () => {
      mockSubRepo.findOne.mockResolvedValue(null);
      const plain = await service.getSubscriptionStatus('u1');
      expect(plain).toEqual({ status: 'none' });
      expect(mockStripe.customers.list).not.toHaveBeenCalled();
      await expect(service.getSubscriptionStatus('u1', { includeTrialEligibility: true })).resolves.toEqual({ status: 'none', trialEligible: true });
    });
  });

  describe('issueDueAnnualCycles — one annual period, Stripe-anchored (D2, D3)', () => {
    const at = (s: string) => new Date(`${s}Z`);
    const sec = (s: string) => Math.floor(at(s).getTime() / 1000);
    const stripeSub = (over: any = {}) => ({
      id: 'sub_y', status: 'active', cancel_at_period_end: false,
      current_period_start: sec('2027-01-15T12:00:00'), current_period_end: sec('2028-01-15T12:00:00'),
      billing_cycle_anchor: sec('2027-01-15T12:00:00'), ...over,
    });
    beforeEach(() => {
      mockSubRepo.findOne.mockResolvedValue({ id: 'row1', userId: 'u1', status: 'active', plan: { interval: 'year', tokensPerCycle: 2 } });
      mockTokenRepo.create.mockImplementation((d: any) => d);
      mockTokenRepo.save.mockResolvedValue([]);
      mockSubRepo.update.mockResolvedValue(undefined);
    });

    it('grants every cycle due so far (catch-up), each claimed once; sets the hint to the next anniversary', async () => {
      mockStripe.subscriptions.retrieve.mockResolvedValue(stripeSub());
      const n = await service.issueDueAnnualCycles('sub_y', at('2027-04-20T00:00:00'));
      expect(n).toBe(3); // Feb 15, Mar 15, Apr 15
      expect(mockTokenRepo.save).toHaveBeenCalledTimes(3);
      expect(mockTokenRepo.save.mock.calls[0][0]).toHaveLength(2); // tokensPerCycle unchanged
      expect([...claimed]).toEqual([1, 2, 3].map((k) => `fulfillment:annual-cycle:sub_y:${sec('2027-01-15T12:00:00')}:${k}`));
      expect(mockSubRepo.update).toHaveBeenCalledWith('row1', { nextTokenIssuanceAt: at('2027-05-15T12:00:00') });
      // Re-run (another instance, or tomorrow): nothing new.
      expect(await service.issueDueAnnualCycles('sub_y', at('2027-04-21T00:00:00'))).toBe(0);
    });

    it('D3: cancel at period end (Stripe active + cancel_at_period_end, local canceling) keeps the allocations', async () => {
      mockStripe.subscriptions.retrieve.mockResolvedValue(stripeSub({ cancel_at_period_end: true }));
      mockSubRepo.findOne.mockResolvedValue({ id: 'row1', userId: 'u1', status: 'canceling', plan: { interval: 'year', tokensPerCycle: 1 } });
      expect(await service.issueDueAnnualCycles('sub_y', at('2027-12-31T00:00:00'))).toBe(11);
    });

    it('never after the paid period expired, never the next period early', async () => {
      mockStripe.subscriptions.retrieve.mockResolvedValue(stripeSub());
      expect(await service.issueDueAnnualCycles('sub_y', at('2028-01-16T00:00:00'))).toBe(0);
      expect(mockSubRepo.update).toHaveBeenCalledWith('row1', { nextTokenIssuanceAt: at('2028-01-15T12:00:00') });
    });

    it.each([['past_due'], ['unpaid'], ['canceled'], ['trialing']])('Stripe status %s → nothing', async (status) => {
      mockStripe.subscriptions.retrieve.mockResolvedValue(stripeSub({ status }));
      expect(await service.issueDueAnnualCycles('sub_y', at('2027-06-01T00:00:00'))).toBe(0);
      expect(mockTokenRepo.save).not.toHaveBeenCalled();
    });

    it('reads the period from the subscription item in the newer Stripe API shape', async () => {
      const s = stripeSub();
      mockStripe.subscriptions.retrieve.mockResolvedValue({ ...s, current_period_start: undefined, current_period_end: undefined, items: { data: [{ current_period_start: s.current_period_start, current_period_end: s.current_period_end }] } });
      expect(await service.issueDueAnnualCycles('sub_y', at('2027-02-16T00:00:00'))).toBe(1);
    });

    it('local row no longer live, or not an annual plan → nothing', async () => {
      mockStripe.subscriptions.retrieve.mockResolvedValue(stripeSub());
      mockSubRepo.findOne.mockResolvedValueOnce({ id: 'row1', userId: 'u1', status: 'canceled', plan: { interval: 'year', tokensPerCycle: 1 } });
      expect(await service.issueDueAnnualCycles('sub_y', at('2027-03-01T00:00:00'))).toBe(0);
      mockSubRepo.findOne.mockResolvedValueOnce({ id: 'row1', userId: 'u1', status: 'active', plan: { interval: 'month', tokensPerCycle: 1 } });
      expect(await service.issueDueAnnualCycles('sub_y', at('2027-03-01T00:00:00'))).toBe(0);
    });

    it('a crash after the grant but before COMMIT leaves the cycle unclaimed for the retry (the claim is in the same transaction)', async () => {
      mockStripe.subscriptions.retrieve.mockResolvedValue(stripeSub());
      mockTokenRepo.save.mockRejectedValueOnce(new Error('crash'));
      await expect(service.issueDueAnnualCycles('sub_y', at('2027-02-16T00:00:00'))).rejects.toThrow('crash');
    });
  });

  describe('issueTokensForNewSubscription — once per billing period (D5)', () => {
    beforeEach(() => {
      mockSubRepo.findOne.mockResolvedValue({ id: 'sub1', userId: 'u1', plan: { tokensPerCycle: 1, interval: 'month' } });
      mockTokenRepo.create.mockImplementation((d: any) => d);
      mockTokenRepo.save.mockResolvedValue([]);
    });

    it('a reissued invoice (new id) for the same period grants nothing', async () => {
      await service.issueTokensForNewSubscription('sub_s', txEm as any, 'in_1', 1800000000);
      await service.issueTokensForNewSubscription('sub_s', txEm as any, 'in_1_reissued', 1800000000);
      expect(mockTokenRepo.save).toHaveBeenCalledTimes(1);
      expect(claimed.has('fulfillment:period-tokens:sub_s:1800000000')).toBe(true);
    });

    it('the next period grants again', async () => {
      await service.issueTokensForNewSubscription('sub_s', txEm as any, 'in_1', 1800000000);
      await service.issueTokensForNewSubscription('sub_s', txEm as any, 'in_2', 1802592000);
      expect(mockTokenRepo.save).toHaveBeenCalledTimes(2);
    });

    it('F-02: payload without the subscription line → period read from Stripe line items; a different invoice for the same period grants nothing', async () => {
      mockStripe.invoices.listLineItems.mockResolvedValue(subscriptionLineItems(1800000000));
      await service.issueTokensForNewSubscription('sub_s', txEm as any, 'in_a', null);
      await service.issueTokensForNewSubscription('sub_s', txEm as any, 'in_b', null);
      expect(mockTokenRepo.save).toHaveBeenCalledTimes(1);
      expect(claimed.has('fulfillment:period-tokens:sub_s:1800000000')).toBe(true);
      expect(mockStripe.invoices.listLineItems).toHaveBeenCalledWith('in_a', { limit: 100 });
    });

    it('F-02: the subscription line on a later page of Stripe line items is found (pagination)', async () => {
      const proration = (i: number) => ({ id: `il_p${i}`, parent: { type: 'invoice_item_details', invoice_item_details: { proration: true } }, period: { start: 1 } });
      mockStripe.invoices.listLineItems
        .mockResolvedValueOnce({ data: [proration(1), proration(2)], has_more: true })
        .mockResolvedValueOnce(subscriptionLineItems(1800000000));
      await service.issueTokensForNewSubscription('sub_s', txEm as any, 'in_p', null);
      expect(mockStripe.invoices.listLineItems).toHaveBeenNthCalledWith(2, 'in_p', { limit: 100, starting_after: 'il_p2' });
      expect(claimed.has('fulfillment:period-tokens:sub_s:1800000000')).toBe(true);
    });

    it('F-02: period still unknown → fails CLOSED: throws before any claim or allocation (the transaction rolls back; Stripe retries)', async () => {
      mockStripe.invoices.listLineItems.mockResolvedValue({ data: [{ id: 'il_x', type: 'invoiceitem', period: { start: 5 } }], has_more: false });
      await expect(service.issueTokensForNewSubscription('sub_s', txEm as any, 'in_u', null)).rejects.toThrow('[invoice-period]');
      expect(claimed.size).toBe(0);
      expect(mockTokenRepo.save).not.toHaveBeenCalled();
    });

    it('F-02: a Stripe error while reading line items propagates (no claim, no allocation)', async () => {
      mockStripe.invoices.listLineItems.mockRejectedValue(new Error('stripe down'));
      await expect(service.issueTokensForNewSubscription('sub_s', txEm as any, 'in_e', null)).rejects.toThrow('stripe down');
      expect(claimed.size).toBe(0);
    });

    it('F-02: no invoice id and no period → fails closed', async () => {
      await expect(service.issueTokensForNewSubscription('sub_s', txEm as any, null, null)).rejects.toThrow('[invoice-period]');
      expect(mockStripe.invoices.listLineItems).not.toHaveBeenCalled();
    });

    it('F-02: a period already in the payload is used as-is (no Stripe call)', async () => {
      await service.issueTokensForNewSubscription('sub_s', txEm as any, 'in_ok', 1800000000);
      expect(mockStripe.invoices.listLineItems).not.toHaveBeenCalled();
      expect(mockTokenRepo.save).toHaveBeenCalledTimes(1);
    });
  });

  describe('F-01 — trial-eligibility behaviour matrix (CURRENT behaviour pinned; one case awaits a PO decision)', () => {
    // Characterization only: no behaviour was changed by the F-01 review. Rows marked PENDING-PO are the cases D1
    // does not clearly decide (report §14.B); they pin today's conservative result until the PO decides.
    const PLAN = { id: 'plan1', stripePriceId: 'price_123' };
    const none = { data: [], has_more: false };
    const trialOf = () => mockStripe.checkout.sessions.create.mock.calls[0]?.[0]?.subscription_data ?? null;
    beforeEach(() => {
      mockUsersService.findById.mockResolvedValue({ id: 'u1', stripeCustomerId: 'cus_1', email: 'reader@test.invalid' });
      mockPlansService.findById.mockResolvedValue(PLAN);
      mockSubRepo.findOneBy.mockResolvedValue(null);
      mockStripe.checkout.sessions.list.mockResolvedValue(none);
      mockStripe.subscriptions.list.mockResolvedValue(none);
      mockStripe.customers.list.mockResolvedValue(none);
      mockStripe.checkout.sessions.create.mockResolvedValue({ id: 'cs', url: 'https://checkout.stripe.com/x' });
    });
    const history = (subs: any[]) => mockStripe.subscriptions.list.mockResolvedValue({ data: subs, has_more: false });

    it.each([
      ['first-time customer, no history', () => undefined, true],
      ['previously received a trial (canceled, trial_start set)', () => history([{ id: 's', status: 'canceled', trial_start: 1 }]), false],
      ['PENDING-PO: previously subscribed and paid WITHOUT a trial (canceled, no trial_start)', () => history([{ id: 's', status: 'canceled', trial_start: null }]), false],
      ['previous subscription never activated (incomplete_expired)', () => history([{ id: 's', status: 'incomplete_expired', trial_start: null }]), true],
      ['PENDING-PO: never activated but canceled before expiry (canceled, no trial_start, never paid — not distinguishable from a paid one)', () => history([{ id: 's', status: 'canceled', trial_start: null }]), false],
      ['returning customer with a canceled Noetia subscription row', () => mockSubRepo.findOneBy.mockResolvedValue({ userId: 'u1', status: 'canceled', stripeSubscriptionId: 'sub_old', stripeCustomerId: 'cus_1' }), false],
      ['Duo/Family member subscribing independently (no own row, no own Stripe subscriptions)', () => undefined, true],
    ])('%s → trial offered: %s', async (_label, arrange, expectedTrial) => {
      (arrange as () => void)();
      await service.createCheckoutSession('u1', 'plan1');
      expect(trialOf()).toEqual(expectedTrial ? { trial_period_days: 14 } : null);
    });

    it.each([
      ['history truncated', () => mockStripe.subscriptions.list.mockResolvedValue({ data: [], has_more: true })],
      ['customer list truncated', () => mockStripe.customers.list.mockResolvedValue({ data: [], has_more: true })],
      ['Stripe unavailable', () => mockStripe.subscriptions.list.mockRejectedValue(new Error('down'))],
    ])('history %s → checkout 503 (no session) and eligibility null (no trial advertised)', async (_label, arrange) => {
      (arrange as () => void)();
      jest.spyOn((service as any).logger, 'warn').mockImplementation(() => undefined);
      await expect(service.createCheckoutSession('u1', 'plan1')).rejects.toThrow(ServiceUnavailableException);
      await expect(service.getTrialEligibility('u1')).resolves.toBeNull();
      expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled();
    });
  });

  describe('cancelSubscription', () => {
    it('sets cancel_at_period_end and updates status to canceling', async () => {
      mockSubRepo.findOneBy.mockResolvedValue({
        id: 'sub1',
        userId: 'u1',
        stripeSubscriptionId: 'sub_stripe_1',
      });
      mockStripe.subscriptions.update.mockResolvedValue({
        cancel_at: Math.floor(Date.now() / 1000) + 86400,
      });
      mockSubRepo.update.mockResolvedValue(undefined);

      const result = await service.cancelSubscription('u1');
      expect(mockStripe.subscriptions.update).toHaveBeenCalledWith('sub_stripe_1', {
        cancel_at_period_end: true,
      });
      expect(mockSubRepo.update).toHaveBeenCalledWith('sub1', { status: 'canceling' });
      expect(result).toHaveProperty('cancelAt');
    });

    it('throws NotFoundException when user has no subscription', async () => {
      mockSubRepo.findOneBy.mockResolvedValue(null);
      await expect(service.cancelSubscription('u1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('resumeSubscription', () => {
    it('sets cancel_at_period_end to false and reverts status to active', async () => {
      mockSubRepo.findOneBy.mockResolvedValue({
        id: 'sub1',
        userId: 'u1',
        stripeSubscriptionId: 'sub_stripe_1',
      });
      mockStripe.subscriptions.update.mockResolvedValue({});
      mockSubRepo.update.mockResolvedValue(undefined);
      mockSubRepo.findOne.mockResolvedValue({ status: 'active', planId: null, currentPeriodEnd: null, trialEnd: null });

      await service.resumeSubscription('u1');
      expect(mockStripe.subscriptions.update).toHaveBeenCalledWith('sub_stripe_1', {
        cancel_at_period_end: false,
      });
      expect(mockSubRepo.update).toHaveBeenCalledWith('sub1', { status: 'active' });
    });

    it('throws NotFoundException when user has no subscription', async () => {
      mockSubRepo.findOneBy.mockResolvedValue(null);
      await expect(service.resumeSubscription('u1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createPortalSession', () => {
    it('returns portal url for user with stripeCustomerId', async () => {
      mockUsersService.findById.mockResolvedValue({ id: 'u1', stripeCustomerId: 'cus_1' });
      mockStripe.billingPortal.sessions.create.mockResolvedValue({ url: 'https://billing.stripe.com/xxx' });
      const result = await service.createPortalSession('u1');
      expect(result).toEqual({ url: 'https://billing.stripe.com/xxx' });
    });

    it('throws NotFoundException when user has no stripeCustomerId', async () => {
      mockUsersService.findById.mockResolvedValue({ id: 'u1', stripeCustomerId: null });
      await expect(service.createPortalSession('u1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getSubscriptionStatus', () => {
    it('returns none when no subscription record', async () => {
      mockSubRepo.findOne.mockResolvedValue(null);
      const result = await service.getSubscriptionStatus('u1');
      expect(result).toEqual({ status: 'none' });
    });

    it('returns subscription data when record exists', async () => {
      mockSubRepo.findOne.mockResolvedValue({ status: 'active', planId: 'p1', currentPeriodEnd: new Date(), trialEnd: null });
      const result = await service.getSubscriptionStatus('u1');
      expect(result.status).toBe('active');
    });
  });

  describe('upsertFromWebhook — identity guard', () => {
    const at = new Date('2026-12-01T00:00:00Z');
    beforeEach(() => { mockUserRepo.findOneBy.mockResolvedValue({ id: 'u1' }); });

    it('skips a duplicate event (same stripeEventId on the row)', async () => {
      mockSubRepo.findOneBy.mockResolvedValue({ id: 'sub1', stripeSubscriptionId: 'sub_1', stripeEventId: 'evt_dup', status: 'active' });
      expect(await service.upsertFromWebhook('evt_dup', 'cus_1', 'sub_1', 'active', at, null)).toBe(false);
      expect(mockSubRepo.upsert).not.toHaveBeenCalled();
    });

    it('skips when no user is found for the customer', async () => {
      mockUserRepo.findOneBy.mockResolvedValue(null);
      expect(await service.upsertFromWebhook('evt_1', 'cus_ghost', 'sub_1', 'active', at, null)).toBe(false);
      expect(mockSubRepo.upsert).not.toHaveBeenCalled();
    });

    it('creates the row for a first subscription (planId only when passed)', async () => {
      mockSubRepo.findOneBy.mockResolvedValue(null);
      expect(await service.upsertFromWebhook('evt_new', 'cus_1', 'sub_1', 'trialing', at, null, 'plan_1')).toBe(true);
      expect(mockSubRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'u1', stripeSubscriptionId: 'sub_1', stripeEventId: 'evt_new', status: 'trialing', planId: 'plan_1' }),
        { conflictPaths: ['userId'] },
      );
    });

    it('does not write planId when the caller does not pass it', async () => {
      mockSubRepo.findOneBy.mockResolvedValue(null);
      await service.upsertFromWebhook('evt_new', 'cus_1', 'sub_1', 'trialing', at, null);
      expect(mockSubRepo.upsert.mock.calls[0][0]).not.toHaveProperty('planId');
    });

    it('updates the same Stripe subscription', async () => {
      mockSubRepo.findOneBy.mockResolvedValue({ stripeSubscriptionId: 'sub_1', status: 'trialing', stripeEventId: 'evt_a' });
      expect(await service.upsertFromWebhook('evt_b', 'cus_1', 'sub_1', 'active', at, null)).toBe(true);
    });

    it('never replaces a LIVE subscription with a different live one (duplicate) — logged as an error', async () => {
      const err = jest.spyOn((service as any).logger, 'error').mockImplementation(() => undefined);
      mockSubRepo.findOneBy.mockResolvedValue({ stripeSubscriptionId: 'sub_1', status: 'active', stripeEventId: 'evt_a' });
      expect(await service.upsertFromWebhook('evt_b', 'cus_1', 'sub_2', 'trialing', at, null)).toBe(false);
      expect(mockSubRepo.upsert).not.toHaveBeenCalled();
      expect(err.mock.calls[0][0]).toContain('DUPLICATE_LIVE_SUBSCRIPTION');
      expect(err.mock.calls[0][0]).toContain('current=sub_1(active)');
      expect(err.mock.calls[0][0]).toContain('incoming=sub_2(trialing)');
    });

    it('a late event from an OLD subscription cannot overwrite the current one', async () => {
      const warn = jest.spyOn((service as any).logger, 'warn').mockImplementation(() => undefined);
      mockSubRepo.findOneBy.mockResolvedValue({ stripeSubscriptionId: 'sub_new', status: 'trialing', stripeEventId: 'evt_a' });
      expect(await service.upsertFromWebhook('evt_late', 'cus_1', 'sub_old', 'canceled', at, null)).toBe(false);
      expect(mockSubRepo.upsert).not.toHaveBeenCalled();
      expect(warn.mock.calls[0][0]).toContain('IGNORED_OTHER_SUBSCRIPTION_EVENT');
    });

    it('a non-live event for another subscription cannot replace an ended one either', async () => {
      jest.spyOn((service as any).logger, 'warn').mockImplementation(() => undefined);
      mockSubRepo.findOneBy.mockResolvedValue({ stripeSubscriptionId: 'sub_old', status: 'canceled', stripeEventId: 'evt_a' });
      expect(await service.upsertFromWebhook('evt_b', 'cus_1', 'sub_x', 'none', at, null)).toBe(false);
    });

    it('a legitimate re-subscription (old one ended, new one live) replaces the row', async () => {
      mockSubRepo.findOneBy.mockResolvedValue({ stripeSubscriptionId: 'sub_old', status: 'canceled', stripeEventId: 'evt_a' });
      expect(await service.upsertFromWebhook('evt_b', 'cus_1', 'sub_new', 'trialing', at, null)).toBe(true);
      expect(mockSubRepo.upsert).toHaveBeenCalledWith(expect.objectContaining({ stripeSubscriptionId: 'sub_new' }), expect.anything());
    });
  });

  describe('upsertFromWebhook — atomic identity (per-user lock)', () => {
    const at = new Date('2026-12-01T00:00:00Z');

    it('takes the per-user lock BEFORE reading the row, inside a transaction', async () => {
      const order: string[] = [];
      mockUserRepo.findOneBy.mockResolvedValue({ id: 'u1' });
      mockSubRepo.manager.transaction.mockImplementationOnce(async (fn: any) => fn({
        getRepository: repoFor,
        query: async (_sql: string, params: unknown[]) => { order.push(`lock ${params[0]}`); },
      }));
      mockSubRepo.findOneBy.mockImplementationOnce(async () => { order.push('read'); return null; });
      await service.upsertFromWebhook('evt_1', 'cus_1', 'sub_1', 'trialing', at, null);
      expect(order).toEqual(['lock subscription-identity:u1', 'read']);
    });

    it('uses the caller transaction when given (no nested transaction)', async () => {
      mockUserRepo.findOneBy.mockResolvedValue({ id: 'u1' });
      mockSubRepo.findOneBy.mockResolvedValue(null);
      await service.upsertFromWebhook('evt_1', 'cus_1', 'sub_1', 'trialing', at, null, undefined, txEm as any);
      expect(mockSubRepo.manager.transaction).not.toHaveBeenCalled();
      expect(txEm.query).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock(hashtext($1))', ['subscription-identity:u1']);
    });

    it('two CONCURRENT webhooks for different live subscriptions: exactly one is applied, the other is rejected', async () => {
      // Stateful row + a read that yields, so without the lock both would read "no row" before either writes.
      let row: any = null;
      mockUserRepo.findOneBy.mockResolvedValue({ id: 'u1' });
      mockSubRepo.findOneBy.mockImplementation(async () => { await new Promise((r) => setTimeout(r, 5)); return row ? { ...row } : null; });
      mockSubRepo.upsert.mockImplementation(async (v: any) => { row = { ...(row ?? {}), ...v }; });
      const logError = jest.spyOn((service as any).logger, 'error').mockImplementation(() => undefined);
      const results = await Promise.all([
        service.upsertFromWebhook('evt_a', 'cus_1', 'sub_A', 'trialing', at, null),
        service.upsertFromWebhook('evt_b', 'cus_1', 'sub_B', 'trialing', at, null),
      ]);
      expect(results.filter(Boolean)).toHaveLength(1);
      expect(mockSubRepo.upsert).toHaveBeenCalledTimes(1);
      expect(row.stripeSubscriptionId).toBe(results[0] ? 'sub_A' : 'sub_B');
      expect(logError).toHaveBeenCalledWith(expect.stringContaining('DUPLICATE_LIVE_SUBSCRIPTION'));
    });
  });

  describe('applyStripeSubscription (order-independent: re-reads Stripe)', () => {
    const now = Math.floor(Date.now() / 1000);
    beforeEach(() => {
      mockUserRepo.findOneBy.mockResolvedValue({ id: 'u1' });
      mockSubRepo.findOneBy.mockResolvedValue(null);
    });

    it('writes the CURRENT Stripe status/period/trial (trialing stays trialing) and the plan from the price (T-1: every event)', async () => {
      mockPlansService.findAll.mockResolvedValue([{ id: 'plan1', stripePriceId: 'price_123' }]);
      mockStripe.subscriptions.retrieve.mockResolvedValue({
        id: 'sub_1', customer: 'cus_1', status: 'trialing', cancel_at_period_end: false,
        current_period_end: now + 86400, trial_end: now + 86400, items: { data: [{ price: { id: 'price_123' } }] },
      });
      await service.applyStripeSubscription('evt_1', 'sub_1');
      const row = mockSubRepo.upsert.mock.calls[0][0];
      expect(row).toMatchObject({ stripeSubscriptionId: 'sub_1', status: 'trialing', stripeCustomerId: 'cus_1' });
      expect(row.currentPeriodEnd).toEqual(new Date((now + 86400) * 1000));
      expect(row.planId).toBe('plan1');
    });

    it('an unknown price records no plan (null), as customer.subscription.updated always did', async () => {
      mockPlansService.findAll.mockResolvedValue([]);
      mockStripe.subscriptions.retrieve.mockResolvedValue({ id: 'sub_1', customer: 'cus_1', status: 'active', items: { data: [{ price: { id: 'price_x' } }] } });
      await service.applyStripeSubscription('evt_1', 'sub_1');
      expect(mockSubRepo.upsert.mock.calls[0][0].planId).toBeNull();
    });

    it('maps cancel_at_period_end, the item-level period end and the plan', async () => {
      mockPlansService.findAll.mockResolvedValue([{ id: 'plan1', stripePriceId: 'price_123' }]);
      mockStripe.subscriptions.retrieve.mockResolvedValue({
        id: 'sub_1', customer: { id: 'cus_1' }, status: 'active', cancel_at_period_end: true,
        items: { data: [{ price: { id: 'price_123' }, current_period_end: now + 10 }] }, trial_end: null,
      });
      await service.applyStripeSubscription('evt_1', 'sub_1');
      expect(mockSubRepo.upsert.mock.calls[0][0]).toMatchObject({ status: 'canceling', planId: 'plan1', currentPeriodEnd: new Date((now + 10) * 1000) });
    });

    it('propagates a Stripe failure (so the webhook is retried)', async () => {
      mockStripe.subscriptions.retrieve.mockRejectedValue(new Error('down'));
      await expect(service.applyStripeSubscription('evt_1', 'sub_1')).rejects.toThrow('down');
      expect(mockSubRepo.upsert).not.toHaveBeenCalled();
    });

    it('ignores a subscription without a customer', async () => {
      mockStripe.subscriptions.retrieve.mockResolvedValue({ id: 'sub_1', status: 'active' });
      expect(await service.applyStripeSubscription('evt_1', 'sub_1')).toBe(false);
    });

    describe('T-1 trial-start grant', () => {
      const trialing = { id: 'sub_1', customer: 'cus_1', status: 'trialing', cancel_at_period_end: false, current_period_end: now + 14 * 86400, trial_end: now + 14 * 86400, items: { data: [{ price: { id: 'price_123' } }] } };
      beforeEach(() => {
        mockPlansService.findAll.mockResolvedValue([{ id: 'plan1', stripePriceId: 'price_123' }]);
        mockSubRepo.findOne.mockResolvedValue({ id: 'row1', userId: 'u1', plan: { tokensPerCycle: 2, interval: 'month' } });
        mockTokenRepo.create.mockImplementation((d: any) => d);
        mockTokenRepo.save.mockResolvedValue([]);
      });

      it('a trialing subscription applied in the webhook transaction grants tokensPerCycle once', async () => {
        mockStripe.subscriptions.retrieve.mockResolvedValue(trialing);
        await service.applyStripeSubscription('evt_1', 'sub_1', txEm as any);
        await service.applyStripeSubscription('evt_2', 'sub_1', txEm as any);
        expect(mockTokenRepo.save).toHaveBeenCalledTimes(1);
        expect(mockTokenRepo.save.mock.calls[0][0]).toHaveLength(2);
        expect(mockTokenRepo.save.mock.calls[0][0][0]).toMatchObject({ userId: 'u1', subscriptionId: 'row1', type: 'paid', reason: 'Trial start (initial cycle)' });
        expect(claimed.has('fulfillment:trial-start-tokens:sub_1')).toBe(true);
      });

      it('not trialing (active) → no trial grant', async () => {
        mockStripe.subscriptions.retrieve.mockResolvedValue({ ...trialing, status: 'active', trial_end: null });
        await service.applyStripeSubscription('evt_1', 'sub_1', txEm as any);
        expect(mockTokenRepo.save).not.toHaveBeenCalled();
      });

      it('an identity-rejected (duplicate) subscription gets no trial grant', async () => {
        mockSubRepo.findOneBy.mockResolvedValue({ id: 'row1', stripeSubscriptionId: 'sub_other', status: 'active' });
        jest.spyOn((service as any).logger, 'error').mockImplementation(() => undefined);
        mockStripe.subscriptions.retrieve.mockResolvedValue(trialing);
        expect(await service.applyStripeSubscription('evt_1', 'sub_1', txEm as any)).toBe(false);
        expect(mockTokenRepo.save).not.toHaveBeenCalled();
      });

      it('outside a webhook transaction (no em) never grants', async () => {
        mockStripe.subscriptions.retrieve.mockResolvedValue(trialing);
        await service.applyStripeSubscription('evt_1', 'sub_1');
        expect(mockTokenRepo.save).not.toHaveBeenCalled();
      });

      it('issueTrialStartTokens: no plan on the row → nothing issued and the key stays unclaimed', async () => {
        mockSubRepo.findOne.mockResolvedValue({ id: 'row1', userId: 'u1', plan: null });
        expect(await service.issueTrialStartTokens('sub_1', txEm as any)).toBe(false);
        expect(claimed.size).toBe(0);
      });

      it('issueTrialStartTokens does not touch nextTokenIssuanceAt (annual schedule starts at the first paid invoice)', async () => {
        mockSubRepo.findOne.mockResolvedValue({ id: 'row1', userId: 'u1', plan: { tokensPerCycle: 1, interval: 'year' } });
        expect(await service.issueTrialStartTokens('sub_1', txEm as any)).toBe(true);
        expect(mockSubRepo.update).not.toHaveBeenCalled();
      });
    });
  });

  describe('cancelFromWebhook', () => {
    it('cancels the row of THAT Stripe subscription under the per-user identity lock (own transaction)', async () => {
      mockSubRepo.find.mockResolvedValue([{ id: 'row1', userId: 'u1', stripeSubscriptionId: 'sub_1' }]);
      mockSubRepo.update.mockResolvedValue(undefined);
      await service.cancelFromWebhook('sub_1');
      expect(mockSubRepo.manager.transaction).toHaveBeenCalledTimes(1);
      expect(lockQueries).toContainEqual(['SELECT pg_advisory_xact_lock(hashtext($1))', ['subscription-identity:u1']]);
      expect(mockSubRepo.update).toHaveBeenCalledWith({ id: 'row1', stripeSubscriptionId: 'sub_1' }, { status: 'canceled' });
    });

    it('uses the caller transaction when given and does nothing for an unknown subscription', async () => {
      mockSubRepo.find.mockResolvedValue([]);
      await service.cancelFromWebhook('sub_unknown', txEm as any);
      expect(mockSubRepo.manager.transaction).not.toHaveBeenCalled();
      expect(mockSubRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('createPurchaseSession', () => {
    it('returns checkout url for a book with a price', async () => {
      mockBookRepo.findOneBy.mockResolvedValue({ id: 'bk1', title: 'Test Book', priceCents: 1500, isPublished: true });
      mockUsersService.findById.mockResolvedValue({ id: 'u1', stripeCustomerId: 'cus_1' });
      mockStripe.checkout.sessions.create.mockResolvedValue({ url: 'https://checkout.stripe.com/pay' });

      const result = await service.createPurchaseSession('u1', 'bk1');
      expect(result).toEqual({ url: 'https://checkout.stripe.com/pay' });
      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({ mode: 'payment', metadata: { bookId: 'bk1', userId: 'u1' } }),
      );
      // The success page must not wait for a subscription after a one-time purchase.
      expect(mockStripe.checkout.sessions.create.mock.calls[0][0].success_url).toContain('/billing/success?purchase=book&session_id=');
    });

    it('throws NotFoundException for unknown or unpublished book', async () => {
      mockBookRepo.findOneBy.mockResolvedValue(null);
      await expect(service.createPurchaseSession('u1', 'ghost')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when book has no price', async () => {
      mockBookRepo.findOneBy.mockResolvedValue({ id: 'bk1', priceCents: null, isPublished: true });
      await expect(service.createPurchaseSession('u1', 'bk1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('redeemToken — atomic (one token, one book; payment-safety correction)', () => {
    // SQL-aware transaction stand-in: per-owner token queues, ownership rows, and a log of the statements.
    function redeemTx(opts: { pools: Record<string, string[]>; owned?: boolean; insertConflict?: boolean; ownerSub?: any }) {
      const pools = Object.fromEntries(Object.entries(opts.pools).map(([k, v]) => [k, [...v]]));
      const log: string[] = [];
      const ownedRows: string[] = [];
      const em = {
        getRepository: (entity: unknown) => {
          if (entity === UserBook) return { existsBy: async () => !!opts.owned };
          if (entity === TokenLedger) return { update: async () => { log.push('expire'); } };
          if (entity === Subscription) return { createQueryBuilder: () => ({ where() { return this; }, andWhere() { return this; }, getOne: async () => opts.ownerSub ?? null }) };
          return {};
        },
        query: async (sql: string, params: any[]) => {
          if (sql.startsWith('UPDATE token_ledger')) {
            const owner = params[0];
            const id = pools[owner]?.shift();
            log.push(`consume ${owner} ${sql.includes('SKIP LOCKED') ? 'skip-locked' : 'wait'} → ${id ?? 'none'}`);
            return id ? [[{ id }], 1] : [[], 0];
          }
          if (sql.startsWith('SELECT count(*)')) return [{ n: pools[params[0]]?.length ?? 0 }];
          if (sql.startsWith('INSERT INTO user_books')) {
            log.push(`insert ${params[0]} ${params[1]} ${opts.insertConflict ? 'conflict' : 'ok'}`);
            if (opts.insertConflict) return [];
            ownedRows.push(`${params[0]}:${params[1]}`);
            return [{ id: 'ub1' }];
          }
          return [];
        },
      };
      mockSubRepo.manager.transaction.mockImplementationOnce(async (fn: any) => fn(em));
      return { log, ownedRows, pools };
    }
    beforeEach(() => mockBookRepo.findOneBy.mockResolvedValue({ id: 'b1', isPublished: true }));

    it('consumes the oldest active token with a row lock and creates ownership in the SAME transaction', async () => {
      const tx = redeemTx({ pools: { u1: ['tok1', 'tok2'] } });
      await service.redeemToken('u1', 'b1');
      expect(tx.log).toEqual(['expire', 'consume u1 skip-locked → tok1', 'insert u1 b1 ok']);
      expect(tx.ownedRows).toEqual(['u1:b1']);
      expect(mockSubRepo.manager.transaction).toHaveBeenCalledTimes(1);
    });

    it('throws NotFoundException for an unknown book (no transaction)', async () => {
      mockBookRepo.findOneBy.mockResolvedValue(null);
      await expect(service.redeemToken('u1', 'ghost')).rejects.toThrow(NotFoundException);
      expect(mockSubRepo.manager.transaction).not.toHaveBeenCalled();
    });

    it('already owned (fast path) → BadRequest already_owned, no token consumed', async () => {
      const tx = redeemTx({ pools: { u1: ['tok1'] }, owned: true });
      await expect(service.redeemToken('u1', 'b1')).rejects.toMatchObject({ response: { error: 'already_owned' } });
      expect(tx.pools.u1).toEqual(['tok1']);
    });

    it('ownership insert conflicts (a concurrent redemption of the same book won) → throws, so the token consumption rolls back', async () => {
      const tx = redeemTx({ pools: { u1: ['tok1'] }, insertConflict: true });
      await expect(service.redeemToken('u1', 'b1')).rejects.toMatchObject({ response: { error: 'already_owned' } });
      expect(tx.log).toContain('insert u1 b1 conflict'); // thrown inside the transaction → PostgreSQL rolls back the UPDATE
    });

    it('no tokens anywhere → ForbiddenException no_tokens_remaining', async () => {
      redeemTx({ pools: { u1: [] } });
      await expect(service.redeemToken('u1', 'b1')).rejects.toThrow(ForbiddenException);
    });

    it('linked Duo/Family member without own tokens draws from the plan owner pool (unchanged order)', async () => {
      const tx = redeemTx({ pools: { member: [], owner1: ['owner-tok'] }, ownerSub: { id: 'owner-sub', userId: 'owner1', status: 'active' } });
      await service.redeemToken('member', 'b1');
      expect(tx.log).toEqual([
        'expire', 'consume member skip-locked → none', 'consume member wait → none',
        'expire', 'consume owner1 skip-locked → owner-tok', 'insert member b1 ok',
      ]);
      expect(tx.ownedRows).toEqual(['member:b1']); // the book belongs to the member who redeemed it
    });
  });

  describe('createTokenPackageSession', () => {
    it('returns checkout url for valid token package', async () => {
      mockPlansService.findTokenPackageById.mockResolvedValue({
        id: 'pkg1',
        stripePriceId: 'price_live_abc123XYZ',
        tokenCount: 1,
        active: true,
      });
      mockUsersService.findById.mockResolvedValue({ id: 'u1', stripeCustomerId: 'cus_1' });
      mockStripe.checkout.sessions.create.mockResolvedValue({ url: 'https://checkout.stripe.com/tok' });

      const result = await service.createTokenPackageSession('u1', 'pkg1');
      expect(result).toEqual({ url: 'https://checkout.stripe.com/tok' });
      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'payment',
          metadata: { tokenPackageId: 'pkg1', userId: 'u1' },
          success_url: expect.stringContaining('/billing/success?purchase=tokens&session_id='),
        }),
      );
    });

    it('throws BadRequestException for unknown package id', async () => {
      mockPlansService.findTokenPackageById.mockResolvedValue(null);
      await expect(service.createTokenPackageSession('u1', 'ghost')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when price ID is still a placeholder', async () => {
      mockPlansService.findTokenPackageById.mockResolvedValue({
        id: 'pkg1',
        stripePriceId: 'price_token_1_placeholder',
        tokenCount: 1,
        active: true,
      });
      await expect(service.createTokenPackageSession('u1', 'pkg1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('issueTokensForPurchasedPackage', () => {
    it('issues the correct number of tokens for the package', async () => {
      mockPlansService.findTokenPackageById.mockResolvedValue({ id: 'pkg1', tokenCount: 3, name: '3 Tokens', active: true });
      mockTokenRepo.create.mockImplementation((d: any) => d);
      mockTokenRepo.save.mockResolvedValue([]);

      await service.issueTokensForPurchasedPackage('pkg1', 'u1');
      expect(mockTokenRepo.create).toHaveBeenCalledTimes(3);
    });

    it('does nothing when package not found', async () => {
      mockPlansService.findTokenPackageById.mockResolvedValue(null);
      await service.issueTokensForPurchasedPackage('ghost', 'u1');
      expect(mockTokenRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('addPurchasedBook', () => {
    it('inserts user_book with purchaseType purchase, ON CONFLICT DO NOTHING (never aborts the webhook transaction)', async () => {
      mockOrIgnoreExecute.mockResolvedValue(undefined);
      await service.addPurchasedBook('u1', 'bk1');
      expect(mockOrIgnoreExecute).toHaveBeenCalledWith({ userId: 'u1', bookId: 'bk1', purchaseType: 'purchase' });
      expect(mockUserBookRepo.insert).not.toHaveBeenCalled();
    });

    it('uses the caller transaction repository when given', async () => {
      mockOrIgnoreExecute.mockResolvedValue(undefined);
      await expect(service.addPurchasedBook('u1', 'bk1', txEm as any)).resolves.toBeUndefined();
      expect(mockUserBookRepo.createQueryBuilder).toHaveBeenCalled();
    });

    it('rethrows unexpected errors', async () => {
      mockOrIgnoreExecute.mockRejectedValue(new Error('DB down'));
      await expect(service.addPurchasedBook('u1', 'bk1')).rejects.toThrow('DB down');
    });
  });

  describe('issueTokensForNewSubscription', () => {
    it('issues tokens equal to plan tokensPerCycle on renewal', async () => {
      mockSubRepo.findOne.mockResolvedValue({
        id: 'sub1',
        userId: 'u1',
        stripeSubscriptionId: 'sub_stripe_1',
        plan: { tokensPerCycle: 2, interval: 'month' },
      });
      mockTokenRepo.create.mockImplementation((d: any) => d);
      mockTokenRepo.save.mockResolvedValue([]);

      await service.issueTokensForNewSubscription('sub_stripe_1');
      expect(mockTokenRepo.create).toHaveBeenCalledTimes(2);
    });

    it('does nothing when no subscription found', async () => {
      mockSubRepo.findOne.mockResolvedValue(null);
      await service.issueTokensForNewSubscription('sub_unknown');
      expect(mockTokenRepo.save).not.toHaveBeenCalled();
    });

    it('annual plans: the paid invoice is cycle 0 and resets the scheduler hint so the new period is read from Stripe', async () => {
      mockSubRepo.findOne.mockResolvedValue({
        id: 'sub1',
        userId: 'u1',
        stripeSubscriptionId: 'sub_stripe_1',
        plan: { tokensPerCycle: 1, interval: 'year' },
      });
      mockSubRepo.update.mockResolvedValue(undefined);
      mockTokenRepo.create.mockImplementation((d: any) => d);
      mockTokenRepo.save.mockResolvedValue([]);

      await service.issueTokensForNewSubscription('sub_stripe_1');
      expect(mockSubRepo.update).toHaveBeenCalledWith('sub1', { nextTokenIssuanceAt: null });
    });

    it('in the webhook transaction, claims the invoice once: a second call for the same invoice issues nothing', async () => {
      mockSubRepo.findOne.mockResolvedValue({ id: 'sub1', userId: 'u1', plan: { tokensPerCycle: 2, interval: 'month' } });
      mockTokenRepo.create.mockImplementation((d: any) => d);
      mockTokenRepo.save.mockResolvedValue([]);
      // No period in the call → read from Stripe's line items (F-02): in_1 and in_2 bill different periods.
      mockStripe.invoices.listLineItems.mockImplementation(async (id: string) => subscriptionLineItems(id === 'in_1' ? 1800000000 : 1802592000));
      await service.issueTokensForNewSubscription('sub_stripe_1', txEm as any, 'in_1');
      await service.issueTokensForNewSubscription('sub_stripe_1', txEm as any, 'in_1');
      expect(mockTokenRepo.save).toHaveBeenCalledTimes(1);
      expect(claimed.has('fulfillment:invoice-tokens:in_1')).toBe(true);
      await service.issueTokensForNewSubscription('sub_stripe_1', txEm as any, 'in_2'); // next renewal
      expect(mockTokenRepo.save).toHaveBeenCalledTimes(2);
    });

    it('does not claim the invoice when no tokens are issued (no plan yet — trial-token gate unchanged)', async () => {
      mockSubRepo.findOne.mockResolvedValue({ id: 'sub1', userId: 'u1', plan: null });
      await service.issueTokensForNewSubscription('sub_stripe_1', txEm as any, 'in_trial');
      expect(claimed.size).toBe(0);
      expect(mockTokenRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('issueMonthlyTokensForAnnualPlans — candidate selection (D2/D3)', () => {
    it('checks active AND canceling annual rows with Stripe; skips monthly plans, rows without a Stripe id and rows whose hint is in the future', async () => {
      const now = new Date('2027-06-01T12:00:00Z');
      mockSubRepo.find.mockResolvedValue([
        { id: 'a', stripeSubscriptionId: 'sub_a', status: 'active', plan: { interval: 'year' }, nextTokenIssuanceAt: null },
        { id: 'c', stripeSubscriptionId: 'sub_c', status: 'canceling', plan: { interval: 'year' }, nextTokenIssuanceAt: new Date('2027-05-01T00:00:00Z') },
        { id: 'm', stripeSubscriptionId: 'sub_m', status: 'active', plan: { interval: 'month' }, nextTokenIssuanceAt: null },
        { id: 'n', stripeSubscriptionId: null, status: 'active', plan: { interval: 'year' }, nextTokenIssuanceAt: null },
        { id: 'f', stripeSubscriptionId: 'sub_f', status: 'active', plan: { interval: 'year' }, nextTokenIssuanceAt: new Date('2027-07-01T00:00:00Z') },
      ]);
      const due = jest.spyOn(service, 'issueDueAnnualCycles').mockResolvedValue(0);
      await service.issueMonthlyTokensForAnnualPlans(now);
      expect(mockSubRepo.find.mock.calls[0][0].where.status.value).toEqual(['active', 'canceling']);
      expect(due.mock.calls.map((c) => c[0])).toEqual(['sub_a', 'sub_c']);
    });

    it('a failure for one subscription is logged and does not stop the others', async () => {
      mockSubRepo.find.mockResolvedValue([
        { id: 'a', stripeSubscriptionId: 'sub_a', status: 'active', plan: { interval: 'year' }, nextTokenIssuanceAt: null },
        { id: 'b', stripeSubscriptionId: 'sub_b', status: 'active', plan: { interval: 'year' }, nextTokenIssuanceAt: null },
      ]);
      const logError = jest.spyOn((service as any).logger, 'error').mockImplementation(() => undefined);
      const due = jest.spyOn(service, 'issueDueAnnualCycles').mockRejectedValueOnce(new Error('stripe down')).mockResolvedValueOnce(1);
      await service.issueMonthlyTokensForAnnualPlans();
      expect(due).toHaveBeenCalledTimes(2);
      expect(logError).toHaveBeenCalledWith(expect.stringContaining('sub_a: stripe down'));
    });

    it('does nothing when there are no candidates', async () => {
      mockSubRepo.find.mockResolvedValue([]);
      const due = jest.spyOn(service, 'issueDueAnnualCycles');
      await service.issueMonthlyTokensForAnnualPlans();
      expect(due).not.toHaveBeenCalled();
    });
  });

  describe('issueAnnualPlanTokensCron', () => {
    it('runs the drip', async () => {
      const spy = jest.spyOn(service, 'issueMonthlyTokensForAnnualPlans').mockResolvedValue(undefined);
      await service.issueAnnualPlanTokensCron();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('swallows errors so the scheduler never crashes', async () => {
      jest.spyOn(service, 'issueMonthlyTokensForAnnualPlans').mockRejectedValue(new Error('boom'));
      await expect(service.issueAnnualPlanTokensCron()).resolves.toBeUndefined();
    });
  });

  describe('findPlanByStripePriceId', () => {
    it('returns plan id when price matches', async () => {
      mockPlansService.findAll.mockResolvedValue([{ id: 'plan_1', stripePriceId: 'price_123' }]);
      const result = await service.findPlanByStripePriceId('price_123');
      expect(result).toBe('plan_1');
    });

    it('returns null when price does not match any plan', async () => {
      mockPlansService.findAll.mockResolvedValue([{ id: 'plan_1', stripePriceId: 'price_other' }]);
      const result = await service.findPlanByStripePriceId('price_unknown');
      expect(result).toBeNull();
    });
  });

  describe('syncSubscription', () => {
    it('returns none status when no subscription record exists', async () => {
      mockSubRepo.findOneBy.mockResolvedValue(null);
      const result = await service.syncSubscription('u1');
      expect(result).toEqual({ status: 'none' });
    });

    it('updates local record from Stripe and returns updated status', async () => {
      mockSubRepo.findOneBy.mockResolvedValue({
        id: 'sub1',
        userId: 'u1',
        stripeSubscriptionId: 'sub_stripe_1',
      });
      mockStripe.subscriptions.retrieve.mockResolvedValue({
        status: 'active',
        cancel_at_period_end: false,
        current_period_end: Math.floor(Date.now() / 1000) + 86400,
        trial_end: null,
      });
      mockSubRepo.update.mockResolvedValue(undefined);
      mockSubRepo.findOne.mockResolvedValue({ status: 'active', planId: null, currentPeriodEnd: new Date(), trialEnd: null });

      await service.syncSubscription('u1');
      expect(mockStripe.subscriptions.retrieve).toHaveBeenCalledWith('sub_stripe_1');
      expect(mockSubRepo.update).toHaveBeenCalled();
    });

    it('maps trialing status correctly', async () => {
      mockSubRepo.findOneBy.mockResolvedValue({ id: 'sub1', userId: 'u1', stripeSubscriptionId: 'sub_1' });
      mockStripe.subscriptions.retrieve.mockResolvedValue({
        status: 'trialing',
        cancel_at_period_end: false,
        current_period_end: Math.floor(Date.now() / 1000) + 86400,
        trial_end: Math.floor(Date.now() / 1000) + 86400,
      });
      mockSubRepo.update.mockResolvedValue(undefined);
      mockSubRepo.findOne.mockResolvedValue({ status: 'trialing', planId: null, currentPeriodEnd: new Date(), trialEnd: new Date() });

      await service.syncSubscription('u1');
      expect(mockSubRepo.update).toHaveBeenCalledWith('sub1', expect.objectContaining({ status: 'trialing' }));
    });

    it('maps past_due status correctly', async () => {
      mockSubRepo.findOneBy.mockResolvedValue({ id: 'sub1', userId: 'u1', stripeSubscriptionId: 'sub_1' });
      mockStripe.subscriptions.retrieve.mockResolvedValue({
        status: 'past_due',
        cancel_at_period_end: false,
        current_period_end: Math.floor(Date.now() / 1000) + 86400,
        trial_end: null,
      });
      mockSubRepo.update.mockResolvedValue(undefined);
      mockSubRepo.findOne.mockResolvedValue({ status: 'past_due', planId: null, currentPeriodEnd: new Date(), trialEnd: null });

      await service.syncSubscription('u1');
      expect(mockSubRepo.update).toHaveBeenCalledWith('sub1', expect.objectContaining({ status: 'past_due' }));
    });

    it('maps canceled status correctly', async () => {
      mockSubRepo.findOneBy.mockResolvedValue({ id: 'sub1', userId: 'u1', stripeSubscriptionId: 'sub_1' });
      mockStripe.subscriptions.retrieve.mockResolvedValue({
        status: 'canceled',
        cancel_at_period_end: false,
        current_period_end: Math.floor(Date.now() / 1000) + 86400,
        trial_end: null,
      });
      mockSubRepo.update.mockResolvedValue(undefined);
      mockSubRepo.findOne.mockResolvedValue({ status: 'canceled', planId: null, currentPeriodEnd: new Date(), trialEnd: null });

      await service.syncSubscription('u1');
      expect(mockSubRepo.update).toHaveBeenCalledWith('sub1', expect.objectContaining({ status: 'canceled' }));
    });

    it('maps unknown status to none', async () => {
      mockSubRepo.findOneBy.mockResolvedValue({ id: 'sub1', userId: 'u1', stripeSubscriptionId: 'sub_1' });
      mockStripe.subscriptions.retrieve.mockResolvedValue({
        status: 'unpaid',
        cancel_at_period_end: false,
        current_period_end: Math.floor(Date.now() / 1000) + 86400,
        trial_end: null,
      });
      mockSubRepo.update.mockResolvedValue(undefined);
      mockSubRepo.findOne.mockResolvedValue({ status: 'none', planId: null, currentPeriodEnd: new Date(), trialEnd: null });

      await service.syncSubscription('u1');
      expect(mockSubRepo.update).toHaveBeenCalledWith('sub1', expect.objectContaining({ status: 'none' }));
    });

    it('maps canceling when cancel_at_period_end is true', async () => {
      mockSubRepo.findOneBy.mockResolvedValue({ id: 'sub1', userId: 'u1', stripeSubscriptionId: 'sub_1' });
      mockStripe.subscriptions.retrieve.mockResolvedValue({
        status: 'active',
        cancel_at_period_end: true,
        current_period_end: Math.floor(Date.now() / 1000) + 86400,
        trial_end: null,
      });
      mockSubRepo.update.mockResolvedValue(undefined);
      mockSubRepo.findOne.mockResolvedValue({ status: 'canceling', planId: null, currentPeriodEnd: new Date(), trialEnd: null });

      await service.syncSubscription('u1');
      expect(mockSubRepo.update).toHaveBeenCalledWith('sub1', expect.objectContaining({ status: 'canceling' }));
    });
  });

  // ── Token ledger ────────────────────────────────────────────────────────────

  describe('issueTokens', () => {
    it('creates paid tokens with 90-day expiry', async () => {
      mockTokenRepo.create.mockImplementation((d: any) => d);
      mockTokenRepo.save.mockResolvedValue([]);
      await service.issueTokens('u1', 2, 'paid');
      expect(mockTokenRepo.create).toHaveBeenCalledTimes(2);
      const entry = mockTokenRepo.create.mock.calls[0][0];
      expect(entry.type).toBe('paid');
      const days = Math.round((entry.expiresAt.getTime() - entry.issuedAt.getTime()) / 86_400_000);
      expect(days).toBe(90);
    });

    it('creates promotional tokens with 30-day expiry', async () => {
      mockTokenRepo.create.mockImplementation((d: any) => d);
      mockTokenRepo.save.mockResolvedValue([]);
      await service.issueTokens('u1', 1, 'promotional');
      const entry = mockTokenRepo.create.mock.calls[0][0];
      const days = Math.round((entry.expiresAt.getTime() - entry.issuedAt.getTime()) / 86_400_000);
      expect(days).toBe(30);
    });

    it('creates courtesy tokens with 30-day expiry and activatedAt set immediately', async () => {
      mockTokenRepo.create.mockImplementation((d: any) => d);
      mockTokenRepo.save.mockResolvedValue([]);
      await service.issueTokens('u1', 1, 'courtesy');
      const entry = mockTokenRepo.create.mock.calls[0][0];
      expect(entry.activatedAt).not.toBeNull();
      expect(entry.type).toBe('courtesy');
    });
  });

  describe('inviteUser', () => {
    it('creates invite and sends email for Duo plan with room', async () => {
      mockSubRepo.findOne.mockResolvedValue({
        id: 'sub1', userId: 'owner1', status: 'active',
        plan: { name: 'Duo', maxProfiles: 2 },
        linkedUserIds: [],
      });
      mockInviteRepo.findOne.mockResolvedValue(null);
      mockInviteRepo.create.mockImplementation((d: any) => d);
      mockInviteRepo.save.mockResolvedValue({ id: 'inv1', invitedEmail: 'guest@test.com', expiresAt: new Date() });
      mockUsersService.findById.mockResolvedValue({ name: 'Owner' });
      mockEmailService.sendPlanInvite.mockResolvedValue(undefined);

      const result = await service.inviteUser('owner1', 'guest@test.com');
      expect(mockEmailService.sendPlanInvite).toHaveBeenCalledWith('guest@test.com', 'Owner', 'Duo', expect.any(String));
      expect(result).toHaveProperty('email', 'guest@test.com');
    });

    it('throws BadRequestException when plan does not support sharing (Individual)', async () => {
      mockSubRepo.findOne.mockResolvedValue({
        id: 'sub1', userId: 'owner1', status: 'active',
        plan: { name: 'Individual', maxProfiles: 1 },
        linkedUserIds: [],
      });
      await expect(service.inviteUser('owner1', 'x@y.com')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when plan is full', async () => {
      mockSubRepo.findOne.mockResolvedValue({
        id: 'sub1', userId: 'owner1', status: 'active',
        plan: { name: 'Duo', maxProfiles: 2 },
        linkedUserIds: ['already-linked'],
      });
      await expect(service.inviteUser('owner1', 'x@y.com')).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException when user has no active subscription', async () => {
      mockSubRepo.findOne.mockResolvedValue(null);
      await expect(service.inviteUser('owner1', 'x@y.com')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('acceptInvite', () => {
    it('adds userId to linkedUserIds and marks invite accepted', async () => {
      mockInviteRepo.findOne.mockResolvedValue({
        id: 'inv1',
        token: 'tok123',
        status: 'pending',
        expiresAt: new Date(Date.now() + 86400000),
        subscription: {
          id: 'sub1', userId: 'owner1', status: 'active',
          plan: { maxProfiles: 2 },
          linkedUserIds: [],
        },
      });
      mockSubRepo.update.mockResolvedValue({});
      mockInviteRepo.update.mockResolvedValue({});

      await service.acceptInvite('tok123', 'guest1');
      expect(mockSubRepo.update).toHaveBeenCalledWith('sub1', { linkedUserIds: ['guest1'] });
      expect(mockInviteRepo.update).toHaveBeenCalledWith('inv1', { status: 'accepted' });
    });

    it('throws BadRequestException for expired or invalid token', async () => {
      mockInviteRepo.findOne.mockResolvedValue(null);
      await expect(service.acceptInvite('bad-token', 'u1')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when owner tries to accept their own invite', async () => {
      mockInviteRepo.findOne.mockResolvedValue({
        id: 'inv1', token: 't', status: 'pending',
        expiresAt: new Date(Date.now() + 86400000),
        subscription: { id: 'sub1', userId: 'owner1', status: 'active', plan: { maxProfiles: 2 }, linkedUserIds: [] },
      });
      await expect(service.acceptInvite('t', 'owner1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('removeLinkedUser', () => {
    it('removes the target user from linkedUserIds', async () => {
      mockSubRepo.findOneBy.mockResolvedValue({ id: 'sub1', userId: 'owner1', linkedUserIds: ['linked1', 'linked2'] });
      mockSubRepo.update.mockResolvedValue({});

      await service.removeLinkedUser('owner1', 'linked1');
      expect(mockSubRepo.update).toHaveBeenCalledWith('sub1', { linkedUserIds: ['linked2'] });
    });

    it('throws BadRequestException when target is not linked', async () => {
      mockSubRepo.findOneBy.mockResolvedValue({ id: 'sub1', userId: 'owner1', linkedUserIds: [] });
      await expect(service.removeLinkedUser('owner1', 'ghost')).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when owner has no subscription', async () => {
      mockSubRepo.findOneBy.mockResolvedValue(null);
      await expect(service.removeLinkedUser('owner1', 'u1')).rejects.toThrow(NotFoundException);
    });
  });
});
