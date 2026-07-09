export type FontSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ReaderPreferences {
  fontSize: FontSize;
  darkMode: boolean;
  /** Last-used audio playback speed, restored across sessions. */
  speed: number;
}

export const FONT_SIZES: FontSize[] = ['sm', 'md', 'lg', 'xl'];
export const SPEEDS = [0.75, 1, 1.25, 1.5, 2] as const;

const DEFAULTS: ReaderPreferences = { fontSize: 'md', darkMode: false, speed: 1 };

export function loadPreferences(): ReaderPreferences {
  if (typeof window === 'undefined') return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem('reader-font-size') as FontSize | null;
    const fontSize: FontSize = raw && FONT_SIZES.includes(raw) ? raw : DEFAULTS.fontSize;
    const darkMode = localStorage.getItem('reader-dark-mode') === 'true';
    const parsedSpeed = parseFloat(localStorage.getItem('reader-speed') ?? '');
    const speed = (SPEEDS as readonly number[]).includes(parsedSpeed) ? parsedSpeed : DEFAULTS.speed;
    return { fontSize, darkMode, speed };
  } catch {
    return { ...DEFAULTS };
  }
}

export function savePreferences(prefs: ReaderPreferences): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('reader-font-size', prefs.fontSize);
    localStorage.setItem('reader-dark-mode', String(prefs.darkMode));
    localStorage.setItem('reader-speed', String(prefs.speed));
  } catch {
    // storage unavailable — silently ignore
  }
}
