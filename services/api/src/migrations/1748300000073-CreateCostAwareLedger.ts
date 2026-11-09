import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * NEM-021 Phase 2 — cost-aware ledger (E1). ADDITIVE ONLY: new tables, plus new NULLABLE columns on
 * NEM-019's ai_budget_ledger and ai_usage_events. No NEM-019 constraint, column, or index is altered,
 * and NEM-019's ai_usage_events.outcome CHECK is untouched.
 *
 * - ai_pricing_schemas / ai_unit_weight_schemas: versioned contract-v1 JSON, validated by the contract
 *   validators before insert and again (once, then cached) when loaded. At most one active row each.
 * - ai_global_budget_policies: the global micro-USD allowance and unresolved bound (D14). NO row is seeded;
 *   with no active policy, cost-aware admission denies.
 * - ai_partial_settlements: cumulative partial settlements of still-unresolved attempts (F-4 transition rule).
 * - ai_cost_overruns: append-only CLASSIFICATION records (actual − reserved) for audit, metrics, and the
 *   breaker. Never summed into `committed`: the excess is already inside settled cost (§9.1).
 * - ai_overrun_breakers: one row per pricing schema; open after any overrun, closed only when a reviewed
 *   replacement is activated (review reference recorded).
 *
 * User rows cascade from users(id); every other new FK is SET NULL or CASCADE (B-2). No content, prompt,
 * book text, or PII is stored: usage JSON is the contract's normalized usage (counts and enums only).
 * No fixture or real value is seeded.
 */
