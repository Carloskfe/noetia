// /pricing authentication + Causas flow, exercised at the NETWORK level: the real apiFetch (Bearer header,
// shared refresh) and the real CauseSelector run; only global fetch is stubbed. The stub enforces the API's
// verified contract — JWT from the Authorization: Bearer header only; 401 otherwise; "no preference" is a
// 200 with an EMPTY body (pinned by services/api/tests/unit/subscriptions/subscriptions-auth.contract.spec.ts).
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: any) => {
    const React = require('react');
    return React.createElement('a', { href, ...props }, children);
  },
}));
jest.mock('@/lib/i18n', () => {
  const { en } = require('../../../../lib/i18n/en');
  return { useTranslation: () => ({ t: en, language: 'en', setLanguage: jest.fn() }) };
});

import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { en } from '@/lib/i18n/en';
import PricingPage from '@/app/(billing)/pricing/page';

(global as any).IS_REACT_ACT_ENVIRONMENT = true;

const API = 'http://localhost:4000';
const PLAN = { id: 'plan-ind', name: 'Individual', amountCents: 899, interval: 'month', tokensPerCycle: 1, maxProfiles: 1 };
const PKG = { id: 'pkg-1', name: 'One', tokenCount: 1, amountCents: 499 };
const CAUSE = { id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301', slug: 'medio-ambiente', name: 'Medio Ambiente', description: 'd' };
const LOGIN = '/login?next=/pricing';

type Server = {
  validTokens: Set<string>;
  refreshIssues: string | null;        // token issued by /auth/refresh (valid refresh session), or null
  savedCause: string | null;
  prefLookup: Array<'ok' | 'fail'>;    // queued outcomes for GET /causes/preferences (default ok)
  saveResults: Array<'ok' | 'fail'>;   // queued outcomes for POST /causes/preferences (default ok)
  checkoutStatus: number;
  planId: string | null;
};

let server: Server;
let calls: Array<{ method: string; url: string; auth: string | null; body?: string }>;
let container: HTMLDivElement;
let root: Root;
const originalLocation = window.location;

function res(status: number, body?: unknown) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => (body === undefined ? Promise.reject(new SyntaxError('Unexpected end of JSON input')) : Promise.resolve(body)),
  });
}

function installFetch() {
  global.fetch = jest.fn((url: string, init: RequestInit = {}) => {
    const method = (init.method ?? 'GET').toUpperCase();
    const auth = ((init.headers ?? {}) as Record<string, string>).Authorization ?? null;
    calls.push({ method, url, auth, body: init.body as string | undefined });
    const path = url.startsWith(API) ? url.slice(API.length) : url.startsWith('/api/') ? url.slice(4) : url;
    const bearer = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    const authed = !!bearer && server.validTokens.has(bearer);

    if (method === 'GET' && path === '/subscriptions/plans') return res(200, [PLAN]);
    if (method === 'GET' && path === '/subscriptions/token-packages') return res(200, [PKG]);
    if (method === 'GET' && path === '/causes') return res(200, [CAUSE]);
    if (method === 'POST' && path === '/auth/refresh') {
      if (!server.refreshIssues) return res(401, { message: 'Unauthorized' });
      server.validTokens.add(server.refreshIssues);
      return res(200, { accessToken: server.refreshIssues });
    }
    if (!authed) return res(401, { message: 'Unauthorized', statusCode: 401 });
    if (method === 'GET' && path === '/subscriptions/me') return res(200, { planId: server.planId });
    if (method === 'GET' && path === '/causes/preferences') {
      if ((server.prefLookup.shift() ?? 'ok') === 'fail') return res(500, { message: 'boom' });
      return server.savedCause
        ? res(200, { userId: 'u', cause1Id: server.savedCause, cause2Id: null, randomDistribution: false })
        : res(200); // no preference: 200 with an empty body
    }
    if (method === 'POST' && path === '/causes/preferences') {
      if ((server.saveResults.shift() ?? 'ok') === 'fail') return res(500, { message: 'boom' });
      server.savedCause = JSON.parse(init.body as string).cause1Id;
      return res(200, { ok: true });
    }
    if (method === 'POST' && path === '/subscriptions/checkout') {
      return server.checkoutStatus === 200 ? res(200, { url: 'https://checkout.test/sub' }) : res(server.checkoutStatus, { message: 'x' });
    }
    if (method === 'POST' && path === '/subscriptions/tokens/purchase') return res(200, { url: 'https://checkout.test/tokens' });
    return res(404, {});
  }) as unknown as typeof fetch;
}

