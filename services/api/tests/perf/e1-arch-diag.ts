/**
 * NEM-024 PO-049 — E-1 ARCHITECTURE VALIDATION diagnostics (test tooling only; never imported by src; opt-in).
 *
 * Disposable local PostgreSQL / MinIO only (refuses anything else). Run from services/api:
 *   NEM019_DISPOSABLE_DB=1 DB_HOST=127.0.0.1 DB_PORT=… DB_NAME=<x>_test DB_USER=… DB_PASS=… [MINIO_*=…] \
 *     npx ts-node -T -P tsconfig.json tests/perf/e1-arch-diag.ts <cmd> [args]
 *
 * Commands (each prints one JSON line; no book text, query text, ids, hashes or keys are printed):
 *   rankfn                         F-48-1: exhaustive single-lexeme ts_rank / ts_rank_cd table (n = 1..300), bit-level,
 *                                  position independence, precondition counterexample values.
 *   prop <seed> <rows> [violate]   F-48-1: property-based differential vs the production RANK_SQL on a synthetic fixture
 *                                  (DB name must end in _prop_test; the table is TRUNCATED). `violate` adds weighted
 *                                  and stripped vectors (precondition violations) — mismatches are EXPECTED there.
 *   counterexamples                F-48-1: replays the deterministic precondition-violation regression cases
 *                                  (fixtures/po049-hybrid-counterexamples.json) on a _prop_test DB.
 *   build-b                        F-48-2: builds the supplementary Distribution-B corpus (10 × 2,000,000 code points,
 *                                  production chunking/indexer) in a DB whose name ends in _b_test.
 *   info <set>                     match counts / selectivity per query of set A | B | C | D.
 *   sql <set> <variant> <reps>     server execution + client wall + FULL-PRECISION equivalence vs RANK_SQL.
 *   e2e <set> <variant> <rounds>   production LexicalRetrievalService (real MinIO + S2 worker), ranking SQL substituted
 *                                  test-only; per-stage timings + retrieve() CONTRACT equivalence (sha256 of the result).
 *
 * Sets: A = governing NEM-023 E-1 mix (unchanged), D = adversarial stress (X0..X9) on the governing corpus,
 *       B = Distribution-B mirror of the governing categories, C = mixed realistic-style workload on the B corpus.
 * Variants: base (production RANK_SQL verbatim), hybrid<M> (PO-048 single-lexeme hybrid), thresh<M> (PO-049 exact
 *           threshold pruning with an occurrence-count upper bound), plus base on an inline-storage clone via DB_NAME.
 */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-var-requires */
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';

const env = process.env;
if (env.NEM019_DISPOSABLE_DB !== '1' || !['127.0.0.1', 'localhost'].includes(env.DB_HOST ?? '') || !/_test$/.test(env.DB_NAME ?? '')) {
  throw new Error('disposable local *_test database only');
}
const SRC = readFileSync(join(process.cwd(), 'src/knowledge/retrieval/lexical-retrieval.service.ts'), 'utf8');
const sqlConst = (name: string) => { const m = new RegExp(`const ${name} = \`([\\s\\S]*?)\`;`).exec(SRC); if (!m) throw new Error(`${name} not found`); return m[1]; };
const RANK_SQL = sqlConst('RANK_SQL');
const LANGS = ['es', 'en', 'simple'] as const;
const BUDGET = 6000;

// ── statistics ───────────────────────────────────────────────────────────────────────────────────────────────────
const pct = (xs: number[], p: number) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]; };
const r2 = (x: number | null) => (x === null ? null : Math.round(x * 100) / 100);
const stats = (xs: number[]) => ({ n: xs.length, p50: r2(pct(xs, 50)), p95: r2(pct(xs, 95)), p99: r2(pct(xs, 99)), max: r2(xs.length ? Math.max(...xs) : null) });
const hr = () => process.hrtime.bigint();
const ms = (t0: bigint) => Number(hr() - t0) / 1e6;
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
function xorshift(seed: number) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; }; }

// ── query sets (content-free identifiers only are ever printed) ─────────────────────────────────────────────────
function govVocabulary(n: number): string[] { // identical to the NEM-023 suite
  const syl = ['ra', 'mo', 'ti', 'sa', 'le', 'no', 'ca', 've', 'du', 'pi', 'ña', 'ló', 'gue', 'trí', 'bas', 'cen', 'fo', 'ju', 'xe', 'zú'];
  const out: string[] = [];
  for (let i = 0; out.length < n; i++) { let w = ''; let x = i + 7; do { w += syl[x % syl.length]; x = Math.floor(x / syl.length); } while (x > 0); out.push(w); }
  return out;
}
const V = govVocabulary(6000);
type Q = { id: string; cat: string; q: string };
const SET_A: Q[] = [
  { id: 'Q0', cat: 'high-frequency', q: V[3] }, { id: 'Q1', cat: 'medium-high', q: V[40] }, { id: 'Q2', cat: 'medium', q: V[400] },
  { id: 'Q3', cat: 'low', q: V[2500] }, { id: 'Q4', cat: 'multi-term AND', q: `${V[10]} ${V[11]}` }, { id: 'Q5', cat: 'boolean OR', q: `${V[100]} or ${V[900]}` },
  { id: 'Q6', cat: 'phrase', q: `"${V[5]} ${V[6]}"` }, { id: 'Q7', cat: 'rare', q: V[5999] }, { id: 'Q8', cat: 'no-match', q: 'inexistente' }, { id: 'Q9', cat: 'low-medium', q: V[1200] },
];
const SET_D: Q[] = [
  { id: 'X0', cat: 'OR high+rare', q: `${V[3]} or ${V[5999]}` }, { id: 'X1', cat: 'OR high+high', q: `${V[3]} or ${V[4]}` },
  { id: 'X2', cat: 'OR high+medium', q: `${V[3]} or ${V[400]}` }, { id: 'X3', cat: 'AND high+high', q: `${V[3]} ${V[4]}` },
  { id: 'X4', cat: 'AND high+medium', q: `${V[3]} ${V[400]}` }, { id: 'X5', cat: 'AND three frequent', q: `${V[3]} ${V[7]} ${V[12]}` },
  { id: 'X6', cat: 'phrase frequent pair', q: `"${V[3]} ${V[4]}"` }, { id: 'X7', cat: 'phrase medium pair', q: `"${V[40]} ${V[41]}"` },
  { id: 'X8', cat: 'OR three medium', q: `${V[40]} or ${V[41]} or ${V[42]}` }, { id: 'X9', cat: 'AND+NOT', q: `${V[3]} -${V[4]}` },
];

