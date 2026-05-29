import { ReaderScreen } from '../../../src/screens/reader/ReaderScreen';

describe('ReaderScreen', () => {
  it('exports ReaderScreen as a React function component', () => {
    expect(typeof ReaderScreen).toBe('function');
  });
});

// Selection mode i18n keys exist in both locales
describe('selection mode i18n', () => {
  it('en has selectionMode and selectionModeHint', () => {
    const { en } = require('../../../src/i18n/en');
    expect(typeof en.reader.selectionMode).toBe('string');
    expect(en.reader.selectionMode.length).toBeGreaterThan(0);
    expect(typeof en.reader.selectionModeHint).toBe('string');
    expect(en.reader.selectionModeHint.length).toBeGreaterThan(0);
  });

  it('es has selectionMode and selectionModeHint', () => {
    const { es } = require('../../../src/i18n/es');
    expect(typeof es.reader.selectionMode).toBe('string');
    expect(es.reader.selectionMode.length).toBeGreaterThan(0);
    expect(typeof es.reader.selectionModeHint).toBe('string');
    expect(es.reader.selectionModeHint.length).toBeGreaterThan(0);
  });

  it('es keys match en shape', () => {
    const { en } = require('../../../src/i18n/en');
    const { es } = require('../../../src/i18n/es');
    expect(Object.keys(es.reader)).toEqual(Object.keys(en.reader));
  });
});
