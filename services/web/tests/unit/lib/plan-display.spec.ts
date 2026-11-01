import { planKey, planLabel } from '../../../lib/plan-display';
import { en } from '../../../lib/i18n/en';
import { es } from '../../../lib/i18n/es';

describe('planKey', () => {
  it.each([
    // Exact production names (verified 2026-10-31) — monthly and annual rows.
    ['Individual Monthly', 'Individual'],
    ['Individual Annual', 'Individual'],
    ['Dual Reader Monthly', 'Duo'],
    ['Dual Reader Annual', 'Duo'],
    ['Family', 'Family'],
    // Names used by earlier migrations / future renames.
    ['Individual', 'Individual'],
    ['Duo', 'Duo'],
    ['Dúo', 'Duo'],
    ['Reader', 'Duo'],
    ['Familia', 'Family'],
    ['  DUAL READER MONTHLY ', 'Duo'],
  ])('maps %p to %p', (name, key) => {
    expect(planKey(name)).toBe(key);
  });

  it.each(['', 'Noetia', 'Premium', 'Individualistic', 'Readers Club', 'Duet'])(
    'returns null for unknown name %p',
    (name) => {
      expect(planKey(name)).toBeNull();
    },
  );

  it('returns null for null and undefined', () => {
    expect(planKey(null)).toBeNull();
    expect(planKey(undefined)).toBeNull();
  });
});

describe('planLabel', () => {
  it('returns the approved English labels', () => {
    expect(planLabel('Individual Annual', en.pricing.planNames)).toBe('Individual');
    expect(planLabel('Dual Reader Monthly', en.pricing.planNames)).toBe('Duo');
    expect(planLabel('Family', en.pricing.planNames)).toBe('Family');
  });

  it('returns the approved Spanish labels', () => {
    expect(planLabel('Individual Monthly', es.pricing.planNames)).toBe('Individual');
    expect(planLabel('Dual Reader Annual', es.pricing.planNames)).toBe('Dúo');
    expect(planLabel('Family', es.pricing.planNames)).toBe('Familia');
  });

  it('falls back to the trimmed raw name for unknown plans', () => {
    expect(planLabel('  Noetia Plus ', en.pricing.planNames)).toBe('Noetia Plus');
  });

  it('returns null when there is no name', () => {
    expect(planLabel(null, en.pricing.planNames)).toBeNull();
    expect(planLabel('   ', en.pricing.planNames)).toBeNull();
  });
});

describe('plan copy coverage', () => {
  it.each([['en', en], ['es', es]] as const)('%s has a name and description for every plan key', (_lang, dict) => {
    for (const key of ['Individual', 'Duo', 'Family'] as const) {
      expect(dict.pricing.planNames[key]).toBeTruthy();
      expect(dict.pricing.planDescriptions[key].tagline).toBeTruthy();
      expect(dict.pricing.planDescriptions[key].highlights.length).toBeGreaterThan(0);
    }
  });
});
