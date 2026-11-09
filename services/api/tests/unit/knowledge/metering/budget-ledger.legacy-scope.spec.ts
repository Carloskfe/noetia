import { BudgetLedgerService, UNRESOLVED } from '../../../../src/knowledge/metering/budget-ledger.service';
import { RateCardService } from '../../../../src/knowledge/metering/rate-card.service';
import { FakeDb, mockMetrics, TEST_CONFIG } from '../support/fixtures';

/**
 * NEM-021 Phase 2: legacy (turn-level, units-only) settlement, release, and reconciliation must never resolve
 * a per-attempt reservation, which only the cost ledger resolves (from normalized usage and the pinned schema).
 * The overall and per-scope unresolved bounds keep counting BOTH kinds (shared UNRESOLVED fragment).
 */
describe('BudgetLedgerService — legacy paths are scoped to legacy reservations (NEM-021)', () => {
  const svc = (db: FakeDb) => new BudgetLedgerService(db as any, new RateCardService(db as any), mockMetrics(), TEST_CONFIG);

  it('legacy settle/release only resolve reservations without an attempt number', async () => {
    const db = new FakeDb();
    db.on(/"costMicroUsd"/, () => []);
    db.on(/^SELECT 1 FROM ai_budget_ledger/, () => [{}]);
    await svc(db).release('turn:k:a1');
    expect(db.ran(/"costMicroUsd"/)[0].sql).toMatch(/r\."attemptNumber" IS NULL/);
  });

  it('legacy reconciliation only scans legacy reservations', async () => {
    const db = new FakeDb();
    db.on(/LEFT JOIN ai_usage_events/, () => []);
    await svc(db).reconcile();
    expect(db.ran(/LEFT JOIN ai_usage_events/)[0].sql).toMatch(/r\."attemptNumber" IS NULL/);
  });

  it('the shared UNRESOLVED fragment does not filter by kind, so unresolved bounds count attempts too', () => {
    expect(UNRESOLVED).not.toMatch(/attemptNumber/);
    expect(UNRESOLVED).toMatch(/"entryType" = 'reservation'/);
  });
});