const flush = () => act(async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); });
const buttons = () => Array.from(container.querySelectorAll('button'));
const byText = (label: string) => buttons().find((b) => b.textContent === label) as HTMLButtonElement | undefined;
const click = async (el: HTMLElement | undefined) => {
  if (!el) throw new Error('element not found');
  act(() => { el.click(); });
  await flush();
};
const planButton = () => byText(en.pricing.startTrial) ?? byText(en.pricing.currentPlan);
const req = (method: string, path: string) => calls.filter((c) => c.method === method && (c.url === API + path || c.url === '/api' + path));
const href = () => (window.location as any).href as string;
const selectorOpen = () => !!container.querySelector('input[type="radio"]');
const lookupDialogOpen = () => !!container.querySelector('[data-testid="pref-lookup-dialog"]');

async function render() {
  act(() => { root.render(React.createElement(PricingPage)); });
  await flush();
}

beforeEach(() => {
  server = { validTokens: new Set(['valid']), refreshIssues: null, savedCause: null, prefLookup: [], saveResults: [], checkoutStatus: 200, planId: null };
  calls = [];
  localStorage.clear();
  installFetch();
  delete (window as any).location;
  (window as any).location = { href: 'http://localhost/pricing' };
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  (window as any).location = originalLocation;
});

describe('/pricing — guest (public page, optional authentication)', () => {
  it('renders plans without redirecting and makes no preference lookup', async () => {
    await render();
    expect(planButton()).toBeDefined();
    expect(href()).toBe('http://localhost/pricing');
    expect(req('GET', '/subscriptions/me')[0].auth).toBeNull();
    expect(req('POST', '/auth/refresh')).toHaveLength(1);
    expect(req('GET', '/causes/preferences')).toHaveLength(0);
  });

  it('choosing a plan sends the guest to /login?next=/pricing (no selector, no checkout)', async () => {
    await render();
    await click(planButton());
    expect(href()).toBe(LOGIN);
    expect(selectorOpen()).toBe(false);
    expect(req('POST', '/subscriptions/checkout')).toHaveLength(0);
  });

  it('buying a token package as a guest goes to /login?next=/pricing', async () => {
    await render();
    await click(byText(en.pricing.tokens.buy));
    expect(href()).toBe(LOGIN);
  });
});

