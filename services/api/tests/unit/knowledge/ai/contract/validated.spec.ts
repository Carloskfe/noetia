import {
  assertCapabilityDescriptor, assertPricingSchema, assertUnitWeightSchema, AttemptBounds, conservativeInputTokens,
  declaresNoCharge, isValidated, MAX_RATE, priceUsage, requireValidated, unitsForUsage, worstCaseCost, worstCaseUnits,
} from '../../../../../src/knowledge/ai/contract';
import {
  FIXTURE_DESCRIPTORS, FIXTURE_PRICING_A, FIXTURE_UNIT_WEIGHTS, FIXTURE_USAGE,
  RAW_FIXTURE_DESCRIPTORS, RAW_FIXTURE_PRICING_A, RAW_FIXTURE_PRICING_B, RAW_FIXTURE_UNIT_WEIGHTS,
} from '../../../../../src/knowledge/ai/contract/fixtures';
import * as validatedModule from '../../../../../src/knowledge/ai/contract/validated';

/**
 * F-6: monetary calculations accept configuration only from its validator (`assert*`), which is
 * the single runtime boundary. These tests prove nothing malformed or unvalidated gets past it.
 */

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const code = (c: string) => expect.objectContaining({ code: c });
const any = (x: unknown) => x as any;
const [DESC_A] = FIXTURE_DESCRIPTORS;
const USAGE_A = FIXTURE_USAGE.find((u) => u.attemptKey === 'a-completed')!;
const BOUNDS: AttemptBounds = { inputTokens: 1_000, maxOutputTokens: 100, cacheIntent: { mode: 'none' }, nonTokenUnitBounds: { tool_call: 1 } };

/** Every monetary entry point, with one config argument replaced by `x`. */
const ENTRY_POINTS: [string, 'pricing' | 'weights' | 'descriptor', (x: unknown) => unknown][] = [
  ['priceUsage(schema)', 'pricing', (x) => priceUsage(USAGE_A, any(x))],
  ['worstCaseCost(schema)', 'pricing', (x) => worstCaseCost(DESC_A, any(x), BOUNDS)],
  ['worstCaseCost(descriptor)', 'descriptor', (x) => worstCaseCost(any(x), FIXTURE_PRICING_A, BOUNDS)],
  ['unitsForUsage(schema)', 'weights', (x) => unitsForUsage(USAGE_A, any(x))],
  ['worstCaseUnits(schema)', 'weights', (x) => worstCaseUnits(DESC_A, any(x), BOUNDS)],
  ['worstCaseUnits(descriptor)', 'descriptor', (x) => worstCaseUnits(any(x), FIXTURE_UNIT_WEIGHTS, BOUNDS)],
  ['conservativeInputTokens(descriptor)', 'descriptor', (x) => conservativeInputTokens(any(x), 10)],
  ['declaresNoCharge(descriptor)', 'descriptor', (x) => declaresNoCharge(any(x), 'rate_limited')],
];

const RAW = { pricing: RAW_FIXTURE_PRICING_A, weights: RAW_FIXTURE_UNIT_WEIGHTS, descriptor: RAW_FIXTURE_DESCRIPTORS[0] };
const SEALED = { pricing: FIXTURE_PRICING_A, weights: FIXTURE_UNIT_WEIGHTS, descriptor: DESC_A };
const OTHER_KIND = { pricing: FIXTURE_UNIT_WEIGHTS, weights: FIXTURE_PRICING_A, descriptor: FIXTURE_PRICING_A };

describe('F-6 — monetary functions accept only validator-sealed configuration', () => {
  it.each(ENTRY_POINTS)('%s: the sealed config is accepted', (_l, kind, call) => {
    expect(() => call(SEALED[kind])).not.toThrow();
  });

  it.each(ENTRY_POINTS)('%s: a raw (well-formed but unvalidated) object → unvalidated_config', (_l, kind, call) => {
    expect(() => call(RAW[kind])).toThrow(code('unvalidated_config'));
  });

  it.each(ENTRY_POINTS)('%s: a spread or JSON copy of a sealed object is not sealed', (_l, kind, call) => {
    expect(() => call({ ...SEALED[kind] })).toThrow(code('unvalidated_config'));
    expect(() => call(clone(SEALED[kind]))).toThrow(code('unvalidated_config'));
  });

  it.each(ENTRY_POINTS)('%s: a sealed object of the wrong kind → unvalidated_config', (_l, kind, call) => {
    expect(() => call(OTHER_KIND[kind])).toThrow(code('unvalidated_config'));
  });

  it.each(ENTRY_POINTS)('%s: null, undefined, and primitives → unvalidated_config', (_l, _kind, call) => {
    for (const x of [null, undefined, 0, 'schema', true]) expect(() => call(x)).toThrow(code('unvalidated_config'));
  });
});

