import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUiLanguage1714000000044 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "uiLanguage" VARCHAR(5) NOT NULL DEFAULT 'es'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "uiLanguage"`);
  }
}
