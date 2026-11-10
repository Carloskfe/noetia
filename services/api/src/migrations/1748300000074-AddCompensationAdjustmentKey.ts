import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * NEM-021 Phase 2, review finding F-8: durable idempotency for cost-ledger compensations. ADDITIVE ONLY.
 *
 * A compensation is a deliberate, signed correction (§9.1), and several distinct corrections per attempt are
 * legitimate. Each one therefore carries a caller-supplied `adjustmentKey` (e.g. the provider-invoice correction
 * reference). A retry or concurrent duplicate of the same adjustment hits the partial unique index and is a no-op;
 * a different adjustment key is a new, separate entry.
 *
 * - New nullable column `adjustmentKey` on ai_budget_ledger (legacy rows keep NULL).
 * - Partial unique index on (idempotencyKey, adjustmentKey) for compensation rows that carry a key.
 * - CHECK: every compensation with a micro-USD amount (only the cost ledger writes those) must carry a key.
 *   NEM-019's units-only compensations (compensatedMicroUsd NULL) are unaffected.
 *
 * No NEM-019 column, constraint, or index is altered; no row is written.
 */
export class AddCompensationAdjustmentKey1748300000074 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE ai_budget_ledger ADD COLUMN "adjustmentKey" varchar(128)`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_ai_budget_ledger_adjustment"
        ON ai_budget_ledger ("idempotencyKey", "adjustmentKey")
        WHERE "entryType" = 'compensation' AND "adjustmentKey" IS NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE ai_budget_ledger ADD CONSTRAINT "CK_ai_budget_ledger_cost_compensation_key"
        CHECK ("entryType" <> 'compensation' OR "compensatedMicroUsd" IS NULL OR "adjustmentKey" IS NOT NULL)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE ai_budget_ledger DROP CONSTRAINT IF EXISTS "CK_ai_budget_ledger_cost_compensation_key"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_ai_budget_ledger_adjustment"`);
    await queryRunner.query(`ALTER TABLE ai_budget_ledger DROP COLUMN IF EXISTS "adjustmentKey"`);
  }
}
