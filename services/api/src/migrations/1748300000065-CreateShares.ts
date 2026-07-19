import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateShares1748300000065 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS shares (
        id varchar(16) PRIMARY KEY,
        "bookId" uuid NOT NULL,
        "fragmentId" uuid,
        quote text NOT NULL,
        author varchar NOT NULL,
        title varchar NOT NULL,
        citation varchar,
        "imageUrl" varchar NOT NULL,
        platform varchar,
        "createdById" uuid,
        "visitCount" integer NOT NULL DEFAULT 0,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_shares_bookId" ON shares ("bookId")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_shares_bookId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS shares`);
  }
}
