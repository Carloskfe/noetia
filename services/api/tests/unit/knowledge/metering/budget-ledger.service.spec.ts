import { IntelligenceDenied } from '../../../../src/knowledge/common/intelligence-denied.error';
import { BudgetLedgerService, GLOBAL_ADMISSION_LOCK, NO_PROVIDER } from '../../../../src/knowledge/metering/budget-ledger.service';
import { RateCardService } from '../../../../src/knowledge/metering/rate-card.service';
import { FakeDb, mockMetrics, TEST_CONFIG, USER_A } from '../support/fixtures';

const POLICY_ROW = {
  id: 'pol-1', tier: 'noetia_plus', capability: 'research_session', version: 1,
  allowanceUnits: '100', periodDays: 30, reserveUnitsPerTurn: 10, reservationTtlSeconds: 300,
  maxUnresolvedUnits: '50', maxUnresolvedAgeSeconds: 3600,
};
const REQ = { userId: USER_A, tier: 'noetia_plus' as const, capability: 'research_session', sessionId: 's-1', idempotencyKey: 'turn:k1' };

function setup(opts: {
  policy?: object | null;
  scope?: { units: number; oldestAge: number };
  overall?: number;
  consumed?: number;
  inserted?: boolean;
  existing?: boolean;
  cache?: { isExhausted: jest.Mock; markExhausted: jest.Mock; clear: jest.Mock } | null;
  config?: Partial<typeof TEST_CONFIG>;
} = {}) {
  const db = new FakeDb();
  db.on(/FROM ai_budget_policies/, () => (opts.policy === null ? [] : [opts.policy ?? POLICY_ROW]));
  db.on(/pg_advisory_xact_lock/, () => [{}]);
  db.on(/^SELECT 1 FROM ai_budget_ledger WHERE "idempotencyKey" = \$1 AND "entryType" = 'reservation'$/, () => (opts.existing ? [{}] : []));
  db.on(/MIN\(r\."createdAt"\)/, () => [opts.scope ?? { units: '0', oldestAge: 0 }]);
  db.on(/^SELECT COALESCE\(SUM\(r\.units\), 0\)::bigint AS units FROM ai_budget_ledger r WHERE/, () => [{ units: String(opts.overall ?? 0) }]);
  db.on(/AS consumed/, () => [{ consumed: String(opts.consumed ?? 0) }]);
  db.on(/'reservation', \$7/, () => (opts.inserted === false ? [] : [{ expiresAt: '2026-11-09T10:05:00Z' }]));
  const cache = opts.cache === null ? undefined : opts.cache ?? { isExhausted: jest.fn().mockResolvedValue(false), markExhausted: jest.fn(), clear: jest.fn() };
  const metrics = mockMetrics();
  const rateCards = new RateCardService(db as any);
  const svc = new BudgetLedgerService(db as any, rateCards, metrics, { ...TEST_CONFIG, ...opts.config }, cache as any);
  return { svc, db, cache, metrics };
}

const reason = async (p: Promise<unknown>) => {
  try {
    await p;
    return 'allowed';
  } catch (e) {
    return (e as IntelligenceDenied).reason;
  }
};

