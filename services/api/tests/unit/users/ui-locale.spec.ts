import {
  DEFAULT_UI_LOCALE,
  isFrenchUiEnabled,
  normalizeUiLocale,
  selectableUiLocales,
  SUPPORTED_UI_LOCALES,
} from '../../../src/users/ui-locale';

describe('ui-locale contract', () => {
  it('declares exactly the canonical interface locales es, en, fr-CA', () => {
    expect([...SUPPORTED_UI_LOCALES]).toEqual(['es', 'en', 'fr-CA']);
    expect(DEFAULT_UI_LOCALE).toBe('es');
  });

  describe('isFrenchUiEnabled (fail-closed gate)', () => {
    it('is off when FR_CA_ENABLED is unset', () => {
      expect(isFrenchUiEnabled({})).toBe(false);
    });

    it.each(['false', 'TRUE', 'True', '1', 'yes', ' true', 'true ', ''])('is off for %p', (v) => {
      expect(isFrenchUiEnabled({ FR_CA_ENABLED: v })).toBe(false);
    });

    it('is on only for the exact string "true"', () => {
      expect(isFrenchUiEnabled({ FR_CA_ENABLED: 'true' })).toBe(true);
    });

    it('reads process.env by default', () => {
      const prev = process.env.FR_CA_ENABLED;
      delete process.env.FR_CA_ENABLED;
      expect(isFrenchUiEnabled()).toBe(false);
      if (prev !== undefined) process.env.FR_CA_ENABLED = prev;
    });
  });

  describe('selectableUiLocales', () => {
    it('offers only es and en while the gate is closed', () => {
      expect(selectableUiLocales({})).toEqual(['es', 'en']);
    });

    it('adds fr-CA when the gate is open', () => {
      expect(selectableUiLocales({ FR_CA_ENABLED: 'true' })).toEqual(['es', 'en', 'fr-CA']);
    });

    it('reads process.env by default (closed)', () => {
      const prev = process.env.FR_CA_ENABLED;
      delete process.env.FR_CA_ENABLED;
      expect(selectableUiLocales()).toEqual(['es', 'en']);
      if (prev !== undefined) process.env.FR_CA_ENABLED = prev;
    });
  });

  describe('normalizeUiLocale', () => {
    it.each(['es', 'en', 'fr-CA'])('keeps the canonical value %p', (v) => {
      expect(normalizeUiLocale(v)).toBe(v);
    });

    it.each(['fr', 'fr-ca', 'FR-CA', 'pt', 'EN', '', ' es', 'es-MX'])('rejects non-canonical %p', (v) => {
      expect(normalizeUiLocale(v)).toBeNull();
    });

    it.each([undefined, null, 42, {}, ['es']])('rejects non-string %p', (v) => {
      expect(normalizeUiLocale(v)).toBeNull();
    });
  });
});
