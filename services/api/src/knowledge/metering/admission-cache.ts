import Redis from 'ioredis';

/**
 * Rebuildable admission-control cache (ADR-005 B-1). It is NEVER the record of
 * a reservation: it only remembers, briefly, that a scope was found exhausted
 * in the ledger. Keys are namespaced and always expire. When a cache is bound
 * and it is unavailable or errors, admission is DENIED (fail closed).
 */
export interface AdmissionCachePort {
  /** Throws when the cache is unavailable. */
  isExhausted(userId: string, capability: string): Promise<boolean>;
  markExhausted(userId: string, capability: string, ttlSeconds: number): Promise<void>;
  clear(userId: string, capability: string): Promise<void>;
}

export const ADMISSION_CACHE = Symbol('ADMISSION_CACHE');

export const admissionKey = (userId: string, capability: string) =>
  `intelligence:admission:v1:${userId}:${capability}`;

export class RedisAdmissionCache implements AdmissionCachePort {
  constructor(private readonly redis: Pick<Redis, 'get' | 'set' | 'del'>) {}

  async isExhausted(userId: string, capability: string): Promise<boolean> {
    return (await this.redis.get(admissionKey(userId, capability))) === '1';
  }

  async markExhausted(userId: string, capability: string, ttlSeconds: number): Promise<void> {
    await this.redis.set(admissionKey(userId, capability), '1', 'EX', Math.max(1, Math.floor(ttlSeconds)));
  }

  async clear(userId: string, capability: string): Promise<void> {
    await this.redis.del(admissionKey(userId, capability));
  }
}

/** Fails fast instead of queueing commands while disconnected. */
export function createAdmissionRedis(url: string): Redis {
  return new Redis(url, { lazyConnect: true, enableOfflineQueue: false, maxRetriesPerRequest: 1 });
}
