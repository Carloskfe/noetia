import { apiFetch } from './api';

// ── Font registry (shared with image-gen VALID_FONTS) ─────────────────────────

export interface FontDef {
  id: string;
  label: string;
  css: string;
}

export const FONTS: readonly FontDef[] = [
  { id: 'playfair',    label: 'Playfair Display', css: "'Playfair Display', serif" },
  { id: 'montserrat',  label: 'Montserrat',       css: "'Montserrat', sans-serif" },
  { id: 'merriweather',label: 'Merriweather',     css: "'Merriweather', serif" },
  { id: 'oswald',      label: 'Oswald',           css: "'Oswald', sans-serif" },
  { id: 'baskerville', label: 'Libre Baskerville', css: "'Libre Baskerville', serif" },
  { id: 'dancing',     label: 'Dancing Script',   css: "'Dancing Script', cursive" },
  { id: 'pacifico',    label: 'Pacifico',         css: "'Pacifico', cursive" },
] as const;

export type FontId = (typeof FONTS)[number]['id'];

export const GOOGLE_FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Playfair+Display&family=Montserrat&family=Merriweather&family=Oswald&family=Libre+Baskerville&family=Dancing+Script&family=Pacifico&display=swap';

// ── Noetia background image gallery ───────────────────────────────────────────
// 18 curated Noetia-provided backgrounds served statically from web/public.
// Offered in the quote-card picker alongside a solid background and the user's
// own camera/uploaded images. Selecting one is fetched + base64-encoded client
// side (see ShareModal urlToBase64) before it's sent to image-gen.
export const BG_PRESETS: readonly string[] = [
  '/backgrounds/imagen-1.jpg',
  '/backgrounds/imagen-2.jpg',
  '/backgrounds/imagen-3.jpg',
  '/backgrounds/imagen-4.jpg',
  '/backgrounds/imagen-5.jpg',
  '/backgrounds/imagen-6.jpg',
  '/backgrounds/imagen-7.jpg',
  '/backgrounds/imagen-8.jpg',
  '/backgrounds/imagen-9.jpg',
  '/backgrounds/imagen-10.jpg',
  '/backgrounds/imagen-11.jpg',
  '/backgrounds/imagen-12.jpg',
  '/backgrounds/imagen-13.jpg',
  '/backgrounds/imagen-14.jpg',
  '/backgrounds/imagen-15.jpg',
  '/backgrounds/imagen-16.jpg',
  '/backgrounds/imagen-17.jpg',
  '/backgrounds/imagen-18.jpg',
] as const;

// ─────────────────────────────────────────────────────────────────────────────

export type SharePlatform = 'linkedin' | 'instagram' | 'facebook' | 'pinterest';
export type ShareFormat =
  | 'ig-post' | 'ig-story' | 'reel'
  | 'fb-post' | 'fb-story'
  | 'li-post'
  | 'pin-post' | 'pin-square';

export const FORMAT_PLATFORM_MAP: Record<ShareFormat, { platform: SharePlatform; format: string }> = {
  'ig-post':    { platform: 'instagram', format: 'post' },
  'ig-story':   { platform: 'instagram', format: 'story' },
  'reel':       { platform: 'instagram', format: 'reel' },
  'fb-post':    { platform: 'facebook',  format: 'post' },
  'fb-story':   { platform: 'facebook',  format: 'story' },
  'li-post':    { platform: 'linkedin',  format: 'post' },
  'pin-post':   { platform: 'pinterest', format: 'pin' },
  'pin-square': { platform: 'pinterest', format: 'pin-square' },
};

export const SHARE_FORMAT_LABELS: Record<ShareFormat, string> = {
  'ig-post':    'IG Post',
  'ig-story':   'IG Story',
  'reel':       'IG Reel',
  'fb-post':    'FB Post',
  'fb-story':   'FB Story',
  'li-post':    'LinkedIn Post',
  'pin-post':   'Pinterest Pin',
  'pin-square': 'Pinterest Sq.',
};

export interface ShareParams {
  format: ShareFormat;
  font: string;
  bgType: 'solid' | 'gradient' | 'image';
  bgColors: string[];
  textColor?: string;
  text?: string;
  citation?: string;
  textBold?: boolean;
  textItalic?: boolean;
  gradientDir?: string;
  bgImage?: string;
  bgFlip?: boolean;
}

export async function shareFragment(fragmentId: string, params: ShareParams): Promise<string> {
  const { platform, format } = FORMAT_PLATFORM_MAP[params.format];
  const data = await apiFetch(`/fragments/${fragmentId}/share`, {
    method: 'POST',
    body: JSON.stringify({
      platform,
      format,
      font: params.font,
      bgType: params.bgType,
      bgColors: params.bgColors,
      ...(params.textColor   ? { textColor:   params.textColor }   : {}),
      ...(params.text        ? { text:        params.text }        : {}),
      ...(params.citation    ? { citation:    params.citation }    : {}),
      ...(params.textBold    ? { textBold:    true }               : {}),
      ...(params.textItalic  ? { textItalic:  true }               : {}),
      ...(params.gradientDir ? { gradientDir: params.gradientDir } : {}),
      ...(params.bgImage     ? { bgImage:     params.bgImage }     : {}),
      ...(params.bgFlip      ? { bgFlip:      true }               : {}),
    }),
  });
  return data.url as string;
}

export async function copyToClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

export function getLuminance(hex: string): number {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function getTextColor(bgColors: string[]): string {
  const avg = bgColors.reduce(
    (acc, hex) => {
      const lum = getLuminance(hex);
      return acc + lum / bgColors.length;
    },
    0,
  );
  return avg <= 0.179 ? '#FFFFFF' : '#0D1B2A';
}
