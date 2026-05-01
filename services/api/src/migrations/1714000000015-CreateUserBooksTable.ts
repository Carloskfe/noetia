import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserBooksTable1714000000015 implements MigrationInterface {
  name = 'CreateUserBooksTable1714000000015';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_books" (
        "id"      uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId"  uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "bookId"  uuid NOT NULL REFERENCES "books"("id") ON DELETE CASCADE,
        "addedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_books" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_books_user_book" UNIQUE ("userId", "bookId")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_user_books_userId" ON "user_books" ("userId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "user_books"`);
  }
}
