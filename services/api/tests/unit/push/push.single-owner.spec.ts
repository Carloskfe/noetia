/**
 * SP-1-I1 — single-owner registration, deleted-account send prevention and log redaction.
 *
 * Uses an in-memory fake of the transaction / advisory-lock / delete / upsert surface that PushService uses, so
 * ownership, rollback and interleaving can be asserted without a database. A real-Postgres concurrency check
 * was run separately against a disposable local container (see the SP-1-I1 report); no unit test touches a DB.
 */
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PushService, PUSH_TOKEN_LOCK_NAMESPACE } from '../../../src/push/push.service';
import { GiftsService } from '../../../src/gifts/gifts.service';

type Row = { userId: string; token: string; platform: string };

const tick = () => new Promise((r) => setImmediate(r));

/** In-memory push_tokens with transactional staging and per-token advisory locks. */
class FakeDb {
  rows: Row[] = [];
  lockQueries: unknown[][] = [];
  private locks = new Map<string, Promise<void>>();
  constructor(private readonly useLocks = true, public failUpsertFor: string | null = null) {}

  manager = {
    transaction: async <T>(fn: (em: any) => Promise<T>): Promise<T> => {
      let staged = this.rows.map((r) => ({ ...r }));
      const held: Array<() => void> = [];
      const em = {
        query: async (sql: string, params: unknown[]) => {
          this.lockQueries.push([sql, ...params]);
          if (!this.useLocks) return;
          const key = `${params[0]}:${params[1]}`;
          while (this.locks.has(key)) await this.locks.get(key);
          let release!: () => void;
          this.locks.set(key, new Promise<void>((r) => { release = r; }));
          held.push(() => { this.locks.delete(key); release(); });
          // Re-read committed state after acquiring the lock (what Postgres READ COMMITTED does per statement).
          staged = this.rows.map((r) => ({ ...r }));
        },
        delete: async (_entity: unknown, where: { token: string; userId: { _value?: string; value?: string } }) => {
          await tick();
          const notUser = (where.userId as any)._value ?? (where.userId as any).value;
          const before = staged.length;
          staged = staged.filter((r) => !(r.token === where.token && r.userId !== notUser));
          return { affected: before - staged.length };
        },
        getRepository: () => ({
          upsert: async (row: Row) => {
            await tick();
            if (this.failUpsertFor === row.userId) throw new Error('simulated upsert failure');
            const i = staged.findIndex((r) => r.userId === row.userId && r.token === row.token);
            if (i >= 0) staged[i] = { ...row };
            else staged.push({ ...row });
          },
        }),
      };
      try {
        const result = await fn(em);
        await tick();
        // Commit: replace committed rows for every token touched, keeping concurrent commits of other tokens.
        this.rows = this.mergeCommit(staged);
        return result;
      } finally {
        held.forEach((r) => r());
      }
    },
  };

  private mergeCommit(staged: Row[]): Row[] {
    // Without locks two transactions can each commit their own view: model "last writer adds, deletes only
    // what it saw" — i.e. rows inserted by a concurrent committer survive, which is the real-world race.
    const stagedKeys = new Set(staged.map((r) => `${r.userId}|${r.token}`));
    const kept = this.rows.filter((r) => stagedKeys.has(`${r.userId}|${r.token}`) || !this.useLocks);
    const merged = new Map<string, Row>();
    for (const r of [...kept, ...staged]) merged.set(`${r.userId}|${r.token}`, r);
    if (this.useLocks) return staged.map((r) => ({ ...r }));
    return [...merged.values()];
  }

  findBy = jest.fn(async ({ userId }: { userId: string }) => this.rows.filter((r) => r.userId === userId));
}

const fetchMock = jest.fn();
global.fetch = fetchMock as unknown as typeof fetch;

function service(db: FakeDb, users: Record<string, { id: string; uiLanguage: string } | null> = {}) {
  const userRepo = { findOneBy: jest.fn(async ({ id }: { id: string }) => users[id] ?? null) };
  return new PushService(db as any, userRepo as any);
}

