import type { Translations } from './en';

// Client-side mapping of API failures to localized messages (NEM-025 B1-A). Raw server messages
// (often English, sometimes internal) are never shown to the user; only the HTTP status selects
// a localized message. Authentication and authorization behaviour is unchanged.
type ApiError = { status?: number } | null | undefined;

function statusOf(err: unknown): number | undefined {
  const s = (err as ApiError)?.status;
  return typeof s === 'number' ? s : undefined;
}

export function loginErrorMessage(err: unknown, t: Translations): string {
  const status = statusOf(err);
  if (status === 401) return t.auth.login.errors.invalidCredentials;
  if (status === 429) return t.common.tooManyAttempts;
  return t.auth.login.errors.generic;
}

export function registerErrorMessage(err: unknown, t: Translations): string {
  const status = statusOf(err);
  if (status === 409) return t.auth.register.errors.emailTaken;
  if (status === 429) return t.common.tooManyAttempts;
  return t.auth.register.errors.generic;
}

/** Generic localized failure for any other API call. */
export function genericErrorMessage(err: unknown, t: Translations): string {
  return statusOf(err) === 429 ? t.common.tooManyAttempts : t.common.error;
}
