import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBooksTable1714000000004 implements MigrationInterface {
  name = 'CreateBooksTable1714000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isAdmin" BOOLEAN NOT NULL DEFAULT false`);

    await queryRunner.query(`
      CREATE TYPE "book_category_enum" AS ENUM (
        'leadership',
        'personal-development',
        'business'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "books" (
        "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "title"         CHARACTER VARYING NOT NULL,
        "author"        CHARACTER VARYING NOT NULL,
        "isbn"          CHARACTER VARYING,
        "language"      CHARACTER VARYING NOT NULL DEFAULT 'es',
        "category"      "book_category_enum" NOT NULL,
        "description"   TEXT,
        "coverUrl"      CHARACTER VARYING,
        "textFileKey"   CHARACTER VARYING,
        "audioFileKey"  CHARACTER VARYING,
        "isPublished"   BOOLEAN NOT NULL DEFAULT false,
        "createdAt"     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt"     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "books"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "book_category_enum"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "isAdmin"`);
  }
}
