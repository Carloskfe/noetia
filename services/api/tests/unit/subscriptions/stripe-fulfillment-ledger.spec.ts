import { claimStripeKey, fulfillmentKey, lockSubscriptionIdentity } from '../../../src/subscriptions/stripe-fulfillment-ledger';

describe('stripe-fulfillment-ledger', () => {
  it('claimStripeKey inserts with ON CONFLICT DO NOTHING RETURNING and reports ownership', async () => {
    const em = { query: jest.fn().mockResolvedValue([{ eventId: 'evt_1' }]) };
    await expect(claimStripeKey(em as any, 'evt_1', 'invoice.paid')).resolves.toBe(true);
    const [sql, params] = em.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO stripe_processed_events/);
    expect(sql).toMatch(/ON CONFLICT \("eventId"\) DO NOTHING RETURNING "eventId"/);
    expect(params).toEqual(['evt_1', 'invoice.paid']);
  });

  it('claimStripeKey returns false when the key was already claimed (no row returned)', async () => {
    const em = { query: jest.fn().mockResolvedValue([]) };
    await expect(claimStripeKey(em as any, 'evt_1', 'x')).resolves.toBe(false);
  });

  it('claimStripeKey treats an unexpected driver result as not claimed (fail safe: no fulfillment)', async () => {
    const em = { query: jest.fn().mockResolvedValue(undefined) };
    await expect(claimStripeKey(em as any, 'evt_1', 'x')).resolves.toBe(false);
  });

  it('claimStripeKey propagates database errors (the transaction rolls back, Stripe retries)', async () => {
    const em = { query: jest.fn().mockRejectedValue(new Error('db down')) };
    await expect(claimStripeKey(em as any, 'evt_1', 'x')).rejects.toThrow('db down');
  });

  it('fulfillmentKey namespaces keys so they never collide with Stripe event ids (evt_…)', () => {
    expect(fulfillmentKey('invoice-tokens', 'in_1')).toBe('fulfillment:invoice-tokens:in_1');
    expect(fulfillmentKey('checkout-session', 'cs_1')).toBe('fulfillment:checkout-session:cs_1');
  });

  it('lockSubscriptionIdentity takes a transaction-scoped advisory lock keyed by user', async () => {
    const em = { query: jest.fn().mockResolvedValue([]) };
    await lockSubscriptionIdentity(em as any, 'u1');
    expect(em.query).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock(hashtext($1))', ['subscription-identity:u1']);
  });
});
