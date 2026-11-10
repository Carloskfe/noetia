import { assertPricingSchema, ValidatedCapabilityDescriptor } from '../../../../../src/knowledge/ai/contract';
import { AdapterEvent, AdapterRequest, ProviderAdapter } from '../../../../../src/knowledge/ai/gateway/gateway.types';
import { RAW_SIMULATOR_PRICING, SIMULATOR_DESCRIPTORS } from '../../../../../src/knowledge/ai/simulator/simulator-fixtures';
import { SimStep, SimulatorV2Adapter } from '../../../../../src/knowledge/ai/simulator/simulator-v2';
import {
  AdapterFactory, checkProviderContract, checkScenario, ContractScenario, GoldenVector, runProviderContract,
} from './support/provider-contract';

const STEP: Record<ContractScenario, SimStep | null> = {
  success: { kind: 'success' },
  citations: { kind: 'success' },
  structured_valid: { kind: 'success', structured: { answer: 'An invented answer.' } },
  structured_malformed: { kind: 'malformed' },
  refusal_complete: { kind: 'refusal', category: 'policy', completeness: 'complete' },
  refusal_partial: { kind: 'refusal', category: 'policy', completeness: 'partial' },
  invalid_request_unevidenced: { kind: 'reject', error: 'invalid_request', evidence: 'none' },
  invalid_request_reported_zero: { kind: 'reject', error: 'invalid_request', evidence: 'provider_reported_zero' },
  context_too_large_unevidenced: { kind: 'reject', error: 'context_too_large', evidence: 'none' },
  rate_limited_unevidenced: { kind: 'reject', error: 'rate_limited', evidence: 'none', retryAfterMs: 0 },
  rate_limited_reported_zero: { kind: 'reject', error: 'rate_limited', evidence: 'provider_reported_zero', retryAfterMs: 0 },
  rate_limited_documented: { kind: 'reject', error: 'rate_limited', evidence: 'documented_no_charge', retryAfterMs: 0 },
  provider_unavailable_unevidenced: { kind: 'unavailable' },
  timeout: { kind: 'timeout' },
  client_abort: { kind: 'timeout' },
  partial_stream_abort: { kind: 'partial_stream', deltas: 3, then: 'hang' },
  cache: null,
};

function simulatorFactory(index: 0 | 1): AdapterFactory {
  const descriptor = SIMULATOR_DESCRIPTORS[index];
  const pricing = assertPricingSchema(RAW_SIMULATOR_PRICING[index]);
  return (scenario) => {
    if (scenario === 'rate_limited_documented' && !descriptor.noChargeErrorClasses.some((c) => c.error === 'rate_limited')) return null;
    const adapter = new SimulatorV2Adapter(descriptor, { seed: 'contract' });
    const step = STEP[scenario];
    if (step) adapter.enqueue(step);
    if (scenario === 'cache') adapter.enqueue({ kind: 'success' }, { kind: 'success' });
    return { adapter, pricing };
  };
}

/** E1 golden vectors, hand-computed (µUSD). Standard = fixture A rates; long-context = fixture B rates and tier. */
const GOLDEN_STANDARD: GoldenVector[] = [{
  label: 'a-completed (E1 pricing.spec)', expectedMicroUsd: 111_000n, nonTokenUnits: { tool_call: 3 },
  tokens: { inputUncached: 10_000, cacheRead: 50_000, cacheWrite: { '5m': 2_000, '1h': 1_000 }, output: 1_500 },
}];
const GOLDEN_LONG: GoldenVector[] = [
  { label: 'base tier (170,000 input)', expectedMicroUsd: 154_000n, nonTokenUnits: {},
    tokens: { inputUncached: 100_000, cacheRead: 50_000, cacheWrite: { '30m': 20_000 }, output: 2_000, reasoning: 1_000 } },
  { label: 'whole request repriced (220,000 input > 200,000)', expectedMicroUsd: 396_000n, nonTokenUnits: {},
    tokens: { inputUncached: 150_000, cacheRead: 50_000, cacheWrite: { '30m': 20_000 }, output: 2_000, reasoning: 1_000 } },
];

// AC-7: the reusable suite passes against simulator v2 (both models).
runProviderContract('simulator v2 / sim-standard', simulatorFactory(0), { goldenVectors: GOLDEN_STANDARD });
runProviderContract('simulator v2 / sim-long-context', simulatorFactory(1), { goldenVectors: GOLDEN_LONG });

// ── Self-test: deliberately broken adapters must fail the suite ──────────────────────────────────────────────

type Mutator = (events: AdapterEvent[], req: AdapterRequest) => AdapterEvent[];

/** Wraps the simulator and rewrites its stream to break one contract rule. */
class BrokenAdapter implements ProviderAdapter {
  readonly simulated = true;
  constructor(private readonly inner: SimulatorV2Adapter, private readonly mutate: Mutator, private readonly ignoreAbort = false) {}
  get descriptor(): ValidatedCapabilityDescriptor { return this.inner.descriptor; }
  countTokens(...a: Parameters<ProviderAdapter['countTokens']>) { return this.inner.countTokens(...a); }
  async *invoke(req: AdapterRequest, signal: AbortSignal): AsyncGenerator<AdapterEvent> {
    if (this.ignoreAbort) { await new Promise(() => undefined); return; }
    const events: AdapterEvent[] = [];
    for await (const e of this.inner.invoke(req, signal)) events.push(e);
    yield* this.mutate(events, req);
  }
}

