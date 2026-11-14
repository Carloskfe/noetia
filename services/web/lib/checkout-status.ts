/**
 * G-1: client side of `GET /subscriptions/checkout-sessions/:id/status` (design §R3.4/§R3.5, copy §R4.4).
 *
 * The success page chooses copy ONLY through `deriveFromResponse` / `deriveFromError` — never from the untrusted
 * `?purchase=` parameter or from any other account status. The mapping is deliberately strict: any response that
 * does not match the contract exactly becomes `unavailable` (no payment, entitlement or delivery claim). In
 * particular a token response can never produce a delivery claim (R1-B): there is no token-delivered copy at all.
 */

export type CheckoutState = 'open' | 'complete' | 'expired';
export type PaymentState = 'paid' | 'unpaid' | 'no_payment_required';

export type SessionCopyKey =
  | 'checkoutOpen'
  | 'checkoutExpired'
  | 'paymentNotConfirmed'
  | 'paidProcessingTokens'
  | 'tokenPaymentConfirmed'
  | 'paidPendingBook'
  | 'deliveredBook'
  | 'unconfirmedBook'
  | 'subscriptionActive'
  | 'subscriptionPending'
  | 'subscriptionProblem'
  | 'subscriptionEnded'
  | 'subscriptionOther'
  | 'notFound'
  | 'unavailable'
  | 'auth';

export interface Derived {
  key: SessionCopyKey;
  /** Terminal states stop polling (§R3.5 terminal rule). */
  terminal: boolean;
}

/** Bounded schedule (§R2.8): the first request immediately, then 2 s × 5 and 4 s × 5 → at most 11 requests, ~30 s. */
export const POLL_DELAYS_MS: readonly number[] = [2000, 2000, 2000, 2000, 2000, 4000, 4000, 4000, 4000, 4000];
export const MAX_STATUS_REQUESTS = POLL_DELAYS_MS.length + 1;
/** A server-requested wait (429 Retry-After) is honoured, but never beyond this cap. */
export const MAX_RETRY_AFTER_MS = 30_000;

export const statusPath = (sessionId: string) => `/subscriptions/checkout-sessions/${encodeURIComponent(sessionId)}/status`;

const CHECKOUT = new Set(['open', 'complete', 'expired']);
const PAYMENT = new Set(['paid', 'unpaid', 'no_payment_required']);
const UNAVAILABLE: Derived = { key: 'unavailable', terminal: false };
const t = (key: SessionCopyKey): Derived => ({ key, terminal: true });
const nt = (key: SessionCopyKey): Derived => ({ key, terminal: false });

export function deriveFromResponse(r: unknown): Derived {
  if (!r || typeof r !== 'object') return UNAVAILABLE;
  const res = r as Record<string, unknown>;
  if (typeof res.checkout !== 'string' || !CHECKOUT.has(res.checkout)) return UNAVAILABLE;
  if (res.kind !== 'subscription' && res.kind !== 'tokens' && res.kind !== 'book') return UNAVAILABLE;

  if (res.checkout === 'open') return nt('checkoutOpen');
  if (res.checkout === 'expired') return t('checkoutExpired');

  if (res.kind === 'subscription') {
    switch (res.entitlement) {
      case 'active': return t('subscriptionActive');
      case 'payment_problem': return t('subscriptionProblem');
      case 'ended': return t('subscriptionEnded');
      case 'superseded': return t('subscriptionOther');
      case 'not_recorded':
      case null: return nt('subscriptionPending');
      default: return UNAVAILABLE;
    }
  }

  if (typeof res.payment !== 'string' || !PAYMENT.has(res.payment)) return UNAVAILABLE;
  if (res.payment !== 'paid') return nt('paymentNotConfirmed');

  if (res.kind === 'tokens') {
    // R1-B: `unconfirmed` (complete + paid + fulfillment key) is the strongest token outcome. Anything else —
    // including a contract-violating `delivered` — never yields a delivery claim.
    if (res.delivery === 'pending') return nt('paidProcessingTokens');
    if (res.delivery === 'unconfirmed') return t('tokenPaymentConfirmed');
    return UNAVAILABLE;
  }
  if (res.delivery === 'pending') return nt('paidPendingBook');
  if (res.delivery === 'delivered') return t('deliveredBook');
  if (res.delivery === 'unconfirmed') return t('unconfirmedBook');
  return UNAVAILABLE;
}

/** HTTP/network failures: 401 → sign in, 404 → not found (both terminal); everything else → unavailable, retried. */
export function deriveFromError(e: unknown): Derived {
  const status = (e as { status?: number } | null)?.status;
  if (status === 401) return t('auth');
  if (status === 404) return t('notFound');
  return UNAVAILABLE;
}

/** Wait before the next request: the schedule's delay, extended (capped) by a 429's Retry-After. */
export function nextDelay(attempt: number, e?: unknown): number {
  const base = POLL_DELAYS_MS[Math.min(attempt, POLL_DELAYS_MS.length - 1)];
  const err = e as { status?: number; retryAfter?: number } | undefined;
  if (err?.status === 429 && typeof err.retryAfter === 'number' && err.retryAfter > 0) {
    return Math.max(base, Math.min(err.retryAfter * 1000, MAX_RETRY_AFTER_MS));
  }
  return base;
}

/** The sign-in return path keeps the Checkout session id and a permitted purchase value — nothing else. */
export function successReturnPath(sessionId: string | null, purchase: string | null): string {
  const q = new URLSearchParams();
  if (sessionId) q.set('session_id', sessionId);
  if (purchase === 'tokens' || purchase === 'book' || purchase === 'gift') q.set('purchase', purchase);
  const qs = q.toString();
  return `/billing/success${qs ? `?${qs}` : ''}`;
}
