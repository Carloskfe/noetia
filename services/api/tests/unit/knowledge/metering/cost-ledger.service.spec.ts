import {
  CapabilityDescriptor, NormalizedUsage, priceUsage, unitsForUsage, worstCaseCost, worstCaseUnits,
} from '../../../../src/knowledge/ai/contract';
import {
  FIXTURE_DESCRIPTORS, FIXTURE_PRICING_A, FIXTURE_UNIT_WEIGHTS,
} from '../../../../src/knowledge/ai/contract/fixtures';
import { NO_PROVIDER } from '../../../../src/knowledge/metering/budget-ledger.service';
import {
  AttemptDenied, AttemptReservationRequest, CostLedgerError, CostLedgerService,
} from '../../../../src/knowledge/metering/cost-ledger.service';
import { FakeDb, TEST_CONFIG, USER_A } from '../support/fixtures';

const [DESC_A, DESC_B] = FIXTURE_DESCRIPTORS;
const POLICY = {
  id: 'pol-1', tier: 'noetia_plus', capability: 'research_session', version: 1, allowanceUnits: 1_000_000_000,
  periodDays: 30, reserveUnitsPerTurn: 10, reservationTtlSeconds: 300, maxUnresolvedUnits: 1_000_000_000, maxUnresolvedAgeSeconds: 3600,
};
const GLOBAL = { id: 'g-1', version: 1, periodDays: 30, allowanceMicroUsd: 10_000_000n, maxUnresolvedMicroUsd: 5_000_000n };
const REQ: AttemptReservationRequest = {
  userId: USER_A, tier: 'noetia_plus', capability: 'research_session', sessionId: null, turnKey: 'turn:abc', attemptNumber: 1,
  descriptor: DESC_A, countedInputTokens: 1_000, maxOutputTokens: 100, cacheIntent: { mode: 'none' }, nonTokenUnitBounds: { tool_call: 1 },
};
const BOUNDS = { inputTokens: 1_000, maxOutputTokens: 100, cacheIntent: { mode: 'none' as const }, nonTokenUnitBounds: { tool_call: 1 } };
const COST = worstCaseCost(DESC_A, FIXTURE_PRICING_A, BOUNDS).microUsd;
const UNITS = worstCaseUnits(DESC_A, FIXTURE_UNIT_WEIGHTS, BOUNDS);

function metrics() {
  return {
    budgetReservedInc: jest.fn(), budgetRejectedInc: jest.fn(), reservationExpiredInc: jest.fn(), reservedMicroUsdInc: jest.fn(),
    settledMicroUsdInc: jest.fn(), costOverrunInc: jest.fn(), overspendMicroUsdInc: jest.fn(), globalAllowanceRejectedInc: jest.fn(),
  };
}

interface State { settledFinal?: bigint; settledPartial?: bigint; held?: bigint; compensated?: bigint; overrun?: bigint }

