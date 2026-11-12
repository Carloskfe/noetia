# NEM-024 PO-051 — E-1 Plan Stability and Workload-Class Architecture Validation

**Mission:** NEM-024 · **Authorization:** [PO-051](../operating-framework/decisions/product-owner/PO-051-nem-024-e1-plan-stability-and-workload-class-validation-authorization.md), bounded diagnostic and architecture validation only · **Executed:** 2026-11-12 · **Agent:** Claude Code
**Branch / PR:** `feat/nem-024-checkpoint-b` · Draft PR #56
**Raw evidence:** [`…-raw-measurements.json`](2026-11-12-NEM-024-po-051-e1-plan-stability-and-workload-class-validation-raw-measurements.json)
**Tools (test only):**
- [`e1-plan-diag.ts`](../../services/api/tests/perf/e1-plan-diag.ts) (new);
- [`e1-literary-diag.ts`](../../services/api/tests/perf/e1-literary-diag.ts) (manifest-configurable);
- [`e1-arch-diag.ts`](../../services/api/tests/perf/e1-arch-diag.ts) (unchanged; used for governing end-to-end runs).

> **E-1 remains OPEN. The governing benchmark, its 150 ms threshold and the protected `ginUsed` assertion are unchanged.** Every recommendation is **UNAPPROVED**.

---

## 1. Executive summary

**Investigation A — plan stability (P-3).** Verdict: **environment- and statistics-sensitive behaviour arising from expected cost-based planning.** It is *not* an indexing or query defect.

**What the measurements show:**

- **How the GIN cost estimate depends on maintenance state.** The planner's cost estimate for the GIN index depends on whether a `VACUUM` has run since the bulk insert:

  | State | GIN Bitmap Index Scan startup cost |
  |---|---|
  | No vacuum since the bulk insert | 880 |
  | Vacuum part-way through the insert | 506 |
  | After a full vacuum | 18 |

  The sequential-scan alternative costs **1,155.7**. The planner does not price detoasting, so a sequential scan looks cheap on this fixture: its main heap is only 889 pages, because 82% of its vectors are TOASTed.
- **Which queries switch.** Before vacuum, Q0, Q4, Q5 and Q6 switch to a sequential scan. That scan is **1.8–3.5 times slower** in SQL than the GIN plan, because it decompresses every vector: 16,900–26,600 TOAST blocks against 2,400–9,700.
- **The protected probe's margin.** In the no-vacuum state the probe picks GIN by **13 cost units (1.1%)**: 1,142.8 against 1,155.7. In PO-050's state, identified by the same 612-of-889 all-visible fingerprint reproduced here, the margin was lost.
- **Effect on E-1.** The plan regime moves **p50 by about 3 times** but **does not decide E-1**:

  | Regime | p50 | p95 |
  |---|---|---|
  | GIN steady state | 113–124 ms | 509.5–530.6 ms |
  | Pre-vacuum default | 397 ms | 868.6 ms |
  | PO-050's mixed state | n/a | 569.6–578.5 ms |

  **Q0 (about 430–510 ms) fails E-1 in every regime.**

**Investigation C — near-limit authentic cohort (P-2).** The feasibility gate passed:

- **Cohort:** ten public-domain Spanish works of **10,857,847 code points and 9,548 chunks**. That is **54% of the governing fixture**, against 37% in PO-050. No TOAST at all.
- **Three sessions, 351 requests:**

  | Measure | Result |
  |---|---|
  | p50 | 35.5–37.5 ms |
  | **p95** | **127.1–133.5 ms** |
  | p99 | 210.9–213.8 ms |
  | Over 150 ms | **12 / 351 (3.4%), all adversarial** |

- **Over-150 detail:** the three-way OR failed in 9 of 9 runs; the honorific and top-verb terms failed occasionally.
- **Typical categories:** p95 ≤ 127.1 ms (cross-book research was worst).
- **Adversarial class:** p95 **210.9–213.8 ms**.
- **Size effect:** from PO-050 to this cohort (1.5 times the chunks), the adversarial p95 doubled and the typical worst category rose 1.5 times.
- **Full-size estimate (not measured):** typical frequent cross-book queries would sit around **150–200 ms**, and adversarial queries around **350–400 ms**.

**Investigation B — workload classes (P-1).**

- Typical and adversarial behaviour differ by about **2 times** on authentic text, so classes are *describable*.
- A defensible typical-load standard is **not yet** supportable. It needs real library-size and query-mix facts, and at governing size even typical queries are estimated near 150 ms.
- **The adversarial class fails today under every framework.** Introducing classes would not unblock release on its own.

**Recommended next PO decision (UNAPPROVED):**

- **Primary:** keep E-1 unchanged. Authorize a **diagnostic re-evaluation of the deferred exact C1 ranking on the authentic near-limit cohort.** C1 targets exactly the failing class: high-frequency single-term and OR scoring.
- **Fallback:** authorize evidence-gathering for a workload-class policy, as listed in §13.

