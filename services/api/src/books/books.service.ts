import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { Book, BookCategory } from './book.entity';
import { CreateBookDto } from './dto/create-book.dto';

@Injectable()
export class BooksService {
  constructor(@InjectRepository(Book) private readonly repo: Repository<Book>) {}

  findAll(category?: BookCategory, isFree?: boolean): Promise<Book[]> {
    const where: FindOptionsWhere<Book> = { isPublished: true };
    if (category) where.category = category;
    if (isFree !== undefined) where.isFree = isFree;
    return this.repo.find({ where, order: { createdAt: 'DESC' } });
  }

  async findById(id: string): Promise<Book> {
    const book = await this.repo.findOneBy({ id });
    if (!book) throw new NotFoundException('Book not found');
    return book;
  }

  findPending(): Promise<Book[]> {
    return this.repo.find({
      where: { isPublished: false },
      relations: ['uploadedBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async publish(id: string): Promise<Book> {
    const book = await this.findById(id);
    book.isPublished = true;
    return this.repo.save(book);
  }

  async remove(id: string): Promise<void> {
    const book = await this.findById(id);
    await this.repo.remove(book);
  }

  create(
    dto: CreateBookDto,
    textFileKey?: string,
    audioFileKey?: string,
    uploadedById?: string,
    isPublished = false,
  ): Promise<Book> {
    const book = this.repo.create({
      ...dto,
      language: dto.language ?? 'es',
      textFileKey: textFileKey ?? null,
      audioFileKey: audioFileKey ?? null,
      uploadedById: uploadedById ?? null,
      isPublished,
    });
    return this.repo.save(book);
  }
}
