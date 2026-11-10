import { assertCapabilityDescriptor, ValidatedCapabilityDescriptor } from '../../../../../src/knowledge/ai/contract';
import { AiGatewayService, GatewayNotSent } from '../../../../../src/knowledge/ai/gateway/ai-gateway.service';
import { CapabilityRouterService } from '../../../../../src/knowledge/ai/gateway/capability-router.service';
import { AdapterEvent, AdapterRequest, GatewayEvent, GatewayRequest, ProviderAdapter } from '../../../../../src/knowledge/ai/gateway/gateway.types';
import { RAW_SIMULATOR_DESCRIPTORS, SIMULATOR_DESCRIPTORS } from '../../../../../src/knowledge/ai/simulator/simulator-fixtures';
import { SimulatorV2Adapter } from '../../../../../src/knowledge/ai/simulator/simulator-v2';
import { ContextItem, sealContext } from '../../../../../src/knowledge/ai/verified-context';
import { mockMetrics, TEST_CONFIG } from '../../support/fixtures';

const [STANDARD, LONG] = SIMULATOR_DESCRIPTORS;
const CHUNK: ContextItem = { kind: 'chunk', ref: 'c-1', bookId: 'b-1', text: 'An invented passage.' };

function context(items: ContextItem[] = [CHUNK]) {
  return sealContext({ pathId: 'research_session.turn', invariant: 'research_session_context', userId: 'u-1', allowedBookIds: ['b-1'], items });
}

function request(over: Partial<GatewayRequest> = {}): GatewayRequest {
  return {
    pathId: 'research_session.turn', context: context(), templateId: 'research_session.turn.v1', requiredCapabilities: ['research_session'],
    output: { mode: 'text' }, maxOutputTokens: 256, cacheIntent: { mode: 'none' }, turnKey: 'turn:test',
    budget: { userId: 'u-1', tier: 'noetia_plus', capability: 'research_session', sessionId: null }, ...over,
  };
}

function ledgerMock() {
  return {
    reserveAttempt: jest.fn(async (r: any) => ({
      attemptKey: `${r.turnKey}:a${r.attemptNumber}`, attemptNumber: r.attemptNumber, reservedMicroUsd: 1_000n, reservedUnits: 1n,
      pricingSchemaId: 'ps', unitWeightSchemaId: 'uw', globalPolicyId: 'g', expiresAt: new Date(), committedBeforeMicroUsd: 0n, allowanceMicroUsd: 1n,
    })),
    settleAttempt: jest.fn(async (u: any) => ({ complete: 'settled', partial: 'partially_settled', unknown: 'held', zero_confirmed: 'released' } as any)[u.usageCompleteness]),
    releaseAttempt: jest.fn(async () => 'released'),
  };
}

function setup(o: { adapters?: ProviderAdapter[]; config?: object } = {}) {
  const sim = new SimulatorV2Adapter(STANDARD, { seed: 'gw' });
  const ledger = ledgerMock();
  const metrics = { ...mockMetrics(), gatewayOutcomeInc: jest.fn(), gatewayRetryInc: jest.fn(), capabilityUnavailableInc: jest.fn() } as any;
  const gateway = new AiGatewayService(new CapabilityRouterService(o.adapters ?? [sim]), ledger as any, metrics, { ...TEST_CONFIG, ...o.config } as any);
  return { sim, ledger, metrics, gateway };
}

async function collect(stream: AsyncIterable<GatewayEvent>) {
  const events: GatewayEvent[] = [];
  for await (const e of stream) events.push(e);
  return events;
}

/** An adapter whose stream the test writes directly. */
class ScriptedAdapter implements ProviderAdapter {
  readonly simulated = true;
  constructor(readonly descriptor: ValidatedCapabilityDescriptor, private readonly body: (req: AdapterRequest, signal: AbortSignal) => AsyncGenerator<AdapterEvent>) {}
  countTokens() { return 100; }
  invoke(req: AdapterRequest, signal: AbortSignal) { return this.body(req, signal); }
}

