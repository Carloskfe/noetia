import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Book, BookCategory } from '../books/book.entity';
import { SyncMap } from '../books/sync-map.entity';
import { CATALOGUE, CatalogueEntry } from './catalogue';
import { GutenbergFetcherService } from './gutenberg-fetcher.service';
import { WikisourceFetcherService } from './wikisource-fetcher.service';
import { PhraseSplitterService } from './phrase-splitter.service';
import { MinioUploaderService } from './minio-uploader.service';
import { LibrivoxApiService } from './librivox-api.service';
import { AudioDownloaderService } from './audio-downloader.service';

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    private readonly gutenbergFetcher: GutenbergFetcherService,
    private readonly wikisourceFetcher: WikisourceFetcherService,
    private readonly phraseSplitter: PhraseSplitterService,
    private readonly minioUploader: MinioUploaderService,
    private readonly librivoxApi: LibrivoxApiService,
    private readonly audioDownloader: AudioDownloaderService,
    @InjectRepository(Book) private readonly bookRepo: Repository<Book>,
    @InjectRepository(SyncMap) private readonly syncMapRepo: Repository<SyncMap>,
  ) {}

  // ── Text ingestion ─────────────────────────────────────────────────────────

  async ingestAll(): Promise<void> {
    for (const entry of CATALOGUE) {
      try {
        await this.ingestOne(entry);
        this.logger.log(`Ingested: ${entry.title}`);
      } catch (err: unknown) {
        this.logger.error(
          `Failed: ${entry.title}`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }
  }

  async ingestOne(entry: CatalogueEntry): Promise<Book> {
    const existing = await this.bookRepo.findOneBy({
      title: entry.title,
      author: entry.author,
    });
    if (existing) {
      this.logger.log(`Skipping (already exists): ${entry.title}`);
      return existing;
    }

    const text =
      entry.source === 'gutenberg'
        ? await this.gutenbergFetcher.fetch(entry.gutenbergId!)
        : await this.wikisourceFetcher.fetch(entry.wikisourceTitle!);

    const phrases = this.phraseSplitter.split(text);

    const book = this.bookRepo.create({
      title: entry.title,
      author: entry.author,
      description: entry.description,
      category: BookCategory.CLASSIC,
      isFree: true,
      isPublished: true,
      language: 'es',
      audioFileKey: entry.librivoxAudioUrl,
    });
    const saved = await this.bookRepo.save(book);

    const textKey = `${saved.id}.txt`;
    await this.minioUploader.upload(textKey, text);

    saved.textFileKey = textKey;
    await this.bookRepo.save(saved);

    const syncMap = this.syncMapRepo.create({ bookId: saved.id, phrases });
    await this.syncMapRepo.save(syncMap);

    return saved;
  }

  // ── Audio ingestion ────────────────────────────────────────────────────────

  async ingestAllAudio(): Promise<void> {
    const books = await this.bookRepo.find({ where: { isFree: true } });
    for (const book of books) {
      if (book.audioFileKey && !book.audioFileKey.startsWith('http')) {
        this.logger.log(`Audio already stored: ${book.title}`);
        continue;
      }
      const entry = CATALOGUE.find(
        (e) => e.title === book.title && e.author === book.author,
      );
      if (!entry) {
        this.logger.warn(`No catalogue entry for: ${book.title}`);
        continue;
      }
      try {
        await this.ingestAudio(entry, book);
        this.logger.log(`Audio downloaded: ${book.title}`);
      } catch (err: unknown) {
        this.logger.error(
          `Audio failed: ${book.title}`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }
  }

  async ingestAudio(entry: CatalogueEntry, book: Book): Promise<void> {
    const zipUrl = await this.librivoxApi.getZipUrl(entry.librivoxAudioUrl);
    const audioKey = `${book.id}.zip`;
    await this.audioDownloader.downloadAndStore(zipUrl, audioKey);
    book.audioFileKey = audioKey;
    await this.bookRepo.save(book);
  }

  // ── Audio stream URL ingestion (M4B, browser-playable) ────────────────────

  async ingestAllAudioStream(): Promise<void> {
    const books = await this.bookRepo.find({ where: { isFree: true } });
    for (const book of books) {
      if (book.audioStreamKey) {
        this.logger.log(`Stream key already set: ${book.title}`);
        continue;
      }
      const entry = CATALOGUE.find(
        (e) => e.title === book.title && e.author === book.author,
      );
      if (!entry) {
        this.logger.warn(`No catalogue entry for: ${book.title}`);
        continue;
      }
      try {
        await this.ingestAudioStream(entry, book);
        this.logger.log(`Stream URL stored: ${book.title}`);
      } catch (err: unknown) {
        this.logger.error(
          `Stream URL failed: ${book.title}`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }
  }

  async ingestAudioStream(entry: CatalogueEntry, book: Book): Promise<void> {
    const m4bUrl = await this.librivoxApi.getM4bUrl(entry.librivoxAudioUrl);
    book.audioStreamKey = m4bUrl;
    await this.bookRepo.save(book);
  }

  // ── SyncMap resync (fixes wrong chapter order without re-ingesting) ─────────

  async resyncWikisourceSyncMaps(): Promise<void> {
    const wikisourceEntries = CATALOGUE.filter((e) => e.source === 'wikisource');
    for (const entry of wikisourceEntries) {
      const book = await this.bookRepo.findOneBy({ title: entry.title, author: entry.author });
      if (!book) {
        this.logger.log(`Not yet ingested, skipping resync: ${entry.title}`);
        continue;
      }
      try {
        await this.resyncSyncMap(entry, book);
        this.logger.log(`Re-synced: ${entry.title}`);
      } catch (err: unknown) {
        this.logger.error(
          `Resync failed: ${entry.title}`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }
  }

  async resyncSyncMap(entry: CatalogueEntry, book: Book): Promise<void> {
    const text = await this.wikisourceFetcher.fetch(entry.wikisourceTitle!);
    const phrases = this.phraseSplitter.split(text);
    await this.syncMapRepo.delete({ bookId: book.id });
    const syncMap = this.syncMapRepo.create({ bookId: book.id, phrases });
    await this.syncMapRepo.save(syncMap);
  }

  // ── Cover image ingestion (Open Library CDN) ──────────────────────────────

  async ingestAllCovers(): Promise<void> {
    const books = await this.bookRepo.find({ where: { isFree: true } });
    for (const book of books) {
      if (book.coverUrl) {
        this.logger.log(`Cover already set: ${book.title}`);
        continue;
      }
      try {
        const url = await this.fetchOpenLibraryCover(book.title, book.author);
        if (url) {
          book.coverUrl = url;
          await this.bookRepo.save(book);
          this.logger.log(`Cover set: ${book.title}`);
        } else {
          this.logger.log(`No cover found: ${book.title}`);
        }
      } catch (err: unknown) {
        this.logger.error(
          `Cover fetch failed: ${book.title}`,
          err instanceof Error ? err.message : String(err),
        );
      }
      await this.sleep(300);
    }
  }

  async fetchOpenLibraryCover(title: string, author: string): Promise<string | null> {
    const q = encodeURIComponent(`${title} ${author}`);
    const url = `https://openlibrary.org/search.json?q=${q}&limit=1&fields=cover_i`;
    const res = await globalThis.fetch(url, {
      headers: { 'User-Agent': 'Alexandria-Ingestion/1.0 (https://github.com/Carloskfe/alexandria)' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { docs?: Array<{ cover_i?: number }> };
    const coverId = data.docs?.[0]?.cover_i;
    if (!coverId) return null;
    return `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
