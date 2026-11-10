import {
  assertPricingSchema, canonicalModifierOrder, ContractError, MAX_RATE, NormalizedUsage, priceUsage,
  selectTier, validatePricingSchema, worstCaseCost,
} from '../../../../../src/knowledge/ai/contract';
import {
  FIXTURE_DESCRIPTORS, FIXTURE_PRICING_A, FIXTURE_PRICING_B, FIXTURE_USAGE, RAW_FIXTURE_PRICING_A, RAW_FIXTURE_PRICING_B,
} from '../../../../../src/knowledge/ai/contract/fixtures';

const usage = (key: string) => FIXTURE_USAGE.find((u) => u.attemptKey === key)!;
const [DESC_A] = FIXTURE_DESCRIPTORS;
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

function completed(over: Partial<NormalizedUsage['tokens']>, schema: { providerKey: string; modelKey: string }, units: Record<string, number> = {}): NormalizedUsage {
  return {
    contract: 'noetia.ai.usage', schemaVersion: 1, providerKey: schema.providerKey, modelKey: schema.modelKey,
    attemptKey: 'golden', startedAt: '2026-01-01T00:00:00Z', endedAt: '2026-01-01T00:00:01Z',
    tokens: { inputUncached: 0, cacheRead: 0, cacheWrite: {}, output: 0, ...over }, nonTokenUnits: units,
    outcome: 'completed', error: null, usageCompleteness: 'complete', zeroUsageEvidence: 'none',
  };
}

describe('priceUsage — golden vectors (hand-computed)', () => {
  it('fixture A, every class plus a non-token unit: 111,000 µUSD', () => {
    // 10,000×3,000,000 + 50,000×300,000 + 2,000×3,750,000 + 1,000×6,000,000 + 1,500×15,000,000 + 3×10,000,000,000
    // = 111,000,000,000 pico-USD = 111,000 µUSD
    const r = priceUsage(usage('a-completed'), FIXTURE_PRICING_A);
    expect(r).toMatchObject({ microUsd: 111_000n, tierIndex: -1 });
  });

  it('fixture A modifiers: batch ×0.5 = 55,500; batch + region ×1.1 = 61,050', () => {
    expect(priceUsage(usage('a-completed'), FIXTURE_PRICING_A, ['batch']).microUsd).toBe(55_500n);
    expect(priceUsage(usage('a-completed'), FIXTURE_PRICING_A, ['batch', 'region_eu']).microUsd).toBe(61_050n);
  });

  it('modifier results are identical in any input order; canonical order is batch, region*, then the rest', () => {
    const a = priceUsage(usage('a-completed'), FIXTURE_PRICING_A, ['batch', 'region_eu']);
    const b = priceUsage(usage('a-completed'), FIXTURE_PRICING_A, ['region_eu', 'batch']);
    expect(a.exact).toEqual(b.exact);
    expect(canonicalModifierOrder(['zeta', 'region_us', 'alpha', 'batch'])).toEqual(['batch', 'region_us', 'alpha', 'zeta']);
  });

  it('fixture B whole-request tier: 210,000 total input reprices every class → 454,000 µUSD', () => {
    // 150,000×2,000,000 + 40,000×200,000 + 20,000×2,500,000 + 2,000×12,000,000 + 6,000×12,000,000 = 454,000,000,000 pico
    expect(priceUsage(usage('b-completed-tier'), FIXTURE_PRICING_B)).toMatchObject({ microUsd: 454_000n, tierIndex: 0 });
  });

  it('tier boundary: exactly at the threshold stays on base; one above reprices', () => {
    const at = completed({ inputUncached: 200_000, output: 1_000 }, FIXTURE_PRICING_B);
    const above = completed({ inputUncached: 200_001, output: 1_000 }, FIXTURE_PRICING_B);
    expect(priceUsage(at, FIXTURE_PRICING_B)).toMatchObject({ microUsd: 208_000n, tierIndex: -1 });
    expect(priceUsage(above, FIXTURE_PRICING_B)).toMatchObject({ microUsd: 412_002n, tierIndex: 0 });
    expect(selectTier(FIXTURE_PRICING_B, 200_000n)).toBe(-1);
    expect(selectTier(FIXTURE_PRICING_B, 200_001n)).toBe(0);
  });

  it('fractional prices: 1 token at $0.01/M reserves 1 µUSD (ceiling) and settles 0 (half up)', () => {
    const tiny = assertPricingSchema({ ...clone(RAW_FIXTURE_PRICING_A), base: { inputUncached: 10_000, cacheRead: 0, cacheWrite: { '5m': 10_000, '1h': 10_000 }, output: 0, nonTokenUnits: { tool_call: 0 } } });
    expect(priceUsage(completed({ inputUncached: 1 }, tiny), tiny).microUsd).toBe(0n);
    expect(worstCaseCost(DESC_A, tiny, { inputTokens: 1, maxOutputTokens: 0, cacheIntent: { mode: 'none' }, nonTokenUnitBounds: { tool_call: 0 } }).microUsd).toBe(1n);
    // half-up boundary: 50 tokens = 0.5 µUSD → 1; 49 tokens = 0.49 µUSD → 0
    expect(priceUsage(completed({ inputUncached: 50 }, tiny), tiny).microUsd).toBe(1n);
    expect(priceUsage(completed({ inputUncached: 49 }, tiny), tiny).microUsd).toBe(0n);
  });

  it('is deterministic across repeated runs', () => {
    const first = priceUsage(usage('b-completed-tier'), FIXTURE_PRICING_B, ['batch']);
    for (let i = 0; i < 200; i++) expect(priceUsage(usage('b-completed-tier'), FIXTURE_PRICING_B, ['batch'])).toEqual(first);
  });

  it('zero-usage records price at zero', () => {
    expect(priceUsage(usage('a-invalid-evidenced'), FIXTURE_PRICING_A).microUsd).toBe(0n);
  });
});

