import { HttpException } from '@nestjs/common';
import { ShareRateLimiter, SHARE_CREATE_LIMIT, SOCIAL_PUBLISH_LIMIT } from '../../../src/sharing/share-rate-limiter';

describe('ShareRateLimiter', () => {
  const redis = { incr: jest.fn(), expire: jest.fn() };
  const limiter = new ShareRateLimiter(redis as never);
  const rule = { limit: 2, windowSeconds: 60 };

  beforeEach(() => jest.clearAllMocks());

  it('allows requests up to the limit and sets the window expiry on the first hit', async () => {
    redis.incr.mockResolvedValueOnce(1).mockResolvedValueOnce(2);
    await limiter.consume('share_create', 'u1', rule);
    await limiter.consume('share_create', 'u1', rule);
    expect(redis.expire).toHaveBeenCalledTimes(1);
    expect(redis.incr.mock.calls[0][0]).toMatch(/^ratelimit:share_create:u1:\d+$/);
  });

  it('throws 429 rate_limited once the limit is exceeded', async () => {
    redis.incr.mockResolvedValue(3);
    await expect(limiter.consume('share_create', 'u1', rule)).rejects.toMatchObject({
      constructor: HttpException,
      status: 429,
      response: { error: 'rate_limited', action: 'share_create' },
    });
  });

  it('keys limits per user so one reader cannot exhaust another\'s quota', async () => {
    redis.incr.mockResolvedValue(1);
    await limiter.consume('social_publish', 'u1', rule);
    await limiter.consume('social_publish', 'u2', rule);
    expect(redis.incr.mock.calls[0][0]).toContain(':u1:');
    expect(redis.incr.mock.calls[1][0]).toContain(':u2:');
  });

  it('fails open when Redis is unavailable', async () => {
    redis.incr.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(limiter.consume('share_create', 'u1', rule)).resolves.toBeUndefined();
  });

  it('exposes the configured limits', () => {
    expect(SHARE_CREATE_LIMIT).toEqual({ limit: 20, windowSeconds: 600 });
    expect(SOCIAL_PUBLISH_LIMIT).toEqual({ limit: 10, windowSeconds: 600 });
  });
});
