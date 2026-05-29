import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { readFile } from 'fs/promises';
import { Book } from '../books/book.entity';
import { SyncMap } from '../books/sync-map.entity';
import { StorageService } from '../storage/storage.service';
import { PhraseSplitterService } from './phrase-splitter.service';
import { parseWhisperFile } from './whisper-parser';
import { alignPhrases, AlignmentStats } from './phrase-aligner';

export interface WhisperSyncResult {
  bookId: string;
  title: string;
  stats: AlignmentStats;
}

@Injectable()
export class WhisperSyncService {
  private readonly logger = new Logger(WhisperSyncService.name);

  constructor(
    @InjectRepository(Book)    private readonly bookRepo: Repository<Book>,
    @InjectRepository(SyncMap) private readonly syncMapRepo: Repository<SyncMap>,
    private readonly storage: StorageService,
    private readonly splitter: PhraseSplitterService,
  ) {}

  async syncBook(bookTitle: string, transcriptPath: string): Promise<WhisperSyncResult> {
    // 1. Find the book
    const book = await this.bookRepo.findOneBy({ title: bookTitle });
    if (!book) throw new Error(`Book not found: "${bookTitle}"`);
    if (!book.textFileKey) throw new Error(`Book has no stored text: "${bookTitle}"`);

    this.logger.log(`Aligning sync map for: ${book.title}`);

    // 2. Load the stored book text and split into phrases
    const rawText = await this.storage.getText(book.textFileKey);
    const phrases = this.splitter.split(rawText);
    this.logger.log(`Phrase count: ${phrases.length}`);

    // 3. Parse the Whisper transcript
    const transcriptContent = await readFile(transcriptPath, 'utf-8');
    const timedWords = parseWhisperFile(transcriptContent, transcriptPath);
    this.logger.log(`Timed words from transcript: ${timedWords.length}`);

    // 4. Align phrases to timed words
    const { phrases: aligned, stats } = alignPhrases(phrases, timedWords);

    this.logger.log(
      `Alignment complete — aligned: ${stats.aligned}/${stats.total}, ` +
      `exceptions: ${stats.exceptions}, avg confidence: ${(stats.avgConfidence * 100).toFixed(1)}%, ` +
      `low-confidence: ${stats.lowConfidence}`,
    );

    if (stats.exceptions > 0) {
      this.logger.warn(`${stats.exceptions} phrase(s) marked as exceptions (not found in audio):`);
      for (const p of stats.exceptionPhrases.slice(0, 10)) {
        this.logger.warn(`  [${p.index}] "${p.text}"`);
      }
      if (stats.exceptionPhrases.length > 10) {
        this.logger.warn(`  ... and ${stats.exceptionPhrases.length - 10} more`);
      }
    }

    if (stats.lowConfidencePhrases.length > 0) {
      this.logger.warn('Low-confidence phrases (spot-check recommended):');
      for (const p of stats.lowConfidencePhrases.slice(0, 10)) {
        this.logger.warn(`  [${p.index}] (${(p.confidence * 100).toFixed(0)}%) "${p.text}"`);
      }
      if (stats.lowConfidencePhrases.length > 10) {
        this.logger.warn(`  ... and ${stats.lowConfidencePhrases.length - 10} more`);
      }
    }

    // 5. Upsert the sync map
    const existing = await this.syncMapRepo.findOneBy({ bookId: book.id });

    const syncCoverage = stats.total > 0 ? stats.aligned / stats.total : 0;

    if (existing) {
      existing.phrases = aligned;
      existing.syncSource = 'whisper';
      existing.syncCoverage = syncCoverage;
      existing.syncExceptions = stats.exceptions;
      existing.syncAvgConfidence = stats.avgConfidence;
      await this.syncMapRepo.save(existing);
    } else {
      await this.syncMapRepo.save(
        this.syncMapRepo.create({
          bookId: book.id,
          phrases: aligned,
          syncSource: 'whisper',
          syncCoverage,
          syncExceptions: stats.exceptions,
          syncAvgConfidence: stats.avgConfidence,
        }),
      );
    }

    this.logger.log(`Sync map saved for: ${book.title}`);

    return { bookId: book.id, title: book.title, stats };
  }
}
