import { createHash } from 'crypto';
import { Inject, Injectable, Optional } from '@nestjs/common';
import { IntelligenceDenied } from '../common/intelligence-denied.error';
import { KNOWLEDGE_CONFIG, KnowledgeConfig } from '../common/knowledge-config';
import { KnowledgeDbService } from '../common/knowledge-db.service';
import { AiGatewayService, PreparedCall } from '../ai/gateway/ai-gateway.service';
import { GatewaySegment } from '../ai/gateway/gateway.types';
import { AnswerSegment } from '../ai/model-provider';
import { RESEARCH_OPERATION, RESEARCH_SESSION } from '../knowledge.types';
import { RightsService } from '../rights/rights.service';
import { ContextBuilderService } from './context-builder.service';
import { CONTEXT_SOURCE_PORT, ContextSourcePort } from './context-source.port';
import { bookSetHash, SessionsService } from './sessions.service';
import { DenialReason } from '../knowledge.types';
import { AnchorResolver } from '../retrieval/anchor-resolver';
import { IndexingPermission } from '../retrieval/indexing-permission';
import { QueryContextResult, QueryContextSource } from '../retrieval/query-context-source.service';
import { BookTextPort, decodeUtf8 } from '../retrieval/retrieval.types';
import { computeTextHash } from '../rights/text-hash';
import { TurnCancelRegistry } from './turn-cancel.registry';
import { TurnGuard } from './turn-guard';
import { TurnMetricsService } from './turn-metrics.service';
import { HistoryRow, isUniqueViolation, ReservationRelease, StoredSegment, TurnRecordStore, TurnRow, TurnStatus } from './turn-record.store';
import { TurnStatusDenied, TurnStatusDetail } from './turn-status.error';

export interface TurnResult {
  sessionId: string;
  segments: AnswerSegment[];
  /** Books in the locked set excluded from this turn (disclosed, ADR-006). */
  excludedBookIds: string[];
  settlement: 'settled' | 'held';
  /** NEM-024 (additive; present only on the question path). */
  turnId?: string;
  status?: 'completed';
  /** Per segment index: the segment's citations (refs + anchors; excerpt from this turn's verified passages). */
  citations?: TurnCitation[][];
  exclusions?: TurnExclusions;
  /** D-8(a): the answer could not be recorded; best-effort delivery, not replayable. */
  unrecorded?: true;
  /** True when this result is a same-key replay of a recorded turn. */
  replayed?: true;
}

export interface TurnCitation {
  ref: string;
  kind: string;
  bookId: string | null;
  anchor: string | null;
  /** Verified passage text from this turn's context; null on replay (re-materialization is Checkpoint B). */
  excerpt: string | null;
  /**
   * `available` (excerpt verified now) · `position_unavailable` (anchor unresolved) · `deferred` (not re-materialized:
   * replay, or the weighted guard was full) · `revoked` (user-level rights or index permission withdrawn; D-10: the
   * excerpt is never shown) · `stale` (text version changed) · `unavailable` (object missing or unreadable).
   */
  sourceState: 'available' | 'position_unavailable' | 'deferred' | 'revoked' | 'stale' | 'unavailable';
}

/** NEM-024 Checkpoint C: the capability-probe response. Contains no monetary or provider values. */
export interface CapabilityProbe {
  tier: string;
  capabilities: string[];
  features: { researchTurns: boolean; streaming: boolean; cancellation: boolean; history: boolean };
  limits: { maxBooks: number; questionMaxCodePoints: number; historyPageMax: number };
}

/** NEM-024 Checkpoint B: one turn as returned by the history and single-turn routes (owner only). */
export interface TurnView {
  turnId: string;
  turnIndex: number | null;
  status: TurnStatus;
  question: string;
  createdAt: string;
  completedAt: string | null;
  failureReason: string | null;
  /** Generated answer text (kept pending TT-14); null unless completed. */
  segments: AnswerSegment[] | null;
  /** Source excerpts re-validated against CURRENT eligibility on every read (D-10). */
  citations: TurnCitation[][] | null;
  exclusions: TurnExclusions | null;
  settlement: string | null;
}

/** DI token for the S2 text reader used by history re-materialization (bound by the module to the E5 adapter). */
export const TURN_BOOK_TEXT = Symbol('TURN_BOOK_TEXT');

const ANCHOR = /^(sha256:[0-9a-f]{64}):(\d+)-(\d+)$/;

/** One-pass code-point slicing (local: TurnService may not import retrieval internals beyond its allow-list). */
function sliceCodePoints(text: string, ranges: readonly { start: number; end: number }[]): (string | null)[] {
  const wanted = [...new Set(ranges.flatMap((r) => [r.start, r.end]))].filter((x) => Number.isInteger(x) && x >= 0).sort((a, b) => a - b);
  const at = new Map<number, number>();
  let cp = 0;
  let w = 0;
  let i = 0;
  while (w < wanted.length) {
    while (w < wanted.length && wanted[w] === cp) at.set(wanted[w++], i);
    if (i >= text.length) break;
    const c = text.charCodeAt(i);
    i += c >= 0xd800 && c <= 0xdbff && i + 1 < text.length && (text.charCodeAt(i + 1) & 0xfc00) === 0xdc00 ? 2 : 1;
    cp++;
  }
  return ranges.map((r) => {
    const a = at.get(r.start);
    const b = at.get(r.end);
    return a === undefined || b === undefined || r.start >= r.end ? null : text.slice(a, b);
  });
}

export interface TurnExclusions {
  ineligible: string[];
  unindexed: string[];
  stale: string[];
  unavailable: string[];
  indexNotPermitted: string[];
}

