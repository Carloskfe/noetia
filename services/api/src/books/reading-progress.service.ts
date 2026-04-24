import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReadingProgress } from './reading-progress.entity';

@Injectable()
export class ReadingProgressService {
  constructor(
    @InjectRepository(ReadingProgress) private readonly repo: Repository<ReadingProgress>,
  ) {}

  async findByUserAndBook(userId: string, bookId: string): Promise<ReadingProgress | null> {
    return this.repo.findOneBy({ userId, bookId });
  }

  async upsert(userId: string, bookId: string, phraseIndex: number): Promise<ReadingProgress> {
    const existing = await this.repo.findOneBy({ userId, bookId });
    if (existing) {
      existing.phraseIndex = phraseIndex;
      return this.repo.save(existing);
    }
    const record = this.repo.create({ userId, bookId, phraseIndex });
    return this.repo.save(record);
  }
}
