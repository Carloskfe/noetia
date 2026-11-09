import {
  AttemptBounds, CacheIntent, CapabilityDescriptor, conservativeInputTokens, NormalizedUsage, PricingSchema,
  priceUsage, unitsForUsage, worstCaseCost, worstCaseUnits,
} from '../../../../../src/knowledge/ai/contract';
import {
  FIXTURE_DESCRIPTORS, FIXTURE_PRICING_A, FIXTURE_PRICING_B, FIXTURE_UNIT_WEIGHTS, FIXTURE_USAGE,
} from '../../../../../src/knowledge/ai/contract/fixtures';

const [DESC_A, DESC_B] = FIXTURE_DESCRIPTORS;

/** Deterministic PRNG (mulberry32) so property runs are reproducible. */
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Split `total` into `parts` non-negative integers that sum to at most `total`. */
function split(rand: () => number, total: number, parts: number): number[] {
  const out: number[] = [];
  let left = total;
  for (let i = 0; i < parts; i++) {
    const n = Math.floor(rand() * (left + 1));
    out.push(n);
    left -= n;
  }
  return out;
}

interface Case { bounds: AttemptBounds; usage: NormalizedUsage; modifiers: string[] }

/** A random attempt whose actual usage respects its declared bounds and the descriptor. */
function randomCase(rand: () => number, d: CapabilityDescriptor, schema: PricingSchema): Case {
  const counted = Math.floor(rand() * 400_000);
  const inputTokens = conservativeInputTokens(d, counted);
  const lifetimes = d.features.cacheHints.lifetimes;
  const intents: CacheIntent[] = [{ mode: 'none' }, ...lifetimes.flatMap((l) => [{ mode: 'write' as const, lifetime: l }, { mode: 'uncertain' as const, lifetime: l }])];
  const cacheIntent = intents[Math.floor(rand() * intents.length)];
  const writeLifetimes = d.features.cacheHints.automaticWrites ? lifetimes : cacheIntent.mode === 'none' ? [] : [cacheIntent.lifetime];
  const [inputUncached, cacheRead, ...writes] = split(rand, counted, 2 + writeLifetimes.length);
  const cacheWrite = Object.fromEntries(writeLifetimes.map((l, i) => [l, writes[i]]));
  const maxOutputTokens = Math.floor(rand() * d.maxOutputTokens);
  let output: number; let reasoning: number | undefined;
  if (d.reasoning.mode === 'within_output') {
    [output, reasoning] = split(rand, maxOutputTokens, 2);
    if (rand() < 0.5) { output += reasoning; reasoning = undefined; }
  } else {
    output = Math.floor(rand() * (maxOutputTokens + 1));
    reasoning = Math.floor(rand() * (d.reasoning.maxReasoningTokens + 1));
  }
  const unitKeys = Object.keys(schema.base.nonTokenUnits ?? {});
  const nonTokenUnitBounds = Object.fromEntries(unitKeys.map((k) => [k, Math.floor(rand() * 20)]));
  const nonTokenUnits = Object.fromEntries(unitKeys.map((k) => [k, Math.floor(rand() * (nonTokenUnitBounds[k] + 1))]));
  const modKeys = Object.keys(schema.modifiers).filter(() => rand() < 0.5);
  const tokens: NormalizedUsage['tokens'] = { inputUncached, cacheRead, cacheWrite, output, ...(reasoning === undefined ? {} : { reasoning }) };
  return {
    bounds: { inputTokens, maxOutputTokens, cacheIntent, nonTokenUnitBounds },
    modifiers: modKeys,
    usage: {
      contract: 'noetia.ai.usage', schemaVersion: 1, providerKey: d.providerKey, modelKey: d.modelKey, attemptKey: 'prop',
      startedAt: '2026-01-01T00:00:00Z', endedAt: '2026-01-01T00:00:01Z', tokens, nonTokenUnits,
      outcome: 'completed', error: null, usageCompleteness: 'complete', zeroUsageEvidence: 'none',
    },
  };
}

describe('worstCaseCost is conservative (AC-3; property test, seeded)', () => {
  it.each([
    ['fixture A (lifetime cache writes, no tier)', DESC_A, FIXTURE_PRICING_A, 1],
    ['fixture B (whole-request tier, automatic writes, estimated counts, separate reasoning bound)', DESC_B, FIXTURE_PRICING_B, 2],
  ])('%s: worst case ≥ settled price for 4,000 random in-bound attempts', (_l, d, schema, seed) => {
    const rand = prng(seed as number);
    let tierCrossings = 0;
    for (let i = 0; i < 4000; i++) {
      const c = randomCase(rand, d as CapabilityDescriptor, schema as PricingSchema);
      const worst = worstCaseCost(d as CapabilityDescriptor, schema as PricingSchema, c.bounds, c.modifiers);
      const actual = priceUsage(c.usage, schema as PricingSchema, c.modifiers);
      expect(worst.microUsd >= actual.microUsd).toBe(true);
      if (worst.tierIndex !== actual.tierIndex) tierCrossings++;
    }
    if (schema === FIXTURE_PRICING_B) expect(tierCrossings).toBeGreaterThan(0); // the estimate pushed some reservations into the tier
  });

  it('worst-case units ≥ settled units for the same random attempts (fixture A and B)', () => {
    for (const [d, schema, seed] of [[DESC_A, FIXTURE_PRICING_A, 3], [DESC_B, FIXTURE_PRICING_B, 4]] as const) {
      const rand = prng(seed);
      for (let i = 0; i < 2000; i++) {
        const c = randomCase(rand, d, schema);
        expect(worstCaseUnits(d, FIXTURE_UNIT_WEIGHTS, c.bounds) >= unitsForUsage(c.usage, FIXTURE_UNIT_WEIGHTS)).toBe(true);
      }
    }
  });
});

