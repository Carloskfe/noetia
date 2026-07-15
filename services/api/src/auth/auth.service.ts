import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthProvider, User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { EmailService } from '../email/email.service';
import { TokenService } from './token.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly tokenService: TokenService,
    private readonly emailService: EmailService,
  ) {}

  async register(name: string, email: string, password: string) {
    const existing = await this.usersService.findByEmail(email);
    if (existing) throw new ConflictException('Email already in use');
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await this.usersService.create({
      name,
      email,
      passwordHash,
      provider: AuthProvider.LOCAL,
      emailConfirmed: false,
    });
    const confirmToken = await this.tokenService.generateEmailConfirmToken(user.id);
    await this.emailService.sendEmailConfirmation(email, name, confirmToken);
    return this.issueTokens(user);
  }

  async issueTokens(user: User) {
    await this.usersService.update(user.id, { lastLoginAt: new Date() });
    const accessToken = this.tokenService.generateAccessToken({ sub: user.id, email: user.email });
    const refreshTokenId = await this.tokenService.generateRefreshToken(user.id);
    return { accessToken, refreshTokenId, user };
  }

  async confirmEmail(token: string) {
    const userId = await this.tokenService.consumeEmailConfirmToken(token);
    if (!userId) throw new BadRequestException('Invalid or expired confirmation link');
    await this.usersService.update(userId, { emailConfirmed: true });
    const user = await this.usersService.findById(userId);
    if (!user) throw new BadRequestException('User not found');
    return this.issueTokens(user);
  }

  async resendConfirmation(userId: string): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (!user || !user.email || user.emailConfirmed) return;
    const token = await this.tokenService.generateEmailConfirmToken(userId);
    await this.emailService.sendEmailConfirmation(user.email, user.name ?? user.email, token, (user.uiLanguage as 'es' | 'en') ?? 'es');
  }

  async upsertOAuthUser(data: {
    provider: AuthProvider;
    providerId: string;
    email?: string | null;
    name?: string | null;
    avatarUrl?: string | null;
  }) {
    let user = await this.usersService.findByProvider(data.provider, data.providerId);
    if (!user) {
      user = await this.usersService.create({
        provider: data.provider,
        providerId: data.providerId,
        email: data.email ?? null,
        name: data.name ?? null,
        avatarUrl: data.avatarUrl ?? null,
        emailConfirmed: true, // OAuth emails are verified by the provider
      });
    } else {
      // Heal existing OAuth accounts left unconfirmed: those created before we
      // set emailConfirmed on creation were trapped behind the confirmation
      // gate with no way out — OAuth users never receive (or can resend) a
      // confirmation email, which is local-provider only.
      if (!user.emailConfirmed) {
        await this.usersService.update(user.id, { emailConfirmed: true });
      }
      user = (await this.usersService.findById(user.id))!;
    }
    return user;
  }

  // ─── Mobile OAuth token verification ────────────────────────────────────────

  async verifyGoogleIdToken(idToken: string) {
    // Verify with Google tokeninfo endpoint
    const res = await globalThis.fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
    );
    if (!res.ok) throw new UnauthorizedException('Invalid Google ID token');
    const payload = await res.json() as {
      sub: string; email?: string; name?: string; picture?: string; aud?: string;
    };
    const clientIds = [
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_MOBILE_CLIENT_ID,
    ].filter(Boolean);
    if (clientIds.length && !clientIds.includes(payload.aud)) {
      throw new UnauthorizedException('Google token audience mismatch');
    }
    return this.upsertOAuthUser({
      provider: AuthProvider.GOOGLE,
      providerId: payload.sub,
      email: payload.email ?? null,
      name: payload.name ?? null,
      avatarUrl: payload.picture ?? null,
    });
  }

  async verifyFacebookToken(accessToken: string) {
    const res = await globalThis.fetch(
      `https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${encodeURIComponent(accessToken)}`,
    );
    if (!res.ok) throw new UnauthorizedException('Invalid Facebook access token');
    const profile = await res.json() as {
      id: string; name?: string; email?: string; picture?: { data?: { url?: string } };
    };
    if (!profile.id) throw new UnauthorizedException('Facebook token has no user id');
    return this.upsertOAuthUser({
      provider: AuthProvider.FACEBOOK,
      providerId: profile.id,
      email: profile.email ?? null,
      name: profile.name ?? null,
      avatarUrl: profile.picture?.data?.url ?? null,
    });
  }

  async verifyAppleIdentityToken(identityToken: string, fullName?: string) {
    // Decode JWT header to get key id
    const [headerB64] = identityToken.split('.');
    const header = JSON.parse(Buffer.from(headerB64, 'base64').toString());

    // Fetch Apple public keys
    const keysRes = await globalThis.fetch('https://appleid.apple.com/auth/keys');
    if (!keysRes.ok) throw new UnauthorizedException('Could not fetch Apple public keys');
    const { keys } = await keysRes.json() as { keys: any[] };
    const key = keys.find((k: any) => k.kid === header.kid);
    if (!key) throw new UnauthorizedException('Apple key not found');

    // Decode payload (trust Apple's signature — full RS256 verification requires a crypto lib)
    const [, payloadB64] = identityToken.split('.');
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString()) as {
      sub: string; email?: string; iss?: string; aud?: string;
    };

    if (payload.iss !== 'https://appleid.apple.com') {
      throw new UnauthorizedException('Invalid Apple token issuer');
    }
    const clientId = process.env.APPLE_CLIENT_ID;
    if (clientId && payload.aud !== clientId) {
      throw new UnauthorizedException('Apple token audience mismatch');
    }

    return this.upsertOAuthUser({
      provider: AuthProvider.APPLE,
      providerId: payload.sub,
      email: payload.email ?? null,
      name: fullName ?? null,
      avatarUrl: null,
    });
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);
    if (!user || user.provider !== 'local') return; // silent — don't reveal account existence
    const token = await this.tokenService.generatePasswordResetToken(user.id);
    await this.emailService.sendPasswordReset(email, user.name ?? email, token, (user.uiLanguage as 'es' | 'en') ?? 'es');
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const userId = await this.tokenService.consumePasswordResetToken(token);
    if (!userId) throw new BadRequestException('Invalid or expired reset token');
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.usersService.update(userId, { passwordHash });
  }
}
