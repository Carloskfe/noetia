/**
 * NEM-024 PO-048 — E-1 retrieval-ranking DIAGNOSTICS (test tooling only; never imported by src; opt-in).
 *
 * Runs against the DISPOSABLE fixture left by the NEM-023 performance suite (NEM023_PERF=1 NEM023_PERF_KEEP=1):
 * 10 books × 2,000,000 code points in a local PostgreSQL and MinIO. Run from services/api with ts-node:
 *
 *   NEM019_DISPOSABLE_DB=1 DB_*=… MINIO_*=… npx ts-node -T -P tsconfig.json tests/perf/e1-ranking-diag.ts <cmd> [args]
 *
 * Commands (all print one JSON line; nothing content-bearing is printed — queries are identified as Q0..Q9 and
 * book ids, hashes and keys never leave the process):
 *   info                      fixture summary + per-query match counts
 *   e2e <order> <rounds>      end-to-end retrieve() with the PRODUCTION service, real MinIO and the S2 worker,
 *                             instrumented per stage (SQL by statement, transaction wall, S2 read/verify, assembly).
 *                             order = fwd | rev | shuffle:<seed>
 *   explain                   EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) of the production STATUS/RANK/key SQL per query
 *   sql <variant> <reps>      a SQL variant vs the production RANK_SQL: client wall, server execution time
 *                             (EXPLAIN ANALYZE, TIMING OFF), and exact result equivalence (ids, ranks, order)
 *
 * The production RANK_SQL / STATUS_SQL are read verbatim from src/knowledge/retrieval/lexical-retrieval.service.ts,
 * so the baseline is always the authorized SQL. Variants are test-only text substitutions, run in this process only.
 */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-var-requires */
import { readFileSync } from 'fs';
import { join } from 'path';

const env = process.env;
if (env.NEM019_DISPOSABLE_DB !== '1' || !['127.0.0.1', 'localhost'].includes(env.DB_HOST ?? '') || !/_test$/.test(env.DB_NAME ?? '')) {
  throw new Error('disposable local *_test database only');
}
const SRC = readFileSync(join(process.cwd(), 'src/knowledge/retrieval/lexical-retrieval.service.ts'), 'utf8');
const sqlConst = (name: string) => { const m = new RegExp(`const ${name} = \`([\\s\\S]*?)\`;`).exec(SRC); if (!m) throw new Error(`${name} not found`); return m[1]; };
export const RANK_SQL = sqlConst('RANK_SQL');
export const STATUS_SQL = sqlConst('STATUS_SQL');
const KEYS_SQL = `SELECT id, "textFileKey" FROM books WHERE id = ANY($1::uuid[])`;
const TOPK = 8;
const BUDGET = 6000;

