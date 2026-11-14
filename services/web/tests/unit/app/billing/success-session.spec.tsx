// /billing/success — G-1 session verification flow (design §R3.5 polling/terminal rules, §R4.4 copy mapping),
// exercised at the NETWORK level: the real page, real lib/checkout-status and real apiFetch run; only global fetch
// is stubbed. Polling runs on Jest fake timers.
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: any) => {
    const React = require('react');
    return React.createElement('a', { href, ...props }, children);
  },
}));
let mockLang: 'en' | 'es' = 'en';
jest.mock('@/lib/i18n', () => {
  const { en } = require('../../../../lib/i18n/en');
  const { es } = require('../../../../lib/i18n/es');
  return { useTranslation: () => ({ t: mockLang === 'en' ? en : es, language: mockLang, setLanguage: jest.fn() }) };
});

import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { en } from '@/lib/i18n/en';
import { es } from '@/lib/i18n/es';
import BillingSuccessPage from '@/app/(billing)/billing/success/page';

(global as any).IS_REACT_ACT_ENVIRONMENT = true;

const API = 'http://localhost:4000';
const SID = 'cs_test_a1B2c3D4e5F6g7H8i9J0';
const STATUS = `/subscriptions/checkout-sessions/${SID}/status`;
type Outcome = { status: number; body?: unknown; headers?: Record<string, string> } | 'network';
let server: { validTokens: Set<string>; status: Outcome[] };
let calls: Array<{ method: string; path: string; auth: string | null; signal?: AbortSignal }>;
let container: HTMLDivElement;
let root: Root;
const originalLocation = window.location;

function installFetch() {
  global.fetch = jest.fn((url: string, init: RequestInit = {}) => {
    const method = (init.method ?? 'GET').toUpperCase();
    const auth = ((init.headers ?? {}) as Record<string, string>).Authorization ?? null;
    const path = url.startsWith(API) ? url.slice(API.length) : url;
    calls.push({ method, path, auth, signal: init.signal ?? undefined });
    const reply = (status: number, body?: unknown, headers: Record<string, string> = {}) =>
      Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body ?? {}), headers: { get: (k: string) => headers[k.toLowerCase()] ?? null } });
    if (method === 'POST' && path === '/auth/refresh') return reply(401, { message: 'Unauthorized' });
    const bearer = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!bearer || !server.validTokens.has(bearer)) return reply(401, { message: 'Unauthorized' });
    if (method !== 'GET' || path !== STATUS) return reply(404, {});
    const next = server.status.length > 1 ? server.status.shift()! : server.status[0];
    if (!next) return reply(503, { error: 'checkout_status_unavailable' });
    if (next === 'network') return Promise.reject(new TypeError('Failed to fetch'));
    return reply(next.status, next.body, next.headers);
  }) as unknown as typeof fetch;
}

const ok = (body: unknown): Outcome => ({ status: 200, body });
const sub = (o: object = {}) => ok({ kind: 'subscription', checkout: 'complete', entitlement: null, ...o });
const tok = (o: object = {}) => ok({ kind: 'tokens', checkout: 'complete', payment: 'paid', delivery: null, ...o });
const book = (o: object = {}) => ok({ kind: 'book', checkout: 'complete', payment: 'paid', delivery: null, ...o });

const view = () => container.querySelector('main')?.getAttribute('data-view');
const copy = () => container.querySelector('[data-copy]')?.getAttribute('data-copy');
const text = () => container.textContent ?? '';
const headings = () => Array.from(container.querySelectorAll('h1')).map((h) => h.textContent);
const flush = () => act(async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); });
const advance = (ms: number) => act(async () => { await jest.advanceTimersByTimeAsync(ms); });
const button = (label: string) => Array.from(container.querySelectorAll('button')).find((b) => b.textContent === label) as HTMLButtonElement | undefined;
const link = (label: string) => Array.from(container.querySelectorAll('a')).find((a) => a.textContent === label) as HTMLAnchorElement | undefined;
const statusCalls = () => calls.filter((c) => c.path === STATUS);

