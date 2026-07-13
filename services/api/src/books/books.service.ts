import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, IsNull, Repository } from 'typeorm';
import { Book, BookCategory } from './book.entity';
import { CreateBookDto } from './dto/create-book.dto';
import { HostingTier, HOSTING_TIER_LIMITS, User } from '../users/user.entity';

@Injectable()
export class BooksService {
  constructor(
    @InjectRepository(Book) private readonly repo: Repository<Book>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  findAll(category?: BookCategory, isFree?: boolean, standalone = true): Promise<Book[]> {
    const qb = this.repo.createQueryBuilder('book')
      .where('book.isPublished = :published', { published: true })
      .orderBy('book.createdAt', 'DESC');
    if (category) qb.andWhere('book.category = :category', { category });
    if (isFree !== undefined) qb.andWhere('book.isFree = :isFree', { isFree });
    // Exclude books that have an entry in book_collections (i.e. belong to a collection).
    // Using the join table rather than book.collection VARCHAR so the filter works
    // even when the VARCHAR field was never populated (e.g. books ingested after migrations).
    if (standalone) qb.andWhere('NOT EXISTS (SELECT 1 FROM book_collections bc WHERE bc."bookId" = book.id)');
    // Quality gate: never surface a title we can't offer cleanly (incomplete /
    // no audio / poor sync produces errors in front of the user). An INGESTED
    // (free-library) book must have a Whisper sync map ≥ 90% coverage; if it was
    // culled below the gate it stays hidden — being isFree=false is NOT a pass
    // (that previously let culled books like Don Quijote leak into discovery).
    // Only genuine AUTHOR/publisher uploads (uploadedById set) bypass the gate —
    // authors manage their own quality through the admin flow.
    qb.andWhere(`(
      book."uploadedById" IS NOT NULL
      OR EXISTS (
        SELECT 1 FROM sync_maps sm
        WHERE sm."bookId" = book.id
          AND sm."syncCoverage" >= 0.90
      )
    )`);
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
    await this.repo.remove(book);
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
