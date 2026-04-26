import { BadGatewayException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SocialController } from '../../../src/social/social.controller';
import { SocialTokenService } from '../../../src/social/social-token.service';
import { REDIS_TOKEN } from '../../../src/auth/redis.provider';
import { JwtAuthGuard } from '../../../src/auth/jwt-auth.guard';
import { LinkedInPublisher } from '../../../src/social/publishers/linkedin.publisher';
import { FacebookPublisher } from '../../../src/social/publishers/facebook.publisher';
import { InstagramPublisher } from '../../../src/social/publishers/instagram.publisher';
import { PinterestPublisher } from '../../../src/social/publishers/pinterest.publisher';

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
const FAKE_IMG_URL = 'http://storage/images/test.png';
const PNG_BYTES = Buffer.from('\x89PNG\r\n\x1a\n' + '\x00'.repeat(100));

describe('SocialController', () => {
  let controller: SocialController;
  let tokenService: ReturnType<typeof mockTokenService>;
  let redis: ReturnType<typeof mockRedis>;

  beforeEach(async () => {
    tokenService = mockTokenService();
    redis = mockRedis();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SocialController],
      providers: [
        { provide: SocialTokenService, useValue: tokenService },
        { provide: REDIS_TOKEN, useValue: redis },
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
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => PNG_BYTES.buffer,
      } as unknown as Response);
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