function brokenFactory(mutate: Mutator, ignoreAbort = false, index: 0 | 1 = 0): AdapterFactory {
  const ok = simulatorFactory(index);
  return (scenario) => {
    const s = ok(scenario);
    return s && { adapter: new BrokenAdapter(s.adapter as SimulatorV2Adapter, mutate, ignoreAbort), pricing: s.pricing };
  };
}

const mapFinal = (f: (u: any) => any): Mutator => (events) => events.map((e) => (e.type === 'final' ? { ...e, usage: f({ ...e.usage }) } : e));

describe('provider contract suite self-test: a broken adapter fails', () => {
  it('the real simulator produces no violations (baseline for the self-test)', async () => {
    expect(await checkProviderContract(simulatorFactory(0), { goldenVectors: GOLDEN_STANDARD })).toEqual([]);
  });

  it.each<[string, AdapterFactory, ContractScenario, RegExp]>([
    ['claims documented_no_charge for an undeclared class', brokenFactory(mapFinal((u) => (u.error === 'rate_limited' && u.usageCompleteness === 'unknown'
      ? { ...u, usageCompleteness: 'zero_confirmed', zeroUsageEvidence: 'documented_no_charge' } : u))), 'rate_limited_unevidenced', /undeclared error class/],
    ['claims zero_confirmed with no evidence (invalid record)', brokenFactory(mapFinal((u) => (u.error === 'invalid_request'
      ? { ...u, usageCompleteness: 'zero_confirmed' } : u))), 'invalid_request_unevidenced', /not a valid contract-v1 record/],
    ['an error category alone is not evidence (unknown rejection reported as released)', brokenFactory(mapFinal((u) => (u.error === 'context_too_large'
      ? { ...u, usageCompleteness: 'zero_confirmed', zeroUsageEvidence: 'provider_reported_zero', tokens: { ...u.tokens, output: 1 } } : u))), 'context_too_large_unevidenced', /not a valid contract-v1 record/],
    ['emits events after the final record', brokenFactory((ev) => [...ev, { type: 'delta', segment: 9, origin: 'synthesis', text: 'late' }]), 'success', /events after the final/],
    ['does not echo the attempt key', brokenFactory(mapFinal((u) => ({ ...u, attemptKey: 'other' }))), 'success', /attempt key not echoed/],
    ['reports a combination outside the §9.3 table', brokenFactory(mapFinal((u) => ({ ...u, outcome: 'timed_out', error: 'timeout' }))), 'success', /not a valid contract-v1 record|§9.3/],
    ['cites a ref outside the request context', brokenFactory((ev) => ev.map((e) => (e.type === 'citation' ? { ...e, ref: 'not-in-context' } : e))), 'citations', /citation outside/],
    ['adds a content field to usage', brokenFactory(mapFinal((u) => ({ ...u, prompt: 'leak' }))), 'success', /not a valid contract-v1 record/],
    ['misreports the rate-limit row (no retry-after)', brokenFactory((ev) => ev.map((e) => (e.type === 'final' ? { ...e, retryAfterMs: undefined } : e))), 'rate_limited_unevidenced', /retry-after/],
    ['never stops after abort', brokenFactory((ev) => ev, true), 'client_abort', /did not terminate/],
    ['under-reports input tokens', brokenFactory(mapFinal((u) => ({ ...u, tokens: { ...u.tokens, inputUncached: u.tokens.inputUncached - 1 } }))), 'success', /input tokens differ/],
    ['reports output beyond the reservation (settlement > worst case)', brokenFactory(mapFinal((u) => (u.error === null ? { ...u, tokens: { ...u.tokens, output: 1_000_000 } } : u))), 'success', /exceeds the worst-case/],
  ])('%s', async (_label, factory, scenario, expected) => {
    const v = await checkScenario(factory, scenario); // must report, never throw
    expect(v.length).toBeGreaterThan(0);
    expect(v.join('\n')).toMatch(expected);
  });

  it('a pricing schema that does not reproduce the golden vectors fails', async () => {
    const bad = assertPricingSchema({ ...JSON.parse(JSON.stringify(RAW_SIMULATOR_PRICING[0])), base: { ...RAW_SIMULATOR_PRICING[0].base, output: 1 } });
    const factory: AdapterFactory = (s) => { const x = simulatorFactory(0)(s); return x && { ...x, pricing: bad }; };
    expect((await checkProviderContract(factory, { goldenVectors: GOLDEN_STANDARD })).some((m) => /golden/.test(m))).toBe(true);
  });

  it('a non-simulated adapter is flagged', async () => {
    const factory: AdapterFactory = (s) => { const x = simulatorFactory(0)(s); return x && { ...x, adapter: Object.assign(Object.create(x.adapter), { simulated: false }) }; };
    expect((await checkScenario(factory, 'success')).join()).toMatch(/not simulated/);
  });

  it('a factory that cannot produce a declared scenario fails', async () => {
    const factory: AdapterFactory = (s) => (s === 'rate_limited_documented' ? null : simulatorFactory(1)(s));
    expect((await checkScenario(factory, 'rate_limited_documented')).join()).toMatch(/cannot produce/);
  });
});
