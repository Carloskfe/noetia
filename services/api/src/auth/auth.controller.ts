import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Request,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { TokenService } from './token.service';
import { UsersService } from '../users/users.service';

const isProd = process.env.NODE_ENV === 'production';
const WEB_URL = process.env.WEB_URL ?? 'http://localhost:3000';

// 30-day "remember me" window so returning users on the same device stay
// signed in (the access token is short-lived; this cookie silently re-issues it
// via /auth/refresh). Rotated on every refresh — see AuthController.refresh.
const REFRESH_COOKIE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;

function setRefreshCookie(res: Response, tokenId: string, userId: string) {
  res.cookie('refresh_token', `${userId}:${tokenId}`, {
    httpOnly: true,
    sameSite: 'strict',
    secure: isProd,
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    path: '/',
  });
}

function safeUser(user: any) {
  return { id: user.id, email: user.email, name: user.name, userType: user.userType ?? null, emailConfirmed: user.emailConfirmed ?? true };
}

@Controller('auth')
@Throttle({ default: { ttl: 60_000, limit: 20 } })
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly tokenService: TokenService,
    private readonly usersService: UsersService,
  ) {}

  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshTokenId, user } = await this.authService.register(
      dto.name,
      dto.email,
      dto.password,
    );
    setRefreshCookie(res, refreshTokenId, user.id);
    return { accessToken, user: safeUser(user) };
  }

  @Post('login')
  @HttpCode(200)
  @UseGuards(AuthGuard('local'))
  async login(@Request() req: any, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshTokenId, user } = await this.authService.issueTokens(req.user);
    setRefreshCookie(res, refreshTokenId, user.id);
    return { accessToken, user: safeUser(user) };
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Request() req: any, @Res({ passthrough: true }) res: Response) {
    const raw = req.cookies?.refresh_token as string | undefined;
    if (!raw) throw new UnauthorizedException();
    const [userId, tokenId] = raw.split(':');
    const valid = await this.tokenService.validateRefreshToken(userId, tokenId);
    if (!valid) {
      res.clearCookie('refresh_token', { path: '/' });
      throw new UnauthorizedException();
    }
    await this.tokenService.deleteRefreshToken(userId, tokenId);
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException();
    const accessToken = this.tokenService.generateAccessToken({ sub: user.id, email: user.email });
    const newTokenId = await this.tokenService.generateRefreshToken(user.id);
    setRefreshCookie(res, newTokenId, user.id);
    return { accessToken, user: safeUser(user) };
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async logout(@Request() req: any, @Res({ passthrough: true }) res: Response) {
    const raw = req.cookies?.refresh_token as string | undefined;
    if (raw) {
      const [userId, tokenId] = raw.split(':');
      await this.tokenService.deleteRefreshToken(userId, tokenId);
    }
    res.clearCookie('refresh_token', { path: '/' });
    return { message: 'Logged out' };
  }

  // ─── Email Confirmation ───────────────────────────────────────────────────

  @Get('confirm-email')
  async confirmEmail(@Query('token') token: string, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshTokenId, user } = await this.authService.confirmEmail(token);
    setRefreshCookie(res, refreshTokenId, user.id);
    return { accessToken, user: safeUser(user) };
  }

  @Post('resend-confirmation')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async resendConfirmation(@Request() req: any) {
    await this.authService.resendConfirmation(req.user.sub);
    return { message: 'Confirmation email sent.' };
  }

  // ─── Forgot / Reset Password ──────────────────────────────────────────────

  @Post('forgot-password')
  @HttpCode(200)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.requestPasswordReset(dto.email);
    return { message: 'If that email exists you will receive a reset link shortly.' };
  }

  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.password);
    return { message: 'Password updated successfully.' };
  }

  // ─── Google OAuth ──────────────────────────────────────────────────────────

  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleLogin() {}

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Request() req: any, @Res() res: Response) {
    const { accessToken, refreshTokenId, user } = await this.authService.issueTokens(req.user);
    setRefreshCookie(res, refreshTokenId, user.id);
    const next = user.userType ? '/library' : '/onboarding';
    res.redirect(`${WEB_URL}/auth/callback?token=${accessToken}&next=${next}`);
  }

  // ─── Facebook OAuth ────────────────────────────────────────────────────────

  @Get('facebook')
  @UseGuards(AuthGuard('facebook'))
  facebookLogin() {}

  @Get('facebook/callback')
  @UseGuards(AuthGuard('facebook'))
  async facebookCallback(@Request() req: any, @Res() res: Response) {
    const { accessToken, refreshTokenId, user } = await this.authService.issueTokens(req.user);
    setRefreshCookie(res, refreshTokenId, user.id);
    const next = user.userType ? '/library' : '/onboarding';
    res.redirect(`${WEB_URL}/auth/callback?token=${accessToken}&next=${next}`);
  }

  // ─── Apple Sign-In ─────────────────────────────────────────────────────────

  @Get('apple')
  @UseGuards(AuthGuard('apple'))
  appleLogin() {}

  @Post('apple/callback')
  @UseGuards(AuthGuard('apple'))
  async appleCallback(@Request() req: any, @Res() res: Response) {
    const { accessToken, refreshTokenId, user } = await this.authService.issueTokens(req.user);
    setRefreshCookie(res, refreshTokenId, user.id);
    const next = user.userType ? '/library' : '/onboarding';
    res.redirect(`${WEB_URL}/auth/callback?token=${accessToken}&next=${next}`);
  }

  // ─── Mobile OAuth — token verification endpoints ──────────────────────────
  // Mobile clients (Expo) obtain tokens client-side, then exchange here for a JWT.

  @Post('google/mobile')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async googleMobile(@Body() body: { idToken: string }) {
    if (!body.idToken) throw new UnauthorizedException('idToken required');
    const user = await this.authService.verifyGoogleIdToken(body.idToken);
    const { accessToken, user: safeU } = await this.authService.issueTokens(user);
    return { accessToken, user: safeUser(safeU) };
  }

  @Post('facebook/mobile')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async facebookMobile(@Body() body: { accessToken: string }) {
    if (!body.accessToken) throw new UnauthorizedException('accessToken required');
    const user = await this.authService.verifyFacebookToken(body.accessToken);
    const { accessToken: jwt, user: safeU } = await this.authService.issueTokens(user);
    return { accessToken: jwt, user: safeUser(safeU) };
  }

  @Post('apple/mobile')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async appleMobile(@Body() body: { identityToken: string; fullName?: string }) {
    if (!body.identityToken) throw new UnauthorizedException('identityToken required');
    const user = await this.authService.verifyAppleIdentityToken(body.identityToken, body.fullName);
    const { accessToken, user: safeU } = await this.authService.issueTokens(user);
    return { accessToken, user: safeUser(safeU) };
  }
}
