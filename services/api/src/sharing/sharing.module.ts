import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Fragment } from '../fragments/fragment.entity';
import { Book } from '../books/book.entity';
import { SyncMap } from '../books/sync-map.entity';
import { EventsModule } from '../events/events.module';
import { Share } from './share.entity';
import { SharingService } from './sharing.service';
import { SharingController } from './sharing.controller';
import { QuoteIntegrityService } from './quote-integrity.service';
import { ShareLifecycleModule } from './share-lifecycle.module';

@Module({
  imports: [TypeOrmModule.forFeature([Fragment, Book, Share, SyncMap]), EventsModule, ShareLifecycleModule],
  providers: [SharingService, QuoteIntegrityService],
  controllers: [SharingController],
})
export class SharingModule {}
