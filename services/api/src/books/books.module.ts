import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Book } from './book.entity';
import { SyncMap } from './sync-map.entity';
import { ReadingProgress } from './reading-progress.entity';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';
import { SyncMapService } from './sync-map.service';
import { ReadingProgressService } from './reading-progress.service';

@Module({
  imports: [TypeOrmModule.forFeature([Book, SyncMap, ReadingProgress])],
  controllers: [BooksController],
  providers: [BooksService, SyncMapService, ReadingProgressService],
  exports: [BooksService],
})
export class BooksModule {}
