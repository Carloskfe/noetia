jest.mock('../../../src/api/client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn() },
}));

import { apiClient } from '../../../src/api/client';
import {
  TOKENS_URL,
  availableTokensOf,
  fetchAvailableTokens,
  fetchOwnership,
  readAccessDenial,
  unlockBook,
  unlockOutcomeOf,
} from '../../../src/api/acquisition';

const get = apiClient.get as jest.Mock;
const post = apiClient.post as jest.Mock;
const apiError = (status: number, data: Record<string, unknown>) => Object.assign(new Error('x'), { status, data });

beforeEach(() => jest.clearAllMocks());

describe('readAccessDenial', () => {
  it.each(['subscription_required', 'payment_required', 'acquisition_required'])('recognises a 403 %s', (reason) => {
    expect(readAccessDenial(apiError(403, { error: reason, bookId: 'b1' }))).toEqual({ reason, bookId: 'b1' });
  });

  it('ignores other errors', () => {
    expect(readAccessDenial(apiError(403, { message: 'EMAIL_NOT_CONFIRMED' }))).toBeNull();
    expect(readAccessDenial(apiError(500, { error: 'subscription_required' }))).toBeNull();
    expect(readAccessDenial(undefined)).toBeNull();
  });
});

describe('balances', () => {
  it('prefers availableTokens, falls back to tokenBalance, never negative', () => {
    expect(availableTokensOf({ availableTokens: 3, tokenBalance: 1 })).toBe(3);
    expect(availableTokensOf({ tokenBalance: 2 })).toBe(2);
    expect(availableTokensOf({ availableTokens: -2 })).toBe(0);
    expect(availableTokensOf(null)).toBe(0);
  });

  it('reads a free account balance from /subscriptions/me', async () => {
    get.mockResolvedValue({ status: 'none', tokenBalance: 1, availableTokens: 1 });
    await expect(fetchAvailableTokens()).resolves.toBe(1);
    expect(get).toHaveBeenCalledWith('/subscriptions/me');
  });

  it('returns null when the balance cannot be read', async () => {
    get.mockRejectedValue(new Error('offline'));
    await expect(fetchAvailableTokens()).resolves.toBeNull();
  });
});

describe('unlockBook', () => {
  it('redeems one token for the book', async () => {
    post.mockResolvedValue({});
    await expect(unlockBook('b 1')).resolves.toBe('unlocked');
    expect(post).toHaveBeenCalledWith('/subscriptions/books/b%201/redeem', {});
  });

  it.each([
    [apiError(400, { error: 'already_owned' }), 'already_owned'],
    [apiError(403, { error: 'no_tokens_remaining' }), 'no_tokens'],
    [apiError(403, { message: 'EMAIL_NOT_CONFIRMED' }), 'email_unconfirmed'],
    [apiError(404, {}), 'not_found'],
    [new Error('offline'), 'error'],
  ])('maps a failed redeem to the customer outcome (%#)', async (err, outcome) => {
    expect(unlockOutcomeOf(err)).toBe(outcome);
    post.mockRejectedValue(err);
    await expect(unlockBook('b1')).resolves.toBe(outcome);
  });
});

describe('fetchOwnership', () => {
  it('reports ownership from the library ids', async () => {
    get.mockResolvedValue(['b1']);
    await expect(fetchOwnership('b1')).resolves.toBe(true);
    get.mockResolvedValue([]);
    await expect(fetchOwnership('b1')).resolves.toBe(false);
  });

  it('returns null when ownership cannot be determined', async () => {
    get.mockResolvedValue({});
    await expect(fetchOwnership('b1')).resolves.toBeNull();
    get.mockRejectedValue(new Error('x'));
    await expect(fetchOwnership('b1')).resolves.toBeNull();
  });
});

it('sends customers to the token packs, never to a per-title purchase', () => {
  expect(TOKENS_URL).toBe('https://noetia.app/pricing#tokens');
});