## 2. Preflight and scope verification

| Check | Result |
|---|---|
| Remote fetch; head `b9828557…` = expected | ✔ |
| PR #56 open, Draft, unmerged, base `feat/nem-024-checkpoint-a` | ✔ |
| Working tree clean (untracked `node_modules` only) | ✔ |
| `PO-051` unused (register, remote refs, history) | ✔ |
| PO register, NEM-024 mission, PO-048/049/050 records, reports and raw evidence read | ✔ |
| NEM-023 suite and protected assertions (`ginUsed`, index-size budget, max < statement timeout) read | ✔ |
| `RANK_SQL`/`STATUS_SQL`, migration 075 (partial GIN `WHERE language = '<lang>'`, default `fastupdate`, `unaccent` configurations) read | ✔ |
| Resources: 6 vCPU, 7.2 GiB (about 5 GiB available), 50 GB free disk; container names `po051-pg` / `po051-minio` free; 14 unrelated containers left untouched | ✔ |

Governance record: `d73bbb1`.

## 3. Starting and ending commits

**Start:** `b9828557466e7d5a63997283a60f472452b5d59b`.

| Commit | Content |
|---|---|
| `d73bbb1` | governance |
| `373161e` | plan tool, near-limit manifest and **frozen query manifest (predeclaration)** |
| final commit | report, raw evidence, concern D13, statuses |

The ending commit is stated in the PR and the final message.

## 4. PostgreSQL configuration and fixture

**Server:** `postgres:16-alpine`, **PostgreSQL 16.13**, in one disposable container with **default settings**:

| Setting | Value |
|---|---|
| `shared_buffers` | 128 MB |
| `random_page_cost` | 4 |
| `seq_page_cost` | 1 |
| `cpu_tuple_cost` | 0.01 |
| `cpu_operator_cost` | 0.0025 |
| `effective_cache_size` | 4 GB |
| `gin_pending_list_limit` | 4 MB |
| `default_statistics_target` | 100 |
| autovacuum | on, 1 min naptime, insert threshold 1,000 + 20% |
| `plan_cache_mode` | auto |

The full list is in the raw `state-*` files.

**Fixtures.** Each was built by the **unchanged** NEM-023 suite (10 × 2,000,000 code points, real MinIO):

| Database | Condition | Status |
|---|---|---|
| `nem019_test` | **default**, autovacuum on | governing condition |
| `nem019b_test` | autovacuum disabled on `ai_book_chunks` before the inserts, to observe the post-ANALYZE, pre-VACUUM state deterministically | **diagnostic** |
| `nem019c_test` | as above, plus one `VACUUM` issued when 12,436 rows (7 of 10 books, about 70%) were committed, reproducing PO-050's mid-insert-autovacuum state | **diagnostic**, the one additional justified condition |

**Each fixture:** 17,780 chunks; heap 889 pages (7.3 MB); TOAST about 43 MB; GIN `es` index 1,445 pages. The average `tsvector` is 175 lexemes and 2,417 B, with 82% of vectors TOASTed.

**Parameters:** all ten (book, hash) pairs are allowed and topK is 8. The terms are synthetic and represented only by query ids.

## 5. Protected `ginUsed` failure reproduction

The suite's probe is `EXPLAIN SELECT id … WHERE language = 'es' AND tsv @@ websearch_to_tsquery(…, <Q3 term>)`, with no allowed-set join.

| Run | State at probe time | Probe plan (cost) | `ginUsed` | Suite p95 |
|---|---|---|---|---|
| PO-049 | (not recorded) | GIN | true | 795.8 |
| **PO-050** | mid-insert autovacuum (relallvisible 612/889) | **Seq Scan 0..1155.70** | **false** (suite failed) | 598.2 |
| PO-051 default (`nem019_test`) | autovacuum completed at the probe (12:54:19) | Bitmap 17.53..277.39 | true | 840.3 |
| PO-051 C0 (`nem019b_test`) | no vacuum | Bitmap **880.30..1142.79** vs Seq 1155.70 | true, by 1.1% | 834.0 |
| PO-051 C3 (`nem019c_test`) | mid-insert VACUUM (relallvisible **612**/889) | Bitmap 506.28..768.77 | true | 784.0 |

The failure was **not reproduced on demand**, but its mechanism is bracketed. The probe's GIN cost depends on the vacuum and pending-list state at probe time: it ranged from 18 to 880 across these runs, and the sequential scan wins once it exceeds about 893. PO-050 matched C3's all-visible fingerprint exactly; a fuller GIN pending list at its probe moment is the consistent explanation (§6).

## 6. Plan and statistics analysis

**Factors and whether they mattered in this database:**

