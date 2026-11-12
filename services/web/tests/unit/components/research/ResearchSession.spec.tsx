// NEM-024 Checkpoint D — the minimal research Q&A screen (react-dom + act; API layer mocked; real copy in en and es).
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, ...props }: any) => {
    const React = require('react');
    return React.createElement('a', props, children);
  },
}));

let mockLang: 'en' | 'es' = 'en';
jest.mock('@/lib/i18n', () => ({
  useTranslation: () => {
    const { en } = require('@/lib/i18n/en');
    const { es } = require('@/lib/i18n/es');
    return { t: mockLang === 'en' ? en : es, language: mockLang, setLanguage: () => undefined };
  },
}));

jest.mock('@/lib/research', () => {
  const actual = jest.requireActual('@/lib/research');
  return {
    ...actual,
    getCapabilities: jest.fn(), getSession: jest.fn(), getHistory: jest.fn(), getTurn: jest.fn(), cancelTurn: jest.fn(), runQuestionStream: jest.fn(),
  };
});

import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import ResearchSession from '@/components/research/ResearchSession';
import { en } from '@/lib/i18n/en';
import { es } from '@/lib/i18n/es';
import * as research from '@/lib/research';

(global as any).IS_REACT_ACT_ENVIRONMENT = true;

const m = research as jest.Mocked<typeof research>;
const SID = '20000000-0000-4000-8000-000000000001';
const CAPS = {
  tier: 'noetia_plus', capabilities: ['research_session'],
  features: { researchTurns: true, streaming: true, cancellation: true, history: true },
  limits: { maxBooks: 3, questionMaxCodePoints: 500, historyPageMax: 50 },
};
const SESSION = {
  id: SID, parentId: null, status: 'active' as const, locked: true, turnCount: 1, forkOffer: null,
  books: [{ bookId: 'b1', position: 1, title: 'El faro', author: 'A' }, { bookId: 'b2', position: 2, title: 'La isla', author: 'B' }],
};
const EXCERPT = 'Érase una vez un faro junto al mar.';
const ANSWER = 'Según el libro, el faro guía a los barcos.';
const cite = (over: Partial<research.Citation> = {}): research.Citation => ({ ref: 'chunk:1', kind: 'chunk', bookId: 'b1', anchor: 'h:1-2', excerpt: EXCERPT, sourceState: 'available', ...over });
const view = (over: Partial<research.TurnView> = {}): research.TurnView => ({
  turnId: 't-old', turnIndex: 1, status: 'completed', question: '¿Qué es el faro?', createdAt: '', completedAt: '', failureReason: null,
  segments: [{ origin: 'library', text: ANSWER, bookId: 'b1' }, { origin: 'synthesis', text: 'Ambos textos coinciden.' }],
  citations: [[cite()], []], exclusions: { ineligible: ['b2'], unindexed: [], stale: [], unavailable: [], indexNotPermitted: [] }, settlement: 'settled', ...over,
});
const RESULT = (over: Partial<research.TurnResult> = {}): research.TurnResult => ({
  sessionId: SID, turnId: 't-new', status: 'completed', settlement: 'settled',
  segments: [{ origin: 'library', text: 'Respuesta nueva del libro.', bookId: 'b1' }], citations: [[cite()]],
  exclusions: { ineligible: [], unindexed: [], stale: [], unavailable: [], indexNotPermitted: [] }, ...over,
});

const jwt = (sub: string) => `h.${btoa(JSON.stringify({ sub })).replace(/=+$/, '')}.s`;
const signIn = (sub: string) => localStorage.setItem('access_token', jwt(sub));
const PKEY = `noetia_research_pending:${SID}`;
const stored = () => { const raw = sessionStorage.getItem(PKEY); return raw ? JSON.parse(raw) : null; };
const storePending = (p: { key: string; question: string }, over: Record<string, unknown> = {}) =>
  sessionStorage.setItem(PKEY, JSON.stringify({ v: 1, owner: 'user-a', savedAt: Date.now(), ...p, ...over }));

let container: HTMLDivElement;
let root: Root;
const flush = async (n = 4) => { for (let i = 0; i < n; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const wait = async (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
async function mount(lang: 'en' | 'es' = 'en', props: Partial<React.ComponentProps<typeof ResearchSession>> = {}) {
  mockLang = lang;
  await act(async () => { root.render(<ResearchSession sessionId={SID} pollMs={5} recoveryDelayMs={5} {...props} />); });
  await flush();
}
const text = () => container.textContent ?? '';
const q = <T extends Element = HTMLElement>(sel: string) => container.querySelector(sel) as T | null;
const byText = (tag: string, s: string) => Array.from(container.querySelectorAll(tag)).find((e) => e.textContent === s) as HTMLElement | undefined;
function type(value: string) {
  const ta = q<HTMLTextAreaElement>('textarea')!;
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
  act(() => { setter.call(ta, value); ta.dispatchEvent(new Event('input', { bubbles: true })); });
}
const key = (el: Element, k: string, extra: KeyboardEventInit = {}) => act(() => { el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...extra })); });
const liveLog = () => q('[data-testid="live-log"]')!;

