import { TextDecoder as NodeTextDecoder, TextEncoder as NodeTextEncoder } from 'util';

// jsdom lacks TextEncoder/TextDecoder (browsers have both).
Object.assign(global, { TextEncoder: NodeTextEncoder, TextDecoder: NodeTextDecoder });

jest.mock('../../../lib/api', () => ({ apiFetch: jest.fn(), apiStream: jest.fn() }));

import { apiFetch, apiStream } from '../../../lib/api';
import { en } from '../../../lib/i18n/en';
import { es } from '../../../lib/i18n/es';
import {
  ACCESS_DENIAL_CODES, apiErrorCode, cancelTurn, clearPending, codePointLength, ERROR_CODES, errorCode, fromView, getCapabilities, getHistory,
  getSession, getTurn, historyToTurns, loadPending, newIdempotencyKey, readerHref, runQuestionStream, savePending, SseParser, terminalAction,
  Terminal, TurnView,
} from '../../../lib/research';

/** NEM-024 Checkpoint D — research client logic (no network: apiFetch/apiStream mocked). */
const fetchMock = apiFetch as jest.Mock;
const streamMock = apiStream as jest.Mock;

const frame = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
const RESULT = {
  sessionId: 's', turnId: 't1', status: 'completed', settlement: 'settled',
  segments: [{ origin: 'library', text: 'Según el libro…', bookId: 'b1' }],
  citations: [[{ ref: 'chunk:1', kind: 'chunk', bookId: 'b1', anchor: 'a', excerpt: 'Érase una vez', sourceState: 'available' }]],
  exclusions: { ineligible: ['b2'], unindexed: [], stale: [], unavailable: [], indexNotPermitted: [] },
};

/** A fake streamed Response delivering `chunks` (strings) one read at a time. */
function sseResponse(chunks: string[], opts: { throwAt?: number; status?: number; type?: string } = {}) {
  const enc = new TextEncoder();
  let i = 0;
  return {
    ok: (opts.status ?? 200) < 400, status: opts.status ?? 200,
    headers: { get: () => opts.type ?? 'text/event-stream; charset=utf-8' },
    body: {
      getReader: () => ({
        read: async () => {
          if (opts.throwAt === i) throw new Error('network');
          return i < chunks.length ? { done: false, value: enc.encode(chunks[i++]) } : { done: true, value: undefined };
        },
        releaseLock: () => undefined,
      }),
    },
    json: async () => ({}),
  };
}
const jsonResponse = (status: number, body: unknown) => ({ ok: status < 400, status, headers: { get: () => 'application/json' }, body: null, json: async () => body });

beforeEach(() => { jest.clearAllMocks(); localStorage.clear(); });

describe('SseParser', () => {
  it('parses complete frames, buffers partial ones across chunks (even mid-UTF-8 text), and keeps order', () => {
    const p = new SseParser();
    const all = frame('stage', { stage: 'checking' }) + frame('delta', { segment: 0, text: 'línea\n2' }) + frame('terminal', { outcome: 'completed' });
    const out = [];
    for (let i = 0; i < all.length; i += 7) out.push(...p.push(all.slice(i, i + 7)));
    expect(out.map((e) => e.event)).toEqual(['stage', 'delta', 'terminal']);
    expect(out[1].data).toEqual({ segment: 0, text: 'línea\n2' });
  });
  it('ignores comments, unknown events, frames without data, and malformed JSON (fail closed); accepts CRLF and no space after the colon', () => {
    const p = new SseParser();
    const out = p.push(': keep-alive\n\nevent: usage\ndata: {"cost":1}\n\nevent: stage\n\nevent: delta\ndata: {bad\n\nevent:stage\r\ndata:{"stage":"searching"}\r\n\r\n');
    expect(out).toEqual([{ event: 'stage', data: { stage: 'searching' } }]);
  });
  it('a frame without an event name is ignored', () => {
    expect(new SseParser().push('data: {"x":1}\n\n')).toEqual([]);
  });
});

describe('newIdempotencyKey / codePointLength / readerHref', () => {
  it('matches the server key pattern, strips unsafe characters, pads short values, caps at 64', () => {
    const re = /^[A-Za-z0-9_-]{8,64}$/;
    expect(newIdempotencyKey()).toMatch(re);
    expect(newIdempotencyKey(() => 'ab')).toBe('q_ab0000');
    expect(newIdempotencyKey(() => 'a/b c.d')).toBe('q_abcd00');
    expect(newIdempotencyKey(() => 'x'.repeat(100))).toHaveLength(64);
    expect(newIdempotencyKey()).not.toBe(newIdempotencyKey());
  });
  it('falls back when crypto.randomUUID is unavailable', () => {
    const orig = (globalThis as any).crypto;
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
    try {
      expect(newIdempotencyKey()).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    } finally {
      Object.defineProperty(globalThis, 'crypto', { value: orig, configurable: true });
    }
  });
  it('counts code points (emoji = 1), and the reader link is the book only (no position)', () => {
    expect(codePointLength('a😀b')).toBe(3);
    expect(readerHref('b 1')).toBe('/reader/b%201');
  });
});

