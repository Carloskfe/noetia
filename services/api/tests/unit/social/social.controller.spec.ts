import {
  BadGatewayException,
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { SocialController } from '../../../src/social/social.controller';
import { SocialTokenService } from '../../../src/social/social-token.service';
import { REDIS_TOKEN } from '../../../src/auth/redis.provider';
import { JwtAuthGuard } from '../../../src/auth/jwt-auth.guard';
import { LinkedInPublisher } from '../../../src/social/publishers/linkedin.publisher';
import { FacebookPublisher } from '../../../src/social/publishers/facebook.publisher';
import { InstagramPublisher } from '../../../src/social/publishers/instagram.publisher';
import { PinterestPublisher } from '../../../src/social/publishers/pinterest.publisher';
import { cardImageOrigin } from '../../../src/social/social.controller';
import { Share } from '../../../src/sharing/share.entity';
import { StorageService } from '../../../src/storage/storage.service';
import { ShareRateLimiter } from '../../../src/sharing/share-rate-limiter';

const mockTokenService = () => ({
  store: jest.fn(),
  getToken: jest.fn(),
});

const mockRedis = () => ({
  set: jest.fn().mockResolvedValue('OK'),
  get: jest.fn().mockResolvedValue(null),
  del: jest.fn().mockResolvedValue(1),
});

const mockRes = () => {
  const res: any = {};
  res.redirect = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.status = jest.fn().mockReturnValue(res);
  return res;
};

const mockUser = { user: { id: 'user-1' } };
const CARD_KEY = '11111111-2222-4333-8444-555555555555.png';
const FAKE_IMG_URL = `http://storage:9000/images/${CARD_KEY}`; // MINIO_PUBLIC_URL unset in tests
const PNG_BYTES = Buffer.from('\x89PNG\r\n\x1a\n' + '\x00'.repeat(100));

describe('SocialController', () => {
  let controller: SocialController;
  let tokenService: ReturnType<typeof mockTokenService>;
  let redis: ReturnType<typeof mockRedis>;
  const shareRepo = { findOneBy: jest.fn() };
  const storage = { getBuffer: jest.fn() };
  const limiter = { consume: jest.fn() };

  beforeEach(async () => {
    tokenService = mockTokenService();
    redis = mockRedis();
    delete process.env.MINIO_PUBLIC_URL;
    shareRepo.findOneBy.mockReset().mockResolvedValue({ id: 's1', imageUrl: FAKE_IMG_URL, createdById: 'user-1' });
    storage.getBuffer.mockReset().mockResolvedValue(PNG_BYTES);
    limiter.consume.mockReset().mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SocialController],
      providers: [
        { provide: SocialTokenService, useValue: tokenService },
        { provide: REDIS_TOKEN, useValue: redis },
        { provide: getRepositoryToken(Share), useValue: shareRepo },
        { provide: StorageService, useValue: storage },
        { provide: ShareRateLimiter, useValue: limiter },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<SocialController>(SocialController);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('connect', () => {
    it('redirects to LinkedIn OAuth URL', async () => {
      const res = mockRes();
      redis.set.mockResolvedValue('OK');
      await controller.connect('linkedin', mockUser as any, res);
      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining('linkedin.com/oauth'),
      );
    });

    it('redirects to Facebook OAuth URL', async () => {
      const res = mockRes();
      await controller.connect('facebook', mockUser as any, res);
      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining('facebook.com'),
      );
    });

    it('redirects to Pinterest OAuth URL', async () => {
      const res = mockRes();
      await controller.connect('pinterest', mockUser as any, res);
      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining('pinterest.com'),
      );
    });

    it('stores CSRF state in Redis', async () => {
      const res = mockRes();
      await controller.connect('linkedin', mockUser as any, res);
      expect(redis.set).toHaveBeenCalledWith(
        expect.stringContaining('oauth:state:'),
        'user-1',
        'EX',
        600,
      );
    });

    it('uses API_URL env var (not API_BASE_URL) for redirect_uri', async () => {
      process.env.API_URL = 'http://api.example.com:4000';
      const res = mockRes();
      await controller.connect('linkedin', mockUser as any, res);
      const redirectUrl: string = res.redirect.mock.calls[0][0];
      expect(redirectUrl).toContain(encodeURIComponent('http://api.example.com:4000/social/linkedin/callback'));
      delete process.env.API_URL;
    });
  });

  describe('callback', () => {
    const validState = 'abc123';

    beforeEach(() => {
      redis.get.mockResolvedValueOnce('user-1');
    });

    it('stores token and returns close-popup HTML on success', async () => {
      const res = mockRes();
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'acc', expires_in: 3600 }),
      } as Response);
      tokenService.store.mockResolvedValue(undefined);

      await controller.callback('linkedin', 'auth-code', validState, undefined, res);

      expect(tokenService.store).toHaveBeenCalledWith('user-1', 'linkedin', expect.objectContaining({ accessToken: 'acc' }));
      expect(res.send).toHaveBeenCalledWith(expect.stringContaining('window.close'));
    });

    it('rejects mismatched state with 400', async () => {
      redis.get.mockReset();
      redis.get.mockResolvedValueOnce(null);
      const res = mockRes();
      await controller.callback('linkedin', 'auth-code', 'bad-state', undefined, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('handles ?error=access_denied without storing token', async () => {
      const res = mockRes();
      await controller.callback('linkedin', undefined, validState, 'access_denied', res);
      expect(tokenService.store).not.toHaveBeenCalled();
      expect(res.send).toHaveBeenCalledWith(expect.stringContaining('window.close'));
    });
  });

  describe('publish', () => {
    beforeEach(() => {
      // Publishing must never fetch the caller-supplied URL (S13).
      global.fetch = jest.fn().mockRejectedValue(new Error('fetch must not be called'));
    });

    const connected = () =>
      tokenService.getToken.mockResolvedValue({ accessToken: 'tok', expiresAt: Date.now() + 3600000 });

    it.each([
      'http://api:4000/health',
      'http://169.254.169.254/latest/meta-data/',
      'https://evil.example/images/' + CARD_KEY,
      'http://storage:9000/books/' + CARD_KEY,
      'http://storage:9000/images/not-a-card.png',
      'http://storage:9000/images/' + CARD_KEY + '?x=1',
    ])('rejects untrusted image source %s with 400 and fetches nothing', async (url) => {
      connected();
      await expect(controller.publish('linkedin', url, undefined, mockUser as any)).rejects.toThrow(BadRequestException);
      expect(global.fetch).not.toHaveBeenCalled();
      expect(storage.getBuffer).not.toHaveBeenCalled();
    });

    it('rejects a non-string imageUrl', async () => {
      connected();
      await expect(controller.publish('linkedin', { evil: 1 } as any, undefined, mockUser as any)).rejects.toThrow(BadRequestException);
    });

    it("404s when the card isn't one of the caller's live shares (other user's or revoked)", async () => {
      connected();
      shareRepo.findOneBy.mockResolvedValue(null);
      await expect(controller.publish('linkedin', FAKE_IMG_URL, undefined, mockUser as any)).rejects.toThrow(NotFoundException);
      const where = shareRepo.findOneBy.mock.calls[0][0];
      expect(where).toMatchObject({ imageUrl: FAKE_IMG_URL, createdById: 'user-1' });
      expect(where.revokedAt).toBeDefined();
    });

    it('reads the image bytes from storage, not over HTTP', async () => {
      connected();
      const spy = jest.spyOn(LinkedInPublisher, 'publish').mockResolvedValue('https://www.linkedin.com/feed/update/1');
      await controller.publish('linkedin', FAKE_IMG_URL, 'c', mockUser as any);
      expect(storage.getBuffer).toHaveBeenCalledWith('images', CARD_KEY);
      expect(spy).toHaveBeenCalledWith('tok', PNG_BYTES, 'c');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('applies the per-user publish rate limit', async () => {
      connected();
      limiter.consume.mockRejectedValue(Object.assign(new Error('rate'), { status: 429 }));
      await expect(controller.publish('linkedin', FAKE_IMG_URL, undefined, mockUser as any)).rejects.toMatchObject({ status: 429 });
      expect(limiter.consume).toHaveBeenCalledWith('social_publish', 'user-1', expect.objectContaining({ limit: 10 }));
      expect(storage.getBuffer).not.toHaveBeenCalled();
    });

    it('returns 502 when the stored image cannot be read', async () => {
      connected();
      storage.getBuffer.mockRejectedValue(new Error('NoSuchKey'));
      await expect(controller.publish('linkedin', FAKE_IMG_URL, undefined, mockUser as any)).rejects.toThrow(BadGatewayException);
    });

    it('accepts images on the configured public origin (MINIO_PUBLIC_URL)', async () => {
      process.env.MINIO_PUBLIC_URL = 'https://storage.noetia.app/';
      const url = `https://storage.noetia.app/images/${CARD_KEY}`;
      shareRepo.findOneBy.mockResolvedValue({ id: 's1', imageUrl: url, createdById: 'user-1' });
      connected();
      jest.spyOn(FacebookPublisher, 'publish').mockResolvedValue('https://www.facebook.com/1');
      await expect(controller.publish('facebook', url, undefined, mockUser as any)).resolves.toEqual({ postUrl: 'https://www.facebook.com/1' });
      expect(cardImageOrigin()).toBe('https://storage.noetia.app');
      delete process.env.MINIO_PUBLIC_URL;
    });

    it('rejects unsupported platforms', async () => {
      connected();
      await expect(controller.publish('myspace', FAKE_IMG_URL, undefined, mockUser as any)).rejects.toThrow(BadRequestException);
    });

    it('returns 401 when account is not connected', async () => {
      tokenService.getToken.mockResolvedValue(null);
      await expect(
        controller.publish('linkedin', FAKE_IMG_URL, undefined, mockUser as any),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('returns postUrl on successful LinkedIn publish', async () => {
      tokenService.getToken.mockResolvedValue({ accessToken: 'tok', expiresAt: Date.now() + 3600000 });
      jest.spyOn(LinkedInPublisher, 'publish').mockResolvedValue('https://www.linkedin.com/feed/update/123');

      const result = await controller.publish('linkedin', FAKE_IMG_URL, 'caption', mockUser as any);
      expect(result).toEqual({ postUrl: 'https://www.linkedin.com/feed/update/123' });
    });

    it('returns 502 on platform API error', async () => {
      tokenService.getToken.mockResolvedValue({ accessToken: 'tok', expiresAt: Date.now() + 3600000 });
      jest.spyOn(LinkedInPublisher, 'publish').mockRejectedValue(new BadGatewayException('platform_publish_failed'));

      await expect(
        controller.publish('linkedin', FAKE_IMG_URL, undefined, mockUser as any),
      ).rejects.toThrow(BadGatewayException);
    });

    it('returns postUrl on successful Pinterest publish', async () => {
      tokenService.getToken.mockResolvedValue({ accessToken: 'tok', expiresAt: Date.now() + 3600000 });
      jest.spyOn(PinterestPublisher, 'publish').mockResolvedValue('https://www.pinterest.com/pin/123');

      const result = await controller.publish('pinterest', FAKE_IMG_URL, 'caption', mockUser as any);
      expect(result).toEqual({ postUrl: 'https://www.pinterest.com/pin/123' });
    });

    it('returns 503 for Instagram when INSTAGRAM_PUBLISH_ENABLED=false', async () => {
      process.env.INSTAGRAM_PUBLISH_ENABLED = 'false';
      tokenService.getToken.mockResolvedValue({ accessToken: 'tok', expiresAt: Date.now() + 3600000 });
      jest.spyOn(InstagramPublisher, 'publish').mockRejectedValue(
        new ServiceUnavailableException('instagram_publish_unavailable'),
      );

      await expect(
        controller.publish('instagram', FAKE_IMG_URL, undefined, mockUser as any),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });
});