/** NEM-024 Checkpoint C: content-free progress stages reported to the SSE transport (doc 14 names). */
export type TurnStage = 'checking' | 'searching' | 'composing';
export interface TurnRunOptions {
  /** Synchronous, content-free progress callback. Never awaited; a throwing callback never affects the turn. */
  onStage?: (stage: TurnStage) => void;
}

/** NEM-024 Checkpoint C: the probe's question limit, kept equal to the validation below. */
export const TURN_QUESTION_MAX_CODE_POINTS = 500;
/** NEM-024 Checkpoint C: the history page ceiling (`history`). */
export const TURN_HISTORY_PAGE_MAX = 50;

/** NEM-024: question normalization (NFC + trim) and validation (1–500 code points), matching E5. */
export function normalizeTurnQuestion(raw: unknown): string {
  if (typeof raw !== 'string') throw new IntelligenceDenied('invalid_request');
  const q = raw.normalize('NFC').trim();
  const n = [...q].length;
  if (n < 1 || n > TURN_QUESTION_MAX_CODE_POINTS) throw new IntelligenceDenied('invalid_request');
  return q;
}

type StageReporter = (stage: TurnStage) => void;
/** Wraps the transport callback so it can never throw into the turn. */
function stageReporter(cb?: (stage: TurnStage) => void): StageReporter {
  return (st) => {
    try {
      cb?.(st);
    } catch {
      // transport problems never affect the turn (D-9 a)
    }
  };
}

/** Amendment 2 (PO-037): thrown inside the step-4 transaction so PostgreSQL rolls the lock back atomically. */
class CancelledBeforeLockCommit extends Error {}

const DENIAL_CODES = new Set<string>([
  'turn_failed', 'session_read_only', 'set_changed', 'duplicate_turn', 'book_ineligible', 'scope_violation', 'no_eligible_books',
]);
const asDenial = (r: string | null | undefined): DenialReason => (r && DENIAL_CODES.has(r) ? (r as DenialReason) : 'turn_failed');

/** Server-side idempotency key, namespaced so clients cannot collide across users. */
export function turnIdempotencyKey(userId: string, sessionId: string, clientKey: string): string {
  return 'turn:' + createHash('sha256').update(`${userId}:${sessionId}:${clientKey}`).digest('hex');
}

/** The instruction template bound to `research_session.turn`. */
export const TURN_TEMPLATE_ID = 'research_session.turn.v1';

/** Validated Gateway segments in the turn's response shape (a library passage carries its cited book). */
function toAnswerSegment(s: GatewaySegment): AnswerSegment {
  const bookId = s.origin === 'library' ? s.citations.find((c) => c.kind === 'chunk')?.bookId ?? undefined : undefined;
  return bookId ? { origin: s.origin, text: s.text, bookId } : { origin: s.origin, text: s.text };
}

/**
 * Research-session turn stub (model path `research_session.turn`; declared
 * invariant `research_session_context`). Turn order (ADR-006, B-5), unchanged:
 *   1. entitlement → 2. book set, eligibility, Context Builder invariant →
 *   3. reservation (Gateway v2: negotiation, token count, attempt-1 reservation in the cost ledger) →
 *   4. short FOR UPDATE transaction (first-turn lock) →
 *   5. provider call outside any transaction → 6. durable settlement (per attempt, by the Gateway).
 * Failure at 1–3: no lock, no charge. Failure at 4: the attempt is released (or held for reconciliation if the
 * release cannot be written — the cost ledger writes no-provider evidence first); no provider call.
 * Failure at 5–6: the lock stands; settlement is never assumed.
 *
 * NEM-022 (D-2, Option A): one accounting path per turn — the Gateway v2 per-attempt reservation and settlement
 * through the NEM-021 cost ledger. The turn never touches the legacy units-only ledger.
 */
@Injectable()
export class TurnService {
  constructor(
    private readonly db: KnowledgeDbService,
    private readonly sessions: SessionsService,
    private readonly rights: RightsService,
    private readonly contextBuilder: ContextBuilderService,
    private readonly gateway: AiGatewayService,
    @Inject(KNOWLEDGE_CONFIG) private readonly config: KnowledgeConfig,
    @Inject(CONTEXT_SOURCE_PORT) private readonly contextSource: ContextSourcePort,
    // NEM-024 (D-3 A2): optional trailing dependencies; absent → the 3-argument path is exactly the accepted NEM-019/022 turn.
    @Optional() private readonly retrieval?: QueryContextSource,
    @Optional() private readonly indexPermission?: IndexingPermission,
    @Optional() private readonly anchors?: AnchorResolver,
    @Optional() private readonly turnRecords?: TurnRecordStore,
    // NEM-024 Checkpoint B (optional; absent → no guard, no cancel registry, no history re-materialization).
    @Optional() @Inject(TURN_BOOK_TEXT) private readonly bookText?: BookTextPort,
    @Optional() private readonly guard?: TurnGuard,
    @Optional() private readonly cancels?: TurnCancelRegistry,
    @Optional() private readonly turnMetrics?: TurnMetricsService,
  ) {}

