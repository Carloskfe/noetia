import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import {
  assertPricingSchema, NormalizedUsage, ValidatedCapabilityDescriptor,
} from '../../../../src/knowledge/ai/contract';
import {
  FIXTURE_DESCRIPTORS, RAW_FIXTURE_PRICING_A, RAW_FIXTURE_PRICING_B, RAW_FIXTURE_UNIT_WEIGHTS,
} from '../../../../src/knowledge/ai/contract/fixtures';
import { KnowledgeConfig } from '../../../../src/knowledge/common/knowledge-config';
import { KnowledgeMetricsService } from '../../../../src/knowledge/common/knowledge-metrics.service';
import { AdmissionCachePort } from '../../../../src/knowledge/metering/admission-cache';
import { CostConfigService } from '../../../../src/knowledge/metering/cost-config.service';
import {
  AttemptDenied, AttemptReservationRequest, CostLedgerService,
} from '../../../../src/knowledge/metering/cost-ledger.service';
import { budgetPolicy, createUser, IT_CONFIG, wire } from './it-env';

/**
 * NEM-021 Phase 2 integration support. Builds on the NEM-019 harness (it-env.ts, unchanged): same disposable
 * database safeguards, same wiring, plus the cost ledger. Every value is an invented, marked fixture.
 */
export const [DESC_A, DESC_B] = FIXTURE_DESCRIPTORS;
export const CAP = 'research_session';
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

/** Cost-ledger tables start empty for each test, so `committed` is exactly what the test creates. */
export async function resetCostState(ds: DataSource) {
  await ds.query(`TRUNCATE ai_partial_settlements, ai_cost_overruns, ai_overrun_breakers, ai_budget_ledger, ai_usage_events,
    ai_pricing_schemas, ai_unit_weight_schemas, ai_global_budget_policies`);
}

export function wireCost(ds: DataSource, opts: { cache?: AdmissionCachePort; config?: Partial<KnowledgeConfig> } = {}) {
  const w = wire(ds, opts);
  const config = { ...IT_CONFIG, ...opts.config };
  const costConfig = new CostConfigService(w.db);
  const costLedger = new CostLedgerService(w.db, costConfig, w.ledger, new KnowledgeMetricsService(), config, opts.cache);
  return { ...w, costConfig, costLedger };
}
export type CostWiring = ReturnType<typeof wireCost>;

/**
 * Golden pricing for descriptor A: every class at `rate` micro-USD per million tokens. At the default
 * 1,000,000 µUSD/M, one token costs exactly 1 µUSD, so golden amounts read directly as token counts.
 */
export function goldenPricing(version: number, rate = 1_000_000) {
  const s = clone(RAW_FIXTURE_PRICING_A) as any;
  s.id = `golden-pricing-a-v${version}`;
  s.version = version;
  s.base = { inputUncached: rate, cacheRead: 0, cacheWrite: { '5m': rate, '1h': rate }, output: rate, nonTokenUnits: { tool_call: 0 } };
  s.tiers = [];
  s.modifiers = {};
  return s;
}
export const sealedGolden = (version: number, rate = 1_000_000) => assertPricingSchema(goldenPricing(version, rate));

export async function addActivePricing(w: CostWiring, raw: unknown, opts: { expiresAt?: Date | null; reviewRef?: string | null } = {}) {
  const id = await w.costConfig.addPricingSchema(raw, { expiresAt: opts.expiresAt ?? null });
  await w.costConfig.activatePricingSchema(id, opts.reviewRef ?? null);
  return id;
}

export async function setGlobalPolicy(w: CostWiring, allowanceMicroUsd: bigint, maxUnresolvedMicroUsd = 1_000_000_000_000n) {
  const id = await w.costConfig.addGlobalPolicy({ periodDays: 30, allowanceMicroUsd, maxUnresolvedMicroUsd, isTestFixture: true });
  await w.costConfig.activateGlobalPolicy(id);
  return id;
}

/** Fixture configuration: golden pricing v1 for A, fixture B pricing, unit weights, a global policy, a roomy unit budget. */
export async function standardSetup(ds: DataSource, w: CostWiring, allowanceMicroUsd = 10_000_000n) {
  await resetCostState(ds);
  await budgetPolicy(ds, 'noetia_plus', CAP, { allowanceUnits: 1_000_000_000, maxUnresolvedUnits: 1_000_000_000 });
  const pricingA = await addActivePricing(w, goldenPricing(1));
  const pricingB = await addActivePricing(w, clone(RAW_FIXTURE_PRICING_B));
  const weights = await w.costConfig.addUnitWeightSchema(clone(RAW_FIXTURE_UNIT_WEIGHTS));
  await w.costConfig.activateUnitWeightSchema(weights);
  const global = await setGlobalPolicy(w, allowanceMicroUsd);
  return { pricingA, pricingB, weights, global };
}

