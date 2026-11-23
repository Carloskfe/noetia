import {
  DEFAULT_LANGUAGE,
  isFrenchEnabled,
  normalizeLanguage,
  resolveServerLanguage,
  resolveStoredLanguage,
  selectableLanguages,
  SUPPORTED_LANGUAGES,
} from '../../../src/i18n/locales';

const ENV = 'EXPO_PUBLIC_FR_CA_ENABLED';

describe('mobile locale contract (NEM-025 Checkpoint A)', () => {
  const prev = process.env[ENV];
  afterEach(() => {
    if (prev === undefined) delete process.env[ENV];
    else process.env[ENV] = prev;
  });

  it('declares exactly es, en, fr-CA with es as default', () => {
    expect([...SUPPORTED_LANGUAGES]).toEqual(['es', 'en', 'fr-CA']);
    expect(DEFAULT_LANGUAGE).toBe('es');
  });

  it('keeps the French gate off unless the value is exactly "true"', () => {
    delete process.env[ENV];
    expect(isFrenchEnabled()).toBe(false);
    for (const v of ['false', 'TRUE', '1', '', ' true']) {
      process.env[ENV] = v;
      expect(isFrenchEnabled()).toBe(false);
    }
    process.env[ENV] = 'true';
    expect(isFrenchEnabled()).toBe(true);
  });

  it('offers fr-CA only behind the gate', () => {
    delete process.env[ENV];
    expect(selectableLanguages()).toEqual(['es', 'en']);
    expect(selectableLanguages(true)).toEqual(['es', 'en', 'fr-CA']);
  });

  it('normalizes values safely', () => {
    expect(normalizeLanguage('es', false)).toBe('es');
    expect(normalizeLanguage('en', false)).toBe('en');
    expect(normalizeLanguage('fr-CA', false)).toBeNull();
    expect(normalizeLanguage('fr-CA', true)).toBe('fr-CA');
    for (const v of ['fr', 'fr-ca', 'pt', '', null, undefined, 1]) expect(normalizeLanguage(v, true)).toBeNull();
    delete process.env[ENV];
    expect(normalizeLanguage('fr-CA')).toBeNull();
  });

  it('resolves the stored device preference with es as the fallback', () => {
    expect(resolveStoredLanguage('en', false)).toBe('en');
    expect(resolveStoredLanguage('fr-CA', false)).toBe('es');
    expect(resolveStoredLanguage('fr-CA', true)).toBe('fr-CA');
    expect(resolveStoredLanguage(null, false)).toBe('es');
    delete process.env[ENV];
    expect(resolveStoredLanguage('fr-CA')).toBe('es');
  });

  it('resolves the server preference without leaking another account’s device value', () => {
    expect(resolveServerLanguage('en', 'es', false)).toBe('en');
    expect(resolveServerLanguage('fr-CA', 'en', false)).toBe('es');
    expect(resolveServerLanguage('fr-CA', 'en', true)).toBe('fr-CA');
    expect(resolveServerLanguage(undefined, 'en', false)).toBe('en');
    expect(resolveServerLanguage('xx', 'en', false)).toBe('en');
    delete process.env[ENV];
    expect(resolveServerLanguage('fr-CA', 'en')).toBe('es');
  });
});