describe('worstCaseCost — golden vectors (hand-computed)', () => {
  it('fixture A, 63,000 input with a 1-hour write intent, 1,500 output, 3 tool calls: 430,500 µUSD', () => {
    // 63,000 × max(3,000,000; 300,000; 6,000,000) + 1,500 × 15,000,000 + 3 × 10,000,000,000 = 430,500,000,000 pico
    const r = worstCaseCost(DESC_A, FIXTURE_PRICING_A, { inputTokens: 63_000, maxOutputTokens: 1_500, cacheIntent: { mode: 'write', lifetime: '1h' }, nonTokenUnitBounds: { tool_call: 3 } });
    expect(r.microUsd).toBe(430_500n);
    const actual = priceUsage(FIXTURE_USAGE.find((u) => u.attemptKey === 'a-completed')!, FIXTURE_PRICING_A);
    expect(r.microUsd >= actual.microUsd).toBe(true);
  });

  it('fixture A with no cache intent prices input at the uncached rate', () => {
    // 63,000 × 3,000,000 + 1,500 × 15,000,000 = 211,500,000,000 pico
    expect(worstCaseCost(DESC_A, FIXTURE_PRICING_A, { inputTokens: 63_000, maxOutputTokens: 1_500, cacheIntent: { mode: 'none' } }).microUsd).toBe(211_500n);
  });

  it('fixture B, 180,000 counted (×1.1 estimate = 198,000) stays on base: 407,500 µUSD', () => {
    const inputTokens = conservativeInputTokens(DESC_B, 180_000);
    expect(inputTokens).toBe(198_000);
    // 198,000 × 1,250,000 (automatic writes) + 4,000 × 8,000,000 + 16,000 × 8,000,000 (separate reasoning bound)
    const r = worstCaseCost(DESC_B, FIXTURE_PRICING_B, { inputTokens, maxOutputTokens: 4_000, cacheIntent: { mode: 'none' } });
    expect(r).toMatchObject({ microUsd: 407_500n, tierIndex: -1 });
  });

  it('fixture B, 190,000 counted (×1.1 = 209,000) is reserved at the tier: 762,500 µUSD', () => {
    const inputTokens = conservativeInputTokens(DESC_B, 190_000);
    expect(inputTokens).toBe(209_000);
    // 209,000 × 2,500,000 + 4,000 × 12,000,000 + 16,000 × 12,000,000
    expect(worstCaseCost(DESC_B, FIXTURE_PRICING_B, { inputTokens, maxOutputTokens: 4_000, cacheIntent: { mode: 'none' } }))
      .toMatchObject({ microUsd: 762_500n, tierIndex: 0 });
  });

  it('modifiers apply to the worst case too, rounded up', () => {
    // 211,500 × 0.5 × 1.1 = 116,325 exactly
    expect(worstCaseCost(DESC_A, FIXTURE_PRICING_A, { inputTokens: 63_000, maxOutputTokens: 1_500, cacheIntent: { mode: 'none' } }, ['region_eu', 'batch']).microUsd).toBe(116_325n);
  });

  it('units golden: a-completed settles 28.5 → 29 units (half up); the worst case reserves 135 units', () => {
    expect(unitsForUsage(FIXTURE_USAGE.find((u) => u.attemptKey === 'a-completed')!, FIXTURE_UNIT_WEIGHTS)).toBe(29n);
    // 63,000 × max(1000, 100, 2000) + 1,500 × 4000 + 3 × 1,000,000 = 135,000,000 → 135
    expect(worstCaseUnits(DESC_A, FIXTURE_UNIT_WEIGHTS, { inputTokens: 63_000, maxOutputTokens: 1_500, cacheIntent: { mode: 'uncertain', lifetime: '1h' }, nonTokenUnitBounds: { tool_call: 3 } })).toBe(135n);
  });
});

describe('worstCaseCost — bounds enforcement', () => {
  const b = (over: Partial<AttemptBounds>): AttemptBounds => ({ inputTokens: 1_000, maxOutputTokens: 100, cacheIntent: { mode: 'none' }, ...over });
  it('input above the context limit → context_too_large (caught before any reservation)', () => {
    expect(() => worstCaseCost(DESC_A, FIXTURE_PRICING_A, b({ inputTokens: 1_000_001 }))).toThrow(expect.objectContaining({ code: 'context_too_large' }));
  });
  it('output bound above the descriptor limit → output_bound_exceeded', () => {
    expect(() => worstCaseCost(DESC_A, FIXTURE_PRICING_A, b({ maxOutputTokens: 64_001 }))).toThrow(expect.objectContaining({ code: 'output_bound_exceeded' }));
  });
  it('unsupported cache lifetime → unknown_cache_lifetime', () => {
    expect(() => worstCaseCost(DESC_A, FIXTURE_PRICING_A, b({ cacheIntent: { mode: 'write', lifetime: '30m' } }))).toThrow(expect.objectContaining({ code: 'unknown_cache_lifetime' }));
  });
  it('unpriced non-token unit bound → unpriced_unit; negative bound → invalid_request', () => {
    expect(() => worstCaseCost(DESC_A, FIXTURE_PRICING_A, b({ nonTokenUnitBounds: { image: 1 } }))).toThrow(expect.objectContaining({ code: 'unpriced_unit' }));
    expect(() => worstCaseCost(DESC_A, FIXTURE_PRICING_A, b({ inputTokens: -1 }))).toThrow(expect.objectContaining({ code: 'invalid_request' }));
  });
});
