import {
  ANNUAL_PAID_CYCLES,
  annualScheduledCycles,
  classifyInvoice,
  grantsCycle,
  invoicePeriodStart,
  monthlyAnniversary,
  subscriptionEverStarted,
} from '../../../src/subscriptions/billing-cycles';

const iso = (d: Date) => d.toISOString().slice(0, 16);
const utc = (s: string) => new Date(`${s}Z`);

describe('billing-cycles (D1, D2, D4, D5)', () => {
  describe('monthlyAnniversary — UTC calendar months, clamped like Stripe', () => {
    it('regular anchor: same day and time each month', () => {
      const start = utc('2027-01-15T12:30:00');
      expect([1, 2, 11].map((k) => iso(monthlyAnniversary(start, k, start)))).toEqual(['2027-02-15T12:30', '2027-03-15T12:30', '2027-12-15T12:30']);
    });

    it('January 31 anchor → Feb 28 (non-leap), Mar 31, Apr 30 …', () => {
      const start = utc('2027-01-31T08:00:00');
      expect([1, 2, 3, 4].map((k) => iso(monthlyAnniversary(start, k, start)).slice(0, 10))).toEqual(['2027-02-28', '2027-03-31', '2027-04-30', '2027-05-31']);
    });

    it('January 31 anchor in a leap year → Feb 29', () => {
      const start = utc('2028-01-31T08:00:00');
      expect(iso(monthlyAnniversary(start, 1, start)).slice(0, 10)).toBe('2028-02-29');
    });

    it('February 29 anchor: in the leap year → Mar 29…; next period (starts Feb 28) keeps the 29th', () => {
      const anchor = utc('2028-02-29T10:00:00');
      expect(iso(monthlyAnniversary(anchor, 1, anchor)).slice(0, 10)).toBe('2028-03-29');
      const nextStart = utc('2029-02-28T10:00:00'); // Stripe renews a Feb 29 anchor on Feb 28
      expect(iso(monthlyAnniversary(nextStart, 1, anchor)).slice(0, 10)).toBe('2029-03-29');
    });

    it('crosses the year boundary', () => {
      const start = utc('2027-11-20T00:00:00');
      expect(iso(monthlyAnniversary(start, 3, start)).slice(0, 10)).toBe('2028-02-20');
    });

    it('is independent of daylight-saving time (pure UTC: same UTC hour before and after DST changes)', () => {
      const start = utc('2027-02-10T01:30:00'); // US DST starts 2027-03-14, EU 2027-03-28
      const hours = [1, 2, 3, 8, 9, 10].map((k) => monthlyAnniversary(start, k, start).getUTCHours());
      expect(new Set(hours)).toEqual(new Set([1]));
    });
  });

  describe('annualScheduledCycles — 11 scheduled + the invoice = 12 paid cycles per annual period', () => {
    it('regular period: exactly 11 cycles, all strictly inside the period, k = 1…11', () => {
      const start = utc('2027-01-15T12:00:00');
      const end = utc('2028-01-15T12:00:00');
      const cycles = annualScheduledCycles(start, end, start);
      expect(cycles).toHaveLength(ANNUAL_PAID_CYCLES - 1);
      expect(cycles.map((c) => c.k)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
      expect(cycles.every((c) => c.due > start && c.due < end)).toBe(true);
      expect(iso(cycles[10].due).slice(0, 10)).toBe('2027-12-15'); // never the next period's anniversary
    });

    it('January 31 and leap-year February 29 anchors still give 11 in-period cycles', () => {
      for (const [s, e] of [['2027-01-31T08:00:00', '2028-01-31T08:00:00'], ['2028-02-29T10:00:00', '2029-02-28T10:00:00'], ['2028-01-31T00:00:00', '2029-01-31T00:00:00']]) {
        const cycles = annualScheduledCycles(utc(s), utc(e), utc(s));
        expect(cycles).toHaveLength(11);
      }
    });

    it('a cycle that would fall on/after the period end is excluded (renewal boundary)', () => {
      const start = utc('2027-01-15T12:00:00');
      const shortEnd = utc('2027-06-15T12:00:00'); // e.g. a period shortened by Stripe
      const cycles = annualScheduledCycles(start, shortEnd, start);
      expect(cycles.map((c) => c.k)).toEqual([1, 2, 3, 4]);
    });
  });

  describe('classifyInvoice / grantsCycle (D4, D5)', () => {
    it.each([
      [{ billing_reason: 'subscription_cycle', amount_paid: 899 }, 'renewal', true],
      [{ billing_reason: 'subscription_cycle', amount_paid: 0 }, 'renewal', true], // valid $0 renewal (D5)
      [{ billing_reason: 'subscription_create', amount_paid: 899 }, 'paid_creation', true], // no trial
      [{ billing_reason: 'subscription_create', amount_paid: 0 }, 'trial_creation', false], // trial invoice (T-1 grants)
      [{ billing_reason: 'subscription_update', amount_paid: 450 }, 'update', false], // upgrade/proration (D4)
      [{ billing_reason: 'subscription_update', amount_paid: 0 }, 'update', false],
      [{ billing_reason: 'manual', amount_paid: 899 }, 'other', false],
      [{ billing_reason: 'subscription_threshold', amount_paid: 899 }, 'other', false],
      [{ amount_paid: 899 }, 'other', false],
      [null, 'other', false],
    ])('%j → %s (grants: %s)', (invoice, cls, grants) => {
      const c = classifyInvoice(invoice as any);
      expect(c).toBe(cls);
      expect(grantsCycle(c)).toBe(grants);
    });

    it('subscription_create with an unknown amount is treated as the trial invoice (grants nothing)', () => {
      expect(classifyInvoice({ billing_reason: 'subscription_create' })).toBe('trial_creation');
    });
  });

  describe('invoicePeriodStart — the billed period, from the subscription line', () => {
    it('legacy line shape (type: subscription)', () => {
      expect(invoicePeriodStart({ lines: { data: [{ type: 'subscription', period: { start: 111 } }] } })).toBe(111);
    });
    it('newer line shape (parent.subscription_item_details)', () => {
      expect(invoicePeriodStart({ lines: { data: [{ parent: { type: 'subscription_item_details', subscription_item_details: { proration: false } }, period: { start: 222 } }] } })).toBe(222);
    });
    it('ignores proration lines and uses the regular subscription line', () => {
      expect(invoicePeriodStart({ lines: { data: [
        { type: 'subscription', proration: true, period: { start: 1 } },
        { type: 'subscription', proration: false, period: { start: 333 } },
      ] } })).toBe(333);
    });
    it('F-02 reachability: a dahlia webhook payload embeds only the first 10 lines, pending prorations first → null', () => {
      const prorations = Array.from({ length: 10 }, (_, i) => ({ id: `il_${i}`, parent: { type: 'invoice_item_details', invoice_item_details: { proration: true } }, period: { start: 1000 + i } }));
      expect(invoicePeriodStart({ lines: { data: prorations, has_more: true } })).toBeNull();
    });
    it('dahlia subscription-item proration lines are not the billed period', () => {
      expect(invoicePeriodStart({ lines: { data: [{ parent: { type: 'subscription_item_details', subscription_item_details: { proration: true } }, period: { start: 9 } }] } })).toBeNull();
    });
    it('null when no subscription line (the caller then reads Stripe line items and fails closed — F-02)', () => {
      expect(invoicePeriodStart({ lines: { data: [{ type: 'invoiceitem', period: { start: 5 } }] } })).toBeNull();
      expect(invoicePeriodStart({})).toBeNull();
      expect(invoicePeriodStart(null)).toBeNull();
    });
  });

  describe('subscriptionEverStarted (D1 history signal)', () => {
    it.each([
      [{ status: 'trialing', trial_start: 1 }, true],
      [{ status: 'canceled', trial_start: 1 }, true], // cancelled during the trial — the trial was received
      [{ status: 'canceled', trial_start: null }, true], // a paid subscription that ended
      [{ status: 'active' }, true],
      [{ status: 'past_due' }, true],
      [{ status: 'incomplete_expired', trial_start: null }, false], // never started
      [{ status: 'incomplete_expired', trial_start: 5 }, true],
      [null, false],
    ])('%j → %s', (sub, expected) => {
      expect(subscriptionEverStarted(sub as any)).toBe(expected);
    });
  });
});