| Factor | Finding | Material? |
|---|---|---|
| GIN partial-index applicability | `WHERE language = 'es'` matches the query predicate; forced plans always use `IDX_ai_book_chunks_tsv_es` | no defect |
| Language and eligibility predicates | allowed-set join is a Hash Join on a 10-row CTE; never chosen as the index driver | no |
| **GIN metapage statistics and pending list** | **Bitmap Index Scan startup cost 880 (no vacuum) → 506 (mid-insert vacuum) → 18 (after VACUUM).** VACUUM flushes the fastupdate pending list and refreshes the statistics `gincostestimate` relies on | **yes, decisive** |
| `ANALYZE` refresh | C1 → C2: no plan or cost change | no |
| Autovacuum timing | determines which of the states above holds when a query is planned; a vacuum during the bulk insert leaves a partial state (5,344 rows inserted since vacuum) | **yes** |
| Estimated vs actual rows | Q0 9,798 vs 9,855 and Q4 2,246–2,260 vs 2,322 are accurate (terms in `most_common_elems`). Q3, Q8 and the probe estimate 89 against actual 415 / 0 / 415 (term not in the MCELEM list, so the default selectivity is used). Q6 estimates 3,597–3,618 against **42** (phrase treated as AND) | estimates do not drive the flip; Q3's 4.7× underestimate only makes GIN look *more* attractive |
| Bitmap vs sequential scan | sequential cost 1,155.7 = 889 pages + 17,780 tuples × CPU costs; **detoasting is not priced** | **yes**: why the sequential scan *looks* cheap |
| Heap / TOAST access | see §8 | **yes** for latency |
| Correlation / cardinality | not material (bitmap heap scans; small heap) | no |
| Prepared statements, custom vs generic plans | TypeORM/`pg` sends unnamed extended-protocol statements, so every execution is custom-planned with the real query text; `plan_cache_mode = auto` never reaches a generic plan | no |
| Table size / caching | all relations fit in shared buffers; `blksRead` ≈ 0 during sessions | no |
| Cost parameters | defaults; no tuning experiment needed: the observed flip is explained without it | n/a |

## 7. GIN versus sequential-scan evidence

Server execution time, median of 5 `EXPLAIN (ANALYZE, BUFFERS)` runs. "TOAST blocks" counts blocks per plain execution.

| Query (matches) | C0 default plan | C0 default ms / TOAST blocks | C0 forced GIN ms / TOAST blocks | After VACUUM (default = GIN) ms |
|---|---|---|---|---|
| Q0 high-frequency (9,855) | **Seq** | 764 / 26,608 | 433 / 9,711 | 432 (C1) / 462 (C2) |
| Q3 selective (415) | GIN | 16.4 / 415 | 15.5 / 415 | 17.1 / 16.7 |
| Q4 AND (2,322) | **Seq** | 450 / 19,312 | 189 / 2,415 | 154 / 199 |
| Q5 OR (4,224) | **Seq** | 664 / 21,076 | 328 / 4,179 | 318 / 349 |
| Q6 phrase (42) | **Seq** | 311 / 16,938 | 90 / 3,809 | 78 / 61 |
| Q8 no-match (0) | GIN | 1.1 / 0 | 0.6 / 0 | 0.3 / 0.2 |

The sequential scan reads every TOASTed vector to evaluate `@@`, about 17,000–27,000 TOAST blocks per query whatever the selectivity. The GIN plan reads only the matching rows' vectors.

PO-050's sequential scan on Q3 and Q8 (227 ms; no-match floor about 222 ms) is the same effect at lower selectivity.

## 8. TOAST and ranking-cost analysis

**In the GIN regime the remaining cost is per matching row:** detoasting each matching vector plus `ts_rank_cd`.

| Query | Matches | Time | TOAST blocks | Per matching row |
|---|---|---|---|---|
| Q0 | 9,855 | 432–462 ms | 9,711 | about 45 µs |
| Q5 | 4,224 | 318–349 ms | n/a | about 75–80 µs |
| Q4 | 2,322 | 154–199 ms | n/a | about 66–86 µs |

This is the PO-048/PO-049 root cause, and it bounds the governing p95 at about 510 ms in every plan regime.

**Authentic text never TOASTs:** 0 of 9,548 near-limit chunks, at 92–101 lexemes and 1,275–1,418 B per chunk. Its per-row cost is lower; see §15.

## 9. Default versus diagnostic-plan measurements

End-to-end measurements use production `LexicalRetrievalService`, real MinIO and the S2 worker, with no caches. There are 100 requests per session, using the NEM-023 mix ×10.

