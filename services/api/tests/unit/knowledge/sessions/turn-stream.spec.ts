import { EventEmitter } from 'events';
import { IntelligenceDenied } from '../../../../src/knowledge/common/intelligence-denied.error';
import { errorTerminal, formatSse, resultEvents, SSE_HEADERS, streamTurn } from '../../../../src/knowledge/sessions/turn-stream';
import { TurnStatusDenied } from '../../../../src/knowledge/sessions/turn-status.error';
import type { TurnResult } from '../../../../src/knowledge/sessions/turn.service';

/** NEM-024 Checkpoint C — SSE serializer, event mapping, ordering, and disconnect semantics (no network). */
const QUESTION = '¿Qué papel tiene el faro en la novela?';
const ANSWER = 'Según el libro, el faro guía.';
const EXCERPT = 'Érase una vez un faro junto al mar.';
const TURN = '30000000-0000-4000-8000-000000000001';

const result = (over: Partial<TurnResult> = {}): TurnResult => ({
  sessionId: 's', excludedBookIds: [], settlement: 'settled', turnId: TURN, status: 'completed',
  segments: [{ origin: 'library', text: ANSWER, bookId: 'b1' } as any, { origin: 'general', text: 'Contexto general.' } as any],
  citations: [[{ ref: 'chunk:c1', kind: 'chunk', bookId: 'b1', anchor: 'h:1-2', excerpt: EXCERPT, sourceState: 'available' }], []],
  exclusions: { ineligible: [], unindexed: [], stale: [], unavailable: [], indexNotPermitted: [] },
  ...over,
});

class FakeRes extends EventEmitter {
  chunks: string[] = [];
  headers: Record<string, string> = {};
  code = 0;
  destroyed = false;
  writableEnded = false;
  flushed = false;
  throwOnWrite = false;
  status(c: number) { this.code = c; return this; }
  setHeader(k: string, v: string) { this.headers[k] = v; return this; }
  flushHeaders() { this.flushed = true; }
  write(s: string) { if (this.throwOnWrite) throw new Error('EPIPE'); this.chunks.push(s); return true; }
  end() { this.writableEnded = true; }
  disconnect() { this.destroyed = true; this.emit('close'); }
}

/** Parse SSE text into [{event, data}], asserting the frame grammar. */
function parse(text: string) {
  return text.split('\n\n').filter(Boolean).map((frame) => {
    const lines = frame.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^event: (stage|delta|segment|terminal)$/);
    expect(lines[1].startsWith('data: ')).toBe(true);
    return { event: lines[0].slice(7), data: JSON.parse(lines[1].slice(6)) };
  });
}
const types = (r: FakeRes) => parse(r.chunks.join('')).map((e) => e.event);

