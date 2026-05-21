import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateClubDiscussions1714000000050 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "club_discussions" (
        "id"          UUID        NOT NULL DEFAULT gen_random_uuid(),
        "clubId"      UUID        NOT NULL REFERENCES "clubs"("id") ON DELETE CASCADE,
        "bookId"      UUID        NOT NULL REFERENCES "books"("id") ON DELETE CASCADE,
        "userId"      UUID        NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "phraseIndex" INT         NOT NULL,
        "content"     TEXT        NOT NULL,
        "deletedAt"   TIMESTAMPTZ,
        "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_club_discussions" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`CREATE INDEX "idx_club_discussions_phrase" ON "club_discussions"("clubId", "bookId", "phraseIndex")`);
    await queryRunner.query(`CREATE INDEX "idx_club_discussions_userId" ON "club_discussions"("userId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "club_discussions"`);
  }
}