/** Distribution B: Zipf(s = 1.0) over 50,000 ranks; ranks 1..|stop| are the PostgreSQL/Snowball Spanish stop words
 * (a published, frequency-ordered list), higher ranks synthetic content words. Invented, deterministic text only. */
const B_RANKS = 50_000;
function bContentWord(i: number): string { // i = 0-based content index; distinct syllable inventory from the governing set
  const syl = ['bri', 'dal', 'fen', 'gor', 'hul', 'jas', 'kel', 'mir', 'nob', 'pex', 'quil', 'ros', 'sut', 'tav', 'vun', 'wex', 'yor', 'zan', 'clo', 'dre', 'fli', 'gna', 'plu', 'stri'];
  let w = ''; let x = i + 31; do { w += syl[x % syl.length]; x = Math.floor(x / syl.length); } while (x > 0);
  return w + 'k'; // consonant ending: keeps Snowball from merging distinct synthetic words in most cases
}
function bVocabulary(stop: string[]): string[] {
  const out = [...stop];
  for (let i = 0; out.length < B_RANKS; i++) out.push(bContentWord(i));
  return out;
}
function bBookText(seed: number, vocab: string[], codePoints: number): string {
  const cdf: number[] = []; let acc = 0;
  for (let r = 1; r <= vocab.length; r++) { acc += 1 / r; cdf.push(acc); }
  const total = acc;
  const rnd = xorshift(createHash('sha256').update(`po049-b-${seed}`).digest().readUInt32LE(0));
  const pick = () => { const u = rnd() * total; let lo = 0; let hi = cdf.length - 1; while (lo < hi) { const mid = (lo + hi) >> 1; if (cdf[mid] < u) lo = mid + 1; else hi = mid; } return vocab[lo]; };
  const parts: string[] = []; let len = 0;
  while (len < codePoints) {
    const n = 8 + Math.floor(rnd() * 14); const words: string[] = [];
    for (let i = 0; i < n; i++) words.push(pick());
    let s = `${words.join(' ')}.`; s = s[0].toUpperCase() + s.slice(1);
    parts.push(s, rnd() < 0.15 ? '\n\n' : ' '); len += s.length + 1;
  }
  return parts.join('').slice(0, codePoints);
}
/** Content word by 1-based content rank (rank 1 = most frequent non-stop word). */
const bc = (rank: number) => bContentWord(rank - 1);
const SET_B: Q[] = [
  { id: 'B0', cat: 'most frequent content term', q: bc(1) }, { id: 'B1', cat: 'content rank 10', q: bc(10) }, { id: 'B2', cat: 'content rank 100', q: bc(100) },
  { id: 'B3', cat: 'content rank 1000', q: bc(1000) }, { id: 'B4', cat: 'multi-term AND (ranks 5, 50)', q: `${bc(5)} ${bc(50)}` },
  { id: 'B5', cat: 'boolean OR (ranks 20, 200)', q: `${bc(20)} or ${bc(200)}` }, { id: 'B6', cat: 'phrase (ranks 2, 3)', q: `"${bc(2)} ${bc(3)}"` },
  { id: 'B7', cat: 'rare (rank 40000)', q: bc(40000) }, { id: 'B8', cat: 'no-match', q: 'inexistente' }, { id: 'B9', cat: 'content rank 3000', q: bc(3000) },
];
/** Distribution C: mixed realistic-style workload on the B corpus — questions whose scaffolding is only Spanish stop words
 * (removed by the parser, so every content word is a corpus term),
 * single terms at log-uniform content ranks, multi-term questions, phrases, OR, no-match. Deterministic. */
function setC(): Q[] {
  const rnd = xorshift(4902);
  const lr = (lo: number, hi: number) => Math.round(Math.exp(Math.log(lo) + rnd() * (Math.log(hi) - Math.log(lo))));
  const out: Q[] = [];
  for (let i = 0; i < 6; i++) out.push({ id: `C${out.length}`, cat: 'single term (log-uniform rank 1..20000)', q: bc(lr(1, 20000)) });
  for (let i = 0; i < 4; i++) out.push({ id: `C${out.length}`, cat: 'question, 2 content terms', q: `¿qué hay del ${bc(lr(1, 5000))} y la ${bc(lr(1, 5000))}?` });
  for (let i = 0; i < 2; i++) out.push({ id: `C${out.length}`, cat: 'question, 3 content terms', q: `¿por qué ${bc(lr(1, 3000))} y ${bc(lr(1, 3000))} con ${bc(lr(1, 3000))}?` });
  for (let i = 0; i < 2; i++) out.push({ id: `C${out.length}`, cat: 'question, 1 content term', q: `¿quién era el ${bc(lr(1, 2000))} para ella?` });
  for (let i = 0; i < 2; i++) { const r = lr(1, 300); out.push({ id: `C${out.length}`, cat: 'phrase', q: `"${bc(r)} ${bc(r + 1)}"` }); }
  for (let i = 0; i < 2; i++) out.push({ id: `C${out.length}`, cat: 'OR', q: `${bc(lr(1, 2000))} or ${bc(lr(1, 2000))}` });
  out.push({ id: `C${out.length}`, cat: 'no-match', q: 'inexistente palabra' });
  out.push({ id: `C${out.length}`, cat: 'stop words only', q: '¿qué es lo que hay?' });
  return out;
}
const SETS: Record<string, Q[]> = { A: SET_A, B: SET_B, C: setC(), D: SET_D };

// ── variant SQL (test-only text; the production RANK_SQL is read verbatim from src) ─────────────────────────────
const branchHead = (lang: string) => `FROM ai_book_chunks c
        JOIN allowed a ON a.b = c."bookId" AND a.h = c."textHash"
        CROSS JOIN (SELECT websearch_to_tsquery('noetia_${lang}'::regconfig, $3) AS q) q
       WHERE c.language = '${lang}' AND c.tsv @@ q.q`;
