import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
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

  /**
   * Adds a FREE book to the user's library. A `user_books` row is permanent
   * ownership (the reader's SubscriptionGuard grants content for it), so paid
   * books are acquired only through token redemption or a Stripe purchase —
   * never here (NEM-011).
   */
  async addBook(userId: string, bookId: string): Promise<void> {
    const book = await this.bookRepo.findOneBy({ id: bookId, isPublished: true });
    if (!book) throw new NotFoundException('Book not found');
    if (!book.isFree) throw new ForbiddenException({ error: 'acquisition_required' });

    try {
      await this.repo.insert({ userId, bookId, purchaseType: 'free' });
    } catch (err: any) {
      // Unique constraint violation — already in library, treat as success
      if (err?.code === '23505') return;
      throw err;
    }
  }

  /**
   * Removes a free-library entry. Acquired ownership (token, purchase, courtesy)
   * and any row on a paid book are never deleted from here — ownership is
   * permanent (NEM-011).
   */
  async removeBook(userId: string, bookId: string): Promise<void> {
    const entry = await this.repo.findOne({ where: { userId, bookId }, relations: ['book'] });
    if (!entry) return;
    if (entry.purchaseType !== 'free' || !entry.book?.isFree) {
      throw new ConflictException({ error: 'acquired_book_cannot_be_removed' });
    }
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
