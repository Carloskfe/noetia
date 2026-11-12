/**
 * NEM-024 PO-051 — E-1 PLAN-STABILITY diagnostics (test tooling only; never imported by src; opt-in).
 *
 * Disposable local PostgreSQL only (refuses anything else). Run from services/api against the governing NEM-023
 * fixture (built by the UNCHANGED suite with NEM023_PERF=1 NEM023_PERF_KEEP=1):
 *   NEM019_DISPOSABLE_DB=1 DB_HOST=127.0.0.1 DB_PORT=… DB_NAME=<x>_test DB_USER=… DB_PASS=… \
 *     npx ts-node -T -P tsconfig.json tests/perf/e1-plan-diag.ts <cmd> [args]
 *
 * Commands (one JSON line each; synthetic query terms are never printed, only ids):
 *   migrate [noautovac]   run the production migrations on an empty disposable DB; `noautovac` then disables autovacuum
 *                         for ai_book_chunks (and its TOAST table) so the suite's post-ANALYZE, pre-VACUUM state can be
 *                         observed deterministically (DIAGNOSTIC condition; disposable DB only).
 *   state <label>         server version, planner/maintenance settings, relation and index sizes, pg_class stats,
 *                         vacuum/analyze timestamps, tsvector column statistics (MCELEM coverage of each query term).
 *   plans <label> <reps>  for Q0 Q3 Q4 Q5 Q6 Q8 (production RANK_SQL, verbatim from src, all ten books allowed) and the
 *                         protected suite's ginUsed PROBE: EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) under the default
 *                         planner and under `SET LOCAL enable_seqscan = off` (DIAGNOSIS ONLY), plus EXPLAIN (ANALYZE,
 *                         TIMING OFF) and plain execution wall time (no EXPLAIN) to separate instrumentation overhead;
 *                         estimated vs actual rows, costs, buffers and per-statement TOAST block deltas.
 */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-var-requires */
import { readFileSync } from 'fs';
import { join } from 'path';

const env = process.env;
if (env.NEM019_DISPOSABLE_DB !== '1' || !['127.0.0.1', 'localhost'].includes(env.DB_HOST ?? '') || !/_test$/.test(env.DB_NAME ?? '')) {
  throw new Error('disposable local *_test database only');
}
const SRC = readFileSync(join(process.cwd(), 'src/knowledge/retrieval/lexical-retrieval.service.ts'), 'utf8');
const RANK_SQL = (() => { const m = /const RANK_SQL = `([\s\S]*?)`;/.exec(SRC); if (!m) throw new Error('RANK_SQL not found'); return m[1]; })();
/** The protected NEM-023 suite's ginUsed probe, verbatim. */
const PROBE_SQL = `EXPLAIN SELECT id FROM ai_book_chunks c WHERE c.language = 'es' AND c.tsv @@ websearch_to_tsquery('noetia_es'::regconfig, $1)`;
const PROBE_BODY = PROBE_SQL.replace(/^EXPLAIN /, '');

function govVocabulary(n: number): string[] { // identical to the NEM-023 suite
  const syl = ['ra', 'mo', 'ti', 'sa', 'le', 'no', 'ca', 've', 'du', 'pi', 'ña', 'ló', 'gue', 'trí', 'bas', 'cen', 'fo', 'ju', 'xe', 'zú'];
  const out: string[] = [];
  for (let i = 0; out.length < n; i++) { let w = ''; let x = i + 7; do { w += syl[x % syl.length]; x = Math.floor(x / syl.length); } while (x > 0); out.push(w); }
  return out;
}
const V = govVocabulary(6000);
const QUERIES: { id: string; cat: string; q: string }[] = [ // identical to the NEM-023 mix for these ids
  { id: 'Q0', cat: 'high-frequency', q: V[3] }, { id: 'Q3', cat: 'low', q: V[2500] }, { id: 'Q4', cat: 'multi-term AND', q: `${V[10]} ${V[11]}` },
  { id: 'Q5', cat: 'boolean OR', q: `${V[100]} or ${V[900]}` }, { id: 'Q6', cat: 'phrase', q: `"${V[5]} ${V[6]}"` }, { id: 'Q8', cat: 'no-match', q: 'inexistente' },
];
const r2 = (x: number) => Math.round(x * 100) / 100;
const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor((s.length - 1) / 2)]; };

async function pg() {
  const { Client } = require('pg');
  const c = new Client({ host: env.DB_HOST, port: Number(env.DB_PORT), database: env.DB_NAME, user: env.DB_USER, password: env.DB_PASS });
  await c.connect();
  return c;
}