describe('BudgetLedgerService — admission (ADR-005 B-1)', () => {
  it('writes a reservation with the turn idempotency key', async () => {
    const { svc, db, metrics } = setup();
    const r = await svc.reserve(REQ);
    expect(r).toMatchObject({ idempotencyKey: 'turn:k1', units: 10, policyId: 'pol-1' });
    expect(db.ran(/'reservation', \$7/)[0].params).toEqual([USER_A, 's-1', 'pol-1', 'noetia_plus', 'research_session', 'turn:k1', 10, 300]);
    expect(metrics.budgetReservedInc).toHaveBeenCalled();
  });

  it('B-6: takes the GLOBAL admission lock first, then the user+capability lock (fixed order)', async () => {
    const { svc, db } = setup();
    await svc.reserve(REQ);
    expect(db.ran(/pg_advisory_xact_lock/).map((c) => c.params)).toEqual([[GLOBAL_ADMISSION_LOCK], [`${USER_A}:research_session`]]);
    const order = db.calls.map((c) => c.sql);
    const firstLock = order.findIndex((q) => /pg_advisory_xact_lock/.test(q));
    const overall = order.findIndex((q) => /^SELECT COALESCE\(SUM\(r\.units\), 0\)::bigint AS units FROM ai_budget_ledger r WHERE/.test(q));
    const insert = order.findIndex((q) => /'reservation', \$7/.test(q));
    expect(firstLock).toBeLessThan(overall);
    expect(overall).toBeLessThan(insert);
  });

  it('B-6: exact global capacity is admitted; one more unit than capacity is rejected', async () => {
    // overall unresolved 999,990 + 10 reserved == bound 1,000,000 → admitted
    expect(await reason(setup({ overall: 999_990 }).svc.reserve(REQ))).toBe('allowed');
    // 999,991 + 10 > 1,000,000 → rejected before any insert
    const over = setup({ overall: 999_991 });
    expect(await reason(over.svc.reserve(REQ))).toBe('unresolved_reservations');
    expect(over.db.ran(/'reservation', \$7/)).toHaveLength(0);
  });

  it('a replayed key is a duplicate before any budget check (deterministic reason)', async () => {
    const { svc, db } = setup({ existing: true, consumed: 1_000_000 });
    expect(await reason(svc.reserve(REQ))).toBe('duplicate_turn');
    expect(db.ran(/AS consumed/)).toHaveLength(0);
  });

  it('works without an admission cache bound', async () => {
    expect(await reason(setup({ cache: null }).svc.reserve(REQ))).toBe('allowed');
  });

  it('Redis unavailable → denied before any ledger write', async () => {
    const cache = { isExhausted: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')), markExhausted: jest.fn(), clear: jest.fn() };
    const { svc, db, metrics } = setup({ cache });
    expect(await reason(svc.reserve(REQ))).toBe('budget_unavailable');
    expect(db.ran(/INSERT/)).toHaveLength(0);
    expect(metrics.budgetRejectedInc).toHaveBeenCalledWith('noetia_plus');
  });

  it('a cached exhausted scope is denied', async () => {
    const cache = { isExhausted: jest.fn().mockResolvedValue(true), markExhausted: jest.fn(), clear: jest.fn() };
    expect(await reason(setup({ cache }).svc.reserve(REQ))).toBe('budget_exhausted');
  });

  it('no approved overall bound → fails closed', async () => {
    expect(await reason(setup({ config: { overallUnresolvedUnitsBound: undefined } }).svc.reserve(REQ))).toBe('budget_unavailable');
  });

  it('no budget policy for tier+capability → denied', async () => {
    expect(await reason(setup({ policy: null }).svc.reserve(REQ))).toBe('budget_unavailable');
  });

  it('ledger unavailable at admission → denied, no reservation', async () => {
    const { svc, db } = setup();
    db.failNext = /pg_advisory_xact_lock/;
    expect(await reason(svc.reserve(REQ))).toBe('budget_unavailable');
    expect(db.ran(/INSERT/)).toHaveLength(0);
  });

  it('ledger rejects the write → denied', async () => {
    const { svc, db } = setup();
    db.failNext = /'reservation', \$7/;
    expect(await reason(svc.reserve(REQ))).toBe('budget_unavailable');
  });

  it('unresolved units above the scope bound → admission denied', async () => {
    expect(await reason(setup({ scope: { units: 51, oldestAge: 1 } }).svc.reserve(REQ))).toBe('unresolved_reservations');
  });

  it('unresolved reservation older than the scope bound → admission denied', async () => {
    expect(await reason(setup({ scope: { units: 10, oldestAge: 3601 } }).svc.reserve(REQ))).toBe('unresolved_reservations');
  });

  it('overall unresolved units above the bound → admission denied', async () => {
    expect(await reason(setup({ overall: 1_000_001 }).svc.reserve(REQ))).toBe('unresolved_reservations');
  });

  it('allowance exceeded → budget_exhausted and the cache is marked', async () => {
    const { svc, cache, metrics } = setup({ consumed: 95 });
    expect(await reason(svc.reserve(REQ))).toBe('budget_exhausted');
    expect(cache!.markExhausted).toHaveBeenCalledWith(USER_A, 'research_session', 60);
    expect(metrics.budgetRejectedInc).toHaveBeenCalledWith('noetia_plus');
  });

  it('a duplicate idempotency key is rejected (double submit)', async () => {
    expect(await reason(setup({ inserted: false }).svc.reserve(REQ))).toBe('duplicate_turn');
  });

  it('activePolicy maps numeric columns', async () => {
    expect(await setup().svc.activePolicy('noetia_plus', 'research_session')).toMatchObject({ allowanceUnits: 100, maxUnresolvedUnits: 50 });
  });
});

describe('BudgetLedgerService — settlement and recovery (B-5)', () => {
  function settleDb(opts: { inserted: boolean; reservationExists: boolean }) {
    const ctx = setup();
    ctx.db.on(/^INSERT INTO ai_budget_ledger\s+\("userId", "sessionId", "policyId", tier, capability, "idempotencyKey", "entryType", units, "costMicroUsd"/, () => (opts.inserted ? [{ id: '9' }] : []));
    ctx.db.on(/^SELECT 1 FROM ai_budget_ledger/, () => (opts.reservationExists ? [{}] : []));
    ctx.db.on(/^SELECT "userId", capability FROM ai_budget_ledger/, () => [{ userId: USER_A, capability: 'research_session' }]);
    return ctx;
  }

  it('settles once and records integer micro-USD from the rate card', async () => {
    const { svc, db, cache } = settleDb({ inserted: true, reservationExists: true });
    const card = { id: 'rc', provider: 'simulated', modelKey: 'simulated-v1', version: 1, microUsdPerUnit: '7' };
    expect(await svc.settle('turn:k1', 6, card)).toBe('settled');
    expect(db.ran(/"costMicroUsd"/)[0].params).toEqual(['turn:k1', 'settlement', 6, '42', 'rc']);
    expect(cache!.clear).toHaveBeenCalledWith(USER_A, 'research_session');
  });

  it('a replayed settlement never charges twice', async () => {
    expect(await settleDb({ inserted: false, reservationExists: true }).svc.settle('turn:k1', 6, null)).toBe('already_resolved');
  });

  it('settling an unknown key reports no_reservation', async () => {
    expect(await settleDb({ inserted: false, reservationExists: false }).svc.release('turn:none')).toBe('no_reservation');
  });

  it('rejects non-integer usage', async () => {
    await expect(setup().svc.settle('k', 1.5, null)).rejects.toThrow('non-negative integer');
  });

  it('propagates a ledger failure at settlement so the caller keeps it held', async () => {
    const { svc, db } = settleDb({ inserted: true, reservationExists: true });
    db.failNext = /"costMicroUsd"/;
    await expect(svc.settle('turn:k1', 3, null)).rejects.toThrow('simulated database failure');
  });

  it('a cache failure after settlement is ignored (ledger is the truth)', async () => {
    const { svc, cache } = settleDb({ inserted: true, reservationExists: true });
    cache!.clear.mockRejectedValue(new Error('redis down'));
    expect(await svc.release('turn:k1')).toBe('settled');
  });

  it('records usage idempotently', async () => {
    const { svc, db } = setup();
    db.on(/INSERT INTO ai_usage_events/, () => []);
    await svc.recordUsage({ userId: USER_A, sessionId: 's', capability: 'research_session', idempotencyKey: 'k', provider: 'simulated', modelKey: 'm', outcome: 'success', unitsReported: 3 });
    expect(db.ran(/ON CONFLICT \("idempotencyKey"\) DO NOTHING/)).toHaveLength(1);
  });

  it('compensation is a separate entry', async () => {
    const { svc, db } = setup();
    db.on(/'compensation', \$2/, () => [{ id: '1' }]);
    await svc.compensate('turn:k1', -4);
    expect(db.ran(/'compensation'/)[0].params).toEqual(['turn:k1', -4]);
  });

  it('compensation requires an existing reservation and integer units', async () => {
    const { svc, db } = setup();
    db.on(/'compensation', \$2/, () => []);
    await expect(svc.compensate('nope', 1)).rejects.toThrow('no reservation');
    await expect(svc.compensate('k', 0.5)).rejects.toThrow('integer');
  });
});

describe('BudgetLedgerService — reconcile', () => {
  it('releases no-provider keys, settles from usage evidence, flags expired held ones once', async () => {
    const { svc, db, metrics } = setup();
    db.on(/LEFT JOIN ai_usage_events/, () => [
      { idempotencyKey: 'k-none', expired: false, provider: NO_PROVIDER, modelKey: null, unitsReported: '0' },
      { idempotencyKey: 'k-known', expired: true, provider: 'simulated', modelKey: 'simulated-v1', unitsReported: '5' },
      { idempotencyKey: 'k-unknown', expired: true, provider: 'simulated', modelKey: 'simulated-v1', unitsReported: null },
      { idempotencyKey: 'k-young', expired: false, provider: null, modelKey: null, unitsReported: null },
    ]);
    db.on(/FROM ai_rate_cards/, () => []);
    db.on(/"costMicroUsd"/, () => [{ id: '1' }]);
    db.on(/^SELECT "userId", capability/, () => []);
    db.on(/'expired_flag', 0/, () => [{ id: '2' }]);
    expect(await svc.reconcile()).toEqual({ settled: 1, released: 1, flaggedExpired: 1, held: 2 });
    expect(metrics.reservationExpiredInc).toHaveBeenCalledTimes(1);
    expect(db.ran(/'expired_flag'/)[0].params).toEqual(['k-unknown']);
  });

  it('a second pass changes nothing (idempotent)', async () => {
    const { svc, db } = setup();
    db.on(/LEFT JOIN ai_usage_events/, () => [{ idempotencyKey: 'k', expired: true, provider: 'simulated', modelKey: null, unitsReported: null }]);
    db.on(/'expired_flag', 0/, () => []);
    expect(await svc.reconcile()).toEqual({ settled: 0, released: 0, flaggedExpired: 0, held: 1 });
  });

  it('counts already-resolved keys as neither settled nor released', async () => {
    const { svc, db } = setup();
    db.on(/LEFT JOIN ai_usage_events/, () => [
      { idempotencyKey: 'a', expired: false, provider: NO_PROVIDER, modelKey: null, unitsReported: '0' },
      { idempotencyKey: 'b', expired: false, provider: 'simulated', modelKey: null, unitsReported: '2' },
    ]);
    db.on(/"costMicroUsd"/, () => []);
    db.on(/^SELECT 1 FROM ai_budget_ledger/, () => [{}]);
    expect(await svc.reconcile()).toEqual({ settled: 0, released: 0, flaggedExpired: 0, held: 0 });
  });
});