function setup(o: {
  policy?: object | null; global?: object | null; pricing?: object; weights?: object | null; dup?: boolean; breaker?: boolean;
  scope?: { units: string; oldestAge: number }; overall?: string; state?: State; consumed?: string; inserted?: boolean;
  cache?: { isExhausted: jest.Mock; markExhausted: jest.Mock; clear: jest.Mock } | null; config?: Partial<typeof TEST_CONFIG>;
} = {}) {
  const db = new FakeDb();
  db.on(/pg_advisory_xact_lock/, () => [{}]);
  db.on(/^SELECT 1 FROM ai_budget_ledger WHERE "idempotencyKey" = \$1 AND "entryType" = 'reservation'$/, () => (o.dup ? [{}] : []));
  db.on(/FROM ai_overrun_breakers WHERE/, () => (o.breaker ? [{}] : []));
  db.on(/MIN\(r\."createdAt"\)/, () => [o.scope ?? { units: '0', oldestAge: 0 }]);
  db.on(/^SELECT COALESCE\(SUM\(r\.units\), 0\)::text AS units FROM ai_budget_ledger r WHERE/, () => [{ units: o.overall ?? '0' }]);
  db.on(/WITH open_attempts/, () => [{
    settledFinal: String(o.state?.settledFinal ?? 0n), settledPartial: String(o.state?.settledPartial ?? 0n), held: String(o.state?.held ?? 0n),
    compensated: String(o.state?.compensated ?? 0n), overrun: String(o.state?.overrun ?? 0n),
  }]);
  db.on(/AS consumed/, () => [{ consumed: o.consumed ?? '0' }]);
  db.on(/'reservation', \$7/, () => (o.inserted === false ? [] : [{ expiresAt: '2026-11-09T10:05:00Z' }]));
  const costConfig = {
    activeGlobalPolicy: jest.fn().mockResolvedValue(o.global === undefined ? GLOBAL : o.global),
    activePricingSchema: jest.fn().mockResolvedValue(o.pricing ?? { status: 'ok', id: 'ps-1', schema: FIXTURE_PRICING_A }),
    activeUnitWeightSchema: jest.fn().mockResolvedValue(o.weights === undefined ? { id: 'uw-1', schema: FIXTURE_UNIT_WEIGHTS } : o.weights),
    pricingSchemaById: jest.fn().mockResolvedValue(FIXTURE_PRICING_A),
    unitWeightSchemaById: jest.fn().mockResolvedValue(FIXTURE_UNIT_WEIGHTS),
  };
  const budgetLedger = { activePolicy: jest.fn().mockResolvedValue(o.policy === undefined ? POLICY : o.policy) };
  const cache = o.cache === null ? undefined : o.cache ?? { isExhausted: jest.fn().mockResolvedValue(false), markExhausted: jest.fn(), clear: jest.fn() };
  const m = metrics();
  const svc = new CostLedgerService(db as any, costConfig as any, budgetLedger as any, m as any, { ...TEST_CONFIG, ...o.config }, cache as any);
  return { svc, db, costConfig, budgetLedger, cache, metrics: m };
}

const cause = async (p: Promise<unknown>) => {
  try {
    await p;
    return 'allowed';
  } catch (e) {
    if (e instanceof AttemptDenied) return e.cause;
    throw e;
  }
};

