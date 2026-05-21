import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateClubMessages1714000000049 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "club_messages" (
        "id"        UUID        NOT NULL DEFAULT gen_random_uuid(),
        "clubId"    UUID        NOT NULL REFERENCES "clubs"("id") ON DELETE CASCADE,
        "userId"    UUID        NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "content"   TEXT        NOT NULL,
        "deletedAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_club_messages" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`CREATE INDEX "idx_club_messages_clubId"    ON "club_messages"("clubId", "createdAt")`);
    await queryRunner.query(`CREATE INDEX "idx_club_messages_userId"    ON "club_messages"("userId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "club_messages"`);
  }
}