/** Same deterministic vocabulary as the NEM-023 performance suite (verified by identical match counts). */
function vocabulary(n: number): string[] {
  const syl = ['ra', 'mo', 'ti', 'sa', 'le', 'no', 'ca', 've', 'du', 'pi', 'ña', 'ló', 'gue', 'trí', 'bas', 'cen', 'fo', 'ju', 'xe', 'zú'];
  const out: string[] = [];
  for (let i = 0; out.length < n; i++) {
    let w = ''; let x = i + 7;
    do { w += syl[x % syl.length]; x = Math.floor(x / syl.length); } while (x > 0);
    out.push(w);
  }
  return out;
}
const V = vocabulary(6000);
/** The governing E-1 query mix, in the suite's order. Categories are labels only. */
export const QUERIES: { id: string; cat: string; q: string }[] = [
  { id: 'Q0', cat: 'high-frequency', q: V[3] },
  { id: 'Q1', cat: 'medium-high', q: V[40] },
  { id: 'Q2', cat: 'medium', q: V[400] },
  { id: 'Q3', cat: 'low', q: V[2500] },
  { id: 'Q4', cat: 'multi-term AND', q: `${V[10]} ${V[11]}` },
  { id: 'Q5', cat: 'boolean OR', q: `${V[100]} or ${V[900]}` },
  { id: 'Q6', cat: 'phrase', q: `"${V[5]} ${V[6]}"` },
  { id: 'Q7', cat: 'rare', q: V[5999] },
  { id: 'Q8', cat: 'no-match', q: 'inexistente' },
  { id: 'Q9', cat: 'low-medium', q: V[1200] },
];
/** DIAGNOSTIC-ONLY adversarial multi-term set (E1_EXTRA=1): NOT part of the E-1 benchmark; reported separately. */
const EXTRA: { id: string; cat: string; q: string }[] = [
  { id: 'X0', cat: 'OR high+rare', q: `${V[3]} or ${V[5999]}` },
  { id: 'X1', cat: 'OR high+high', q: `${V[3]} or ${V[4]}` },
  { id: 'X2', cat: 'OR high+medium', q: `${V[3]} or ${V[400]}` },
  { id: 'X3', cat: 'AND high+high', q: `${V[3]} ${V[4]}` },
  { id: 'X4', cat: 'AND high+medium', q: `${V[3]} ${V[400]}` },
  { id: 'X5', cat: 'AND three frequent', q: `${V[3]} ${V[7]} ${V[12]}` },
  { id: 'X6', cat: 'phrase frequent pair', q: `"${V[3]} ${V[4]}"` },
  { id: 'X7', cat: 'phrase medium pair', q: `"${V[40]} ${V[41]}"` },
  { id: 'X8', cat: 'OR three medium', q: `${V[40]} or ${V[41]} or ${V[42]}` },
  { id: 'X9', cat: 'AND+NOT', q: `${V[3]} -${V[4]}` },
];
if (env.E1_EXTRA === '1') { QUERIES.length = 0; QUERIES.push(...EXTRA); }

const pct = (xs: number[], p: number) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]; };
const r2 = (x: number | null) => (x === null ? null : Math.round(x * 100) / 100);
const stats = (xs: number[]) => ({ n: xs.length, p50: r2(pct(xs, 50)), p95: r2(pct(xs, 95)), p99: r2(pct(xs, 99)), max: r2(xs.length ? Math.max(...xs) : null), mean: r2(xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null) });
const hr = () => process.hrtime.bigint();
const ms = (t0: bigint) => Number(hr() - t0) / 1e6;

async function pg() {
  const { Client } = require('pg');
  const c = new Client({ host: env.DB_HOST, port: Number(env.DB_PORT), database: env.DB_NAME, user: env.DB_USER, password: env.DB_PASS });
  await c.connect();
  return c;
}
async function allowedPairs(c: any): Promise<{ books: string[]; hashes: string[] }> {
  const rows = (await c.query(`SELECT DISTINCT "bookId" b, "textHash" h FROM ai_book_chunks ORDER BY 1`)).rows;
  return { books: rows.map((r: any) => r.b), hashes: rows.map((r: any) => r.h) };
}

// ── variants (test-only SQL text; each documents its equivalence class) ─────────────────────────────────────────
type Variant = { cls: 'exact-setting' | 'exact-structural' | 'lossy-cap' | 'semantic-change' | 'baseline'; pre?: string[]; sql: (topK: number) => string; note: string };
function branchLimitedSql(): string {
  // Build explicitly to avoid fragile regexes: per-language branch keeps its predicate and computes the same rank,
  // keeps only its own top-K by the SAME total order, then the outer query applies the original ORDER BY/LIMIT.
  const branch = (lang: string) => `(SELECT c.id, c."bookId", c."textHash", c."chunkIndex", c."charStart", c."charEnd", c.language,
           ts_rank_cd(c.tsv, q.q, 32) AS rank
      FROM ai_book_chunks c
      JOIN allowed a ON a.b = c."bookId" AND a.h = c."textHash"
      CROSS JOIN (SELECT websearch_to_tsquery('noetia_${lang}'::regconfig, $3) AS q) q
     WHERE c.language = '${lang}' AND c.tsv @@ q.q
     ORDER BY rank DESC, c."bookId", c."chunkIndex" LIMIT $4)`;
  return `
  WITH allowed(b, h) AS (SELECT * FROM unnest($1::uuid[], $2::text[]))
  SELECT r.* FROM (
    ${branch('es')}
    UNION ALL
    ${branch('en')}
    UNION ALL
    ${branch('simple')}
  ) r
  ORDER BY r.rank DESC, r."bookId", r."chunkIndex"
  LIMIT $4`;
}
/** DIAGNOSTIC: stage 1 orders matches by the cheaper ts_rank (same predicates/eligibility), keeps M per branch;
 * stage 2 computes the production ts_rank_cd on those M and applies the production ORDER BY/LIMIT. */
