import { createServer, IncomingMessage, request, Server, ServerResponse } from 'http';
import { AddressInfo } from 'net';
import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SessionsController } from '../../../src/knowledge/sessions/sessions.controller';
import { turnIdempotencyKey } from '../../../src/knowledge/sessions/turn.service';
import { budgetPolicy, createUser, enableFlag, openDataSource, readyUser } from './support/it-env';
import { EN_TEXT, ES_TEXT } from './support/retrieval-env';
import { gate, ledgerEntries, researchBook, TurnWiring, wireTurns } from './support/turn-env';

/**
 * NEM-024 Checkpoint C on a disposable PostgreSQL 16 — the SSE transport end to end over a real HTTP socket:
 * the real SessionsController → TurnService → E5 retrieval → Gateway (simulator) → NEM-021 ledger → ai_turns.
 * Guards and pipes are covered by the unit HTTP suite; here the handler is invoked directly with the user id.
 */
const Q = '¿Qué papel tiene el faro? or lighthouse';
type Frame = { event: string; data: any };

describe('NEM-024 Checkpoint C — SSE stream + capability probe (real PostgreSQL)', () => {
  let ds: DataSource;
  let t: TurnWiring;
  let es: { id: string };
  let en: { id: string };
  let server: Server;
  let port: number;
  /** Server-side event log: frames written, Gateway terminal, T1 commits (for ordering evidence). */
  let log: string[];
  let onClose: (() => void) | null;
  let handlerDone: Promise<void>[];

  beforeAll(async () => {
    ds = await openDataSource();
    t = wireTurns(ds);
    await enableFlag(ds);
    await budgetPolicy(ds, 'noetia_plus', 'research_session', { allowanceUnits: 1_000_000_000, maxUnresolvedUnits: 1_000_000_000 });
    es = await researchBook(ds, t, ES_TEXT);
    en = await researchBook(ds, t, EN_TEXT, 'en');
    const controller = new SessionsController(t.sessions, t.qturns);
    server = createServer((req: IncomingMessage, res: ServerResponse) => {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        const { sessionId, idempotencyKey, question } = JSON.parse(body);
        const r = res as ServerResponse & { status: (c: number) => unknown };
        r.status = (c: number) => { res.statusCode = c; return res; };
        const write = res.write.bind(res) as (s: string) => boolean;
        (res as any).write = (s: string) => { log.push(`frame:${/^event: (\w+)/.exec(s)?.[1]}`); return write(s); };
        res.on('close', () => onClose?.());
        handlerDone.push(controller.stream({ user: { id: String(req.headers['x-user']) } }, sessionId, { idempotencyKey, question }, res as any));
      });
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    port = (server.address() as AddressInfo).port;
  });
  afterAll(async () => {
    await new Promise((r) => server?.close(r));
    await ds?.destroy();
  });
  beforeEach(() => { log = []; onClose = null; handlerDone = []; });
  afterEach(() => jest.restoreAllMocks());

  /** Opens a stream; `onFrame` may return 'disconnect' to destroy the client socket. Resolves when the response ends or the socket closes. */
  function openStream(u: string, s: string, key: string, onFrame?: (f: Frame) => 'disconnect' | void, disconnectWhen?: Promise<void>) {
    return new Promise<{ status: number; headers: Record<string, unknown>; frames: Frame[]; disconnected: boolean }>((resolve, reject) => {
      const frames: Frame[] = [];
      let buf = '';
      let disconnected = false;
      const req = request({ host: '127.0.0.1', port, method: 'POST', path: '/', headers: { 'content-type': 'application/json', 'x-user': u } }, (res) => {
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => {
          buf += chunk;
          let i: number;
          while ((i = buf.indexOf('\n\n')) >= 0) {
            const [ev, da] = buf.slice(0, i).split('\n');
            buf = buf.slice(i + 2);
            const f = { event: ev.slice(7), data: JSON.parse(da.slice(6)) };
            frames.push(f);
            if (onFrame?.(f) === 'disconnect') {
              disconnected = true;
              req.destroy();
              resolve({ status: res.statusCode!, headers: res.headers, frames, disconnected });
              return;
            }
          }
        });
        res.on('end', () => resolve({ status: res.statusCode!, headers: res.headers, frames, disconnected }));
        res.on('error', () => resolve({ status: res.statusCode!, headers: res.headers, frames, disconnected }));
      });
      req.on('error', (e) => (disconnected ? undefined : reject(e)));
      void disconnectWhen?.then(() => {
        disconnected = true;
        req.destroy();
        resolve({ status: 200, headers: {}, frames, disconnected });
      });
      req.end(JSON.stringify({ sessionId: s, idempotencyKey: key, question: Q }));
    });
  }
  async function session(books = [es.id, en.id]) {
    const u = await readyUser(ds, t);
    return { u, s: (await t.sessions.create(u, books)).id as string };
  }
  const rows = (s: string) => ds.query(`SELECT id, status, "turnIndex", "reservationRelease" FROM ai_turns WHERE "sessionId" = $1 ORDER BY "createdAt", id`, [s]);
  const events = (fr: Frame[]) => fr.map((f) => f.event);
  const terminal = (fr: Frame[]) => fr[fr.length - 1];
  /** Instruments the Gateway terminal and T1 commit into the server log. */
  function instrument() {
    const stream = t.gateway.stream.bind(t.gateway);
    jest.spyOn(t.gateway, 'stream').mockImplementation(async function* (p, o) {
      for await (const e of stream(p, o)) {
        if (e.type === 'delta' || e.type === 'segment') log.push(`gateway:${e.type}`);
        if (e.type === 'terminal') log.push('gateway:terminal');
        yield e;
      }
    });
    const complete = t.records.complete.bind(t.records);
    jest.spyOn(t.records, 'complete').mockImplementation(async (...a) => {
      const ok = await complete(...a);
      log.push(`T1:${ok ? 'committed' : 'lost'}`);
      return ok;
    });
  }

  describe('SSE contract and ordering', () => {
    it('stage(checking, searching, composing) → [delta, segment]* → terminal(completed, persisted, settled); text only after Gateway validation AND T1 commit', async () => {
      instrument();
      const { u, s } = await session();
      const r = await openStream(u, s, 'sse-ok-00001');
      await Promise.all(handlerDone);
      expect(r.status).toBe(200);
      expect(r.headers['content-type']).toBe('text/event-stream; charset=utf-8');
      expect(r.headers['x-accel-buffering']).toBe('no');
      const ev = events(r.frames);
      expect(ev.slice(0, 3)).toEqual(['stage', 'stage', 'stage']);
      expect(r.frames.slice(0, 3).map((f) => f.data)).toEqual([{ stage: 'checking' }, { stage: 'searching' }, { stage: 'composing' }]);
      expect(ev[ev.length - 1]).toBe('terminal');
      expect(ev.filter((e) => e === 'terminal')).toHaveLength(1);
      const content = ev.slice(3, -1);
      expect(content.length).toBeGreaterThan(0);
      for (let i = 0; i < content.length; i += 2) expect([content[i], content[i + 1]]).toEqual(['delta', 'segment']);
      // ordering evidence (server side): every content frame follows the Gateway terminal and this request's T1 commit
      const firstContent = log.findIndex((x) => x === 'frame:delta' || x === 'frame:segment');
      for (const m of ['gateway:delta', 'gateway:segment', 'gateway:terminal', 'T1:committed']) expect({ m, seen: log.includes(m) }).toEqual({ m, seen: true });
      expect(firstContent).toBeGreaterThan(0);
      expect(firstContent).toBeGreaterThan(log.indexOf('gateway:terminal'));
      expect(firstContent).toBeGreaterThan(log.indexOf('T1:committed'));
      expect(log.indexOf('gateway:terminal')).toBeGreaterThan(log.lastIndexOf('gateway:delta'));
      expect(log.slice(0, firstContent).filter((x) => x.startsWith('frame:'))).toEqual(['frame:stage', 'frame:stage', 'frame:stage']);
      const term = terminal(r.frames).data;
      expect(term).toMatchObject({ outcome: 'completed', statusCode: 200, persisted: true, settlement: 'settled' });
      expect(term.unrecorded).toBeUndefined();
      // streamed text == terminal result == stored record (stage frames carry no content)
      const deltas = r.frames.filter((f) => f.event === 'delta').map((f) => f.data.text);
      expect(deltas).toEqual(term.result.segments.map((x: any) => x.text));
      for (const f of r.frames.filter((x) => x.event === 'stage')) expect(Object.keys(f.data)).toEqual(['stage']);
      const [row] = await rows(s);
      expect(row).toMatchObject({ id: term.turnId, status: 'completed', turnIndex: 1 });
      expect(await ledgerEntries(ds, `${turnIdempotencyKey(u, s, 'sse-ok-00001')}:a1`)).toEqual(['reservation', 'settlement']);
      // library citations carry the verified excerpt on the live stream (refs + anchors only in the record)
      const lib = r.frames.filter((f) => f.event === 'segment').flatMap((f) => f.data.citations).filter((c: any) => c.kind === 'chunk');
      for (const c of lib) expect(typeof c.excerpt === 'string' || c.sourceState === 'position_unavailable').toBe(true);
    });

    it('same-key replay over SSE: checking → content → terminal(replayed); no reservation, no provider call', async () => {
      const { u, s } = await session();
      await openStream(u, s, 'sse-replay-01');
      await Promise.all(handlerDone);
      const calls = jest.spyOn(t.sim, 'invoke');
      const prep = jest.spyOn(t.gateway, 'prepare');
      const r = await openStream(u, s, 'sse-replay-01');
      expect(r.frames[0].data).toEqual({ stage: 'checking' });
      expect(events(r.frames).filter((e) => e === 'stage')).toHaveLength(1);
      expect(terminal(r.frames).data).toMatchObject({ outcome: 'completed', replayed: true, persisted: true });
      expect(calls).not.toHaveBeenCalled();
      expect(prep).not.toHaveBeenCalled();
      expect(await ledgerEntries(ds, `${turnIdempotencyKey(u, s, 'sse-replay-01')}:a1`)).toEqual(['reservation', 'settlement']);
    });

    it('duplicate key while the original is provisional → terminal pending (409, status accepted); then one completion; one reservation', async () => {
      const { u, s } = await session();
      const hold = gate();
      const invoked = gate();
      const invoke = t.gateway.invoke.bind(t.gateway);
      jest.spyOn(t.gateway, 'invoke').mockImplementationOnce(async (p, o) => { invoked.open(); await hold.p; return invoke(p, o); });
      const first = openStream(u, s, 'sse-dup-0001');
      await invoked.p;
      const dup = await openStream(u, s, 'sse-dup-0001');
      expect(events(dup.frames)).toEqual(['stage', 'terminal']);
      expect(terminal(dup.frames).data).toMatchObject({ outcome: 'pending', statusCode: 409, code: 'duplicate_turn', status: 'accepted' });
      hold.open();
      expect(terminal((await first).frames).data).toMatchObject({ outcome: 'completed', persisted: true });
      expect(await ledgerEntries(ds, `${turnIdempotencyKey(u, s, 'sse-dup-0001')}:a1`)).toEqual(['reservation', 'settlement']);
      expect(await rows(s)).toHaveLength(1);
    });
  });

  describe('terminal outcomes', () => {
    it('provider failure → terminal failed (recorded owner failure); no content frames', async () => {
      const { u, s } = await session();
      t.sim.enqueue({ kind: 'unavailable' } as any);
      const r = await openStream(u, s, 'sse-fail-0001');
      expect(events(r.frames)).toEqual(['stage', 'stage', 'stage', 'terminal']);
      expect(terminal(r.frames).data).toMatchObject({ outcome: 'failed', status: 'failed', code: 'turn_failed', statusCode: 502 });
      expect((await rows(s))[0].status).toBe('failed');
    });

    it('explicit cancel (after the lock, before the provider) → terminal cancelled with the observed release; T3 recorded', async () => {
      const { u, s } = await session();
      const invoke = t.gateway.invoke.bind(t.gateway);
      jest.spyOn(t.gateway, 'invoke').mockImplementationOnce(async (p, o) => {
        await t.qturns.cancel(u, s, 'sse-cancel-001'); // the authenticated cancel route's service call (T3 + signal)
        return invoke(p, o);
      });
      const r = await openStream(u, s, 'sse-cancel-001');
      expect(terminal(r.frames).data).toMatchObject({ outcome: 'cancelled', status: 'cancelled' });
      expect(events(r.frames)).not.toContain('delta');
      expect((await rows(s))[0].status).toBe('cancelled');
    });

    it('cancel before the lock commits (Amendment 2) → terminal cancelled, released; no lock, no turn count', async () => {
      const { u, s } = await session();
      const lockOwned = t.sessions.lockOwned.bind(t.sessions);
      jest.spyOn(t.sessions, 'lockOwned').mockImplementationOnce(async (...a) => { t.cancels.abort(turnIdempotencyKey(u, s, 'sse-cancel-002')); return lockOwned(...a); });
      const r = await openStream(u, s, 'sse-cancel-002');
      expect(terminal(r.frames).data).toMatchObject({ outcome: 'cancelled', status: 'cancelled', reservationRelease: 'released' });
      const [c] = await ds.query(`SELECT "lockedAt", "turnCount" FROM ai_conversations WHERE id = $1`, [s]);
      expect([c.lockedAt, Number(c.turnCount)]).toEqual([null, 0]);
    });

    it('D-8(a) unrecorded → terminal completed with persisted:false + unrecorded (never shown as saved); then interrupted after the fence', async () => {
      const { u, s } = await session();
      jest.spyOn(t.records, 'complete').mockRejectedValue(new Error('write failed'));
      const r = await openStream(u, s, 'sse-unrec-001');
      const term = terminal(r.frames).data;
      expect(term).toMatchObject({ outcome: 'completed', persisted: false, unrecorded: true });
      expect(events(r.frames)).toContain('delta'); // best-effort delivery of the answer the server holds
      jest.restoreAllMocks();
      const [row] = await rows(s);
      expect(row.status).toBe('accepted');
      const pending = await openStream(u, s, 'sse-unrec-001');
      expect(terminal(pending.frames).data).toMatchObject({ outcome: 'pending', status: 'accepted', statusCode: 409 });
      await ds.query(`UPDATE ai_turns SET "fenceAt" = statement_timestamp() - interval '1 second' WHERE id = $1`, [row.id]);
      const after = await openStream(u, s, 'sse-unrec-001');
      expect(terminal(after.frames).data).toMatchObject({ outcome: 'interrupted', status: 'interrupted' });
      expect(events(after.frames)).not.toContain('delta'); // never reproduces the answer
    });
  });

  describe('disconnect is never a cancellation (D-9 a)', () => {
    it('client disconnects at "composing" → the turn still completes and is persisted; same-key replay returns it; one reservation', async () => {
      const { u, s } = await session();
      const closed = gate();
      onClose = closed.open;
      const invoke = t.gateway.invoke.bind(t.gateway);
      jest.spyOn(t.gateway, 'invoke').mockImplementationOnce(async (p, o) => { await closed.p; return invoke(p, o); }); // provider runs only after the socket is gone
      const r = await openStream(u, s, 'sse-disc-0001', (f) => (f.event === 'stage' && f.data.stage === 'composing' ? 'disconnect' : undefined));
      expect(r.disconnected).toBe(true);
      expect(events(r.frames)).toEqual(['stage', 'stage', 'stage']);
      await Promise.all(handlerDone); // the handler finished the turn after the client left
      const [row] = await rows(s);
      expect(row.status).toBe('completed');
      const sim = jest.spyOn(t.sim, 'invoke');
      const replay = await openStream(u, s, 'sse-disc-0001');
      expect(terminal(replay.frames).data).toMatchObject({ outcome: 'completed', replayed: true, turnId: row.id });
      expect(sim).not.toHaveBeenCalled();
      expect(await ledgerEntries(ds, `${turnIdempotencyKey(u, s, 'sse-disc-0001')}:a1`)).toEqual(['reservation', 'settlement']);
    });

    it('disconnect DURING the provider attempt → the provider signal is not aborted (no client_abort); completed and settled, not held', async () => {
      const { u, s } = await session();
      const started = gate();
      const closed = gate();
      onClose = closed.open;
      let abortedAtResume: boolean | null = null;
      const invoke = t.sim.invoke.bind(t.sim);
      jest.spyOn(t.sim, 'invoke').mockImplementationOnce(async function* (req, signal) {
        started.open(); // the provider attempt has begun
        await closed.p; // ...and the client socket is now gone
        abortedAtResume = signal.aborted;
        yield* invoke(req, signal);
      });
      const r = await openStream(u, s, 'sse-disc-0002', undefined, started.p);
      expect(r.disconnected).toBe(true);
      await Promise.all(handlerDone);
      expect(abortedAtResume).toBe(false);
      expect((await rows(s))[0].status).toBe('completed');
      expect(await ledgerEntries(ds, `${turnIdempotencyKey(u, s, 'sse-disc-0002')}:a1`)).toEqual(['reservation', 'settlement']);
    });
  });

  describe('rights and eligibility enforcement', () => {
    it('all books revoked → terminal denied no_eligible_books (403); no reservation, no record, no content', async () => {
      const b = await researchBook(ds, t, ES_TEXT);
      const { u, s } = await session([b.id]);
      await ds.query(`UPDATE book_ai_rights SET status = 'revoked' WHERE "bookId" = $1`, [b.id]);
      const prep = jest.spyOn(t.gateway, 'prepare');
      const r = await openStream(u, s, 'sse-rights-01');
      expect(events(r.frames)).toEqual(['stage', 'terminal']);
      expect(terminal(r.frames).data).toMatchObject({ outcome: 'denied', statusCode: 403, code: 'no_eligible_books' });
      expect(prep).not.toHaveBeenCalled();
      expect(await rows(s)).toEqual([]);
    });

    it('revoked between preflight and the provider (final check) → terminal failed book_ineligible; released; no text', async () => {
      const b = await researchBook(ds, t, ES_TEXT);
      const { u, s } = await session([b.id, en.id]);
      const lockOwned = t.sessions.lockOwned.bind(t.sessions);
      jest.spyOn(t.sessions, 'lockOwned').mockImplementationOnce(async (...a) => {
        await ds.query(`UPDATE book_ai_rights SET status = 'revoked' WHERE "bookId" = $1`, [b.id]);
        return lockOwned(...a);
      });
      const r = await openStream(u, s, 'sse-rights-02');
      expect(terminal(r.frames).data).toMatchObject({ outcome: 'failed', code: 'book_ineligible', reservationRelease: 'released' });
      expect(events(r.frames)).not.toContain('delta');
    });

    it("another user's session → terminal denied not_found; nothing about the session leaks", async () => {
      const { s } = await session();
      const intruder = await readyUser(ds, t);
      const r = await openStream(intruder, s, 'sse-other-001');
      expect(terminal(r.frames).data).toMatchObject({ outcome: 'denied', statusCode: 404, code: 'not_found' });
      expect(Object.keys(terminal(r.frames).data).sort()).toEqual(['code', 'message', 'outcome', 'statusCode']);
    });
  });

  describe('no sensitive content in logs or error payloads', () => {
    it('question, answer, and excerpt text never reach console/Logger; error terminals carry only fixed codes', async () => {
      const sinks = [
        jest.spyOn(console, 'log').mockImplementation(() => undefined), jest.spyOn(console, 'error').mockImplementation(() => undefined),
        jest.spyOn(console, 'warn').mockImplementation(() => undefined), jest.spyOn(console, 'info').mockImplementation(() => undefined),
        jest.spyOn(console, 'debug').mockImplementation(() => undefined),
        jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined), jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined),
        jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined),
      ];
      const { u, s } = await session();
      const ok = await openStream(u, s, 'sse-logs-0001');
      const answer = ok.frames.filter((f) => f.event === 'delta').map((f) => f.data.text);
      t.sim.enqueue({ kind: 'internal' } as any);
      const bad = await openStream(u, s, 'sse-logs-0002');
      const logged = JSON.stringify(sinks.flatMap((x) => x.mock.calls));
      for (const txt of [Q, 'faro', ...answer]) expect(logged).not.toContain(txt);
      const errPayload = JSON.stringify(terminal(bad.frames).data);
      for (const bad2 of [Q, 'stack', 'Error', 'SELECT', 'ai_turns']) expect(errPayload).not.toContain(bad2);
    });
  });

  describe('capability probe (real entitlement resolver)', () => {
    it('entitled → tier, capabilities, features, limits from the active policy; no budget values', async () => {
      const u = await readyUser(ds, t);
      const p = await t.qturns.capabilities(u);
      const policy = await t.entitlements.activePolicy('noetia_plus');
      expect(p).toEqual({
        tier: 'noetia_plus', capabilities: [...policy!.capabilities].sort(),
        features: { researchTurns: true, streaming: true, cancellation: true, history: true },
        limits: { maxBooks: policy!.maxBooks, questionMaxCodePoints: 500, historyPageMax: 50 },
      });
      expect(JSON.stringify(p)).not.toMatch(/budget|allowance|unit|usd|ledger|provider|model/i);
    });
    it('deny-first: no grant → no_entitlement; prerequisite missing → prerequisite_missing; flag disabled → feature_disabled', async () => {
      const plain = await createUser(ds);
      t.fx.plan.set(plain, 'qualifying');
      await expect(t.qturns.capabilities(plain)).rejects.toMatchObject({ reason: 'no_entitlement' });
      const noPlan = await createUser(ds);
      await expect(t.qturns.capabilities(noPlan)).rejects.toMatchObject({ reason: 'prerequisite_missing' });
      const u = await readyUser(ds, t);
      await ds.query(`UPDATE feature_flags SET enabled = false WHERE key = 'intelligence.research_session'`);
      try {
        await expect(t.qturns.capabilities(u)).rejects.toMatchObject({ reason: 'feature_disabled' });
      } finally {
        await enableFlag(ds);
      }
    });
  });
});
