import { ERROR_CATEGORIES, ErrorCategory, OUTCOME_TABLE } from '../../../../../src/knowledge/ai/contract';
import { normalizeAttempt, NormalizeInput } from '../../../../../src/knowledge/ai/gateway/attempt-normalizer';
import { SIMULATOR_DESCRIPTORS } from '../../../../../src/knowledge/ai/simulator/simulator-fixtures';

const [STANDARD, LONG] = SIMULATOR_DESCRIPTORS;
const base = { descriptor: STANDARD, attemptKey: 'turn:n:a1', startedAt: '2026-01-01T00:00:00Z', endedAt: '2026-01-01T00:00:01Z' };
const zero = { inputUncached: 0, cacheRead: 0, cacheWrite: {}, output: 0 };
const record = (over: object = {}, d = STANDARD) => ({
  contract: 'noetia.ai.usage', schemaVersion: 1, providerKey: d.providerKey, modelKey: d.modelKey, attemptKey: 'turn:n:a1',
  startedAt: base.startedAt, endedAt: base.endedAt, tokens: { inputUncached: 10, cacheRead: 0, cacheWrite: {}, output: 2 },
  nonTokenUnits: d.nonTokenUnits.length ? { tool_call: 0 } : {}, outcome: 'completed', error: null, usageCompleteness: 'complete', zeroUsageEvidence: 'none', ...over,
});
const n = (i: Partial<NormalizeInput>) => normalizeAttempt({ ...base, ...i } as NormalizeInput);

describe('normalizeAttempt — every result maps to exactly one §9.3 row; the Gateway never decides release', () => {
  it.each(ERROR_CATEGORIES.filter((e) => e !== 'capability_unavailable' && e !== 'malformed_output'))('adapter-reported %s keeps its table row', (error: ErrorCategory) => {
    const rule = OUTCOME_TABLE[error];
    const completeness = rule.completeness.includes('unknown') ? 'unknown' : rule.completeness[0];
    const tokens = completeness === 'unknown' ? zero : record().tokens;
    const r = n({ adapterUsage: record({ outcome: rule.outcome, error, usageCompleteness: completeness, tokens }) });
    expect(r.usage).toMatchObject({ outcome: rule.outcome, error, usageCompleteness: completeness });
    expect(r.violations).toEqual([]);
  });

  it('success and malformed_output (structured output failed validation) are completed + complete', () => {
    expect(n({ adapterUsage: record() }).usage).toMatchObject({ outcome: 'completed', error: null, usageCompleteness: 'complete' });
    expect(n({ adapterUsage: record(), structuredInvalid: true }).usage).toMatchObject({ outcome: 'completed', error: 'malformed_output', usageCompleteness: 'complete' });
    expect(n({ adapterUsage: record({ outcome: 'refused', error: 'refusal' }), structuredInvalid: true }).usage.error).toBe('refusal');
  });

  it('Gateway timeout always yields timed_out / timeout / unknown with zero counts', () => {
    expect(n({ condition: 'timeout', adapterUsage: record() }).usage).toMatchObject({ outcome: 'timed_out', error: 'timeout', usageCompleteness: 'unknown', tokens: zero, zeroUsageEvidence: 'none' });
  });

  it('client abort: the adapter abort report is kept; otherwise partial counts are kept, else unknown', () => {
    const partial = record({ outcome: 'aborted', error: 'client_abort', usageCompleteness: 'partial' });
    expect(n({ condition: 'client_abort', adapterUsage: partial }).usage).toMatchObject({ error: 'client_abort', usageCompleteness: 'partial' });
    expect(n({ condition: 'client_abort' }).usage).toMatchObject({ outcome: 'aborted', error: 'client_abort', usageCompleteness: 'unknown' });
    expect(n({ condition: 'client_abort', adapterUsage: record({ outcome: 'refused', error: 'refusal', usageCompleteness: 'partial' }) }).usage)
      .toMatchObject({ error: 'client_abort', usageCompleteness: 'partial', tokens: record().tokens });
  });

  it('adapter failure, a missing record, or an invalid record → failed / internal / unknown (held)', () => {
    expect(n({ condition: 'adapter_failure' }).usage).toMatchObject({ outcome: 'failed', error: 'internal', usageCompleteness: 'unknown' });
    expect(n({}).violations).toEqual(['missing_final_usage']);
    expect(n({ adapterUsage: { ...record(), prompt: 'x' } }).violations).toEqual(['invalid_usage_record']);
    expect(n({ adapterUsage: record({ attemptKey: 'turn:other:a1' }) }).violations).toEqual(['attempt_key_mismatch']);
    expect(n({ adapterUsage: record({}, LONG) }).violations).toEqual(['model_mismatch']);
    for (const bad of [record({ attemptKey: 'turn:other:a1' }), record({}, LONG), { nope: 1 }]) {
      expect(n({ adapterUsage: bad }).usage).toMatchObject({ error: 'internal', usageCompleteness: 'unknown', providerKey: STANDARD.providerKey, attemptKey: 'turn:n:a1' });
    }
  });

  it('evidence discipline: provider_reported_zero is accepted; documented_no_charge only when the descriptor declares the class', () => {
    const reported = record({ outcome: 'rejected', error: 'rate_limited', usageCompleteness: 'zero_confirmed', zeroUsageEvidence: 'provider_reported_zero', tokens: zero });
    expect(n({ adapterUsage: reported }).usage.usageCompleteness).toBe('zero_confirmed');
    const documented = (d = STANDARD) => record({ outcome: 'rejected', error: 'rate_limited', usageCompleteness: 'zero_confirmed', zeroUsageEvidence: 'documented_no_charge', tokens: zero }, d);
    const held = n({ adapterUsage: documented() });
    expect(held.usage).toMatchObject({ usageCompleteness: 'unknown', zeroUsageEvidence: 'none' });
    expect(held.violations).toEqual(['undeclared_documented_no_charge']);
    expect(n({ descriptor: LONG, adapterUsage: documented(LONG) }).usage).toMatchObject({ usageCompleteness: 'zero_confirmed', zeroUsageEvidence: 'documented_no_charge' });
    const wrongClass = record({ outcome: 'rejected', error: 'invalid_request', usageCompleteness: 'zero_confirmed', zeroUsageEvidence: 'documented_no_charge', tokens: zero }, LONG);
    expect(n({ descriptor: LONG, adapterUsage: wrongClass }).usage.usageCompleteness).toBe('unknown');
  });

  it('an error category alone is never evidence: an unevidenced zero claim is an invalid record (held)', () => {
    const claim = record({ outcome: 'rejected', error: 'invalid_request', usageCompleteness: 'zero_confirmed', zeroUsageEvidence: 'none', tokens: zero });
    expect(n({ adapterUsage: claim }).usage).toMatchObject({ error: 'internal', usageCompleteness: 'unknown' });
  });

  it('an adapter may not report not_sent (no reservation decision belongs to it)', () => {
    expect(n({ adapterUsage: { ...record(), outcome: 'not_sent', error: 'capability_unavailable' } }).usage.error).toBe('internal');
  });
});
