import { test, expect, Page } from '@playwright/test';

// NEM-012 — "Unlock with token". These flows exist only on the Release A branch,
// so they are skipped against production until Release A is deployed (remove the
// skip then). Run locally: BASE_URL=http://localhost:3000 npx playwright test acquire-to-read
test.skip(
  ({ baseURL }) => !baseURL || baseURL.includes('noetia.app'),
  'Release A UI (NEM-012) is not deployed to production yet',
);

const BOOK_ID = 'book-e2e-paid';
const BOOK = {
  id: BOOK_ID,
  title: 'Cien años de soledad',
  author: 'García Márquez',
  audioFileUrl: null,
  audioStreamUrl: null,
  textFileUrl: null,
  isFree: false,
};
const PHRASES = [
  { text: 'Muchos años después', startTime: 0, endTime: 2, type: 'sentence' },
  { text: 'frente al pelotón de fusilamiento', startTime: 2, endTime: 5, type: 'sentence' },
];

const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });

async function baseRoutes(page: Page, opts: { tokens: number; owned: boolean }) {
  await page.addInitScript(() => {
    localStorage.setItem('noetia_lang', 'en');
    localStorage.setItem('access_token', 'e2e-token');
    localStorage.setItem('noetia_reader_tutorial_seen', '1');
  });
  await page.route('**/subscriptions/me', (r) =>
    r.fulfill(json({ status: 'none', tokenBalance: opts.tokens, availableTokens: opts.tokens, isLinkedMember: false })),
  );
  await page.route(`**/books/${BOOK_ID}/summary`, (r) => r.fulfill(json({ ...BOOK, coverUrl: null })));
  await page.route(`**/books/${BOOK_ID}/sync-map`, (r) => r.fulfill(json({ phrases: PHRASES })));
  await page.route(`**/books/${BOOK_ID}/progress`, (r) => r.fulfill(json({ phraseIndex: 0 })));
  await page.route(`**/books/${BOOK_ID}/fragments`, (r) => r.fulfill(json([])));
  await page.route('**/library/ids', (r) => r.fulfill(json(opts.owned ? [BOOK_ID] : [])));
  await page.route('**/users/me', (r) => r.fulfill(json({ id: 'u1', name: 'Test', userType: 'personal', emailConfirmed: true })));
}

test.describe('Flow: acquire → read (NEM-012)', () => {
  test('free account: denied paid book → unlock with a token → reads it', async ({ page }) => {
    await baseRoutes(page, { tokens: 2, owned: false });
    let unlocked = false;
    await page.route(`**/books/${BOOK_ID}`, (r) =>
      r.fulfill(unlocked ? json(BOOK) : json({ error: 'subscription_required', bookId: BOOK_ID }, 403)),
    );
    await page.route(`**/subscriptions/books/${BOOK_ID}/redeem`, (r) => {
      unlocked = true;
      return r.fulfill(json({}, 201));
    });

    await page.goto(`/reader/${BOOK_ID}`);
    await expect(page.getByRole('heading', { name: 'Unlock this book' })).toBeVisible();
    await expect(page.getByText('Cien años de soledad')).toBeVisible();
    await expect(page.getByText('You have 2 tokens')).toBeVisible();
    await expect(page.getByText(/buy this|purchase/i)).toHaveCount(0);

    await page.getByRole('button', { name: 'Unlock with 1 token' }).click();
    await expect(page.locator('span[data-phrase-index="0"]').first()).toBeVisible();
  });

  test('no tokens: the unlock screen sends the customer to token packs', async ({ page }) => {
    await baseRoutes(page, { tokens: 0, owned: false });
    await page.route(`**/books/${BOOK_ID}`, (r) => r.fulfill(json({ error: 'subscription_required', bookId: BOOK_ID }, 403)));

    await page.goto(`/reader/${BOOK_ID}`);
    await expect(page.getByRole('button', { name: 'Unlock with 1 token' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Get tokens' })).toHaveAttribute('href', '/pricing#tokens');
  });

  test('subscriber reading a paid book they do not own sees a visible Unlock action', async ({ page }) => {
    await baseRoutes(page, { tokens: 1, owned: false });
    await page.route(`**/books/${BOOK_ID}`, (r) => r.fulfill(json(BOOK)));
    await page.route(`**/subscriptions/books/${BOOK_ID}/redeem`, (r) => r.fulfill(json({}, 201)));

    await page.goto(`/reader/${BOOK_ID}`);
    await expect(page.locator('span[data-phrase-index="0"]').first()).toBeVisible();

    await page.getByRole('button', { name: 'Unlock', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Unlock this book' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Unlock with 1 token' }).click();

    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Unlock', exact: true })).toHaveCount(0);
  });

  test('regression: an owned paid book opens normally with no unlock action', async ({ page }) => {
    await baseRoutes(page, { tokens: 0, owned: true });
    await page.route(`**/books/${BOOK_ID}`, (r) => r.fulfill(json(BOOK)));

    await page.goto(`/reader/${BOOK_ID}`);
    await expect(page.locator('span[data-phrase-index="0"]').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Unlock', exact: true })).toHaveCount(0);
  });
});