describe('CostLedgerService.reserveAttempt — admission', () => {
  it('reserves the contract worst case in micro-USD and units, pinned to schema versions, with instrumentation', async () => {
    const { svc, db, metrics: m } = setup({ state: { settledFinal: 100n, held: 50n, compensated: -10n } });
    const r = await svc.reserveAttempt(REQ);
    expect(r).toMatchObject({
      attemptKey: 'turn:abc:a1', attemptNumber: 1, reservedMicroUsd: COST, reservedUnits: UNITS,
      pricingSchemaId: 'ps-1', unitWeightSchemaId: 'uw-1', globalPolicyId: 'g-1', committedBeforeMicroUsd: 140n, allowanceMicroUsd: 10_000_000n,
    });
    const insert = db.ran(/'reservation', \$7/)[0].params;
    expect(insert.slice(5, 7)).toEqual(['turn:abc:a1', UNITS.toString()]);
    expect(insert.slice(8, 14)).toEqual([COST.toString(), 'ps-1', 'uw-1', 'g-1', 1, 'turn:abc']);
    expect(JSON.parse(insert[14])).toEqual([]);
    expect(JSON.parse(insert[15])).toEqual(DESC_A.noChargeErrorClasses);
    expect(m.budgetReservedInc).toHaveBeenCalledTimes(1);
    expect(m.reservedMicroUsdInc).toHaveBeenCalledWith(COST);
  });

  it('takes the global lock before the scope lock (B-6 order), inside one transaction', async () => {
    const { svc, db } = setup();
    await svc.reserveAttempt(REQ);
    const locks = db.ran(/pg_advisory_xact_lock/).map((c) => c.params[0]);
    expect(locks).toEqual(['intelligence:budget:global-admission:v1', `${USER_A}:research_session`]);
    expect(db.transaction).toHaveBeenCalledTimes(1);
  });

  it('applies the conservative factor to estimated counts (descriptor B)', async () => {
    const { svc, costConfig } = setup({ pricing: { status: 'ok', id: 'ps-b', schema: (await import('../../../../src/knowledge/ai/contract/fixtures')).FIXTURE_PRICING_B } });
    const r = await svc.reserveAttempt({ ...REQ, descriptor: DESC_B, nonTokenUnitBounds: {}, countedInputTokens: 10 });
    expect(costConfig.activePricingSchema).toHaveBeenCalledWith('fixture-b', 'fixture-b-mid');
    expect(r.reservedMicroUsd).toBeGreaterThan(0n);
  });

  it('exact capacity is admitted; one micro-USD over is rejected', async () => {
    const exact = { ...GLOBAL, allowanceMicroUsd: 1_000n + COST };
    expect(await cause(setup({ global: exact, state: { settledFinal: 1_000n } }).svc.reserveAttempt(REQ))).toBe('allowed');
    expect(await cause(setup({ global: { ...exact, allowanceMicroUsd: exact.allowanceMicroUsd - 1n }, state: { settledFinal: 1_000n } }).svc.reserveAttempt(REQ)))
      .toBe('global_allowance');
  });

  it('negative capacity after an overrun denies every admission', async () => {
    const { svc, metrics: m } = setup({ global: { ...GLOBAL, allowanceMicroUsd: 1_000n }, state: { settledFinal: 1_400n } });
    expect(await cause(svc.reserveAttempt(REQ))).toBe('global_allowance');
    expect(m.globalAllowanceRejectedInc).toHaveBeenCalledTimes(1);
    expect(m.budgetRejectedInc).toHaveBeenCalledWith('noetia_plus');
  });

  it.each([
    ['no overall unresolved-units bound configured', { config: { overallUnresolvedUnitsBound: undefined } }, 'unresolved_bound_unset'],
    ['no per-user budget policy', { policy: null }, 'policy_missing'],
    ['no global policy (unset denies)', { global: null }, 'global_policy_unset'],
    ['no active pricing schema', { pricing: { status: 'missing' } }, 'pricing_schema_missing'],
    ['expired pricing schema', { pricing: { status: 'expired' } }, 'pricing_schema_expired'],
    ['stored schema fails validation', { pricing: { status: 'invalid' } }, 'pricing_schema_invalid'],
    ['no unit-weight schema', { weights: null }, 'unit_weights_missing'],
    ['duplicate attempt key', { dup: true }, 'duplicate_attempt'],
    ['open overrun breaker on the schema', { breaker: true }, 'overrun_breaker_open'],
    ['per-scope unresolved units above the bound', { scope: { units: String(POLICY.maxUnresolvedUnits + 1), oldestAge: 0 } }, 'scope_unresolved'],
    ['per-scope oldest unresolved too old', { scope: { units: '0', oldestAge: 4000 } }, 'scope_unresolved'],
    ['overall unresolved units bound', { overall: String(TEST_CONFIG.overallUnresolvedUnitsBound!) }, 'overall_unresolved_units'],
    ['micro-USD unresolved bound', { state: { held: GLOBAL.maxUnresolvedMicroUsd - COST + 1n } }, 'unresolved_micro_usd_bound'],
    ['per-user unit allowance', { consumed: String(POLICY.allowanceUnits) }, 'unit_allowance'],
    ['a concurrent duplicate loses at insert', { inserted: false }, 'duplicate_attempt'],
  ])('denies (fail closed): %s', async (_l, o, expected) => {
    const { svc, db } = setup(o as any);
    expect(await cause(svc.reserveAttempt(REQ))).toBe(expected);
    // Denied before any reservation is written; only the lost insert race attempted (and failed) the write.
    expect(db.ran(/'reservation', \$7/)).toHaveLength((o as any).inserted === false ? 1 : 0);
  });

  it('a global policy deactivated between pre-check and lock is re-read and denies', async () => {
    const { svc, costConfig } = setup();
    costConfig.activeGlobalPolicy.mockResolvedValueOnce(GLOBAL).mockResolvedValueOnce(null);
    expect(await cause(svc.reserveAttempt(REQ))).toBe('global_policy_unset');
  });

  it('a missing input-token count is denied before any pricing', async () => {
    expect(await cause(setup().svc.reserveAttempt({ ...REQ, countedInputTokens: null }))).toBe('input_count_unavailable');
  });

  it.each([
    ['attempt number 0', { attemptNumber: 0 }, 'invalid_request'],
    ['empty turn key', { turnKey: '' }, 'invalid_request'],
    ['a missing non-token unit bound (F-5)', { nonTokenUnitBounds: {} }, 'contract_rejected'],
    ['input above the context limit', { countedInputTokens: 1_000_001 }, 'contract_rejected'],
    ['an unvalidated descriptor (F-6)', { descriptor: JSON.parse(JSON.stringify(DESC_A)) as CapabilityDescriptor }, 'contract_rejected'],
    ['an unknown modifier', { modifiers: ['nope'] }, 'contract_rejected'],
  ])('rejects %s', async (_l, over, expected) => {
    const { svc, metrics: m } = setup();
    expect(await cause(svc.reserveAttempt({ ...REQ, ...(over as any) }))).toBe(expected);
    expect(m.budgetRejectedInc).not.toHaveBeenCalled();
  });

  it('an amount outside the bigint column range is denied and recorded', async () => {
    const { svc } = setup();
    const huge = { ...REQ, nonTokenUnitBounds: { tool_call: Number.MAX_SAFE_INTEGER } };
    // tool_call is 10,000 µUSD each in fixture A, so 2^53 calls exceed 2^63−1 µUSD.
    expect(await cause(svc.reserveAttempt(huge))).toBe('column_overflow');
  });

  it('an exhausted scope in the admission cache denies; a cache failure denies; unit exhaustion is cached', async () => {
    const exhausted = { isExhausted: jest.fn().mockResolvedValue(true), markExhausted: jest.fn(), clear: jest.fn() };
    expect(await cause(setup({ cache: exhausted }).svc.reserveAttempt(REQ))).toBe('cache_exhausted');
    const broken = { isExhausted: jest.fn().mockRejectedValue(new Error('redis down')), markExhausted: jest.fn(), clear: jest.fn() };
    expect(await cause(setup({ cache: broken }).svc.reserveAttempt(REQ))).toBe('ledger_unavailable');
    const ctx = setup({ consumed: String(POLICY.allowanceUnits) });
    await cause(ctx.svc.reserveAttempt(REQ));
    expect(ctx.cache!.markExhausted).toHaveBeenCalledWith(USER_A, 'research_session', TEST_CONFIG.admissionCacheTtlSeconds);
  });

  it('any database failure denies with budget_unavailable', async () => {
    const { svc, db } = setup();
    db.failNext = /WITH open_attempts/;
    const err = await svc.reserveAttempt(REQ).catch((e) => e);
    expect(err).toBeInstanceOf(AttemptDenied);
    expect(err.reason).toBe('budget_unavailable');
    expect(err.cause).toBe('ledger_unavailable');
  });

  it('works without an admission cache', async () => {
    expect(await cause(setup({ cache: null }).svc.reserveAttempt(REQ))).toBe('allowed');
  });
});

