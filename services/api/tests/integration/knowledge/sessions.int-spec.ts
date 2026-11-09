import { DataSource } from 'typeorm';
import { Book } from '../../../src/books/book.entity';
import {
  budgetPolicy, createBook, createUser, denial, eligibleBook, enableFlag, grant, insertRights, IT_HASH, openDataSource, readyUser, wire,
} from './support/it-env';

describe('NEM-019 sessions on real PostgreSQL', () => {
  let ds: DataSource;
  let w: ReturnType<typeof wire>;
  const books = (n: number) => Promise.all(Array.from({ length: n }, () => eligibleBook(ds, w)));

  beforeAll(async () => {
    ds = await openDataSource();
    w = wire(ds);
    await enableFlag(ds);
    await budgetPolicy(ds, 'noetia_plus', 'research_session');
    await budgetPolicy(ds, 'noetia_x', 'research_session');
  });
  afterAll(async () => ds?.destroy());

  describe('limits (AC-3, AC-11a)', () => {
    it('Noetia+ holds 3; a fourth verified public-domain book NOT in the library is rejected (it counts)', async () => {
      const u = await readyUser(ds, w);
      const [a, b, c, d] = await books(4);
      const s = await w.sessions.create(u, [a, b, c]);
      expect(s.books).toHaveLength(3);
      expect(await ds.query(`SELECT count(*) FROM user_books WHERE "userId" = $1`, [u])).toEqual([{ count: '0' }]);
      expect(await denial(w.sessions.addBook(u, s.id, d))).toBe('limit_reached');
      expect(await denial(w.sessions.create(u, [a, b, c, d]))).toBe('limit_reached');
    });

    it('NoetiaX holds 10 and rejects the eleventh', async () => {
      const u = await readyUser(ds, w, 'noetia_x');
      const bs = await books(11);
      const s = await w.sessions.create(u, bs.slice(0, 10));
      expect(s.books).toHaveLength(10);
      expect(await denial(w.sessions.addBook(u, s.id, bs[10]))).toBe('limit_reached');
    });

    it('duplicate ids are rejected', async () => {
      const u = await readyUser(ds, w);
      const [a] = await books(1);
      expect(await denial(w.sessions.create(u, [a, a]))).toBe('duplicate_book');
    });
  });

  describe('rights and eligibility (AC-11, AC-11a, AC-11b)', () => {
    it('isFree = true with no record is denied', async () => {
      const u = await readyUser(ds, w);
      const b = await createBook(ds, { isFree: true });
      w.fx.textHash.set(b, IT_HASH);
      expect(await denial(w.sessions.create(u, [b]))).toBe('book_ineligible');
    });

    it.each([
      ['partial', { jurisdiction: null }],
      ['revoked', { status: 'revoked' }],
      ['pending', { status: 'pending_review' }],
    ])('%s record is denied', async (_l, over) => {
      const u = await readyUser(ds, w);
      const b = await createBook(ds);
      await insertRights(ds, b, over);
      w.fx.textHash.set(b, IT_HASH);
      expect(await denial(w.sessions.create(u, [b]))).toBe('book_ineligible');
    });

    it('stale textHash is denied', async () => {
      const u = await readyUser(ds, w);
      const b = await createBook(ds);
      await insertRights(ds, b);
      w.fx.textHash.set(b, 'sha256:it-fixture-text-CHANGED');
      expect(await denial(w.sessions.create(u, [b]))).toBe('book_ineligible');
    });

    it('an owned book with no rights record is denied', async () => {
      const u = await readyUser(ds, w);
      const b = await createBook(ds);
      await ds.query(`INSERT INTO user_books ("userId", "bookId", "purchaseType") VALUES ($1, $2, 'token')`, [u, b]);
      w.fx.ownership.set(`${u}:${b}`, 'entitled');
      w.fx.textHash.set(b, IT_HASH);
      expect(await denial(w.sessions.create(u, [b]))).toBe('book_ineligible');
    });

    it('an unverified public-domain fixture cannot be selected', async () => {
      const u = await readyUser(ds, w);
      const b = await createBook(ds);
      await insertRights(ds, b, { status: 'unknown' });
      w.fx.textHash.set(b, IT_HASH);
      expect(await denial(w.sessions.create(u, [b]))).toBe('book_ineligible');
    });

    it('verified licensed: denied without entitlement, allowed with it (B-4)', async () => {
      const u = await readyUser(ds, w);
      const b = await createBook(ds);
      await insertRights(ds, b, { rightsBasis: 'licensed', authorDeathDate: null });
      w.fx.textHash.set(b, IT_HASH);
      expect(await denial(w.sessions.create(u, [b]))).toBe('book_ineligible'); // unknown
      w.fx.ownership.set(`${u}:${b}`, 'not_entitled');
      expect(await denial(w.sessions.create(u, [b]))).toBe('book_ineligible');
      w.fx.ownership.set(`${u}:${b}`, 'entitled');
      expect((await w.sessions.create(u, [b])).books).toHaveLength(1);
    });
  });

  describe('concurrency (AC-4, AC-5)', () => {
    it('N parallel adds at the limit never exceed it', async () => {
      const u = await readyUser(ds, w);
      const s = await w.sessions.create(u, []);
      const bs = await books(8);
      const results = await Promise.all(bs.map((b) => denial(w.sessions.addBook(u, s.id, b))));
      expect(results.filter((r) => r === 'allowed')).toHaveLength(3);
      expect(results.filter((r) => r !== 'allowed').every((r) => r === 'limit_reached')).toBe(true);
      expect(await ds.query(`SELECT count(*) FROM ai_session_books WHERE "sessionId" = $1`, [s.id])).toEqual([{ count: '3' }]);
    });

    it('parallel first turns yield one lock and one set', async () => {
      const u = await readyUser(ds, w);
      const [a, b] = await books(2);
      const s = await w.sessions.create(u, [a, b]);
      const results = await Promise.all(Array.from({ length: 5 }, (_, i) => denial(w.turns.run(u, s.id, `parallel-first-${i}`))));
      expect(results.every((r) => r === 'allowed')).toBe(true);
      const [row] = await ds.query(`SELECT "lockedAt", "bookSetHash", "turnCount" FROM ai_conversations WHERE id = $1`, [s.id]);
      expect(row.lockedAt).not.toBeNull();
      expect(row.turnCount).toBe(5);
      expect(row.bookSetHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('add racing the first turn never yields a set that differs from the lock', async () => {
      for (let round = 0; round < 5; round++) {
        const u = await readyUser(ds, w);
        const [a, b] = await books(2);
        const s = await w.sessions.create(u, [a]);
        const [turn, add] = await Promise.all([denial(w.turns.run(u, s.id, `race-${round}`)), denial(w.sessions.addBook(u, s.id, b))]);
        const [row] = await ds.query(`SELECT "lockedAt", "bookSetHash" FROM ai_conversations WHERE id = $1`, [s.id]);
        const rows = await w.sessions.books(w.db, s.id);
        const { bookSetHash } = await import('../../../src/knowledge/sessions/sessions.service');
        if (row.lockedAt) expect(row.bookSetHash).toBe(bookSetHash(rows)); // the locked hash always matches the stored set
        // Either the add won (turn saw set_changed or ran after) or the turn locked first (add rejected).
        expect(['allowed', 'set_changed']).toContain(turn);
        expect(['allowed', 'session_locked']).toContain(add);
        expect(turn === 'allowed' && add === 'allowed' ? rows.length === 2 && row.lockedAt : true).toBeTruthy();
      }
    });

    it('books cannot change after the first turn; a fork is required (AC-5)', async () => {
      const u = await readyUser(ds, w);
      const [a, b] = await books(2);
      const s = await w.sessions.create(u, [a]);
      await w.turns.run(u, s.id, 'lock-me-0001');
      expect(await denial(w.sessions.addBook(u, s.id, b))).toBe('session_locked');
      expect(await denial(w.sessions.removeBook(u, s.id, a))).toBe('session_locked');
      const f = await w.sessions.fork(u, s.id, [a, b]);
      expect(f).toMatchObject({ parentId: s.id, locked: false, inheritsParentContext: true });
    });

    it('parallel forks each create an independent session; the parent is unchanged', async () => {
      const u = await readyUser(ds, w);
      const [a, b, c] = await books(3);
      const s = await w.sessions.create(u, [a]);
      await w.turns.run(u, s.id, 'lock-parent-1');
      const forks = await Promise.all([w.sessions.fork(u, s.id, [a, b]), w.sessions.fork(u, s.id, [a, c]), w.sessions.fork(u, s.id, [b])]);
      expect(new Set(forks.map((f) => f.id)).size).toBe(3);
      expect(forks.map((f) => f.inheritsParentContext)).toEqual([true, true, false]);
      expect((await w.sessions.get(u, s.id)).books).toHaveLength(1);
    });
  });

  describe('downgrade, upgrade, fork context (AC-6, AC-7)', () => {
    it('NoetiaX → Noetia+ with more than 3 books: read_only, fork offer, history preserved', async () => {
      const u = await readyUser(ds, w, 'noetia_x');
      const bs = await books(5);
      const s = await w.sessions.create(u, bs);
      await w.turns.run(u, s.id, 'before-downgrade');
      await grant(ds, u, 'noetia_plus');
      expect(await denial(w.turns.run(u, s.id, 'after-downgrade'))).toBe('session_read_only');
      const v = await w.sessions.get(u, s.id);
      expect(v).toMatchObject({ status: 'read_only', forkOffer: { maxBooks: 3 }, turnCount: 1 });
      expect(v.books).toHaveLength(5);
      const f = await w.sessions.fork(u, s.id, bs.slice(0, 3));
      expect(f.inheritsParentContext).toBe(false); // AC-7: larger parent set → no generated context
      expect(await denial(w.sessions.fork(u, s.id, bs.slice(0, 4)))).toBe('limit_reached');
    });

    it('downgrade during an active turn: the turn completes and settles; the next is read_only', async () => {
      const u = await readyUser(ds, w, 'noetia_x');
      const bs = await books(4);
      const s = await w.sessions.create(u, bs);
      w.sim.beforeRespond = async () => grant(ds, u, 'noetia_plus');
      const r = await w.turns.run(u, s.id, 'active-during-downgrade');
      w.sim.beforeRespond = undefined;
      expect(r.settlement).toBe('settled');
      expect(await denial(w.turns.run(u, s.id, 'next-after-downgrade'))).toBe('session_read_only');
    });

    it('upgrade with a locked set: the set stays locked; fork to add books', async () => {
      const u = await readyUser(ds, w);
      const bs = await books(4);
      const s = await w.sessions.create(u, bs.slice(0, 3));
      await w.turns.run(u, s.id, 'pre-upgrade-01');
      await grant(ds, u, 'noetia_x');
      expect(await denial(w.sessions.addBook(u, s.id, bs[3]))).toBe('session_locked');
      expect((await w.sessions.fork(u, s.id, bs)).books).toHaveLength(4);
    });
  });

  describe('isolation (AC-15b; PO-026 rule 6)', () => {
    it("another user and a household member cannot read, change, fork, or run another member's session", async () => {
      const owner = await readyUser(ds, w);
      const member = await readyUser(ds, w); // same household in product terms; data is keyed by individual userId
      const [a, b] = await books(2);
      const s = await w.sessions.create(owner, [a]);
      expect(await denial(w.sessions.get(member, s.id))).toBe('not_found');
      expect(await denial(w.sessions.addBook(member, s.id, b))).toBe('not_found');
      expect(await denial(w.sessions.fork(member, s.id, [a]))).toBe('not_found');
      expect(await denial(w.turns.run(member, s.id, 'member-attempt'))).toBe('not_found');
      expect(await ds.query(`SELECT count(*) FROM ai_session_books WHERE "sessionId" = $1`, [s.id])).toEqual([{ count: '1' }]);
    });

    it('a free user (not qualifying) is denied even with a grant (AC-9)', async () => {
      const u = await createUser(ds);
      w.fx.plan.set(u, 'not_qualifying');
      await grant(ds, u, 'noetia_x');
      expect(await denial(w.sessions.create(u, []))).toBe('prerequisite_missing');
    });
  });

  it('AC-8: deleting a book through the existing repository path succeeds; history stays readable', async () => {
    const u = await readyUser(ds, w);
    const [a, b] = await books(2);
    const s = await w.sessions.create(u, [a, b]);
    await w.turns.run(u, s.id, 'before-book-delete');
    const repo = ds.getRepository(Book);
    const book = await repo.findOneByOrFail({ id: a });
    const title = book.title;
    await repo.remove(book); // same call as BooksService.remove
    const v = await w.sessions.get(u, s.id);
    expect(v.books).toHaveLength(2);
    expect(v.books[0]).toMatchObject({ bookId: null, title });
    expect(v.locked).toBe(true);
    // The deleted book simply no longer participates; the remaining book still runs.
    expect((await w.turns.run(u, s.id, 'after-book-delete')).segments.length).toBeGreaterThan(0);
  });
});