| Condition | Plans | p50 | p95 | p99 | Ranking SQL p95 | Q0 p50 | Q8 p50 | Contract identical |
|---|---|---|---|---|---|---|---|---|
| D1 default, post-autovacuum, s1 | GIN | 122.6 | **509.5** | 580.2 | 449.6 | 509.5 | 10.0 | ✔ |
| D1 s2 | GIN | 112.6 | **515.3** | 598.7 | 452.2 | 515.3 | 11.0 | ✔ |
| D1 s3 (interleaved with the near-limit runs) | GIN | 124.0 | **530.6** | 596.1 | n/a | n/a | n/a | ✔ |
| C0 default (pre-vacuum) | Seq for Q0/Q4/Q5/Q6 (planned); Q1/Q2 latencies consistent with Seq (not captured) | 396.8 | **868.6** | 923.8 | 793.6 | 868.6 | 19.9 | ✔ |
| C0 forced GIN (`enable_seqscan = off`, diagnostic) | GIN | 124.4 | **540.5** | 642.5 | 469.2 | 540.5 | 12.8 | ✔ |
| C2 after VACUUM + ANALYZE | GIN | 114.2 | **510.0** | 560.8 | 440.6 | 510.0 | 9.9 | ✔ |
| PO-050 (mid-insert state; reference) | Seq for Q0/Q3/Q4… | 305.8–312.8 | 569.6–578.5 | 596–610 | 511–513 | 570–579 | 221–222 | ✔ |

**Instrumentation overhead:**

- **EXPLAIN:** `EXPLAIN ANALYZE` with timing, with `TIMING OFF`, and plain execution agree within run-to-run noise (for example Q0 under D1: 447 / 308 / 423 ms).
- **Fixed overhead:** plain client wall time adds about 4–6 ms of round trip and transaction overhead, visible on Q8 (0.2 ms server against 6.5 ms wall).
- **Correctness:** results are byte-identical in every regime (`contractIdenticalAll`). The plan changes cost, never ranking.

## 10. Root-cause classification and confidence

**Classification: environment- and statistics-sensitive behaviour, from expected cost-based planning on a TOAST-heavy fixture.**

| Statement | Evidence | Confidence |
|---|---|---|
| The flip is driven by GIN maintenance state (pending list and metapage stats) relative to the bulk insert, and so by autovacuum timing | controlled C0/C1/C3; startup cost 880 / 506 / 18; same data, same SQL | **high** |
| The sequential scan is chosen because the cost model omits detoasting on an 889-page heap carrying a 43 MB TOAST table | cost arithmetic; TOAST blocks 17–27 k for the sequential scan | **high** |
| Not an indexing or query-structure defect | index applicable and used when forced and in steady state; contract identical | **high** |
| PO-050's exact probe state (GIN cost > 893) | fingerprint reproduced (612/889); exact pending fill not reproduced | **moderate** |
| E-1 consequence: the plan regime changes p50 about 3 times, not the E-1 verdict | p95 ≥ 509.5 ms in every regime | **high** |

**Implication for E-1:** plan stability is a real latency risk. Typical-query p50 triples after a bulk load until vacuum. But it is not the reason E-1 fails.

**Smallest justified next action:** none required for E-1. Two items for the PO:

1. a decision on whether the protected assertion should be revised (§22);
2. awareness that bulk index loads are slow until vacuumed.

Any operational remedy, such as a vacuum after indexing, would be a production change and needs separate authorization.

**Protected `ginUsed` assessment (A4):**

- **Validity:** consistently valid for the steady-state fixture, after vacuum.
- **Sensitivity:** sensitive to autovacuum timing at the moment it runs, right after the bulk load and ANALYZE, where it rests on a 1.1% cost margin or fails outright.
- **Scope of the claim:** it asserts a *planner choice*, which is overly restrictive for a pre-vacuum fixture.
- **Not a defect signal:** it does not show a missing index.

**Evidence-backed option** (for PO decision only; *not changed*): assert **index applicability**, meaning the forced plan uses the GIN index, after an explicit `VACUUM ANALYZE` that represents steady state. Planner choice would then be reported informationally.

## 11. Workload-class architecture comparison (P-1)

| | Option 1 — single governing criterion (current E-1) | Option 2 — typical + adversarial classes, each with its own method and future PO thresholds | Option 3 — representative primary criterion + non-negotiable stress safeguard |
|---|---|---|---|
| Advantages | simple; already defined and enforced; strongest protection; no incentive to re-scope | matches observed behaviour (≈2× gap typical vs adversarial); lets UX target and worst-case guard differ | UX-centred headline; keeps a hard guard against slow legitimate queries |
| Risks | the governing fixture is structurally adversarial (TOAST, upper-bound size), so release stays blocked on a synthetic condition; may drive optimization for an unrepresentative case | two thresholds invite bargaining; class boundaries can be gamed (moving queries to "adversarial"); needs class membership rules | "representative" depends on data Noetia does not yet have; the guard's threshold is where weakening pressure concentrates |
| Testability | high (exists) | moderate: needs authentic corpus fixtures, query manifests, freeze discipline (demonstrated in PO-050/051) | moderate, same as Option 2 |
| Maintenance | low | higher: corpus manifests, rights records, query freezes, two suites | higher, same as Option 2 |
| Incentive to weaken | low | **medium–high** unless class rules are fixed in advance | **medium** |
| Status today | **FAILED** (509.5–598.2) | typical: pass at 54% size; **adversarial: FAILED** (210.9–213.8 at 54% size) | primary: unknown at full size (estimated 150–200); **safeguard: FAILED** |

