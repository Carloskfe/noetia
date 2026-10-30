import { apiClient } from './client';

// Book acquisition by token (PO-021 / PO-023, NEM-012). Paid books are only ever
// acquired by redeeming a token — there is no per-title purchase (B-1).

// Follows the build's web origin like the API follows EXPO_PUBLIC_API_URL, so a
// staging build never sends a tester to the production checkout.
const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL ?? 'https://noetia.app').replace(/\/+$/, '');
export const TOKENS_URL = `${WEB_URL}/pricing#tokens`;

export type AccessDenial = {
  reason: 'subscription_required' | 'payment_required' | 'acquisition_required';
  bookId?: string;
};

const DENIAL_REASONS: ReadonlyArray<AccessDenial['reason']> = [
  'subscription_required',
  'payment_required',
  'acquisition_required',
];

/** A 403 from a content endpoint that an unlock can resolve — or null for any other error. */
export function readAccessDenial(err: unknown): AccessDenial | null {
  const e = err as { status?: number; data?: { error?: string; bookId?: string } } | null;
  if (e?.status !== 403) return null;
  const reason = e.data?.error as AccessDenial['reason'] | undefined;
  if (!reason || !DENIAL_REASONS.includes(reason)) return null;
  return { reason, bookId: e.data?.bookId };
}

/** Tokens the user can spend right now: own tokens plus a household pool. */
export function availableTokensOf(status: unknown): number {
  const s = status as { availableTokens?: number; tokenBalance?: number } | null;
  const n = s?.availableTokens ?? s?.tokenBalance ?? 0;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export async function fetchAvailableTokens(): Promise<number | null> {
  try {
    return availableTokensOf(await apiClient.get<unknown>('/subscriptions/me'));
  } catch {
    return null;
  }
}

export type UnlockOutcome = 'unlocked' | 'already_owned' | 'no_tokens' | 'email_unconfirmed' | 'not_found' | 'error';

export function unlockOutcomeOf(err: unknown): UnlockOutcome {
  const e = err as { status?: number; data?: { error?: string; message?: string } } | null;
  const code = e?.data?.error;
  if (code === 'already_owned') return 'already_owned';
  if (code === 'no_tokens_remaining') return 'no_tokens';
  if (e?.data?.message === 'EMAIL_NOT_CONFIRMED') return 'email_unconfirmed';
  if (e?.status === 404) return 'not_found';
  return 'error';
}

/** Redeems one token for the book. `already_owned` is a success for the customer (e.g. a double tap). */
export async function unlockBook(bookId: string): Promise<UnlockOutcome> {
  try {
    await apiClient.post(`/subscriptions/books/${encodeURIComponent(bookId)}/redeem`, {});
    return 'unlocked';
  } catch (err) {
    return unlockOutcomeOf(err);
  }
}

/** Whether the user owns the book, from `GET /library/ids`; null when it cannot be determined. */
export async function fetchOwnership(bookId: string): Promise<boolean | null> {
  try {
    const ids = await apiClient.get<unknown>('/library/ids');
    return Array.isArray(ids) ? ids.includes(bookId) : null;
  } catch {
    return null;
  }
}

export type BookAccess<T> =
  | { kind: 'allowed'; book: T }
  | { kind: 'denied'; denial: AccessDenial }
  | { kind: 'unknown' };

/**
 * Asks the server whether the user may read the book now. `unknown` means the
 * server could not be reached (offline) or answered with an unrelated error.
 */
export async function checkBookAccess<T>(bookId: string): Promise<BookAccess<T>> {
  try {
    return { kind: 'allowed', book: await apiClient.get<T>(`/books/${encodeURIComponent(bookId)}`) };
  } catch (err) {
    const denial = readAccessDenial(err);
    return denial ? { kind: 'denied', denial } : { kind: 'unknown' };
  }
}