const COLS = `c.id, c."bookId", c."textHash", c."chunkIndex", c."charStart", c."charEnd", c.language`;
/** PO-048 exact hybrid (unchanged logic), M as a literal. */
function hybridSql(m: number): string {
  const arm = (lang: string, single: boolean) => single
    ? `(SELECT s.id, s."bookId", s."textHash", s."chunkIndex", s."charStart", s."charEnd", s.language, ts_rank_cd(s.tsv, s.q, 32) AS rank FROM (
      SELECT ${COLS}, c.tsv, q.q ${branchHead(lang)} AND numnode(q.q) = 1
       ORDER BY ts_rank(c.tsv, q.q, 32) DESC, c."bookId", c."chunkIndex" LIMIT ${m}) s)`
    : `(SELECT ${COLS}, ts_rank_cd(c.tsv, q.q, 32) AS rank ${branchHead(lang)} AND numnode(q.q) <> 1)`;
  return `
  WITH allowed(b, h) AS (SELECT * FROM unnest($1::uuid[], $2::text[]))
  SELECT r.* FROM (
    ${LANGS.flatMap((l) => [arm(l, true), arm(l, false)]).join('\n    UNION ALL\n    ')}
  ) r
  ORDER BY r.rank DESC, r."bookId", r."chunkIndex"
  LIMIT $4`;
}
/**
 * PO-049 candidate C1 — EXACT THRESHOLD PRUNING (diagnostic).
 * For every matching row, S = Σ over the query's DISTINCT operand lexemes of that lexeme's stored position count, obtained
 * EXACTLY by inverting the single-lexeme ts_rank(…, 32) through width_bucket over F = [f(1) … f(255)] (F strictly
 * increasing — proven exhaustively by `rankfn`). Under uniform weights, ts_rank_cd's Wdoc ≤ 0.1 · S (each cover adds
 * ≤ 0.1, covers have distinct starting entries, doc entries ≤ S). Algorithm: score the M rows with the largest S exactly;
 * θ = K-th best exact rank among them; every other row whose bound could reach θ (S ≥ ⌈θ/(1−θ)/0.1 · 0.9999⌉; the 1e-4 relative
 * slack exceeds every float4/float8 rounding effect by > 6×) is also scored exactly; the production ORDER BY/LIMIT is applied to the union.
 * Rows whose bound is below θ cannot enter the top K (K rows with rank ≥ θ already exist). $5 = F (real[]), $6 = M.
 */
function threshSql(andBound = false): string {
  const lexArr = (lang: string) => `ARRAY(SELECT DISTINCT m[1]::tsquery FROM regexp_matches(websearch_to_tsquery('noetia_${lang}'::regconfig, $3)::text, '(''(?:[^'']|'''')*'')', 'g') m)`;
  const eligible = (lang: string) => `(websearch_to_tsquery('noetia_${lang}'::regconfig, $3)::text !~ ''':')`; // no prefix/weight operand (websearch never emits them)
  // C2: pure conjunction of operands (no OR/NOT/phrase) — every PostgreSQL cover is a minimal window containing all m
  // distinct lexemes, and any position lies in at most m minimal windows, so NExtent ≤ m · n_min (and ≤ S).
  const pureAnd = (lang: string) => `(websearch_to_tsquery('noetia_${lang}'::regconfig, $3)::text ~ '^''(?:[^'']|'''')*''( & ''(?:[^'']|'''')*'')+$')`;
  const cand = (lang: string) => `SELECT c.id, c."bookId", c."chunkIndex",
           CASE WHEN NOT ${eligible(lang)} THEN 2147483647
                ${andBound ? `WHEN ${pureAnd(lang)} THEN (SELECT least(sum(n), count(*) * min(n)) FROM (SELECT width_bucket(ts_rank(c.tsv, l, 32), $5::real[]) n FROM unnest(${lexArr(lang)}) l) z)::int` : ''}
                ELSE (SELECT coalesce(sum(width_bucket(ts_rank(c.tsv, l, 32), $5::real[])), 0) FROM unnest(${lexArr(lang)}) l)::int END AS s
      ${branchHead(lang)}`;
  const exactRank = `ts_rank_cd(c.tsv, CASE c.language WHEN 'es' THEN qs.es WHEN 'en' THEN qs.en ELSE qs.si END, 32)`;
  return `
  WITH allowed(b, h) AS (SELECT * FROM unnest($1::uuid[], $2::text[])),
  qs AS (SELECT websearch_to_tsquery('noetia_es'::regconfig, $3) es, websearch_to_tsquery('noetia_en'::regconfig, $3) en, websearch_to_tsquery('noetia_simple'::regconfig, $3) si),
  cand AS MATERIALIZED (
    ${LANGS.map(cand).join('\n    UNION ALL\n    ')}
  ),
  top AS MATERIALIZED (SELECT id FROM cand ORDER BY s DESC, "bookId", "chunkIndex" LIMIT $6),
  topx AS MATERIALIZED (SELECT ${COLS}, ${exactRank} AS rank FROM ai_book_chunks c, qs WHERE c.id IN (SELECT id FROM top)),
  theta AS (SELECT min(rank)::float8 th, count(*) n FROM (SELECT rank FROM topx ORDER BY rank DESC LIMIT $4) z),
  restx AS (SELECT ${COLS}, ${exactRank} AS rank
      FROM cand x JOIN ai_book_chunks c ON c.id = x.id CROSS JOIN qs CROSS JOIN theta t
     WHERE x.id NOT IN (SELECT id FROM top) AND t.n >= $4
       AND (t.th >= 0.998 OR x.s >= ceil((t.th / (1 - t.th)) / 0.1 * 0.9999)))
  SELECT r.* FROM (SELECT * FROM topx UNION ALL SELECT * FROM restx) r
  ORDER BY r.rank DESC, r."bookId", r."chunkIndex"
  LIMIT $4`;
}
type Variant = { sql: string; extra: (F: string) => any[]; cls: string };
function variant(name: string): Variant {
  if (name === 'base') return { sql: RANK_SQL, extra: () => [], cls: 'baseline (production RANK_SQL verbatim)' };
  let m = /^hybrid(\d+)$/.exec(name);
  if (m) return { sql: hybridSql(Number(m[1])), extra: () => [], cls: `PO-048 single-lexeme hybrid, M=${m[1]}` };
  m = /^thresh(\d+)$/.exec(name);
  if (m) { const M = Number(m[1]); return { sql: threshSql(), extra: (F) => [F, M], cls: `PO-049 C1 exact threshold pruning, M=${M}` }; }
  m = /^andb(\d+)$/.exec(name);
  if (m) { const M = Number(m[1]); return { sql: threshSql(true), extra: (F) => [F, M], cls: `PO-049 C2 = C1 + minimal-window conjunction bound, M=${M}` }; }
  throw new Error('unknown variant');
}