async function render(search = `?session_id=${SID}`) {
  (window as any).location = { href: `http://localhost/billing/success${search}`, search };
  act(() => { root.render(React.createElement(BillingSuccessPage)); });
  await flush();
}

beforeEach(() => {
  jest.useFakeTimers();
  mockLang = 'en';
  server = { validTokens: new Set(['valid']), status: [] };
  calls = [];
  localStorage.clear();
  localStorage.setItem('access_token', 'valid');
  installFetch();
  delete (window as any).location;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  (window as any).location = originalLocation;
  jest.useRealTimers();
});

const S = (lang: 'en' | 'es') => (lang === 'en' ? en : es).billing.success;
const ALL_APPROVED = (lang: 'en' | 'es') => {
  const st = S(lang).status;
  return [st.checkoutOpen, st.checkoutExpired, st.paymentNotConfirmed, st.paidProcessing.tokens, st.tokenPaymentConfirmed, st.paidPending.book, st.delivered.book, st.unconfirmed.book, st.subscriptionActive.body, st.subscriptionEnded, st.subscriptionOther, st.notFound, st.unavailable];
};

describe('request shape and read-only behaviour', () => {
  it('GET /subscriptions/checkout-sessions/:id/status with the Bearer token; never sync, /me or any write', async () => {
    server.status = [tok({ delivery: 'unconfirmed' })];
    await render(`?purchase=tokens&session_id=${SID}`);
    expect(statusCalls()).toHaveLength(1);
    expect(statusCalls()[0]).toMatchObject({ method: 'GET', auth: 'Bearer valid' });
    expect(calls.every((c) => c.method === 'GET' && c.path === STATUS)).toBe(true);
  });

  it('while verifying, a neutral status (the existing "confirming your purchase") — no claim', async () => {
    let release!: () => void;
    (global.fetch as jest.Mock).mockImplementationOnce(() => new Promise((r) => { release = () => r({ ok: true, status: 200, json: async () => ({ kind: 'tokens', checkout: 'complete', payment: 'paid', delivery: 'unconfirmed' }), headers: { get: () => null } }); }));
    await render();
    expect(view()).toBe('checking');
    expect(text()).toBe(en.billing.success.purchaseTitle);
    await act(async () => { release(); });
    await flush();
    expect(copy()).toBe('tokenPaymentConfirmed');
  });
});

