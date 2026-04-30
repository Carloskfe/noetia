import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Book } from './book.entity';
import { User } from '../users/user.entity';
import { SyncMap } from './sync-map.entity';
import { ReadingProgress } from './reading-progress.entity';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';
import { SyncMapService } from './sync-map.service';
import { ReadingProgressService } from './reading-progress.service';
import { Subscription } from '../subscriptions/subscription.entity';
import { FragmentsModule } from '../fragments/fragments.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [TypeOrmModule.forFeature([Book, SyncMap, ReadingProgress, Subscription, User]), FragmentsModule, SubscriptionsModule],
  controllers: [BooksController],
  providers: [BooksService, SyncMapService, ReadingProgressService],
  exports: [BooksService],
})
export class BooksModule {}
