// Quote-card background sources for the mobile ShareSheet.
//
// Two background sources ship today (both OTA-safe, pure JS):
//   • 'default' — the existing gradient style (no image)
//   • 'preset'  — one of the 18 curated Noetia gallery images
//
// Preset images are served statically by the web app at
// `${WEB_URL}/backgrounds/imagen-N.jpg`. image-gen accepts `bgImage` as a URL
// and fetches it server-side, so the device only needs the URL — no download or
// base64 encoding. Camera capture / gallery upload (which require a local image
// to be base64-encoded, and the native expo-image-picker module) are a separate
// task gated on a full eas build.

export type Platform = 'instagram' | 'facebook' | 'linkedin' | 'pinterest';

// Web root that serves the static /backgrounds assets. Derived from the API URL
// by stripping a trailing `/api` (prod: https://noetia.app/api → https://noetia.app).
// In local dev set EXPO_PUBLIC_WEB_URL (e.g. http://localhost:3000) since the API
// and web run on different ports.
export const WEB_URL: string =
  process.env.EXPO_PUBLIC_WEB_URL ??
  (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/api\/?$/, '');

export const BG_PRESET_COUNT = 18;

// Absolute URLs for the 18 Noetia gallery backgrounds.
export const BG_PRESETS: readonly string[] = Array.from(
  { length: BG_PRESET_COUNT },
  (_, i) => `${WEB_URL}/backgrounds/imagen-${i + 1}.jpg`,
);

export const SHARE_FORMAT: Record<Platform, string> = {
  instagram: 'ig-post',
  facebook: 'fb-post',
  linkedin: 'li-post',
  pinterest: 'pin-post',
};

// Default (non-image) style — the gradient the ShareSheet has always used.
export const DEFAULT_STYLE = {
  font: 'playfair',
  bgType: 'gradient' as const,
  bgColors: ['#0D1B2A', '#1E3A5F'],
  textColor: '#FFFFFF',
};

export interface BgSelection {
  /** 'default' = gradient, 'preset' = a Noetia gallery image. */
  type: 'default' | 'preset';
  /** Preset URL, required when type === 'preset'. */
  presetUrl?: string;
  /** Mirror the background horizontally — image backgrounds only. */
  flip?: boolean;
}

/**
 * Build the POST body for `/fragments/:id/share`.
 *
 * For an image (preset) background it sends `bgType: 'image'`, the preset URL as
 * `bgImage`, and `bgFlip: true` only when the mirror toggle is on. A missing or
 * empty preset URL falls back to the default gradient (never emits a broken
 * image payload). `flip` is ignored for the default background (no-op).
 */
export function buildSharePayload(
  platform: Platform,
  bg: BgSelection,
): Record<string, unknown> {
  const base = {
    platform,
    format: SHARE_FORMAT[platform],
    font: DEFAULT_STYLE.font,
  };

  if (bg.type === 'preset' && bg.presetUrl) {
    return {
      ...base,
      bgType: 'image',
      bgImage: bg.presetUrl,
      ...(bg.flip ? { bgFlip: true } : {}),
    };
  }

  return { ...base, ...DEFAULT_STYLE };
}