  /**
   * NEM-024 (D-3 A3): with `question`, the research turn retrieves eligible book passages, records the turn, and
   * replays by key. Without it, the accepted turn below runs unchanged.
   */
  async run(userId: string, sessionId: string, clientKey: string, question?: string, opts: TurnRunOptions = {}): Promise<TurnResult> {
    if (question !== undefined) return this.runQuestion(userId, sessionId, clientKey, question, stageReporter(opts.onStage));
    // 1. Entitlement and tier policy.
    const r = await this.sessions.resolveOrDeny(userId);

    // 2. Book set and eligibility (preflight: no lock, no charge).
    const ownedRows = await this.db.query<{ status: string }>(
      `SELECT status FROM ai_conversations WHERE id = $1 AND "userId" = $2`,
      [sessionId, userId],
    );
    if (ownedRows.length === 0) throw new IntelligenceDenied('not_found');
    if (ownedRows[0].status === 'read_only') throw new IntelligenceDenied('session_read_only');
    const books = await this.sessions.books(this.db, sessionId);
    if (books.length > r.limits.maxBooks) {
      await this.sessions.markOverLimit(sessionId);
      throw new IntelligenceDenied('session_read_only');
    }
    const preHash = bookSetHash(books);
    const allowed: string[] = [];
    const excluded: string[] = [];
    for (const b of books) {
      if (b.bookId && (await this.rights.eligibility(userId, b.bookId, RESEARCH_OPERATION)).eligible) allowed.push(b.bookId);
      else if (b.bookId) excluded.push(b.bookId);
    }
    if (allowed.length === 0) throw new IntelligenceDenied('no_eligible_books');
    const candidates = await this.contextSource.candidates(userId, sessionId, allowed);
    const context = this.contextBuilder.build(userId, allowed, candidates);

    // 3. Negotiate and reserve attempt 1 (fails closed; throws IntelligenceDenied before any lock).
    const key = turnIdempotencyKey(userId, sessionId, clientKey);
    const prepared = await this.gateway.prepare({
      pathId: ContextBuilderService.PATH,
      context,
      templateId: TURN_TEMPLATE_ID,
      requiredCapabilities: [RESEARCH_SESSION],
      output: { mode: 'text' },
      maxOutputTokens: this.config.turnMaxOutputTokens ?? 1024,
      cacheIntent: { mode: 'none' },
      turnKey: key,
      budget: { userId, tier: r.tier, capability: RESEARCH_SESSION, sessionId },
      nonTokenUnitBounds: { tool_call: this.config.turnMaxToolCalls ?? 0 },
    });

    // 4. Short lock transaction. No provider call inside it.
    let lockOutcome: 'ok' | 'read_only' | 'set_changed';
    try {
      lockOutcome = await this.db.transaction(async (m) => {
        const s = await this.sessions.lockOwned(m, userId, sessionId);
        if (s.status === 'read_only') return 'read_only' as const;
        const current = await this.sessions.books(m, sessionId);
        const hash = bookSetHash(current);
        if (hash !== preHash || (s.bookSetHash && s.bookSetHash !== hash)) return 'set_changed' as const;
        await m.query(
          `UPDATE ai_conversations
              SET "lockedAt" = COALESCE("lockedAt", now()), "bookSetHash" = COALESCE("bookSetHash", $2),
                  "turnCount" = "turnCount" + 1, "updatedAt" = now()
            WHERE id = $1`,
          [sessionId, hash],
        );
        return 'ok' as const;
      });
    } catch {
      await this.releaseOrHold(prepared);
      throw new IntelligenceDenied('turn_failed');
    }
    if (lockOutcome !== 'ok') {
      await this.releaseOrHold(prepared);
      throw new IntelligenceDenied(lockOutcome === 'read_only' ? 'session_read_only' : 'set_changed');
    }

    // 5–6. Provider call outside any transaction (the lock now stands), then durable settlement per attempt:
    // the Gateway settles each attempt from its normalized usage; unknown usage or a ledger outage stays held.
    const result = await this.gateway.invoke(prepared);

    if (result.scopeViolation) throw new IntelligenceDenied('scope_violation'); // metric counted by the Gateway
    if (result.outcome !== 'completed' || result.error !== null) throw new IntelligenceDenied('turn_failed');
    return { sessionId, segments: result.segments.map(toAnswerSegment), excludedBookIds: excluded, settlement: result.settlement };
  }

  /**
   * Step-4 failure: release the never-sent attempt. The cost ledger writes no-provider evidence before the
   * release row, so if the release cannot be written, reconciliation releases it later; if even the evidence
   * cannot be written, the attempt stays held, is flagged on expiry, and is never released to zero automatically.
   */
  private async releaseOrHold(prepared: PreparedCall): Promise<void> {
    try {
      await this.gateway.release(prepared);
    } catch {
      // Held until reconciliation (see above).
    }
  }

  // ── NEM-024 Checkpoint A: the question turn ─────────────────────────────────────────────────────────────────
  //
  // Order (ADR-006 B-5, unchanged): 1 entitlement → 2 set + eligibility + RETRIEVAL + Context Builder (preflight: no
  // lock, no charge) → 3 Gateway prepare/reserve → 4 lock transaction + turn record T0 → 4b FINAL ELIGIBILITY CHECK →
  // 5 provider call → 6 per-attempt settlement (Gateway) → 7 completion T1. The ledger is never read or written here.

