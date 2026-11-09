import {
  assertCapabilityDescriptor, assertPricingSchema, assertUnitWeightSchema, AttemptBounds, CacheIntent, conservativeInputTokens, NormalizedUsage, priceUsage, unitsForUsage,
  ValidatedCapabilityDescriptor as CapabilityDescriptor, ValidatedPricingSchema as PricingSchema, worstCaseCost, worstCaseUnits,
} from '../../../../../src/knowledge/ai/contract';
import {
  FIXTURE_DESCRIPTORS, FIXTURE_PRICING_A, FIXTURE_PRICING_B, FIXTURE_UNIT_WEIGHTS, FIXTURE_USAGE,
  RAW_FIXTURE_DESCRIPTORS, RAW_FIXTURE_PRICING_A, RAW_FIXTURE_UNIT_WEIGHTS,
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
  const unitKeys = [...d.nonTokenUnits];  // F-5: a bound for every declared unit
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
    expect(worstCaseCost(DESC_A, FIXTURE_PRICING_A, { inputTokens: 63_000, maxOutputTokens: 1_500, cacheIntent: { mode: 'none' }, nonTokenUnitBounds: { tool_call: 0 } }).microUsd).toBe(211_500n);
  });

  it('fixture B, 180,000 counted (×1.1 estimate = 198,000) stays on base: 407,500 µUSD', () => {
    const inputTokens = conservativeInputTokens(DESC_B, 180_000);
    expect(inputTokens).toBe(198_000);
    // 198,000 × 1,250,000 (automatic writes) + 4,000 × 8,000,000 + 16,000 × 8,000,000 (separate reasoning bound)
    const r = worstCaseCost(DESC_B, FIXTURE_PRICING_B, { inputTokens, maxOutputTokens: 4_000, cacheIntent: { mode: 'none' }, nonTokenUnitBounds: {} });
    expect(r).toMatchObject({ microUsd: 407_500n, tierIndex: -1 });
  });

  it('fixture B, 190,000 counted (×1.1 = 209,000) is reserved at the tier: 762,500 µUSD', () => {
    const inputTokens = conservativeInputTokens(DESC_B, 190_000);
    expect(inputTokens).toBe(209_000);
    // 209,000 × 2,500,000 + 4,000 × 12,000,000 + 16,000 × 12,000,000
    expect(worstCaseCost(DESC_B, FIXTURE_PRICING_B, { inputTokens, maxOutputTokens: 4_000, cacheIntent: { mode: 'none' }, nonTokenUnitBounds: {} }))
      .toMatchObject({ microUsd: 762_500n, tierIndex: 0 });
  });

  it('modifiers apply to the worst case too, rounded up', () => {
    // 211,500 × 0.5 × 1.1 = 116,325 exactly
    expect(worstCaseCost(DESC_A, FIXTURE_PRICING_A, { inputTokens: 63_000, maxOutputTokens: 1_500, cacheIntent: { mode: 'none' }, nonTokenUnitBounds: { tool_call: 0 } }, ['region_eu', 'batch']).microUsd).toBe(116_325n);
  });

  it('units golden: a-completed settles 28.5 → 29 units (half up); the worst case reserves 135 units', () => {
    expect(unitsForUsage(FIXTURE_USAGE.find((u) => u.attemptKey === 'a-completed')!, FIXTURE_UNIT_WEIGHTS)).toBe(29n);
    // 63,000 × max(1000, 100, 2000) + 1,500 × 4000 + 3 × 1,000,000 = 135,000,000 → 135
    expect(worstCaseUnits(DESC_A, FIXTURE_UNIT_WEIGHTS, { inputTokens: 63_000, maxOutputTokens: 1_500, cacheIntent: { mode: 'uncertain', lifetime: '1h' }, nonTokenUnitBounds: { tool_call: 3 } })).toBe(135n);
  });
});

