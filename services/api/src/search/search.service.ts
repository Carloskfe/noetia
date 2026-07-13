import { Inject, Injectable, OnModuleInit, Logger } from '@nestjs/common';
import type { Index } from 'meilisearch';
import { Book } from '../books/book.entity';
import { MEILI_INDEX } from './search.constants';

type BookDoc = {
  id: string;
  title: string;
  author: string;
  description: string;
  category: string;
  language: string;
  isFree: boolean;
  isPublished: boolean;
  coverUrl: string | null;
  createdAt: string;
};

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name);

  constructor(@Inject(MEILI_INDEX) private readonly index: Index<BookDoc>) {}

  async onModuleInit() {
    await this.index
      .updateSettings({
        searchableAttributes: ['title', 'author', 'description'],
        filterableAttributes: ['category', 'isFree', 'isPublished', 'language'],
        sortableAttributes: ['createdAt'],
      })
      .catch((err: Error) =>
        this.logger.warn(`Meilisearch settings update failed: ${err.message}`),
      );
  }

  async indexBook(book: Book): Promise<void> {
    const doc: BookDoc = {
      id: book.id,
      title: book.title,
      author: book.author,
      description: book.description ?? '',
      category: book.category,
      language: book.language,
      isFree: book.isFree,
      isPublished: book.isPublished,
      coverUrl: book.coverUrl ?? null,
      createdAt: book.createdAt?.toISOString() ?? new Date().toISOString(),
    };
    await this.index
      .addDocuments([doc], { primaryKey: 'id' })
      .catch((err: Error) => this.logger.warn(`Index book failed (${book.id}): ${err.message}`));
  }

  async removeBook(bookId: string): Promise<void> {
    await this.index
      .deleteDocument(bookId)
      .catch((err: Error) => this.logger.warn(`Remove book failed (${bookId}): ${err.message}`));
  }

  async search(q: string, options: { category?: string; isFree?: boolean }) {
    const filter: string[] = ['isPublished = true'];
    if (options.category) filter.push(`category = "${options.category}"`);
    // Only offer books that meet the standard. Culled below-standard titles are
    // isFree=false, so default the public search to free-only — never surface a
    // title that would error when opened. (The index lacks uploadedById/sync
    // coverage; when author books enter search, index a `meetsStandard` flag and
    // filter on that instead so paid-but-complete author titles remain findable.)
    filter.push(`isFree = ${options.isFree ?? true}`);

    return this.index.search(q, {
      filter: filter.join(' AND '),
      limit: 20,
    });
  }

  async indexAll(books: Book[]): Promise<void> {
    const docs: BookDoc[] = books.map((book) => ({
      id: book.id,
      title: book.title,
      author: book.author,
      description: book.description ?? '',
      category: book.category,
      language: book.language,
      isFree: book.isFree,
      isPublished: book.isPublished,
      coverUrl: book.coverUrl ?? null,
      createdAt: book.createdAt?.toISOString() ?? new Date().toISOString(),
    }));
    await this.index.addDocuments(docs, { primaryKey: 'id' });
  }
}
