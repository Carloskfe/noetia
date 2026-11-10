import { assertPricingSchema, priceUsage } from '../../../../../src/knowledge/ai/contract';
import { AdapterEvent, AdapterRequest } from '../../../../../src/knowledge/ai/gateway/gateway.types';
import { renderEnvelope } from '../../../../../src/knowledge/ai/gateway/instruction-templates';
import { RAW_SIMULATOR_PRICING, SIMULATOR_DESCRIPTORS } from '../../../../../src/knowledge/ai/simulator/simulator-fixtures';
import { REQUEST_FRAMING_TOKENS, simulatedTokenCount, SimulatorV2Adapter } from '../../../../../src/knowledge/ai/simulator/simulator-v2';
import { sealContext } from '../../../../../src/knowledge/ai/verified-context';

const [STANDARD, LONG] = SIMULATOR_DESCRIPTORS;
const ctx = (text = 'An invented passage.', copies = 1) => sealContext({
  pathId: 'research_session.turn', invariant: 'research_session_context', userId: 'u', allowedBookIds: ['b-1', 'b-2'],
  items: [{ kind: 'chunk', ref: 'c-1', bookId: 'b-1', text: text.repeat(copies) }, { kind: 'chunk', ref: 'c-2', bookId: 'b-2', text: 'Second.' }],
});
const req = (over: Partial<AdapterRequest> = {}, text?: string, copies?: number): AdapterRequest => ({
  attemptKey: 'turn:s:a1', envelope: renderEnvelope('research_session.turn.v1', ctx(text, copies)), maxOutputTokens: 200,
  cacheIntent: { mode: 'none' }, output: { mode: 'text' }, nonTokenUnitBounds: { tool_call: 2 }, ...over,
});
async function run(sim: SimulatorV2Adapter, r: AdapterRequest, abortAfterFirstDelta = false) {
  const ctrl = new AbortController();
  const events: AdapterEvent[] = [];
  for await (const e of sim.invoke(r, ctrl.signal)) { events.push(e); if (abortAfterFirstDelta && e.type === 'delta') ctrl.abort(); }
  return { events, final: events.find((e) => e.type === 'final') as Extract<AdapterEvent, { type: 'final' }> | undefined };
}
const fixed = () => new Date('2026-01-01T00:00:00Z');

