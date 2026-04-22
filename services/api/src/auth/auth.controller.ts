import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Request,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { TokenService } from './token.service';

const isProd = process.env.NODE_ENV === 'production';
const WEB_URL = process.env.WEB_URL ?? 'http://localhost:3000';

function setRefreshCookie(res: Response, tokenId: string, userId: string) {
  res.cookie('refresh_token', `${userId}:${tokenId}`, {
    httpOnly: true,
    sameSite: 'strict',
    secure: isProd,
    maxAge: 1000 * 60 * 60 * 24 * 7,
    path: '/auth',
  });
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly tokenService: TokenService,
  ) {}

  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshTokenId, user } = await this.authService.register(
      dto.name,
      dto.email,
      dto.password,
    );
    setRefreshCookie(res, refreshTokenId, user.id);
    return { accessToken, user: { id: user.id, email: user.email, name: user.name } };
  }

  @Post('login')
  @HttpCode(200)
  @UseGuards(AuthGuard('local'))
  async login(@Request() req: any, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshTokenId, user } = await this.authService.issueTokens(req.user);
    setRefreshCookie(res, refreshTokenId, user.id);
    return { accessToken, user: { id: user.id, email: user.email, name: user.name } };
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Request() req: any, @Res({ passthrough: true }) res: Response) {
    const raw = req.cookies?.refresh_token as string | undefined;
    if (!raw) throw new UnauthorizedException();
    const [userId, tokenId] = raw.split(':');
    const valid = await this.tokenService.validateRefreshToken(userId, tokenId);
    if (!valid) {
      res.clearCookie('refresh_token', { path: '/auth' });
      throw new UnauthorizedException();
    }
    await this.tokenService.deleteRefreshToken(userId, tokenId);
    const user = await this.authService['usersService'].findById(userId);
    if (!user) throw new UnauthorizedException();
    const accessToken = this.tokenService.generateAccessToken({ sub: user.id, email: user.email });
    const newTokenId = await this.tokenService.generateRefreshToken(user.id);
    setRefreshCookie(res, newTokenId, user.id);
    return { accessToken };
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
    res.clearCookie('refresh_token', { path: '/auth' });
    return { message: 'Logged out' };
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
    res.redirect(`${WEB_URL}/auth/callback?token=${accessToken}`);
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
    res.redirect(`${WEB_URL}/auth/callback?token=${accessToken}`);
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
    res.redirect(`${WEB_URL}/auth/callback?token=${accessToken}`);
  }
}