function twoStageSql(m: number): string {
  const branch = (lang: string) => `(SELECT s.id, s."bookId", s."textHash", s."chunkIndex", s."charStart", s."charEnd", s.language, ts_rank_cd(s.tsv, s.q, 32) AS rank FROM (
      SELECT c.id, c."bookId", c."textHash", c."chunkIndex", c."charStart", c."charEnd", c.language, c.tsv, q.q
        FROM ai_book_chunks c
        JOIN allowed a ON a.b = c."bookId" AND a.h = c."textHash"
        CROSS JOIN (SELECT websearch_to_tsquery('noetia_${lang}'::regconfig, $3) AS q) q
       WHERE c.language = '${lang}' AND c.tsv @@ q.q
       ORDER BY ts_rank(c.tsv, q.q, 32) DESC, c."bookId", c."chunkIndex" LIMIT ${m}) s)`;
  return `
  WITH allowed(b, h) AS (SELECT * FROM unnest($1::uuid[], $2::text[]))
  SELECT r.* FROM (
    ${branch('es')}
    UNION ALL
    ${branch('en')}
    UNION ALL
    ${branch('simple')}
  ) r
  ORDER BY r.rank DESC, r."bookId", r."chunkIndex"
  LIMIT $4`;
}
/** EXACT HYBRID (diagnostic): two-stage only when the parsed tsquery is a single lexeme (numnode = 1), where ts_rank and
 * ts_rank_cd are both strictly increasing in that lexeme's occurrence count (uniform weights); otherwise the production
 * full ranking. Both arms keep the production predicates, eligibility join, rank expression and ORDER BY/LIMIT. */
function hybridSql(m: number): string {
  const arm = (lang: string, single: boolean) => single
    ? `(SELECT s.id, s."bookId", s."textHash", s."chunkIndex", s."charStart", s."charEnd", s.language, ts_rank_cd(s.tsv, s.q, 32) AS rank FROM (
      SELECT c.id, c."bookId", c."textHash", c."chunkIndex", c."charStart", c."charEnd", c.language, c.tsv, q.q
        FROM ai_book_chunks c JOIN allowed a ON a.b = c."bookId" AND a.h = c."textHash"
        CROSS JOIN (SELECT websearch_to_tsquery('noetia_${lang}'::regconfig, $3) AS q) q
       WHERE c.language = '${lang}' AND c.tsv @@ q.q AND numnode(q.q) = 1
       ORDER BY ts_rank(c.tsv, q.q, 32) DESC, c."bookId", c."chunkIndex" LIMIT ${m}) s)`
    : `(SELECT c.id, c."bookId", c."textHash", c."chunkIndex", c."charStart", c."charEnd", c.language, ts_rank_cd(c.tsv, q.q, 32) AS rank
        FROM ai_book_chunks c JOIN allowed a ON a.b = c."bookId" AND a.h = c."textHash"
        CROSS JOIN (SELECT websearch_to_tsquery('noetia_${lang}'::regconfig, $3) AS q) q
       WHERE c.language = '${lang}' AND c.tsv @@ q.q AND numnode(q.q) <> 1)`;
  const all = ['es', 'en', 'simple'].flatMap((l) => [arm(l, true), arm(l, false)]).join('\n    UNION ALL\n    ');
  return `
  WITH allowed(b, h) AS (SELECT * FROM unnest($1::uuid[], $2::text[]))
  SELECT r.* FROM (
    ${all}
  ) r
  ORDER BY r.rank DESC, r."bookId", r."chunkIndex"
  LIMIT $4`;
}
const capSql = (cap: number) => RANK_SQL.replace(/WHERE c\.language = '(es|en|simple)' AND c\.tsv @@ q\.q/g,
  (_m, lang) => `WHERE c.language = '${lang}' AND c.tsv @@ q.q AND c.id IN (SELECT c2.id FROM ai_book_chunks c2 JOIN allowed a2 ON a2.b = c2."bookId" AND a2.h = c2."textHash", (SELECT websearch_to_tsquery('noetia_${lang}'::regconfig, $3) AS q) q2 WHERE c2.language = '${lang}' AND c2.tsv @@ q2.q ORDER BY c2."bookId", c2."chunkIndex" LIMIT ${cap})`);
