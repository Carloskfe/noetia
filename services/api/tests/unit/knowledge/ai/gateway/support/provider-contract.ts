import {
  assertNormalizedUsage, AttemptOutcome, declaresNoCharge, ErrorCategory, isValidOutcomeCombination, NormalizedUsage, priceUsage,
  TokenCounts, UsageCompleteness, ValidatedPricingSchema, worstCaseCost, ZeroUsageEvidence,
} from '../../../../../../src/knowledge/ai/contract';
import {
  AdapterEvent, AdapterRequest, JsonSchema, OutputMode, PromptEnvelope, ProviderAdapter,
} from '../../../../../../src/knowledge/ai/gateway/gateway.types';
import { INSTRUCTION_TEMPLATES } from '../../../../../../src/knowledge/ai/gateway/instruction-templates';
import { SEGMENT_ORIGINS } from '../../../../../../src/knowledge/knowledge.types';

/**
 * NEM-022 provider contract test suite (§5.8): `runProviderContract(name, adapterFactory)`.
 *
 * Every future adapter must pass it before the launch-readiness gate. The factory returns an adapter primed to
 * produce the requested scenario (the simulator via its script; a real adapter via a recorded transport fixture),
 * plus the pricing schema for its model. It runs without a database; an integration variant runs the same
 * scenarios through the Gateway and the E1 ledger.
 *
 * Coverage: capabilities, every row of the E1 §9.3 outcome table, evidence discipline, streaming termination,
 * structured output, citation refs, cache accounting, abort, attempt-key echo, and pricing through E1 `priceUsage`
 * (golden vectors; reservation ≥ settlement). `checkProviderContract` returns violations instead of failing, so the
 * suite can prove a deliberately broken adapter fails (self-test).
 */
export type ContractScenario =
  | 'success' | 'structured_valid' | 'structured_malformed' | 'refusal_complete' | 'refusal_partial'
  | 'invalid_request_unevidenced' | 'invalid_request_reported_zero' | 'context_too_large_unevidenced'
  | 'rate_limited_unevidenced' | 'rate_limited_reported_zero' | 'rate_limited_documented'
  | 'provider_unavailable_unevidenced' | 'timeout' | 'client_abort' | 'partial_stream_abort' | 'citations' | 'cache';

export const CONTRACT_SCENARIOS: readonly ContractScenario[] = [
  'success', 'structured_valid', 'structured_malformed', 'refusal_complete', 'refusal_partial',
  'invalid_request_unevidenced', 'invalid_request_reported_zero', 'context_too_large_unevidenced',
  'rate_limited_unevidenced', 'rate_limited_reported_zero', 'rate_limited_documented',
  'provider_unavailable_unevidenced', 'timeout', 'client_abort', 'partial_stream_abort', 'citations', 'cache',
];

export interface ContractSubject {
  adapter: ProviderAdapter;
  pricing: ValidatedPricingSchema;
}

/** Return null only for a scenario the adapter cannot produce by declaration (`rate_limited_documented`, `cache`). */
export type AdapterFactory = (scenario: ContractScenario) => ContractSubject | null;

export interface GoldenVector {
  label: string;
  tokens: TokenCounts;
  nonTokenUnits: Record<string, number>;
  expectedMicroUsd: bigint;
}

export interface ContractOptions {
  /** Hand-computed E1 golden vectors for the adapter's pricing (re-keyed to its model). */
  goldenVectors?: GoldenVector[];
  /** How long an adapter may take to stop after abort (ms). */
  abortDeadlineMs?: number;
}

interface ExpectedRow {
  outcome: AttemptOutcome;
  error: ErrorCategory | null;
  completeness: readonly UsageCompleteness[];
  evidence?: ZeroUsageEvidence;
}

const EXPECTED: Partial<Record<ContractScenario, ExpectedRow>> = {
  success: { outcome: 'completed', error: null, completeness: ['complete'] },
  structured_valid: { outcome: 'completed', error: null, completeness: ['complete'] },
  structured_malformed: { outcome: 'completed', error: null, completeness: ['complete'] },
  citations: { outcome: 'completed', error: null, completeness: ['complete'] },
  refusal_complete: { outcome: 'refused', error: 'refusal', completeness: ['complete'] },
  refusal_partial: { outcome: 'refused', error: 'refusal', completeness: ['partial'] },
  invalid_request_unevidenced: { outcome: 'rejected', error: 'invalid_request', completeness: ['unknown'], evidence: 'none' },
  invalid_request_reported_zero: { outcome: 'rejected', error: 'invalid_request', completeness: ['zero_confirmed'], evidence: 'provider_reported_zero' },
  context_too_large_unevidenced: { outcome: 'rejected', error: 'context_too_large', completeness: ['unknown'], evidence: 'none' },
  rate_limited_unevidenced: { outcome: 'rejected', error: 'rate_limited', completeness: ['unknown'], evidence: 'none' },
  rate_limited_reported_zero: { outcome: 'rejected', error: 'rate_limited', completeness: ['zero_confirmed'], evidence: 'provider_reported_zero' },
  rate_limited_documented: { outcome: 'rejected', error: 'rate_limited', completeness: ['zero_confirmed'], evidence: 'documented_no_charge' },
  provider_unavailable_unevidenced: { outcome: 'failed', error: 'provider_unavailable', completeness: ['unknown'], evidence: 'none' },
};

