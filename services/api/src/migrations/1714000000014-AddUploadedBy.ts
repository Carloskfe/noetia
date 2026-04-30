import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUploadedBy1714000000014 implements MigrationInterface {
  name = 'AddUploadedBy1714000000014';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "books" ADD COLUMN IF NOT EXISTS "uploadedById" uuid NULL REFERENCES "users"("id") ON DELETE SET NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "books" DROP COLUMN IF EXISTS "uploadedById"`,
    );
  }
}
