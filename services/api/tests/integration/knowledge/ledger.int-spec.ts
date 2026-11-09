import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { BudgetLedgerService } from '../../../src/knowledge/metering/budget-ledger.service';
import { RedisAdmissionCache } from '../../../src/knowledge/metering/admission-cache';
import { turnIdempotencyKey } from '../../../src/knowledge/sessions/turn.service';
import { budgetPolicy, denial, eligibleBook, enableFlag, openDataSource, readyUser, redisCache, wire } from './support/it-env';

const CAP = 'research_session';

async function ledgerRows(ds: DataSource, key: string) {
  return ds.query(`SELECT "entryType", units::int AS units, "costMicroUsd"::text AS cost FROM ai_budget_ledger WHERE "idempotencyKey" = $1 ORDER BY id`, [key]);
}
async function unresolvedFor(ds: DataSource, userId: string) {
  const [r] = await ds.query(
    `SELECT count(*)::int AS n, COALESCE(SUM(units), 0)::int AS units FROM ai_budget_ledger r
      WHERE r."userId" = $1 AND r."entryType" = 'reservation' AND NOT EXISTS (
        SELECT 1 FROM ai_budget_ledger s WHERE s."idempotencyKey" = r."idempotencyKey" AND s."entryType" IN ('settlement','release'))`,
    [userId],
  );
  return r;
}

/** Make the next statement matching `re` fail, as if the ledger were unavailable. */
function failNextQuery(w: ReturnType<typeof wire>, re: RegExp) {
  const original = w.db.query.bind(w.db);
  const spy = jest.spyOn(w.db, 'query').mockImplementation(async (sql: string, params?: unknown[]) => {
    if (re.test(sql)) {
      spy.mockRestore();
      throw new Error('simulated ledger outage');
    }
    return original(sql, params);
  });
  return spy;
}

