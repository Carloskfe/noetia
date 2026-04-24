import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SyncMap, SyncPhrase } from './sync-map.entity';
import { BooksService } from './books.service';

@Injectable()
export class SyncMapService {
  constructor(
    @InjectRepository(SyncMap) private readonly repo: Repository<SyncMap>,
    private readonly booksService: BooksService,
  ) {}

  async findByBook(bookId: string): Promise<SyncMap | null> {
    return this.repo.findOneBy({ bookId });
  }

  async upsert(bookId: string, phrases: SyncPhrase[]): Promise<SyncMap> {
    await this.booksService.findById(bookId); // throws 404 if book missing

    const existing = await this.repo.findOneBy({ bookId });
    if (existing) {
      existing.phrases = phrases;
      existing.updatedAt = new Date();
      return this.repo.save(existing);
    }

    const record = this.repo.create({ bookId, phrases });
    return this.repo.save(record);
  }
}
