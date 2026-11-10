import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import {
  assertNormalizedUsage, CacheIntent, ContractError, conservativeInputTokens, guardColumn, ledgerActionFor, legacyOutcome,
  MAX_BIGINT_COLUMN, NoChargeDeclaration, NormalizedUsage, priceUsage, unitsForUsage, ValidatedCapabilityDescriptor,
  worstCaseCost, worstCaseUnits,
} from '../ai/contract';
import { IntelligenceDenied } from '../common/intelligence-denied.error';
import { KNOWLEDGE_CONFIG, KnowledgeConfig } from '../common/knowledge-config';
import { KnowledgeDbService } from '../common/knowledge-db.service';
import { KnowledgeMetricsService } from '../common/knowledge-metrics.service';
import { Capability, DenialReason, IntelligenceTier } from '../knowledge.types';
import { ADMISSION_CACHE, AdmissionCachePort } from './admission-cache';
import { attemptIdempotencyKey } from './attempt-key';
import { BudgetLedgerService, GLOBAL_ADMISSION_LOCK, NO_PROVIDER, UNRESOLVED } from './budget-ledger.service';
import { CostConfigService, GlobalBudgetPolicy, Queryable } from './cost-config.service';

// ── Public types ─────────────────────────────────────────────────────────────────────────────────

export interface AttemptReservationRequest {
  userId: string;
  tier: IntelligenceTier;
  capability: Capability;
  sessionId: string | null;
  /** Server-side turn key (e.g. `turnIdempotencyKey`); attempts of one turn share it. */
  turnKey: string;
  /** 1 for the first attempt; each retry is a new attempt with its own reservation (D15). */
  attemptNumber: number;
  /** The adapter's capability descriptor, sealed by `assertCapabilityDescriptor`. */
  descriptor: ValidatedCapabilityDescriptor;
  /** Input tokens counted (exact) or estimated; null = unavailable → denied. */
  countedInputTokens: number | null;
  maxOutputTokens: number;
  cacheIntent: CacheIntent;
  /** An explicit bound for every non-token unit the descriptor declares (contract F-5). */
  nonTokenUnitBounds: Record<string, number>;
  modifiers?: string[];
}

export interface AttemptReservation {
  attemptKey: string;
  attemptNumber: number;
  reservedMicroUsd: bigint;
  reservedUnits: bigint;
  pricingSchemaId: string;
  unitWeightSchemaId: string;
  globalPolicyId: string;
  expiresAt: Date;
  /** Instrumentation (AC-4): `committed` read under the global lock immediately before this admission. */
  committedBeforeMicroUsd: bigint;
  allowanceMicroUsd: bigint;
}

export type AttemptSettleResult = 'settled' | 'partially_settled' | 'released' | 'held' | 'already_resolved' | 'no_reservation';

export interface AttemptReconcileSummary {
  settled: number;
  released: number;
  flaggedExpired: number;
  held: number;
}

/** §9.1 accounting state for the active global period. All integer micro-USD. */
export interface GlobalCostState {
  periodDays: number;
  allowance: bigint;
  /** Full actual cost of resolved attempts (incl. any excess) plus partial settlements of unresolved ones. */
  settled: bigint;
  /** Unresolved reserved exposure: Σ max(0, reserved − settled so far) over unresolved attempts. */
  held: bigint;
  compensated: bigint;
  /** settled + held + compensated. Overruns are NOT added: they are already inside settled. */
  committed: bigint;
  /** allowance − committed (negative after an overrun). */
  capacity: bigint;
  /** Σ overrun classifications in the period: audit only, never part of committed. */
  overrunClassified: bigint;
}

/** Internal denial causes (for tests, metrics, and audit). Clients only ever see the safe `reason`. */
export type AttemptDenialCause =
  | 'invalid_request' | 'contract_rejected' | 'column_overflow' | 'input_count_unavailable'
  | 'cache_exhausted' | 'unit_allowance'
  | 'scope_unresolved' | 'overall_unresolved_units' | 'unresolved_micro_usd_bound'
  | 'duplicate_attempt'
  | 'unresolved_bound_unset' | 'policy_missing' | 'global_policy_unset'
  | 'pricing_schema_missing' | 'pricing_schema_expired' | 'pricing_schema_invalid' | 'unit_weights_missing'
  | 'overrun_breaker_open' | 'global_allowance' | 'ledger_unavailable';