// ── DB helpers ───────────────────────────────────────────────────────────────────────────────────────────────────
async function pg() {
  const { Client, types } = require('pg');
  types.setTypeParser(700, (v: string) => v); // float4 → raw text (lossless with extra_float_digits ≥ 1: shortest exact)
  const c = new Client({ host: env.DB_HOST, port: Number(env.DB_PORT), database: env.DB_NAME, user: env.DB_USER, password: env.DB_PASS });
  await c.connect();
  await c.query('SET extra_float_digits = 3');
  return c;
}
async function rankTable(c: any): Promise<string> {
  const [{ f }] = (await c.query(`SELECT array_agg(ts_rank(to_tsvector('noetia_simple'::regconfig, repeat('zorb ', n)), 'zorb'::tsquery, 32) ORDER BY n)::text f FROM generate_series(1, 255) n`)).rows;
  return f;
}
async function run(c: any, v: Variant, F: string, books: string[], hashes: string[], q: string, k: number) {
  await c.query('BEGIN');
  try {
    await c.query('SET LOCAL statement_timeout = 5000');
    const t0 = hr();
    const rows = (await c.query(v.sql, [books, hashes, q, k, ...v.extra(F)])).rows;
    const wall = ms(t0);
    await c.query('COMMIT');
    return { rows, wall };
  } catch (e) { await c.query('ROLLBACK'); throw e; }
}
/** Full-precision row contract: every returned column, rank as PostgreSQL's shortest-exact float4 text. */
const rowKey = (r: any) => [r.id, r.bookId, r.textHash, r.chunkIndex, r.charStart, r.charEnd, r.language, r.rank].join('|');
function compare(base: any[], cand: any[]) {
  const a = base.map(rowKey); const b = cand.map(rowKey);
  const identical = a.length === b.length && a.every((x, i) => x === b[i]);
  let firstDiff: number | null = null;
  if (!identical) { firstDiff = 0; while (firstDiff < Math.max(a.length, b.length) && a[firstDiff] === b[firstDiff]) firstDiff++; firstDiff += 1; }
  const ids = new Set(cand.map((r) => r.id));
  return { identical, firstDiff, recall: base.length ? base.filter((r) => ids.has(r.id)).length / base.length : 1, sameCount: a.length === b.length,
    rankBitsEqualWhereIdsEqual: base.every((r, i) => !cand[i] || cand[i].id !== r.id || cand[i].rank === r.rank) };
}
async function allowedPairs(c: any) {
  const rows = (await c.query(`SELECT DISTINCT "bookId" b, "textHash" h FROM ai_book_chunks ORDER BY 1`)).rows;
  return { books: rows.map((r: any) => r.b), hashes: rows.map((r: any) => r.h) };
}

// ── F-48-1: rank-function audit ──────────────────────────────────────────────────────────────────────────────────
async function cmdRankfn() {
  const c = await pg();
  const [ver] = (await c.query(`SELECT version() v, current_setting('server_version_num') num`)).rows;
  const tab = (await c.query(`
    SELECT cfg::text cfg, n, (SELECT array_length(positions, 1) FROM unnest(v) u WHERE u.lexeme = 'zorbatul') npos,
           encode(float4send(ts_rank(v, q, 32)), 'hex') rb, encode(float4send(ts_rank_cd(v, q, 32)), 'hex') cdb, ts_rank(v, q, 32) r, ts_rank_cd(v, q, 32) cd
      FROM generate_series(1, 300) n, unnest(ARRAY['noetia_es','noetia_en','noetia_simple']::regconfig[]) cfg,
           LATERAL (SELECT to_tsvector(cfg, repeat('zorbatul ', n) || 'filler') v, websearch_to_tsquery(cfg, 'zorbatul') q) x`)).rows;
  const byCfg: any = {};
  for (const cfg of ['noetia_es', 'noetia_en', 'noetia_simple']) {
    const rows = tab.filter((t: any) => t.cfg === cfg);
    const dom = [...new Map(rows.map((t: any) => [t.npos, t])).values()].sort((x: any, y: any) => x.npos - y.npos) as any[];
    const fnOfN = rows.every((t: any) => { const d = dom.find((x) => x.npos === t.npos); return d.rb === t.rb && d.cdb === t.cdb; });
    const strict = (key: string) => dom.every((d, i) => i === 0 || Number(d[key]) > Number(dom[i - 1][key]));
    const minGap = (key: string) => Math.min(...dom.slice(1).map((d, i) => Number(d[key]) - Number(dom[i][key])));
    byCfg[cfg] = { storedCountDomain: [dom[0].npos, dom[dom.length - 1].npos], distinctStoredCounts: dom.length, valuesAreFunctionOfStoredCount: fnOfN,
      tsRankStrictlyIncreasing: strict('r'), tsRankCdStrictlyIncreasing: strict('cd'), minAdjacentGap: { tsRank: minGap('r'), tsRankCd: minGap('cd') },
      sha256OfBitTable: sha(dom.map((d) => `${d.npos}:${d.rb}:${d.cdb}`).join(',')) };
  }
  const bitTablesIdentical = new Set(Object.values(byCfg).map((x: any) => x.sha256OfBitTable)).size === 1;
  // cd closed form n/(n+10) (Wdoc = 0.1·n with norm 32) checked bitwise
  const cdClosedForm = (await c.query(`SELECT bool_and(ts_rank_cd(to_tsvector('noetia_simple', repeat('zorb ', n)), 'zorb'::tsquery, 32) = ((0.1::float4::float8 * n) / (0.1::float4::float8 * n + 1))::float4) ok FROM generate_series(1,255) n`)).rows[0].ok;
  // position independence: 3,000 random position sets incl. the 16383 clamp (deterministic seed)
  await c.query(`SELECT setseed(0.049)`);
  const [pi] = (await c.query(`
    WITH v AS (SELECT g, 1 + (g % 255) n, (SELECT ('zorb:' || string_agg(x::text, ',') || ' other:1')::tsvector FROM (SELECT DISTINCT x FROM (SELECT 1 + floor(random() * 16383)::int x FROM generate_series(1, (1 + (g % 255)) * 3)) a ORDER BY x LIMIT 1 + (g % 255)) b) t FROM generate_series(1, 3000) g)
    SELECT count(*) vectors, count(*) FILTER (WHERE (SELECT array_length(positions, 1) FROM unnest(t) WHERE lexeme = 'zorb') = n) exact_n,
           (SELECT count(*) FROM (SELECT n FROM v GROUP BY n HAVING count(DISTINCT (float4send(ts_rank(t, 'zorb'::tsquery, 32)), float4send(ts_rank_cd(t, 'zorb'::tsquery, 32)))) > 1) z) position_dependent_counts
      FROM v`)).rows;
  // precondition counterexamples (pairs whose two rank orders disagree)
  const cx = (await c.query(`
    SELECT id, numnode(q) nn, ts_rank(a, q, 32) ra, ts_rank_cd(a, q, 32) cda, ts_rank(b, q, 32) rb, ts_rank_cd(b, q, 32) cdb FROM (VALUES
      ('P-W mixed weights: 1×A vs 11×D', 'zorb:1A'::tsvector, ('zorb:' || (SELECT string_agg(i::text || 'D', ',') FROM generate_series(1, 11) i))::tsvector, 'zorb'::tsquery),
      ('P-P stripped vs 1 position', strip('zorb:1'::tsvector), 'zorb:1'::tsvector, 'zorb'::tsquery),
      ('P-O prefix operand: a:1+b:1 vs a:3', 'zorba:1 zorbb:2'::tsvector, 'zorba:1,2,3'::tsvector, 'zorb:*'::tsquery),
      ('P-O weight-restricted operand: 1A+200D vs 2A', ('zorb:1A,' || (SELECT string_agg(i::text, ',') FROM generate_series(2, 201) i))::tsvector, 'zorb:1A,2A'::tsvector, 'zorb:A'::tsquery)
    ) t(id, a, b, q)`)).rows.map((r: any) => ({ ...r, ordersDisagree: Math.sign(Number(r.ra) - Number(r.rb)) !== Math.sign(Number(r.cda) - Number(r.cdb)) }));
  // which operand shapes websearch_to_tsquery can emit (prefix/weight markers never appear)
  const inputs = ['zorb:*', 'zorb:A', 'zorb:*A', '"zorb"*', 'zorb:1', '-zorb', 'zorb or zorb', 'zorb zorb', 'e-mail', "zorb's", 'el', '""'];
  const ws = (await c.query(`SELECT bool_or(websearch_to_tsquery(cfg, i)::text ~ ''':') any_prefix_or_weight_marker FROM unnest($1::text[]) i, unnest(ARRAY['noetia_es','noetia_en','noetia_simple']::regconfig[]) cfg`, [inputs])).rows[0];
  await c.end();
  console.log(JSON.stringify({ cmd: 'rankfn', server: ver, byCfg, bitTablesIdenticalAcrossConfigs: bitTablesIdentical, cdEqualsClosedForm_n_over_n_plus_10: cdClosedForm,
    positionIndependence: pi, preconditionCounterexamples: cx, websearchEmitsPrefixOrWeightMarker: ws.any_prefix_or_weight_marker }));
}

