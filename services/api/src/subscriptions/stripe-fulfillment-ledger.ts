import { EntityManager } from 'typeorm';

/**
 * Durable, exactly-once claims on the existing `stripe_processed_events` table (primary key "eventId"),
 * used INSIDE the transaction that performs the corresponding side effects. No schema change.
 *
 * Two kinds of keys share the primary key:
 *   - a Stripe event id (`evt_…`), claimed once per webhook delivery;
 *   - a fulfillment key (`fulfillment:<kind>:<stripe object id>`, e.g. `fulfillment:invoice-tokens:in_…`),
 *     claimed once per economic fulfillment, so two DIFFERENT events about the same invoice or Checkout
 *     session can never both grant it. The `type` column says which kind a row is.
 *
 * Why this is exactly-once: the INSERT runs in the same transaction as the side effects.
 *   - A concurrent transaction inserting the same key blocks on the uncommitted row until the first one
 *     ends: commit → conflict (nothing returned → the caller skips); rollback → the insert succeeds.
 *   - A crash or a thrown error before COMMIT rolls back the claim together with the side effects, so a
 *     Stripe retry processes the event from scratch (no under- or over-fulfillment).
 *
 * @returns true when this transaction now owns the key; false when it was already claimed (committed).
 */
export async function claimStripeKey(em: EntityManager, key: string, type: string): Promise<boolean> {
  const rows = await em.query(
    `INSERT INTO stripe_processed_events ("eventId", type, "processedAt") VALUES ($1, $2, now())
     ON CONFLICT ("eventId") DO NOTHING RETURNING "eventId"`,
    [key, type],
  );
  return Array.isArray(rows) && rows.length > 0;
}

/** Fulfillment key for one Stripe object (invoice, Checkout session…) — see claimStripeKey. */
export const fulfillmentKey = (kind: 'invoice-tokens' | 'checkout-session', stripeObjectId: string): string =>
  `fulfillment:${kind}:${stripeObjectId}`;

/**
 * Serializes webhook writes to one user's subscription row with a transaction-scoped advisory lock (released
 * on commit/rollback; across API instances; no table). Must be called inside a transaction.
 */
export async function lockSubscriptionIdentity(em: EntityManager, userId: string): Promise<void> {
  await em.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`subscription-identity:${userId}`]);
}
