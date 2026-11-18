import Stripe from 'stripe';

/**
 * Payment activation gate (fail closed).
 *
 * A Stripe client may exist ONLY when BOTH hold:
 *   1. `PAYMENTS_ENABLED` is exactly the string `true` (surrounding whitespace ignored; case-sensitive), and
 *   2. `STRIPE_SECRET_KEY` looks like a Stripe secret or restricted key (`sk_` / `rk_`, `test` or `live`).
 *
 * Anything else — flag missing, empty, `false`, `TRUE`, `1`, `yes`, `on`, a typo; key missing, empty or a
 * placeholder — yields NO client. The three Stripe-owning classes (SubscriptionsService, GiftsService,
 * WebhooksController) obtain their client only through `createStripeClient`, so with no client every Checkout,
 * billing and webhook path keeps failing with its existing error (`payments_not_configured` /
 * `Stripe is not configured`). A configured key alone — test or live — never activates payments.
 *
 * Setting `PAYMENTS_ENABLED=true` is a financial-release action that needs its own Product Owner authorization
 * (docs/stripe-setup.md § Payment activation). This module never logs or returns the key in a message.
 */
export type PaymentsActivation =
  | { enabled: true; stripeKey: string; mode: 'test' | 'live' }
  | { enabled: false; reason: string };

export interface ConfigReader {
  get<T = string>(key: string): T | undefined;
}

const STRIPE_KEY_PATTERN = /^(sk|rk)_(test|live)_[A-Za-z0-9_]+$/;

/** True only for the exact value `true` (trimmed). Every other value, including `TRUE` and `1`, is false. */
export function parsePaymentsEnabled(raw: unknown): boolean {
  return typeof raw === 'string' && raw.trim() === 'true';
}

export function resolvePaymentsActivation(config: ConfigReader): PaymentsActivation {
  const rawFlag = config.get<unknown>('PAYMENTS_ENABLED');
  if (!parsePaymentsEnabled(rawFlag)) {
    const unset = rawFlag === undefined || rawFlag === null || (typeof rawFlag === 'string' && rawFlag.trim() === '');
    return { enabled: false, reason: unset ? 'PAYMENTS_ENABLED not set' : 'PAYMENTS_ENABLED is not exactly "true"' };
  }
  const rawKey = config.get<unknown>('STRIPE_SECRET_KEY');
  const key = typeof rawKey === 'string' ? rawKey.trim() : '';
  if (key === '') return { enabled: false, reason: 'STRIPE_SECRET_KEY not set' };
  const match = STRIPE_KEY_PATTERN.exec(key);
  if (!match) return { enabled: false, reason: 'STRIPE_SECRET_KEY is not a Stripe secret/restricted key' };
  return { enabled: true, stripeKey: key, mode: match[2] as 'test' | 'live' };
}

/** The ONLY place a Stripe client is constructed. Returns null whenever payments are not explicitly activated. */
export function createStripeClient(config: ConfigReader): InstanceType<typeof Stripe> | null {
  const activation = resolvePaymentsActivation(config);
  return activation.enabled ? new Stripe(activation.stripeKey) : null;
}

/** One safe boot-log line (never contains the key). */
export function describePaymentsActivation(config: ConfigReader): string {
  const activation = resolvePaymentsActivation(config);
  return activation.enabled
    ? `[payments] ENABLED (Stripe ${activation.mode} mode)`
    : `[payments] disabled (${activation.reason}); checkout, billing and webhooks fail closed`;
}
