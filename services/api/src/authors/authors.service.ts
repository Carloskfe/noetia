import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Book } from '../books/book.entity';

@Injectable()
export class AuthorsService {
  constructor(@InjectRepository(Book) private readonly booksRepo: Repository<Book>) {}

  findMyBooks(userId: string): Promise<Book[]> {
    return this.booksRepo.find({
      where: { uploadedById: userId },
      order: { createdAt: 'DESC' },
    });
  }
}
