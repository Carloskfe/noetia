import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Book } from '../books/book.entity';
import { UserBook } from './user-book.entity';
import { LibraryController } from './library.controller';
import { LibraryService } from './library.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserBook, Book])],
  controllers: [LibraryController],
  providers: [LibraryService],
  exports: [LibraryService],
})
export class LibraryModule {}
