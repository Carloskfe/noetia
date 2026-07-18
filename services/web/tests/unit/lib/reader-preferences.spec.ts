import { loadPreferences, savePreferences, FONT_SIZES, SPEEDS } from '../../../lib/reader-preferences';

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
  it('contains four steps sm, md, lg, xl in order', () => {
    expect(FONT_SIZES).toEqual(['sm', 'md', 'lg', 'xl']);
  });
});

describe('loadPreferences', () => {
  it('returns defaults when no values are stored', () => {
    const prefs = loadPreferences();
    expect(prefs).toEqual({ fontSize: 'md', darkMode: false, speed: 1, readingLayout: 'scroll' });
  });

  it('restores a stored playback speed', () => {
    mockStorage['reader-speed'] = '1.5';
    expect(loadPreferences().speed).toBe(1.5);
  });

  it('falls back to speed 1 for an unknown/invalid stored speed', () => {
    mockStorage['reader-speed'] = '3.7';
    expect(loadPreferences().speed).toBe(1);
    mockStorage['reader-speed'] = 'abc';
    expect(loadPreferences().speed).toBe(1);
  });

  it('accepts every offered speed step', () => {
    for (const s of SPEEDS) {
      mockStorage['reader-speed'] = String(s);
      expect(loadPreferences().speed).toBe(s);
    }
  });

  it('reads the new xl font size', () => {
    mockStorage['reader-font-size'] = 'xl';
    expect(loadPreferences().fontSize).toBe('xl');
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

  it('defaults reading layout to scroll', () => {
    expect(loadPreferences().readingLayout).toBe('scroll');
  });

  it('restores a stored paged layout', () => {
    mockStorage['reader-layout'] = 'paged';
    expect(loadPreferences().readingLayout).toBe('paged');
  });

  it('falls back to scroll for an unknown stored layout', () => {
    mockStorage['reader-layout'] = 'grid';
    expect(loadPreferences().readingLayout).toBe('scroll');
  });

  it('returns defaults without throwing when window is undefined', () => {
    Object.defineProperty(global, 'window', { value: undefined, writable: true });
    expect(() => loadPreferences()).not.toThrow();
    expect(loadPreferences()).toEqual({ fontSize: 'md', darkMode: false, speed: 1, readingLayout: 'scroll' });
  });
});

describe('savePreferences', () => {
  it('writes font size to localStorage', () => {
    savePreferences({ fontSize: 'lg', darkMode: false, speed: 1, readingLayout: 'scroll' });
    expect(localStorageMock.setItem).toHaveBeenCalledWith('reader-font-size', 'lg');
  });

  it('writes dark mode to localStorage as string', () => {
    savePreferences({ fontSize: 'md', darkMode: true, speed: 1, readingLayout: 'scroll' });
    expect(localStorageMock.setItem).toHaveBeenCalledWith('reader-dark-mode', 'true');
  });

  it('writes the playback speed', () => {
    savePreferences({ fontSize: 'md', darkMode: false, speed: 1.25, readingLayout: 'scroll' });
    expect(localStorageMock.setItem).toHaveBeenCalledWith('reader-speed', '1.25');
  });

  it('writes the reading layout', () => {
    savePreferences({ fontSize: 'md', darkMode: false, speed: 1, readingLayout: 'paged' });
    expect(localStorageMock.setItem).toHaveBeenCalledWith('reader-layout', 'paged');
  });

  it('writes all four keys in a single call', () => {
    savePreferences({ fontSize: 'sm', darkMode: false, speed: 2, readingLayout: 'paged' });
    expect(localStorageMock.setItem).toHaveBeenCalledTimes(4);
    expect(localStorageMock.setItem).toHaveBeenCalledWith('reader-font-size', 'sm');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('reader-dark-mode', 'false');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('reader-speed', '2');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('reader-layout', 'paged');
  });

  it('does not throw when window is undefined', () => {
    Object.defineProperty(global, 'window', { value: undefined, writable: true });
    expect(() => savePreferences({ fontSize: 'md', darkMode: false, speed: 1, readingLayout: 'scroll' })).not.toThrow();
  });

  it('saved values are recoverable by loadPreferences', () => {
    savePreferences({ fontSize: 'xl', darkMode: true, speed: 1.5, readingLayout: 'paged' });
    const prefs = loadPreferences();
    expect(prefs).toEqual({ fontSize: 'xl', darkMode: true, speed: 1.5, readingLayout: 'paged' });
  });
});