  private async runQuestion(userId: string, sessionId: string, clientKey: string, rawQuestion: string, stage: StageReporter): Promise<TurnResult> {
    const { retrieval, indexPermission, anchors, turnRecords } = this;
    if (!retrieval || !indexPermission || !anchors || !turnRecords) throw new IntelligenceDenied('feature_disabled');
    const question = normalizeTurnQuestion(rawQuestion);
    stage('checking');

    // 1. Entitlement and tier policy.
    const r = await this.sessions.resolveOrDeny(userId);

    // 2. Session gate, replay, set, eligibility, retrieval, Context Builder (preflight: no lock, no charge).
    const ownedRows = await this.db.query<{ status: string }>(
      `SELECT status FROM ai_conversations WHERE id = $1 AND "userId" = $2`,
      [sessionId, userId],
    );
    if (ownedRows.length === 0) throw new IntelligenceDenied('not_found');
    const key = turnIdempotencyKey(userId, sessionId, clientKey);
    const existing = await turnRecords.findByKey(sessionId, key);
    if (existing) return this.replay(await this.finalizeIfExpired(existing));
    // Checkpoint B: explicit cancellation of this in-flight turn (a transport disconnect never reaches this registry).
    const signal = this.cancels?.register(key);
    try {
      return await this.executeQuestion(userId, sessionId, key, question, r, ownedRows[0].status, signal, stage);
    } finally {
      if (signal) this.cancels!.unregister(key, signal);
    }
  }

