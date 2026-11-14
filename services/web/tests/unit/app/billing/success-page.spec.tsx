// /billing/success — post-payment confirmation, exercised at the NETWORK level: the real page and the real
// apiFetch (Bearer header, shared refresh) run; only global fetch is stubbed, enforcing the API contract
// (JWT from the Authorization: Bearer header only). Polling runs on Jest fake timers.
// This file covers the flows WITHOUT a Checkout session id (unchanged by G-1) and the G-b gift rule; the G-1
// session-verification flow is in success-session.spec.tsx.
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
type Outcome = { status: number; body?: unknown } | 'network';
let server: { validTokens: Set<string>; refreshIssues: string | null; sync: Outcome[]; me: Outcome[] };
let calls: Array<{ method: string; path: string; auth: string | null }>;
let container: HTMLDivElement;
let root: Root;
const originalLocation = window.location;

function res(status: number, body?: unknown) {
  return Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body ?? {}) });
}

function installFetch() {
  global.fetch = jest.fn((url: string, init: RequestInit = {}) => {
    const method = (init.method ?? 'GET').toUpperCase();
    const auth = ((init.headers ?? {}) as Record<string, string>).Authorization ?? null;
    const path = url.startsWith(API) ? url.slice(API.length) : url;
    calls.push({ method, path, auth });
    if (method === 'POST' && path === '/auth/refresh') {
      if (!server.refreshIssues) return res(401, { message: 'Unauthorized' });
      server.validTokens.add(server.refreshIssues);
      return res(200, { accessToken: server.refreshIssues });
    }
    const bearer = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!bearer || !server.validTokens.has(bearer)) return res(401, { message: 'Unauthorized' });
    const queue = method === 'POST' && path === '/subscriptions/sync' ? server.sync : method === 'GET' && path === '/subscriptions/me' ? server.me : null;
    if (!queue) return res(404, {});
    const next = queue.length > 1 ? queue.shift()! : queue[0] ?? { status: 200, body: { status: 'none' } };
    if (next === 'network') return Promise.reject(new TypeError('Failed to fetch'));
    return res(next.status, next.body);
  }) as unknown as typeof fetch;
}

const ok = (status: string): Outcome => ({ status: 200, body: { status } });
const view = () => container.querySelector('main')?.getAttribute('data-view');
const text = () => container.textContent ?? '';
const flush = () => act(async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); });
const advance = (ms: number) => act(async () => { await jest.advanceTimersByTimeAsync(ms); });
const button = (label: string) => Array.from(container.querySelectorAll('button')).find((b) => b.textContent === label) as HTMLButtonElement;
const link = (label: string) => Array.from(container.querySelectorAll('a')).find((a) => a.textContent === label) as HTMLAnchorElement | undefined;
const req = (method: string, path: string) => calls.filter((c) => c.method === method && c.path === path);

async function render(search = '') {
  (window as any).location = { href: `http://localhost/billing/success${search}`, search };
  act(() => { root.render(React.createElement(BillingSuccessPage)); });
  await flush();
}

