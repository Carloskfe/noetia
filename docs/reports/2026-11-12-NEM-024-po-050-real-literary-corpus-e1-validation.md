# NEM-024 PO-050 — E-1 Representative Literary Corpus Validation

**Mission:** NEM-024 · **Authorization:** [PO-050](../operating-framework/decisions/product-owner/PO-050-nem-024-e1-representative-literary-corpus-validation-authorization.md), limited diagnostic validation only · **Executed:** 2026-11-12 · **Agent:** Claude Code
**Branch / PR:** `feat/nem-024-checkpoint-b` · Draft PR #56 · **Starting commit:** `bde618121b7e592e99d624e343836e3ecba9e62c`
**Raw evidence:** [`2026-11-12-NEM-024-po-050-real-literary-corpus-e1-validation-raw-measurements.json`](2026-11-12-NEM-024-po-050-real-literary-corpus-e1-validation-raw-measurements.json)
**Manifests:**
- [`po050-corpus-manifest.json`](../../services/api/tests/perf/fixtures/po050-corpus-manifest.json)
- [`po050-query-manifest-es.json`](../../services/api/tests/perf/fixtures/po050-query-manifest-es.json)
- [`po050-query-manifest-en.json`](../../services/api/tests/perf/fixtures/po050-query-manifest-en.json)

**Tool:** [`services/api/tests/perf/e1-literary-diag.ts`](../../services/api/tests/perf/e1-literary-diag.ts) (test only)

> **E-1 remains OPEN. The governing benchmark and its 150 ms threshold are unchanged.** Nothing here is a qualification, and every recommendation below is **UNAPPROVED**.

---

## 1. Executive summary

| | End-to-end p95 | Over 150 ms |
|---|---|---|
| **Category A** — governing synthetic benchmark, same session | **569.6 / 578.5 ms** (suite session: 598.2 ms) | most requests |
| **Category B** — authentic Spanish workload (10 works, categories A–D) | per-category p95 **22–86 ms** | **0 / 279** |
| **Category C** — adversarial queries on the authentic Spanish corpus | **93–108 ms** (worst single request 131 ms) | **0** |
| Authentic Spanish, all 360 requests (3 sessions) | **79.5 / 83.7 / 83.1 ms** (p50 ≈ 22 ms, p99 ≤ 108 ms) | **0** |
| Authentic English, supplementary (4 works, 2 sessions) | **65.3 / 67.6 ms** | **0** |

The existing, unchanged retrieval implementation meets the 150 ms intent on every authentic workload measured, including the predeclared stress queries. It does **not** meet it on the governing benchmark. **Outcome 1 applies:** authentic workloads usually satisfy E-1. Category A is not met, so E-1 is not met.

The gap has three measured causes, all structural differences between the synthetic fixture and real books:

1. **TOAST.** Synthetic chunks carry 175 distinct stems against 96 in real text, with no stop words. That pushes 82% of the governing search vectors into out-of-line storage (TOAST, 43 MB). Not one of the 9,244 authentic chunks was TOASTed.
2. **Plan.** In this session the planner chose a **sequential scan** for the governing fixture. Every query, even a no-match, then decompresses every vector: the no-match floor is about 222 ms. On authentic text the planner used the GIN index (bitmap scans) for every query.
3. **Corpus size.** The governing corpus is 20 M code points and 17,780 chunks. The ten authentic works total 7.3 M and 6,385 chunks. Only *Don Quijote* reaches the fixture's per-book size.

Authentic Spanish is not unusually selective. Three ordinary content stems each occur in more than 50% of chunks, so the governing Q0 frequency (55%) is realistic for a frequent word. Typical reader searches still match far fewer chunks: names 2–16%, themes 2–5%, phrases under 0.5%.

**Size is a real confound.** By estimate, a full-size authentic corpus would push frequent-term and OR stress queries to roughly 185–210 ms. Typical queries would stay under 150 ms. That estimate is a linear extrapolation, not a measurement.

**Usefulness finding.** Natural-language questions are passed verbatim to `websearch_to_tsquery`, which ANDs every content word. Five of the 12 question-form Spanish queries, and two of the three English ones, returned **no passages**.

**Recommendation (UNAPPROVED):** keep Category A unchanged as the adversarial and stress reference. Ask the PO to consider separate typical-load and adversarial-load criteria, only after one size-matched authentic measurement. The fallback is the unchanged E-1 plus a targeted architecture study (§24).

## 2. Authorization and preflight

