import { isFrenchUiEnabled, normalizeUiLocale, UiLocale } from '../users/ui-locale';

/**
 * Transactional-message locale foundation (NEM-025 B2-A1).
 *
 * Two functions, deliberately separate:
 *
 * - `dispatchCopyLocale()` is the ONLY function used by live email dispatch. It reproduces the pre-B2
 *   selection exactly: `'en'` → English, everything else → Spanish. The single addition is a French
 *   branch that is unreachable in this build, because it requires the code constant
 *   `FR_CA_TRANSACTIONAL_READY` (ships `false`) in addition to `FR_CA_ENABLED=true`. Enabling the
 *   interface gate alone never produces French email.
 *
 * - `resolveMessageLocale()` is the N-1 normalization (canonical locale + canonical `<html lang>` for
 *   legacy/invalid stored values). B2-A2a (B2-D4) activates it for the account-security emails ONLY, through
 *   `accountEmailLocale()`, called by their four callers (registration, resend confirmation, password reset,
 *   farewell). EmailService itself still selects with `dispatchCopyLocale()`, so gift, waitlist and
 *   invitation emails are unchanged.
 */
export type EmailLocale = UiLocale;

/**
 * French transactional readiness. Flipped only by a reviewed code change after human fr-CA sign-off and
 * PO authorization (B2-D5). Not an environment variable on purpose: no configuration change can enable it.
 */
export const FR_CA_TRANSACTIONAL_READY = false as boolean;

export interface FrenchReadiness {
  env?: NodeJS.ProcessEnv;
  /** Test seam only; production code never passes it. */
  ready?: boolean;
}

/** True only when the code-level readiness constant AND the API French gate are both on. */
export function isFrenchTransactionalActive(opts: FrenchReadiness = {}): boolean {
  const ready = opts.ready ?? FR_CA_TRANSACTIONAL_READY;
  return ready === true && isFrenchUiEnabled(opts.env ?? process.env);
}

/**
 * Live dispatch selection — behaviour-preserving. Any value other than `'en'` (including `undefined`,
 * legacy strings and a stored `'fr-CA'` while French is inactive) selects Spanish, exactly as before.
 */
export function dispatchCopyLocale(lang: unknown, opts: FrenchReadiness = {}): EmailLocale {
  if (lang === 'en') return 'en';
  if (lang === 'fr-CA' && isFrenchTransactionalActive(opts)) return 'fr-CA';
  return 'es';
}

/** Canonical `<html lang>` values. */
export const HTML_LANG: Record<EmailLocale, string> = { es: 'es', en: 'en', 'fr-CA': 'fr-CA' };

/** B2-D4 fallback (PO-approved for B2-A2a): unsupported, unknown, malformed or gated values use Spanish. */
export const N1_FALLBACK_LOCALE: EmailLocale = 'es';

/**
 * N-1 normalization (PR #82 §3.3.1; B2-D4). Returns a canonical locale and `<html lang>` for any stored
 * value; never echoes the raw input.
 */
export function resolveMessageLocale(
  stored: unknown,
  opts: FrenchReadiness = {},
): { locale: EmailLocale; htmlLang: string } {
  const normalized = normalizeUiLocale(stored);
  let locale: EmailLocale = N1_FALLBACK_LOCALE;
  if (normalized === 'es' || normalized === 'en') locale = normalized;
  else if (normalized === 'fr-CA' && isFrenchTransactionalActive(opts)) locale = 'fr-CA';
  return { locale, htmlLang: HTML_LANG[locale] };
}

/**
 * Locale for the account-security emails of an existing or newly created account (NEM-025 B2-A2a, B2-D1/B2-D4):
 * the account's stored interface preference, normalized by N-1. `es`/`en` pass through unchanged; anything
 * else, including `fr-CA` while French transactional readiness is off, becomes Spanish. The caller passes
 * the result to EmailService, so the raw stored string never reaches an HTML attribute.
 *
 * Authorized callers only: local registration, resend confirmation, password reset, account-deletion
 * farewell. Gift, waitlist, invitation and commerce callers are excluded (B2-D6).
 */
export function accountEmailLocale(stored: unknown, opts: FrenchReadiness = {}): EmailLocale {
  return resolveMessageLocale(stored, opts).locale;
}
