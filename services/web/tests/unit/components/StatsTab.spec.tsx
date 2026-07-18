// Mock i18n so StatsTab has its labels without a LanguageProvider.
jest.mock('@/lib/i18n', () => ({
  useTranslation: () => ({
    t: {
      common: { loading: 'Loading…' },
      stats: {
        thisWeek: 'This week',
        streak: 'Day streak',
        streakDays: (n: number) => `${n} days`,
        allTimePhrases: 'Phrases read',
        booksThisWeek: 'Books this week',
        minutesFmt: (n: number) => `${n} min`,
        noData: 'No reading this week yet',
        period: {
          days: '7 days',
          weeks: 'Weeks',
          months: 'Months',
          rangeWeeks: 'Last 12 weeks',
          rangeMonths: 'Last 12 months',
          activeWeeks: (n: number) => `${n} active weeks`,
          activeMonths: (n: number) => `${n} active months`,
          empty: 'No reading yet',
        },
        goals: {
          title: 'Weekly goals',
          weeklyMinutes: 'Minutes per week',
          weeklyBooks: 'Books per week',
          minutesPlaceholder: 'e.g. 60',
          booksPlaceholder: 'e.g. 1',
          save: 'Save goals',
          saving: 'Saving…',
          saved: 'Goals saved',
          progress: (c: number, g: number) => `${c} / ${g}`,
        },
      },
    },
  }),
}));

import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import StatsTab from '@/components/StatsTab';

(global as any).IS_REACT_ACT_ENVIRONMENT = true;

const STATS = {
  thisWeek: Array.from({ length: 7 }, (_, i) => ({
    date: `2026-07-${String(12 + i).padStart(2, '0')}`,
    minutes: i,
    phrases: i * 10,
  })),
  thisWeekMinutes: 21,
  thisWeekPhrases: 210,
  booksThisWeek: 2,
  streak: 3,
  allTimeMinutes: 100,
  allTimePhrases: 500,
  goals: { weeklyMinutes: null, weeklyBooks: null },
};

const HISTORY = {
  weekly: Array.from({ length: 12 }, (_, i) => ({
    start: new Date(Date.UTC(2026, 3, 6) + i * 7 * 86_400_000).toISOString().slice(0, 10),
    minutes: i === 11 ? 40 : 0,
    phrases: 0,
    activeDays: i === 11 ? 4 : 0,
  })),
  monthly: Array.from({ length: 12 }, (_, i) => ({
    start: `2026-${String(i + 1).padStart(2, '0')}-01`,
    minutes: i,
    phrases: 0,
    activeDays: i,
  })),
};

let container: HTMLDivElement;
let root: Root;

function mockFetch(): void {
  global.fetch = jest.fn((url: string) => {
    const body = String(url).includes('/history') ? HISTORY : STATS;
    return Promise.resolve({ ok: true, json: async () => body } as Response);
  }) as unknown as typeof fetch;
}

async function render(): Promise<void> {
  await act(async () => {
    root.render(React.createElement(StatsTab));
  });
  // flush the two fetch microtask chains
  await act(async () => { await Promise.resolve(); });
}

function click(el: Element | null | undefined): void {
  act(() => { el?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
}

function toggle(label: string): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll('button')).find((b) => b.textContent === label);
}

function bars(): HTMLElement[] {
  return Array.from(container.querySelectorAll('[data-testid="stat-bar"]'));
}

beforeEach(() => {
  localStorage.setItem('noetia_token', 'test-token');
  mockFetch();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  localStorage.clear();
  jest.restoreAllMocks();
});

describe('StatsTab period views', () => {
  it('defaults to the 7-day view with 7 bars', async () => {
    await render();
    expect(bars()).toHaveLength(7);
    expect(toggle('7 days')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('fetches both /stats/me and /stats/history on mount', async () => {
    await render();
    const urls = (global.fetch as jest.Mock).mock.calls.map((c) => String(c[0]));
    expect(urls).toContain('/api/stats/me');
    expect(urls).toContain('/api/stats/history');
  });

  it('switches to the weekly view showing 12 week bars and a range caption', async () => {
    await render();
    click(toggle('Weeks'));
    expect(bars()).toHaveLength(12);
    // 40 total minutes, 1 active week
    expect(container.textContent).toContain('Last 12 weeks');
    expect(container.textContent).toContain('40 min');
    expect(container.textContent).toContain('1 active weeks');
  });

  it('switches to the monthly view showing 12 month bars', async () => {
    await render();
    click(toggle('Months'));
    expect(bars()).toHaveLength(12);
    expect(container.textContent).toContain('Last 12 months');
  });

  it('shows the empty caption when the aggregated period has no reading', async () => {
    global.fetch = jest.fn((url: string) => {
      const empty = { weekly: [], monthly: [] };
      const body = String(url).includes('/history') ? empty : STATS;
      return Promise.resolve({ ok: true, json: async () => body } as Response);
    }) as unknown as typeof fetch;
    await render();
    click(toggle('Weeks'));
    expect(container.textContent).toContain('No reading yet');
  });
});
