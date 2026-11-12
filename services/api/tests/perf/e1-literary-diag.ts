/**
 * NEM-024 PO-050 — E-1 REPRESENTATIVE LITERARY CORPUS diagnostics (test tooling only; never imported by src; opt-in).
 *
 * Disposable local PostgreSQL / MinIO only (refuses anything else). Run from services/api:
 *   NEM019_DISPOSABLE_DB=1 DB_HOST=127.0.0.1 DB_PORT=… DB_NAME=po050_<es|en>_test DB_USER=… DB_PASS=… MINIO_*=… \
 *     npx ts-node -T -P tsconfig.json tests/perf/e1-literary-diag.ts <cmd> [args]
 *
 * Commands (each prints one JSON line; NO book text, query text, anchors, ids, hashes of book bytes or keys are printed,
 * except the rights/normalization hashes recorded in the committed corpus manifest):
 *   prepare <rawDir> <outDir>          verify acquired files against fixtures/po050-corpus-manifest.json, apply the
 *                                      production Gutenberg header strip + the manifest's editorial cut, write the
 *                                      normalized texts to <outDir> (LOCAL ONLY) and record their sizes and hashes.
 *   ingest <normDir>                   store each normalized text of the DB's language in the disposable MinIO and index
 *                                      it with the production BookIndexer (real rights rows, real permission check).
 *   profile <normDir>                  Q-50-1 corpus composition: tokens, stop-word share, chunks, tsvector sizes,
 *                                      distinct lexemes, top-term frequency/selectivity distribution (no lexeme strings).
 *   freeze <queries.json>              validate the LOCAL query file and write the content-minimized, hash-only
 *                                      specification fixtures/po050-query-manifest-<lang>.json (the predeclaration).
 *   info <queries.json> [scope]        matching chunks / books / query structure per query (untimed).
 *   relevance <queries.json> <normDir> retrieval usefulness: expected-passage hits, empty results, citation validity
 *                                      (every passage re-derived from the local normalized text), ordering and scores.
 *   e2e <queries.json> <seed> <rounds> [scope]
 *                                      production LexicalRetrievalService (unchanged SQL, real MinIO, S2 worker, no
 *                                      caches); per-request stage timings and result shape; session resource deltas.
 *
 * scope: declared (default; each query's predeclared allowed-book set) | S1 | S3 | S10 (sensitivity: the same queries
 *        over {W01} / {W01,W03,W07} / all ten Spanish works) | L (all works of the DB's language).
 */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-var-requires */
import { execSync } from 'child_process';
import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { loadavg } from 'os';
import { join } from 'path';

const env = process.env;
if (env.NEM019_DISPOSABLE_DB !== '1' || !['127.0.0.1', 'localhost'].includes(env.DB_HOST ?? '') || !/_test$/.test(env.DB_NAME ?? '')) {
  throw new Error('disposable local *_test database only');
}
const LANG: 'es' | 'en' = /po050_en_test$/.test(env.DB_NAME ?? '') ? 'en' : 'es';
const CFG = LANG === 'es' ? 'noetia_es' : 'noetia_en';
const BUDGET = 6000;
const TOPK = 8;
const MANIFEST_PATH = join(__dirname, 'fixtures/po050-corpus-manifest.json');
const manifest = () => JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));

