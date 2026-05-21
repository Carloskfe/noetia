import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateClubs1714000000046 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "clubs" (
        "id"               UUID         NOT NULL DEFAULT gen_random_uuid(),
        "name"             VARCHAR(100) NOT NULL,
        "description"      TEXT,
        "coverUrl"         VARCHAR(500),
        "type"             VARCHAR(20)  NOT NULL DEFAULT 'public',
        "ownerId"          UUID         NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "approvalRequired" BOOLEAN      NOT NULL DEFAULT false,
        "tokenRequired"    BOOLEAN      NOT NULL DEFAULT false,
        "maxMembers"       INT,
        "createdAt"        TIMESTAMPTZ  NOT NULL DEFAULT now(),
        "updatedAt"        TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT "PK_clubs" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_clubs_type" CHECK ("type" IN ('public', 'private', 'author_event'))
      )
    `);

    await queryRunner.query(`CREATE INDEX "idx_clubs_ownerId" ON "clubs"("ownerId")`);
    await queryRunner.query(`CREATE INDEX "idx_clubs_type" ON "clubs"("type")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "clubs"`);
  }
}
