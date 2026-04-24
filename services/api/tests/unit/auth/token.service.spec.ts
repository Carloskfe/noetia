import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { TokenService } from '../../../src/auth/token.service';
import { REDIS_TOKEN } from '../../../src/auth/redis.provider';

const mockJwtService = { sign: jest.fn() };

const mockRedis = {
  set: jest.fn(),
  get: jest.fn(),
  del: jest.fn(),
};

describe('TokenService', () => {
  let service: TokenService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        { provide: JwtService, useValue: mockJwtService },
        { provide: REDIS_TOKEN, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<TokenService>(TokenService);
    jest.clearAllMocks();
  });

  describe('generateAccessToken', () => {
    it('signs and returns a JWT string', () => {
      mockJwtService.sign.mockReturnValue('signed-jwt');
      const result = service.generateAccessToken({ sub: 'uid-1', email: 'u@test.com' });
      expect(mockJwtService.sign).toHaveBeenCalledWith({ sub: 'uid-1', email: 'u@test.com' });
      expect(result).toBe('signed-jwt');
    });

    it('handles null email payload', () => {
      mockJwtService.sign.mockReturnValue('jwt-no-email');
      service.generateAccessToken({ sub: 'uid-2', email: null });
      expect(mockJwtService.sign).toHaveBeenCalledWith({ sub: 'uid-2', email: null });
    });
  });

  describe('generateRefreshToken', () => {
    it('stores a key in Redis with 7-day TTL and returns a UUID', async () => {
      mockRedis.set.mockResolvedValue('OK');
      const tokenId = await service.generateRefreshToken('user-1');
      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringMatching(/^refresh:user-1:/),
        '1',
        'EX',
        60 * 60 * 24 * 7,
      );
      expect(typeof tokenId).toBe('string');
      expect(tokenId).toMatch(/^[0-9a-f-]{36}$/);
    });
  });

  describe('validateRefreshToken', () => {
    it('returns true when the token is stored in Redis', async () => {
      mockRedis.get.mockResolvedValue('1');
      expect(await service.validateRefreshToken('user-1', 'tok')).toBe(true);
      expect(mockRedis.get).toHaveBeenCalledWith('refresh:user-1:tok');
    });

    it('returns false when the token is not found in Redis', async () => {
      mockRedis.get.mockResolvedValue(null);
      expect(await service.validateRefreshToken('user-1', 'bad-tok')).toBe(false);
    });
  });

  describe('deleteRefreshToken', () => {
    it('deletes the exact Redis key for the user+token pair', async () => {
      mockRedis.del.mockResolvedValue(1);
      await service.deleteRefreshToken('user-1', 'tok-id');
      expect(mockRedis.del).toHaveBeenCalledWith('refresh:user-1:tok-id');
    });
  });

  describe('generatePasswordResetToken', () => {
    it('returns a 64-character hex string and stores it with 1h TTL', async () => {
      mockRedis.set.mockResolvedValue('OK');
      const token = await service.generatePasswordResetToken('user-1');
      expect(token).toMatch(/^[0-9a-f]{64}$/);
      expect(mockRedis.set).toHaveBeenCalledWith(`pwd_reset:${token}`, 'user-1', 'EX', 3600);
    });

    it('generates a unique token each call', async () => {
      mockRedis.set.mockResolvedValue('OK');
      const t1 = await service.generatePasswordResetToken('user-1');
      const t2 = await service.generatePasswordResetToken('user-1');
      expect(t1).not.toBe(t2);
    });
  });

  describe('consumePasswordResetToken', () => {
    it('returns userId and deletes the key when token is valid', async () => {
      mockRedis.get.mockResolvedValue('user-42');
      mockRedis.del.mockResolvedValue(1);
      const userId = await service.consumePasswordResetToken('valid-hex-token');
      expect(userId).toBe('user-42');
      expect(mockRedis.del).toHaveBeenCalledWith('pwd_reset:valid-hex-token');
    });

    it('returns null and does not delete when token is not found', async () => {
      mockRedis.get.mockResolvedValue(null);
      const userId = await service.consumePasswordResetToken('expired-token');
      expect(userId).toBeNull();
      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });
});
