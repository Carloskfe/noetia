# NEM-024 — PO-048 E-1 Retrieval Performance: PostgreSQL Ranking Root-Cause Investigation (diagnostic only)

**Date:** 2026-11-11 · **Authority:** [PO-048](../operating-framework/decisions/product-owner/PO-048-nem-024-e1-ranking-root-cause-investigation-authorization.md) (diagnostic only; PO-047 accepted conditionally for development progression) · **Branch / PR:** `feat/nem-024-checkpoint-b`, Draft PR #56 · **Review:** independent Product Architecture (**not yet performed**) · **PO follow-on decision:** **awaiting**

**Status: E-1 remains OPEN. Checkpoint E remains NOT QUALIFIED.** No production code, SQL, index, migration or configuration was changed.

## 1. Executive summary

**E-1 reproduced (governing benchmark):** end-to-end retrieval p50 / p95, n = 100 each:

| Session | Order | p50 (ms) | p95 (ms) |
|---|---|---|---|
| Governing suite (session 0) | – | 95 | 387 |
| Instrumented session | fwd | 90 | 371 |
| Instrumented session | rev | 87 | 369 |
| Instrumented session | shuffle | 90 | 369 |

Run order made no material difference. Earlier sessions measured p95 values of 603 / 620 / 763 ms, so variance between days is large.

**Primary bottleneck (high confidence): the ranking SQL's per-row evaluation of `ts_rank_cd`.**

- **What sets p95:** the benchmark's p95 falls inside the slowest query's samples. That query is Q0, a term present in 9,855 of 17,780 chunks (55%).
- **Q0 end to end ≈ 369 ms:**

  | Stage | Time | Share |
  |---|---|---|
  | Ranking SQL | ≈ 320 ms | 86% |
  | S2 read + verify | ≈ 40 ms | 11% |
  | Everything else | ≈ 6 ms | 2% |

- **Inside the ranking SQL (≈ 300 ms server time):**
  - the GIN index and heap scans take < 5 ms;
  - sorting is a trivial top-N heapsort;
  - JIT never fires, and no memory spills;
  - **≈ 295 ms is spent computing `rank` for every matching row: ≈ 110–125 ms fetching each row's out-of-line (TOAST) `tsvector`, and ≈ 170–180 ms in `ts_rank_cd` itself.**

**Exact-result-preserving candidates** (identical rows and order; correctness argued):

| Candidate | Effect | Meets E-1? |
|---|---|---|
| Session settings (`jit=off`, `work_mem`) | None | No |
| Per-branch top-K pushdown | None | No |
| `tsv` compression (lz4, EXTERNAL) | None (values were stored uncompressed already) | No |
| **Inline `tsv` storage (`STORAGE MAIN`), clone** | Q0 SQL 300 → 202 ms; end-to-end p95 370 → **271 ms** | No |
| **Exact hybrid ranking** (cheap pre-selection only for single-lexeme queries, where provably exact) **+ inline storage** | Q0 SQL → 29 ms; end-to-end p95 → **264 ms**, now bounded by the OR query Q5 | **No** |

**No exact-result-preserving candidate reaches E-1 on the governing benchmark.**

**The only measured way to reach E-1 changes multi-term ranking results.** Two-stage ranking for *all* queries plus inline storage gives end-to-end p95 **112 ms** (two sessions). It returned identical results on the 10 benchmark queries, but on an adversarial multi-term set it missed the true top result (recall@8 = 0.13) for OR queries. **It needs a Product Owner relevance decision; it is not contract-compatible.**

**Candidate caps** (score at most N candidates): fast but lossy (recall@8 down to 0.13 on the benchmark). **Rejected.**

**Production suitability (E1-Q5):**

- With exact global `ts_rank_cd` semantics, a single-instance PostgreSQL on 1 vCPU cannot plausibly meet E-1 for this benchmark's multi-term high-frequency queries. The per-row ranking CPU is the floor, and one query cannot use more than one core.
- Single-term searches can be made fast exactly.
- **Representativeness caveat:** the synthetic benchmark's top terms occur in 24–55% of all chunks, which is stop-word-like. Whether that represents real filtered Spanish text is a PO and benchmark question; the benchmark was not redefined here.

**Recommendation (UNAPPROVED):**

1. Authorize the **exact package**: inline `tsv` storage plus the single-lexeme exact hybrid. It is a no-regret improvement that cuts the dominant single-term case from ≈ 369 to **92 ms** end to end (measured, clone) and E-1 p95 by ≈ 29%.
2. **Separately**, have the PO decide how multi-term ranking may trade exactness for latency, or how E-1 applies to such queries.

