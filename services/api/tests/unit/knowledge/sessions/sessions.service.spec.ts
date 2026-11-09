import { bookSetHash, SessionsService } from '../../../../src/knowledge/sessions/sessions.service';
import { bookId, mockMetrics, USER_A, USER_B } from '../support/fixtures';
import { sessionStore } from '../support/session-store';

const CATALOGUE = Array.from({ length: 12 }, (_, i) => bookId(i + 1));

function setup(opts: { tier?: 'noetia_plus' | 'noetia_x'; allowed?: boolean; ineligible?: string[] } = {}) {
  const store = sessionStore(CATALOGUE);
  const tierState = { tier: opts.tier ?? 'noetia_plus', allowed: opts.allowed ?? true };
  const entitlements = {
    resolve: jest.fn(async () =>
      tierState.allowed
        ? { allowed: true, tier: tierState.tier, capability: 'research_session', policy: { id: 'p', version: 1 }, limits: { maxBooks: tierState.tier === 'noetia_x' ? 10 : 3 } }
        : { allowed: false, reason: 'prerequisite_missing' }),
  };
  const ineligible = new Set(opts.ineligible ?? []);
  const rights = { eligibility: jest.fn(async (_u: string, b: string) => (ineligible.has(b) ? { eligible: false, reason: 'no_rights_record' } : { eligible: true, basis: 'public_domain' })) };
  const metrics = mockMetrics();
  const svc = new SessionsService(store.db as any, entitlements as any, rights as any, metrics);
  return { svc, store, tierState, ineligible, metrics, rights };
}

const reason = async (p: Promise<unknown>) => p.then(() => 'allowed', (e) => e.reason ?? e.message);