/**
 * An attempt on descriptor A with no cache intent and no tool calls. With golden pricing its worst case is
 * exactly `input + maxOutput` µUSD.
 */
export function attempt(userId: string, input: number, maxOutput = 0, over: Partial<AttemptReservationRequest> = {}): AttemptReservationRequest {
  return {
    userId, tier: 'noetia_plus', capability: CAP, sessionId: null, turnKey: `turn:${randomUUID()}`, attemptNumber: 1,
    descriptor: DESC_A, countedInputTokens: input, maxOutputTokens: maxOutput, cacheIntent: { mode: 'none' },
    nonTokenUnitBounds: { tool_call: 0 }, ...over,
  };
}

export function attemptB(userId: string, input: number, over: Partial<AttemptReservationRequest> = {}): AttemptReservationRequest {
  return attempt(userId, input, 0, { descriptor: DESC_B as ValidatedCapabilityDescriptor, nonTokenUnitBounds: {}, ...over });
}

/** Normalized usage for an attempt (no content: counts and enums only). */
export function usage(
  attemptKey: string, tokens: Partial<NormalizedUsage['tokens']>, over: Partial<NormalizedUsage> = {},
): NormalizedUsage {
  return {
    contract: 'noetia.ai.usage', schemaVersion: 1, providerKey: 'fixture-a', modelKey: 'fixture-a-mid', attemptKey,
    startedAt: '2026-11-09T00:00:00Z', endedAt: '2026-11-09T00:00:01Z',
    tokens: { inputUncached: 0, cacheRead: 0, cacheWrite: {}, output: 0, ...tokens }, nonTokenUnits: {},
    outcome: 'completed', error: null, usageCompleteness: 'complete', zeroUsageEvidence: 'none', ...over,
  };
}

export async function newUser(ds: DataSource) {
  return createUser(ds, 'cost');
}

export async function denialCause(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return 'allowed';
  } catch (e) {
    if (e instanceof AttemptDenied) return e.cause;
    throw e;
  }
}

export async function rowCount(ds: DataSource, sql: string, params: unknown[] = []): Promise<number> {
  return Number((await ds.query(sql, params))[0].n);
}

/** Make the next statement matching `re` fail, as if the ledger were unavailable. */
export function failNextQuery(w: CostWiring, re: RegExp) {
  const original = w.db.query.bind(w.db);
  const originalTx = w.db.transaction.bind(w.db);
  const fail = (sql: string) => {
    if (re.test(sql)) {
      restore();
      throw new Error('simulated ledger outage');
    }
  };
  const q = jest.spyOn(w.db, 'query').mockImplementation(async (sql: string, params?: unknown[]) => {
    fail(sql);
    return original(sql, params);
  });
  const t = jest.spyOn(w.db, 'transaction').mockImplementation(async (fn) => originalTx(async (m) => fn({
    ...m, query: async (sql: string, params?: unknown[]) => { fail(sql); return m.query(sql, params); },
  } as any)));
  function restore() {
    q.mockRestore();
    t.mockRestore();
  }
  return restore;
}

/**
 * Pause the next transaction statement matching `re` (inside `w.db.transaction`) until `release()` is called.
 * `reached` resolves once the statement is about to run, so the test can act while that transaction is still
 * open and holding its locks. Used for deterministic interleavings (F-9).
 */
export function pauseAt(w: CostWiring, re: RegExp) {
  let release!: () => void;
  let markReached!: () => void;
  const gate = new Promise<void>((res) => { release = res; });
  const reached = new Promise<void>((res) => { markReached = res; });
  let armed = true;
  const originalTx = w.db.transaction.bind(w.db);
  const spy = jest.spyOn(w.db, 'transaction').mockImplementation(async (fn) => originalTx(async (m) => fn({
    ...m,
    query: async (sql: string, params?: unknown[]) => {
      if (armed && re.test(sql)) {
        armed = false;
        markReached();
        await gate;
      }
      return m.query(sql, params);
    },
  } as any)));
  let released = false;
  return {
    reached,
    /** Idempotent: safe to call from both the test body and a cleanup path. */
    release: () => {
      if (released) return;
      released = true;
      release();
      spy.mockRestore();
    },
  };
}

/** Resolve once some session is blocked waiting for an advisory lock (proves the interleaving, not just timing). */
export async function waitForAdvisoryLockWaiter(ds: DataSource, timeoutMs = 10_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const [{ n }] = await ds.query(`SELECT count(*)::int AS n FROM pg_locks WHERE locktype = 'advisory' AND NOT granted`);
    if (n > 0) return true;
    await new Promise((r) => setTimeout(r, 25));
  }
  return false;
}
