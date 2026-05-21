import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateClubSessions1714000000052 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "club_sessions" (
        "id"               UUID         NOT NULL DEFAULT gen_random_uuid(),
        "clubId"           UUID         NOT NULL REFERENCES "clubs"("id") ON DELETE CASCADE,
        "bookId"           UUID         NOT NULL REFERENCES "books"("id") ON DELETE CASCADE,
        "hostId"           UUID         NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "title"            VARCHAR(150) NOT NULL,
        "status"           VARCHAR(20)  NOT NULL DEFAULT 'scheduled',
        "scheduledAt"      TIMESTAMPTZ  NOT NULL,
        "startPhraseIndex" INT          NOT NULL,
        "endPhraseIndex"   INT          NOT NULL,
        "startedAt"        TIMESTAMPTZ,
        "completedAt"      TIMESTAMPTZ,
        "createdAt"        TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT "PK_club_sessions" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_club_sessions_status" CHECK ("status" IN ('scheduled', 'live', 'completed', 'cancelled')),
        CONSTRAINT "CHK_club_sessions_phrase_range" CHECK ("endPhraseIndex" > "startPhraseIndex")
      )
    `);

    await queryRunner.query(`CREATE INDEX "idx_club_sessions_clubId"      ON "club_sessions"("clubId")`);
    await queryRunner.query(`CREATE INDEX "idx_club_sessions_scheduledAt" ON "club_sessions"("scheduledAt")`);
    await queryRunner.query(`CREATE INDEX "idx_club_sessions_status"      ON "club_sessions"("clubId", "status")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "club_sessions"`);
  }
}
