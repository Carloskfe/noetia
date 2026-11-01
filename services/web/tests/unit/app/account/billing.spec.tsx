jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, ...props }: any) => {
    const React = require('react');
    return React.createElement('a', props, children);
  },
}));

let mockDict: any;
jest.mock('@/lib/i18n', () => ({ useTranslation: () => ({ t: mockDict }) }));

import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import BillingSettingsPage from '@/app/(account)/account/billing/page';
import { en } from '@/lib/i18n/en';
import { es } from '@/lib/i18n/es';

(global as any).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function mockApi(planName: string | null, maxProfiles: number, linkedCount: number) {
  global.fetch = jest.fn((url: string) => {
    const body =
      url === '/api/subscriptions/me'
        ? { status: 'active', planId: 'p1', planName, maxProfiles, currentPeriodEnd: '2026-12-01T00:00:00Z' }
        : {
            linkedUsers: Array.from({ length: linkedCount }, (_, i) => ({ id: `u${i}`, name: `Member ${i}`, email: null, avatarUrl: null })),
            pendingInvites: [],
            maxProfiles,
            isOwner: true,
          };
    return Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response);
  }) as unknown as typeof fetch;
}

async function renderPage(dict: typeof en) {
  mockDict = dict;
  await act(async () => {
    root.render(React.createElement(BillingSettingsPage));
  });
  await act(async () => {});
}

function planNameShown(): string {
  return container.querySelector('span.font-medium')!.textContent!;
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  jest.restoreAllMocks();
});

describe('BillingSettingsPage plan name', () => {
  it.each([
    ['Individual Monthly', en, 'Individual'],
    ['Individual Annual', es, 'Individual'],
    ['Dual Reader Monthly', en, 'Duo'],
    ['Dual Reader Annual', es, 'Dúo'],
    ['Family', en, 'Family'],
    ['Family', es, 'Familia'],
  ])('shows %p as the localized name', async (internal, dict, expected) => {
    mockApi(internal, 1, 0);
    await renderPage(dict);

    expect(planNameShown()).toBe(expected);
    expect(container.textContent).not.toMatch(/Dual Reader|Monthly|Annual/);
  });

  it('falls back to the generic "Plan" label when there is no plan name', async () => {
    mockApi(null, 1, 0);
    await renderPage(en);

    expect(planNameShown()).toBe(en.billing.plan);
  });
});

describe('BillingSettingsPage capacity message', () => {
  it('is localized in English when the plan is full', async () => {
    mockApi('Dual Reader Monthly', 2, 1);
    await renderPage(en);

    expect(container.textContent).toContain('Plan full — 2 of 2 users.');
    expect(container.textContent).not.toContain('Plan completo');
  });

  it('is localized in Spanish when the plan is full', async () => {
    mockApi('Family', 5, 4);
    await renderPage(es);

    expect(container.textContent).toContain('Plan completo — 5 de 5 usuarios.');
  });

  it('is not shown while the plan has room', async () => {
    mockApi('Family', 5, 1);
    await renderPage(en);

    expect(container.textContent).not.toContain('Plan full');
  });
});