// ── statistics ───────────────────────────────────────────────────────────────────────────────────────────────────
const pct = (xs: number[], p: number) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]; };
const r2 = (x: number | null) => (x === null ? null : Math.round(x * 100) / 100);
const stats = (xs: number[]) => ({ n: xs.length, p50: r2(pct(xs, 50)), p95: r2(pct(xs, 95)), p99: r2(pct(xs, 99)), max: r2(xs.length ? Math.max(...xs) : null), mean: r2(xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null) });
const hr = () => process.hrtime.bigint();
const ms = (t0: bigint) => Number(hr() - t0) / 1e6;
const sha = (s: string | Buffer) => createHash('sha256').update(s).digest('hex');
function xorshift(seed: number) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; }; }
function shuffle<T>(xs: T[], rnd: () => number): T[] { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// ── local query file (never committed) ───────────────────────────────────────────────────────────────────────────
type LQ = { id: string; lang: 'es' | 'en'; cat: string; form: 'question' | 'keywords' | 'phrase'; cls: 'ordinary' | 'complex' | 'adversarial' | 'negative'; scope: string; q: string;
  expect: 'match' | 'none' | 'unknown'; ref?: { work: string; anchor: string; note: string } | null; derivation: string };
function loadQueries(path: string): LQ[] {
  const qs: LQ[] = JSON.parse(readFileSync(path, 'utf8')).filter((q: LQ) => q.lang === LANG);
  const ids = new Set<string>();
  for (const q of qs) {
    if (ids.has(q.id)) throw new Error(`duplicate ${q.id}`); ids.add(q.id);
    if (!q.q || !q.cat || !q.scope || !q.cls || !q.form || !q.derivation) throw new Error(`incomplete ${q.id}`);
  }
  return qs;
}

// ── DB / services ────────────────────────────────────────────────────────────────────────────────────────────────
async function pg() {
  const { Client } = require('pg');
  const c = new Client({ host: env.DB_HOST, port: Number(env.DB_PORT), database: env.DB_NAME, user: env.DB_USER, password: env.DB_PASS });
  await c.connect();
  return c;
}
/** workId → { bookId, textHash } from the disposable DB (books titled `PO050 <workId>` by `ingest`). */
async function works(c: any): Promise<Map<string, { bookId: string; textHash: string }>> {
  const rows = (await c.query(`SELECT b.title, c."bookId", min(c."textHash") h FROM books b JOIN ai_book_chunks c ON c."bookId" = b.id WHERE b.title LIKE 'PO050 %' GROUP BY 1, 2 ORDER BY 1`)).rows;
  return new Map(rows.map((r: any) => [r.title.slice(6), { bookId: r.bookId, textHash: r.h }]));
}
function scopeWorks(scope: string, all: string[]): string[] {
  if (scope === 'L' || scope === 'S10') return all;
  if (scope === 'S1') return ['W01'];
  if (scope === 'S3') return ['W01', 'W03', 'W07'];
  const ws = scope.split('+');
  for (const w of ws) if (!all.includes(w)) throw new Error(`unknown work ${w}`);
  return ws;
}

// ── prepare ──────────────────────────────────────────────────────────────────────────────────────────────────────
function cmdPrepare(rawDir: string, outDir: string) {
  const { GutenbergFetcherService } = require('../../src/ingestion/gutenberg-fetcher.service');
  const strip = (raw: string): string => (GutenbergFetcherService.prototype as any).stripHeaders.call({}, raw); // production code, verbatim
  const m = manifest();
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const out: any[] = [];
  for (const w of m.works) {
    const bytes = readFileSync(join(rawDir, `pg${w.gutenbergId}.txt`));
    if (sha(bytes) !== w.acquiredSha256) throw new Error(`${w.id}: acquired hash mismatch`);
    const stripped = strip(bytes.toString('utf8'));
    const cps = Array.from(stripped);
    if (cps.length !== w.normalization.strippedCodePoints || sha(stripped) !== w.normalization.strippedSha256) throw new Error(`${w.id}: stripped text mismatch`);
    const [a, b] = w.normalization.keepCodePoints;
    let text = cps.slice(a, b).join('');
    if (w.normalization.removeIllustrationBlocks) text = text.replace(/\[Illustration[^\]]*\]/g, '');
    text = text.trim();
    const nb = Buffer.from(text, 'utf8');
    writeFileSync(join(outDir, `${w.id}.txt`), nb);
    w.normalizedCodePoints = Array.from(text).length; w.normalizedBytes = nb.length; w.normalizedSha256 = sha(nb);
    out.push({ id: w.id, acquiredBytes: bytes.length, strippedCodePoints: cps.length, normalizedCodePoints: w.normalizedCodePoints, normalizedBytes: nb.length, removedCodePoints: cps.length - w.normalizedCodePoints });
  }
  writeFileSync(MANIFEST_PATH, `${JSON.stringify(m, null, 1)}\n`);
  console.log(JSON.stringify({ cmd: 'prepare', works: out }));
}