const REASON: Record<AttemptDenialCause, DenialReason> = {
  invalid_request: 'invalid_request',
  contract_rejected: 'invalid_request',
  column_overflow: 'invalid_request',
  input_count_unavailable: 'budget_unavailable',
  cache_exhausted: 'budget_exhausted',
  unit_allowance: 'budget_exhausted',
  scope_unresolved: 'unresolved_reservations',
  overall_unresolved_units: 'unresolved_reservations',
  unresolved_micro_usd_bound: 'unresolved_reservations',
  duplicate_attempt: 'duplicate_turn',
  unresolved_bound_unset: 'budget_unavailable',
  policy_missing: 'budget_unavailable',
  global_policy_unset: 'budget_unavailable',
  pricing_schema_missing: 'budget_unavailable',
  pricing_schema_expired: 'budget_unavailable',
  pricing_schema_invalid: 'budget_unavailable',
  unit_weights_missing: 'budget_unavailable',
  overrun_breaker_open: 'budget_unavailable',
  global_allowance: 'budget_unavailable',
  ledger_unavailable: 'budget_unavailable',
};

/** A fail-closed admission denial. Surfaces as the customer-neutral `IntelligenceDenied(reason)`. */
export class AttemptDenied extends IntelligenceDenied {
  constructor(readonly cause: AttemptDenialCause) {
    super(REASON[cause]);
  }
}

/** A settlement-side request that must not proceed (caller bug); the reservation stays held. */
export class CostLedgerError extends Error {}

interface AttemptRow {
  userId: string;
  sessionId: string | null;
  capability: string;
  attemptNumber: number;
  reservedMicroUsd: string;
  pricingSchemaId: string | null;
  unitWeightSchemaId: string | null;
  pricingModifiers: string[] | null;
  noChargeDeclarations: NoChargeDeclaration[] | null;
}

const ATTEMPT_COLUMNS = `r."userId", r."sessionId", r.capability, r."attemptNumber", r."reservedMicroUsd"::text AS "reservedMicroUsd",
  r."pricingSchemaId", r."unitWeightSchemaId", r."pricingModifiers", r."noChargeDeclarations"`;

/** An attempt reservation (alias `r`) that is still unresolved. */
const OPEN_ATTEMPT = `r."attemptNumber" IS NOT NULL AND ${UNRESOLVED}`;

/**
 * The attempt (alias `r`) has at least one recorded partial settlement. A partially settled attempt holds a real
 * obligation inside *settled*, so it can never be released to zero: only a final settlement resolves it.
 */
const HAS_PARTIAL = `EXISTS (SELECT 1 FROM ai_partial_settlements p WHERE p."attemptKey" = r."idempotencyKey")`;

/** Copy of the reservation's identity columns, for resolution and flag entries. */
const FROM_RESERVATION = `r."userId", r."sessionId", r."policyId", r.tier, r.capability, r."idempotencyKey"`;

/**
 * NEM-021 cost-aware ledger (Phase 2): per-attempt reservations priced by contract v1, a global micro-USD
 * allowance (D14), evidence-aware settlement, overrun classification and breaker, and reconciliation.
 *
 * It extends NEM-019's ledger table and keeps every NEM-019 guarantee: append-only rows, one reservation
 * and one resolution per key (partial unique indexes), B-6 global lock → scope lock, fail-closed admission,
 * settlement never assumed, reconciliation only from durable evidence, never released to zero.
 *
 * Accounting (§9.1): committed = settled + held + compensated; admission requires
 * committed + worstCaseCost ≤ allowance under the global lock. An overrun is classified (audit) but never
 * added to committed again. All pricing, rounding, and outcome rules come from the frozen contract.
 */
@Injectable()
export class CostLedgerService {
  private readonly logger = new Logger(CostLedgerService.name);

  constructor(
    private readonly db: KnowledgeDbService,
    private readonly costConfig: CostConfigService,
    private readonly budgetLedger: BudgetLedgerService,
    private readonly metrics: KnowledgeMetricsService,
    @Inject(KNOWLEDGE_CONFIG) private readonly config: KnowledgeConfig,
    @Optional() @Inject(ADMISSION_CACHE) private readonly cache?: AdmissionCachePort,
  ) {}

  // ── Admission ──────────────────────────────────────────────────────────────────────────────

