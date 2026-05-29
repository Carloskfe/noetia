import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSyncCoverage1748200000056 implements MigrationInterface {
  name = 'AddSyncCoverage1748200000056';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`ALTER TABLE sync_maps ADD COLUMN IF NOT EXISTS "syncCoverage" float DEFAULT NULL`);
    await runner.query(`ALTER TABLE sync_maps ADD COLUMN IF NOT EXISTS "syncExceptions" integer DEFAULT NULL`);
    await runner.query(`ALTER TABLE sync_maps ADD COLUMN IF NOT EXISTS "syncAvgConfidence" float DEFAULT NULL`);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`ALTER TABLE sync_maps DROP COLUMN IF EXISTS "syncAvgConfidence"`);
    await runner.query(`ALTER TABLE sync_maps DROP COLUMN IF EXISTS "syncExceptions"`);
    await runner.query(`ALTER TABLE sync_maps DROP COLUMN IF EXISTS "syncCoverage"`);
  }
}
