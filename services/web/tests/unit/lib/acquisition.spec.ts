jest.mock('@/lib/api', () => ({ apiFetch: jest.fn() }));

import {
  availableTokensOf,
  fetchAvailableTokens,
  fetchOwnership,
  readAccessDenial,
  unlockBook,
  unlockOutcomeOf,
  wantsUnlock,
} from '@/lib/acquisition';

const apiError = (status: number, data: Record<string, unknown>) => Object.assign(new Error('x'), { status, data });

describe('readAccessDenial', () => {
  it.each(['subscription_required', 'payment_required', 'acquisition_required'])('recognises a 403 %s as an unlockable denial', (reason) => {
    expect(readAccessDenial(apiError(403, { error: reason, bookId: 'b1' }))).toEqual({ reason, bookId: 'b1' });
  });

  it('returns null for other errors', () => {
    expect(readAccessDenial(apiError(403, { message: 'EMAIL_NOT_CONFIRMED' }))).toBeNull();
    expect(readAccessDenial(apiError(404, { error: 'subscription_required' }))).toBeNull();
    expect(readAccessDenial(new Error('network'))).toBeNull();
    expect(readAccessDenial(null)).toBeNull();
  });
});

describe('availableTokensOf', () => {
  it('prefers availableTokens, falls back to tokenBalance, defaults to 0', () => {
    expect(availableTokensOf({ availableTokens: 3, tokenBalance: 1 })).toBe(3);
    expect(availableTokensOf({ tokenBalance: 2 })).toBe(2);
    expect(availableTokensOf({ status: 'none' })).toBe(0);
    expect(availableTokensOf(null)).toBe(0);
  });

  it('never returns a negative or fractional count', () => {
    expect(availableTokensOf({ availableTokens: -1 })).toBe(0);
    expect(availableTokensOf({ availableTokens: 2.7 })).toBe(2);
    expect(availableTokensOf({ availableTokens: NaN })).toBe(0);
  });
});

describe('fetchAvailableTokens', () => {
  it('reads the balance from /subscriptions/me (works for free accounts)', async () => {
    const fetcher = jest.fn().mockResolvedValue({ status: 'none', tokenBalance: 2, availableTokens: 2 });
    await expect(fetchAvailableTokens(fetcher)).resolves.toBe(2);
    expect(fetcher).toHaveBeenCalledWith('/subscriptions/me');
  });

  it('returns null when the balance cannot be read', async () => {
    await expect(fetchAvailableTokens(jest.fn().mockRejectedValue(new Error('down')))).resolves.toBeNull();
  });
});

describe('unlockBook / unlockOutcomeOf', () => {
  it('redeems one token for the book', async () => {
    const fetcher = jest.fn().mockResolvedValue({});
    await expect(unlockBook('b 1', fetcher)).resolves.toBe('unlocked');
    expect(fetcher).toHaveBeenCalledWith('/subscriptions/books/b%201/redeem', { method: 'POST' });
  });

  it.each([
    [apiError(400, { error: 'already_owned' }), 'already_owned'],
    [apiError(403, { error: 'no_tokens_remaining' }), 'no_tokens'],
    [apiError(403, { message: 'EMAIL_NOT_CONFIRMED' }), 'email_unconfirmed'],
    [apiError(404, { message: 'Book not found' }), 'not_found'],
    [apiError(500, {}), 'error'],
    [new Error('offline'), 'error'],
  ])('maps a failed redeem to the customer outcome (%#)', async (err, outcome) => {
    expect(unlockOutcomeOf(err)).toBe(outcome);
    await expect(unlockBook('b1', jest.fn().mockRejectedValue(err))).resolves.toBe(outcome);
  });
});

describe('fetchOwnership', () => {
  it('reports ownership from the library ids', async () => {
    await expect(fetchOwnership('b1', jest.fn().mockResolvedValue(['b0', 'b1']))).resolves.toBe(true);
    await expect(fetchOwnership('b2', jest.fn().mockResolvedValue(['b0', 'b1']))).resolves.toBe(false);
  });

  it('returns null when ownership cannot be determined', async () => {
    await expect(fetchOwnership('b1', jest.fn().mockResolvedValue({}))).resolves.toBeNull();
    await expect(fetchOwnership('b1', jest.fn().mockRejectedValue(new Error('x')))).resolves.toBeNull();
  });
});

describe('wantsUnlock', () => {
  it('is true only for unlock=1', () => {
    expect(wantsUnlock('?unlock=1')).toBe(true);
    expect(wantsUnlock('?unlock=0')).toBe(false);
    expect(wantsUnlock('')).toBe(false);
  });
});
