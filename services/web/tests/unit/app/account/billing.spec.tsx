// /account/billing — exercised at the NETWORK level: the real page and the real apiFetch (Bearer header, shared
// refresh) run; only global fetch is stubbed, enforcing the API contract (JWT from the Bearer header only).
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
import BillingSettingsPage from '@/app/(account)/account/billing/page';

(global as any).IS_REACT_ACT_ENVIRONMENT = true;

const API = 'http://localhost:4000';
const LOGIN = '/login?next=%2Faccount%2Fbilling';
type Reply = { status: number; body?: unknown } | 'network';
type Route = `${string} ${string}`;

let server: {
  validTokens: Set<string>;
  refreshIssues: string | null;
  sub: Record<string, unknown>;
  linked: Record<string, unknown> | null;
  overrides: Map<Route, Reply[]>;
};
let calls: Array<{ route: Route; auth: string | null; body?: string }>;
let container: HTMLDivElement;
let root: Root;
const originalLocation = window.location;

const SUBSCRIBER = { status: 'active', planId: 'p-duo', planName: 'Duo', maxProfiles: 2, currentPeriodEnd: '2026-12-12T00:00:00Z', tokenBalance: 1 };
const LINKED = { linkedUsers: [{ id: 'm1', name: 'Member One', email: 'member@test.invalid', avatarUrl: null }], pendingInvites: [{ id: 'inv1', email: 'invitee@test.invalid', expiresAt: '2026-12-01T00:00:00Z' }], maxProfiles: 3, isOwner: true };

function res(status: number, body?: unknown) {
  return Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body ?? {}) });
}

function installFetch() {
  global.fetch = jest.fn((url: string, init: RequestInit = {}) => {
    const method = (init.method ?? 'GET').toUpperCase();
    const auth = ((init.headers ?? {}) as Record<string, string>).Authorization ?? null;
    const path = url.startsWith(API) ? url.slice(API.length) : url;
    const route = `${method} ${path}` as Route;
    calls.push({ route, auth, body: init.body as string | undefined });
    if (route === 'POST /auth/refresh') {
      if (!server.refreshIssues) return res(401, { message: 'Unauthorized' });
      server.validTokens.add(server.refreshIssues);
      return res(200, { accessToken: server.refreshIssues });
    }
    const bearer = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!bearer || !server.validTokens.has(bearer)) return res(401, { message: 'Unauthorized' });
    const queued = server.overrides.get(route);
    if (queued?.length) {
      const r = queued.shift()!;
      if (r === 'network') return Promise.reject(new TypeError('Failed to fetch'));
      return res(r.status, r.body);
    }
    if (route === 'GET /subscriptions/me') return res(200, server.sub);
    if (route === 'GET /subscriptions/linked-users') return server.linked ? res(200, server.linked) : res(404, { error: 'no_subscription' });
    if (route === 'POST /subscriptions/portal') return res(201, { url: 'https://billing.stripe.test/session' });
    if (route === 'POST /subscriptions/sync') return res(201, server.sub);
    if (route === 'POST /subscriptions/resume') { server.sub = { ...server.sub, status: 'active' }; return res(201, server.sub); }
    if (route === 'POST /subscriptions/invite') return res(201, { id: 'inv2' });
    if (route.startsWith('DELETE /subscriptions/linked-users/')) { server.linked = { ...LINKED, linkedUsers: [] }; return res(200, {}); }
    if (route.startsWith('DELETE /subscriptions/invite/')) { server.linked = { ...LINKED, pendingInvites: [] }; return res(200, {}); }
    return res(404, {});
  }) as unknown as typeof fetch;
}