describe('SessionsService (ADR-006; PO-027)', () => {
  it('creates a session with books and snapshots; view exposes no tier name', async () => {
    const { svc } = setup();
    const v = await svc.create(USER_A, [bookId(1), bookId(2)]);
    expect(v.books.map((b) => b.position)).toEqual([1, 2]);
    expect(v).toMatchObject({ status: 'active', locked: false, forkOffer: null, inheritsParentContext: false });
    expect(JSON.stringify(v)).not.toMatch(/noetia_plus|noetia_x/);
  });

  it('denies creation without entitlement (prerequisite_missing)', async () => {
    expect(await reason(setup({ allowed: false }).svc.create(USER_A, []))).toBe('prerequisite_missing');
  });

  it('Noetia+ rejects a fourth book at creation and on add (metric by tier)', async () => {
    const { svc, metrics } = setup();
    expect(await reason(svc.create(USER_A, CATALOGUE.slice(0, 4)))).toBe('limit_reached');
    const s = await svc.create(USER_A, CATALOGUE.slice(0, 3));
    expect(await reason(svc.addBook(USER_A, s.id, bookId(4)))).toBe('limit_reached');
    expect(metrics.limitRejectedInc).toHaveBeenCalledWith('noetia_plus');
  });

  it('NoetiaX allows ten and rejects the eleventh', async () => {
    const { svc } = setup({ tier: 'noetia_x' });
    const s = await svc.create(USER_A, CATALOGUE.slice(0, 10));
    expect(s.books).toHaveLength(10);
    expect(await reason(svc.addBook(USER_A, s.id, bookId(11)))).toBe('limit_reached');
  });

  it('rejects duplicate ids in a request and an already-selected book', async () => {
    const { svc } = setup();
    expect(await reason(svc.create(USER_A, [bookId(1), bookId(1)]))).toBe('duplicate_book');
    const s = await svc.create(USER_A, [bookId(1)]);
    expect(await reason(svc.addBook(USER_A, s.id, bookId(1)))).toBe('duplicate_book');
  });

  it('rejects a non-array selection and unknown or ineligible books', async () => {
    const { svc } = setup({ ineligible: [bookId(2)] });
    expect(await reason(svc.create(USER_A, 'x' as any))).toBe('invalid_request');
    expect(await reason(svc.create(USER_A, [bookId(99)]))).toBe('book_ineligible');
    expect(await reason(svc.create(USER_A, [bookId(2)]))).toBe('book_ineligible');
  });

  it('adds into the smallest free position after a removal', async () => {
    const { svc } = setup();
    const s = await svc.create(USER_A, [bookId(1), bookId(2), bookId(3)]);
    await svc.removeBook(USER_A, s.id, bookId(2));
    const v = await svc.addBook(USER_A, s.id, bookId(4));
    expect(v.books.find((b) => b.bookId === bookId(4))!.position).toBe(2);
  });

  it('removing a book that is not selected → not_found', async () => {
    const { svc } = setup();
    const s = await svc.create(USER_A, [bookId(1)]);
    expect(await reason(svc.removeBook(USER_A, s.id, bookId(5)))).toBe('not_found');
  });

  it('a locked session cannot change (add or remove)', async () => {
    const { svc, store } = setup();
    const s = await svc.create(USER_A, [bookId(1)]);
    store.sessions[0].lockedAt = new Date();
    expect(await reason(svc.addBook(USER_A, s.id, bookId(2)))).toBe('session_locked');
    expect(await reason(svc.removeBook(USER_A, s.id, bookId(1)))).toBe('session_locked');
  });

  it('a read-only session cannot change', async () => {
    const { svc, store } = setup();
    const s = await svc.create(USER_A, [bookId(1)]);
    store.sessions[0].status = 'read_only';
    expect(await reason(svc.addBook(USER_A, s.id, bookId(2)))).toBe('session_read_only');
  });

  it("another user's session is not found (get, add, fork)", async () => {
    const { svc } = setup();
    const s = await svc.create(USER_A, [bookId(1)]);
    expect(await reason(svc.get(USER_B, s.id))).toBe('not_found');
    expect(await reason(svc.addBook(USER_B, s.id, bookId(2)))).toBe('not_found');
    expect(await reason(svc.fork(USER_B, s.id, [bookId(1)]))).toBe('not_found');
  });

  it('AC-6: NoetiaX → Noetia+ with more than 3 books → read_only + fork offer, history kept', async () => {
    const { svc, tierState } = setup({ tier: 'noetia_x' });
    const s = await svc.create(USER_A, CATALOGUE.slice(0, 5));
    tierState.tier = 'noetia_plus';
    const v = await svc.get(USER_A, s.id);
    expect(v).toMatchObject({ status: 'read_only', forkOffer: { maxBooks: 3 } });
    expect(v.books).toHaveLength(5);
  });

  it('history stays readable when entitlement ends (no fork offer, no change)', async () => {
    const { svc, tierState } = setup();
    const s = await svc.create(USER_A, [bookId(1)]);
    tierState.allowed = false;
    expect(await svc.get(USER_A, s.id)).toMatchObject({ status: 'active', forkOffer: null, books: [expect.any(Object)] });
  });

  describe('fork (AC-7)', () => {
    it('carries generated context when the parent set is a subset and still eligible', async () => {
      const { svc } = setup();
      const p = await svc.create(USER_A, [bookId(1), bookId(2)]);
      const f = await svc.fork(USER_A, p.id, [bookId(1), bookId(2), bookId(3)]);
      expect(f).toMatchObject({ parentId: p.id, inheritsParentContext: true });
    });

    it('a fork from a larger set carries no generated context', async () => {
      const { svc } = setup({ tier: 'noetia_x' });
      const p = await svc.create(USER_A, CATALOGUE.slice(0, 5));
      const f = await svc.fork(USER_A, p.id, CATALOGUE.slice(0, 3));
      expect(f.inheritsParentContext).toBe(false);
    });

    it('no carry when a parent book has become ineligible', async () => {
      const { svc, ineligible } = setup();
      const p = await svc.create(USER_A, [bookId(1), bookId(2)]);
      ineligible.add(bookId(2));
      const f = await svc.fork(USER_A, p.id, [bookId(1), bookId(3)]);
      expect(f.inheritsParentContext).toBe(false);
      expect(await reason(svc.fork(USER_A, p.id, [bookId(1), bookId(2)]))).toBe('book_ineligible');
    });

    it('no carry when a parent book was deleted (null book id)', async () => {
      const { svc, store } = setup();
      const p = await svc.create(USER_A, [bookId(1)]);
      store.books[0].bookId = null;
      expect((await svc.fork(USER_A, p.id, [bookId(1)])).inheritsParentContext).toBe(false);
    });

    it('the fork respects the current tier limit; the parent is unchanged', async () => {
      const { svc, store } = setup();
      const p = await svc.create(USER_A, [bookId(1)]);
      expect(await reason(svc.fork(USER_A, p.id, CATALOGUE.slice(0, 4)))).toBe('limit_reached');
      expect(store.books.filter((b) => b.sessionId === p.id)).toHaveLength(1);
    });
  });

  it('markOverLimit can run inside a caller transaction', async () => {
    const { svc, store } = setup();
    const s = await svc.create(USER_A, [bookId(1)]);
    const row = await svc.markOverLimit(s.id, { query: store.db.query } as any);
    expect(row.status).toBe('read_only');
  });

  it('bookSetHash is order-independent and based on row identity', () => {
    const a = [{ id: 'r1', position: 1 }, { id: 'r2', position: 2 }];
    expect(bookSetHash(a)).toBe(bookSetHash([...a].reverse()));
    expect(bookSetHash(a)).not.toBe(bookSetHash([{ id: 'r1', position: 1 }, { id: 'r3', position: 2 }]));
  });
});
