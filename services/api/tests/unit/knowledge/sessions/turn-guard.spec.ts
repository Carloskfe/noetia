import { DEFAULT_TURN_WEIGHT_LIMIT, TurnGuard, turnWeightLimitFromEnv } from '../../../../src/knowledge/sessions/turn-guard';

describe('TurnGuard (D-11 weighted admission)', () => {
  it('admits up to W units, refuses beyond, and releases idempotently', () => {
    const g = new TurnGuard(10);
    const a = g.tryAcquire(10);
    expect(a.ok).toBe(true);
    expect(g.tryAcquire(1)).toEqual({ ok: false, reason: 'over_limit' });
    if (a.ok) { a.release(); a.release(); }
    expect(g.used).toBe(0);
    const three = [g.tryAcquire(3), g.tryAcquire(3), g.tryAcquire(3)];
    expect(three.every((x) => x.ok)).toBe(true);
    expect(g.tryAcquire(3)).toEqual({ ok: false, reason: 'over_limit' }); // 9 + 3 > 10
    expect(g.tryAcquire(1).ok).toBe(true);
  });
  it('a request heavier than W can never be admitted (exceeds_limit → Q-11 escalation if W < 10)', () => {
    expect(new TurnGuard(6).tryAcquire(10)).toEqual({ ok: false, reason: 'exceeds_limit' });
    expect(new TurnGuard(3).tryAcquire(0).ok).toBe(true); // weight floors at 1
  });
  it('W is configurable for the 10 → 6 → 3 evaluation; invalid values fall back to the candidate 10', () => {
    expect(DEFAULT_TURN_WEIGHT_LIMIT).toBe(10);
    expect(turnWeightLimitFromEnv({ INTELLIGENCE_TURN_WEIGHT_LIMIT: '6' })).toBe(6);
    expect(turnWeightLimitFromEnv({ INTELLIGENCE_TURN_WEIGHT_LIMIT: '3' })).toBe(3);
    for (const v of [undefined, '', '0', '-1', 'x', '101']) expect(turnWeightLimitFromEnv({ INTELLIGENCE_TURN_WEIGHT_LIMIT: v })).toBe(10);
    expect(new TurnGuard().limit).toBe(10);
  });
});
