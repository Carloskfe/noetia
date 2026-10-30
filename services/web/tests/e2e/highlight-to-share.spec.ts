import { test, expect } from '@playwright/test';

const BOOK_ID = 'book-e2e-2';

// Dismiss the first-time reader tutorial if it appears
async function dismissTutorialIfVisible(page: any) {
  const tutorial = page.getByRole('dialog', { name: 'Tutorial del lector' });
  if (await tutorial.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: 'Omitir' }).click();
  }
}

// Paged is the default layout and has no <h1> (the title lives in the top bar), so wait
// for the title text and the first rendered phrase — works in both paged and scroll.
async function expectReaderLoaded(page: any, title: string) {
  await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
  await expect(page.locator('span[data-phrase-index="0"]').first()).toBeVisible();
}

const MOCK_BOOK = {
  id: BOOK_ID,
  title: 'Cien años de soledad',
  author: 'García Márquez',
  audioFileUrl: null,
  audioStreamUrl: null,
  textFileUrl: null,
  isFree: false,
};

const MOCK_PHRASES = [
  { text: 'Muchos años después', startTime: 0, endTime: 2, type: 'sentence' },
  { text: 'frente al pelotón de fusilamiento', startTime: 2, endTime: 5, type: 'sentence' },
  { text: 'el coronel Aureliano Buendía', startTime: 5, endTime: 8, type: 'sentence' },
];

const MOCK_FRAGMENT = {
  id: 'frag-e2e-1',
  bookId: BOOK_ID,
  text: 'Muchos años después',
  note: null,
  createdAt: '2026-05-02T00:00:00Z',
};

test.describe('Flow: highlight → share', () => {
  test.beforeEach(async ({ page }) => {
    // Set fake token so the reader fetches fragments (it skips the call without one)
    await page.addInitScript(() => localStorage.setItem('access_token', 'e2e-fake-token'));

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
    // The reader checks ownership of paid books (NEM-012 unlock action); the user owns this one.
    await page.route('**/library/ids', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([BOOK_ID]) }),
    );
  });

  test.skip('user selects text, saves fragment, and sees counter increment', async ({ page }) => {
    // KNOWN LIMITATION: Programmatic text selection via PointerEvent dispatch does not
    // reliably trigger React's onPointerUp handler in headless Chromium. This flow is
    // covered by manual QA. Run with --headed flag to test locally if needed.
    await page.route(`**/fragments`, (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_FRAGMENT),
        });
      } else {
        route.continue();
      }
    });

    await page.goto(`/reader/${BOOK_ID}`);
    await expectReaderLoaded(page, 'Cien años de soledad');
    await dismissTutorialIfVisible(page);

    const firstPhrase = page.locator('span[data-phrase-index="0"]');
    await expect(firstPhrase).toBeVisible();

    // Select text and trigger pointerup — must use evaluate to set selection
    // then dispatch from the reader container so React's delegated handler fires
    await page.evaluate(() => {
      const phrase = document.querySelector('span[data-phrase-index="0"]');
      const container = phrase?.closest('div[class*="leading-relaxed"]');
      if (!phrase || !container) return;
      const range = document.createRange();
      range.selectNodeContents(phrase);
      const sel = window.getSelection();
      if (sel) { sel.removeAllRanges(); sel.addRange(range); }
      container.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerType: 'mouse' }));
    });

    // Fragment popover should appear with save button
    await expect(page.getByRole('button', { name: 'Guardar fragmento' })).toBeVisible({ timeout: 10000 });

    // Save the fragment — wait for the POST /fragments call
    const fragmentRequest = page.waitForRequest(
      (req) => req.url().includes('/fragments') && req.method() === 'POST',
    );
    await page.getByRole('button', { name: 'Guardar fragmento' }).click({ force: true });
    await fragmentRequest;

    // Popover should disappear
    await expect(page.getByRole('button', { name: 'Guardar fragmento' })).not.toBeVisible();

    // Fragment count badge in top bar should show 1
    const fragmentsBtn = page.getByRole('button', { name: 'Fragmentos' });
    await expect(fragmentsBtn.locator('span').filter({ hasText: '1' })).toBeVisible();
  });

  test('fragment sheet opens and shows saved fragment text', async ({ page }) => {
    // Pre-load with one existing fragment
    await page.route(`**/books/${BOOK_ID}/fragments`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([MOCK_FRAGMENT]),
      }),
    );

    await page.goto(`/reader/${BOOK_ID}`);
    await expectReaderLoaded(page, 'Cien años de soledad');
    await dismissTutorialIfVisible(page);

    // Open fragment sheet via top bar
    await page.getByRole('button', { name: 'Fragmentos' }).click();

    const sheet = page.getByRole('dialog', { name: 'Fragmentos guardados' });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText('Muchos años después')).toBeVisible();
  });

  test('share modal opens from fragment sheet', async ({ page }) => {
    // Unique fragment text that won't collide with reader phrases
    const SHARE_FRAGMENT = { ...MOCK_FRAGMENT, id: 'frag-share-1', text: 'Texto guardado para compartir' };

    // Override ALL routes independently (don't rely on beforeEach ordering)
    await page.route(`**/books/${BOOK_ID}`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_BOOK) }),
    );
    await page.route(`**/books/${BOOK_ID}/sync-map`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ phrases: MOCK_PHRASES }) }),
    );
    await page.route(`**/books/${BOOK_ID}/progress`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ phraseIndex: 0 }) }),
    );
    await page.route(`**/books/${BOOK_ID}/fragments`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([SHARE_FRAGMENT]) }),
    );
    await page.route('**/library/ids', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([BOOK_ID]) }),
    );

    await page.goto(`/reader/${BOOK_ID}`);
    await expectReaderLoaded(page, 'Cien años de soledad');
    await dismissTutorialIfVisible(page);

    // Open fragment sheet
    await page.getByRole('button', { name: 'Fragmentos' }).click();
    const sheet = page.getByRole('dialog', { name: 'Fragmentos guardados' });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText('Texto guardado para compartir')).toBeVisible();

    // Click share on the fragment
    await page.getByRole('button', { name: 'Compartir fragmento' }).click({ force: true });

    // Share modal (Crear tarjeta) should appear
    await expect(page.getByRole('heading', { name: 'Crear tarjeta' })).toBeVisible();
  });
});
