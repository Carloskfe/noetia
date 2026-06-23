import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixAllowInsightsColumnName1748300000061 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE users RENAME COLUMN allow_insights TO "allowInsights"`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE users RENAME COLUMN "allowInsights" TO allow_insights`);
  }
}
