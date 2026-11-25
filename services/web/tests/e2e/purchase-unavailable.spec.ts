import fs from 'node:fs';
import path from 'node:path';
import { test, expect, type Page, type Request } from '@playwright/test';
import { en } from '../../lib/i18n/en';
import { es } from '../../lib/i18n/es';

// Purchase-unavailable state (CI-1).
//
// While payments are off, a purchase must never start. How the web shows that depends on the tree under test:
//
// - 'backend-gate': there is no web purchase flag (current main). Purchase controls are clickable; the API refuses
//   (PR #63 gate: 400 { error: 'payments_not_configured' }); the page must show its payment error, stay put and
//   never navigate to a checkout URL.
// - 'web-gated-off': lib/purchase-availability.ts exists with PURCHASES_AVAILABLE = false (PR #59 once integrated).
//   Controls are disabled, an unavailable notice is shown, and no checkout endpoint is ever called.
// - 'web-gated-on': the flag is true (financial release). Controls are clickable again, so the backend-gate tests
//   apply: with the API refusing, nothing may start.
//
// Exactly one group runs on any tree; the other group is skipped with an explicit reason. Expected copy comes from
// the tree's own i18n dictionaries, in both languages.

const FLAG_FILE = path.join(__dirname, '../../lib/purchase-availability.ts');

type Mode = 'backend-gate' | 'web-gated-off' | 'web-gated-on';

function detectMode(): Mode {
  if (!fs.existsSync(FLAG_FILE)) return 'backend-gate';
  const source = fs.readFileSync(FLAG_FILE, 'utf8');
  const match = source.match(/export const PURCHASES_AVAILABLE(?:\s*:\s*boolean)?\s*=\s*(true|false)\s*;/);
  if (!match) {
    throw new Error(`purchase-unavailable.spec: cannot read PURCHASES_AVAILABLE from ${FLAG_FILE}; update this spec.`);
  }
  return match[1] === 'true' ? 'web-gated-on' : 'web-gated-off';
}

const MODE = detectMode();
const CONTROLS_DISABLED_BY_WEB = MODE === 'web-gated-off';

type Lang = 'en' | 'es';
const LANGS: Lang[] = ['en', 'es'];
const DICTIONARIES: Record<Lang, unknown> = { en, es };

// Reads a dictionary entry by dotted path. Untyped on purpose: the keys for the web-gated state exist only once
// PR #59 is integrated, and a missing key must fail the test loudly rather than compare against `undefined`.
function copy(lang: Lang, key: string): string {
  let node: unknown = DICTIONARIES[lang];
  for (const part of key.split('.')) {
    if (node === null || typeof node !== 'object' || !(part in node)) {
      throw new Error(`i18n key "${key}" is missing in ${lang}`);
    }
    node = (node as Record<string, unknown>)[part];
  }
  if (typeof node !== 'string' || node.length === 0) throw new Error(`i18n key "${key}" (${lang}) is not a string`);
  return node;
}

const PLANS = [
  { id: 'individual-monthly', name: 'Individual', amountCents: 899, interval: 'month', tokensPerCycle: 1, maxProfiles: 1 },
  { id: 'duo-monthly', name: 'Duo', amountCents: 1399, interval: 'month', tokensPerCycle: 2, maxProfiles: 2 },
  { id: 'family-monthly', name: 'Family', amountCents: 1899, interval: 'month', tokensPerCycle: 4, maxProfiles: 5 },
  { id: 'individual-annual', name: 'Individual', amountCents: 8399, interval: 'year', tokensPerCycle: 1, maxProfiles: 1 },
];
const TOKEN_PACKAGES = [
  { id: 'tokens-1', tokenCount: 1, amountCents: 499 },
  { id: 'tokens-3', tokenCount: 3, amountCents: 1299 },
];
const PAYMENTS_OFF = { error: 'payments_not_configured' };
const PURCHASE_ENDPOINTS = /\/(subscriptions\/checkout|subscriptions\/tokens\/purchase|gifts\/checkout)(\?|$)/;

