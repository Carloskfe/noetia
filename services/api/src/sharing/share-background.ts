import { BadRequestException } from '@nestjs/common';

/** Largest accepted base64 data URI for an uploaded background (~6 MB image). */
export const BG_IMAGE_MAX_CHARS = 8_000_000;
export const BG_PRESET_COUNT = 18;

const DATA_URI_RE = /^data:image\/(?:png|jpe?g|webp);base64,[A-Za-z0-9+/=\r\n]+$/;
const PRESET_PATH_RE = /^\/backgrounds\/imagen-(\d{1,2})\.jpg$/;

/**
 * Hosts allowed to serve preset backgrounds: the web app (WEB_URL), production
 * and staging, plus SHARE_BG_ALLOWED_HOSTS (comma-separated; e.g. a LAN IP for
 * local mobile development).
 */
export function allowedBackgroundHosts(env: NodeJS.ProcessEnv = process.env): Set<string> {
  const hosts = new Set(['noetia.app', 'staging.noetia.app']);
  try {
    if (env.WEB_URL) hosts.add(new URL(env.WEB_URL).hostname);
  } catch {
    /* ignore a malformed WEB_URL */
  }
  for (const h of (env.SHARE_BG_ALLOWED_HOSTS ?? '').split(',')) {
    if (h.trim()) hosts.add(h.trim().toLowerCase());
  }
  return hosts;
}

/**
 * NEM-016 S12: the image renderer must never fetch an arbitrary URL. A card
 * background is accepted only as
 *  - an inline base64 image (png / jpeg / webp) — web presets and uploads, or
 *  - one of the 18 Noetia preset images, `/backgrounds/imagen-N.jpg`, served by
 *    an allowed host (mobile sends absolute preset URLs).
 * Anything else is rejected with 400 `unsupported_background_image`.
 */
export function resolveBackgroundImage(
  bgImage: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  if (!bgImage) return undefined;
  const reject = () => new BadRequestException({ error: 'unsupported_background_image' });

  if (bgImage.startsWith('data:')) {
    if (bgImage.length > BG_IMAGE_MAX_CHARS || !DATA_URI_RE.test(bgImage)) throw reject();
    return bgImage;
  }

  let url: URL;
  try {
    url = new URL(bgImage);
  } catch {
    throw reject();
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw reject();
  if (url.username || url.password || url.search || url.hash) throw reject();
  if (!allowedBackgroundHosts(env).has(url.hostname.toLowerCase())) throw reject();
  const m = PRESET_PATH_RE.exec(url.pathname);
  const n = m ? parseInt(m[1], 10) : 0;
  if (n < 1 || n > BG_PRESET_COUNT) throw reject();
  return `${url.protocol}//${url.host}/backgrounds/imagen-${n}.jpg`;
}
