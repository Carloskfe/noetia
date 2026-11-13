import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SubscriptionsService } from '../../../src/subscriptions/subscriptions.service';
import { WebhooksService } from '../../../src/subscriptions/webhooks.service';
import { GiftsService } from '../../../src/gifts/gifts.service';
import { StripeProcessedEvent } from '../../../src/subscriptions/stripe-processed-event.entity';

const mockGiftsService = { fulfillGift: jest.fn() };

const mockSubscriptionsService = {
  upsertFromWebhook: jest.fn(),
  applyStripeSubscription: jest.fn(),
  cancelFromWebhook: jest.fn(),
  findPlanByStripePriceId: jest.fn(),
  addPurchasedBook: jest.fn(),
  issueTokensForNewSubscription: jest.fn(),
  issueTokensForPurchasedPackage: jest.fn(),
};

// Stateful in-memory stand-in for the stripe_processed_events ledger. handleEvent runs in ONE transaction: the
// claim INSERT honours the primary key and a throw inside the transaction rolls the claims back.
let processedStore: Map<string, { eventId: string; type: string }>;
const txLog: string[] = [];
const em = {
  query: jest.fn(async (sql: string, params: any[]) => {
    if (!sql.includes('INSERT INTO stripe_processed_events')) return [];
    if (processedStore.has(params[0])) return [];
    processedStore.set(params[0], { eventId: params[0], type: params[1] });
    return [{ eventId: params[0] }];
  }),
};
const mockProcessedRepo = {
  manager: {
    transaction: jest.fn(async (fn: (m: typeof em) => Promise<unknown>) => {
      const snapshot = new Map(processedStore);
      try {
        const result = await fn(em);
        txLog.push('commit');
        return result;
      } catch (err) {
        txLog.push('rollback');
        processedStore = snapshot;
        throw err;
      }
    }),
  },
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
    processedStore = new Map();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhooksService,
        { provide: SubscriptionsService, useValue: mockSubscriptionsService },
        { provide: GiftsService, useValue: mockGiftsService },
        { provide: getRepositoryToken(StripeProcessedEvent), useValue: mockProcessedRepo },
      ],
    }).compile();

    service = module.get(WebhooksService);
  });

  describe('handleEvent', () => {
    // Subscription events re-read Stripe through SubscriptionsService.applyStripeSubscription (state mapping
    // and the identity guard are tested in subscriptions.service.spec / payment-lifecycle.spec).
    it('checkout.session.completed (subscription, string id) → re-reads that subscription, no plan', async () => {
      await service.handleEvent(makeEvent('checkout.session.completed', { subscription: 'sub_1', customer: 'cus_1' }) as any);
      expect(mockSubscriptionsService.applyStripeSubscription).toHaveBeenCalledWith('evt_test_1', 'sub_1', {}, em);
    });

    it('checkout.session.completed (subscription, object id) → re-reads that subscription', async () => {
      await service.handleEvent(makeEvent('checkout.session.completed', { subscription: { id: 'sub_2' }, customer: { id: 'cus_2' } }) as any);
      expect(mockSubscriptionsService.applyStripeSubscription).toHaveBeenCalledWith('evt_test_1', 'sub_2', {}, em);
    });

    it('skips checkout.session.completed when subscription or customer missing', async () => {
      await service.handleEvent(makeEvent('checkout.session.completed', { subscription: null, customer: 'cus_1' }) as any);
      expect(mockSubscriptionsService.applyStripeSubscription).not.toHaveBeenCalled();
    });

    it('handles checkout.session.completed (payment mode) — adds purchased book', async () => {
      const event = makeEvent('checkout.session.completed', {
        id: 'cs_book_1',
        mode: 'payment',
        metadata: { bookId: 'bk_1', userId: 'u_1' },
      });
      await service.handleEvent(event as any);
      expect(mockSubscriptionsService.addPurchasedBook).toHaveBeenCalledWith('u_1', 'bk_1', em);
      expect(mockSubscriptionsService.applyStripeSubscription).not.toHaveBeenCalled();
    });

    it('handles checkout.session.completed (payment mode) — issues tokens for token package', async () => {
      const event = makeEvent('checkout.session.completed', {
        id: 'cs_pkg_1',
        mode: 'payment',
        metadata: { tokenPackageId: 'pkg_uuid_1', userId: 'u_1' },
      });
      await service.handleEvent(event as any);
      expect(mockSubscriptionsService.issueTokensForPurchasedPackage).toHaveBeenCalledWith('pkg_uuid_1', 'u_1', em);
      expect(mockSubscriptionsService.addPurchasedBook).not.toHaveBeenCalled();
    });

    it('silently skips payment checkout without userId', async () => {
      const event = makeEvent('checkout.session.completed', { id: 'cs_none', mode: 'payment', metadata: {} });
      await service.handleEvent(event as any);
      expect(mockSubscriptionsService.addPurchasedBook).not.toHaveBeenCalled();
      expect(mockSubscriptionsService.issueTokensForPurchasedPackage).not.toHaveBeenCalled();
    });

    it('invoice.paid → re-reads the subscription, then issues tokens exactly as before', async () => {
      const order: string[] = [];
      mockSubscriptionsService.applyStripeSubscription.mockImplementationOnce(async () => { order.push('apply'); return true; });
      mockSubscriptionsService.issueTokensForNewSubscription.mockImplementationOnce(async () => { order.push('tokens'); });
      await service.handleEvent(makeEvent('invoice.paid', { id: 'in_1', subscription: 'sub_1', customer: 'cus_1' }) as any);
      expect(mockSubscriptionsService.applyStripeSubscription).toHaveBeenCalledWith('evt_test_1', 'sub_1', {}, em);
      expect(mockSubscriptionsService.issueTokensForNewSubscription).toHaveBeenCalledWith('sub_1', em, 'in_1');
      expect(order).toEqual(['apply', 'tokens']);
    });

    it('invoice.paid reads the subscription id from the newer invoice shape (parent.subscription_details)', async () => {
      await service.handleEvent(makeEvent('invoice.paid', { parent: { subscription_details: { subscription: 'sub_9' } } }) as any);
      expect(mockSubscriptionsService.applyStripeSubscription).toHaveBeenCalledWith('evt_test_1', 'sub_9', {}, em);
    });

    it('skips invoice.paid without a subscription (one-off invoice)', async () => {
      await service.handleEvent(makeEvent('invoice.paid', { customer: 'cus_1' }) as any);
      expect(mockSubscriptionsService.applyStripeSubscription).not.toHaveBeenCalled();
      expect(mockSubscriptionsService.issueTokensForNewSubscription).not.toHaveBeenCalled();
    });

    it('invoice.payment_failed → re-reads the subscription (Stripe decides past_due), no tokens', async () => {
      await service.handleEvent(makeEvent('invoice.payment_failed', { subscription: { id: 'sub_1' }, customer: 'cus_1' }) as any);
      expect(mockSubscriptionsService.applyStripeSubscription).toHaveBeenCalledWith('evt_test_1', 'sub_1', {}, em);
      expect(mockSubscriptionsService.issueTokensForNewSubscription).not.toHaveBeenCalled();
    });

    it('skips invoice.payment_failed when the subscription id is missing', async () => {
      await service.handleEvent(makeEvent('invoice.payment_failed', { customer: 'cus_1' }) as any);
      expect(mockSubscriptionsService.applyStripeSubscription).not.toHaveBeenCalled();
    });

    it('customer.subscription.created → re-reads the subscription WITHOUT writing planId (trial-token gate)', async () => {
      await service.handleEvent(makeEvent('customer.subscription.created', { id: 'sub_new', customer: 'cus_1' }) as any);
      expect(mockSubscriptionsService.applyStripeSubscription).toHaveBeenCalledWith('evt_test_1', 'sub_new', {}, em);
    });

    it('customer.subscription.updated → re-reads the subscription and writes planId (unchanged)', async () => {
      await service.handleEvent(makeEvent('customer.subscription.updated', { id: 'sub_1', customer: 'cus_1' }) as any);
      expect(mockSubscriptionsService.applyStripeSubscription).toHaveBeenCalledWith('evt_test_1', 'sub_1', { includePlan: true }, em);
    });

    it('handles customer.subscription.deleted and cancels', async () => {
      await service.handleEvent(makeEvent('customer.subscription.deleted', { id: 'sub_1' }) as any);
      expect(mockSubscriptionsService.cancelFromWebhook).toHaveBeenCalledWith('sub_1', em);
    });

    it('a Stripe re-read failure propagates (non-2xx) and the event is not recorded, so Stripe retries', async () => {
      mockSubscriptionsService.applyStripeSubscription.mockRejectedValueOnce(new Error('stripe down'));
      const e = makeEvent('customer.subscription.created', { id: 'sub_1' }, 'evt_fail');
      await expect(service.handleEvent(e as any)).rejects.toThrow('stripe down');
      expect(processedStore.has('evt_fail')).toBe(false);
    });

    it('handles unknown event type without error', async () => {
      const event = makeEvent('payment_intent.created', { id: 'pi_1' });
      await expect(service.handleEvent(event as any)).resolves.toBeUndefined();
    });

    it('is idempotent — duplicate event id is not re-processed', async () => {
      const event = makeEvent('checkout.session.completed', {
        subscription: 'sub_1',
        customer: 'cus_1',
      }, 'evt_dup');

      await service.handleEvent(event as any);
      await service.handleEvent(event as any);

      // Redelivery of the same event.id → the second delivery is skipped.
      expect(mockSubscriptionsService.applyStripeSubscription).toHaveBeenCalledTimes(1);
    });
  });

  describe('idempotency (P2)', () => {
    it('processes a first delivery exactly once and records it', async () => {
      const event = makeEvent('invoice.paid', {
        subscription: 'sub_1', customer: 'cus_1', lines: { data: [] },
      }, 'evt_first');

      await service.handleEvent(event as any);

      expect(mockSubscriptionsService.issueTokensForNewSubscription).toHaveBeenCalledTimes(1);
      expect(processedStore.has('evt_first')).toBe(true);
    });

    it('duplicate invoice.paid does not issue duplicate subscription tokens', async () => {
      const event = makeEvent('invoice.paid', {
        subscription: 'sub_1', customer: 'cus_1', lines: { data: [] },
      }, 'evt_inv_dup');

      await service.handleEvent(event as any);
      await service.handleEvent(event as any); // Stripe redelivers the SAME event

      expect(mockSubscriptionsService.issueTokensForNewSubscription).toHaveBeenCalledTimes(1);
    });

    it('duplicate token-package checkout does not issue duplicate purchased tokens', async () => {
      const event = makeEvent('checkout.session.completed', {
        id: 'cs_pkg_dup', mode: 'payment', metadata: { tokenPackageId: 'pkg_1', userId: 'u_1' },
      }, 'evt_pkg_dup');

      await service.handleEvent(event as any);
      await service.handleEvent(event as any);

      expect(mockSubscriptionsService.issueTokensForPurchasedPackage).toHaveBeenCalledTimes(1);
    });

    it('a processing FAILURE does not permanently suppress a legitimate Stripe retry', async () => {
      const event = makeEvent('invoice.paid', {
        subscription: 'sub_1', customer: 'cus_1', lines: { data: [] },
      }, 'evt_retry');

      // First delivery fails mid-processing → must NOT be recorded as processed.
      mockSubscriptionsService.issueTokensForNewSubscription.mockRejectedValueOnce(new Error('boom'));
      await expect(service.handleEvent(event as any)).rejects.toThrow('boom');
      expect(processedStore.has('evt_retry')).toBe(false); // no record → Stripe will retry

      // Stripe redelivers → now it succeeds and is processed exactly once more.
      await service.handleEvent(event as any);
      expect(mockSubscriptionsService.issueTokensForNewSubscription).toHaveBeenCalledTimes(2);
      expect(processedStore.has('evt_retry')).toBe(true);
    });

    it('distinct legitimate events continue to process independently', async () => {
      const e1 = makeEvent('invoice.paid', {
        subscription: 'sub_1', customer: 'cus_1', lines: { data: [] },
      }, 'evt_a');
      const e2 = makeEvent('invoice.paid', {
        subscription: 'sub_2', customer: 'cus_2', lines: { data: [] },
      }, 'evt_b');

      await service.handleEvent(e1 as any);
      await service.handleEvent(e2 as any);

      expect(mockSubscriptionsService.issueTokensForNewSubscription).toHaveBeenCalledTimes(2);
      expect(mockSubscriptionsService.issueTokensForNewSubscription).toHaveBeenCalledWith('sub_1', em, null);
      expect(mockSubscriptionsService.issueTokensForNewSubscription).toHaveBeenCalledWith('sub_2', em, null);
    });
  });

  describe('exactly-once fulfillment (P0 correction)', () => {
    const payment = (id: string, sessionId: string, metadata: Record<string, string>) =>
      makeEvent('checkout.session.completed', { id: sessionId, mode: 'payment', metadata }, id);

    it('claims the event id inside the same transaction as the side effects', async () => {
      mockSubscriptionsService.applyStripeSubscription.mockImplementationOnce(async () => {
        expect(processedStore.has('evt_tx')).toBe(true); // claim already taken, not yet committed
        return true;
      });
      await service.handleEvent(makeEvent('customer.subscription.created', { id: 'sub_1' }, 'evt_tx') as any);
      expect(mockProcessedRepo.manager.transaction).toHaveBeenCalledTimes(1);
    });

    it('a different event id for an already-fulfilled Checkout session grants nothing', async () => {
      const md = { tokenPackageId: 'pkg_1', userId: 'u_1' };
      await service.handleEvent(payment('evt_1', 'cs_same', md) as any);
      await service.handleEvent(payment('evt_2', 'cs_same', md) as any);
      expect(mockSubscriptionsService.issueTokensForPurchasedPackage).toHaveBeenCalledTimes(1);
      expect(processedStore.has('fulfillment:checkout-session:cs_same')).toBe(true);
      expect(processedStore.has('evt_2')).toBe(true); // the event itself is recorded as handled
    });

    it('a book purchase is claimed per session too', async () => {
      await service.handleEvent(payment('evt_b1', 'cs_bk', { bookId: 'bk', userId: 'u_1' }) as any);
      await service.handleEvent(payment('evt_b2', 'cs_bk', { bookId: 'bk', userId: 'u_1' }) as any);
      expect(mockSubscriptionsService.addPurchasedBook).toHaveBeenCalledTimes(1);
    });

    it('gift: records in the transaction and e-mails only after commit, once', async () => {
      txLog.length = 0;
      const notify = jest.fn(async () => { txLog.push('email'); });
      mockGiftsService.fulfillGift.mockImplementationOnce(async () => { txLog.push('record'); return notify; });
      const md = { type: 'gift', recipientEmail: 'r@test.invalid', tokenCount: '1' };
      await service.handleEvent(payment('evt_g1', 'cs_g', md) as any);
      await service.handleEvent(payment('evt_g2', 'cs_g', md) as any);
      expect(mockGiftsService.fulfillGift).toHaveBeenCalledTimes(1);
      expect(mockGiftsService.fulfillGift).toHaveBeenCalledWith(expect.objectContaining({ id: 'cs_g' }), em);
      expect(notify).toHaveBeenCalledTimes(1);
      expect(txLog).toEqual(['record', 'commit', 'email', 'commit']); // 2nd delivery: claim conflict, no work
    });

    it('gift with nothing to send (null) is fine', async () => {
      mockGiftsService.fulfillGift.mockResolvedValueOnce(null);
      await expect(service.handleEvent(payment('evt_gn', 'cs_gn', { type: 'gift' }) as any)).resolves.toBeUndefined();
    });

    it('a post-commit notification failure is logged, not thrown (the event stays recorded)', async () => {
      const logError = jest.spyOn((service as any).logger, 'error').mockImplementation(() => undefined);
      mockGiftsService.fulfillGift.mockResolvedValueOnce(async () => { throw new Error('smtp down'); });
      await service.handleEvent(payment('evt_ge', 'cs_ge', { type: 'gift', recipientEmail: 'r@test.invalid', tokenCount: '1' }) as any);
      expect(processedStore.has('evt_ge')).toBe(true);
      expect(logError).toHaveBeenCalledWith(expect.stringContaining('smtp down'));
    });

    it('a failure after the session claim rolls back BOTH claims so the retry fulfills', async () => {
      mockSubscriptionsService.issueTokensForPurchasedPackage.mockRejectedValueOnce(new Error('boom'));
      const e = payment('evt_rb', 'cs_rb', { tokenPackageId: 'pkg_1', userId: 'u_1' });
      await expect(service.handleEvent(e as any)).rejects.toThrow('boom');
      expect(processedStore.has('evt_rb')).toBe(false);
      expect(processedStore.has('fulfillment:checkout-session:cs_rb')).toBe(false);
      await service.handleEvent(e as any);
      expect(mockSubscriptionsService.issueTokensForPurchasedPackage).toHaveBeenCalledTimes(2);
    });

    it('a payment session without an id cannot be claimed and grants nothing', async () => {
      await service.handleEvent(makeEvent('checkout.session.completed', { mode: 'payment', metadata: { tokenPackageId: 'p', userId: 'u' } }, 'evt_noid') as any);
      expect(mockSubscriptionsService.issueTokensForPurchasedPackage).not.toHaveBeenCalled();
    });
  });
});