beforeEach(() => {
  jest.useFakeTimers();
  mockLang = 'en';
  server = { validTokens: new Set(['valid']), refreshIssues: null, sync: [], me: [] };
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

describe('/billing/success — account-status flow without a session id (unchanged by G-1)', () => {
  it('shows a neutral "confirming" state first — never "activated" while the request is in flight', async () => {
    let release!: () => void;
    (global.fetch as jest.Mock).mockImplementationOnce(() => new Promise((r) => { release = () => r({ ok: true, status: 200, json: async () => ({ status: 'trialing' }) }); }));
    await render();
    expect(view()).toBe('checking');
    expect(text()).toContain(en.billing.success.checking);
    expect(text()).not.toContain(en.billing.success.title);
    await act(async () => { release(); });
    await flush();
    expect(view()).toBe('confirmed');
  });

  it.each(['active', 'trialing', 'canceling'])('sync reports %s → confirmed (Bearer sent, no polling)', async (status) => {
    server.sync = [ok(status)];
    await render();
    expect(view()).toBe('confirmed');
    expect(text()).toContain(en.billing.success.title);
    expect(req('POST', '/subscriptions/sync')[0].auth).toBe('Bearer valid');
    expect(req('GET', '/subscriptions/me')).toHaveLength(0);
  });

  it('webhook not processed yet (sync → none) → polls /subscriptions/me and confirms once the webhook lands', async () => {
    server.sync = [ok('none')];
    server.me = [ok('none'), ok('trialing')];
    await render();
    expect(view()).toBe('checking');
    await advance(3000);
    expect(view()).toBe('checking');
    await advance(3000);
    expect(view()).toBe('confirmed');
    expect(req('GET', '/subscriptions/me')).toHaveLength(2);
  });

  it('polling is bounded: after 5 attempts → "pending" (never "activated"); Check again restarts verification', async () => {
    server.sync = [ok('none')];
    server.me = [ok('none')];
    await render();
    await advance(5 * 3000);
    expect(view()).toBe('pending');
    expect(text()).toContain(en.billing.success.pendingTitle);
    expect(text()).not.toContain(en.billing.success.title);
    expect(req('GET', '/subscriptions/me')).toHaveLength(5);
    await advance(60_000);
    expect(req('GET', '/subscriptions/me')).toHaveLength(5); // no unbounded polling
    expect(link(en.billing.success.viewBilling)?.getAttribute('href')).toBe('/account/billing');
    server.sync = [ok('active')];
    await act(async () => { button(en.billing.success.checkAgain).click(); });
    await flush();
    expect(view()).toBe('confirmed');
  });

  it('past_due → payment problem with a link to billing', async () => {
    server.sync = [ok('past_due')];
    await render();
    expect(view()).toBe('problem');
    expect(text()).toContain(en.billing.success.problemTitle);
    expect(link(en.billing.success.viewBilling)?.getAttribute('href')).toBe('/account/billing');
  });

  it('sync 500 → verification error with retry (no "activated"); retry succeeds', async () => {
    server.sync = [{ status: 500, body: { message: 'boom' } }, ok('trialing')];
    await render();
    expect(view()).toBe('error');
    expect(text()).not.toContain(en.billing.success.title);
    await act(async () => { button(en.billing.retry).click(); });
    await flush();
    expect(view()).toBe('confirmed');
  });

  it('network failure → verification error (not "pending", not "activated")', async () => {
    server.sync = ['network'];
    await render();
    expect(view()).toBe('error');
  });

  it('a failure while polling → verification error', async () => {
    server.sync = [ok('none')];
    server.me = [{ status: 502, body: {} }];
    await render();
    await advance(3000);
    expect(view()).toBe('error');
  });

  it('no session (401, refresh fails) → sign-in prompt that returns here; no automatic redirect', async () => {
    localStorage.clear();
    await render();
    expect(view()).toBe('auth');
    expect(link(en.billing.success.signIn)?.getAttribute('href')).toBe('/login?next=%2Fbilling%2Fsuccess');
    expect((window.location as any).href).toContain('/billing/success');
  });

  it('expired access token + valid refresh session → refreshes once and confirms with the new token', async () => {
    localStorage.setItem('access_token', 'expired');
    server.refreshIssues = 'fresh';
    server.sync = [ok('trialing')];
    await render();
    expect(req('POST', '/auth/refresh')).toHaveLength(1);
    expect(req('POST', '/subscriptions/sync').pop()?.auth).toBe('Bearer fresh');
    expect(view()).toBe('confirmed');
  });

  it('only reads state: the page never calls checkout or any other write endpoint', async () => {
    server.sync = [ok('none')];
    server.me = [ok('none')];
    await render();
    await advance(5 * 3000);
    const paths = new Set(calls.map((c) => `${c.method} ${c.path}`));
    expect([...paths].sort()).toEqual(['GET /subscriptions/me', 'POST /subscriptions/sync']);
  });

  it('Spanish copy', async () => {
    mockLang = 'es';
    server.sync = [ok('none')];
    server.me = [ok('none')];
    await render();
    expect(text()).toContain(es.billing.success.checking);
    await advance(5 * 3000);
    expect(text()).toContain(es.billing.success.pendingTitle);
  });
});

describe('/billing/success — one-time purchases (?purchase=…)', () => {
  it.each([['tokens', ''], ['book', ''], ['gift', ''], ['gift', '&session_id=cs_test_synthetic1234']] as const)('purchase=%s%s (no verifiable session, or G-b gift) → neutral "confirming your purchase", no API calls', async (kind, extra) => {
    await render(`?purchase=${kind}${extra}`);
    expect(view()).toBe('purchase');
    expect(text()).toContain(en.billing.success.purchaseTitle);
    expect(text()).toContain(en.billing.success.purchaseBody[kind]);
    expect(text()).not.toContain(en.billing.success.title);
    expect(calls).toHaveLength(0);
  });

  it('an unauthenticated gift buyer sees only generic copy — no account or transaction details, no API calls', async () => {
    await render('?purchase=gift&session_id=cs_test_someone_else');
    expect(text()).toContain(en.billing.success.purchaseBody.gift);
    expect(text()).not.toMatch(/cs_test_someone_else|@|\$\d/);
    expect(calls).toHaveLength(0);
  });

  it('an unknown purchase value falls back to subscription verification', async () => {
    server.sync = [ok('active')];
    await render('?purchase=other');
    expect(view()).toBe('confirmed');
  });
});

describe('/billing/success — copy never claims an unverified payment (PR #60 P1)', () => {
  const flatten = (v: unknown): string[] => (typeof v === 'string' ? [v] : typeof v === 'object' && v ? Object.values(v).flatMap(flatten) : []);
  it.each([['en', en], ['es', es]] as const)('%s: no billing.success string says the payment was received', (_lang, dict) => {
    const strings = flatten(dict.billing.success).join(' | ');
    expect(strings).not.toMatch(/payment received|pago recibido|won't be charged again|no se te cobrará de nuevo|activated|activada/i);
  });
});
