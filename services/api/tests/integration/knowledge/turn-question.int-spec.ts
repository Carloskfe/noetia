import { DataSource } from 'typeorm';
import { codePointSlice } from '../../../src/knowledge/retrieval/chunker';
import { turnIdempotencyKey } from '../../../src/knowledge/sessions/turn.service';
import { budgetPolicy, enableFlag, openDataSource, readyUser } from './support/it-env';
import { EN_TEXT, ES_TEXT } from './support/retrieval-env';
import { gate, ledgerEntries, researchBook, turnRows, TurnWiring, wireTurns } from './support/turn-env';

/** NEM-024 Checkpoint A on a disposable PostgreSQL 16 (simulated provider; fixture texts; in-process object store). */

const MIGRATION = 'CreateAiTurns1748300000076';
const lastMigration = async (ds: DataSource) => (await ds.query(`SELECT name FROM migrations ORDER BY timestamp DESC LIMIT 1`))[0].name;
async function revertNewerThan076(ds: DataSource) {
  for (let g = 0; g < 100; g++) {
    const [last] = await ds.query(`SELECT timestamp::bigint::text AS ts FROM migrations ORDER BY timestamp DESC LIMIT 1`);
    if (BigInt(last.ts) <= 1748300000076n) return;
    await ds.undoLastMigration({ transaction: 'each' });
  }
}
async function schemaOutside(ds: DataSource) {
  const columns = await ds.query(`SELECT table_name, column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name <> 'ai_turns' ORDER BY table_name, ordinal_position`);
  const constraints = await ds.query(`SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE connamespace = 'public'::regnamespace AND conrelid::regclass::text <> 'ai_turns' ORDER BY conname`);
  const indexes = await ds.query(`SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename <> 'ai_turns' ORDER BY indexname`);
  return JSON.stringify({ columns, constraints, indexes });
}
const reasonOf = async (p: Promise<unknown>) => p.then((r) => ({ ok: true as const, r: r as any }), (e) => ({ ok: false as const, e }));
const Q = '¿Qué papel tiene el faro? or lighthouse';

