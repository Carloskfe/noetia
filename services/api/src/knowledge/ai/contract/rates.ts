import { CapabilityDescriptor } from './capability';
import { ContractError } from './contract-error';
import { assertCount, assertRate } from './money';
import { TokenCounts } from './usage';
import { Checker, KEY_PATTERN, LIFETIME_PATTERN } from './validation';

/**
 * A per-class rate table: integer amount per 1,000,000 tokens (or units).
 * Used for prices (micro-USD per million) and for internal-unit weights (units per million).
 * This is the ONLY implementation of per-class arithmetic in the codebase.
 */
export interface RateTable {
  inputUncached: number;
  cacheRead: number;
  /** Keyed by cache lifetime, e.g. `{ "5m": 3750000, "1h": 6000000 }`. */
  cacheWrite: Record<string, number>;
  output: number;
  /** Defaults to `output` when absent. */
  reasoning?: number;
  /** Keyed by non-token unit, e.g. `{ "tool_call": 10000000000 }`. */
  nonTokenUnits?: Record<string, number>;
}

/** How the caller intends to use the prompt cache for this attempt. */
export type CacheIntent =
  | { mode: 'none' }
  | { mode: 'write'; lifetime: string }
  /** The caller may or may not write; price input at the higher of uncached and write. */
  | { mode: 'uncertain'; lifetime: string };

/** Bounds declared before a provider attempt; the basis of every worst-case figure. */
export interface AttemptBounds {
  /** Input tokens after any conservative estimate (see `conservativeInputTokens`). */
  inputTokens: number;
  maxOutputTokens: number;
  cacheIntent: CacheIntent;
  /** Upper bound per non-token unit the attempt may consume. */
  nonTokenUnitBounds?: Record<string, number>;
}

const RATE_KEYS = ['inputUncached', 'cacheRead', 'cacheWrite', 'output', 'reasoning', 'nonTokenUnits'] as const;

export function checkRateTable(c: Checker, v: unknown, path: string): v is RateTable {
  if (!c.isObject(v, path)) return false;
  const before = c.errors.length;
  c.onlyKeys(v, RATE_KEYS, path);
  const rate = (x: unknown, p: string) => {
    try { assertRate(x, p); } catch (e) { c.fail(p, (e as Error).message); }
  };
  rate(v.inputUncached, `${path}.inputUncached`);
  rate(v.cacheRead, `${path}.cacheRead`);
  rate(v.output, `${path}.output`);
  if (v.reasoning !== undefined) rate(v.reasoning, `${path}.reasoning`);
  if (c.isObject(v.cacheWrite, `${path}.cacheWrite`)) {
    for (const [k, n] of Object.entries(v.cacheWrite)) {
      if (!LIFETIME_PATTERN.test(k)) c.fail(`${path}.cacheWrite.${k}`, 'lifetime must look like "5m" or "1h"');
      rate(n, `${path}.cacheWrite.${k}`);
    }
  }
  if (v.nonTokenUnits !== undefined && c.isObject(v.nonTokenUnits, `${path}.nonTokenUnits`)) {
    for (const [k, n] of Object.entries(v.nonTokenUnits)) {
      if (!KEY_PATTERN.test(k)) c.fail(`${path}.nonTokenUnits.${k}`, 'invalid unit key');
      rate(n, `${path}.nonTokenUnits.${k}`);
    }
  }
  return c.errors.length === before;
}

/** `b` is at least `a` for every class (and both declare the same lifetimes and units). */
export function rateTableDominates(b: RateTable, a: RateTable): boolean {
  const sameKeys = (x: Record<string, number> = {}, y: Record<string, number> = {}) =>
    Object.keys(x).sort().join() === Object.keys(y).sort().join();
  if (!sameKeys(a.cacheWrite, b.cacheWrite) || !sameKeys(a.nonTokenUnits, b.nonTokenUnits)) return false;
  if (b.inputUncached < a.inputUncached || b.cacheRead < a.cacheRead || b.output < a.output) return false;
  if ((b.reasoning ?? b.output) < (a.reasoning ?? a.output)) return false;
  for (const k of Object.keys(a.cacheWrite)) if (b.cacheWrite[k] < a.cacheWrite[k]) return false;
  for (const k of Object.keys(a.nonTokenUnits ?? {})) if ((b.nonTokenUnits ?? {})[k] < (a.nonTokenUnits ?? {})[k]) return false;
  return true;
}

