import { priceUsage } from '../../../src/knowledge/ai/contract';
import { CostConfigError } from '../../../src/knowledge/metering/cost-config.service';
import { DataSource } from 'typeorm';
import { budgetPolicy, openDataSource } from './support/it-env';
import {
  addActivePricing, attempt, attemptB, CAP, CostWiring, denialCause, failNextQuery, goldenPricing, newUser, resetCostState,
  pauseAt, rowCount, sealedGolden, setGlobalPolicy, standardSetup, usage, waitForAdvisoryLockWaiter, wireCost,
} from './support/cost-env';

/** NEM-021 Phase 2 acceptance on real PostgreSQL (§11 AC-4 … AC-10; §12). Fixture values only. */
describe('NEM-021 cost-aware ledger on real PostgreSQL', () => {
  let ds: DataSource;
  let w: CostWiring;
  let cfg: Awaited<ReturnType<typeof standardSetup>>;

  beforeAll(async () => {
    ds = await openDataSource();
    w = wireCost(ds);
  });
  beforeEach(async () => { cfg = await standardSetup(ds, w); });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    await resetCostState(ds);
    await ds?.destroy();
  });

  const state = async () => (await w.costLedger.globalState())!;
  const reservations = () => rowCount(ds, `SELECT count(*) AS n FROM ai_budget_ledger WHERE "entryType" = 'reservation' AND "attemptNumber" IS NOT NULL`);

  describe('AC-4: admission invariant (F-1)', () => {
    it('N distinct users in parallel, variable costs: committed + reservation ≤ allowance at EVERY admission', async () => {
      const allowance = 1_000_000n;
      await setGlobalPolicy(w, allowance);
      const users = await Promise.all(Array.from({ length: 20 }, () => newUser(ds)));
      // Variable worst cases: 50,000 … 200,000 µUSD (golden pricing: µUSD = tokens). Σ ≈ 2.5M > allowance.
      const reqs = users.map((u, i) => attempt(u, 50_000 + ((i * 7_919) % 150_000), 1_000));
      const results = await Promise.all(reqs.map((r) => w.costLedger.reserveAttempt(r).then((ok) => ({ ok }), (e) => ({ e }))));
      const admitted = results.flatMap((r) => ('ok' in r ? [r.ok] : []));
      const denied = results.flatMap((r) => ('e' in r ? [r.e] : []));
      expect(admitted.length).toBeGreaterThan(0);
      expect(denied.length).toBeGreaterThan(0); // the boundary was actually contested
      expect(denied.every((e: any) => e.cause === 'global_allowance' && e.reason === 'budget_unavailable')).toBe(true);
      // Instrumented check, read under the global lock at each admission.
      for (const a of admitted) expect(a.committedBeforeMicroUsd + a.reservedMicroUsd <= allowance).toBe(true);
      // Serialization proof: each admission saw exactly the sum of the admissions before it.
      const ordered = [...admitted].sort((x, y) => (x.committedBeforeMicroUsd < y.committedBeforeMicroUsd ? -1 : 1));
      let running = 0n;
      for (const a of ordered) {
        expect(a.committedBeforeMicroUsd).toBe(running);
        running += a.reservedMicroUsd;
      }
      const s = await state();
      expect(s.held).toBe(running);
      expect(s.committed <= allowance).toBe(true);
      // When actual ≤ reserved for all attempts, final settled + held ≤ allowance.
      for (const a of admitted) {
        const input = reqs.find((r) => a.attemptKey.startsWith(r.turnKey))!.countedInputTokens!;
        expect(await w.costLedger.settleAttempt(usage(a.attemptKey, { inputUncached: input, output: 500 }))).toBe('settled');
      }
      const after = await state();
      expect(after.held).toBe(0n);
      expect(after.settled + after.held <= allowance).toBe(true);
      expect(after.settled).toBe(running - BigInt(admitted.length * 500));
    });

    it('exact capacity is admitted; one micro-USD over is rejected', async () => {
      const u = await newUser(ds);
      const cost = 123_457n; // input 123,000 + output bound 457 at 1 µUSD per token
      await setGlobalPolicy(w, cost - 1n);
      expect(await denialCause(w.costLedger.reserveAttempt(attempt(u, 123_000, 457)))).toBe('global_allowance');
      expect(await reservations()).toBe(0);
      await setGlobalPolicy(w, cost);
      const r = await w.costLedger.reserveAttempt(attempt(u, 123_000, 457));
      expect(r.reservedMicroUsd).toBe(cost);
      expect(r.committedBeforeMicroUsd + r.reservedMicroUsd).toBe(cost);
      expect(await denialCause(w.costLedger.reserveAttempt(attempt(u, 0, 1)))).toBe('global_allowance'); // 1 µUSD over
    });
  });

  it('AC-6: each retry reserves separately; a turn with three attempts holds three reservations until each resolves', async () => {
    const u = await newUser(ds);
    const base = attempt(u, 100_000);
    const r = [];
    for (const n of [1, 2, 3]) r.push(await w.costLedger.reserveAttempt({ ...base, attemptNumber: n }));
    expect(r.map((x) => x.attemptKey)).toEqual([1, 2, 3].map((n) => `${base.turnKey}:a${n}`));
    expect(await denialCause(w.costLedger.reserveAttempt({ ...base, attemptNumber: 2 }))).toBe('duplicate_attempt');
    expect(await rowCount(ds, `SELECT count(*) AS n FROM ai_budget_ledger WHERE "turnKey" = $1 AND "entryType" = 'reservation'`, [base.turnKey])).toBe(3);
    expect((await state()).held).toBe(300_000n);
    // Attempt 1: rate-limited with provider-reported zero → released. Attempt 2: timeout → held. Attempt 3: settles.
    await w.costLedger.settleAttempt(usage(r[0].attemptKey, {}, { outcome: 'rejected', error: 'rate_limited', usageCompleteness: 'zero_confirmed', zeroUsageEvidence: 'provider_reported_zero' }));
    await w.costLedger.settleAttempt(usage(r[1].attemptKey, {}, { outcome: 'timed_out', error: 'timeout', usageCompleteness: 'unknown' }));
    await w.costLedger.settleAttempt(usage(r[2].attemptKey, { inputUncached: 90_000 }));
    expect(await state()).toMatchObject({ held: 100_000n, settled: 90_000n, committed: 190_000n });
  });

  it('AC-7: settlement uses the pinned schema even if a newer schema is activated mid-flight', async () => {
    const u = await newUser(ds);
    const r = await w.costLedger.reserveAttempt(attempt(u, 10_000, 1_000));
    const v2 = await addActivePricing(w, goldenPricing(2, 3_000_000)); // 3× the price, activated mid-flight
    const done = usage(r.attemptKey, { inputUncached: 10_000, output: 800 });
    expect(await w.costLedger.settleAttempt(done)).toBe('settled');
    const [row] = await ds.query(`SELECT "settledMicroUsd"::text AS s, "pricingSchemaId" AS p FROM ai_budget_ledger WHERE "idempotencyKey" = $1 AND "entryType" = 'settlement'`, [r.attemptKey]);
    expect(row).toEqual({ s: priceUsage(done, sealedGolden(1)).microUsd.toString(), p: cfg.pricingA });
    expect(row.s).toBe('10800');
    // A new admission is priced with the newly active version.
    const next = await w.costLedger.reserveAttempt(attempt(u, 10_000, 1_000));
    expect(next).toMatchObject({ pricingSchemaId: v2, reservedMicroUsd: 33_000n });
  });

  describe('AC-8: unknown and partial usage, ledger outage, reconciliation, replay', () => {
    it('unknown usage holds the reserved amount; expiry flags once and never releases to zero', async () => {
      await budgetPolicy(ds, 'noetia_plus', CAP, { allowanceUnits: 1_000_000_000, maxUnresolvedUnits: 1_000_000_000, reservationTtlSeconds: 1 });
      const r = await w.costLedger.reserveAttempt(attempt(await newUser(ds), 50_000));
      expect(await w.costLedger.settleAttempt(usage(r.attemptKey, {}, { outcome: 'failed', error: 'provider_unavailable', usageCompleteness: 'unknown' }))).toBe('held');
      expect((await state()).held).toBe(50_000n);
      await ds.query(`UPDATE ai_budget_ledger SET "expiresAt" = now() - interval '1 second' WHERE "idempotencyKey" = $1`, [r.attemptKey]);
      expect(await w.costLedger.reconcileAttempts()).toEqual({ settled: 0, released: 0, flaggedExpired: 1, held: 1 });
      expect(await w.costLedger.reconcileAttempts()).toEqual({ settled: 0, released: 0, flaggedExpired: 0, held: 1 });
      expect((await state()).held).toBe(50_000n);
    });

    it('ledger outage at settlement → held; reconciliation settles exactly once; replays never double-charge', async () => {
      const r = await w.costLedger.reserveAttempt(attempt(await newUser(ds), 40_000, 2_000));
      const done = usage(r.attemptKey, { inputUncached: 40_000, output: 1_500 });
      failNextQuery(w, /'settlement', \$2, \$3/);
      await expect(w.costLedger.settleAttempt(done)).rejects.toThrow('simulated ledger outage');
      expect(await state()).toMatchObject({ held: 42_000n, settled: 0n });
      expect(await w.costLedger.reconcileAttempts()).toMatchObject({ settled: 1, held: 0 });
      expect(await w.costLedger.reconcileAttempts()).toMatchObject({ settled: 0, held: 0 });
      expect(await w.costLedger.settleAttempt(done)).toBe('already_resolved');
      expect(await rowCount(ds, `SELECT count(*) AS n FROM ai_budget_ledger WHERE "idempotencyKey" = $1 AND "entryType" = 'settlement'`, [r.attemptKey])).toBe(1);
      expect(await state()).toMatchObject({ held: 0n, settled: 41_500n, committed: 41_500n });
    });

    it('concurrent reconcilers and concurrent settlements never double-settle', async () => {
      const keys = [];
      for (let i = 0; i < 5; i++) {
        const r = await w.costLedger.reserveAttempt(attempt(await newUser(ds), 10_000));
        keys.push(r.attemptKey);
        failNextQuery(w, /'settlement', \$2, \$3/);
        await w.costLedger.settleAttempt(usage(r.attemptKey, { inputUncached: 10_000 })).catch(() => undefined);
      }
      const passes = await Promise.all([w.costLedger.reconcileAttempts(), w.costLedger.reconcileAttempts(), w.costLedger.reconcileAttempts()]);
      expect(passes.reduce((a, p) => a + p.settled, 0)).toBe(5);
      const replays = await Promise.all(keys.map((k) => w.costLedger.settleAttempt(usage(k, { inputUncached: 10_000 }))));
      expect(replays.every((x) => x === 'already_resolved')).toBe(true);
      expect(await state()).toMatchObject({ settled: 50_000n, held: 0n });
    });

    it('the database itself refuses a second resolution for an attempt key', async () => {
      const r = await w.costLedger.reserveAttempt(attempt(await newUser(ds), 1_000));
      await w.costLedger.settleAttempt(usage(r.attemptKey, { inputUncached: 1_000 }));
      await expect(ds.query(
        `INSERT INTO ai_budget_ledger ("userId", tier, capability, "idempotencyKey", "entryType", units, "settledMicroUsd")
         SELECT "userId", tier, capability, "idempotencyKey", 'release', 0, 0 FROM ai_budget_ledger WHERE "idempotencyKey" = $1 AND "entryType" = 'reservation'`,
        [r.attemptKey])).rejects.toThrow(/UQ_ai_budget_ledger_resolution/);
    });
  });

  describe('AC-9a: golden accounting (F-4)', () => {
    it('reserve $1.00, actual $1.40 → settled 1.40, held 0, overrun 0.40, committed 1.40 (not 1.80); replay and reconcile change nothing', async () => {
      const r = await w.costLedger.reserveAttempt(attempt(await newUser(ds), 1_000_000));
      expect(r.reservedMicroUsd).toBe(1_000_000n);
      expect(await state()).toMatchObject({ held: 1_000_000n, settled: 0n, overrunClassified: 0n, committed: 1_000_000n });
      const actual = usage(r.attemptKey, { inputUncached: 1_000_000, output: 400_000 }); // the provider ignored max_tokens
      expect(await w.costLedger.settleAttempt(actual)).toBe('settled');
      const golden = { settled: 1_400_000n, held: 0n, overrunClassified: 400_000n, committed: 1_400_000n };
      expect(await state()).toMatchObject(golden);
      for (let i = 0; i < 2; i++) {
        expect(await w.costLedger.settleAttempt(actual)).toBe('already_resolved');
        await w.costLedger.reconcileAttempts();
      }
      expect(await state()).toMatchObject(golden);
      expect(await ds.query(`SELECT "reservedMicroUsd"::text AS r, "actualMicroUsd"::text AS a, "overrunMicroUsd"::text AS o FROM ai_cost_overruns`))
        .toEqual([{ r: '1000000', a: '1400000', o: '400000' }]);
    });

    it('partial: reserved 1.00 → partial 0.30 → final 1.10 gives committed 1.00 → 1.00 → 1.10', async () => {
      const r = await w.costLedger.reserveAttempt(attempt(await newUser(ds), 1_000_000));
      expect((await state()).committed).toBe(1_000_000n);
      const partial = usage(r.attemptKey, { inputUncached: 300_000 }, { outcome: 'refused', error: 'refusal', usageCompleteness: 'partial' });
      expect(await w.costLedger.settleAttempt(partial)).toBe('partially_settled');
      expect(await w.costLedger.settleAttempt(partial)).toBe('partially_settled'); // replay: no second partial
      expect(await state()).toMatchObject({ settled: 300_000n, held: 700_000n, committed: 1_000_000n });
      await w.costLedger.reconcileAttempts(); // no final evidence yet: stays held
      expect((await state()).committed).toBe(1_000_000n);
      const final = usage(r.attemptKey, { inputUncached: 1_000_000, output: 100_000 }, { outcome: 'refused', error: 'refusal', usageCompleteness: 'complete' });
      expect(await w.costLedger.settleAttempt(final)).toBe('settled');
      expect(await state()).toMatchObject({ settled: 1_100_000n, held: 0n, committed: 1_100_000n, overrunClassified: 100_000n });
      await w.costLedger.reconcileAttempts();
      expect((await state()).committed).toBe(1_100_000n);
    });

    it('a partially settled attempt can never be released: the partial obligation stays in committed', async () => {
      const r = await w.costLedger.reserveAttempt(attempt(await newUser(ds), 1_000_000));
      const partial = usage(r.attemptKey, { inputUncached: 300_000 }, { outcome: 'refused', error: 'refusal', usageCompleteness: 'partial' });
      expect(await w.costLedger.settleAttempt(partial)).toBe('partially_settled');
      const expected = { settled: 300_000n, held: 700_000n, committed: 1_000_000n };
      // Not-sent release and contradictory zero evidence are both refused; the attempt stays held.
      await expect(w.costLedger.releaseAttempt(r.attemptKey)).rejects.toThrow('only a final settlement can resolve it');
      const zero = usage(r.attemptKey, {}, { outcome: 'rejected', error: 'rate_limited', usageCompleteness: 'zero_confirmed', zeroUsageEvidence: 'provider_reported_zero' });
      expect(await w.costLedger.settleAttempt(zero)).toBe('held');
      await w.costLedger.reconcileAttempts();
      expect(await state()).toMatchObject(expected);
      expect(await rowCount(ds, `SELECT count(*) AS n FROM ai_budget_ledger WHERE "idempotencyKey" = $1 AND "entryType" = 'release'`, [r.attemptKey])).toBe(0);
      // The final settlement still resolves it, counted once.
      const final = usage(r.attemptKey, { inputUncached: 800_000 }, { outcome: 'refused', error: 'refusal', usageCompleteness: 'complete' });
      expect(await w.costLedger.settleAttempt(final)).toBe('settled');
      expect(await state()).toMatchObject({ settled: 800_000n, held: 0n, committed: 800_000n });
    });
  });

  it('AC-9: injected overrun — exact record, once-only accounting, breaker until reviewed replacement, admissions stop, total = allowance + overruns', async () => {
    await setGlobalPolicy(w, 3_000_000n);
    const users = [await newUser(ds), await newUser(ds), await newUser(ds)];
    const r = [];
    for (const u of users) r.push(await w.costLedger.reserveAttempt(attempt(u, 1_000_000)));
    expect(await denialCause(w.costLedger.reserveAttempt(attempt(users[0], 1)))).toBe('global_allowance');
    await w.costLedger.settleAttempt(usage(r[0].attemptKey, { inputUncached: 1_000_000 }));
    await w.costLedger.settleAttempt(usage(r[1].attemptKey, { inputUncached: 1_000_000 }));
    await w.costLedger.settleAttempt(usage(r[2].attemptKey, { inputUncached: 1_000_000, output: 400_000 })); // injected model error
    // Recorded exactly, never capped; classified once; committed counts it once (through settled).
    expect(await state()).toMatchObject({ settled: 3_400_000n, held: 0n, committed: 3_400_000n, overrunClassified: 400_000n, capacity: -400_000n });
    expect(await rowCount(ds, `SELECT count(*) AS n FROM ai_cost_overruns`)).toBe(1);
    // Final total = allowance bound + exactly the injected overruns.
    expect((await state()).settled).toBe(3_000_000n + 400_000n);
    // Breaker open on the schema used: new admissions priced with it fail closed.
    expect(await ds.query(`SELECT state FROM ai_overrun_breakers WHERE "pricingSchemaId" = $1`, [cfg.pricingA])).toEqual([{ state: 'open' }]);
    await setGlobalPolicy(w, 100_000_000n); // even with capacity, the open breaker denies
    expect(await denialCause(w.costLedger.reserveAttempt(attempt(users[0], 1)))).toBe('overrun_breaker_open');
    // A replacement needs a review reference; the broken schema cannot simply be re-activated.
    const v2 = await w.costConfig.addPricingSchema(goldenPricing(2, 2_000_000));
    await expect(w.costConfig.activatePricingSchema(v2)).rejects.toBeInstanceOf(CostConfigError);
    await expect(w.costConfig.activatePricingSchema(cfg.pricingA, 'ref')).rejects.toBeInstanceOf(CostConfigError);
    expect(await w.costConfig.activatePricingSchema(v2, 'PA-review-fixture-001')).toEqual({ closedBreakers: 1 });
    expect(await ds.query(`SELECT state, "closedByReviewRef" AS ref, "replacementSchemaId" AS rep FROM ai_overrun_breakers`))
      .toEqual([{ state: 'closed', ref: 'PA-review-fixture-001', rep: v2 }]);
    // Admissions stop while capacity is insufficient (capacity is negative under the original allowance).
    await setGlobalPolicy(w, 3_000_000n);
    expect(await denialCause(w.costLedger.reserveAttempt(attempt(users[0], 1)))).toBe('global_allowance');
    await setGlobalPolicy(w, 10_000_000n);
    expect((await w.costLedger.reserveAttempt(attempt(users[0], 1_000))).pricingSchemaId).toBe(v2);
  });

  describe('AC-9b: release requires authoritative evidence (F-4)', () => {
    const rejected = { outcome: 'rejected' as const, error: 'rate_limited' as const };

    it('a rejected attempt with an error category but no evidence is HELD, not released', async () => {
      const r = await w.costLedger.reserveAttempt(attempt(await newUser(ds), 5_000));
      expect(await w.costLedger.settleAttempt(usage(r.attemptKey, {}, { ...rejected, usageCompleteness: 'unknown', zeroUsageEvidence: 'none' }))).toBe('held');
      expect(await w.costLedger.reconcileAttempts()).toMatchObject({ released: 0, held: 1 });
      expect((await state()).held).toBe(5_000n);
    });

    it('provider_reported_zero releases', async () => {
      const r = await w.costLedger.reserveAttempt(attempt(await newUser(ds), 5_000));
      expect(await w.costLedger.settleAttempt(usage(r.attemptKey, {}, { ...rejected, usageCompleteness: 'zero_confirmed', zeroUsageEvidence: 'provider_reported_zero' }))).toBe('released');
      expect(await state()).toMatchObject({ held: 0n, settled: 0n, committed: 0n });
    });

    it('documented_no_charge releases only when the attempt descriptor declares that class (B declares rate_limited; A does not)', async () => {
      const u = await newUser(ds);
      const b = await w.costLedger.reserveAttempt(attemptB(u, 1_000));
      const evidence = { ...rejected, usageCompleteness: 'zero_confirmed' as const, zeroUsageEvidence: 'documented_no_charge' as const };
      expect(await w.costLedger.settleAttempt(usage(b.attemptKey, {}, { ...evidence, providerKey: 'fixture-b', modelKey: 'fixture-b-mid' }))).toBe('released');
      const a = await w.costLedger.reserveAttempt(attempt(u, 1_000));
      expect(await w.costLedger.settleAttempt(usage(a.attemptKey, {}, evidence))).toBe('held');
    });

    it('a never-sent attempt is released through releaseAttempt; a provider-reported attempt cannot be released that way', async () => {
      const u = await newUser(ds);
      const notSent = await w.costLedger.reserveAttempt(attempt(u, 2_000));
      expect(await w.costLedger.releaseAttempt(notSent.attemptKey)).toBe('released');
      const sent = await w.costLedger.reserveAttempt(attempt(u, 2_000));
      await w.costLedger.settleAttempt(usage(sent.attemptKey, {}, { outcome: 'timed_out', error: 'timeout', usageCompleteness: 'unknown' }));
      await expect(w.costLedger.releaseAttempt(sent.attemptKey)).rejects.toThrow('evidenced zero usage');
      expect((await state()).held).toBe(2_000n);
    });
  });

  describe('AC-10: each condition denies before any provider call (no reservation written)', () => {
    it.each([
      ['missing pricing schema', async () => ds.query(`UPDATE ai_pricing_schemas SET active = false`), 'pricing_schema_missing'],
      ['expired pricing schema', async () => {
        await addActivePricing(w, goldenPricing(3), { expiresAt: new Date(Date.now() - 1000) });
      }, 'pricing_schema_expired'],
      ['unset global policy', async () => ds.query(`UPDATE ai_global_budget_policies SET active = false`), 'global_policy_unset'],
      ['exceeded micro-USD unresolved bound', async () => setGlobalPolicy(w, 10_000_000n, 9_999n), 'unresolved_micro_usd_bound'],
      ['missing unit weights', async () => ds.query(`UPDATE ai_unit_weight_schemas SET active = false`), 'unit_weights_missing'],
    ])('%s', async (_l, arrange, expected) => {
      await arrange();
      expect(await denialCause(w.costLedger.reserveAttempt(attempt(await newUser(ds), 10_000)))).toBe(expected);
      expect(await reservations()).toBe(0);
    });

    it('missing input-token count', async () => {
      expect(await denialCause(w.costLedger.reserveAttempt(attempt(await newUser(ds), 0, 0, { countedInputTokens: null })))).toBe('input_count_unavailable');
      expect(await reservations()).toBe(0);
    });

    it('insufficient capacity, including after an overrun', async () => {
      await setGlobalPolicy(w, 100_000n);
      const u = await newUser(ds);
      const r = await w.costLedger.reserveAttempt(attempt(u, 100_000));
      expect(await denialCause(w.costLedger.reserveAttempt(attempt(u, 1)))).toBe('global_allowance');
      await w.costLedger.settleAttempt(usage(r.attemptKey, { inputUncached: 100_000, output: 5 }));
      await addActivePricing(w, goldenPricing(4), { reviewRef: 'PA-review-fixture-002' }); // replacement clears the breaker…
      expect(await denialCause(w.costLedger.reserveAttempt(attempt(u, 1)))).toBe('global_allowance'); // …but capacity is −5
      expect(await reservations()).toBe(1);
    });

    it('per-user unit allowance still applies to attempts (ADR-005 units)', async () => {
      await budgetPolicy(ds, 'noetia_plus', CAP, { allowanceUnits: 5, maxUnresolvedUnits: 1_000_000_000 });
      expect(await denialCause(w.costLedger.reserveAttempt(attempt(await newUser(ds), 1_000_000)))).toBe('unit_allowance');
      expect(await reservations()).toBe(0);
    });
  });

  it('AC-5: legacy NEM-019 reservations and attempts share the per-scope and overall unresolved bounds; legacy paths never resolve attempts', async () => {
    const u = await newUser(ds);
    await budgetPolicy(ds, 'noetia_plus', CAP, { allowanceUnits: 1_000_000_000, maxUnresolvedUnits: 1_000_000_000, reserveUnitsPerTurn: 10 });
    await w.ledger.reserve({ userId: u, tier: 'noetia_plus', capability: CAP, sessionId: null, idempotencyKey: 'legacy-turn-1' });
    const a = await w.costLedger.reserveAttempt(attempt(u, 1_000));
    // Legacy reconciliation and release ignore the attempt; legacy settlement of the attempt key is impossible.
    expect(await w.ledger.release(a.attemptKey)).toBe('already_resolved');
    await w.ledger.reconcile();
    expect((await state()).held).toBe(1_000n);
    // The overall units bound counts both: with a bound below their sum, the next attempt is denied.
    const [{ units }] = await ds.query(`SELECT SUM(units)::int AS units FROM ai_budget_ledger WHERE "entryType" = 'reservation'`);
    const tight = wireCost(ds, { config: { overallUnresolvedUnitsBound: units } });
    expect(await denialCause(tight.costLedger.reserveAttempt(attempt(u, 1_000)))).toBe('overall_unresolved_units');
  });

  describe('F-8: compensation idempotency (adjustment key, migration 074)', () => {
    const comps = (key: string) => rowCount(ds, `SELECT count(*) AS n FROM ai_budget_ledger WHERE "idempotencyKey" = $1 AND "entryType" = 'compensation'`, [key]);
    const settled = async (input = 10_000) => {
      const r = await w.costLedger.reserveAttempt(attempt(await newUser(ds), input));
      await w.costLedger.settleAttempt(usage(r.attemptKey, { inputUncached: input }));
      return r;
    };

    it('distinct adjustments are separate entries; a replay of one is a duplicate; committed counts each once', async () => {
      const r = await settled();
      expect(await w.costLedger.compensateAttempt(r.attemptKey, 'invoice-corr-1', -2_500n)).toBe('recorded');
      expect(await w.costLedger.compensateAttempt(r.attemptKey, 'invoice-corr-2', 1_000n)).toBe('recorded');
      expect(await w.costLedger.compensateAttempt(r.attemptKey, 'invoice-corr-1', -2_500n)).toBe('duplicate'); // retry
      expect(await w.costLedger.compensateAttempt(r.attemptKey, 'invoice-corr-1', -2_500n)).toBe('duplicate'); // retry again
      expect(await comps(r.attemptKey)).toBe(2);
      expect(await state()).toMatchObject({ settled: 10_000n, compensated: -1_500n, committed: 8_500n });
      expect(await rowCount(ds, `SELECT count(*) AS n FROM ai_budget_ledger WHERE "idempotencyKey" = $1 AND "entryType" = 'settlement'`, [r.attemptKey])).toBe(1);
    });

    it('concurrent duplicate submissions of one adjustment write exactly one entry; concurrent distinct adjustments all land', async () => {
      const r = await settled();
      const same = await Promise.all(Array.from({ length: 10 }, () => w.costLedger.compensateAttempt(r.attemptKey, 'invoice-corr-7', -700n)));
      expect(same.filter((x) => x === 'recorded')).toHaveLength(1);
      expect(same.filter((x) => x === 'duplicate')).toHaveLength(9);
      expect(await comps(r.attemptKey)).toBe(1);
      const distinct = await Promise.all([1, 2, 3, 4, 5].map((i) => w.costLedger.compensateAttempt(r.attemptKey, `invoice-line-${i}`, -100n)));
      expect(distinct.every((x) => x === 'recorded')).toBe(true);
      expect(await comps(r.attemptKey)).toBe(6);
      expect((await state()).compensated).toBe(-1_200n);
    });

    it('reusing an adjustment key with a different amount is refused and changes nothing', async () => {
      const r = await settled();
      await w.costLedger.compensateAttempt(r.attemptKey, 'invoice-corr-1', -2_500n);
      await expect(w.costLedger.compensateAttempt(r.attemptKey, 'invoice-corr-1', -3_000n)).rejects.toThrow('different amount');
      expect(await comps(r.attemptKey)).toBe(1);
      expect((await state()).compensated).toBe(-2_500n);
      // The same adjustment key on ANOTHER attempt is a different adjustment.
      const other = await settled();
      expect(await w.costLedger.compensateAttempt(other.attemptKey, 'invoice-corr-1', -3_000n)).toBe('recorded');
    });

    it('the database enforces it: a duplicate keyed row and a key-less micro-USD compensation are refused; NEM-019 units-only compensation is unaffected', async () => {
      const r = await settled();
      await w.costLedger.compensateAttempt(r.attemptKey, 'invoice-corr-1', -2_500n);
      const raw = (adj: string | null) => ds.query(
        `INSERT INTO ai_budget_ledger ("userId", tier, capability, "idempotencyKey", "entryType", units, "compensatedMicroUsd", "adjustmentKey")
         SELECT "userId", tier, capability, "idempotencyKey", 'compensation', 0, -1, $2 FROM ai_budget_ledger WHERE "idempotencyKey" = $1 AND "entryType" = 'reservation'`,
        [r.attemptKey, adj]);
      await expect(raw('invoice-corr-1')).rejects.toThrow(/UQ_ai_budget_ledger_adjustment/);
      await expect(raw(null)).rejects.toThrow(/CK_ai_budget_ledger_cost_compensation_key/);
      // NEM-019's legacy compensate (units only, no micro-USD, no key) still works unchanged.
      await budgetPolicy(ds, 'noetia_plus', CAP, { allowanceUnits: 1_000_000_000, maxUnresolvedUnits: 1_000_000_000, reserveUnitsPerTurn: 10 });
      const u = await newUser(ds);
      await w.ledger.reserve({ userId: u, tier: 'noetia_plus', capability: CAP, sessionId: null, idempotencyKey: 'legacy-comp-1' });
      await expect(w.ledger.compensate('legacy-comp-1', 3)).resolves.toBeUndefined();
      await expect(w.ledger.compensate('legacy-comp-1', 3)).resolves.toBeUndefined(); // NEM-019 semantics unchanged
      expect(await comps('legacy-comp-1')).toBe(2);
    });
  });

  describe('F-9: global policy activation is serialized with admission (same B-6 lock)', () => {
    const policy = (allowance: bigint) =>
      w.costConfig.addGlobalPolicy({ periodDays: 30, allowanceMicroUsd: allowance, maxUnresolvedMicroUsd: 1_000_000_000_000n, isTestFixture: true });

    it('an admission in flight (lock held, old policy read) makes a concurrent activation WAIT; the change commits after it', async () => {
      await setGlobalPolicy(w, 1_000_000n);
      const p1 = (await w.costConfig.activeGlobalPolicy())!.id;
      const pause = pauseAt(w, /WITH open_attempts/); // inside admission, after the lock and the policy re-read
      const order: string[] = [];
      const admission = w.costLedger.reserveAttempt(attempt(await newUser(ds), 800_000)).then((r) => { order.push('admission'); return r; });
      await pause.reached;
      const p2 = await policy(100_000n);
      const activation = w.costConfig.activateGlobalPolicy(p2).then(() => { order.push('activation'); });
      // Observe first, release always, assert after: a failure can never leave the paused transaction open.
      const blocked = await waitForAdvisoryLockWaiter(ds, 3_000);
      const orderWhilePaused = [...order];
      pause.release();
      expect(blocked).toBe(true); // the activation is blocked on the global admission lock
      expect(orderWhilePaused).toEqual([]);
      const r = await admission;
      await activation;
      expect(order).toEqual(['admission', 'activation']);
      // The admission committed while P1 was still the active policy: the invariant held at that moment.
      expect(r).toMatchObject({ globalPolicyId: p1, allowanceMicroUsd: 1_000_000n, committedBeforeMicroUsd: 0n, reservedMicroUsd: 800_000n });
      // After the reduction, capacity is negative and admissions stop (fail closed), as for an overrun.
      expect((await state())).toMatchObject({ allowance: 100_000n, committed: 800_000n, capacity: -700_000n });
      expect(await denialCause(w.costLedger.reserveAttempt(attempt(await newUser(ds), 1)))).toBe('global_allowance');
    });

    it('an activation in flight makes a concurrent admission WAIT; the admission then re-reads and uses the NEW policy', async () => {
      await setGlobalPolicy(w, 1_000_000n);
      const p2 = await policy(100_000n);
      const pause = pauseAt(w, /UPDATE ai_global_budget_policies SET active = true/); // inside activation, lock held
      const order: string[] = [];
      const activation = w.costConfig.activateGlobalPolicy(p2).then(() => { order.push('activation'); });
      await pause.reached;
      const admission = denialCause(w.costLedger.reserveAttempt(attempt(await newUser(ds), 800_000))).then((c) => { order.push('admission'); return c; });
      const blocked = await waitForAdvisoryLockWaiter(ds, 3_000);
      const orderWhilePaused = [...order];
      pause.release();
      expect(blocked).toBe(true); // the admission is blocked on the global admission lock
      expect(orderWhilePaused).toEqual([]);
      await activation;
      expect(await admission).toBe('global_allowance'); // 800,000 > 100,000 under the newly active policy
      expect(order).toEqual(['activation', 'admission']);
      expect(await reservations()).toBe(0);
    });

    it('F-9b: a replacement pricing schema activated between pre-check and lock cannot let an admission pin the broken schema', async () => {
      // Open the breaker on golden v1 with an injected overrun.
      const u = await newUser(ds);
      const r = await w.costLedger.reserveAttempt(attempt(u, 10_000));
      await w.costLedger.settleAttempt(usage(r.attemptKey, { inputUncached: 10_000, output: 5_000 }));
      expect(await ds.query(`SELECT state FROM ai_overrun_breakers WHERE "pricingSchemaId" = $1`, [cfg.pricingA])).toEqual([{ state: 'open' }]);
      const v2 = await w.costConfig.addPricingSchema(goldenPricing(2));
      // The admission has already looked up v1 (still active) and is about to take the global lock.
      const pause = pauseAt(w, /pg_advisory_xact_lock/);
      const admission = denialCause(w.costLedger.reserveAttempt(attempt(u, 1_000)));
      await pause.reached;
      expect(await w.costConfig.activatePricingSchema(v2, 'PA-review-fixture-009')).toEqual({ closedBreakers: 1 });
      pause.release();
      expect(await admission).toBe('pricing_schema_missing'); // v1 is no longer current: fail closed, never pinned to v1
      expect(await rowCount(ds, `SELECT count(*) AS n FROM ai_budget_ledger WHERE "entryType" = 'reservation' AND "pricingSchemaId" = $1`, [cfg.pricingA])).toBe(1);
      expect((await w.costLedger.reserveAttempt(attempt(u, 1_000))).pricingSchemaId).toBe(v2); // a retry prices with v2
    });

    it('parallel admissions interleaved with repeated activations: no deadlock, and every admission fits the policy it committed under', async () => {
      await setGlobalPolicy(w, 1_000_000n);
      const allowances = [300_000n, 900_000n, 200_000n, 700_000n, 1_000_000n];
      const ids = [];
      for (const a of allowances) ids.push(await policy(a));
      const users = await Promise.all(Array.from({ length: 24 }, () => newUser(ds)));
      const results = await Promise.all([
        ...users.map((u, i) => w.costLedger.reserveAttempt(attempt(u, 20_000 + (i % 5) * 10_000)).then((ok) => ({ ok }), (e) => ({ e }))),
        ...ids.map((id) => w.costConfig.activateGlobalPolicy(id).then(() => ({ activated: id }))),
      ]);
      const admitted = results.flatMap((r: any) => (r.ok ? [r.ok] : []));
      expect(results.filter((r: any) => r.e && r.e.cause !== 'global_allowance')).toEqual([]);
      expect(admitted.length).toBeGreaterThan(0);
      for (const a of admitted) expect(a.committedBeforeMicroUsd + a.reservedMicroUsd <= a.allowanceMicroUsd).toBe(true);
      expect((await w.costConfig.activeGlobalPolicy())).not.toBeNull();
    });
  });

  it('R-1: legacy settle, release, and reconcile never resolve an attempt, even when evidence the legacy path would act on exists', async () => {
    await budgetPolicy(ds, 'noetia_plus', CAP, { allowanceUnits: 1_000_000_000, maxUnresolvedUnits: 1_000_000_000, reserveUnitsPerTurn: 10 });
    const u = await newUser(ds);
    // Legacy control: a NEM-019 reservation with legacy evidence; legacy reconciliation must still settle it.
    await w.ledger.reserve({ userId: u, tier: 'noetia_plus', capability: CAP, sessionId: null, idempotencyKey: 'legacy-r1' });
    await ds.query(`INSERT INTO ai_usage_events ("userId", capability, "idempotencyKey", provider, "modelKey", outcome, "unitsReported")
                    VALUES ($1, $2, 'legacy-r1', 'simulated', 'sim', 'success', 3)`, [u, CAP]);
    // A1: settlement outage after evidence was written → ai_usage_events has unitsReported (legacy would SETTLE it).
    const a1 = await w.costLedger.reserveAttempt(attempt(u, 40_000));
    failNextQuery(w, /'settlement', \$2, \$3/);
    await expect(w.costLedger.settleAttempt(usage(a1.attemptKey, { inputUncached: 30_000 }))).rejects.toThrow('simulated ledger outage');
    // A2: never-sent release interrupted after the no-provider evidence → legacy would RELEASE it.
    const a2 = await w.costLedger.reserveAttempt(attempt(u, 5_000));
    failNextQuery(w, /'release', 0, 0/);
    await expect(w.costLedger.releaseAttempt(a2.attemptKey)).rejects.toThrow('simulated ledger outage');
    // A3: a held attempt, targeted directly by the legacy API.
    const a3 = await w.costLedger.reserveAttempt(attempt(u, 7_000));
    expect(await w.ledger.settle(a3.attemptKey, 5, null)).toBe('already_resolved');
    expect(await w.ledger.release(a3.attemptKey)).toBe('already_resolved');
    expect(await w.ledger.settle(a1.attemptKey, 5, null)).toBe('already_resolved');

    const legacy = await w.ledger.reconcile();
    expect(legacy).toEqual({ settled: 1, released: 0, flaggedExpired: 0, held: 0 }); // only the legacy reservation
    const resolutions = (k: string) => rowCount(ds, `SELECT count(*) AS n FROM ai_budget_ledger WHERE "idempotencyKey" = $1 AND "entryType" IN ('settlement', 'release')`, [k]);
    for (const k of [a1.attemptKey, a2.attemptKey, a3.attemptKey]) expect(await resolutions(k)).toBe(0);
    expect(await ds.query(`SELECT units::int AS units, "costMicroUsd" FROM ai_budget_ledger WHERE "idempotencyKey" = 'legacy-r1' AND "entryType" = 'settlement'`))
      .toEqual([{ units: 3, costMicroUsd: null }]);
    expect((await state()).held).toBe(52_000n); // all three attempts still held at their reservations

    // Only the cost ledger resolves them, from the same evidence, in micro-USD with the pinned schema.
    expect(await w.costLedger.reconcileAttempts()).toEqual({ settled: 1, released: 1, flaggedExpired: 0, held: 1 });
    expect(await state()).toMatchObject({ held: 7_000n, settled: 30_000n });
  });
});
