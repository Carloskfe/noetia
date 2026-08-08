import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Ledger of Stripe webhook events whose business side effects have COMPLETED.
 *
 * Idempotency contract (see webhooks.service.ts): a row is written **only after**
 * an event's processing succeeds. A row's presence therefore means "already
 * fully handled — safe to skip on redelivery". Absence means "not yet completed",
 * so a redelivered event (after a mid-processing failure/crash) is re-processed,
 * preserving Stripe's at-least-once retry. `eventId` is Stripe's globally-unique
 * event id and is the primary key.
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