/** Endpoint path without the optional same-origin /api prefix (pages call either /api/... or NEXT_PUBLIC_API_URL). */
const endpoint = (r: Request) => new URL(r.url()).pathname.replace(/^\/api(?=\/)/, '');

const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });

type Session = 'guest' | 'signed-in';

/** Language, session, mocked read endpoints, and a recorder for every purchase request the page makes. */
async function preparePage(page: Page, lang: Lang, session: Session): Promise<Request[]> {
  await page.addInitScript(
    ({ l, signedIn }) => {
      localStorage.setItem('noetia_lang', l);
      if (signedIn) localStorage.setItem('access_token', 'e2e-fake-token');
    },
    { l: lang, signedIn: session === 'signed-in' },
  );

  // Patterns match with or without the /api prefix: some pages call the same-origin rewrite (/api/...), others call
  // NEXT_PUBLIC_API_URL directly.
  await page.route('**/subscriptions/plans', (route) => route.fulfill(json(PLANS)));
  await page.route('**/subscriptions/token-packages', (route) => route.fulfill(json(TOKEN_PACKAGES)));
  if (session === 'signed-in') {
    // A confirmed reader with no subscription: checkout may only be attempted with a known status.
    await page.route('**/subscriptions/me', (route) => route.fulfill(json({ status: 'none', planId: null, tokenBalance: 0 })));
    await page.route('**/users/me', (route) =>
      route.fulfill(json({ id: 'u-e2e', name: 'E2E Reader', userType: 'personal', emailConfirmed: true })),
    );
  } else {
    // A guest visitor: no session, and the one refresh attempt is refused.
    await page.route('**/subscriptions/me', (route) => route.fulfill(json({ message: 'Unauthorized' }, 401)));
  }
  await page.route('**/auth/refresh', (route) => route.fulfill(json({ message: 'Unauthorized' }, 401)));
  // A saved cause preference, so selecting a plan goes straight to checkout (no cause selector in between).
  await page.route('**/causes/preferences', (route) => route.fulfill(json({ cause1Id: 'cause-1' })));
  await page.route('**/causes', (route) => route.fulfill(json([])));

  // The API's fail-closed answer while payments are disabled (PR #63).
  const purchaseRequests: Request[] = [];
  await page.route(PURCHASE_ENDPOINTS, (route) => {
    purchaseRequests.push(route.request());
    return route.fulfill(json(PAYMENTS_OFF, 400));
  });
  return purchaseRequests;
}

/** No navigation to any checkout page happened: still on the same path, never on a Stripe host. */
async function expectStayedOn(page: Page, pathname: string, visited: string[]) {
  await expect(page).toHaveURL((url) => url.pathname === pathname);
  expect(visited.filter((u) => /stripe\.com|\/checkout/i.test(new URL(u).hostname + new URL(u).pathname))).toEqual([]);
}

function trackNavigations(page: Page): string[] {
  const visited: string[] = [];
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) visited.push(frame.url());
  });
  return visited;
}

test.describe(`Purchases unavailable: API refuses, page stays (mode: ${MODE})`, () => {
  test.skip(CONTROLS_DISABLED_BY_WEB, 'Web purchase controls are disabled on this tree; covered by the web-gated tests below.');

  for (const lang of LANGS) {
    test(`[${lang}] subscription checkout is refused and shows the payment error`, async ({ page }) => {
      const purchaseRequests = await preparePage(page, lang, 'signed-in');
      const visited = trackNavigations(page);

      await page.goto('/pricing');
      await expect(page.getByRole('heading', { name: copy(lang, 'pricing.title') })).toBeVisible();

      await page.getByRole('button', { name: copy(lang, 'pricing.startTrial') }).first().click();

      await expect(page.getByText(copy(lang, 'pricing.paymentError'))).toBeVisible();
      expect(purchaseRequests.map(endpoint)).toEqual(['/subscriptions/checkout']);
      await expectStayedOn(page, '/pricing', visited);
    });

    test(`[${lang}] token purchase is refused and shows the payment error`, async ({ page }) => {
      const purchaseRequests = await preparePage(page, lang, 'signed-in');
      const visited = trackNavigations(page);

      await page.goto('/pricing');
      await expect(page.getByRole('heading', { name: copy(lang, 'pricing.tokens.title') })).toBeVisible();

      await page.getByRole('button', { name: copy(lang, 'pricing.tokens.buy') }).first().click();

      await expect(page.getByText(copy(lang, 'pricing.paymentError'))).toBeVisible();
      expect(purchaseRequests.map(endpoint)).toEqual(['/subscriptions/tokens/purchase']);
      await expectStayedOn(page, '/pricing', visited);
    });

    test(`[${lang}] gift checkout is refused and shows the gift error`, async ({ page }) => {
      const purchaseRequests = await preparePage(page, lang, 'signed-in');
      const visited = trackNavigations(page);

      await page.goto('/gift');
      await expect(page.getByRole('heading', { name: copy(lang, 'giftCard.send.title') })).toBeVisible();

      await page.locator('input[type="email"]').fill('reader@example.com');
      await page.locator('button[type="submit"]').click();

      await expect(page.getByText(copy(lang, 'giftCard.send.error'))).toBeVisible();
      expect(purchaseRequests.map(endpoint)).toEqual(['/gifts/checkout']);
      await expectStayedOn(page, '/gift', visited);
    });
  }
});

