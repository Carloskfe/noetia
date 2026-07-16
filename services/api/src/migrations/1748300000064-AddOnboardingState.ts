import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOnboardingState1748300000064 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS "onboardingState" jsonb NOT NULL DEFAULT '{"welcome":"not_started","welcomeStep":0,"tours":{}}'::jsonb`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS "onboardingState"`);
  }
}