| Check | Result |
|---|---|
| Remote fetch; repository `Carloskfe/noetia`; branch `feat/nem-024-checkpoint-b`; working tree clean (untracked `node_modules` only) | ✔ |
| Remote head = `bde618121b7e…` (expected) | ✔ |
| PR #56 open, Draft, unmerged, base `feat/nem-024-checkpoint-a` | ✔ |
| `PO-050` unused (register, remote history, branches) | ✔ |
| NEM-023/024 specs, PO-047–049 records and reports, E-1 suite, retrieval/indexer/chunker/rights code, `GutenbergFetcherService` read | ✔ |
| Disposable services only: `po050-pg` (postgres:16-alpine 16.13, **default settings**, 127.0.0.1:55432), `po050-minio` (127.0.0.1:59000) | ✔ |
| Resources: 50 GB disk free, about 5 GB RAM available; 14 unrelated containers left untouched | ✔ |

Governance record: commit `822db90`.

## 3. Corpus selection and rights evidence

The corpus was selected on rights and diversity **before any measurement**. All works are original-language (no translations), from distinct authors, and from Project Gutenberg. Per-work editions, URLs, release dates, hashes, removed material and rights statements are in the corpus manifest.

| ID | Work | Author (life) | Published | Form | Normalized code points |
|---|---|---|---|---|---|
| W01 | Don Quijote (I + II) | Cervantes (1547–1616) | 1605/1615 | novel, dialogue-heavy | 2,148,374 |
| W02 | Pepita Jiménez | Valera (1824–1905) | 1874 | epistolary novel | 320,837 |
| W03 | La Regenta | Clarín (1852–1901) | 1884–85 | long realist novel | 1,795,253 |
| W04 | Misericordia | Pérez Galdós (1843–1920) | 1897 | realist novel | 489,556 |
| W05 | Los pazos de Ulloa | Pardo Bazán (1851–1921) | 1886 | naturalist novel | 502,686 |
| W06 | Niebla | Unamuno (1864–1936) | 1914 | modernist "nivola" | 326,717 |
| W07 | Los cuatro jinetes del Apocalipsis | Blasco Ibáñez (1867–1928) | 1916 | war novel | 816,243 |
| W08 | El Gaucho Martín Fierro | Hernández (1834–1886), Argentina | 1872 | narrative verse, dialect | 69,536 |
| W09 | Cuentos de amor de locura y de muerte | Quiroga (1878–1937), Uruguay | 1917 | short stories | 300,544 |
| W10 | La gaviota | Fernán Caballero (1796–1877) | 1849 | costumbrista novel | 542,452 |
| E01 | Pride and Prejudice | Austen (1775–1817) | 1813 | novel of manners | 702,022 |
| E02 | Frankenstein | M. Shelley (1797–1851) | 1818 | Gothic, epistolary frame | 426,692 |
| E03 | Dracula | Stoker (1847–1912) | 1897 | Gothic, epistolary | 859,753 |
| E04 | Moby-Dick | Melville (1819–1891) | 1851 | encyclopaedic novel | 1,240,917 |

**Rights.** Every work is public domain in the **United States**: published before 1931, which is Project Gutenberg's determination, and every file carries the standard Gutenberg licence header.

- **Spanish works:** also public domain in **Spain** under the LPI, Disposición transitoria 4ª. Authors who died before 7 December 1987 are protected for life + 80 years, and the latest author death here (1937) expired by 2018. They are also public domain in the EU generally, at life + 70.
- **English works:** also public domain in the UK and EU at life + 70.
- **Worldwide:** not asserted. Gutenberg's header requires checking local law outside the US.

Use here was temporary local diagnostic indexing only.

**Excluded or not selected:**

