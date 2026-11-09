import { createHash } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { IntelligenceDenied } from '../common/intelligence-denied.error';
import { KnowledgeDbService } from '../common/knowledge-db.service';
import { KnowledgeMetricsService } from '../common/knowledge-metrics.service';
import { ModelGatewayService } from '../ai/model-gateway.service';
import { AnswerSegment } from '../ai/model-provider';
import { RESEARCH_OPERATION, RESEARCH_SESSION } from '../knowledge.types';
import { BudgetLedgerService, NO_PROVIDER } from '../metering/budget-ledger.service';
import { RateCardService } from '../metering/rate-card.service';
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

/**
 * Research-session turn stub (model path `research_session.turn`; declared
 * invariant `research_session_context`). Turn order (ADR-006, B-5):
 *   1. entitlement → 2. book set, eligibility, Context Builder invariant →
 *   3. ledger reservation → 4. short FOR UPDATE transaction (first-turn lock) →
 *   5. provider call outside any transaction → 6. durable settlement.
 * Failure at 1–3: no lock, no charge. Failure at 4: reservation released (or
 * held for reconciliation if the release cannot be written); no provider call.
 * Failure at 5–6: the lock stands; settlement is never assumed.
 */
@Injectable()
export class TurnService {
  constructor(
    private readonly db: KnowledgeDbService,
    private readonly sessions: SessionsService,
    private readonly rights: RightsService,
    private readonly contextBuilder: ContextBuilderService,
    private readonly ledger: BudgetLedgerService,
    private readonly rateCards: RateCardService,
    private readonly gateway: ModelGatewayService,
    private readonly metrics: KnowledgeMetricsService,
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

    // 3. Reserve budget in the ledger (fails closed; throws IntelligenceDenied).
    const key = turnIdempotencyKey(userId, sessionId, clientKey);
    await this.ledger.reserve({ userId, tier: r.tier, capability: RESEARCH_SESSION, sessionId, idempotencyKey: key });

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
      await this.releaseOrHold(userId, sessionId, key);
      throw new IntelligenceDenied('turn_failed');
    }
    if (lockOutcome !== 'ok') {
      await this.releaseOrHold(userId, sessionId, key);
      throw new IntelligenceDenied(lockOutcome === 'read_only' ? 'session_read_only' : 'set_changed');
    }

    // 5. Provider call, outside any transaction. The lock now stands.
    const result = await this.gateway.invoke(ContextBuilderService.PATH, context);

    // 6. Durable settlement — never assumed.
    let settlement: TurnResult['settlement'] = 'held';
    try {
      await this.ledger.recordUsage({
        userId, sessionId, capability: RESEARCH_SESSION, idempotencyKey: key,
        provider: result.provider, modelKey: result.modelKey, outcome: result.outcome, unitsReported: result.unitsReported,
      });
      if (result.unitsReported !== null) {
        const card = await this.rateCards.active(result.provider, result.modelKey);
        await this.ledger.settle(key, result.unitsReported, card);
        settlement = 'settled';
      }
    } catch {
      settlement = 'held'; // reconciliation settles it later from durable records
    }

    if (result.scopeViolation) {
      this.metrics.scopeViolationInc();
      throw new IntelligenceDenied('scope_violation');
    }
    if (result.outcome !== 'success') throw new IntelligenceDenied('turn_failed');
    return { sessionId, segments: result.segments, excludedBookIds: excluded, settlement };
  }

  /** Step-4 failure: release idempotently; if that fails, leave durable evidence for reconciliation. */
  private async releaseOrHold(userId: string, sessionId: string, key: string): Promise<void> {
    try {
      await this.ledger.release(key);
    } catch {
      try {
        await this.ledger.recordUsage({
          userId, sessionId, capability: RESEARCH_SESSION, idempotencyKey: key,
          provider: NO_PROVIDER, modelKey: null, outcome: 'aborted', unitsReported: 0,
        });
      } catch {
        // Held until reconciliation; it is flagged on expiry and never released to zero automatically.
      }
    }
  }
}
