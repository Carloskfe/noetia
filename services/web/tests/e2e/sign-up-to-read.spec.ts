import { test, expect } from '@playwright/test';

const BOOK_ID = 'book-e2e-1';

const MOCK_BOOK = {
  id: BOOK_ID,
  title: 'El Quijote',
  author: 'Cervantes',
  audioFileUrl: null,
  audioStreamUrl: null,
  textFileUrl: null,
  isFree: true,
};

const MOCK_PHRASES = [
  { text: 'En un lugar de la Mancha', startTime: 0, endTime: 3, type: 'sentence' },
  { text: 'de cuyo nombre no quiero acordarme', startTime: 3, endTime: 6, type: 'sentence' },
];

test.describe('Flow: sign-up → read', () => {
  // Force English so assertions match i18n strings regardless of browser default
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('noetia_lang', 'en');
    });
  });

  test('user registers, lands in library, and opens reader', async ({ page }) => {
    await page.route('**/auth/register', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          accessToken: 'e2e-token-abc',
          user: { id: 'u1', name: 'Test User', userType: null, emailConfirmed: true },
        }),
      }),
    );

    await page.route('**/library', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([MOCK_BOOK]),
      }),
    );

    await page.route(`**/books/${BOOK_ID}`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_BOOK),
      }),
    );

    await page.route(`**/books/${BOOK_ID}/sync-map`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ phrases: MOCK_PHRASES }),
      }),
    );

    await page.route(`**/books/${BOOK_ID}/progress`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ phraseIndex: 0 }) }),
    );

    await page.route(`**/books/${BOOK_ID}/fragments`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }),
    );

    await page.route(`**/library/${BOOK_ID}`, (route) =>
      route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({}) }),
    );

    await page.route('**/users/me', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'u1', name: 'Test User', userType: 'personal', emailConfirmed: true }) }));
    await page.route('**/subscriptions/me', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'none', planId: null, tokenBalance: 0 }) }));
    await page.route('**/books*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([MOCK_BOOK]) }));
    await page.route('**/collections', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }));
    await page.route('**/library/ids', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }));

    // ── Step 1: navigate to register ─────────────────────────────────────────
    await page.goto('/register');
    await expect(page.getByRole('button', { name: /create account/i })).toBeVisible();

    // ── Step 2: fill and submit the form ──────────────────────────────────────
    await page.locator('input[type="text"]').fill('Test User');
    await page.locator('input[type="email"]').fill('test+e2e@noetia.com');
    await page.locator('input[type="password"]').fill('secure-password-123');
    await page.getByRole('button', { name: /create account/i }).click();

    // ── Step 3: redirected to onboarding or library (userType null → onboarding) ──
    await page.waitForURL(/\/(onboarding|library|discover)/, { timeout: 15000 });

    // ── Step 4: navigate to reader and verify it loads ────────────────────────
    await page.goto(`/reader/${BOOK_ID}`);
    await expect(page.getByRole('heading', { name: 'El Quijote' })).toBeVisible();
    await expect(page.getByText('En un lugar de la Mancha')).toBeVisible();
  });

  test('shows validation errors when form is submitted empty', async ({ page }) => {
    await page.goto('/register');
    await page.getByRole('button', { name: /create account/i }).click();

    await expect(page.getByText(/name is required/i)).toBeVisible();
    await expect(page.getByText(/invalid email/i)).toBeVisible();
    await expect(page.getByText(/8 characters/i)).toBeVisible();
  });

  test('shows server error when registration fails', async ({ page }) => {
    await page.route('**/auth/register', (route) =>
      route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Email already in use' }),
      }),
    );

    await page.goto('/register');
    await page.locator('input[type="text"]').fill('Test User');
    await page.locator('input[type="email"]').fill('taken@noetia.com');
    await page.locator('input[type="password"]').fill('secure-password-123');
    await page.getByRole('button', { name: /create account/i }).click();

    await expect(page.getByText(/email already in use/i)).toBeVisible();
  });
});
