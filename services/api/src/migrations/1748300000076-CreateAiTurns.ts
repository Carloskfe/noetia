import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * NEM-024 Checkpoint A: the research-turn record (conversation record only; the NEM-021 ledger remains the sole
 * authority for reservations and settlement). ADDITIVE ONLY.
 *
 * - `status`: `accepted` (provisional) · `completed` · `failed` · `cancelled` · `interrupted` (terminal; never changed).
 * - `fenceAt` (database time): owner/cancel transitions must START before it; finalization may start at or after it
 *   (F-6, F-7). Finalization itself is Checkpoint B.
 * - UNIQUE (`sessionId`, `keyHash`): at most one record per turn key.
 * - Partial UNIQUE (`sessionId`) WHERE `status = 'accepted'`: at most one provisional turn per session.
 * - Amendment 1 (B-2): a terminal `failed` record may exist without a lock (`turnIndex` NULL), with the step-4 denial
 *   in `failureReason` and the observed `reservationRelease` (`released` | `unconfirmed`).
 * - `segments` stores generated text plus citation refs and anchors only — never excerpt or verbatim book text (S2).
 * - Cascades from `ai_conversations` (which cascades from `users`), so account deletion is never blocked (ADR-005 B-2).
 *
 * No existing table, column, constraint, or index is altered; no row is written.
 */
export class CreateAiTurns1748300000076 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE ai_turns (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "sessionId" uuid NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
        "turnIndex" integer,
        "keyHash" varchar(80) NOT NULL,
        question text NOT NULL,
        status varchar(16) NOT NULL,
        "failureReason" varchar(40),
        "reservationRelease" varchar(16),
        segments jsonb,
        exclusions jsonb,
        settlement varchar(24),
        "attemptToken" uuid NOT NULL,
        "fenceAt" timestamptz NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT statement_timestamp(),
        "completedAt" timestamptz,
        CONSTRAINT "UQ_ai_turns_session_key" UNIQUE ("sessionId", "keyHash"),
        CONSTRAINT "CK_ai_turns_status" CHECK (status IN ('accepted', 'completed', 'failed', 'cancelled', 'interrupted')),
        CONSTRAINT "CK_ai_turns_question" CHECK (char_length(question) BETWEEN 1 AND 500),
        CONSTRAINT "CK_ai_turns_release" CHECK ("reservationRelease" IS NULL OR "reservationRelease" IN ('released', 'unconfirmed')),
        CONSTRAINT "CK_ai_turns_turn_index" CHECK ("turnIndex" IS NULL OR "turnIndex" >= 1),
        CONSTRAINT "CK_ai_turns_completed" CHECK (status <> 'completed' OR (segments IS NOT NULL AND "completedAt" IS NOT NULL AND "turnIndex" IS NOT NULL))
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_ai_turns_one_provisional" ON ai_turns ("sessionId") WHERE status = 'accepted'`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS ai_turns`);
  }
}
