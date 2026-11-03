import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * NEM-016 (SA-001 Stage 0) — share lifecycle and de-duplication.
 *
 * Additive only: two nullable columns and two indexes. Existing rows are not
 * modified (no backfill), so `up` is safe to run on live data.
 *
 * `down` refuses to run while revoked shares exist: dropping `revokedAt` would
 * silently re-publish content a reader withdrew. Those rows must be handled by
 * an explicit, reviewed decision before rolling back.
 */
export class AddShareLifecycle1748300000068 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE shares ADD COLUMN IF NOT EXISTS "revokedAt" timestamptz`);
    await queryRunner.query(`ALTER TABLE shares ADD COLUMN IF NOT EXISTS "configHash" varchar(64)`);
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
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const [{ count }] = await queryRunner.query(
      `SELECT COUNT(*)::int AS count FROM shares WHERE "revokedAt" IS NOT NULL`,
    );
    if (count > 0) {
      throw new Error(
        `Refusing to roll back 068: ${count} revoked share(s) would become public again. ` +
          'Delete or otherwise resolve them first (Product Owner decision).',
      );
    }
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_shares_creator_config_live"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_shares_createdById"`);
    await queryRunner.query(`ALTER TABLE shares DROP COLUMN IF EXISTS "configHash"`);
    await queryRunner.query(`ALTER TABLE shares DROP COLUMN IF EXISTS "revokedAt"`);
  }
}
