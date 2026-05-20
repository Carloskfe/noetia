import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePushTokens1714000000045 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "push_tokens" (
        "id"        UUID         NOT NULL DEFAULT gen_random_uuid(),
        "userId"    UUID         NOT NULL,
        "token"     VARCHAR(255) NOT NULL,
        "platform"  VARCHAR(20)  NOT NULL DEFAULT 'unknown',
        "createdAt" TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT "PK_push_tokens" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_push_tokens_user_token" UNIQUE ("userId", "token")
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_push_tokens_userId" ON "push_tokens"("userId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "push_tokens"`);
  }
}
