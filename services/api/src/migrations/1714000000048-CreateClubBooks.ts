import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateClubBooks1714000000048 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "club_books" (
        "id"          UUID        NOT NULL DEFAULT gen_random_uuid(),
        "clubId"      UUID        NOT NULL REFERENCES "clubs"("id") ON DELETE CASCADE,
        "bookId"      UUID        NOT NULL REFERENCES "books"("id") ON DELETE CASCADE,
        "status"      VARCHAR(20) NOT NULL DEFAULT 'active',
        "addedById"   UUID        NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "startedAt"   TIMESTAMPTZ,
        "completedAt" TIMESTAMPTZ,
        "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_club_books" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_club_books_club_book" UNIQUE ("clubId", "bookId"),
        CONSTRAINT "CHK_club_books_status" CHECK ("status" IN ('active', 'completed', 'queued'))
      )
    `);

    await queryRunner.query(`CREATE INDEX "idx_club_books_clubId" ON "club_books"("clubId")`);
    await queryRunner.query(`CREATE INDEX "idx_club_books_status" ON "club_books"("clubId", "status")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "club_books"`);
  }
}
