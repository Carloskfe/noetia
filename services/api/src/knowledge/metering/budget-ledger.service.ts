import { Inject, Injectable, Optional } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { IntelligenceDenied } from '../common/intelligence-denied.error';
import { KNOWLEDGE_CONFIG, KnowledgeConfig } from '../common/knowledge-config';
import { KnowledgeDbService } from '../common/knowledge-db.service';
import { KnowledgeMetricsService } from '../common/knowledge-metrics.service';
import { Capability, IntelligenceTier } from '../knowledge.types';
import { ADMISSION_CACHE, AdmissionCachePort } from './admission-cache';
import { RateCard, RateCardService } from './rate-card.service';

export interface BudgetPolicy {
  id: string;
  tier: IntelligenceTier;
  capability: string;
  version: number;
  allowanceUnits: number;
  periodDays: number;
  reserveUnitsPerTurn: number;
  reservationTtlSeconds: number;
  maxUnresolvedUnits: number;
  maxUnresolvedAgeSeconds: number;
}

export interface ReservationRequest {
  userId: string;
  tier: IntelligenceTier;
  capability: Capability;
  sessionId: string | null;
  idempotencyKey: string;
}

export interface Reservation {
  idempotencyKey: string;
  units: number;
  policyId: string;
  expiresAt: Date;
}

export type UsageOutcome = 'success' | 'failure' | 'timeout' | 'aborted';

export interface UsageRecord {
  userId: string;
  sessionId: string | null;
  capability: Capability;
  idempotencyKey: string;
  /** 'none' means no provider was called (usage is known to be zero). */
  provider: string;
  /** Internal routing key for rate-card lookup. Never customer-visible. */
  modelKey: string | null;
  outcome: UsageOutcome;
  unitsReported: number | null;
}

export type SettleResult = 'settled' | 'already_resolved' | 'no_reservation';

export interface ReconcileSummary {
  settled: number;
  released: number;
  flaggedExpired: number;
  held: number;
}

/** No provider was called for this key: usage is known to be zero. */
export const NO_PROVIDER = 'none';

const UNRESOLVED = `r."entryType" = 'reservation' AND NOT EXISTS (
  SELECT 1 FROM ai_budget_ledger s
   WHERE s."idempotencyKey" = r."idempotencyKey" AND s."entryType" IN ('settlement', 'release'))`;

/**
 * The PostgreSQL budget ledger — the ONLY budget authority (ADR-005 B-1, B-5).
 * Append-only. Integer units; integer micro-USD cost from rate cards.
 *
 * Admission (reserve) fails closed: any unavailable store, error, or rejected
 * write denies BEFORE any provider call. Settlement is never assumed: unknown
 * usage or a ledger failure leaves the reservation held and unresolved for
 * reconciliation, which is idempotent via the unique (key, entryType) index.
 */
@Injectable()
export class BudgetLedgerService {
  constructor(
    private readonly db: KnowledgeDbService,
    private readonly rateCards: RateCardService,
    private readonly metrics: KnowledgeMetricsService,
    @Inject(KNOWLEDGE_CONFIG) private readonly config: KnowledgeConfig,
    @Optional() @Inject(ADMISSION_CACHE) private readonly cache?: AdmissionCachePort,
  ) {}