describe('§R4.4 state → approved copy (EN and ES); terminal states make one request', () => {
  type Case = [string, Outcome, string, (lang: 'en' | 'es') => string, boolean];
  const cases: Case[] = [
    ['tokens paid + key → tokenPaymentConfirmed', tok({ delivery: 'unconfirmed' }), 'tokenPaymentConfirmed', (l) => S(l).status.tokenPaymentConfirmed, true],
    ['book delivered', book({ delivery: 'delivered' }), 'deliveredBook', (l) => S(l).status.delivered.book, true],
    ['book unconfirmed', book({ delivery: 'unconfirmed' }), 'unconfirmedBook', (l) => S(l).status.unconfirmed.book, true],
    ['expired', tok({ checkout: 'expired', payment: 'unpaid' }), 'checkoutExpired', (l) => S(l).status.checkoutExpired, true],
    ['subscription active', sub({ entitlement: 'active' }), 'subscriptionActive', (l) => S(l).status.subscriptionActive.body, true],
    ['subscription ended', sub({ entitlement: 'ended' }), 'subscriptionEnded', (l) => S(l).status.subscriptionEnded, true],
    ['subscription superseded', sub({ entitlement: 'superseded' }), 'subscriptionOther', (l) => S(l).status.subscriptionOther, true],
    ['subscription payment problem (existing copy)', sub({ entitlement: 'payment_problem' }), 'subscriptionProblem', (l) => S(l).problemBody, true],
    ['404 → notFound', { status: 404, body: { error: 'checkout_session_not_found' } }, 'notFound', (l) => S(l).status.notFound, true],
    // non-terminal → copy after the full budget
    ['open', tok({ checkout: 'open', payment: 'unpaid' }), 'checkoutOpen', (l) => S(l).status.checkoutOpen, false],
    ['complete, unpaid', book({ payment: 'unpaid' }), 'paymentNotConfirmed', (l) => S(l).status.paymentNotConfirmed, false],
    ['tokens paid, no key', tok({ delivery: 'pending' }), 'paidProcessingTokens', (l) => S(l).status.paidProcessing.tokens, false],
    ['book paid, no key', book({ delivery: 'pending' }), 'paidPendingBook', (l) => S(l).status.paidPending.book, false],
    ['subscription not recorded (existing pending copy)', sub({ entitlement: 'not_recorded' }), 'subscriptionPending', (l) => S(l).pendingBody, false],
    ['503 → unavailable', { status: 503, body: { error: 'checkout_status_unavailable' } }, 'unavailable', (l) => S(l).status.unavailable, false],
  ];
  for (const lang of ['en', 'es'] as const) {
    it.each(cases)(`${lang}: %s`, async (_l, outcome, key, message, terminal) => {
      mockLang = lang;
      server.status = [outcome];
      await render();
      if (!terminal) await advance(30_000);
      expect(view()).toBe('session');
      expect(copy()).toBe(key);
      expect(text()).toContain(message(lang));
      expect(statusCalls()).toHaveLength(terminal ? 1 : 11);
      // Exactly one approved G-1 message is on screen (or none, for states using existing copy).
      const shown = ALL_APPROVED(lang).filter((m) => text().includes(m));
      expect(shown.length).toBeLessThanOrEqual(1);
    });
  }

  it('401 (refresh fails) → existing sign-in copy; the link keeps session_id and the permitted purchase; no redirect', async () => {
    localStorage.clear();
    await render(`?purchase=book&session_id=${SID}&evil=1`);
    expect(copy()).toBe('auth');
    expect(text()).toContain(en.billing.success.authTitle);
    expect(link(en.billing.success.signIn)?.getAttribute('href')).toBe(`/login?next=${encodeURIComponent(`/billing/success?session_id=${SID}&purchase=book`)}`);
    expect((window.location as any).href).toContain('/billing/success');
  });

  it('notFound offers sign-in with the session preserved (another account may own it)', async () => {
    server.status = [{ status: 404, body: { error: 'checkout_session_not_found' } }];
    await render();
    expect(link(en.billing.success.signIn)?.getAttribute('href')).toBe(`/login?next=${encodeURIComponent(`/billing/success?session_id=${SID}`)}`);
  });
});

