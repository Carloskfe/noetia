import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateGiftCards1714000000043 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "gift_cards" (
        "id"                UUID         NOT NULL DEFAULT gen_random_uuid(),
        "buyerUserId"       UUID,
        "buyerEmail"        VARCHAR(255),
        "recipientEmail"    VARCHAR(255) NOT NULL,
        "message"           TEXT,
        "occasion"          VARCHAR(50),
        "tokenCount"        INT          NOT NULL,
        "claimToken"        VARCHAR(64)  NOT NULL,
        "status"            VARCHAR(20)  NOT NULL DEFAULT 'sent',
        "claimedByUserId"   UUID,
        "claimedAt"         TIMESTAMPTZ,
        "expiresAt"         TIMESTAMPTZ  NOT NULL,
        "stripeSessionId"   VARCHAR(255) NOT NULL,
        "createdAt"         TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT "PK_gift_cards" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_gift_cards_claimToken" UNIQUE ("claimToken")
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_gift_cards_claimToken" ON "gift_cards"("claimToken")`);
    await queryRunner.query(`CREATE INDEX "idx_gift_cards_recipientEmail" ON "gift_cards"("recipientEmail")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "gift_cards"`);
  }
}
