import { KnowledgeDbService } from '../common/knowledge-db.service';
import { computeTextHash } from '../rights/text-hash';
import { chunkText } from './chunker';
import { IndexingDenialReason, IndexingPermission } from './indexing-permission';
import { IndexOutcome, RetrievalMetricsService } from './retrieval-metrics.service';
import {
  BookTextPort,
  decodeUtf8,
  PREVIOUS_SET_HARD_CAP_HOURS,
  RetrievalConfig,
  RetrievalLanguage,
  retrievalLanguage,
} from './retrieval.types';

/** Per-language search configuration (constants; never derived from input). */
export const SEARCH_CONFIG: Record<RetrievalLanguage, string> = { es: 'noetia_es', en: 'noetia_en', simple: 'noetia_simple' };

export type IndexSkipReason =
  | 'book_not_found'
  | 'not_published'
  | 'no_stored_text'
  | IndexingDenialReason
  | 'hash_mismatch'
  | 'too_many_chunks'
  | 'index_size_budget'
  | 'retention_previous_set_pending'
  | 'text_unreadable'
  | 'text_not_utf8'
  | 'empty_text';

export interface IndexResult {
  outcome: IndexOutcome;
  reason?: IndexSkipReason;
  chunks?: number;
  textHash?: string;
}

class SizeBudgetExceeded extends Error {}
class RetentionPending extends Error {}

/**
 * NEM-023 §5.3 indexer (explicit, offline command; concurrency 1). For one book:
 * scope (published, stored text) → book-level `IndexingPermission` (default deny) → read the MinIO bytes →
 * `computeTextHash(bytes)` must equal the permitted hash → chunk → write ONE complete set in ONE transaction.
 *
 * Idempotent (an existing set for the hash is skipped) and resumable (`indexAll` walks books in id order).
 * Writes only `ai_book_chunks`: never sync maps, fragments, reader data, or rights records. Stores no verbatim text
 * (S2): the `tsvector` is computed in the INSERT from the text sent as a transient parameter.
 */
export class BookIndexer {
  constructor(
    private readonly db: KnowledgeDbService,
    private readonly permission: IndexingPermission,
    private readonly text: BookTextPort,
    private readonly metrics: RetrievalMetricsService,
    private readonly config: RetrievalConfig,
  ) {}

  private done(outcome: IndexOutcome, extra: Omit<IndexResult, 'outcome'> = {}): IndexResult {
    this.metrics.indexBooksInc(outcome);
    return { outcome, ...extra };
  }

  async indexBook(bookId: string, now = new Date()): Promise<IndexResult> {
    const [book] = await this.db.query<{ language: string | null; textFileKey: string | null; isPublished: boolean }>(
      `SELECT language, "textFileKey", "isPublished" FROM books WHERE id = $1`, [bookId],
    );
    if (!book) return this.done('skipped_scope', { reason: 'book_not_found' });
    if (!book.isPublished) return this.done('skipped_scope', { reason: 'not_published' });
    if (!book.textFileKey) return this.done('skipped_scope', { reason: 'no_stored_text' });

    const decision = await this.permission.check(bookId, now);
    if (!decision.permitted) return this.done('skipped_scope', { reason: decision.reason });
    const textHash = decision.textHash;

    const sets = await this.sets(bookId);
    if (sets.includes(textHash)) return this.done('exists', { textHash });
    if (sets.length >= 2) return this.done('skipped_limit', { reason: 'retention_previous_set_pending', textHash });
    if ((await this.indexBytes()) >= this.config.maxIndexBytes) return this.done('skipped_limit', { reason: 'index_size_budget', textHash });

    let bytes: Uint8Array;
    try {
      bytes = await this.text.read(book.textFileKey);
    } catch {
      return this.done('failed', { reason: 'text_unreadable', textHash });
    }
    if (computeTextHash(bytes) !== textHash) return this.done('skipped_scope', { reason: 'hash_mismatch', textHash });
    let text: string;
    try {
      text = decodeUtf8(bytes);
    } catch {
      return this.done('failed', { reason: 'text_not_utf8', textHash });
    }
    const chunks = chunkText(text, { targetChars: this.config.chunkTargetChars, overlapRatio: this.config.chunkOverlapRatio });
    if (chunks.length === 0) return this.done('skipped_scope', { reason: 'empty_text', textHash });
    if (chunks.length > this.config.maxChunksPerBook) return this.done('skipped_limit', { reason: 'too_many_chunks', textHash });

    const cps = Array.from(text);
    const language = retrievalLanguage(book.language);
    try {
      const written = await this.db.transaction(async (m) => {
        await m.query(`SET LOCAL statement_timeout = ${Math.floor(this.config.indexStatementTimeoutMs)}`);
        await m.query(`SELECT pg_advisory_xact_lock(hashtext('ai_book_chunks:' || $1::text))`, [bookId]);
        const [{ n }] = await m.query(`SELECT count(*)::int AS n FROM ai_book_chunks WHERE "bookId" = $1 AND "textHash" = $2`, [bookId, textHash]);
        if (n > 0) return 0; // a concurrent run completed the same set
        const [{ s }] = await m.query(`SELECT count(DISTINCT "textHash")::int AS s FROM ai_book_chunks WHERE "bookId" = $1`, [bookId]);
        if (s >= 2) throw new RetentionPending();
        await m.query(
          `INSERT INTO ai_book_chunks ("bookId", "textHash", "chunkIndex", "charStart", "charEnd", language, tsv)
           SELECT $1, $2, x.i, x.s, x.e, $3, to_tsvector('${SEARCH_CONFIG[language]}'::regconfig, x.t)
             FROM unnest($4::int[], $5::int[], $6::int[], $7::text[]) AS x(i, s, e, t)`,
          [
            bookId, textHash, language,
            chunks.map((c) => c.chunkIndex), chunks.map((c) => c.charStart), chunks.map((c) => c.charEnd),
            chunks.map((c) => cps.slice(c.charStart, c.charEnd).join('')),
          ],
        );
        const [{ size }] = await m.query(`SELECT pg_total_relation_size('ai_book_chunks')::bigint::text AS size`);
        if (BigInt(size) > BigInt(this.config.maxIndexBytes)) throw new SizeBudgetExceeded();
        return chunks.length;
      });
      if (written === 0) return this.done('exists', { textHash });
      return this.done('indexed', { chunks: written, textHash });
    } catch (e) {
      if (e instanceof SizeBudgetExceeded) return this.done('skipped_limit', { reason: 'index_size_budget', textHash });
      if (e instanceof RetentionPending) return this.done('skipped_limit', { reason: 'retention_previous_set_pending', textHash });
      throw e; // the transaction rolled back: no partial set exists
    }
  }