describe('financial-claim restrictions on screen', () => {
  const confirmedEn = /payment is confirmed/i;
  it.each([
    ['open', tok({ checkout: 'open', payment: 'unpaid' })],
    ['expired', book({ checkout: 'expired', payment: 'unpaid' })],
    ['unpaid with key-like delivery', tok({ payment: 'unpaid', delivery: 'unconfirmed' })],
    ['no_payment_required', tok({ payment: 'no_payment_required', delivery: 'unconfirmed' })],
    ['tokens pending', tok({ delivery: 'pending' })],
    ['token `delivered` (contract violation)', tok({ delivery: 'delivered' })],
    ['subscription active', sub({ entitlement: 'active' })],
    ['503', { status: 503, body: {} }],
    ['429', { status: 429, body: {} }],
    ['404', { status: 404, body: {} }],
    ['network', 'network'],
  ] as Array<[string, Outcome]>)('%s → neither approved payment-confirmed message, no token-delivery claim', async (_l, outcome) => {
    server.status = [outcome];
    await render();
    await advance(60_000);
    expect(text()).not.toMatch(confirmedEn);
    expect(text()).not.toContain(en.billing.success.status.tokenPaymentConfirmed);
    expect(text()).not.toMatch(/tokens? (have been|were) added|added to your balance/i);
  });

  it('the Spanish token message never appears outside its state either', async () => {
    mockLang = 'es';
    server.status = [tok({ delivery: 'pending' })];
    await render();
    await advance(30_000);
    expect(text()).not.toContain(es.billing.success.status.tokenPaymentConfirmed);
    expect(text()).not.toMatch(/pago está confirmado/i);
  });

  it('book delivery copy only with `delivered` (durable ownership evidence)', async () => {
    for (const delivery of ['pending', 'unconfirmed', null]) {
      calls = [];
      server.status = [book({ delivery })];
      act(() => root.unmount());
      root = createRoot(container);
      await render();
      await advance(30_000);
      expect(text()).not.toContain(en.billing.success.status.delivered.book);
    }
  });

  it('?purchase= cannot override the verified kind', async () => {
    server.status = [sub({ entitlement: 'active' })];
    await render(`?purchase=tokens&session_id=${SID}`);
    expect(copy()).toBe('subscriptionActive');
    expect(text()).not.toContain(en.billing.success.status.tokenPaymentConfirmed);
  });

  it('a token response under ?purchase=book renders token copy', async () => {
    server.status = [tok({ delivery: 'unconfirmed' })];
    await render(`?purchase=book&session_id=${SID}`);
    expect(copy()).toBe('tokenPaymentConfirmed');
  });

  it('subscription active uses the existing title + approved body; never the retired "full access" body or tokens', async () => {
    server.status = [sub({ entitlement: 'active' })];
    await render();
    expect(headings()).toEqual([en.billing.success.title]);
    expect(text()).toContain(en.billing.success.status.subscriptionActive.body);
    expect(text()).not.toContain(en.billing.success.body);
    expect(text()).not.toMatch(/token/i);
  });

  it('no new headings: G-1 messages render without an <h1>, and the "confirming" title never heads a result', async () => {
    for (const outcome of [tok({ delivery: 'unconfirmed' }), book({ delivery: 'delivered' }), book({ delivery: 'unconfirmed' }), tok({ checkout: 'expired', payment: 'unpaid' }), sub({ entitlement: 'ended' }), sub({ entitlement: 'superseded' }), { status: 404, body: {} } as Outcome]) {
      calls = [];
      server.status = [outcome];
      act(() => root.unmount());
      root = createRoot(container);
      await render();
      expect(headings()).toEqual([]);
      expect(text()).not.toContain(en.billing.success.purchaseTitle);
    }
  });
});

describe('G-b gifts', () => {
  it('?purchase=gift with a session id → no request at all, existing generic copy, nothing personal', async () => {
    await render(`?purchase=gift&session_id=${SID}`);
    await advance(60_000);
    expect(calls).toHaveLength(0);
    expect(text()).toContain(en.billing.success.purchaseBody.gift);
    expect(text()).not.toMatch(new RegExp(`${SID}|@|\\$\\d`));
  });
});