describe('NEM-024 Checkpoint A — question turn on real PostgreSQL', () => {
  let ds: DataSource;
  let t: TurnWiring;
  let es: { id: string };
  let en: { id: string };
  beforeAll(async () => {
    ds = await openDataSource();
    t = wireTurns(ds);
    await enableFlag(ds);
    await budgetPolicy(ds, 'noetia_plus', 'research_session', { allowanceUnits: 1_000_000_000, maxUnresolvedUnits: 1_000_000_000 });
    es = await researchBook(ds, t, ES_TEXT);
    en = await researchBook(ds, t, EN_TEXT, 'en');
  });
  afterAll(async () => ds?.destroy());
  afterEach(() => jest.restoreAllMocks());

  async function session(books = [es.id, en.id]) {
    const u = await readyUser(ds, t);
    const s = await t.sessions.create(u, books);
    return { u, s: s.id as string };
  }

  it('migration 076: additive; down/up by name; nothing else altered; constraints and the partial unique index exist', async () => {
    await revertNewerThan076(ds);
    expect(await lastMigration(ds)).toBe(MIGRATION);
    const before = await schemaOutside(ds);
    await ds.undoLastMigration({ transaction: 'each' });
    expect(await lastMigration(ds)).toBe('CreateAiBookChunks1748300000075');
    expect(await ds.query(`SELECT to_regclass('ai_turns') AS t`)).toEqual([{ t: null }]);
    expect(await schemaOutside(ds)).toBe(before);
    await ds.runMigrations({ transaction: 'each' });
    expect(await lastMigration(ds)).toBe(MIGRATION);
    expect(await schemaOutside(ds)).toBe(before);
    const idx = await ds.query(`SELECT indexdef FROM pg_indexes WHERE indexname = 'UQ_ai_turns_one_provisional'`);
    expect(idx[0].indexdef).toMatch(/UNIQUE INDEX .* \("sessionId"\) WHERE \(\(status\)::text = 'accepted'::text\)/);
    const [fk] = await ds.query(`SELECT confrelid::regclass::text AS t, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid = 'ai_turns'::regclass AND contype = 'f'`);
    expect(fk).toEqual({ t: 'ai_conversations', def: expect.stringMatching(/ON DELETE CASCADE/) });
    const cols = (await ds.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'ai_turns'`)).map((c: any) => c.column_name);
    expect(cols).not.toEqual(expect.arrayContaining(['excerpt']));
    expect(Number((await ds.query(`SELECT count(*) FROM ai_turns`))[0].count)).toBe(0);
  });

  it('happy path: retrieval in step 2 → reserve → lock + T0 → final check → provider → settle → T1; citations resolvable; no excerpt stored', async () => {
    const { u, s } = await session();
    const spy = jest.spyOn(t.sim, 'invoke');
    const r = await t.qturns.run(u, s, 'happy-key-0001', Q);
    expect(r).toMatchObject({ status: 'completed', settlement: 'settled' });
    expect(spy).toHaveBeenCalledTimes(1);
    const lib = r.citations!.flat().filter((c) => c.kind === 'chunk');
    expect(lib.length).toBeGreaterThan(0);
    for (const c of lib) {
      const [hash, range] = [c.anchor!.slice(0, 71), c.anchor!.slice(72)];
      const [a, b] = range.split('-').map(Number);
      expect(c.excerpt).toBe(codePointSlice(c.bookId === es.id ? ES_TEXT : EN_TEXT, a, b));
      expect(hash).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(c.sourceState).toBe('available');
    }
    const [row] = await turnRows(ds, s);
    expect(row).toMatchObject({ status: 'completed', turnIndex: 1, settlement: 'settled', failureReason: null });
    for (const c of lib) expect(JSON.stringify(row.segments)).not.toContain(c.excerpt!); // refs + anchors only (S2)
    const [conv] = await ds.query(`SELECT "turnCount", "lockedAt" FROM ai_conversations WHERE id = $1`, [s]);
    expect(conv.turnCount).toBe(1);
    expect(conv.lockedAt).not.toBeNull();
    expect(await ledgerEntries(ds, `${turnIdempotencyKey(u, s, 'happy-key-0001')}:a1`)).toEqual(['reservation', 'settlement']);
  });

  it('replay: the same key returns the recorded turn with no reservation and no provider call', async () => {
    const { u, s } = await session();
    await t.qturns.run(u, s, 'replay-key-0001', Q);
    const spy = jest.spyOn(t.sim, 'invoke');
    const r = await t.qturns.run(u, s, 'replay-key-0001', Q);
    expect(r).toMatchObject({ status: 'completed', replayed: true });
    expect(spy).not.toHaveBeenCalled();
    expect(await ledgerEntries(ds, `${turnIdempotencyKey(u, s, 'replay-key-0001')}:a1`)).toEqual(['reservation', 'settlement']);
    expect(await turnRows(ds, s)).toHaveLength(1);
  });

  it('idempotency under concurrency: 5 same-key requests → one reservation, one provider call, one record', async () => {
    const { u, s } = await session();
    const spy = jest.spyOn(t.sim, 'invoke');
    const results = await Promise.all(Array.from({ length: 5 }, () => reasonOf(t.qturns.run(u, s, 'conc-key-00001', Q))));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(await ledgerEntries(ds, `${turnIdempotencyKey(u, s, 'conc-key-00001')}:a1`)).toEqual(['reservation', 'settlement']);
    expect(await turnRows(ds, s)).toHaveLength(1);
    const ok = results.filter((x) => x.ok);
    expect(ok.length).toBeGreaterThanOrEqual(1);
    for (const x of results.filter((y) => !y.ok)) expect((x as any).e.reason).toBe('duplicate_turn');
  });

  it('one provisional turn per session: a different key during an in-flight turn fails at step 4 → released, terminal failed record, no provider call', async () => {
    const { u, s } = await session();
    const g = gate();
    const entered = gate();
    const real = t.gateway.invoke.bind(t.gateway);
    jest.spyOn(t.gateway, 'invoke').mockImplementationOnce(async (p, o) => { entered.open(); await g.p; return real(p, o); });
    const first = t.qturns.run(u, s, 'first-key-0001', Q);
    await entered.p; // the first turn holds its provisional record and is inside the provider call
    const second = await reasonOf(t.qturns.run(u, s, 'second-key-001', Q));
    expect(second.ok).toBe(false);
    expect((second as any).e.reason).toBe('duplicate_turn');
    expect((second as any).e.detail).toMatchObject({ status: 'failed', reservationRelease: 'released', recorded: true });
    expect(await ledgerEntries(ds, `${turnIdempotencyKey(u, s, 'second-key-001')}:a1`)).toEqual(['reservation', 'release']);
    g.open();
    expect(await first).toMatchObject({ status: 'completed' });
    const rows = await turnRows(ds, s);
    expect(rows.map((r: any) => [r.status, r.turnIndex])).toEqual(expect.arrayContaining([['completed', 1], ['failed', null]]));
    const [conv] = await ds.query(`SELECT "turnCount" FROM ai_conversations WHERE id = $1`, [s]);
    expect(conv.turnCount).toBe(1); // the failed record is not a research turn
    // Replay of the failed key returns the recorded denial, with no new reservation.
    const replay = await reasonOf(t.qturns.run(u, s, 'second-key-001', Q));
    expect((replay as any).e.detail).toMatchObject({ status: 'failed', reservationRelease: 'released' });
    expect(await ledgerEntries(ds, `${turnIdempotencyKey(u, s, 'second-key-001')}:a1`)).toEqual(['reservation', 'release']);
  });

  it('B-2 idempotency: concurrent failure-record writes for one key leave exactly one row', async () => {
    const { s } = await session();
    const ids = await Promise.all(Array.from({ length: 6 }, (_, i) => t.records.recordStep4Failure({ sessionId: s, keyHash: 'turn:b2-key', question: 'q', reason: 'set_changed', release: i % 2 ? 'released' : 'unconfirmed' })));
    expect(new Set(ids).size).toBe(1);
    const rows = await turnRows(ds, s);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: 'failed', turnIndex: null, failureReason: 'set_changed' });
  });

  it('B-2 release failure: reported unconfirmed; the ledger keeps the attempt held (no release claimed by E6)', async () => {
    const { u, s } = await session();
    const g = gate();
    const entered = gate();
    const real = t.gateway.invoke.bind(t.gateway);
    jest.spyOn(t.gateway, 'invoke').mockImplementationOnce(async (p, o) => { entered.open(); await g.p; return real(p, o); });
    const first = t.qturns.run(u, s, 'hold-first-001', Q);
    await entered.p;
    jest.spyOn(t.gateway, 'release').mockRejectedValueOnce(new Error('ledger unavailable'));
    const second = await reasonOf(t.qturns.run(u, s, 'hold-second-01', Q));
    expect((second as any).e.detail).toMatchObject({ reservationRelease: 'unconfirmed', recorded: true });
    expect(await ledgerEntries(ds, `${turnIdempotencyKey(u, s, 'hold-second-01')}:a1`)).toEqual(['reservation']); // held for reconciliation
    g.open();
    await first;
  });

  it('B-2 persistence failure of the failure record: denial with recorded:false; replay → 409 pending; no charge (released first)', async () => {
    const { u, s } = await session();
    const g = gate();
    const entered = gate();
    const real = t.gateway.invoke.bind(t.gateway);
    jest.spyOn(t.gateway, 'invoke').mockImplementationOnce(async (p, o) => { entered.open(); await g.p; return real(p, o); });
    const first = t.qturns.run(u, s, 'pf-first-0001', Q);
    await entered.p;
    jest.spyOn(t.records, 'recordStep4Failure').mockRejectedValueOnce(new Error('db write failed'));
    const second = await reasonOf(t.qturns.run(u, s, 'pf-second-001', Q));
    expect((second as any).e.detail).toEqual({ status: 'failed', reservationRelease: 'released', recorded: false });
    expect(await ledgerEntries(ds, `${turnIdempotencyKey(u, s, 'pf-second-001')}:a1`)).toEqual(['reservation', 'release']);
    g.open();
    await first;
    const replay = await reasonOf(t.qturns.run(u, s, 'pf-second-001', Q));
    expect([(replay as any).e.reason, (replay as any).e.detail]).toEqual(['duplicate_turn', { status: 'pending' }]);
  });

  it.each<[string, (bookId: string) => Promise<unknown>]>([
    ['user-level rights revoked', (b) => ds.query(`UPDATE book_ai_rights SET status = 'revoked' WHERE "bookId" = $1`, [b])],
    ['indexing permission withdrawn', (b) => ds.query(`UPDATE book_ai_rights SET "permittedOperations" = ARRAY['research_analysis'] WHERE "bookId" = $1`, [b])],
  ])('final eligibility check (%s after reservation): no provider call; reservation released; record failed; book_ineligible', async (_l, revoke) => {
    const b = await researchBook(ds, t, `${ES_TEXT}\n\nEdición ${Math.random()}.`);
    const { u, s } = await session([b.id]);
    const spy = jest.spyOn(t.sim, 'invoke');
    const realPrepare = t.gateway.prepare.bind(t.gateway);
    jest.spyOn(t.gateway, 'prepare').mockImplementationOnce(async (req) => { const p = await realPrepare(req); await revoke(b.id); return p; });
    const r = await reasonOf(t.qturns.run(u, s, 'final-key-0001', 'faro'));
    expect((r as any).e.reason).toBe('book_ineligible');
    expect((r as any).e.detail).toMatchObject({ status: 'failed', reservationRelease: 'released', exclusions: { ineligible: [b.id] } });
    expect(spy).not.toHaveBeenCalled();
    expect(await ledgerEntries(ds, `${turnIdempotencyKey(u, s, 'final-key-0001')}:a1`)).toEqual(['reservation', 'release']);
    const [row] = await turnRows(ds, s);
    expect(row).toMatchObject({ status: 'failed', failureReason: 'book_ineligible', reservationRelease: 'released', turnIndex: 1 });
  });

  it('settlement before completion: the ledger settles inside the Gateway before T1; a completion-write failure delivers unrecorded and keeps the charge', async () => {
    const { u, s } = await session();
    const key = `${turnIdempotencyKey(u, s, 'unrec-key-0001')}:a1`;
    jest.spyOn(t.records, 'complete').mockImplementation(async () => {
      expect(await ledgerEntries(ds, key)).toEqual(['reservation', 'settlement']); // settled before any completion attempt
      throw new Error('write failed');
    });
    const r = await t.qturns.run(u, s, 'unrec-key-0001', Q);
    expect(r).toMatchObject({ status: 'completed', unrecorded: true });
    expect(t.records.complete).toHaveBeenCalledTimes(2); // one bounded retry
    const [row] = await turnRows(ds, s);
    expect(row.status).toBe('accepted'); // provisional until the fence (finalization is Checkpoint B)
    const replay = await reasonOf(t.qturns.run(u, s, 'unrec-key-0001', Q));
    expect((replay as any).e.detail).toMatchObject({ status: 'accepted' });
  });

  it('lost transition: another terminal outcome committed first → no answer text; ledger settlement stands', async () => {
    const { u, s } = await session();
    const realComplete = t.records.complete.bind(t.records);
    jest.spyOn(t.records, 'complete').mockImplementationOnce(async (id, tok, p) => {
      await ds.query(`UPDATE ai_turns SET status = 'interrupted' WHERE id = $1`, [id]); // simulates a committed T4
      return realComplete(id, tok, p);
    });
    const r = await reasonOf(t.qturns.run(u, s, 'lost-key-00001', Q));
    expect(r.ok).toBe(false);
    expect((r as any).e.detail).toMatchObject({ status: 'interrupted' });
    expect(JSON.stringify((r as any).e.getResponse())).not.toMatch(/Simulated analysis/);
    expect(await ledgerEntries(ds, `${turnIdempotencyKey(u, s, 'lost-key-00001')}:a1`)).toEqual(['reservation', 'settlement']);
  });

  describe('fence semantics for owner transitions (F-7), with real lock waits', () => {
    async function provisional(fenceSql: string) {
      const { s } = await session();
      const [r] = await ds.query(
        `INSERT INTO ai_turns ("sessionId", "turnIndex", "keyHash", question, status, "attemptToken", "fenceAt")
         VALUES ($1, 1, 'turn:fence-' || gen_random_uuid(), 'q', 'accepted', gen_random_uuid(), ${fenceSql}) RETURNING id, "attemptToken", "fenceAt"`,
        [s],
      );
      return r as { id: string; attemptToken: string; fenceAt: Date };
    }
    const payload = { segments: [{ origin: 'synthesis', text: 'x', citations: [] }], exclusions: {}, settlement: 'settled' };

    it('LW-7: a transition that STARTS after the fence never succeeds, even with no competitor', async () => {
      const r = await provisional(`statement_timestamp() - interval '1 second'`);
      expect(await t.records.complete(r.id, r.attemptToken, payload)).toBe(false);
      expect(await t.records.fail(r.id, r.attemptToken, 'turn_failed')).toBe(false);
      expect((await ds.query(`SELECT status FROM ai_turns WHERE id = $1`, [r.id]))[0].status).toBe('accepted');
    });

    it('owner token required: another token cannot complete', async () => {
      const r = await provisional(`statement_timestamp() + interval '1 hour'`);
      expect(await t.records.complete(r.id, '00000000-0000-4000-8000-000000000000', payload)).toBe(false);
      expect(await t.records.complete(r.id, r.attemptToken, payload)).toBe(true);
      expect(await t.records.complete(r.id, r.attemptToken, payload)).toBe(false); // terminal: never changes
    });

    it('LW-1: a T1 that STARTED before the fence, blocked on a row lock past the fence, commits after it', async () => {
      const r = await provisional(`statement_timestamp() + interval '1500 milliseconds'`);
      const qr = ds.createQueryRunner();
      await qr.connect();
      await qr.startTransaction();
      await qr.query(`SELECT id FROM ai_turns WHERE id = $1 FOR UPDATE`, [r.id]); // hold the row lock
      const pending = t.records.complete(r.id, r.attemptToken, payload); // starts before the fence, then waits
      await new Promise((res) => setTimeout(res, 2200)); // now past the fence
      await qr.commitTransaction();
      await qr.release();
      expect(await pending).toBe(true);
      const [row] = await ds.query(`SELECT status, "completedAt" < "fenceAt" AS started_before, clock_timestamp() > "fenceAt" AS now_after FROM ai_turns WHERE id = $1`, [r.id]);
      expect(row).toEqual({ status: 'completed', started_before: true, now_after: true }); // statement start < fence < commit
    });

    it('LW-8: a terminal state committed first wins; the blocked pre-fence owner re-checks the status and affects 0 rows', async () => {
      const r = await provisional(`statement_timestamp() + interval '1 hour'`);
      const qr = ds.createQueryRunner();
      await qr.connect();
      await qr.startTransaction();
      await qr.query(`UPDATE ai_turns SET status = 'interrupted' WHERE id = $1`, [r.id]); // holds the lock, terminal pending commit
      const pending = t.records.complete(r.id, r.attemptToken, payload);
      await new Promise((res) => setTimeout(res, 300));
      await qr.commitTransaction();
      await qr.release();
      expect(await pending).toBe(false);
      expect((await ds.query(`SELECT status FROM ai_turns WHERE id = $1`, [r.id]))[0].status).toBe('interrupted');
    });
  });

  it('account deletion cascades the turn records; late owner transitions are no-ops', async () => {
    const { u, s } = await session();
    await t.qturns.run(u, s, 'del-key-000001', Q);
    const [row] = await ds.query(`SELECT id, "attemptToken" FROM ai_turns WHERE "sessionId" = $1`, [s]);
    await ds.query(`DELETE FROM users WHERE id = $1`, [u]);
    expect(await turnRows(ds, s)).toEqual([]);
    expect(await t.records.fail(row.id, row.attemptToken, 'turn_failed')).toBe(false);
  });

  it('protected tables untouched by question turns: fragments, sync_maps, user_books unchanged', async () => {
    const sums = async () => Promise.all(['fragments', 'sync_maps', 'user_books'].map(async (x) =>
      (await ds.query(`SELECT md5(coalesce(string_agg(t::text, '|' ORDER BY t::text), '')) AS m FROM ${x} t`))[0].m));
    const before = await sums();
    const { u, s } = await session();
    await t.qturns.run(u, s, 'prot-key-00001', Q);
    expect(await sums()).toEqual(before);
  });
});
