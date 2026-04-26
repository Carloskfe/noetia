import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AuthModule } from '../auth/auth.module';
import { redisProvider } from '../auth/redis.provider';
import { SocialTokenService } from './social-token.service';
import { SocialController } from './social.controller';

@Module({
  imports: [HttpModule, AuthModule],
  providers: [SocialTokenService, redisProvider],
  controllers: [SocialController],
  exports: [SocialTokenService],
})
export class SocialModule {}
