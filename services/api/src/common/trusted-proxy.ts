import { isIP } from 'net';

/**
 * G1-I1: which TCP peers may supply the client address through `X-Forwarded-For`
 * (design: docs/reports/payment-lifecycle-20261112/g1-trusted-proxy-correction-design.md §5, §7).
 *
 * Production intent: `TRUSTED_PROXY_CIDRS` holds ONLY the allocation range of the dedicated internal Docker
 * network `noetia_api_edge`, whose only members are Traefik and the API. Express then honours the forwarded
 * client address only for connections from that range; every other peer (web SSR, monitoring, any container on
 * another network) is attributed to its own TCP address, so it cannot choose its rate-limit tracker.
 *
 * A CIDR does not prove identity: trusting a range is safe only while network membership is controlled
 * (exactly Traefik + API, verified at deploy). This parser only refuses values that are obviously unsafe.
 *
 * Fail-safe: anything missing, malformed or too broad disables trust entirely — the behaviour before G1-I1
 * (tracker = immediate peer). Trust is never widened by a fallback.
 */
export type TrustedProxyConfig = { enabled: true; cidrs: string[] } | { enabled: false; reason: string };

export const TRUSTED_PROXY_MIN_PREFIX = { 4: 24, 6: 112 } as const;
export const TRUSTED_PROXY_MAX_ENTRIES = 4;

export function parseTrustedProxyCidrs(raw: string | undefined | null): TrustedProxyConfig {
  if (raw === undefined || raw === null || raw.trim() === '') return { enabled: false, reason: 'TRUSTED_PROXY_CIDRS not set' };
  const entries = raw.split(',').map((s) => s.trim());
  if (entries.some((e) => e === '')) return { enabled: false, reason: 'empty entry in TRUSTED_PROXY_CIDRS' };
  if (entries.length > TRUSTED_PROXY_MAX_ENTRIES) {
    return { enabled: false, reason: `more than ${TRUSTED_PROXY_MAX_ENTRIES} entries in TRUSTED_PROXY_CIDRS` };
  }
  for (const entry of entries) {
    // Explicit `address/prefix` only. Rejects Express keywords (loopback, linklocal, uniquelocal), `true`,
    // hop counts, bare addresses and netmask notation.
    const m = /^([0-9A-Fa-f:.]+)\/(\d{1,3})$/.exec(entry);
    const family = m ? isIP(m[1]) : 0;
    if (!m || (family !== 4 && family !== 6)) return { enabled: false, reason: `not an explicit IPv4/IPv6 CIDR: "${entry}"` };
    const prefix = Number(m[2]);
    const max = family === 4 ? 32 : 128;
    if (prefix > max) return { enabled: false, reason: `invalid prefix length: "${entry}"` };
    if (prefix < TRUSTED_PROXY_MIN_PREFIX[family]) {
      return { enabled: false, reason: `range too broad (minimum /${TRUSTED_PROXY_MIN_PREFIX[family]}): "${entry}"` };
    }
    if (family === 6 && m[1].includes('.')) return { enabled: false, reason: `IPv4-in-IPv6 notation not accepted: "${entry}"` };
  }
  return { enabled: true, cidrs: entries };
}

export interface TrustSettable {
  set(setting: string, value: unknown): unknown;
}
export interface TrustLogger {
  log(message: string): void;
  warn(message: string): void;
}

/**
 * Applies the parsed configuration to the Express application (NestExpressApplication.set → Express app.set).
 * Never throws: if Express rejects the value, trust stays disabled. Returns the effective configuration.
 */
export function applyTrustedProxy(app: TrustSettable, raw: string | undefined | null, logger: TrustLogger): TrustedProxyConfig {
  const parsed = parseTrustedProxyCidrs(raw);
  if (!parsed.enabled) {
    const unset = raw === undefined || raw === null || raw.trim() === '';
    const message = `[trusted-proxy] disabled (${parsed.reason}); client address = immediate TCP peer`;
    if (unset) logger.log(message);
    else logger.warn(message);
    return parsed;
  }
  try {
    app.set('trust proxy', parsed.cidrs);
  } catch {
    logger.warn('[trusted-proxy] disabled (value rejected by Express); client address = immediate TCP peer');
    return { enabled: false, reason: 'rejected by Express' };
  }
  logger.log(`[trusted-proxy] X-Forwarded-For honoured only from ${parsed.cidrs.join(', ')}`);
  return parsed;
}
