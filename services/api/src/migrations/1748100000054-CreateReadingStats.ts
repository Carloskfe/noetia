import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateReadingStats1748100000054 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "reading_stats" (
        "id"           uuid    NOT NULL DEFAULT uuid_generate_v4(),
        "userId"       uuid    NOT NULL,
        "date"         date    NOT NULL,
        "minutesRead"  integer NOT NULL DEFAULT 0,
        "phrasesRead"  integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_reading_stats" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_reading_stats_user_date" UNIQUE ("userId", "date"),
        CONSTRAINT "FK_reading_stats_user" FOREIGN KEY ("userId")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_reading_stats_user_date"
        ON "reading_stats" ("userId", "date")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "reading_stats"`);
  }
}
