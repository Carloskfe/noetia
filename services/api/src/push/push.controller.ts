import { Body, Controller, HttpCode, Post, Request, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';
import { PUSH_REGISTER_THROTTLE, pushRegisterTracker } from './push-register.throttle';
import { PushService } from './push.service';

@Controller('push')
export class PushController {
  constructor(private readonly pushService: PushService) {}

  @Post('register')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @Throttle({ global: { ...PUSH_REGISTER_THROTTLE, getTracker: pushRegisterTracker } })
  register(
    @Request() req: { user: { id: string } },
    @Body() dto: RegisterPushTokenDto,
  ) {
    return this.pushService.registerToken(req.user.id, dto.token, dto.platform ?? 'unknown');
  }
}
