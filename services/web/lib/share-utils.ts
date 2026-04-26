import { apiFetch } from './api';

export type SharePlatform = 'linkedin' | 'instagram' | 'facebook' | 'whatsapp';
export type ShareFormat = 'ig-post' | 'ig-story' | 'fb-post' | 'fb-story' | 'li-post' | 'wa';

export const FORMAT_PLATFORM_MAP: Record<ShareFormat, { platform: SharePlatform; format: string }> = {
  'ig-post':  { platform: 'instagram', format: 'post' },
  'ig-story': { platform: 'instagram', format: 'story' },
  'fb-post':  { platform: 'facebook',  format: 'post' },
  'fb-story': { platform: 'facebook',  format: 'story' },
  'li-post':  { platform: 'linkedin',  format: 'post' },
  'wa':       { platform: 'whatsapp',  format: 'post' },
};

export const SHARE_FORMAT_LABELS: Record<ShareFormat, string> = {
  'ig-post':  'IG Post',
  'ig-story': 'IG Story',
  'fb-post':  'FB Post',
  'fb-story': 'FB Story',
  'li-post':  'LinkedIn',
  'wa':       'WhatsApp',
};

export interface ShareParams {
  format: ShareFormat;
  font: string;
  bgType: 'solid' | 'gradient';
  bgColors: string[];
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
