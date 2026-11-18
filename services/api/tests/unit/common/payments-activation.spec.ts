const stripeCtor = jest.fn();
jest.mock('stripe', () => jest.fn().mockImplementation((...args: unknown[]) => { stripeCtor(...args); return { marker: 'stripe-client' }; }));

import {
  createStripeClient,
  describePaymentsActivation,
  parsePaymentsEnabled,
  resolvePaymentsActivation,
} from '../../../src/common/payments-activation';

const config = (flag: unknown, key: unknown) => ({
  get: <T = string>(k: string) => (k === 'PAYMENTS_ENABLED' ? flag : k === 'STRIPE_SECRET_KEY' ? key : undefined) as T | undefined,
});

const LIVE = 'sk_live_51AbCdEfGh';
const TEST = 'sk_test_51AbCdEfGh';
const RESTRICTED = 'rk_live_51AbCdEfGh';

beforeEach(() => stripeCtor.mockClear());

describe('parsePaymentsEnabled', () => {
  it.each(['true', ' true ', 'true\n', '\ttrue'])('accepts exactly "true" (trimmed): %p', (raw) => {
    expect(parsePaymentsEnabled(raw)).toBe(true);
  });

  it.each([
    ['missing', undefined], ['null', null], ['empty', ''], ['whitespace', '   '],
    ['false', 'false'], ['uppercase', 'TRUE'], ['capitalised', 'True'],
    ['one', '1'], ['yes', 'yes'], ['on', 'on'], ['enabled', 'enabled'], ['y', 'y'],
    ['quoted', '"true"'], ['typo', 'ture'], ['trailing text', 'true # launch'], ['two values', 'true,false'],
    ['boolean true (not a string)', true], ['number 1', 1], ['object', {}],
  ])('rejects %s', (_label, raw) => {
    expect(parsePaymentsEnabled(raw)).toBe(false);
  });
});

describe('resolvePaymentsActivation — activation-state matrix', () => {
  const DISABLED_FLAGS: [string, unknown][] = [
    ['missing', undefined], ['empty', ''], ['false', 'false'], ['TRUE', 'TRUE'], ['1', '1'], ['yes', 'yes'], ['malformed', 'ture'],
  ];
  const KEYS: [string, unknown][] = [
    ['missing key', undefined], ['empty key', ''], ['placeholder key', 'changeme'],
    ['test key', TEST], ['live key', LIVE], ['restricted live key', RESTRICTED],
  ];

  describe.each(DISABLED_FLAGS)('PAYMENTS_ENABLED %s', (_fl, flag) => {
    it.each(KEYS)('%s → disabled, no Stripe client', (_kl, key) => {
      const activation = resolvePaymentsActivation(config(flag, key));
      expect(activation.enabled).toBe(false);
      expect(createStripeClient(config(flag, key))).toBeNull();
      expect(stripeCtor).not.toHaveBeenCalled();
    });
  });

  describe('PAYMENTS_ENABLED true', () => {
    it.each([
      ['missing key', undefined, 'STRIPE_SECRET_KEY not set'],
      ['empty key', '', 'STRIPE_SECRET_KEY not set'],
      ['whitespace key', '   ', 'STRIPE_SECRET_KEY not set'],
      ['placeholder key', 'changeme', 'STRIPE_SECRET_KEY is not a Stripe secret/restricted key'],
      ['publishable key', 'pk_live_51AbCdEf', 'STRIPE_SECRET_KEY is not a Stripe secret/restricted key'],
      ['webhook secret by mistake', 'whsec_abc', 'STRIPE_SECRET_KEY is not a Stripe secret/restricted key'],
      ['prefix only', 'sk_live_', 'STRIPE_SECRET_KEY is not a Stripe secret/restricted key'],
      ['non-string key', 12345, 'STRIPE_SECRET_KEY not set'],
    ])('%s → disabled (flag alone never activates)', (_l, key, reason) => {
      expect(resolvePaymentsActivation(config('true', key))).toEqual({ enabled: false, reason });
      expect(createStripeClient(config('true', key))).toBeNull();
      expect(stripeCtor).not.toHaveBeenCalled();
    });

    it.each([
      ['test key', TEST, 'test'], ['live key', LIVE, 'live'], ['restricted live key', RESTRICTED, 'live'],
      ['key with surrounding whitespace', `  ${TEST}\n`, 'test'],
    ])('%s → enabled; client built with the trimmed key', (_l, key, mode) => {
      const activation = resolvePaymentsActivation(config('true', key));
      expect(activation).toEqual({ enabled: true, stripeKey: (key as string).trim(), mode });
      expect(createStripeClient(config('true', key))).toEqual({ marker: 'stripe-client' });
      expect(stripeCtor).toHaveBeenCalledTimes(1);
      expect(stripeCtor).toHaveBeenCalledWith((key as string).trim());
    });
  });

  it('distinguishes "not set" from "not exactly true" in the reason', () => {
    expect(resolvePaymentsActivation(config(undefined, LIVE))).toEqual({ enabled: false, reason: 'PAYMENTS_ENABLED not set' });
    expect(resolvePaymentsActivation(config('', LIVE))).toEqual({ enabled: false, reason: 'PAYMENTS_ENABLED not set' });
    expect(resolvePaymentsActivation(config('TRUE', LIVE))).toEqual({ enabled: false, reason: 'PAYMENTS_ENABLED is not exactly "true"' });
  });
});

describe('describePaymentsActivation (boot log line)', () => {
  it.each([
    [undefined, LIVE], ['false', LIVE], ['TRUE', TEST], ['true', undefined], ['true', 'changeme'], ['true', LIVE], ['true', TEST], ['true', RESTRICTED],
  ])('never contains the key (flag %p)', (flag, key) => {
    const line = describePaymentsActivation(config(flag, key));
    expect(line.startsWith('[payments] ')).toBe(true);
    if (typeof key === 'string') expect(line).not.toContain(key);
    expect(line).not.toMatch(/sk_|rk_|51AbCd/);
  });

  it('states the mode when enabled and fail-closed when disabled', () => {
    expect(describePaymentsActivation(config('true', LIVE))).toBe('[payments] ENABLED (Stripe live mode)');
    expect(describePaymentsActivation(config('true', TEST))).toBe('[payments] ENABLED (Stripe test mode)');
    expect(describePaymentsActivation(config(undefined, LIVE))).toBe(
      '[payments] disabled (PAYMENTS_ENABLED not set); checkout, billing and webhooks fail closed',
    );
  });
});
