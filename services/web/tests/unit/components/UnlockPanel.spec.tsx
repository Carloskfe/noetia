jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, ...props }: any) => {
    const React = require('react');
    return React.createElement('a', props, children);
  },
}));

jest.mock('@/lib/i18n', () => ({
  useTranslation: () => ({
    t: {
      acquisition: {
        title: 'Unlock this book',
        subtitle: 'Use 1 token to keep it forever.',
        balance: (n: number) => `You have ${n} tokens`,
        checkingBalance: 'Checking…',
        unlock: 'Unlock with 1 token',
        unlocking: 'Unlocking…',
        getTokens: 'Get tokens',
        noTokens: 'No tokens yet.',
        confirmEmail: 'Confirm your email.',
        signIn: 'Sign in to unlock',
        error: 'Something went wrong.',
        readingWithPlan: 'Readable with your plan.',
        paymentPending: 'Payment pending.',
        close: 'Close',
      },
    },
  }),
}));

const mockFetchAvailableTokens = jest.fn();
const mockUnlockBook = jest.fn();
jest.mock('@/lib/acquisition', () => ({
  fetchAvailableTokens: () => mockFetchAvailableTokens(),
  unlockBook: (id: string) => mockUnlockBook(id),
}));
const mockApiFetch = jest.fn();
jest.mock('@/lib/api', () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }));

import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { UnlockDialog, UnlockPanel, UnlockScreen } from '@/components/UnlockPanel';

(global as any).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem('access_token', 'tok');
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  localStorage.clear();
});

const flush = () => act(async () => { await Promise.resolve(); });
const text = () => container.textContent ?? '';
const button = (label: string) =>
  Array.from(container.querySelectorAll('button')).find((b) => b.textContent === label) as HTMLButtonElement | undefined;
const link = (label: string) =>
  Array.from(container.querySelectorAll('a')).find((a) => a.textContent === label) as HTMLAnchorElement | undefined;

async function renderPanel(props: Partial<React.ComponentProps<typeof UnlockPanel>> = {}) {
  const onUnlocked = jest.fn();
  await act(async () => {
    root.render(<UnlockPanel bookId="b1" title="Libro" onUnlocked={onUnlocked} {...props} />);
  });
  await flush();
  return onUnlocked;
}

describe('UnlockPanel', () => {
  it('shows the available balance and unlocks with one token', async () => {
    mockFetchAvailableTokens.mockResolvedValue(2);
    mockUnlockBook.mockResolvedValue('unlocked');
    const onUnlocked = await renderPanel();

    expect(text()).toContain('You have 2 tokens');
    await act(async () => { button('Unlock with 1 token')!.click(); });

    expect(mockUnlockBook).toHaveBeenCalledWith('b1');
    expect(onUnlocked).toHaveBeenCalledTimes(1);
  });

  it('treats already_owned (e.g. a double tap) as success', async () => {
    mockFetchAvailableTokens.mockResolvedValue(1);
    mockUnlockBook.mockResolvedValue('already_owned');
    const onUnlocked = await renderPanel();
    await act(async () => { button('Unlock with 1 token')!.click(); });
    expect(onUnlocked).toHaveBeenCalled();
  });

  it('with no tokens, offers Get tokens instead of the unlock button — never a per-title purchase', async () => {
    mockFetchAvailableTokens.mockResolvedValue(0);
    await renderPanel();

    expect(button('Unlock with 1 token')).toBeUndefined();
    expect(text()).toContain('No tokens yet.');
    expect(link('Get tokens')!.getAttribute('href')).toBe('/pricing#tokens');
    expect(text().toLowerCase()).not.toMatch(/buy this|purchase|comprar este/);
  });

  it('switches to Get tokens when the API reports no_tokens_remaining', async () => {
    mockFetchAvailableTokens.mockResolvedValue(1);
    mockUnlockBook.mockResolvedValue('no_tokens');
    const onUnlocked = await renderPanel();
    await act(async () => { button('Unlock with 1 token')!.click(); });
    expect(onUnlocked).not.toHaveBeenCalled();
    expect(text()).toContain('No tokens yet.');
  });

  it.each([
    ['email_unconfirmed', 'Confirm your email.'],
    ['error', 'Something went wrong.'],
    ['not_found', 'Something went wrong.'],
  ])('shows the %s message and keeps the unlock button available', async (outcome, message) => {
    mockFetchAvailableTokens.mockResolvedValue(1);
    mockUnlockBook.mockResolvedValue(outcome);
    await renderPanel();
    await act(async () => { button('Unlock with 1 token')!.click(); });
    expect(text()).toContain(message);
    expect(button('Unlock with 1 token')!.disabled).toBe(false);
  });

  it('asks a signed-out visitor to sign in and return to the book', async () => {
    localStorage.clear();
    await renderPanel();
    expect(mockFetchAvailableTokens).not.toHaveBeenCalled();
    expect(link('Sign in to unlock')!.getAttribute('href')).toBe('/login?next=%2Freader%2Fb1');
  });

  it('explains plan access and a pending payment when relevant', async () => {
    mockFetchAvailableTokens.mockResolvedValue(1);
    await renderPanel({ readableWithPlan: true, reason: 'payment_required' });
    expect(text()).toContain('Readable with your plan.');
    expect(text()).toContain('Payment pending.');
  });

  it('disables unlock while the balance is still loading', async () => {
    mockFetchAvailableTokens.mockReturnValue(new Promise(() => {}));
    await renderPanel();
    expect(text()).toContain('Checking…');
    expect(button('Unlock with 1 token')!.disabled).toBe(true);
  });
});

describe('UnlockDialog', () => {
  it('is a labelled modal that closes from its button and the backdrop', async () => {
    mockFetchAvailableTokens.mockResolvedValue(1);
    const onClose = jest.fn();
    await act(async () => {
      root.render(<UnlockDialog bookId="b1" onUnlocked={jest.fn()} onClose={onClose} />);
    });
    const dialog = container.querySelector('[role="dialog"]') as HTMLDivElement;
    expect(dialog.getAttribute('aria-label')).toBe('Unlock this book');
    act(() => button('Close')!.click());
    act(() => dialog.click());
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe('UnlockScreen', () => {
  it('loads public book metadata from the summary endpoint', async () => {
    mockFetchAvailableTokens.mockResolvedValue(1);
    mockApiFetch.mockResolvedValue({ title: 'Cien años', author: 'GGM', coverUrl: null });
    await act(async () => {
      root.render(<UnlockScreen bookId="b1" reason="subscription_required" onUnlocked={jest.fn()} />);
    });
    await flush();
    expect(mockApiFetch).toHaveBeenCalledWith('/books/b1/summary');
    expect(text()).toContain('Cien años');
  });

  it('still offers the unlock when the summary cannot be loaded', async () => {
    mockFetchAvailableTokens.mockResolvedValue(1);
    mockApiFetch.mockRejectedValue(new Error('down'));
    await act(async () => {
      root.render(<UnlockScreen bookId="b1" onUnlocked={jest.fn()} />);
    });
    await flush();
    expect(button('Unlock with 1 token')).toBeDefined();
  });
});
