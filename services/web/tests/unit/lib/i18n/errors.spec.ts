import { en } from '@/lib/i18n/en';
import { es } from '@/lib/i18n/es';
import { frCA } from '@/lib/i18n/fr-ca';
import { genericErrorMessage, loginErrorMessage, registerErrorMessage } from '@/lib/i18n/errors';

// Raw server messages (e.g. "Invalid credentials", "Email already in use") must never reach the UI.
const RAW = Object.assign(new Error('Invalid credentials'), { status: 401 });

describe('localized API error mapping (NEM-025 B1-A)', () => {
  it.each([[es], [en], [frCA]])('login: 401 → invalid credentials, 429 → too many attempts, else generic', (t) => {
    expect(loginErrorMessage(RAW, t)).toBe(t.auth.login.errors.invalidCredentials);
    expect(loginErrorMessage({ status: 429 }, t)).toBe(t.common.tooManyAttempts);
    expect(loginErrorMessage({ status: 500 }, t)).toBe(t.auth.login.errors.generic);
    expect(loginErrorMessage(new Error('boom'), t)).toBe(t.auth.login.errors.generic);
    expect(loginErrorMessage(undefined, t)).toBe(t.auth.login.errors.generic);
  });

  it.each([[es], [en], [frCA]])('register: 409 → email taken, 429 → too many attempts, else generic', (t) => {
    expect(registerErrorMessage(Object.assign(new Error('Email already in use'), { status: 409 }), t)).toBe(t.auth.register.errors.emailTaken);
    expect(registerErrorMessage({ status: 429 }, t)).toBe(t.common.tooManyAttempts);
    expect(registerErrorMessage({ status: 400 }, t)).toBe(t.auth.register.errors.generic);
  });

  it.each([[es], [en], [frCA]])('generic: 429 → too many attempts, anything else → common error', (t) => {
    expect(genericErrorMessage({ status: 429 }, t)).toBe(t.common.tooManyAttempts);
    expect(genericErrorMessage({ status: 404 }, t)).toBe(t.common.error);
    expect(genericErrorMessage(null, t)).toBe(t.common.error);
  });

  it('never returns the raw server message', () => {
    for (const t of [es, en, frCA]) {
      expect(loginErrorMessage(RAW, t)).not.toContain('Invalid credentials');
      expect(registerErrorMessage(Object.assign(new Error('Email already in use'), { status: 409 }), t)).not.toContain('already in use');
    }
  });
});
