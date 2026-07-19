export type FontSize = 'sm' | 'md' | 'lg' | 'xl';
/** How the text column is laid out: continuous scroll, or discrete pages. */
export type ReadingLayout = 'scroll' | 'paged';

export interface ReaderPreferences {
  fontSize: FontSize;
  darkMode: boolean;
  /** Last-used audio playback speed, restored across sessions. */
  speed: number;
  readingLayout: ReadingLayout;
}

export const FONT_SIZES: FontSize[] = ['sm', 'md', 'lg', 'xl'];
export const READING_LAYOUTS: ReadingLayout[] = ['scroll', 'paged'];
export const SPEEDS = [0.75, 1, 1.25, 1.5, 2] as const;

// Paged ("page") view is the standard reading layout. A reader who switches to
// scroll has their choice remembered (localStorage 'reader-layout'), which wins
// over this default. Paged only engages for synced books; others fall back to
// scroll rendering regardless.
const DEFAULTS: ReaderPreferences = { fontSize: 'md', darkMode: false, speed: 1, readingLayout: 'paged' };

export function loadPreferences(): ReaderPreferences {
  if (typeof window === 'undefined') return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem('reader-font-size') as FontSize | null;
    const fontSize: FontSize = raw && FONT_SIZES.includes(raw) ? raw : DEFAULTS.fontSize;
    const darkMode = localStorage.getItem('reader-dark-mode') === 'true';
    const parsedSpeed = parseFloat(localStorage.getItem('reader-speed') ?? '');
    const speed = (SPEEDS as readonly number[]).includes(parsedSpeed) ? parsedSpeed : DEFAULTS.speed;
    const rawLayout = localStorage.getItem('reader-layout') as ReadingLayout | null;
    const readingLayout: ReadingLayout = rawLayout && READING_LAYOUTS.includes(rawLayout) ? rawLayout : DEFAULTS.readingLayout;
    return { fontSize, darkMode, speed, readingLayout };
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
    localStorage.setItem('reader-layout', prefs.readingLayout);
  } catch {
    // storage unavailable — silently ignore
  }
}