const VARIANTS: Record<string, Variant> = {
  base: { cls: 'baseline', sql: () => RANK_SQL, note: 'production RANK_SQL verbatim' },
  jitoff: { cls: 'exact-setting', pre: ['SET LOCAL jit = off'], sql: () => RANK_SQL, note: 'same SQL; transaction-local jit=off' },
  workmem: { cls: 'exact-setting', pre: ['SET LOCAL work_mem = \'16MB\''], sql: () => RANK_SQL, note: 'same SQL; transaction-local work_mem 16MB' },
  branchlimit: { cls: 'exact-structural', sql: branchLimitedSql, note: 'per-language branch top-K by the same total order, then the original global ORDER BY/LIMIT' },
  branchlimit_jitoff: { cls: 'exact-structural', pre: ['SET LOCAL jit = off'], sql: branchLimitedSql, note: 'branchlimit + jit=off' },
  norank: { cls: 'semantic-change', sql: () => RANK_SQL.replace(/ts_rank_cd\(c\.tsv, q\.q, 32\)/g, '0::real'), note: 'DIAGNOSTIC ONLY: rank removed (measures ranking cost; different order)' },
  detoast: { cls: 'semantic-change', sql: () => RANK_SQL.replace(/ts_rank_cd\(c\.tsv, q\.q, 32\)/g, 'length(c.tsv)::real'), note: 'DIAGNOSTIC ONLY: forces the tsvector detoast with a trivial function (measures detoast vs ranking cost)' },
  tsrank: { cls: 'semantic-change', sql: () => RANK_SQL.replace(/ts_rank_cd\(c\.tsv, q\.q, 32\)/g, 'ts_rank(c.tsv, q.q, 32)'), note: 'DIAGNOSTIC ONLY: ts_rank instead of ts_rank_cd (different scores)' },
  twostage200: { cls: 'lossy-cap', sql: () => twoStageSql(200), note: 'DIAGNOSTIC ONLY: ts_rank top-200 per branch, then production ts_rank_cd ordering (exact only where both rank orders agree)' },
  twostage50: { cls: 'lossy-cap', sql: () => twoStageSql(50), note: 'DIAGNOSTIC ONLY: two-stage, M=50' },
  twostage400: { cls: 'lossy-cap', sql: () => twoStageSql(400), note: 'DIAGNOSTIC ONLY: two-stage, M=400' },
  hybrid200: { cls: 'exact-structural', sql: () => hybridSql(200), note: 'two-stage only for single-lexeme queries (provably exact there); production full ranking otherwise' },
  cap500: { cls: 'lossy-cap', sql: () => capSql(500), note: 'DIAGNOSTIC ONLY: score at most 500 candidates per branch (by bookId, chunkIndex) before ranking' },
  cap2000: { cls: 'lossy-cap', sql: () => capSql(2000), note: 'DIAGNOSTIC ONLY: candidate cap 2000' },
};

