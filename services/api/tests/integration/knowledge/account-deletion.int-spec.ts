import { DataSource } from 'typeorm';
import { User } from '../../../src/users/user.entity';
import { UsersService } from '../../../src/users/users.service';
import { budgetPolicy, eligibleBook, enableFlag, openDataSource, readyUser, wire } from './support/it-env';

const USER_TABLES = ['ai_grants', 'ai_conversations', 'ai_usage_events', 'ai_budget_ledger'] as const;

describe('AC-15e: account deletion with rows in every user-related AI table', () => {
  let ds: DataSource;
  let w: ReturnType<typeof wire>;

  beforeAll(async () => {
    ds = await openDataSource();
    w = wire(ds);
    await enableFlag(ds);
    await budgetPolicy(ds, 'noetia_x', 'research_session');
  });
  afterAll(async () => ds?.destroy());

  it('the existing deleteAccount path succeeds and leaves no AI row for the user', async () => {
    const u = await readyUser(ds, w, 'noetia_x');
    const [a, b] = [await eligibleBook(ds, w), await eligibleBook(ds, w)];
    const parent = await w.sessions.create(u, [a, b]);
    await w.turns.run(u, parent.id, 'deletion-turn-01');                       // ledger reservation + settlement + usage event
    w.sim.enqueue({ kind: 'failure', units: null });
    await w.turns.run(u, parent.id, 'deletion-turn-02').catch(() => undefined); // an unresolved (held) reservation too
    const fork = await w.sessions.fork(u, parent.id, [a]);                       // fork lineage (self-references)

    const before: Record<string, number> = {};
    for (const t of USER_TABLES) before[t] = Number((await ds.query(`SELECT count(*) FROM ${t} WHERE "userId" = $1`, [u]))[0].count);
    const sessionBooksBefore = Number((await ds.query(
      `SELECT count(*) FROM ai_session_books WHERE "sessionId" = ANY($1)`, [[parent.id, fork.id]]))[0].count);
    expect(Object.values(before).every((n) => n > 0)).toBe(true); // rows exist in every user-related AI table
    expect(sessionBooksBefore).toBe(3);
    // feature_flags carries no per-user targeting, so it has no user rows to delete.
    expect(await ds.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'feature_flags' AND column_name ILIKE '%user%'`)).toEqual([]);

    // The unchanged production deletion path. Only the email side effect is stubbed.
    const users = new UsersService(ds.getRepository(User), ds, { sendFarewell: jest.fn().mockResolvedValue(undefined) } as any);
    await expect(users.deleteAccount(u)).resolves.toBeUndefined();

    expect(await ds.query(`SELECT id FROM users WHERE id = $1`, [u])).toEqual([]);
    for (const t of USER_TABLES) {
      expect({ t, n: Number((await ds.query(`SELECT count(*) FROM ${t} WHERE "userId" = $1`, [u]))[0].count) }).toEqual({ t, n: 0 });
    }
    expect(Number((await ds.query(`SELECT count(*) FROM ai_session_books WHERE "sessionId" = ANY($1)`, [[parent.id, fork.id]]))[0].count)).toBe(0);
    expect(await ds.query(`SELECT id FROM ai_conversations WHERE id = ANY($1)`, [[parent.id, fork.id]])).toEqual([]);
    // The books themselves are catalogue rows and remain.
    expect(await ds.query(`SELECT count(*)::int AS n FROM books WHERE id = ANY($1)`, [[a, b]])).toEqual([{ n: 2 }]);
  });
});
