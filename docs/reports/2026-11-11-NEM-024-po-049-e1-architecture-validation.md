# NEM-024 — PO-049 E-1 Architecture Validation: Exact Ranking and Benchmark Representativeness

**Authority:** [PO-049](../operating-framework/decisions/product-owner/PO-049-nem-024-e1-architecture-validation-authorization.md). **DIAGNOSTIC AND ARCHITECTURAL VALIDATION ONLY.**
**Date:** 2026-11-11 · **Branch:** `feat/nem-024-checkpoint-b` · Draft PR #56 · **Execution agent:** Claude Code · **Review:** independent Product Architecture (AWAITING)
**Starting commit:** `689cdb33054978e3d39a4c496190c241acb64d77` · **Ending commit:** the commit that adds this report (see PR #56; tooling `af943c9`, governance `bf67bf3`)

> **No production code, SQL, index, migration, configuration, merge, deployment or activation.** `services/api/src` is byte-identical to the starting commit. Every experiment ran on disposable local PostgreSQL 16.13 / MinIO containers with synthetic text. They are removed.

---

## 1. Executive summary

**Headline:** the investigation found **no genuinely exact strategy that meets E-1 on the governing benchmark.** The best exact configuration measured is **256–268 ms p95** against the 150 ms target. It is bounded by multi-term **AND** and **phrase** queries.

### F-48-1: the single-lexeme hybrid is CONDITIONALLY EXACT

The PostgreSQL 16.13 source and an exhaustive bit-level enumeration prove that, for a single plain operand on a positional vector with uniform weights:
- `ts_rank(·,32)` and `ts_rank_cd(·,32)` are both functions of the stored occurrence count n ∈ [1, 255] alone;
- both are strictly increasing in n.

Their total orders, including ties under the shared `(bookId, chunkIndex)` tie-break, are therefore identical.

**Differential evidence:**
- **Precondition-satisfying fixtures:** 5,103 full-precision hybrid cases, with **0** mismatches whenever M ≥ topK.
- **Counterexamples:** three source-predicted counterexamples are preserved as deterministic regression cases. Mixed weights and stripped vectors both break the hybrid at M = 200.

`numnode(q) = 1` is sufficient **only together with** the enforceable preconditions in §6.4.

### F-48-2: the governing benchmark is extreme, but not implausible

| Measure | Governing Q0 | Distribution B (Zipf, s = 1, real Spanish stop list) |
|---|---|---|
| Token frequency | 4,413 per million | 279 per million (top content term) |
| Chunks matched | 55.4% | 4.5% (≤ 9% for every query) |

**Under B and C, today's production code already meets E-1:**

| Distribution | Production p95 | C1 exact candidate p95 |
|---|---|---|
| B | 104 ms | 98 ms |
| C | 115 ms | 90 ms |

The governing benchmark is unchanged and still fails: 496–573 ms on the production configuration in this session, 795.8 ms in the governing suite run.

Whether real users ask about such frequent terms (for example, protagonists' names) is **untested**. A benchmark revision would need the empirical evidence listed in §13.4.

### F-48-3: two exact candidates were examined

**C1, exact threshold pruning:**
- **Method:** an exact occurrence-count upper bound, derived by inverting `ts_rank` through `width_bucket`; only rows whose bound can reach the K-th exact score are scored exactly.
- **Correctness:** exact under the same preconditions, with 2,667+ property cases at 0 mismatches.
- **Effect:** it eliminates almost all `ts_rank_cd` calls for single-term and OR queries.
- **With inline storage:**

  | Set | p95 before | p95 with C1 |
  |---|---|---|
  | Governing (A) | 411 ms (inline baseline) | **256–268 ms** |
  | Adversarial (D) | 837 ms | **211 ms** |

- **Remaining limit:** it cannot prune AND or phrase queries.

**C2, a tighter minimal-window bound for conjunctions:** proven sound, but it pruned **0 rows** on the governing AND query. That is no gain, so the stop condition was reached.

### Root cause sharpened

`ts_rank_cd` has a fixed per-call cost of ≈ 23 µs per operand and ≈ 54 µs for a three-node query, even on a two-lexeme vector. It comes from zero-filling a 32 KB position buffer per query node (tsrank.c:876–877). `ts_rank` costs ≈ 0.1 µs.

Exact AND and phrase ranking over thousands of rows is therefore bounded by the engine function itself. The remaining exact options are an application-side bit-exact re-implementation or a PostgreSQL change, both architectural decisions.

### Status

| Item | Status |
|---|---|
| E-1 | **OPEN** |
| Checkpoint E | **NOT QUALIFIED** |
| Release | **BLOCKED** |
| Q-11 | Conditional development acceptance; risks retained |

## 2. Authorization and preflight verification

| Check | Result |
|---|---|
| Remote fetched; branch `feat/nem-024-checkpoint-b`; working tree clean (only ignored `node_modules`) | ✔ |
| PR #56: open, **Draft**, unmerged, base `feat/nem-024-checkpoint-a`, head `689cdb3…` = expected | ✔ |
| `PO-049` unused (governance tree, all remote history) | ✔ |
| Read: decision register, NEM-023/NEM-024 specifications, PO-045..PO-048, the full PO-048 report and raw measurements, `RANK_SQL`, the indexer, retrieval contracts, E-1 suite and PO-048 tooling | ✔ |
| Databases and fixtures disposable and synthetic (`po049-*` containers on 127.0.0.1; `*_test` names enforced by the tooling) | ✔ |
| Governance record created first (`bf67bf3`) | ✔ |

A leftover background waiter from an earlier session, which only polled a file, was stopped. No unrelated container was touched (14 Noetia and AutoGuildX containers kept running).

## 3. Starting and ending commits

| Commit | Content |
|---|---|
| `689cdb3` | Starting HEAD (PO-048 report) |
| `bf67bf3` | PO-049 governance record and indexes |
| `af943c9` | Test-only tooling: `e1-arch-diag.ts`, the counterexample fixture, the perf README |
| *(this commit)* | This report, the raw measurements, mission status |

## 4. Scope and changed-file inventory

| File | Change |
|---|---|
| `docs/operating-framework/decisions/product-owner/PO-049-…authorization.md` | New |
| `docs/noetia-plus/PRODUCT-DECISIONS.md` | Index entry |
| `docs/engineering-missions/README.md` | Status |
| `docs/engineering-missions/APPROVED/NEM-024-…md` | Status |
| `services/api/tests/perf/e1-arch-diag.ts` | New; test-only, opt-in, refuses non-disposable targets |
| `services/api/tests/perf/fixtures/po049-hybrid-counterexamples.json` | New; deterministic regression cases |
| `services/api/tests/perf/README.md` | §PO-049 |
| `docs/reports/2026-11-11-NEM-024-po-049-e1-architecture-validation.md` | This report |
| `docs/reports/…-raw-measurements.json` | Raw evidence, content-free |

**Not changed:** `services/api/src/**`, `RANK_SQL`, migrations, indexes, Dockerfiles, Compose, the E-1 suite or its thresholds, protected tests, web, mobile.

## 5. PostgreSQL 16 source audit

**Source:** tag `REL_16_13` (github.com/postgres/postgres), matching the benchmarked server *PostgreSQL 16.13 on x86_64-pc-linux-musl* (`postgres:16-alpine`, `server_version_num` 160013). `tsrank.c` sha256 `8f009f1b600af01a6982e973129adff3c45d1efb56791c0c91d94339882e4463`.

| Location | Fact established |
|---|---|
| `tsrank.c:24` | Default weights `{D 0.1, C 0.2, B 0.4, A 1.0}` (float4) |
| `tsrank.c:356–397` `calc_rank` (= `ts_rank`) | A single operand (`QI_VAL`) goes to `calc_rank_or`. Normalization 32: `res /= (res + 1)` in float4. No other normalization flag is set (production uses 32 only) |
| `tsrank.c:283–354` `calc_rank_or` | For each distinct operand (`SortAndUniqItems`), entries come from `find_wordentry`. For a **prefix** operand that is several entries (`:112–125`). Then `resj = Σ_j w(pos_j)/(j+1)²` over stored positions in storage order, `wjm` = maximum weight (first index), and `res += (wjm + resj − wjm/(jm+1)²)/1.64493406685`, then `/size`. **The operand's weight restriction is ignored** (no `weight` test). A positionless entry uses a dummy position of weight D (`posnull`, `:297–324`) |
| `tsrank.c:726–847` `get_docrep` | One doc entry per stored position of each operand entry, **filtered by the operand weight mask** (`:784–785`). **Positionless entries are ignored** (`:768–773`). Sorted by (position, weight, entry); identical (position, entry) pairs are merged (`:817–836`), which collapses duplicate operands |
| `tsrank.c:645–724` `Cover` | Scans forward for the first end q at which the query holds, then backward for the largest start p. That gives a **minimal window**; it resumes at the entry after the start |
| `tsrank.c:849–950` `calc_rank_cd` (= `ts_rank_cd`) | Per cover, `Cpos = (#entries)/Σ(1/w)` and `nNoise = (q−p) − (end−begin)` (if negative, `(end−begin)/2`); `Wdoc += Cpos/(1+nNoise)` in float8. Normalization 32: `Wdoc /= Wdoc + 1`, then **cast to float4** |
| `tsrank.c:540–548, 876–877` | `QueryRepresentationOperand` holds `WordEntryPos pos[MAXQROPOS = 16384]` (32 KB). **`palloc0(query->size × 32 KB)` on every call**, which is the fixed per-call cost (§14.3) |
| `to_tsany.c:205–235` | `to_tsvector` sets **weight 0 (D) on every position** and `haspos = 1` |
| `to_tsany.c:139–151`, `ts_type.h:85–87` | At most **255** positions per lexeme (`MAXNUMPOS − 1`); positions clamped to 16383 (`LIMITPOS`) and de-duplicated |
| `tsquery.c:398–403` | `websearch_to_tsquery` tokens always have `weight = 0` and `prefix = false` |
| `to_tsany.c:493–551` `pushval_morph` | Prefix only if a **dictionary** returns `TSL_PREFIX`. Noetia's configurations (migration 075) map `word`, `hword` and `hword_part` to `unaccent` + `spanish_stem` / `english_stem` / `simple`; other token types inherit the copied defaults. None of these sets `TSL_PREFIX` |

## 6. Formal analysis of single-lexeme ranking equivalence

### 6.1 Setting

Let q be the per-branch `websearch_to_tsquery(cfg, $3)`, with `numnode(q) = 1`, so q is exactly one operand o. Let v be an indexed vector containing o's lexeme with n stored positions, 1 ≤ n ≤ 255. A row matches iff the lexeme is present.

### 6.2 Both ranks are functions of n alone

- **`ts_rank`:** with all weights D, `resj = 0.1f·Σ_{j=1..n} 1/j²`, `wjm = 0.1f`, `jm = 0`, so `res = (0.1f + resj − 0.1f)/1.6449…`, then normalized. That depends only on n (positions never enter).
- **`ts_rank_cd`:** the doc representation has n entries with distinct positions. Each `Cover` call returns the single entry, so `Cpos = 1/(1/0.1f)` and `nNoise = 0`. Hence `Wdoc = n·c` and `cd = fl32(n·c/(n·c+1))`.

**Verified bitwise:** `cd = (n/(n+10))` reproduced exactly for all n.

### 6.3 Strict monotonicity, by complete enumeration of the finite domain

`rankfn` computed both functions in PostgreSQL 16.13, as `float4send` bits, for n = 1..300 through the production indexing expression, in all three configurations:

| Result | Value |
|---|---|
| Stored count domain | exactly [1, 255] (counts > 255 are stored as 255) |
| `ts_rank` | strictly increasing; minimum adjacent gap 7.7 × 10⁻⁷ |
| `ts_rank_cd` | strictly increasing; minimum adjacent gap 1.43 × 10⁻⁴ |
| Distinct values | 255 for each function |
| Configurations | bit tables **identical** across `noetia_es`, `noetia_en` and `noetia_simple` (one sha256) |
| Position independence | 3,000 random position sets per count, including the 16383 clamp: **0** counts with more than one value |

**Consequence:** for matching rows x and y,

> `rank(x) ⋛ rank(y) ⇔ n_x ⋛ n_y ⇔ cd(x) ⋛ cd(y)`.

Ties coincide. Because `(bookId, chunkIndex)` is unique among eligible rows, the stage-1 order and the production order are the same total order:
- `validate()` admits one text version per book;
- the `UNIQUE (bookId, textHash, chunkIndex)` constraint holds.

The first M ≥ K rows of a branch in stage-1 order contain that branch's production top K, in order. The global top K takes at most K rows from any branch. Stage 2 calls the identical `ts_rank_cd(c.tsv, q.q, 32)` on identical inputs, so rank values are bit-identical.

There is no saturation issue: every count is representable, and float4 rounding never merges two counts (the gaps above exceed one float4 ulp at those magnitudes by > 10×).

### 6.4 Preconditions: is `numnode(q) = 1` sufficient?

`numnode(q) = 1` alone is **not** sufficient for arbitrary tsqueries. Together with the following conditions, it is.

| ID | Precondition | Holds today because | Violation shown |
|---|---|---|---|
| **P-Q** | The single operand has no prefix flag and no weight restriction | The query comes from `websearch_to_tsquery` (`tsquery.c:402–403`), and no configured dictionary emits `TSL_PREFIX`. `rankfn` confirms no `:` marker for any tested input, including `zorb:*` and `zorb:A` | `to_tsquery('zorb:*')`: a:1 + b:1 vs a:3 orders disagree. `zorb:A`: `ts_rank` ignores the restriction |
| **P-W** | Every stored position has weight D | The only writer is `BookIndexer` via `to_tsvector` (`to_tsany.c:225`) | **CX-1:** 1×A vs 11×D gives `ts_rank` 0.378 > 0.0865 but `ts_rank_cd` 0.5 < 0.524 |
| **P-P** | Every lexeme carries positions (no `strip()`) | `to_tsvector` always stores positions | **CX-2:** stripped vs n=1: equal `ts_rank`, `ts_rank_cd` 0 vs 0.0909 |
| **P-M** | Stage-1 limit M ≥ topK, per branch | M = 200 and `maxTopK` = 20 | M < K mismatches in every seed (negative control) |
| **P-T** | Stage-1 and final ORDER BY share the `(bookId, chunkIndex)` tie-break | Same SQL text | – |
| **P-V** | Engine algorithm as audited (`REL_16_13`) | Pinned image major version 16 | Re-run `rankfn` + `prop` on any PostgreSQL upgrade |

For an implementation, P-Q and P-M can be enforced in SQL:
- add a guard such as `q::text !~ ''':'`;
- use `LIMIT GREATEST(200, $4)`.

P-W and P-P are data invariants of the single writer. They could be protected by a CHECK constraint (a schema change requiring authorization), or by an indexer test plus a startup self-test.

### 6.5 Verdict

**CONDITIONALLY EXACT.**

## 7. Full-precision result comparisons

**What is compared** (`compare()`, every row): `id`, `bookId`, `textHash`, `chunkIndex`, `charStart`, `charEnd`, `language`, `rank`, row count and exact order.

- **Rank:** the float4 value is retrieved as PostgreSQL's shortest-exact text (`extra_float_digits = 3`, raw text parser). That is a bijection with the float4 bit pattern, and nothing is rounded.
- **Contract:** the end-to-end check compares the sha256 of the entire `retrieve()` result, at topK 1, 8 and 20. That covers passages (text, offsets, ranks, tokens), exclusions and truncation.

| Scope | Result |
|---|---|
| Governing set A, base vs `hybrid200` / `thresh200` / `andb200`, production and inline storage, topK 1/8/20 | **identical** (all 10 queries, every variant) |
| Set D (adversarial), inline, `hybrid200` / `thresh200` | **identical** |
| Sets B and C, `hybrid200` / `thresh200` | **identical** |
| `retrieve()` contract, all 17 end-to-end sessions × topK 1/8/20 | **identical** in every session (`contractIdenticalAll: true`) |

## 8. Adversarial and property-based testing

`prop` builds a fresh synthetic fixture per seed with the **production indexing expression** `to_tsvector('noetia_<lang>', text)`:
- 8 books × 2 text versions; only version 0 is allowed, so the stale-version rows test eligibility;
- `es`, `en` and `simple` rows;
- 5 target lexemes with counts drawn from {0, 1–3, 4–20, 100–300} (forcing the 255 cap and ties) in shuffled positions, among frequent fillers that include the stop words `el`/`de` (Spanish) and `the`/`and` (English).

**Queries (27):**
- single lexemes;
- OR of 2 and 3 terms;
- AND of 2, 3 and 4 terms, including frequent fillers;
- a phrase, AND-NOT, duplicate OR and duplicate AND;
- a Spanish stop word that is a lexeme in `en`/`simple` (cross-branch `numnode` differs);
- an English stop word plus a term;
- stop words only;
- OR with a phrase;
- prefix and weight syntax, hyphenated and apostrophe inputs;
- no match.

Each query runs at topK ∈ {1, 2, 3, 5, 8, 13, 20} and several M values around topK (1, 2, 5, 8, 13, 20, 21, 40, 200).

| Fixtures | Seeds (rows) | Cases | Mismatches with M ≥ topK | Mismatches with M < topK (negative control) |
|---|---|---|---|---|
| Preconditions hold | 49 (3,000), 50 (6,000), 51 (400), 54 (4,000), 55 (800) | **9,408** (hybrid 5,103 · C1 3,171 · C2 1,134) | **0** | 1,094 |
| Preconditions violated (15% weight A, 15% mixed A/D, 10% stripped) | 52 (3,000), 53 (6,000), 56 (4,000) | 5,831 | hybrid **97**, C1 **341**, C2 **71** | 719 |

The negative controls show that the harness detects failures. The violated-precondition runs show that the preconditions are necessary.

**Fewer than topK matches:** seed 51 (400 rows), and stop-word or no-match queries.

**More than 200 candidates:** frequent fillers match up to ~6,000 rows.

## 9. Counterexamples

The counterexamples are preserved in `services/api/tests/perf/fixtures/po049-hybrid-counterexamples.json`, invented lexeme only. Replay with `e1-arch-diag.ts counterexamples`.

| Case | Violation | Construction (k = 1) | `hybrid200` | `thresh200` |
|---|---|---|---|---|
| CX-1 | P-W | 200 × `zorb:1A` + 1 × 11 D positions | **NOT identical** (recall 0) | identical |
| CX-2 | P-P | 200 × stripped `zorb` + 1 × `zorb:1` | **NOT identical** (recall 0) | identical |
| CX-3 | P-W | 200 × 30 A positions + 1 × 40 A positions | identical | **NOT identical** (recall 0) |

**Source-level:**
- prefix and weight-restricted operands contradict "a function of one count" (`rankfn` `preconditionCounterexamples`);
- `websearch_to_tsquery` cannot produce them.

**No counterexample exists** inside the preconditions (§6.3 is exhaustive over the domain).

## 10. Benchmark representativeness methodology

The governing generator draws word index `⌊u^2.2 · 6000⌋`, which is a power law, not Zipf. Its vocabulary contains no stop words, so every token is indexed.

**Supplementary distributions** (research only; labelled; Distribution A untouched):

| Distribution | Corpus | Queries |
|---|---|---|
| **A** governing | NEM-023 suite, unchanged | Q0..Q9 |
| **B** more selective content | 10 × 2,000,000 code points. Zipf s = 1.0 over 50,000 ranks; ranks 1–313 are the PostgreSQL/Snowball Spanish stop list (frequency-ordered); higher ranks are synthetic content words. Same sentence model, chunking (1,500 / 10%), indexer and rights path | B0..B9 mirror A's categories by content rank (1, 10, 100, 1000, 3000, 40000; AND 5+50; OR 20+200; phrase 2+3; no match) |
| **C** mixed realistic-style | B corpus | 20 queries: 6 single terms at log-uniform ranks; 6 questions with stop-word scaffolding (`¿qué hay del X y la Y?`, 2–3 content terms); 2 one-term questions; 2 phrases; 2 OR; 1 no match; 1 stop words only |
| **D** adversarial | Governing corpus | X0..X9: high-frequency OR, AND, phrase, AND-NOT |

**Evidence status:**

| Assumption | Status |
|---|---|
| Zipf exponent ≈ 1 for natural language; function words dominate the top ranks | **Supported** (established linguistic regularity: Zipf 1949; Piantadosi 2014 review) |
| Stop words ≈ 55% of tokens (B: 55.5% measured on the generated corpus) | **Estimated** (model value; not measured on a Spanish corpus here) |
| Highest-frequency Spanish content stems ≈ 500–2,000 per million | **Estimated**, from general corpus knowledge; not measured |
| Noetia users' question distribution | **Untested.** No user data used or available |

**C artifact found and corrected before measurement:** the first C templates used non-stop words such as *dice* and *historia*, which are absent from the synthetic vocabulary, so AND semantics produced zero matches. The scaffolding was changed to stop words only.

**D degeneracy (also present in PO-048's adversarial set):** in X1, X3, X6 and X9, V[4] unaccents to the stop word *lo*, so those queries reduce to one lexeme (`numnode` 1).

## 11. Supplementary synthetic distributions

| | A governing | B | C | D |
|---|---|---|---|---|
| Chunks | 17,780 | 17,691 | 17,691 | 17,780 |
| Average `tsv` size / lexemes per chunk | 2,417 B / 175 | 1,499 B / 81 | 1,499 B / 81 | 2,417 B / 175 |
| Heap / TOAST | 7.3 MB / 43.1 MB | 31.4 MB / 0.25 MB (inline already) | same as B | same as A |
| Most frequent query: matches (% of chunks) | 9,855 (55.4%) | 1,183 (6.7%, OR) | 1,586 (9.0%, OR) | 10,371 (58.3%, OR) |
| Matching books for matching queries | 10 | 10 (rare: 4) | 1–10 | 4–10 |

**End-to-end** (production service, real MinIO and S2 worker, n = 100 per session; ms):

| Set | Configuration | p50 | **p95** | p99 | Ranking SQL p95 | S2 p50 / p95 | Contract identical | PostgreSQL CPU (ms) |
|---|---|---|---|---|---|---|---|---|
| B | production | 56 | **104** | 117 | 66 | 29 / 52 | ✔ | 3,458 |
| B | hybrid200 | 54 | **112** | 139 | 70 | 29 / 58 | ✔ | 3,204 |
| B | C1 thresh200 | 56 | **98** | 108 | 30 | 31 / 65 | ✔ | 2,660 |
| C | production | 57 | **115** | 167 | 64 | 28 / 56 | ✔ | 4,879 |
| C | hybrid200 | 55 | **114** | 152 | 67 | 34 / 60 | ✔ | 4,273 |
| C | C1 thresh200 | 57 | **90** | 94 | 29 | 32 / 62 | ✔ | 3,869 |
| D | production | 557 | **1,002** | 1,029 | 917 | 69 / 106 | ✔ | 71,221 |
| D | inline storage | 413 | **837** | 872 | 743 | 70 / 100 | ✔ | 58,949 |
| D | hybrid200 + inline | 167 | **798** | 821 | 695 | 67 / 102 | ✔ | 45,176 |
| D | **C1 + inline** | 147 | **211** | 236 | 141 | 63 / 90 | ✔ | 22,116 |

B and C use storage that is already effectively inline, because their vectors are small.

## 12. Governing benchmark results, unchanged

| Session (Distribution A) | Configuration | p50 | **p95** | p99 / max |
|---|---|---|---|---|
| NEM-023 suite, session 0 (fixture build) | production | 362 | **795.8** | max 896 |
| e2e 1 | production | 136 | **573** | 614 |
| e2e 2 | production | 122 | **496** | 563 |
| e2e | inline storage (clone) | 146 | **411** | 448 |
| e2e | hybrid200 + inline | 126 | **309** | 371 |
| e2e | C1 thresh200, production storage | 120 | **371** | 402 |
| e2e 1 / 2 | **C1 thresh200 + inline** | 128 / 135 | **256 / 268** | 291 / 288 |

**E-1 on the governing benchmark: FAILED in every configuration** (target ≤ 150 ms).

**Host variance:** this session's host was slower than PO-048's. Production Q0 SQL took 496–539 ms vs 300 ms. The S2 phase p50 was ≈ 57 ms vs ≈ 40 ms, and p95 85–96 ms. Comparisons are within-session only.

**Per-query p50 with C1 + inline** (ms):

| Query | Q0 | Q1 | Q2 | Q3 | Q4 (AND) | Q5 (OR) | Q6 (phrase) | Q7 | Q8 | Q9 |
|---|---|---|---|---|---|---|---|---|---|---|
| p50 | 147–152 | 98–110 | 86–90 | 92–104 | **256–268** | 127–147 | **153–157** | 123–142 | 22–31 | 142–143 |

Even selective queries sit at 90–140 ms in this session, because of the S2 floor plus fixed overheads.

## 13. Query-frequency and selectivity comparisons

### 13.1 Token frequency per million tokens

| Governing query | Frequency | | Distribution B query | Frequency |
|---|---|---|---|---|
| Q0 | **4,413** | | B0 (top content term) | **279** |
| Q4 terms | 2,417 / 2,300 | | B1 (rank 10) | 272 |
| Q6 terms | 3,443 / 3,142 | | B2 (rank 100) | 212 |
| Q1 | 1,157 | | B3 (rank 1000) | 67 |
| Q5 terms | 705 / 213 | | B9 (rank 3000) | 26 |
| Q2 | 332 | | | |
| Q3 | 122 | | | |
| Q7 | 76 | | | |

### 13.2 Chunk selectivity

| Distribution | Range of chunks matched |
|---|---|
| A | 0–55% (four queries ≥ 13%) |
| B | ≤ 6.7% |
| C | ≤ 9.0%; multi-term questions 0–0.12%, because AND semantics makes natural questions very selective |

### 13.3 Required conclusions

1. **Does the governing benchmark disproportionately emphasize extremely frequent terms?** **Yes.**
   - Q0 is ≈ 16× B's top content term and ≈ 2–9× the estimated frequency of the most frequent real Spanish content stems.
   - Q4 and Q6 combine two such terms.
   - The vocabulary has no stop words, and there are only 6,000 word types.
2. **Do such frequencies remain plausible for legitimate questions?** **Partly.**
   - Q1 (1,157 pm) is within the estimated range of top Spanish content stems.
   - Q0-like concentration is plausible for **a protagonist's name or a book's central theme within its own book** ("Sancho" in *Don Quijote*). Such terms are not stop words and can appear in most chunks of that book.
   - Across a ten-book library, though, a single term matching 55% of **all** chunks is atypical.
   - This is **estimated / untested**, since no user or real-corpus measurement was made.
3. **Is 150 ms met under any supplementary distribution?** **Yes for B and C, even with today's production SQL** (104 / 115 ms). **No for D** (best exact 211 ms) **and no for A.**
4. **Would passing supplementary tests change the architectural recommendation?** **Not by itself.** E-1 is defined on A. Production already passes B and C, so they cannot discriminate between candidates. C1 still improves tail latency (B 104 → 98, C 115 → 90) and cuts PostgreSQL CPU by 21–23%. C1 remains the strongest exact direction for the frequent-term tail, which real names and themes may produce.
5. **Evidence needed before proposing a benchmark revision:**
   - (a) term-frequency and chunk-selectivity profiles from **licensed or public-domain Spanish and English books**, measured through the production indexer (no customer text), including names and central themes;
   - (b) an anonymized, consented distribution of real research-question shapes (term count, operators, stop-word share) once a pilot exists;
   - (c) a PO-approved method for mapping these to a revised mix;
   - (d) explicit retention of an adversarial tail criterion.

   Until then, Distribution A governs.

## 14. Additional exact candidates examined

Two candidates were examined, selected from the PO-048 and PO-049 plans. PO-048's settings, early-limit and storage experiments were not repeated.

### 14.1 C1: exact threshold pruning with an occurrence-count upper bound (`thresh<M>`)

**Hypothesis.** Exact `ts_rank_cd` is expensive per call, but its value is bounded by a cheap, exact count.

**Mechanics.**
- For each matching row, S = Σ over the query's **distinct** operand lexemes of the lexeme's stored count.
- Each count is recovered **exactly** as `width_bucket(ts_rank(tsv, 'lexeme', 32), F)`, where F = [f(1)…f(255)] is the strictly increasing table from §6.3.
- Score exactly the M rows with the largest S, and let θ be the K-th best exact rank among them.
- Score exactly every other row whose bound can reach θ: `S ≥ ⌈θ/(1−θ)/0.1 × 0.9999⌉`. If θ ≥ 0.998, score all rows.
- Apply the production ORDER BY/LIMIT to the union.

**Why exact** (preconditions P-W, P-Q, P-M, P-T, P-V; P-P not needed):
- **Bound:** each cover contributes `Cpos/(1+nNoise)`. With uniform D weights, `Cpos` = 0.1 (to float8 rounding) and `1+nNoise ≥ 1`. Covers have distinct start entries, and doc entries ≤ S after merging duplicates. Hence `Wdoc ≤ 0.1·S`.
- **Monotonicity:** norm 32 and the float4 cast are monotone.
- **Slack:** the 10⁻⁴ relative slack exceeds the float4 (≤ 1.5 × 10⁻⁵ relative at θ ≤ 0.998) and float8 effects by more than 6×. Slack only adds candidates.
- **Pruning is safe:** K rows with rank ≥ θ already exist, so a row whose bound is below θ cannot enter the top K. Ties at θ have bound ≥ θ and are scored.
- **Positionless entries:** these only over-count S, which is safe.
- **Exact cases:** for single-lexeme and pure-OR queries, the bound is exact (every occurrence is its own cover, with `nNoise` 0).

**Structures:** none new. It needs the constant F (255 float4 values; derived at run time or verified at startup) and SQL using `width_bucket`, `regexp_matches` over `q::text` to list operand lexemes, and the existing PK index.

**Costs:**

| Cost type | Amount |
|---|---|
| One-time | SQL text change plus tests (no schema) |
| Recurring | none |
| With inline storage | the PO-048 one-time table rewrite (heap 7 → 48 MB, TOAST 43 → 2 MB) |

### 14.2 C2: C1 plus a minimal-window conjunction bound (`andb<M>`)

**Hypothesis.** For a pure conjunction of m distinct lexemes, every cover is a minimal window containing all m lexemes. Any position lies in at most m minimal windows: the start lexemes of windows containing a position are pairwise distinct, by minimality. Hence `NExtent ≤ m·n_min`, a tighter bound than S.

**Exactness.** Sound under the same preconditions plus pure-AND detection, which uses a `q::text` pattern; other trees use the C1 bound.

### 14.3 Supporting measurement: the per-call fixed cost of `ts_rank_cd`

Measured on 20,000 two-lexeme vectors, which removes data size from the comparison:

| Function | Per call |
|---|---|
| `length` | 0.6 µs |
| `ts_rank` | 0.13 µs over `length` |
| `ts_rank_cd`, 1 operand | **23 µs** |
| `ts_rank_cd`, `a & b` | **54 µs** |
| `ts_rank_cd`, `a \| b` | **61 µs** |

The cost tracks `query->size × 32 KB` zero-filled per call (tsrank.c:876–877), not the document.

## 15. Performance and correctness of the candidates

**Server execution, p50 ms, governing set A** (inline clone; production-storage figures in brackets):

| Query (matches) | base | hybrid200 | **C1** | C2 |
|---|---|---|---|---|
| Q0 single (9,855) | 237 [539] | 36 [209] | **36** [313] | 45 |
| Q1 single (3,399) | 109 [158] | 17 [91] | **24** [223] | 18 |
| Q4 AND (2,322) | 142 [115] | 148 [155] | **130** [270] | 178 |
| Q5 OR (4,224) | 242 [200] | 252 [366] | **47** [363] | 32 |
| Q6 phrase (42) | 96 [67] | 106 [64] | **102** [64] | 82 |
| **All-query wall p95** | 257 [472] | 237 [338] | **143** [439] | 151 |
| **Full-precision identical** | – | ✔ | ✔ | ✔ |

**Plan evidence:**
- **C1 on production storage, Q0:** the cheap pass is 216 ms, almost all of it the TOAST fetch for 9,855 rows (27,427 TOAST buffers). The exact rest pass scores **0** extra rows. So C1 needs inline storage to pay off.
- **C1 inline, Q4:** the cheap pass takes 14 ms for 2,322 rows, but the rest pass still scores 2,122 rows exactly (114 ms). AND scores sit far below the bound because of `nNoise`.
- **C2 inline, Q4:** also scores 2,122 rows (**no pruning**).
- **Q6:** cost is dominated by `@@` phrase recheck, which is candidate matching rather than ranking (42 final matches).
- **No temporary files or spills** in any variant.

**Correctness:** identical at full precision for all queries, at topK 1/8/20, and through the end-to-end contract (§7–§8).

**Repeatability:**

| Comparison | Spread | Assessment |
|---|---|---|
| C1 + inline, two sessions | 256 vs 268 ms (±2.3%) | – |
| Production, two sessions | 496 vs 573 ms (±7%) | – |
| C1 + inline vs hybrid + inline | 256–268 vs 309 ms | Gain exceeds session variance |
| C1 + inline vs inline-only | 256–268 vs 411 ms | Gain exceeds session variance |

**Stop condition reached:**
- **C1** is exact and is the best measured, but does not meet E-1 on A or D.
- **C2** gives no gain.
- No further exact remedy was established within PO-049's bounds. This is **not** a claim that an exact ≤ 150 ms solution is impossible.

## 16. Database memory, CPU and storage considerations

**Storage (inline clone vs production):** heap 7.3 → 48.3 MB, TOAST 43.1 → 2.2 MB. That is net ≈ neutral, plus a one-time rewrite under an exclusive lock.

**Buffer cache:** the hot heap grows into PostgreSQL's default 128 MB `shared_buffers`. This is acceptable for one 10-book set. **Scaling to many libraries needs measurement.**

**PostgreSQL CPU per 100-request session (A):**

| Configuration | CPU (ms) |
|---|---|
| Production | 21,793–22,408 |
| Inline | 20,735 |
| Hybrid + inline | 15,626 |
| C1 + inline | 13,633–13,654 (**−38%**) |

On D: 71,221 → 22,116 (**−69%**).

**Memory:** C1 materializes ids and counts only, not vectors. There is no `work_mem` spill.

**SQL complexity:** five CTEs and per-branch correlated subqueries. The plan was stable across all queries, but it is more complex to maintain than `RANK_SQL`.

## 17. Comparison of all relevant options

| Option | Exact? | Governing E-1 p95 | Decision class | Notes |
|---|---|---|---|---|
| Current exact ranking | – | 496–573 (this session); 369–387 (PO-048) | – | Fails |
| Inline `tsv` storage | **Yes** (fingerprints and full precision) | 411 | **Database decision** (migration and rewrite) | Small, reversible (`SET STORAGE EXTENDED` + rewrite) |
| Single-lexeme hybrid | **Conditionally exact** (P-Q/W/P/M/T/V) | 309 with inline | Preserves contract if the preconditions are protected | Helps Q0/Q1 only |
| **Combined exact package = inline + C1** (subsumes the hybrid) | **Conditionally exact** (P-Q/W/M/T/V) | **256–268** | Database decision (inline) + SQL change | Best measured. Bounded by Q4 (AND), Q6 (phrase) and the S2 floor (p95 85–96 ms this session) |
| C2 conjunction bound | Conditionally exact | no gain over C1 | – | Not recommended |
| Two-stage approximate ranking | **No** (PO-048: recall@8 0.13, top-1 missed on X0/X2) | ≈ 112 (PO-048 session) | **Relevance-policy decision** | Faster results that lose citations are not an equivalent implementation |
| Benchmark or criterion reconsideration | – | B 104 / C 115 already pass | **Performance-standard decision** | Needs the §13.4 evidence |
| Larger architectural alternative | Possibly | Not measured | **Database / infrastructure decision** | (a) application-side bit-exact `ts_rank_cd` over fetched positions: no new service, high correctness risk; (b) a PostgreSQL engine change or extension (none authorized); (c) a dedicated search engine (excluded by cost rules). An S2 floor reduction would touch the S2 worker, in a separate scope |

**Classification by decision type:**

| Decision type | Options |
|---|---|
| Preserve the original contract | Inline storage; hybrid and C1 (under protected preconditions) |
| Require a relevance-policy decision | Two-stage / caps |
| Require a performance-standard decision | Benchmark or criterion revision |
| Require a database or infrastructure decision | Inline migration; engine change; application re-implementation; new engine |

## 18. Relevance and citation-quality risks

**Exact options:** within their preconditions there is no relevance or citation change. Results are bit-identical, citations and offsets are identical, and the whole `retrieve()` result hash is identical.

**Risk 1: preconditions erode.** Examples are a future weighted indexer (`setweight`) or a switch from `websearch_to_tsquery`. These silently turn an exact path lossy, as CX-1..CX-3 show. **Any implementation must protect P-Q, P-W and P-M with guards and with the regression fixture.**

**Risk 2: the approximate option.** Two-stage ranking keeps the PO-048 measured losses: recall@8 as low as 0.13, and the top citation missed on OR queries.

## 19. Q-11 and large-book risk implications

**No production change was made, so no Q-11 requalification was run, and none is claimed.**

**Direction of the effects if implemented:**
- PostgreSQL CPU per retrieval falls 38–69%, which lowers database contention with reader endpoints. That favors Q-11.
- The API event loop is unaffected. The S2 path, API memory and worker queueing are unchanged.
- Research admission and completion improve with lower retrieval latency.
- The ten-book requirement is unchanged.
- The inline rewrite increases heap pages in the buffer cache (§16).

**Required gates for any implementation authorization:**
- a full Q-11 regression, because the narrowest margin is 1.8 ms at W=10 `p3x3`;
- E-1 requalification;
- the large-book memory limitation, which stays **open** and is not addressed by any option here.

## 20. Recommendation and alternative

**Technical conclusion:**
- The single-lexeme hybrid is **conditionally exact**, with proof plus exhaustive and differential evidence.
- C1 generalizes it to all query shapes exactly and prunes single-term and OR queries almost completely.
- Exact AND and phrase ranking remain bounded by `ts_rank_cd`'s fixed per-call engine cost.
- The best exact configuration measured on the governing benchmark is **256–268 ms**. **No genuinely exact strategy meeting E-1 on Distribution A was identified.**
- On the supplementary distributions B and C, production already meets E-1.

**Architectural recommendation:** the smallest defensible next direction is the **exact package**:
- the inline `tsv` storage migration;
- C1 threshold ranking in `RANK_SQL`, which supersedes the hybrid;
- protected preconditions: SQL guards for P-Q and P-M, an indexer invariant test and the counterexample fixture as a permanent regression, and a startup check of F;
- a PostgreSQL-upgrade gate.

This improves the governing tail by ≈ 35–50% and database CPU by 38–69%, with no recurring cost. **It does not close E-1 on its own.**

**Alternative:** keep current ranking and decide the performance standard (§13.4) first, deferring the migration.

**Product decision required:** whether to accept continued E-1 failure on the governing AND/phrase tail; or authorize evidence gathering for a benchmark revision; or authorize an architectural study. These are listed in §21 and are **not selected here**.

**Execution authorization (separate follow-on mission, not created):**
- a migration setting `ai_book_chunks.tsv` `STORAGE MAIN` with a rewrite;
- a `RANK_SQL` change to C1;
- guards, tests and the regression fixture;
- E-1 requalification plus Q-11 regression.

## 21. Exact follow-on decisions required

**D-1 Exact package:** authorize, or decline, a bounded implementation mission for inline storage + C1 + protected preconditions + requalification.

**D-2 AND/phrase tail and the standard.** Choose one or more:
- (a) accept that governing E-1 remains failed for exact ranking and record it as an exception;
- (b) authorize collecting the §13.4 evidence toward a possible benchmark or criterion revision (governing benchmark unchanged until then);
- (c) authorize an architectural study of exact AND/phrase scoring (application-side bit-exact re-implementation, or an engine-level option);
- (d) a relevance-policy decision on approximate ranking. This is not recommended, given the PO-048 citation losses.

**D-3 S2 floor:** whether to investigate the ≈ 57–60 ms (p50) S2 phase, which caps every matching query. That is a separate scope touching the S2 worker.

## 22. Confidence and limitations

| Conclusion | Confidence | Basis / limitation |
|---|---|---|
| Hybrid conditionally exact | **High** | Source audit + exhaustive domain enumeration + 9,408 differential cases. Limited to PostgreSQL 16.13 x86-64 musl |
| C1 exact under preconditions | **High** | Bound proof + 3,171 + 1,134 differential cases + contract equality. The proof relies on the uniform-weight invariant |
| C1 performance gain | **Medium-high** | Two sessions, gain ≫ variance. Single shared VM, host slower than PO-048 |
| AND/phrase limit is the engine fixed cost | **High** | Microbenchmark + source |
| Representativeness | **Low-medium** | Synthetic Zipf model; estimated real frequencies; no user data |

**Further limitations:**
- Uncapped database container.
- n = 100 per session.
- D's degenerate stop-word cases.
- B/C phrase queries had no matches (independent-token model).
- C2's bound is sound but was tested only on synthetic data.

## 23. Raw evidence references

`docs/reports/2026-11-11-NEM-024-po-049-e1-architecture-validation-raw-measurements.json` (≈ 186 KB, content-free). It holds every JSON result:

| Group | Contents |
|---|---|
| `rankfn` | Rank-function audit |
| `prop-*`, `prop2-*` | Property runs |
| `counterexamples` | Regression cases |
| `info-A/B/C/D` | Selectivity per set |
| `sql-*` | SQL-level comparisons |
| `e2e-*` | End-to-end sessions |
| `build-b` | Distribution B corpus build |
| Governing suite session 0 | Plan text removed |

The source audit references `REL_16_13` file and line locations (§5).

## 24. Reproduction instructions

1. Start `postgres:16-alpine`, `redis:7-alpine` and `minio/minio` on 127.0.0.1 (ports 55432 / 56379 / 59000).
2. Run the NEM-023 suite with `NEM023_PERF=1 NEM023_PERF_KEEP=1`. This produces Distribution A plus session 0.
3. `CREATE DATABASE po049_prop_test`, then run `e1-arch-diag.ts rankfn`, `prop <seed> <rows> [violate]` (seeds above; `PROP_VARIANTS` for the second batch) and `counterexamples`.
4. Inline clone: `CREATE DATABASE po049inline_test TEMPLATE nem019_test`, then `ALTER TABLE ai_book_chunks ALTER COLUMN tsv SET STORAGE MAIN`, `UPDATE … SET tsv = (tsv::text)::tsvector` and `VACUUM FULL ANALYZE`.
5. `CREATE DATABASE po049_b_test`, then run `build-b`.
6. Run `info|sql|e2e <A|B|C|D> <base|hybrid200|thresh200|andb200>` against the corresponding DB (A/D: `nem019_test` or `po049inline_test`; B/C: `po049_b_test`). For PostgreSQL CPU, read the container's `cpu.stat` `usage_usec` before and after each session.

## 25. Cleanup confirmation

- The `po049-pg` container, with all its databases (`nem019_test`, `po049_prop_test`, `po049inline_test`, `po049_b_test`), plus `po049-redis` and `po049-minio`, was **stopped and removed**: 0 `po049` containers remain.
- No temporary index, setting or clone persists.
- The scratch source checkout of PostgreSQL files lives only in the session scratchpad.
- No unrelated container was touched.
- `services/api/src` is unchanged since `689cdb3` (and since PO-047's `d007049`).

## 26. PA review status and mandatory STOP

| Item | Status |
|---|---|
| PA review | **AWAITING** |
| PO decision | **AWAITING** (D-1..D-3) |
| E-1 | **OPEN** |
| Q-11 | Conditional development acceptance; risks retained; not production-qualified |
| Checkpoint E | **NOT QUALIFIED** |
| Release | **BLOCKED** |
| PR #56 | Draft, unmerged, base unchanged |

Nothing was deployed or activated, and no PO-050 or new mission was created. **STOP.**