// ── F-48-1: property-based differential on a synthetic fixture ───────────────────────────────────────────────────
const TARGETS = ['kalq', 'bvorq', 'dzunt', 'fyxt', 'grumph'];
const FILLER = ['lorbin', 'tasvek', 'mubrel', 'quonst', 'el', 'the', 'de', 'and', 'yarvix', 'pelnot'];
const PROP_QUERIES: Q[] = [
  ...TARGETS.map((t, i) => ({ id: `S${i}`, cat: 'single lexeme', q: t })),
  { id: 'P0', cat: 'OR 2', q: 'kalq or bvorq' }, { id: 'P1', cat: 'OR 3', q: 'kalq or dzunt or grumph' }, { id: 'P2', cat: 'AND 2', q: 'kalq bvorq' },
  { id: 'P3', cat: 'phrase', q: '"kalq bvorq"' }, { id: 'P4', cat: 'AND NOT', q: 'kalq -bvorq' }, { id: 'P5', cat: 'duplicate OR', q: 'kalq or kalq' },
  { id: 'P6', cat: 'duplicate AND', q: 'kalq kalq' }, { id: 'P7', cat: 'es stop word (lexeme in en/simple)', q: 'el' }, { id: 'P8', cat: 'en stop word + term', q: 'the fyxt' },
  { id: 'P9', cat: 'stop words only (all configs)', q: 'de and' }, { id: 'P10', cat: 'OR with phrase', q: 'kalq or "bvorq dzunt"' }, { id: 'P11', cat: 'prefix syntax (ignored by websearch)', q: 'kalq:*' },
  { id: 'P12', cat: 'weight syntax', q: 'kalq:A' }, { id: 'P13', cat: 'hyphenated', q: 'kalq-bvorq' }, { id: 'P14', cat: 'apostrophe', q: "kalq's" }, { id: 'P15', cat: 'no match', q: 'zzzzqx' },
  { id: 'P16', cat: 'filler term (very frequent)', q: 'lorbin' }, { id: 'P17', cat: 'OR frequent filler', q: 'lorbin or tasvek' },
  { id: 'P18', cat: 'AND 3', q: 'kalq bvorq dzunt' }, { id: 'P19', cat: 'AND frequent filler', q: 'lorbin tasvek' }, { id: 'P20', cat: 'AND target + filler', q: 'kalq lorbin' },
  { id: 'P21', cat: 'AND 4 incl. frequent', q: 'fyxt grumph lorbin mubrel' },
];
async function cmdProp(seed: number, nrows: number, violate: boolean) {
  if (!/_prop_test$/.test(env.DB_NAME ?? '')) throw new Error('prop requires a dedicated *_prop_test database (the chunk table is truncated)');
  const { openDataSource } = require('../integration/knowledge/support/it-env');
  const ds = await openDataSource(); await ds.destroy(); // migrations only
  const c = await pg();
  await c.query('TRUNCATE ai_book_chunks');
  const rnd = xorshift(seed);
  const books: string[] = [];
  for (let b = 0; b < 8; b++) books.push((await c.query(`INSERT INTO books (title, author, category, language, "textFileKey", "isPublished") VALUES ($1, 'Fixture Author', 'classic', 'es', NULL, true) RETURNING id`, [`PO-049 synthetic ${seed}-${b}`])).rows[0].id);
  const hashOf = (b: number, v: number) => `sha256:${sha(`po049-${seed}-${b}-${v}`)}`;
  const count = () => { const u = rnd(); return u < 0.45 ? 0 : u < 0.75 ? 1 + Math.floor(rnd() * 3) : u < 0.93 ? 4 + Math.floor(rnd() * 17) : u < 0.97 ? 100 + Math.floor(rnd() * 200) : 1 + Math.floor(rnd() * 2); };
  const rows: any[] = [];
  const idx = new Map<string, number>();
  for (let i = 0; i < nrows; i++) {
    const b = Math.floor(rnd() * books.length); const v = rnd() < 0.8 ? 0 : 1; // version 1 = a stale text version (never allowed)
    const lang = LANGS[rnd() < 0.6 ? 0 : rnd() < 0.5 ? 1 : 2];
    const toks: string[] = [];
    for (const t of TARGETS) for (let k = count(); k > 0; k--) toks.push(t);
    for (let k = 20 + Math.floor(rnd() * 200); k > 0; k--) toks.push(FILLER[Math.floor(rnd() * FILLER.length)]);
    for (let j = toks.length - 1; j > 0; j--) { const x = Math.floor(rnd() * (j + 1)); [toks[j], toks[x]] = [toks[x], toks[j]]; }
    const key = `${b}|${v}`; const ci = idx.get(key) ?? 0; idx.set(key, ci + 1);
    const mode = !violate ? 'plain' : (() => { const u = rnd(); return u < 0.15 ? 'weightA' : u < 0.3 ? 'mixed' : u < 0.4 ? 'strip' : 'plain'; })();
    rows.push({ b: books[b], h: hashOf(b, v), ci, cs: ci * 1350, ce: ci * 1350 + 1500, lang, text: toks.join(' '), mode });
  }
  for (let i = 0; i < rows.length; i += 500) {
    const part = rows.slice(i, i + 500);
    await c.query(`INSERT INTO ai_book_chunks ("bookId", "textHash", "chunkIndex", "charStart", "charEnd", language, tsv)
      SELECT x.b, x.h, x.ci, x.cs, x.ce, x.lang,
        CASE x.mode WHEN 'plain' THEN to_tsvector(('noetia_' || x.lang)::regconfig, x.t)
                    WHEN 'weightA' THEN setweight(to_tsvector(('noetia_' || x.lang)::regconfig, x.t), 'A')
                    WHEN 'mixed' THEN setweight(to_tsvector(('noetia_' || x.lang)::regconfig, split_part(x.t, ' ', 1)), 'A') || to_tsvector(('noetia_' || x.lang)::regconfig, x.t)
                    ELSE strip(to_tsvector(('noetia_' || x.lang)::regconfig, x.t)) END
      FROM json_to_recordset($1::json) x(b uuid, h text, ci int, cs int, ce int, lang text, t text, mode text)`, [JSON.stringify(part.map((r) => ({ ...r, t: r.text })))]);
  }
  await c.query('ANALYZE ai_book_chunks');
  const F = await rankTable(c);
  const allowedB = books; const allowedH = books.map((_, b) => hashOf(b, 0));
  const out: any = { cmd: 'prop', seed, rows: nrows, violate, cases: 0, byVariant: {} as any, counterexamples: [] as any[] };
  const variants = (env.PROP_VARIANTS ?? 'hybrid1,hybrid2,hybrid5,hybrid8,hybrid13,hybrid20,hybrid21,hybrid40,hybrid200,thresh1,thresh8,thresh20,thresh40,thresh200').split(',');
  const matchInfo: any = {};
  for (const { id, q } of PROP_QUERIES) {
    matchInfo[id] = (await run(c, variant("base"), F, allowedB, allowedH, q, 1_000_000)).rows.length;
    for (const k of [1, 2, 3, 5, 8, 13, 20]) {
      const base = (await run(c, variant('base'), F, allowedB, allowedH, q, k)).rows;
      for (const vn of variants) {
        const M = Number(/\d+$/.exec(vn)![0]);
        const cand = (await run(c, variant(vn), F, allowedB, allowedH, q, k)).rows;
        const cmp = compare(base, cand);
        const s = (out.byVariant[vn] ??= { cases: 0, identical: 0, mismatchesWithMgeK: 0, mismatchesWithMltK: 0, minRecall: 1 });
        s.cases++; out.cases++;
        if (cmp.identical) s.identical++; else { if (M >= k) s.mismatchesWithMgeK++; else s.mismatchesWithMltK++; s.minRecall = Math.min(s.minRecall, cmp.recall);
          if (out.counterexamples.length < 40) out.counterexamples.push({ variant: vn, query: id, k, M, firstDiff: cmp.firstDiff, recall: r2(cmp.recall), sameCount: cmp.sameCount }); }
      }
    }
  }
  out.matchesPerQuery = matchInfo;
  out.fixture = { books: books.length, versionsPerBook: 2, allowedVersion: 0, languages: LANGS, modes: violate ? 'plain + weightA (15%) + mixed A/D (15%) + stripped (10%)' : 'plain (production indexer expression)' };
  await c.end();
  console.log(JSON.stringify(out));
}