describe('CostLedgerService.globalState', () => {
  it('committed = settled (final + partial) + held + compensated; overruns are reported, never added', async () => {
    const { svc } = setup({ state: { settledFinal: 1_400_000n, settledPartial: 300_000n, held: 700_000n, compensated: -50_000n, overrun: 400_000n } });
    expect(await svc.globalState()).toEqual({
      periodDays: 30, allowance: 10_000_000n, settled: 1_700_000n, held: 700_000n, compensated: -50_000n,
      committed: 2_350_000n, capacity: 7_650_000n, overrunClassified: 400_000n,
    });
  });

  it('returns null without an active global policy', async () => {
    expect(await setup({ global: null }).svc.globalState()).toBeNull();
  });
});

// ── Settlement ──────────────────────────────────────────────────────────────────────────────────

const RESERVED = 1_000_000n;
function usage(over: Partial<NormalizedUsage> = {}, tokens: Partial<NormalizedUsage['tokens']> = {}): NormalizedUsage {
  return {
    contract: 'noetia.ai.usage', schemaVersion: 1, providerKey: 'fixture-a', modelKey: 'fixture-a-mid', attemptKey: 'turn:abc:a1',
    startedAt: '2026-01-01T00:00:00Z', endedAt: '2026-01-01T00:00:01Z',
    tokens: { inputUncached: 1_000, cacheRead: 0, cacheWrite: {}, output: 100, ...tokens }, nonTokenUnits: {},
    outcome: 'completed', error: null, usageCompleteness: 'complete', zeroUsageEvidence: 'none', ...over,
  };
}
const ROW = {
  userId: USER_A, sessionId: null, capability: 'research_session', attemptNumber: 1, reservedMicroUsd: String(RESERVED),
  pricingSchemaId: 'ps-1', unitWeightSchemaId: 'uw-1', pricingModifiers: [], noChargeDeclarations: [],
};

