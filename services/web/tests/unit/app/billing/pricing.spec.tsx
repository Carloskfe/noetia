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
  checkoutBody?: unknown;              // error body for a non-200 checkout (e.g. the API's 409/503 codes)
  planId: string | null;
  subStatus: string;                   // subscription status returned by /subscriptions/me
  meResults: Array<'ok' | 'fail' | 'network'>; // queued outcomes for GET /subscriptions/me (default ok)
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
    if (method === 'GET' && path === '/subscriptions/me') {
      const outcome = server.meResults.shift() ?? 'ok';
      if (outcome === 'network') return Promise.reject(new TypeError('Failed to fetch'));
      if (outcome === 'fail') return res(500, { message: 'boom' });
      return res(200, server.planId ? { status: server.subStatus, planId: server.planId } : { status: 'none' });
    }
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
      return server.checkoutStatus === 200 ? res(200, { url: 'https://checkout.test/sub' }) : res(server.checkoutStatus, server.checkoutBody ?? { message: 'x' });
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
const statusDialog = () => container.querySelector<HTMLElement>('[data-testid="status-check-dialog"]');
const statusBanner = () => container.querySelector<HTMLElement>('[data-testid="status-unknown-banner"]');
const within = (el: HTMLElement | null, label: string) =>
  Array.from(el?.querySelectorAll('button') ?? []).find((b) => b.textContent === label) as HTMLButtonElement | undefined;

async function render() {
  act(() => { root.render(React.createElement(PricingPage)); });
  await flush();
}

