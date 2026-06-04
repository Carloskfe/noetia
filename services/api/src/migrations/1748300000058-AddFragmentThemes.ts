import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFragmentThemes1748300000058 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE fragments ADD COLUMN themes JSONB`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE fragments DROP COLUMN IF EXISTS themes`);
  }
}