describe('/pricing — signed-in', () => {
  beforeEach(() => { localStorage.setItem('access_token', 'valid'); });

  it('sends Authorization: Bearer on the subscription status and preference lookups', async () => {
    await render();
    expect(req('GET', '/subscriptions/me')[0].auth).toBe('Bearer valid');
    expect(req('GET', '/causes/preferences')[0].auth).toBe('Bearer valid');
    expect(req('POST', '/auth/refresh')).toHaveLength(0);
  });

  it('marks the current plan from /subscriptions/me', async () => {
    server.planId = PLAN.id;
    await render();
    expect(byText(en.pricing.currentPlan)?.disabled).toBe(true);
  });

  it('saved preference → checkout directly with Bearer and the unchanged body; no selector', async () => {
    server.savedCause = CAUSE.id;
    await render();
    await click(planButton());
    expect(selectorOpen()).toBe(false);
    const [c] = req('POST', '/subscriptions/checkout');
    expect(c.auth).toBe('Bearer valid');
    expect(c.body).toBe(JSON.stringify({ planId: PLAN.id }));
    expect(href()).toBe('https://checkout.test/sub');
  });

  it('no saved preference (empty 200 body) → shows the selector, not a saved state', async () => {
    await render();
    await click(planButton());
    expect(selectorOpen()).toBe(true);
    expect(container.textContent).toContain(en.causeSelector.defaultNote);
    expect(req('POST', '/subscriptions/checkout')).toHaveLength(0);
  });

  it('select one cause → save succeeds → checkout continues', async () => {
    await render();
    await click(planButton());
    await click(container.querySelector<HTMLInputElement>('input[type="radio"]')!);
    await click(byText(en.causeSelector.confirm));
    expect(req('POST', '/causes/preferences')[0].auth).toBe('Bearer valid');
    expect(req('POST', '/subscriptions/checkout')[0].auth).toBe('Bearer valid');
    expect(href()).toBe('https://checkout.test/sub');
  });

  it('save fails → no checkout; retry succeeds → checkout continues', async () => {
    server.saveResults = ['fail', 'ok'];
    await render();
    await click(planButton());
    await click(container.querySelector<HTMLInputElement>('input[type="radio"]')!);
    await click(byText(en.causeSelector.confirm));
    expect(req('POST', '/subscriptions/checkout')).toHaveLength(0);
    expect(container.textContent).toContain(en.causeSelector.saveError);
    await click(byText(en.causeSelector.retrySave));
    expect(req('POST', '/causes/preferences')).toHaveLength(2);
    expect(href()).toBe('https://checkout.test/sub');
  });

  it('continue without choosing → checkout, with no preference write', async () => {
    await render();
    await click(planButton());
    await click(byText(en.causeSelector.skip));
    expect(req('POST', '/causes/preferences')).toHaveLength(0);
    expect(href()).toBe('https://checkout.test/sub');
  });

  it('preference lookup error → explicit notice (no selector, no equal-split claim); continue keeps the preference', async () => {
    server.savedCause = CAUSE.id;
    server.prefLookup = ['fail'];
    await render();
    await click(planButton());
    expect(lookupDialogOpen()).toBe(true);
    expect(selectorOpen()).toBe(false);
    expect(container.textContent).not.toContain(en.causeSelector.defaultNote);
    await click(byText(en.pricing.prefLookup.continue));
    expect(req('POST', '/causes/preferences')).toHaveLength(0);
    expect(server.savedCause).toBe(CAUSE.id);
    expect(href()).toBe('https://checkout.test/sub');
  });

  it('preference lookup error → retry finds a saved preference → checkout directly', async () => {
    server.savedCause = CAUSE.id;
    server.prefLookup = ['fail', 'ok'];
    await render();
    await click(planButton());
    await click(byText(en.pricing.prefLookup.retry));
    expect(lookupDialogOpen()).toBe(false);
    expect(selectorOpen()).toBe(false);
    expect(href()).toBe('https://checkout.test/sub');
  });

  it('preference lookup error → retry finds no preference → selector', async () => {
    server.prefLookup = ['fail', 'ok'];
    await render();
    await click(planButton());
    await click(byText(en.pricing.prefLookup.retry));
    expect(selectorOpen()).toBe(true);
  });

  it('preference lookup error → retry fails again → notice stays; cancel closes it without checkout', async () => {
    server.prefLookup = ['fail', 'fail'];
    await render();
    await click(planButton());
    await click(byText(en.pricing.prefLookup.retry));
    expect(lookupDialogOpen()).toBe(true);
    await click(byText(en.common.cancel));
    expect(lookupDialogOpen()).toBe(false);
    expect(req('POST', '/subscriptions/checkout')).toHaveLength(0);
  });

  it('token-package purchase sends Bearer and the unchanged body', async () => {
    await render();
    await click(byText(en.pricing.tokens.buy));
    const [c] = req('POST', '/subscriptions/tokens/purchase');
    expect(c.auth).toBe('Bearer valid');
    expect(c.body).toBe(JSON.stringify({ packageId: PKG.id }));
    expect(href()).toBe('https://checkout.test/tokens');
  });

  it('checkout 401 that cannot be refreshed → /login?next=/pricing', async () => {
    server.savedCause = CAUSE.id;
    await render();
    server.validTokens.delete('valid'); // session revoked after page load
    await click(planButton());
    expect(href()).toBe(LOGIN);
  });

  it('checkout non-auth failure (e.g. 403 email not confirmed) → existing payment error, no redirect', async () => {
    server.savedCause = CAUSE.id;
    server.checkoutStatus = 403;
    await render();
    await click(planButton());
    expect(container.textContent).toContain(en.pricing.paymentError);
    expect(href()).toBe('http://localhost/pricing');
  });
});

describe('/pricing — refresh session', () => {
  it('expired access token + valid refresh session → refreshes once and continues to checkout with the new token', async () => {
    localStorage.setItem('access_token', 'expired');
    server.refreshIssues = 'fresh';
    server.savedCause = CAUSE.id;
    await render();
    expect(req('POST', '/auth/refresh')).toHaveLength(1);
    expect(req('GET', '/causes/preferences')[0].auth).toBe('Bearer fresh');
    await click(planButton());
    expect(req('POST', '/subscriptions/checkout')[0].auth).toBe('Bearer fresh');
    expect(href()).toBe('https://checkout.test/sub');
  });

  it('no access token at all + valid refresh session → treated as signed in (no login redirect)', async () => {
    server.refreshIssues = 'fresh';
    await render();
    expect(localStorage.getItem('access_token')).toBe('fresh');
    await click(planButton());
    expect(selectorOpen()).toBe(true);
    expect(href()).toBe('http://localhost/pricing');
  });
});