async function runVariant(c: any, v: Variant, books: string[], hashes: string[], q: string): Promise<{ rows: any[]; wall: number }> {
  const t0 = hr();
  await c.query('BEGIN');
  try {
    await c.query('SET LOCAL statement_timeout = 2000');
    for (const p of v.pre ?? []) await c.query(p);
    const rows = (await c.query(v.sql(TOPK), [books, hashes, q, TOPK])).rows;
    await c.query('COMMIT');
    return { rows, wall: ms(t0) };
  } catch (e) { await c.query('ROLLBACK'); throw e; }
}
async function serverExec(c: any, v: Variant, books: string[], hashes: string[], q: string, timing = false): Promise<any> {
  await c.query('BEGIN');
  try {
    for (const p of v.pre ?? []) await c.query(p);
    const [{ 'QUERY PLAN': plan }] = (await c.query(`EXPLAIN (ANALYZE, BUFFERS, TIMING ${timing ? 'ON' : 'OFF'}, FORMAT JSON) ${v.sql(TOPK)}`, [books, hashes, q, TOPK])).rows;
    await c.query('COMMIT');
    return plan[0];
  } catch (e) { await c.query('ROLLBACK'); throw e; }
}
function summarizePlan(p: any) {
  const nodes: any[] = [];
  const walk = (n: any, depth: number) => {
    nodes.push({ depth, type: n['Node Type'], rel: n['Relation Name'], index: n['Index Name'], strategy: n.Strategy, planRows: n['Plan Rows'], actualRows: n['Actual Rows'], loops: n['Actual Loops'],
      totalMs: n['Actual Total Time'], startupMs: n['Actual Startup Time'], sortMethod: n['Sort Method'], sortSpaceKB: n['Sort Space Used'], sortSpaceType: n['Sort Space Type'],
      sharedHit: n['Shared Hit Blocks'], sharedRead: n['Shared Read Blocks'], tempRead: n['Temp Read Blocks'], tempWritten: n['Temp Written Blocks'], heapBlocksExact: n['Exact Heap Blocks'], heapBlocksLossy: n['Lossy Heap Blocks'], recheckRemoved: n['Rows Removed by Index Recheck'], filterRemoved: n['Rows Removed by Filter'] });
    for (const ch of n.Plans ?? []) walk(ch, depth + 1);
  };
  walk(p.Plan, 0);
  const jit = p.JIT ? { functions: p.JIT.Functions, timingMs: p.JIT.Timing ? { generation: p.JIT.Timing.Generation?.Total ?? p.JIT.Timing.Generation, inlining: p.JIT.Timing.Inlining, optimization: p.JIT.Timing.Optimization, emission: p.JIT.Timing.Emission, total: p.JIT.Timing.Total } : null, options: p.JIT.Options } : null;
  return { planningMs: p['Planning Time'], executionMs: p['Execution Time'], jit, planningBuffers: p.Planning ? { hit: p.Planning['Shared Hit Blocks'], read: p.Planning['Shared Read Blocks'] } : null, nodes };
}
const rowsKey = (rows: any[]) => rows.map((r) => `${r.id}|${Number(r.rank).toFixed(6)}`);

async function cmdInfo() {
  const c = await pg();
  const { books } = await allowedPairs(c);
  const counts: any[] = [];
  for (const { id, cat, q } of QUERIES) {
    const [{ n }] = (await c.query(`SELECT count(*)::int n FROM ai_book_chunks WHERE language = 'es' AND tsv @@ websearch_to_tsquery('noetia_es'::regconfig, $1)`, [q])).rows;
    const [{ nb }] = (await c.query(`SELECT count(DISTINCT "bookId")::int nb FROM ai_book_chunks WHERE language = 'es' AND tsv @@ websearch_to_tsquery('noetia_es'::regconfig, $1)`, [q])).rows;
    counts.push({ id, cat, matches: n, matchingBooks: nb });
  }
  const [sz] = (await c.query(`SELECT count(*)::int chunks, pg_relation_size('ai_book_chunks') heap, (SELECT pg_total_relation_size(reltoastrelid) FROM pg_class WHERE relname='ai_book_chunks') toast, pg_indexes_size('ai_book_chunks') idx, avg(pg_column_size(tsv))::int tsvavg FROM ai_book_chunks`)).rows;
  const idx = (await c.query(`SELECT indexrelname, pg_relation_size(indexrelid) sz FROM pg_stat_user_indexes WHERE relname='ai_book_chunks'`)).rows;
  const settings = (await c.query(`SELECT name, setting, unit FROM pg_settings WHERE name IN ('jit','jit_above_cost','jit_inline_above_cost','jit_optimize_above_cost','work_mem','shared_buffers','effective_cache_size','random_page_cost','max_parallel_workers_per_gather','default_statistics_target','server_version')`)).rows;
  await c.end();
  console.log(JSON.stringify({ cmd: 'info', books: books.length, size: sz, indexes: idx, settings, queries: counts }));
}

