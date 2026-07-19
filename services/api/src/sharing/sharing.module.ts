import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Fragment } from '../fragments/fragment.entity';
import { Book } from '../books/book.entity';
import { Share } from './share.entity';
import { SharingService } from './sharing.service';
import { SharingController } from './sharing.controller';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [TypeOrmModule.forFeature([Fragment, Book, Share]), EventsModule],
  providers: [SharingService],
  controllers: [SharingController],
})
export class SharingModule {}
