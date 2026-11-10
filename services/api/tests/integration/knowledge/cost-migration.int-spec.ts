import { DataSource } from 'typeorm';
import { User } from '../../../src/users/user.entity';
import { UsersService } from '../../../src/users/users.service';
import { openDataSource } from './support/it-env';
import { attempt, newUser, resetCostState, standardSetup, usage, wireCost } from './support/cost-env';

/** NEM-021 Phase 2: migration 073 up/down (§11 AC-13) and account deletion over the new tables (§11 AC-11, B-2). */

const MIGRATION = 'CreateCostAwareLedger1748300000073';
const COST_TABLES = ['ai_pricing_schemas', 'ai_unit_weight_schemas', 'ai_global_budget_policies', 'ai_partial_settlements',
  'ai_cost_overruns', 'ai_overrun_breakers'];
const LEDGER_COLUMNS = ['reservedMicroUsd', 'settledMicroUsd', 'compensatedMicroUsd', 'pricingSchemaId', 'unitWeightSchemaId',
  'globalPolicyId', 'attemptNumber', 'turnKey', 'pricingModifiers', 'noChargeDeclarations', 'normalizedUsage', 'contractOutcome',
  'errorCategory', 'usageCompleteness'];
const USAGE_COLUMNS = ['contractOutcome', 'errorCategory', 'usageCompleteness', 'zeroUsageEvidence', 'normalizedUsage',
  'attemptNumber', 'pricingSchemaId', 'settledMicroUsd'];
const ADDED: Record<string, string[]> = { ai_budget_ledger: LEDGER_COLUMNS, ai_usage_events: USAGE_COLUMNS };
/** Tables with a user column added or created by 073 (B-2: rows must go when the user is deleted). */
const USER_TABLES = ['ai_budget_ledger', 'ai_usage_events', 'ai_partial_settlements', 'ai_cost_overruns'];

const isAdded = (table: string, column: string) => (ADDED[table] ?? []).includes(column);
const mentionsAdded = (table: string, def: string) => (ADDED[table] ?? []).some((c) => def.includes(`"${c}"`));

/**
 * The whole public schema EXCEPT what 073 adds: its six tables, its columns on the two NEM-019 tables, and the
 * constraints and indexes on those columns. Equal snapshots before and after 073 prove nothing else was altered.
 */
async function schemaOutside073(ds: DataSource) {
  const columns = (await ds.query(
    `SELECT table_name, column_name, data_type, is_nullable, column_default FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name <> ALL($1) ORDER BY table_name, ordinal_position`, [COST_TABLES],
  )).filter((c: any) => !isAdded(c.table_name, c.column_name));
  const constraints = (await ds.query(
    `SELECT conname, conrelid::regclass::text AS t, pg_get_constraintdef(oid) AS def FROM pg_constraint
      WHERE connamespace = 'public'::regnamespace AND conrelid::regclass::text <> ALL($1) ORDER BY conname`, [COST_TABLES],
  )).filter((c: any) => !mentionsAdded(c.t, c.def));
  const indexes = (await ds.query(
    `SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename <> ALL($1) ORDER BY indexname`,
    [COST_TABLES],
  )).filter((i: any) => !mentionsAdded(i.tablename, i.indexdef));
  return JSON.stringify({ columns, constraints, indexes });
}

const costTablesPresent = async (ds: DataSource) =>
  Number((await ds.query(`SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ANY($1)`, [COST_TABLES]))[0].count);
const addedColumnsPresent = async (ds: DataSource) =>
  (await ds.query(
    `SELECT table_name, column_name, is_nullable FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name IN ('ai_budget_ledger', 'ai_usage_events')`,
  )).filter((c: any) => isAdded(c.table_name, c.column_name));
const lastMigration = async (ds: DataSource) => (await ds.query(`SELECT name FROM migrations ORDER BY timestamp DESC LIMIT 1`))[0].name;

