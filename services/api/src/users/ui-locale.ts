/**
 * Interface-locale contract (NEM-025 Checkpoint A).
 *
 * Canonical interface locales are `es`, `en` and `fr-CA`. They describe the language of Noetia's
 * own interface, never the language of a book: book content uses ISO language codes (`fr` for
 * French-language books) and is independent of the interface locale.
 *
 * `fr-CA` is gated. French transactional emails and push notifications are not built yet, so a
 * stored `fr-CA` preference would silently receive Spanish messages. Until the gate is
 * deliberately enabled, the API refuses to store `fr-CA`. The gate fails closed: only the exact
 * string `true` enables it.
 */
export const SUPPORTED_UI_LOCALES = ['es', 'en', 'fr-CA'] as const;
export type UiLocale = (typeof SUPPORTED_UI_LOCALES)[number];

export const DEFAULT_UI_LOCALE: UiLocale = 'es';

/** True only when `FR_CA_ENABLED` is exactly `"true"`. Any other value, or none, keeps French off. */
export function isFrenchUiEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.FR_CA_ENABLED === 'true';
}

/** Locales a user may select right now: always `es` and `en`; `fr-CA` only behind the gate. */
export function selectableUiLocales(env: NodeJS.ProcessEnv = process.env): UiLocale[] {
  return isFrenchUiEnabled(env) ? [...SUPPORTED_UI_LOCALES] : ['es', 'en'];
}

/** Returns the canonical locale for a supported value, or `null` for anything else. */
export function normalizeUiLocale(value: unknown): UiLocale | null {
  return typeof value === 'string' && (SUPPORTED_UI_LOCALES as readonly string[]).includes(value)
    ? (value as UiLocale)
    : null;
}
