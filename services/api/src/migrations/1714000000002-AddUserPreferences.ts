import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserPreferences1714000000002 implements MigrationInterface {
  name = 'AddUserPreferences1714000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "country" CHARACTER VARYING`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "languages" TEXT`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "interests" TEXT`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "interests"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "languages"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "country"`);
  }
}