  private async executeQuestion(
    userId: string, sessionId: string, key: string, question: string, r: Awaited<ReturnType<SessionsService['resolveOrDeny']>>,
    sessionStatus: string, signal: AbortSignal | undefined, stage: StageReporter = () => undefined,
  ): Promise<TurnResult> {
    const retrieval = this.retrieval!; // presence checked by runQuestion
    const turnRecords = this.turnRecords!;
    const anchors = this.anchors!;
    const cancelledBeforeReservation = () => new TurnStatusDenied('turn_failed', { status: 'cancelled' });
    if (sessionStatus === 'read_only') throw new IntelligenceDenied('session_read_only');
    const books = await this.sessions.books(this.db, sessionId);
    if (books.length > r.limits.maxBooks) {
      await this.sessions.markOverLimit(sessionId);
      throw new IntelligenceDenied('session_read_only');
    }
    const preHash = bookSetHash(books);
    const allowed: string[] = [];
    const excluded: string[] = [];
    for (const b of books) {
      if (b.bookId && (await this.rights.eligibility(userId, b.bookId, RESEARCH_OPERATION)).eligible) allowed.push(b.bookId);
      else if (b.bookId) excluded.push(b.bookId);
    }
    if (allowed.length === 0) throw new IntelligenceDenied('no_eligible_books');
    if (signal?.aborted) throw cancelledBeforeReservation();
    // Checkpoint B (D-11): weighted admission of the S2 work BEFORE any reservation; no queueing.
    const admitted = this.guard?.tryAcquire(allowed.length);
    if (admitted && !admitted.ok) {
      this.turnMetrics?.guardRejectedInc(admitted.reason);
      throw new TurnStatusDenied('budget_unavailable', { status: 'pending', retryAfterSeconds: 1, guard: admitted.reason });
    }
    stage('searching');
    let retrieved: QueryContextResult;
    const tRetrieval = process.hrtime.bigint();
    try {
      retrieved = await retrieval.resolve(userId, allowed, question);
    } catch {
      throw new IntelligenceDenied('turn_failed'); // before reservation: no lock, no charge, no record
    } finally {
      if (admitted?.ok) admitted.release();
      this.turnMetrics?.observeStage('retrieval', Number(process.hrtime.bigint() - tRetrieval) / 1e9);
    }
    const candidates = await this.contextSource.candidates(userId, sessionId, allowed);
    const context = this.contextBuilder.build(userId, allowed, [...candidates, ...retrieved.items]);
    const exclusions: TurnExclusions = {
      ineligible: excluded, unindexed: retrieved.excluded.unindexed, stale: retrieved.excluded.stale,
      unavailable: retrieved.excluded.unavailable, indexNotPermitted: retrieved.excluded.indexNotPermitted,
    };

    // 3. Negotiate and reserve attempt 1. The ledger's attempt-key uniqueness is the gate against a second reservation.
    if (signal?.aborted) throw cancelledBeforeReservation();
    let prepared: PreparedCall;
    const tPrepare = process.hrtime.bigint();
    try {
      prepared = await this.gateway.prepare({
        pathId: ContextBuilderService.PATH,
        context,
        templateId: TURN_TEMPLATE_ID,
        requiredCapabilities: [RESEARCH_SESSION],
        output: { mode: 'text' },
        maxOutputTokens: this.config.turnMaxOutputTokens ?? 1024,
        cacheIntent: { mode: 'none' },
        turnKey: key,
        budget: { userId, tier: r.tier, capability: RESEARCH_SESSION, sessionId },
        nonTokenUnitBounds: { tool_call: this.config.turnMaxToolCalls ?? 0 },
      });
    } catch (e) {
      if (e instanceof IntelligenceDenied && e.reason === 'duplicate_turn') {
        const row = await turnRecords.findByKey(sessionId, key);
        if (row) return this.replay(await this.finalizeIfExpired(row));
        throw new TurnStatusDenied('duplicate_turn', { status: 'pending' }); // the original is between reserve and lock
      }
      throw e;
    } finally {
      this.turnMetrics?.observeStage('prepare', Number(process.hrtime.bigint() - tPrepare) / 1e9);
    }

    // 4. Short lock transaction: lock, set check, turn count, and the provisional record (T0), atomically.
    type Lock = { outcome: 'ok'; id: string; attemptToken: string } | { outcome: 'session_read_only' | 'set_changed' | 'duplicate_turn' | 'turn_failed' | 'cancelled' };
    let lock: Lock;
    try {
      lock = await this.db.transaction(async (m): Promise<Lock> => {
        const s = await this.sessions.lockOwned(m, userId, sessionId);
        if (s.status === 'read_only') return { outcome: 'session_read_only' };
        const current = await this.sessions.books(m, sessionId);
        const hash = bookSetHash(current);
        if (hash !== preHash || (s.bookSetHash && s.bookSetHash !== hash)) return { outcome: 'set_changed' };
        const [u] = await m.query(
          `WITH u AS (
             UPDATE ai_conversations
                SET "lockedAt" = COALESCE("lockedAt", now()), "bookSetHash" = COALESCE("bookSetHash", $2),
                    "turnCount" = "turnCount" + 1, "updatedAt" = now()
              WHERE id = $1 RETURNING "turnCount")
           SELECT "turnCount" FROM u`,
          [sessionId, hash],
        );
        const rec = await turnRecords.insertAccepted(m, { sessionId, keyHash: key, question, turnIndex: Number(u.turnCount) });
        // Amendment 2 (PO-037) — THE decision point: the last action before COMMIT. An explicit cancel observed here
        // aborts the transaction, so the lock, the turn count, and the provisional row all roll back atomically. A
        // cancel arriving after this check finds the transaction committing and follows the post-lock semantics.
        if (signal?.aborted) throw new CancelledBeforeLockCommit();
        return { outcome: 'ok', ...rec };
      });
    } catch (e) {
      lock = e instanceof CancelledBeforeLockCommit ? { outcome: 'cancelled' }
        : { outcome: isUniqueViolation(e, 'UQ_ai_turns_one_provisional') || isUniqueViolation(e, 'UQ_ai_turns_session_key') ? 'duplicate_turn' : 'turn_failed' };
    }
    if (lock.outcome === 'cancelled') return this.step4Failure(sessionId, key, question, prepared, 'turn_failed', 'cancelled');
    if (lock.outcome !== 'ok') return this.step4Failure(sessionId, key, question, prepared, lock.outcome);
    const { id: turnId, attemptToken } = lock;
    stage('composing'); // synchronous and content-free; emitted before the final eligibility check, never between it and invoke

    // 4b. Final eligibility check (F-3): fresh user-level rights for every allowed book and fresh book-level index
    // permission (same text hash) for every book contributing chunks. Nothing else is awaited between its completion
    // and the provider call.
    const ineligible = await this.finalIneligible(userId, allowed, retrieved);
    if (ineligible.length > 0) {
      const release = await this.releaseObserved(prepared);
      const detail = await this.recordOwnerFailure(turnId, attemptToken, 'book_ineligible', release, { ...exclusions, ineligible: [...exclusions.ineligible, ...ineligible] });
      throw new TurnStatusDenied('book_ineligible', { ...detail, exclusions: { ineligible } });
    }
    // Checkpoint B: an explicit cancel observed before the provider call (synchronous check; nothing awaited between
    // the final eligibility check and invoke on the success path) → release the never-sent attempt, record T3.
    if (signal?.aborted) {
      const release = await this.releaseObserved(prepared);
      throw new TurnStatusDenied('turn_failed', { ...(await this.cancelOwned(turnId)), reservationRelease: release });
    }
    // 5–6. Provider call outside any transaction; the Gateway settles each attempt before releasing any text (F-3).
    const tProvider = process.hrtime.bigint();
    const result = await this.gateway.invoke(prepared, signal ? { signal } : {});
    this.turnMetrics?.observeStage('provider', Number(process.hrtime.bigint() - tProvider) / 1e9);
    if (signal?.aborted && (result.outcome !== 'completed' || result.error !== null)) {
      // Cancelled during the provider attempt: client_abort; usage held by the Gateway/ledger (never released here).
      throw new TurnStatusDenied('turn_failed', await this.cancelOwned(turnId));
    }
    if (result.scopeViolation) {
      throw new TurnStatusDenied('scope_violation', await this.recordOwnerFailure(turnId, attemptToken, 'scope_violation'));
    }
    if (result.outcome !== 'completed' || result.error !== null) {
      throw new TurnStatusDenied('turn_failed', await this.recordOwnerFailure(turnId, attemptToken, 'turn_failed'));
    }

    // 7. Completion (T1). Answer text is released only after this request's own transition is confirmed (G5).
    const passages = new Map(retrieved.passages.map((p) => [p.ref, p.text]));
    const citations: TurnCitation[][] = [];
    const stored: StoredSegment[] = [];
    for (const seg of result.segments) {
      const segCitations: TurnCitation[] = [];
      for (const c of seg.citations) {
        let anchor: string | null = null;
        try {
          anchor = (await anchors.resolve(c.ref))?.anchor ?? null;
        } catch {
          anchor = null;
        }
        const excerpt = c.kind === 'chunk' ? passages.get(c.ref) ?? null : null;
        segCitations.push({ ref: c.ref, kind: c.kind, bookId: c.bookId, anchor, excerpt, sourceState: anchor ? 'available' : 'position_unavailable' });
      }
      citations.push(segCitations);
      const a = toAnswerSegment(seg);
      stored.push({ ...a, citations: segCitations.map(({ ref, kind, bookId, anchor }) => ({ ref, kind, bookId, anchor })) });
    }
    const answer: TurnResult = {
      sessionId, segments: result.segments.map(toAnswerSegment), excludedBookIds: excluded, settlement: result.settlement,
      turnId, status: 'completed', citations, exclusions,
    };
    let outcome: 'committed' | 'lost' | 'error' = 'error';
    for (let i = 0; i < 2 && outcome === 'error'; i++) {
      try {
        outcome = (await turnRecords.complete(turnId, attemptToken, { segments: stored, exclusions: { ...exclusions }, settlement: result.settlement })) ? 'committed' : 'lost';
      } catch {
        outcome = 'error';
      }
    }
    if (outcome === 'committed') return answer;
    let row: TurnRow | null;
    try {
      row = await turnRecords.findById(turnId);
    } catch {
      throw new TurnStatusDenied('turn_failed', { turnId, status: 'unknown' }); // nothing confirmed: no text
    }
    if (row && row.status === 'completed' && row.attemptToken === attemptToken) return answer; // our commit landed
    if (outcome === 'error' && row && row.status === 'accepted') {
      this.turnMetrics?.unrecordedInc();
      return { ...answer, unrecorded: true }; // D-8(a), best effort
    }
    this.turnMetrics?.fencedInc();
    throw this.denialFor(row, turnId); // another terminal outcome won: no text (G5)
  }

