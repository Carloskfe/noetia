import { ContractError } from './contract-error';

/**
 * Shared outcome and error model (NEM-021 §9.3, corrections F-3 and F-4).
 * One table, used by the ledger (settlement) and the Gateway (retries, contract tests).
 */

export type AttemptOutcome = 'completed' | 'refused' | 'rejected' | 'failed' | 'timed_out' | 'aborted' | 'not_sent';

export type ErrorCategory =
  | 'malformed_output'
  | 'refusal'
  | 'invalid_request'
  | 'context_too_large'
  | 'rate_limited'
  | 'provider_unavailable'
  | 'timeout'
  | 'client_abort'
  | 'internal'
  | 'capability_unavailable';

export type UsageCompleteness = 'complete' | 'partial' | 'unknown' | 'zero_confirmed';

/** Authoritative no-charge evidence; required for `zero_confirmed` (F-4). */
export type ZeroUsageEvidence = 'provider_reported_zero' | 'documented_no_charge' | 'none';

export type LedgerAction = 'settle' | 'settle_partial_hold_remainder' | 'release' | 'hold' | 'no_reservation';

export const ATTEMPT_OUTCOMES: readonly AttemptOutcome[] = ['completed', 'refused', 'rejected', 'failed', 'timed_out', 'aborted', 'not_sent'];
export const ERROR_CATEGORIES: readonly ErrorCategory[] = [
  'malformed_output', 'refusal', 'invalid_request', 'context_too_large', 'rate_limited',
  'provider_unavailable', 'timeout', 'client_abort', 'internal', 'capability_unavailable',
];
export const USAGE_COMPLETENESS: readonly UsageCompleteness[] = ['complete', 'partial', 'unknown', 'zero_confirmed'];
export const ZERO_USAGE_EVIDENCE: readonly ZeroUsageEvidence[] = ['provider_reported_zero', 'documented_no_charge', 'none'];

export interface OutcomeRule {
  outcome: AttemptOutcome;
  /** Completeness values a usage record may carry for this row. */
  completeness: readonly UsageCompleteness[];
  retryable: boolean;
  /** Action per completeness value. `zero_confirmed` maps to `release` only with valid evidence. */
  action: Partial<Record<UsageCompleteness, LedgerAction>>;
}

/** Key `none` is the success row (no error). */
export const OUTCOME_TABLE: Readonly<Record<ErrorCategory | 'none', OutcomeRule>> = {
  none:                   { outcome: 'completed', completeness: ['complete'], retryable: false, action: { complete: 'settle' } },
  malformed_output:       { outcome: 'completed', completeness: ['complete'], retryable: false, action: { complete: 'settle' } },
  refusal:                { outcome: 'refused', completeness: ['complete', 'partial'], retryable: false,
                            action: { complete: 'settle', partial: 'settle_partial_hold_remainder' } },
  invalid_request:        { outcome: 'rejected', completeness: ['zero_confirmed', 'unknown'], retryable: false,
                            action: { zero_confirmed: 'release', unknown: 'hold' } },
  context_too_large:      { outcome: 'rejected', completeness: ['zero_confirmed', 'unknown'], retryable: false,
                            action: { zero_confirmed: 'release', unknown: 'hold' } },
  rate_limited:           { outcome: 'rejected', completeness: ['zero_confirmed', 'unknown'], retryable: true,
                            action: { zero_confirmed: 'release', unknown: 'hold' } },
  provider_unavailable:   { outcome: 'failed', completeness: ['unknown', 'zero_confirmed'], retryable: true,
                            action: { unknown: 'hold', zero_confirmed: 'release' } },
  timeout:                { outcome: 'timed_out', completeness: ['unknown'], retryable: true, action: { unknown: 'hold' } },
  client_abort:           { outcome: 'aborted', completeness: ['partial', 'unknown'], retryable: false,
                            action: { partial: 'hold', unknown: 'hold' } },
  internal:               { outcome: 'failed', completeness: ['unknown'], retryable: false, action: { unknown: 'hold' } },
  capability_unavailable: { outcome: 'not_sent', completeness: [], retryable: false, action: {} },
};

/** Error class names the provider documents as never billed (declared per descriptor). */
export interface NoChargeDeclaration {
  error: ErrorCategory;
  documentationRef: string;
}

export interface OutcomeFacts {
  outcome: AttemptOutcome;
  error: ErrorCategory | null;
  usageCompleteness: UsageCompleteness | null;
  zeroUsageEvidence: ZeroUsageEvidence;
}

/** True when the (outcome, error, completeness) triple is a row of the table. */
export function isValidOutcomeCombination(f: OutcomeFacts): boolean {
  const rule = OUTCOME_TABLE[f.error ?? 'none'];
  if (!rule || rule.outcome !== f.outcome) return false;
  if (f.outcome === 'not_sent') return f.usageCompleteness === null;
  return f.usageCompleteness !== null && rule.completeness.includes(f.usageCompleteness);
}

/**
 * True only when zero usage is backed by authoritative evidence (F-4):
 * - `provider_reported_zero` for this attempt, or
 * - `documented_no_charge` that the adapter's descriptor declares for this exact error class.
 * An error category alone is never evidence.
 */
export function hasAuthoritativeZeroEvidence(f: OutcomeFacts, noCharge: readonly NoChargeDeclaration[] = []): boolean {
  if (f.zeroUsageEvidence === 'provider_reported_zero') return true;
  if (f.zeroUsageEvidence === 'documented_no_charge') {
    return f.error !== null && noCharge.some((d) => d.error === f.error && d.documentationRef.trim() !== '');
  }
  return false;
}

/**
 * The ledger action for an attempt (§9.3). Throws on a combination outside the table.
 * Defensive rule: `zero_confirmed` without authoritative evidence is held, never released.
 */
export function ledgerActionFor(f: OutcomeFacts, noCharge: readonly NoChargeDeclaration[] = []): LedgerAction {
  if (!isValidOutcomeCombination(f)) {
    throw new ContractError('invalid_outcome_combination', `${f.outcome}/${f.error ?? 'none'}/${f.usageCompleteness ?? 'none'}`);
  }
  if (f.outcome === 'not_sent') return 'no_reservation';
  const rule = OUTCOME_TABLE[f.error ?? 'none'];
  const completeness = f.usageCompleteness as UsageCompleteness;
  if (completeness === 'zero_confirmed' && !hasAuthoritativeZeroEvidence(f, noCharge)) return 'hold';
  return rule.action[completeness] as LedgerAction;
}

/** Whether the Gateway may retry this attempt as a new, separately reserved attempt. */
export function isRetryable(error: ErrorCategory | null): boolean {
  return OUTCOME_TABLE[error ?? 'none'].retryable;
}

/** Mapping onto NEM-019's legacy `ai_usage_events.outcome` CHECK values (unchanged column). */
export type LegacyUsageOutcome = 'success' | 'failure' | 'timeout' | 'aborted';
export function legacyOutcome(outcome: AttemptOutcome): LegacyUsageOutcome | null {
  switch (outcome) {
    case 'completed': return 'success';
    case 'refused':
    case 'rejected':
    case 'failed': return 'failure';
    case 'timed_out': return 'timeout';
    case 'aborted': return 'aborted';
    case 'not_sent': return null;
  }
}
