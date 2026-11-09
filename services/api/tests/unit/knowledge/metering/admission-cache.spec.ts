import { admissionKey, createAdmissionRedis, RedisAdmissionCache } from '../../../../src/knowledge/metering/admission-cache';
import { USER_A } from '../support/fixtures';

describe('RedisAdmissionCache (rebuildable, never authority)', () => {
  const redis = { get: jest.fn(), set: jest.fn(), del: jest.fn() };
  const cache = new RedisAdmissionCache(redis as any);
  beforeEach(() => jest.resetAllMocks());

  it('uses namespaced keys', () => {
    expect(admissionKey(USER_A, 'research_session')).toBe(`intelligence:admission:v1:${USER_A}:research_session`);
  });

  it('reports exhausted only for the marker value', async () => {
    redis.get.mockResolvedValueOnce('1').mockResolvedValueOnce(null);
    expect(await cache.isExhausted(USER_A, 'research_session')).toBe(true);
    expect(await cache.isExhausted(USER_A, 'research_session')).toBe(false);
  });

  it('always sets an expiry (at least 1 second)', async () => {
    await cache.markExhausted(USER_A, 'research_session', 0.2);
    expect(redis.set).toHaveBeenCalledWith(admissionKey(USER_A, 'research_session'), '1', 'EX', 1);
  });

  it('clears a key', async () => {
    await cache.clear(USER_A, 'research_session');
    expect(redis.del).toHaveBeenCalledWith(admissionKey(USER_A, 'research_session'));
  });

  it('propagates Redis errors so admission can fail closed', async () => {
    redis.get.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(cache.isExhausted(USER_A, 'x')).rejects.toThrow('ECONNREFUSED');
  });

  it('creates a lazy, fail-fast client (no connection at construction)', () => {
    const client = createAdmissionRedis('redis://127.0.0.1:1');
    expect(client.options.lazyConnect).toBe(true);
    expect(client.options.enableOfflineQueue).toBe(false);
    client.disconnect();
  });
});