export const CONTRACT_SCHEMA: JsonSchema = {
  type: 'object', required: ['answer'], additionalProperties: false, properties: { answer: { type: 'string', minLength: 1 } },
};

/** Invented fixture context: one book chunk and one user highlight. */
export const CONTRACT_ENVELOPE: PromptEnvelope = {
  templateId: 'research_session.turn.v1',
  instructions: INSTRUCTION_TEMPLATES['research_session.turn.v1'].instructions,
  contextBlocks: [
    { ref: 'chunk-1', kind: 'chunk', bookId: 'book-1', text: 'An invented passage about lighthouses.' },
    { ref: 'highlight-1', kind: 'highlight', bookId: 'book-1', text: 'An invented reader highlight.' },
  ],
};

let seq = 0;
export function contractRequest(adapter: ProviderAdapter, over: Partial<AdapterRequest> = {}): AdapterRequest {
  const bounds: Record<string, number> = {};
  for (const u of adapter.descriptor.nonTokenUnits) bounds[u] = 4;
  return {
    attemptKey: `turn:contract-${++seq}:a1`, envelope: CONTRACT_ENVELOPE, maxOutputTokens: 256, cacheIntent: { mode: 'none' },
    output: { mode: 'text' }, nonTokenUnitBounds: bounds, ...over,
  };
}

export interface Run {
  events: AdapterEvent[];
  final?: Extract<AdapterEvent, { type: 'final' }>;
  threw: boolean;
  terminated: boolean;
}

/** Drive one adapter call; optionally abort after `abortAfterMs` or after the first delta. */
export async function runAdapter(
  adapter: ProviderAdapter, req: AdapterRequest, opts: { abortAfterMs?: number; abortAfterFirstDelta?: boolean; deadlineMs?: number } = {},
): Promise<Run> {
  const ctrl = new AbortController();
  const events: AdapterEvent[] = [];
  let threw = false;
  const timer = opts.abortAfterMs !== undefined ? setTimeout(() => ctrl.abort(), opts.abortAfterMs) : undefined;
  const consume = (async () => {
    try {
      for await (const e of adapter.invoke(req, ctrl.signal)) {
        events.push(e);
        if (opts.abortAfterFirstDelta && e.type === 'delta') ctrl.abort();
      }
    } catch {
      threw = true;
    }
    return true;
  })();
  const deadline = new Promise<false>((r) => setTimeout(() => r(false), opts.deadlineMs ?? 2_000));
  const terminated = await Promise.race([consume, deadline]);
  if (timer) clearTimeout(timer);
  ctrl.abort();
  const finals = events.filter((e) => e.type === 'final') as Extract<AdapterEvent, { type: 'final' }>[];
  return { events, final: finals[0], threw, terminated };
}

/** Structural and contract checks every run must satisfy. */
function genericViolations(subject: ContractSubject, req: AdapterRequest, run: Run): string[] {
  const v: string[] = [];
  const d = subject.adapter.descriptor;
  if (!run.terminated) v.push('stream did not terminate');
  const finals = run.events.filter((e) => e.type === 'final');
  if (finals.length > 1) v.push('more than one final event');
  const finalAt = run.events.findIndex((e) => e.type === 'final');
  if (finalAt >= 0 && finalAt !== run.events.length - 1) v.push('events after the final event');
  let lastSegment = -1;
  for (const e of run.events) {
    if (!['delta', 'citation', 'tool_call', 'final'].includes(e.type)) v.push(`unknown event type ${(e as { type: string }).type}`);
    if (e.type === 'delta') {
      if (e.segment < lastSegment) v.push('segment index went backwards');
      lastSegment = Math.max(lastSegment, e.segment);
      if (!SEGMENT_ORIGINS.includes(e.origin)) v.push('invalid origin');
    }
    if (e.type === 'citation' && !req.envelope.contextBlocks.some((b) => b.ref === e.ref)) v.push('citation outside the request context');
  }
  if (run.final) {
    let u: NormalizedUsage | undefined;
    try {
      u = assertNormalizedUsage(run.final.usage);
    } catch {
      v.push('final usage is not a valid contract-v1 record');
    }
    if (u) {
      if (u.attemptKey !== req.attemptKey) v.push('attempt key not echoed');
      if (u.providerKey !== d.providerKey || u.modelKey !== d.modelKey) v.push('usage names another model');
      if (!isValidOutcomeCombination(u)) v.push('outcome/error/completeness not a §9.3 row');
      if (u.zeroUsageEvidence === 'documented_no_charge' && (u.error === null || !declaresNoCharge(d, u.error))) {
        v.push('documented_no_charge claimed for an undeclared error class');
      }
      if (u.usageCompleteness === 'complete' || u.usageCompleteness === 'partial') {
        try {
          const a = priceUsage(u, subject.pricing).microUsd;
          const b = priceUsage(JSON.parse(JSON.stringify(u)), subject.pricing).microUsd;
          if (a !== b) v.push('usage does not price deterministically');
        } catch {
          v.push('usage cannot be priced by E1 priceUsage');
        }
      }
    }
  }
  return v;
}

