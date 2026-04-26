import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import Redis from 'ioredis';
import { InjectRedis } from '../auth/redis.provider';

export interface SocialTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

const ALG = 'aes-256-cbc';
const IV_LEN = 16;

@Injectable()
export class SocialTokenService {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  private get key(): Buffer {
    const secret = process.env.SOCIAL_TOKEN_SECRET ?? 'changeme-social-secret';
    return scryptSync(secret, 'salt', 32) as Buffer;
  }

  private encrypt(plain: string): string {
    const iv = randomBytes(IV_LEN);
    const cipher = createCipheriv(ALG, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
  }

  private decrypt(ciphertext: string): string {
    const [ivHex, dataHex] = ciphertext.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const data = Buffer.from(dataHex, 'hex');
    const decipher = createDecipheriv(ALG, this.key, iv);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  }

  private redisKey(userId: string, platform: string): string {
    return `social:tokens:${userId}:${platform}`;
  }

  async store(userId: string, platform: string, tokens: SocialTokens): Promise<void> {
    const key = this.redisKey(userId, platform);
    const encrypted = this.encrypt(JSON.stringify(tokens));
    const ttl = Math.max(1, Math.floor((tokens.expiresAt - Date.now()) / 1000));
    await this.redis.set(key, encrypted, 'EX', ttl);

    if (tokens.refreshToken) {
      const refreshKey = `${key}:refresh`;
      const refreshEncrypted = this.encrypt(tokens.refreshToken);
      await this.redis.set(refreshKey, refreshEncrypted, 'EX', 60 * 24 * 60 * 60);
    }
  }

  async getToken(userId: string, platform: string): Promise<SocialTokens | null> {
    const key = this.redisKey(userId, platform);
    const raw = await this.redis.get(key);
    if (!raw) return null;

    const tokens: SocialTokens = JSON.parse(this.decrypt(raw));

    const fiveMinutes = 5 * 60 * 1000;
    if (tokens.expiresAt - Date.now() < fiveMinutes && tokens.refreshToken) {
      const refreshed = await this.refresh(userId, platform, tokens.refreshToken);
      if (refreshed) return refreshed;
    }

    return tokens;
  }

  private async refresh(
    userId: string,
    platform: string,
    refreshToken: string,
  ): Promise<SocialTokens | null> {
    const refreshKey = `${this.redisKey(userId, platform)}:refresh`;
    const rawRefresh = await this.redis.get(refreshKey);
    if (!rawRefresh) return null;

    try {
      const storedRefresh = this.decrypt(rawRefresh);
      if (storedRefresh !== refreshToken) return null;

      return null;
    } catch {
      return null;
    }
  }
}
