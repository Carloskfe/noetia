import { createHash } from 'crypto';
import { CreateBucketCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { DataSource } from 'typeorm';
import { KnowledgeDbService } from '../../../src/knowledge/common/knowledge-db.service';
import { computeTextHash } from '../../../src/knowledge/rights/text-hash';
import { BookIndexer } from '../../../src/knowledge/retrieval/book-indexer.service';
import { IndexingPermission } from '../../../src/knowledge/retrieval/indexing-permission';
import { LexicalRetrievalService } from '../../../src/knowledge/retrieval/lexical-retrieval.service';
import { RetrievalMetricsService } from '../../../src/knowledge/retrieval/retrieval-metrics.service';
import { BookTextPort, DEFAULT_RETRIEVAL_CONFIG } from '../../../src/knowledge/retrieval/retrieval.types';
import { StorageBookText } from '../../../src/knowledge/retrieval/storage-book-text';
import { StorageService } from '../../../src/storage/storage.service';
import { insertRights, IT_CONFIG, openDataSource } from './support/it-env';
import { BOTH_OPS, insertBook, MemoryObjectStore } from './support/retrieval-env';

/**
 * NEM-023 §9.4 / §13 measurements: 10 books × the largest dev book (~2,000,000 code points ≈ 500k tokens each),
 * production defaults (1,500-char chunks, 10% overlap). Opt-in (heavy): NEM023_PERF=1.
 * With NEM023_MINIO_ENDPOINT/PORT (a disposable local MinIO container), S2 reads go through the real
 * StorageService; otherwise through the in-process fixture store. Invented, deterministic text only.
 */
const RUN = process.env.NEM023_PERF === '1';
const BOOKS = 10;
const CODE_POINTS = 2_000_000;

/** Deterministic Zipf-like invented Spanish-ish vocabulary and text. */
function vocabulary(n: number): string[] {
  const syl = ['ra', 'mo', 'ti', 'sa', 'le', 'no', 'ca', 've', 'du', 'pi', 'ña', 'ló', 'gue', 'trí', 'bas', 'cen', 'fo', 'ju', 'xe', 'zú'];
  const out: string[] = [];
  for (let i = 0; out.length < n; i++) {
    let w = '';
    let x = i + 7;
    do { w += syl[x % syl.length]; x = Math.floor(x / syl.length); } while (x > 0);
    out.push(w);
  }
  return out;
}
function bookText(seed: number, vocab: string[]): string {
  let state = createHash('sha256').update(`nem023-perf-${seed}`).digest().readUInt32LE(0) || 1;
  const rnd = () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296; };
  const parts: string[] = [];
  let len = 0;
  while (len < CODE_POINTS) {
    const words: string[] = [];
    const n = 8 + Math.floor(rnd() * 14);
    for (let i = 0; i < n; i++) words.push(vocab[Math.min(vocab.length - 1, Math.floor(Math.pow(rnd(), 2.2) * vocab.length))]);
    let s = `${words.join(' ')}.`;
    s = s[0].toUpperCase() + s.slice(1);
    parts.push(s, rnd() < 0.15 ? '\n\n' : ' ');
    len += s.length + 1;
  }
  return parts.join('').slice(0, CODE_POINTS);
}
const pct = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]; };

