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
 * - `resolveMessageLocale()` is the designed N-1 normalization (canonical locale + canonical `<html lang>`
 *   for legacy/invalid stored values). It is NOT authorized for dispatch and is not called by any
 *   runtime code; it exists so it can be reviewed and tested in isolation.
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

/** B2-D4 fallback as recommended in the B2 preparation report. Pending PO decision. */
export const N1_FALLBACK_LOCALE: EmailLocale = 'es';

/**
 * N-1 normalization (DESIGN ONLY — not wired to dispatch; see PR #82 §3.3.1).
 * Returns a canonical locale and `<html lang>` for any stored value; never echoes the raw input.
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
