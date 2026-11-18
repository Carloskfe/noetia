import { test, expect } from '@playwright/test';

const MOCK_PLANS = [
  { id: 'individual-monthly', name: 'Individual', amountCents: 899, interval: 'month', tokensPerCycle: 1, maxProfiles: 1 },
  { id: 'individual-annual',  name: 'Individual', amountCents: 8399, interval: 'year',  tokensPerCycle: 1, maxProfiles: 1 },
  { id: 'duo-monthly',        name: 'Duo',        amountCents: 1399, interval: 'month', tokensPerCycle: 2, maxProfiles: 2 },
  { id: 'duo-annual',         name: 'Duo',        amountCents: 12999, interval: 'year', tokensPerCycle: 2, maxProfiles: 2 },
  { id: 'family-monthly',     name: 'Family',     amountCents: 1899, interval: 'month', tokensPerCycle: 4, maxProfiles: 5 },
  { id: 'family-annual',      name: 'Family',     amountCents: 17999, interval: 'year', tokensPerCycle: 4, maxProfiles: 5 },
];

test.describe('Flow: subscribe → unlock', () => {
  test('pricing page shows plans and initiates checkout on plan selection', async ({ page }) => {
    await page.route('**/subscriptions/plans', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_PLANS),
      }),
    );

    await page.route('**/subscriptions/token-packages', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }),
    );

    await page.route('**/subscriptions/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'none', planId: null, tokenBalance: 0 }),
      }),
    );

    await page.route('**/causes/preferences', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) }),
    );

    let checkoutBody: { planId?: string } = {};
    await page.route('**/subscriptions/checkout', async (route) => {
      checkoutBody = JSON.parse(route.request().postData() ?? '{}');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ url: 'https://checkout.stripe.com/pay/cs_test_mock' }),
      });
    });

    await page.goto('/pricing');
    await expect(page.getByRole('heading', { name: 'Planes Noetia' })).toBeVisible();

    // Monthly tab should be active by default — shows Individual, Duo, Family
    await expect(page.getByText('Individual').first()).toBeVisible();
    await expect(page.getByText('Duo').first()).toBeVisible();
    await expect(page.getByText('Family').first()).toBeVisible();

    // Click "Elegir plan" on the first plan
    const checkoutRequest = page.waitForRequest(
      (req) => req.url().includes('/subscriptions/checkout') && req.method() === 'POST',
    );
    await page.getByRole('button', { name: 'Elegir plan' }).first().click();
    await checkoutRequest;

    expect(checkoutBody.planId).toBeTruthy();
  });

  test('annual tab shows discounted prices', async ({ page }) => {
    await page.route('**/subscriptions/plans', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_PLANS) }),
    );
    await page.route('**/subscriptions/token-packages', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }),
    );
    await page.route('**/subscriptions/me', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'none', planId: null }) }),
    );
    await page.route('**/causes/preferences', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) }),
    );

    await page.goto('/pricing');
    await page.getByRole('button', { name: /Anual/i }).click();

    // Annual Individual plan price
    await expect(page.getByText('$83.99')).toBeVisible();
  });

  test('current plan button is disabled', async ({ page }) => {
    await page.route('**/subscriptions/plans', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_PLANS) }),
    );
    await page.route('**/subscriptions/token-packages', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }),
    );
    await page.route('**/subscriptions/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'active', planId: 'individual-monthly', tokenBalance: 1 }),
      }),
    );
    await page.route('**/causes/preferences', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) }),
    );

    await page.goto('/pricing');
    const disabledBtn = page.getByRole('button', { name: 'Tu plan actual' });
    await expect(disabledBtn).toBeVisible();
    await expect(disabledBtn).toBeDisabled();
  });

  test('shows error when checkout fails', async ({ page }) => {
    await page.route('**/subscriptions/plans', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_PLANS) }),
    );
    await page.route('**/subscriptions/token-packages', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }),
    );
    await page.route('**/subscriptions/me', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'none', planId: null }) }),
    );
    await page.route('**/causes/preferences', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) }),
    );
    await page.route('**/subscriptions/checkout', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({}) }),
    );

    await page.goto('/pricing');
    await page.getByRole('button', { name: 'Elegir plan' }).first().click();

    await expect(page.getByText(/No pudimos iniciar el pago/i)).toBeVisible();
  });
});
