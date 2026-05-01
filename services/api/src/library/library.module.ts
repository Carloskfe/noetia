import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Book } from '../books/book.entity';
import { BookCollection } from './book-collection.entity';
import { Collection } from './collection.entity';
import { CollectionsController } from './collections.controller';
import { CollectionsService } from './collections.service';
import { LibraryController } from './library.controller';
import { LibraryService } from './library.service';
import { UserBook } from './user-book.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserBook, Book, Collection, BookCollection])],
  controllers: [LibraryController, CollectionsController],
  providers: [LibraryService, CollectionsService],
  exports: [LibraryService, CollectionsService],
})
export class LibraryModule {}