  /** Index every published book with stored text, in id order (resumable: existing sets are skipped). Concurrency 1. */
  async indexAll(now = new Date()): Promise<Record<IndexOutcome, number>> {
    const totals: Record<IndexOutcome, number> = { indexed: 0, skipped_scope: 0, skipped_limit: 0, exists: 0, failed: 0 };
    const books = await this.db.query<{ id: string }>(`SELECT id FROM books WHERE "isPublished" = true AND "textFileKey" IS NOT NULL ORDER BY id`);
    for (const b of books) {
      let r: IndexResult;
      try {
        r = await this.indexBook(b.id, now);
      } catch {
        r = this.done('failed');
      }
      totals[r.outcome]++;
    }
    return totals;
  }

  /**
   * D-7 retention: delete every superseded set (any set older than its book's newest set) once the newest set has
   * existed for `previousSetGraceHours` — clamped to the non-configurable 30-day hard cap.
   */
  async prune(now = new Date()): Promise<{ sets: number; rows: number }> {
    const hours = Math.min(Math.max(0, this.config.previousSetGraceHours), PREVIOUS_SET_HARD_CAP_HOURS);
    const [r] = await this.db.query<{ sets: number; rows: number }>(
      `WITH sets AS (
         SELECT "bookId", "textHash", min("createdAt") AS created FROM ai_book_chunks GROUP BY "bookId", "textHash"
       ), ranked AS (
         SELECT *, max(created) OVER (PARTITION BY "bookId") AS newest FROM sets
       ), d AS (
         DELETE FROM ai_book_chunks c USING ranked r
          WHERE c."bookId" = r."bookId" AND c."textHash" = r."textHash"
            AND r.created < r.newest AND r.newest <= $1::timestamptz - make_interval(hours => $2::int)
         RETURNING c."bookId", c."textHash"
       )
       SELECT count(DISTINCT ("bookId", "textHash"))::int AS sets, count(*)::int AS rows FROM d`,
      [now.toISOString(), hours],
    );
    return r;
  }

  /** Revocation (D-7): remove every set (current and previous) for the book, immediately. */
  async purge(bookId: string): Promise<{ sets: number; rows: number }> {
    const [r] = await this.db.query<{ sets: number; rows: number }>(
      `WITH d AS (DELETE FROM ai_book_chunks WHERE "bookId" = $1 RETURNING "textHash")
       SELECT count(DISTINCT "textHash")::int AS sets, count(*)::int AS rows FROM d`,
      [bookId],
    );
    return r;
  }

  private async sets(bookId: string): Promise<string[]> {
    return (await this.db.query<{ textHash: string }>(
      `SELECT DISTINCT "textHash" FROM ai_book_chunks WHERE "bookId" = $1`, [bookId],
    )).map((r) => r.textHash);
  }

  private async indexBytes(): Promise<number> {
    const [{ size }] = await this.db.query<{ size: string }>(`SELECT pg_total_relation_size('ai_book_chunks')::bigint::text AS size`);
    return Number(size);
  }
}
