import { BadRequestException } from '@nestjs/common';

/** Largest accepted base64 data URI for an uploaded background (~6 MB image). */
export const BG_IMAGE_MAX_CHARS = 8_000_000;
export const BG_PRESET_COUNT = 18;

const DATA_URI_RE = /^data:image\/(?:png|jpe?g|webp);base64,[A-Za-z0-9+/=\r\n]+$/;
const PRESET_PATH_RE = /^\/backgrounds\/imagen-(\d{1,2})\.jpg$/;

/** Built-in preset hosts: https only, and image-gen requires public addresses. */
export const DEFAULT_BG_HOSTS: ReadonlySet<string> = new Set(['noetia.app', 'staging.noetia.app']);

/**
 * Hosts added via SHARE_BG_ALLOWED_HOSTS (comma-separated) — local development
 * only, e.g. a LAN IP for the mobile app. image-gen reads the same variable from
 * the shared .env, so both sides accept exactly the same hosts. An empty or
 * unset variable adds nothing (fail closed).
 */
export function configuredBackgroundHosts(env: NodeJS.ProcessEnv = process.env): Set<string> {
  const hosts = new Set<string>();
  for (const h of (env.SHARE_BG_ALLOWED_HOSTS ?? '').split(',')) {
    if (h.trim()) hosts.add(h.trim().toLowerCase());
  }
  return hosts;
}

/**
 * NEM-016 S12: the image renderer must never fetch an arbitrary URL. A card
 * background is accepted only as
 *  - an inline base64 image (png / jpeg / webp) — web presets and uploads, or
 *  - one of the 18 Noetia preset images, `/backgrounds/imagen-N.jpg`, on
 *    https://noetia.app or https://staging.noetia.app, or on a host listed in
 *    SHARE_BG_ALLOWED_HOSTS (dev). Mobile sends absolute preset URLs.
 * image-gen applies the same rules again and additionally checks DNS answers
 * (public addresses only), pins the connection and refuses redirects.
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
  const host = url.hostname.toLowerCase();
  const configured = configuredBackgroundHosts(env).has(host);
  // Built-in hosts must use https; plain http only for explicitly configured dev hosts.
  if (!configured && !(DEFAULT_BG_HOSTS.has(host) && url.protocol === 'https:')) throw reject();
  const m = PRESET_PATH_RE.exec(url.pathname);
  const n = m ? parseInt(m[1], 10) : 0;
  if (n < 1 || n > BG_PRESET_COUNT) throw reject();
  return `${url.protocol}//${url.host}/backgrounds/imagen-${n}.jpg`;
}
