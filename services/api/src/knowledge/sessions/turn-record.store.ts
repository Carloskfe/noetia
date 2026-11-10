import { randomUUID } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { KNOWLEDGE_CONFIG, KnowledgeConfig } from '../common/knowledge-config';
import { KnowledgeDbService } from '../common/knowledge-db.service';

/**
 * NEM-024 turn record (`ai_turns`). A CONVERSATION record only: reservations, settlement, release, and compensation
 * belong exclusively to the Gateway and the NEM-021 ledger. Nothing here reads or writes ledger tables.
 *
 * Transitions are single-statement transactions whose fence predicate uses `statement_timestamp()` (the statement
 * start; F-7). Uniqueness of the terminal outcome comes from the row lock plus `status = 'accepted'`: under READ
 * COMMITTED a statement that waited for the row re-checks its WHERE clause against the committed version.
 */
export type TurnStatus = 'accepted' | 'completed' | 'failed' | 'cancelled' | 'interrupted';
export type ReservationRelease = 'released' | 'unconfirmed';

export interface StoredCitation {
  ref: string;
  kind: string;
  bookId: string | null;
  /** `textHash:charStart-charEnd`, or null when the position could not be resolved. Never excerpt text (S2). */
  anchor: string | null;
}
export interface StoredSegment {
  origin: string;
  text: string;
  bookId?: string;
  citations: StoredCitation[];
}

export interface TurnRow {
  id: string;
  sessionId: string;
  turnIndex: number | null;
  keyHash: string;
  status: TurnStatus;
  failureReason: string | null;
  reservationRelease: ReservationRelease | null;
  segments: StoredSegment[] | null;
  exclusions: Record<string, string[]> | null;
  settlement: string | null;
  attemptToken: string;
}

export interface HistoryRow extends TurnRow {
  question: string;
  createdAt: Date;
  completedAt: Date | null;
}

/** Grace between the owner's own bound (T_max) and the fence (proposed 30 s; review package Q-12). */
export const FENCE_GRACE_SECONDS = 30;
/** Mirrors the Gateway's per-turn attempt ceiling (metering/attempt-key.ts) without importing metering code. */
const ATTEMPT_CEILING = 99;

/**
 * Seconds from record creation to the fence: T_max (provider timeout × attempts + retry delays + a completion-write
 * budget of two statement timeouts) plus grace. Derived from the active configuration at insert time.
 */
export function fenceSeconds(config: KnowledgeConfig): number {
  const attempts = Math.min(Math.max(config.maxProviderAttempts ?? 1, 1), ATTEMPT_CEILING);
  const tMaxMs = config.providerTimeoutMs * attempts + (config.maxRetryDelayMs ?? 0) * (attempts - 1) + 2 * config.statementTimeoutMs;
  return Math.ceil(tMaxMs / 1000) + FENCE_GRACE_SECONDS;
}

const COLUMNS = `id, "sessionId", "turnIndex", "keyHash", status, "failureReason", "reservationRelease", segments, exclusions, settlement, "attemptToken"`;

/** True for a PostgreSQL unique violation on the named constraint or index. */
export function isUniqueViolation(e: unknown, name: string): boolean {
  const err = e as { code?: string; constraint?: string; driverError?: { code?: string; constraint?: string } };
  const code = err?.driverError?.code ?? err?.code;
  const constraint = err?.driverError?.constraint ?? err?.constraint;
  return code === '23505' && constraint === name;
}

@Injectable()
export class TurnRecordStore {
  constructor(
    private readonly db: KnowledgeDbService,
    @Inject(KNOWLEDGE_CONFIG) private readonly config: KnowledgeConfig,
  ) {}

  async findByKey(sessionId: string, keyHash: string): Promise<TurnRow | null> {
    const [r] = await this.db.query<TurnRow>(`SELECT ${COLUMNS} FROM ai_turns WHERE "sessionId" = $1 AND "keyHash" = $2`, [sessionId, keyHash]);
    return r ?? null;
  }

  async findById(id: string): Promise<TurnRow | null> {
    const [r] = await this.db.query<TurnRow>(`SELECT ${COLUMNS} FROM ai_turns WHERE id = $1`, [id]);
    return r ?? null;
  }

  async findProvisional(sessionId: string): Promise<TurnRow | null> {
    const [r] = await this.db.query<TurnRow>(`SELECT ${COLUMNS} FROM ai_turns WHERE "sessionId" = $1 AND status = 'accepted'`, [sessionId]);
    return r ?? null;
  }

  /**
   * T0 — inside the caller's step-4 lock transaction. Throws a unique violation on `UQ_ai_turns_one_provisional`
   * (another provisional turn in the session) or `UQ_ai_turns_session_key`; the caller's transaction then rolls back.
   */
  async insertAccepted(
    m: EntityManager,
    a: { sessionId: string; keyHash: string; question: string; turnIndex: number },
  ): Promise<{ id: string; attemptToken: string }> {
    const attemptToken = randomUUID();
    const [r] = await m.query(
      `INSERT INTO ai_turns ("sessionId", "turnIndex", "keyHash", question, status, "attemptToken", "fenceAt")
       VALUES ($1, $2, $3, $4, 'accepted', $5, statement_timestamp() + make_interval(secs => $6))
       RETURNING id`,
      [a.sessionId, a.turnIndex, a.keyHash, a.question, attemptToken, fenceSeconds(this.config)],
    );
    return { id: r.id, attemptToken };
  }

