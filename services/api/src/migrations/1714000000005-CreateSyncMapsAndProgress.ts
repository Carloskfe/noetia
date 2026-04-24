import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSyncMapsAndProgress1714000000005 implements MigrationInterface {
  name = 'CreateSyncMapsAndProgress1714000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "sync_maps" (
        "id"        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "bookId"    UUID NOT NULL REFERENCES "books"("id") ON DELETE CASCADE,
        "phrases"   JSONB NOT NULL DEFAULT '[]',
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "uq_sync_maps_book" UNIQUE ("bookId")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "reading_progress" (
        "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId"      UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "bookId"      UUID NOT NULL REFERENCES "books"("id") ON DELETE CASCADE,
        "phraseIndex" INTEGER NOT NULL DEFAULT 0,
        "updatedAt"   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "uq_reading_progress_user_book" UNIQUE ("userId", "bookId")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "reading_progress"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sync_maps"`);
  }
}
