import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAllowInsights1748300000060 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE users ADD COLUMN allow_insights BOOLEAN NOT NULL DEFAULT TRUE`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS allow_insights`);
  }
}
