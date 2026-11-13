/**
 * Pure billing-cycle rules for subscription token entitlements (PO decisions D1, D2, D4, D5 — 2026-11-13; see
 * docs/product-governance/COMMERCE-DECISIONS.md). No I/O: every input comes from Stripe objects.
 */

/** Paid allocations per annual billing period (D2): the annual invoice is cycle 0, the scheduler grants 1…11. */
export const ANNUAL_PAID_CYCLES = 12;

/**
 * UTC calendar-month anniversary `k` months after the period start, on the billing anchor's day-of-month and
 * time of day, clamped to the month's length (Stripe-style): anchor Jan 31 → Feb 28 (Feb 29 in a leap year),
 * Mar 31, Apr 30…; anchor Feb 29 → Mar 29 …. UTC only, so daylight-saving changes never move it.
 */
export function monthlyAnniversary(periodStart: Date, k: number, anchor: Date): Date {
  const months = periodStart.getUTCMonth() + k;
  const year = periodStart.getUTCFullYear() + Math.floor(months / 12);
  const month = ((months % 12) + 12) % 12;
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(anchor.getUTCDate(), daysInMonth);
  return new Date(Date.UTC(year, month, day, anchor.getUTCHours(), anchor.getUTCMinutes(), anchor.getUTCSeconds()));
}

/**
 * Scheduled annual cycles (k = 1…11) of ONE paid period: their due dates, all strictly inside
 * [periodStart, periodEnd). The next period's tokens are never part of this list (D2).
 */
export function annualScheduledCycles(periodStart: Date, periodEnd: Date, anchor: Date): Array<{ k: number; due: Date }> {
  const cycles: Array<{ k: number; due: Date }> = [];
  for (let k = 1; k < ANNUAL_PAID_CYCLES; k++) {
    const due = monthlyAnniversary(periodStart, k, anchor);
    if (due > periodStart && due < periodEnd) cycles.push({ k, due });
  }
  return cycles;
}

export type InvoiceClass =
  | 'renewal' // subscription_cycle — a billing period begins (any amount, incl. a valid $0 renewal: D5)
  | 'paid_creation' // subscription_create with amount > 0 — subscription started without a trial
  | 'trial_creation' // subscription_create at $0 — the free trial's invoice (T-1 is the trial grant). A $0 creation
  //                    without a trial would need a discount, which no approved program provides; it grants nothing.
  | 'update' // subscription_update — plan change / proration: never an extra cycle (D4)
  | 'other'; // manual, subscription_threshold, upcoming, missing reason…

/** Classifies a paid Stripe invoice for cycle-token eligibility (D4, D5). */
export function classifyInvoice(invoice: { billing_reason?: string | null; amount_paid?: number | null } | null | undefined): InvoiceClass {
  const reason = invoice?.billing_reason;
  const amount = typeof invoice?.amount_paid === 'number' ? invoice.amount_paid : null;
  if (reason === 'subscription_cycle') return 'renewal';
  if (reason === 'subscription_create') return amount !== null && amount > 0 ? 'paid_creation' : 'trial_creation';
  if (reason === 'subscription_update') return 'update';
  return 'other';
}

/** Only renewals and paid creations grant a cycle (D4, D5). */
export const grantsCycle = (c: InvoiceClass): boolean => c === 'renewal' || c === 'paid_creation';

/**
 * Start (unix seconds) of the billing period an invoice pays for, read from its subscription line item
 * (`lines.data[].period.start`, non-proration). Not `invoice.period_start`, which on subscription invoices refers
 * to the PREVIOUS period. null when no subscription line is present (the invoice-id key still applies).
 */
export function invoicePeriodStart(invoice: any): number | null {
  const lines: any[] = invoice?.lines?.data ?? [];
  const isSubscriptionLine = (l: any) =>
    l?.type === 'subscription' || l?.parent?.type === 'subscription_item_details' || !!l?.subscription_item || !!l?.parent?.subscription_item_details;
  const line = lines.find((l) => isSubscriptionLine(l) && !l?.proration && !l?.parent?.subscription_item_details?.proration && typeof l?.period?.start === 'number');
  return line ? line.period.start : null;
}

/**
 * D1 history signal: a Stripe subscription that ever started — it received a trial, or got past the
 * never-started `incomplete_expired` state. Gift and token-package purchases are one-time payments, never
 * subscriptions, so they can never appear here.
 */
export function subscriptionEverStarted(sub: { status?: string; trial_start?: number | null } | null | undefined): boolean {
  if (!sub) return false;
  return !!sub.trial_start || (sub.status !== undefined && sub.status !== 'incomplete_expired');
}
