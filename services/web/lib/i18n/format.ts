import type { Language } from './locales';

// Locale-aware, presentation-only formatting (NEM-025 B1-A). Never used for prices or any commerce
// logic: USD price display is out of scope here (PR #60 owns lib/currency.ts) and CAD is not used.

/** BCP 47 locale used by Intl for an interface language. Spanish keeps 'es-ES', which the profile
 *  page already used, so existing Spanish output is unchanged. */
export function intlLocale(language: Language): string {
  if (language === 'fr-CA') return 'fr-CA';
  if (language === 'en') return 'en-US';
  return 'es-ES';
}

/** Long date (e.g. "22 de noviembre de 2026", "November 22, 2026", "22 novembre 2026"). */
export function formatLongDate(iso: string | null | undefined, language: Language): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(intlLocale(language), { year: 'numeric', month: 'long', day: 'numeric' });
}

/** Date and time in the interface language. */
export function formatDateTime(iso: string, language: Language): string {
  return new Date(iso).toLocaleString(intlLocale(language));
}

/** Country name in the interface language, from an ISO 3166 region code; `fallback` if unavailable. */
export function countryName(code: string, language: Language, fallback: string): string {
  try {
    return new Intl.DisplayNames([intlLocale(language)], { type: 'region' }).of(code) ?? fallback;
  } catch {
    return fallback;
  }
}
