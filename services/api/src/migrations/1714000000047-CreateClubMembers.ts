import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateClubMembers1714000000047 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "club_members" (
        "id"                   UUID        NOT NULL DEFAULT gen_random_uuid(),
        "clubId"               UUID        NOT NULL REFERENCES "clubs"("id") ON DELETE CASCADE,
        "userId"               UUID        NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "role"                 VARCHAR(20) NOT NULL DEFAULT 'member',
        "status"               VARCHAR(20) NOT NULL DEFAULT 'active',
        "bannedAt"             TIMESTAMPTZ,
        "bannedById"           UUID        REFERENCES "users"("id") ON DELETE SET NULL,
        "notifNearbyComment"   BOOLEAN     NOT NULL DEFAULT true,
        "notifNewBook"         BOOLEAN     NOT NULL DEFAULT true,
        "notifMilestone"       BOOLEAN     NOT NULL DEFAULT true,
        "notifSession"         BOOLEAN     NOT NULL DEFAULT true,
        "notifConfigured"      BOOLEAN     NOT NULL DEFAULT false,
        "joinedAt"             TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_club_members" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_club_members_club_user" UNIQUE ("clubId", "userId"),
        CONSTRAINT "CHK_club_members_role"   CHECK ("role"   IN ('admin', 'moderator', 'member')),
        CONSTRAINT "CHK_club_members_status" CHECK ("status" IN ('active', 'banned'))
      )
    `);

    await queryRunner.query(`CREATE INDEX "idx_club_members_clubId"  ON "club_members"("clubId")`);
    await queryRunner.query(`CREATE INDEX "idx_club_members_userId"  ON "club_members"("userId")`);
    await queryRunner.query(`CREATE INDEX "idx_club_members_status"  ON "club_members"("status")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "club_members"`);
  }
}
