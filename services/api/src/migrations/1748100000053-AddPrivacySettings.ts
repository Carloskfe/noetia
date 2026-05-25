import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPrivacySettings1748100000053 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "shareReadingProgress" boolean NOT NULL DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS "shareLibrary"         boolean NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS "shareProfile"         boolean NOT NULL DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS "shareFragments"       boolean NOT NULL DEFAULT FALSE
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN IF EXISTS "shareReadingProgress",
        DROP COLUMN IF EXISTS "shareLibrary",
        DROP COLUMN IF EXISTS "shareProfile",
        DROP COLUMN IF EXISTS "shareFragments"
    `);
  }
}
