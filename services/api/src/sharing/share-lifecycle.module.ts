import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { redisProvider } from '../auth/redis.provider';
import { Share } from './share.entity';
import { CardImageDeletion } from './card-image-deletion.entity';
import { ShareLifecycleService } from './share-lifecycle.service';
import { ShareRateLimiter } from './share-rate-limiter';

/**
 * Share lifecycle (revocation / deletion) and the per-user share rate limiter.
 * Dependency-free apart from storage and Redis, so fragments, users and social
 * can import it without circular module imports.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Share, CardImageDeletion])],
  providers: [ShareLifecycleService, ShareRateLimiter, redisProvider],
  exports: [ShareLifecycleService, ShareRateLimiter],
})
export class ShareLifecycleModule {}