describe('polling: budget, transitions, retry, cancellation', () => {
  it('open forever → exactly 11 requests over ~30 s, then checkoutOpen + Check again; nothing more after', async () => {
    server.status = [tok({ checkout: 'open', payment: 'unpaid' })];
    await render();
    await advance(29_999);
    expect(view()).toBe('checking');
    await advance(1);
    expect(view()).toBe('session');
    expect(statusCalls()).toHaveLength(11);
    await advance(120_000);
    expect(statusCalls()).toHaveLength(11);
    expect(button(en.billing.success.checkAgain)).toBeDefined();
  });

  it('schedule: 1 immediately, +5 over the next 10 s (2 s apart), +5 over the following 20 s (4 s apart)', async () => {
    server.status = [tok({ delivery: 'pending' })];
    await render();
    expect(statusCalls()).toHaveLength(1);
    await advance(2000);
    expect(statusCalls()).toHaveLength(2);
    await advance(8000);
    expect(statusCalls()).toHaveLength(6);
    await advance(4000);
    expect(statusCalls()).toHaveLength(7);
    await advance(16_000);
    expect(statusCalls()).toHaveLength(11);
  });

  it('open is not terminal: open → complete during polling reaches the right state and stops', async () => {
    server.status = [tok({ checkout: 'open', payment: 'unpaid' }), tok({ checkout: 'open', payment: 'unpaid' }), tok({ delivery: 'pending' }), tok({ delivery: 'unconfirmed' })];
    await render();
    await advance(6000);
    expect(copy()).toBe('tokenPaymentConfirmed');
    expect(statusCalls()).toHaveLength(4);
    await advance(60_000);
    expect(statusCalls()).toHaveLength(4);
  });

  it('503 backs off inside the budget, then a success is shown', async () => {
    server.status = [{ status: 503, body: {} }, { status: 503, body: {} }, book({ delivery: 'delivered' })];
    await render();
    await advance(4000);
    expect(copy()).toBe('deliveredBook');
    expect(statusCalls()).toHaveLength(3);
  });

  it('429 honours Retry-After (Retry-After-global from the API throttler)', async () => {
    server.status = [{ status: 429, body: {}, headers: { 'retry-after-global': '10' } }, tok({ delivery: 'unconfirmed' })];
    await render();
    await advance(9_999);
    expect(statusCalls()).toHaveLength(1); // not after the scheduled 2 s
    await advance(1);
    expect(statusCalls()).toHaveLength(2);
    expect(copy()).toBe('tokenPaymentConfirmed');
  });

  it('429 throughout never exceeds 11 requests and ends on "unavailable"', async () => {
    server.status = [{ status: 429, body: {}, headers: { 'retry-after': '1' } }];
    await render();
    await advance(120_000);
    expect(statusCalls()).toHaveLength(11);
    expect(copy()).toBe('unavailable');
  });

  it('network failures → unavailable after the budget; Check again starts a new budget of at most 11', async () => {
    server.status = ['network'];
    await render();
    await advance(30_000);
    expect(copy()).toBe('unavailable');
    expect(statusCalls()).toHaveLength(11);
    server.status = [tok({ delivery: 'unconfirmed' })];
    await act(async () => { button(en.billing.success.checkAgain)!.click(); });
    await flush();
    expect(copy()).toBe('tokenPaymentConfirmed');
    expect(statusCalls()).toHaveLength(12);
  });

  it('unmount during polling → in-flight request aborted, no further requests, no state update after unmount', async () => {
    const errors = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    server.status = [tok({ delivery: 'pending' })];
    await render();
    expect(statusCalls()).toHaveLength(1);
    const signal = statusCalls()[0].signal!;
    act(() => root.unmount());
    expect(signal.aborted).toBe(true);
    await act(async () => { await jest.advanceTimersByTimeAsync(60_000); });
    expect(statusCalls()).toHaveLength(1);
    expect(errors.mock.calls.flat().join(' ')).not.toMatch(/unmounted|not wrapped in act/i);
    errors.mockRestore();
    root = createRoot(container); // afterEach unmounts again
  });

  it('Check again aborts nothing stale: a superseded run never overwrites the newer result', async () => {
    server.status = [tok({ checkout: 'open', payment: 'unpaid' })];
    await render();
    await advance(30_000);
    expect(copy()).toBe('checkoutOpen');
    // New run returns a terminal state immediately; the old run is already finished and cannot interfere.
    server.status = [tok({ delivery: 'unconfirmed' })];
    await act(async () => { button(en.billing.success.checkAgain)!.click(); });
    await flush();
    await advance(60_000);
    expect(copy()).toBe('tokenPaymentConfirmed');
  });
});
