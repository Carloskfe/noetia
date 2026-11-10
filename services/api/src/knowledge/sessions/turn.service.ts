import { createHash } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
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

export interface TurnResult {
  sessionId: string;
  segments: AnswerSegment[];
  /** Books in the locked set excluded from this turn (disclosed, ADR-006). */
  excludedBookIds: string[];
  settlement: 'settled' | 'held';
}

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
  ) {}

  async run(userId: string, sessionId: string, clientKey: string): Promise<TurnResult> {
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
}
