import { DataSource } from 'typeorm';
import { codePointSlice } from '../../../src/knowledge/retrieval/chunker';
import { computeTextHash } from '../../../src/knowledge/rights/text-hash';
import { turnIdempotencyKey } from '../../../src/knowledge/sessions/turn.service';
import { budgetPolicy, createUser, enableFlag, insertRights, openDataSource, readyUser } from './support/it-env';
import { BOTH_OPS, EN_TEXT, ES_TEXT } from './support/retrieval-env';
import { gate, ledgerCount, ledgerEntries, researchBook, TurnWiring, wireTurns } from './support/turn-env';

/**
 * NEM-024 Checkpoint B on a disposable PostgreSQL 16 — release-blocking recovery evidence (PO-036 §3), the applicable
 * R1–R12 / LW-2..LW-6 / LW-10 races, the cancellation matrix against the real ledger, D-10 redaction, authorization,
 * and the weighted guard. No mocked database; simulated provider; fixture texts.
 */
const Q = '¿Qué papel tiene el faro? or lighthouse';
const caught = async (p: Promise<unknown>) => p.then((r) => ({ ok: true as const, r: r as any }), (e) => ({ ok: false as const, e }));
const status = async (ds: DataSource, id: string) => (await ds.query(`SELECT status FROM ai_turns WHERE id = $1`, [id]))[0]?.status;
const expireFence = (ds: DataSource, id: string) => ds.query(`UPDATE ai_turns SET "fenceAt" = statement_timestamp() - interval '1 second' WHERE id = $1`, [id]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const payload = { segments: [{ origin: 'synthesis', text: 'x', citations: [] }], exclusions: {}, settlement: 'settled' };

describe('NEM-024 Checkpoint B — recovery, cancellation, history (real PostgreSQL)', () => {
  let ds: DataSource;
  let t: TurnWiring;
  let es: { id: string; key: string; hash: string };
  let en: { id: string; key: string; hash: string };
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

  async function session(tw: TurnWiring = t, books = [es.id, en.id]) {
    const u = await readyUser(ds, tw);
    return { u, s: (await tw.sessions.create(u, books)).id as string };
  }
  async function provisional(fenceSql: string) {
    const { s } = await session();
    const [r] = await ds.query(
      `INSERT INTO ai_turns ("sessionId", "turnIndex", "keyHash", question, status, "attemptToken", "fenceAt")
       VALUES ($1, 1, 'turn:p-' || gen_random_uuid(), 'q', 'accepted', gen_random_uuid(), ${fenceSql}) RETURNING id, "attemptToken"`, [s]);
    return { ...(r as { id: string; attemptToken: string }), s };
  }
  /** A real turn stranded in `accepted` because both completion writes failed (D-8 a). */
  async function stranded(key: string) {
    const { u, s } = await session();
    jest.spyOn(t.records, 'complete').mockRejectedValue(new Error('write failed'));
    const r = await t.qturns.run(u, s, key, Q);
    jest.restoreAllMocks();
    expect(r.unrecorded).toBe(true);
    const [row] = await ds.query(`SELECT id, status FROM ai_turns WHERE "sessionId" = $1`, [s]);
    expect(row.status).toBe('accepted');
    return { u, s, id: row.id as string, attemptKey: `${turnIdempotencyKey(u, s, key)}:a1` };
  }

  describe('release condition A–D: stranded turns reach a terminal state', () => {
    it('A + C (scheduled): after the fence, the periodic sweep finalizes a stranded turn as interrupted with no ledger change; no owner process needed', async () => {
      const x = await stranded('strand-key-0001');
      await t.recovery.tick(); // before its fence this row is not eligible (other expired rows may be swept)
      expect(await status(ds, x.id)).toBe('accepted');
      await expireFence(ds, x.id);
      const before = await ledgerCount(ds);
      expect(await t.recovery.tick()).toBeGreaterThanOrEqual(1);
      expect(await status(ds, x.id)).toBe('interrupted');
      expect(await ledgerCount(ds)).toBe(before); // D: recovery never touches the ledger
      expect(await ledgerEntries(ds, x.attemptKey)).toEqual(['reservation', 'settlement']); // the D-8 charge stands
      const replay = await caught(t.qturns.run(x.u, x.s, 'strand-key-0001', Q));
      expect((replay as any).e.detail).toEqual({ turnId: x.id, status: 'interrupted' });
    });

    it.each<[string, (x: Awaited<ReturnType<typeof stranded>>) => Promise<unknown>]>([
      ['replay', (x) => caught(t.qturns.run(x.u, x.s, 'lazy-replay-01', Q))],
      ['history', (x) => t.qturns.history(x.u, x.s)],
      ['single turn', (x) => t.qturns.turnView(x.u, x.s, x.id)],
      ['cancel', (x) => t.qturns.cancel(x.u, x.s, 'lazy-cancel-01')],
    ])('C (lazy): %s finalizes an expired stranded turn without the sweep, and never returns accepted', async (route, act) => {
      const key = route === 'replay' ? 'lazy-replay-01' : route === 'cancel' ? 'lazy-cancel-01' : `lazy-${route.replace(' ', '')}-1`;
      const x = await stranded(key);
      await expireFence(ds, x.id);
      const before = await ledgerCount(ds);
      const out: any = await act(x);
      expect(await status(ds, x.id)).toBe('interrupted');
      const reported = route === 'replay' ? out.e.detail.status : route === 'history' ? out[0].status : out.status;
      expect(reported).toBe('interrupted');
      expect(await ledgerCount(ds)).toBe(before);
    });

    it('B / R2: the owner loses to finalization — fence passed and the sweep committed while the provider call ran → T1 0 rows → interrupted, no answer text; settlement stands', async () => {
      const { u, s } = await session();
      const g = gate();
      const entered = gate();
      const real = t.gateway.invoke.bind(t.gateway);
      jest.spyOn(t.gateway, 'invoke').mockImplementationOnce(async (p, o) => { entered.open(); await g.p; return real(p, o); });
      const run = caught(t.qturns.run(u, s, 'r2-owner-key-1', Q));
      await entered.p;
      const [row] = await ds.query(`SELECT id FROM ai_turns WHERE "sessionId" = $1`, [s]);
      await expireFence(ds, row.id);
      expect(await t.recovery.tick()).toBeGreaterThanOrEqual(1);
      g.open();
      const r = await run;
      expect(r.ok).toBe(false);
      expect((r as any).e.detail).toEqual({ turnId: row.id, status: 'interrupted' });
      expect(JSON.stringify((r as any).e.getResponse())).not.toMatch(/Simulated analysis/);
      expect(await status(ds, row.id)).toBe('interrupted');
      expect(await ledgerEntries(ds, `${turnIdempotencyKey(u, s, 'r2-owner-key-1')}:a1`)).toEqual(['reservation', 'settlement']);
    });
  });

  describe('R-series races (real PostgreSQL)', () => {
    it('R1: completion before the fence, then the sweep → completed; sweep affects 0 rows', async () => {
      const r = await provisional(`statement_timestamp() + interval '1 hour'`);
      expect(await t.records.complete(r.id, r.attemptToken, payload)).toBe(true);
      expect(await t.records.finalize([r.id])).toBe(0);
      expect(await status(ds, r.id)).toBe('completed');
    });

    it.each([0, 1])('R3: fence passed — completion and finalization in parallel (order %i) → always interrupted', async (order) => {
      const r = await provisional(`statement_timestamp() - interval '1 second'`);
      const ops = [() => t.records.complete(r.id, r.attemptToken, payload), () => t.records.finalize([r.id])];
      const [a, b] = await Promise.all(order ? [ops[1](), ops[0]()] : [ops[0](), ops[1]()]);
      const completed = order ? b : a;
      expect(completed).toBe(false);
      expect(await status(ds, r.id)).toBe('interrupted');
    });

    it.each([0, 1])('R4: fence in the future — completion and finalization in parallel (order %i) → always completed', async (order) => {
      const r = await provisional(`statement_timestamp() + interval '1 hour'`);
      const ops = [() => t.records.complete(r.id, r.attemptToken, payload), () => t.records.finalize([r.id])];
      const res = await Promise.all(order ? [ops[1](), ops[0]()] : [ops[0](), ops[1]()]);
      expect(res).toContain(true);
      expect(await status(ds, r.id)).toBe('completed');
    });

    it.each([0, 1])('R5: cancel vs completion under a held row lock (issue order %i) → exactly one terminal winner', async (order) => {
      const r = await provisional(`statement_timestamp() + interval '1 hour'`);
      const qr = ds.createQueryRunner();
      await qr.connect();
      await qr.startTransaction();
      await qr.query(`SELECT id FROM ai_turns WHERE id = $1 FOR UPDATE`, [r.id]);
      const first = order ? t.records.cancel(r.id) : t.records.complete(r.id, r.attemptToken, payload);
      await sleep(50);
      const second = order ? t.records.complete(r.id, r.attemptToken, payload) : t.records.cancel(r.id);
      await sleep(50);
      await qr.commitTransaction();
      await qr.release();
      const results = await Promise.all([first, second]);
      expect(results.filter(Boolean)).toHaveLength(1);
      expect(['cancelled', 'completed']).toContain(await status(ds, r.id));
    });

    it('R6: cancel after the fence → lazy finalization → interrupted (cancel response reports it)', async () => {
      const x = await stranded('r6-cancel-0001');
      await expireFence(ds, x.id);
      expect(await t.qturns.cancel(x.u, x.s, 'r6-cancel-0001')).toEqual({ turnId: x.id, status: 'interrupted' });
    });

    it('R7: observed statuses are monotonic — accepted (provisional) → interrupted → interrupted, even after a completion attempt', async () => {
      const x = await stranded('r7-mono-key-01');
      const seen: string[] = [];
      const read = async () => {
        const r = await caught(t.qturns.run(x.u, x.s, 'r7-mono-key-01', Q));
        seen.push((r as any).e.detail.status);
      };
      await read();
      await expireFence(ds, x.id);
      await read();
      const [row] = await ds.query(`SELECT "attemptToken" FROM ai_turns WHERE id = $1`, [x.id]);
      expect(await t.records.complete(x.id, row.attemptToken, payload)).toBe(false);
      await read();
      expect(seen).toEqual(['accepted', 'interrupted', 'interrupted']);
    });

    it('R9: crash (no owner) — reads before the fence report accepted, after it interrupted via lazy finalization (no sweep)', async () => {
      const r = await provisional(`statement_timestamp() + interval '1500 milliseconds'`);
      const [{ userId }] = await ds.query(`SELECT "userId" FROM ai_conversations WHERE id = $1`, [r.s]);
      expect((await t.qturns.turnView(userId, r.s, r.id)).status).toBe('accepted');
      await sleep(1700);
      expect((await t.qturns.turnView(userId, r.s, r.id)).status).toBe('interrupted');
    });

    it('R12: monotonicity property — 200 seeded interleavings of T1/T2/T3/T4/read never change an observed terminal state; at most one terminal transition per row', async () => {
      let seed = 0x2e0cb54;
      const rnd = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
      for (let i = 0; i < 200; i++) {
        const past = rnd() < 0.5;
        const r = await provisional(past ? `statement_timestamp() - interval '1 second'` : `statement_timestamp() + interval '1 hour'`);
        const ops = [
          () => t.records.complete(r.id, r.attemptToken, payload),
          () => t.records.fail(r.id, r.attemptToken, 'turn_failed'),
          () => t.records.cancel(r.id),
          () => t.records.finalize([r.id]).then((n) => n === 1),
        ].sort(() => rnd() - 0.5).slice(0, 1 + Math.floor(rnd() * 4));
        const observed: string[] = [];
        const results = await Promise.all(ops.map(async (op) => { const ok = await op(); observed.push(await status(ds, r.id)); return ok; }));
        const winners = results.filter(Boolean).length;
        expect({ i, winners: winners <= 1 }).toEqual({ i, winners: true });
        const final = await status(ds, r.id);
        const firstTerminal = observed.find((x) => x !== 'accepted');
        if (firstTerminal) expect({ i, final }).toEqual({ i, final: firstTerminal });
        if (past) expect({ i, final }).toEqual({ i, final: ops.length && winners ? 'interrupted' : final });
        else expect({ i, interrupted: final === 'interrupted' }).toEqual({ i, interrupted: false });
      }
    }, 120_000);
  });

  describe('LW-series lock waits (real PostgreSQL)', () => {
    it('LW-2: a pre-fence T1 holds the row across the fence; T4 started after the fence blocks, then affects 0 rows; reader returns completed', async () => {
      const r = await provisional(`statement_timestamp() + interval '1 second'`);
      const qr = ds.createQueryRunner();
      await qr.connect();
      await qr.startTransaction();
      const [u] = await qr.query(`WITH u AS (UPDATE ai_turns SET status = 'completed', segments = '[]'::jsonb, settlement = 'settled', "completedAt" = statement_timestamp()
         WHERE id = $1 AND status = 'accepted' AND statement_timestamp() < "fenceAt" RETURNING id) SELECT count(*)::int AS n FROM u`, [r.id]);
      expect(u.n).toBe(1); // started before the fence, not yet committed
      await sleep(1300); // past the fence
      const t4 = t.records.finalize([r.id]);
      await sleep(100);
      await qr.commitTransaction();
      await qr.release();
      expect(await t4).toBe(0);
      expect(await status(ds, r.id)).toBe('completed');
    });

    it('LW-3: T4 commits after the fence; a T1 that started after the fence → 0 rows (fence and status predicates both fail)', async () => {
      const r = await provisional(`statement_timestamp() - interval '1 second'`);
      expect(await t.records.finalize([r.id])).toBe(1);
      expect(await t.records.complete(r.id, r.attemptToken, payload)).toBe(false);
      expect(await status(ds, r.id)).toBe('interrupted');
    });

    it('LW-4: T3 and T1 both start before the fence and contend for the row lock → exactly one terminal state', async () => {
      for (const order of [0, 1]) {
        const r = await provisional(`statement_timestamp() + interval '1 hour'`);
        const qr = ds.createQueryRunner();
        await qr.connect();
        await qr.startTransaction();
        await qr.query(`SELECT id FROM ai_turns WHERE id = $1 FOR UPDATE`, [r.id]);
        const a = order ? t.records.cancel(r.id) : t.records.complete(r.id, r.attemptToken, payload);
        const b = order ? t.records.complete(r.id, r.attemptToken, payload) : t.records.cancel(r.id);
        await sleep(100);
        await qr.commitTransaction();
        await qr.release();
        expect((await Promise.all([a, b])).filter(Boolean)).toHaveLength(1);
      }
    });

    it('LW-5: transaction-start trap — inside a transaction opened before the fence, now() is stale while statement_timestamp() is current', async () => {
      const r = await provisional(`statement_timestamp() + interval '700 milliseconds'`);
      const qr = ds.createQueryRunner();
      await qr.connect();
      await qr.startTransaction();
      await qr.query(`SELECT 1`);
      await sleep(900);
      const [x] = await qr.query(`SELECT now() < "fenceAt" AS now_says_before, statement_timestamp() < "fenceAt" AS stmt_says_before FROM ai_turns WHERE id = $1`, [r.id]);
      await qr.rollbackTransaction();
      await qr.release();
      expect(x).toEqual({ now_says_before: true, stmt_says_before: false }); // why every transition uses statement_timestamp()
    });

    it.each([['completion (T1)', 'completed'], ['cancel (T3)', 'cancelled']])('LW-6 / LW-10: a lazy reader started after the fence waits behind an in-flight pre-fence %s and returns its status, never accepted', async (_l, target) => {
      const r = await provisional(`statement_timestamp() + interval '1 second'`);
      const [{ userId }] = await ds.query(`SELECT "userId" FROM ai_conversations WHERE id = $1`, [r.s]);
      const qr = ds.createQueryRunner();
      await qr.connect();
      await qr.startTransaction();
      await qr.query(target === 'completed'
        ? `UPDATE ai_turns SET status = 'completed', segments = '[]'::jsonb, settlement = 'settled', "completedAt" = statement_timestamp() WHERE id = $1 AND status = 'accepted' AND statement_timestamp() < "fenceAt"`
        : `UPDATE ai_turns SET status = 'cancelled' WHERE id = $1 AND status = 'accepted' AND statement_timestamp() < "fenceAt"`, [r.id]);
      await sleep(1200); // past the fence
      const reader = t.qturns.turnView(userId, r.s, r.id);
      await sleep(150);
      await qr.commitTransaction();
      await qr.release();
      expect((await reader).status).toBe(target);
    });
  });

  describe('cancellation matrix (real ledger)', () => {
    it('before reservation → owner stops; no ledger rows; no record', async () => {
      const { u, s } = await session();
      const g = gate();
      const entered = gate();
      const real = t.qcs.resolve.bind(t.qcs);
      jest.spyOn(t.qcs, 'resolve').mockImplementationOnce(async (...a) => { entered.open(); await g.p; return real(...a); });
      const run = caught(t.qturns.run(u, s, 'cx-before-0001', Q));
      await entered.p;
      expect(await t.qturns.cancel(u, s, 'cx-before-0001')).toEqual({ status: 'cancel_requested' });
      g.open();
      const r = await run;
      expect((r as any).e.detail).toEqual({ status: 'cancelled' });
      expect(await ledgerEntries(ds, `${turnIdempotencyKey(u, s, 'cx-before-0001')}:a1`)).toEqual([]);
      expect(await ds.query(`SELECT 1 FROM ai_turns WHERE "sessionId" = $1`, [s])).toEqual([]);
    });

    it('after reservation, before the lock → recorded at the lock, released, cancelled (deviation N-B1: the lock stands)', async () => {
      const { u, s } = await session();
      const g = gate();
      const entered = gate();
      const real = t.gateway.prepare.bind(t.gateway);
      jest.spyOn(t.gateway, 'prepare').mockImplementationOnce(async (req) => { const p = await real(req); entered.open(); await g.p; return p; });
      const run = caught(t.qturns.run(u, s, 'cx-prelock-001', Q));
      await entered.p;
      expect(await t.qturns.cancel(u, s, 'cx-prelock-001')).toEqual({ status: 'cancel_requested' });
      g.open();
      const r = await run;
      expect((r as any).e.detail).toMatchObject({ status: 'cancelled', reservationRelease: 'released' });
      expect(await ledgerEntries(ds, `${turnIdempotencyKey(u, s, 'cx-prelock-001')}:a1`)).toEqual(['reservation', 'release']);
      const [row] = await ds.query(`SELECT status FROM ai_turns WHERE "sessionId" = $1`, [s]);
      expect(row.status).toBe('cancelled');
    });

    it('after the lock, before the provider call → T3 by the endpoint; owner releases; no provider call', async () => {
      const { u, s } = await session();
      const spy = jest.spyOn(t.sim, 'invoke');
      const g = gate();
      const entered = gate();
      const real = t.permission.check.bind(t.permission);
      jest.spyOn(t.permission, 'check').mockImplementation(async (b, now) => {
        const rows = await ds.query(`SELECT 1 FROM ai_turns WHERE "sessionId" = $1`, [s]);
        if (rows.length) { entered.open(); await g.p; } // the final eligibility check (after the lock)
        return real(b, now);
      });
      const run = caught(t.qturns.run(u, s, 'cx-postlock-01', Q));
      await entered.p;
      expect((await t.qturns.cancel(u, s, 'cx-postlock-01')).status).toBe('cancelled');
      g.open();
      const r = await run;
      expect((r as any).e.detail).toMatchObject({ status: 'cancelled', reservationRelease: 'released' });
      expect(spy).not.toHaveBeenCalled();
      expect(await ledgerEntries(ds, `${turnIdempotencyKey(u, s, 'cx-postlock-01')}:a1`)).toEqual(['reservation', 'release']);
    });

    it('during the provider attempt → client_abort; attempt held by the ledger (no release by E6); record cancelled', async () => {
      const slow = wireTurns(ds, { config: { providerTimeoutMs: 10_000 } });
      for (const bk of [es, en]) { slow.fx.textHash.set(bk.id, bk.hash); slow.store.put(bk.key, bk.id === es.id ? ES_TEXT : EN_TEXT); }
      const { u, s } = await session(slow);
      slow.sim.enqueue({ kind: 'partial_stream', deltas: 2, then: 'hang' }); // the provider is streaming, then hangs
      const started = gate();
      const realSim = slow.sim.invoke.bind(slow.sim);
      jest.spyOn(slow.sim, 'invoke').mockImplementationOnce((req: any, sig: AbortSignal) => { started.open(); return realSim(req, sig); });
      const run = caught(slow.qturns.run(u, s, 'cx-during-0001', Q));
      await started.p;
      await sleep(50); // the attempt is in flight at the provider
      expect((await slow.qturns.cancel(u, s, 'cx-during-0001')).status).toBe('cancelled'); // endpoint: T3 + abort signal
      const r = await run;
      expect((r as any).e.detail).toMatchObject({ status: 'cancelled' });
      const entries = await ledgerEntries(ds, `${turnIdempotencyKey(u, s, 'cx-during-0001')}:a1`);
      expect(entries).not.toContain('release');
      expect(entries[0]).toBe('reservation');
      const [row] = await ds.query(`SELECT status FROM ai_turns WHERE "sessionId" = $1`, [s]);
      expect(row.status).toBe('cancelled');
    });

    it('after settlement → no effect (completed); repeated cancel is idempotent', async () => {
      const { u, s } = await session();
      await t.qturns.run(u, s, 'cx-after-00001', Q);
      const a = await t.qturns.cancel(u, s, 'cx-after-00001');
      const b = await t.qturns.cancel(u, s, 'cx-after-00001');
      expect([a.status, b.status]).toEqual(['completed', 'completed']);
    });
  });

  describe('D-10 rights-aware history redaction and authorization', () => {
    it('available → revoked (user rights) → revoked (index permission) → stale (text changed) → unavailable (object missing); answer text kept', async () => {
      const b = await researchBook(ds, t, `${ES_TEXT}\n\nEdición para historial.`);
      const { u, s } = await session(t, [b.id]);
      const r = await t.qturns.run(u, s, 'hist-key-00001', 'faro');
      const turnId = r.turnId!;
      const view = async () => (await t.qturns.turnView(u, s, turnId));
      const v1 = await view();
      const c1 = v1.citations!.flat().find((c) => c.kind === 'chunk')!;
      expect(c1.sourceState).toBe('available');
      const [, range] = [c1.anchor!.slice(0, 71), c1.anchor!.slice(72)];
      const [a1, b1] = range.split('-').map(Number);
      expect(c1.excerpt).toBe(codePointSlice(`${ES_TEXT}\n\nEdición para historial.`, a1, b1));
      const answer = v1.segments!.map((x) => x.text).join('|');

      await ds.query(`UPDATE book_ai_rights SET status = 'revoked' WHERE "bookId" = $1`, [b.id]);
      const v2 = await view();
      expect(v2.citations!.flat().find((c) => c.kind === 'chunk')).toMatchObject({ excerpt: null, sourceState: 'revoked' });
      expect(v2.segments!.map((x) => x.text).join('|')).toBe(answer);
      await ds.query(`UPDATE book_ai_rights SET status = 'verified', "permittedOperations" = ARRAY['research_analysis'] WHERE "bookId" = $1`, [b.id]);
      expect((await view()).citations!.flat().find((c) => c.kind === 'chunk')).toMatchObject({ excerpt: null, sourceState: 'revoked' });
      await ds.query(`UPDATE book_ai_rights SET "permittedOperations" = $2 WHERE "bookId" = $1`, [b.id, BOTH_OPS]);
      expect((await view()).citations!.flat().find((c) => c.kind === 'chunk')!.sourceState).toBe('available');

      const newText = `${ES_TEXT}\n\nTexto reemplazado.`;
      const newHash = computeTextHash(Buffer.from(newText));
      t.store.put(b.key, newText);
      t.fx.textHash.set(b.id, newHash);
      await insertRights(ds, b.id, { textHash: newHash, permittedOperations: BOTH_OPS });
      expect((await view()).citations!.flat().find((c) => c.kind === 'chunk')).toMatchObject({ excerpt: null, sourceState: 'stale' });

      t.store.put(b.key, `${ES_TEXT}\n\nEdición para historial.`);
      t.fx.textHash.set(b.id, b.hash);
      t.store.objects.delete(b.key);
      expect((await view()).citations!.flat().find((c) => c.kind === 'chunk')).toMatchObject({ excerpt: null, sourceState: 'unavailable' });
      t.store.put(b.key, `${ES_TEXT}\n\nEdición para historial.`);
    });

    it('authorization: another user cannot read history, a single turn, or cancel in someone else\'s session', async () => {
      const { u, s } = await session();
      const r = await t.qturns.run(u, s, 'authz-key-0001', Q);
      const other = await createUser(ds);
      for (const call of [() => t.qturns.history(other, s), () => t.qturns.turnView(other, s, r.turnId!), () => t.qturns.cancel(other, s, 'authz-key-0001')]) {
        expect(((await caught(call())) as any).e.reason).toBe('not_found');
      }
      expect(await t.qturns.history(u, s)).toHaveLength(1);
    });
  });

  describe('weighted guard (real PostgreSQL)', () => {
    it('a turn heavier than W is refused before reservation (exceeds_limit) — the Q-11 condition when W < 10', async () => {
      const small = wireTurns(ds, { weight: 1 });
      for (const b of [es, en]) { small.fx.textHash.set(b.id, b.hash); small.store.put(b.key, b.id === es.id ? ES_TEXT : EN_TEXT); }
      const { u, s } = await session(small, [es.id, en.id]);
      const r = await caught(small.qturns.run(u, s, 'guard-heavy-01', Q));
      expect([(r as any).e.reason, (r as any).e.detail.guard]).toEqual(['budget_unavailable', 'exceeds_limit']);
      expect(await ledgerEntries(ds, `${turnIdempotencyKey(u, s, 'guard-heavy-01')}:a1`)).toEqual([]);
    });

    it('concurrent turns over W: the second is refused (over_limit) with no reservation or record; the first completes; capacity is released', async () => {
      const small = wireTurns(ds, { weight: 1 });
      small.fx.textHash.set(es.id, es.hash);
      small.store.put(es.key, ES_TEXT);
      const a = await session(small, [es.id]);
      const b = await session(small, [es.id]);
      const g = gate();
      const entered = gate();
      const real = small.qcs.resolve.bind(small.qcs);
      jest.spyOn(small.qcs, 'resolve').mockImplementationOnce(async (...x) => { entered.open(); await g.p; return real(...x); });
      const first = small.qturns.run(a.u, a.s, 'guard-first-01', 'faro');
      await entered.p;
      const second = await caught(small.qturns.run(b.u, b.s, 'guard-second-1', 'faro'));
      expect([(second as any).e.reason, (second as any).e.detail.guard]).toEqual(['budget_unavailable', 'over_limit']);
      expect(await ledgerEntries(ds, `${turnIdempotencyKey(b.u, b.s, 'guard-second-1')}:a1`)).toEqual([]);
      expect(await ds.query(`SELECT 1 FROM ai_turns WHERE "sessionId" = $1`, [b.s])).toEqual([]);
      g.open();
      expect(await first).toMatchObject({ status: 'completed' });
      expect(small.guard.used).toBe(0);
      expect(await small.qturns.run(b.u, b.s, 'guard-second-2', 'faro')).toMatchObject({ status: 'completed' });
    });
  });
});