describe('NEM-019 budget ledger integrity on real PostgreSQL (AC-15, 15a, 15c, 15d)', () => {
  let ds: DataSource;
  let w: ReturnType<typeof wire>;
  const reserveReq = (userId: string, key = `k-${randomUUID()}`, capability = CAP, tier: 'noetia_plus' | 'noetia_x' = 'noetia_plus') =>
    ({ userId, tier, capability, sessionId: null, idempotencyKey: key });

  beforeAll(async () => {
    ds = await openDataSource();
    w = wire(ds);
    await enableFlag(ds);
  });
  afterAll(async () => ds?.destroy());
  afterEach(() => jest.restoreAllMocks());

  it('AC-15: concurrent reservations never exceed the budget', async () => {
    await budgetPolicy(ds, 'noetia_plus', CAP, { allowanceUnits: 50, reserveUnitsPerTurn: 10 });
    const u = await readyUser(ds, w);
    const results = await Promise.all(Array.from({ length: 20 }, () => denial(w.ledger.reserve(reserveReq(u)))));
    expect(results.filter((r) => r === 'allowed')).toHaveLength(5);
    expect(results.filter((r) => r !== 'allowed').every((r) => r === 'budget_exhausted')).toBe(true);
    expect((await unresolvedFor(ds, u)).units).toBe(50);
  });

  it('double submit: the same idempotency key in parallel yields exactly one reservation', async () => {
    await budgetPolicy(ds, 'noetia_plus', CAP);
    const u = await readyUser(ds, w);
    const key = `dup-${randomUUID()}`;
    const results = await Promise.all(Array.from({ length: 6 }, () => denial(w.ledger.reserve(reserveReq(u, key)))));
    expect(results.filter((r) => r === 'allowed')).toHaveLength(1);
    expect(results.filter((r) => r === 'duplicate_turn')).toHaveLength(5);
    expect(await ledgerRows(ds, key)).toEqual([{ entryType: 'reservation', units: 10, cost: null }]);
  });

  it('AC-15a: budgets resolve by tier AND capability; one capability cannot draw on another', async () => {
    await budgetPolicy(ds, 'noetia_plus', CAP, { allowanceUnits: 10, reserveUnitsPerTurn: 10 });
    await budgetPolicy(ds, 'noetia_plus', 'highlight_intelligence', { allowanceUnits: 30, reserveUnitsPerTurn: 10 });
    const u = await readyUser(ds, w);
    expect(await denial(w.ledger.reserve(reserveReq(u)))).toBe('allowed');
    expect(await denial(w.ledger.reserve(reserveReq(u)))).toBe('budget_exhausted');
    for (let i = 0; i < 3; i++) expect(await denial(w.ledger.reserve(reserveReq(u, undefined, 'highlight_intelligence')))).toBe('allowed');
    expect(await denial(w.ledger.reserve(reserveReq(u, undefined, 'highlight_intelligence')))).toBe('budget_exhausted');
    // A capability with no fixture policy has no budget at all.
    expect(await denial(w.ledger.reserve(reserveReq(u, undefined, 'unbudgeted_capability')))).toBe('budget_unavailable');
  });

  describe('settlement recovery (AC-15d)', () => {
    let u: string;
    beforeEach(async () => {
      await budgetPolicy(ds, 'noetia_plus', CAP, { allowanceUnits: 1000 });
      u = await readyUser(ds, w);
      await ds.query(`INSERT INTO ai_rate_cards (provider, "modelKey", version, "microUsdPerUnit", "isTestFixture") VALUES ('simulated', 'simulated-v1', 1, 7, true) ON CONFLICT DO NOTHING`);
    });

    it('settle, replay, retry, and reconcile twice → exactly one settlement with integer micro-USD', async () => {
      const key = `settle-${randomUUID()}`;
      await w.ledger.reserve(reserveReq(u, key));
      await w.ledger.recordUsage({ userId: u, sessionId: null, capability: CAP, idempotencyKey: key, provider: 'simulated', modelKey: 'simulated-v1', outcome: 'success', unitsReported: 6 });
      const card = await w.rateCards.active('simulated', 'simulated-v1');
      expect(await w.ledger.settle(key, 6, card)).toBe('settled');
      const again = await Promise.all([w.ledger.settle(key, 6, card), w.ledger.settle(key, 6, card), w.ledger.release(key)]);
      expect(again).toEqual(['already_resolved', 'already_resolved', 'already_resolved']);
      await w.ledger.reconcile();
      await w.ledger.reconcile();
      expect(await ledgerRows(ds, key)).toEqual([
        { entryType: 'reservation', units: 10, cost: null },
        { entryType: 'settlement', units: 6, cost: '42' },
      ]);
    });

    it('ledger outage at settlement → held; reconciliation later settles it exactly once', async () => {
      const key = `outage-${randomUUID()}`;
      await w.ledger.reserve(reserveReq(u, key));
      await w.ledger.recordUsage({ userId: u, sessionId: null, capability: CAP, idempotencyKey: key, provider: 'simulated', modelKey: 'simulated-v1', outcome: 'success', unitsReported: 4 });
      failNextQuery(w, /"costMicroUsd", "rateCardId"\)\s+SELECT/);
      await expect(w.ledger.settle(key, 4, null)).rejects.toThrow('simulated ledger outage');
      expect(await ledgerRows(ds, key)).toEqual([{ entryType: 'reservation', units: 10, cost: null }]); // held at reserved amount
      const [first, second] = [await w.ledger.reconcile(), await w.ledger.reconcile()];
      expect(first.settled).toBeGreaterThanOrEqual(1);
      expect(second.settled).toBe(0);
      expect(await ledgerRows(ds, key)).toEqual([
        { entryType: 'reservation', units: 10, cost: null },
        { entryType: 'settlement', units: 4, cost: '28' },
      ]);
    });

    it('concurrent reconcilers never double-settle', async () => {
      const key = `concurrent-${randomUUID()}`;
      await w.ledger.reserve(reserveReq(u, key));
      await w.ledger.recordUsage({ userId: u, sessionId: null, capability: CAP, idempotencyKey: key, provider: 'simulated', modelKey: 'simulated-v1', outcome: 'failure', unitsReported: 3 });
      await Promise.all([w.ledger.reconcile(), w.ledger.reconcile(), w.ledger.reconcile()]);
      expect((await ledgerRows(ds, key)).filter((r: any) => r.entryType === 'settlement')).toHaveLength(1);
    });

    it('unknown usage → held at the reserved amount; on expiry it is flagged once, never released to zero', async () => {
      await budgetPolicy(ds, 'noetia_plus', CAP, { allowanceUnits: 1000, reservationTtlSeconds: 1 });
      const key = `unknown-${randomUUID()}`;
      await w.ledger.reserve(reserveReq(u, key));
      await w.ledger.recordUsage({ userId: u, sessionId: null, capability: CAP, idempotencyKey: key, provider: 'simulated', modelKey: 'simulated-v1', outcome: 'timeout', unitsReported: null });
      await ds.query(`UPDATE ai_budget_ledger SET "expiresAt" = now() - interval '1 minute' WHERE "idempotencyKey" = $1`, [key]); // test-only clock skip
      await w.ledger.reconcile();
      await w.ledger.reconcile();
      expect(await ledgerRows(ds, key)).toEqual([
        { entryType: 'reservation', units: 10, cost: null },
        { entryType: 'expired_flag', units: 0, cost: null },
      ]);
      expect((await unresolvedFor(ds, u)).units).toBe(10); // still counts against the budget
    });

    it('a no-provider key (step-4 failure evidence) is released by reconciliation, once', async () => {
      const key = `noprov-${randomUUID()}`;
      await w.ledger.reserve(reserveReq(u, key));
      await w.ledger.recordUsage({ userId: u, sessionId: null, capability: CAP, idempotencyKey: key, provider: 'none', modelKey: null, outcome: 'aborted', unitsReported: 0 });
      await w.ledger.reconcile();
      await w.ledger.reconcile();
      expect((await ledgerRows(ds, key)).map((r: any) => r.entryType)).toEqual(['reservation', 'release']);
    });

    it('compensation is a separate entry; the original settlement is never edited', async () => {
      const key = `comp-${randomUUID()}`;
      await w.ledger.reserve(reserveReq(u, key));
      await w.ledger.settle(key, 5, null);
      await w.ledger.compensate(key, -2);
      expect((await ledgerRows(ds, key)).map((r: any) => [r.entryType, r.units])).toEqual([['reservation', 10], ['settlement', 5], ['compensation', -2]]);
    });

    it('the database itself refuses a second settlement or release for a key', async () => {
      const key = `db-guard-${randomUUID()}`;
      await w.ledger.reserve(reserveReq(u, key));
      await w.ledger.settle(key, 1, null);
      await expect(ds.query(
        `INSERT INTO ai_budget_ledger ("userId", tier, capability, "idempotencyKey", "entryType", units) VALUES ($1, 'noetia_plus', $2, $3, 'release', 0)`,
        [u, CAP, key],
      )).rejects.toThrow(/UQ_ai_budget_ledger_resolution/);
    });
  });

  describe('admission fails closed (AC-15c)', () => {
    it('unresolved reservations above the scope bound deny new admissions in that scope only', async () => {
      await budgetPolicy(ds, 'noetia_plus', CAP, { allowanceUnits: 1000, maxUnresolvedUnits: 15 });
      const u = await readyUser(ds, w);
      const other = await readyUser(ds, w);
      await w.ledger.reserve(reserveReq(u));
      await w.ledger.reserve(reserveReq(u));
      expect(await denial(w.ledger.reserve(reserveReq(u)))).toBe('unresolved_reservations');
      expect(await denial(w.ledger.reserve(reserveReq(other)))).toBe('allowed'); // other scope unaffected
    });

    it('overall unresolved bound exceeded → everyone is denied', async () => {
      await budgetPolicy(ds, 'noetia_plus', CAP);
      const u = await readyUser(ds, w);
      const tight = wire(ds, { config: { overallUnresolvedUnitsBound: 0 } });
      await w.ledger.reserve(reserveReq(u)); // at least one unresolved reservation exists overall
      expect(await denial(tight.ledger.reserve(reserveReq(u)))).toBe('unresolved_reservations');
    });

    it('ledger unavailable at admission → denied; no reservation written', async () => {
      await budgetPolicy(ds, 'noetia_plus', CAP);
      const u = await readyUser(ds, w);
      failNextQuery(w, /^SELECT \* FROM ai_budget_policies/);
      const key = `adm-down-${randomUUID()}`;
      expect(await denial(w.ledger.reserve(reserveReq(u, key)))).toBe('budget_unavailable');
      expect(await ledgerRows(ds, key)).toEqual([]);
    });

    it('Redis unavailable → denied before any provider call (real client, closed port)', async () => {
      await budgetPolicy(ds, 'noetia_plus', CAP);
      const down = redisCache('redis://127.0.0.1:1');
      const wd = wire(ds, { cache: down.cache });
      const u = await readyUser(ds, wd);
      const [b] = [await eligibleBook(ds, wd)];
      const s = await wd.sessions.create(u, [b]);
      const providerSpy = jest.spyOn(wd.sim, 'invoke');
      expect(await denial(wd.turns.run(u, s.id, 'redis-down-01'))).toBe('budget_unavailable');
      expect(providerSpy).not.toHaveBeenCalled();
      expect((await wd.sessions.get(u, s.id)).locked).toBe(false);
      expect(await ledgerRows(ds, turnIdempotencyKey(u, s.id, 'redis-down-01'))).toEqual([]);
      down.client.disconnect();
    });

    it('with Redis available, an exhausted scope is cached (namespaced, expiring) and cleared on settlement', async () => {
      await budgetPolicy(ds, 'noetia_plus', CAP, { allowanceUnits: 10, reserveUnitsPerTurn: 10 });
      const up = redisCache();
      await up.client.connect();
      const wr = wire(ds, { cache: up.cache });
      const u = await readyUser(ds, wr);
      const key = `redis-${randomUUID()}`;
      await wr.ledger.reserve(reserveReq(u, key));
      expect(await denial(wr.ledger.reserve(reserveReq(u)))).toBe('budget_exhausted');
      const redisKey = `intelligence:admission:v1:${u}:${CAP}`;
      expect(await up.client.get(redisKey)).toBe('1');
      expect(await up.client.ttl(redisKey)).toBeGreaterThan(0);
      await wr.ledger.settle(key, 2, null);
      expect(await up.client.get(redisKey)).toBeNull();
      up.client.disconnect();
    });
  });

  describe('full turns through the turn order (AC-15c, 15d)', () => {
    it('provider failure / abort / timeout with unknown usage leave the reservation held; the lock stands', async () => {
      await budgetPolicy(ds, 'noetia_plus', CAP);
      const u = await readyUser(ds, w);
      const b = await eligibleBook(ds, w);
      const s = await w.sessions.create(u, [b]);
      w.sim.enqueue({ kind: 'failure', units: null }, { kind: 'abort' }, { kind: 'hang' });
      for (const k of ['fail-unknown-1', 'abort-unknown-1', 'timeout-unknown-1']) {
        expect(await denial(w.turns.run(u, s.id, k))).toBe('turn_failed');
        expect((await ledgerRows(ds, turnIdempotencyKey(u, s.id, k))).map((r: any) => r.entryType)).toEqual(['reservation']);
      }
      expect((await w.sessions.get(u, s.id)).locked).toBe(true);
      expect((await unresolvedFor(ds, u)).n).toBe(3);
    });

    it('ledger unavailable at settlement during a real turn → held, then reconciled exactly once', async () => {
      await budgetPolicy(ds, 'noetia_plus', CAP);
      const u = await readyUser(ds, w);
      const b = await eligibleBook(ds, w);
      const s = await w.sessions.create(u, [b]);
      failNextQuery(w, /"costMicroUsd", "rateCardId"\)\s+SELECT/);
      const r = await w.turns.run(u, s.id, 'settle-outage-1');
      expect(r.settlement).toBe('held');
      const key = turnIdempotencyKey(u, s.id, 'settle-outage-1');
      expect((await ledgerRows(ds, key)).map((x: any) => x.entryType)).toEqual(['reservation']);
      await w.ledger.reconcile();
      await w.ledger.reconcile();
      expect((await ledgerRows(ds, key)).map((x: any) => x.entryType)).toEqual(['reservation', 'settlement']);
    });

    it('double submit of the same turn: one reservation, one provider call', async () => {
      await budgetPolicy(ds, 'noetia_plus', CAP);
      const u = await readyUser(ds, w);
      const b = await eligibleBook(ds, w);
      const s = await w.sessions.create(u, [b]);
      const spy = jest.spyOn(w.sim, 'invoke');
      const results = await Promise.all([denial(w.turns.run(u, s.id, 'same-key-01')), denial(w.turns.run(u, s.id, 'same-key-01'))]);
      expect(results.sort()).toEqual(['allowed', 'duplicate_turn']);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('budget rejection never locks the set', async () => {
      await budgetPolicy(ds, 'noetia_plus', CAP, { allowanceUnits: 5, reserveUnitsPerTurn: 10 });
      const u = await readyUser(ds, w);
      const b = await eligibleBook(ds, w);
      const s = await w.sessions.create(u, [b]);
      expect(await denial(w.turns.run(u, s.id, 'over-budget-1'))).toBe('budget_exhausted');
      expect((await w.sessions.get(u, s.id)).locked).toBe(false);
    });

    it('lock-transaction failure releases the reservation; no provider call', async () => {
      await budgetPolicy(ds, 'noetia_plus', CAP);
      const u = await readyUser(ds, w);
      const b = await eligibleBook(ds, w);
      const s = await w.sessions.create(u, [b]);
      const spy = jest.spyOn(w.sim, 'invoke');
      // Transaction #1 is the step-3 reservation (must succeed); #2 is the step-4 lock transaction.
      const realTx = w.db.transaction.bind(w.db);
      let n = 0;
      const tx = jest.spyOn(w.db, 'transaction').mockImplementation(async (fn: any) => {
        n += 1;
        if (n === 2) throw new Error('lock tx failed');
        return realTx(fn);
      });
      expect(await denial(w.turns.run(u, s.id, 'lock-fail-01'))).toBe('turn_failed');
      tx.mockRestore();
      expect(spy).not.toHaveBeenCalled();
      expect((await ledgerRows(ds, turnIdempotencyKey(u, s.id, 'lock-fail-01'))).map((x: any) => x.entryType)).toEqual(['reservation', 'release']);
      expect((await w.sessions.get(u, s.id)).locked).toBe(false);
    });
  });

  it('AC-17: token scenarios change no budget (no shared table or code path)', async () => {
    await budgetPolicy(ds, 'noetia_plus', CAP);
    const u = await readyUser(ds, w);
    const before = await unresolvedFor(ds, u);
    const ledgerCountBefore = (await ds.query(`SELECT count(*)::int AS n FROM ai_budget_ledger WHERE "userId" = $1`, [u]))[0].n;
    // Issue and redeem a book token (test DB only): neither touches the AI budget.
    const b = await eligibleBook(ds, w);
    const [t] = await ds.query(`INSERT INTO token_ledger ("userId", "expiresAt") VALUES ($1, now() + interval '90 days') RETURNING id`, [u]);
    await ds.query(`UPDATE token_ledger SET status = 'redeemed', "redeemedAt" = now(), "bookId" = $2 WHERE id = $1`, [t.id, b]);
    expect(await unresolvedFor(ds, u)).toEqual(before);
    expect((await ds.query(`SELECT count(*)::int AS n FROM ai_budget_ledger WHERE "userId" = $1`, [u]))[0].n).toBe(ledgerCountBefore);
    expect(BudgetLedgerService.toString()).not.toMatch(/token_ledger/);
    expect(RedisAdmissionCache.toString()).not.toMatch(/token/);
  });
});
