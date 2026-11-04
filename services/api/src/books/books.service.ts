import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ShareLifecycleService } from '../sharing/share-lifecycle.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Book, BookCategory } from './book.entity';
import { CreateBookDto } from './dto/create-book.dto';
import { HostingTier, HOSTING_TIER_LIMITS, User } from '../users/user.entity';
import { qualityGateSql } from './book-eligibility';

@Injectable()
export class BooksService {
  constructor(
    @InjectRepository(Book) private readonly repo: Repository<Book>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly shareLifecycle: ShareLifecycleService,
  ) {}

  findAll(
    category?: BookCategory,
    isFree?: boolean,
    standalone = true,
    search?: string,
    limit?: number,
  ): Promise<Book[]> {
    const qb = this.repo.createQueryBuilder('book')
      .where('book.isPublished = :published', { published: true })
      .orderBy('book.createdAt', 'DESC');
    if (category) qb.andWhere('book.category = :category', { category });
    if (isFree !== undefined) qb.andWhere('book.isFree = :isFree', { isFree });
    // Case-insensitive title/author match for typeahead search (e.g. the club
    // book picker). Without this, GET /books?search= was silently ignored, so the
    // picker showed an unfiltered list — a typed title never narrowed results.
    const term = search?.trim();
    if (term) {
      qb.andWhere('(book.title ILIKE :search OR book.author ILIKE :search)', {
        search: `%${term}%`,
      });
    }
    // Exclude books that have an entry in book_collections (i.e. belong to a collection).
    // Using the join table rather than book.collection VARCHAR so the filter works
    // even when the VARCHAR field was never populated (e.g. books ingested after migrations).
    if (standalone) qb.andWhere('NOT EXISTS (SELECT 1 FROM book_collections bc WHERE bc."bookId" = book.id)');
    // Quality gate — see book-eligibility.ts (shared with public sharing).
    qb.andWhere(qualityGateSql('book'));
    if (limit && limit > 0) qb.take(limit);
    return qb.getMany();
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
    // Deleting a book withdraws its public shares (NEM-016 F2): revocation, the
    // image-deletion outbox rows and the delete commit together.
    const imageKeys = await this.repo.manager.transaction(async (m) => {
      const keys = await this.shareLifecycle.revokeForBook(id, m);
      await m.remove(book);
      return keys;
    });
    await this.shareLifecycle.purgeImages(imageKeys);
  }

  async checkUploadQuota(userId: string): Promise<void> {
    const user = await this.userRepo.findOneBy({ id: userId });
    const tier = user?.hostingTier ?? HostingTier.BASIC;
    const limit = HOSTING_TIER_LIMITS[tier];
    const count = await this.repo.count({ where: { uploadedById: userId } });
    if (count >= limit) {
      throw new ForbiddenException(
        `Tu plan ${tier} permite hasta ${limit} libro(s). Actualiza tu plan para subir más.`,
      );
    }
  }

  create(
    dto: CreateBookDto,
    textFileKey?: string,
    audioFileKey?: string,
    uploadedById?: string,
    isPublished = false,
    textFileSizeBytes?: number,
    audioFileSizeBytes?: number,
  ): Promise<Book> {
    const book = this.repo.create({
      ...dto,
      language: dto.language ?? 'es',
      textFileKey: textFileKey ?? null,
      audioFileKey: audioFileKey ?? null,
      uploadedById: uploadedById ?? null,
      isPublished,
      textFileSizeBytes: textFileSizeBytes ?? null,
      audioFileSizeBytes: audioFileSizeBytes ?? null,
    });
    return this.repo.save(book);
  }
}
