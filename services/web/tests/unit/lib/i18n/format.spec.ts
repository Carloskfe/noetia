import { countryName, formatDateTime, formatLongDate, intlLocale } from '@/lib/i18n/format';

describe('presentation-only locale formatting (NEM-025 B1-A)', () => {
  it('maps interface languages to Intl locales (Spanish keeps es-ES as before)', () => {
    expect(intlLocale('es')).toBe('es-ES');
    expect(intlLocale('en')).toBe('en-US');
    expect(intlLocale('fr-CA')).toBe('fr-CA');
  });

  it('formats long dates in the interface language, with accents intact', () => {
    const iso = '2026-02-03T12:00:00Z';
    expect(formatLongDate(iso, 'es')).toBe(new Date(iso).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' }));
    expect(formatLongDate(iso, 'en')).toContain('February');
    expect(formatLongDate(iso, 'fr-CA')).toContain('février');
    expect(formatLongDate(null, 'en')).toBe('');
  });

  it('formats date-times with the interface locale', () => {
    const iso = '2026-11-22T15:30:00Z';
    expect(formatDateTime(iso, 'fr-CA')).toBe(new Date(iso).toLocaleString('fr-CA'));
    expect(formatDateTime(iso, 'en')).toBe(new Date(iso).toLocaleString('en-US'));
  });

  it('localizes country names, falling back safely', () => {
    expect(countryName('MX', 'en', 'México')).toBe('Mexico');
    expect(countryName('MX', 'fr-CA', 'México')).toBe('Mexique');
    expect(countryName('not a region', 'en', 'Otro')).toBe('Otro');
  });
});
