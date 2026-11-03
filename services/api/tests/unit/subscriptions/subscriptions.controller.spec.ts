import { GoneException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PlansService } from '../../../src/subscriptions/plans.service';
import { SubscriptionsController } from '../../../src/subscriptions/subscriptions.controller';
import { SubscriptionsService } from '../../../src/subscriptions/subscriptions.service';

// The retired route must touch none of the service's checkout or redemption paths.
const mockSubscriptionsService: Record<string, jest.Mock> = {
  createCheckoutSession: jest.fn(),
  createTokenPackageSession: jest.fn(),
  createPortalSession: jest.fn(),
  getOrCreateStripeCustomer: jest.fn(),
  addPurchasedBook: jest.fn(),
  redeemToken: jest.fn(),
};

describe('SubscriptionsController — direct title purchase retired (NEM-015)', () => {
  let controller: SubscriptionsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [SubscriptionsController],
      providers: [
        { provide: SubscriptionsService, useValue: mockSubscriptionsService },
        { provide: PlansService, useValue: {} },
      ],
    }).compile();
    controller = module.get(SubscriptionsController);
  });

  it('answers 410 title_purchase_discontinued for any book', () => {
    let err: unknown;
    try {
      (controller as any).purchaseBook({ user: { id: 'u1' } }, 'any-book');
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(GoneException);
    expect((err as GoneException).getStatus()).toBe(410);
    expect((err as GoneException).getResponse()).toEqual({ error: 'title_purchase_discontinued' });
  });

  it('never reaches the service or Stripe', () => {
    expect(() => (controller as any).purchaseBook()).toThrow(GoneException);
    for (const fn of Object.values(mockSubscriptionsService)) expect(fn).not.toHaveBeenCalled();
  });

  it('still lets customers redeem a token for a book', async () => {
    mockSubscriptionsService.redeemToken.mockResolvedValue(undefined);
    await controller.redeemBook({ user: { id: 'u1' } }, 'b1');
    expect(mockSubscriptionsService.redeemToken).toHaveBeenCalledWith('u1', 'b1');
  });
});
