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
import { EmailService } from '../../../src/email/email.service';
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
  generateEmailConfirmToken: jest.fn(),
  consumeEmailConfirmToken: jest.fn(),
};

const mockEmailService = {
  sendEmailConfirmation: jest.fn().mockResolvedValue(undefined),
  sendPasswordReset: jest.fn().mockResolvedValue(undefined),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: TokenService, useValue: mockTokenService },
        { provide: EmailService, useValue: mockEmailService },
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

    it('creates user with emailConfirmed: false for local provider', async () => {
      const user = { id: '1', email: 'new@test.com', provider: AuthProvider.LOCAL, emailConfirmed: false };
      mockUsersService.findByEmail.mockResolvedValue(null);
      mockUsersService.create.mockResolvedValue(user);
      mockUsersService.update.mockResolvedValue(user);
      mockTokenService.generateAccessToken.mockReturnValue('access-token');
      mockTokenService.generateRefreshToken.mockResolvedValue('refresh-id');
      mockTokenService.generateEmailConfirmToken.mockResolvedValue('confirm-tok');

      await service.register('Name', 'new@test.com', 'password123');

      expect(mockUsersService.create).toHaveBeenCalledWith(
        expect.objectContaining({ emailConfirmed: false, provider: AuthProvider.LOCAL }),
      );
    });

    it('sends confirmation email on register', async () => {
      const user = { id: '1', email: 'new@test.com', provider: AuthProvider.LOCAL };
      mockUsersService.findByEmail.mockResolvedValue(null);
      mockUsersService.create.mockResolvedValue(user);
      mockUsersService.update.mockResolvedValue(user);
      mockTokenService.generateAccessToken.mockReturnValue('at');
      mockTokenService.generateRefreshToken.mockResolvedValue('rt');
      mockTokenService.generateEmailConfirmToken.mockResolvedValue('confirm-tok');

      await service.register('Name', 'new@test.com', 'password123');

      expect(mockEmailService.sendEmailConfirmation).toHaveBeenCalledWith(
        'new@test.com',
        'Name',
        'confirm-tok',
      );
    });

    it('hashes the password before storing', async () => {
      const user = { id: '1', email: 'h@test.com' };
      mockUsersService.findByEmail.mockResolvedValue(null);
      mockUsersService.create.mockResolvedValue(user);
      mockUsersService.update.mockResolvedValue(user);
      mockTokenService.generateAccessToken.mockReturnValue('at');
      mockTokenService.generateRefreshToken.mockResolvedValue('rt');
      mockTokenService.generateEmailConfirmToken.mockResolvedValue('ct');

      await service.register('Name', 'h@test.com', 'plaintext');

      const createdWith = mockUsersService.create.mock.calls[0][0];
      expect(createdWith.passwordHash).toBe('hashed:plaintext');
    });
  });

  describe('confirmEmail', () => {
    it('throws BadRequestException for invalid or expired token', async () => {
      mockTokenService.consumeEmailConfirmToken.mockResolvedValue(null);
      await expect(service.confirmEmail('bad-token')).rejects.toThrow(BadRequestException);
    });

    it('marks user emailConfirmed and returns tokens on valid token', async () => {
      const user = { id: 'u1', email: 'u@test.com', emailConfirmed: true };
      mockTokenService.consumeEmailConfirmToken.mockResolvedValue('u1');
      mockUsersService.update.mockResolvedValue(user);
      mockUsersService.findById.mockResolvedValue(user);
      mockTokenService.generateAccessToken.mockReturnValue('at');
      mockTokenService.generateRefreshToken.mockResolvedValue('rt');

      const result = await service.confirmEmail('valid-token');

      expect(mockUsersService.update).toHaveBeenCalledWith('u1', { emailConfirmed: true });
      expect(result.accessToken).toBe('at');
    });

    it('throws BadRequestException if user is not found after confirmation', async () => {
      mockTokenService.consumeEmailConfirmToken.mockResolvedValue('ghost-id');
      mockUsersService.update.mockResolvedValue(undefined);
      mockUsersService.findById.mockResolvedValue(null);
      await expect(service.confirmEmail('orphan-token')).rejects.toThrow(BadRequestException);
    });
  });

  describe('resendConfirmation', () => {
    it('does nothing if user is already confirmed', async () => {
      mockUsersService.findById.mockResolvedValue({ id: 'u1', email: 'u@test.com', emailConfirmed: true });
      await service.resendConfirmation('u1');
      expect(mockEmailService.sendEmailConfirmation).not.toHaveBeenCalled();
    });

    it('does nothing if user has no email', async () => {
      mockUsersService.findById.mockResolvedValue({ id: 'u1', email: null, emailConfirmed: false });
      await service.resendConfirmation('u1');
      expect(mockEmailService.sendEmailConfirmation).not.toHaveBeenCalled();
    });

    it('sends confirmation email for unconfirmed user', async () => {
      mockUsersService.findById.mockResolvedValue({ id: 'u1', email: 'u@test.com', name: 'User', emailConfirmed: false });
      mockTokenService.generateEmailConfirmToken.mockResolvedValue('new-tok');
      await service.resendConfirmation('u1');
      expect(mockEmailService.sendEmailConfirmation).toHaveBeenCalledWith('u@test.com', 'User', 'new-tok', 'es');
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

    it('creates new OAuth user with emailConfirmed: true', async () => {
      const newUser = { id: '2', email: 'n@test.com', emailConfirmed: true };
      mockUsersService.findByProvider.mockResolvedValue(null);
      mockUsersService.create.mockResolvedValue(newUser);

      await service.upsertOAuthUser({
        provider: AuthProvider.GOOGLE,
        providerId: 'gid456',
        email: 'n@test.com',
        name: 'New',
        avatarUrl: null,
      });

      expect(mockUsersService.create).toHaveBeenCalledWith(
        expect.objectContaining({ emailConfirmed: true }),
      );
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

    it('generates token and sends reset email for local user', async () => {
      mockUsersService.findByEmail.mockResolvedValue({ id: '1', provider: 'local', email: 'local@test.com', name: 'Local' });
      mockTokenService.generatePasswordResetToken.mockResolvedValue('reset-token');

      await service.requestPasswordReset('local@test.com');

      expect(mockTokenService.generatePasswordResetToken).toHaveBeenCalledWith('1');
      expect(mockEmailService.sendPasswordReset).toHaveBeenCalledWith(
        'local@test.com',
        'Local',
        'reset-token',
        'es',
      );
    });
  });

  // ── Mobile OAuth ────────────────────────────────────────────────────────────

  describe('verifyGoogleIdToken', () => {
    it('returns a user when Google tokeninfo is valid', async () => {
      const mockPayload = { sub: 'g123', email: 'g@test.com', name: 'Guser', picture: null };
      globalThis.fetch = jest.fn().mockResolvedValue({
        ok: true, json: jest.fn().mockResolvedValue(mockPayload),
      } as any);
      mockUsersService.findByProvider.mockResolvedValue(null);
      mockUsersService.create.mockResolvedValue({ id: 'u1', provider: 'google' });

      await service.verifyGoogleIdToken('valid-id-token');

      expect(mockUsersService.create).toHaveBeenCalledWith(
        expect.objectContaining({ provider: AuthProvider.GOOGLE, providerId: 'g123' }),
      );
    });

    it('throws UnauthorizedException when Google rejects the token', async () => {
      globalThis.fetch = jest.fn().mockResolvedValue({ ok: false } as any);
      await expect(service.verifyGoogleIdToken('bad-token')).rejects.toThrow('Invalid Google ID token');
    });
  });

  describe('verifyFacebookToken', () => {
    it('returns a user when Facebook Graph API responds with a profile', async () => {
      const fbProfile = { id: 'fb456', name: 'FBUser', email: 'fb@test.com' };
      globalThis.fetch = jest.fn().mockResolvedValue({
        ok: true, json: jest.fn().mockResolvedValue(fbProfile),
      } as any);
      mockUsersService.findByProvider.mockResolvedValue(null);
      mockUsersService.create.mockResolvedValue({ id: 'u2', provider: 'facebook' });

      await service.verifyFacebookToken('fb-access-token');

      expect(mockUsersService.create).toHaveBeenCalledWith(
        expect.objectContaining({ provider: AuthProvider.FACEBOOK, providerId: 'fb456' }),
      );
    });

    it('throws UnauthorizedException when Facebook rejects the token', async () => {
      globalThis.fetch = jest.fn().mockResolvedValue({ ok: false } as any);
      await expect(service.verifyFacebookToken('bad-token')).rejects.toThrow('Invalid Facebook access token');
    });
  });

  describe('verifyAppleIdentityToken', () => {
    it('upserts user from a valid Apple identity token payload', async () => {
      const header = Buffer.from(JSON.stringify({ kid: 'key1' })).toString('base64');
      const payload = Buffer.from(JSON.stringify({
        sub: 'apple-sub-789', email: 'apple@test.com', iss: 'https://appleid.apple.com', aud: 'com.noetia.app',
      })).toString('base64url');
      const token = `${header}.${payload}.sig`;

      globalThis.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ keys: [{ kid: 'key1' }] }),
      } as any);
      mockUsersService.findByProvider.mockResolvedValue(null);
      mockUsersService.create.mockResolvedValue({ id: 'u3', provider: 'apple' });

      await service.verifyAppleIdentityToken(token, 'Carlos');

      expect(mockUsersService.create).toHaveBeenCalledWith(
        expect.objectContaining({ provider: AuthProvider.APPLE, providerId: 'apple-sub-789', name: 'Carlos' }),
      );
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