const owners = (db: FakeDb, token: string) => db.rows.filter((r) => r.token === token).map((r) => r.userId).sort();

let logs: string[];
beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue({ ok: true });
  logs = [];
  for (const m of ['log', 'warn', 'error', 'debug', 'verbose'] as const) {
    jest.spyOn(Logger.prototype, m).mockImplementation((...a: unknown[]) => { logs.push(a.map(String).join(' ')); });
  }
});
afterEach(() => jest.restoreAllMocks());

const T = 'ExponentPushToken[shared-device-T]';

describe('single-owner registration (SP-D1)', () => {
  it('1. A registers T → A is the owner; lock taken with namespace + token', async () => {
    const db = new FakeDb();
    await service(db).registerToken('user-A', T, 'ios');
    expect(db.rows).toEqual([{ userId: 'user-A', token: T, platform: 'ios' }]);
    expect(db.lockQueries[0]).toEqual(['SELECT pg_advisory_xact_lock($1, hashtext($2))', PUSH_TOKEN_LOCK_NAMESPACE, T]);
  });

  it('2. B registers T → B becomes the ONLY owner; one redacted log line', async () => {
    const db = new FakeDb();
    const svc = service(db);
    await svc.registerToken('user-A', T, 'ios');
    await svc.registerToken('user-B', T, 'ios');
    expect(owners(db, T)).toEqual(['user-B']);
    expect(logs).toEqual(['push.register: token reassigned; 1 previous registration(s) removed']);
  });

  it('3. repeated registration by B is idempotent (no eviction, platform refreshed as before)', async () => {
    const db = new FakeDb();
    const svc = service(db);
    await svc.registerToken('user-B', T, 'ios');
    await svc.registerToken('user-B', T, 'unknown');
    expect(db.rows).toEqual([{ userId: 'user-B', token: T, platform: 'unknown' }]);
    expect(logs).toEqual([]);
  });

  it("4. A's other device tokens are preserved", async () => {
    const db = new FakeDb();
    const svc = service(db);
    await svc.registerToken('user-A', T, 'ios');
    await svc.registerToken('user-A', 'ExpoPushToken[A-tablet]', 'android');
    await svc.registerToken('user-B', T, 'ios');
    expect(owners(db, T)).toEqual(['user-B']);
    expect(owners(db, 'ExpoPushToken[A-tablet]')).toEqual(['user-A']);
  });

  it('5. concurrent registrations of T never leave more than one owner (40 interleaved rounds)', async () => {
    for (let round = 0; round < 40; round++) {
      const db = new FakeDb();
      const svc = service(db);
      await svc.registerToken('user-A', T, 'ios');
      await Promise.all(['user-B', 'user-C', 'user-D'].map((u) => svc.registerToken(u, T, 'ios')));
      expect(owners(db, T)).toHaveLength(1);
    }
  });

  it('5b. control: the same interleaving WITHOUT the advisory lock does produce multiple owners', async () => {
    let multi = 0;
    for (let round = 0; round < 40; round++) {
      const db = new FakeDb(false);
      const svc = service(db);
      await Promise.all(['user-B', 'user-C', 'user-D'].map((u) => svc.registerToken(u, T, 'ios')));
      if (owners(db, T).length > 1) multi++;
    }
    expect(multi).toBeGreaterThan(0);
  });

  it('6. a failure inside the transaction rolls the reassignment back (A keeps T; error propagates)', async () => {
    const db = new FakeDb(true, 'user-B');
    const svc = service(db);
    await svc.registerToken('user-A', T, 'ios');
    await expect(svc.registerToken('user-B', T, 'ios')).rejects.toThrow('simulated upsert failure');
    expect(owners(db, T)).toEqual(['user-A']);
    expect(logs).toEqual([]);
  });
});