/** Deterministic precondition-violation regression cases (see fixtures/po049-hybrid-counterexamples.json). */
async function cmdCounterexamples() {
  if (!/_prop_test$/.test(env.DB_NAME ?? '')) throw new Error('requires a dedicated *_prop_test database');
  const spec = JSON.parse(readFileSync(join(process.cwd(), 'tests/perf/fixtures/po049-hybrid-counterexamples.json'), 'utf8'));
  const c = await pg();
  const F = await rankTable(c);
  const res: any[] = [];
  for (const cs of spec.cases) {
    await c.query('TRUNCATE ai_book_chunks');
    const [{ id: book }] = (await c.query(`INSERT INTO books (title, author, category, language, "textFileKey", "isPublished") VALUES ('PO-049 counterexample', 'Fixture Author', 'classic', 'es', NULL, true) RETURNING id`)).rows;
    const h = `sha256:${sha(cs.id)}`;
    let ci = 0;
    for (const g of cs.rows) for (let k = 0; k < g.copies; k++) {
      await c.query(`INSERT INTO ai_book_chunks ("bookId", "textHash", "chunkIndex", "charStart", "charEnd", language, tsv) VALUES ($1, $2, $3, $4, $5, 'simple', $6::tsvector)`, [book, h, ci, ci * 10, ci * 10 + 10, g.tsv]);
      ci++;
    }
    const base = (await run(c, variant('base'), F, [book], [h], cs.query, cs.k)).rows;
    const out: any = { id: cs.id, precondition: cs.precondition, k: cs.k };
    for (const vn of cs.variants) { const cmp = compare(base, (await run(c, variant(vn), F, [book], [h], cs.query, cs.k)).rows); out[vn] = { identical: cmp.identical, firstDiff: cmp.firstDiff, recall: cmp.recall }; }
    res.push(out);
  }
  await c.query('TRUNCATE ai_book_chunks');
  await c.end();
  console.log(JSON.stringify({ cmd: 'counterexamples', cases: res }));
}