async function cmdMigrate(noautovac: boolean) {
  const { openDataSource } = require('../integration/knowledge/support/it-env');
  const ds = await openDataSource();
  if (noautovac) await ds.query(`ALTER TABLE ai_book_chunks SET (autovacuum_enabled = false, toast.autovacuum_enabled = false)`);
  const [{ n }] = await ds.query(`SELECT count(*)::int n FROM ai_book_chunks`);
  await ds.destroy();
  console.log(JSON.stringify({ cmd: 'migrate', db: env.DB_NAME, rows: n, autovacuumDisabledOnTable: noautovac }));
}

async function cmdState(label: string) {
  const c = await pg();
  const settings = (await c.query(`SELECT name, setting, unit, source FROM pg_settings WHERE name IN ('server_version','shared_buffers','effective_cache_size','work_mem',
    'random_page_cost','seq_page_cost','cpu_tuple_cost','cpu_index_tuple_cost','cpu_operator_cost','effective_io_concurrency','default_statistics_target',
    'autovacuum','autovacuum_naptime','autovacuum_vacuum_insert_threshold','autovacuum_vacuum_insert_scale_factor','autovacuum_analyze_threshold',
    'autovacuum_analyze_scale_factor','gin_pending_list_limit','gin_fuzzy_search_limit','jit','plan_cache_mode','enable_seqscan','enable_bitmapscan') ORDER BY name`)).rows;
  const rels = (await c.query(`SELECT c.relname, c.relkind, c.relpages, c.reltuples::bigint reltuples, pg_relation_size(c.oid) bytes, c.reloptions
    FROM pg_class c WHERE c.relname IN ('ai_book_chunks','IDX_ai_book_chunks_tsv_es','IDX_ai_book_chunks_tsv_en','IDX_ai_book_chunks_tsv_simple','UQ_ai_book_chunks_set_index','ai_book_chunks_pkey')
    OR c.oid = (SELECT reltoastrelid FROM pg_class WHERE relname = 'ai_book_chunks') ORDER BY 1`)).rows
    .map((r: any) => ({ ...r, relname: /^pg_toast_/.test(r.relname) ? 'pg_toast(ai_book_chunks)' : r.relname }));
  const [vis] = (await c.query(`SELECT relallvisible FROM pg_class WHERE relname = 'ai_book_chunks'`)).rows;
  const [st] = (await c.query(`SELECT n_live_tup, n_dead_tup, n_mod_since_analyze, n_ins_since_vacuum, last_vacuum, last_autovacuum, last_analyze, last_autoanalyze,
    vacuum_count, autovacuum_count, analyze_count, autoanalyze_count FROM pg_stat_user_tables WHERE relname = 'ai_book_chunks'`)).rows;
  const [cs] = (await c.query(`SELECT null_frac, avg_width, array_length(most_common_elems::text::text[], 1) mcelem_n,
    (SELECT min(x) FROM unnest(most_common_elem_freqs) x) mcelem_min_freq FROM pg_stats WHERE tablename = 'ai_book_chunks' AND attname = 'tsv'`)).rows;
  const terms: any[] = [];
  for (const { id, q } of [...QUERIES, { id: 'PROBE', q: V[2500] }]) {
    const lex = (await c.query(`SELECT unnest(tsvector_to_array(to_tsvector('noetia_es'::regconfig, $1))) l`, [q.replace(/"|\bor\b/g, ' ')])).rows.map((r: any) => r.l);
    const inMc: any[] = [];
    for (const l of lex) {
      const [m] = (await c.query(`SELECT i, most_common_elem_freqs[i] f FROM pg_stats s, generate_subscripts(s.most_common_elems::text::text[], 1) i
        WHERE s.tablename = 'ai_book_chunks' AND s.attname = 'tsv' AND (s.most_common_elems::text::text[])[i] = $1`, [l])).rows;
      inMc.push(m ? { inMcelem: true, freq: r2(Number(m.f) * 1e4) / 1e4 } : { inMcelem: false });
    }
    const [{ n }] = (await c.query(`SELECT count(*)::int n FROM ai_book_chunks WHERE language = 'es' AND tsv @@ websearch_to_tsquery('noetia_es'::regconfig, $1)`, [q])).rows;
    terms.push({ id, terms: inMc, actualMatches: n });
  }
  await c.end();
  console.log(JSON.stringify({ cmd: 'state', label, db: env.DB_NAME, settings, relations: rels, relallvisible: vis.relallvisible, tableStats: st, tsvStats: cs, queryTerms: terms }));
}

function summarize(planJson: any) {
  const p = planJson[0];
  const scans: any[] = [];
  const walk = (n: any) => {
    if (n['Relation Name'] === 'ai_book_chunks' || /Index Scan|Bitmap Index/.test(n['Node Type'])) {
      scans.push({ node: n['Node Type'], index: n['Index Name'] ?? null, estRows: n['Plan Rows'], actualRows: n['Actual Rows'], loops: n['Actual Loops'],
        startupCost: n['Startup Cost'], totalCost: n['Total Cost'], hit: n['Shared Hit Blocks'], read: n['Shared Read Blocks'], heapBlocksExact: n['Exact Heap Blocks'] ?? null,
        rowsRemovedByFilter: n['Rows Removed by Filter'] ?? null, recheckRemoved: n['Rows Removed by Index Recheck'] ?? null });
    }
    (n.Plans ?? []).forEach(walk);
  };
  walk(p.Plan);
  return { topNode: p.Plan['Node Type'], totalCost: p.Plan['Total Cost'], execMs: p['Execution Time'], planningMs: p['Planning Time'], hit: p.Plan['Shared Hit Blocks'], read: p.Plan['Shared Read Blocks'], scans };
}

async function toastBlocks(c: any): Promise<number | null> {
  try {
    const [r] = (await c.query(`SELECT coalesce(toast_blks_hit,0) + coalesce(toast_blks_read,0) t FROM pg_statio_user_tables WHERE relname = 'ai_book_chunks'`)).rows;
    return Number(r.t);
  } catch { return null; }
}

async function cmdPlans(label: string, reps: number) {
  const c = await pg();
  await c.query(`SET stats_fetch_consistency = none`);
  const rows = (await c.query(`SELECT DISTINCT "bookId" b, "textHash" h FROM ai_book_chunks ORDER BY 1`)).rows;
  const books = rows.map((r: any) => r.b); const hashes = rows.map((r: any) => r.h);
  const items = [...QUERIES.map((x) => ({ ...x, sql: RANK_SQL, params: (q: string) => [books, hashes, q, 8] })), { id: 'PROBE', cat: 'suite ginUsed probe', q: V[2500], sql: PROBE_BODY, params: (q: string) => [q] }];
  const out: any[] = [];
  for (const it of items) {
    const res: any = { id: it.id, cat: it.cat };
    for (const mode of ['default', 'forcedIndex'] as const) {
      const set = mode === 'forcedIndex' ? 'SET LOCAL enable_seqscan = off' : 'SELECT 1';
      const tx = async (sql: string) => { await c.query('BEGIN'); try { await c.query(set); const r = await c.query(sql, it.params(it.q)); await c.query('COMMIT'); return r; } catch (e) { await c.query('ROLLBACK'); throw e; } };
      await tx(it.sql); // warm
      const an: any[] = []; const off: number[] = []; const wall: number[] = []; const toast: number[] = [];
      for (let i = 0; i < reps; i++) an.push(summarize((await tx(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${it.sql}`)).rows[0]['QUERY PLAN']));
      for (let i = 0; i < reps; i++) off.push((await tx(`EXPLAIN (ANALYZE, TIMING OFF, FORMAT JSON) ${it.sql}`)).rows[0]['QUERY PLAN'][0]['Execution Time']);
      for (let i = 0; i < reps; i++) {
        await c.query('SELECT pg_stat_force_next_flush()'); const t0b = await toastBlocks(c);
        const t0 = process.hrtime.bigint(); await tx(it.sql); wall.push(Number(process.hrtime.bigint() - t0) / 1e6);
        await c.query('SELECT pg_stat_force_next_flush()'); const t1b = await toastBlocks(c);
        if (t0b !== null && t1b !== null) toast.push(t1b - t0b);
      }
      const last = an[an.length - 1];
      res[mode] = { ...last, execMs: r2(med(an.map((a) => a.execMs))), execMsAll: an.map((a) => r2(a.execMs)), timingOffMs: r2(med(off)), plainWallMs: r2(med(wall)), plainWallAll: wall.map(r2),
        toastBlocksPerExec: toast.length ? med(toast) : null };
    }
    out.push(res);
  }
  await c.end();
  console.log(JSON.stringify({ cmd: 'plans', label, db: env.DB_NAME, reps, queries: out }));
}

(async () => {
  const [cmd, a1, a2] = process.argv.slice(2);
  if (cmd === 'migrate') await cmdMigrate(a1 === 'noautovac');
  else if (cmd === 'state') await cmdState(a1 ?? 'state');
  else if (cmd === 'plans') await cmdPlans(a1 ?? 'plans', Number(a2 ?? 5));
  else throw new Error('usage: migrate [noautovac] | state <label> | plans <label> <reps>');
})().catch((e) => { console.error(e?.message ?? e); process.exit(1); });