describe('deleted-account send prevention (mandatory)', () => {
  it('7. orphaned registrations of a deleted user → zero Expo submissions', async () => {
    const db = new FakeDb();
    db.rows = [{ userId: 'deleted-A', token: T, platform: 'ios' }];
    await service(db, { 'deleted-A': null }).sendToUser('deleted-A', 'gift_claimed', { tokenCount: 3 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('7b. gift bought by A, A deleted, gift claimed later: claim unchanged, no push submitted', async () => {
    const db = new FakeDb();
    db.rows = [{ userId: 'deleted-buyer', token: T, platform: 'ios' }];
    const push = service(db, { 'deleted-buyer': null, claimer: { id: 'claimer', uiLanguage: 'es' } });
    const gift = { id: 'gift-1', status: 'sent', expiresAt: new Date(Date.now() + 86_400_000), tokenCount: 3, buyerUserId: 'deleted-buyer' };
    const giftRepo = { findOneBy: jest.fn().mockResolvedValue(gift), update: jest.fn().mockResolvedValue({}) };
    const tokenRepo = { create: jest.fn((x) => x), save: jest.fn().mockResolvedValue([]) };
    const config = { get: jest.fn((_k: string, d?: unknown) => d) } as unknown as ConfigService;
    const gifts = new GiftsService(config, {} as any, push, giftRepo as any, tokenRepo as any, {} as any);

    await expect(gifts.claimGift('claim-tok', 'claimer')).resolves.toEqual({ tokenCount: 3 });
    for (let i = 0; i < 5; i++) await tick();

    expect(tokenRepo.save).toHaveBeenCalledTimes(1);
    expect(tokenRepo.save.mock.calls[0][0]).toHaveLength(3);
    expect(giftRepo.update).toHaveBeenCalledWith('gift-1', expect.objectContaining({ status: 'claimed', claimedByUserId: 'claimer' }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('existing users still receive their notification (one request per token)', async () => {
    const db = new FakeDb();
    db.rows = [{ userId: 'user-B', token: T, platform: 'ios' }];
    await service(db, { 'user-B': { id: 'user-B', uiLanguage: 'en' } }).sendToUser('user-B', 'invite_accepted', { planName: 'Duo' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('after B takes over T, a notification for A is not submitted to T', async () => {
    const db = new FakeDb();
    const users = { 'user-A': { id: 'user-A', uiLanguage: 'es' }, 'user-B': { id: 'user-B', uiLanguage: 'es' } };
    const svc = service(db, users);
    await svc.registerToken('user-A', T, 'ios');
    await svc.registerToken('user-B', T, 'ios');
    await svc.sendToUser('user-A', 'invite_accepted', { planName: 'Duo' });
    expect(fetchMock).not.toHaveBeenCalled();
    await svc.sendToUser('user-B', 'invite_accepted', { planName: 'Duo' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).to).toBe(T);
  });
});

describe('logging and external calls', () => {
  it('15. failure and reassignment logs contain no token, user id or email', async () => {
    const db = new FakeDb();
    const users = { 'user-A': { id: 'user-A', uiLanguage: 'es' } };
    const svc = service(db, users);
    await svc.registerToken('user-B', T, 'ios');
    await svc.registerToken('user-A', T, 'ios');
    fetchMock.mockRejectedValueOnce(new Error('getaddrinfo ENOTFOUND exp.host'));
    await svc.sendToUser('user-A', 'invite_accepted', { planName: 'Duo' });
    expect(logs.length).toBe(2);
    for (const line of logs) {
      expect(line).not.toContain(T);
      expect(line).not.toMatch(/PushToken\[/);
      expect(line).not.toMatch(/user-[AB]/);
      expect(line).not.toMatch(/@/);
    }
    expect(logs[1]).toBe('Push submission failed: getaddrinfo ENOTFOUND exp.host');
  });

  it('16. registration makes no external call; sends only ever target the existing Expo endpoint', async () => {
    const db = new FakeDb();
    const svc = service(db, { 'user-A': { id: 'user-A', uiLanguage: 'es' } });
    await svc.registerToken('user-A', T, 'ios');
    expect(fetchMock).not.toHaveBeenCalled();
    await svc.sendToUser('user-A', 'club_new_book', {});
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual(['https://exp.host/--/api/v2/push/send']);
  });
});