async function cmdExplain() {
  const c = await pg();
  const { books, hashes } = await allowedPairs(c);
  const out: any[] = [];
  for (const { id, q } of QUERIES) {
    if (env.E1_NOWARM !== '1') for (let w = 0; w < 2; w++) await runVariant(c, VARIANTS.base, books, hashes, q); // warm (E1_NOWARM=1: cold first execution)
    const rank = summarizePlan(await serverExec(c, VARIANTS.base, books, hashes, q, true));
    const rankNoTiming = summarizePlan(await serverExec(c, VARIANTS.base, books, hashes, q, false));
    const statusPlan = (await c.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${STATUS_SQL}`, [books, hashes])).rows[0]['QUERY PLAN'][0];
    const resultBooks = [...new Set((await runVariant(c, VARIANTS.base, books, hashes, q)).rows.map((r: any) => r.bookId))];
    const keysPlan = resultBooks.length ? (await c.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${KEYS_SQL}`, [resultBooks])).rows[0]['QUERY PLAN'][0] : null;
    out.push({ id, rank, rankTimingOffExecMs: rankNoTiming.executionMs, rankTimingOffPlanningMs: rankNoTiming.planningMs, rankTimingOffJit: rankNoTiming.jit,
      status: { planningMs: statusPlan['Planning Time'], executionMs: statusPlan['Execution Time'] }, keys: keysPlan ? { planningMs: keysPlan['Planning Time'], executionMs: keysPlan['Execution Time'] } : null, resultBooks: resultBooks.length });
  }
  await c.end();
  console.log(JSON.stringify({ cmd: 'explain', queries: out }));
}

async function cmdSql(name: string, reps: number) {
  const v = VARIANTS[name];
  if (!v) throw new Error('unknown variant');
  const c = await pg();
  const { books, hashes } = await allowedPairs(c);
  const out: any[] = [];
  const allWall: number[] = [];
  for (const { id, q } of QUERIES) {
    const base = await runVariant(c, VARIANTS.base, books, hashes, q);
    const baseKey = rowsKey(base.rows);
    for (let w = 0; w < 2; w++) await runVariant(c, v, books, hashes, q);
    const wall: number[] = []; const exec: number[] = []; const plan: number[] = []; let jitMs = 0; let identical = true; let overlap = 0; let firstMiss: number | null = null;
    for (let i = 0; i < reps; i++) {
      const r = await runVariant(c, v, books, hashes, q);
      wall.push(r.wall); allWall.push(r.wall);
      const key = rowsKey(r.rows);
      if (JSON.stringify(key) !== JSON.stringify(baseKey)) identical = false;
      if (i === 0) {
        const ids = new Set(r.rows.map((x: any) => x.id));
        overlap = base.rows.filter((x: any) => ids.has(x.id)).length;
        const miss = base.rows.findIndex((x: any) => !ids.has(x.id));
        firstMiss = miss < 0 ? null : miss + 1;
      }
    }
    for (let i = 0; i < Math.min(5, reps); i++) {
      const p = summarizePlan(await serverExec(c, v, books, hashes, q));
      exec.push(p.executionMs); plan.push(p.planningMs); jitMs = Math.max(jitMs, p.jit?.timingMs?.total ?? 0);
    }
    out.push({ id, rows: base.rows.length, wallMs: stats(wall), serverExecMs: stats(exec), planningMs: stats(plan), jitMaxMs: r2(jitMs),
      identicalToBaseline: identical, recallAtK: base.rows.length ? r2(overlap / base.rows.length) : 1, firstMissingBaselineRank: firstMiss });
  }
  await c.end();
  console.log(JSON.stringify({ cmd: 'sql', variant: name, cls: v.cls, note: v.note, reps, allWallMs: stats(allWall), queries: out }));
}

