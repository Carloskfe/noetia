import { test, expect } from '@playwright/test';

// CI-1 guard: the suite tests the checked-out build on loopback and cannot reach a deployed site.
// Never skipped under CI (playwright.config.ts refuses BASE_URL there). Skipped only in the manual mode: an explicit
// BASE_URL outside CI.
test.describe('E2E isolation', () => {
  test.skip(!process.env.CI && Boolean(process.env.BASE_URL?.trim()), 'Manual run against an explicit BASE_URL.');

  test('targets the local build on loopback', async ({ page, baseURL }) => {
    expect(baseURL).toBeDefined();
    expect(new URL(baseURL as string).hostname).toBe('127.0.0.1');

    const response = await page.goto('/');
    expect(response?.ok()).toBe(true);
    expect(new URL(page.url()).hostname).toBe('127.0.0.1');
  });

  test('production hosts are unreachable from the test browser', async ({ page }) => {
    for (const url of ['https://noetia.app/', 'https://storage.noetia.app/']) {
      const error = await page.goto(url).then(
        () => null,
        (e: Error) => e,
      );
      expect(error, `${url} must not load`).not.toBeNull();
      expect(String(error?.message)).toContain('net::ERR_NAME_NOT_RESOLVED');
    }
  });
});
