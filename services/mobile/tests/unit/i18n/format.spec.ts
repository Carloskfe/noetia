import { formatDateTime, formatLongDate, intlLocale } from '../../../src/i18n/format';

const DATE = '2026-02-05T14:30:00Z';

describe('intlLocale', () => {
  it('maps each interface language to an Intl locale', () => {
    expect(intlLocale('es')).toBe('es');
    expect(intlLocale('en')).toBe('en-US');
    expect(intlLocale('fr-CA')).toBe('fr-CA');
  });
});

describe('formatLongDate', () => {
  it('keeps the Spanish output the app produced before (locale "es")', () => {
    expect(formatLongDate(DATE, 'es')).toBe(new Date(DATE).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' }));
    expect(formatLongDate(DATE, 'es')).toContain('febrero');
  });

  it('formats English and Canadian French dates in their own language', () => {
    expect(formatLongDate(DATE, 'en')).toContain('February');
    expect(formatLongDate(DATE, 'fr-CA')).toContain('février');
  });

  it('accepts timestamps and Date objects', () => {
    const ms = Date.parse(DATE);
    expect(formatLongDate(ms, 'en')).toBe(formatLongDate(new Date(ms), 'en'));
  });
});

describe('formatDateTime', () => {
  it('uses the interface locale, not the device locale', () => {
    expect(formatDateTime(DATE, 'en')).toBe(new Date(DATE).toLocaleString('en-US'));
    expect(formatDateTime(DATE, 'fr-CA')).toBe(new Date(DATE).toLocaleString('fr-CA'));
    expect(formatDateTime(DATE, 'es')).toBe(new Date(DATE).toLocaleString('es'));
  });
});
