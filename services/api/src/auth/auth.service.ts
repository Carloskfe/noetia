import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthProvider, User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { TokenService } from './token.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly tokenService: TokenService,
  ) {}

  async register(name: string, email: string, password: string) {
    const existing = await this.usersService.findByEmail(email);
    if (existing) throw new ConflictException('Email already in use');
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await this.usersService.create({ name, email, passwordHash, provider: AuthProvider.LOCAL });
    return this.issueTokens(user);
  }

  async issueTokens(user: User) {
    const accessToken = this.tokenService.generateAccessToken({ sub: user.id, email: user.email });
    const refreshTokenId = await this.tokenService.generateRefreshToken(user.id);
    return { accessToken, refreshTokenId, user };
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
      });
    } else {
      await this.usersService.update(user.id, { lastLoginAt: new Date() });
      user = (await this.usersService.findById(user.id))!;
    }
    return user;
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);
    if (!user || user.provider !== 'local') return; // silent — don't reveal account existence
    const token = await this.tokenService.generatePasswordResetToken(user.id);
    const webUrl = process.env.WEB_URL ?? 'http://localhost:3000';
    // In production replace this log with an email via your mail provider
    console.log(`[DEV] Password reset link: ${webUrl}/reset-password?token=${token}`);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const userId = await this.tokenService.consumePasswordResetToken(token);
    if (!userId) throw new BadRequestException('Invalid or expired reset token');
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.usersService.update(userId, { passwordHash });
  }
}