describe('pending question storage (same-key recovery after reload)', () => {
  it('round-trips per session; rejects invalid keys or shapes; clear removes it', () => {
    savePending('s1', { key: 'q_abcdefgh', question: '¿Qué?' });
    expect(loadPending('s1')).toEqual({ key: 'q_abcdefgh', question: '¿Qué?' });
    expect(loadPending('s2')).toBeNull();
    localStorage.setItem('noetia_research_pending:s3', JSON.stringify({ key: 'bad key', question: 'x' }));
    expect(loadPending('s3')).toBeNull();
    localStorage.setItem('noetia_research_pending:s4', '{not json');
    expect(loadPending('s4')).toBeNull();
    clearPending('s1');
    expect(loadPending('s1')).toBeNull();
  });
  it('storage failures never throw', () => {
    const spy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    const spy2 = jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(() => savePending('s', { key: 'q_abcdefgh', question: 'x' })).not.toThrow();
    expect(() => clearPending('s')).not.toThrow();
    spy.mockRestore(); spy2.mockRestore();
  });
});

describe('error mapping', () => {
  it.each(ERROR_CODES.map((c) => [c]))('%s has non-empty en and es copy (different languages, no "Error:" prefix, no "!")', (code) => {
    const e = en.research.errors[code];
    const s = es.research.errors[code];
    expect(typeof e).toBe('string');
    expect(typeof s).toBe('string');
    expect(e.length).toBeGreaterThan(0);
    expect(s).not.toBe(e);
    for (const txt of [e, s]) {
      expect(txt).not.toMatch(/^Error:|[!¡]/);
    }
  });
  it('unknown or missing codes map to generic; known codes pass through', () => {
    expect(errorCode('budget_exhausted')).toBe('budget_exhausted');
    expect(errorCode('something_new')).toBe('generic');
    expect(errorCode(undefined)).toBe('generic');
    expect(en.research.errors.generic).toBeTruthy();
  });
  it('apiErrorCode reads status + code only (never the server message)', () => {
    expect(apiErrorCode({ status: 403, data: { code: 'feature_disabled', message: 'English text' } })).toEqual({ status: 403, code: 'feature_disabled' });
    expect(apiErrorCode(new Error('x'))).toEqual({ status: null, code: 'generic' });
    expect(apiErrorCode(null)).toEqual({ status: null, code: 'generic' });
  });
  it('access-denial codes hide the screen', () => {
    for (const c of ['feature_disabled', 'no_entitlement', 'prerequisite_missing', 'policy_missing', 'capability_not_in_tier']) expect(ACCESS_DENIAL_CODES.has(c)).toBe(true);
    expect(ACCESS_DENIAL_CODES.has('turn_failed')).toBe(false);
  });
});

describe('history mapping', () => {
  const view = (over: Partial<TurnView>): TurnView => ({
    turnId: 't', turnIndex: 1, status: 'completed', question: 'q', createdAt: '', completedAt: null, failureReason: null,
    segments: RESULT.segments as any, citations: RESULT.citations as any, exclusions: null, settlement: 'settled', ...over,
  });
  it('newest-first history is shown oldest-first; accepted → processing; failed carries its mapped code; non-completed has no text', () => {
    const turns = historyToTurns([view({ turnId: 'new', status: 'accepted' }), view({ turnId: 'old' })]);
    expect(turns.map((x) => [x.id, x.status])).toEqual([['old', 'completed'], ['new', 'processing']]);
    expect(turns[1].segments).toEqual([]);
    expect(fromView(view({ status: 'failed', failureReason: 'book_ineligible', segments: null })).code).toBe('book_ineligible');
    expect(fromView(view({ status: 'failed', failureReason: null })).code).toBe('turn_failed');
    expect(fromView(view({ status: 'interrupted', exclusions: { ineligible: ['b'] } as any })).exclusions).toEqual({ ineligible: ['b'], unindexed: [], stale: [], unavailable: [], indexNotPermitted: [] });
    expect(fromView(view({ segments: null, citations: null })).segments).toEqual([]);
  });
});

