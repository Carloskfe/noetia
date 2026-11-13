// Pricing → CauseSelector → checkout wiring (PO-053): checkout runs after a SUCCESSFUL save or an explicit
// skip, never after a failed save. Checkout request itself is unchanged.
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: any) => {
    const React = require('react');
    return React.createElement('a', { href, ...props }, children);
  },
}));
jest.mock('@/lib/i18n', () => {
  const { es } = require('../../../../lib/i18n/es');
  return { useTranslation: () => ({ t: es, language: 'es', setLanguage: jest.fn() }) };
});
const mockApiFetch = jest.fn();
jest.mock('@/lib/api', () => ({ apiFetch: (...a: unknown[]) => mockApiFetch(...a) }));

import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import PricingPage from '@/app/(billing)/pricing/page';
import { es } from '@/lib/i18n/es';

(global as any).IS_REACT_ACT_ENVIRONMENT = true;

const PLAN = { id: 'plan-ind', name: 'Individual', amountCents: 899, interval: 'month', tokensPerCycle: 1, maxProfiles: 1 };
const CAUSES = [{ id: 'c-env', slug: 'medio-ambiente', name: 'Medio Ambiente', description: 'd' }];

let container: HTMLDivElement;
let root: Root;
let fetchMock: jest.Mock;

function setup(prefs: unknown) {
  fetchMock = jest.fn((url: string, init?: RequestInit) => {
    const json = (body: unknown, ok = true) => Promise.resolve({ ok, status: ok ? 200 : 500, json: () => Promise.resolve(body) });
    if (url === '/api/subscriptions/plans') return json([PLAN]);
    if (url === '/api/subscriptions/token-packages') return json([]);
    if (url === '/api/subscriptions/me') return json(null, false);
    if (url === '/api/causes/preferences') return prefs ? json(prefs) : json(null, false);
    if (url === '/api/subscriptions/checkout' && init?.method === 'POST') return json({ url: '#checkout' });
    return json(null, false);
  });
  global.fetch = fetchMock as unknown as typeof fetch;
}

const flush = () => act(async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); });
const btn = (label: string) =>
  Array.from(container.querySelectorAll('button')).find((b) => b.textContent === label) as HTMLButtonElement;
const checkoutCalls = () => fetchMock.mock.calls.filter(([u]) => u === '/api/subscriptions/checkout');

async function render() {
  act(() => { root.render(React.createElement(PricingPage)); });
  await flush();
}
async function choosePlan() {
  const planBtn = Array.from(container.querySelectorAll('button')).find((b) =>
    b.className.includes('w-full py-3') && !b.disabled) as HTMLButtonElement;
  act(() => { planBtn.click(); });
  await flush();
}

beforeEach(() => {
  mockApiFetch.mockReset();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

describe('Pricing checkout with Causas preference', () => {
  it('goes straight to checkout when a preference already exists', async () => {
    setup({ cause1Id: 'c-env', cause2Id: null, randomDistribution: false });
    await render();
    await choosePlan();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(checkoutCalls()).toHaveLength(1);
    expect(checkoutCalls()[0][1]).toEqual({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId: 'plan-ind' }),
    });
  });

  it('skip → checkout without saving a preference', async () => {
    setup(null);
    mockApiFetch.mockResolvedValueOnce(CAUSES);
    await render();
    await choosePlan();
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    act(() => { btn(es.causeSelector.skip).click(); });
    await flush();
    expect(checkoutCalls()).toHaveLength(1);
    expect(mockApiFetch).not.toHaveBeenCalledWith('/causes/preferences', expect.anything());
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('failed save → no checkout, dialog stays open; retry success → checkout', async () => {
    setup(null);
    mockApiFetch
      .mockResolvedValueOnce(CAUSES)
      .mockRejectedValueOnce(new Error('500'))
      .mockResolvedValueOnce({});
    await render();
    await choosePlan();
    act(() => { container.querySelector<HTMLInputElement>('input[type="radio"]')!.click(); });
    act(() => { btn(es.causeSelector.confirm).click(); });
    await flush();
    expect(checkoutCalls()).toHaveLength(0);
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();

    act(() => { btn(es.causeSelector.retrySave).click(); });
    await flush();
    expect(checkoutCalls()).toHaveLength(1);
  });
});