// ── ingest ───────────────────────────────────────────────────────────────────────────────────────────────────────
async function cmdIngest(normDir: string) {
  if (!/^po050_(es|en)_test$/.test(env.DB_NAME ?? '')) throw new Error('ingest requires po050_es_test or po050_en_test');
  if (!['127.0.0.1', 'localhost'].includes(env.MINIO_ENDPOINT ?? '')) throw new Error('local disposable MinIO only');
  const { S3Client, CreateBucketCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
  const { KnowledgeDbService } = require('../../src/knowledge/common/knowledge-db.service');
  const { computeTextHash } = require('../../src/knowledge/rights/text-hash');
  const { BookIndexer } = require('../../src/knowledge/retrieval/book-indexer.service');
  const { IndexingPermission } = require('../../src/knowledge/retrieval/indexing-permission');
  const { RetrievalMetricsService } = require('../../src/knowledge/retrieval/retrieval-metrics.service');
  const { DEFAULT_RETRIEVAL_CONFIG } = require('../../src/knowledge/retrieval/retrieval.types');
  const { StorageBookText } = require('../../src/knowledge/retrieval/storage-book-text');
  const { StorageService } = require('../../src/storage/storage.service');
  const { openDataSource, insertRights, IT_CONFIG } = require('../integration/knowledge/support/it-env');
  const { insertBook, BOTH_OPS } = require('../integration/knowledge/support/retrieval-env');
  const ds = await openDataSource();
  const s3 = new S3Client({ endpoint: `http://${env.MINIO_ENDPOINT}:${env.MINIO_PORT}`, region: 'us-east-1', forcePathStyle: true, credentials: { accessKeyId: env.MINIO_ACCESS_KEY, secretAccessKey: env.MINIO_SECRET_KEY } });
  await s3.send(new CreateBucketCommand({ Bucket: 'books' })).catch(() => undefined);
  const db = new KnowledgeDbService(ds, IT_CONFIG);
  const hashes = new Map<string, string>();
  const store = new StorageBookText(new StorageService());
  const authority = { attest: async (r: { verifier: string | null }) => (r.verifier === 'po050-disposable-verifier' ? 'attested' as const : 'not_attested' as const) };
  const indexer = new BookIndexer(db, new IndexingPermission(db, { currentTextHash: async (b: string) => hashes.get(b) ?? null }, authority), store, new RetrievalMetricsService(), DEFAULT_RETRIEVAL_CONFIG);
  const out: any[] = [];
  for (const w of manifest().works.filter((x: any) => x.language === LANG)) {
    const bytes = readFileSync(join(normDir, `${w.id}.txt`));
    if (sha(bytes) !== w.normalizedSha256) throw new Error(`${w.id}: normalized hash mismatch`);
    const key = `texts/po050-${w.id}.txt`;
    await s3.send(new PutObjectCommand({ Bucket: 'books', Key: key, Body: bytes }));
    const id = await insertBook(ds, { language: LANG, textFileKey: key });
    await ds.query(`UPDATE books SET title = $2, author = 'PO050 disposable' WHERE id = $1`, [id, `PO050 ${w.id}`]);
    const hash = computeTextHash(bytes); hashes.set(id, hash);
    const death = String(w.authorLife).split('–')[1];
    await insertRights(ds, id, { textHash: hash, permittedOperations: BOTH_OPS, verifier: 'po050-disposable-verifier', workTitle: w.title, workAuthors: [w.author],
      authorDeathDate: `${death}-12-31`, firstPublicationDate: String(w.originalPublication).slice(0, 4), edition: w.edition, editionPublisher: w.sourceRepository,
      editionYear: Number(String(w.gutenbergReleaseDate).slice(0, 4)), textSource: 'project_gutenberg', isTranslation: false, addedMaterial: 'excluded',
      sourceUrl: w.canonicalUrl, rightsBasis: 'public_domain', rightsEvidence: 'PO-050 corpus manifest', jurisdiction: LANG === 'es' ? 'US; ES (LPI DT 4ª); EU' : 'US; UK/EU',
      evidenceLinks: [w.canonicalUrl] });
    const t0 = hr();
    const r = await indexer.indexBook(id);
    const indexMs = ms(t0);
    if (r.outcome !== 'indexed') throw new Error(`${w.id}: indexing outcome ${r.outcome}`);
    out.push({ id: w.id, chunks: r.chunks, indexMs: r2(indexMs) });
  }
  await ds.query('ANALYZE ai_book_chunks');
  const [sz] = await ds.query(`SELECT count(*)::int chunks, pg_relation_size('ai_book_chunks') heap, (SELECT pg_total_relation_size(reltoastrelid) FROM pg_class WHERE relname='ai_book_chunks') toast, pg_indexes_size('ai_book_chunks') indexes, pg_total_relation_size('ai_book_chunks') total FROM ai_book_chunks`);
  await ds.destroy();
  console.log(JSON.stringify({ cmd: 'ingest', lang: LANG, works: out, size: sz }));
}

// ── profile (Q-50-1) ─────────────────────────────────────────────────────────────────────────────────────────────
async function cmdProfile(normDir: string) {
  const c = await pg();
  const W = await works(c);
  const stopFile = LANG === 'es' ? 'spanish.stop' : 'english.stop';
  const [{ f }] = (await c.query(`SELECT pg_read_file('/usr/local/share/postgresql/tsearch_data/${stopFile}') f`)).rows;
  const stop = new Set(f.split('\n').map((s: string) => s.trim()).filter(Boolean));
  const perBook: any[] = [];
  let corpusTokens = 0;
  for (const [wid, { bookId }] of W) {
    const text = readFileSync(join(normDir, `${wid}.txt`), 'utf8');
    const toks = text.toLowerCase().match(/\p{L}+/gu) ?? [];
    corpusTokens += toks.length;
    const [r] = (await c.query(`SELECT count(*)::int chunks, percentile_disc(0.5) WITHIN GROUP (ORDER BY pg_column_size(tsv)) tsv_p50, percentile_disc(0.95) WITHIN GROUP (ORDER BY pg_column_size(tsv)) tsv_p95,
      max(pg_column_size(tsv)) tsv_max, avg(pg_column_size(tsv))::int tsv_avg, avg(length(tsv))::int lexemes_per_chunk_avg,
      sum(CASE WHEN pg_column_size(tsv) > 2032 THEN 1 ELSE 0 END)::int toasted_estimate FROM ai_book_chunks WHERE "bookId" = $1`, [bookId])).rows;
    const top = (await c.query(`SELECT ndoc, nentry FROM ts_stat($$SELECT tsv FROM ai_book_chunks WHERE "bookId" = '${bookId}'$$) ORDER BY ndoc DESC, nentry DESC LIMIT 10`)).rows;
    const [{ n: distinct }] = (await c.query(`SELECT count(*)::int n FROM ts_stat($$SELECT tsv FROM ai_book_chunks WHERE "bookId" = '${bookId}'$$)`)).rows;
    perBook.push({ id: wid, codePoints: Array.from(text).length, tokens: toks.length, stopTokenPct: r2((100 * toks.filter((t) => stop.has(t)).length) / toks.length), ...r,
      distinctLexemes: distinct, topLexemePctOfBookChunks: top.map((t: any) => r2((100 * t.ndoc) / r.chunks)), topLexemePerMillionTokens: top.map((t: any) => Math.round((1e6 * t.nentry) / toks.length)) });
  }
  const [{ n: total }] = (await c.query(`SELECT count(*)::int n FROM ai_book_chunks`)).rows;
  const top = (await c.query(`SELECT ndoc, nentry FROM ts_stat('SELECT tsv FROM ai_book_chunks') ORDER BY ndoc DESC LIMIT 200`)).rows;
  const [{ n: distinct }] = (await c.query(`SELECT count(*)::int n FROM ts_stat('SELECT tsv FROM ai_book_chunks')`)).rows;
  const [bands] = (await c.query(`SELECT count(*) FILTER (WHERE ndoc >= $1 * 0.5)::int ge50, count(*) FILTER (WHERE ndoc >= $1 * 0.25)::int ge25, count(*) FILTER (WHERE ndoc >= $1 * 0.10)::int ge10,
      count(*) FILTER (WHERE ndoc >= $1 * 0.05)::int ge5, count(*) FILTER (WHERE ndoc >= $1 * 0.01)::int ge1 FROM ts_stat('SELECT tsv FROM ai_book_chunks')`, [total])).rows;
  const [sz] = (await c.query(`SELECT pg_relation_size('ai_book_chunks') heap, (SELECT pg_total_relation_size(reltoastrelid) FROM pg_class WHERE relname='ai_book_chunks') toast, pg_indexes_size('ai_book_chunks') indexes, pg_total_relation_size('ai_book_chunks') total FROM ai_book_chunks`)).rows;
  await c.end();
  const pick = [1, 2, 3, 5, 10, 20, 50, 100, 200];
  console.log(JSON.stringify({ cmd: 'profile', lang: LANG, stopWords: stop.size, corpus: { works: W.size, chunks: total, tokens: corpusTokens, distinctLexemes: distinct, size: sz,
    lexemesByChunkSelectivity: { ge50pct: bands.ge50, ge25pct: bands.ge25, ge10pct: bands.ge10, ge5pct: bands.ge5, ge1pct: bands.ge1 },
    topRank: pick.filter((k) => k <= top.length).map((k) => ({ rank: k, pctChunks: r2((100 * top[k - 1].ndoc) / total), perMillionTokens: Math.round((1e6 * top[k - 1].nentry) / corpusTokens) })) }, perBook }));
}

// ── query structure (from PostgreSQL's own parse; only operator counts leave the DB) ─────────────────────────────
async function structure(c: any, q: string) {
  const [r] = (await c.query(`SELECT querytree(websearch_to_tsquery('${CFG}'::regconfig, $1)) t, numnode(websearch_to_tsquery('${CFG}'::regconfig, $1)) nn`, [q])).rows;
  const t: string = r.t;
  const lexemes = (t.match(/'(?:[^']|'')*'/g) ?? []).length;
  const phrase = /<\d+>|<->/.test(t); const or = /\|/.test(t); const and = /&/.test(t); const not = /!/.test(t);
  const shape = lexemes === 0 ? 'empty' : phrase ? 'phrase' : or ? (and ? 'mixed' : 'OR') : not ? 'NOT' : and ? 'AND' : 'single';
  return { lexemes, numnode: r.nn, shape };
}

// ── freeze ───────────────────────────────────────────────────────────────────────────────────────────────────────
async function cmdFreeze(path: string) {
  const qs = loadQueries(path);
  const c = await pg();
  const spec: any[] = [];
  for (const q of qs) {
    const s = await structure(c, q.q);
    spec.push({ id: q.id, lang: q.lang, category: q.cat, form: q.form, class: q.cls, allowedScope: q.scope, structure: s.shape, searchableTerms: s.lexemes, numnode: s.numnode,
      expectedMatching: q.expect, independentReference: q.ref ? { work: q.ref.work, location: q.ref.note, anchorSha256: sha(q.ref.anchor) } : null,
      derivation: q.derivation, querySha256: sha(q.q) });
  }
  await c.end();
  const body = { schema: 'po050-query-manifest/1', mission: 'NEM-024 PO-050', lang: LANG, frozenAt: new Date().toISOString(),
    note: 'Predeclared before any timed measurement. Query text and reference anchors are kept LOCAL (not committed); this file holds hashes and derivation metadata only.',
    queries: spec };
  const manifestSha = sha(JSON.stringify(spec));
  writeFileSync(join(__dirname, `fixtures/po050-query-manifest-${LANG}.json`), `${JSON.stringify({ ...body, specSha256: manifestSha, localFileSha256: sha(readFileSync(path)) }, null, 1)}\n`);
  const byCat: Record<string, number> = {}; for (const q of spec) byCat[q.category] = (byCat[q.category] ?? 0) + 1;
  const byShape: Record<string, number> = {}; for (const q of spec) byShape[q.structure] = (byShape[q.structure] ?? 0) + 1;
  console.log(JSON.stringify({ cmd: 'freeze', lang: LANG, n: spec.length, byCat, byShape, specSha256: manifestSha }));
}

// ── info ─────────────────────────────────────────────────────────────────────────────────────────────────────────
async function cmdInfo(path: string, scopeOverride: string) {
  const qs = loadQueries(path);
  const c = await pg();
  const W = await works(c); const all = [...W.keys()];
  const [{ n: total }] = (await c.query(`SELECT count(*)::int n FROM ai_book_chunks`)).rows;
  const out: any[] = [];
  for (const q of qs) {
    const ws = scopeWorks(scopeOverride === 'declared' ? q.scope : scopeOverride, all);
    const ids = ws.map((w) => W.get(w)!.bookId);
    const [{ n: scopeChunks }] = (await c.query(`SELECT count(*)::int n FROM ai_book_chunks WHERE "bookId" = ANY($1::uuid[])`, [ids])).rows;
    const [r] = (await c.query(`SELECT count(*)::int n, count(DISTINCT "bookId")::int nb FROM ai_book_chunks WHERE language = $3 AND "bookId" = ANY($2::uuid[]) AND tsv @@ websearch_to_tsquery('${CFG}'::regconfig, $1)`, [q.q, ids, LANG])).rows;
    const [g] = (await c.query(`SELECT count(*)::int n FROM ai_book_chunks WHERE language = $2 AND tsv @@ websearch_to_tsquery('${CFG}'::regconfig, $1)`, [q.q, LANG])).rows;
    const s = await structure(c, q.q);
    out.push({ id: q.id, cat: q.cat, cls: q.cls, scope: scopeOverride === 'declared' ? q.scope : scopeOverride, scopeBooks: ws.length, scopeChunks, matches: r.n,
      pctOfScopeChunks: r2((100 * r.n) / scopeChunks), matchingBooks: r.nb, matchesWholeCorpus: g.n, pctOfCorpus: r2((100 * g.n) / total), ...s });
  }
  await c.end();
  console.log(JSON.stringify({ cmd: 'info', lang: LANG, scope: scopeOverride, corpusChunks: total, queries: out }));
}

// ── retrieval wiring (production classes; instrumentation wraps, never substitutes) ─────────────────────────────
async function wire() {
  const { KnowledgeDbService } = require('../../src/knowledge/common/knowledge-db.service');
  const { LexicalRetrievalService } = require('../../src/knowledge/retrieval/lexical-retrieval.service');
  const { RetrievalMetricsService } = require('../../src/knowledge/retrieval/retrieval-metrics.service');
  const { DEFAULT_RETRIEVAL_CONFIG } = require('../../src/knowledge/retrieval/retrieval.types');
  const { StorageBookText } = require('../../src/knowledge/retrieval/storage-book-text');
  const { processS2Verifier } = require('../../src/knowledge/retrieval/s2-verification.service');
  const { StorageService } = require('../../src/storage/storage.service');
  const { openDataSource, IT_CONFIG } = require('../integration/knowledge/support/it-env');
  if (!['127.0.0.1', 'localhost'].includes(env.MINIO_ENDPOINT ?? '')) throw new Error('local disposable MinIO only');
  const ds = await openDataSource();
  const db = new KnowledgeDbService(ds, IT_CONFIG);
  const store = new StorageBookText(new StorageService());
  const pool = processS2Verifier();
  const T: { cur: any } = { cur: null };
  const origTx = db.transaction.bind(db);
  db.transaction = async (fn: any) => {
    const t0 = hr();
    try {
      return await origTx(async (m: any) => {
        const q0 = m.query.bind(m); const proxy = Object.create(m);
        proxy.query = async (sql: string, params?: any[]) => {
          const t = hr();
          try { return await q0(sql, params); } finally {
            if (T.cur) { const k = /ts_rank_cd/.test(sql) ? 'rankSql' : /EXISTS \(SELECT 1 FROM ai_book_chunks/.test(sql) ? 'statusSql' : /"textFileKey"/.test(sql) ? 'keysSql' : 'otherSql'; T.cur[k] = (T.cur[k] ?? 0) + ms(t); }
          }
        };
        return fn(proxy);
      });
    } finally { if (T.cur) { T.cur.txWall = ms(t0); T.cur.tTxEnd = hr(); } }
  };
  const origRead = store.read.bind(store);
  store.read = async (key: string) => { const t = hr(); try { return await origRead(key); } finally { if (T.cur) { const d = ms(t); T.cur.readSum = (T.cur.readSum ?? 0) + d; T.cur.readMax = Math.max(T.cur.readMax ?? 0, d); T.cur.reads = (T.cur.reads ?? 0) + 1; } } };
  const origVerify = pool.verify.bind(pool);
  pool.verify = async (b: any, h: string, r: any) => { const t = hr(); try { return await origVerify(b, h, r); } finally { if (T.cur) { const d = ms(t); T.cur.verifyMax = Math.max(T.cur.verifyMax ?? 0, d); T.cur.tS2End = hr(); } } };
  const retrieval = new LexicalRetrievalService(db, store, new RetrievalMetricsService(), DEFAULT_RETRIEVAL_CONFIG, pool);
  return { retrieval, T, close: async () => { await pool.shutdown(); await ds.destroy(); } };
}
function pgCpuUsec(): number | null {
  try { const s = execSync(`docker exec ${env.PG_CONTAINER ?? 'po050-pg'} cat /sys/fs/cgroup/cpu.stat`, { encoding: 'utf8' }); return Number(/usage_usec (\d+)/.exec(s)![1]); } catch { return null; }
}
function pgMemBytes(): number | null {
  try { return Number(execSync(`docker exec ${env.PG_CONTAINER ?? 'po050-pg'} cat /sys/fs/cgroup/memory.current`, { encoding: 'utf8' }).trim()); } catch { return null; }
}
async function dbStat(c: any) { const [r] = (await c.query(`SELECT blks_hit::bigint h, blks_read::bigint r, xact_commit::bigint x, temp_bytes::bigint t FROM pg_stat_database WHERE datname = current_database()`)).rows; return r; }

// ── relevance / usefulness ───────────────────────────────────────────────────────────────────────────────────────
async function cmdRelevance(path: string, normDir: string) {
  const qs = loadQueries(path);
  const c = await pg(); const W = await works(c); await c.end();
  const all = [...W.keys()]; const byBook = new Map([...W].map(([w, v]) => [v.bookId, w]));
  const texts = new Map(all.map((w) => [w, Array.from(readFileSync(join(normDir, `${w}.txt`), 'utf8'))]));
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ');
  const { retrieval, close } = await wire();
  const out: any[] = [];
  for (const q of qs) {
    const ws = scopeWorks(q.scope, all);
    const allowed = ws.map((w) => W.get(w)!);
    const r = await retrieval.retrieve({ allowed, query: q.q, topK: TOPK, budgetTokens: BUDGET });
    let citationsValid = true;
    for (const p of r.passages) {
      const w = byBook.get(p.bookId);
      const okScope = !!w && ws.includes(w) && W.get(w)!.textHash === p.textHash;
      const okText = !!w && texts.get(w)!.slice(p.charStart, p.charEnd).join('') === p.text;
      if (!okScope || !okText) citationsValid = false;
    }
    let refHitRank: number | null = null;
    if (q.ref) { const a = norm(q.ref.anchor); const i = r.passages.findIndex((p: any) => byBook.get(p.bookId) === q.ref!.work && norm(p.text).includes(a)); refHitRank = i >= 0 ? i + 1 : null; }
    const top20 = q.ref ? await retrieval.retrieve({ allowed, query: q.q, topK: 20, budgetTokens: 8000 }) : null;
    let refHitRank20: number | null = null;
    if (q.ref && top20) { const a = norm(q.ref.anchor); const i = top20.passages.findIndex((p: any) => byBook.get(p.bookId) === q.ref!.work && norm(p.text).includes(a)); refHitRank20 = i >= 0 ? i + 1 : null; }
    out.push({ id: q.id, cat: q.cat, cls: q.cls, expect: q.expect, passages: r.passages.length, empty: r.passages.length === 0, truncated: r.truncated,
      resultWorks: [...new Set(r.passages.map((p: any) => byBook.get(p.bookId)))], excluded: { unindexed: r.excluded.unindexed.length, stale: r.excluded.stale.length, unavailable: r.excluded.unavailable.length },
      citationsValid, hasReference: !!q.ref, refWork: q.ref?.work ?? null, refHitRankTop8: refHitRank, refHitRankTop20: refHitRank20,
      ordering: r.passages.map((p: any) => [p.rank, byBook.get(p.bookId), p.chunkIndex]), resultSha256: sha(JSON.stringify(r)) });
  }
  await close();
  const withRef = out.filter((x) => x.hasReference);
  console.log(JSON.stringify({ cmd: 'relevance', lang: LANG, n: out.length, empty: out.filter((x) => x.empty).length, unexpectedEmpty: out.filter((x) => x.empty && x.expect !== 'none').map((x) => x.id),
    citationsValidAll: out.every((x) => x.citationsValid), references: withRef.length, refHitTop8: withRef.filter((x) => x.refHitRankTop8 !== null).length, refHitTop20: withRef.filter((x) => x.refHitRankTop20 !== null).length, queries: out }));
}

// ── e2e ──────────────────────────────────────────────────────────────────────────────────────────────────────────
async function cmdE2e(path: string, seed: number, rounds: number, scopeOverride: string) {
  const qs = loadQueries(path);
  const c = await pg(); const W = await works(c);
  const all = [...W.keys()];
  const allowedFor = (q: LQ) => scopeWorks(scopeOverride === 'declared' ? q.scope : scopeOverride, all).map((w) => W.get(w)!);
  const { retrieval, T, close } = await wire();
  for (const q of qs) await retrieval.retrieve({ allowed: allowedFor(q), query: q.q, topK: TOPK, budgetTokens: BUDGET }); // warm-up (excluded)
  const load0 = loadavg(); const cpu0 = pgCpuUsec(); const st0 = await dbStat(c); const tWall = hr(); const pgMem0 = pgMemBytes();
  const samples: any[] = []; const errors: any[] = []; const firstHash = new Map<string, string>(); const unstable = new Set<string>();
  let rssMax = 0; let heapMax = 0;
  for (let round = 0; round < rounds; round++) {
    for (const q of shuffle(qs, xorshift(seed * 1000 + round))) {
      T.cur = { q: q.id };
      const t0 = hr();
      try {
        const r = await retrieval.retrieve({ allowed: allowedFor(q), query: q.q, topK: TOPK, budgetTokens: BUDGET });
        const total = ms(t0); const cur = T.cur; T.cur = null;
        const h = sha(JSON.stringify(r)); if (!firstHash.has(q.id)) firstHash.set(q.id, h); else if (firstHash.get(q.id) !== h) unstable.add(q.id);
        samples.push({ q: q.id, cat: q.cat, cls: q.cls, total, statusSql: cur.statusSql ?? 0, rankSql: cur.rankSql ?? 0, keysSql: cur.keysSql ?? 0, txWall: cur.txWall ?? 0,
          readSum: cur.readSum ?? 0, readMax: cur.readMax ?? 0, verifyMax: cur.verifyMax ?? 0, s2Phase: cur.tS2End && cur.tTxEnd ? Number(cur.tS2End - cur.tTxEnd) / 1e6 : 0,
          booksRead: cur.reads ?? 0, passages: r.passages.length, truncated: r.truncated, excluded: r.excluded.unindexed.length + r.excluded.stale.length + r.excluded.unavailable.length });
      } catch (e: any) { T.cur = null; errors.push({ q: q.id, ms: ms(t0), kind: String(e?.code ?? e?.name ?? 'error') }); }
      const mu = process.memoryUsage(); rssMax = Math.max(rssMax, mu.rss); heapMax = Math.max(heapMax, mu.heapUsed);
    }
  }
  const wallS = ms(tWall) / 1000; const cpu1 = pgCpuUsec(); const st1 = await dbStat(c); const load1 = loadavg(); const pgMem1 = pgMemBytes();
  await c.end(); await close();
  const f = ['total', 'statusSql', 'rankSql', 'keysSql', 'txWall', 'readSum', 'readMax', 'verifyMax', 's2Phase'];
  const agg = (xs: any[]) => ({ ...Object.fromEntries(f.map((k) => [k, stats(xs.map((s) => s[k]))])), booksRead: stats(xs.map((s) => s.booksRead)), passages: stats(xs.map((s) => s.passages)),
    over150: xs.filter((s) => s.total > 150).length, emptyPct: r2((100 * xs.filter((s) => s.passages === 0).length) / Math.max(1, xs.length)) });
  const group = (key: string) => Object.fromEntries([...new Set(samples.map((s) => s[key]))].sort().map((k) => [k, agg(samples.filter((s) => s[key] === k))]));
  console.log(JSON.stringify({ cmd: 'e2e', lang: LANG, db: env.DB_NAME, seed, rounds, scope: scopeOverride, n: samples.length, errors,
    resultStableAcrossRepeats: unstable.size === 0, unstable: [...unstable],
    session: { wallS: r2(wallS), pgCpuS: cpu0 !== null && cpu1 !== null ? r2((cpu1 - cpu0) / 1e6) : null, pgCpuPctOfOneCore: cpu0 !== null && cpu1 !== null ? r2((100 * (cpu1 - cpu0)) / 1e6 / wallS) : null,
      pgMemBytes: [pgMem0, pgMem1], blksHit: Number(st1.h) - Number(st0.h), blksRead: Number(st1.r) - Number(st0.r), tempBytes: Number(st1.t) - Number(st0.t),
      clientRssMaxMB: r2(rssMax / 1048576), clientHeapMaxMB: r2(heapMax / 1048576), loadavg1Start: r2(load0[0]), loadavg1End: r2(load1[0]) },
    overall: agg(samples), byCategory: group('cat'), byClass: group('cls'), byQuery: group('q') }));
}

(async () => {
  const [cmd, a1, a2, a3, a4] = process.argv.slice(2);
  if (cmd === 'prepare') cmdPrepare(a1, a2);
  else if (cmd === 'ingest') await cmdIngest(a1);
  else if (cmd === 'profile') await cmdProfile(a1);
  else if (cmd === 'freeze') await cmdFreeze(a1);
  else if (cmd === 'info') await cmdInfo(a1, a2 ?? 'declared');
  else if (cmd === 'relevance') await cmdRelevance(a1, a2);
  else if (cmd === 'e2e') await cmdE2e(a1, Number(a2), Number(a3 ?? 3), a4 ?? 'declared');
  else throw new Error('usage: prepare <raw> <out> | ingest <norm> | profile <norm> | freeze <q.json> | info <q.json> [scope] | relevance <q.json> <norm> | e2e <q.json> <seed> <rounds> [scope]');
})().catch((e) => { console.error(e?.message ?? e); process.exit(1); });
