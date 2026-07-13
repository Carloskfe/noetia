import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRedis } from './redis.provider';
import Redis from 'ioredis';
import { randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';

// 30 days — the "remember me" window. Must match the refresh_token cookie
// maxAge in auth.controller.ts; whichever is shorter caps how long a returning
// user stays signed in. Rotated (deleted + reissued) on every /auth/refresh.
const REFRESH_TTL = 60 * 60 * 24 * 30;
const PWD_RESET_TTL = 60 * 60; // 1 hour
const EMAIL_CONFIRM_TTL = 60 * 60 * 24; // 24 hours

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  generateAccessToken(payload: { sub: string; email: string | null }) {
    return this.jwtService.sign(payload);
  }

  async generateRefreshToken(userId: string): Promise<string> {
    const tokenId = uuidv4();
    await this.redis.set(`refresh:${userId}:${tokenId}`, '1', 'EX', REFRESH_TTL);
    return tokenId;
  }

  async validateRefreshToken(userId: string, tokenId: string): Promise<boolean> {
    const val = await this.redis.get(`refresh:${userId}:${tokenId}`);
    return val === '1';
  }

  async deleteRefreshToken(userId: string, tokenId: string): Promise<void> {
    await this.redis.del(`refresh:${userId}:${tokenId}`);
  }

  async generatePasswordResetToken(userId: string): Promise<string> {
    const token = randomBytes(32).toString('hex');
    await this.redis.set(`pwd_reset:${token}`, userId, 'EX', PWD_RESET_TTL);
    return token;
  }

  async consumePasswordResetToken(token: string): Promise<string | null> {
    const userId = await this.redis.get(`pwd_reset:${token}`);
    if (userId) await this.redis.del(`pwd_reset:${token}`);
    return userId;
  }

  async generateEmailConfirmToken(userId: string): Promise<string> {
    const token = randomBytes(32).toString('hex');
    await this.redis.set(`email_confirm:${token}`, userId, 'EX', EMAIL_CONFIRM_TTL);
    return token;
  }

  async consumeEmailConfirmToken(token: string): Promise<string | null> {
    const userId = await this.redis.get(`email_confirm:${token}`);
    if (userId) await this.redis.del(`email_confirm:${token}`);
    return userId;
  }
}
