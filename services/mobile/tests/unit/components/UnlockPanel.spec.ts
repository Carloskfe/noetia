import { UnlockPanel } from '../../../src/components/UnlockPanel';
import { en } from '../../../src/i18n/en';
import { es } from '../../../src/i18n/es';

describe('UnlockPanel', () => {
  it('exports a React function component', () => {
    expect(typeof UnlockPanel).toBe('function');
  });
});

describe('acquisition copy (shared with web, NEM-012)', () => {
  it('has the same keys in English and Spanish', () => {
    expect(Object.keys(es.acquisition).sort()).toEqual(Object.keys(en.acquisition).sort());
  });

  it('formats the token balance in both languages', () => {
    expect(en.acquisition.balance(1)).toBe('You have 1 token');
    expect(en.acquisition.balance(3)).toBe('You have 3 tokens');
    expect(es.acquisition.balance(1)).toBe('Tienes 1 token');
    expect(es.acquisition.balance(3)).toBe('Tienes 3 tokens');
  });

  it('never mentions a per-title purchase (B-1)', () => {
    const all = JSON.stringify([en.acquisition, es.acquisition]).toLowerCase();
    expect(all).not.toMatch(/buy this book|purchase this|comprar este libro/);
  });

  it('no longer carries the old "Full library access" plan copy', () => {
    const all = JSON.stringify([en, es]);
    expect(all).not.toMatch(/Full library access|Acceso completo a la biblioteca/);
  });
});