// ── F-48-2: Distribution-B corpus builder (same chunking, indexer, rights path as the governing suite) ─────────────
async function cmdBuildB() {
  if (!/_b_test$/.test(env.DB_NAME ?? '')) throw new Error('build-b requires a dedicated *_b_test database');
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
  if (!['127.0.0.1', 'localhost'].includes(env.MINIO_ENDPOINT ?? '')) throw new Error('local disposable MinIO only');
  const ds = await openDataSource();
  const [{ f }] = await ds.query(`SELECT pg_read_file('/usr/local/share/postgresql/tsearch_data/spanish.stop') f`);
  const stop = f.split('\n').map((s: string) => s.trim()).filter(Boolean);
  const vocab = bVocabulary(stop);
  const s3 = new S3Client({ endpoint: `http://${env.MINIO_ENDPOINT}:${env.MINIO_PORT}`, region: 'us-east-1', forcePathStyle: true, credentials: { accessKeyId: env.MINIO_ACCESS_KEY, secretAccessKey: env.MINIO_SECRET_KEY } });
  await s3.send(new CreateBucketCommand({ Bucket: 'books' })).catch(() => undefined);
  const db = new KnowledgeDbService(ds, IT_CONFIG);
  const hashes = new Map<string, string>();
  const store = new StorageBookText(new StorageService());
  const indexer = new BookIndexer(db, new IndexingPermission(db, { currentTextHash: async (b: string) => hashes.get(b) ?? null }, { attest: async () => 'attested' }), store, new RetrievalMetricsService(), DEFAULT_RETRIEVAL_CONFIG);
  let chunks = 0; const stopTokenShare: number[] = [];
  const stopSet = new Set(stop);
  for (let i = 0; i < 10; i++) {
    const text = bBookText(i, vocab, 2_000_000);
    const toks = text.toLowerCase().split(/[^\p{L}]+/u).filter(Boolean);
    stopTokenShare.push(toks.filter((t) => stopSet.has(t)).length / toks.length);
    const bytes = Buffer.from(text, 'utf8'); const key = `texts/po049-b-${i}.txt`;
    await s3.send(new PutObjectCommand({ Bucket: 'books', Key: key, Body: bytes }));
    const id = await insertBook(ds, { language: 'es', textFileKey: key });
    const hash = computeTextHash(bytes); hashes.set(id, hash);
    await insertRights(ds, id, { textHash: hash, permittedOperations: BOTH_OPS, verifier: 'fixture-verifier' });
    const r = await indexer.indexBook(id);
    if (r.outcome !== 'indexed') throw new Error(`indexing failed: ${r.outcome}`);
    chunks += r.chunks;
  }
  await ds.query('ANALYZE ai_book_chunks');
  const [sz] = await ds.query(`SELECT pg_relation_size('ai_book_chunks') heap, (SELECT pg_total_relation_size(reltoastrelid) FROM pg_class WHERE relname='ai_book_chunks') toast, pg_indexes_size('ai_book_chunks') idx, avg(pg_column_size(tsv))::int tsvavg, avg(length(tsv))::int lexemesavg FROM ai_book_chunks`);
  await ds.destroy();
  console.log(JSON.stringify({ cmd: 'build-b', books: 10, codePointsPerBook: 2_000_000, chunks, stopWords: stop.length, zipfS: 1.0, ranks: B_RANKS, stopTokenShare: stats(stopTokenShare.map((x) => x * 100)), size: sz }));
}

// ── measurements ─────────────────────────────────────────────────────────────────────────────────────────────────
async function cmdInfo(set: string) {
  const c = await pg();
  const [{ n: total }] = (await c.query(`SELECT count(*)::int n FROM ai_book_chunks`)).rows;
  const out: any[] = [];
  for (const { id, cat, q } of SETS[set]) {
    const [r] = (await c.query(`SELECT count(*)::int n, count(DISTINCT "bookId")::int nb, numnode(websearch_to_tsquery('noetia_es'::regconfig, $1)) nn FROM ai_book_chunks WHERE language = 'es' AND tsv @@ websearch_to_tsquery('noetia_es'::regconfig, $1)`, [q])).rows;
    out.push({ id, cat, matches: r.n, pctChunks: r2((100 * r.n) / total), matchingBooks: r.nb, numnode: r.nn });
  }
  const [sz] = (await c.query(`SELECT avg(pg_column_size(tsv))::int tsvavg, avg(length(tsv))::int lexemesavg, pg_relation_size('ai_book_chunks') heap, (SELECT pg_total_relation_size(reltoastrelid) FROM pg_class WHERE relname='ai_book_chunks') toast FROM ai_book_chunks`)).rows;
  await c.end();
  console.log(JSON.stringify({ cmd: 'info', set, db: env.DB_NAME, chunks: total, size: sz, queries: out }));
}

async function cmdSql(set: string, vn: string, reps: number) {
  const c = await pg();
  const F = await rankTable(c);
  const { books, hashes } = await allowedPairs(c);
  const v = variant(vn); const base = variant('base');
  const out: any[] = []; const all: number[] = [];
  for (const { id, q } of SETS[set]) {
    const ref = (await run(c, base, F, books, hashes, q, 8)).rows;
    for (let w = 0; w < 2; w++) await run(c, v, F, books, hashes, q, 8);
    const wall: number[] = []; let identical = true; let worst: any = null;
    for (let i = 0; i < reps; i++) { const r = await run(c, v, F, books, hashes, q, 8); wall.push(r.wall); all.push(r.wall); const cmp = compare(ref, r.rows); if (!cmp.identical) { identical = false; worst = cmp; } }
    const exec: number[] = []; let buffers: any = null;
    for (let i = 0; i < 3; i++) {
      await c.query('BEGIN');
      const [{ 'QUERY PLAN': p }] = (await c.query(`EXPLAIN (ANALYZE, BUFFERS, TIMING OFF, FORMAT JSON) ${v.sql}`, [books, hashes, q, 8, ...v.extra(F)])).rows;
      await c.query('COMMIT');
      exec.push(p[0]['Execution Time']); buffers = { hit: p[0].Plan['Shared Hit Blocks'], read: p[0].Plan['Shared Read Blocks'], tempWritten: p[0].Plan['Temp Written Blocks'] };
    }
    // topK boundary checks at full precision for every accepted topK edge
    const kChecks: any = {};
    for (const k of [1, 8, 20]) { const a = (await run(c, base, F, books, hashes, q, k)).rows; const b = (await run(c, v, F, books, hashes, q, k)).rows; kChecks[k] = compare(a, b).identical; }
    out.push({ id, rows: ref.length, wallMs: stats(wall), serverExecMs: stats(exec), buffers, identicalFullPrecision: identical, topKIdentical: kChecks, mismatch: worst });
  }
  await c.end();
  console.log(JSON.stringify({ cmd: 'sql', set, variant: vn, cls: v.cls, db: env.DB_NAME, reps, allWallMs: stats(all), queries: out }));
}

