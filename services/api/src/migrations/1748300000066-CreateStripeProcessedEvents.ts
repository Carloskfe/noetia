import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Additive: a ledger of fully-processed Stripe webhook events, used to make
 * webhook processing idempotent against Stripe's at-least-once redelivery.
 * No data backfill (historical Stripe events are not required — a never-before-
 * seen event on redelivery is simply processed once). Fully reversible.
 */
export class CreateStripeProcessedEvents1748300000066 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS stripe_processed_events (
        "eventId" varchar PRIMARY KEY,
        type varchar NOT NULL,
        "processedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS stripe_processed_events`);
  }
}