Details are in §16.

## 2. Authorization and scope verification

- PO-048 recorded in `f95a153`: decision record, `PRODUCT-DECISIONS.md`, mission status, register.
- PO-047 recorded as **conditionally accepted for development progression**, with its thin `p3x3` margin and large-book memory risk retained. PO-046 accepted as diagnostics; PO-045 provisional.
- Only disposable local services and synthetic data were used. Production and staging were not touched; no customer text.
- **Committed changes:**
  - governance;
  - `services/api/tests/perf/e1-ranking-diag.ts` and its README section;
  - this report and its raw measurements.

  **`services/api/src` is unchanged** (`git diff d007049 -- services/api/src` is empty).
- **Database changes:** temporary storage changes ran only in disposable database **clones** (`CREATE DATABASE … TEMPLATE`), and were dropped with the container.

## 3. Baseline and preflight

- **Starting commit:** `d00704962ea72e0c0309c1b8a0d700ce28195606`. The remote head was equal; PR #56 open, Draft, unmerged; tree clean; PO-048 unused.
- **Ending commit:** the report commit (see PR #56).

## 4. Current SQL and data path

`LexicalRetrievalService.retrieve` runs one transaction (`SET LOCAL statement_timeout = 2000` → `STATUS_SQL` → `RANK_SQL` → key lookup), then S2 per distinct result book, then assembly.

**`RANK_SQL`:**

- **Eligibility:** an `allowed(b, h)` CTE from bound arrays.
- **Language branches:** three branches (`es`, `en`, `simple`), each with a constant `websearch_to_tsquery` configuration and the predicate of its partial GIN index, joined to `allowed` on book id **and** text hash. Each computes `ts_rank_cd(c.tsv, q.q, 32)`; the branches are combined with `UNION ALL`.
- **Order:** `ORDER BY rank DESC, "bookId", "chunkIndex" LIMIT topK` (8).

Schema facts relevant here:

- `ai_book_chunks.tsv` is a `tsvector` with default storage (`x`, extended). Average stored size is 2,417 bytes, above the ~2 KB TOAST threshold.
- So **97% of `tsv` bytes live in the TOAST table** (TOAST 43 MB vs heap 7.3 MB).
- The indexer builds `tsv` with `to_tsvector(config, text)` and **no `setweight`**, so every lexeme has the same weight.

## 5. Fixture and methodology

| Item | Value |
|---|---|
| Fixture | Built once by the governing NEM-023 suite (`NEM023_PERF=1 NEM023_PERF_KEEP=1`): 10 books × 2,000,000 code points, 17,780 chunks, production chunking (1,500 characters, 10% overlap), real indexer, all `es` |
| Database | Disposable `postgres:16-alpine` 16.13 with **default settings**, the same image and defaults as production |
| Storage | Disposable MinIO, read through the PO-047 path |
| Query mix | The suite's 10 queries Q0..Q9, reconstructed deterministically and verified by identical match counts. Measured as 10 rounds of 10 after warm-up (n = 100) |
| Sessions | 3 instrumented end-to-end sessions with different orders (fwd, rev, shuffle) |
| Server time | `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)`, with timing on for per-node analysis. Execution-time comparisons used `TIMING OFF` |
| Client time | Node-observed wall time; reported separately from server time |

Measurements are warm-cache unless labelled. The database was uncapped, as in earlier sessions; a 1-vCPU-capped check is in §13.

**Diagnostic variants** are test-only SQL text substitutions, each classified: exact setting, exact structural, lossy, or semantic change. Each run compares rows, rank and order with the production `RANK_SQL` on identical inputs (identical yes/no, recall@8, first missing rank). Cross-database equivalence for storage clones used content-free result fingerprints.

## 6. Reproduced E-1 baseline

| Session | n | p50 | p95 | p99 | max |
|---|---|---|---|---|---|
| Governing suite (session 0) | 100 | 95.0 | **386.9** | – | 587.1 |
| Instrumented fwd | 100 | 90.2 | **370.5** | 379.7 | 409.4 |
| Instrumented rev | 100 | 87.3 | **368.6** | 391.5 | 394.1 |
| Instrumented shuffle | 100 | 89.8 | **369.1** | 386.3 | 389.8 |

All values in ms.

- **Within this session:** variance is small (p95 369–387 ms), and run order has no material effect.
- **Across sessions:** large (p95 387–763 ms over PO-045 to PO-048). This is consistent with host load on the shared VM.

**Per-query p50 by match count** (session 0):

| Matches | p50 |
|---|---|
| 0 | 5 ms |
| 42–1,145 | 50–94 ms |
| 2,322 | 185 ms |
| 3,399 | 164 ms |
| 4,224 | 287 ms |
| 9,855 | 376 ms |

## 7. End-to-end time decomposition (E1-Q1)

Instrumented sessions, ms. "fwd / rev / shuffle" are the three runs.

| Stage | Overall p50 | Overall p95 | Q0 p50 | Q5 p50 | Q3 p50 |
|---|---|---|---|---|---|
| **Total retrieval** | 87–90 | 369–371 | **369–371** | 292–298 | 47–53 |
| Ranking SQL (Node-observed) | 44–50 | 318–322 | **318–322** (86%) | 229–230 | 15–16 |
| Ranking SQL (server execution, `EXPLAIN`) | – | – | 300–312 | 217–230 | 14–17 |
| Status / eligibility SQL | 1.35–1.45 | – | ≈ 1.4 | – | – |
| Key-lookup SQL | 1.2–1.3 | – | ≈ 1.3 | – | – |
| Transaction overhead (`SET LOCAL`, BEGIN/COMMIT, round trips) | 2.8–3.1 | – | ≈ 3 | – | – |
| **S2 phase** (read + SHA-256 + UTF-8 + slice for 4 result books) | 38–41 | 64–66 | 38–43 (11%) | 55–59 | 24–29 |
| S2 read per book (max per request) | – | – | 14–15 | – | – |
| S2 verify, worker queue + execution (max) | – | – | 24–28 | – | – |
| Result assembly and budget trimming | < 0.1 | 0.18–0.24 | < 0.1 | – | – |

**S2 detail.** Q0's top 8 chunks come from 4 distinct books, and S2 verifies each one. The single S2 worker processes books sequentially, so the S2 phase is ≈ 40–60 ms for every matching query. **That is a floor independent of SQL.** No S2 queue saturation or failures occurred; every transfer was zero-copy.

**Conclusion.** For the queries that determine p95, ranking SQL is 78–86% of latency and S2 is 11–20%. The other SQL statements, transaction overhead and assembly are each ≈ 1–3 ms.

## 8. PostgreSQL execution-plan analysis (E1-Q2)

**Q0** (9,855 matches): production SQL, `EXPLAIN (ANALYZE, BUFFERS)`, warm.

| Node | Rows (actual / estimated) | Time | Buffers |
|---|---|---|---|
| Limit | 8 | 306.2 ms | 28,327 hits, 0 reads |
| Sort (**top-N heapsort, 27 kB**) | 8 / 988 | 306.2 | – |
| Append | 9,855 / 988 | 300.9 | – |
| **Hash Join** (computes `ts_rank_cd` for every row) | 9,855 / 986 | **299.7** | **28,323** |
| Bitmap Heap Scan `ai_book_chunks` (exact, 889 pages, 0 recheck) | 9,855 / 9,855 | 4.0 | 896 |
| Bitmap Index Scan `IDX_ai_book_chunks_tsv_es` | 9,855 / 9,855 | 0.7 | 7 |
| Hash ← CTE Scan `allowed` | 10 | 0.02 | – |
| `en` / `simple` branches (Nested Loop → Bitmap scans) | 0 | 0.01 | 2 each |

**Findings:**

- **Candidate enumeration is cheap:** the GIN bitmap index scan takes 0.7 ms and the heap scan 4 ms. The index is used and estimates are accurate at the scan.
- **Ranking dominates:** ≈ 296 ms is attributed to the join node, which evaluates the projection (`ts_rank_cd`) for all 9,855 rows. It touches **≈ 27,400 buffers beyond the heap's 896**: that is TOAST access, ≈ 2.8 pages per row for its `tsvector`.
- **Sorting is negligible:** top-N heapsort over 27 kB.
- **JIT: none.** Plan costs stay below `jit_above_cost` (100,000) in every query. `jit=off` changed nothing (§10).
- **No temporary files or spills.** `work_mem` of 16 MB changed nothing.
- **Joins:** the eligibility hash join on (book, hash) is cheap. Its estimate is off by about 10× (986 vs 9,855 rows) because of the `unnest` CTE selectivity, but that does not change the plan's cost structure.
- **Language branches:** the empty `en` and `simple` branches cost about 0.01 ms.
- **Planning** 0.45–0.66 ms per query; **status SQL** 0.15–0.22 ms; **key lookup** ≈ 0.02 ms execution.
- **Per-query ranking SQL** (server execution, ms): Q0 306 · Q5 225 · Q4 127 · Q1 108 · Q6 50 · Q2 40 · Q7 24 · Q9 19 · Q3 14 · Q8 0.3.
- **Cost per matching row is ≈ 30 µs.** Server time scales linearly with matches. The phrase query Q6 costs more per row, because only 42 rows match but phrase checking needs positions.

**Splitting the ≈ 295 ms ranking cost** (Q0, server execution):

| Variant (diagnostic) | Q0 execution |
|---|---|
| Production (`ts_rank_cd`) | 300 ms |
| Rank removed (`0::real`): no `tsvector` read at all | 6 ms |
| `length(tsv)`: forces the TOAST fetch, trivial computation | 129 ms → **TOAST fetch ≈ 123 ms** |
| `ts_rank_cd` remainder | **≈ 170 ms** |
| Inline storage clone, `length(tsv)` | 20 ms (TOAST fetch removed) |
| Inline storage clone, production SQL | 202 ms → **`ts_rank_cd` ≈ 180 ms** |

**Cold cache.** After a PostgreSQL restart (OS page cache warm), Q0's first execution took 393 ms, with 4,868 block reads.

## 9. Query selectivity and match-count analysis

| Query | Category | Matches (of 17,780) | Matching books | Ranking SQL, server (ms) | End-to-end p50 (ms) |
|---|---|---|---|---|---|
| Q8 | No match | 0 | 0 | 0.3 | 7 |
| Q6 | Phrase | 42 | 10 | 50 | 87 |
| Q3 | Low | 415 | 10 | 14 | 47–53 |
| Q9 | Low-medium | 590 | 10 | 19 | 87 |
| Q7 | Rare | 629 | 10 | 24 | 94 |
| Q2 | Medium | 1,145 | 10 | 40 | 87 |
| Q4 | Multi-term AND | 2,322 | 10 | 127 | 185 |
| Q1 | Medium-high | 3,399 | 10 | 108 | 164 |
| Q5 | Boolean OR | 4,224 | 10 | 225 | 292–298 |
| Q0 | High | 9,855 | 10 | 306 | 369–376 |

- **Correlation:** ranking time grows roughly linearly with matches (≈ 30 µs per row, more for multi-term or phrase evaluation). End-to-end time ≈ ranking SQL + S2 (≈ 25–60 ms) + ≈ 6 ms.
- **Distribution:** every matching query matches all 10 books, so S2 always verifies several books.
- **Representativeness:** the suite's Zipf vocabulary makes Q0 match 55% and Q1 19% of all chunks, and these are not stop words for the `noetia_es` configuration. In real Spanish text, the configuration removes stop words, so content terms are expected to be far more selective. That is an untested hypothesis, and the governing benchmark was not changed.

## 10. Candidate optimization experiments

Server execution in ms (`EXPLAIN ANALYZE`, `TIMING OFF`, p50 of 5); n = 10 client runs per query. Equivalence is against production `RANK_SQL`.

| # | Candidate | Class | Q0 | Q5 | Q1 | Identical results | Evidence |
|---|---|---|---|---|---|---|---|
| 0 | Production `RANK_SQL` | baseline | 300.6 | 217.4 | 107.9 | – | measured |
| 1 | `SET LOCAL jit = off` | exact (setting) | 322.1 | 229.0 | 115.3 | 10/10 | measured: **no gain** (JIT never used) |
| 2 | `SET LOCAL work_mem = 16MB` | exact (setting) | 310.9 | 226.0 | 113.8 | 10/10 | measured: **no gain** (no spills) |
| 3 | Per-branch `ORDER BY … LIMIT topK`, then global | exact (structural) | 332.3 | 234.5 | 105.7 | 10/10 | measured: **no gain** (sort is not the cost) |
| 4 | `tsv` lz4 compression (clone) | exact (storage) | 317.0 | 223.3 | 113.6 | 10/10 fingerprints | measured: **no gain** |
| 5 | `tsv` `STORAGE EXTERNAL` (clone) | exact (storage) | 308.7 | 225.2 | 108.4 | 10/10 fingerprints | measured: **no gain** (values were already uncompressed) |
| 6 | **`tsv` `STORAGE MAIN` (inline; clone)** | **exact (storage)** | **202.5** | **182.9** | **75.0** | **10/10 fingerprints** | measured: **−33% on Q0** |
| 7 | **Exact hybrid:** for single-lexeme tsqueries (`numnode = 1`), select the top 200 by `ts_rank`, then production `ts_rank_cd` order and LIMIT; otherwise the production full ranking | **exact (structural; proof in §11)** | 151.9 (inline: **29.5**) | 229.4 (inline: 176.9) | 61.7 (inline: 16.6) | **20/20** (benchmark + adversarial) | measured |
| 8 | Two-stage for all queries, M = 200 | **lossy** | 151.3 (inline: 29.0) | 75.0 (inline: 24.3) | 53.8 (inline: 15.8) | 10/10 benchmark; **8/10 adversarial** | measured |
| 9 | Two-stage, M = 50 / 400 (inline) | lossy | – | – | – | M = 50: 8/10 benchmark; M = 400: 10/10 benchmark, **9/10 adversarial** | measured |
| 10 | `ts_rank` instead of `ts_rank_cd` (inline) | semantic change | 22.0 | 11.8 | 8.9 | 2/10 (Q4 recall 0.13) | measured, diagnostic |
| 11 | Candidate cap 500 / 2,000 | lossy | 22.2 / 72.8 | 31.1 / 111.3 | 19.6 / 67.9 | 5/10 · 7/10; minimum recall@8 0.13 / 0.25 | measured |
| 12 | Rank removed / `length(tsv)` | diagnostic | 6.1 / 128.7 | – | – | no | measured (cost split) |

**End-to-end** (production service, real MinIO and S2; ranking SQL substituted test-only; n = 100):

| Configuration | p50 | p95 | p99 | Bounding query | Exact? |
|---|---|---|---|---|---|
| Production | 87–90 | **369–371** | 380–392 | Q0 | – |
| Inline storage (clone) | 105 | **271** | 297 | Q0 (269), Q5 (258) | **yes** |
| Exact hybrid, production storage | 90 | **299** | 314 | Q5 (299) | **yes** |
| **Exact hybrid + inline storage (clone)** | 95 | **264** | 274 | **Q5 (264)** | **yes** |
| Two-stage (all) + production storage | 90 | **200** | 213 | Q0 (200) | no |
| Two-stage (all) + inline storage (clone), 2 sessions | 89 | **112 / 112** | 118 / 122 | Q5, Q6, Q9 (≈ 100–106) | **no (relevance loss shown)** |

**E-1 status per candidate:**

| Candidate | E-1 |
|---|---|
| Exact candidates (6, 7, 6 + 7) | **Partial:** they improve E-1 but do not reach 150 ms |
| Two-stage-all + inline storage | Would satisfy E-1 diagnostically, but is **not exact** |

None of these is an E-1 qualification: all ran on a schema-modified clone or with substituted SQL.

## 11. Exact-result and relevance equivalence

**Exact candidates.**

- **#1–#3 (settings and branch pushdown):** results identical by construction.
  - Settings do not change semantics.
  - Each row belongs to exactly one branch, and the global order is a strict total order (rank, bookId, chunkIndex), so the global top-K ⊆ the union of each branch's top-K.
- **#4–#6 (storage):** identical by construction (same `tsvector` values; storage only). Verified by identical result fingerprints for all 10 queries.
- **#7 (exact hybrid), correctness argument:**
  1. All lexemes have the same weight: the indexer never calls `setweight`.
  2. For a single-lexeme tsquery, each occurrence of the lexeme is a cover of length 1, so `ts_rank_cd` = occurrences × the uniform weight. Normalization 32 (r/(r+1)) is strictly increasing.
  3. `ts_rank` for a single lexeme adds a positive term per stored position. It is strictly increasing in the occurrence count, and normalization 32 is strictly increasing too.
  4. Both functions therefore induce the same order, and equal counts give equal scores under both.
  5. Stage 1 orders by (`ts_rank` desc, bookId, chunkIndex), stage 2 by (`ts_rank_cd` desc, bookId, chunkIndex). These are the same strict total order over the matching set, so the first M = 200 of stage 1 contain the first K = 8 of the production order, in the same order.
  6. Both use the stored positions; tsvector's 256-position cap per lexeme applies identically to both.
  7. Predicates, eligibility join, language branches and the final ORDER BY/LIMIT are unchanged.
  8. Multi-node tsqueries (AND, OR, NOT, phrase) take the unchanged production arm.

  **Verified:** identical on 10/10 benchmark and 10/10 adversarial queries, on both storage layouts.

  **Caveat:** before implementation, the monotonicity premises (steps 2–3) must be confirmed against PostgreSQL 16's `tsrank.c` and covered by property tests. They are reasoned here from the function definitions, not code-audited.

**Determinism.** Repeated runs gave identical rows and order for every exact variant (5–10 repetitions per query).

**Citations, offsets, budget, exclusions.** The candidates change only which rows SQL returns and their order, and for exact candidates those are identical. Citation offsets (`charStart`/`charEnd`), S2 slicing, token-budget trimming and `stale`/`unavailable`/`unindexed` exclusions are downstream and unchanged.

## 12. Candidate-cap and two-stage relevance loss

| Candidate | Benchmark | Adversarial multi-term set (X0–X9, diagnostic only) |
|---|---|---|
| Cap 500 | Q0, Q1, Q4, Q5 miss the **top-ranked** result; Q7 misses rank 8; minimum recall@8 0.13 | – |
| Cap 2,000 | Q0 misses rank 2; Q5 misses rank 1; Q4 misses rank 8; minimum recall@8 0.25 | – |
| Two-stage M = 50 | Q4 (recall 0.88, misses rank 8); Q5 (recall 0.50, misses rank 3) | X0, X2 recall 0.13 (miss rank 1); X8 0.88 |
| Two-stage M = 200 | identical | **X0 (OR high + rare), X2 (OR high + medium): recall 0.13, top result missed** |
| Two-stage M = 400 | identical | **X2: recall 0.13, top result missed** |

**Why multi-term two-stage fails.** For an OR query, `ts_rank_cd` treats every occurrence of any term as a cover, so it ranks by combined occurrences. `ts_rank` saturates each term separately, so a chunk dense in the rare term can rank low in stage 1 yet first under `ts_rank_cd`. AND and phrase queries add proximity, which `ts_rank` ignores.

**Conclusion.** Every candidate-limiting or two-stage-for-all method **can omit a higher-ranked eligible passage**. None is exact-result-preserving, and none can be adopted without a PO relevance decision (§19).

## 13. CPU, memory, I/O and index-size impact

| Item | Production storage | Inline storage (`MAIN`) |
|---|---|---|
| Heap / TOAST / indexes | 7.3 / 43.1 / 15.7 MB | 48.3 / 2.2 / 15.7 MB (total ≈ unchanged; GIN unchanged) |
| Q0 buffers touched | 28,327 | 5,724 |
| Q0 ranking server time | 300 ms | 202 ms (exact SQL) · 29 ms (exact hybrid) |
| Temporary files and spills | none | none |
| Planning time | 0.45–0.66 ms | similar; hybrid adds a few plan nodes (unmeasured beyond total) |

- **Indexing and inserts.** A storage change needs a one-time table rewrite (`ALTER COLUMN tsv SET STORAGE MAIN` affects only new values, so existing rows must be rewritten). After that, inserts store `tsv` inline: wider heap rows, no TOAST inserts. The insert cost was not measured here. With 17,780 rows the rewrite took seconds in the clone.
- **The hybrid SQL** needs no storage. Its CPU per single-term query is lower; multi-term queries are unchanged.
- **1-vCPU-capped database (production cap):** Q0 299 ms (production storage) and 205 ms (inline), unchanged from uncapped because one query uses one core. **More cores would not help a single query** unless parallel query engaged, and the production cap is 1 vCPU.
- **Database memory:** the inline heap of 48 MB fits the default 128 MB `shared_buffers`; no change needed.

## 14. Comparison of feasible remedies

| Candidate | Measured benefit | Exact? | Complexity | Operational impact | Evidence |
|---|---|---|---|---|---|
| Improve the current execution plan (JIT, `work_mem`, pushdown) | None | yes | – | – | measured |
| **Improve eligibility and ranking SQL structure: exact single-lexeme hybrid** | Single-term queries: Q0 SQL −50% (production storage) / −90% (inline); E-1 p95 −19% (alone) / −29% (with inline) | **yes** (proof §11) | Medium: one SQL text with two arms per language; property tests | None | measured |
| **Storage or statistics: inline `tsv` (`STORAGE MAIN`)** | Q0 SQL −33%; E-1 p95 −27% | **yes** | Low: one migration plus rewrite | Heap ↑, TOAST ↓, total ≈ same; one-time rewrite | measured (clone) |
| Deterministic candidate limiting (caps) | Large | **no** (recall 0.13–0.25) | Low | – | measured |
| Two-stage for all queries (+ inline) | E-1 p95 112 ms | **no** (top-1 misses on OR queries) | Medium | – | measured |
| Additional index or database resources | More cores: none for a single query (1-vCPU cap; parallel query not engaged). A ranking-capable index (e.g. RUM) or a separate search engine could remove per-row ranking, but changes infrastructure and ranking semantics | depends | High | New extension, service or capacity | **speculative / estimated** |
| Other: S2 floor (≈ 40–60 ms) | Limits every candidate: even exact SQL at 0 ms leaves ≈ 45–65 ms | – | Changing it touches the S2 worker (not authorized; Q-11 interaction) | – | measured component |

## 15. Cost and operating complexity

| Candidate | Recurring cost | One-time engineering | Maintenance |
|---|---|---|---|
| Inline storage | None | Small: migration with `STORAGE MAIN` and a rewrite; verify insert path | Low |
| Exact hybrid | None | Medium: `RANK_SQL` change, proof-backed property tests, equivalence suite | Medium: two arms per language |
| Two-stage all | None | Medium | Medium, plus relevance monitoring |
| Separate engine, RUM, or more DB CPU | New or allocated capacity, operations burden | High | High |

## 16. Recommendation (UNAPPROVED)

**Primary: authorize the exact package, with a PO decision on multi-term ranking alongside it.**

1. **Inline `tsv` storage:** a migration `ALTER TABLE ai_book_chunks ALTER COLUMN tsv SET STORAGE MAIN`, plus a controlled rewrite of existing rows. Exact; −27% E-1 p95.
2. **Exact single-lexeme hybrid** in `RANK_SQL`: two-stage only when `numnode(tsquery) = 1`, with M ≥ topK (200 measured); production full ranking otherwise. Exact by proof; it makes the dominant single-term case fast (Q0 end-to-end p50 ≈ 369 → **92 ms**: SQL 32 + S2 42 + overhead; measured on the clone).
3. **Expected:** E-1 p95 ≈ **264 ms** on the governing benchmark (measured, clone). **E-1 still OPEN.** The bound becomes the multi-term OR query.

**Why this is the smallest justified intervention:**

- No exact alternative does better.
- Settings, pushdown and compression were measured useless.
- Both parts are local: one migration and one SQL text. No infrastructure, cost or contract change.
- It removes the measured TOAST cost and the unnecessary `ts_rank_cd` work for single-term queries without changing any result.

**Required PO decision (to reach E-1).** For multi-term queries with very frequent terms, exact `ts_rank_cd` over thousands of matches costs ≈ 180–230 ms of SQL on one core. Reaching 150 ms end to end therefore needs **one** of:

| Option | Measured effect |
|---|---|
| (a) Approximate ranking for multi-term queries (two-stage-all, M = 200) with an explicit relevance tolerance | E-1 p95 112 ms; top-1 misses demonstrated for OR queries |
| (b) An E-1 criterion that accounts for query class or term frequency, or a benchmark revision for representativeness | – |
| (c) An architectural alternative with cost and semantics review (ranking-capable index or engine) | – |

**Fallback.** If the PO rejects every relevance trade-off and every criterion change, E-1 cannot be met on the existing single-instance PostgreSQL for the governing benchmark (§17). The exact package is still recommended as an improvement, and E-1 would remain a documented exception pending an architecture decision.

## 17. Risks, assumptions and confidence

| Statement | Confidence | Basis |
|---|---|---|
| Ranking (TOAST fetch + `ts_rank_cd`) is the primary E-1 bottleneck | **High** | Plan nodes, the cost split, three consistent end-to-end sessions |
| JIT, sorting, spills, joins, planning and other SQL are not material | High | Plans; settings variants |
| Inline storage is exact and saves ≈ 100 ms on Q0 | High | Clone fingerprints; repeated timings; capped DB check |
| The exact hybrid is exact | **High for the design; medium until code-audited** | Proof §11; 20/20 identical; needs a PG16 source check and property tests |
| No exact candidate reaches E-1 on this benchmark with 1 vCPU | Medium-high | Q5 OR ≈ 177–229 ms SQL exact; S2 ≈ 40–60 ms floor; no exact way found to avoid per-row `ts_rank_cd` for multi-term queries |
| The benchmark's high-frequency terms are unrepresentative | **Speculative** | Zipf synthetic vocabulary; not tested on real filtered text |
| Production behaves like the disposable DB | Medium | Same image and defaults; capped check equal; real data, concurrency and cache state untested |

**Session variance.** E-1 p95 ranged from 387 to 763 ms across days, so absolute values need fresh-session confirmation.

## 18. Why the preferred candidate is the smallest justified intervention

It is the minimal set of **exact** changes with a measured effect: one storage attribute and one SQL restructuring. It needs no new dependency, index, infrastructure, configuration or contract change.

Every larger E-1 gain measured requires a relevance change or an architecture change, and so belongs to the PO.

## 19. Exact subsequent authorization required

A PO decision (and PA/SA review) that would:

1. **Authorize a tracked migration** setting `ai_book_chunks.tsv` storage to `MAIN`, with a rewrite of existing rows. A schema-storage change only; no column, type or index change. PA/SA must review the rewrite procedure for deployed environments (lock duration, snapshot).
2. **Authorize a `RANK_SQL` change** limited to the single-lexeme exact hybrid. This needs:
   - a code audit of PostgreSQL 16 `ts_rank`/`ts_rank_cd` monotonicity for single lexemes with uniform weights;
   - property and equivalence tests (randomized fixtures, ties, weights, the 256-position cap) that assert identical rows and order against the current SQL;
   - the NEM-023 suite and all retrieval contracts unchanged.
3. **Decide on multi-term ranking:** option (a), (b) or (c) in §16. For (a), a relevance tolerance and a measurement protocol (recall@K, top-1 preservation) are needed before any implementation.
4. **Requalify:** E-1 with ≥ 3 sessions; Q-11 regression at W=10, 6 and 3 (the retrieval path shares the 1-vCPU API; database load changes could affect reader latency); full regression.
5. **Rollback:** the migration's down-step returns storage to `EXTENDED` (followed by a rewrite); the SQL change is a code revert.

PO-048 creates or executes none of this.

## 20. Unresolved exceptions

| Item | Status |
|---|---|
| **E-1** | **OPEN** (p95 369–387 ms this session) |
| Checkpoint E | **NOT QUALIFIED** |
| Q-11 | PO-047 conditionally accepted for development; thin `p3x3` margin and large-book memory risk retained |
| S2 floor | ≈ 40–60 ms per retrieval (single worker, several books). It limits any E-1 remedy; changing it is out of scope |
| Benchmark representativeness | Stop-word-like synthetic frequencies (§9); a PO question |
| Earlier exceptions | Unchanged; not waived |

## 21. Test tooling and changed-file inventory

| Commit | Files |
|---|---|
| `f95a153` | PO-048 record; `PRODUCT-DECISIONS.md`; `docs/engineering-missions/README.md`; NEM-024 mission status |
| `713ef67` | `services/api/tests/perf/e1-ranking-diag.ts` (new, opt-in, disposable DB only); `services/api/tests/perf/README.md` (§PO-048) |
| report commit | This report; `2026-11-11-NEM-024-po-048-e1-ranking-raw-measurements.json`; status lines |

**Not changed:** `services/api/src`, migrations, Dockerfiles, Compose, protected tests, and the E-1 suite's acceptance definition and query mix.

**Tool checks:** `tsc` 0 errors on the perf project; ESLint 0 errors (6 `no-explicit-any` warnings).

## 22. Raw measurements

[`2026-11-11-NEM-024-po-048-e1-ranking-raw-measurements.json`](2026-11-11-NEM-024-po-048-e1-ranking-raw-measurements.json) (≈ 303 KB, compact JSON) contains:

- fixture `info` (sizes, indexes, settings, match counts);
- `explain` (per-query plan nodes, warm and cold);
- the end-to-end sessions (fwd, rev, shuffle; inline clone; substituted variants);
- every SQL variant result (timings and equivalence);
- clone fingerprints and storage facts;
- the capped-DB checks;
- the adversarial set;
- the session-0 suite summary.

Queries appear only as Q0–Q9 and X0–X9. It contains no query text, book text, ids, hashes, keys or credentials (checked).

## 23. Reproduction and clean-up

1. Start disposable `postgres:16-alpine`, `redis:7-alpine` and `minio/minio` on 127.0.0.1.
2. Run the NEM-023 suite with `NEM023_PERF=1 NEM023_PERF_KEEP=1`.
3. Use the commands in `services/api/tests/perf/README.md` §PO-048 (`info`, `explain`, `e2e`, `sql <variant>`, `E1_SUBST`, `E1_EXTRA`).
4. For storage clones: `CREATE DATABASE <x>_test TEMPLATE nem019_test`, then `ALTER TABLE ai_book_chunks ALTER COLUMN tsv SET STORAGE MAIN` (or `SET COMPRESSION lz4` / `SET STORAGE EXTERNAL`), then `UPDATE ai_book_chunks SET tsv = (tsv::text)::tsvector; VACUUM FULL ANALYZE ai_book_chunks;`.

**Clean-up done:** the `po048-*` containers (PostgreSQL with all clones, Redis, MinIO) were removed; no temporary index or setting persists anywhere. No unrelated container was touched.

## 24. Review and decision status

| Item | Status |
|---|---|
| Independent PA review | **AWAITING** |
| PO follow-on decision | **AWAITING** |
| E-1 | **OPEN** |
| Checkpoint E | **NOT QUALIFIED** |
| Release | **BLOCKED** |
