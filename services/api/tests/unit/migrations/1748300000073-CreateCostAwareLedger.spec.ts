import { CreateCostAwareLedger1748300000073 } from '../../../src/migrations/1748300000073-CreateCostAwareLedger';

const runner = () => {
  const calls: string[] = [];
  return { calls, qr: { query: jest.fn(async (sql: string) => { calls.push(sql); return []; }) } as any };
};
const up = async () => {
  const r = runner();
  await new CreateCostAwareLedger1748300000073().up(r.qr);
  return r.calls;
};

describe('CreateCostAwareLedger1748300000073 (NEM-021 Phase 2)', () => {
  it('is additive: seeds nothing, drops nothing, never alters an existing column or constraint', async () => {
    const all = (await up()).join('\n');
    expect(all).not.toMatch(/\bINSERT\s+INTO\b|\bUPDATE\s+\w+\s+SET\b|\bDELETE\s+FROM\b|\bDROP\b|\bRENAME\b|ALTER\s+COLUMN|SET DATA TYPE|\bTRUNCATE\b/i);
    // Only NEM-019's ledger and usage tables are altered, and only with ADD COLUMN.
    const alters = [...all.matchAll(/ALTER TABLE (\w+)/g)].map((m) => m[1]);
    expect([...new Set(alters)].sort()).toEqual(['ai_budget_ledger', 'ai_usage_events']);
    for (const block of all.split(/ALTER TABLE/).slice(1)) {
      const clauses = block.split(/;|CREATE/)[0].split(',').map((c) => c.trim()).filter(Boolean);
      expect(clauses.every((c) => /^(\w+\s+)?ADD COLUMN /.test(c) || /^ADD COLUMN /.test(c))).toBe(true);
    }
  });

  it('every added column is nullable (existing NEM-019 rows are untouched)', async () => {
    const added = (await up()).join('\n').match(/ADD COLUMN [^,\n]+/g)!;
    expect(added.length).toBe(22);
    expect(added.filter((c) => /NOT NULL|DEFAULT/.test(c))).toEqual([]);
  });

  it("does not touch NEM-019's ai_usage_events.outcome CHECK", async () => {
    expect((await up()).join('\n')).not.toMatch(/\boutcome\b(?!")/);
  });

  it('user rows cascade; every other new FK is SET NULL or CASCADE (B-2)', async () => {
    const all = (await up()).join('\n');
    const refs = all.match(/REFERENCES \w+\(id\) ON DELETE (CASCADE|SET NULL|RESTRICT|NO ACTION)/g)!;
    expect(refs.length).toBe(9); // ledger 3 + usage 1 + partials 1 + overruns 2 + breakers 2
    expect(refs.every((r) => /CASCADE|SET NULL/.test(r))).toBe(true);
    for (const t of ['ai_partial_settlements', 'ai_cost_overruns']) {
      expect(all.split(`CREATE TABLE ${t}`)[1].split('CREATE')[0]).toMatch(/"userId" uuid NOT NULL REFERENCES users\(id\) ON DELETE CASCADE/);
    }
  });

  it('overruns are one classification per attempt, positive, and equal actual − reserved', async () => {
    const t = (await up()).find((s) => /CREATE TABLE ai_cost_overruns/.test(s))!;
    expect(t).toMatch(/UNIQUE \("attemptKey"\)/);
    expect(t).toMatch(/"overrunMicroUsd" > 0/);
    expect(t).toMatch(/"overrunMicroUsd" = "actualMicroUsd" - "reservedMicroUsd"/);
  });

  it('breakers are keyed by pricing schema; a closed breaker must carry a review reference', async () => {
    const t = (await up()).find((s) => /CREATE TABLE ai_overrun_breakers/.test(s))!;
    expect(t).toMatch(/"pricingSchemaId" uuid PRIMARY KEY/);
    expect(t).toMatch(/state = 'closed' AND "closedAt" IS NOT NULL AND "closedByReviewRef" IS NOT NULL/);
  });

  it('at most one active pricing schema per model, one active weight schema, one active global policy', async () => {
    const idx = (await up()).filter((s) => /CREATE UNIQUE INDEX/.test(s)).join('\n');
    expect(idx).toMatch(/UQ_ai_pricing_schemas_one_active[\s\S]*WHERE active/);
    expect(idx).toMatch(/UQ_ai_unit_weight_schemas_one_active[\s\S]*WHERE active/);
    expect(idx).toMatch(/UQ_ai_global_budget_policies_one_active[\s\S]*WHERE active/);
  });

  it('global policies hold integer micro-USD and a fixture marker; no row is seeded', async () => {
    const t = (await up()).find((s) => /CREATE TABLE ai_global_budget_policies/.test(s))!;
    expect(t).toMatch(/"allowanceMicroUsd" bigint NOT NULL/);
    expect(t).toMatch(/"maxUnresolvedMicroUsd" bigint NOT NULL/);
    expect(t).toMatch(/"isTestFixture" boolean/);
  });

  it('down reverses everything it created, dependants first', async () => {
    const r = runner();
    await new CreateCostAwareLedger1748300000073().down(r.qr);
    const all = r.calls.join('\n');
    const order = ['ai_overrun_breakers', 'ai_cost_overruns', 'ai_partial_settlements', 'ai_global_budget_policies', 'ai_unit_weight_schemas', 'ai_pricing_schemas']
      .map((t) => all.indexOf(`DROP TABLE IF EXISTS ${t}`));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect((all.match(/DROP COLUMN IF EXISTS/g) ?? []).length).toBe(22);
  });
});
