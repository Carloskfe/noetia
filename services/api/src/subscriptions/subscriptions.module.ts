import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailModule } from '../email/email.module';
import { GiftsModule } from '../gifts/gifts.module';
import { Book } from '../books/book.entity';
import { UserBook } from '../library/user-book.entity';
import { User } from '../users/user.entity';
import { UsersModule } from '../users/users.module';
import { CourtesyTokenQuota } from './courtesy-token-quota.entity';
import { Plan } from './plan.entity';
import { PlansService } from './plans.service';
import { Subscription } from './subscription.entity';
import { SubscriptionInvite } from './subscription-invite.entity';
import { SubscriptionGuard } from './subscription.guard';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { TokenLedger } from './token-ledger.entity';
import { TokenPackage } from './token-package.entity';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { AdminTokensController } from './admin-tokens.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Subscription, SubscriptionInvite, Plan, User, Book, UserBook, TokenLedger, TokenPackage, CourtesyTokenQuota]), UsersModule, EmailModule, GiftsModule],
  providers: [SubscriptionsService, PlansService, WebhooksService, SubscriptionGuard],
  controllers: [SubscriptionsController, WebhooksController, AdminTokensController],
  exports: [SubscriptionsService, SubscriptionGuard],
})
export class SubscriptionsModule {}
