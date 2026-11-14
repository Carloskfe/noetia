import { COMMERCIAL_CURRENCY, formatUsd } from '@/lib/currency';

describe('currency (USD — PO decision 2026-11-13)', () => {
  it('the commercial currency is USD', () => {
    expect(COMMERCIAL_CURRENCY).toBe('USD');
  });

  it.each([
    [899, 'US$8.99'],
    [8399, 'US$83.99'],
    [1399, 'US$13.99'],
    [999, 'US$9.99'],
    [0, 'US$0.00'],
    [700, 'US$7.00'],
  ])('formatUsd(%i) = %s', (cents, out) => {
    expect(formatUsd(cents)).toBe(out);
  });

  it('never renders a bare "$" amount (always marked as US dollars)', () => {
    expect(formatUsd(1899)).toMatch(/^US\$/);
  });
});
