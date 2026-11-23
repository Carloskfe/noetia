import type { Language } from './locales';

// Presentation-only date formatting in the active interface language (NEM-025 B1-B).
// No currency formatting lives here: commerce stays in USD and is not converted.

/** Intl locale for each interface language. Spanish keeps the 'es' locale the app already used. */
export function intlLocale(language: Language): string {
  switch (language) {
    case 'en': return 'en-US';
    case 'fr-CA': return 'fr-CA';
    default: return 'es';
  }
}

/** Long date, e.g. "5 de noviembre de 2026", "November 5, 2026", "5 novembre 2026". */
export function formatLongDate(value: string | number | Date, language: Language): string {
  return new Date(value).toLocaleDateString(intlLocale(language), { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Date and time in the interface language (previously the device locale). */
export function formatDateTime(value: string | number | Date, language: Language): string {
  return new Date(value).toLocaleString(intlLocale(language));
}