async function cmdE2e(order: string, rounds: number) {
  const { KnowledgeDbService } = require('../../src/knowledge/common/knowledge-db.service');
  const { LexicalRetrievalService } = require('../../src/knowledge/retrieval/lexical-retrieval.service');
  const { RetrievalMetricsService } = require('../../src/knowledge/retrieval/retrieval-metrics.service');
  const { DEFAULT_RETRIEVAL_CONFIG } = require('../../src/knowledge/retrieval/retrieval.types');
  const { StorageBookText } = require('../../src/knowledge/retrieval/storage-book-text');
  const { processS2Verifier } = require('../../src/knowledge/retrieval/s2-verification.service');
  const { StorageService } = require('../../src/storage/storage.service');
  const { openDataSource, IT_CONFIG } = require('../integration/knowledge/support/it-env');
  const ds = await openDataSource();
  const db = new KnowledgeDbService(ds, IT_CONFIG);
  const store = new StorageBookText(new StorageService());
  const pool = processS2Verifier();
  // ── per-request stage recorder (test-only wrappers around the same objects the service uses) ──
  let cur: any = null;
  const origTx = db.transaction.bind(db);
  db.transaction = async (fn: any) => {
    const t0 = hr();
    try {
      return await origTx(async (m: any) => {
        const q0 = m.query.bind(m);
        const proxy = Object.create(m);
        proxy.query = async (sql: string, params?: any[]) => {
          const t = hr();
          const subst = env.E1_SUBST && /ts_rank_cd/.test(sql) ? VARIANTS[env.E1_SUBST].sql(TOPK) : sql; // DIAGNOSTIC substitution (test-only)
          try { return await q0(subst, params); } finally {
            const k = /ts_rank_cd/.test(sql) ? 'rankSql' : /EXISTS \(SELECT 1 FROM ai_book_chunks/.test(sql) ? 'statusSql' : /textFileKey/.test(sql) ? 'keysSql' : /statement_timeout/.test(sql) ? 'setLocal' : 'otherSql';
            if (cur) cur[k] = (cur[k] ?? 0) + ms(t);
          }
        };
        return fn(proxy);
      });
    } finally { if (cur) { cur.txWall = ms(t0); cur.tTxEnd = hr(); } }
  };
  const origRead = store.read.bind(store);
  store.read = async (k: string) => { const t = hr(); try { return await origRead(k); } finally { if (cur) { cur.reads.push(ms(t)); } } };
  const origVerify = pool.verify.bind(pool);
  pool.verify = async (b: any, h: string, r: any) => { const t = hr(); try { return await origVerify(b, h, r); } finally { if (cur) { cur.verifies.push(ms(t)); cur.tS2End = hr(); } } };
  const retrieval = new LexicalRetrievalService(db, store, new RetrievalMetricsService(), DEFAULT_RETRIEVAL_CONFIG, pool);
  const c = await pg();
  const { books, hashes } = await allowedPairs(c);
  await c.end();
  const allowed = books.map((b, i) => ({ bookId: b, textHash: hashes[i] }));
  for (const { q } of QUERIES) await retrieval.retrieve({ allowed, query: q, topK: TOPK, budgetTokens: BUDGET }); // warm-up (as the suite)
  const seq: number[] = [];
  let rng = Number(order.split(':')[1] ?? 1) >>> 0 || 1;
  const rand = () => { rng ^= rng << 13; rng ^= rng >>> 17; rng ^= rng << 5; return (rng >>> 0) / 4294967296; };
  for (let r = 0; r < rounds; r++) {
    const idx = QUERIES.map((_, i) => i);
    if (order === 'rev') idx.reverse();
    if (order.startsWith('shuffle')) for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    seq.push(...idx);
  }
  const samples: any[] = [];
  const cpu0 = process.cpuUsage();
  for (const i of seq) {
    cur = { q: QUERIES[i].id, reads: [], verifies: [] };
    const t0 = hr();
    const res = await retrieval.retrieve({ allowed, query: QUERIES[i].q, topK: TOPK, budgetTokens: BUDGET });
    const total = ms(t0);
    const s2Phase = cur.tS2End && cur.tTxEnd ? Number(cur.tS2End - cur.tTxEnd) / 1e6 : 0;
    samples.push({ q: cur.q, total, txWall: cur.txWall ?? 0, statusSql: cur.statusSql ?? 0, rankSql: cur.rankSql ?? 0, keysSql: cur.keysSql ?? 0, setLocal: cur.setLocal ?? 0,
      txOverhead: (cur.txWall ?? 0) - (cur.statusSql ?? 0) - (cur.rankSql ?? 0) - (cur.keysSql ?? 0) - (cur.setLocal ?? 0),
      s2Phase, readMax: cur.reads.length ? Math.max(...cur.reads) : 0, verifyMax: cur.verifies.length ? Math.max(...cur.verifies) : 0, books: cur.reads.length,
      assembly: total - (cur.txWall ?? 0) - s2Phase, passages: res.passages.length });
    cur = null;
  }
  const cpu = process.cpuUsage(cpu0);
  const fields = ['total', 'txWall', 'statusSql', 'rankSql', 'keysSql', 'setLocal', 'txOverhead', 's2Phase', 'readMax', 'verifyMax', 'assembly'];
  const agg = (xs: any[]) => Object.fromEntries(fields.map((f) => [f, stats(xs.map((s) => s[f]))]));
  const byQuery = Object.fromEntries(QUERIES.map(({ id }) => [id, { ...agg(samples.filter((s) => s.q === id)), books: r2(samples.filter((s) => s.q === id).reduce((a, s) => a + s.books, 0) / rounds) }]));
  const poolStats = pool.stats();
  await pool.shutdown();
  await ds.destroy();
  console.log(JSON.stringify({ cmd: 'e2e', order, rounds, n: samples.length, overall: agg(samples), byQuery, nodeCpuMs: r2((cpu.user + cpu.system) / 1000), s2Pool: { transferred: poolStats.transferred, copied: poolStats.copied, waitMsMax: poolStats.waitMsMax, execMsTotal: r2(poolStats.execMsTotal) } }));
}

/** Content-free fingerprint of the production RANK_SQL result per query (sha256 over ordered id|rank), for cross-DB checks. */
async function cmdFingerprint() {
  const { createHash } = require('crypto');
  const c = await pg();
  const { books, hashes } = await allowedPairs(c);
  const out: Record<string, string> = {};
  for (const { id, q } of QUERIES) out[id] = createHash('sha256').update(rowsKey((await runVariant(c, VARIANTS.base, books, hashes, q)).rows).join(',')).digest('hex').slice(0, 16);
  const [sz] = (await c.query(`SELECT (SELECT pg_total_relation_size(reltoastrelid) FROM pg_class WHERE relname='ai_book_chunks') toast, pg_relation_size('ai_book_chunks') heap, avg(pg_column_size(tsv))::int tsvavg,
    (SELECT attcompression FROM pg_attribute WHERE attrelid='ai_book_chunks'::regclass AND attname='tsv') compression, (SELECT attstorage FROM pg_attribute WHERE attrelid='ai_book_chunks'::regclass AND attname='tsv') storage FROM ai_book_chunks`)).rows;
  await c.end();
  console.log(JSON.stringify({ cmd: 'fingerprint', db: env.DB_NAME, storage: sz, results: out }));
}

const [cmd, a1, a2] = process.argv.slice(2);
(async () => {
  if (cmd === 'info') await cmdInfo();
  else if (cmd === 'explain') await cmdExplain();
  else if (cmd === 'fingerprint') await cmdFingerprint();
  else if (cmd === 'sql') await cmdSql(a1, Number(a2 ?? 10));
  else if (cmd === 'e2e') await cmdE2e(a1 ?? 'fwd', Number(a2 ?? 10));
  else throw new Error('usage: info | explain | sql <variant> <reps> | e2e <order> <rounds>');
  process.exit(0);
})().catch((e) => { console.error(String(e?.stack ?? e)); process.exit(1); });
