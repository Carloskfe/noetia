import {
  assertNormalizedUsage, declaresNoCharge, ErrorCategory, isValidOutcomeCombination, NormalizedUsage, OUTCOME_TABLE,
  SCHEMA_VERSION, ValidatedCapabilityDescriptor,
} from '../contract';

/**
 * Error normalization (NEM-022 §5.3). Every attempt ends as exactly one row of the contract-v1 §9.3 table.
 * The Gateway never chooses settle, hold, or release itself: it only produces the normalized usage, and the
 * cost ledger applies `ledgerActionFor`.
 *
 * Evidence discipline (F-4): `zero_confirmed` survives only with `provider_reported_zero` and an all-zero usage
 * report for this attempt, or with `documented_no_charge` for an error class the adapter's descriptor declares.
 * Anything else is downgraded to `unknown` with evidence `none`, so the attempt is HELD (and a violation recorded).
 */
export type GatewayCondition =
  /** The Gateway's own timeout fired. */
  | 'timeout'
  /** The caller aborted. */
  | 'client_abort'
  /** The adapter threw, or its stream ended without a final usage record. */
  | 'adapter_failure';

export interface NormalizeInput {
  descriptor: ValidatedCapabilityDescriptor;
  attemptKey: string;
  startedAt: string;
  endedAt: string;
  /** The adapter's final usage record, if one arrived. */
  adapterUsage?: unknown;
  condition?: GatewayCondition;
  /** Structured output that failed validation (turns a clean completion into `malformed_output`). */
  structuredInvalid?: boolean;
}

export interface NormalizeResult {
  usage: NormalizedUsage;
  /** Contract violations by the adapter (counts and codes only; no content). */
  violations: string[];
}

function synthesized(i: NormalizeInput, error: ErrorCategory, partial?: NormalizedUsage): NormalizedUsage {
  const rule = OUTCOME_TABLE[error];
  const usePartial = partial !== undefined && rule.completeness.includes('partial');
  return {
    contract: 'noetia.ai.usage',
    schemaVersion: SCHEMA_VERSION,
    providerKey: i.descriptor.providerKey,
    modelKey: i.descriptor.modelKey,
    attemptKey: i.attemptKey,
    startedAt: i.startedAt,
    endedAt: i.endedAt,
    tokens: usePartial ? partial.tokens : { inputUncached: 0, cacheRead: 0, cacheWrite: {}, output: 0 },
    nonTokenUnits: usePartial ? partial.nonTokenUnits : {},
    outcome: rule.outcome,
    error,
    usageCompleteness: usePartial ? 'partial' : 'unknown',
    zeroUsageEvidence: 'none',
  };
}

/** Validate the adapter's record against the contract, the attempt, and the evidence rules. */
function checkAdapterUsage(i: NormalizeInput, violations: string[]): NormalizedUsage | null {
  let u: NormalizedUsage;
  try {
    u = assertNormalizedUsage(i.adapterUsage);
  } catch {
    violations.push('invalid_usage_record');
    return null;
  }
  if (u.attemptKey !== i.attemptKey) { violations.push('attempt_key_mismatch'); return null; }
  if (u.providerKey !== i.descriptor.providerKey || u.modelKey !== i.descriptor.modelKey) { violations.push('model_mismatch'); return null; }
  if (!isValidOutcomeCombination(u)) { violations.push('outcome_not_in_table'); return null; }
  if (u.outcome === 'not_sent') { violations.push('adapter_reported_not_sent'); return null; }
  // The contract validator already guarantees: zero_confirmed ⇔ evidence ≠ none, and all counts zero.
  // What only the Gateway can check: `documented_no_charge` must be declared by THIS adapter's descriptor.
  if (u.zeroUsageEvidence === 'documented_no_charge' && (u.error === null || !declaresNoCharge(i.descriptor, u.error))) {
    violations.push('undeclared_documented_no_charge');
    return { ...u, usageCompleteness: 'unknown', zeroUsageEvidence: 'none' };
  }
  return u;
}

export function normalizeAttempt(i: NormalizeInput): NormalizeResult {
  const violations: string[] = [];
  if (i.condition === 'timeout') return { usage: synthesized(i, 'timeout'), violations };
  const adapter = i.adapterUsage === undefined ? null : checkAdapterUsage(i, violations);
  if (i.condition === 'client_abort') {
    // Accept the adapter's own abort report (partial or unknown); otherwise usage is unknown and held.
    if (adapter && adapter.error === 'client_abort') return { usage: adapter, violations };
    return { usage: synthesized(i, 'client_abort', adapter && adapter.usageCompleteness === 'partial' ? adapter : undefined), violations };
  }
  if (i.condition === 'adapter_failure' || !adapter) {
    if (i.adapterUsage === undefined) violations.push('missing_final_usage');
    return { usage: synthesized(i, 'internal'), violations };
  }
  if (i.structuredInvalid && adapter.outcome === 'completed' && adapter.error === null) {
    return { usage: { ...adapter, error: 'malformed_output' }, violations };
  }
  return { usage: adapter, violations };
}
