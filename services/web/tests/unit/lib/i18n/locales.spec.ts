import {
  bookLanguageFor,
  DEFAULT_LANGUAGE,
  isFrenchEnabled,
  normalizeLanguage,
  resolveServerLanguage,
  resolveStoredLanguage,
  selectableLanguages,
  SUPPORTED_LANGUAGES,
} from '../../../../lib/i18n/locales';

const ENV = 'NEXT_PUBLIC_FR_CA_ENABLED';

describe('web locale contract (NEM-025 Checkpoint A)', () => {
  const prev = process.env[ENV];
  afterEach(() => {
    if (prev === undefined) delete process.env[ENV];
    else process.env[ENV] = prev;
  });

  it('declares exactly es, en, fr-CA with es as default', () => {
    expect([...SUPPORTED_LANGUAGES]).toEqual(['es', 'en', 'fr-CA']);
    expect(DEFAULT_LANGUAGE).toBe('es');
  });

  describe('isFrenchEnabled — default-disabled, fail-closed gate', () => {
    it('is off when the variable is unset', () => {
      delete process.env[ENV];
      expect(isFrenchEnabled()).toBe(false);
    });

    it.each(['false', 'TRUE', '1', 'yes', '', ' true'])('is off for %p', (v) => {
      process.env[ENV] = v;
      expect(isFrenchEnabled()).toBe(false);
    });

    it('is on only for exactly "true"', () => {
      process.env[ENV] = 'true';
      expect(isFrenchEnabled()).toBe(true);
    });
  });

  describe('selectableLanguages', () => {
    it('hides fr-CA by default', () => {
      delete process.env[ENV];
      expect(selectableLanguages()).toEqual(['es', 'en']);
    });

    it('offers fr-CA only behind the gate', () => {
      expect(selectableLanguages(true)).toEqual(['es', 'en', 'fr-CA']);
      expect(selectableLanguages(false)).toEqual(['es', 'en']);
    });
  });

  describe('normalizeLanguage', () => {
    it.each(['es', 'en'])('keeps %p regardless of the gate', (v) => {
      expect(normalizeLanguage(v, false)).toBe(v);
      expect(normalizeLanguage(v, true)).toBe(v);
    });

    it('treats fr-CA as unavailable while gated, available when enabled', () => {
      expect(normalizeLanguage('fr-CA', false)).toBeNull();
      expect(normalizeLanguage('fr-CA', true)).toBe('fr-CA');
    });

    it.each(['fr', 'fr-ca', 'EN', 'pt', '', null, undefined, 3, {}])('rejects %p', (v) => {
      expect(normalizeLanguage(v, true)).toBeNull();
    });

    it('uses the environment gate by default', () => {
      delete process.env[ENV];
      expect(normalizeLanguage('fr-CA')).toBeNull();
    });
  });

  describe('resolveStoredLanguage', () => {
    it('preserves existing es/en device preferences', () => {
      expect(resolveStoredLanguage('en', false)).toBe('en');
      expect(resolveStoredLanguage('es', false)).toBe('es');
    });

    it('falls back to es for missing, legacy or gated values', () => {
      expect(resolveStoredLanguage(null, false)).toBe('es');
      expect(resolveStoredLanguage('pt', false)).toBe('es');
      expect(resolveStoredLanguage('fr-CA', false)).toBe('es');
    });

    it('keeps fr-CA when the gate is enabled', () => {
      expect(resolveStoredLanguage('fr-CA', true)).toBe('fr-CA');
    });

    it('uses the environment gate by default', () => {
      delete process.env[ENV];
      expect(resolveStoredLanguage('fr-CA')).toBe('es');
    });
  });

  describe('resolveServerLanguage', () => {
    it('lets a selectable server preference win over the device value', () => {
      expect(resolveServerLanguage('en', 'es', false)).toBe('en');
      expect(resolveServerLanguage('es', 'en', false)).toBe('es');
      expect(resolveServerLanguage('fr-CA', 'en', true)).toBe('fr-CA');
    });

    it('resolves a gated server value to the default, never to another account’s device value', () => {
      expect(resolveServerLanguage('fr-CA', 'en', false)).toBe('es');
    });

    it('keeps the current device language for missing or legacy server values', () => {
      expect(resolveServerLanguage(undefined, 'en', false)).toBe('en');
      expect(resolveServerLanguage('pt', 'en', false)).toBe('en');
      expect(resolveServerLanguage(null, 'es', false)).toBe('es');
    });

    it('uses the environment gate by default', () => {
      delete process.env[ENV];
      expect(resolveServerLanguage('fr-CA', 'en')).toBe('es');
    });
  });

  describe('bookLanguageFor — interface locale is independent of book language', () => {
    it('maps fr-CA interfaces to fr books and leaves es/en unchanged', () => {
      expect(bookLanguageFor('fr-CA')).toBe('fr');
      expect(bookLanguageFor('es')).toBe('es');
      expect(bookLanguageFor('en')).toBe('en');
    });
  });
});