  /** T1 — owner completion. Returns true only if this statement committed the transition. */
  async complete(
    id: string,
    attemptToken: string,
    p: { segments: StoredSegment[]; exclusions: Record<string, string[]>; settlement: string },
  ): Promise<boolean> {
    const rows = await this.transition(
      `UPDATE ai_turns SET status = 'completed', segments = $3::jsonb, exclusions = $4::jsonb, settlement = $5,
              "completedAt" = statement_timestamp()
        WHERE id = $1 AND "attemptToken" = $2 AND status = 'accepted' AND statement_timestamp() < "fenceAt"
        RETURNING id`,
      [id, attemptToken, JSON.stringify(p.segments), JSON.stringify(p.exclusions), p.settlement],
    );
    return rows === 1;
  }

  /** T2 — owner failure (provider/validation failure, final eligibility check). True only if committed here. */
  async fail(id: string, attemptToken: string, reason: string, release: ReservationRelease | null = null, exclusions: Record<string, string[]> | null = null): Promise<boolean> {
    const rows = await this.transition(
      `UPDATE ai_turns SET status = 'failed', "failureReason" = $3, "reservationRelease" = $4, exclusions = COALESCE($5::jsonb, exclusions)
        WHERE id = $1 AND "attemptToken" = $2 AND status = 'accepted' AND statement_timestamp() < "fenceAt"
        RETURNING id`,
      [id, attemptToken, reason, release, exclusions === null ? null : JSON.stringify(exclusions)],
    );
    return rows === 1;
  }

  /** T3 — explicit cancel. Eligible only when the statement starts before the fence; never overwrites a terminal state. */
  async cancel(id: string): Promise<boolean> {
    return (await this.transition(
      `UPDATE ai_turns SET status = 'cancelled'
        WHERE id = $1 AND status = 'accepted' AND statement_timestamp() < "fenceAt"
        RETURNING id`,
      [id],
    )) === 1;
  }

  /**
   * T4 — finalization of the given rows (lazy, from a status-returning read). Eligible only when the statement starts
   * at or after the fence. If a pre-fence transition holds a row, this statement waits for its commit and then
   * re-checks `status = 'accepted'` (READ COMMITTED), so it never overwrites a terminal outcome.
   */
  async finalize(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    return this.transition(
      `UPDATE ai_turns SET status = 'interrupted'
        WHERE id = ANY($1::uuid[]) AND status = 'accepted' AND statement_timestamp() >= "fenceAt"
        RETURNING id`,
      [ids],
    );
  }

  /** T4 — the periodic sweep: finalize up to `limit` expired provisional rows. Never touches the ledger. */
  async sweep(limit = 500): Promise<number> {
    return this.transition(
      `UPDATE ai_turns SET status = 'interrupted'
        WHERE id IN (SELECT id FROM ai_turns WHERE status = 'accepted' AND "fenceAt" <= statement_timestamp() ORDER BY "fenceAt" LIMIT $1)
          AND status = 'accepted' AND statement_timestamp() >= "fenceAt"
        RETURNING id`,
      [limit],
    );
  }

  /** History page for one session, newest first (the caller verifies ownership). */
  async listBySession(sessionId: string, limit: number): Promise<HistoryRow[]> {
    return this.db.query<HistoryRow>(
      `SELECT ${COLUMNS}, question, "createdAt", "completedAt" FROM ai_turns WHERE "sessionId" = $1 ORDER BY "createdAt" DESC, id DESC LIMIT $2`,
      [sessionId, limit],
    );
  }

  async findHistoryRow(sessionId: string, id: string): Promise<HistoryRow | null> {
    const [r] = await this.db.query<HistoryRow>(
      `SELECT ${COLUMNS}, question, "createdAt", "completedAt" FROM ai_turns WHERE "sessionId" = $1 AND id = $2`, [sessionId, id]);
    return r ?? null;
  }

  /**
   * Amendment 1 (B-2): a terminal `failed` record after a step-4 failure and the Gateway release. Idempotent
   * (`ON CONFLICT DO NOTHING`; an existing record for the key is kept). Not a research turn: no lock, no turn count,
   * `turnIndex` NULL. Written with no Gateway call, so it can never reserve or charge. Returns the record's id.
   */
  async recordStep4Failure(a: { sessionId: string; keyHash: string; question: string; reason: string; release: ReservationRelease }): Promise<string> {
    const inserted = await this.db.query<{ id: string }>(
      `INSERT INTO ai_turns ("sessionId", "turnIndex", "keyHash", question, status, "failureReason", "reservationRelease", "attemptToken", "fenceAt")
       VALUES ($1, NULL, $2, $3, 'failed', $4, $5, $6, statement_timestamp())
       ON CONFLICT ("sessionId", "keyHash") DO NOTHING
       RETURNING id`,
      [a.sessionId, a.keyHash, a.question, a.reason, a.release, randomUUID()],
    );
    if (inserted[0]) return inserted[0].id;
    const existing = await this.findByKey(a.sessionId, a.keyHash);
    if (!existing) throw new Error('turn record conflict without an existing row');
    return existing.id;
  }

  /**
   * One conditional UPDATE as its own transaction (statement timeout applied by KnowledgeDbService). Wrapped in a
   * CTE so it stays ONE statement (same `statement_timestamp()`) and returns rows rather than the driver's
   * `[rows, rowCount]` tuple for UPDATE commands.
   */
  private async transition(updateSql: string, params: unknown[]): Promise<number> {
    return this.db.transaction(async (m) => {
      const [r] = await m.query(`WITH u AS (${updateSql}) SELECT count(*)::int AS n FROM u`, params);
      return Number(r.n);
    });
  }
}