describe('F-6 — malformed configuration cannot reach a calculation', () => {
  const MALFORMED_PRICING: [string, (s: any) => void][] = [
    ['negative rate', (s) => { s.base.inputUncached = -1; }],
    ['fractional rate', (s) => { s.base.output = 0.5; }],
    ['string rate', (s) => { s.base.output = '15000000'; }],
    ['rate above MAX_RATE', (s) => { s.base.cacheRead = MAX_RATE + 1; }],
    ['negative non-token unit rate', (s) => { s.base.nonTokenUnits.tool_call = -5; }],
    ['tier below base (non-monotone)', (s) => { s.tiers[0].rates.inputUncached = 1; }],
    ['tier thresholds not increasing', (s) => { s.tiers.push(clone(s.tiers[0])); }],
    ['tier with a missing rate class', (s) => { delete s.tiers[0].rates.output; }],
    ['tier with an extra unit', (s) => { s.tiers[0].rates.nonTokenUnits = { ...s.tiers[0].rates.nonTokenUnits, image: 1 }; }],
    ['modifier of 0 bps', (s) => { s.modifiers = { batch: 0 }; }],
    ['negative modifier', (s) => { s.modifiers = { batch: -5000 }; }],
    ['fractional modifier', (s) => { s.modifiers = { batch: 5000.5 }; }],
    ['modifier with an invalid key', (s) => { s.modifiers = { 'Batch Mode': 5000 }; }],
  ];

  it.each(MALFORMED_PRICING)('pricing with %s: rejected at the boundary and unusable directly', (_l, mutate) => {
    const s = clone(RAW_FIXTURE_PRICING_B) as any;
    if (!s.base.nonTokenUnits) s.base.nonTokenUnits = { tool_call: 1 };
    for (const t of s.tiers) if (!t.rates.nonTokenUnits) t.rates.nonTokenUnits = { tool_call: 2 };
    expect(() => assertPricingSchema(s)).not.toThrow(); // the unmutated baseline is valid
    mutate(s);
    expect(() => assertPricingSchema(s)).toThrow(code('invalid_schema'));
    expect(() => priceUsage(USAGE_A, s)).toThrow(code('unvalidated_config'));
  });

  it.each([
    ['negative weight', (w: any) => { w.weights.output = -1; }],
    ['fractional weight', (w: any) => { w.weights.inputUncached = 1.25; }],
    ['tiers smuggled in', (w: any) => { w.tiers = []; }],
  ])('unit weights with %s: rejected at the boundary and unusable directly', (_l, mutate) => {
    const w = clone(RAW_FIXTURE_UNIT_WEIGHTS) as any;
    mutate(w);
    expect(() => assertUnitWeightSchema(w)).toThrow(code('invalid_schema'));
    expect(() => unitsForUsage(USAGE_A, w)).toThrow(code('unvalidated_config'));
  });

  it.each([
    ['negative context limit', (d: any) => { d.maxContextTokens = -1; }],
    ['estimated counting without a factor', (d: any) => { d.tokenCountingMethod = { mode: 'estimated' }; }],
    ['factor below 1.0 (would under-reserve)', (d: any) => { d.tokenCountingMethod = { mode: 'estimated', conservativeFactorBps: 9000 }; }],
    ['missing non-token unit declaration', (d: any) => { delete d.nonTokenUnits; }],
    ['unknown field', (d: any) => { d.apiKey = 'secret'; }],
  ])('descriptor with %s: rejected at the boundary and unusable directly', (_l, mutate) => {
    const d = clone(RAW_FIXTURE_DESCRIPTORS[0]) as any;
    mutate(d);
    expect(() => assertCapabilityDescriptor(d)).toThrow(code('invalid_descriptor'));
    expect(() => worstCaseCost(d, FIXTURE_PRICING_A, BOUNDS)).toThrow(code('unvalidated_config'));
  });
});

