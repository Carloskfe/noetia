import {
  assertCapabilityDescriptor, assertNormalizedUsage, assertUnitWeightSchema, CapabilityDescriptor, conservativeInputTokens,
  declaresNoCharge, validateCapabilityDescriptor, validateNormalizedUsage, validateUnitWeightSchema,
} from '../../../../../src/knowledge/ai/contract';
import { FIXTURE_DESCRIPTORS, FIXTURE_UNIT_WEIGHTS, FIXTURE_USAGE } from '../../../../../src/knowledge/ai/contract/fixtures';

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

describe('fixtures are valid contract-v1 artifacts', () => {
  it('descriptors, usage, and unit weights all validate', () => {
    for (const d of FIXTURE_DESCRIPTORS) expect(validateCapabilityDescriptor(d)).toEqual({ ok: true, value: d });
    for (const u of FIXTURE_USAGE) expect(validateNormalizedUsage(u)).toMatchObject({ ok: true });
    expect(validateUnitWeightSchema(FIXTURE_UNIT_WEIGHTS).ok).toBe(true);
  });

  it('usage fixtures cover every outcome row with a usage record and every token class', () => {
    const rows = new Set(FIXTURE_USAGE.map((u) => `${u.outcome}/${u.error ?? 'none'}`));
    for (const r of ['completed/none', 'completed/malformed_output', 'refused/refusal', 'rejected/invalid_request', 'rejected/context_too_large',
      'rejected/rate_limited', 'failed/provider_unavailable', 'timed_out/timeout', 'aborted/client_abort', 'failed/internal']) expect(rows.has(r)).toBe(true);
    const t = FIXTURE_USAGE.map((u) => u.tokens);
    expect(t.some((x) => x.inputUncached > 0 && x.cacheRead > 0 && Object.keys(x.cacheWrite).length > 0 && x.output > 0)).toBe(true);
    expect(t.some((x) => (x.reasoning ?? 0) > 0)).toBe(true);
    expect(FIXTURE_USAGE.some((u) => Object.keys(u.nonTokenUnits).length > 0)).toBe(true);
  });
});

describe('capability descriptor validation', () => {
  it.each([
    ['wrong contract', (d: any) => { d.contract = 'x'; }],
    ['wrong schema version', (d: any) => { d.schemaVersion = 2; }],
    ['empty capabilities', (d: any) => { d.capabilities = []; }],
    ['non-integer context', (d: any) => { d.maxContextTokens = 1.5; }],
    ['bad lifetime', (d: any) => { d.features.cacheHints.lifetimes = ['soon']; }],
    ['automatic writes without lifetimes', (d: any) => { d.features.cacheHints = { lifetimes: [], automaticWrites: true }; }],
    ['estimated factor below 1.0', (d: any) => { d.tokenCountingMethod = { mode: 'estimated', conservativeFactorBps: 9_000 }; }],
    ['unknown counting mode', (d: any) => { d.tokenCountingMethod = { mode: 'guess' }; }],
    ['unknown reasoning mode', (d: any) => { d.reasoning = { mode: 'free' }; }],
    ['no-charge for an unknown category', (d: any) => { d.noChargeErrorClasses = [{ error: 'oops', documentationRef: 'x' }]; }],
    ['no-charge without a reference', (d: any) => { d.noChargeErrorClasses = [{ error: 'rate_limited', documentationRef: '' }]; }],
    ['unknown field', (d: any) => { d.apiKey = 'secret'; }],
  ])('rejects %s', (_l, mutate) => {
    const d = clone(FIXTURE_DESCRIPTORS[1]);
    mutate(d);
    expect(validateCapabilityDescriptor(d).ok).toBe(false);
    expect(() => assertCapabilityDescriptor(d)).toThrow(expect.objectContaining({ code: 'invalid_descriptor' }));
  });

  it('conservative token estimate rounds up and rejects invalid counts', () => {
    const [a, b] = FIXTURE_DESCRIPTORS as CapabilityDescriptor[];
    expect(conservativeInputTokens(a, 12_345)).toBe(12_345);
    expect(conservativeInputTokens(b, 1)).toBe(2);           // 1 × 1.1 = 1.1 → 2
    expect(conservativeInputTokens(b, 10)).toBe(11);
    expect(() => conservativeInputTokens(b, -1)).toThrow(expect.objectContaining({ code: 'invalid_request' }));
    expect(() => conservativeInputTokens(b, Number.MAX_SAFE_INTEGER)).toThrow(expect.objectContaining({ code: 'overflow' }));
    expect(declaresNoCharge(b, 'rate_limited')).toBe(true);
    expect(declaresNoCharge(a, 'rate_limited')).toBe(false);
  });
});

