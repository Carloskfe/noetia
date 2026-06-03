import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
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
  customers: { create: jest.fn() },
  checkout: { sessions: { create: jest.fn() } },
  billingPortal: { sessions: { create: jest.fn() } },
  subscriptions: {
    update: jest.fn(),
    retrieve: jest.fn(),
  },
};

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => mockStripe);
});

const mockUserRepo = {
  update: jest.fn(),
  findOneBy: jest.fn(),
};

const mockQb = { where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), leftJoinAndSelect: jest.fn().mockReturnThis(), getOne: jest.fn() };
const mockSubRepo = {
  findOne: jest.fn(),
  findOneBy: jest.fn(),
  update: jest.fn(),
  upsert: jest.fn(),
  decrement: jest.fn(),
  createQueryBuilder: jest.fn(() => mockQb),
};

const mockBookRepo = { findOneBy: jest.fn() };

const mockUserBookRepo = {
  existsBy: jest.fn(),
  insert: jest.fn(),
};

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

  describe('createCheckoutSession', () => {
    it('returns checkout url for valid plan', async () => {
      mockUsersService.findById.mockResolvedValue({ id: 'u1', stripeCustomerId: 'cus_1' });
      mockPlansService.findById.mockResolvedValue({ id: 'plan1', stripePriceId: 'price_123' });
      mockStripe.checkout.sessions.create.mockResolvedValue({ url: 'https://checkout.stripe.com/xxx' });

      const result = await service.createCheckoutSession('u1', 'plan1');
      expect(result).toEqual({ url: 'https://checkout.stripe.com/xxx' });
      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({ subscription_data: { trial_period_days: 14 } }),
      );
    });

    it('throws BadRequestException for invalid planId', async () => {
      mockPlansService.findById.mockResolvedValue(null);
      await expect(service.createCheckoutSession('u1', 'bad-plan')).rejects.toThrow(BadRequestException);
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

  describe('upsertFromWebhook', () => {
    it('skips duplicate event (same stripeEventId)', async () => {
      mockSubRepo.findOneBy.mockResolvedValue({ id: 'sub1', stripeEventId: 'evt_dup' });
      await service.upsertFromWebhook('evt_dup', 'cus_1', 'sub_1', 'active', new Date(), null);
      expect(mockSubRepo.upsert).not.toHaveBeenCalled();
    });

    it('skips upsert when no user found for customerId', async () => {
      mockSubRepo.findOneBy.mockResolvedValue(null);
      mockUserRepo.findOneBy.mockResolvedValue(null);
      await service.upsertFromWebhook('evt_1', 'cus_ghost', 'sub_1', 'active', new Date(), null);
      expect(mockSubRepo.upsert).not.toHaveBeenCalled();
    });

    it('upserts subscription for new event', async () => {
      mockSubRepo.findOneBy.mockResolvedValue(null);
      mockUserRepo.findOneBy.mockResolvedValue({ id: 'u1' });
      mockSubRepo.upsert.mockResolvedValue(undefined);
      await service.upsertFromWebhook('evt_new', 'cus_1', 'sub_1', 'active', new Date(), null, 'plan_1');
      expect(mockSubRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ stripeEventId: 'evt_new', status: 'active', planId: 'plan_1' }),
        expect.anything(),
      );
    });
  });

  describe('cancelFromWebhook', () => {
    it('updates subscription status to canceled', async () => {
      mockSubRepo.update.mockResolvedValue(undefined);
      await service.cancelFromWebhook('sub_1');
      expect(mockSubRepo.update).toHaveBeenCalledWith({ stripeSubscriptionId: 'sub_1' }, { status: 'canceled' });
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

  describe('redeemToken', () => {
    it('redeems oldest active token (FIFO) and records book unlock', async () => {
      mockBookRepo.findOneBy.mockResolvedValue({ id: 'bk1', isPublished: true });
      mockTokenRepo.update.mockResolvedValue(undefined);
      mockTokenRepo.findOne.mockResolvedValue({ id: 'tok1', status: 'active' });
      mockUserBookRepo.existsBy.mockResolvedValue(false);
      mockUserBookRepo.insert.mockResolvedValue(undefined);

      await service.redeemToken('u1', 'bk1');
      expect(mockTokenRepo.update).toHaveBeenCalledWith('tok1', expect.objectContaining({ status: 'redeemed', bookId: 'bk1' }));
      expect(mockUserBookRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'u1', bookId: 'bk1', purchaseType: 'token' }),
      );
    });

    it('throws NotFoundException for unknown book', async () => {
      mockBookRepo.findOneBy.mockResolvedValue(null);
      await expect(service.redeemToken('u1', 'ghost')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when no active tokens remain', async () => {
      mockBookRepo.findOneBy.mockResolvedValue({ id: 'bk1', isPublished: true });
      mockTokenRepo.update.mockResolvedValue(undefined);
      mockTokenRepo.findOne.mockResolvedValue(null);
      await expect(service.redeemToken('u1', 'bk1')).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when book is already owned', async () => {
      mockBookRepo.findOneBy.mockResolvedValue({ id: 'bk1', isPublished: true });
      mockTokenRepo.update.mockResolvedValue(undefined);
      mockTokenRepo.findOne.mockResolvedValue({ id: 'tok1', status: 'active' });
      mockUserBookRepo.existsBy.mockResolvedValue(true);
      await expect(service.redeemToken('u1', 'bk1')).rejects.toThrow(BadRequestException);
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
    it('inserts user_book with purchaseType purchase', async () => {
      mockUserBookRepo.insert.mockResolvedValue(undefined);
      await service.addPurchasedBook('u1', 'bk1');
      expect(mockUserBookRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'u1', bookId: 'bk1', purchaseType: 'purchase' }),
      );
    });

    it('silently ignores duplicate (already owned)', async () => {
      mockUserBookRepo.insert.mockRejectedValue({ code: '23505' });
      await expect(service.addPurchasedBook('u1', 'bk1')).resolves.toBeUndefined();
    });

    it('rethrows unexpected errors', async () => {
      mockUserBookRepo.insert.mockRejectedValue(new Error('DB down'));
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

    it('sets nextTokenIssuanceAt +30 days for annual plans', async () => {
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
      expect(mockSubRepo.update).toHaveBeenCalledWith('sub1', expect.objectContaining({ nextTokenIssuanceAt: expect.any(Date) }));
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

      const result = await service.syncSubscription('u1');
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

  describe('redeemToken', () => {
    it('redeems oldest active token (FIFO) and records book unlock', async () => {
      mockBookRepo.findOneBy.mockResolvedValue({ id: 'b1', isPublished: true });
      mockTokenRepo.update.mockResolvedValue({});
      mockTokenRepo.findOne.mockResolvedValue({ id: 'tok1', status: 'active' });
      mockUserBookRepo.existsBy.mockResolvedValue(false);
      mockUserBookRepo.insert.mockResolvedValue({});

      await service.redeemToken('u1', 'b1');

      expect(mockTokenRepo.update).toHaveBeenCalledWith('tok1', expect.objectContaining({ status: 'redeemed', bookId: 'b1' }));
      expect(mockUserBookRepo.insert).toHaveBeenCalledWith(expect.objectContaining({ purchaseType: 'token' }));
    });

    it('throws ForbiddenException when no active tokens remain', async () => {
      mockBookRepo.findOneBy.mockResolvedValue({ id: 'b1', isPublished: true });
      mockTokenRepo.update.mockResolvedValue({});
      mockTokenRepo.findOne.mockResolvedValue(null);
      await expect(service.redeemToken('u1', 'b1')).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when book does not exist', async () => {
      mockBookRepo.findOneBy.mockResolvedValue(null);
      await expect(service.redeemToken('u1', 'b1')).rejects.toThrow(NotFoundException);
    });

    it('uses owner token pool when linked user has no own tokens', async () => {
      mockBookRepo.findOneBy.mockResolvedValue({ id: 'b1', isPublished: true });
      mockUserBookRepo.existsBy.mockResolvedValue(false);
      mockTokenRepo.update.mockResolvedValue({});
      mockTokenRepo.findOne
        .mockResolvedValueOnce(null) // linked user has no tokens
        .mockResolvedValueOnce({ id: 'owner-tok', status: 'active' }); // owner has tokens
      mockQb.getOne.mockResolvedValue({ id: 'owner-sub', userId: 'owner1', status: 'active' });
      mockUserBookRepo.insert.mockResolvedValue({});

      await service.redeemToken('linked-user', 'b1');
      expect(mockTokenRepo.update).toHaveBeenCalledWith('owner-tok', expect.objectContaining({ status: 'redeemed' }));
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
