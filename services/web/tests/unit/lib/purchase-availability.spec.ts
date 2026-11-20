import { PURCHASES_AVAILABLE, purchasesAvailable } from '@/lib/purchase-availability';

describe('lib/purchase-availability (fail closed)', () => {
  it('defaults to purchases UNAVAILABLE: enabling is a reviewed financial-release change, never a default', () => {
    expect(PURCHASES_AVAILABLE).toBe(false);
    expect(purchasesAvailable()).toBe(false);
  });

  it('is not driven by environment variables (no ungoverned activation switch)', () => {
    const before = { ...process.env };
    process.env.NEXT_PUBLIC_PAYMENTS_ENABLED = 'true';
    process.env.PAYMENTS_ENABLED = 'true';
    process.env.NEXT_PUBLIC_PURCHASES_AVAILABLE = 'true';
    jest.isolateModules(() => {
      const mod = require('@/lib/purchase-availability');
      expect(mod.purchasesAvailable()).toBe(false);
    });
    process.env = before;
  });
});
