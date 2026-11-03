import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AuthModule } from '../auth/auth.module';
import { redisProvider } from '../auth/redis.provider';
import { SocialTokenService } from './social-token.service';
import { SocialController } from './social.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Share } from '../sharing/share.entity';
import { ShareLifecycleModule } from '../sharing/share-lifecycle.module';

@Module({
  imports: [HttpModule, AuthModule, TypeOrmModule.forFeature([Share]), ShareLifecycleModule],
  providers: [SocialTokenService, redisProvider],
  controllers: [SocialController],
  exports: [SocialTokenService],
})
export class SocialModule {}
