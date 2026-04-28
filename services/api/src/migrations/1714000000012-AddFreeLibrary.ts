import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFreeLibrary1714000000012 implements MigrationInterface {
  name = 'AddFreeLibrary1714000000012';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "public"."book_category_enum" ADD VALUE IF NOT EXISTS 'classic'`);
    await queryRunner.query(`ALTER TABLE "books" ADD COLUMN IF NOT EXISTS "isFree" boolean NOT NULL DEFAULT false`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "books" DROP COLUMN IF EXISTS "isFree"`);
    // Note: PostgreSQL does not support removing enum values; 'classic' stays in the type
  }
}