const usageFor = (req: AdapterRequest, d: ValidatedCapabilityDescriptor, over: object = {}) => ({
  contract: 'noetia.ai.usage' as const, schemaVersion: 1 as const, providerKey: d.providerKey, modelKey: d.modelKey, attemptKey: req.attemptKey,
  startedAt: '2026-01-01T00:00:00Z', endedAt: '2026-01-01T00:00:01Z', tokens: { inputUncached: 100, cacheRead: 0, cacheWrite: {}, output: 5 },
  nonTokenUnits: { tool_call: 0 }, outcome: 'completed' as const, error: null, usageCompleteness: 'complete' as const, zeroUsageEvidence: 'none' as const, ...over,
});

describe('AiGatewayService.prepare — negotiation, token count, reservation', () => {
  it('reserves attempt 1 with the negotiated descriptor, the adapter count, and a bound for every declared unit', async () => {
    const { gateway, ledger, sim } = setup();
    const p = await gateway.prepare(request({ nonTokenUnitBounds: { tool_call: 2, undeclared_unit: 9 } }));
    expect(p.state).toBe('reserved');
    expect(ledger.reserveAttempt).toHaveBeenCalledWith(expect.objectContaining({
      turnKey: 'turn:test', attemptNumber: 1, descriptor: STANDARD, countedInputTokens: sim.countTokens(p.envelope, { mode: 'text' }),
      maxOutputTokens: 256, nonTokenUnitBounds: { tool_call: 2 }, userId: 'u-1', tier: 'noetia_plus', capability: 'research_session',
    }));
    expect((await gateway.prepare(request({ turnKey: 'turn:t2' }))).nonTokenUnitBounds).toEqual({ tool_call: 0 }); // declared but unset → 0
  });

  it('capability_unavailable ends the request before any reservation (metric, not_sent)', async () => {
    const { gateway, ledger, metrics } = setup();
    const e = await gateway.prepare(request({ requiredCapabilities: ['undeclared_capability'] })).catch((x) => x);
    expect(e).toBeInstanceOf(GatewayNotSent);
    expect(e).toMatchObject({ error: 'capability_unavailable', reason: 'turn_failed' });
    expect(ledger.reserveAttempt).not.toHaveBeenCalled();
    expect(metrics.capabilityUnavailableInc).toHaveBeenCalledTimes(1);
    expect(metrics.gatewayOutcomeInc).toHaveBeenCalledWith('not_sent');
  });

  it('context_too_large (by the adapter count) ends the request before any reservation', async () => {
    const small = assertCapabilityDescriptor({ ...JSON.parse(JSON.stringify(RAW_SIMULATOR_DESCRIPTORS[0])), maxContextTokens: 50 });
    const { gateway, ledger, metrics } = setup({ adapters: [new SimulatorV2Adapter(small)] });
    const e = await gateway.prepare(request()).catch((x) => x);
    expect(e).toMatchObject({ error: 'context_too_large', reason: 'invalid_request' });
    expect(ledger.reserveAttempt).not.toHaveBeenCalled();
    expect(metrics.capabilityUnavailableInc).not.toHaveBeenCalled();
  });

  it('rejects an unsealed or mismatched context and any template not bound to the path (programming errors)', async () => {
    const { gateway, ledger } = setup();
    const unsealed = { pathId: 'research_session.turn', invariant: 'research_session_context', userId: 'u-1', allowedBookIds: ['b-1'], items: [CHUNK] };
    await expect(gateway.prepare(request({ context: unsealed as any }))).rejects.toThrow('context invariant');
    await expect(gateway.prepare(request({ context: sealContext({ ...context(), invariant: 'other' }) }))).rejects.toThrow('context invariant');
    await expect(gateway.prepare(request({ pathId: 'unknown.path' as any }))).rejects.toThrow('context invariant');
    for (const t of ['free-form prompt', 'constructor', '__proto__']) await expect(gateway.prepare(request({ templateId: t }))).rejects.toThrow('template');
    expect(ledger.reserveAttempt).not.toHaveBeenCalled();
  });

  it('a ledger denial propagates (no provider call)', async () => {
    const { gateway, ledger, sim } = setup();
    ledger.reserveAttempt.mockRejectedValueOnce(new Error('denied'));
    const spy = jest.spyOn(sim, 'invoke');
    await expect(gateway.prepare(request())).rejects.toThrow('denied');
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('AiGatewayService.invoke / stream — order, settlement, citations', () => {
  it('reserve → provider call → settle; events arrive as deltas, then validated segments, then usage, then terminal', async () => {
    const { gateway, ledger, sim, metrics } = setup();
    const spy = jest.spyOn(sim, 'invoke');
    const p = await gateway.prepare(request());
    const events = await collect(gateway.stream(p));
    const types = events.map((e) => e.type);
    expect(types.indexOf('delta')).toBe(0);
    expect(types.lastIndexOf('delta')).toBeLessThan(types.indexOf('segment'));
    expect(types.slice(-2)).toEqual(['usage', 'terminal']);
    expect(ledger.reserveAttempt.mock.invocationCallOrder[0]).toBeLessThan(spy.mock.invocationCallOrder[0]);
    expect(spy.mock.invocationCallOrder[0]).toBeLessThan(ledger.settleAttempt.mock.invocationCallOrder[0]);
    const terminal = events.at(-1) as Extract<GatewayEvent, { type: 'terminal' }>;
    expect(terminal.response).toMatchObject({ outcome: 'completed', error: null, settlement: 'settled', scopeViolation: false, stopReason: 'end_turn' });
    expect(terminal.response.segments[0]).toMatchObject({ origin: 'library', citations: [{ ref: 'c-1', kind: 'chunk', bookId: 'b-1' }] });
    expect(terminal.response.counts).toMatchObject({ librarySegments: 1, citedItems: 1 });
    expect(ledger.settleAttempt).toHaveBeenCalledWith(expect.objectContaining({ attemptKey: 'turn:test:a1', usageCompleteness: 'complete' }));
    expect(metrics.gatewayOutcomeInc).toHaveBeenCalledWith('completed');
  });

  it('a prepared call is used once: invoke twice or after release fails; release is idempotent and only for never-sent calls', async () => {
    const { gateway, ledger } = setup();
    const p = await gateway.prepare(request());
    await gateway.invoke(p);
    await expect(gateway.invoke(p)).rejects.toThrow('already used');
    await gateway.release(p); // already invoked → no release
    expect(ledger.releaseAttempt).not.toHaveBeenCalled();
    const q = await gateway.prepare(request({ turnKey: 'turn:q' }));
    await gateway.release(q);
    await gateway.release(q);
    expect(ledger.releaseAttempt).toHaveBeenCalledTimes(1);
    expect(ledger.releaseAttempt).toHaveBeenCalledWith('turn:q:a1');
    await expect(gateway.invoke(q)).rejects.toThrow('already used');
  });

  it('a citation outside the sealed allowed set is a scope violation: segments dropped, metric, usage still settled once', async () => {
    const { gateway, ledger, sim, metrics } = setup();
    sim.enqueue({ kind: 'citation_error' });
    const r = await gateway.invoke(await gateway.prepare(request()));
    expect(r).toMatchObject({ scopeViolation: true, segments: [], outcome: 'completed' });
    expect(metrics.scopeViolationInc).toHaveBeenCalledTimes(1);
    expect(ledger.settleAttempt).toHaveBeenCalledTimes(1);
  });

  it('a tool call naming a book outside the allowed set is a scope violation', async () => {
    const { gateway, sim } = setup();
    sim.enqueue({ kind: 'success', toolCalls: [{ name: 'retrieve', bookId: 'b-9' }] });
    expect((await gateway.invoke(await gateway.prepare(request({ nonTokenUnitBounds: { tool_call: 1 } })))).scopeViolation).toBe(true);
  });

  it('a library segment without a valid citation is never returned as library', async () => {
    const { gateway, sim } = setup();
    sim.enqueue({ kind: 'success', segments: [{ origin: 'library', text: 'Uncited claim.' }] });
    const r = await gateway.invoke(await gateway.prepare(request()));
    expect(r.segments).toEqual([{ origin: 'synthesis', text: 'Uncited claim.', citations: [] }]);
  });

  it('structured output: a valid object reaches the caller; an invalid one is completed + malformed_output, settled, withheld', async () => {
    const schema = { type: 'object' as const, required: ['answer'], properties: { answer: { type: 'string' as const } } };
    const ok = setup();
    ok.sim.enqueue({ kind: 'success', structured: { answer: 'Invented.' } });
    const good = await ok.gateway.invoke(await ok.gateway.prepare(request({ output: { mode: 'structured', schema } })));
    expect(good).toMatchObject({ outcome: 'completed', error: null, structured: { answer: 'Invented.' }, segments: [] });
    const bad = setup();
    bad.sim.enqueue({ kind: 'malformed' });
    const r = await bad.gateway.invoke(await bad.gateway.prepare(request({ output: { mode: 'structured', schema } })));
    expect(r).toMatchObject({ outcome: 'completed', error: 'malformed_output', segments: [] });
    expect(r.structured).toBeUndefined();
    expect(bad.ledger.settleAttempt).toHaveBeenCalledWith(expect.objectContaining({ error: 'malformed_output', usageCompleteness: 'complete' }));
    const wrongShape = setup();
    wrongShape.sim.enqueue({ kind: 'success', structured: { answer: 7 } });
    expect((await wrongShape.gateway.invoke(await wrongShape.gateway.prepare(request({ output: { mode: 'structured', schema } })))).error).toBe('malformed_output');
  });

  it('a ledger outage at settlement leaves the attempt held', async () => {
    const { gateway, ledger } = setup();
    ledger.settleAttempt.mockRejectedValueOnce(new Error('ledger down'));
    const r = await gateway.invoke(await gateway.prepare(request()));
    expect(r.settlement).toBe('held');
    expect(r.attempts[0].settlement).toBe('ledger_error');
  });
});

describe('AiGatewayService — retries (shared outcome model, each attempt reserved separately)', () => {
  const retrying = { maxProviderAttempts: 3, maxRetryDelayMs: 1_000 };

  it('rate_limited is retried after retry-after as a new reserved attempt; the first is held without evidence', async () => {
    const { gateway, ledger, sim, metrics } = setup({ config: retrying });
    sim.enqueue({ kind: 'reject', error: 'rate_limited', evidence: 'none', retryAfterMs: 40 }, { kind: 'success' });
    const p = await gateway.prepare(request());
    const events: GatewayEvent[] = [];
    const at: number[] = [];
    for await (const e of gateway.stream(p)) { events.push(e); at.push(performance.now()); }
    const retryAt = events.findIndex((e) => e.type === 'retry');
    expect(at[retryAt + 1] - at[retryAt]).toBeGreaterThanOrEqual(38); // retry-after honoured before the next attempt
    expect(events.find((e) => e.type === 'retry')).toEqual({ type: 'retry', attemptNumber: 2, afterMs: 40 });
    expect(ledger.reserveAttempt.mock.calls.map((c: any[]) => c[0].attemptNumber)).toEqual([1, 2]);
    const r = (events.at(-1) as any).response;
    expect(r.attempts.map((a: any) => [a.attemptKey, a.error, a.settlement])).toEqual([['turn:test:a1', 'rate_limited', 'held'], ['turn:test:a2', null, 'settled']]);
    expect(r).toMatchObject({ outcome: 'completed', settlement: 'held' }); // attempt 1 is still held by the ledger
    expect(metrics.gatewayRetryInc).toHaveBeenCalledTimes(1);
  });

  it('timeout and provider_unavailable are retried; the bound is honoured', async () => {
    const { gateway, ledger, sim } = setup({ config: { ...retrying, providerTimeoutMs: 20 } });
    sim.enqueue({ kind: 'timeout' }, { kind: 'unavailable' }, { kind: 'unavailable' });
    const r = await gateway.invoke(await gateway.prepare(request()));
    expect(r.attempts.map((a) => a.error)).toEqual(['timeout', 'provider_unavailable', 'provider_unavailable']);
    expect(ledger.reserveAttempt).toHaveBeenCalledTimes(3);
    expect(r).toMatchObject({ outcome: 'failed', error: 'provider_unavailable', settlement: 'held' });
  });

  it.each([
    ['non-retryable rows', { kind: 'reject', error: 'invalid_request', evidence: 'none' }, {}],
    ['retry-after above the configured maximum', { kind: 'reject', error: 'rate_limited', evidence: 'none', retryAfterMs: 5_000 }, {}],
    ['retries disabled by default (1 attempt)', { kind: 'unavailable' }, { maxProviderAttempts: undefined }],
  ] as const)('no retry for %s', async (_l, step, over) => {
    const { gateway, ledger, sim } = setup({ config: { ...retrying, ...over } });
    sim.enqueue(step as any, { kind: 'success' });
    const r = await gateway.invoke(await gateway.prepare(request()));
    expect(r.attempts).toHaveLength(1);
    expect(ledger.reserveAttempt).toHaveBeenCalledTimes(1);
  });

  it('never retries once deltas were emitted (a partial stream that times out)', async () => {
    const { gateway, sim } = setup({ config: { ...retrying, providerTimeoutMs: 30 } });
    sim.enqueue({ kind: 'partial_stream', deltas: 1, then: 'hang' }, { kind: 'success' });
    const r = await gateway.invoke(await gateway.prepare(request()));
    expect(r.attempts).toHaveLength(1);
    expect(r).toMatchObject({ outcome: 'timed_out', error: 'timeout', segments: [] });
  });

  it('a retry that the ledger does not admit stops the call; the last attempt stands', async () => {
    const { gateway, ledger, sim } = setup({ config: retrying });
    sim.enqueue({ kind: 'unavailable' }, { kind: 'success' });
    const p = await gateway.prepare(request());
    ledger.reserveAttempt.mockRejectedValueOnce(new Error('global_allowance'));
    const r = await gateway.invoke(p);
    expect(r.attempts).toHaveLength(1);
    expect(r.error).toBe('provider_unavailable');
  });

  it('documented_no_charge on a descriptor that declares it releases; on one that does not, it is held (evidence discipline)', async () => {
    const declared = setup({ adapters: [new SimulatorV2Adapter(LONG)] });
    (declared.gateway as any).router.adapters[0].enqueue({ kind: 'reject', error: 'rate_limited', evidence: 'documented_no_charge', retryAfterMs: 0 });
    const a = await declared.gateway.invoke(await declared.gateway.prepare(request()));
    expect(a.usage).toMatchObject({ usageCompleteness: 'zero_confirmed', zeroUsageEvidence: 'documented_no_charge' });
    const undeclared = setup();
    undeclared.sim.enqueue({ kind: 'reject', error: 'rate_limited', evidence: 'documented_no_charge', retryAfterMs: 0 });
    const b = await undeclared.gateway.invoke(await undeclared.gateway.prepare(request()));
    expect(b.usage).toMatchObject({ usageCompleteness: 'unknown', zeroUsageEvidence: 'none' });
    expect(undeclared.ledger.settleAttempt).toHaveBeenCalledWith(expect.objectContaining({ usageCompleteness: 'unknown' }));
  });
});

describe('AiGatewayService — abort, timeout, and misbehaving adapters', () => {
  it('a client abort mid-stream cancels the simulated call and yields client_abort / aborted with partial usage', async () => {
    const { gateway, ledger, sim } = setup();
    sim.enqueue({ kind: 'partial_stream', deltas: 5, then: 'hang' });
    const ctrl = new AbortController();
    const events: GatewayEvent[] = [];
    for await (const e of gateway.stream(await gateway.prepare(request()), { signal: ctrl.signal })) {
      events.push(e);
      if (e.type === 'delta') ctrl.abort();
    }
    const r = (events.at(-1) as any).response;
    expect(r).toMatchObject({ outcome: 'aborted', error: 'client_abort', segments: [], settlement: 'held' });
    expect(r.usage.usageCompleteness).toBe('partial');
    expect(ledger.settleAttempt).toHaveBeenCalledWith(expect.objectContaining({ error: 'client_abort', usageCompleteness: 'partial' }));
  });

  it('a call aborted before it starts is released (never sent), not settled', async () => {
    const { gateway, ledger, sim } = setup();
    const spy = jest.spyOn(sim, 'invoke');
    const ctrl = new AbortController();
    ctrl.abort();
    const r = await gateway.invoke(await gateway.prepare(request()), { signal: ctrl.signal });
    expect(spy).not.toHaveBeenCalled();
    expect(ledger.releaseAttempt).toHaveBeenCalledWith('turn:test:a1');
    expect(ledger.settleAttempt).not.toHaveBeenCalled();
    expect(r).toMatchObject({ outcome: 'aborted', settlement: 'settled' });
  });

  it('the Gateway timeout yields timed_out / unknown even if the adapter reports something else on abort', async () => {
    const { gateway, sim } = setup({ config: { providerTimeoutMs: 20 } });
    sim.enqueue({ kind: 'timeout' });
    const r = await gateway.invoke(await gateway.prepare(request()));
    expect(r.usage).toMatchObject({ outcome: 'timed_out', error: 'timeout', usageCompleteness: 'unknown' });
  });

  it('an adapter that ignores abort is cut off after the grace period (timed_out)', async () => {
    const hang = new ScriptedAdapter(STANDARD, async function* () { await new Promise(() => undefined); yield* []; }); // never yields
    const { gateway } = setup({ adapters: [hang], config: { providerTimeoutMs: 20, abortGraceMs: 20 } });
    const t0 = Date.now();
    const r = await gateway.invoke(await gateway.prepare(request()));
    expect(Date.now() - t0).toBeLessThan(1_000);
    expect(r.error).toBe('timeout');
  });

  it('an adapter that throws, or ends without a usage record, is internal / unknown (held)', async () => {
    const t = setup();
    t.sim.enqueue({ kind: 'internal' }, { kind: 'partial_stream', deltas: 1, then: 'drop' });
    expect((await t.gateway.invoke(await t.gateway.prepare(request()))).usage).toMatchObject({ error: 'internal', usageCompleteness: 'unknown' });
    expect((await t.gateway.invoke(await t.gateway.prepare(request({ turnKey: 'turn:2' })))).usage).toMatchObject({ error: 'internal', usageCompleteness: 'unknown' });
  });

  it('events after the final record are ignored; an invalid usage record becomes internal / unknown', async () => {
    const late = new ScriptedAdapter(STANDARD, async function* (req) {
      yield { type: 'final', usage: usageFor(req, STANDARD) };
      yield { type: 'delta', segment: 0, origin: 'synthesis', text: 'late' };
    });
    const a = setup({ adapters: [late] });
    const events = await collect(a.gateway.stream(await a.gateway.prepare(request())));
    expect(events.filter((e) => e.type === 'delta')).toHaveLength(0);
    const invalid = new ScriptedAdapter(STANDARD, async function* (req) { yield { type: 'final', usage: { ...usageFor(req, STANDARD), attemptKey: 'other' } }; });
    const b = setup({ adapters: [invalid] });
    expect((await b.gateway.invoke(await b.gateway.prepare(request()))).usage).toMatchObject({ error: 'internal', usageCompleteness: 'unknown' });
  });
});
