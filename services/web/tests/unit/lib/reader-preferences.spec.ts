import { loadPreferences, savePreferences, FONT_SIZES } from '../../../lib/reader-preferences';

const mockStorage: Record<string, string> = {};
const localStorageMock = {
  getItem: jest.fn((key: string) => mockStorage[key] ?? null),
  setItem: jest.fn((key: string, value: string) => { mockStorage[key] = value; }),
  removeItem: jest.fn((key: string) => { delete mockStorage[key]; }),
  clear: jest.fn(() => { Object.keys(mockStorage).forEach((k) => delete mockStorage[k]); }),
};

beforeEach(() => {
  jest.clearAllMocks();
  localStorageMock.clear();
  Object.defineProperty(global, 'localStorage', { value: localStorageMock, writable: true });
  Object.defineProperty(global, 'window', { value: global, writable: true });
});

describe('FONT_SIZES', () => {
  it('contains exactly sm, md, lg in order', () => {
    expect(FONT_SIZES).toEqual(['sm', 'md', 'lg']);
  });
});

describe('loadPreferences', () => {
  it('returns defaults when no values are stored', () => {
    const prefs = loadPreferences();
    expect(prefs).toEqual({ fontSize: 'md', darkMode: false });
  });

  it('returns stored font size and darkMode when both are present', () => {
    mockStorage['reader-font-size'] = 'lg';
    mockStorage['reader-dark-mode'] = 'true';
    const prefs = loadPreferences();
    expect(prefs.fontSize).toBe('lg');
    expect(prefs.darkMode).toBe(true);
  });

  it('returns stored sm font size', () => {
    mockStorage['reader-font-size'] = 'sm';
    expect(loadPreferences().fontSize).toBe('sm');
  });

  it('falls back to md if stored font size is not a valid step', () => {
    mockStorage['reader-font-size'] = 'xxl';
    expect(loadPreferences().fontSize).toBe('md');
  });

  it('treats missing reader-dark-mode as false', () => {
    mockStorage['reader-font-size'] = 'sm';
    expect(loadPreferences().darkMode).toBe(false);
  });

  it('treats reader-dark-mode = "false" as false', () => {
    mockStorage['reader-dark-mode'] = 'false';
    expect(loadPreferences().darkMode).toBe(false);
  });

  it('returns defaults without throwing when window is undefined', () => {
    Object.defineProperty(global, 'window', { value: undefined, writable: true });
    expect(() => loadPreferences()).not.toThrow();
    expect(loadPreferences()).toEqual({ fontSize: 'md', darkMode: false });
  });
});

describe('savePreferences', () => {
  it('writes font size to localStorage', () => {
    savePreferences({ fontSize: 'lg', darkMode: false });
    expect(localStorageMock.setItem).toHaveBeenCalledWith('reader-font-size', 'lg');
  });

  it('writes dark mode to localStorage as string', () => {
    savePreferences({ fontSize: 'md', darkMode: true });
    expect(localStorageMock.setItem).toHaveBeenCalledWith('reader-dark-mode', 'true');
  });

  it('writes both keys in a single call', () => {
    savePreferences({ fontSize: 'sm', darkMode: false });
    expect(localStorageMock.setItem).toHaveBeenCalledTimes(2);
    expect(localStorageMock.setItem).toHaveBeenCalledWith('reader-font-size', 'sm');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('reader-dark-mode', 'false');
  });

  it('does not throw when window is undefined', () => {
    Object.defineProperty(global, 'window', { value: undefined, writable: true });
    expect(() => savePreferences({ fontSize: 'md', darkMode: false })).not.toThrow();
  });

  it('saved values are recoverable by loadPreferences', () => {
    savePreferences({ fontSize: 'lg', darkMode: true });
    const prefs = loadPreferences();
    expect(prefs.fontSize).toBe('lg');
    expect(prefs.darkMode).toBe(true);
  });
});
