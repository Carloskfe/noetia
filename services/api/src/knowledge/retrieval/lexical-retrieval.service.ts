import { KnowledgeDbService } from '../common/knowledge-db.service';
import { computeTextHash, TEXT_HASH_PATTERN } from '../rights/text-hash';
import { sliceCodePointRanges } from './chunker';
import { RetrievalMetricsService } from './retrieval-metrics.service';
import {
  BookTextPort,
  chunkRef,
  decodeUtf8,
  estimateTokens,
  isUuid,
  Passage,
  RetrievalConfig,
  RetrievalExclusions,
  RetrievalLanguage,
  RetrievalPort,
  RetrievalRequest,
  RetrievalRequestInvalid,
  RetrievalResult,
} from './retrieval.types';

interface RankedRow {
  id: string;
  bookId: string;
  textHash: string;
  chunkIndex: number;
  charStart: number;
  charEnd: number;
  language: RetrievalLanguage;
  rank: number;
}

/**
 * The ONLY retrieval query in E5 (an architecture test confines `ts_rank`, `websearch_to_tsquery`, and `tsvector`
 * SQL to this file and the indexer). One sub-query per language, each with a CONSTANT configuration and the
 * language predicate of its partial GIN index, combined with UNION ALL. The allowed (bookId, textHash) pairs are a
 * join predicate in SQL — never a post-filter. The query text is always a bound parameter.
 */
const RANK_SQL = `
  WITH allowed(b, h) AS (SELECT * FROM unnest($1::uuid[], $2::text[]))
  SELECT r.* FROM (
    SELECT c.id, c."bookId", c."textHash", c."chunkIndex", c."charStart", c."charEnd", c.language,
           ts_rank_cd(c.tsv, q.q, 32) AS rank
      FROM ai_book_chunks c
      JOIN allowed a ON a.b = c."bookId" AND a.h = c."textHash"
      CROSS JOIN (SELECT websearch_to_tsquery('noetia_es'::regconfig, $3) AS q) q
     WHERE c.language = 'es' AND c.tsv @@ q.q
    UNION ALL
    SELECT c.id, c."bookId", c."textHash", c."chunkIndex", c."charStart", c."charEnd", c.language,
           ts_rank_cd(c.tsv, q.q, 32) AS rank
      FROM ai_book_chunks c
      JOIN allowed a ON a.b = c."bookId" AND a.h = c."textHash"
      CROSS JOIN (SELECT websearch_to_tsquery('noetia_en'::regconfig, $3) AS q) q
     WHERE c.language = 'en' AND c.tsv @@ q.q
    UNION ALL
    SELECT c.id, c."bookId", c."textHash", c."chunkIndex", c."charStart", c."charEnd", c.language,
           ts_rank_cd(c.tsv, q.q, 32) AS rank
      FROM ai_book_chunks c
      JOIN allowed a ON a.b = c."bookId" AND a.h = c."textHash"
      CROSS JOIN (SELECT websearch_to_tsquery('noetia_simple'::regconfig, $3) AS q) q
     WHERE c.language = 'simple' AND c.tsv @@ q.q
  ) r
  ORDER BY r.rank DESC, r."bookId", r."chunkIndex"
  LIMIT $4`;

const STATUS_SQL = `
  WITH allowed(b, h) AS (SELECT * FROM unnest($1::uuid[], $2::text[]))
  SELECT a.b AS "bookId",
         EXISTS (SELECT 1 FROM ai_book_chunks c WHERE c."bookId" = a.b AND c."textHash" = a.h) AS current,
         EXISTS (SELECT 1 FROM ai_book_chunks c WHERE c."bookId" = a.b) AS indexed
    FROM allowed a`;

/** NFC-normalized, trimmed query; empty string when nothing remains. */
export function normalizeQuery(q: unknown): string {
  return typeof q === 'string' ? q.normalize('NFC').trim() : '';
}

/**
 * NEM-023 §5.5 `RetrievalPort` — lexical PostgreSQL implementation, storage S2.
 *
 * SQL ranks chunk offsets; then, per distinct result book (≤ 10), the MinIO object is read, its hash verified against
 * the chunk's `textHash` (which is the caller's current hash), and passages are sliced by code-point offsets. A read
 * failure or hash mismatch drops that book (fail closed). Passages are trimmed to the token budget in rank order.
 * No query or passage text is logged, persisted, or put in metrics or errors.
 */
export class LexicalRetrievalService implements RetrievalPort {
  constructor(
    private readonly db: KnowledgeDbService,
    private readonly text: BookTextPort,
    private readonly metrics: RetrievalMetricsService,
    private readonly config: RetrievalConfig,
  ) {}

