import { Body, Controller, HttpCode, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PushService } from './push.service';

@Controller('push')
export class PushController {
  constructor(private readonly pushService: PushService) {}

  @Post('register')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  register(
    @Request() req: any,
    @Body() dto: { token: string; platform?: string },
  ) {
    return this.pushService.registerToken(req.user.id, dto.token, dto.platform ?? 'unknown');
  }
}