**Key observation:** Options 2 and 3 do **not** unblock release today. The legitimate adversarial queries on authentic text already exceed 150 ms at 54% of the governing size.

## 12. Proposed future benchmark structure (shape only; no thresholds)

If the PO pursues classes, the evidence supports **Option 3's shape with Option 2's discipline**:

1. **Category A (retained): governing synthetic stress fixture**, unchanged, as regression protection against TOAST-heavy and very large corpora.
2. **Representative authentic workload**, which must meet all of the following:
   - rights-cleared authentic texts, with corpus manifests and hashes;
   - a declared corpus-size distribution, including a near-limit cohort;
   - predeclared, frozen query categories with expected matching behaviour and reference passages;
   - successful retrievals well represented; no-match controls reported separately;
   - multi-book research requests;
   - at least three independent sessions;
   - environmental variability quantified;
   - resource assumptions stated: the 1-vCPU API cap, PostgreSQL defaults, a post-vacuum steady state;
   - a documented relationship to real user behaviour.
3. **Authentic adversarial class**: frequent names and terms, OR, phrase and multi-term AND at full ten-book size. Membership rules must be fixed **before** measurement, and no query may be moved between classes after results are seen.
4. **A plan-regime statement**: measured in steady state (post-vacuum), with the pre-vacuum regime reported as a separate operational risk.

## 13. Evidence required for performance-policy decisions

Missing facts that prevent a defensible typical-load standard today:

1. **Library-size distribution.** How large real NoetiaX ten-book libraries are. Catalogue metadata (book lengths) can answer this without customer data.
2. **Query-mix distribution.** The share of names, themes, phrases, cross-book questions and question-form queries. This needs consented pilot query *shapes*, not text.
3. **Full-size authentic behaviour.** The 54% cohort is the largest feasible within `maxChunksPerBook` and the ten-book limit (§14). Behaviour at 100% remains an extrapolation.
4. **Behaviour on the target runtime.** Capped API container, concurrent reader load (Q-11 interaction).
5. **Retrieval-quality interplay (D13).** A question-interpretation change would alter both matching volume and latency.

## 14. Authentic-corpus size feasibility (C1 gate)

**Candidate search.** Bounded: 22 named long public-domain Spanish novels already identified from the Gutenberg catalogue in PO-050, sized by HTTP `Content-Length` only, with no text downloaded.

**Constraints:**

- ten books;
- `maxChunksPerBook = 2,000` (about 2.27 M code points per book; *Fortunata y Jacinta* excluded, and the limit was not changed);
- public domain in the US and Spain (Pío Baroja, died 1956, excluded);
- at most two works per author;
- no padding.

**Result: FEASIBLE** at **10,857,847 code points and 9,548 chunks.**

| Measure | Value |
|---|---|
| Share of the governing fixture's code points | 54.3% |
| Share of its chunks | 53.7% |
| PO-050 cohort, for comparison | 36.6% |
| Gain from dropping the per-author cap | about 0.07 MB, negligible |

A size-equal authentic ten-book cohort is **not feasible** under the chunk cap with existing public-domain Spanish works.

**Cohort (corpus manifest `po051-corpus-manifest.json`):**

| ID | Work | Author | Code points | Chunks |
|---|---|---|---|---|
| N01 | *Don Quijote* | Cervantes | 2,148,374 | 1,897 |
| N02 | *La Regenta* | Clarín | 1,795,253 | 1,560 |
| N03 | *Los argonautas* | Blasco Ibáñez | 1,245,391 | 1,126 |
| N04 | *Mare nostrum* | Blasco Ibáñez | 890,409 | 780 |
| N05 | *La familia de León Roch* | Galdós | 846,746 | 744 |
| N06 | *La desheredada* | Galdós | 838,575 | 741 |
| N07 | *La Quimera* | Pardo Bazán | 809,653 | 712 |
| N08 | *El cuarto poder* | Palacio Valdés | 766,574 | 668 |
| N09 | *Peñas arriba* | Pereda | 765,399 | 675 |
| N10 | *La espuma* | Palacio Valdés | 751,473 | 645 |

- **Rights:** authors died 1616–1938; every work is public domain in the US (published before 1931) and in Spain (LPI DT 4ª, life + 80, expired by 2019 at the latest).
- **Editorial material removed:** only Gutenberg credit lines, transcriber notes, consolidated indexes and publisher advertisements. Authors' prologues and dedications were kept.
- **Not committed:** no text.

## 15. Near-limit measurements

**Method:** production path unchanged, declared scopes, topK 8 and budget 6,000.

**Query set (frozen in `373161e` before timing; spec sha256 `823ee801…fb73676c`):** 39 queries. 31 are PO-050 definitions kept verbatim for N01/N02; queries tied to works no longer in the cohort were dropped. 8 are new entity queries for the new works.

**Sessions:** seeds 8001–8003, each 3 rounds × 39 queries, interleaved with a governing session.

