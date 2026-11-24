import { createHash } from 'crypto';

/**
 * Route-level throttle for `POST /push/register` (SP-1-I1), using the already-installed @nestjs/throttler.
 *
 * - Keyed to the app's ONLY named throttler, `global` (app.module.ts). Overrides keyed `default` are never read
 *   by ThrottlerGuard v6 when no throttler is named `default`.
 * - Tracked per bearer session, not per IP: until TRUSTED_PROXY_CIDRS is configured the client address is the
 *   proxy's, so an IP-keyed route limit would be shared by every user. The bearer string is hashed and never
 *   stored or logged. Requests without a bearer fall back to the client address (they are rejected by
 *   JwtAuthGuard anyway). A forged bearer only creates its own bucket and still fails authentication.
 */
export const PUSH_REGISTER_THROTTLE = { limit: 10, ttl: 60_000 } as const;

export function pushRegisterTracker(req: { headers?: Record<string, unknown>; ip?: string }): string {
  const auth = req?.headers?.authorization;
  if (typeof auth === 'string' && auth.startsWith('Bearer ') && auth.length > 7) {
    return 'push-register:' + createHash('sha256').update(auth.slice(7)).digest('hex').slice(0, 32);
  }
  return String(req?.ip ?? 'unknown');
}