function settleSetup(o: { row?: object | null; settled?: boolean; partial?: boolean; released?: boolean; open?: boolean; exists?: boolean; usageEvent?: object | null } = {}) {
  const ctx = setup();
  const { db } = ctx;
  db.on(/^SELECT r\."userId", r\."sessionId", r\.capability/, () => (o.row === null ? [] : [o.row ?? ROW]));
  db.on(/^INSERT INTO ai_usage_events/, () => []);
  db.on(/'settlement', \$2, \$3/, () => (o.settled === false ? [] : [{ id: '9' }]));
  db.on(/INSERT INTO ai_cost_overruns/, () => []);
  db.on(/INSERT INTO ai_overrun_breakers/, () => []);
  db.on(/INSERT INTO ai_partial_settlements/, () => (o.partial === false ? [] : [{ id: '7' }]));
  db.on(/'release', 0, 0/, () => (o.released === false ? [] : [{ userId: USER_A, capability: 'research_session' }]));
  db.on(/^SELECT 1 FROM ai_budget_ledger r WHERE r\."idempotencyKey" = \$1 AND r\."attemptNumber" IS NOT NULL/, () => (o.open ? [{}] : []));
  db.on(/^SELECT 1 FROM ai_budget_ledger WHERE "idempotencyKey" = \$1 AND "entryType" = 'reservation' AND "attemptNumber" IS NOT NULL/, () => (o.exists === false ? [] : [{}]));
  db.on(/^SELECT provider FROM ai_usage_events/, () => (o.usageEvent ? [o.usageEvent] : []));
  return ctx;
}