  async activePolicy(tier: IntelligenceTier, capability: Capability): Promise<BudgetPolicy | null> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT * FROM ai_budget_policies WHERE tier = $1 AND capability = $2 AND active = true
        ORDER BY version DESC LIMIT 1`,
      [tier, capability],
    );
    const p = rows[0];
    if (!p) return null;
    return {
      id: String(p.id),
      tier: p.tier as IntelligenceTier,
      capability: String(p.capability),
      version: Number(p.version),
      allowanceUnits: Number(p.allowanceUnits),
      periodDays: Number(p.periodDays),
      reserveUnitsPerTurn: Number(p.reserveUnitsPerTurn),
      reservationTtlSeconds: Number(p.reservationTtlSeconds),
      maxUnresolvedUnits: Number(p.maxUnresolvedUnits),
      maxUnresolvedAgeSeconds: Number(p.maxUnresolvedAgeSeconds),
    };
  }

  /**
   * Admission: write a reservation to the ledger, or deny. Never throws
   * anything but IntelligenceDenied.
   */
  async reserve(req: ReservationRequest): Promise<Reservation> {
    try {
      return await this.reserveOrThrow(req);
    } catch (e) {
      if (e instanceof IntelligenceDenied) {
        if (e.reason === 'budget_exhausted' || e.reason === 'unresolved_reservations') {
          this.metrics.budgetRejectedInc(req.tier);
        }
        throw e;
      }
      this.metrics.budgetRejectedInc(req.tier);
      throw new IntelligenceDenied('budget_unavailable');
    }
  }

  private async reserveOrThrow(req: ReservationRequest): Promise<Reservation> {
    if (this.cache && (await this.cache.isExhausted(req.userId, req.capability))) {
      throw new IntelligenceDenied('budget_exhausted');
    }
    const bound = this.config.overallUnresolvedUnitsBound;
    if (bound === undefined) throw new IntelligenceDenied('budget_unavailable');

    const policy = await this.activePolicy(req.tier, req.capability);
    if (!policy) throw new IntelligenceDenied('budget_unavailable');

    const outcome = await this.db.transaction(async (m) => {
      await m.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [`${req.userId}:${req.capability}`]);

      const [scope] = await m.query(
        `SELECT COALESCE(SUM(r.units), 0)::bigint AS units,
                COALESCE(EXTRACT(EPOCH FROM (now() - MIN(r."createdAt"))), 0) AS "oldestAge"
           FROM ai_budget_ledger r
          WHERE r."userId" = $1 AND r.capability = $2 AND ${UNRESOLVED}`,
        [req.userId, req.capability],
      );
      if (Number(scope.units) > policy.maxUnresolvedUnits || Number(scope.oldestAge) > policy.maxUnresolvedAgeSeconds) {
        return 'unresolved_reservations' as const;
      }
      const [overall] = await m.query(
        `SELECT COALESCE(SUM(r.units), 0)::bigint AS units FROM ai_budget_ledger r WHERE ${UNRESOLVED}`,
      );
      if (Number(overall.units) > bound) return 'unresolved_reservations' as const;

      const consumed = await this.consumedUnits(m, req.userId, req.capability, policy.periodDays);
      if (consumed + policy.reserveUnitsPerTurn > policy.allowanceUnits) return 'budget_exhausted' as const;

      const inserted = await m.query(
        `INSERT INTO ai_budget_ledger
           ("userId", "sessionId", "policyId", tier, capability, "idempotencyKey", "entryType", units, "expiresAt")
         VALUES ($1, $2, $3, $4, $5, $6, 'reservation', $7, now() + make_interval(secs => $8))
         ON CONFLICT DO NOTHING
         RETURNING "expiresAt"`,
        [req.userId, req.sessionId, policy.id, req.tier, req.capability, req.idempotencyKey,
          policy.reserveUnitsPerTurn, policy.reservationTtlSeconds],
      );
      if (inserted.length === 0) return 'duplicate_turn' as const;
      return { expiresAt: new Date(inserted[0].expiresAt) };
    });

    if (outcome === 'budget_exhausted') {
      await this.cache?.markExhausted(req.userId, req.capability, this.config.admissionCacheTtlSeconds);
    }
    if (typeof outcome === 'string') throw new IntelligenceDenied(outcome);

    this.metrics.budgetReservedInc();
    return { idempotencyKey: req.idempotencyKey, units: policy.reserveUnitsPerTurn, policyId: policy.id, expiresAt: outcome.expiresAt };
  }

  /** Settled + compensated + still-unresolved reserved units in the window. */
  private async consumedUnits(m: EntityManager, userId: string, capability: string, periodDays: number): Promise<number> {
    const [row] = await m.query(
      `SELECT
         (SELECT COALESCE(SUM(units), 0) FROM ai_budget_ledger
           WHERE "userId" = $1 AND capability = $2 AND "entryType" IN ('settlement', 'compensation')
             AND "createdAt" >= now() - make_interval(days => $3))
       + (SELECT COALESCE(SUM(r.units), 0) FROM ai_budget_ledger r
           WHERE r."userId" = $1 AND r.capability = $2 AND ${UNRESOLVED}) AS consumed`,
      [userId, capability, periodDays],
    );
    return Number(row.consumed);
  }

  /** The Gateway's durable usage record. Idempotent per key. */
  async recordUsage(u: UsageRecord): Promise<void> {
    await this.db.query(
      `INSERT INTO ai_usage_events ("userId", "sessionId", capability, "idempotencyKey", provider, "modelKey", outcome, "unitsReported")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT ("idempotencyKey") DO NOTHING`,
      [u.userId, u.sessionId, u.capability, u.idempotencyKey, u.provider, u.modelKey, u.outcome, u.unitsReported],
    );
  }

  /**
   * Settle a reservation from reported usage. Idempotent: a replay, retry, or
   * reconciliation can never produce a second settlement. Throws on ledger
   * failure; the caller must then leave the reservation held.
   */
  async settle(idempotencyKey: string, units: number, card: RateCard | null): Promise<SettleResult> {
    if (!Number.isInteger(units) || units < 0) throw new Error('units must be a non-negative integer');
    const cost = card ? this.rateCards.cost(units, card) : null;
    return this.appendResolution(idempotencyKey, 'settlement', units, cost, card?.id ?? null);
  }

  /** Release a reservation whose provider was never called. Idempotent. */
  async release(idempotencyKey: string): Promise<SettleResult> {
    return this.appendResolution(idempotencyKey, 'release', 0, null, null);
  }

  private async appendResolution(
    key: string, type: 'settlement' | 'release', units: number, cost: string | null, rateCardId: string | null,
  ): Promise<SettleResult> {
    const rows = await this.db.query<{ id: string }>(
      `INSERT INTO ai_budget_ledger
         ("userId", "sessionId", "policyId", tier, capability, "idempotencyKey", "entryType", units, "costMicroUsd", "rateCardId")
       SELECT r."userId", r."sessionId", r."policyId", r.tier, r.capability, r."idempotencyKey", $2, $3, $4, $5
         FROM ai_budget_ledger r
        WHERE r."idempotencyKey" = $1 AND ${UNRESOLVED}
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [key, type, units, cost, rateCardId],
    );
    if (rows.length > 0) {
      await this.clearCacheFor(key);
      return 'settled';
    }
    const exists = await this.db.query(
      `SELECT 1 FROM ai_budget_ledger WHERE "idempotencyKey" = $1 AND "entryType" = 'reservation'`,
      [key],
    );
    return exists.length > 0 ? 'already_resolved' : 'no_reservation';
  }

  /** A correction is a separate entry referencing the key — never an edit. */
  async compensate(idempotencyKey: string, units: number): Promise<void> {
    if (!Number.isInteger(units)) throw new Error('units must be an integer');
    const rows = await this.db.query(
      `INSERT INTO ai_budget_ledger ("userId", "sessionId", "policyId", tier, capability, "idempotencyKey", "entryType", units)
       SELECT "userId", "sessionId", "policyId", tier, capability, "idempotencyKey", 'compensation', $2
         FROM ai_budget_ledger WHERE "idempotencyKey" = $1 AND "entryType" = 'reservation'
       RETURNING id`,
      [idempotencyKey, units],
    );
    if (rows.length === 0) throw new Error('no reservation for key');
  }

  /**
   * Reconciliation: settle or release unresolved reservations from durable
   * evidence (ai_usage_events). Without evidence, a reservation stays held;
   * once expired it is flagged (once), never released to zero.
   */
  async reconcile(): Promise<ReconcileSummary> {
    const summary: ReconcileSummary = { settled: 0, released: 0, flaggedExpired: 0, held: 0 };
    const rows = await this.db.query<{
      idempotencyKey: string; expired: boolean; provider: string | null; modelKey: string | null; unitsReported: string | null;
    }>(
      `SELECT r."idempotencyKey", (r."expiresAt" < now()) AS expired, u.provider, u."modelKey",
              u."unitsReported"::text AS "unitsReported"
         FROM ai_budget_ledger r
         LEFT JOIN ai_usage_events u ON u."idempotencyKey" = r."idempotencyKey"
        WHERE ${UNRESOLVED}
        ORDER BY r.id`,
    );
    for (const row of rows) {
      if (row.provider === NO_PROVIDER) {
        if ((await this.release(row.idempotencyKey)) === 'settled') summary.released++;
        continue;
      }
      if (row.unitsReported !== null && row.unitsReported !== undefined) {
        const units = Number(row.unitsReported);
        const card = row.provider && row.modelKey ? await this.rateCards.active(row.provider, row.modelKey) : null;
        if ((await this.settle(row.idempotencyKey, units, card)) === 'settled') summary.settled++;
        continue;
      }
      summary.held++;
      if (row.expired) {
        const flagged = await this.db.query(
          `INSERT INTO ai_budget_ledger ("userId", "sessionId", "policyId", tier, capability, "idempotencyKey", "entryType", units)
           SELECT "userId", "sessionId", "policyId", tier, capability, "idempotencyKey", 'expired_flag', 0
             FROM ai_budget_ledger WHERE "idempotencyKey" = $1 AND "entryType" = 'reservation'
           ON CONFLICT DO NOTHING RETURNING id`,
          [row.idempotencyKey],
        );
        if (flagged.length > 0) {
          summary.flaggedExpired++;
          this.metrics.reservationExpiredInc();
        }
      }
    }
    return summary;
  }

  private async clearCacheFor(key: string): Promise<void> {
    if (!this.cache) return;
    try {
      const [r] = await this.db.query<{ userId: string; capability: string }>(
        `SELECT "userId", capability FROM ai_budget_ledger WHERE "idempotencyKey" = $1 AND "entryType" = 'reservation'`,
        [key],
      );
      if (r) await this.cache.clear(r.userId, r.capability);
    } catch {
      // The cache is rebuildable and expires on its own; the ledger already holds the truth.
    }
  }
}
