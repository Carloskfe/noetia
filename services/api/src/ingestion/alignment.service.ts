import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Book } from '../books/book.entity';
import { SyncMap } from '../books/sync-map.entity';
import { SyncPhrase } from '../books/sync-map.entity';

export interface Chapter {
  title: string;
  startMs: number;
  endMs: number;
}

@Injectable()
export class AlignmentService {
  private readonly logger = new Logger(AlignmentService.name);
  private readonly imageGenUrl: string;

  constructor(
    @InjectRepository(Book) private readonly bookRepo: Repository<Book>,
    @InjectRepository(SyncMap) private readonly syncMapRepo: Repository<SyncMap>,
    config: ConfigService,
  ) {
    this.imageGenUrl = config.get('IMAGE_GEN_URL', 'http://image-gen:5000');
  }

  async alignAll(): Promise<void> {
    const books = await this.bookRepo.find({
      where: { isPublished: true, isFree: true },
    });
    for (const book of books) {
      try {
        await this.alignBook(book);
      } catch (err: unknown) {
        this.logger.error(
          `Failed to align "${book.title}"`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }
  }

  async alignBook(book: Book): Promise<void> {
    if (!book.audioStreamKey?.startsWith('http')) {
      this.logger.warn(`"${book.title}" has no HTTP audio stream — skipping`);
      return;
    }

    const syncMap = await this.syncMapRepo.findOneBy({ bookId: book.id });
    if (!syncMap?.phrases?.length) {
      this.logger.warn(`"${book.title}" has no sync map — skipping`);
      return;
    }

    const chapters = await this.fetchChapters(book.audioStreamKey);
    if (!chapters.length) {
      this.logger.warn(`"${book.title}" — ffprobe returned no chapters, skipping`);
      return;
    }

    const aligned = this.assignTimestamps(syncMap.phrases, chapters);
    await this.syncMapRepo.save({ ...syncMap, phrases: aligned });

    const nonZero = aligned.filter((p) => p.startTime > 0).length;
    this.logger.log(
      `"${book.title}" — ${chapters.length} chapters, ${aligned.length} phrases, ${nonZero} with real timestamps`,
    );
  }

  async fetchChapters(audioUrl: string): Promise<Chapter[]> {
    const url = `${this.imageGenUrl}/align/chapters?url=${encodeURIComponent(audioUrl)}`;
    const res = await fetch(url);
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`/align/chapters returned ${res.status}: ${body}`);
    }
    const data = (await res.json()) as { chapters: Chapter[] };
    return data.chapters ?? [];
  }

  /**
   * Assign real startTime/endTime to every phrase using chapter timestamps.
   *
   * Strategy:
   *  1. Find heading phrases — they mark chapter boundaries in the text.
   *  2. If the number of headings is within 2× of the chapter count, pair them
   *     1:1 (heading[i] → chapter[i]) and distribute timestamps linearly within
   *     each chapter segment by character count.
   *  3. If counts diverge too much, fall back to full-book linear distribution
   *     across the total audio duration.
   */
  assignTimestamps(phrases: SyncPhrase[], chapters: Chapter[]): SyncPhrase[] {
    const result: SyncPhrase[] = phrases.map((p) => ({ ...p }));
    const totalDurationMs = chapters[chapters.length - 1].endMs;

    const headingIdxs = phrases
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => p.type === 'heading')
      .map(({ i }) => i);

    const useChapterMapping =
      headingIdxs.length > 0 &&
      headingIdxs.length <= chapters.length * 2 &&
      chapters.length <= headingIdxs.length * 2;

    if (!useChapterMapping) {
      return this.distributeLinear(result, 0, totalDurationMs);
    }

    const segmentCount = Math.min(headingIdxs.length, chapters.length);

    for (let i = 0; i < segmentCount; i++) {
      const segStart = headingIdxs[i];
      const segEnd =
        i + 1 < headingIdxs.length ? headingIdxs[i + 1] - 1 : phrases.length - 1;
      const chapter = chapters[i];
      this.distributeSegment(result, segStart, segEnd, chapter.startMs, chapter.endMs);
    }

    // Phrases before the first heading → distribute in the lead-up to chapter 0
    if (headingIdxs[0] > 0 && chapters[0].startMs > 0) {
      this.distributeSegment(result, 0, headingIdxs[0] - 1, 0, chapters[0].startMs);
    }

    // Phrases after the last matched segment → distribute across remaining audio
    const lastMatchedPhrase =
      segmentCount < headingIdxs.length
        ? headingIdxs[segmentCount] - 1
        : phrases.length - 1;
    const lastMatchedChapterEnd = chapters[segmentCount - 1].endMs;

    if (lastMatchedPhrase < phrases.length - 1 && lastMatchedChapterEnd < totalDurationMs) {
      this.distributeSegment(result, lastMatchedPhrase + 1, phrases.length - 1, lastMatchedChapterEnd, totalDurationMs);
    }

    return result;
  }

  /** Distribute timestamps for phrases[start..end] linearly within [audioStart, audioEnd]. */
  private distributeSegment(
    phrases: SyncPhrase[],
    start: number,
    end: number,
    audioStart: number,
    audioEnd: number,
  ): void {
    const segment = phrases.slice(start, end + 1);
    const totalChars = segment.reduce((s, p) => s + (p.text.length || 1), 0);
    const duration = audioEnd - audioStart;
    let cumChars = 0;

    for (let i = start; i <= end; i++) {
      const chars = phrases[i].text.length || 1;
      phrases[i].startTime = audioStart + Math.round((cumChars / totalChars) * duration);
      cumChars += chars;
      phrases[i].endTime = audioStart + Math.round((cumChars / totalChars) * duration);
    }
  }

  /** Distribute all phrases linearly across [startMs, endMs] by character count. */
  distributeLinear(phrases: SyncPhrase[], startMs: number, endMs: number): SyncPhrase[] {
    const result = phrases.map((p) => ({ ...p }));
    this.distributeSegment(result, 0, result.length - 1, startMs, endMs);
    return result;
  }
}
