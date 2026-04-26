import {
  BadRequestException,
  BadGatewayException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Redirect,
  Req,
  Res,
  ServiceUnavailableException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { randomBytes } from 'crypto';
import Redis from 'ioredis';
import { InjectRedis } from '../auth/redis.provider';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SocialTokenService, SocialTokens } from './social-token.service';
import { LinkedInPublisher } from './publishers/linkedin.publisher';
import { FacebookPublisher } from './publishers/facebook.publisher';
import { InstagramPublisher } from './publishers/instagram.publisher';
import { PinterestPublisher } from './publishers/pinterest.publisher';

const VALID_PLATFORMS = new Set(['linkedin', 'facebook', 'instagram', 'pinterest']);

const OAUTH_CONFIG: Record<string, {
  authUrl: string;
  tokenUrl: string;
  clientIdEnv: string;
  clientSecretEnv: string;
  scope: string;
}> = {
  linkedin: {
    authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    clientIdEnv: 'LINKEDIN_CLIENT_ID',
    clientSecretEnv: 'LINKEDIN_CLIENT_SECRET',
    scope: 'w_member_social r_liteprofile',
  },
  facebook: {
    authUrl: 'https://www.facebook.com/v21.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v21.0/oauth/access_token',
    clientIdEnv: 'FACEBOOK_APP_ID',
    clientSecretEnv: 'FACEBOOK_APP_SECRET',
    scope: 'pages_manage_posts,pages_read_engagement',
  },
  instagram: {
    authUrl: 'https://api.instagram.com/oauth/authorize',
    tokenUrl: 'https://api.instagram.com/oauth/access_token',
    clientIdEnv: 'INSTAGRAM_APP_ID',
    clientSecretEnv: 'INSTAGRAM_APP_SECRET',
    scope: 'instagram_content_publish,instagram_basic',
  },
  pinterest: {
    authUrl: 'https://www.pinterest.com/oauth/',
    tokenUrl: 'https://api.pinterest.com/v5/oauth/token',
    clientIdEnv: 'PINTEREST_APP_ID',
    clientSecretEnv: 'PINTEREST_APP_SECRET',
    scope: 'boards:read pins:write',
  },
};

const closePopupHtml = (error?: string) => `
<!DOCTYPE html><html><body><script>
window.opener && window.opener.postMessage(${JSON.stringify({ type: 'oauth', error: error ?? null })}, '*');
window.close();
</script></body></html>`;

@Controller('social')
export class SocialController {
  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly tokenService: SocialTokenService,
  ) {}

  @Get(':platform/connect')
  @UseGuards(JwtAuthGuard)
  async connect(
    @Param('platform') platform: string,
    @Req() req: { user: { id: string } },
    @Res() res: Response,
  ) {
    if (!VALID_PLATFORMS.has(platform)) {
      throw new BadRequestException(`unsupported platform: ${platform}`);
    }

    const config = OAUTH_CONFIG[platform];
    const state = randomBytes(16).toString('hex');
    await this.redis.set(`oauth:state:${state}`, req.user.id, 'EX', 600);

    const redirectUri = `${process.env.API_BASE_URL ?? 'http://localhost:3001'}/social/${platform}/callback`;
    const clientId = process.env[config.clientIdEnv] ?? '';
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: config.scope,
      state,
    });
    return res.redirect(`${config.authUrl}?${params.toString()}`);
  }

  @Get(':platform/callback')
  async callback(
    @Param('platform') platform: string,
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ) {
    if (error) {
      return res.send(closePopupHtml(error));
    }

    if (!state) {
      return res.status(400).send(closePopupHtml('missing_state'));
    }

    const userId = await this.redis.get(`oauth:state:${state}`);
    if (!userId) {
      return res.status(400).send(closePopupHtml('invalid_state'));
    }
    await this.redis.del(`oauth:state:${state}`);

    if (!code) {
      return res.status(400).send(closePopupHtml('missing_code'));
    }

    const config = OAUTH_CONFIG[platform];
    const redirectUri = `${process.env.API_BASE_URL ?? 'http://localhost:3001'}/social/${platform}/callback`;

    try {
      const tokenRes = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
          client_id: process.env[config.clientIdEnv] ?? '',
          client_secret: process.env[config.clientSecretEnv] ?? '',
        }).toString(),
      });

      if (!tokenRes.ok) {
        return res.send(closePopupHtml('token_exchange_failed'));
      }

      const tokenData = (await tokenRes.json()) as {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
      };

      const tokens: SocialTokens = {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: Date.now() + (tokenData.expires_in ?? 3600) * 1000,
      };

      await this.tokenService.store(userId, platform, tokens);
      return res.send(closePopupHtml());
    } catch {
      return res.send(closePopupHtml('token_exchange_failed'));
    }
  }

  @Get(':platform/status')
  @UseGuards(JwtAuthGuard)
  async status(
    @Param('platform') platform: string,
    @Req() req: { user: { id: string } },
  ) {
    const token = await this.tokenService.getToken(req.user.id, platform);
    return { connected: token !== null };
  }

  @Post(':platform/publish')
  @UseGuards(JwtAuthGuard)
  async publish(
    @Param('platform') platform: string,
    @Body('imageUrl') imageUrl: string,
    @Body('caption') caption: string | undefined,
    @Req() req: { user: { id: string } },
  ) {
    const token = await this.tokenService.getToken(req.user.id, platform);
    if (!token) {
      throw new UnauthorizedException('account_not_connected');
    }

    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) {
      throw new BadGatewayException('image_download_failed');
    }
    const imageBuffer = Buffer.from(await imgRes.arrayBuffer());

    let postUrl: string;
    try {
      switch (platform) {
        case 'linkedin':
          postUrl = await LinkedInPublisher.publish(token.accessToken, imageBuffer, caption);
          break;
        case 'facebook':
          postUrl = await FacebookPublisher.publish(token.accessToken, imageBuffer, caption);
          break;
        case 'instagram': {
          const enabled = process.env.INSTAGRAM_PUBLISH_ENABLED === 'true';
          postUrl = await InstagramPublisher.publish(token.accessToken, imageBuffer, caption, enabled);
          break;
        }
        case 'pinterest':
          postUrl = await PinterestPublisher.publish(token.accessToken, imageUrl, caption);
          break;
        default:
          throw new BadRequestException(`unsupported platform: ${platform}`);
      }
    } catch (err) {
      if (err instanceof UnauthorizedException || err instanceof ServiceUnavailableException || err instanceof BadRequestException) {
        throw err;
      }
      throw new BadGatewayException('platform_publish_failed');
    }

    return { postUrl };
  }
}