  /** Replay of a recorded turn. Never calls the Gateway; never reserves. */
  private replay(row: TurnRow): TurnResult {
    if (row.status === 'completed') {
      const segs = row.segments ?? [];
      return {
        sessionId: row.sessionId,
        segments: segs.map((s) => (s.bookId ? { origin: s.origin as AnswerSegment['origin'], text: s.text, bookId: s.bookId } : { origin: s.origin as AnswerSegment['origin'], text: s.text })),
        excludedBookIds: row.exclusions?.ineligible ?? [],
        settlement: (row.settlement as TurnResult['settlement']) ?? 'held',
        turnId: row.id, status: 'completed', replayed: true,
        citations: segs.map((s) => s.citations.map((c) => ({ ...c, excerpt: null, sourceState: 'deferred' as const }))),
        exclusions: {
          ineligible: row.exclusions?.ineligible ?? [], unindexed: row.exclusions?.unindexed ?? [], stale: row.exclusions?.stale ?? [],
          unavailable: row.exclusions?.unavailable ?? [], indexNotPermitted: row.exclusions?.indexNotPermitted ?? [],
        },
      };
    }
    throw this.denialFor(row, row.id);
  }

  private denialFor(row: TurnRow | null, turnId: string): TurnStatusDenied {
    if (!row) return new TurnStatusDenied('turn_failed', { turnId, status: 'unknown' });
    if (row.status === 'accepted') return new TurnStatusDenied('duplicate_turn', { turnId, status: 'accepted' });
    if (row.status === 'failed') {
      return new TurnStatusDenied(asDenial(row.failureReason), { turnId, status: 'failed', ...(row.reservationRelease ? { reservationRelease: row.reservationRelease } : {}) });
    }
    return new TurnStatusDenied('turn_failed', {
      turnId, status: row.status === 'completed' ? 'unknown' : row.status,
      ...(row.status === 'cancelled' && row.reservationRelease ? { reservationRelease: row.reservationRelease } : {}),
    });
  }

  /**
   * Step-4 failure (Amendment 1, B-2): release the never-sent attempt through the Gateway, then write an idempotent
   * terminal `failed` record (no lock, no turn count, no Gateway call). Release is reported as `released` only when
   * the Gateway call completed without error; otherwise `unconfirmed` (held for NEM-021 reconciliation).
   */
  private async step4Failure(
    sessionId: string, keyHash: string, question: string, prepared: PreparedCall, reason: DenialReason, status: 'failed' | 'cancelled' = 'failed',
  ): Promise<never> {
    const release = await this.releaseObserved(prepared); // never-sent attempt; `released` only when the Gateway confirms
    const detail: TurnStatusDetail = { status, reservationRelease: release, recorded: true };
    try {
      detail.turnId = await this.turnRecords!.recordStep4Failure({
        sessionId, keyHash, question, reason: status === 'cancelled' ? null : reason, release, status,
      });
    } catch {
      detail.recorded = false;
    }
    throw new TurnStatusDenied(reason, detail);
  }

  /** T2 with a conservative status report: `failed` only if this statement committed it; otherwise the stored status. */
  private async recordOwnerFailure(
    turnId: string, attemptToken: string, reason: string, release: ReservationRelease | null = null, exclusions: TurnExclusions | null = null,
  ): Promise<TurnStatusDetail> {
    try {
      if (await this.turnRecords!.fail(turnId, attemptToken, reason, release, exclusions ? { ...exclusions } : null)) {
        return { turnId, status: 'failed', ...(release ? { reservationRelease: release } : {}) };
      }
      const row = await this.turnRecords!.findById(turnId);
      return this.denialFor(row, turnId).detail;
    } catch {
      return { turnId, status: 'unknown' };
    }
  }

  private async finalIneligible(userId: string, allowed: string[], retrieved: QueryContextResult): Promise<string[]> {
    const failed = new Set<string>();
    for (const b of allowed) {
      let ok = false;
      try {
        ok = (await this.rights.eligibility(userId, b, RESEARCH_OPERATION)).eligible;
      } catch {
        ok = false;
      }
      if (!ok) failed.add(b);
    }
    const chunkHashes = new Map<string, string>();
    for (const p of retrieved.passages) chunkHashes.set(p.bookId, p.textHash);
    for (const [b, hash] of chunkHashes) {
      let ok = false;
      try {
        const d = await this.indexPermission!.check(b);
        ok = d.permitted && d.textHash === hash;
      } catch {
        ok = false;
      }
      if (!ok) failed.add(b);
    }
    return [...failed].sort();
  }

  /** Gateway release of a never-sent attempt; never inferred from the ledger. */
  private async releaseObserved(prepared: PreparedCall): Promise<ReservationRelease> {
    try {
      await this.gateway.release(prepared);
      return 'released';
    } catch {
      return 'unconfirmed';
    }
  }