describe('terminalAction (D-C3: the terminal decides, not HTTP 200)', () => {
  const act = (t: Partial<Terminal>) => terminalAction({ statusCode: 200, ...t } as Terminal, 'q', 'local-1');
  it('completed + persisted → completed turn with segments and citations; clears the pending key', () => {
    const a = act({ outcome: 'completed', persisted: true, turnId: 't1', result: RESULT as any });
    expect(a).toMatchObject({ kind: 'turn', clearPending: true, turn: { id: 't1', status: 'completed', segments: RESULT.segments } });
    expect((a as any).turn.exclusions.ineligible).toEqual(['b2']);
  });
  it('D-8 unrecorded → status unrecorded (never shown as saved), whether marked on the terminal or the result', () => {
    expect(act({ outcome: 'completed', persisted: false, unrecorded: true, result: RESULT as any })).toMatchObject({ turn: { status: 'unrecorded' } });
    expect(act({ outcome: 'completed', result: { ...RESULT, unrecorded: true } as any })).toMatchObject({ turn: { status: 'unrecorded' } });
    expect(act({ outcome: 'completed' })).toMatchObject({ turn: { id: 'local-1', segments: [], citations: [] } });
  });
  it('cancelled: released → no capacity note; after the provider started (no release) or unconfirmed → may count; no record → local id', () => {
    expect(act({ outcome: 'cancelled', turnId: 't', reservationRelease: 'released' })).toMatchObject({ turn: { status: 'cancelled', mayCount: false } });
    expect(act({ outcome: 'cancelled', turnId: 't' })).toMatchObject({ turn: { mayCount: true } });
    expect(act({ outcome: 'cancelled', turnId: 't', reservationRelease: 'unconfirmed' })).toMatchObject({ turn: { mayCount: true } });
    expect(act({ outcome: 'cancelled' })).toMatchObject({ turn: { id: 'local-1', mayCount: false } });
  });
  it('interrupted → terminal turn; failed → mapped code (+ may count when unconfirmed); failed duplicate_turn → "another question in progress"', () => {
    expect(act({ outcome: 'interrupted', turnId: 't' })).toMatchObject({ turn: { status: 'interrupted' } });
    expect(act({ outcome: 'failed', turnId: 't', code: 'book_ineligible', exclusions: { ineligible: ['b'] } })).toMatchObject({ turn: { status: 'failed', code: 'book_ineligible', exclusions: { ineligible: ['b'] } } });
    expect(act({ outcome: 'failed', code: 'turn_failed', reservationRelease: 'unconfirmed' })).toMatchObject({ turn: { mayCount: true } });
    expect(act({ outcome: 'failed', code: 'duplicate_turn', status: 'failed' })).toEqual({ kind: 'notice', code: 'duplicate_turn', clearPending: true, busy: true });
  });
  it('pending (same key provisional) → poll, keeping the key; guard refusal → notice', () => {
    expect(act({ outcome: 'pending', status: 'accepted', turnId: 't' })).toEqual({ kind: 'poll', turnId: 't' });
    expect(act({ outcome: 'pending', status: 'pending' })).toEqual({ kind: 'poll', turnId: null });
    expect(act({ outcome: 'pending', guard: 'over_limit', retryAfterSeconds: 1 })).toMatchObject({ kind: 'notice', code: 'budget_unavailable', clearPending: true });
  });
  it('unknown → keeps the pending key (Check again replays the same key)', () => {
    expect(act({ outcome: 'unknown', turnId: 't' })).toMatchObject({ kind: 'turn', clearPending: false, turn: { status: 'unknown' } });
  });
  it('denied → notice; read-only and budget-exhausted flags', () => {
    expect(act({ outcome: 'denied', code: 'session_read_only' })).toMatchObject({ kind: 'notice', readOnly: true, budgetExhausted: false });
    expect(act({ outcome: 'denied', code: 'budget_exhausted' })).toMatchObject({ budgetExhausted: true });
    expect(act({ outcome: 'denied', code: 'weird' })).toMatchObject({ code: 'generic' });
  });
});

describe('API wrappers', () => {
  it('use the accepted routes through apiFetch', async () => {
    fetchMock.mockResolvedValue({});
    await getCapabilities();
    await getSession('s 1');
    await getHistory('s1', 50);
    await getTurn('s1', 't1');
    await cancelTurn('s1', 'q_abcdefgh');
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      '/knowledge/sessions/capabilities', '/knowledge/sessions/s%201', '/knowledge/sessions/s1/turns?limit=50',
      '/knowledge/sessions/s1/turns/t1', '/knowledge/sessions/s1/turns/cancel',
    ]);
    expect(fetchMock.mock.calls[4][1]).toEqual({ method: 'POST', body: JSON.stringify({ idempotencyKey: 'q_abcdefgh' }) });
  });
});

