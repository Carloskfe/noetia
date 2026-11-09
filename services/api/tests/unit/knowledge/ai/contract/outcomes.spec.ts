import {
  ATTEMPT_OUTCOMES, ERROR_CATEGORIES, hasAuthoritativeZeroEvidence, isRetryable, isValidOutcomeCombination,
  LedgerAction, ledgerActionFor, legacyOutcome, OUTCOME_TABLE, OutcomeFacts, USAGE_COMPLETENESS, ZERO_USAGE_EVIDENCE,
} from '../../../../../src/knowledge/ai/contract';
import { FIXTURE_DESCRIPTORS, FIXTURE_USAGE } from '../../../../../src/knowledge/ai/contract/fixtures';

const DESC_B = FIXTURE_DESCRIPTORS[1];
const f = (outcome: OutcomeFacts['outcome'], error: OutcomeFacts['error'], usageCompleteness: OutcomeFacts['usageCompleteness'], zeroUsageEvidence: OutcomeFacts['zeroUsageEvidence'] = 'none'): OutcomeFacts =>
  ({ outcome, error, usageCompleteness, zeroUsageEvidence });

describe('shared outcome model — every §9.3 row (AC-3b)', () => {
  const rows: Array<[string, OutcomeFacts, LedgerAction, boolean]> = [
    ['success', f('completed', null, 'complete'), 'settle', false],
    ['malformed_output', f('completed', 'malformed_output', 'complete'), 'settle', false],
    ['refusal complete', f('refused', 'refusal', 'complete'), 'settle', false],
    ['refusal partial', f('refused', 'refusal', 'partial'), 'settle_partial_hold_remainder', false],
    ['invalid_request evidenced', f('rejected', 'invalid_request', 'zero_confirmed', 'provider_reported_zero'), 'release', false],
    ['invalid_request unevidenced', f('rejected', 'invalid_request', 'unknown'), 'hold', false],
    ['context_too_large evidenced', f('rejected', 'context_too_large', 'zero_confirmed', 'provider_reported_zero'), 'release', false],
    ['context_too_large unevidenced', f('rejected', 'context_too_large', 'unknown'), 'hold', false],
    ['rate_limited evidenced', f('rejected', 'rate_limited', 'zero_confirmed', 'provider_reported_zero'), 'release', true],
    ['rate_limited unevidenced', f('rejected', 'rate_limited', 'unknown'), 'hold', true],
    ['provider_unavailable unknown', f('failed', 'provider_unavailable', 'unknown'), 'hold', true],
    ['provider_unavailable evidenced', f('failed', 'provider_unavailable', 'zero_confirmed', 'provider_reported_zero'), 'release', true],
    ['timeout', f('timed_out', 'timeout', 'unknown'), 'hold', true],
    ['client_abort partial', f('aborted', 'client_abort', 'partial'), 'hold', false],
    ['client_abort unknown', f('aborted', 'client_abort', 'unknown'), 'hold', false],
    ['internal', f('failed', 'internal', 'unknown'), 'hold', false],
    ['capability_unavailable', f('not_sent', 'capability_unavailable', null), 'no_reservation', false],
  ];
  it.each(rows)('%s → %s', (_l, facts, action, retryable) => {
    expect(isValidOutcomeCombination(facts)).toBe(true);
    expect(ledgerActionFor(facts)).toBe(action);
    expect(isRetryable(facts.error)).toBe(retryable);
  });

  it('the table covers every error category exactly once, plus the success row', () => {
    expect(Object.keys(OUTCOME_TABLE).sort()).toEqual([...ERROR_CATEGORIES, 'none'].sort());
  });

  it('every combination outside the table is rejected (exhaustive)', () => {
    const allowed = new Set(rows.map(([, x]) => `${x.outcome}/${x.error}/${x.usageCompleteness}`));
    let checked = 0;
    for (const outcome of ATTEMPT_OUTCOMES) for (const error of [null, ...ERROR_CATEGORIES]) for (const c of [null, ...USAGE_COMPLETENESS]) {
      const facts = f(outcome, error, c);
      const key = `${outcome}/${error}/${c}`;
      checked++;
      if (allowed.has(key)) expect(isValidOutcomeCombination(facts)).toBe(true);
      else {
        expect(isValidOutcomeCombination(facts)).toBe(false);
        expect(() => ledgerActionFor(facts)).toThrow(expect.objectContaining({ code: 'invalid_outcome_combination' }));
      }
    }
    expect(checked).toBe(ATTEMPT_OUTCOMES.length * (ERROR_CATEGORIES.length + 1) * (USAGE_COMPLETENESS.length + 1));
  });
});

describe('authoritative no-charge evidence (F-4, AC-9b)', () => {
  it('an error category alone never releases: zero_confirmed without evidence is held', () => {
    for (const error of ['invalid_request', 'context_too_large', 'rate_limited'] as const) {
      expect(ledgerActionFor(f('rejected', error, 'zero_confirmed', 'none'))).toBe('hold');
    }
    expect(ledgerActionFor(f('failed', 'provider_unavailable', 'zero_confirmed', 'none'))).toBe('hold');
  });

  it('documented_no_charge releases only when the descriptor declares that exact error class', () => {
    const facts = f('rejected', 'rate_limited', 'zero_confirmed', 'documented_no_charge');
    expect(ledgerActionFor(facts)).toBe('hold');                                   // no declaration supplied
    expect(ledgerActionFor(facts, DESC_B.noChargeErrorClasses)).toBe('release');   // declared for rate_limited
    const other = f('rejected', 'invalid_request', 'zero_confirmed', 'documented_no_charge');
    expect(ledgerActionFor(other, DESC_B.noChargeErrorClasses)).toBe('hold');      // declared for a different class
    expect(hasAuthoritativeZeroEvidence(facts, [{ error: 'rate_limited', documentationRef: '   ' }])).toBe(false); // blank reference
  });

  it('provider_reported_zero is authoritative for that attempt', () => {
    expect(hasAuthoritativeZeroEvidence(f('rejected', 'invalid_request', 'zero_confirmed', 'provider_reported_zero'))).toBe(true);
    expect(ZERO_USAGE_EVIDENCE).toEqual(['provider_reported_zero', 'documented_no_charge', 'none']);
  });

  it('the fixture rows behave as intended', () => {
    const byKey = (k: string) => FIXTURE_USAGE.find((u) => u.attemptKey === k)!;
    expect(ledgerActionFor(byKey('a-invalid-evidenced'))).toBe('release');
    expect(ledgerActionFor(byKey('a-invalid-unevidenced'))).toBe('hold');
    expect(ledgerActionFor(byKey('b-rate-limited-documented'), DESC_B.noChargeErrorClasses)).toBe('release');
    expect(ledgerActionFor(byKey('a-rate-limited-unevidenced'))).toBe('hold');
  });
});

describe('legacy NEM-019 outcome mapping (unchanged CHECK column)', () => {
  it('maps exactly', () => {
    expect(ATTEMPT_OUTCOMES.map((o) => [o, legacyOutcome(o)])).toEqual([
      ['completed', 'success'], ['refused', 'failure'], ['rejected', 'failure'], ['failed', 'failure'],
      ['timed_out', 'timeout'], ['aborted', 'aborted'], ['not_sent', null],
    ]);
  });
});
