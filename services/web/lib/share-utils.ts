import { apiFetch } from './api';

// ── Font registry (shared with image-gen VALID_FONTS) ─────────────────────────

export interface FontDef {
  id: string;
  label: string;
  css: string;
}

export const FONTS: readonly FontDef[] = [
  { id: 'lato',          label: 'Lato',            css: "'Lato', sans-serif" },
  { id: 'playfair',      label: 'Playfair Display', css: "'Playfair Display', serif" },
  { id: 'lora',          label: 'Lora',             css: "'Lora', serif" },
  { id: 'merriweather',  label: 'Merriweather',     css: "'Merriweather', serif" },
  { id: 'dancing',       label: 'Dancing Script',   css: "'Dancing Script', cursive" },
  { id: 'montserrat',    label: 'Montserrat',       css: "'Montserrat', sans-serif" },
  { id: 'raleway',       label: 'Raleway',          css: "'Raleway', sans-serif" },
] as const;

export type FontId = (typeof FONTS)[number]['id'];

export const GOOGLE_FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Lato&family=Playfair+Display&family=Lora&family=Merriweather&family=Dancing+Script&family=Montserrat&family=Raleway&display=swap';

// ─────────────────────────────────────────────────────────────────────────────

export type SharePlatform = 'linkedin' | 'instagram' | 'facebook' | 'whatsapp';
export type ShareFormat =
  | 'ig-post' | 'ig-story'
  | 'fb-post' | 'fb-story'
  | 'li-post'
  | 'wa-pic' | 'wa-story'
  | 'reel'
  | 'twitter-card';

export const FORMAT_PLATFORM_MAP: Record<ShareFormat, { platform: SharePlatform; format: string }> = {
  'ig-post':      { platform: 'instagram', format: 'post' },
  'ig-story':     { platform: 'instagram', format: 'story' },
  'fb-post':      { platform: 'facebook',  format: 'post' },
  'fb-story':     { platform: 'facebook',  format: 'story' },
  'li-post':      { platform: 'linkedin',  format: 'post' },
  'wa-pic':       { platform: 'whatsapp',  format: 'wa-pic' },
  'wa-story':     { platform: 'whatsapp',  format: 'wa-story' },
  'reel':         { platform: 'instagram', format: 'reel' },
  'twitter-card': { platform: 'linkedin',  format: 'twitter-card' },
};

export const SHARE_FORMAT_LABELS: Record<ShareFormat, string> = {
  'ig-post':      'IG Post',
  'ig-story':     'IG Story',
  'fb-post':      'FB Post',
  'fb-story':     'FB Story',
  'li-post':      'LinkedIn',
  'wa-pic':       'WA Pic',
  'wa-story':     'WA Story',
  'reel':         'Reel',
  'twitter-card': 'Twitter/X',
};

export interface ShareParams {
  format: ShareFormat;
  font: string;
  bgType: 'solid' | 'gradient';
  bgColors: string[];
  textColor?: string;
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
      ...(params.textColor ? { textColor: params.textColor } : {}),
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
