import { DataSource } from 'typeorm';
import { createBook, createUser, openDataSource } from './support/it-env';

const NEW_TABLES = ['ai_tier_policies', 'ai_grants', 'feature_flags', 'ai_conversations', 'ai_session_books', 'book_ai_rights',
  'ai_budget_policies', 'ai_rate_cards', 'ai_budget_ledger', 'ai_usage_events'];

async function schemaSnapshot(ds: DataSource) {
  const rows = await ds.query(
    `SELECT table_name, column_name, data_type, is_nullable, column_default FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name <> ALL($1) ORDER BY table_name, ordinal_position`,
    [NEW_TABLES],
  );
  const fks = await ds.query(
    `SELECT conname, conrelid::regclass::text AS t, pg_get_constraintdef(oid) AS def FROM pg_constraint
      WHERE connamespace = 'public'::regnamespace AND conrelid::regclass::text <> ALL($1) ORDER BY conname`,
    [NEW_TABLES],
  );
  return JSON.stringify({ rows, fks });
}

const tablesPresent = async (ds: DataSource) =>
  (await ds.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ANY($1)`, [NEW_TABLES])).length;

/** NEM-019's four migrations, oldest first (D-1: identified by name, not by position). */
const NEM019_MIGRATIONS = [
  'CreateIntelligenceEntitlement1748300000069', 'CreateIntelligenceSessions1748300000070',
  'CreateBookAiRights1748300000071', 'CreateIntelligenceMetering1748300000072',
];
const LAST_NEM019_TIMESTAMP = 1748300000072;

const lastMigrationName = async (ds: DataSource): Promise<string> =>
  (await ds.query(`SELECT name FROM migrations ORDER BY timestamp DESC LIMIT 1`))[0].name;

/** Revert every migration newer than 072 (none, one, or many), stopping exactly at 072. */
async function revertMigrationsAfter072(ds: DataSource) {
  for (let guard = 0; guard < 100; guard++) {
    const [last] = await ds.query(`SELECT timestamp::bigint::text AS ts FROM migrations ORDER BY timestamp DESC LIMIT 1`);
    if (BigInt(last.ts) <= BigInt(LAST_NEM019_TIMESTAMP)) return;
    await ds.undoLastMigration({ transaction: 'each' });
  }
  throw new Error('more than 100 migrations after 072; refusing to continue');
}

describe('NEM-019 schema on a disposable database', () => {
  let ds: DataSource;
  beforeAll(async () => { ds = await openDataSource(); });
  afterAll(async () => ds?.destroy());

  it('AC-19: migrations 069–072 run down and up; no existing table is altered; revert restores the prior schema', async () => {
    // D-1 (PO-approved, 2026-11-09): independent of how many migrations follow 072. Later migrations are
    // reverted first, so the snapshot below is taken at the "072 is latest" state the original assertions describe.
    await revertMigrationsAfter072(ds);
    expect(await tablesPresent(ds)).toBe(10);
    const before = await schemaSnapshot(ds);
    for (const name of [...NEM019_MIGRATIONS].reverse()) {
      expect(await lastMigrationName(ds)).toBe(name); // revert 072…069 by name, never by position
      await ds.undoLastMigration({ transaction: 'each' });
    }
    expect(await tablesPresent(ds)).toBe(0);
    const reverted = await schemaSnapshot(ds);
    expect(reverted).toBe(before); // nothing outside the new tables changed, and revert leaves no residue
    expect(await lastMigrationName(ds)).toBe('ReconcilePlanDisplayPrices1748300000067');
    await ds.runMigrations({ transaction: 'each' });
    expect(await tablesPresent(ds)).toBe(10);
    // AC-12: straight after a fresh up-migration, seeds created no rights, budget, or rate-card rows.
    expect(Number((await ds.query(`SELECT count(*) FROM book_ai_rights`))[0].count)).toBe(0);
    expect(Number((await ds.query(`SELECT count(*) FROM ai_budget_policies`))[0].count)).toBe(0);
    expect(Number((await ds.query(`SELECT count(*) FROM ai_rate_cards`))[0].count)).toBe(0);
    // Compare at the same "072 is latest" state, then restore the full schema for the remaining tests.
    await revertMigrationsAfter072(ds);
    expect(await schemaSnapshot(ds)).toBe(before);
    await ds.runMigrations({ transaction: 'each' });
  });

  it('seeds: tier policies are exactly 3 and 10', async () => {
    expect(await ds.query(`SELECT tier, "maxBooks" FROM ai_tier_policies ORDER BY tier`)).toEqual([
      { tier: 'noetia_plus', maxBooks: 3 }, { tier: 'noetia_x', maxBooks: 10 },
    ]);
  });

  it('AC-15f: every FK from a knowledge table to users is ON DELETE CASCADE or SET NULL', async () => {
    const fks = await ds.query(
      `SELECT conrelid::regclass::text AS t, confdeltype FROM pg_constraint
        WHERE contype = 'f' AND confrelid = 'users'::regclass AND conrelid::regclass::text = ANY($1)`,
      [NEW_TABLES],
    );
    expect(fks.length).toBeGreaterThanOrEqual(4);
    expect(fks.map((f: any) => f.t).sort()).toEqual(['ai_budget_ledger', 'ai_conversations', 'ai_grants', 'ai_usage_events']);
    for (const f of fks) expect({ t: f.t, rule: f.confdeltype }).toEqual({ t: f.t, rule: expect.stringMatching(/^[cn]$/) }); // c=CASCADE n=SET NULL
    // Self-test: the rule rejects RESTRICT (r) and NO ACTION (a).
    expect(/^[cn]$/.test('a') || /^[cn]$/.test('r')).toBe(false);
  });

  it('every FK from a knowledge table (to anything) is CASCADE or SET NULL — nothing can block deletion', async () => {
    const fks = await ds.query(
      `SELECT conname, confdeltype FROM pg_constraint WHERE contype = 'f' AND conrelid::regclass::text = ANY($1)`,
      [NEW_TABLES],
    );
    expect(fks.filter((f: any) => !['c', 'n'].includes(f.confdeltype))).toEqual([]);
  });

  describe('session-book constraints (AC-3)', () => {
    let sessionId: string;
    beforeAll(async () => {
      const userId = await createUser(ds);
      [{ id: sessionId }] = await ds.query(
        `INSERT INTO ai_conversations ("userId", "tierAtCreation", "policyVersionAtCreation") VALUES ($1, 'noetia_x', 1) RETURNING id`, [userId]);
    });
    const insert = async (position: number, bookId: string) =>
      ds.query(`INSERT INTO ai_session_books ("sessionId", "bookId", position, "titleSnapshot", "authorSnapshot") VALUES ($1, $2, $3, 't', 'a')`, [sessionId, bookId, position]);

    it('the database rejects position 11 directly', async () => {
      await expect(insert(11, await createBook(ds))).rejects.toThrow(/check constraint/i);
      await expect(insert(0, await createBook(ds))).rejects.toThrow(/check constraint/i);
    });
    it('the database rejects a duplicate book and a duplicate position in one session', async () => {
      const b = await createBook(ds);
      await insert(1, b);
      await expect(insert(2, b)).rejects.toThrow(/UQ_ai_session_books_session_book/);
      await expect(insert(1, await createBook(ds))).rejects.toThrow(/UQ_ai_session_books_session_position/);
    });
  });
});