describe('NEM-024 Checkpoint C — SSE transport', () => {
  describe('formatSse', () => {
    it('one event line + one data line + blank line; newlines inside content are JSON-escaped (frame cannot be split)', () => {
      const f = formatSse({ type: 'delta', data: { segment: 0, text: 'línea 1\nlínea 2\n\nevent: terminal' } });
      expect(f.endsWith('\n\n')).toBe(true);
      expect(f.split('\n')).toHaveLength(4); // event, data, '', ''
      expect(parse(f)).toEqual([{ event: 'delta', data: { segment: 0, text: 'línea 1\nlínea 2\n\nevent: terminal' } }]);
    });
  });

  describe('resultEvents', () => {
    it('per segment delta → segment (citations with the verified excerpt), then exactly one terminal last', () => {
      const ev = resultEvents(result());
      expect(ev.map((e) => e.type)).toEqual(['delta', 'segment', 'delta', 'segment', 'terminal']);
      expect(ev[0].data).toEqual({ segment: 0, text: ANSWER });
      expect(ev[1].data).toEqual({ segment: 0, origin: 'library', bookId: 'b1', citations: result().citations![0] });
      expect(ev[3].data).toEqual({ segment: 1, origin: 'general', citations: [] });
      expect(ev[4].data).toMatchObject({ outcome: 'completed', statusCode: 200, turnId: TURN, settlement: 'settled', persisted: true });
      expect((ev[4].data as any).unrecorded).toBeUndefined();
    });
    it('D-8(a) unrecorded: persisted false + unrecorded marker (never represented as saved)', () => {
      const t = resultEvents(result({ unrecorded: true, settlement: 'held' })).pop()!.data as any;
      expect(t).toMatchObject({ outcome: 'completed', persisted: false, unrecorded: true, settlement: 'held' });
    });
    it('replay: replayed marker, persisted true; citations as stored (deferred, no excerpt)', () => {
      const r = result({ replayed: true, citations: [[{ ref: 'chunk:c1', kind: 'chunk', bookId: 'b1', anchor: 'h:1-2', excerpt: null, sourceState: 'deferred' }], []] });
      const ev = resultEvents(r);
      expect(ev.pop()!.data).toMatchObject({ outcome: 'completed', replayed: true, persisted: true });
      expect((ev[1].data as any).citations[0]).toMatchObject({ excerpt: null, sourceState: 'deferred' });
    });
    it('no segments / no citations array → terminal only, citations default to []', () => {
      expect(resultEvents(result({ segments: [], citations: undefined, turnId: undefined })).map((e) => e.type)).toEqual(['terminal']);
      expect((resultEvents(result({ citations: undefined }))[1].data as any).citations).toEqual([]);
    });
  });

  describe('errorTerminal', () => {
    it.each([
      [{ status: 'failed', turnId: TURN, reservationRelease: 'released' }, 'failed'],
      [{ status: 'cancelled', turnId: TURN, reservationRelease: 'unconfirmed' }, 'cancelled'],
      [{ status: 'interrupted', turnId: TURN }, 'interrupted'],
      [{ status: 'accepted', turnId: TURN }, 'pending'],
      [{ status: 'pending' }, 'pending'],
      [{ status: 'unknown', turnId: TURN }, 'unknown'],
    ] as const)('TurnStatusDenied %j → outcome %s (status payload preserved)', (detail, outcome) => {
      const t = errorTerminal(new TurnStatusDenied('turn_failed', detail as any)).data as any;
      expect(t.outcome).toBe(outcome);
      expect(t.status).toBe(detail.status);
      expect(t.statusCode).toBe(502);
      expect(t.code).toBe('turn_failed');
      if ('reservationRelease' in detail) expect(t.reservationRelease).toBe(detail.reservationRelease);
    });
    it('unrecorded failure (recorded:false) → persisted false; guard and exclusions carried', () => {
      const t = errorTerminal(new TurnStatusDenied('turn_failed', { status: 'cancelled', reservationRelease: 'released', recorded: false })).data as any;
      expect(t).toMatchObject({ recorded: false, persisted: false });
      const g = errorTerminal(new TurnStatusDenied('budget_unavailable', { status: 'pending', retryAfterSeconds: 1, guard: 'over_limit' })).data as any;
      expect(g).toMatchObject({ outcome: 'pending', statusCode: 503, retryAfterSeconds: 1, guard: 'over_limit' });
      const x = errorTerminal(new TurnStatusDenied('book_ineligible', { status: 'failed', turnId: TURN, exclusions: { ineligible: ['b1'] } })).data as any;
      expect(x).toMatchObject({ outcome: 'failed', statusCode: 403, exclusions: { ineligible: ['b1'] } });
    });
    it('plain denial → outcome denied with its fixed code, status, and message', () => {
      expect(errorTerminal(new IntelligenceDenied('no_eligible_books')).data).toMatchObject({ outcome: 'denied', statusCode: 403, code: 'no_eligible_books' });
    });
    it('unexpected error → generic turn_failed; nothing from the original error (message, stack, SQL, question) leaks', () => {
      const raw = new Error(`relation "ai_turns" violates … question=${QUESTION}`);
      const t = errorTerminal(raw).data;
      expect(t).toMatchObject({ outcome: 'denied', statusCode: 502, code: 'turn_failed' });
      const s = JSON.stringify(t);
      for (const bad of [QUESTION, 'ai_turns', 'stack', 'Error:']) expect(s).not.toContain(bad);
    });
  });

  describe('streamTurn', () => {
    it('sets the SSE headers (incl. X-Accel-Buffering: no), 200, flushes, then stage* → content → terminal → end', async () => {
      const res = new FakeRes();
      const out = await streamTurn(res as any, async (onStage) => { onStage('checking'); onStage('searching'); onStage('composing'); return result(); });
      expect(res.code).toBe(200);
      expect(res.headers).toEqual(SSE_HEADERS);
      expect(res.headers['X-Accel-Buffering']).toBe('no');
      expect(res.flushed).toBe(true);
      expect(types(res)).toEqual(['stage', 'stage', 'stage', 'delta', 'segment', 'delta', 'segment', 'terminal']);
      expect(parse(res.chunks.join('')).slice(0, 3).map((e) => e.data)).toEqual([{ stage: 'checking' }, { stage: 'searching' }, { stage: 'composing' }]);
      expect(res.writableEnded).toBe(true);
      expect(out).toEqual({ delivered: true, outcome: 'completed' });
    });
    it('stage events are content-free (only the stage name) and monotonic: repeats and regressions are dropped', async () => {
      const res = new FakeRes();
      await streamTurn(res as any, async (onStage) => { onStage('searching'); onStage('checking'); onStage('searching'); onStage('composing'); onStage('composing'); return result(); });
      const stages = parse(res.chunks.join('')).filter((e) => e.event === 'stage');
      expect(stages.map((e) => e.data)).toEqual([{ stage: 'searching' }, { stage: 'composing' }]);
      for (const e of stages) expect(Object.keys(e.data)).toEqual(['stage']);
    });
    it('NO content before the result exists: while the turn is running only stage frames have been written', async () => {
      const res = new FakeRes();
      let finish!: (r: TurnResult) => void;
      const p = streamTurn(res as any, (onStage) => { onStage('checking'); onStage('composing'); return new Promise<TurnResult>((r) => { finish = r; }); });
      await new Promise((r) => setImmediate(r));
      const before = res.chunks.join('');
      expect(types(res)).toEqual(['stage', 'stage']);
      for (const bad of [ANSWER, EXCERPT, 'delta', 'segment']) expect(before).not.toContain(bad);
      finish(result());
      await p;
      expect(types(res).slice(2)).toEqual(['delta', 'segment', 'delta', 'segment', 'terminal']);
    });
    it('a denial → stage frames then a single terminal; no delta/segment; never rejects', async () => {
      const res = new FakeRes();
      const out = await streamTurn(res as any, async (onStage) => { onStage('checking'); throw new TurnStatusDenied('turn_failed', { status: 'cancelled', turnId: TURN, reservationRelease: 'released' }); });
      expect(types(res)).toEqual(['stage', 'terminal']);
      expect(parse(res.chunks.join(''))[1].data).toMatchObject({ outcome: 'cancelled', reservationRelease: 'released' });
      expect(out.outcome).toBe('cancelled');
    });
    it('client disconnect mid-turn: the turn is NOT cancelled (run keeps going and resolves), later writes are skipped, no throw', async () => {
      const res = new FakeRes();
      let finish!: (r: TurnResult) => void;
      let runSignalled = false;
      const p = streamTurn(res as any, (onStage) => { onStage('checking'); return new Promise<TurnResult>((r) => { finish = (x) => { runSignalled = true; r(x); }; }); });
      await new Promise((r) => setImmediate(r));
      res.disconnect();
      // the run function received no signal: the transport has no path to cancel the turn
      finish(result());
      const out = await p;
      expect(runSignalled).toBe(true);
      expect(types(res)).toEqual(['stage']);
      expect(res.writableEnded).toBe(false); // never end() a destroyed response
      expect(out).toEqual({ delivered: false, outcome: 'completed' });
    });
    it('socket error and throwing write are treated as a disconnect (no unhandled error)', async () => {
      const res = new FakeRes();
      res.throwOnWrite = true;
      expect(await streamTurn(res as any, async (onStage) => { onStage('checking'); return result(); })).toEqual({ delivered: false, outcome: 'completed' });
      const res2 = new FakeRes();
      const p = streamTurn(res2 as any, async () => { res2.emit('error', new Error('ECONNRESET')); return result(); });
      expect((await p).delivered).toBe(false);
      const res3 = new FakeRes();
      res3.writableEnded = true;
      expect((await streamTurn(res3 as any, async () => result())).delivered).toBe(false);
    });
    it('end() throwing is swallowed', async () => {
      const res = new FakeRes();
      res.end = () => { throw new Error('gone'); };
      expect((await streamTurn(res as any, async () => result())).delivered).toBe(true);
    });
  });
});
