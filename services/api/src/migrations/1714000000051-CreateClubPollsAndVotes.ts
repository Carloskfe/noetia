import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateClubPollsAndVotes1714000000051 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "club_polls" (
        "id"             UUID        NOT NULL DEFAULT gen_random_uuid(),
        "clubId"         UUID        NOT NULL REFERENCES "clubs"("id") ON DELETE CASCADE,
        "createdById"    UUID        NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "question"       VARCHAR(255) NOT NULL,
        "status"         VARCHAR(20)  NOT NULL DEFAULT 'open',
        "closesAt"       TIMESTAMPTZ  NOT NULL,
        "winnerOptionId" UUID,
        "createdAt"      TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT "PK_club_polls" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_club_polls_status" CHECK ("status" IN ('open', 'closed'))
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "club_poll_options" (
        "id"        UUID        NOT NULL DEFAULT gen_random_uuid(),
        "pollId"    UUID        NOT NULL REFERENCES "club_polls"("id") ON DELETE CASCADE,
        "bookId"    UUID        NOT NULL REFERENCES "books"("id") ON DELETE CASCADE,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_club_poll_options" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_club_poll_options_poll_book" UNIQUE ("pollId", "bookId")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "club_polls"
        ADD CONSTRAINT "FK_club_polls_winnerOption"
          FOREIGN KEY ("winnerOptionId") REFERENCES "club_poll_options"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      CREATE TABLE "club_poll_votes" (
        "id"       UUID        NOT NULL DEFAULT gen_random_uuid(),
        "pollId"   UUID        NOT NULL REFERENCES "club_polls"("id") ON DELETE CASCADE,
        "optionId" UUID        NOT NULL REFERENCES "club_poll_options"("id") ON DELETE CASCADE,
        "userId"   UUID        NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_club_poll_votes" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_club_poll_votes_poll_user" UNIQUE ("pollId", "userId")
      )
    `);

    await queryRunner.query(`CREATE INDEX "idx_club_polls_clubId"      ON "club_polls"("clubId")`);
    await queryRunner.query(`CREATE INDEX "idx_club_poll_options_poll" ON "club_poll_options"("pollId")`);
    await queryRunner.query(`CREATE INDEX "idx_club_poll_votes_poll"   ON "club_poll_votes"("pollId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "club_poll_votes"`);
    await queryRunner.query(`ALTER TABLE "club_polls" DROP CONSTRAINT IF EXISTS "FK_club_polls_winnerOption"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "club_poll_options"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "club_polls"`);
  }
}
