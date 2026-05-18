import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Book } from '../../../src/books/book.entity';
import { UserBook } from '../../../src/library/user-book.entity';
import { Subscription } from '../../../src/subscriptions/subscription.entity';
import { SubscriptionGuard } from '../../../src/subscriptions/subscription.guard';

const mockQb = { where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), getOne: jest.fn() };
const mockSubRepo = { findOneBy: jest.fn(), createQueryBuilder: jest.fn(() => mockQb) };
const mockBookRepo = { findOneBy: jest.fn() };
const mockUserBookRepo = { existsBy: jest.fn() };

const makeContext = (userId?: string, bookId?: string): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({
        user: userId ? { id: userId } : undefined,
        params: bookId ? { id: bookId } : {},
      }),
    }),
  } as unknown as ExecutionContext);

describe('SubscriptionGuard', () => {
  let guard: SubscriptionGuard;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockUserBookRepo.existsBy.mockResolvedValue(false);
    mockQb.getOne.mockResolvedValue(null); // no linked subscription by default
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionGuard,
        { provide: getRepositoryToken(Subscription), useValue: mockSubRepo },
        { provide: getRepositoryToken(Book), useValue: mockBookRepo },
        { provide: getRepositoryToken(UserBook), useValue: mockUserBookRepo },
      ],
    }).compile();

    guard = module.get(SubscriptionGuard);
  });

  describe('free book bypass', () => {
    it('allows access to a free book without checking subscription', async () => {
      mockBookRepo.findOneBy.mockResolvedValue({ isFree: true });

      await expect(guard.canActivate(makeContext('u1', 'free-book-id'))).resolves.toBe(true);
      expect(mockSubRepo.findOneBy).not.toHaveBeenCalled();
    });

    it('falls through to subscription check for a non-free book', async () => {
      mockBookRepo.findOneBy.mockResolvedValue({ isFree: false });
      mockSubRepo.findOneBy.mockResolvedValue({ status: 'active' });

      await expect(guard.canActivate(makeContext('u1', 'paid-book-id'))).resolves.toBe(true);
      expect(mockSubRepo.findOneBy).toHaveBeenCalled();
    });

    it('falls through to subscription check when no bookId in params', async () => {
      mockSubRepo.findOneBy.mockResolvedValue({ status: 'active' });

      await expect(guard.canActivate(makeContext('u1'))).resolves.toBe(true);
      expect(mockSubRepo.findOneBy).toHaveBeenCalled();
    });
  });

  describe('owned book bypass', () => {
    it('allows access when user owns the book, regardless of subscription', async () => {
      mockBookRepo.findOneBy.mockResolvedValue({ isFree: false });
      mockUserBookRepo.existsBy.mockResolvedValue(true);

      await expect(guard.canActivate(makeContext('u1', 'book-id'))).resolves.toBe(true);
      expect(mockSubRepo.findOneBy).not.toHaveBeenCalled();
    });

    it('does not check ownership when no userId on request', async () => {
      mockBookRepo.findOneBy.mockResolvedValue({ isFree: false });
      mockSubRepo.findOneBy.mockResolvedValue(null);

      await expect(guard.canActivate(makeContext(undefined, 'book-id'))).rejects.toThrow(ForbiddenException);
      expect(mockUserBookRepo.existsBy).not.toHaveBeenCalled();
    });
  });

  describe('subscription check', () => {
    beforeEach(() => {
      mockBookRepo.findOneBy.mockResolvedValue({ isFree: false });
    });

    it('allows active subscriber', async () => {
      mockSubRepo.findOneBy.mockResolvedValue({ status: 'active' });
      await expect(guard.canActivate(makeContext('u1', 'book-id'))).resolves.toBe(true);
    });

    it('allows trialing subscriber', async () => {
      mockSubRepo.findOneBy.mockResolvedValue({ status: 'trialing' });
      await expect(guard.canActivate(makeContext('u1', 'book-id'))).resolves.toBe(true);
    });

    it('allows canceling subscriber', async () => {
      mockSubRepo.findOneBy.mockResolvedValue({ status: 'canceling' });
      await expect(guard.canActivate(makeContext('u1', 'book-id'))).resolves.toBe(true);
    });

    it('throws 403 subscription_required for non-subscriber', async () => {
      mockSubRepo.findOneBy.mockResolvedValue(null);
      await expect(guard.canActivate(makeContext('u1', 'book-id'))).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(makeContext('u1', 'book-id'))).rejects.toMatchObject({
        response: { error: 'subscription_required' },
      });
    });

    it('throws 403 subscription_required for canceled subscriber', async () => {
      mockSubRepo.findOneBy.mockResolvedValue({ status: 'canceled' });
      await expect(guard.canActivate(makeContext('u1', 'book-id'))).rejects.toThrow(ForbiddenException);
    });

    it('throws 403 payment_required with billingPortalHint for past_due subscriber', async () => {
      mockSubRepo.findOneBy.mockResolvedValue({ status: 'past_due' });
      await expect(guard.canActivate(makeContext('u1', 'book-id'))).rejects.toMatchObject({
        response: { error: 'payment_required', billingPortalHint: true },
      });
    });

    it('throws 403 for unauthenticated request (no user on req)', async () => {
      mockSubRepo.findOneBy.mockResolvedValue(null);
      await expect(guard.canActivate(makeContext(undefined, 'book-id'))).rejects.toThrow(ForbiddenException);
    });
  });

  describe('linked user access', () => {
    beforeEach(() => {
      mockBookRepo.findOneBy.mockResolvedValue({ isFree: false });
      mockSubRepo.findOneBy.mockResolvedValue(null);
    });

    it('allows a linked member on an active owner subscription', async () => {
      mockQb.getOne.mockResolvedValue({ id: 'owner-sub', status: 'active' });
      await expect(guard.canActivate(makeContext('linked-user', 'book-id'))).resolves.toBe(true);
    });

    it('throws subscription_required when user is not linked to any active plan', async () => {
      mockQb.getOne.mockResolvedValue(null);
      await expect(guard.canActivate(makeContext('u1', 'book-id'))).rejects.toMatchObject({
        response: { error: 'subscription_required' },
      });
    });
  });
});