  // ── NEM-024 Checkpoint B: cancellation, lazy finalization, history ──────────────────────────────────────────

  /** T4 lazily for a provisional row, then re-read (G3: never return an expired `accepted` without trying T4). */
  private async finalizeIfExpired<T extends TurnRow>(row: T): Promise<T> {
    if (row.status !== 'accepted') return row;
    const n = await this.turnRecords!.finalize([row.id]);
    this.turnMetrics?.finalizedInc('lazy', n);
    return ((await this.turnRecords!.findById(row.id)) as T | null) ?? row;
  }

  /** T3 by the owner after observing its own cancel signal; reports the committed status. */
  private async cancelOwned(turnId: string): Promise<TurnStatusDetail> {
    try {
      if (await this.turnRecords!.cancel(turnId)) {
        this.turnMetrics?.cancelledInc();
        return { turnId, status: 'cancelled' };
      }
      const row = await this.turnRecords!.findById(turnId);
      return row ? this.denialFor(await this.finalizeIfExpired(row), turnId).detail : { turnId, status: 'unknown' };
    } catch {
      return { turnId, status: 'unknown' };
    }
  }

  private async assertOwned(userId: string, sessionId: string): Promise<void> {
    const rows = await this.db.query(`SELECT 1 FROM ai_conversations WHERE id = $1 AND "userId" = $2`, [sessionId, userId]);
    if (rows.length === 0) throw new IntelligenceDenied('not_found');
  }

  /**
   * Explicit, authenticated cancellation (D-9 a). Signals the in-flight owner (if in this process), lazily finalizes an
   * expired row, then attempts T3. Idempotent: a repeated or late cancel returns the current status. Never reserves,
   * calls a provider, or touches the ledger.
   */
  async cancel(userId: string, sessionId: string, clientKey: string): Promise<{ turnId?: string; status: TurnStatus | 'cancel_requested' }> {
    if (!this.turnRecords) throw new IntelligenceDenied('feature_disabled');
    await this.assertOwned(userId, sessionId);
    const key = turnIdempotencyKey(userId, sessionId, clientKey);
    const signalled = this.cancels?.abort(key) ?? false;
    let row = await this.turnRecords.findByKey(sessionId, key);
    if (!row) {
      if (signalled) return { status: 'cancel_requested' }; // the owner stops at its next boundary
      throw new IntelligenceDenied('not_found');
    }
    row = await this.finalizeIfExpired(row);
    if (row.status === 'accepted') {
      if (await this.turnRecords.cancel(row.id)) this.turnMetrics?.cancelledInc();
      row = await this.finalizeIfExpired((await this.turnRecords.findById(row.id)) ?? row);
    }
    return { turnId: row.id, status: row.status };
  }

  /**
   * NEM-024 Checkpoint C — capability probe (`GET /knowledge/sessions/capabilities`). Deny-first: the single
   * entitlement resolver decides (the route's CapabilityGuard already denied an unentitled caller). Returns tier,
   * capability keys, and limits only: never budgets, ledger balances, prices, provider or model configuration.
   */
  async capabilities(userId: string): Promise<CapabilityProbe> {
    const r = await this.sessions.resolveOrDeny(userId);
    const research = Boolean(this.retrieval && this.indexPermission && this.anchors && this.turnRecords);
    return {
      tier: r.tier,
      capabilities: [...r.policy.capabilities].filter((c) => typeof c === 'string').sort(),
      features: { researchTurns: research, streaming: research, cancellation: research && Boolean(this.cancels), history: Boolean(this.turnRecords) },
      limits: { maxBooks: r.limits.maxBooks, questionMaxCodePoints: TURN_QUESTION_MAX_CODE_POINTS, historyPageMax: TURN_HISTORY_PAGE_MAX },
    };
  }

  /** History page (owner only), newest first; expired provisional rows are finalized before anything is returned. */
  async history(userId: string, sessionId: string, limit = 20): Promise<TurnView[]> {
    if (!this.turnRecords) throw new IntelligenceDenied('feature_disabled');
    await this.assertOwned(userId, sessionId);
    const n = Math.min(Math.max(Math.floor(limit) || 20, 1), TURN_HISTORY_PAGE_MAX);
    let rows = await this.turnRecords.listBySession(sessionId, n);
    const provisional = rows.filter((x) => x.status === 'accepted').map((x) => x.id);
    if (provisional.length > 0) {
      this.turnMetrics?.finalizedInc('lazy', await this.turnRecords.finalize(provisional));
      rows = await this.turnRecords.listBySession(sessionId, n);
    }
    return this.toViews(userId, rows);
  }

  /** One turn (owner only), with the same lazy finalization and re-validation. */
  async turnView(userId: string, sessionId: string, turnId: string): Promise<TurnView> {
    if (!this.turnRecords) throw new IntelligenceDenied('feature_disabled');
    await this.assertOwned(userId, sessionId);
    let row = await this.turnRecords.findHistoryRow(sessionId, turnId);
    if (!row) throw new IntelligenceDenied('not_found');
    if (row.status === 'accepted') {
      this.turnMetrics?.finalizedInc('lazy', await this.turnRecords.finalize([row.id]));
      row = (await this.turnRecords.findHistoryRow(sessionId, turnId)) ?? row;
    }
    return (await this.toViews(userId, [row]))[0];
  }

