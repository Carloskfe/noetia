import { CreateIntelligenceMetering1748300000072 } from '../../../src/migrations/1748300000072-CreateIntelligenceMetering';

const runner = () => {
  const calls: string[] = [];
  return { calls, qr: { query: jest.fn(async (sql: string) => { calls.push(sql); return []; }) } as any };
};

describe('CreateIntelligenceMetering1748300000072 (NEM-019)', () => {
  it('seeds no budget or rate-card values and alters nothing', async () => {
    const { calls, qr } = runner();
    await new CreateIntelligenceMetering1748300000072().up(qr);
    const all = calls.join('\n');
    expect(all).not.toMatch(/INSERT|ALTER TABLE/i);
  });

  it('ledger: integer units, cascades from users, one reservation / one resolution / one expiry flag per key', async () => {
    const { calls, qr } = runner();
    await new CreateIntelligenceMetering1748300000072().up(qr);
    const ledger = calls.find((s) => /CREATE TABLE ai_budget_ledger/.test(s))!;
    expect(ledger).toMatch(/"userId" uuid NOT NULL REFERENCES users\(id\) ON DELETE CASCADE/);
    expect(ledger).toMatch(/units bigint NOT NULL/);
    expect(ledger).toMatch(/"costMicroUsd" bigint/);
    const idx = calls.filter((s) => /CREATE UNIQUE INDEX/.test(s)).join('\n');
    expect(idx).toMatch(/WHERE "entryType" = 'reservation'/);
    expect(idx).toMatch(/WHERE "entryType" IN \('settlement', 'release'\)/);
    expect(idx).toMatch(/WHERE "entryType" = 'expired_flag'/);
  });

  it('usage events cascade from users and are unique per key', async () => {
    const { calls, qr } = runner();
    await new CreateIntelligenceMetering1748300000072().up(qr);
    const usage = calls.find((s) => /CREATE TABLE ai_usage_events/.test(s))!;
    expect(usage).toMatch(/REFERENCES users\(id\) ON DELETE CASCADE/);
    expect(usage).toMatch(/UNIQUE \("idempotencyKey"\)/);
  });

  it('budget policies are keyed by tier AND capability and carry a test-fixture marker', async () => {
    const { calls, qr } = runner();
    await new CreateIntelligenceMetering1748300000072().up(qr);
    const pol = calls.find((s) => /CREATE TABLE ai_budget_policies/.test(s))!;
    expect(pol).toMatch(/UNIQUE \(tier, capability, version\)/);
    expect(pol).toMatch(/"isTestFixture" boolean NOT NULL DEFAULT false/);
  });

  it('down drops all four tables in dependency order', async () => {
    const { calls, qr } = runner();
    await new CreateIntelligenceMetering1748300000072().down(qr);
    expect(calls).toEqual(['DROP TABLE IF EXISTS ai_usage_events', 'DROP TABLE IF EXISTS ai_budget_ledger', 'DROP TABLE IF EXISTS ai_rate_cards', 'DROP TABLE IF EXISTS ai_budget_policies']);
  });
});