| Session | n | p50 | p95 | p99 | max | Over 150 | Errors | Empty | Stable |
|---|---|---|---|---|---|---|---|---|---|
| nl-s1 | 117 | 35.5 | **131.4** | 213.8 | 214.4 | 4 | 0 | 7.7% | ✔ |
| nl-s2 | 117 | 36.9 | **133.5** | 211.1 | 234.4 | 4 | 0 | 7.7% | ✔ |
| nl-s3 | 117 | 37.5 | **127.1** | 210.9 | 220.8 | 4 | 0 | 7.7% | ✔ |
| Governing D1-s3 (same window) | 100 | 124.0 | 530.6 | 596.1 | 639.6 | n/a | 0 | n/a | ✔ |

**Stage p95:**

| Stage | p95 (ms) |
|---|---|
| Ranking SQL | 93.8–99.9 |
| Storage reads (sum) | 64–82 |
| S2 verify | 23.4–23.9 |
| S2 phase | 40–45 |

**Session resources:**

- **PostgreSQL CPU:** 2.93–3.06 s per 117 requests, about 25 ms per request, against about 15 ms in PO-050.
- **I/O:** `blksRead` 0–7.
- **Host:** load 1.4–2.6, higher than PO-050's 0.4–1.5 and labelled.

**Plans:** GIN bitmap for every query.

**Usefulness:** citation validity 100%. References found at rank 1: 5 of 6 (SA03 missed again; see D13).

## 16. Corpus-size and lexical-structure effects

| Effect | Evidence | Kind |
|---|---|---|
| 1. Total corpus size | PO-050 (6,385 chunks) → near-limit (9,548; ×1.50): overall p95 81 → 131 (×1.6); typical worst category 86 → 127 (×1.5); adversarial 93–108 → 211–214 (×2.0) | **measured** |
| 2. Lexical diversity | authentic: 92–101 lexemes per chunk, 45–53% stop-word tokens. Governing: 175, 0% | **measured** |
| 3. TOAST storage | authentic 0% of chunks; governing 82% → sequential-scan floor and higher per-row cost | **measured** |
| 4. Query selectivity | frequent authentic terms reach 23–35% of chunks (SE05 2,225; SE01 3,339). Governing Q0 is 55% | **measured** |
| 5. Planner decisions | authentic: GIN everywhere. Governing: maintenance-state-dependent (§5–§9) | **measured** |
| 6. Number of verified books | S2 p95 40–45 ms; up to 4–6 books for cross-book and AND/OR results | **measured** |
| Per-row ranking cost | near-limit EXPLAIN gives about 22–28 µs single-term, 50–64 µs AND, about 70 µs OR, 76 µs phrase, above PO-050's 17 / 39 / 37–46 µs | **measured, cause unresolved** (possible: higher host load, three 66 MB fixtures sharing 128 MB `shared_buffers`, EXPLAIN overhead) |
| Full-size (20 M) projection | ×1.86 more matches at equal selectivity: typical frequent cross-book queries ≈ 150–200 ms; adversarial ≈ 350–400 ms | **extrapolation only** (linear; stable GIN plan assumed) |

PO-050's full-size estimate (185–210 ms for stress queries) **underestimated** what this cohort shows: 211–214 ms already at 54% size.

**Bottom line:** the authentic-text advantage is real (no TOAST, GIN plans), but it **shrinks with size**. It does not by itself establish a full-size pass.

## 17. Typical versus adversarial results

| Class (near-limit, three sessions) | p50 | p95 | p99 | Over 150 |
|---|---|---|---|---|
| Ordinary (60 per session) | 36.8–40.1 | 80.3–89.7 | ≤ 127.1 | 0 |
| Complex (30) | 26.2–29.4 | 38.2–42.1 | ≤ 51.2 | 0 |
| **Typical categories A–D, worst per-category p95** | n/a | **100.3–127.1** (D, cross-book) | n/a | **0** |
| **Adversarial (21)** | 115.9–121.4 | **210.9–213.8** | 220.8–234.4 | **12** |
| Negative controls (6, reported separately) | 10.8–15.1 | 33.6–50.5 | n/a | 0 |

**Requests over 150 ms, by query:**

| Query | Over 150 ms |
|---|---|
| SE05, 3-way OR | 9 / 9 |
| SE01, honorific | 2 / 9 |
| SE07, top narrative verb | 1 / 9 |

These are kept separate. **No favourable aggregate is formed with PO-050.**

## 18. Retrieval usefulness limitations

This was recorded as a **separate product concern**: [D13 in `20-open-product-decisions.md`](../noetia-plus/20-open-product-decisions.md).

- **PO-050:** 7 of 15 question-form queries returned nothing.
- **Near-limit cohort:** 2 of 9 question-form queries returned nothing (SB01, SD02), and the known-location question SA03 missed its passage again.
- **Keyword and phrase forms:** never unexpectedly empty.

