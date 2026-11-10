import { DataSource } from 'typeorm';
import { assertPricingSchema, priceUsage } from '../../../src/knowledge/ai/contract';
import { RAW_FIXTURE_UNIT_WEIGHTS } from '../../../src/knowledge/ai/contract/fixtures';
import { AiGatewayService, GatewayNotSent } from '../../../src/knowledge/ai/gateway/ai-gateway.service';
import { CapabilityRouterService } from '../../../src/knowledge/ai/gateway/capability-router.service';
import { GatewayRequest } from '../../../src/knowledge/ai/gateway/gateway.types';
import { RAW_SIMULATOR_PRICING, SIMULATOR_DESCRIPTORS } from '../../../src/knowledge/ai/simulator/simulator-fixtures';
import { SimStep, SimulatorV2Adapter } from '../../../src/knowledge/ai/simulator/simulator-v2';
import { sealContext } from '../../../src/knowledge/ai/verified-context';
import { KnowledgeMetricsService } from '../../../src/knowledge/common/knowledge-metrics.service';
import { AttemptDenied } from '../../../src/knowledge/metering/cost-ledger.service';
import { budgetPolicy, IT_CONFIG, openDataSource } from './support/it-env';
import { addActivePricing, CAP, CostWiring, newUser, resetCostState, rowCount, setGlobalPolicy, wireCost } from './support/cost-env';

/** NEM-022 §5.9 / AC-8: negotiation → count → E1 reservation → simulated call → normalized usage → E1 settlement. */
const [STANDARD, LONG] = SIMULATOR_DESCRIPTORS;
const PRICING = RAW_SIMULATOR_PRICING.map((p) => assertPricingSchema(JSON.parse(JSON.stringify(p))));
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

