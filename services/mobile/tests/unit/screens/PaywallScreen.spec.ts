import { requiresPaywall } from '../../../src/api/subscriptions';
import { PaywallScreen } from '../../../src/screens/PaywallScreen';

describe('PaywallScreen', () => {
  it('exports a React function component', () => {
    expect(typeof PaywallScreen).toBe('function');
  });
});

describe('requiresPaywall', () => {
  it('returns true for none', () => {
    expect(requiresPaywall('none')).toBe(true);
  });

  it('returns true for canceled', () => {
    expect(requiresPaywall('canceled')).toBe(true);
  });

  it('returns true for past_due', () => {
    expect(requiresPaywall('past_due')).toBe(true);
  });

  it('returns false for active', () => {
    expect(requiresPaywall('active')).toBe(false);
  });

  it('returns false for trialing', () => {
    expect(requiresPaywall('trialing')).toBe(false);
  });

  it('returns false for canceling', () => {
    expect(requiresPaywall('canceling')).toBe(false);
  });
});
