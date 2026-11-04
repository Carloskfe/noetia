import { createHash } from 'crypto';
import {
  Injectable,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Book } from '../books/book.entity';
import { SyncMap } from '../books/sync-map.entity';
import { QUOTE_SOURCE_READ_TIMEOUT_MS, StorageService } from '../storage/storage.service';
import { QuoteProvenance, checkQuoteAgainstSource, normalizeTypography } from './quote-integrity';

// Re-exported so existing imports of the rules from this file keep working.
export * from './quote-integrity';

const CACHE_MAX_BOOKS = 8;
const CACHE_TTL_MS = 10 * 60_000;

@Injectable()
export class QuoteIntegrityService {
  private readonly cache = new Map<
    string,
    { text: string; kind: QuoteProvenance['source']; sha: string; at: number }
  >();

  constructor(
    @InjectRepository(SyncMap) private readonly syncMapRepo: Repository<SyncMap>,
    private readonly storage: StorageService,
  ) {}

  /**
   * Throws 422 `quote_not_in_source` (with `reason`) unless `quote` is a
   * faithful excerpt; otherwise returns its provenance.
   */
  async assertFaithfulExcerpt(book: Book, quote: string): Promise<QuoteProvenance> {
    const source = await this.loadSource(book);
    const result = checkQuoteAgainstSource(quote, source.text);
    if (!result.ok) {
      throw new UnprocessableEntityException({ error: 'quote_not_in_source', reason: result.reason });
    }
    return {
      v: 1,
      source: source.kind,
      sourceSha256: source.sha,
      spans: result.spans,
      checkedAt: new Date().toISOString(),
    };
  }

  private async loadSource(book: Book) {
    const hit = this.cache.get(book.id);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit;

    let raw = '';
    let kind: QuoteProvenance['source'] = 'sync_map';
    const syncMap = await this.syncMapRepo.findOneBy({ bookId: book.id });
    if (syncMap?.phrases?.length) {
      raw = syncMap.phrases.map((p) => p.text ?? '').join(' ');
    } else if (book.textFileKey) {
      kind = 'text_file';
      try {
        raw = await this.storage.getText(book.textFileKey, 'books', { timeoutMs: QUOTE_SOURCE_READ_TIMEOUT_MS });
      } catch {
        throw new ServiceUnavailableException({ error: 'quote_source_unavailable' });
      }
    }
    if (!raw.trim()) {
      // No source to verify against: refuse rather than attribute unverified text.
      throw new UnprocessableEntityException({ error: 'quote_not_in_source', reason: 'no_source' });
    }

    const text = normalizeTypography(raw);
    const entry = { text, kind, sha: createHash('sha256').update(text).digest('hex'), at: Date.now() };
    if (this.cache.size >= CACHE_MAX_BOOKS) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.set(book.id, entry);
    return entry;
  }
}