(RUN ? describe : describe.skip)('NEM-023 performance (10 × largest book, production defaults)', () => {
  let ds: DataSource;
  const bookIds: string[] = [];
  afterAll(async () => {
    if (ds && process.env.NEM023_PERF_KEEP === '1') { await ds.destroy(); return; } // analysis only; disposable DB
    if (ds) {
      for (const id of bookIds) {
        await ds.query(`DELETE FROM book_ai_rights WHERE "bookId" = $1`, [id]);
        await ds.query(`DELETE FROM books WHERE id = $1`, [id]); // cascades the chunk rows
      }
      await ds.destroy();
    }
  });

  it('measures index size, indexing time, and retrieval latency (incl. S2 fetch); GIN indexes used', async () => {
    ds = await openDataSource();
    const db = new KnowledgeDbService(ds, IT_CONFIG);
    const hashes = new Map<string, string>();
    const identity = { currentTextHash: async (b: string) => hashes.get(b) ?? null };
    const authority = { attest: async () => 'attested' as const };
    let store: BookTextPort;
    let put: (key: string, bytes: Buffer) => Promise<void>;
    let storeKind: string;
    if (process.env.NEM023_MINIO_ENDPOINT) {
      process.env.MINIO_ENDPOINT = process.env.NEM023_MINIO_ENDPOINT;
      process.env.MINIO_PORT = process.env.NEM023_MINIO_PORT ?? '9000';
      process.env.MINIO_ACCESS_KEY = process.env.NEM023_MINIO_ACCESS_KEY;
      process.env.MINIO_SECRET_KEY = process.env.NEM023_MINIO_SECRET_KEY;
      if (!['127.0.0.1', 'localhost'].includes(process.env.MINIO_ENDPOINT!)) throw new Error('local disposable MinIO only');
      const s3 = new S3Client({ endpoint: `http://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}`, region: 'us-east-1', forcePathStyle: true,
        credentials: { accessKeyId: process.env.MINIO_ACCESS_KEY!, secretAccessKey: process.env.MINIO_SECRET_KEY! } });
      await s3.send(new CreateBucketCommand({ Bucket: 'books' })).catch(() => undefined);
      put = async (key, bytes) => { await s3.send(new PutObjectCommand({ Bucket: 'books', Key: key, Body: bytes })); };
      store = new StorageBookText(new StorageService());
      storeKind = 'disposable local MinIO via StorageService';
    } else {
      const mem = new MemoryObjectStore();
      put = async (key, bytes) => mem.put(key, bytes);
      store = mem;
      storeKind = 'in-process fixture store';
    }
    const metrics = new RetrievalMetricsService();
    const permission = new IndexingPermission(db, identity, authority);
    const indexer = new BookIndexer(db, permission, store, metrics, DEFAULT_RETRIEVAL_CONFIG);
    const retrieval = new LexicalRetrievalService(db, store, metrics, DEFAULT_RETRIEVAL_CONFIG);

    const vocab = vocabulary(6000);
    const sizeBefore = Number((await ds.query(`SELECT pg_total_relation_size('ai_book_chunks') AS s`))[0].s);
    const indexMs: number[] = [];
    let chunks = 0;
    for (let i = 0; i < BOOKS; i++) {
      const text = bookText(i, vocab);
      const bytes = Buffer.from(text, 'utf8');
      const key = `texts/nem023-perf-${i}.txt`;
      await put(key, bytes);
      const id = await insertBook(ds, { language: 'es', textFileKey: key });
      bookIds.push(id);
      const hash = computeTextHash(bytes);
      hashes.set(id, hash);
      await insertRights(ds, id, { textHash: hash, permittedOperations: BOTH_OPS, verifier: 'fixture-verifier' });
      const t0 = process.hrtime.bigint();
      const r = await indexer.indexBook(id);
      indexMs.push(Number(process.hrtime.bigint() - t0) / 1e6);
      expect(r.outcome).toBe('indexed');
      expect(r.chunks!).toBeLessThanOrEqual(DEFAULT_RETRIEVAL_CONFIG.maxChunksPerBook);
      chunks += r.chunks!;
    }
    await ds.query('ANALYZE ai_book_chunks');
    const [sz] = await ds.query(`SELECT pg_total_relation_size('ai_book_chunks') AS total, pg_relation_size('ai_book_chunks') AS heap,
      pg_indexes_size('ai_book_chunks') AS indexes, (SELECT pg_total_relation_size(reltoastrelid) FROM pg_class WHERE relname = 'ai_book_chunks') AS toast`);

    const allowed = bookIds.map((b) => ({ bookId: b, textHash: hashes.get(b)! }));
    const queries = [vocab[3], vocab[40], vocab[400], vocab[2500], `${vocab[10]} ${vocab[11]}`, `${vocab[100]} or ${vocab[900]}`, `"${vocab[5]} ${vocab[6]}"`, vocab[5999], 'inexistente', vocab[1200]];
    for (const q of queries) await retrieval.retrieve({ allowed, query: q, topK: 8, budgetTokens: 6000 }); // warm-up
    const lat: number[] = [];
    let passages = 0;
    for (let round = 0; round < 10; round++) {
      for (const q of queries) {
        const t0 = process.hrtime.bigint();
        const r = await retrieval.retrieve({ allowed, query: q, topK: 8, budgetTokens: 6000 });
        lat.push(Number(process.hrtime.bigint() - t0) / 1e6);
        passages += r.passages.length;
      }
    }
    const fetchLat: number[] = [];
    const hashLat: number[] = [];
    for (const b of bookIds.slice(0, 5)) {
      const [{ textFileKey }] = await ds.query(`SELECT "textFileKey" FROM books WHERE id = $1`, [b]);
      let t0 = process.hrtime.bigint();
      const bytes = await store.read(textFileKey);
      fetchLat.push(Number(process.hrtime.bigint() - t0) / 1e6);
      t0 = process.hrtime.bigint();
      computeTextHash(bytes);
      new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      hashLat.push(Number(process.hrtime.bigint() - t0) / 1e6);
    }
    const perQuery: { matches: number; p50: number }[] = [];
    for (const q of queries) {
      const [{ n }] = await ds.query(`SELECT count(*)::int AS n FROM ai_book_chunks WHERE language = 'es' AND tsv @@ websearch_to_tsquery('noetia_es'::regconfig, $1)`, [q]);
      const c: number[] = [];
      for (let i = 0; i < 3; i++) {
        const t0 = process.hrtime.bigint();
        await retrieval.retrieve({ allowed, query: q, topK: 8, budgetTokens: 6000 });
        c.push(Number(process.hrtime.bigint() - t0) / 1e6);
      }
      perQuery.push({ matches: n, p50: Math.round(pct(c, 50)) });
    }
    const selective = perQuery.filter((x) => x.matches <= 1000);
    const sqlLat: number[] = [];
    for (const q of queries) {
      const t0 = process.hrtime.bigint();
      await ds.query(`SELECT id FROM ai_book_chunks WHERE language = 'es' AND tsv @@ websearch_to_tsquery('noetia_es'::regconfig, $1) LIMIT 8`, [q]);
      sqlLat.push(Number(process.hrtime.bigint() - t0) / 1e6);
    }
    const plan = (await ds.query(`EXPLAIN SELECT id FROM ai_book_chunks c WHERE c.language = 'es' AND c.tsv @@ websearch_to_tsquery('noetia_es'::regconfig, $1)`, [vocab[2500]]))
      .map((r: any) => r['QUERY PLAN']).join('\n');

    const report = {
      store: storeKind, books: BOOKS, codePointsPerBook: CODE_POINTS, chunks, chunksPerBook: chunks / BOOKS,
      indexBytes: { total: Number(sz.total) - sizeBefore, heap: Number(sz.heap), indexes: Number(sz.indexes), toast: Number(sz.toast), budget: DEFAULT_RETRIEVAL_CONFIG.maxIndexBytes },
      indexingMsPerBook: { min: Math.min(...indexMs), median: pct(indexMs, 50), max: Math.max(...indexMs), total: indexMs.reduce((a, b) => a + b, 0) },
      retrievalMs: { n: lat.length, p50: pct(lat, 50), p95: pct(lat, 95), max: Math.max(...lat), avgPassages: passages / lat.length },
      perQuery: perQuery.sort((a, b) => a.matches - b.matches), totalChunks: chunks,
      selectiveQueries: { count: selective.length, maxP50: Math.max(...selective.map((x) => x.p50)) },
      perObjectMs: { fetchMedian: pct(fetchLat, 50), hashAndDecodeMedian: pct(hashLat, 50) },
      sqlOnlyMs: { p50: pct(sqlLat, 50), max: Math.max(...sqlLat) },
      ginUsed: /IDX_ai_book_chunks_tsv_es/.test(plan), plan,
    };
    process.stdout.write(`NEM023_PERF ${JSON.stringify(report)}\n`);
    expect(report.ginUsed).toBe(true);
    expect(Number(sz.total)).toBeLessThan(DEFAULT_RETRIEVAL_CONFIG.maxIndexBytes);
    expect(Math.max(...lat)).toBeLessThan(DEFAULT_RETRIEVAL_CONFIG.retrievalStatementTimeoutMs);
  }, 900_000);
});