describe('NEM-022 Gateway v2 end to end through the NEM-021 cost ledger (real PostgreSQL)', () => {
  let ds: DataSource;
  let w: CostWiring;
  beforeAll(async () => { ds = await openDataSource(); w = wireCost(ds); });
  afterAll(async () => { await resetCostState(ds); await ds?.destroy(); });
  afterEach(() => jest.restoreAllMocks());

  async function configure(allowance = 1_000_000_000_000n) {
    await resetCostState(ds);
    await budgetPolicy(ds, 'noetia_plus', CAP, { allowanceUnits: 1_000_000_000, maxUnresolvedUnits: 1_000_000_000 });
    for (const raw of RAW_SIMULATOR_PRICING) await addActivePricing(w, clone(raw));
    await w.costConfig.activateUnitWeightSchema(await w.costConfig.addUnitWeightSchema(clone(RAW_FIXTURE_UNIT_WEIGHTS)));
    await setGlobalPolicy(w, allowance);
  }

  function gateway(steps: SimStep[] = [], o: { descriptor?: typeof STANDARD; config?: object } = {}) {
    const sim = new SimulatorV2Adapter(o.descriptor ?? STANDARD, { seed: 'e2e' });
    sim.enqueue(...steps);
    return { sim, gw: new AiGatewayService(new CapabilityRouterService([sim]), w.costLedger, new KnowledgeMetricsService(), { ...IT_CONFIG, ...o.config }) };
  }

  const request = (userId: string, turnKey: string, over: Partial<GatewayRequest> = {}): GatewayRequest => ({
    pathId: 'research_session.turn', templateId: 'research_session.turn.v1', requiredCapabilities: ['research_session'],
    context: sealContext({ pathId: 'research_session.turn', invariant: 'research_session_context', userId, allowedBookIds: ['b-1'],
      items: [{ kind: 'chunk', ref: 'c-1', bookId: 'b-1', text: 'An invented passage.' }] }),
    output: { mode: 'text' }, maxOutputTokens: 256, cacheIntent: { mode: 'none' }, turnKey,
    budget: { userId, tier: 'noetia_plus', capability: CAP, sessionId: null }, nonTokenUnitBounds: { tool_call: 1 }, ...over,
  });
  const entries = async (key: string) => (await ds.query(`SELECT "entryType" FROM ai_budget_ledger WHERE "idempotencyKey" = $1 ORDER BY id`, [key])).map((r: any) => r.entryType);
  const state = async () => (await w.costLedger.globalState())!;

  it('success: the reservation is the E1 worst case and the settlement is exactly E1 priceUsage of the usage, with the pinned schema', async () => {
    await configure();
    const u = await newUser(ds);
    const { gw } = gateway();
    const p = await gw.prepare(request(u, 'turn:e2e-ok'));
    const r = await gw.invoke(p);
    expect(r).toMatchObject({ outcome: 'completed', settlement: 'settled' });
    const key = 'turn:e2e-ok:a1';
    expect(await entries(key)).toEqual(['reservation', 'settlement']);
    const [row] = await ds.query(`SELECT "settledMicroUsd"::text AS s FROM ai_budget_ledger WHERE "idempotencyKey" = $1 AND "entryType" = 'settlement'`, [key]);
    const actual = priceUsage(r.usage, PRICING[0]).microUsd;
    expect(row.s).toBe(actual.toString());
    expect(actual <= p.firstReservation.reservedMicroUsd).toBe(true);
    expect(await state()).toMatchObject({ settled: actual, held: 0n });
  });

  it('retry: each attempt reserves separately; an unevidenced rate limit stays held, an evidenced one is released', async () => {
    await configure();
    const u = await newUser(ds);
    const retry = { maxProviderAttempts: 3, maxRetryDelayMs: 100 };
    const a = gateway([{ kind: 'reject', error: 'rate_limited', evidence: 'none', retryAfterMs: 10 }, { kind: 'success' }], { config: retry });
    const pa = await a.gw.prepare(request(u, 'turn:e2e-retry'));
    const ra = await a.gw.invoke(pa);
    expect(ra.attempts.map((x) => x.settlement)).toEqual(['held', 'settled']);
    expect(await entries('turn:e2e-retry:a1')).toEqual(['reservation']);
    expect(await entries('turn:e2e-retry:a2')).toEqual(['reservation', 'settlement']);
    expect((await state()).held).toBe(pa.firstReservation.reservedMicroUsd);
    const b = gateway([{ kind: 'reject', error: 'rate_limited', evidence: 'documented_no_charge', retryAfterMs: 0 }, { kind: 'success' }], { descriptor: LONG, config: retry });
    const rb = await b.gw.invoke(await b.gw.prepare(request(u, 'turn:e2e-retry-doc')));
    expect(rb.attempts.map((x) => x.settlement)).toEqual(['released', 'settled']);
    expect(rb.settlement).toBe('settled');
    expect(await entries('turn:e2e-retry-doc:a1')).toEqual(['reservation', 'release']);
  });

  it.each<[string, SimStep, object, string[], string]>([
    ['refusal with complete usage', { kind: 'refusal', category: 'policy', completeness: 'complete' }, {}, ['reservation', 'settlement'], 'settled'],
    ['refusal with partial usage', { kind: 'refusal', category: 'policy', completeness: 'partial' }, {}, ['reservation'], 'partially_settled'],
    ['timeout', { kind: 'timeout' }, { providerTimeoutMs: 30 }, ['reservation'], 'held'],
    ['partial stream that ends without usage', { kind: 'partial_stream', deltas: 1, then: 'drop' }, {}, ['reservation'], 'held'],
    ['invalid request without evidence', { kind: 'reject', error: 'invalid_request', evidence: 'none' }, {}, ['reservation'], 'held'],
    ['invalid request with provider-reported zero', { kind: 'reject', error: 'invalid_request', evidence: 'provider_reported_zero' }, {}, ['reservation', 'release'], 'released'],
    ['undeclared documented_no_charge is held, never released', { kind: 'reject', error: 'rate_limited', evidence: 'documented_no_charge' }, {}, ['reservation'], 'held'],
    ['provider unavailable', { kind: 'unavailable' }, {}, ['reservation'], 'held'],
  ])('contract row through the ledger: %s', async (_l, step, config, expected, settlement) => {
    await configure();
    const u = await newUser(ds);
    const { gw } = gateway([step], { config });
    const key = `turn:e2e-row-${Math.random().toString(36).slice(2)}`;
    const r = await gw.invoke(await gw.prepare(request(u, key)));
    expect(r.attempts[0].settlement).toBe(settlement);
    expect(await entries(`${key}:a1`)).toEqual(expected);
  });

  it('client abort mid-stream: client_abort / aborted with partial usage, held at the reserved amount', async () => {
    await configure();
    const u = await newUser(ds);
    const { gw } = gateway([{ kind: 'partial_stream', deltas: 5, then: 'hang' }]);
    const p = await gw.prepare(request(u, 'turn:e2e-abort'));
    const ctrl = new AbortController();
    let response: any;
    for await (const e of gw.stream(p, { signal: ctrl.signal })) {
      if (e.type === 'delta') ctrl.abort();
      if (e.type === 'terminal') response = e.response;
    }
    expect(response).toMatchObject({ outcome: 'aborted', error: 'client_abort', settlement: 'held' });
    expect(response.usage.usageCompleteness).toBe('partial');
    expect(await state()).toMatchObject({ held: p.firstReservation.reservedMicroUsd, settled: 0n });
  });

  it('structured output that fails validation is completed + malformed_output and settled', async () => {
    await configure();
    const u = await newUser(ds);
    const { gw } = gateway([{ kind: 'malformed' }]);
    const r = await gw.invoke(await gw.prepare(request(u, 'turn:e2e-malformed', { output: { mode: 'structured', schema: { type: 'object' } } })));
    expect(r).toMatchObject({ outcome: 'completed', error: 'malformed_output', settlement: 'settled' });
    expect(r.structured).toBeUndefined();
  });

  it('capability_unavailable and context_too_large are decided before any reservation', async () => {
    await configure();
    const u = await newUser(ds);
    const { gw } = gateway();
    await expect(gw.prepare(request(u, 'turn:e2e-cap', { requiredCapabilities: ['web_search'] }))).rejects.toBeInstanceOf(GatewayNotSent);
    await expect(gw.prepare(request(u, 'turn:e2e-big', { context: sealContext({ pathId: 'research_session.turn', invariant: 'research_session_context', userId: u,
      allowedBookIds: ['b-1'], items: [{ kind: 'chunk', ref: 'c-1', bookId: 'b-1', text: 'x'.repeat(4_100_000) }] }) }))).rejects.toMatchObject({ error: 'context_too_large' });
    expect(await rowCount(ds, `SELECT count(*) AS n FROM ai_budget_ledger WHERE "entryType" = 'reservation'`)).toBe(0);
  });

  it('admission invariant under concurrent distinct users through the Gateway; settled + held ≤ allowance when usage stays within reservations', async () => {
    await configure(); // measure one attempt's worst case, then set the allowance to just over five of them
    const probe = gateway();
    const one = await probe.gw.prepare(request(await newUser(ds), 'turn:e2e-probe'));
    await probe.gw.release(one);
    const allowance = one.firstReservation.reservedMicroUsd * 5n + 1n;
    await configure(allowance);
    const users = await Promise.all(Array.from({ length: 16 }, () => newUser(ds)));
    // Admissions race while every admitted reservation is still held (the contested boundary), then the calls run.
    const results = await Promise.all(users.map(async (u, i) => {
      const { gw } = gateway();
      try {
        return { gw, p: await gw.prepare(request(u, `turn:e2e-par-${i}`)) };
      } catch (e) {
        return { e };
      }
    }));
    const admitted = results.filter((x): x is { gw: AiGatewayService; p: any } => 'p' in x);
    const denied = results.filter((x) => 'e' in x).map((x: any) => x.e);
    expect((await state()).committed <= allowance).toBe(true);
    await Promise.all(admitted.map(({ gw, p }) => gw.invoke(p)));
    expect(admitted.length).toBeGreaterThan(0);
    expect(denied.length).toBeGreaterThan(0);
    expect(denied.every((e) => e instanceof AttemptDenied && e.cause === 'global_allowance')).toBe(true);
    for (const { p } of admitted) expect(p.firstReservation.committedBeforeMicroUsd + p.firstReservation.reservedMicroUsd <= allowance).toBe(true);
    const s = await state();
    expect(s.settled + s.held <= allowance).toBe(true);
    expect(s.held).toBe(0n);
  });

  it('overrun (the simulated provider ignores max_tokens): full actual settled once, overrun classified, breaker opens, later admissions denied', async () => {
    await configure();
    const u = await newUser(ds);
    const { gw } = gateway([{ kind: 'success', outputTokens: 50_000 }]);
    const p = await gw.prepare(request(u, 'turn:e2e-overrun'));
    const r = await gw.invoke(p);
    const actual = priceUsage(r.usage, PRICING[0]).microUsd;
    expect(actual > p.firstReservation.reservedMicroUsd).toBe(true);
    expect(await state()).toMatchObject({ settled: actual, held: 0n, committed: actual, overrunClassified: actual - p.firstReservation.reservedMicroUsd });
    expect(await rowCount(ds, `SELECT count(*) AS n FROM ai_cost_overruns WHERE "attemptKey" = 'turn:e2e-overrun:a1'`)).toBe(1);
    const next = gateway();
    const e = await next.gw.prepare(request(u, 'turn:e2e-after-overrun')).catch((x) => x);
    expect(e).toBeInstanceOf(AttemptDenied);
    expect(e.cause).toBe('overrun_breaker_open');
  });
});
