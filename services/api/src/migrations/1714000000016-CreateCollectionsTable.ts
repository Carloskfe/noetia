import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCollectionsTable1714000000016 implements MigrationInterface {
  name = 'CreateCollectionsTable1714000000016';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "collections" (
        "id"          uuid        NOT NULL DEFAULT uuid_generate_v4(),
        "name"        varchar     NOT NULL,
        "slug"        varchar     NOT NULL,
        "description" text,
        "coverUrl"    varchar,
        "createdAt"   TIMESTAMP   NOT NULL DEFAULT now(),
        CONSTRAINT "PK_collections" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_collections_slug" UNIQUE ("slug")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "book_collections" (
        "id"           uuid  NOT NULL DEFAULT uuid_generate_v4(),
        "bookId"       uuid  NOT NULL REFERENCES "books"("id") ON DELETE CASCADE,
        "collectionId" uuid  NOT NULL REFERENCES "collections"("id") ON DELETE CASCADE,
        "position"     int   NOT NULL DEFAULT 0,
        CONSTRAINT "PK_book_collections" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_book_collections_book_coll" UNIQUE ("bookId", "collectionId")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_book_collections_collectionId" ON "book_collections" ("collectionId", "position")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "book_collections"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "collections"`);
  }
}
