import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { Book, BookCategory } from './book.entity';
import { CreateBookDto } from './dto/create-book.dto';

@Injectable()
export class BooksService {
  constructor(@InjectRepository(Book) private readonly repo: Repository<Book>) {}

  findAll(category?: BookCategory): Promise<Book[]> {
    const where: FindOptionsWhere<Book> = { isPublished: true };
    if (category) where.category = category;
    return this.repo.find({ where, order: { createdAt: 'DESC' } });
  }

  async findById(id: string): Promise<Book> {
    const book = await this.repo.findOneBy({ id });
    if (!book) throw new NotFoundException('Book not found');
    return book;
  }

  create(dto: CreateBookDto, textFileKey?: string, audioFileKey?: string): Promise<Book> {
    const book = this.repo.create({
      ...dto,
      language: dto.language ?? 'es',
      textFileKey: textFileKey ?? null,
      audioFileKey: audioFileKey ?? null,
      isPublished: false,
    });
    return this.repo.save(book);
  }
}