  /** Reserve one provider attempt, or deny before any provider call. Never throws anything but AttemptDenied. */
  async reserveAttempt(req: AttemptReservationRequest): Promise<AttemptReservation> {
    try {
      const reservation = await this.reserveOrThrow(req);
      this.metrics.budgetReservedInc();
      this.metrics.reservedMicroUsdInc(reservation.reservedMicroUsd);
      return reservation;
    } catch (e) {
      const denied = e instanceof AttemptDenied ? e : new AttemptDenied('ledger_unavailable');
      if (denied.cause === 'global_allowance') this.metrics.globalAllowanceRejectedInc();
      if (!['invalid_request', 'contract_rejected', 'duplicate_attempt'].includes(denied.cause)) {
        this.metrics.budgetRejectedInc(req?.tier);
      }
      throw denied;
    }
  }

  private async reserveOrThrow(req: AttemptReservationRequest): Promise<AttemptReservation> {
    let key: string;
    try {
      key = attemptIdempotencyKey(req.turnKey, req.attemptNumber);
    } catch {
      throw new AttemptDenied('invalid_request');
    }
    if (this.cache && (await this.cache.isExhausted(req.userId, req.capability))) throw new AttemptDenied('cache_exhausted');

    const unitsBound = this.config.overallUnresolvedUnitsBound;
    if (unitsBound === undefined) throw new AttemptDenied('unresolved_bound_unset');
    const policy = await this.budgetLedger.activePolicy(req.tier, req.capability);
    if (!policy) throw new AttemptDenied('policy_missing');
    if (!(await this.costConfig.activeGlobalPolicy())) throw new AttemptDenied('global_policy_unset');

    const d = req.descriptor;
    const pricing = await this.costConfig.activePricingSchema(d?.providerKey, d?.modelKey);
    if (pricing.status !== 'ok') {
      const causes = { missing: 'pricing_schema_missing', expired: 'pricing_schema_expired', invalid: 'pricing_schema_invalid' } as const;
      throw new AttemptDenied(causes[pricing.status]);
    }
    const weights = await this.costConfig.activeUnitWeightSchema();
    if (!weights) throw new AttemptDenied('unit_weights_missing');
    if (req.countedInputTokens === null || req.countedInputTokens === undefined) throw new AttemptDenied('input_count_unavailable');

    let cost: bigint;
    let units: bigint;
    try {
      const bounds = {
        inputTokens: conservativeInputTokens(d, req.countedInputTokens),
        maxOutputTokens: req.maxOutputTokens,
        cacheIntent: req.cacheIntent,
        nonTokenUnitBounds: req.nonTokenUnitBounds,
      };
      cost = guardColumn(worstCaseCost(d, pricing.schema, bounds, req.modifiers ?? []).microUsd);
      units = guardColumn(worstCaseUnits(d, weights.schema, bounds));
    } catch (e) {
      if (e instanceof ContractError && e.code === 'overflow') {
        this.logger.warn('cost-aware admission denied: amount outside the bigint column range');
        throw new AttemptDenied('column_overflow');
      }
      throw new AttemptDenied('contract_rejected');
    }

    const outcome = await this.db.transaction(async (m) => {
      // B-6 order: global lock, then scope lock (same keys as NEM-019, so both ledgers serialize together).
      await m.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [GLOBAL_ADMISSION_LOCK]);
      await m.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [`${req.userId}:${req.capability}`]);

      // Re-read under the lock: the policy may have changed since the pre-check.
      const global = await this.costConfig.activeGlobalPolicy(m);
      if (!global) return 'global_policy_unset' as const;
      const dup = await m.query(`SELECT 1 FROM ai_budget_ledger WHERE "idempotencyKey" = $1 AND "entryType" = 'reservation'`, [key]);
      if (dup.length > 0) return 'duplicate_attempt' as const;
      const breaker = await m.query(`SELECT 1 FROM ai_overrun_breakers WHERE "pricingSchemaId" = $1 AND state = 'open'`, [pricing.id]);
      if (breaker.length > 0) return 'overrun_breaker_open' as const;

      const [scope] = await m.query(
        `SELECT COALESCE(SUM(r.units), 0)::text AS units,
                COALESCE(EXTRACT(EPOCH FROM (now() - MIN(r."createdAt"))), 0)::int AS "oldestAge"
           FROM ai_budget_ledger r WHERE r."userId" = $1 AND r.capability = $2 AND ${UNRESOLVED}`,
        [req.userId, req.capability],
      );
      if (BigInt(scope.units) > BigInt(policy.maxUnresolvedUnits) || Number(scope.oldestAge) > policy.maxUnresolvedAgeSeconds) {
        return 'scope_unresolved' as const;
      }
      const [overall] = await m.query(`SELECT COALESCE(SUM(r.units), 0)::text AS units FROM ai_budget_ledger r WHERE ${UNRESOLVED}`);
      if (BigInt(overall.units) + units > BigInt(unitsBound)) return 'overall_unresolved_units' as const;

      const state = await this.globalState(m, global);
      if (!state) return 'global_policy_unset' as const;
      if (state.held + cost > global.maxUnresolvedMicroUsd) return 'unresolved_micro_usd_bound' as const;
      // The admission invariant (§9.1): committed + worstCaseCost ≤ allowance. Exact capacity is admitted.
      if (state.committed + cost > global.allowanceMicroUsd) return 'global_allowance' as const;

      const consumed = await this.consumedUnits(m, req.userId, req.capability, policy.periodDays);
      if (consumed + units > BigInt(policy.allowanceUnits)) return 'unit_allowance' as const;

      const inserted = await m.query(
        `INSERT INTO ai_budget_ledger
           ("userId", "sessionId", "policyId", tier, capability, "idempotencyKey", "entryType", units, "expiresAt",
            "reservedMicroUsd", "pricingSchemaId", "unitWeightSchemaId", "globalPolicyId", "attemptNumber", "turnKey",
            "pricingModifiers", "noChargeDeclarations")
         VALUES ($1, $2, $3, $4, $5, $6, 'reservation', $7, now() + make_interval(secs => $8),
                 $9, $10, $11, $12, $13, $14, $15::jsonb, $16::jsonb)
         ON CONFLICT DO NOTHING
         RETURNING "expiresAt"`,
        [req.userId, req.sessionId, policy.id, req.tier, req.capability, key, units.toString(), policy.reservationTtlSeconds,
          cost.toString(), pricing.id, weights.id, global.id, req.attemptNumber, req.turnKey,
          JSON.stringify(req.modifiers ?? []), JSON.stringify(d.noChargeErrorClasses)],
      );
      if (inserted.length === 0) return 'duplicate_attempt' as const;
      return { expiresAt: new Date(inserted[0].expiresAt), committedBefore: state.committed, global };
    });

    if (outcome === 'unit_allowance') await this.cache?.markExhausted(req.userId, req.capability, this.config.admissionCacheTtlSeconds);
    if (typeof outcome === 'string') throw new AttemptDenied(outcome);
    return {
      attemptKey: key,
      attemptNumber: req.attemptNumber,
      reservedMicroUsd: cost,
      reservedUnits: units,
      pricingSchemaId: pricing.id,
      unitWeightSchemaId: weights.id,
      globalPolicyId: outcome.global.id,
      expiresAt: outcome.expiresAt,
      committedBeforeMicroUsd: outcome.committedBefore,
      allowanceMicroUsd: outcome.global.allowanceMicroUsd,
    };
  }

  /** NEM-019's per-user consumption: settled + compensated units in the window + unresolved reserved units. */
  private async consumedUnits(m: Queryable, userId: string, capability: string, periodDays: number): Promise<bigint> {
    const [row] = await m.query(
      `SELECT (
         (SELECT COALESCE(SUM(units), 0) FROM ai_budget_ledger
           WHERE "userId" = $1 AND capability = $2 AND "entryType" IN ('settlement', 'compensation')
             AND "createdAt" >= now() - make_interval(days => $3))
       + (SELECT COALESCE(SUM(r.units), 0) FROM ai_budget_ledger r
           WHERE r."userId" = $1 AND r.capability = $2 AND ${UNRESOLVED}))::text AS consumed`,
      [userId, capability, periodDays],
    );
    return BigInt(row.consumed);
  }

  // ── Accounting state ───────────────────────────────────────────────────────────────────────

  /**
   * The §9.1 quantities for the active period, read in ONE statement (a consistent snapshot).
   * - settled: settlements in the window (attempt `settledMicroUsd`, or NEM-019 rate-card `costMicroUsd`),
   *   plus the latest cumulative partial settlement of each still-unresolved attempt;
   * - held: Σ max(0, reserved − partial) over unresolved attempts, whatever their age (never released to zero);
   * - compensated: signed compensating entries in the window.
   * Legacy NEM-019 reservations carry no micro-USD, so they hold 0 here (they keep their unit bounds).
   */
  async globalState(m: Queryable = this.db, policy?: GlobalBudgetPolicy | null): Promise<GlobalCostState | null> {
    const global = policy === undefined ? await this.costConfig.activeGlobalPolicy(m) : policy;
    if (!global) return null;
    const [row] = await m.query(
      `WITH open_attempts AS (
         SELECT r."reservedMicroUsd" AS reserved,
                COALESCE((SELECT MAX(p."settledMicroUsd") FROM ai_partial_settlements p
                           WHERE p."attemptKey" = r."idempotencyKey"), 0) AS partial
           FROM ai_budget_ledger r
          WHERE r."reservedMicroUsd" IS NOT NULL AND ${UNRESOLVED}
       )
       SELECT
         (SELECT COALESCE(SUM(COALESCE(s."settledMicroUsd", s."costMicroUsd")), 0) FROM ai_budget_ledger s
           WHERE s."entryType" = 'settlement' AND s."createdAt" >= now() - make_interval(days => $1))::text AS "settledFinal",
         (SELECT COALESCE(SUM(x.partial), 0) FROM open_attempts x)::text AS "settledPartial",
         (SELECT COALESCE(SUM(GREATEST(0, x.reserved - x.partial)), 0) FROM open_attempts x)::text AS held,
         (SELECT COALESCE(SUM(c."compensatedMicroUsd"), 0) FROM ai_budget_ledger c
           WHERE c."entryType" = 'compensation' AND c."createdAt" >= now() - make_interval(days => $1))::text AS compensated,
         (SELECT COALESCE(SUM(o."overrunMicroUsd"), 0) FROM ai_cost_overruns o
           WHERE o."createdAt" >= now() - make_interval(days => $1))::text AS overrun`,
      [global.periodDays],
    );
    const settled = BigInt(row.settledFinal) + BigInt(row.settledPartial);
    const held = BigInt(row.held);
    const compensated = BigInt(row.compensated);
    const committed = settled + held + compensated;
    return {
      periodDays: global.periodDays,
      allowance: global.allowanceMicroUsd,
      settled,
      held,
      compensated,
      committed,
      capacity: global.allowanceMicroUsd - committed,
      overrunClassified: BigInt(row.overrun),
    };
  }

  // ── Settlement ─────────────────────────────────────────────────────────────────────────────

  /**
   * Resolve an attempt from its normalized usage (§9.3 via the contract's `ledgerActionFor`), priced with the
   * schema and modifiers PINNED at reservation. Idempotent: replays and reconciliation never resolve twice.
   * Throws on invalid usage or a ledger failure; the caller must then leave the reservation held.
   */
  async settleAttempt(input: NormalizedUsage): Promise<AttemptSettleResult> {
    const usage = assertNormalizedUsage(input);
    if (usage.providerKey === NO_PROVIDER) throw new CostLedgerError('usage cannot claim the no-provider key');
    const row = await this.attemptRow(usage.attemptKey);
    if (!row) return 'no_reservation';
    return this.resolve(usage.attemptKey, row, usage, true);
  }

  /**
   * Release an attempt whose provider request was NEVER sent (e.g. a failure between reservation and send).
   * This is not a path for failed or rejected provider calls: those release only through `settleAttempt`
   * with evidenced `zero_confirmed` usage. Refused if usage from a provider is already recorded for the key.
   */
  async releaseAttempt(attemptKey: string): Promise<AttemptSettleResult> {
    const row = await this.attemptRow(attemptKey);
    if (!row) return 'no_reservation';
    const [existing] = await this.db.query<{ provider: string }>(
      `SELECT provider FROM ai_usage_events WHERE "idempotencyKey" = $1`, [attemptKey]);
    if (existing && existing.provider !== NO_PROVIDER) {
      throw new CostLedgerError('provider usage is recorded for this attempt; release requires evidenced zero usage');
    }
    if (await this.hasPartial(attemptKey)) {
      throw new CostLedgerError('a partial settlement is recorded for this attempt; only a final settlement can resolve it');
    }
    await this.db.query(
      `INSERT INTO ai_usage_events ("userId", "sessionId", capability, "idempotencyKey", provider, "modelKey", outcome,
         "unitsReported", "contractOutcome", "attemptNumber")
       VALUES ($1, $2, $3, $4, $5, NULL, 'aborted', 0, 'not_sent', $6) ON CONFLICT ("idempotencyKey") DO NOTHING`,
      [row.userId, row.sessionId, row.capability, attemptKey, NO_PROVIDER, row.attemptNumber],
    );
    return this.appendRelease(attemptKey, true);
  }

  /** A correction is a separate signed entry (micro-USD and units) — never an edit, never a second settlement. */
  async compensateAttempt(attemptKey: string, microUsd: bigint, units = 0): Promise<void> {
    if (typeof microUsd !== 'bigint' || microUsd > MAX_BIGINT_COLUMN || -microUsd > MAX_BIGINT_COLUMN) {
      throw new CostLedgerError('compensation must be a bigint within the column range');
    }
    if (!Number.isSafeInteger(units)) throw new CostLedgerError('units must be an integer');
    const rows = await this.db.query(
      `INSERT INTO ai_budget_ledger ("userId", "sessionId", "policyId", tier, capability, "idempotencyKey", "entryType", units,
         "compensatedMicroUsd", "pricingSchemaId", "attemptNumber", "turnKey")
       SELECT ${FROM_RESERVATION}, 'compensation', $2, $3, r."pricingSchemaId", r."attemptNumber", r."turnKey"
         FROM ai_budget_ledger r WHERE r."idempotencyKey" = $1 AND r."entryType" = 'reservation' AND r."attemptNumber" IS NOT NULL
       RETURNING id`,
      [attemptKey, units, microUsd.toString()],
    );
    if (rows.length === 0) throw new CostLedgerError('no attempt reservation for key');
  }

  // ── Reconciliation ─────────────────────────────────────────────────────────────────────────

  /**
   * Resolve unresolved attempts from durable evidence only (ai_usage_events). Without evidence an attempt
   * stays held; once expired it is flagged once, never released to zero. Idempotent and safe to run in
   * parallel (the unique resolution index decides every race).
   */
  async reconcileAttempts(): Promise<AttemptReconcileSummary> {
    const summary: AttemptReconcileSummary = { settled: 0, released: 0, flaggedExpired: 0, held: 0 };
    const rows = await this.db.query<AttemptRow & { key: string; expired: boolean; provider: string | null; usage: unknown }>(
      `SELECT r."idempotencyKey" AS key, (r."expiresAt" < now()) AS expired, u.provider, u."normalizedUsage" AS usage, ${ATTEMPT_COLUMNS}
         FROM ai_budget_ledger r
         LEFT JOIN ai_usage_events u ON u."idempotencyKey" = r."idempotencyKey"
        WHERE ${OPEN_ATTEMPT}
        ORDER BY r.id`,
    );
    for (const row of rows) {
      let result: AttemptSettleResult = 'held';
      try {
        if (row.provider === NO_PROVIDER) result = await this.appendRelease(row.key, true);
        else if (row.usage) result = await this.resolve(row.key, row, assertNormalizedUsage(row.usage), false);
      } catch {
        result = 'held'; // e.g. pinned schema unavailable or a transient failure: stays held; retried next pass
      }
      if (result === 'settled') summary.settled++;
      else if (result === 'released') summary.released++;
      else if (result === 'held' || result === 'partially_settled') {
        summary.held++;
        if (row.expired && (await this.flagExpired(row.key))) summary.flaggedExpired++;
      }
    }
    return summary;
  }

  // ── Internals ──────────────────────────────────────────────────────────────────────────────

  private async attemptRow(key: string): Promise<AttemptRow | null> {
    const [row] = await this.db.query<AttemptRow>(
      `SELECT ${ATTEMPT_COLUMNS} FROM ai_budget_ledger r
        WHERE r."idempotencyKey" = $1 AND r."entryType" = 'reservation' AND r."attemptNumber" IS NOT NULL`,
      [key],
    );
    return row ?? null;
  }

  private async resolve(key: string, row: AttemptRow, usage: NormalizedUsage, recordEvidence: boolean): Promise<AttemptSettleResult> {
    if (usage.attemptKey !== key) throw new CostLedgerError('usage belongs to another attempt');
    const action = ledgerActionFor(usage, row.noChargeDeclarations ?? []);

    if (action === 'hold') {
      if (recordEvidence) await this.recordEvidence(row, usage, null, null);
      return 'held';
    }
    if (action === 'release' || action === 'no_reservation') {
      // Evidenced zero_confirmed, or `not_sent` (the provider was never called): release with no charge — unless a
      // partial settlement already proved a charge. Zero evidence then contradicts recorded usage: keep it held.
      if (await this.hasPartial(key)) return 'held';
      if (recordEvidence) await this.recordEvidence(row, usage, 0n, 0n);
      return this.appendRelease(key, false);
    }

    const pricing = await this.costConfig.pricingSchemaById(row.pricingSchemaId);
    const weights = await this.costConfig.unitWeightSchemaById(row.unitWeightSchemaId);
    if (!pricing || !weights) throw new CostLedgerError('pinned pricing or weight schema unavailable');
    const actual = guardColumn(priceUsage(usage, pricing, row.pricingModifiers ?? []).microUsd);
    const units = guardColumn(unitsForUsage(usage, weights));
    const reserved = BigInt(row.reservedMicroUsd);

    if (action === 'settle_partial_hold_remainder') return this.recordPartial(key, row, usage, actual, units, reserved);
    if (recordEvidence) await this.recordEvidence(row, usage, actual, units);
    return this.settleFinal(key, row, usage, actual, units, reserved);
  }

  /** Durable usage evidence for reconciliation, written before the ledger entry (NEM-019 order). */
  private async recordEvidence(row: AttemptRow, u: NormalizedUsage, settled: bigint | null, units: bigint | null) {
    await this.db.query(
      `INSERT INTO ai_usage_events ("userId", "sessionId", capability, "idempotencyKey", provider, "modelKey", outcome, "unitsReported",
         "contractOutcome", "errorCategory", "usageCompleteness", "zeroUsageEvidence", "normalizedUsage", "attemptNumber",
         "pricingSchemaId", "settledMicroUsd")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14, $15, $16)
       ON CONFLICT ("idempotencyKey") DO NOTHING`,
      [row.userId, row.sessionId, row.capability, u.attemptKey, u.providerKey, u.modelKey, legacyOutcome(u.outcome) ?? 'aborted',
        units === null ? null : units.toString(), u.outcome, u.error, u.usageCompleteness, u.zeroUsageEvidence, JSON.stringify(u),
        row.attemptNumber, row.pricingSchemaId, settled === null ? null : settled.toString()],
    );
  }

  /**
   * Final settlement: the FULL actual is settled (never capped). In the same transaction, any excess over
   * the reservation is classified once as an overrun and the schema's breaker opens. Held → settled is one
   * row, so the obligation is never in both.
   */
  private async settleFinal(key: string, row: AttemptRow, u: NormalizedUsage, actual: bigint, units: bigint, reserved: bigint) {
    const excess = actual > reserved ? actual - reserved : 0n;
    const inserted = await this.db.transaction(async (m) => {
      const rows = await m.query(
        `INSERT INTO ai_budget_ledger ("userId", "sessionId", "policyId", tier, capability, "idempotencyKey", "entryType", units,
           "settledMicroUsd", "pricingSchemaId", "unitWeightSchemaId", "attemptNumber", "turnKey", "normalizedUsage",
           "contractOutcome", "errorCategory", "usageCompleteness")
         SELECT ${FROM_RESERVATION}, 'settlement', $2, $3, r."pricingSchemaId", r."unitWeightSchemaId", r."attemptNumber",
                r."turnKey", $4::jsonb, $5, $6, $7
           FROM ai_budget_ledger r WHERE r."idempotencyKey" = $1 AND ${OPEN_ATTEMPT}
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [key, units.toString(), actual.toString(), JSON.stringify(u), u.outcome, u.error, u.usageCompleteness],
      );
      if (rows.length === 0) return false;
      if (excess > 0n) {
        await m.query(
          `INSERT INTO ai_cost_overruns ("userId", "attemptKey", "pricingSchemaId", "reservedMicroUsd", "actualMicroUsd", "overrunMicroUsd")
           VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT ("attemptKey") DO NOTHING`,
          [row.userId, key, row.pricingSchemaId, reserved.toString(), actual.toString(), excess.toString()],
        );
        await this.openBreaker(m, row.pricingSchemaId);
      }
      return true;
    });
    if (!inserted) return this.resolvedOrMissing(key);
    this.metrics.settledMicroUsdInc(actual);
    if (excess > 0n) {
      this.metrics.costOverrunInc();
      this.metrics.overspendMicroUsdInc(excess);
    }
    await this.clearCache(row);
    return 'settled' as const;
  }

  /**
   * Partial settlement (§9.3 refusal + partial): record the cumulative partial; the attempt stays unresolved
   * and holds max(0, reserved − partial). A partial above the reservation already proves a model error, so
   * the breaker opens; the overrun itself is classified once, at final settlement.
   */
  private async recordPartial(key: string, row: AttemptRow, u: NormalizedUsage, actual: bigint, units: bigint, reserved: bigint) {
    const inserted = await this.db.transaction(async (m) => {
      const rows = await m.query(
        `INSERT INTO ai_partial_settlements ("userId", "attemptKey", "settledMicroUsd", units, "normalizedUsage")
         SELECT r."userId", r."idempotencyKey", $2, $3, $4::jsonb FROM ai_budget_ledger r
          WHERE r."idempotencyKey" = $1 AND ${OPEN_ATTEMPT}
         ON CONFLICT ("attemptKey", "settledMicroUsd") DO NOTHING
         RETURNING id`,
        [key, actual.toString(), units.toString(), JSON.stringify(u)],
      );
      if (rows.length > 0 && actual > reserved) await this.openBreaker(m, row.pricingSchemaId);
      return rows.length > 0;
    });
    if (inserted) return 'partially_settled' as const;
    const open = await this.db.query(`SELECT 1 FROM ai_budget_ledger r WHERE r."idempotencyKey" = $1 AND ${OPEN_ATTEMPT}`, [key]);
    return open.length > 0 ? ('partially_settled' as const) : this.resolvedOrMissing(key);
  }

  /** Release with no charge. `requireNoProvider`: only when the durable evidence says no provider was called. */
  private async appendRelease(key: string, requireNoProvider: boolean): Promise<AttemptSettleResult> {
    const rows = await this.db.query<{ userId: string; capability: string }>(
      `INSERT INTO ai_budget_ledger ("userId", "sessionId", "policyId", tier, capability, "idempotencyKey", "entryType", units,
         "settledMicroUsd", "pricingSchemaId", "unitWeightSchemaId", "attemptNumber", "turnKey")
       SELECT ${FROM_RESERVATION}, 'release', 0, 0, r."pricingSchemaId", r."unitWeightSchemaId", r."attemptNumber", r."turnKey"
         FROM ai_budget_ledger r
        WHERE r."idempotencyKey" = $1 AND ${OPEN_ATTEMPT} AND NOT ${HAS_PARTIAL}
          AND ($2::boolean = false OR EXISTS (
            SELECT 1 FROM ai_usage_events u WHERE u."idempotencyKey" = r."idempotencyKey" AND u.provider = $3))
       ON CONFLICT DO NOTHING
       RETURNING "userId", capability`,
      [key, requireNoProvider, NO_PROVIDER],
    );
    if (rows.length === 0) {
      const open = await this.db.query(`SELECT 1 FROM ai_budget_ledger r WHERE r."idempotencyKey" = $1 AND ${OPEN_ATTEMPT}`, [key]);
      return open.length > 0 ? 'held' : this.resolvedOrMissing(key); // still open: blocked by a partial or missing evidence
    }
    await this.clearCache(rows[0]);
    return 'released';
  }

  private async hasPartial(key: string): Promise<boolean> {
    const rows = await this.db.query(`SELECT 1 FROM ai_budget_ledger r WHERE r."idempotencyKey" = $1 AND r."entryType" = 'reservation' AND ${HAS_PARTIAL}`, [key]);
    return rows.length > 0;
  }

  private async openBreaker(m: Queryable, pricingSchemaId: string | null) {
    if (!pricingSchemaId) return;
    await m.query(
      `INSERT INTO ai_overrun_breakers ("pricingSchemaId", state, "openedAt") VALUES ($1, 'open', now())
       ON CONFLICT ("pricingSchemaId") DO UPDATE
         SET state = 'open', "openedAt" = now(), "closedAt" = NULL, "closedByReviewRef" = NULL, "replacementSchemaId" = NULL
         WHERE ai_overrun_breakers.state = 'closed'`,
      [pricingSchemaId],
    );
  }

  private async flagExpired(key: string): Promise<boolean> {
    const flagged = await this.db.query(
      `INSERT INTO ai_budget_ledger ("userId", "sessionId", "policyId", tier, capability, "idempotencyKey", "entryType", units, "attemptNumber", "turnKey")
       SELECT ${FROM_RESERVATION}, 'expired_flag', 0, r."attemptNumber", r."turnKey"
         FROM ai_budget_ledger r WHERE r."idempotencyKey" = $1 AND r."entryType" = 'reservation'
       ON CONFLICT DO NOTHING RETURNING id`,
      [key],
    );
    if (flagged.length === 0) return false;
    this.metrics.reservationExpiredInc();
    return true;
  }

  private async resolvedOrMissing(key: string): Promise<AttemptSettleResult> {
    const exists = await this.db.query(
      `SELECT 1 FROM ai_budget_ledger WHERE "idempotencyKey" = $1 AND "entryType" = 'reservation' AND "attemptNumber" IS NOT NULL`, [key]);
    return exists.length > 0 ? 'already_resolved' : 'no_reservation';
  }

  private async clearCache(row: { userId: string; capability: string }) {
    if (!this.cache) return;
    try {
      await this.cache.clear(row.userId, row.capability);
    } catch {
      // The cache is rebuildable and expires on its own; the ledger holds the truth.
    }
  }
}
