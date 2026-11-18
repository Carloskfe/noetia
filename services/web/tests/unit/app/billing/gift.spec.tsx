// /gift: token-gift purchase page. Fail-closed purchase availability (lib/purchase-availability.ts).
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
let mockPurchasesAvailable = false;
jest.mock('@/lib/purchase-availability', () => ({ purchasesAvailable: () => mockPurchasesAvailable }));

import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { en } from '@/lib/i18n/en';
import GiftPage from '@/app/(billing)/gift/page';

(global as any).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let fetchMock: jest.Mock;
const originalLocation = window.location;

const flush = () => act(async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); });
const submitButton = () => container.querySelector<HTMLButtonElement>('button[type="submit"]')!;
const form = () => container.querySelector('form')!;
const email = () => container.querySelector<HTMLInputElement>('input[type="email"]')!;
const giftCalls = () => fetchMock.mock.calls.filter(([url]) => String(url).includes('/gifts/checkout'));

async function render() {
  act(() => { root.render(React.createElement(GiftPage)); });
  await flush();
}

beforeEach(() => {
  mockPurchasesAvailable = false;
  fetchMock = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ url: 'https://checkout.test/gift' }) }));
  global.fetch = fetchMock as unknown as typeof fetch;
  delete (window as any).location;
  (window as any).location = { href: 'http://localhost/gift' };
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  (window as any).location = originalLocation;
});

describe('/gift — purchases unavailable (fail-closed default)', () => {
  it('shows the unavailable notice; the form is read-only and the submit control says "Not available yet"', async () => {
    await render();
    expect(container.querySelector('[data-testid="gift-unavailable"]')?.textContent).toBe(en.giftCard.send.unavailable);
    expect(container.querySelector('fieldset')?.disabled).toBe(true);
    expect(submitButton().disabled).toBe(true);
    expect(submitButton().textContent).toBe(en.giftCard.send.unavailableButton);
    expect(container.textContent).not.toContain(en.giftCard.send.footer);
    // package information is still shown
    expect(container.textContent).toContain('$9.99');
  });

  it('forcing a submit starts no gift checkout and no redirect', async () => {
    await render();
    act(() => { submitButton().click(); });
    act(() => { form().dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    await flush();
    expect(giftCalls()).toHaveLength(0);
    expect(window.location.href).toBe('http://localhost/gift');
  });
});

describe('/gift — purchase path preserved for the future financial release (availability forced on)', () => {
  beforeEach(() => { mockPurchasesAvailable = true; });

  it('no notice; submitting posts the existing gift-checkout contract and follows the returned URL', async () => {
    await render();
    expect(container.querySelector('[data-testid="gift-unavailable"]')).toBeNull();
    const input = email();
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setter.call(input, 'friend@test.invalid');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await flush();
    expect(submitButton().disabled).toBe(false);
    act(() => { form().dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    await flush();
    expect(giftCalls()).toHaveLength(1);
    expect(JSON.parse(giftCalls()[0][1].body)).toEqual({ recipientEmail: 'friend@test.invalid', tokenCount: 1 });
    expect(window.location.href).toBe('https://checkout.test/gift');
  });
});
