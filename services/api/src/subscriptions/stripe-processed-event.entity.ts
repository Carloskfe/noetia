import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Exactly-once claims for Stripe webhook processing (see stripe-fulfillment-ledger.ts, webhooks.service.ts).
 *
 * A row is INSERTed (ON CONFLICT DO NOTHING) at the START of the webhook transaction and commits only together
 * with that event's side effects; a crash or error rolls it back with them, so Stripe's retry re-processes the
 * event. A committed row therefore means "fully handled — skip".
 *
 * `eventId` (primary key) holds two kinds of keys, distinguished by `type`:
 *   - a Stripe event id (`evt_…`), `type` = the Stripe event type;
 *   - a fulfillment key (`fulfillment:<kind>:<stripe object id>`), `type` = `fulfillment:<kind>` — one per
 *     economic grant (paid invoice, Checkout session, trial start), so different events cannot grant twice.
 * The column keeps its historical name; the migration (066) is deployed and is not edited.
 */
@Entity('stripe_processed_events')
export class StripeProcessedEvent {
  @PrimaryColumn({ type: 'varchar' })
  eventId: string;

  @Column({ type: 'varchar' })
  type: string;

  @Column({ type: 'timestamptz' })
  processedAt: Date;
}