  /**
   * D-10: re-validate every cited source against CURRENT user-level research rights AND book-level index permission,
   * then re-materialize the excerpt from the verified object (S2). A revoked, changed, or missing source never yields
   * an excerpt. Generated answer text is returned unchanged (TT-14 open). Shares the weighted guard (Q-5).
   */
  private async toViews(userId: string, rows: HistoryRow[]): Promise<TurnView[]> {
    const tHistory = process.hrtime.bigint();
    type Cite = { bookId: string; hash: string; start: number; end: number };
    const parsed = new Map<string, Cite | null>();
    const books = new Set<string>();
    for (const r of rows) {
      if (r.status !== 'completed') continue;
      for (const seg of r.segments ?? []) for (const c of seg.citations) {
        const m = c.anchor ? ANCHOR.exec(c.anchor) : null;
        const cite = c.kind === 'chunk' && c.bookId && m ? { bookId: c.bookId, hash: m[1], start: Number(m[2]), end: Number(m[3]) } : null;
        parsed.set(`${r.id}|${c.ref}|${c.anchor}`, cite);
        if (cite) books.add(cite.bookId);
      }
    }
    const state = new Map<string, { status: 'ok' | 'revoked'; hash?: string }>();
    for (const b of books) {
      let ok = false;
      let hash: string | undefined;
      try {
        ok = (await this.rights.eligibility(userId, b, RESEARCH_OPERATION)).eligible;
        if (ok) {
          const d = await this.indexPermission!.check(b);
          ok = d.permitted;
          hash = d.permitted ? d.textHash : undefined;
        }
      } catch {
        ok = false;
      }
      state.set(b, ok ? { status: 'ok', hash } : { status: 'revoked' });
    }
    const wanted = [...books].filter((b) => state.get(b)!.status === 'ok' && [...parsed.values()].some((c) => c && c.bookId === b && c.hash === state.get(b)!.hash));
    const texts = new Map<string, string | 'unavailable' | 'stale'>();
    let deferred = !this.bookText;
    if (wanted.length > 0 && this.bookText) {
      const admitted = this.guard?.tryAcquire(wanted.length);
      if (admitted && !admitted.ok) {
        this.turnMetrics?.guardRejectedInc(admitted.reason);
        deferred = true;
      } else {
        try {
          const keys = new Map<string, string | null>((await this.db.query<{ id: string; textFileKey: string | null }>(
            `SELECT id, "textFileKey" FROM books WHERE id = ANY($1::uuid[])`, [wanted])).map((k) => [k.id, k.textFileKey]));
          for (const b of wanted) {
            try {
              const key = keys.get(b);
              if (!key) throw new Error('no key');
              const bytes = await this.bookText.read(key);
              texts.set(b, computeTextHash(bytes) === state.get(b)!.hash ? decodeUtf8(bytes) : 'stale');
            } catch {
              texts.set(b, 'unavailable');
            }
          }
        } finally {
          if (admitted?.ok) admitted.release();
        }
      }
    }
    // F-1: excerpts are keyed by the citation's own key (turn | ref | anchor), never by occurrence order, so repeated
    // citations, identical anchors in several turns, and interleaved books always map to their own range.
    const excerptByKey = new Map<string, string | null>();
    for (const [b, t] of texts) {
      if (typeof t !== 'string' || t === 'unavailable' || t === 'stale') continue;
      const mine = [...parsed.entries()].filter((e): e is [string, Cite] => !!e[1] && e[1].bookId === b && e[1].hash === state.get(b)!.hash);
      const slices = sliceCodePoints(t, mine.map(([, c]) => ({ start: c.start, end: c.end })));
      mine.forEach(([key], i) => excerptByKey.set(key, slices[i]));
    }
    const views = rows.map((r): TurnView => {
      const completed = r.status === 'completed';
      const citations = completed ? (r.segments ?? []).map((seg) => seg.citations.map((c): TurnCitation => {
        const key = `${r.id}|${c.ref}|${c.anchor}`;
        const cite = parsed.get(key) ?? null;
        const base = { ref: c.ref, kind: c.kind, bookId: c.bookId, anchor: c.anchor, excerpt: null as string | null };
        if (!cite) return { ...base, sourceState: c.kind === 'chunk' ? 'position_unavailable' : 'deferred' };
        const st = state.get(cite.bookId)!;
        if (st.status === 'revoked') return { ...base, sourceState: 'revoked' };
        if (cite.hash !== st.hash) return { ...base, sourceState: 'stale' };
        if (deferred) return { ...base, sourceState: 'deferred' };
        const t = texts.get(cite.bookId);
        if (t === 'stale') return { ...base, sourceState: 'stale' };
        if (t === undefined || t === 'unavailable') return { ...base, sourceState: 'unavailable' };
        const excerpt = excerptByKey.get(key) ?? null;
        return excerpt === null ? { ...base, sourceState: 'unavailable' } : { ...base, excerpt, sourceState: 'available' };
      })) : null;
      return {
        turnId: r.id, turnIndex: r.turnIndex, status: r.status, question: r.question,
        createdAt: new Date(r.createdAt).toISOString(), completedAt: r.completedAt ? new Date(r.completedAt).toISOString() : null,
        failureReason: r.failureReason,
        segments: completed ? (r.segments ?? []).map((x) => (x.bookId ? { origin: x.origin as AnswerSegment['origin'], text: x.text, bookId: x.bookId } : { origin: x.origin as AnswerSegment['origin'], text: x.text })) : null,
        citations,
        exclusions: (r.exclusions as unknown as TurnExclusions) ?? null,
        settlement: r.settlement,
      };
    });
    this.turnMetrics?.observeStage('history', Number(process.hrtime.bigint() - tHistory) / 1e9);
    return views;
  }
}
