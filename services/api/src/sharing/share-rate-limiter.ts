import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { InjectRedis } from '../auth/redis.provider';

export interface RateLimitRule {
  limit: number;
  windowSeconds: number;
}

/** New quote-card renders per user (re-used shares don't count). */
export const SHARE_CREATE_LIMIT: RateLimitRule = { limit: 20, windowSeconds: 600 };
/** Server-side social publishes per user. */
export const SOCIAL_PUBLISH_LIMIT: RateLimitRule = { limit: 10, windowSeconds: 600 };

/**
 * Per-user fixed-window limiter in Redis (NEM-016 S8/S15).
 *
 * Keyed by user id rather than IP: the API sits behind Traefik without
 * `trust proxy`, so request IPs aren't per-client. Fails open if Redis is
 * unavailable so a cache outage never blocks sharing.
 */
@Injectable()
export class ShareRateLimiter {
  private readonly logger = new Logger(ShareRateLimiter.name);

  constructor(@InjectRedis() private readonly redis: Redis) {}

  async consume(action: string, userId: string, rule: RateLimitRule): Promise<void> {
    const windowId = Math.floor(Date.now() / 1000 / rule.windowSeconds);
    const key = `ratelimit:${action}:${userId}:${windowId}`;
    let count: number;
    try {
      count = await this.redis.incr(key);
      if (count === 1) await this.redis.expire(key, rule.windowSeconds);
    } catch {
      this.logger.warn(`rate limiter unavailable for ${action}; allowing request`);
      return;
    }
    if (count > rule.limit) {
      throw new HttpException({ error: 'rate_limited', action }, HttpStatus.TOO_MANY_REQUESTS);
    }
  }
}