type Ctl = { stage: (s: research.Stage) => Promise<void>; terminal: (t: Partial<research.Terminal>) => Promise<void>; lose: () => Promise<void>; signal?: AbortSignal; key: string; question: string };
/** Controls each runQuestionStream call manually. */
function controlledStream() {
  const calls: Ctl[] = [];
  m.runQuestionStream.mockImplementation((_s, k, qq, h, signal) => new Promise((resolve) => {
    calls.push({
      key: k, question: qq, signal,
      stage: async (s) => { await act(async () => { h.onStage(s); }); },
      terminal: async (t) => { await act(async () => { h.onTerminal({ statusCode: 200, ...t } as research.Terminal); resolve('terminal'); }); await flush(); },
      lose: async () => { await act(async () => { resolve('lost'); }); await flush(); },
    });
  }));
  return calls;
}

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  signIn('user-a');
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  m.getCapabilities.mockResolvedValue(CAPS);
  m.getSession.mockResolvedValue(SESSION);
  m.getHistory.mockResolvedValue([view()]);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe.each(['en', 'es'] as const)('ResearchSession (%s)', (lang) => {
  const T = lang === 'en' ? en.research : es.research;

  describe('capability gating', () => {
    it('loading → neutral loading text', async () => {
      m.getCapabilities.mockReturnValue(new Promise(() => undefined));
      mockLang = lang;
      await act(async () => { root.render(<ResearchSession sessionId={SID} />); });
      expect(q('[role="status"]')?.textContent).toBe(T.loading);
    });
    it.each([
      [{ status: 403, data: { code: 'feature_disabled', message: 'Feature disabled' } }],
      [{ status: 403, data: { code: 'prerequisite_missing' } }],
      [{ status: 400, data: { code: 'no_entitlement' } }],
    ])('probe denial %j → unavailable notice only; no session or history request; server message never shown', async (err) => {
      m.getCapabilities.mockRejectedValue(Object.assign(new Error('Feature disabled'), err));
      await mount(lang);
      expect(text()).toContain(T.unavailable.title);
      expect(text()).toContain(T.unavailable.body);
      expect(text()).not.toContain('Feature disabled');
      expect(m.getSession).not.toHaveBeenCalled();
      expect(m.getHistory).not.toHaveBeenCalled();
      expect(q('textarea')).toBeNull();
    });
    it('probe allows but research turns are not wired / capability missing → unavailable', async () => {
      m.getCapabilities.mockResolvedValue({ ...CAPS, features: { ...CAPS.features, researchTurns: false } });
      await mount(lang);
      expect(text()).toContain(T.unavailable.title);
      m.getCapabilities.mockResolvedValue({ ...CAPS, capabilities: [] });
      await act(async () => root.unmount());
      root = createRoot(container);
      await mount(lang);
      expect(text()).toContain(T.unavailable.title);
    });
    it('probe network error → load error; session 404 → not found; session access denial → unavailable', async () => {
      m.getCapabilities.mockRejectedValue(Object.assign(new Error('x'), { status: 500 }));
      await mount(lang);
      expect(q('[role="alert"]')?.textContent).toBe(T.loadError);
      await act(async () => root.unmount());
      root = createRoot(container);
      m.getCapabilities.mockResolvedValue(CAPS);
      m.getSession.mockRejectedValue(Object.assign(new Error('nf'), { status: 404, data: { code: 'not_found' } }));
      await mount(lang);
      expect(q('[role="alert"]')?.textContent).toBe(T.notFound);
      await act(async () => root.unmount());
      root = createRoot(container);
      m.getSession.mockRejectedValue(Object.assign(new Error('d'), { status: 403, data: { code: 'feature_disabled' } }));
      await mount(lang);
      expect(text()).toContain(T.unavailable.title);
      await act(async () => root.unmount());
      root = createRoot(container);
      m.getSession.mockRejectedValue(new Error('boom'));
      await mount(lang);
      expect(q('[role="alert"]')?.textContent).toBe(T.loadError);
    });
  });

  describe('session context and history', () => {
    it('book chips, lock indicator, excluded book disclosure, history oldest-first with origin labels in text', async () => {
      m.getHistory.mockResolvedValue([view({ turnId: 't2', question: 'Segunda' }), view({ turnId: 't1', question: 'Primera' })]);
      await mount(lang);
      expect(text()).toContain(T.books.label);
      expect(text()).toContain('El faro');
      expect(text()).toContain(`La isla· ${T.books.excluded}`);
      expect(q('[data-testid="lock-state"]')?.textContent).toBe(T.books.locked);
      const articles = Array.from(container.querySelectorAll('article'));
      expect(articles.map((a) => a.textContent?.includes('Primera'))).toEqual([true, false]);
      expect(text()).toContain(T.origin.library);
      expect(text()).toContain(T.origin.synthesis);
      expect(q('[data-testid="disclosures"]')?.textContent).toContain(T.exclusions.ineligible(1));
      expect(m.getHistory).toHaveBeenCalledWith(SID, 50);
    });
    it('unlocked session, empty history → unlocked hint and empty-state copy; broader segments hidden', async () => {
      m.getSession.mockResolvedValue({ ...SESSION, locked: false, turnCount: 0 });
      m.getHistory.mockResolvedValue([]);
      await mount(lang);
      expect(q('[data-testid="lock-state"]')?.textContent).toBe(T.books.unlocked);
      expect(text()).toContain(T.conversation.empty);
      await act(async () => root.unmount());
      root = createRoot(container);
      m.getHistory.mockResolvedValue([view({ segments: [{ origin: 'broader', text: 'BROADER TEXT' }], citations: [[]] })]);
      await mount(lang);
      expect(text()).not.toContain('BROADER TEXT');
    });
    it('read-only session → notice + fork notice, no question input (no fork/selection UI)', async () => {
      m.getSession.mockResolvedValue({ ...SESSION, status: 'read_only', forkOffer: { maxBooks: 3 } });
      await mount(lang);
      expect(q('[role="note"]')?.textContent).toContain(T.readOnly);
      expect(text()).toContain(T.forkNotice(3));
      expect(q('textarea')).toBeNull();
    });
    it('history states: processing, failed (mapped code), cancelled, interrupted', async () => {
      m.getHistory.mockResolvedValue([
        view({ turnId: 'a', status: 'accepted', segments: null, citations: null }),
        view({ turnId: 'b', status: 'failed', failureReason: 'book_ineligible', segments: null, citations: null }),
        view({ turnId: 'c', status: 'cancelled', segments: null, citations: null }),
        view({ turnId: 'd', status: 'interrupted', segments: null, citations: null }),
      ]);
      await mount(lang);
      const st = Array.from(container.querySelectorAll('[data-testid="turn-status"]')).map((e) => e.textContent);
      expect(st[0]).toContain(T.status.interrupted);
      expect(st[1]).toContain(T.status.cancelled);
      expect(st[2]).toContain(T.errors.book_ineligible);
      expect(st[3]).toBe(T.status.processing);
      expect(text()).not.toContain(ANSWER);
    });
  });

  describe('asking over SSE', () => {
    it('Enter submits with a fresh key; content-free stages are shown and announced; the answer renders only at the terminal', async () => {
      const calls = controlledStream();
      await mount(lang);
      type('  ¿Qué papel tiene el faro?  ');
      key(q('textarea')!, 'Enter');
      await flush();
      expect(calls).toHaveLength(1);
      expect(calls[0].key).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
      expect(calls[0].question).toBe('¿Qué papel tiene el faro?');
      expect(stored()).toMatchObject({ v: 1, key: calls[0].key, question: '¿Qué papel tiene el faro?', owner: 'user-a' });
      expect(localStorage.getItem(PKEY)).toBeNull(); // F-D1: never in localStorage
      expect(q('[data-testid="progress"]')?.textContent).toContain(T.stage.submitting);
      expect(q<HTMLTextAreaElement>('textarea')!.disabled).toBe(true);
      for (const s of ['checking', 'searching', 'composing'] as const) {
        await calls[0].stage(s);
        expect(q('[data-testid="progress"]')?.textContent).toContain(T.stage[s]);
        expect(liveLog().textContent).toBe(T.stage[s]);
      }
      expect(text()).not.toContain('Respuesta nueva del libro.');
      await calls[0].terminal({ outcome: 'completed', persisted: true, turnId: 't-new', result: RESULT() });
      expect(text()).toContain('Respuesta nueva del libro.');
      expect(liveLog().textContent).toBe(T.status.answerReady);
      expect(liveLog().textContent).not.toContain('Respuesta nueva');
      expect(stored()).toBeNull();
      expect(q<HTMLTextAreaElement>('textarea')!.value).toBe('');
      expect(m.getSession).toHaveBeenCalledTimes(2); // lock state refreshed from the server after the outcome
    });
    it('Shift+Enter does not submit; empty and too-long questions cannot be sent (code-point counter)', async () => {
      const calls = controlledStream();
      await mount(lang);
      type('hola');
      key(q('textarea')!, 'Enter', { shiftKey: true });
      expect(calls).toHaveLength(0);
      type('   ');
      expect(q<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
      type('😀'.repeat(501));
      expect(q('#research-counter')?.textContent).toBe(T.ask.tooLong(500));
      expect(q('textarea')!.getAttribute('aria-invalid')).toBe('true');
      expect(q<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
      type('😀'.repeat(500));
      expect(q('#research-counter')?.textContent).toBe(T.ask.counter(500, 500));
    });
    it('D-8 unrecorded → answer shown with the "not saved" note (never as saved)', async () => {
      const calls = controlledStream();
      await mount(lang);
      type('faro');
      key(q('textarea')!, 'Enter');
      await flush();
      await calls[0].terminal({ outcome: 'completed', persisted: false, unrecorded: true, turnId: 't-new', result: RESULT({ unrecorded: true }) });
      expect(text()).toContain('Respuesta nueva del libro.');
      const last = Array.from(container.querySelectorAll('article')).pop()!;
      expect(last.getAttribute('data-status')).toBe('unrecorded');
      expect(last.textContent).toContain(T.status.unrecorded);
      expect(liveLog().textContent).toContain(T.status.unrecorded);
    });
    it.each([
      ['failed', { outcome: 'failed', turnId: 'tf', code: 'book_ineligible', status: 'failed' }, (T2: typeof en.research) => T2.errors.book_ineligible],
      ['cancelled (released)', { outcome: 'cancelled', turnId: 'tc', reservationRelease: 'released', status: 'cancelled' }, (T2: typeof en.research) => T2.status.cancelled],
      ['interrupted', { outcome: 'interrupted', turnId: 'ti', status: 'interrupted' }, (T2: typeof en.research) => T2.status.interrupted],
      ['unknown', { outcome: 'unknown', turnId: 'tu', status: 'unknown' }, (T2: typeof en.research) => T2.status.unknown],
    ] as const)('terminal %s → distinct status copy; no answer text', async (_n, term, copy) => {
      const calls = controlledStream();
      await mount(lang);
      type('faro');
      key(q('textarea')!, 'Enter');
      await flush();
      await calls[0].terminal(term as any);
      const last = Array.from(container.querySelectorAll('article')).pop()!;
      expect(last.querySelector('[data-testid="turn-status"]')?.textContent).toContain(copy(T));
      expect(last.textContent).not.toContain('Respuesta nueva');
    });
    it('cancelled after the provider started → capacity note; Ask again is explicit and uses a NEW key', async () => {
      const calls = controlledStream();
      await mount(lang);
      type('faro');
      key(q('textarea')!, 'Enter');
      await flush();
      await calls[0].terminal({ outcome: 'cancelled', turnId: 'tc', status: 'cancelled' });
      expect(text()).toContain(T.status.mayCount);
      expect(calls).toHaveLength(1); // never auto-resubmitted
      await act(async () => byText('button', `${T.status.askAgain} — ${T.status.askAgainHint}`)!.click());
      await flush();
      expect(calls).toHaveLength(2);
      expect(calls[1].key).not.toBe(calls[0].key);
      expect(calls[1].question).toBe('faro');
    });
    it('denials: read-only → input replaced; budget_exhausted → input disabled; duplicate_turn → "wait" notice and disabled', async () => {
      for (const [code, check] of [
        ['session_read_only', () => expect(q('textarea')).toBeNull()],
        ['budget_exhausted', () => expect(q<HTMLTextAreaElement>('textarea')!.disabled).toBe(true)],
      ] as const) {
        const calls = controlledStream();
        await mount(lang);
        type('faro');
        key(q('textarea')!, 'Enter');
        await flush();
        await calls[0].terminal({ outcome: 'denied', statusCode: 409, code });
        expect(q('[data-testid="notice"]')?.textContent).toBe(T.errors[code]);
        check();
        await act(async () => root.unmount());
        root = createRoot(container);
      }
      const calls = controlledStream();
      await mount(lang);
      type('faro');
      key(q('textarea')!, 'Enter');
      await flush();
      await calls[0].terminal({ outcome: 'failed', statusCode: 409, code: 'duplicate_turn', status: 'failed' });
      expect(q('[data-testid="notice"]')?.textContent).toBe(T.errors.duplicate_turn);
      expect(q<HTMLTextAreaElement>('textarea')!.disabled).toBe(true);
    });
    it('same-key provisional (pending) → processing state, polls the turn, then shows the result', async () => {
      const calls = controlledStream();
      m.getTurn.mockResolvedValueOnce(view({ turnId: 'tp', status: 'accepted', segments: null, citations: null }))
        .mockResolvedValue(view({ turnId: 'tp', question: 'faro', segments: [{ origin: 'synthesis', text: 'Resultado por sondeo.' }], citations: [[]] }));
      await mount(lang, { pollMs: 40 });
      type('faro');
      key(q('textarea')!, 'Enter');
      await flush();
      await calls[0].terminal({ outcome: 'pending', statusCode: 409, code: 'duplicate_turn', status: 'accepted', turnId: 'tp' });
      expect(q('[data-testid="progress"]')?.textContent).toContain(T.stage.processing);
      expect(stored()).not.toBeNull();
      await wait(150);
      await flush();
      expect(m.getTurn).toHaveBeenCalledWith(SID, 'tp');
      expect(text()).toContain('Resultado por sondeo.');
      expect(q('[data-testid="progress"]')).toBeNull();
      expect(stored()).toBeNull();
      expect(calls).toHaveLength(1); // no re-ask
    });
  });

  describe('explicit cancellation vs disconnect', () => {
    it('Cancel button and Esc call the cancel endpoint with the SAME key; the stream terminal decides', async () => {
      const calls = controlledStream();
      m.cancelTurn.mockResolvedValue({ status: 'cancel_requested' });
      await mount(lang);
      type('faro');
      key(q('textarea')!, 'Enter');
      await flush();
      await calls[0].stage('searching');
      await act(async () => byText('button', T.cancel)!.click());
      await flush();
      expect(m.cancelTurn).toHaveBeenCalledWith(SID, calls[0].key);
      expect(q('[data-testid="progress"]')?.textContent).toContain(T.stage.cancelling);
      expect(liveLog().textContent).toBe(T.stage.cancelling);
      await calls[0].stage('composing'); // a late stage does not override "cancelling"
      expect(q('[data-testid="progress"]')?.textContent).toContain(T.stage.cancelling);
      await calls[0].terminal({ outcome: 'cancelled', turnId: 'tc', reservationRelease: 'released' });
      expect(text()).toContain(T.status.cancelled);
      expect(q('[data-testid="progress"]')).toBeNull();

      // Esc
      type('isla');
      key(q('textarea')!, 'Enter');
      await flush();
      key(document.body, 'Escape');
      await flush();
      expect(m.cancelTurn).toHaveBeenLastCalledWith(SID, calls[1].key);
    });
    it('cancel while polling a provisional turn → loads the turn from the cancel result', async () => {
      const calls = controlledStream();
      m.getTurn.mockResolvedValue(view({ turnId: 'tp', status: 'accepted', segments: null, citations: null }));
      await mount(lang);
      type('faro');
      key(q('textarea')!, 'Enter');
      await flush();
      await calls[0].terminal({ outcome: 'pending', statusCode: 409, status: 'accepted', turnId: 'tp' });
      m.cancelTurn.mockResolvedValue({ turnId: 'tp', status: 'cancelled' });
      m.getTurn.mockResolvedValue(view({ turnId: 'tp', status: 'cancelled', segments: null, citations: null }));
      await act(async () => byText('button', T.cancel)!.click());
      await flush();
      expect(text()).toContain(T.status.cancelled);
      expect(q('[data-testid="progress"]')).toBeNull();
    });
    it('cancel endpoint failure → mapped notice, turn keeps running', async () => {
      const calls = controlledStream();
      m.cancelTurn.mockRejectedValue(Object.assign(new Error('x'), { status: 404, data: { code: 'not_found' } }));
      await mount(lang);
      type('faro');
      key(q('textarea')!, 'Enter');
      await flush();
      await act(async () => byText('button', T.cancel)!.click());
      await flush();
      expect(q('[data-testid="notice"]')?.textContent).toBe(T.errors.not_found);
      expect(q('[data-testid="progress"]')).not.toBeNull();
      expect(calls).toHaveLength(1);
    });
    it('a lost connection is NOT a cancellation: no cancel call; automatic recovery replays the SAME key once; then Check again', async () => {
      const calls = controlledStream();
      await mount(lang, { recoveryDelayMs: 60 });
      type('faro');
      key(q('textarea')!, 'Enter');
      await flush();
      await calls[0].lose();
      expect(m.cancelTurn).not.toHaveBeenCalled();
      expect(liveLog().textContent).toBe(T.status.connectionLost);
      await wait(90);
      await flush();
      expect(calls).toHaveLength(2);
      expect(calls[1].key).toBe(calls[0].key);
      expect(q('[data-testid="progress"]')?.textContent).toContain(T.stage.recovering);
      await calls[1].lose();
      await wait(90);
      expect(calls).toHaveLength(2); // only one automatic recovery
      expect(text()).toContain(T.status.connectionLost);
      await act(async () => byText('button', T.status.checkAgain)!.click());
      await flush();
      expect(calls).toHaveLength(3);
      expect(calls[2].key).toBe(calls[0].key);
      await calls[2].terminal({ outcome: 'completed', persisted: true, replayed: true, turnId: 't-new', result: RESULT({ replayed: true }) });
      expect(text()).toContain('Respuesta nueva del libro.');
      expect(m.cancelTurn).not.toHaveBeenCalled();
    });
    it('leaving the page (unmount) aborts delivery only — never calls cancel; the pending key stays for recovery', async () => {
      const calls = controlledStream();
      await mount(lang);
      type('faro');
      key(q('textarea')!, 'Enter');
      await flush();
      await act(async () => root.unmount());
      root = createRoot(container);
      expect(calls[0].signal?.aborted).toBe(true);
      expect(m.cancelTurn).not.toHaveBeenCalled();
      expect(stored().key).toBe(calls[0].key);
    });
  });

  describe('reload recovery (same key)', () => {
    it('a pending question in storage is replayed with its SAME key on load; a replay does not downgrade the history entry', async () => {
      storePending({ key: 'q_reloadkey1', question: '¿Qué es el faro?' });
      const calls = controlledStream();
      await mount(lang);
      expect(calls).toHaveLength(1);
      expect(calls[0].key).toBe('q_reloadkey1');
      expect(q('[data-testid="progress"]')?.textContent).toContain(T.stage.recovering);
      await calls[0].terminal({ outcome: 'completed', persisted: true, replayed: true, turnId: 't-old', result: RESULT({ turnId: 't-old', replayed: true, citations: [[cite({ excerpt: null, sourceState: 'deferred' })]] }) });
      expect(Array.from(container.querySelectorAll('article'))).toHaveLength(1);
      expect(text()).toContain(ANSWER); // the re-validated history entry is kept
      expect(stored()).toBeNull();
    });
  });

  describe('F-D1 — recovery storage lifecycle', () => {
    it('a pending entry of ANOTHER account is not replayed and is purged', async () => {
      storePending({ key: 'q_foreignkey', question: 'ajena' }, { owner: 'user-b' });
      const calls = controlledStream();
      await mount(lang);
      expect(calls).toHaveLength(0);
      expect(stored()).toBeNull();
      expect(text()).not.toContain('ajena');
    });
    it('an EXPIRED entry is not replayed and is purged; a legacy localStorage entry is ignored and purged', async () => {
      storePending({ key: 'q_expiredkey', question: 'vieja' }, { savedAt: Date.now() - research.RECOVERY_TTL_MS - 1000 });
      localStorage.setItem(PKEY, JSON.stringify({ key: 'q_legacykey1', question: 'legado' }));
      const calls = controlledStream();
      await mount(lang);
      expect(calls).toHaveLength(0);
      expect(stored()).toBeNull();
      expect(localStorage.getItem(PKEY)).toBeNull();
    });
    it('signed out → nothing is stored when asking (the turn still runs)', async () => {
      localStorage.removeItem('access_token');
      const calls = controlledStream();
      await mount(lang);
      type('faro');
      key(q('textarea')!, 'Enter');
      await flush();
      expect(calls).toHaveLength(1);
      expect(stored()).toBeNull();
    });
  });

  describe('F-D2 — unknown outcome recovery (same key, no new key)', () => {
    it('Check again replays the unknown turn\'s OWN key immediately — even after a newer question was asked', async () => {
      const calls = controlledStream();
      await mount(lang);
      type('primera');
      key(q('textarea')!, 'Enter');
      await flush();
      await calls[0].terminal({ outcome: 'unknown', statusCode: 502, code: 'turn_failed', status: 'unknown', turnId: 'tu' });
      expect(stored()).toMatchObject({ key: calls[0].key }); // kept for reload recovery
      // a newer question (new key) completes
      type('segunda');
      key(q('textarea')!, 'Enter');
      await flush();
      await calls[1].terminal({ outcome: 'completed', persisted: true, turnId: 't2', result: RESULT({ turnId: 't2' }) });
      // Check again on the unknown turn → its own key and question
      const unknownArticle = Array.from(container.querySelectorAll('article')).find((a) => a.getAttribute('data-status') === 'unknown')!;
      await act(async () => (unknownArticle.querySelector('button') as HTMLButtonElement).click());
      await flush();
      expect(calls).toHaveLength(3);
      expect([calls[2].key, calls[2].question]).toEqual([calls[0].key, 'primera']);
      await calls[2].terminal({ outcome: 'completed', persisted: true, replayed: true, turnId: 'tu', result: RESULT({ turnId: 'tu', replayed: true, segments: [{ origin: 'synthesis', text: 'Recuperada.' }], citations: [[]] }) });
      expect(text()).toContain('Recuperada.');
      expect(container.querySelector('article[data-status="unknown"]')).toBeNull(); // the same turn id was replaced
      expect(m.cancelTurn).not.toHaveBeenCalled();
    });
    it('after a reload, the unknown question is replayed with the SAME key automatically', async () => {
      const calls = controlledStream();
      await mount(lang);
      type('primera');
      key(q('textarea')!, 'Enter');
      await flush();
      await calls[0].terminal({ outcome: 'unknown', statusCode: 502, status: 'unknown', turnId: 'tu' });
      await act(async () => root.unmount());
      root = createRoot(container);
      await mount(lang); // reload
      expect(calls).toHaveLength(2);
      expect([calls[1].key, calls[1].question]).toEqual([calls[0].key, 'primera']);
      expect(q('[data-testid="progress"]')?.textContent).toContain(T.stage.recovering);
    });
  });

  describe('F-D3 — cancellation during recovery never sticks in "Cancelling…"', () => {
    async function polling(pollMs = 40) {
      const calls = controlledStream();
      m.getTurn.mockResolvedValue(view({ turnId: 'tp', status: 'accepted', segments: null, citations: null }));
      await mount(lang, { pollMs });
      type('faro');
      key(q('textarea')!, 'Enter');
      await flush();
      await calls[0].terminal({ outcome: 'pending', statusCode: 409, status: 'accepted', turnId: 'tp' });
      return calls;
    }
    it.each([
      ['cancel_requested', { status: 'cancel_requested' }],
      ['no turn id', { status: 'cancelled' }],
    ])('while polling, cancel returns %s → back to processing and polling resumes, then the outcome shows', async (_n, res) => {
      const calls = await polling();
      m.cancelTurn.mockResolvedValue(res as any);
      await act(async () => byText('button', T.cancel)!.click());
      await flush();
      expect(q('[data-testid="progress"]')?.textContent).toContain(T.stage.processing);
      expect(q('[data-testid="progress"]')?.textContent).not.toContain(T.stage.cancelling);
      const before = m.getTurn.mock.calls.length;
      m.getTurn.mockResolvedValue(view({ turnId: 'tp', status: 'cancelled', segments: null, citations: null }));
      await wait(120);
      await flush();
      expect(m.getTurn.mock.calls.length).toBeGreaterThan(before);
      expect(text()).toContain(T.status.cancelled);
      expect(q('[data-testid="progress"]')).toBeNull();
      expect(calls).toHaveLength(1); // no new stream, no new key
    });
    it('cancel failure while polling → mapped notice and polling resumes (recoverable)', async () => {
      await polling();
      m.cancelTurn.mockRejectedValue(Object.assign(new Error('x'), { status: 503, data: { code: 'budget_unavailable' } }));
      await act(async () => byText('button', T.cancel)!.click());
      await flush();
      expect(q('[data-testid="notice"]')?.textContent).toBe(T.errors.budget_unavailable);
      expect(q('[data-testid="progress"]')?.textContent).toContain(T.stage.processing);
      expect(byText('button', T.cancel)).toBeDefined(); // cancel can be retried
    });
    it('stream open, cancel_requested, but no terminal ever arrives → watchdog drops delivery (not a cancel) and replays the SAME key', async () => {
      const calls = controlledStream();
      m.cancelTurn.mockResolvedValue({ status: 'cancel_requested' });
      await mount(lang, { cancelWatchdogMs: 40, recoveryDelayMs: 5 });
      type('faro');
      key(q('textarea')!, 'Enter');
      await flush();
      await calls[0].stage('composing');
      await act(async () => byText('button', T.cancel)!.click());
      await flush();
      expect(q('[data-testid="progress"]')?.textContent).toContain(T.stage.cancelling);
      await wait(60);
      expect(calls[0].signal?.aborted).toBe(true); // delivery dropped
      await calls[0].lose(); // the aborted fetch resolves as lost
      await wait(30);
      await flush();
      expect(calls).toHaveLength(2);
      expect(calls[1].key).toBe(calls[0].key);
      expect(m.cancelTurn).toHaveBeenCalledTimes(1); // the watchdog itself never cancels
      await calls[1].terminal({ outcome: 'cancelled', turnId: 'tc', reservationRelease: 'released', status: 'cancelled' });
      expect(text()).toContain(T.status.cancelled);
      expect(q('[data-testid="progress"]')).toBeNull();
    });
    it('stream open: when the terminal arrives in time, the watchdog never fires', async () => {
      const calls = controlledStream();
      m.cancelTurn.mockResolvedValue({ status: 'cancel_requested' });
      await mount(lang, { cancelWatchdogMs: 40 });
      type('faro');
      key(q('textarea')!, 'Enter');
      await flush();
      await act(async () => byText('button', T.cancel)!.click());
      await flush();
      await calls[0].terminal({ outcome: 'cancelled', turnId: 'tc', reservationRelease: 'released', status: 'cancelled' });
      await wait(60);
      expect(calls[0].signal?.aborted).toBe(false);
      expect(calls).toHaveLength(1);
    });
  });

  describe('citations and the excerpt dialog (accessible)', () => {
    async function openCitation(c: research.Citation) {
      m.getHistory.mockResolvedValue([view({ citations: [[c], []] })]);
      await mount(lang);
      const btn = q<HTMLButtonElement>('button[aria-haspopup="dialog"]')!;
      expect(btn.getAttribute('aria-label')).toBe(T.citation.button(1, 'El faro'));
      act(() => btn.focus());
      await act(async () => btn.click());
      return btn;
    }
    it('available → dialog with title, verified excerpt, Open book link (book only); focus moves in; Esc closes and returns focus; Esc does not cancel', async () => {
      const btn = await openCitation(cite());
      const dlg = document.querySelector('[role="dialog"]')!;
      expect(dlg.getAttribute('aria-modal')).toBe('true');
      expect(document.getElementById(dlg.getAttribute('aria-labelledby')!)?.textContent).toBe(T.citation.dialogTitle(1));
      expect(dlg.textContent).toContain(EXCERPT);
      expect(dlg.textContent).toContain(T.citation.excerptLabel);
      expect(dlg.querySelector('[data-testid="source-state"]')).toBeNull();
      const link = dlg.querySelector('a')!;
      expect(link.getAttribute('href')).toBe('/reader/b1');
      expect(link.textContent).toBe(T.citation.openBook);
      expect(document.activeElement?.textContent).toBe(T.citation.close);
      key(dlg, 'Escape');
      await flush();
      expect(document.querySelector('[role="dialog"]')).toBeNull();
      expect(document.activeElement).toBe(btn);
      expect(m.cancelTurn).not.toHaveBeenCalled();
    });
    it('focus trap: Tab from the last element wraps to the first, Shift+Tab from the first wraps to the last', async () => {
      await openCitation(cite());
      const dlg = document.querySelector('[role="dialog"]')!;
      const focusables = Array.from(dlg.querySelectorAll<HTMLElement>('a[href], button'));
      const [first, last] = [focusables[0], focusables[focusables.length - 1]];
      act(() => last.focus());
      key(dlg, 'Tab');
      expect(document.activeElement).toBe(first);
      key(dlg, 'Tab', { shiftKey: true });
      expect(document.activeElement).toBe(last);
    });
    it.each([
      ['revoked', false], ['stale', false], ['unavailable', false], ['deferred', false], ['position_unavailable', true],
    ] as const)('sourceState %s → state text; excerpt shown: %s (D-10: never for revoked/changed/missing)', async (state, shows) => {
      await openCitation(cite({ sourceState: state, excerpt: state === 'position_unavailable' ? EXCERPT : null }));
      const dlg = document.querySelector('[role="dialog"]')!;
      expect(dlg.querySelector('[data-testid="source-state"]')?.textContent).toBe(T.citation.state[state]);
      expect(dlg.textContent?.includes(EXCERPT)).toBe(shows);
    });
    it('a revoked citation carrying text (defensive) still shows no excerpt; clicking the backdrop closes', async () => {
      await openCitation(cite({ sourceState: 'revoked', excerpt: EXCERPT }));
      const dlg = document.querySelector('[role="dialog"]')!;
      expect(dlg.textContent).not.toContain(EXCERPT);
      await act(async () => { dlg.parentElement!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); });
      expect(document.querySelector('[role="dialog"]')).toBeNull();
    });
  });

  describe('accessibility basics', () => {
    it('labelled question input with described hint/counter, role="log" polite live region, labelled conversation region', async () => {
      await mount(lang);
      const ta = q('textarea')!;
      expect(q(`label[for="${ta.id}"]`)?.textContent).toBe(T.ask.label);
      expect(ta.getAttribute('aria-describedby')).toBe('research-hint research-counter');
      expect(liveLog().getAttribute('role')).toBe('log');
      expect(liveLog().getAttribute('aria-live')).toBe('polite');
      expect(liveLog().getAttribute('aria-label')).toBe(T.progressLabel);
      expect(q(`section[aria-label="${T.conversation.label}"]`)).not.toBeNull();
      expect(document.title === '' || typeof document.title === 'string').toBe(true);
    });
    it('no untranslated keys or placeholder leaks in any rendered state', async () => {
      m.getHistory.mockResolvedValue([view(), view({ turnId: 'x', status: 'interrupted', segments: null, citations: null })]);
      await mount(lang);
      expect(text()).not.toMatch(/research\.|undefined|\[object|NaN/);
      expect(text()).not.toMatch(/Error:/);
    });
  });
});

describe('language separation', () => {
  it('en and es render different copy for the same state (no hard-coded strings)', async () => {
    await mount('en');
    const enText = text();
    await act(async () => root.unmount());
    root = createRoot(container);
    await mount('es');
    const esText = text();
    expect(enText).toContain(en.research.title);
    expect(esText).toContain(es.research.title);
    expect(esText).not.toContain(en.research.title);
    expect(esText).not.toContain(en.research.ask.label);
  });
});
