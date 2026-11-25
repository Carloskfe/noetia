// NEM-025 B2-A2a — local email/password registration request (mobile).
//
// The reader's active interface language (from the existing LanguageProvider — no separate state) is
// sent as `uiLanguage` so the API stores it on the new account and confirms in that language.
//
// Only `es` and `en` are sent in this build. `fr-CA` is never sent from registration, whatever the app's
// French gate says: French transactional email is not active, and the API refuses a gated `fr-CA`, so
// sending it could turn a configuration mismatch into a failed registration. Without the field the API
// registers the reader in Spanish, exactly as for older app versions.
import { normalizeLanguage, type Language } from '../i18n/locales';

export interface RegisterFields {
  name: string;
  email: string;
  password: string;
}

export type RegisterRequestBody = RegisterFields & { uiLanguage?: 'es' | 'en' };

export function registerRequestBody(fields: RegisterFields, language: Language): RegisterRequestBody {
  const uiLanguage = normalizeLanguage(language, false);
  return uiLanguage === 'es' || uiLanguage === 'en' ? { ...fields, uiLanguage } : { ...fields };
}
