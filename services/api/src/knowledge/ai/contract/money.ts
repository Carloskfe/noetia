import { ContractError } from './contract-error';

/**
 * Exact integer arithmetic for money (NEM-021 §9.2). BigInt only; no floating point.
 *
 * Prices are integer micro-USD per 1,000,000 units, so `units × price` is an
 * exact amount in pico-USD (10⁻⁶ micro-USD). Modifiers are integer factor
 * basis points (10,000 = ×1.0). A result is the exact rational
 * `numerator / denominator` micro-USD, rounded exactly once.
 */

/** Largest value storable in a PostgreSQL `bigint` column. */
export const MAX_BIGINT_COLUMN = 9_223_372_036_854_775_807n;
/** Largest accepted token or unit count (JavaScript safe integer). */
export const MAX_COUNT = Number.MAX_SAFE_INTEGER;
/**
 * Sanity bound for any configured rate (micro-USD or units per million): 10¹² = $1,000,000 per
 * million units. An engineering validation limit, not a product value.
 */
export const MAX_RATE = 1_000_000_000_000;
/** Largest accepted modifier factor (×100). */
export const MAX_MODIFIER_BPS = 1_000_000;
export const BPS_DENOMINATOR = 10_000n;
export const PER_MILLION = 1_000_000n;

export interface ExactAmount {
  numerator: bigint;
  denominator: bigint;
}

export function assertCount(value: unknown, label: string): bigint {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new ContractError('invalid_request', `${label} must be a non-negative safe integer`);
  }
  return BigInt(value);
}

export function assertRate(value: unknown, label: string): bigint {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > MAX_RATE) {
    throw new ContractError('invalid_schema', `${label} must be an integer in [0, ${MAX_RATE}]`);
  }
  return BigInt(value);
}

/** Exact amount from a pico-USD sum (denominator = 10⁶ to express micro-USD). */
export function fromPicoSum(pico: bigint): ExactAmount {
  return { numerator: pico, denominator: PER_MILLION };
}

/** Apply integer factor basis points exactly (no rounding). */
export function applyFactorBps(amount: ExactAmount, factorBps: bigint): ExactAmount {
  return { numerator: amount.numerator * factorBps, denominator: amount.denominator * BPS_DENOMINATOR };
}

/** Ceiling of a non-negative exact amount (reservations). */
export function roundCeiling(amount: ExactAmount): bigint {
  assertNonNegative(amount);
  const { numerator: n, denominator: d } = amount;
  return guardColumn((n + d - 1n) / d);
}

/** Round half up of a non-negative exact amount (settlement). */
export function roundHalfUp(amount: ExactAmount): bigint {
  assertNonNegative(amount);
  const { numerator: n, denominator: d } = amount;
  return guardColumn((2n * n + d) / (2n * d));
}

function assertNonNegative(amount: ExactAmount) {
  if (amount.denominator <= 0n || amount.numerator < 0n) {
    throw new ContractError('invalid_request', 'amounts in contract v1 are non-negative');
  }
}

/** Fail closed if a value could not be written to a `bigint` column. */
export function guardColumn(value: bigint): bigint {
  if (value > MAX_BIGINT_COLUMN) {
    throw new ContractError('overflow', 'amount exceeds the bigint column range');
  }
  return value;
}