async function cmdE2e(set: string, vn: string, rounds: number) {
  const { KnowledgeDbService } = require('../../src/knowledge/common/knowledge-db.service');
  const { LexicalRetrievalService } = require('../../src/knowledge/retrieval/lexical-retrieval.service');
  const { RetrievalMetricsService } = require('../../src/knowledge/retrieval/retrieval-metrics.service');
  const { DEFAULT_RETRIEVAL_CONFIG } = require('../../src/knowledge/retrieval/retrieval.types');
  const { StorageBookText } = require('../../src/knowledge/retrieval/storage-book-text');
  const { processS2Verifier } = require('../../src/knowledge/retrieval/s2-verification.service');
  const { StorageService } = require('../../src/storage/storage.service');
  const { openDataSource, IT_CONFIG } = require('../integration/knowledge/support/it-env');
  const QS = SETS[set];
  const c = await pg(); const F = await rankTable(c); const { books, hashes } = await allowedPairs(c); await c.end();
  const ds = await openDataSource();
  const db = new KnowledgeDbService(ds, IT_CONFIG);
  const store = new StorageBookText(new StorageService());
  const pool = processS2Verifier();
  const v = variant(vn);
  let subst = false; let cur: any = null;
  const origTx = db.transaction.bind(db);
  db.transaction = async (fn: any) => {
    const t0 = hr();
    try {
      return await origTx(async (m: any) => {
        const q0 = m.query.bind(m); const proxy = Object.create(m);
        proxy.query = async (sql: string, params?: any[]) => {
          const t = hr(); const isRank = /ts_rank_cd/.test(sql);
          try { return await (isRank && subst ? q0(v.sql, [...(params ?? []), ...v.extra(F)]) : q0(sql, params)); } // DIAGNOSTIC substitution (test-only)
          finally { if (cur && isRank) cur.rankSql = ms(t); }
        };
        return fn(proxy);
      });
    } finally { if (cur) { cur.txWall = ms(t0); cur.tTxEnd = hr(); } }
  };
  const origVerify = pool.verify.bind(pool);
  pool.verify = async (b: any, h: string, r: any) => { try { return await origVerify(b, h, r); } finally { if (cur) cur.tS2End = hr(); } };
  const retrieval = new LexicalRetrievalService(db, store, new RetrievalMetricsService(), DEFAULT_RETRIEVAL_CONFIG, pool);
  const allowed = books.map((b: string, i: number) => ({ bookId: b, textHash: hashes[i] }));
  // contract equivalence: full retrieve() result (passages incl. text/offsets/ranks, exclusions, truncation) at topK 1, 8, 20
  const contract: any = {};
  for (const { id, q } of QS) {
    contract[id] = {};
    for (const k of [1, 8, 20]) {
      subst = false; const a = sha(JSON.stringify(await retrieval.retrieve({ allowed, query: q, topK: k, budgetTokens: BUDGET })));
      subst = vn !== 'base'; const b = sha(JSON.stringify(await retrieval.retrieve({ allowed, query: q, topK: k, budgetTokens: BUDGET })));
      contract[id][k] = a === b;
    }
  }
  subst = vn !== 'base';
  for (const { q } of QS) await retrieval.retrieve({ allowed, query: q, topK: 8, budgetTokens: BUDGET }); // warm-up
  const samples: any[] = [];
  for (let r = 0; r < rounds; r++) for (const { id, q } of QS) {
    cur = { q: id }; const t0 = hr();
    await retrieval.retrieve({ allowed, query: q, topK: 8, budgetTokens: BUDGET });
    const total = ms(t0);
    samples.push({ q: id, total, rankSql: cur.rankSql ?? 0, txWall: cur.txWall ?? 0, s2Phase: cur.tS2End && cur.tTxEnd ? Number(cur.tS2End - cur.tTxEnd) / 1e6 : 0 });
    cur = null;
  }
  await pool.shutdown(); await ds.destroy();
  const f = ['total', 'rankSql', 'txWall', 's2Phase'];
  const agg = (xs: any[]) => Object.fromEntries(f.map((k) => [k, stats(xs.map((s) => s[k]))]));
  const allContract = Object.values(contract).every((x: any) => Object.values(x).every(Boolean));
  console.log(JSON.stringify({ cmd: 'e2e', set, variant: vn, cls: v.cls, db: env.DB_NAME, rounds, n: samples.length, contractIdenticalAll: allContract, contract,
    overall: agg(samples), byQuery: Object.fromEntries(QS.map(({ id }) => [id, agg(samples.filter((s) => s.q === id))])) }));
}

async function cmdExplain(set: string, vn: string, qid: string) {
  const c = await pg(); const F = await rankTable(c); const { books, hashes } = await allowedPairs(c); const v = variant(vn);
  const q = SETS[set].find((x) => x.id === qid)!.q;
  for (let w = 0; w < 2; w++) await run(c, v, F, books, hashes, q, 8);
  await c.query('BEGIN');
  const [{ 'QUERY PLAN': p }] = (await c.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${v.sql}`, [books, hashes, q, 8, ...v.extra(F)])).rows;
  await c.query('COMMIT'); await c.end();
  const nodes: any[] = [];
  const walk = (n: any, d: number) => { nodes.push({ d, type: n['Node Type'], cte: n['CTE Name'] ?? n['Subplan Name'], rel: n['Relation Name'], idx: n['Index Name'], rows: n['Actual Rows'], loops: n['Actual Loops'], ms: n['Actual Total Time'], hit: n['Shared Hit Blocks'], read: n['Shared Read Blocks'], temp: n['Temp Written Blocks'] }); for (const ch of n.Plans ?? []) walk(ch, d + 1); };
  walk(p[0].Plan, 0);
  console.log(JSON.stringify({ cmd: 'explain', set, variant: vn, q: qid, db: env.DB_NAME, executionMs: p[0]['Execution Time'], planningMs: p[0]['Planning Time'], nodes }));
}

const [cmd, a1, a2, a3] = process.argv.slice(2);
(async () => {
  if (cmd === 'rankfn') await cmdRankfn();
  else if (cmd === 'prop') await cmdProp(Number(a1 ?? 49), Number(a2 ?? 3000), a3 === 'violate');
  else if (cmd === 'counterexamples') await cmdCounterexamples();
  else if (cmd === 'build-b') await cmdBuildB();
  else if (cmd === 'info') await cmdInfo(a1 ?? 'A');
  else if (cmd === 'sql') await cmdSql(a1 ?? 'A', a2 ?? 'base', Number(a3 ?? 10));
  else if (cmd === 'explain') await cmdExplain(a1 ?? 'A', a2 ?? 'base', a3 ?? 'Q0');
  else if (cmd === 'e2e') await cmdE2e(a1 ?? 'A', a2 ?? 'base', Number(a3 ?? 10));
  else throw new Error('usage: rankfn | prop <seed> <rows> [violate] | counterexamples | build-b | info <set> | sql <set> <variant> <reps> | e2e <set> <variant> <rounds>');
  process.exit(0);
})().catch((e) => { console.error(String(e?.stack ?? e)); process.exit(1); });