- *La Celestina* (#1619): a **copyrighted 1998 modern edition** with editor's notes, so the edition's rights could not be established. Replaced by W02.
- *Platero y yo*: the author died in 1958, so it is still protected in Spain.
- Translations (*Crimen y castigo*, *La Odisea*, *La Divina Comedia*): the translator's rights were not verified.
- *Fortunata y Jacinta*: about 2.5 M code points, beyond `maxChunksPerBook`.

No customer or subscription content, unauthorized scans or commercial editions were used.

## 4. Text normalization and ingestion

Normalization is the **production** `GutenbergFetcherService.stripHeaders`, called on the prototype verbatim. Bytes are used exactly as served, with CRLF line endings preserved as production stores them. After that come:

- the manifest's code-point keep range, which removes only editorial material: Gutenberg credit lines, transcriber notes, a transcriber-added index, Galdós's third-party prologue to *La Regenta*, the Saintsbury preface and printer colophon in *Pride and Prejudice*, and the publisher advertisements in *Dracula*;
- removal of `[Illustration …]` blocks;
- a final trim.

Acquired, stripped and normalized SHA-256 values are recorded, and the tool re-verifies them on every run. No padding, repetition or concatenation was applied.

Ingestion used the **production** `BookIndexer`:

- production chunking: 1,500 characters with 10% overlap;
- `noetia_es` / `noetia_en`;
- the existing GIN indexes;
- one complete set per book.

Each book also got a disposable `books` row and a real `book_ai_rights` row (public domain, the work's metadata and Gutenberg URL, a disposable verifier), and passed the real `IndexingPermission` check: rights status, permitted operation and current text hash. Objects live in the disposable MinIO.

**Indexing time:** 2.76 s for the Spanish set (38–740 ms per book) and 1.16 s for the English set. All 14 books were indexed, with no refusals.

## 5. Corpus composition and size (Q-50-1)

| | Spanish (10) | English (4) | Governing fixture (10) |
|---|---|---|---|
| Code points | 7,312,198 | 3,229,384 | 20,000,000 |
| Word tokens | 1,254,826 | 580,428 | n/a (synthetic) |
| Stop-word share of tokens | 45.8–53.2% per book | 49.2–55.8% | 0% (no stop words in the generator) |
| Chunks | 6,385 (54–1,897 per book) | 2,859 | 17,780 |
| Distinct lexemes (corpus) | 24,579 | 15,627 | 5,074 |
| Average distinct lexemes per chunk | **96** | 94 | **175** |
| Average stored `tsvector` | **1,343 B** (p95 1,464–1,776 per book) | 1,323 B | **2,417 B** |
| Chunks over 2,000 B stored, so TOASTed | **0** | 0 | **14,526 (82%)** |
| Heap / TOAST / index | 10.2 MB / **8 KB** / 8.4 MB | 4.5 MB / 57 KB / 6.3 MB | 7.3 MB / **43.1 MB** / 16.2 MB |

**Chunk selectivity of the most frequent searchable lexemes.** "Searchable" means after stop-word removal.

| Lexeme frequency rank | 1 | 2 | 3 | 5 | 10 | 20 | 50 | 100 | 200 |
|---|---|---|---|---|---|---|---|---|---|
| Spanish, % of chunks | 68.6 | 63.4 | 54.9 | 38.6 | 34.3 | 26.3 | 18.7 | 12.7 | 7.9 |
| Spanish, per million tokens | 6,477 | 6,332 | 5,737 | 3,384 | 2,294 | 1,833 | 1,166 | 762 | 428 |
| English, % of chunks | 50.1 | 39.6 | 38.1 | 35.0 | 29.6 | 24.3 | 18.6 | 12.4 | 8.0 |

**Spanish lexemes by chunk coverage:**

| Share of chunks a lexeme appears in | Spanish lexemes |
|---|---|
| ≥ 50% | 3 |
| ≥ 25% | 24 |
| ≥ 10% | 143 |
| ≥ 5% | 339 |
| ≥ 1% | 1,798 |

Within single books, the top lexeme covers 63.8–88.9% of that book's chunks. For comparison, the governing Q0 covers 55.4% of chunks at 4,413 per million.

## 6. Query-selection methodology

Queries are written the way readers type them. Natural questions are passed verbatim because the product applies no query rewriting: `QueryContextSource` forwards the question to `RetrievalPort` and then to `websearch_to_tsquery`. Keyword and quoted-phrase forms are included too.

**Spanish: 40 queries**

| Category | Count | Content |
|---|---|---|
| A — characters and entities | 10 | very frequent to rare names, a two-word name, "who is" and "where does" questions |
| B — themes and interpretation | 7 | |
| C — passages and quotations | 9 | 5 phrases, remembered scenes, a remembered object |
| D — cross-book research | 5 | full ten-book context |
| E — stress and negative controls | 9 | frequent honorific, top narrative verb, OR of names, OR of themes, AND of frequent nouns, phrase of frequent tokens; 2 no-match controls (5%) |

- **Scopes:** 34 queries use the full ten-book library (`L`) and 6 use one book (`Wxx`), where the question is plainly about the book being read.
- **Classes:** 21 ordinary, 10 complex, 7 adversarial, 2 negative.
- **Structures** (from PostgreSQL's own parse): 14 single-term, 18 AND, 6 phrase, 2 OR.

**English (supplementary): 14 queries**, with the same categories, all over `L`, which is the four English works.

**References.** Each reference is an independently identifiable location, such as the windmills in *Quijote* I.8 or the Rocinante naming passage in I.1. There are 12 in total: 8 Spanish and 4 English. Each is represented by a short anchor that is kept **local**. Only the anchor's existence in the normalized text was checked before the freeze. No query was executed.

No paid LLM was used.

## 7. Predeclaration evidence

The query manifests were **frozen and pushed in commit `977337e` before any timed measurement**.

- Spanish spec sha256: `7cf1cbd1…a53467edb0`.
- English spec sha256: `464a9601…f034a286c0`.

Each hashes every query's text and anchor, and records the local file's own hash. Every untimed pass (selectivity, plans, usefulness) and every timed session ran afterwards against the unchanged local file, sha256 `9616d47a…cd97958a`. No query, scope or reference was changed after any observation.

## 8. Governing synthetic benchmark status (Category A)

The fixture was rebuilt with the **unchanged** NEM-023 suite, which used 10 × 2,000,000 code points and real MinIO.

| Session | n | p50 | p95 | p99 | Ranking SQL p95 | S2 p95 |
|---|---|---|---|---|---|---|
| Suite, session 0 | 100 | 314.5 | **598.2** | n/a | n/a | n/a |
| e2e production (`e1-arch-diag e2e A base`), session 1 | 100 | 312.8 | **569.6** | 596.0 | 513.2 | 61.7 |
| e2e production, session 2 | 100 | 305.8 | **578.5** | 610.2 | 511.5 | 61.1 |

**E-1 is FAILED** on the governing benchmark. These figures are consistent with PO-049's production 496–573 ms.

- **Per query:**
  - Q0 p50 570–579 ms;
  - Q5 (OR) 471–485 ms;
  - Q4 (AND) 396–409 ms;
  - **Q8 (no match) 221–222 ms.**
- **Contract:** the result contract was identical across repeats.
- **Plan:** the production `RANK_SQL` plan in this database is **Seq Scan + Hash Join** for Q0, Q3 and Q4. Q3 has 415 matches yet took 227.5 ms and touched 49,885 shared buffers. Every row's TOASTed vector is decompressed to evaluate `@@`, which explains the no-match floor.
- **Plan sensitivity (reported, not changed):** the suite's own `ginUsed` assertion **failed** in this session. The planner chose a sequential scan for the suite's EXPLAIN probe (estimated 89 rows) after autovacuum and analyze; PO-049 recorded `ginUsed: true`. This is a protected test, so it is reported here and not modified.

## 9. Spanish authentic-corpus measurements (Category B + C)

**Method:**

- **Implementation:** production `LexicalRetrievalService`, production `RANK_SQL`/`STATUS_SQL`, real disposable MinIO through `StorageService`, and the process S2 worker.
- **No shortcuts:** no SQL substitution, no caches.
- **Settings:** topK 8 and budget 6,000 tokens (production defaults).
- **Order:** declared scopes, one warm-up pass excluded from the figures, then 3 rounds × 40 queries in an order shuffled by seed (5001 / 5002 / 5003).
- **Interleaving:** sessions were interleaved with the governing and English sessions.

| Session | n | p50 | p95 | p99 | max | Over 150 ms | Errors | Empty requests | Results stable |
|---|---|---|---|---|---|---|---|---|---|
| es-s1 | 120 | 22.4 | 79.5 | 107.8 | 116.6 | 0 | 0 | 15% | ✔ |
| es-s2 | 120 | 22.8 | 83.7 | 104.7 | 105.5 | 0 | 0 | 15% | ✔ |
| es-s3 | 120 | 22.3 | 83.1 | 93.4 | 93.9 | 0 | 0 | 15% | ✔ |

**Stage p95 across the three sessions:**

| Stage | p95 (ms) |
|---|---|
| Status SQL | 1.9–2.0 |
| Ranking SQL | 59.6–61.2 |
| Storage reads (sum per request) | 40.1–48.3 |
| S2 verify (max per request) | 15.5–16.2 |
| S2 phase | 25.7–26.2 |

**Session-level resources:**

- **PostgreSQL CPU:** 1.77–1.91 s per 120 requests, about 15 ms per request. That is about 47% of one core while running back-to-back.
- **I/O:** 0 blocks read and no temporary bytes; everything was served from shared buffers.
- **Host:** load average 0.4–1.5. No contamination was observed and no session was discarded.

## 10. English supplementary measurements

| Session | n | p50 | p95 | p99 | max | Over 150 ms | Empty requests |
|---|---|---|---|---|---|---|---|
| en-s1 (seed 6001, 8 rounds × 14) | 112 | 18.6 | 65.3 | 71.7 | 78.6 | 0 | 21.4% |
| en-s2 (seed 6002) | 112 | 20.3 | 67.6 | 75.9 | 79.3 | 0 | 21.4% |

The English set has four works, 2,859 chunks and only 14 queries. It is **supplementary**, with no qualification value: it is not a ten-book cohort. Its behaviour matches the Spanish set: GIN bitmap plans, no TOAST, and the OR stress query is the slowest.

## 11. Query-category performance

Values are end-to-end p95 in ms across es-s1, es-s2 and es-s3.

| Category | p95 | Over 150 ms | Benchmark category |
|---|---|---|---|
| A — entity | 41.4–42.4 | 0 | B (representative) |
| B — theme | 32.2–38.2 | 0 | B |
| C — passage / quotation | 22.2–28.7 | 0 | B |
| D — cross-book | 63.3–**85.9** | 0 | B |
| E — stress (adversarial class) | **93.4–107.8** (worst request 116.6) | 0 | C (adversarial) |
| E — no-match (negative class) | 21.4–27.9 | 0 | (control) |

**Category B as a whole:** p95 ≤ 85.9 ms in every session. This bound holds because the p95 of a union of groups cannot exceed the largest group p95.

**Q-50-3:** **no legitimate query category exceeded 150 ms** in this study.

**Worst realistic category:** D, cross-book research, at 85.9 ms. It is dominated by S2: SD05 ("muerte") reads 5 books, with an S2 p95 of 60.5 ms.

## 12. High-frequency entity and theme analysis

| Query (class) | Matching chunks (% of scope) | Books | e2e p95 worst session |
|---|---|---|---|
| SA01 principal-character name, W01 | 1,016 (15.9%) | 3 | ≤ 42 |
| SA05 title/name, W03 | 557 (8.7%) | 1 | ≤ 42 |
| SA09 family surname, W07 | 383 (6.0%) | 1 | ≤ 42 |
| SA02 / SA07 secondary names | 234 (3.7%) / 122 (1.9%) | 2 / 1 | ≤ 42 |
| SD03 "Dios" | 1,313 (20.6%) | 10 | ≤ 86 |
| SD05 "muerte" / SD01 "madre" | 842 (13.2%) / 784 (12.3%) | 10 | 85.9 |
| **SE01** honorific "don" | **3,178 (49.8%)** | 10 | **102.0** (ranking SQL 81) |
| **SE07** top narrative verb | **2,436 (38.2%)** | 10 | 76.6 |

Protagonist names in their own book are the authentic analogue of the governing Q0. They covered 6–16% of the library and 30–53% of their own book's chunks. Only the honorific "don" approached Q0's 55%.

**Per-row cost:** a fit of server ranking time against matching rows gives **about 17 µs per matching row for single-term queries**. That is consistent with PO-049's measured `ts_rank_cd` per-call cost; the rows are inline, so there is no TOAST cost.

## 13. Phrase and multi-term analysis

| Query | Structure | Matching chunks | e2e p95 worst | Ranking SQL p95 |
|---|---|---|---|---|
| SE05 | 3-way OR | 1,627 (25.5%) | **116.6** | 100.7 |
| SE03 | AND of 2 frequent nouns | 886 (13.9%) | 105.5 | 47.3 (S2 56, 4 books) |
| SE02 | OR of 2 names | 1,410 (22.1%) | 81.5 | 61.2 |
| SE04 | phrase of 2 frequent tokens | 1,185 (18.6%) | 75.8 | 52.4 |
| SE06 | 3-way AND | 49 (0.8%) | 61.4 | 5.4 (S2 49, 6 books) |
| SC01–SC05 | literary phrases | 1–11 | ≤ 28.7 | < 1 |

**Per-row cost** of AND, OR and phrase queries:

| Shape | Basis | Cost per matching row |
|---|---|---|
| AND | fit | ≈ 39 µs |
| OR | point estimates | ≈ 37–46 µs |
| Phrase | point estimate | ≈ 36 µs |

That is about 2–2.7 times the single-term cost, matching PO-049's 54–61 µs per-call `ts_rank_cd` measurement for two-operand queries.

Selective AND and phrase queries are cheap in SQL. Their cost comes from S2, from reading and verifying several books.

## 14. PostgreSQL ranking cost

**Literary databases:**

- **Plans:** the production `RANK_SQL` used **Bitmap Index Scans on the GIN index for every query**. In English, EE01 and EE02 mixed in a sequential scan on a small branch.
- **Server execution:** 0.1–75 ms.
- **Buffers:** shared buffers only, no TOAST traffic.

**Governing fixture** (Seq Scan, 82% TOASTed):

| Query | Server time | Shared buffers |
|---|---|---|
| Q0 | 496 ms | 76,168 |
| Q3 | 227 ms | 49,885 |
| Q4 | 331 ms | 55,506 |

**Main literary bottleneck:** for high-frequency and OR stress queries it is the ranking SQL, which scales linearly with matching rows (§12–13). For multi-book results it is S2 (§15).

**Main governing bottleneck:** it is plan- and TOAST-driven. Every query pays a decompression floor of about 220 ms before the per-row ranking cost is added.

## 15. S2 cost and number of verified books

Real *Don Quijote* is 2.2 MB, so per-book S2 work is the same order as the governing 2 MB books. What drives S2 cost is the **number of distinct result books**, not language.

| Measure | Spanish sessions |
|---|---|
| Books read per request | p50 1, max 6 |
| Storage read sum, p95 | 40–48 ms |
| Verify (worker), p95 | 15.5–16.2 ms |
| S2 phase, p95 | ≈ 26 ms |
| S2 phase, p95 for 4–6-book results (SE03, SE06, SD05) | 49–61 ms |

On the governing fixture the S2 phase p95 was 61–62 ms; Q-mix results span several 2 MB books.

S2 was **not** changed (D-3 deferred). Full re-read and re-verify ran on every request.

## 16. Retrieval usefulness and empty-result rate

These checks ran untimed, after the freeze, at topK 8 with the declared scope.

- **Citation validity:** **every passage** (both languages) re-derived exactly from the local normalized text at its `[charStart, charEnd)` code points. Every passage belonged to an allowed book with its current hash. Exclusions were empty.
- **References found:**
  - Spanish: **6 of 8 at rank 1** (SC01, SC02, SC04, SC05, SC08, SC09).
  - English: **3 of 4 at rank 1**.
- **References missed:**
  - **SA03** ("what is Don Quijote's horse called?") returned 8 passages from W01, but the naming passage is in neither the top 8 nor the top 20. The naming passage does not contain the question's words ("caballo" / "llama").
  - **SC03** and **EC03** returned nothing (see the next point).
- **Empty results:**
  - Spanish: 6 of 40 queries, 15% of requests. Five were **unexpected**: SB01, SB06, SC03, SC07, SD02. All are natural-language questions with three to five content words, which websearch ANDs.
  - English: 3 of 14, including the expected `smartphone` control. Two unexpected: EB02 and EC03, both questions.
  - In total, **7 of the 15 question-form queries across both languages returned nothing**. Keyword and phrase forms were never unexpectedly empty.
- **No-match controls:** the "computadora" control matched 2 chunks through a stemming collision with another word; it is reported as observed. The two-term control was empty.
- **Determinism:** results were byte-stable across every repeat in every session.

The first lexically ranked passage is **not** claimed to be the best semantic answer. These checks establish retrievability of known locations, nothing more.

## 17. Corpus-size and selection sensitivity (Q-50-4)

These runs used the same 40 queries and the same seed (7001). Only the allowed-book set was changed.

| Allowed set | Chunks in scope | p50 | p95 | p99 | Ranking SQL p95 | Empty requests |
|---|---|---|---|---|---|---|
| S1 = {W01} | 1,897 | 20.5 | 49.9 | 75.7 | 28.7 | 42.5% |
| S3 = {W01, W03, W07} | 4,193 | 21.1 | 73.5 | 93.0 | 54.3 | 27.5% |
| S10 = all ten | 6,385 | 22.5 | 83.6 | 107.1 | 59.9 | 15% |

Latency grows with the matching rows in scope and with the distinct result books. Language does not drive it.

**Separating size, structure and language effects** (estimate, labelled; not measured):

1. **Size.** The governing table has 2.8 times as many chunks. At equal selectivity, a frequent single term covering about 50% of chunks would match about 8,900 rows at full size. At the measured 17.4 µs per row that is about 155 ms of SQL, or **about 185 ms end to end**. A 3-way OR covering 25% would be about 4,560 rows at 46 µs, so **about 210 ms**. Typical entity and theme queries (≤ 16%) would remain **under about 110 ms**. This assumes linear scaling and a stable GIN plan. At larger sizes the planner may switch to a sequential scan, as it did on the governing fixture.
2. **Structure, not language.** TOASTed vectors, a direct consequence of the generator's high per-chunk lexical diversity and absence of stop words, roughly triple per-row cost and add the sequential-scan floor.
3. **Language.** Authentic language is **not** more selective for frequent words (§5). It is more selective for what readers actually type: names, themes and phrases.

**Limitation:** a naturally occurring, size-matched authentic cohort (10 × about 2 M code points) was not available within this scope.

- Few public-domain Spanish works reach that length.
- *Fortunata y Jacinta* exceeds `maxChunksPerBook`.
- Padding is prohibited.

No smaller selection is treated as qualifying the ten-book scenario.

## 18. Comparison with PO-048 and PO-049

- **PO-048 root cause confirmed.** Per-row `ts_rank_cd` plus TOAST fetch is the cost, and it applies to the governing fixture only. The TOAST component never appears with authentic text.
- **PO-049 per-call costs confirmed.** About 23 µs for one operand and 54–61 µs for AND/OR are consistent with the 17 µs and 37–46 µs per-row costs observed here on inline rows.
- **PO-049's inline-storage experiment** reproduced on the synthetic fixture what authentic text does naturally.
- **PO-049 supplementary B/C results** (production p95 104 and 115 ms) are **corroborated in direction** by authentic text, with a lower p95 here (79–84 ms) because the corpus is smaller.
- **D-1 optimizations:** C1 and inline storage were not implemented. On authentic text they would address only the frequent-term and OR stress tail (§12–13). The TOAST problem they target is absent.

## 19. Benchmark representativeness assessment (Q-50-5)

The governing benchmark is **a mixture, weighted toward adversarial stress**:

- **Corpus size:** an **upper bound** of the ten-book commitment. Ten books of about 2 M code points each is ten copies of the longest classic in the cohort; the authentic library averaged 0.73 M per book.
- **Text structure:** **unrepresentative.** It has 1.8 times the distinct lexemes per chunk and no stop words, which TOASTs 82% of vectors and (in this session) pushes the planner into a sequential scan. None of the 9,244 authentic chunks was TOASTed.
- **Query frequency:** **partly realistic.** A term covering 55% of chunks exists in real Spanish (3 stems ≥ 50%), but it is a verb form or honorific rather than what readers typically search. The mix's AND, OR and phrase shapes are legitimate.

**Category A therefore functions as a stress condition.** It is valid protection against large libraries and very frequent terms, but it is not an estimate of the typical reader workload.

## 20. E-1 implications

- **E-1 remains OPEN.** Category A is not met: 569.6 / 578.5 / 598.2 ms against 150 ms.
- **Categories B and C** were met on the authentic corpus at its natural size: 0 of 944 timed requests over 150 ms across Spanish, English and sensitivity runs.
- **No criterion is met or changed by this report.** A future, separate PO decision would be needed to give workload classes formal status.

## 21. Q-11 and large-book risk implications

- **Q-11:** unchanged, with conditional development acceptance; no requalification was run. Authentic workloads used about 15 ms of PostgreSQL CPU per request with no TOAST I/O. That is lighter database contention than the governing mix, which suggests, without proving, more headroom for reader endpoints under research load.
- **Large-book memory:** unchanged. Real books reach fixture size (*Quijote* 2.2 MB), so the 512 MB API large-book risk applies to authentic catalogues. The client process RSS here (about 360 MB) is the ts-node harness, not the capped API, and is not evidence for Q-11.
- **New observation:** *Don Quijote* (both parts as one object) produced **1,897 of the 2,000 maximum chunks per book**. A work beyond about 2.27 M code points, such as *Fortunata y Jacinta*, would be refused with `too_many_chunks`. This is a capability limit for long works; it is reported for the PO, not changed.

## 22. Cost and resource observations

| Item | Effect |
|---|---|
| New providers, services, extensions or dependencies | none |
| Infrastructure added | none |
| Recurring cost | none |
| Database footprint | authentic Spanish index **18.6 MB** total against 66.5 MB for the synthetic fixture (no TOAST), well within `maxIndexBytes` (250 MB) |
| Work done | 3.9 MB of downloads (texts) and a 5.6 MB catalogue file |

Everything was disposable, and all of it was deleted at cleanup (§27).

## 23. Limitations and confidence

| Limitation | Effect on confidence |
|---|---|
| Authentic corpus is 37% of the governing size; no size-matched authentic cohort | **Moderate** for the full-size frequent-term and OR estimates (§17, estimated) |
| Query set is author-constructed (no pilot or consented user queries) | **Moderate** representativeness of mix proportions; categories are plausible, not measured frequencies |
| References are lexical locations, not semantic relevance judgements | usefulness evidence is retrievability only |
| Client harness on the host, not the 1-vCPU capped API container | absolute figures are host-specific; class ordering and stage proportions are robust |
| Shared development VM (other containers running) | interleaved sessions; loads 0.4–1.5; no contamination detected; run-to-run spread ≤ 5% p95 |
| Governing plan choice (Seq Scan) is plan-sensitive; PO-049 recorded `ginUsed: true` | Category A numbers are consistent with PO-049, but plan-regime sensitivity is unquantified |
| English set is small (4 works, 14 queries) | supplementary only |

**Overall confidence:**

| Conclusion | Confidence |
|---|---|
| Authentic typical workloads pass at natural corpus size | **High** |
| Benchmark representativeness | **Moderate–high** |
| Full-size stress behaviour | **Moderate** (estimate) |

## 24. Recommendation and alternatives (UNAPPROVED)

**Primary recommendation:** consider introducing **separate typical-load and adversarial-load criteria**, keeping the original E-1 benchmark **unchanged** as the adversarial and stress reference (Category A). The decision should be made only after one bounded evidence step: a **size-matched authentic measurement**.

- **What it is:** the largest rights-cleared works, plus a ten-book selection at the realistic upper end of library size.
- **What it settles:** whether frequent-term and OR stress classes exceed 150 ms at full size, as §17 estimates.

Threshold values remain the PO's decision. This report proposes none.

**Fallback:** keep E-1 **unchanged** as the sole criterion, and authorize a **targeted architecture study** of the governing regime. It would cover plan stability (Seq Scan versus GIN) and the TOAST-driven floor. The deferred D-1 exact package would be revisited with that evidence. No implementation is implied.

**Distinguished options:**

| Option | Assessment |
|---|---|
| Keep E-1 unchanged | possible, but keeps release blocked on a structurally adversarial fixture |
| Revise the benchmark | **not** recommended now; evidence is insufficient (size confound) |
| Separate typical and adversarial criteria | **primary** |
| Implement an exact ranking optimization (D-1) | would help only the stress tail on authentic text; remains deferred |
| Another architecture investigation | **fallback** |

## 25. Exact next Product Owner decisions required

1. **P-1:** whether to pursue a **workload-class E-1 structure** (typical versus adversarial) in principle, with Category A unchanged.
2. **P-2:** whether to authorize the **size-matched authentic measurement**, and optionally consented pilot query shapes, as the evidence step before P-1.
3. **P-3:** whether the **plan sensitivity of the governing fixture** needs investigation. The protected suite's `ginUsed` assertion failed in this session, and the Seq Scan floor is about 222 ms. This would be diagnostic only.
4. **P-4 (product, outside latency):** how natural-language questions should reach lexical retrieval. Seven of 15 question-form queries returned nothing because of AND semantics. Any change would alter the retrieval contract and needs its own decision.
5. **P-5:** whether the **`maxChunksPerBook` = 2,000** limit is acceptable for long works (*Quijote* at 1,897; *Fortunata y Jacinta* refused).

## 26. Raw evidence and reproduction instructions

**Raw evidence:** [`…-raw-measurements.json`](2026-11-12-NEM-024-po-050-real-literary-corpus-e1-validation-raw-measurements.json) (about 400 KB). It contains:

- ingest, profile, info, explain and relevance passes for both languages;
- all 10 timed sessions, plus the governing suite excerpt, which was captured truncated.

It contains **no** book text, query text, anchors, book ids, keys or result hashes. Its only 64-hex values are the two manifest spec hashes.

**Reproduction** (from `services/api`, with disposable services):

1. Start disposable `postgres:16-alpine` (default settings) on 127.0.0.1:55432, create `po050_es_test` and `po050_en_test`, and start `minio/minio` on 127.0.0.1:59000.
2. Download each `downloadUrl` in the corpus manifest into `<raw>/pg<id>.txt`, then run `prepare <raw> <norm>`. Hashes are verified at three stages.
3. Run `ingest <norm>` against each database.
4. Recreate a local query file matching the hashes in the query manifests, then run `freeze` (this must reproduce the spec hashes).
5. Run the measurement commands:

   ```
   info | explain | relevance <q> <norm>
   e2e <q> 5001|5002|5003 3
   e2e <q> 6001|6002 8     (en)
   e2e <q> 7001 3 S1|S3|S10
   ```

6. For the governing comparison, run the NEM-023 suite with `NEM023_PERF=1 NEM023_PERF_KEEP=1 NEM023_MINIO_*` on `nem019_test`, then `e1-arch-diag.ts e2e A base 10` twice.

All commands take `NEM019_DISPOSABLE_DB=1 DB_* MINIO_* npx ts-node -T -P tsconfig.json tests/perf/e1-literary-diag.ts <cmd>`. The tool refuses non-local or non-`_test` databases.

## 27. Cleanup confirmation

- **Containers:** the disposable `po050-pg` and `po050-minio` were removed, together with their three anonymous data volumes (the MinIO `books` bucket and both PostgreSQL data directories, identified by content before deletion). That removed the databases, every indexed chunk, the rights rows and the MinIO objects.
- **Local files:** acquired texts, normalized texts and the Gutenberg catalogue file were deleted from the session scratch directory.
- **What remains locally:** the session-scoped local query file (query text and short reference anchors, no book text), kept for PA reproduction of the manifest hashes.
- **Production and staging:** never contacted.
- **Unrelated containers:** none touched.

## 28. PA review status and mandatory STOP

| Item | Status |
|---|---|
| Production code changed | **NO** (`services/api/src/` untouched) |
| Schema or migration | **NO** |
| E-1 threshold or benchmark changed | **NO** |
| Retrieval contract changed | **NO** |
| Merge / deployment / activation | **NO** |
| E-1 | **OPEN** |
| Q-11 | conditional development acceptance |
| Checkpoint E | **NOT QUALIFIED** |
| Release | **BLOCKED** |
| PA review | **AWAITING** |
| PO follow-on decision | **AWAITING** |

**STOP.** There is no PO-051 and no new mission.
