import { CreateIntelligenceEntitlement1748300000069, TIER_POLICY_SEED } from '../../../src/migrations/1748300000069-CreateIntelligenceEntitlement';

const runner = () => {
  const calls: { sql: string; params?: unknown[] }[] = [];
  return { calls, qr: { query: jest.fn(async (sql: string, params?: unknown[]) => { calls.push({ sql, params }); return []; }) } as any };
};

describe('CreateIntelligenceEntitlement1748300000069 (NEM-019)', () => {
  it('creates only new tables; never alters an existing one', async () => {
    const { calls, qr } = runner();
    await new CreateIntelligenceEntitlement1748300000069().up(qr);
    expect(calls.map((c) => c.sql).join('\n')).not.toMatch(/ALTER TABLE/i);
    expect(calls.filter((c) => /CREATE TABLE/.test(c.sql)).map((c) => c.sql.match(/CREATE TABLE (\w+)/)![1])).toEqual(['ai_tier_policies', 'ai_grants', 'feature_flags']);
  });

  it('seeds only the PO-027 limits 3 and 10, idempotently', async () => {
    const { calls, qr } = runner();
    await new CreateIntelligenceEntitlement1748300000069().up(qr);
    const seeds = calls.filter((c) => /INSERT INTO ai_tier_policies/.test(c.sql));
    expect(seeds.map((c) => c.params)).toEqual([['noetia_plus', 1, 3, ['research_session']], ['noetia_x', 1, 10, ['research_session']]]);
    expect(seeds.every((c) => /ON CONFLICT \(tier, version\) DO NOTHING/.test(c.sql))).toBe(true);
    expect(TIER_POLICY_SEED.map((p) => p.maxBooks)).toEqual([3, 10]);
  });

  it('ai_grants cascades from users(id); feature_flags has no user reference', async () => {
    const { calls, qr } = runner();
    await new CreateIntelligenceEntitlement1748300000069().up(qr);
    expect(calls.find((c) => /CREATE TABLE ai_grants/.test(c.sql))!.sql).toMatch(/REFERENCES users\(id\) ON DELETE CASCADE/);
    expect(calls.find((c) => /CREATE TABLE feature_flags/.test(c.sql))!.sql).not.toMatch(/users/);
  });

  it('down drops the three tables in reverse order', async () => {
    const { calls, qr } = runner();
    await new CreateIntelligenceEntitlement1748300000069().down(qr);
    expect(calls.map((c) => c.sql)).toEqual(['DROP TABLE IF EXISTS feature_flags', 'DROP TABLE IF EXISTS ai_grants', 'DROP TABLE IF EXISTS ai_tier_policies']);
  });
});