describe('normalized usage validation', () => {
  const base = () => clone(FIXTURE_USAGE.find((u) => u.attemptKey === 'a-completed')!) as any;
  it.each([
    ['content field (prompt text is never allowed)', (u: any) => { u.prompt = 'hello'; }],
    ['content inside tokens', (u: any) => { u.tokens.text = 'x'; }],
    ['negative count', (u: any) => { u.tokens.output = -1; }],
    ['unsafe integer', (u: any) => { u.tokens.output = Number.MAX_SAFE_INTEGER + 2; }],
    ['bad lifetime key', (u: any) => { u.tokens.cacheWrite = { eventually: 1 }; }],
    ['bad unit key', (u: any) => { u.nonTokenUnits = { 'Bad-Key': 1 }; }],
    ['outcome/error mismatch', (u: any) => { u.error = 'timeout'; }],
    ['completeness not allowed for the row', (u: any) => { u.usageCompleteness = 'unknown'; }],
    ['zero_confirmed without evidence', (u: any) => { Object.assign(u, { outcome: 'rejected', error: 'invalid_request', usageCompleteness: 'zero_confirmed', zeroUsageEvidence: 'none', tokens: { inputUncached: 0, cacheRead: 0, cacheWrite: {}, output: 0 }, nonTokenUnits: {} }); }],
    ['zero_confirmed with non-zero counts', (u: any) => { Object.assign(u, { outcome: 'rejected', error: 'invalid_request', usageCompleteness: 'zero_confirmed', zeroUsageEvidence: 'provider_reported_zero' }); }],
    ['evidence without zero_confirmed', (u: any) => { u.zeroUsageEvidence = 'provider_reported_zero'; }],
    ['not_sent has no usage record', (u: any) => { Object.assign(u, { outcome: 'not_sent', error: 'capability_unavailable' }); }],
    ['wrong schema version', (u: any) => { u.schemaVersion = 2; }],
    ['bad timestamp', (u: any) => { u.startedAt = 'now'; }],
  ])('rejects %s', (_l, mutate) => {
    const u = base();
    mutate(u);
    expect(validateNormalizedUsage(u).ok).toBe(false);
    expect(() => assertNormalizedUsage(u)).toThrow(expect.objectContaining({ code: 'invalid_usage' }));
  });
  it('rejects non-objects', () => expect(validateNormalizedUsage('x').ok).toBe(false));
});

describe('unit-weight schema validation', () => {
  it.each([
    ['wrong contract', (w: any) => { w.contract = 'x'; }],
    ['fractional weight', (w: any) => { w.weights.output = 0.5; }],
    ['tiers are not allowed', (w: any) => { w.tiers = []; }],
    ['bad version', (w: any) => { w.version = 0; }],
  ])('rejects %s', (_l, mutate) => {
    const w = clone(FIXTURE_UNIT_WEIGHTS) as any;
    mutate(w);
    expect(validateUnitWeightSchema(w).ok).toBe(false);
    expect(() => assertUnitWeightSchema(w)).toThrow(expect.objectContaining({ code: 'invalid_schema' }));
  });
});
