import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeFragmentPhraseIndicesNullable1714000000011 implements MigrationInterface {
  name = 'MakeFragmentPhraseIndicesNullable1714000000011';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "fragments" ALTER COLUMN "startPhraseIndex" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "fragments" ALTER COLUMN "endPhraseIndex" DROP NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE "fragments" SET "startPhraseIndex" = 0 WHERE "startPhraseIndex" IS NULL`);
    await queryRunner.query(`UPDATE "fragments" SET "endPhraseIndex" = 0 WHERE "endPhraseIndex" IS NULL`);
    await queryRunner.query(`ALTER TABLE "fragments" ALTER COLUMN "startPhraseIndex" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "fragments" ALTER COLUMN "endPhraseIndex" SET NOT NULL`);
  }
}