export class CreateCostAwareLedger1748300000073 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE ai_pricing_schemas (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "schemaKey" varchar(128) NOT NULL,
        provider varchar(64) NOT NULL,
        "modelKey" varchar(64) NOT NULL,
        version integer NOT NULL CHECK (version >= 1),
        schema jsonb NOT NULL,
        "isTestFixture" boolean NOT NULL,
        active boolean NOT NULL DEFAULT false,
        "expiresAt" timestamptz,
        "activatedAt" timestamptz,
        "activationReviewRef" varchar(256),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_ai_pricing_schemas_provider_model_version" UNIQUE (provider, "modelKey", version)
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_ai_pricing_schemas_one_active"
        ON ai_pricing_schemas (provider, "modelKey") WHERE active
    `);

    await queryRunner.query(`
      CREATE TABLE ai_unit_weight_schemas (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "schemaKey" varchar(128) NOT NULL,
        version integer NOT NULL CHECK (version >= 1),
        schema jsonb NOT NULL,
        "isTestFixture" boolean NOT NULL,
        active boolean NOT NULL DEFAULT false,
        "activatedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_ai_unit_weight_schemas_key_version" UNIQUE ("schemaKey", version)
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_ai_unit_weight_schemas_one_active" ON ai_unit_weight_schemas ((true)) WHERE active`);

    await queryRunner.query(`
      CREATE TABLE ai_global_budget_policies (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        version integer NOT NULL CHECK (version >= 1),
        "periodDays" integer NOT NULL CHECK ("periodDays" >= 1),
        "allowanceMicroUsd" bigint NOT NULL CHECK ("allowanceMicroUsd" >= 0),
        "maxUnresolvedMicroUsd" bigint NOT NULL CHECK ("maxUnresolvedMicroUsd" >= 0),
        "isTestFixture" boolean NOT NULL DEFAULT false,
        active boolean NOT NULL DEFAULT false,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_ai_global_budget_policies_version" UNIQUE (version)
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_ai_global_budget_policies_one_active" ON ai_global_budget_policies ((true)) WHERE active`);

    // New nullable columns on NEM-019's ledger. Existing rows keep NULL (legacy, units-only reservations).
    await queryRunner.query(`
      ALTER TABLE ai_budget_ledger
        ADD COLUMN "reservedMicroUsd" bigint CHECK ("reservedMicroUsd" >= 0),
        ADD COLUMN "settledMicroUsd" bigint CHECK ("settledMicroUsd" >= 0),
        ADD COLUMN "compensatedMicroUsd" bigint,
        ADD COLUMN "pricingSchemaId" uuid REFERENCES ai_pricing_schemas(id) ON DELETE SET NULL,
        ADD COLUMN "unitWeightSchemaId" uuid REFERENCES ai_unit_weight_schemas(id) ON DELETE SET NULL,
        ADD COLUMN "globalPolicyId" uuid REFERENCES ai_global_budget_policies(id) ON DELETE SET NULL,
        ADD COLUMN "attemptNumber" integer CHECK ("attemptNumber" >= 1),
        ADD COLUMN "turnKey" varchar(128),
        ADD COLUMN "pricingModifiers" jsonb,
        ADD COLUMN "noChargeDeclarations" jsonb,
        ADD COLUMN "normalizedUsage" jsonb,
        ADD COLUMN "contractOutcome" varchar(16),
        ADD COLUMN "errorCategory" varchar(32),
        ADD COLUMN "usageCompleteness" varchar(16)
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_ai_budget_ledger_turnKey" ON ai_budget_ledger ("turnKey") WHERE "turnKey" IS NOT NULL`,
    );

    // New nullable columns on NEM-019's usage events (the legacy outcome column keeps its CHECK and
    // receives the mapped legacy value; the §9.3 values live here).
    await queryRunner.query(`
      ALTER TABLE ai_usage_events
        ADD COLUMN "contractOutcome" varchar(16),
        ADD COLUMN "errorCategory" varchar(32),
        ADD COLUMN "usageCompleteness" varchar(16),
        ADD COLUMN "zeroUsageEvidence" varchar(32),
        ADD COLUMN "normalizedUsage" jsonb,
        ADD COLUMN "attemptNumber" integer CHECK ("attemptNumber" >= 1),
        ADD COLUMN "pricingSchemaId" uuid REFERENCES ai_pricing_schemas(id) ON DELETE SET NULL,
        ADD COLUMN "settledMicroUsd" bigint CHECK ("settledMicroUsd" >= 0)
    `);

    await queryRunner.query(`
      CREATE TABLE ai_partial_settlements (
        id bigserial PRIMARY KEY,
        "userId" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "attemptKey" varchar(128) NOT NULL,
        "settledMicroUsd" bigint NOT NULL CHECK ("settledMicroUsd" >= 0),
        units bigint NOT NULL CHECK (units >= 0),
        "normalizedUsage" jsonb NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_ai_partial_settlements_attempt_amount" UNIQUE ("attemptKey", "settledMicroUsd")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_ai_partial_settlements_userId" ON ai_partial_settlements ("userId")`);

    await queryRunner.query(`
      CREATE TABLE ai_cost_overruns (
        id bigserial PRIMARY KEY,
        "userId" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "attemptKey" varchar(128) NOT NULL,
        "pricingSchemaId" uuid REFERENCES ai_pricing_schemas(id) ON DELETE SET NULL,
        "reservedMicroUsd" bigint NOT NULL CHECK ("reservedMicroUsd" >= 0),
        "actualMicroUsd" bigint NOT NULL CHECK ("actualMicroUsd" >= 0),
        "overrunMicroUsd" bigint NOT NULL CHECK ("overrunMicroUsd" > 0),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_ai_cost_overruns_attempt" UNIQUE ("attemptKey"),
        CONSTRAINT "CK_ai_cost_overruns_excess" CHECK ("overrunMicroUsd" = "actualMicroUsd" - "reservedMicroUsd")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_ai_cost_overruns_userId" ON ai_cost_overruns ("userId")`);

    await queryRunner.query(`
      CREATE TABLE ai_overrun_breakers (
        "pricingSchemaId" uuid PRIMARY KEY REFERENCES ai_pricing_schemas(id) ON DELETE CASCADE,
        state varchar(8) NOT NULL CHECK (state IN ('open', 'closed')),
        "openedAt" timestamptz NOT NULL,
        "closedAt" timestamptz,
        "closedByReviewRef" varchar(256),
        "replacementSchemaId" uuid REFERENCES ai_pricing_schemas(id) ON DELETE SET NULL,
        CONSTRAINT "CK_ai_overrun_breakers_state" CHECK (
          (state = 'open' AND "closedAt" IS NULL)
          OR (state = 'closed' AND "closedAt" IS NOT NULL AND "closedByReviewRef" IS NOT NULL))
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS ai_overrun_breakers`);
    await queryRunner.query(`DROP TABLE IF EXISTS ai_cost_overruns`);
    await queryRunner.query(`DROP TABLE IF EXISTS ai_partial_settlements`);
    await queryRunner.query(`
      ALTER TABLE ai_usage_events
        DROP COLUMN IF EXISTS "settledMicroUsd", DROP COLUMN IF EXISTS "pricingSchemaId",
        DROP COLUMN IF EXISTS "attemptNumber", DROP COLUMN IF EXISTS "normalizedUsage",
        DROP COLUMN IF EXISTS "zeroUsageEvidence", DROP COLUMN IF EXISTS "usageCompleteness",
        DROP COLUMN IF EXISTS "errorCategory", DROP COLUMN IF EXISTS "contractOutcome"
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ai_budget_ledger_turnKey"`);
    await queryRunner.query(`
      ALTER TABLE ai_budget_ledger
        DROP COLUMN IF EXISTS "usageCompleteness", DROP COLUMN IF EXISTS "errorCategory",
        DROP COLUMN IF EXISTS "contractOutcome", DROP COLUMN IF EXISTS "normalizedUsage",
        DROP COLUMN IF EXISTS "noChargeDeclarations", DROP COLUMN IF EXISTS "pricingModifiers",
        DROP COLUMN IF EXISTS "turnKey", DROP COLUMN IF EXISTS "attemptNumber",
        DROP COLUMN IF EXISTS "globalPolicyId", DROP COLUMN IF EXISTS "unitWeightSchemaId",
        DROP COLUMN IF EXISTS "pricingSchemaId", DROP COLUMN IF EXISTS "compensatedMicroUsd",
        DROP COLUMN IF EXISTS "settledMicroUsd", DROP COLUMN IF EXISTS "reservedMicroUsd"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS ai_global_budget_policies`);
    await queryRunner.query(`DROP TABLE IF EXISTS ai_unit_weight_schemas`);
    await queryRunner.query(`DROP TABLE IF EXISTS ai_pricing_schemas`);
  }
}
