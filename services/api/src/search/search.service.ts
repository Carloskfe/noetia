import { Inject, Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Index } from 'meilisearch';
import { Book } from '../books/book.entity';
import { SyncMap } from '../books/sync-map.entity';
import { MEILI_INDEX } from './search.constants';

// Mirrors the discovery gate in BooksService.findAll — keep them in sync.
const SYNC_COVERAGE_GATE = 0.9;

type BookDoc = {
  id: string;
  title: string;
  author: string;
  description: string;
  category: string;
  language: string;
  isFree: boolean;
  isPublished: boolean;
  // True when the title may be offered: a genuine author/publisher upload, or a
  // free-library book whose Whisper sync map clears the coverage gate. Search
  // filters on this so below-standard titles (e.g. auto-aligned books awaiting a
  // Whisper map) never surface — same rule discovery and collections enforce.
  meetsStandard: boolean;
  coverUrl: string | null;
  createdAt: string;
};

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    @Inject(MEILI_INDEX) private readonly index: Index<BookDoc>,
    @InjectRepository(SyncMap) private readonly syncMapRepo: Repository<SyncMap>,
  ) {}

  async onModuleInit() {
    await this.index
      .updateSettings({
        searchableAttributes: ['title', 'author', 'description'],
        filterableAttributes: ['category', 'isFree', 'isPublished', 'language', 'meetsStandard'],
        sortableAttributes: ['createdAt'],
      })
      .catch((err: Error) =>
        this.logger.warn(`Meilisearch settings update failed: ${err.message}`),
      );
  }

  /** Book ids (from the given set) that have a sync map clearing the gate. */
  private async gatedBookIds(bookIds: string[]): Promise<Set<string>> {
    if (!bookIds.length) return new Set();
    const rows = await this.syncMapRepo
      .createQueryBuilder('sm')
      .select('DISTINCT sm.bookId', 'bookId')
      .where('sm.bookId IN (:...ids)', { ids: bookIds })
      .andWhere('sm.syncCoverage >= :gate', { gate: SYNC_COVERAGE_GATE })
      .getRawMany<{ bookId: string }>();
    return new Set(rows.map((r) => r.bookId));
  }

  private toDoc(book: Book, meetsStandard: boolean): BookDoc {
    return {
      id: book.id,
      title: book.title,
      author: book.author,
      description: book.description ?? '',
      category: book.category,
      language: book.language,
      isFree: book.isFree,
      isPublished: book.isPublished,
      meetsStandard,
      coverUrl: book.coverUrl ?? null,
      createdAt: book.createdAt?.toISOString() ?? new Date().toISOString(),
    };
  }

  async indexBook(book: Book): Promise<void> {
    // Author uploads are gated by the admin flow; free-library books need a
    // qualifying Whisper sync map.
    const meetsStandard = book.uploadedById != null || (await this.gatedBookIds([book.id])).has(book.id);
    await this.index
      .addDocuments([this.toDoc(book, meetsStandard)], { primaryKey: 'id' })
      .catch((err: Error) => this.logger.warn(`Index book failed (${book.id}): ${err.message}`));
  }

  async removeBook(bookId: string): Promise<void> {
    await this.index
      .deleteDocument(bookId)
      .catch((err: Error) => this.logger.warn(`Remove book failed (${bookId}): ${err.message}`));
  }

  async search(q: string, options: { category?: string; isFree?: boolean }) {
    const filter: string[] = ['isPublished = true', 'meetsStandard = true'];
    if (options.category) filter.push(`category = "${options.category}"`);
    // Public search defaults to the free library; author/paid titles opt in.
    filter.push(`isFree = ${options.isFree ?? true}`);

    return this.index.search(q, {
      filter: filter.join(' AND '),
      limit: 20,
    });
  }

  async indexAll(books: Book[]): Promise<void> {
    const gated = await this.gatedBookIds(books.map((b) => b.id));
    const docs = books.map((book) =>
      this.toDoc(book, book.uploadedById != null || gated.has(book.id)),
    );
    await this.index.addDocuments(docs, { primaryKey: 'id' });
  }
}
