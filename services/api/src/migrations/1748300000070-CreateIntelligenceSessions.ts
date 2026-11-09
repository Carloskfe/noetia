import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * NEM-019 — research sessions (ADR-006). Additive only.
 *
 * - ai_conversations: one row per research session. Cascades from users(id) so
 *   account deletion is never blocked (B-2). Fork lineage uses SET NULL so a
 *   parent can be removed without blocking anything.
 * - ai_session_books: the normalized selected-book set. Unique per session and
 *   book, and per session and position; position ceiling 1–10 (the highest
 *   approved limit). The book reference is ON DELETE SET NULL with a metadata
 *   snapshot, so deleting a book never fails and history stays readable.
 */
export class CreateIntelligenceSessions1748300000070 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE ai_conversations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "parentId" uuid REFERENCES ai_conversations(id) ON DELETE SET NULL,
        "contextParentId" uuid REFERENCES ai_conversations(id) ON DELETE SET NULL,
        status varchar(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'read_only')),
        "readOnlyReason" varchar(32),
        "tierAtCreation" varchar(32) NOT NULL,
        "policyVersionAtCreation" integer NOT NULL,
        "lockedAt" timestamptz,
        "bookSetHash" varchar(64),
        "turnCount" integer NOT NULL DEFAULT 0,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_ai_conversations_userId" ON ai_conversations ("userId")`);

    await queryRunner.query(`
      CREATE TABLE ai_session_books (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "sessionId" uuid NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
        "bookId" uuid REFERENCES books(id) ON DELETE SET NULL,
        position smallint NOT NULL CHECK (position BETWEEN 1 AND 10),
        "titleSnapshot" varchar NOT NULL,
        "authorSnapshot" varchar NOT NULL,
        "addedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_ai_session_books_session_book" UNIQUE ("sessionId", "bookId"),
        CONSTRAINT "UQ_ai_session_books_session_position" UNIQUE ("sessionId", position)
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_ai_session_books_bookId" ON ai_session_books ("bookId")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS ai_session_books`);
    await queryRunner.query(`DROP TABLE IF EXISTS ai_conversations`);
  }
}