describe('NEM-021 migration 073 on a disposable database', () => {
  let ds: DataSource;
  beforeAll(async () => { ds = await openDataSource(); });
  afterAll(async () => ds?.destroy());

  it('AC-13: 073 runs down and up; it only adds; no other table, column, constraint, or index is altered; no value is seeded', async () => {
    expect(await lastMigration(ds)).toBe(MIGRATION);
    await resetCostState(ds);
    expect(await costTablesPresent(ds)).toBe(6);
    const added = await addedColumnsPresent(ds);
    expect(added).toHaveLength(LEDGER_COLUMNS.length + USAGE_COLUMNS.length);
    expect(added.every((c: any) => c.is_nullable === 'YES')).toBe(true); // NEM-019 rows stay valid (legacy = NULL)
    const withMigration = await schemaOutside073(ds);

    await ds.undoLastMigration({ transaction: 'each' });
    expect(await lastMigration(ds)).toBe('CreateIntelligenceMetering1748300000072');
    expect(await costTablesPresent(ds)).toBe(0);
    expect(await addedColumnsPresent(ds)).toEqual([]);
    expect(await schemaOutside073(ds)).toBe(withMigration); // revert leaves no residue and 073 changed nothing else

    await ds.runMigrations({ transaction: 'each' });
    expect(await lastMigration(ds)).toBe(MIGRATION);
    expect(await costTablesPresent(ds)).toBe(6);
    expect(await addedColumnsPresent(ds)).toHaveLength(LEDGER_COLUMNS.length + USAGE_COLUMNS.length);
    expect(await schemaOutside073(ds)).toBe(withMigration);
    // No pricing, weight, or global-policy value is seeded: unset configuration denies.
    for (const t of ['ai_pricing_schemas', 'ai_unit_weight_schemas', 'ai_global_budget_policies']) {
      expect({ t, n: Number((await ds.query(`SELECT count(*) FROM ${t}`))[0].count) }).toEqual({ t, n: 0 });
    }
    // NEM-019's legacy outcome CHECK is untouched (also covered by the snapshot).
    const [check] = await ds.query(
      `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid = 'ai_usage_events'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%outcome%' AND pg_get_constraintdef(oid) NOT LIKE '%contractOutcome%'`,
    );
    expect(check.def).toMatch(/success.*failure.*timeout.*aborted/);
  });

  it('AC-11 (B-2): every FK to users from 073 is ON DELETE CASCADE; every other new FK is CASCADE or SET NULL', async () => {
    const fks = await ds.query(
      `SELECT conrelid::regclass::text AS t, confrelid::regclass::text AS target, pg_get_constraintdef(oid) AS def
         FROM pg_constraint WHERE contype = 'f' AND connamespace = 'public'::regnamespace
          AND (conrelid::regclass::text = ANY($1) OR conrelid::regclass::text IN ('ai_budget_ledger', 'ai_usage_events'))`,
      [COST_TABLES],
    );
    const fromNew = fks.filter((f: any) => COST_TABLES.includes(f.t) || mentionsAdded(f.t, f.def));
    // ai_budget_ledger 3 (pricing, weights, global policy) · ai_usage_events 1 · partial 1 · overruns 2 · breakers 2.
    expect(fromNew).toHaveLength(9);
    expect(fromNew.filter((f: any) => f.target === 'users').map((f: any) => f.t).sort()).toEqual(['ai_cost_overruns', 'ai_partial_settlements']);
    for (const f of fromNew.filter((x: any) => x.target === 'users')) expect(f.def).toMatch(/ON DELETE CASCADE/);
    for (const f of fromNew) expect({ t: f.t, ok: /ON DELETE (CASCADE|SET NULL)/.test(f.def) }).toEqual({ t: f.t, ok: true });
  });

  it('AC-11: the unchanged deleteAccount path removes every cost-ledger row for the user; shared configuration remains', async () => {
    const w = wireCost(ds);
    await standardSetup(ds, w);
    const u = await newUser(ds);
    const other = await newUser(ds);
    const L = w.costLedger;
    // Partial settlement (ai_partial_settlements), an overrun (ai_cost_overruns + settlement + usage evidence), a held attempt.
    const p = await L.reserveAttempt(attempt(u, 100_000));
    await L.settleAttempt(usage(p.attemptKey, { inputUncached: 30_000 }, { outcome: 'refused', error: 'refusal', usageCompleteness: 'partial' }));
    const h = await L.reserveAttempt(attempt(u, 1_000));
    await L.settleAttempt(usage(h.attemptKey, {}, { outcome: 'timed_out', error: 'timeout', usageCompleteness: 'unknown' }));
    const kept = await L.reserveAttempt(attempt(other, 1_000)); // another user's rows must survive
    const o = await L.reserveAttempt(attempt(u, 10_000)); // last: the overrun opens the breaker on the schema
    await L.settleAttempt(usage(o.attemptKey, { inputUncached: 10_000, output: 5_000 }));

    const count = async (t: string, user: string) => Number((await ds.query(`SELECT count(*) FROM ${t} WHERE "userId" = $1`, [user]))[0].count);
    for (const t of USER_TABLES) expect({ t, some: (await count(t, u)) > 0 }).toEqual({ t, some: true });

    const users = new UsersService(ds.getRepository(User), ds, { sendFarewell: jest.fn().mockResolvedValue(undefined) } as any);
    await expect(users.deleteAccount(u)).resolves.toBeUndefined();

    for (const t of USER_TABLES) expect({ t, n: await count(t, u) }).toEqual({ t, n: 0 });
    expect(await count('ai_budget_ledger', other)).toBe(1);
    expect((await w.costLedger.globalState())!.held).toBe(kept.reservedMicroUsd);
    // Shared configuration (no user column) remains: pricing schemas, weights, global policy, and the opened breaker.
    for (const t of ['ai_pricing_schemas', 'ai_unit_weight_schemas', 'ai_global_budget_policies', 'ai_overrun_breakers']) {
      expect({ t, some: Number((await ds.query(`SELECT count(*) FROM ${t}`))[0].count) > 0 }).toEqual({ t, some: true });
    }
    await resetCostState(ds);
  });
});
