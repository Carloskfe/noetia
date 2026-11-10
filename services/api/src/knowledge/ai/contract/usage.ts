import { ContractError } from './contract-error';
import { MAX_COUNT } from './money';
import {
  ATTEMPT_OUTCOMES, AttemptOutcome, ERROR_CATEGORIES, ErrorCategory, isValidOutcomeCombination,
  USAGE_COMPLETENESS, UsageCompleteness, ZERO_USAGE_EVIDENCE, ZeroUsageEvidence,
} from './outcomes';
import { Checker, KEY_PATTERN, LIFETIME_PATTERN, ValidationResult } from './validation';
import { SCHEMA_VERSION } from './version';

/** Per-class token counts. All integers; no content. */
export interface TokenCounts {
  inputUncached: number;
  cacheRead: number;
  /** Cache writes keyed by lifetime, e.g. `{ "5m": 1200 }`. */
  cacheWrite: Record<string, number>;
  output: number;
  /** Present only when the provider reports reasoning separately from output. */
  reasoning?: number;
}

/**
 * Normalized usage for one provider attempt (named distinctly from NEM-019's legacy
 * `UsageRecord`, which Phase 2 migrates onto this type). Carries no prompts, text, or PII.
 */
export interface NormalizedUsage {
  contract: 'noetia.ai.usage';
  schemaVersion: typeof SCHEMA_VERSION;
  providerKey: string;
  modelKey: string;
  attemptKey: string;
  startedAt: string;
  endedAt: string;
  tokens: TokenCounts;
  nonTokenUnits: Record<string, number>;
  outcome: AttemptOutcome;
  error: ErrorCategory | null;
  usageCompleteness: UsageCompleteness;
  zeroUsageEvidence: ZeroUsageEvidence;
}

const TOP_KEYS = ['contract', 'schemaVersion', 'providerKey', 'modelKey', 'attemptKey', 'startedAt', 'endedAt', 'tokens',
  'nonTokenUnits', 'outcome', 'error', 'usageCompleteness', 'zeroUsageEvidence'] as const;

export function totalInputTokens(t: TokenCounts): bigint {
  return BigInt(t.inputUncached) + BigInt(t.cacheRead) + Object.values(t.cacheWrite).reduce((a, n) => a + BigInt(n), 0n);
}

function allZero(t: TokenCounts, units: Record<string, number>): boolean {
  return totalInputTokens(t) === 0n && t.output === 0 && (t.reasoning ?? 0) === 0 && Object.values(units).every((n) => n === 0);
}

export function validateNormalizedUsage(v: unknown): ValidationResult<NormalizedUsage> {
  const c = new Checker();
  if (!c.isObject(v, 'usage')) return c.result(v);
  c.onlyKeys(v, TOP_KEYS, 'usage');
  if (v.contract !== 'noetia.ai.usage') c.fail('usage.contract', 'must be "noetia.ai.usage"');
  if (v.schemaVersion !== SCHEMA_VERSION) c.fail('usage.schemaVersion', `must be ${SCHEMA_VERSION}`);
  for (const k of ['providerKey', 'modelKey', 'attemptKey'] as const) c.string(v[k], `usage.${k}`);
  c.isoDate(v.startedAt, 'usage.startedAt');
  c.isoDate(v.endedAt, 'usage.endedAt');

  let tokensOk = false;
  if (c.isObject(v.tokens, 'usage.tokens')) {
    const t = v.tokens;
    c.onlyKeys(t, ['inputUncached', 'cacheRead', 'cacheWrite', 'output', 'reasoning'], 'usage.tokens');
    const before = c.errors.length;
    c.int(t.inputUncached, 'usage.tokens.inputUncached', 0, MAX_COUNT);
    c.int(t.cacheRead, 'usage.tokens.cacheRead', 0, MAX_COUNT);
    c.int(t.output, 'usage.tokens.output', 0, MAX_COUNT);
    if (t.reasoning !== undefined) c.int(t.reasoning, 'usage.tokens.reasoning', 0, MAX_COUNT);
    if (c.isObject(t.cacheWrite, 'usage.tokens.cacheWrite')) {
      for (const [k, n] of Object.entries(t.cacheWrite)) {
        if (!LIFETIME_PATTERN.test(k)) c.fail(`usage.tokens.cacheWrite.${k}`, 'unknown lifetime key');
        c.int(n, `usage.tokens.cacheWrite.${k}`, 0, MAX_COUNT);
      }
    }
    tokensOk = c.errors.length === before;
  }
  let unitsOk = false;
  if (c.isObject(v.nonTokenUnits, 'usage.nonTokenUnits')) {
    const before = c.errors.length;
    for (const [k, n] of Object.entries(v.nonTokenUnits)) {
      if (!KEY_PATTERN.test(k)) c.fail(`usage.nonTokenUnits.${k}`, 'invalid unit key');
      c.int(n, `usage.nonTokenUnits.${k}`, 0, MAX_COUNT);
    }
    unitsOk = c.errors.length === before;
  }

  const outcomeOk = c.oneOf(v.outcome, ATTEMPT_OUTCOMES, 'usage.outcome');
  const errorOk = v.error === null || c.oneOf(v.error, ERROR_CATEGORIES, 'usage.error');
  const complOk = c.oneOf(v.usageCompleteness, USAGE_COMPLETENESS, 'usage.usageCompleteness');
  const evOk = c.oneOf(v.zeroUsageEvidence, ZERO_USAGE_EVIDENCE, 'usage.zeroUsageEvidence');

  if (outcomeOk && errorOk && complOk && evOk) {
    const facts = {
      outcome: v.outcome as AttemptOutcome,
      error: v.error as ErrorCategory | null,
      usageCompleteness: v.usageCompleteness as UsageCompleteness,
      zeroUsageEvidence: v.zeroUsageEvidence as ZeroUsageEvidence,
    };
    if (facts.outcome === 'not_sent') c.fail('usage.outcome', '"not_sent" attempts have no usage record');
    else if (!isValidOutcomeCombination(facts)) {
      c.fail('usage', `outcome/error/completeness ${facts.outcome}/${facts.error ?? 'none'}/${facts.usageCompleteness} is not a row of the §9.3 table`);
    }
    // F-4: evidence and zero usage go together; an error category alone is never evidence.
    if (facts.usageCompleteness === 'zero_confirmed' && facts.zeroUsageEvidence === 'none') {
      c.fail('usage.zeroUsageEvidence', '"zero_confirmed" requires authoritative no-charge evidence');
    }
    if (facts.zeroUsageEvidence !== 'none' && facts.usageCompleteness !== 'zero_confirmed') {
      c.fail('usage.zeroUsageEvidence', 'evidence may only accompany "zero_confirmed"');
    }
    if (facts.usageCompleteness === 'zero_confirmed' && tokensOk && unitsOk
      && !allZero(v.tokens as unknown as TokenCounts, v.nonTokenUnits as Record<string, number>)) {
      c.fail('usage.tokens', '"zero_confirmed" requires every count to be zero');
    }
  }
  return c.result(v);
}

export function assertNormalizedUsage(v: unknown): NormalizedUsage {
  const r = validateNormalizedUsage(v);
  if (!r.ok) throw new ContractError('invalid_usage', r.errors.join('; '));
  return r.value;
}