describe('F-6 — sealed configuration is immutable and detached from its input', () => {
  it('sealed objects are deep-frozen: rates, tiers, modifiers, and descriptor fields cannot change', () => {
    const s = assertPricingSchema(clone(RAW_FIXTURE_PRICING_B));
    expect(() => { any(s).base.output = 0; }).toThrow(TypeError);
    expect(() => { any(s).tiers[0].rates.inputUncached = 0; }).toThrow(TypeError);
    expect(() => { any(s).tiers.push({}); }).toThrow(TypeError);
    expect(() => { any(s).modifiers.batch = 1; }).toThrow(TypeError);
    expect(() => { any(DESC_A).nonTokenUnits.pop(); }).toThrow(TypeError);
    expect(() => { any(DESC_A).maxOutputTokens = 1e9; }).toThrow(TypeError);
    expect(() => { any(FIXTURE_UNIT_WEIGHTS).weights.output = 0; }).toThrow(TypeError);
  });

  it('mutating the input after validation does not affect the sealed copy', () => {
    const raw = clone(RAW_FIXTURE_PRICING_A) as any;
    const sealed = assertPricingSchema(raw);
    const before = priceUsage(USAGE_A, sealed).microUsd;
    raw.base.output = 0;
    raw.base.inputUncached = 0;
    expect(priceUsage(USAGE_A, sealed).microUsd).toBe(before);
    expect(before).toBeGreaterThan(0n);
  });

  it('validation happens once: repeated calculations reuse the same sealed object', () => {
    const sealed = assertPricingSchema(clone(RAW_FIXTURE_PRICING_A));
    expect(isValidated(sealed, 'pricing schema')).toBe(true);
    const results = Array.from({ length: 100 }, () => priceUsage(USAGE_A, sealed).microUsd);
    expect(new Set(results).size).toBe(1);
  });

  it('requireValidated / isValidated distinguish kinds', () => {
    expect(isValidated(DESC_A, 'capability descriptor')).toBe(true);
    expect(isValidated(DESC_A, 'pricing schema')).toBe(false);
    expect(isValidated(RAW_FIXTURE_DESCRIPTORS[0], 'capability descriptor')).toBe(false);
    expect(() => requireValidated(FIXTURE_UNIT_WEIGHTS, 'unit-weight schema')).not.toThrow();
    expect(() => requireValidated(FIXTURE_UNIT_WEIGHTS, 'capability descriptor')).toThrow(code('unvalidated_config'));
  });
});

describe('F-7 — configuration cannot be sealed without its designated validator', () => {
  const { validateAndSeal } = validatedModule;
  const malformed = {
    'pricing schema': () => { const s = clone(RAW_FIXTURE_PRICING_A) as any; s.base.output = -1; return s; },
    'unit-weight schema': () => { const w = clone(RAW_FIXTURE_UNIT_WEIGHTS) as any; w.weights.output = 1.5; return w; },
    'capability descriptor': () => { const d = clone(RAW_FIXTURE_DESCRIPTORS[0]) as any; delete d.nonTokenUnits; return d; },
  } as const;
  const CODES = { 'pricing schema': 'invalid_schema', 'unit-weight schema': 'invalid_schema', 'capability descriptor': 'invalid_descriptor' } as const;

  it('the module exposes no way to register an object other than validateAndSeal', () => {
    expect(any(validatedModule).sealValidated).toBeUndefined();
    expect(any(validatedModule).seal).toBeUndefined();
    expect(any(validatedModule).registry).toBeUndefined();
  });

  it.each(Object.keys(malformed) as (keyof typeof malformed)[])('%s: validateAndSeal runs the designated validator and refuses malformed input', (kind) => {
    const bad = malformed[kind]();
    expect(() => validateAndSeal(kind, bad)).toThrow(code(CODES[kind]));
    expect(isValidated(bad, kind)).toBe(false);
  });

  it('a value valid for one kind cannot be sealed as another kind', () => {
    expect(() => validateAndSeal('capability descriptor', clone(RAW_FIXTURE_PRICING_A))).toThrow(code('invalid_descriptor'));
    expect(() => validateAndSeal('pricing schema', clone(RAW_FIXTURE_DESCRIPTORS[0]))).toThrow(code('invalid_schema'));
    expect(() => validateAndSeal('unit-weight schema', clone(RAW_FIXTURE_PRICING_A))).toThrow(code('invalid_schema'));
  });

  it.each([['an unknown kind', 'free pass'], ['a prototype key', 'constructor'], ['a prototype key', '__proto__']])(
    '%s (%s) cannot be used to seal anything', (_l, kind) => {
      expect(() => validateAndSeal(any(kind), clone(RAW_FIXTURE_PRICING_A))).toThrow(code('unvalidated_config'));
    });

  it('the assert* validators and validateAndSeal are one path: same validation, same sealed shape', () => {
    const viaAssert = assertPricingSchema(clone(RAW_FIXTURE_PRICING_A));
    const viaSeal = validateAndSeal('pricing schema', clone(RAW_FIXTURE_PRICING_A));
    expect(viaSeal).toEqual(viaAssert);
    expect(isValidated(viaSeal, 'pricing schema')).toBe(true);
    expect(Object.isFrozen(viaSeal)).toBe(true);
    expect(priceUsage(USAGE_A, any(viaSeal)).microUsd).toBe(priceUsage(USAGE_A, viaAssert).microUsd);
  });
});