describe('CostLedgerService.settleAttempt', () => {
  it('settles the full actual with the PINNED schema and modifiers; records evidence first', async () => {
    const { svc, db, costConfig, metrics: m } = settleSetup({ row: { ...ROW, pricingModifiers: ['batch'] } });
    const u = usage();
    expect(await svc.settleAttempt(u)).toBe('settled');
    expect(costConfig.pricingSchemaById).toHaveBeenCalledWith('ps-1');
    const actual = priceUsage(u, FIXTURE_PRICING_A, ['batch']).microUsd;
    const units = unitsForUsage(u, FIXTURE_UNIT_WEIGHTS);
    const evidenceAt = db.calls.findIndex((c) => /^INSERT INTO ai_usage_events/.test(c.sql));
    const settleAt = db.calls.findIndex((c) => /'settlement', \$2, \$3/.test(c.sql));
    expect(evidenceAt).toBeGreaterThanOrEqual(0);
    expect(evidenceAt).toBeLessThan(settleAt);
    const ev = db.calls[evidenceAt].params;
    expect(ev.slice(4, 12)).toEqual(['fixture-a', 'fixture-a-mid', 'success', units.toString(), 'completed', null, 'complete', 'none']);
    expect(ev[15]).toBe(actual.toString());
    expect(db.calls[settleAt].params.slice(0, 3)).toEqual(['turn:abc:a1', units.toString(), actual.toString()]);
    expect(db.ran(/INSERT INTO ai_cost_overruns/)).toHaveLength(0);
    expect(m.settledMicroUsdInc).toHaveBeenCalledWith(actual);
    expect(m.costOverrunInc).not.toHaveBeenCalled();
  });

  it('actual above the reservation: full actual settled, excess classified once, breaker opened (same transaction)', async () => {
    const { svc, db, metrics: m } = settleSetup({ row: { ...ROW, reservedMicroUsd: '1000' } });
    const u = usage();
    const actual = priceUsage(u, FIXTURE_PRICING_A).microUsd;
    expect(actual).toBeGreaterThan(1000n);
    expect(await svc.settleAttempt(u)).toBe('settled');
    expect(db.ran(/'settlement', \$2, \$3/)[0].params[2]).toBe(actual.toString()); // never capped
    expect(db.ran(/INSERT INTO ai_cost_overruns/)[0].params).toEqual([USER_A, 'turn:abc:a1', 'ps-1', '1000', actual.toString(), (actual - 1000n).toString()]);
    expect(db.ran(/INSERT INTO ai_overrun_breakers/)[0].params).toEqual(['ps-1']);
    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(m.costOverrunInc).toHaveBeenCalledTimes(1);
    expect(m.overspendMicroUsdInc).toHaveBeenCalledWith(actual - 1000n);
  });

  it('a replay never settles twice', async () => {
    const { svc, db, metrics: m } = settleSetup({ settled: false });
    expect(await svc.settleAttempt(usage())).toBe('already_resolved');
    expect(db.ran(/INSERT INTO ai_cost_overruns/)).toHaveLength(0);
    expect(m.settledMicroUsdInc).not.toHaveBeenCalled();
  });

  it('unknown attempt key → no_reservation', async () => {
    expect(await settleSetup({ row: null }).svc.settleAttempt(usage())).toBe('no_reservation');
  });

  it('refusal with partial usage → partial settlement; remainder held; no evidence row (the final can still arrive)', async () => {
    const { svc, db } = settleSetup();
    const u = usage({ outcome: 'refused', error: 'refusal', usageCompleteness: 'partial' });
    expect(await svc.settleAttempt(u)).toBe('partially_settled');
    expect(db.ran(/INSERT INTO ai_partial_settlements/)[0].params[1]).toBe(priceUsage(u, FIXTURE_PRICING_A).microUsd.toString());
    expect(db.ran(/^INSERT INTO ai_usage_events/)).toHaveLength(0);
    expect(db.ran(/INSERT INTO ai_overrun_breakers/)).toHaveLength(0);
  });

  it('a partial above the reservation opens the breaker (classification waits for the final)', async () => {
    const { svc, db } = settleSetup({ row: { ...ROW, reservedMicroUsd: '1' } });
    expect(await svc.settleAttempt(usage({ outcome: 'refused', error: 'refusal', usageCompleteness: 'partial' }))).toBe('partially_settled');
    expect(db.ran(/INSERT INTO ai_overrun_breakers/)).toHaveLength(1);
    expect(db.ran(/INSERT INTO ai_cost_overruns/)).toHaveLength(0);
  });

  it('a replayed partial is a no-op while open, and already_resolved once resolved', async () => {
    const p = usage({ outcome: 'refused', error: 'refusal', usageCompleteness: 'partial' });
    expect(await settleSetup({ partial: false, open: true }).svc.settleAttempt(p)).toBe('partially_settled');
    expect(await settleSetup({ partial: false, open: false }).svc.settleAttempt(p)).toBe('already_resolved');
  });

  it.each([
    ['rejected + unevidenced (unknown)', usage({ outcome: 'rejected', error: 'rate_limited', usageCompleteness: 'unknown' }, { inputUncached: 0, output: 0 })],
    ['timeout, unknown usage', usage({ outcome: 'timed_out', error: 'timeout', usageCompleteness: 'unknown' }, { inputUncached: 0, output: 0 })],
    ['client abort, partial usage', usage({ outcome: 'aborted', error: 'client_abort', usageCompleteness: 'partial' })],
    ['documented_no_charge for a class the descriptor does not declare', usage({ outcome: 'rejected', error: 'invalid_request', usageCompleteness: 'zero_confirmed', zeroUsageEvidence: 'documented_no_charge' }, { inputUncached: 0, output: 0 })],
  ])('holds (no release, no settlement): %s', async (_l, u) => {
    const { svc, db } = settleSetup();
    expect(await svc.settleAttempt(u)).toBe('held');
    expect(db.ran(/^INSERT INTO ai_usage_events/)).toHaveLength(1);
    expect(db.ran(/'release', 0, 0/)).toHaveLength(0);
    expect(db.ran(/'settlement', \$2, \$3/)).toHaveLength(0);
  });

  it('releases only with authoritative evidence: provider_reported_zero, or a declared documented_no_charge', async () => {
    const zero = { inputUncached: 0, output: 0 };
    const reported = usage({ outcome: 'rejected', error: 'rate_limited', usageCompleteness: 'zero_confirmed', zeroUsageEvidence: 'provider_reported_zero' }, zero);
    expect(await settleSetup().svc.settleAttempt(reported)).toBe('released');
    const documented = usage({ outcome: 'rejected', error: 'rate_limited', usageCompleteness: 'zero_confirmed', zeroUsageEvidence: 'documented_no_charge' }, zero);
    const declared = settleSetup({ row: { ...ROW, noChargeDeclarations: DESC_B.noChargeErrorClasses } });
    expect(await declared.svc.settleAttempt(documented)).toBe('released');
    expect(declared.db.ran(/^INSERT INTO ai_usage_events/)[0].params[7]).toBe('0');
    expect(await settleSetup().svc.settleAttempt(documented)).toBe('held'); // not declared by this attempt's descriptor
  });

  it('a release replay is already_resolved', async () => {
    const u = usage({ outcome: 'rejected', error: 'rate_limited', usageCompleteness: 'zero_confirmed', zeroUsageEvidence: 'provider_reported_zero' }, { inputUncached: 0, output: 0 });
    expect(await settleSetup({ released: false }).svc.settleAttempt(u)).toBe('already_resolved');
  });

  it('throws (caller keeps it held) on invalid usage, a no-provider claim, a pinned schema that is gone, or a ledger outage', async () => {
    await expect(settleSetup().svc.settleAttempt({ ...usage(), prompt: 'x' } as any)).rejects.toThrow();
    await expect(settleSetup().svc.settleAttempt(usage({ providerKey: NO_PROVIDER }))).rejects.toBeInstanceOf(CostLedgerError);
    const gone = settleSetup();
    gone.costConfig.pricingSchemaById.mockResolvedValue(null);
    await expect(gone.svc.settleAttempt(usage())).rejects.toThrow('pinned pricing or weight schema unavailable');
    const outage = settleSetup();
    outage.db.failNext = /'settlement', \$2, \$3/;
    await expect(outage.svc.settleAttempt(usage())).rejects.toThrow('simulated database failure');
  });

  it('a cache failure after resolution is ignored', async () => {
    const ctx = settleSetup();
    ctx.cache!.clear.mockRejectedValue(new Error('redis down'));
    expect(await ctx.svc.settleAttempt(usage())).toBe('settled');
  });
});

