import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSubscriptionInvites1714000000042 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "subscription_invites" (
        "id"              UUID         NOT NULL DEFAULT gen_random_uuid(),
        "subscriptionId"  UUID         NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
        "invitedEmail"    VARCHAR(255) NOT NULL,
        "token"           VARCHAR(64)  NOT NULL,
        "status"          VARCHAR(20)  NOT NULL DEFAULT 'pending',
        "expiresAt"       TIMESTAMPTZ  NOT NULL,
        "createdAt"       TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT "PK_subscription_invites" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_subscription_invites_token" UNIQUE ("token")
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_subscription_invites_token" ON "subscription_invites"("token")`);
    await queryRunner.query(`CREATE INDEX "idx_subscription_invites_sub" ON "subscription_invites"("subscriptionId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "subscription_invites"`);
  }
}
