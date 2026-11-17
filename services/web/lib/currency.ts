/**
 * Noetia's commercial and financial currency is USD (PO decision, 2026-11-13).
 *
 * Prices are always marked explicitly as US dollars: a bare "$" reads as the local peso in much of Latin
 * America (MXN, COP, ARS, CLP…), which would misstate the price for Spanish-speaking readers.
 */
export const COMMERCIAL_CURRENCY = 'USD' as const;

/** 899 → "US$8.99". Amounts are integer US cents, as stored in plans / token packages. */
export function formatUsd(cents: number): string {
  return `US$${(cents / 100).toFixed(2)}`;
}