describe('CostLedgerService.releaseAttempt (provider never called)', () => {
  it('writes no-provider evidence, then releases only if that evidence is the no-provider record', async () => {
    const { svc, db } = settleSetup();
    expect(await svc.releaseAttempt('turn:abc:a1')).toBe('released');
    expect(db.ran(/^INSERT INTO ai_usage_events/)[0].params.slice(3, 6)).toEqual(['turn:abc:a1', NO_PROVIDER, 1]);
    expect(db.ran(/'release', 0, 0/)[0].params).toEqual(['turn:abc:a1', true, NO_PROVIDER]);
  });

  it('is refused once a provider has reported usage for the attempt', async () => {
    await expect(settleSetup({ usageEvent: { provider: 'fixture-a' } }).svc.releaseAttempt('turn:abc:a1')).rejects.toBeInstanceOf(CostLedgerError);
  });

  it('no reservation → no_reservation; already resolved → already_resolved', async () => {
    expect(await settleSetup({ row: null }).svc.releaseAttempt('k')).toBe('no_reservation');
    expect(await settleSetup({ released: false, usageEvent: { provider: NO_PROVIDER } }).svc.releaseAttempt('turn:abc:a1')).toBe('already_resolved');
  });
});

describe('CostLedgerService.compensateAttempt', () => {
  it('writes a separate signed compensating entry', async () => {
    const { svc, db } = setup();
    db.on(/'compensation', \$2, \$3/, () => [{ id: '1' }]);
    await svc.compensateAttempt('turn:abc:a1', -250n, -2);
    expect(db.ran(/'compensation'/)[0].params).toEqual(['turn:abc:a1', -2, '-250']);
  });

  it('requires an attempt reservation, an in-range bigint, and integer units', async () => {
    const { svc, db } = setup();
    db.on(/'compensation', \$2, \$3/, () => []);
    await expect(svc.compensateAttempt('nope', 1n)).rejects.toThrow('no attempt reservation');
    await expect(svc.compensateAttempt('k', 1 as any)).rejects.toThrow('bigint');
    await expect(svc.compensateAttempt('k', 2n ** 63n)).rejects.toThrow('bigint');
    await expect(svc.compensateAttempt('k', 1n, 0.5)).rejects.toThrow('integer');
  });
});