beforeEach(() => {
  server = { validTokens: new Set(['valid']), refreshIssues: null, savedCause: null, prefLookup: [], saveResults: [], checkoutStatus: 200, planId: null, subStatus: 'active', meResults: [] };
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

  it('prices are shown in explicitly marked US dollars (USD — PO decision 2026-11-13), never a bare "$"', async () => {
    await render();
    const text = document.body.textContent ?? '';
    expect(text).toContain('US$8.99'); // plan
    expect(text).toContain('US$4.99'); // token package
    expect(text).not.toMatch(/(^|[^S])\$\d/); // no "$8.99" without the US marker
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

describe('/pricing — subscription status unknown (server or network failure)', () => {
  beforeEach(() => { localStorage.setItem('access_token', 'valid'); });

  it('status 500 → plans and token packages stay browsable; a banner offers a retry; no redirect', async () => {
    server.meResults = ['fail'];
    await render();
    expect(planButton()).toBeDefined();
    expect(byText(en.pricing.tokens.buy)).toBeDefined();
    expect(statusBanner()?.textContent).toContain(en.pricing.statusCheck.banner);
    expect(href()).toBe('http://localhost/pricing');
  });

  it('a successful Causas lookup does not count as status verification: saved cause + status 500 → no checkout', async () => {
    server.meResults = ['fail'];
    server.savedCause = CAUSE.id;
    await render();
    expect(req('GET', '/causes/preferences')).toHaveLength(1); // the lookup succeeded…
    await click(planButton());
    expect(statusDialog()).not.toBeNull(); // …but checkout is still blocked
    expect(req('POST', '/subscriptions/checkout')).toHaveLength(0);
    expect(href()).toBe('http://localhost/pricing');
  });

  it('status unknown + no saved cause → no selector and no preference write before the status is known', async () => {
    server.meResults = ['fail'];
    await render();
    await click(planButton());
    expect(statusDialog()).not.toBeNull();
    expect(selectorOpen()).toBe(false);
    expect(req('POST', '/causes/preferences')).toHaveLength(0);
  });

  it('a network failure (fetch rejects) is treated as unknown status, not as a guest', async () => {
    server.meResults = ['network'];
    server.savedCause = CAUSE.id;
    await render();
    expect(statusBanner()).not.toBeNull();
    await click(planButton());
    expect(statusDialog()).not.toBeNull();
    expect(href()).toBe('http://localhost/pricing');
    expect(req('POST', '/subscriptions/checkout')).toHaveLength(0);
  });

  it('retry succeeds (no subscription) → continues to checkout with the saved cause, unchanged body', async () => {
    server.meResults = ['fail', 'ok'];
    server.savedCause = CAUSE.id;
    await render();
    await click(planButton());
    await click(within(statusDialog(), en.pricing.statusCheck.retry));
    expect(statusDialog()).toBeNull();
    expect(statusBanner()).toBeNull();
    const [c] = req('POST', '/subscriptions/checkout');
    expect(c.body).toBe(JSON.stringify({ planId: PLAN.id }));
    expect(href()).toBe('https://checkout.test/sub');
  });

  it('retry succeeds with no saved cause → normal selector flow', async () => {
    server.meResults = ['fail', 'ok'];
    await render();
    await click(planButton());
    await click(within(statusDialog(), en.pricing.statusCheck.retry));
    expect(selectorOpen()).toBe(true);
  });

  it('retry reveals the chosen plan is already active → no second checkout; plan marked current', async () => {
    server.meResults = ['fail', 'ok'];
    server.planId = PLAN.id;
    server.savedCause = CAUSE.id;
    await render();
    await click(planButton());
    await click(within(statusDialog(), en.pricing.statusCheck.retry));
    expect(statusDialog()).toBeNull();
    expect(req('POST', '/subscriptions/checkout')).toHaveLength(0);
    expect(byText(en.pricing.currentPlan)?.disabled).toBe(true);
  });

  it('retry fails again → notice stays; cancel closes it without checkout', async () => {
    server.meResults = ['fail', 'fail'];
    server.savedCause = CAUSE.id;
    await render();
    await click(planButton());
    await click(within(statusDialog(), en.pricing.statusCheck.retry));
    expect(statusDialog()).not.toBeNull();
    await click(within(statusDialog(), en.common.cancel));
    expect(statusDialog()).toBeNull();
    expect(req('POST', '/subscriptions/checkout')).toHaveLength(0);
  });

  it('retry finds the session expired (401, refresh fails) → /login?next=/pricing', async () => {
    server.meResults = ['fail'];
    await render();
    await click(planButton());
    server.validTokens.delete('valid');
    await click(within(statusDialog(), en.pricing.statusCheck.retry));
    expect(href()).toBe(LOGIN);
  });

  it('banner retry recovers the status without choosing a plan (current plan then marked)', async () => {
    server.meResults = ['fail', 'ok'];
    server.planId = PLAN.id;
    await render();
    await click(within(statusBanner(), en.pricing.statusCheck.retry));
    expect(statusBanner()).toBeNull();
    expect(byText(en.pricing.currentPlan)?.disabled).toBe(true);
    expect(req('POST', '/subscriptions/checkout')).toHaveLength(0);
  });

  it('token-package purchase is not blocked by an unknown subscription status', async () => {
    server.meResults = ['fail'];
    await render();
    await click(byText(en.pricing.tokens.buy));
    expect(req('POST', '/subscriptions/tokens/purchase')[0].auth).toBe('Bearer valid');
    expect(href()).toBe('https://checkout.test/tokens');
  });
});

describe('/pricing — which statuses count as a current plan', () => {
  beforeEach(() => { localStorage.setItem('access_token', 'valid'); });

  it.each(['active', 'trialing', 'canceling', 'past_due'])('status %s → plan marked current and not purchasable again', async (st) => {
    server.planId = PLAN.id;
    server.subStatus = st;
    await render();
    expect(byText(en.pricing.currentPlan)?.disabled).toBe(true);
  });

  it('status canceled → the former plan can be purchased again', async () => {
    server.planId = PLAN.id;
    server.subStatus = 'canceled';
    server.savedCause = CAUSE.id;
    await render();
    expect(byText(en.pricing.currentPlan)).toBeUndefined();
    await click(planButton());
    expect(href()).toBe('https://checkout.test/sub');
  });
});

describe('/pricing — server-side duplicate-subscription guard responses', () => {
  beforeEach(() => {
    localStorage.setItem('access_token', 'valid');
    server.savedCause = CAUSE.id;
  });
  const pricingError = () => container.querySelector('[data-testid="pricing-error"]');

  it('409 subscription_exists → explains and links to billing; no redirect, no generic payment error', async () => {
    server.checkoutStatus = 409;
    server.checkoutBody = { statusCode: 409, error: 'subscription_exists', status: 'trialing' };
    await render();
    await click(planButton());
    expect(pricingError()?.textContent).toContain(en.pricing.subscriptionExists);
    expect(pricingError()?.querySelector('a')?.getAttribute('href')).toBe('/account/billing');
    expect(href()).toBe('http://localhost/pricing');
  });

  it('409 checkout_pending → asks to wait and retry', async () => {
    server.checkoutStatus = 409;
    server.checkoutBody = { statusCode: 409, error: 'checkout_pending' };
    await render();
    await click(planButton());
    expect(pricingError()?.textContent).toBe(en.pricing.checkoutPending);
    expect(pricingError()?.querySelector('a')).toBeNull();
  });

  it('503 subscription_status_unavailable → says the status could not be confirmed', async () => {
    server.checkoutStatus = 503;
    server.checkoutBody = { statusCode: 503, error: 'subscription_status_unavailable' };
    await render();
    await click(planButton());
    expect(pricingError()?.textContent).toBe(en.pricing.statusUnavailable);
  });
});