const flush = () => act(async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); });
const text = () => container.textContent ?? '';
const button = (label: string) => Array.from(container.querySelectorAll('button')).find((b) => b.textContent === label) as HTMLButtonElement | undefined;
const click = async (el: HTMLElement | undefined) => { if (!el) throw new Error('element not found'); act(() => { el.click(); }); await flush(); };
const routeCalls = (route: Route) => calls.filter((c) => c.route === route);
const href = () => (window.location as any).href as string;
const actionError = () => container.querySelector('[data-testid="billing-action-error"]')?.textContent;
const notice = () => container.querySelector('[data-testid="billing-notice"]')?.textContent;
const reply = (route: Route, ...r: Reply[]) => server.overrides.set(route, r);
function fillEmail(value: string) {
  const input = container.querySelector('input[type="email"]') as HTMLInputElement;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function render() {
  act(() => { root.render(React.createElement(BillingSettingsPage)); });
  await flush();
}

beforeEach(() => {
  mockLang = 'en';
  server = { validTokens: new Set(['valid']), refreshIssues: null, sub: { ...SUBSCRIBER }, linked: { ...LINKED }, overrides: new Map() };
  calls = [];
  localStorage.clear();
  localStorage.setItem('access_token', 'valid');
  installFetch();
  delete (window as any).location;
  (window as any).location = { href: 'http://localhost/account/billing' };
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  (window as any).location = originalLocation;
});

describe('/account/billing — loading the subscription', () => {
  it('a subscriber sees the plan card; status and members are requested with Bearer', async () => {
    await render();
    expect(text()).toContain('Duo');
    expect(text()).toContain(en.billing.statuses.active);
    expect(text()).not.toContain(en.billing.noPlan);
    expect(routeCalls('GET /subscriptions/me')[0].auth).toBe('Bearer valid');
    expect(routeCalls('GET /subscriptions/linked-users')[0].auth).toBe('Bearer valid');
    expect(text()).toContain(en.billing.members.title);
  });

  it('a user with no subscription sees "no active plan" (only when the API says so)', async () => {
    server.sub = { status: 'none' };
    server.linked = null;
    await render();
    expect(text()).toContain(en.billing.noPlan);
  });

  it.each<[string, Reply]>([['500', { status: 500, body: { message: 'boom' } }], ['network', 'network'], ['malformed', { status: 200, body: {} }]])(
    'status request failure (%s) is NEVER shown as "no active plan" → error with retry; retry recovers',
    async (_label, failure) => {
      reply('GET /subscriptions/me', failure);
      await render();
      expect(container.querySelector('[data-testid="billing-load-error"]')).not.toBeNull();
      expect(text()).toContain(en.billing.loadError);
      expect(text()).not.toContain(en.billing.noPlan);
      expect(text()).not.toContain(en.billing.viewPlans);
      await click(button(en.billing.retry));
      expect(text()).toContain('Duo');
    },
  );

  it('expired access token + valid refresh session → one refresh, then everything loads with the new token', async () => {
    localStorage.setItem('access_token', 'expired');
    server.refreshIssues = 'fresh';
    await render();
    expect(routeCalls('POST /auth/refresh')).toHaveLength(1);
    expect(routeCalls('GET /subscriptions/me').pop()?.auth).toBe('Bearer fresh');
    expect(text()).toContain('Duo');
  });

  it('no session (401, refresh fails) → login with a return path, not "no active plan"', async () => {
    localStorage.clear();
    await render();
    expect(href()).toBe(LOGIN);
  });

  it('linked-users failure does not hide the plan (members card omitted)', async () => {
    reply('GET /subscriptions/linked-users', { status: 500, body: {} });
    server.sub = { ...SUBSCRIBER, maxProfiles: 1 };
    await render();
    expect(text()).toContain('Duo');
  });

  it('Spanish copy is unchanged for Spanish readers; English readers get English', async () => {
    mockLang = 'es';
    await render();
    expect(text()).toContain(es.billing.title);
    expect(text()).toContain(es.billing.manageBilling);
    expect(text()).toContain(es.billing.statuses.active);
  });
});

describe('/account/billing — actions', () => {
  it('Manage billing → Bearer POST /subscriptions/portal → navigates to the returned URL', async () => {
    await render();
    await click(button(en.billing.manageBilling));
    expect(routeCalls('POST /subscriptions/portal')[0].auth).toBe('Bearer valid');
    expect(href()).toBe('https://billing.stripe.test/session');
  });

  it.each<[string, Reply]>([['no url', { status: 201, body: {} }], ['404 no_billing_account', { status: 404, body: { error: 'no_billing_account' } }], ['network', 'network']])(
    'portal failure (%s) → error message; never navigates to /undefined',
    async (_label, failure) => {
      reply('POST /subscriptions/portal', failure);
      await render();
      await click(button(en.billing.manageBilling));
      expect(href()).toBe('http://localhost/account/billing');
      expect(actionError()).toBe(en.billing.portalError);
    },
  );

  it('portal with an expired session → login with a return path', async () => {
    await render();
    server.validTokens.clear();
    await click(button(en.billing.manageBilling));
    expect(href()).toBe(LOGIN);
  });

  it('Refresh status → Bearer POST /subscriptions/sync, reloads state, confirms', async () => {
    await render();
    const before = routeCalls('GET /subscriptions/me').length;
    await click(button(en.billing.refreshStatus));
    expect(routeCalls('POST /subscriptions/sync')[0].auth).toBe('Bearer valid');
    expect(routeCalls('GET /subscriptions/me').length).toBe(before + 1);
    expect(notice()).toBe(en.billing.refreshed);
  });

  it('Refresh failure → error, state kept', async () => {
    reply('POST /subscriptions/sync', { status: 503, body: {} });
    await render();
    await click(button(en.billing.refreshStatus));
    expect(actionError()).toBe(en.billing.actionError);
    expect(text()).toContain('Duo');
  });

  it('Resume (canceling) → Bearer POST /subscriptions/resume, refreshed to active', async () => {
    server.sub = { ...SUBSCRIBER, status: 'canceling' };
    await render();
    expect(text()).toContain(en.billing.accessEnds);
    await click(button(en.billing.resumeSubscription));
    expect(routeCalls('POST /subscriptions/resume')[0].auth).toBe('Bearer valid');
    expect(text()).toContain(en.billing.statuses.active);
    expect(notice()).toBe(en.billing.resumed);
  });

  it('Resume failure → error', async () => {
    server.sub = { ...SUBSCRIBER, status: 'canceling' };
    reply('POST /subscriptions/resume', { status: 500, body: {} });
    await render();
    await click(button(en.billing.resumeSubscription));
    expect(actionError()).toBe(en.billing.actionError);
  });

  it('Invite → Bearer POST with the email; success message and reload', async () => {
    await render();
    await click(button(en.billing.members.invite));
    fillEmail('new@test.invalid');
    await click(button(en.billing.members.sendInvite));
    const [c] = routeCalls('POST /subscriptions/invite');
    expect(c.auth).toBe('Bearer valid');
    expect(c.body).toBe(JSON.stringify({ email: 'new@test.invalid' }));
    expect(text()).toContain(en.billing.members.inviteSent);
  });

  it.each<[string, Reply, string]>([
    ['plan_full', { status: 400, body: { error: 'plan_full' } }, en.billing.members.errors.planFull],
    ['no sharing', { status: 400, body: { error: 'plan_does_not_support_sharing' } }, en.billing.members.errors.noSharing],
    ['other', { status: 500, body: {} }, en.billing.members.errors.generic],
  ])('Invite failure (%s) → specific message', async (_l, failure, message) => {
    reply('POST /subscriptions/invite', failure);
    await render();
    await click(button(en.billing.members.invite));
    fillEmail('new@test.invalid');
    await click(button(en.billing.members.sendInvite));
    expect(text()).toContain(message);
  });

  it('Remove member → Bearer DELETE, member list refreshed, confirmation', async () => {
    await render();
    expect(text()).toContain('Member One');
    await click(button(en.billing.members.remove));
    expect(routeCalls('DELETE /subscriptions/linked-users/m1')[0].auth).toBe('Bearer valid');
    expect(text()).not.toContain('Member One');
    expect(notice()).toBe(en.billing.members.removed);
  });

  it('Revoke invitation → Bearer DELETE, refreshed, confirmation; failure → error', async () => {
    await render();
    await click(button(en.billing.members.revoke));
    expect(routeCalls('DELETE /subscriptions/invite/inv1')[0].auth).toBe('Bearer valid');
    expect(text()).not.toContain('invitee@test.invalid');
    expect(notice()).toBe(en.billing.members.revoked);
  });

  it('Remove failure → error, member still listed', async () => {
    reply('DELETE /subscriptions/linked-users/m1', { status: 500, body: {} });
    await render();
    await click(button(en.billing.members.remove));
    expect(actionError()).toBe(en.billing.actionError);
    expect(text()).toContain('Member One');
  });
});