Latency results for empty queries are fast because nothing is ranked. Empty results are therefore reported separately and are not counted as evidence of good performance.

No query rewriting, semantic search, fallback or parser change was made.

## 19. Q-11 and large-book risk implications

- **Q-11:** unchanged, with conditional development acceptance and the 1.8 ms margin retained; no requalification. Two observations bear on it:
  - authentic near-limit retrieval used about 25 ms of PostgreSQL CPU per request;
  - the governing pre-vacuum regime raises SQL time 2–3 times. A reader-interference measurement taken during an unvacuumed bulk load would be pessimistic, so Q-11 runs should record vacuum state.
- **Large-book memory:** unchanged. N01 is 2.2 MB, N02 1.8 MB.
- **Long-work chunk limit:** unchanged. N01 uses 1,897 of 2,000 chunks, and the cap prevents a size-equal authentic cohort.

## 20. Cost and operational complexity

| Item | Effect |
|---|---|
| New services, providers, extensions, dependencies or infrastructure | none |
| Recurring cost | none |
| Diagnostic footprint | 4 disposable databases (about 225 MB), 1 MinIO, about 11.4 MB of downloads; all removed (§26) |
| Option 1 operational cost | none new |
| Options 2 and 3 operational cost | ongoing maintenance of authentic-corpus manifests, rights records, freeze discipline and two suites (§11) |
| A future vacuum-after-indexing step (not authorized) | would add a maintenance operation to indexing |

## 21. Recommended architectural direction (UNAPPROVED)

1. **Retain E-1 unchanged.** Neither the plan finding nor the authentic evidence justifies changing the standard.
2. **Primary next step:** a **diagnostic** re-evaluation, with no implementation, of the deferred exact **C1** ranking on the authentic near-limit cohort and the governing fixture. The reasons:
   - every measured failure on authentic text is in high-frequency single-term and OR scoring;
   - PO-049 showed C1 removes most `ts_rank_cd` calls there (adversarial set 1,002 → 211 ms) while preserving exact results;
   - inline storage is unnecessary on authentic text, which never TOASTs.
3. **Fallback:** evidence-gathering for a workload-class policy (§13 items 1–2), keeping Category A as the stress reference.
4. **Plan stability:** no remedy needed for E-1. The protected-assertion question goes to the PO (§22).

### Decision matrix

| Option | Evidence strength | Product implications | Engineering effort | Operational cost | Security / citation | Remaining performance risk |
|---|---|---|---|---|---|---|
| Retain E-1 unchanged | strong (A fails in all regimes) | release stays blocked | none | none | unchanged | high: governing and authentic adversarial both fail |
| Typical + adversarial classes (after approval) | **moderate**: typical passes at 54%, full size unknown; adversarial fails | headline closer to UX; needs policy rules | medium (suites, manifests) | low–medium (maintenance) | unchanged (same retrieval) | adversarial class still fails → needs optimization anyway |
| Primary typical-load criterion + stress safeguard (after approval) | **weak–moderate**: no real size or query-mix data | strongest UX framing; safeguard pressure point | medium | low–medium | unchanged | safeguard fails today; full-size typical estimated 150–200 |
| Investigate planner/index stability further | strong mechanism already established; further work has low marginal value | none for E-1 | low | none | unchanged | p50 regression after bulk loads until vacuum |
| Revisit deferred exact-ranking optimization (C1) | **strong for the failing class** (PO-049 + PO-051 per-row data) | could bring adversarial authentic queries under 150; governing Q0 unproven | medium (SQL change, invariants P-Q/W/P/M/T/V, regression fixtures) | none recurring | exact ranking preserved (conditionally exact; guards needed); citations unchanged | AND/phrase tail and governing TOAST cost remain |

## 22. Decisions requiring explicit PO approval

1. **R-1:** whether to authorize the **diagnostic C1 re-evaluation** on authentic near-limit and governing fixtures (primary).
2. **R-2:** whether to pursue a **workload-class policy** and authorize its evidence: library-size distribution from catalogue metadata, and consented pilot query shapes (fallback).
3. **R-3:** whether the **protected `ginUsed` assertion** should be revised, for example to index applicability after `VACUUM ANALYZE`. The assertion is unchanged; any change needs authorization.
4. **R-4:** **D13** natural-question retrieval quality (separate product concern).
5. **R-5 (retained):** the `maxChunksPerBook = 2,000` limit for long works, and whether bulk-indexing should be followed by maintenance. Both are production changes, not authorized.

## 23. Changed-file inventory

