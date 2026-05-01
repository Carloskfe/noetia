import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Book } from '../books/book.entity';
import { UserBook } from './user-book.entity';

@Injectable()
export class LibraryService {
  constructor(
    @InjectRepository(UserBook) private readonly repo: Repository<UserBook>,
    @InjectRepository(Book) private readonly bookRepo: Repository<Book>,
  ) {}

  async addBook(userId: string, bookId: string): Promise<void> {
    const book = await this.bookRepo.findOneBy({ id: bookId, isPublished: true });
    if (!book) throw new NotFoundException('Book not found');

    try {
      await this.repo.insert({ userId, bookId });
    } catch (err: any) {
      // Unique constraint violation — already in library, treat as success
      if (err?.code === '23505') return;
      throw err;
    }
  }

  async removeBook(userId: string, bookId: string): Promise<void> {
    await this.repo.delete({ userId, bookId });
  }

  async getUserLibrary(userId: string): Promise<Book[]> {
    const entries = await this.repo.find({
      where: { userId },
      relations: ['book'],
      order: { addedAt: 'DESC' },
    });
    return entries.map((e) => e.book).filter(Boolean);
  }

  async getUserBookIds(userId: string): Promise<string[]> {
    const entries = await this.repo.find({ where: { userId }, select: ['bookId'] });
    return entries.map((e) => e.bookId);
  }

  async hasBook(userId: string, bookId: string): Promise<boolean> {
    return this.repo.existsBy({ userId, bookId });
  }
}