describe('worstCaseCost — bounds enforcement', () => {
  const b = (over: Partial<AttemptBounds>): AttemptBounds => ({ inputTokens: 1_000, maxOutputTokens: 100, cacheIntent: { mode: 'none' }, nonTokenUnitBounds: { tool_call: 0 }, ...over });
  it('input above the context limit → context_too_large (caught before any reservation)', () => {
    expect(() => worstCaseCost(DESC_A, FIXTURE_PRICING_A, b({ inputTokens: 1_000_001 }))).toThrow(expect.objectContaining({ code: 'context_too_large' }));
  });
  it('output bound above the descriptor limit → output_bound_exceeded', () => {
    expect(() => worstCaseCost(DESC_A, FIXTURE_PRICING_A, b({ maxOutputTokens: 64_001 }))).toThrow(expect.objectContaining({ code: 'output_bound_exceeded' }));
  });
  it('unsupported cache lifetime → unknown_cache_lifetime', () => {
    expect(() => worstCaseCost(DESC_A, FIXTURE_PRICING_A, b({ cacheIntent: { mode: 'write', lifetime: '30m' } }))).toThrow(expect.objectContaining({ code: 'unknown_cache_lifetime' }));
  });
  it('bound for an undeclared unit → unit_declaration_mismatch; negative bound → invalid_request', () => {
    expect(() => worstCaseCost(DESC_A, FIXTURE_PRICING_A, b({ nonTokenUnitBounds: { tool_call: 0, image: 1 } }))).toThrow(expect.objectContaining({ code: 'unit_declaration_mismatch' }));
    expect(() => worstCaseCost(DESC_A, FIXTURE_PRICING_A, b({ inputTokens: -1 }))).toThrow(expect.objectContaining({ code: 'invalid_request' }));
  });
});

// ─── F-5: non-token unit bounds — nothing billable may be silently omitted ───────────────────────

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const code = (c: string) => expect.objectContaining({ code: c });

/** A descriptor/pricing/weights triple, built through the validation boundary, declaring `units`. */
function withUnits(units: string[], rates: Record<string, number>) {
  const d = clone(RAW_FIXTURE_DESCRIPTORS[0]) as any;
  d.nonTokenUnits = units;
  const p = clone(RAW_FIXTURE_PRICING_A) as any;
  p.base.nonTokenUnits = Object.fromEntries(units.map((u) => [u, rates[u]]));
  const w = clone(RAW_FIXTURE_UNIT_WEIGHTS) as any;
  w.weights.nonTokenUnits = Object.fromEntries(units.map((u) => [u, rates[u]]));
  return { d: assertCapabilityDescriptor(d), p: assertPricingSchema(p), w: assertUnitWeightSchema(w) };
}

describe('F-5 — every declared non-token unit needs an explicit bound (negative)', () => {
  const base = { inputTokens: 1_000, maxOutputTokens: 100, cacheIntent: { mode: 'none' as const } };

  it.each([
    ['empty bounds while the descriptor declares tool_call', {}],
    ['bounds omitted entirely', undefined],
    ['bounds null', null],
    ['bounds as an array', []],
    ['bounds as a number', 3],
  ])('%s → missing_unit_bound (cost and units)', (_l, nonTokenUnitBounds) => {
    const b = { ...base, nonTokenUnitBounds } as unknown as AttemptBounds;
    expect(() => worstCaseCost(DESC_A, FIXTURE_PRICING_A, b)).toThrow(code('missing_unit_bound'));
    expect(() => worstCaseUnits(DESC_A, FIXTURE_UNIT_WEIGHTS, b)).toThrow(code('missing_unit_bound'));
  });

  it('an inherited key ("constructor") is not an explicit bound', () => {
    const { d, p, w } = withUnits(['constructor'], { constructor: 5_000_000 });
    expect(() => worstCaseCost(d, p, { ...base, nonTokenUnitBounds: {} })).toThrow(code('missing_unit_bound'));
    expect(() => worstCaseUnits(d, w, { ...base, nonTokenUnitBounds: {} })).toThrow(code('missing_unit_bound'));
    // …while an own bound for it is priced normally: 1,000 × 3 + 100 × 15 + 2 × 5 (µUSD per million → µUSD)
    expect(worstCaseCost(d, p, { ...base, nonTokenUnitBounds: { constructor: 2 } }).microUsd).toBe(3_000n + 1_500n + 10n);
  });

  it('a bound for a unit the descriptor does not declare → unit_declaration_mismatch', () => {
    expect(() => worstCaseCost(DESC_B, FIXTURE_PRICING_B, { ...base, nonTokenUnitBounds: { tool_call: 1 } })).toThrow(code('unit_declaration_mismatch'));
  });

  it('schema prices a unit the descriptor does not declare → unit_declaration_mismatch', () => {
    const d = clone(RAW_FIXTURE_DESCRIPTORS[0]) as any;
    d.nonTokenUnits = [];  // claims "no non-token operations" but the schema bills tool_call
    expect(() => worstCaseCost(assertCapabilityDescriptor(d), FIXTURE_PRICING_A, { ...base, nonTokenUnitBounds: {} })).toThrow(code('unit_declaration_mismatch'));
  });

  it('descriptor declares a unit the schema does not price → unit_declaration_mismatch', () => {
    const d = clone(RAW_FIXTURE_DESCRIPTORS[0]) as any;
    d.nonTokenUnits = ['tool_call', 'web_search'];
    expect(() => worstCaseCost(assertCapabilityDescriptor(d), FIXTURE_PRICING_A, { ...base, nonTokenUnitBounds: { tool_call: 0, web_search: 0 } }))
      .toThrow(code('unit_declaration_mismatch'));
  });

  it('unit weights that do not weight a declared unit → unpriced_unit', () => {
    const d = clone(RAW_FIXTURE_DESCRIPTORS[0]) as any;
    d.nonTokenUnits = ['web_search'];
    expect(() => worstCaseUnits(assertCapabilityDescriptor(d), FIXTURE_UNIT_WEIGHTS, { ...base, nonTokenUnitBounds: { web_search: 1 } }))
      .toThrow(code('unpriced_unit'));
  });

  it.each([['negative', -1], ['fractional', 1.5], ['NaN', NaN], ['string', '3'], ['unsafe', Number.MAX_SAFE_INTEGER + 2]])(
    'inconsistent bound (%s) → invalid_request', (_l, n) => {
      const b = { ...base, nonTokenUnitBounds: { tool_call: n } } as unknown as AttemptBounds;
      expect(() => worstCaseCost(DESC_A, FIXTURE_PRICING_A, b)).toThrow(code('invalid_request'));
      expect(() => worstCaseUnits(DESC_A, FIXTURE_UNIT_WEIGHTS, b)).toThrow(code('invalid_request'));
    });

  it('an explicit 0 bound is the validated "operation unavailable for this attempt"', () => {
    const zero = worstCaseCost(DESC_A, FIXTURE_PRICING_A, { ...base, nonTokenUnitBounds: { tool_call: 0 } });
    const one = worstCaseCost(DESC_A, FIXTURE_PRICING_A, { ...base, nonTokenUnitBounds: { tool_call: 1 } });
    expect(one.microUsd - zero.microUsd).toBe(10_000n);  // 10,000,000,000 µUSD/M = 10,000 µUSD per tool call
  });

  it('a descriptor that declares no units (validated empty list) prices with {}', () => {
    expect(() => worstCaseCost(DESC_B, FIXTURE_PRICING_B, { ...base, nonTokenUnitBounds: {} })).not.toThrow();
  });
});