describe('runQuestionStream', () => {
  const handlers = () => ({ onStage: jest.fn(), onTerminal: jest.fn() });
  it('posts key + question to the SSE route; stages in order; the terminal ends it', async () => {
    streamMock.mockResolvedValue(sseResponse([
      frame('stage', { stage: 'checking' }) + frame('stage', { stage: 'searching' }),
      frame('stage', { stage: 'composing' }) + frame('delta', { segment: 0, text: 'x' }) + frame('segment', { segment: 0, origin: 'library', citations: [] }),
      frame('terminal', { outcome: 'completed', statusCode: 200, persisted: true, result: RESULT }) + frame('stage', { stage: 'checking' }),
    ]));
    const h = handlers();
    expect(await runQuestionStream('s1', 'q_abcdefgh', '¿Qué?', h)).toBe('terminal');
    expect(streamMock).toHaveBeenCalledWith('/knowledge/sessions/s1/turns/stream', expect.objectContaining({ method: 'POST', body: JSON.stringify({ idempotencyKey: 'q_abcdefgh', question: '¿Qué?' }) }));
    expect(h.onStage.mock.calls.map((c) => c[0])).toEqual(['checking', 'searching', 'composing']);
    expect(h.onTerminal).toHaveBeenCalledTimes(1);
    expect(h.onTerminal.mock.calls[0][0]).toMatchObject({ outcome: 'completed', persisted: true });
  });
  it('a terminal error after the stream opened is reported as the terminal (HTTP 200 is not success, D-C3)', async () => {
    streamMock.mockResolvedValue(sseResponse([frame('terminal', { outcome: 'denied', statusCode: 403, code: 'no_eligible_books' })]));
    const h = handlers();
    expect(await runQuestionStream('s1', 'q_abcdefgh', 'q', h)).toBe('terminal');
    expect(h.onTerminal.mock.calls[0][0]).toMatchObject({ outcome: 'denied', code: 'no_eligible_books' });
  });
  it('pre-stream HTTP errors (403/400/…) become a denied terminal with the code only', async () => {
    streamMock.mockResolvedValue(jsonResponse(403, { code: 'prerequisite_missing', message: 'English' }));
    const h = handlers();
    expect(await runQuestionStream('s1', 'q_abcdefgh', 'q', h)).toBe('terminal');
    expect(h.onTerminal).toHaveBeenCalledWith({ outcome: 'denied', statusCode: 403, code: 'prerequisite_missing' });
    streamMock.mockResolvedValue(jsonResponse(500, 'not json object'));
    const h2 = handlers();
    await runQuestionStream('s1', 'q_abcdefgh', 'q', h2);
    expect(h2.onTerminal).toHaveBeenCalledWith({ outcome: 'denied', statusCode: 500, code: undefined });
  });
  it('lost connection (end without terminal, read error, fetch failure, non-SSE 200) → "lost", never a cancel', async () => {
    streamMock.mockResolvedValue(sseResponse([frame('stage', { stage: 'checking' })]));
    expect(await runQuestionStream('s1', 'q_abcdefgh', 'q', handlers())).toBe('lost');
    streamMock.mockResolvedValue(sseResponse([frame('stage', { stage: 'checking' })], { throwAt: 1 }));
    expect(await runQuestionStream('s1', 'q_abcdefgh', 'q', handlers())).toBe('lost');
    streamMock.mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await runQuestionStream('s1', 'q_abcdefgh', 'q', handlers())).toBe('lost');
    streamMock.mockResolvedValue(jsonResponse(200, {}));
    expect(await runQuestionStream('s1', 'q_abcdefgh', 'q', handlers())).toBe('lost');
    expect(fetchMock).not.toHaveBeenCalled(); // no cancel request was made
  });
  it('a 401 from apiStream (after the shared refresh failed) propagates', async () => {
    streamMock.mockRejectedValue(Object.assign(new Error('Session expired'), { status: 401 }));
    await expect(runQuestionStream('s1', 'q_abcdefgh', 'q', handlers())).rejects.toMatchObject({ status: 401 });
  });
  it('passes the AbortSignal to the request (navigation drops delivery only)', async () => {
    streamMock.mockResolvedValue(sseResponse([frame('terminal', { outcome: 'completed', statusCode: 200 })]));
    const ac = new AbortController();
    await runQuestionStream('s1', 'q_abcdefgh', 'q', handlers(), ac.signal);
    expect(streamMock.mock.calls[0][1].signal).toBe(ac.signal);
  });
});