test.describe(`Purchases unavailable: web controls disabled (mode: ${MODE})`, () => {
  test.skip(
    !CONTROLS_DISABLED_BY_WEB,
    MODE === 'backend-gate'
      ? 'This tree has no web purchase flag (lib/purchase-availability.ts); these checks run once PR #59 is integrated.'
      : 'Web purchases are enabled on this tree; the API-refusal tests above apply instead.',
  );

  for (const lang of LANGS) {
    test(`[${lang}] pricing shows the unavailable notice and every purchase control is disabled`, async ({ page }) => {
      const purchaseRequests = await preparePage(page, lang, 'guest');
      const visited = trackNavigations(page);

      await page.goto('/pricing');
      await expect(page.getByRole('heading', { name: copy(lang, 'pricing.title') })).toBeVisible();
      await expect(page.getByTestId('purchases-unavailable')).toHaveText(copy(lang, 'pricing.unavailable.notice'));
      await expect(page.getByTestId('gift-unavailable')).toHaveText(copy(lang, 'pricing.unavailable.gift'));

      const unavailable = page.getByRole('button', { name: copy(lang, 'pricing.unavailable.button'), exact: true });
      // Three monthly plans plus two token packages, all rendered as disabled "not available yet" buttons.
      await expect(unavailable).toHaveCount(PLANS.filter((p) => p.interval === 'month').length + TOKEN_PACKAGES.length);
      for (const button of await unavailable.all()) {
        await expect(button).toBeDisabled();
        await button.click({ force: true });
      }
      await expect(page.getByRole('button', { name: copy(lang, 'pricing.startTrial') })).toHaveCount(0);
      await expect(page.getByRole('button', { name: copy(lang, 'pricing.tokens.buy') })).toHaveCount(0);

      expect(purchaseRequests.map((r) => r.url())).toEqual([]);
      await expectStayedOn(page, '/pricing', visited);
    });

    test(`[${lang}] gift form is disabled, shows the notice and never calls checkout`, async ({ page }) => {
      const purchaseRequests = await preparePage(page, lang, 'guest');
      const visited = trackNavigations(page);

      await page.goto('/gift');
      await expect(page.getByRole('heading', { name: copy(lang, 'giftCard.send.title') })).toBeVisible();
      await expect(page.getByTestId('gift-unavailable')).toHaveText(copy(lang, 'giftCard.send.unavailable'));
      await expect(page.locator('input[type="email"]')).toBeDisabled();

      const submit = page.locator('button[type="submit"]');
      await expect(submit).toBeDisabled();
      await expect(submit).toHaveText(copy(lang, 'giftCard.send.unavailableButton'));
      await submit.click({ force: true });
      await page.locator('form').evaluate((form) => (form as HTMLFormElement).requestSubmit());

      expect(purchaseRequests.map((r) => r.url())).toEqual([]);
      await expectStayedOn(page, '/gift', visited);
    });
  }
});
