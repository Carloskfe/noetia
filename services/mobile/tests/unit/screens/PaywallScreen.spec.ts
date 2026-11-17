jest.mock('../../../src/api/client', () => ({ apiClient: { get: jest.fn() } }));
import { apiClient } from '../../../src/api/client';
import { fetchTrialEligibility, paywallSubtitleKey, requiresPaywall } from '../../../src/api/subscriptions';
import { en } from '../../../src/i18n/en';
import { es } from '../../../src/i18n/es';
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

describe('trial eligibility on the paywall (D1/D6)', () => {
  const get = apiClient.get as jest.Mock;
  beforeEach(() => get.mockReset());

  it('asks the API with ?trialEligibility=1 and returns its boolean', async () => {
    get.mockResolvedValue({ status: 'none', trialEligible: false });
    await expect(fetchTrialEligibility()).resolves.toBe(false);
    expect(get).toHaveBeenCalledWith('/subscriptions/me?trialEligibility=1');
  });

  it('unknown (null, missing field, or a failure) → null', async () => {
    get.mockResolvedValueOnce({ status: 'none', trialEligible: null });
    await expect(fetchTrialEligibility()).resolves.toBeNull();
    get.mockResolvedValueOnce({ status: 'none' });
    await expect(fetchTrialEligibility()).resolves.toBeNull();
    get.mockRejectedValueOnce(new Error('offline'));
    await expect(fetchTrialEligibility()).resolves.toBeNull();
  });

  it('a trial is shown only to a confirmed-eligible user; returning users and unknown get no trial copy', () => {
    expect(paywallSubtitleKey(true)).toBe('subtitle');
    expect(paywallSubtitleKey(false)).toBe('subtitleReturning');
    expect(paywallSubtitleKey(null)).toBe('subtitleNeutral');
    for (const dict of [en, es]) {
      expect(dict.paywall.subtitleReturning).not.toMatch(/14/);
      expect(dict.paywall.subtitleNeutral).not.toMatch(/prueba gratuita|free trial/i);
    }
  });
});

