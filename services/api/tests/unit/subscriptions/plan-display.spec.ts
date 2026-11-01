import { customerPlanName, planKey } from '../../../src/subscriptions/plan-display';

describe('planKey', () => {
  it.each([
    ['Individual Monthly', 'Individual'],
    ['Individual Annual', 'Individual'],
    ['Individual', 'Individual'],
    ['Dual Reader Monthly', 'Duo'],
    ['Dual Reader Annual', 'Duo'],
    ['Duo', 'Duo'],
    ['Dúo', 'Duo'],
    ['Reader', 'Duo'],
    ['Family', 'Family'],
    ['Familia', 'Family'],
    ['  family annual  ', 'Family'],
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

describe('customerPlanName', () => {
  it('uses the approved Spanish names', () => {
    expect(customerPlanName('Individual Monthly', 'es')).toBe('Individual');
    expect(customerPlanName('Dual Reader Annual', 'es')).toBe('Dúo');
    expect(customerPlanName('Family', 'es')).toBe('Familia');
  });

  it('uses the approved English names', () => {
    expect(customerPlanName('Individual Annual', 'en')).toBe('Individual');
    expect(customerPlanName('Dual Reader Monthly', 'en')).toBe('Duo');
    expect(customerPlanName('Family', 'en')).toBe('Family');
  });

  it('defaults to Spanish, and treats unsupported languages as Spanish', () => {
    expect(customerPlanName('Dual Reader Monthly')).toBe('Dúo');
    expect(customerPlanName('Family', 'pt')).toBe('Familia');
  });

  it('returns unknown names unchanged', () => {
    expect(customerPlanName('Noetia', 'en')).toBe('Noetia');
  });
});