describe('simulator v2 — deterministic provider emulation', () => {
  it('the same seed, script, request, and clock produce identical events and usage; another seed changes the text', async () => {
    const a = await run(new SimulatorV2Adapter(STANDARD, { seed: 's1', clock: fixed }), req());
    const b = await run(new SimulatorV2Adapter(STANDARD, { seed: 's1', clock: fixed }), req());
    expect(b.events).toEqual(a.events);
    const c = await run(new SimulatorV2Adapter(STANDARD, { seed: 's2', clock: fixed }), req());
    expect(c.events).not.toEqual(a.events);
    expect(c.final!.usage.tokens).toEqual(a.final!.usage.tokens);
  });

  it('token counting is a documented approximation: ceil(UTF-8 bytes / 4), flagged estimated', () => {
    expect([simulatedTokenCount(''), simulatedTokenCount('abcd'), simulatedTokenCount('abcde'), simulatedTokenCount('ééé')]).toEqual([0, 1, 2, 2]);
    expect(STANDARD.tokenCountingMethod).toEqual({ mode: 'estimated', conservativeFactorBps: 10_000 });
    const sim = new SimulatorV2Adapter(STANDARD);
    const r = req();
    expect(sim.countTokens(r.envelope, { mode: 'structured', schema: { type: 'object' } })).toBeGreaterThan(sim.countTokens(r.envelope, r.output));
  });

  it('default answer: a cited library segment per book chunk plus a synthesis; output within the bound', async () => {
    const { events, final } = await run(new SimulatorV2Adapter(STANDARD), req());
    expect(events.filter((e) => e.type === 'citation').map((e: any) => e.ref)).toEqual(['c-1', 'c-2']);
    expect(final!.usage).toMatchObject({ outcome: 'completed', error: null, usageCompleteness: 'complete', nonTokenUnits: { tool_call: 0 } });
    expect(final!.usage.tokens.output).toBeLessThanOrEqual(200);
    expect(final!.usage.tokens.inputUncached).toBe(new SimulatorV2Adapter(STANDARD).countTokens(req().envelope, req().output));
  });

  it('prompt-prefix caching: write for the lifetime, read while valid, write again after expiry', async () => {
    let now = Date.parse('2026-01-01T00:00:00Z');
    const sim = new SimulatorV2Adapter(STANDARD, { clock: () => new Date(now) });
    const r = req({ cacheIntent: { mode: 'write', lifetime: '5m' } });
    const t1 = (await run(sim, r)).final!.usage.tokens;
    const prefix = t1.cacheWrite['5m'];
    expect(prefix).toBeGreaterThan(0);
    expect(t1.inputUncached).toBe(REQUEST_FRAMING_TOKENS);
    now += 4 * 60_000;
    const t2 = (await run(sim, r)).final!.usage.tokens;
    expect(t2).toMatchObject({ cacheRead: prefix, cacheWrite: {}, inputUncached: REQUEST_FRAMING_TOKENS });
    now += 2 * 60_000;
    expect((await run(sim, r)).final!.usage.tokens.cacheWrite['5m']).toBe(prefix);
    expect((await run(sim, req({ cacheIntent: { mode: 'uncertain', lifetime: '1h' } }))).final!.usage.tokens.cacheWrite['1h']).toBe(prefix);
  });

  it('automatic cache writes (long-context model) happen without a hint, on its declared lifetime', async () => {
    const t = (await run(new SimulatorV2Adapter(LONG), req())).final!.usage.tokens;
    expect(Object.keys(t.cacheWrite)).toEqual(['30m']);
  });

  it('whole-request tier repricing comes from the E1 fixtures: above 200,000 input tokens every class reprices', async () => {
    const pricing = assertPricingSchema(RAW_SIMULATOR_PRICING[1]);
    const small = (await run(new SimulatorV2Adapter(LONG), req())).final!.usage;
    const large = (await run(new SimulatorV2Adapter(LONG), req({}, 'x'.repeat(1_000), 900))).final!.usage;
    expect(priceUsage(small, pricing).tierIndex).toBe(-1);
    expect(priceUsage(large, pricing).tierIndex).toBe(0);
  });

  it('refusals by category, complete or partial', async () => {
    const sim = new SimulatorV2Adapter(STANDARD);
    sim.enqueue({ kind: 'refusal', category: 'self_harm', completeness: 'complete' }, { kind: 'refusal', category: 'policy', completeness: 'partial' });
    const a = await run(sim, req());
    expect(a.final).toMatchObject({ refusalCategory: 'self_harm', stopReason: 'refusal', usage: { outcome: 'refused', error: 'refusal', usageCompleteness: 'complete' } });
    const b = await run(sim, req());
    expect(b.final!.usage).toMatchObject({ usageCompleteness: 'partial', tokens: { output: 0 } });
  });

  it('429-style rejections with retry-after, with and without evidence; provider unavailable', async () => {
    const sim = new SimulatorV2Adapter(LONG);
    sim.enqueue(
      { kind: 'reject', error: 'rate_limited', evidence: 'none', retryAfterMs: 1_500 },
      { kind: 'reject', error: 'rate_limited', evidence: 'documented_no_charge' },
      { kind: 'reject', error: 'invalid_request', evidence: 'provider_reported_zero' },
      { kind: 'unavailable' },
      { kind: 'unavailable', evidence: 'provider_reported_zero' },
    );
    expect((await run(sim, req())).final).toMatchObject({ retryAfterMs: 1_500, usage: { error: 'rate_limited', usageCompleteness: 'unknown', zeroUsageEvidence: 'none' } });
    expect((await run(sim, req())).final!.usage).toMatchObject({ usageCompleteness: 'zero_confirmed', zeroUsageEvidence: 'documented_no_charge' });
    expect((await run(sim, req())).final!.usage).toMatchObject({ error: 'invalid_request', zeroUsageEvidence: 'provider_reported_zero' });
    expect((await run(sim, req())).final!.usage).toMatchObject({ outcome: 'failed', error: 'provider_unavailable', usageCompleteness: 'unknown' });
    expect((await run(sim, req())).final!.usage).toMatchObject({ usageCompleteness: 'zero_confirmed', zeroUsageEvidence: 'provider_reported_zero' });
  });

  it('timeouts wait for abort; partial streams hang or drop; abort mid-stream reports partial usage', async () => {
    const sim = new SimulatorV2Adapter(STANDARD);
    sim.enqueue({ kind: 'timeout' });
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 10);
    const events: AdapterEvent[] = [];
    for await (const e of sim.invoke(req(), ctrl.signal)) events.push(e);
    expect(events).toHaveLength(1);
    expect((events[0] as any).usage).toMatchObject({ outcome: 'aborted', error: 'client_abort', usageCompleteness: 'unknown' });
    sim.enqueue({ kind: 'partial_stream', deltas: 1, then: 'drop' });
    const dropped = await run(sim, req());
    expect(dropped.events.map((e) => e.type)).toEqual(['delta']);
    expect(dropped.final).toBeUndefined();
    sim.enqueue({ kind: 'partial_stream', deltas: 2, then: 'hang' });
    const aborted = await run(sim, req(), true);
    expect(aborted.final!.usage).toMatchObject({ error: 'client_abort', usageCompleteness: 'partial' });
    expect(aborted.final!.usage.tokens.output).toBeGreaterThan(0);
  });

  it('malformed structured output, citation errors, tool calls, explicit output, reasoning, and internal errors', async () => {
    const sim = new SimulatorV2Adapter(LONG);
    sim.enqueue({ kind: 'malformed' });
    const m = await run(sim, req({ output: { mode: 'structured', schema: { type: 'object' } } }));
    expect(() => JSON.parse((m.events[0] as any).text)).toThrow();
    sim.enqueue({ kind: 'citation_error' });
    expect((await run(sim, req())).events.some((e) => e.type === 'citation' && e.ref === 'ref-outside-context')).toBe(true);
    sim.enqueue({ kind: 'success', toolCalls: [{ name: 'retrieve', bookId: 'b-1' }], outputTokens: 500, reasoningTokens: 7 });
    const t = await run(sim, req());
    expect(t.events.some((e) => e.type === 'tool_call')).toBe(true);
    expect(t.final).toMatchObject({ stopReason: 'max_tokens', usage: { tokens: { output: 500, reasoning: 7 }, nonTokenUnits: {} } });
    const std = new SimulatorV2Adapter(STANDARD);
    std.enqueue({ kind: 'success', toolCalls: [{ name: 'retrieve', bookId: 'b-1' }], reasoningTokens: 7 });
    const s = await run(std, req());
    expect(s.final!.usage.nonTokenUnits).toEqual({ tool_call: 1 });
    expect(s.final!.usage.tokens.reasoning).toBeUndefined(); // within-output reasoning is never reported separately
    std.enqueue({ kind: 'internal' });
    await expect(run(std, req())).rejects.toThrow('simulated internal error');
    std.enqueue({ kind: 'success', segments: [{ origin: 'synthesis', text: 'Scripted.' }] });
    expect((await run(std, req())).events.filter((e) => e.type === 'delta').map((e: any) => e.text).join('')).toBe('Scripted.');
  });

  it('the beforeRespond hook runs before the response', async () => {
    const sim = new SimulatorV2Adapter(STANDARD);
    const order: string[] = [];
    sim.beforeRespond = async () => { order.push('hook'); };
    for await (const e of sim.invoke(req(), new AbortController().signal)) order.push(e.type);
    expect(order[0]).toBe('hook');
  });

  it('rejects an invalid cache lifetime', async () => {
    await expect(run(new SimulatorV2Adapter(STANDARD), req({ cacheIntent: { mode: 'write', lifetime: '5s' } }))).rejects.toThrow('invalid cache lifetime');
  });
});
