// Interface-locale contract for the web app (NEM-025 Checkpoint A).
//
// Interface locales describe Noetia's own UI: `es`, `en`, `fr-CA`. They are independent of a
// book's original language, which uses ISO codes such as `fr` (see `bookLanguageFor`).
//
// `fr-CA` sits behind a French readiness gate that is disabled by default and fails closed: only
// NEXT_PUBLIC_FR_CA_ENABLED === 'true' enables it. While the gate is closed, `fr-CA` is never
// offered, never applied from storage or from the server, and never written anywhere.

export const SUPPORTED_LANGUAGES = ['es', 'en', 'fr-CA'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = 'es';

/** French readiness gate. `process.env.NEXT_PUBLIC_FR_CA_ENABLED` must be referenced literally so
 *  Next.js inlines it at build time. Any value other than exactly `'true'` keeps French hidden. */
export function isFrenchEnabled(): boolean {
  return process.env.NEXT_PUBLIC_FR_CA_ENABLED === 'true';
}

/** Languages a user may pick right now. `es` and `en` are always available. */
export function selectableLanguages(frEnabled: boolean = isFrenchEnabled()): Language[] {
  return frEnabled ? [...SUPPORTED_LANGUAGES] : ['es', 'en'];
}

function isSupported(value: unknown): value is Language {
  return typeof value === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

/** The value as a selectable language, or `null` if it is unknown, malformed or gated off. */
export function normalizeLanguage(value: unknown, frEnabled: boolean = isFrenchEnabled()): Language | null {
  return isSupported(value) && selectableLanguages(frEnabled).includes(value) ? value : null;
}

/** Language to use from this device's stored preference: the stored value when selectable,
 *  otherwise the default. */
export function resolveStoredLanguage(stored: unknown, frEnabled: boolean = isFrenchEnabled()): Language {
  return normalizeLanguage(stored, frEnabled) ?? DEFAULT_LANGUAGE;
}

/**
 * Language to use after reading the signed-in account's server preference.
 * - A selectable server value wins over the device value, as before.
 * - A canonical value that is not selectable here (`fr-CA` while the gate is closed) resolves to
 *   the default. It must not fall back to the device value, which may belong to another account
 *   that used this browser.
 * - A missing or legacy unknown server value keeps the current device language (unchanged behaviour).
 */
export function resolveServerLanguage(
  serverValue: unknown,
  current: Language,
  frEnabled: boolean = isFrenchEnabled(),
): Language {
  const selectable = normalizeLanguage(serverValue, frEnabled);
  if (selectable) return selectable;
  if (isSupported(serverValue)) return DEFAULT_LANGUAGE;
  return current;
}

/** ISO language code of book content matching an interface language (`fr-CA` UI → `fr` books). */
export function bookLanguageFor(language: Language): 'es' | 'en' | 'fr' {
  return language === 'fr-CA' ? 'fr' : language;
}
