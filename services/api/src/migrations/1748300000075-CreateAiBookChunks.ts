import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * NEM-023 (E5 Stage 1) Checkpoint A: lexical book-passage index, storage variant S2. ADDITIVE ONLY.
 *
 * - `unaccent` contrib extension (trusted since PostgreSQL 13: the database owner may create it). D-5.
 * - Text-search configurations `noetia_es`, `noetia_en`, `noetia_simple`: copies of the core `spanish`, `english`, and
 *   `simple` configurations whose word token types run `unaccent` and then the language dictionary (§9.3).
 * - Table `ai_book_chunks`: identity, the X-3 anchor (`textHash` + Unicode code-point offsets), nullable metadata, and
 *   the stored `tsvector`. **No verbatim text column** (S2: the text stays in MinIO). No user column.
 *   `chapterLabel`, `phraseIndexStart`, and `phraseIndexEnd` stay NULL in Stage 1 (Amendment 1, B-2).
 * - One partial GIN index per language. The UNIQUE (bookId, textHash, chunkIndex) index also serves as the btree on
 *   (bookId, textHash) via its leading columns.
 *
 * No existing table, column, constraint, or index is altered; no row is written.
 */
export class CreateAiBookChunks1748300000075 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS unaccent`);
    for (const [name, copy, dict] of [
      ['noetia_es', 'spanish', 'spanish_stem'],
      ['noetia_en', 'english', 'english_stem'],
      ['noetia_simple', 'simple', 'simple'],
    ]) {
      await queryRunner.query(`CREATE TEXT SEARCH CONFIGURATION ${name} (COPY = ${copy})`);
      await queryRunner.query(`ALTER TEXT SEARCH CONFIGURATION ${name} ALTER MAPPING FOR hword, hword_part, word WITH unaccent, ${dict}`);
    }
    await queryRunner.query(`
      CREATE TABLE ai_book_chunks (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "bookId" uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
        "textHash" varchar(80) NOT NULL,
        "chunkIndex" integer NOT NULL,
        "charStart" integer NOT NULL,
        "charEnd" integer NOT NULL,
        "phraseIndexStart" integer,
        "phraseIndexEnd" integer,
        "chapterLabel" varchar(200),
        language varchar(8) NOT NULL,
        tsv tsvector NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_ai_book_chunks_set_index" UNIQUE ("bookId", "textHash", "chunkIndex"),
        CONSTRAINT "CK_ai_book_chunks_offsets" CHECK ("charStart" >= 0 AND "charStart" < "charEnd"),
        CONSTRAINT "CK_ai_book_chunks_index" CHECK ("chunkIndex" >= 0),
        CONSTRAINT "CK_ai_book_chunks_language" CHECK (language IN ('es', 'en', 'simple')),
        CONSTRAINT "CK_ai_book_chunks_hash" CHECK ("textHash" ~ '^sha256:[0-9a-f]{64}$'),
        CONSTRAINT "CK_ai_book_chunks_phrases" CHECK (
          ("phraseIndexStart" IS NULL) = ("phraseIndexEnd" IS NULL)
          AND ("phraseIndexStart" IS NULL OR "phraseIndexStart" <= "phraseIndexEnd"))
      )
    `);
    for (const lang of ['es', 'en', 'simple']) {
      await queryRunner.query(`CREATE INDEX "IDX_ai_book_chunks_tsv_${lang}" ON ai_book_chunks USING gin (tsv) WHERE language = '${lang}'`);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS ai_book_chunks`);
    for (const name of ['noetia_simple', 'noetia_en', 'noetia_es']) {
      await queryRunner.query(`DROP TEXT SEARCH CONFIGURATION IF EXISTS ${name}`);
    }
    // Fails loudly (no CASCADE) if anything outside this migration came to depend on the extension.
    await queryRunner.query(`DROP EXTENSION IF EXISTS unaccent`);
  }
}