const text = (run: Run) => run.events.filter((e) => e.type === 'delta').map((e) => (e as { text: string }).text).join('');

/** Check one scenario; returns violations prefixed with the scenario name. */
export async function checkScenario(factory: AdapterFactory, scenario: ContractScenario, opts: ContractOptions = {}): Promise<string[]> {
  const subject = factory(scenario);
  const d = (s: ContractSubject | null) => s?.adapter.descriptor;
  const out = (msgs: string[]) => msgs.map((m) => `${scenario}: ${m}`);
  if (!subject) {
    const probe = factory('success');
    if (scenario === 'rate_limited_documented' && probe && !declaresNoCharge(probe.adapter.descriptor, 'rate_limited')) return [];
    if (scenario === 'cache' && probe && probe.adapter.descriptor.features.cacheHints.lifetimes.length === 0) return [];
    return out(['factory cannot produce a scenario the descriptor declares']);
  }
  const v: string[] = [];
  if (subject.adapter.simulated !== true || d(subject)?.simulated !== true) v.push('adapter is not simulated (refused until the launch-readiness gate)');
  const structured: OutputMode = { mode: 'structured', schema: CONTRACT_SCHEMA };
  const abortDeadline = opts.abortDeadlineMs ?? 1_000;

  if (scenario === 'cache') {
    const lifetime = subject.adapter.descriptor.features.cacheHints.lifetimes[0];
    const base = contractRequest(subject.adapter, { cacheIntent: { mode: 'write', lifetime } });
    const first = await runAdapter(subject.adapter, base);
    const second = await runAdapter(subject.adapter, { ...base, attemptKey: base.attemptKey.replace(':a1', ':a2') });
    v.push(...genericViolations(subject, base, first), ...genericViolations(subject, { ...base, attemptKey: base.attemptKey.replace(':a1', ':a2') }, second));
    const t1 = first.final?.usage.tokens;
    const t2 = second.final?.usage.tokens;
    if (!t1 || !(t1.cacheWrite[lifetime] > 0) || t1.cacheRead !== 0) v.push('first call did not write the prompt prefix to cache');
    if (!t2 || !(t2.cacheRead > 0) || Object.keys(t2.cacheWrite).length !== 0) v.push('second call did not read the cached prefix');
    return out(v);
  }

  const req = contractRequest(subject.adapter, scenario.startsWith('structured') ? { output: structured } : {});
  const run = scenario === 'timeout' || scenario === 'client_abort'
    ? await runAdapter(subject.adapter, req, { abortAfterMs: 30, deadlineMs: 30 + abortDeadline })
    : scenario === 'partial_stream_abort'
      ? await runAdapter(subject.adapter, req, { abortAfterFirstDelta: true, deadlineMs: abortDeadline })
      : await runAdapter(subject.adapter, req);
  v.push(...genericViolations(subject, req, run));

  if (scenario === 'timeout' || scenario === 'client_abort' || scenario === 'partial_stream_abort') {
    if (run.final) {
      const u = run.final.usage;
      if (u.outcome !== 'aborted' || u.error !== 'client_abort') v.push('abort must be reported as aborted/client_abort');
      if (scenario === 'partial_stream_abort' && u.usageCompleteness === 'complete') v.push('a partial stream cannot report complete usage');
    }
    if (scenario === 'partial_stream_abort' && !run.events.some((e) => e.type === 'delta')) v.push('no delta before the abort');
    return out(v);
  }

  const exp = EXPECTED[scenario]!;
  if (run.threw) v.push('adapter threw instead of reporting the outcome');
  if (!run.final) v.push('no final usage record');
  else {
    const u = run.final.usage;
    if (u.outcome !== exp.outcome || u.error !== exp.error || !exp.completeness.includes(u.usageCompleteness)) {
      v.push(`expected ${exp.outcome}/${exp.error ?? 'none'}/${exp.completeness.join('|')}, got ${u.outcome}/${u.error ?? 'none'}/${u.usageCompleteness}`);
    }
    if (exp.evidence && u.zeroUsageEvidence !== exp.evidence) v.push(`expected evidence ${exp.evidence}, got ${u.zeroUsageEvidence}`);
    if (scenario === 'rate_limited_unevidenced' && !(typeof run.final.retryAfterMs === 'number' && run.final.retryAfterMs >= 0)) {
      v.push('a rate limit must carry retry-after');
    }
    const valid = (() => { try { assertNormalizedUsage(u); return true; } catch { return false; } })();
    if (valid && (scenario === 'success' || scenario === 'citations')) {
      const reserved = worstCaseCost(subject.adapter.descriptor, subject.pricing, {
        inputTokens: subject.adapter.countTokens(req.envelope, req.output), maxOutputTokens: req.maxOutputTokens, cacheIntent: req.cacheIntent,
        nonTokenUnitBounds: req.nonTokenUnitBounds,
      }).microUsd;
      if (priceUsage(u, subject.pricing).microUsd > reserved) v.push('settlement exceeds the worst-case reservation');
      if (u.tokens.inputUncached + u.tokens.cacheRead + Object.values(u.tokens.cacheWrite).reduce((a, n) => a + n, 0) !== subject.adapter.countTokens(req.envelope, req.output)) {
        v.push('reported input tokens differ from the adapter count');
      }
    }
    if (scenario === 'citations' && !run.events.some((e) => e.type === 'citation')) v.push('no citation emitted for a context chunk');
    if (scenario === 'structured_valid' || scenario === 'structured_malformed') {
      let ok = false;
      try {
        const parsed = JSON.parse(text(run));
        ok = typeof parsed === 'object' && parsed !== null && typeof parsed.answer === 'string' && parsed.answer.length > 0 && Object.keys(parsed).length === 1;
      } catch {
        ok = false;
      }
      if (scenario === 'structured_valid' && !ok) v.push('structured output does not match the requested schema');
      if (scenario === 'structured_malformed' && ok) v.push('the malformed fixture produced valid output');
    }
  }
  return out(v);
}

