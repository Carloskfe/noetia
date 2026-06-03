import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionsService } from '../../../src/subscriptions/subscriptions.service';
import { WebhooksService } from '../../../src/subscriptions/webhooks.service';
import { GiftsService } from '../../../src/gifts/gifts.service';

const mockGiftsService = { fulfillGift: jest.fn() };

const mockSubscriptionsService = {
  upsertFromWebhook: jest.fn(),
  cancelFromWebhook: jest.fn(),
  findPlanByStripePriceId: jest.fn(),
  addPurchasedBook: jest.fn(),
  issueTokensForNewSubscription: jest.fn(),
  issueTokensForPurchasedPackage: jest.fn(),
};

const makeEvent = (type: string, data: object, id = 'evt_test_1') => ({
  id,
  type,
  data: { object: data },
});

describe('WebhooksService', () => {
  let service: WebhooksService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhooksService,
        { provide: SubscriptionsService, useValue: mockSubscriptionsService },
        { provide: GiftsService, useValue: mockGiftsService },
      ],
    }).compile();

    service = module.get(WebhooksService);
  });

  describe('handleEvent', () => {
    it('handles checkout.session.completed (subscription mode, string ids)', async () => {
      const event = makeEvent('checkout.session.completed', {
        mode: 'subscription',
        subscription: 'sub_1',
        customer: 'cus_1',
      });
      await service.handleEvent(event as any);
      expect(mockSubscriptionsService.upsertFromWebhook).toHaveBeenCalledWith(
        'evt_test_1', 'cus_1', 'sub_1', 'active', expect.any(Date), null,
      );
    });

    it('handles checkout.session.completed (subscription mode, object ids)', async () => {
      const event = makeEvent('checkout.session.completed', {
        mode: 'subscription',
        subscription: { id: 'sub_obj' },
        customer: { id: 'cus_obj' },
      });
      await service.handleEvent(event as any);
      expect(mockSubscriptionsService.upsertFromWebhook).toHaveBeenCalledWith(
        expect.any(String), 'cus_obj', 'sub_obj', 'active', expect.any(Date), null,
      );
    });

    it('skips checkout.session.completed when subscription or customer missing', async () => {
      const event = makeEvent('checkout.session.completed', { mode: 'subscription', subscription: null, customer: null });
      await service.handleEvent(event as any);
      expect(mockSubscriptionsService.upsertFromWebhook).not.toHaveBeenCalled();
    });

    it('handles checkout.session.completed (payment mode) — adds purchased book', async () => {
      const event = makeEvent('checkout.session.completed', {
        mode: 'payment',
        metadata: { bookId: 'bk_1', userId: 'u_1' },
      });
      await service.handleEvent(event as any);
      expect(mockSubscriptionsService.addPurchasedBook).toHaveBeenCalledWith('u_1', 'bk_1');
      expect(mockSubscriptionsService.upsertFromWebhook).not.toHaveBeenCalled();
    });

    it('handles checkout.session.completed (payment mode) — issues tokens for token package', async () => {
      const event = makeEvent('checkout.session.completed', {
        mode: 'payment',
        metadata: { tokenPackageId: 'pkg_uuid_1', userId: 'u_1' },
      });
      await service.handleEvent(event as any);
      expect(mockSubscriptionsService.issueTokensForPurchasedPackage).toHaveBeenCalledWith('pkg_uuid_1', 'u_1');
      expect(mockSubscriptionsService.addPurchasedBook).not.toHaveBeenCalled();
    });

    it('silently skips payment checkout without userId', async () => {
      const event = makeEvent('checkout.session.completed', { mode: 'payment', metadata: {} });
      await service.handleEvent(event as any);
      expect(mockSubscriptionsService.addPurchasedBook).not.toHaveBeenCalled();
      expect(mockSubscriptionsService.issueTokensForPurchasedPackage).not.toHaveBeenCalled();
    });

    it('handles invoice.paid — sets status active and issues tokens', async () => {
      const event = makeEvent('invoice.paid', {
        subscription: 'sub_1',
        customer: 'cus_1',
        lines: { data: [{ period: { end: Math.floor(Date.now() / 1000) + 86400 } }] },
      });
      await service.handleEvent(event as any);
      expect(mockSubscriptionsService.upsertFromWebhook).toHaveBeenCalledWith(
        expect.any(String),
        'cus_1',
        'sub_1',
        'active',
        expect.any(Date),
        null,
      );
      expect(mockSubscriptionsService.issueTokensForNewSubscription).toHaveBeenCalledWith('sub_1');
    });

    it('skips invoice.paid when subscription or customer id missing', async () => {
      const event = makeEvent('invoice.paid', { subscription: null, customer: null });
      await service.handleEvent(event as any);
      expect(mockSubscriptionsService.upsertFromWebhook).not.toHaveBeenCalled();
    });

    it('handles invoice.paid — object ids, no periodEnd falls back to now', async () => {
      const event = makeEvent('invoice.paid', {
        subscription: { id: 'sub_obj' },
        customer: { id: 'cus_obj' },
        lines: { data: [] },
      });
      await service.handleEvent(event as any);
      expect(mockSubscriptionsService.upsertFromWebhook).toHaveBeenCalledWith(
        expect.any(String), 'cus_obj', 'sub_obj', 'active', expect.any(Date), null,
      );
    });

    it('handles invoice.payment_failed (string ids) and sets status past_due', async () => {
      const event = makeEvent('invoice.payment_failed', {
        subscription: 'sub_1',
        customer: 'cus_1',
      });
      await service.handleEvent(event as any);
      expect(mockSubscriptionsService.upsertFromWebhook).toHaveBeenCalledWith(
        expect.any(String), 'cus_1', 'sub_1', 'past_due', expect.any(Date), null,
      );
    });

    it('handles invoice.payment_failed (object ids)', async () => {
      const event = makeEvent('invoice.payment_failed', {
        subscription: { id: 'sub_obj' },
        customer: { id: 'cus_obj' },
      });
      await service.handleEvent(event as any);
      expect(mockSubscriptionsService.upsertFromWebhook).toHaveBeenCalledWith(
        expect.any(String), 'cus_obj', 'sub_obj', 'past_due', expect.any(Date), null,
      );
    });

    it('skips invoice.payment_failed when ids missing', async () => {
      const event = makeEvent('invoice.payment_failed', { subscription: null, customer: null });
      await service.handleEvent(event as any);
      expect(mockSubscriptionsService.upsertFromWebhook).not.toHaveBeenCalled();
    });

    it('handles customer.subscription.updated — active status, string customer', async () => {
      mockSubscriptionsService.findPlanByStripePriceId.mockResolvedValue('plan_1');
      const event = makeEvent('customer.subscription.updated', {
        id: 'sub_1',
        customer: 'cus_1',
        status: 'active',
        cancel_at_period_end: false,
        current_period_end: Math.floor(Date.now() / 1000) + 86400,
        trial_end: null,
        items: { data: [{ price: { id: 'price_123' } }] },
      });
      await service.handleEvent(event as any);
      expect(mockSubscriptionsService.upsertFromWebhook).toHaveBeenCalledWith(
        expect.any(String), 'cus_1', 'sub_1', 'active', expect.any(Date), null, 'plan_1',
      );
    });

    it('handles customer.subscription.updated — object customer', async () => {
      mockSubscriptionsService.findPlanByStripePriceId.mockResolvedValue(null);
      const event = makeEvent('customer.subscription.updated', {
        id: 'sub_1',
        customer: { id: 'cus_obj' },
        status: 'active',
        cancel_at_period_end: false,
        current_period_end: Math.floor(Date.now() / 1000) + 86400,
        trial_end: null,
        items: { data: [{ price: { id: 'price_x' } }] },
      });
      await service.handleEvent(event as any);
      expect(mockSubscriptionsService.upsertFromWebhook).toHaveBeenCalledWith(
        expect.any(String), 'cus_obj', 'sub_1', 'active', expect.any(Date), null, null,
      );
    });

    it('handles customer.subscription.updated — canceling status', async () => {
      mockSubscriptionsService.findPlanByStripePriceId.mockResolvedValue(null);
      const event = makeEvent('customer.subscription.updated', {
        id: 'sub_1', customer: 'cus_1', status: 'active', cancel_at_period_end: true,
        current_period_end: Math.floor(Date.now() / 1000) + 86400, trial_end: null,
        items: { data: [] },
      });
      await service.handleEvent(event as any);
      expect(mockSubscriptionsService.upsertFromWebhook).toHaveBeenCalledWith(
        expect.any(String), 'cus_1', 'sub_1', 'canceling', expect.any(Date), null, null,
      );
    });

    it('handles customer.subscription.updated — trialing status with trial_end', async () => {
      mockSubscriptionsService.findPlanByStripePriceId.mockResolvedValue(null);
      const trialEnd = Math.floor(Date.now() / 1000) + 86400;
      const event = makeEvent('customer.subscription.updated', {
        id: 'sub_1', customer: 'cus_1', status: 'trialing', cancel_at_period_end: false,
        current_period_end: trialEnd, trial_end: trialEnd,
        items: { data: [] },
      });
      await service.handleEvent(event as any);
      expect(mockSubscriptionsService.upsertFromWebhook).toHaveBeenCalledWith(
        expect.any(String), 'cus_1', 'sub_1', 'trialing', expect.any(Date), expect.any(Date), null,
      );
    });

    it('handles customer.subscription.updated — past_due status', async () => {
      mockSubscriptionsService.findPlanByStripePriceId.mockResolvedValue(null);
      const event = makeEvent('customer.subscription.updated', {
        id: 'sub_1', customer: 'cus_1', status: 'past_due', cancel_at_period_end: false,
        current_period_end: Math.floor(Date.now() / 1000) + 86400, trial_end: null,
        items: { data: [] },
      });
      await service.handleEvent(event as any);
      expect(mockSubscriptionsService.upsertFromWebhook).toHaveBeenCalledWith(
        expect.any(String), 'cus_1', 'sub_1', 'past_due', expect.any(Date), null, null,
      );
    });

    it('handles customer.subscription.updated — unknown status maps to none', async () => {
      mockSubscriptionsService.findPlanByStripePriceId.mockResolvedValue(null);
      const event = makeEvent('customer.subscription.updated', {
        id: 'sub_1', customer: 'cus_1', status: 'unpaid', cancel_at_period_end: false,
        current_period_end: Math.floor(Date.now() / 1000) + 86400, trial_end: null,
        items: { data: [] },
      });
      await service.handleEvent(event as any);
      expect(mockSubscriptionsService.upsertFromWebhook).toHaveBeenCalledWith(
        expect.any(String), 'cus_1', 'sub_1', 'none', expect.any(Date), null, null,
      );
    });

    it('handles customer.subscription.deleted and cancels', async () => {
      const event = makeEvent('customer.subscription.deleted', { id: 'sub_1' });
      await service.handleEvent(event as any);
      expect(mockSubscriptionsService.cancelFromWebhook).toHaveBeenCalledWith('sub_1');
    });

    it('handles unknown event type without error', async () => {
      const event = makeEvent('payment_intent.created', { id: 'pi_1' });
      await expect(service.handleEvent(event as any)).resolves.toBeUndefined();
    });

    it('is idempotent — duplicate event id is not re-processed', async () => {
      mockSubscriptionsService.upsertFromWebhook.mockResolvedValue(undefined);
      const event = makeEvent('checkout.session.completed', {
        subscription: 'sub_1',
        customer: 'cus_1',
      }, 'evt_dup');

      await service.handleEvent(event as any);
      await service.handleEvent(event as any);

      expect(mockSubscriptionsService.upsertFromWebhook).toHaveBeenCalledTimes(2);
    });
  });
});