describe('CostLedgerService.reconcileAttempts', () => {
  const evidence = (key: string, over: object) => ({ ...ROW, key, expired: false, provider: null, usage: null, ...over });

  it('settles from stored evidence, releases no-provider keys, holds and flags expired unevidenced ones once', async () => {
    const ctx = settleSetup();
    const done = usage({ attemptKey: 'k-done' });
    ctx.db.on(/LEFT JOIN ai_usage_events u/, () => [
      evidence('k-done', { provider: 'fixture-a', usage: done }),
      evidence('k-none', { provider: NO_PROVIDER }),
      evidence('k-old', { expired: true }),
      evidence('k-timeout', { expired: true, provider: 'fixture-a', usage: usage({ attemptKey: 'k-timeout', outcome: 'timed_out', error: 'timeout', usageCompleteness: 'unknown' }, { inputUncached: 0, output: 0 }) }),
      evidence('k-young', {}),
    ]);
    ctx.db.on(/'expired_flag', 0/, () => [{ id: '3' }]);
    expect(await ctx.svc.reconcileAttempts()).toEqual({ settled: 1, released: 1, flaggedExpired: 2, held: 3 });
    expect(ctx.db.ran(/^INSERT INTO ai_usage_events/)).toHaveLength(0); // evidence is never rewritten
    expect(ctx.metrics.reservationExpiredInc).toHaveBeenCalledTimes(2);
  });

  it('a second pass changes nothing; a pinned-schema failure leaves the attempt held', async () => {
    const ctx = settleSetup({ settled: false });
    ctx.costConfig.pricingSchemaById.mockResolvedValueOnce(null);
    ctx.db.on(/LEFT JOIN ai_usage_events u/, () => [
      evidence('k1', { provider: 'fixture-a', usage: usage({ attemptKey: 'k1' }) }),
      evidence('k2', { provider: 'fixture-a', usage: usage({ attemptKey: 'k2' }) }),
    ]);
    expect(await ctx.svc.reconcileAttempts()).toEqual({ settled: 0, released: 0, flaggedExpired: 0, held: 1 });
  });

  it('expired flag is written once (second pass finds it already flagged)', async () => {
    const ctx = settleSetup();
    ctx.db.on(/LEFT JOIN ai_usage_events u/, () => [evidence('k', { expired: true })]);
    ctx.db.on(/'expired_flag', 0/, () => []);
    expect(await ctx.svc.reconcileAttempts()).toEqual({ settled: 0, released: 0, flaggedExpired: 0, held: 1 });
  });

  it('evidence for a different attempt is rejected and the attempt stays held', async () => {
    const ctx = settleSetup();
    ctx.db.on(/LEFT JOIN ai_usage_events u/, () => [evidence('k', { provider: 'fixture-a', usage: usage({ attemptKey: 'other' }) })]);
    expect(await ctx.svc.reconcileAttempts()).toEqual({ settled: 0, released: 0, flaggedExpired: 0, held: 1 });
  });
});
