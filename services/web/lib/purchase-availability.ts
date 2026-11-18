/**
 * Web purchase availability: FAIL CLOSED (PO 2026-11-18, PR #59).
 *
 * Decides only whether the web PRESENTS subscription, token-package and gift purchase controls as actionable.
 * It is NOT a payment-activation mechanism and must never be treated as one: whether a payment can happen is
 * decided solely by the API gate (PR #63, `services/api/src/common/payments-activation.ts`: Stripe exists only when
 * `PAYMENTS_ENABLED` is exactly "true" AND a real Stripe secret key is configured). With this constant `false`,
 * the web shows prices and plan information, disables every purchase control, and never calls the checkout,
 * token-purchase or gift-checkout endpoints, so it can't look ready while the backend is disabled.
 *
 * Deliberately a reviewed code constant, not an environment variable: turning it on requires a pull request
 * reviewed as part of the financial release, so there is no separate, ungoverned activation switch.
 *
 * Turning it on (financial release only, separate PO authorization):
 *   1. PR #60's lifecycle work is integrated with every Stripe client going through `createStripeClient`
 *      (including `CheckoutStatusService`), and the remaining financial gates (G-1, G-4, G-5, W-1, W-2, USD-1,
 *      D4, webhooks, Terms/legal) are closed.
 *   2. The public pricing copy (subtitle, trial wording per D1, currency) is approved for the live state.
 *   3. Order: deploy this constant as `true` together with, or immediately after, setting `PAYMENTS_ENABLED=true`
 *      and verifying the API boot line `[payments] ENABLED (Stripe live mode)`. Never set it before the backend
 *      is enabled. If the backend is later disabled (kill switch), revert this constant in the same release
 *      window: the API still fails closed, but the web would otherwise show purchase controls that end in an error.
 */
export const PURCHASES_AVAILABLE: boolean = false;

export function purchasesAvailable(): boolean {
  return PURCHASES_AVAILABLE;
}
