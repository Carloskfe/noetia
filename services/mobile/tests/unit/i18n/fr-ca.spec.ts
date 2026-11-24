import { en } from '../../../src/i18n/en';
import { es } from '../../../src/i18n/es';
import { frCA } from '../../../src/i18n/fr-ca';

type AnyRecord = Record<string, unknown>;

function describeShape(value: unknown): unknown {
  if (typeof value === 'function') return `fn:${(value as (...a: unknown[]) => unknown).length}`;
  if (typeof value === 'string') return 'string';
  if (Array.isArray(value)) return value.map(describeShape);
  if (value && typeof value === 'object') {
    const out: AnyRecord = {};
    for (const key of Object.keys(value as AnyRecord)) out[key] = describeShape((value as AnyRecord)[key]);
    return out;
  }
  return typeof value;
}

function leafEntries(value: unknown, prefix = ''): [string, unknown][] {
  if (value && typeof value === 'object') {
    return Object.keys(value as AnyRecord).flatMap((k) =>
      leafEntries((value as AnyRecord)[k], prefix ? `${prefix}.${k}` : k),
    );
  }
  return [[prefix, value]];
}

describe('mobile i18n parity (en, es, fr-CA)', () => {
  it('has identical structure in en and es (existing languages unchanged in shape)', () => {
    expect(describeShape(es)).toEqual(describeShape(en));
  });

  it('has identical structure in en and fr-CA', () => {
    expect(describeShape(frCA)).toEqual(describeShape(en));
  });

  it('has no empty French string', () => {
    expect(leafEntries(frCA).filter(([, v]) => typeof v === 'string' && v.trim() === '')).toEqual([]);
  });

  // Identical to English on purpose: language labels, brand/product names, platform names,
  // cognates and symbols.
  const IDENTICAL_TO_EN_ALLOWED = new Set([
    'lang.es', 'lang.en', 'lang.fr-CA', 'common.ok', 'auth.login.passwordPlaceholder',
    'fragments.title', 'paywall.title', 'sharing.platforms.instagram', 'sharing.platforms.facebook',
    'sharing.platforms.linkedin', 'sharing.platforms.pinterest', 'consent.ok', 'clubs.nav',
    'clubs.tabs.discussion',
    // NEM-025 B1-B navigation labels: cognates, as in clubs.nav and fragments.title.
    'nav.clubs', 'nav.fragments', 'nav.club',
  ]);

  it('leaves no English string untranslated outside the reviewed allowlist', () => {
    const enMap = new Map(leafEntries(en));
    const untranslated = leafEntries(frCA)
      .filter(([k, v]) => typeof v === 'string' && enMap.get(k) === v)
      .map(([k]) => k)
      .filter((k) => !IDENTICAL_TO_EN_ALLOWED.has(k));
    expect(untranslated).toEqual([]);
  });

  it('labels the French interface "Français (Canada)" in every dictionary', () => {
    for (const t of [en, es, frCA]) expect(t.lang['fr-CA']).toBe('Français (Canada)');
  });

  it('marks every French paywall price as US dollars', () => {
    for (const plan of Object.values(frCA.paywall.plans)) expect(plan.price).toContain('$ US');
  });

  it('keeps plan keys and the popular flag identical to en', () => {
    expect(Object.keys(frCA.paywall.plans)).toEqual(Object.keys(en.paywall.plans));
    expect(frCA.paywall.plans.Duo.popular).toBe(true);
  });
});