| File | Change |
|---|---|
| `docs/operating-framework/decisions/product-owner/PO-051-…-authorization.md` | new governance record |
| `docs/noetia-plus/PRODUCT-DECISIONS.md` | PO-051 entry |
| `docs/engineering-missions/README.md` | NEM-024 status |
| `docs/engineering-missions/APPROVED/NEM-024-…md` | NEM-024 status |
| `docs/noetia-plus/20-open-product-decisions.md` | **D13** retrieval-quality concern |
| `services/api/tests/perf/e1-plan-diag.ts` | new, test only |
| `services/api/tests/perf/e1-literary-diag.ts` | `LIT_MANIFEST` / `LIT_QPREFIX`, `po051_*` databases (test only) |
| `services/api/tests/perf/fixtures/po051-corpus-manifest.json` | new; metadata and hashes |
| `services/api/tests/perf/fixtures/po051-query-manifest-es.json` | new; hash-only, frozen |
| `services/api/tests/perf/README.md` | PO-051 section |
| `docs/reports/2026-11-12-NEM-024-po-051-…validation.md` | this report |
| `docs/reports/2026-11-12-NEM-024-po-051-…raw-measurements.json` | raw evidence |

**Not changed:** `services/api/src/`, SQL, migrations, indexes, Docker/Compose, web/mobile, S2, protected tests, thresholds and contracts.

## 24. Raw evidence references

[`2026-11-12-NEM-024-po-051-e1-plan-stability-and-workload-class-validation-raw-measurements.json`](2026-11-12-NEM-024-po-051-e1-plan-stability-and-workload-class-validation-raw-measurements.json) (about 350 KB). It contains:

- **Governing fixture:**
  - `state-D1/C0/C1/C2/C3`: settings, relation and index pages and tuples, all-visible pages, vacuum/analyze timestamps, MCELEM coverage per query id;
  - `plans-*`: node types, estimated and actual rows, costs, buffers, TOAST blocks, execution, TIMING OFF and plain wall times, default and forced;
  - the three suite runs, with the synthetic term redacted from the plan text;
  - `e2e-D1-s1/s2`, `e2e-C0-default/forced`, `e2e-C2-default`, `gov-D1-s3`;
  - the PO-050 reference fingerprint.
- **Near-limit cohort:** `ingest-nl`, `profile-nl`, `info-nl`, `explain-nl`, `relevance-nl`, `nl-s1..s3`.
- **Diagnostic settings used:** recorded, including the exact mid-insert VACUUM row count.

No book text, query text, synthetic terms, anchors, book ids or result hashes. The only 64-hex values are the predeclaration hashes. Nothing was omitted; every run is included.

## 25. Reproduction instructions

From `services/api`, with disposable `postgres:16-alpine` (default settings) and `minio/minio` on 127.0.0.1:

1. **Default condition:** run the NEM-023 suite on `nem019_test` with `NEM023_PERF=1 NEM023_PERF_KEEP=1 NEM023_MINIO_*`, then `e1-plan-diag.ts state|plans D1 5` and `e1-arch-diag.ts e2e A base 10` (×2).
2. **C0:** create `nem019b_test`, run `e1-plan-diag.ts migrate noautovac`, then the suite, then `state` / `plans` C0 and the end-to-end run. Then `ALTER DATABASE nem019b_test SET enable_seqscan = off`, the end-to-end run again, and `RESET`.
3. **C1 / C2:** `VACUUM ai_book_chunks`, then `state` / `plans` C1; `ANALYZE`, then `state` / `plans` C2 and an end-to-end run.
4. **C3:** create `nem019c_test`, run `migrate noautovac`, then the suite while a watcher runs `VACUUM ai_book_chunks` once `count(*) ≥ 12,000`, then `state` / `plans` C3.
5. **Near-limit cohort:**
   - download each `downloadUrl` in `po051-corpus-manifest.json`;
   - run `LIT_MANIFEST=po051-corpus-manifest.json DB_NAME=po051_es_test e1-literary-diag.ts prepare|ingest`;
   - rebuild the local query file to match `po051-query-manifest-es.json` (the freeze must reproduce the spec hash);
   - run `profile|info|explain|relevance`, then `e2e <q> 8001|8002|8003 3`.

## 26. Cleanup confirmation

- **Containers and volumes:** `po051-pg` and `po051-minio` removed with `docker rm -v`, so their anonymous volumes went with them. All four databases, the MinIO objects and every indexed chunk are gone.
- **Local files:** the acquired and normalized literary texts were deleted from the session scratch directory. Only the local query file remains, for hash reproduction; it contains no book text beyond short reference anchors.
- **Production and staging:** never contacted.
- **Unrelated containers:** none touched.
- **Diagnostic settings:** the database-level `enable_seqscan` setting was reset immediately; `pg_db_role_setting` was verified empty.

## 27. PA review status and mandatory STOP

| Item | Status |
|---|---|
| Production code / SQL / schema / migrations | **NO change** |
| Governing benchmark / threshold / protected tests | **NO change** |
| E-1 | **OPEN** |
| Q-11 | conditional development acceptance; risks retained |
| Checkpoint E | **NOT QUALIFIED** |
| PR #56 | Draft, unmerged |
| PA review | **AWAITING** |
| PO next decision | **AWAITING** |
| Release | **BLOCKED** |

**STOP.** There is no PO-052 and no new mission.
