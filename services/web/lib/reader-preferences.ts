export type FontSize = 'sm' | 'md' | 'lg';

export interface ReaderPreferences {
  fontSize: FontSize;
  darkMode: boolean;
}

export const FONT_SIZES: FontSize[] = ['sm', 'md', 'lg'];

const DEFAULTS: ReaderPreferences = { fontSize: 'md', darkMode: false };

export function loadPreferences(): ReaderPreferences {
  if (typeof window === 'undefined') return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem('reader-font-size') as FontSize | null;
    const fontSize: FontSize = raw && FONT_SIZES.includes(raw) ? raw : DEFAULTS.fontSize;
    const darkMode = localStorage.getItem('reader-dark-mode') === 'true';
    return { fontSize, darkMode };
  } catch {
    return { ...DEFAULTS };
  }
}

export function savePreferences(prefs: ReaderPreferences): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('reader-font-size', prefs.fontSize);
    localStorage.setItem('reader-dark-mode', String(prefs.darkMode));
  } catch {
    // storage unavailable — silently ignore
  }
}