describe('F-5 — conservative reservation with arbitrary declared units (property test, seeded)', () => {
  const POOL = ['tool_call', 'web_search', 'image', 'code_exec', 'constructor', 'to_string'];

  it('reservation ≥ settlement for in-bound usage; dropping any declared bound fails closed', () => {
    const rand = prng(51);
    let cases = 0;
    for (let i = 0; i < 400; i++) {
      const units = POOL.filter(() => rand() < 0.5);
      const rates = Object.fromEntries(units.map((u) => [u, Math.floor(rand() * 50_000_000_000)]));
      const { d, p, w } = withUnits(units, rates);
      for (let j = 0; j < 10; j++) {
        const c = randomCase(rand, d, p);
        expect(worstCaseCost(d, p, c.bounds, c.modifiers).microUsd >= priceUsage(c.usage, p, c.modifiers).microUsd).toBe(true);
        expect(worstCaseUnits(d, w, c.bounds) >= unitsForUsage(c.usage, w)).toBe(true);
        for (const omit of units) {
          const partial = { ...c.bounds, nonTokenUnitBounds: Object.fromEntries(Object.entries(c.bounds.nonTokenUnitBounds).filter(([k]) => k !== omit)) };
          expect(() => worstCaseCost(d, p, partial, c.modifiers)).toThrow(code('missing_unit_bound'));
          expect(() => worstCaseUnits(d, w, partial)).toThrow(code('missing_unit_bound'));
        }
        cases++;
      }
    }
    expect(cases).toBe(4000);
  });

  it('raising any unit bound never lowers the reservation (monotone in every declared unit)', () => {
    const rand = prng(52);
    for (let i = 0; i < 300; i++) {
      const units = POOL.filter(() => rand() < 0.6);
      if (units.length === 0) continue;
      const { d, p } = withUnits(units, Object.fromEntries(units.map((u) => [u, Math.floor(rand() * 50_000_000_000)])));
      const c = randomCase(rand, d, p);
      const before = worstCaseCost(d, p, c.bounds, c.modifiers).microUsd;
      const k = units[Math.floor(rand() * units.length)];
      const raised = { ...c.bounds, nonTokenUnitBounds: { ...c.bounds.nonTokenUnitBounds, [k]: c.bounds.nonTokenUnitBounds[k] + 1 + Math.floor(rand() * 5) } };
      expect(worstCaseCost(d, p, raised, c.modifiers).microUsd >= before).toBe(true);
    }
  });
});
