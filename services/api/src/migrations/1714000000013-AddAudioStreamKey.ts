import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAudioStreamKey1714000000013 implements MigrationInterface {
  name = 'AddAudioStreamKey1714000000013';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "books" ADD COLUMN IF NOT EXISTS "audioStreamKey" varchar NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "books" DROP COLUMN IF EXISTS "audioStreamKey"`,
    );
  }
}