const big = (n: number) => BigInt(n);

/** Exact sum Σ count × rate (in rate-units × 10⁻⁶; for prices: pico-USD). No rounding. */
export function exactUsageSum(table: RateTable, tokens: TokenCounts, units: Record<string, number>): bigint {
  let sum = assertCount(tokens.inputUncached, 'inputUncached') * big(table.inputUncached)
    + assertCount(tokens.cacheRead, 'cacheRead') * big(table.cacheRead)
    + assertCount(tokens.output, 'output') * big(table.output)
    + assertCount(tokens.reasoning ?? 0, 'reasoning') * big(table.reasoning ?? table.output);
  for (const [lifetime, n] of Object.entries(tokens.cacheWrite)) {
    const rate = table.cacheWrite[lifetime];
    if (rate === undefined) throw new ContractError('unknown_cache_lifetime', `no rate for cache lifetime "${lifetime}"`);
    sum += assertCount(n, `cacheWrite.${lifetime}`) * big(rate);
  }
  for (const [key, n] of Object.entries(units)) {
    const rate = (table.nonTokenUnits ?? {})[key];
    if (rate === undefined) throw new ContractError('unpriced_unit', `no rate for non-token unit "${key}"`);
    sum += assertCount(n, `nonTokenUnits.${key}`) * big(rate);
  }
  return sum;
}

/**
 * Exact worst-case sum for an attempt within its declared bounds:
 * - every input token at the highest applicable input class (uncached, cache read, and the cache
 *   write for the intended lifetime — or every supported lifetime when the provider writes automatically);
 * - the output bound at the higher of output and reasoning rates, plus a separate reasoning bound if declared;
 * - every declared non-token unit bound.
 */
export function exactWorstCaseSum(table: RateTable, d: CapabilityDescriptor, b: AttemptBounds): bigint {
  const input = assertCount(b.inputTokens, 'inputTokens');
  const maxOut = assertCount(b.maxOutputTokens, 'maxOutputTokens');
  if (input > big(d.maxContextTokens)) throw new ContractError('context_too_large', 'input exceeds the descriptor context limit');
  if (maxOut > big(d.maxOutputTokens)) throw new ContractError('output_bound_exceeded', 'maxOutputTokens exceeds the descriptor limit');

  const writeRate = (lifetime: string): number => {
    if (!d.features.cacheHints.lifetimes.includes(lifetime) || table.cacheWrite[lifetime] === undefined) {
      throw new ContractError('unknown_cache_lifetime', `cache lifetime "${lifetime}" is not supported or not priced`);
    }
    return table.cacheWrite[lifetime];
  };
  const inputCandidates = [table.inputUncached, table.cacheRead];
  if (b.cacheIntent.mode !== 'none') inputCandidates.push(writeRate(b.cacheIntent.lifetime));
  if (d.features.cacheHints.automaticWrites) for (const l of d.features.cacheHints.lifetimes) inputCandidates.push(writeRate(l));
  let sum = input * big(Math.max(...inputCandidates));

  const reasoningRate = table.reasoning ?? table.output;
  if (d.reasoning.mode === 'within_output') {
    sum += maxOut * big(Math.max(table.output, reasoningRate));
  } else {
    sum += maxOut * big(table.output) + big(d.reasoning.maxReasoningTokens) * big(reasoningRate);
  }
  for (const [key, n] of Object.entries(b.nonTokenUnitBounds ?? {})) {
    const rate = (table.nonTokenUnits ?? {})[key];
    if (rate === undefined) throw new ContractError('unpriced_unit', `no rate for non-token unit "${key}"`);
    sum += assertCount(n, `nonTokenUnitBounds.${key}`) * big(rate);
  }
  return sum;
}