  private validate(req: RetrievalRequest): { books: string[]; hashes: string[]; query: string } {
    const allowed = Array.isArray(req?.allowed) ? req.allowed : null;
    if (!allowed || allowed.length === 0) throw new RetrievalRequestInvalid('allowed');
    const byBook = new Map<string, string>();
    for (const a of allowed) {
      if (!a || !isUuid(a.bookId) || typeof a.textHash !== 'string' || !TEXT_HASH_PATTERN.test(a.textHash)) throw new RetrievalRequestInvalid('allowed');
      const prev = byBook.get(a.bookId);
      if (prev !== undefined && prev !== a.textHash) throw new RetrievalRequestInvalid('allowed'); // one version per book
      byBook.set(a.bookId, a.textHash);
    }
    if (byBook.size > this.config.maxAllowedBooks) throw new RetrievalRequestInvalid('allowed');
    if (typeof req.query !== 'string') throw new RetrievalRequestInvalid('query');
    const query = normalizeQuery(req.query);
    if ([...query].length > this.config.maxQueryCodePoints) throw new RetrievalRequestInvalid('query');
    if (!Number.isInteger(req.topK) || req.topK < 1 || req.topK > this.config.maxTopK) throw new RetrievalRequestInvalid('topK');
    if (!Number.isInteger(req.budgetTokens) || req.budgetTokens < 1 || req.budgetTokens > this.config.maxBudgetTokens) {
      throw new RetrievalRequestInvalid('budgetTokens');
    }
    const books = [...byBook.keys()];
    return { books, hashes: books.map((b) => byBook.get(b)!), query };
  }

  async retrieve(req: RetrievalRequest): Promise<RetrievalResult> {
    let v: ReturnType<LexicalRetrievalService['validate']>;
    try {
      v = this.validate(req);
    } catch (e) {
      this.metrics.retrievalInc('invalid');
      throw e;
    }
    const excluded: RetrievalExclusions = { unindexed: [], stale: [], unavailable: [] };
    if (v.query === '') return this.finish({ passages: [], excluded, truncated: false });

    let status: { bookId: string; current: boolean; indexed: boolean }[];
    let rows: RankedRow[];
    let keys: Map<string, string | null>;
    try {
      ({ status, rows, keys } = await this.db.transaction(async (m) => {
        await m.query(`SET LOCAL statement_timeout = ${Math.floor(this.config.retrievalStatementTimeoutMs)}`);
        const status = await m.query(STATUS_SQL, [v.books, v.hashes]);
        const rows: RankedRow[] = (await m.query(RANK_SQL, [v.books, v.hashes, v.query, req.topK]))
          .map((r: any) => ({ ...r, chunkIndex: Number(r.chunkIndex), charStart: Number(r.charStart), charEnd: Number(r.charEnd), rank: Number(r.rank) }));
        const ids = [...new Set(rows.map((r) => r.bookId))];
        const keyRows = ids.length ? await m.query(`SELECT id, "textFileKey" FROM books WHERE id = ANY($1::uuid[])`, [ids]) : [];
        return { status, rows, keys: new Map<string, string | null>(keyRows.map((k: any) => [k.id, k.textFileKey])) };
      }));
    } catch (e) {
      this.metrics.retrievalInc('error');
      throw e;
    }
    for (const s of status) {
      if (!s.current) (s.indexed ? excluded.stale : excluded.unindexed).push(s.bookId);
    }

    // S2: read each distinct result book once, verify the object hash, slice by offsets.
    const resultBooks = [...new Set(rows.map((r) => r.bookId))];
    const texts = new Map<string, string>();
    await Promise.all(resultBooks.map(async (bookId) => {
      const hash = rows.find((r) => r.bookId === bookId)!.textHash;
      const key = keys.get(bookId);
      let bytes: Uint8Array;
      try {
        if (!key) throw new Error('no key');
        bytes = await this.text.read(key);
      } catch {
        excluded.unavailable.push(bookId);
        return;
      }
      if (computeTextHash(bytes) !== hash) {
        excluded.stale.push(bookId);
        return;
      }
      try {
        texts.set(bookId, decodeUtf8(bytes));
      } catch {
        excluded.unavailable.push(bookId);
      }
    }));

    const sliced = new Map<string, (string | null)[]>();
    for (const [bookId, t] of texts) {
      const mine = rows.filter((r) => r.bookId === bookId);
      sliced.set(bookId, sliceCodePointRanges(t, mine.map((r) => ({ start: r.charStart, end: r.charEnd }))));
    }
    const cursor = new Map<string, number>();
    const passages: Passage[] = [];
    let used = 0;
    let truncated = false;
    for (const r of rows) {
      const slices = sliced.get(r.bookId);
      if (!slices) continue;
      const i = cursor.get(r.bookId) ?? 0;
      cursor.set(r.bookId, i + 1);
      const text = slices[i];
      if (text === null || text === undefined) continue; // offsets outside the verified text: never served
      const tokens = estimateTokens(text);
      if (used + tokens > req.budgetTokens) {
        truncated = true;
        continue;
      }
      used += tokens;
      passages.push({
        ref: chunkRef(r.id), bookId: r.bookId, textHash: r.textHash, chunkIndex: r.chunkIndex, charStart: r.charStart, charEnd: r.charEnd,
        chapterLabel: null, phraseRange: null, language: r.language, rank: r.rank, text, tokens,
      });
    }
    excluded.stale.sort();
    excluded.unavailable.sort();
    return this.finish({ passages, excluded, truncated });
  }

  private finish(r: RetrievalResult): RetrievalResult {
    this.metrics.retrievalInc(r.passages.length > 0 ? 'ok' : 'empty');
    this.metrics.passagesObserve(r.passages.length);
    this.metrics.excludedInc('unindexed', r.excluded.unindexed.length);
    this.metrics.excludedInc('stale', r.excluded.stale.length);
    this.metrics.excludedInc('unavailable', r.excluded.unavailable.length);
    return r;
  }
}
