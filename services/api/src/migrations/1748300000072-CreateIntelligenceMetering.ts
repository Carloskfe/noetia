import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * NEM-019 — AI resource-budget metering (ADR-005 B-1, B-5). Additive only.
 *
 * - ai_budget_policies: keyed by tier AND capability (PO-028 rule 4). No row is
 *   seeded: budget values exist only as marked test fixtures (TT-09, TT-11 open).
 * - ai_rate_cards: versioned unit → micro-USD cost cards. No row is seeded.
 * - ai_budget_ledger: the ONLY budget authority. Append-only. One reservation,
 *   one resolution (settlement or release), and one expiry flag per
 *   idempotency key, enforced by partial unique indexes, so a replay can never charge twice.
 *   Corrections are separate compensating entries.
 * - ai_usage_events: the Gateway's durable usage record, one per idempotency key.
 *
 * Usage and budget rows cascade from users(id) and hold no content (B-2).
 */
export class CreateIntelligenceMetering1748300000072 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE ai_budget_policies (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tier varchar(32) NOT NULL CHECK (tier IN ('noetia_plus', 'noetia_x')),
        capability varchar(64) NOT NULL,
        version integer NOT NULL CHECK (version >= 1),
        "allowanceUnits" bigint NOT NULL CHECK ("allowanceUnits" >= 0),
        "periodDays" integer NOT NULL CHECK ("periodDays" >= 1),
        "reserveUnitsPerTurn" integer NOT NULL CHECK ("reserveUnitsPerTurn" >= 1),
        "reservationTtlSeconds" integer NOT NULL CHECK ("reservationTtlSeconds" >= 1),
        "maxUnresolvedUnits" bigint NOT NULL CHECK ("maxUnresolvedUnits" >= 0),
        "maxUnresolvedAgeSeconds" integer NOT NULL CHECK ("maxUnresolvedAgeSeconds" >= 1),
        "isTestFixture" boolean NOT NULL DEFAULT false,
        active boolean NOT NULL DEFAULT true,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_ai_budget_policies_tier_cap_version" UNIQUE (tier, capability, version)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE ai_rate_cards (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        provider varchar(64) NOT NULL,
        "modelKey" varchar(64) NOT NULL,
        version integer NOT NULL CHECK (version >= 1),
        "microUsdPerUnit" bigint NOT NULL CHECK ("microUsdPerUnit" >= 0),
        "isTestFixture" boolean NOT NULL DEFAULT false,
        active boolean NOT NULL DEFAULT true,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_ai_rate_cards_provider_model_version" UNIQUE (provider, "modelKey", version)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE ai_budget_ledger (
        id bigserial PRIMARY KEY,
        "userId" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "sessionId" uuid REFERENCES ai_conversations(id) ON DELETE SET NULL,
        "policyId" uuid REFERENCES ai_budget_policies(id) ON DELETE SET NULL,
        tier varchar(32) NOT NULL,
        capability varchar(64) NOT NULL,
        "idempotencyKey" varchar(128) NOT NULL,
        "entryType" varchar(16) NOT NULL
          CHECK ("entryType" IN ('reservation', 'settlement', 'release', 'expired_flag', 'compensation')),
        units bigint NOT NULL,
        "costMicroUsd" bigint,
        "rateCardId" uuid REFERENCES ai_rate_cards(id) ON DELETE SET NULL,
        "expiresAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    // One reservation, ONE resolution (settlement or release), and one expiry
    // flag per key. A replay, retry, or race can never charge twice.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_ai_budget_ledger_reservation"
        ON ai_budget_ledger ("idempotencyKey") WHERE "entryType" = 'reservation'
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_ai_budget_ledger_resolution"
        ON ai_budget_ledger ("idempotencyKey") WHERE "entryType" IN ('settlement', 'release')
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_ai_budget_ledger_expired_flag"
        ON ai_budget_ledger ("idempotencyKey") WHERE "entryType" = 'expired_flag'
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_ai_budget_ledger_user_cap" ON ai_budget_ledger ("userId", capability, "createdAt")`,
    );

    await queryRunner.query(`
      CREATE TABLE ai_usage_events (
        id bigserial PRIMARY KEY,
        "userId" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "sessionId" uuid REFERENCES ai_conversations(id) ON DELETE SET NULL,
        capability varchar(64) NOT NULL,
        "idempotencyKey" varchar(128) NOT NULL,
        provider varchar(64) NOT NULL,
        "modelKey" varchar(64),
        outcome varchar(16) NOT NULL CHECK (outcome IN ('success', 'failure', 'timeout', 'aborted')),
        "unitsReported" bigint,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_ai_usage_events_key" UNIQUE ("idempotencyKey")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_ai_usage_events_userId" ON ai_usage_events ("userId")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS ai_usage_events`);
    await queryRunner.query(`DROP TABLE IF EXISTS ai_budget_ledger`);
    await queryRunner.query(`DROP TABLE IF EXISTS ai_rate_cards`);
    await queryRunner.query(`DROP TABLE IF EXISTS ai_budget_policies`);
  }
}
