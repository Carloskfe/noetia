import { Test, TestingModule } from '@nestjs/testing';
import { SocialTokenService, SocialTokens } from '../../../src/social/social-token.service';
import { REDIS_TOKEN } from '../../../src/auth/redis.provider';

const mockRedis = () => ({
  set: jest.fn().mockResolvedValue('OK'),
  get: jest.fn().mockResolvedValue(null),
});

const makeTokens = (offsetMs = 60 * 60 * 1000): SocialTokens => ({
  accessToken: 'access-abc',
  refreshToken: 'refresh-xyz',
  expiresAt: Date.now() + offsetMs,
});

describe('SocialTokenService', () => {
  let service: SocialTokenService;
  let redis: ReturnType<typeof mockRedis>;

  beforeEach(async () => {
    redis = mockRedis();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SocialTokenService,
        { provide: REDIS_TOKEN, useValue: redis },
      ],
    }).compile();

    service = module.get<SocialTokenService>(SocialTokenService);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('store', () => {
    it('calls redis.set with encrypted value and positive TTL', async () => {
      const tokens = makeTokens();
      await service.store('user-1', 'linkedin', tokens);
      expect(redis.set).toHaveBeenCalledWith(
        'social:tokens:user-1:linkedin',
        expect.any(String),
        'EX',
        expect.any(Number),
      );
      const [, encrypted, , ttl] = redis.set.mock.calls[0];
      expect(ttl).toBeGreaterThan(0);
      expect(encrypted).toContain(':');
    });

    it('also stores refresh token under :refresh key', async () => {
      const tokens = makeTokens();
      await service.store('user-1', 'linkedin', tokens);
      expect(redis.set).toHaveBeenCalledTimes(2);
      const keys = redis.set.mock.calls.map((c: string[]) => c[0]);
      expect(keys).toContain('social:tokens:user-1:linkedin:refresh');
    });

    it('does not store refresh key when refreshToken is absent', async () => {
      const tokens: SocialTokens = { accessToken: 'acc', expiresAt: Date.now() + 3600000 };
      await service.store('user-1', 'linkedin', tokens);
      expect(redis.set).toHaveBeenCalledTimes(1);
    });
  });

  describe('getToken', () => {
    it('returns null when key is missing in Redis', async () => {
      redis.get.mockResolvedValue(null);
      const result = await service.getToken('user-1', 'linkedin');
      expect(result).toBeNull();
    });

    it('decrypts and returns token on cache hit', async () => {
      const tokens = makeTokens();
      await service.store('user-1', 'linkedin', tokens);
      const encrypted = redis.set.mock.calls[0][1] as string;
      redis.get.mockResolvedValueOnce(encrypted);

      const result = await service.getToken('user-1', 'linkedin');
      expect(result).not.toBeNull();
      expect(result!.accessToken).toBe('access-abc');
    });

    it('encryption round-trips correctly', async () => {
      const tokens = makeTokens();
      await service.store('user-1', 'facebook', tokens);
      const encrypted = redis.set.mock.calls[0][1] as string;
      redis.get.mockResolvedValueOnce(encrypted);

      const result = await service.getToken('user-1', 'facebook');
      expect(result!.accessToken).toBe(tokens.accessToken);
      expect(result!.refreshToken).toBe(tokens.refreshToken);
    });

    it('attempts refresh when token is within 5 min of expiry', async () => {
      const tokens = makeTokens(4 * 60 * 1000);
      await service.store('user-1', 'linkedin', tokens);
      const encrypted = redis.set.mock.calls[0][1] as string;
      redis.get.mockResolvedValueOnce(encrypted);
      redis.get.mockResolvedValueOnce(null);

      const result = await service.getToken('user-1', 'linkedin');
      expect(redis.get).toHaveBeenCalledTimes(2);
      expect(result).not.toBeNull();
    });
  });
});
