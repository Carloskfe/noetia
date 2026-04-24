import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, BadRequestException } from '@nestjs/common';
import { AuthService } from '../../../src/auth/auth.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockImplementation((plain: string) => Promise.resolve(`hashed:${plain}`)),
  compare: jest.fn().mockImplementation((plain: string, hashed: string) =>
    Promise.resolve(hashed === `hashed:${plain}`),
  ),
}));
import { UsersService } from '../../../src/users/users.service';
import { TokenService } from '../../../src/auth/token.service';
import { AuthProvider } from '../../../src/users/user.entity';

const mockUsersService = {
  findByEmail: jest.fn(),
  findByProvider: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
};

const mockTokenService = {
  generateAccessToken: jest.fn(),
  generateRefreshToken: jest.fn(),
  generatePasswordResetToken: jest.fn(),
  consumePasswordResetToken: jest.fn(),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: TokenService, useValue: mockTokenService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('throws ConflictException when email is already in use', async () => {
      mockUsersService.findByEmail.mockResolvedValue({ id: '1', email: 'taken@test.com' });
      await expect(service.register('Name', 'taken@test.com', 'pass')).rejects.toThrow(ConflictException);
    });

    it('creates user and returns tokens when email is available', async () => {
      const user = { id: '1', email: 'new@test.com', provider: AuthProvider.LOCAL };
      mockUsersService.findByEmail.mockResolvedValue(null);
      mockUsersService.create.mockResolvedValue(user);
      mockUsersService.update.mockResolvedValue(user);
      mockTokenService.generateAccessToken.mockReturnValue('access-token');
      mockTokenService.generateRefreshToken.mockResolvedValue('refresh-id');

      const result = await service.register('Name', 'new@test.com', 'password123');

      expect(mockUsersService.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'new@test.com', provider: AuthProvider.LOCAL }),
      );
      expect(result).toEqual({ accessToken: 'access-token', refreshTokenId: 'refresh-id', user });
    });

    it('hashes the password before storing', async () => {
      const user = { id: '1', email: 'h@test.com' };
      mockUsersService.findByEmail.mockResolvedValue(null);
      mockUsersService.create.mockResolvedValue(user);
      mockUsersService.update.mockResolvedValue(user);
      mockTokenService.generateAccessToken.mockReturnValue('at');
      mockTokenService.generateRefreshToken.mockResolvedValue('rt');

      await service.register('Name', 'h@test.com', 'plaintext');

      const createdWith = mockUsersService.create.mock.calls[0][0];
      expect(createdWith.passwordHash).toBeDefined();
      expect(createdWith.passwordHash).not.toBe('plaintext');
      expect(createdWith.passwordHash).toBe('hashed:plaintext');
    });
  });

  describe('issueTokens', () => {
    it('updates lastLoginAt and returns both tokens', async () => {
      const user = { id: '1', email: 'u@test.com' };
      mockUsersService.update.mockResolvedValue(user);
      mockTokenService.generateAccessToken.mockReturnValue('at');
      mockTokenService.generateRefreshToken.mockResolvedValue('rt');

      const result = await service.issueTokens(user as any);

      expect(mockUsersService.update).toHaveBeenCalledWith('1', expect.objectContaining({ lastLoginAt: expect.any(Date) }));
      expect(result).toEqual({ accessToken: 'at', refreshTokenId: 'rt', user });
    });
  });

  describe('upsertOAuthUser', () => {
    it('returns the existing user when found by provider', async () => {
      const existing = { id: '99', email: 'g@test.com' };
      mockUsersService.findByProvider.mockResolvedValue(existing);
      mockUsersService.findById.mockResolvedValue(existing);

      const result = await service.upsertOAuthUser({
        provider: AuthProvider.GOOGLE,
        providerId: 'gid123',
        email: 'g@test.com',
        name: 'G User',
        avatarUrl: null,
      });

      expect(mockUsersService.create).not.toHaveBeenCalled();
      expect(result).toEqual(existing);
    });

    it('creates a new user when not found by provider', async () => {
      const newUser = { id: '2', email: 'n@test.com' };
      mockUsersService.findByProvider.mockResolvedValue(null);
      mockUsersService.create.mockResolvedValue(newUser);

      const result = await service.upsertOAuthUser({
        provider: AuthProvider.GOOGLE,
        providerId: 'gid456',
        email: 'n@test.com',
        name: 'New',
        avatarUrl: null,
      });

      expect(mockUsersService.create).toHaveBeenCalledWith(
        expect.objectContaining({ provider: AuthProvider.GOOGLE, providerId: 'gid456' }),
      );
      expect(result).toEqual(newUser);
    });

    it('handles null email and name gracefully', async () => {
      const newUser = { id: '3', email: null };
      mockUsersService.findByProvider.mockResolvedValue(null);
      mockUsersService.create.mockResolvedValue(newUser);

      await service.upsertOAuthUser({
        provider: AuthProvider.APPLE,
        providerId: 'aid',
        email: null,
        name: null,
        avatarUrl: null,
      });

      expect(mockUsersService.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: null, name: null }),
      );
    });
  });

  describe('requestPasswordReset', () => {
    it('does nothing when user is not found (silent — no account enumeration)', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);
      await expect(service.requestPasswordReset('unknown@test.com')).resolves.toBeUndefined();
      expect(mockTokenService.generatePasswordResetToken).not.toHaveBeenCalled();
    });

    it('does nothing when user is an OAuth provider (silent)', async () => {
      mockUsersService.findByEmail.mockResolvedValue({ id: '1', provider: 'google' });
      await expect(service.requestPasswordReset('g@test.com')).resolves.toBeUndefined();
      expect(mockTokenService.generatePasswordResetToken).not.toHaveBeenCalled();
    });

    it('generates a password reset token for a local user', async () => {
      mockUsersService.findByEmail.mockResolvedValue({ id: '1', provider: 'local' });
      mockTokenService.generatePasswordResetToken.mockResolvedValue('reset-token');

      await service.requestPasswordReset('local@test.com');

      expect(mockTokenService.generatePasswordResetToken).toHaveBeenCalledWith('1');
    });
  });

  describe('resetPassword', () => {
    it('throws BadRequestException when the token is invalid or expired', async () => {
      mockTokenService.consumePasswordResetToken.mockResolvedValue(null);
      await expect(service.resetPassword('bad-token', 'newpass')).rejects.toThrow(BadRequestException);
    });

    it('hashes the new password and updates the user on a valid token', async () => {
      mockTokenService.consumePasswordResetToken.mockResolvedValue('user-id-1');
      mockUsersService.update.mockResolvedValue({});

      await service.resetPassword('valid-token', 'newPassword123');

      const [calledId, calledData] = mockUsersService.update.mock.calls[0];
      expect(calledId).toBe('user-id-1');
      expect(calledData.passwordHash).toBe('hashed:newPassword123');
    });
  });
});
