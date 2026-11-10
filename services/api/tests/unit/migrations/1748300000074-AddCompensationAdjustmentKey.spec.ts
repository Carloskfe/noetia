import { AddCompensationAdjustmentKey1748300000074 } from '../../../src/migrations/1748300000074-AddCompensationAdjustmentKey';

const run = async (dir: 'up' | 'down') => {
  const calls: string[] = [];
  const qr = { query: jest.fn(async (sql: string) => { calls.push(sql); return []; }) } as any;
  await new AddCompensationAdjustmentKey1748300000074()[dir](qr);
  return calls.join('\n');
};

describe('AddCompensationAdjustmentKey1748300000074 (NEM-021 Phase 2, F-8)', () => {
  it('is additive: one nullable column, one partial unique index, one CHECK; seeds, drops, and alters nothing', async () => {
    const up = await run('up');
    expect(up).not.toMatch(/\bINSERT\s+INTO\b|\bUPDATE\s+\w+\s+SET\b|\bDELETE\s+FROM\b|\bDROP\b|\bRENAME\b|ALTER\s+COLUMN|SET DATA TYPE|\bTRUNCATE\b/i);
    expect(up).toMatch(/ALTER TABLE ai_budget_ledger ADD COLUMN "adjustmentKey" varchar\(128\)/);
    expect(up).not.toMatch(/"adjustmentKey" varchar\(128\) (NOT NULL|DEFAULT)/);
    expect([...up.matchAll(/ALTER TABLE (\w+)/g)].map((m) => m[1])).toEqual(['ai_budget_ledger', 'ai_budget_ledger']);
  });

  it('the unique index is per attempt key and adjustment key, for keyed compensation rows only (distinct adjustments stay allowed)', async () => {
    const up = await run('up');
    expect(up).toMatch(/CREATE UNIQUE INDEX "UQ_ai_budget_ledger_adjustment"\s+ON ai_budget_ledger \("idempotencyKey", "adjustmentKey"\)\s+WHERE "entryType" = 'compensation' AND "adjustmentKey" IS NOT NULL/);
  });

  it("requires a key on every micro-USD compensation; NEM-019's units-only compensations (no micro-USD) are unaffected", async () => {
    expect(await run('up')).toMatch(/CHECK \("entryType" <> 'compensation' OR "compensatedMicroUsd" IS NULL OR "adjustmentKey" IS NOT NULL\)/);
  });

  it('down removes exactly what up added, constraint and index before the column', async () => {
    const down = await run('down');
    const order = ['CK_ai_budget_ledger_cost_compensation_key', 'UQ_ai_budget_ledger_adjustment', 'DROP COLUMN IF EXISTS "adjustmentKey"'].map((s) => down.indexOf(s));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(down).not.toMatch(/DROP TABLE/);
  });
});
