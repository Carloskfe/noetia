import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReadingGoals1748100000055 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "goalWeeklyMinutes" integer,
        ADD COLUMN IF NOT EXISTS "goalWeeklyBooks"   integer
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN IF EXISTS "goalWeeklyMinutes",
        DROP COLUMN IF EXISTS "goalWeeklyBooks"
    `);
  }
}
