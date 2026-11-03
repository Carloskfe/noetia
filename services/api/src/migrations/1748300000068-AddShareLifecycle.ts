import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * NEM-016 (SA-001 Stage 0) — share lifecycle, de-duplication, quote provenance
 * and the card-image deletion outbox.
 *
 * Additive only: three nullable columns on `shares`, two indexes and one new
 * table. Existing rows are not modified (no backfill).
 *
 * Locking: ADD COLUMN (nullable, no default) is a catalog-only change but takes
 * a brief ACCESS EXCLUSIVE lock; the index builds hold a SHARE lock (writes to
 * `shares` wait) for the build. `lock_timeout` makes the migration fail fast —
 * and roll back entirely — instead of queueing behind a long query and stalling
 * other requests.
 *
 * `down` refuses to run while revoked shares or queued image deletions exist:
 * dropping them would re-publish withdrawn content or forget public images.
 */
export class AddShareLifecycle1748300000068 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`SET LOCAL lock_timeout = '10s'`);
    await queryRunner.query(`ALTER TABLE shares ADD COLUMN IF NOT EXISTS "revokedAt" timestamptz`);
    await queryRunner.query(`ALTER TABLE shares ADD COLUMN IF NOT EXISTS "configHash" varchar(64)`);
    await queryRunner.query(`ALTER TABLE shares ADD COLUMN IF NOT EXISTS "quoteProvenance" jsonb`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_shares_createdById" ON shares ("createdById")`,
    );
    // One live share per creator + card configuration. Partial, so revoked rows
    // and pre-068 rows (configHash NULL) never conflict.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_shares_creator_config_live"
        ON shares ("createdById", "configHash")
        WHERE "revokedAt" IS NULL AND "configHash" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS card_image_deletions (
        "key"           varchar(64) PRIMARY KEY,
        "createdAt"     timestamptz NOT NULL DEFAULT now(),
        "attempts"      integer     NOT NULL DEFAULT 0,
        "lastAttemptAt" timestamptz,
        "lastError"     varchar(64)
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const [{ revoked }] = await queryRunner.query(
      `SELECT COUNT(*)::int AS revoked FROM shares WHERE "revokedAt" IS NOT NULL`,
    );
    const [{ pending }] = await queryRunner.query(
      `SELECT COUNT(*)::int AS pending FROM card_image_deletions`,
    );
    if (revoked > 0 || pending > 0) {
      throw new Error(
        `Refusing to roll back 068: ${revoked} revoked share(s) would become public again and ` +
          `${pending} queued card-image deletion(s) would be forgotten. ` +
          'Resolve them first (Product Owner decision).',
      );
    }
    await queryRunner.query(`DROP TABLE IF EXISTS card_image_deletions`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_shares_creator_config_live"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_shares_createdById"`);
    await queryRunner.query(`ALTER TABLE shares DROP COLUMN IF EXISTS "quoteProvenance"`);
    await queryRunner.query(`ALTER TABLE shares DROP COLUMN IF EXISTS "configHash"`);
    await queryRunner.query(`ALTER TABLE shares DROP COLUMN IF EXISTS "revokedAt"`);
  }
}
