import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * NEM-019 — book AI rights records (ADR-002 default deny; ADR-006; 07 §3).
 * Additive only. Creates an EMPTY table: no rights record for any real book is
 * inserted here or anywhere in this mission (AC-12).
 *
 * One record applies to one exact text version ("textHash"). Only `verified`
 * allows processing, for the listed operations only.
 */
export class CreateBookAiRights1748300000071 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE book_ai_rights (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "bookId" uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
        status varchar(16) NOT NULL DEFAULT 'unknown'
          CHECK (status IN ('unknown', 'pending_review', 'verified', 'rejected', 'revoked', 'expired')),
        "textHash" varchar(128) NOT NULL,
        "workTitle" varchar,
        "workAuthors" text[],
        "authorDeathDate" date,
        "firstPublicationDate" varchar(32),
        edition varchar,
        "editionPublisher" varchar,
        "editionYear" integer,
        "textSource" varchar,
        "isTranslation" boolean,
        translators text[],
        "translatorDeathDate" date,
        "translationDate" varchar(32),
        "addedMaterial" varchar(16) CHECK ("addedMaterial" IN ('none', 'excluded', 'cleared')),
        "sourceUrl" varchar,
        "rightsBasis" varchar(32) CHECK ("rightsBasis" IN ('public_domain', 'rights_holder_opt_in', 'licensed')),
        "rightsEvidence" text,
        jurisdiction varchar(64),
        "permittedOperations" text[] NOT NULL DEFAULT '{}',
        verifier varchar,
        "verifiedAt" timestamptz,
        "evidenceLinks" text[],
        "reviewDate" date,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_book_ai_rights_book_text" UNIQUE ("bookId", "textHash")
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS book_ai_rights`);
  }
}