describe('priceUsage / worstCaseCost — fail closed on invalid input', () => {
  it('overflow beyond the bigint column is denied', () => {
    const huge = assertPricingSchema({ ...clone(RAW_FIXTURE_PRICING_A), base: { ...clone(RAW_FIXTURE_PRICING_A.base), output: MAX_RATE } });
    expect(() => priceUsage(completed({ output: Number.MAX_SAFE_INTEGER }, huge), huge)).toThrow(expect.objectContaining({ code: 'overflow' }));
  });

  it('rejects a schema for another provider or model', () => {
    expect(() => priceUsage(usage('a-completed'), FIXTURE_PRICING_B)).toThrow(expect.objectContaining({ code: 'schema_mismatch' }));
    expect(() => worstCaseCost(DESC_A, FIXTURE_PRICING_B, { inputTokens: 1, maxOutputTokens: 1, cacheIntent: { mode: 'none' }, nonTokenUnitBounds: { tool_call: 0 } }))
      .toThrow(expect.objectContaining({ code: 'schema_mismatch' }));
  });

  it('rejects unknown modifiers, duplicate modifiers, unknown cache lifetimes, and unpriced units', () => {
    expect(() => priceUsage(usage('a-completed'), FIXTURE_PRICING_A, ['weekend'])).toThrow(expect.objectContaining({ code: 'unknown_modifier' }));
    expect(() => priceUsage(usage('a-completed'), FIXTURE_PRICING_A, ['batch', 'batch'])).toThrow(expect.objectContaining({ code: 'unknown_modifier' }));
    expect(() => priceUsage(completed({ cacheWrite: { '2h': 10 } }, FIXTURE_PRICING_A), FIXTURE_PRICING_A)).toThrow(ContractError);
    expect(() => priceUsage(completed({}, FIXTURE_PRICING_A, { image: 1 }), FIXTURE_PRICING_A)).toThrow(expect.objectContaining({ code: 'unpriced_unit' }));
  });

  it('rejects invalid usage records before pricing', () => {
    const bad = { ...completed({}, FIXTURE_PRICING_A), tokens: { inputUncached: -5, cacheRead: 0, cacheWrite: {}, output: 0 } };
    expect(() => priceUsage(bad, FIXTURE_PRICING_A)).toThrow(expect.objectContaining({ code: 'invalid_usage' }));
  });
});

describe('pricing schema validation', () => {
  it('accepts both fixtures', () => {
    expect(validatePricingSchema(RAW_FIXTURE_PRICING_A).ok).toBe(true);
    expect(validatePricingSchema(RAW_FIXTURE_PRICING_B).ok).toBe(true);
  });

  it.each([
    ['wrong schema version', (s: any) => { s.schemaVersion = 2; }],
    ['wrong currency', (s: any) => { s.currency = 'usd'; }],
    ['fractional rate', (s: any) => { s.base.output = 1.5; }],
    ['rate above the sanity bound', (s: any) => { s.base.output = MAX_RATE + 1; }],
    ['bad lifetime key', (s: any) => { s.base.cacheWrite = { forever: 1 }; }],
    ['non-increasing tier thresholds', (s: any) => { s.tiers.push({ aboveInputTokens: 200_000, rates: s.tiers[0].rates }); }],
    ['tier cheaper than base (non-monotone)', (s: any) => { s.tiers[0].rates.output = 1; }],
    ['tier with different lifetimes', (s: any) => { s.tiers[0].rates.cacheWrite = { '5m': 9_999_999 }; }],
    ['zero modifier', (s: any) => { s.modifiers.batch = 0; }],
    ['unknown top-level field', (s: any) => { s.prompt = 'text'; }],
    ['missing source note', (s: any) => { s.sourceNote = ''; }],
    ['bad date', (s: any) => { s.effectiveFrom = 'yesterday'; }],
  ])('rejects %s', (_label, mutate) => {
    const s = clone(RAW_FIXTURE_PRICING_B);
    mutate(s);
    expect(validatePricingSchema(s).ok).toBe(false);
    expect(() => assertPricingSchema(s)).toThrow(expect.objectContaining({ code: 'invalid_schema' }));
  });

  it('rejects non-objects', () => {
    expect(validatePricingSchema(null).ok).toBe(false);
    expect(validatePricingSchema([]).ok).toBe(false);
  });
});