/** Golden vectors: the adapter model's pricing reproduces E1's hand-computed values (no adapter-specific pricing). */
export function checkGoldenVectors(factory: AdapterFactory, opts: ContractOptions): string[] {
  const subject = factory('success');
  if (!subject) return ['golden: factory cannot produce a success subject'];
  const d = subject.adapter.descriptor;
  return (opts.goldenVectors ?? []).flatMap((g) => {
    const usage: NormalizedUsage = {
      contract: 'noetia.ai.usage', schemaVersion: 1, providerKey: d.providerKey, modelKey: d.modelKey, attemptKey: `golden-${g.label}`,
      startedAt: '2026-01-01T00:00:00Z', endedAt: '2026-01-01T00:00:01Z', tokens: g.tokens, nonTokenUnits: g.nonTokenUnits,
      outcome: 'completed', error: null, usageCompleteness: 'complete', zeroUsageEvidence: 'none',
    };
    const got = priceUsage(usage, subject.pricing).microUsd;
    return got === g.expectedMicroUsd ? [] : [`golden ${g.label}: expected ${g.expectedMicroUsd}, got ${got}`];
  });
}

/** A check that throws is itself a violation (a broken adapter must never crash the suite). */
async function safeCheck(factory: AdapterFactory, scenario: ContractScenario, opts: ContractOptions): Promise<string[]> {
  try {
    return await checkScenario(factory, scenario, opts);
  } catch (e) {
    return [`${scenario}: could not evaluate (${e instanceof Error ? e.message.slice(0, 120) : 'error'})`];
  }
}

export async function checkProviderContract(factory: AdapterFactory, opts: ContractOptions = {}): Promise<string[]> {
  const all: string[] = [];
  for (const s of CONTRACT_SCENARIOS) all.push(...(await safeCheck(factory, s, opts)));
  all.push(...checkGoldenVectors(factory, opts));
  return all;
}

/** Register the contract suite for an adapter (jest). */
export function runProviderContract(name: string, factory: AdapterFactory, opts: ContractOptions = {}) {
  describe(`provider contract v1: ${name}`, () => {
    it.each(CONTRACT_SCENARIOS)('%s', async (scenario) => {
      expect(await safeCheck(factory, scenario, opts)).toEqual([]);
    });
    it('prices identically through E1 priceUsage golden vectors', () => {
      expect(checkGoldenVectors(factory, opts)).toEqual([]);
    });
  });
}
