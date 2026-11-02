jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, ...props }: any) => {
    const React = require('react');
    return React.createElement('a', props, children);
  },
}));
jest.mock('@/components/CauseSelector', () => ({ __esModule: true, default: () => null }));

let mockDict: any;
jest.mock('@/lib/i18n', () => ({ useTranslation: () => ({ t: mockDict }) }));

import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import PricingPage from '@/app/(billing)/pricing/page';
import { en } from '@/lib/i18n/en';
import { es } from '@/lib/i18n/es';

(global as any).IS_REACT_ACT_ENVIRONMENT = true;

// Shape of GET /api/subscriptions/plans in production after NOF-003 (legacy internal names).
const PRODUCTION_PLANS = [
  { id: 'ind-m', name: 'Individual Monthly', interval: 'month', amountCents: 899, tokensPerCycle: 1, maxProfiles: 1 },
  { id: 'duo-m', name: 'Dual Reader Monthly', interval: 'month', amountCents: 1399, tokensPerCycle: 2, maxProfiles: 2 },
  { id: 'fam-m', name: 'Family', interval: 'month', amountCents: 1899, tokensPerCycle: 4, maxProfiles: 5 },
  { id: 'ind-y', name: 'Individual Annual', interval: 'year', amountCents: 8399, tokensPerCycle: 1, maxProfiles: 1 },
  { id: 'duo-y', name: 'Dual Reader Annual', interval: 'year', amountCents: 12999, tokensPerCycle: 2, maxProfiles: 2 },
  { id: 'fam-y', name: 'Family', interval: 'year', amountCents: 17999, tokensPerCycle: 4, maxProfiles: 5 },
];

let container: HTMLDivElement;
let root: Root;

function mockApi(plans = PRODUCTION_PLANS) {
  global.fetch = jest.fn((url: string) => {
    const body =
      url === '/api/subscriptions/plans' ? plans :
      url === '/api/subscriptions/token-packages' ? [] :
      null;
    return Promise.resolve({ ok: body !== null, json: () => Promise.resolve(body) } as Response);
  }) as unknown as typeof fetch;
}

async function renderPage(dict: typeof en) {
  mockDict = dict;
  await act(async () => {
    root.render(React.createElement(PricingPage));
  });
  await act(async () => {});
}

async function showInterval(label: string) {
  const button = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.startsWith(label))!;
  await act(async () => {
    button.click();
  });
}

type Card = { label: string; price: string; tagline: string; highlights: string[]; popular: boolean };

function cards(): Card[] {
  return Array.from(container.querySelectorAll<HTMLElement>('div.relative.rounded-2xl')).map((card) => ({
    label: card.querySelector('p.uppercase')!.textContent!,
    price: card.querySelector('span.text-3xl')!.textContent!,
    tagline: card.querySelector('p.text-sm.text-gray-500')!.textContent!,
    highlights: Array.from(card.querySelectorAll('li')).map((li) => li.textContent!.replace('✓', '')),
    popular: card.textContent!.includes(mockDict.pricing.popular),
  }));
}

beforeEach(() => {
  mockApi();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  jest.restoreAllMocks();
});

describe.each([
  ['en', en, ['Individual', 'Duo', 'Family']],
  ['es', es, ['Individual', 'Dúo', 'Familia']],
] as const)('PricingPage (%s)', (_lang, dict, labels) => {
  const keys = ['Individual', 'Duo', 'Family'] as const;

  it('renders the three monthly cards with approved names, prices, taglines and benefits', async () => {
    await renderPage(dict);

    const rendered = cards();
    expect(rendered.map((c) => c.label)).toEqual(labels);
    expect(rendered.map((c) => c.price)).toEqual(['$8.99', '$13.99', '$18.99']);
    rendered.forEach((card, i) => {
      expect(card.tagline).toBe(dict.pricing.planDescriptions[keys[i]].tagline);
      expect(card.highlights).toEqual(dict.pricing.planDescriptions[keys[i]].highlights);
    });
  });

  it('renders the three annual cards with approved names, prices, taglines and benefits', async () => {
    await renderPage(dict);
    await showInterval(dict.pricing.annual);

    const rendered = cards();
    expect(rendered.map((c) => c.label)).toEqual(labels);
    expect(rendered.map((c) => c.price)).toEqual(['$83.99', '$129.99', '$179.99']);
    rendered.forEach((card, i) => {
      expect(card.tagline).toBe(dict.pricing.planDescriptions[keys[i]].tagline);
      expect(card.highlights).toEqual(dict.pricing.planDescriptions[keys[i]].highlights);
    });
  });

  it('shows the popular badge only on Duo, for both intervals', async () => {
    await renderPage(dict);
    expect(cards().map((c) => c.popular)).toEqual([false, true, false]);

    await showInterval(dict.pricing.annual);
    expect(cards().map((c) => c.popular)).toEqual([false, true, false]);
  });

  it('never shows a raw internal plan name on a card', async () => {
    // Scoped to cards: the interval toggle itself is legitimately labelled "Monthly" / "Annual".
    const cardText = () => cards().map((c) => `${c.label} ${c.tagline} ${c.highlights.join(' ')}`).join(' | ');
    await renderPage(dict);
    expect(cardText()).not.toMatch(/Dual Reader|Monthly|Annual/);
    expect(container.textContent).not.toContain('Dual Reader');

    await showInterval(dict.pricing.annual);
    expect(cardText()).not.toMatch(/Dual Reader|Monthly|Annual/);
    expect(container.textContent).not.toContain('Dual Reader');
  });
});

describe('PricingPage — unmapped plan names', () => {
  it('shows the raw name with no benefits rather than the wrong plan copy', async () => {
    mockApi([{ id: 'x', name: 'Noetia Plus', interval: 'month', amountCents: 600, tokensPerCycle: 0, maxProfiles: 1 }]);
    await renderPage(en);

    const [card] = cards();
    expect(card.label).toBe('Noetia Plus');
    expect(card.tagline).toBe('');
    expect(card.highlights).toEqual([]);
    expect(card.popular).toBe(false);
  });
});
