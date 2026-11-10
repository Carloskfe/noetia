# NOETIA ENGINEERING MISSION — NEM-### (E5) — identifier pending PO reservation
## Knowledge Retrieval and Grounding (Stage 1: lexical, provider-independent)

**Status:** DRAFT — REVISION 3 — **not executable** (governance README: a DRAFT mission is never executed)
**Mission type:** IMPLEMENTATION (proposed)
**Implementation authorization:** NONE (requires PO approval of this specification, decisions D-1 to D-9, **and** a separate execution instruction)
**Schema changes:** ADDITIVE ONLY (proposed: one table, three text-search configurations, and the `unaccent` contrib extension if D-5 is approved), on disposable test databases only
**Infrastructure changes:** NOT AUTHORIZED (none needed: no image change, no new service, no background job)
**Production deployment:** NOT AUTHORIZED (staging and merge to `main` also NOT AUTHORIZED)
**Product Owner approval:** REQUIRED

> Drafted under the PO instruction *"E5 Discovery and Engineering Mission Draft"* (2026-11-09).
> **Revision 2** answers the Product Architecture review of PR #52 (*"direction supported — changes required"*):
> 1. authoritative text hash (§9.1);
> 2. query interface and E6 boundary (§5, §9.2);
> 3. storage variants without choosing one (§5.1, §10);
> 4. Spanish/English full-text search and accents (§9.3);
> 5. scope, retention, and limits (§9.4);
> 6. invariants (§8, §11);
> 7. PO decisions (§16).
>
> **Revision 3** answers the final clarifications on revision 2 (`53fc73f`):
> - **C-1:** book-level index permission is separated from user-level query-time eligibility; the indexer uses no user identity and denies by default (§9.6).
> - **C-2:** S2 still stores a lexical derivative (`tsvector`) of book content in PostgreSQL and its backups (§5.1, §10).
>
> Everything else is unchanged.
>
> Evidence: [E5 discovery report, revision 3](../../reports/2026-11-09-E5-retrieval-discovery-report.md).

---

## 1. Context

No retrieval exists. NEM-019's `ContextSourcePort` is bound to `EmptyContextSource`, so models receive no book content.

ADR-004 approves pgvector as the future vector store, behind a mandatory, technology-neutral retrieval interface. Production PostgreSQL (`postgres:16-alpine`) has no pgvector, and paid AI stays off until the launch gate. E5 Stage 1 delivers lexical, citable retrieval inside the existing PostgreSQL, with **no provider, no new infrastructure, and no cost**.

## 2. Objective

Provide **dark, unwired** retrieval components that, given an allowed set already produced by the existing eligibility step and a query, return ranked, budget-bounded, citable passages and the user's own highlights and notes. E6 will wire these components into turns through the unchanged Context Builder and the accepted NEM-022 Gateway.

**Done** = every §11 criterion proven on disposable databases with fixture texts.

## 3. Dependencies

- **Decisions before approval:** D-1 (TT-25) to D-9 (§16).
- **Code:** NEM-022 accepted (Gateway v2), NEM-021 (ledger), NEM-019 (rights, Context Builder). Built on the NEM-022 branch stack, not `main`.
- **E3:** E5 adds or reuses the single `computeTextHash` function. **Binding the real `TextIdentityPort` adapter in the module is E3's step**, not E5's (§9.1).
- **E6:** consumes `QueryContextSource` (§9.2).
- **Not required:** pgvector, an embedding provider, staging, CI changes, any paid service.
- **Test environment:** the existing disposable `postgres:16-alpine` + Redis harness; VM limits (`--maxWorkers=2`, one heavy job at a time).

## 4. Source-of-truth references

ADR-002, ADR-003, **ADR-004**, ADR-005, **ADR-006** · 03 research architecture (retrieval contract rules 6–8, permission pipeline, traceable citations, origins, trust boundary F-17) · 02 reconciliation X-3 · P0 packet (E3, E5, E6 rows; TT-25) · NEM-019 technical note §1–§9, §11, §12 · discovery report revision 2.

## 5. In scope

Only under `services/api` (plus tests and docs):

1. **Migration (additive, ≥ 075):**
   - `CREATE EXTENSION IF NOT EXISTS unaccent` (D-5).
   - Text-search configurations `noetia_es` (copy of `spanish`), `noetia_en` (copy of `english`), and `noetia_simple` (copy of `simple`), with word token types mapped to `unaccent` followed by the language stemmer (§9.3).
   - Table **`ai_book_chunks`**:
     - **Identity:** `id` uuid; `bookId` (FK `books` `ON DELETE CASCADE`); `chunkIndex`.
     - **Anchor:** `textHash`, `charStart`, `charEnd` (code points).
     - **Metadata:** `phraseIndexStart` and `phraseIndexEnd` (derived, nullable); `chapterLabel` (nullable); `language` (`es` | `en` | `simple`).
     - **Search:** `tsv` tsvector.
     - **Constraints:** UNIQUE (`bookId`, `textHash`, `chunkIndex`); CHECK `charStart < charEnd`.
     - **Indexes:** partial GIN on `tsv` per language; btree (`bookId`, `textHash`). No user columns.
   - **Storage variant per D-4 (§5.1).** Only the approved variant is built.
2. **Chunker (pure, deterministic):**
   - book text plus optional sync phrases → chunks;
   - configurable size and overlap (D-8); prefers paragraph and sentence boundaries; never splits a word;
   - exact code-point offsets; headings → chapter labels; phrase ranges derived from sync maps (read-only).
3. **Indexer (explicit command, offline):**
   - per book: **establish book-level index permission (§9.6; default deny)**; read the MinIO text; `textHash = computeTextHash(bytes)`, which must equal the hash the permission was granted for; chunk; write **one complete set in one transaction**;
   - idempotent (skips an existing set), resumable, concurrency 1, enforces the §9.4 limits;
   - **never writes sync maps, fragments, or reader data.**
   - Commands: `index <bookId|all>`, `prune` (non-current sets past grace), `purge <bookId>` (immediate).
4. **`computeTextHash`:** one shared pure function under `knowledge/rights/` (§9.1), with unit tests, if not already added by E3.
5. **`RetrievalPort` + lexical implementation** (§9.2, §9.3): per-language sub-queries with constant configurations, the allowed `(bookId, textHash)` pairs as SQL predicates, `ts_rank_cd` with deterministic tie-breaks, top-k, and budget trimming.
6. **User content search:**
   - lexical search over the **requesting user's** `fragments.text` and `fragments.note`, for allowed books only;
   - the language comes from the fragment's book; `to_tsvector` is computed at query time; row cap per §9.4;
   - **no index or schema change on `fragments`.**
7. **`QueryContextSource`** (§9.2): resolves current hashes through `TextIdentityPort`, calls `RetrievalPort` and the user content search, and maps the results to NEM-019 `ContextItem`s (`chunk` / `highlight` / `note`, with `text`) under a total context-token budget. **It is not bound to `ContextSourcePort`, and `TurnService` is unchanged.**
8. **Anchor resolver:** chunk ref → `{ bookId, textHash, charStart, charEnd, chapterLabel, phraseRange }`. It verifies the hash still equals the current text hash (otherwise the ref is unresolvable). Gateway citation anchors carry `textHash:charStart-charEnd`.
9. **Metrics (no content labels):** `intelligence_retrieval_total{outcome}`, `intelligence_retrieval_passages` (histogram), `intelligence_retrieval_excluded_total{reason}` (`stale` | `unindexed`), `intelligence_index_books_total{outcome}` (`indexed` | `skipped_scope` | `skipped_limit` | `exists`).
10. **Tests (§12), technical-note section, migration entries, completion report.**

### 5.1 Storage variants (D-4 — the PO chooses; the mission builds only the approved one)

| | **S1 — chunk text in PostgreSQL** | **S2 — offsets + `tsvector` only; text from MinIO** |
|---|---|---|
| Columns | `text` + generated stored `tsv` (CASE on `language`) | No `text`; `tsv` computed by the indexer and stored |
| Retrieval | One SQL query returns ranked passages with text; snippets via `ts_headline` | SQL ranking, then MinIO GET per distinct result book (≤ 10), verify the object hash, slice by offsets; optional bounded in-memory LRU (no persistence) |
| Failure mode | PostgreSQL only | MinIO unavailable or object hash mismatch → that book returns nothing (fail closed) |
| Extra criteria | Purge removes text rows; backup note in the runbook | MinIO fault tests; latency measured with fetch; cache bounded and content-free in logs |

**Both variants store a lexical derivative of book content in PostgreSQL.** `tsvector` holds the chunk's stemmed, accent-folded words **with positions**, which approximately reconstructs the wording. So S2 is not "content only in MinIO". It is "**verbatim text** only in MinIO". Under both variants, that derivative is in every PostgreSQL dump: 7 daily + 4 weekly on the server, plus the daily offsite copy, kept until rotation (up to about 28 days after a purge).

Exposure, latency, and storage comparison: discovery report §6.

## 6. Out of scope

- pgvector, embeddings, hybrid fusion, any provider (Stage 2).
- Meilisearch indexing of chunks.
- Wiring `TurnService` or `ContextSourcePort` (E6); conversations; library-wide Ask My Highlights; Briefs; reconstruction accounting (E6).
- **Binding the real `TextIdentityPort`** (E3).
- Reader deep links (protected); any frontend.
- Background or scheduled indexing jobs; production indexing.
- Staging, CI/CD, infrastructure, merge, deployment.
- Changes to frozen contract v1, accepted NEM-019/021/022 behaviour, `sync_maps`, or `fragments` schema.

## 7. Product rules

- Retrieval only within the session's eligible books; default deny.
- Saved quotations and notes are `user_content` (F-17), never `library`.
- Excerpts only, within budgets; never full-text export.
- No model or provider name in output.
- Indexing limitations (unindexed or stale books; cross-language matching) are disclosed as facts, never hidden.
- `BOOK TOKEN ≠ AI USAGE`.

## 8. Protected systems

Reader, Escucha Activa, **`sync_maps`** (read-only input), ownership, `user_books`, **`fragments`** (read-only; no schema change), tokens, Stripe, subscriptions, production data. NEM-019 guarantees (Context Builder invariant, turn order, F-12, default deny, **module bindings including `TEXT_IDENTITY_PORT → UnboundTextIdentityPort`**), NEM-021 frozen contract v1 and ledger, NEM-022 accepted Gateway behaviour. `app.module.ts` unchanged. Any need to touch these is a stop condition.

## 9. Technical requirements

### 9.1 Authoritative current text hash

- **Definition:** `textHash = "sha256:" + lowercase-hex(SHA-256(exact bytes of the MinIO object at books.textFileKey))`. Byte-exact, with no normalization.
- **Offsets:** Unicode code points into the UTF-8-decoded text.
- **Current value:** always obtained through `TextIdentityPort.currentTextHash(bookId)`, **never from chunk rows**. Chunks only record the hash they were built from.
- **Shared function:** one `computeTextHash` used by the indexer, E3's adapter, and future rights manifests. An architecture test enforces a single definition.
- **No module binding:** E5 does not change the module binding (NEM-019 architecture test). In the dark module nothing is eligible and retrieval returns nothing for real books. E5 tests bind a fixture port.
- **Race:** retrieval re-reads the port and returns only chunks for that hash; a changed text yields no chunks until re-indexed (fail closed).

### 9.2 Query interface and E6 boundary

- **`RetrievalPort.retrieve(req)`:**
  - `req.allowed` — non-empty `{ bookId, textHash }[]` from the caller's eligibility step;
  - `req.query` — NFC-normalized, trimmed, 1–500 code points; always a bound parameter to `websearch_to_tsquery`; empty after normalization → no passages;
  - `req.topK` — 1–20;
  - `req.budgetTokens` — ≤ 8,000.
  - It returns `{ passages, excluded: { unindexed, stale }, truncated }`.
- **`QueryContextSource.candidatesFor(userId, allowedBookIds, query)`** → `ContextItem[]`. **E6 calls it after the turn's existing eligibility step. E5 does not call it from any turn path.**
- Product code depends only on these interfaces (ADR-004). An architecture test forbids `tsvector`, `ts_rank`, or `websearch_to_tsquery` SQL outside the lexical implementation.

### 9.3 Spanish/English full-text search

- Configurations `noetia_es`, `noetia_en`, and `noetia_simple`, with `unaccent` followed by the stemmer (`simple` for the fallback). `language` comes from `books.language`; unknown values map to `simple`.
- **`tsv`:** S1 uses a generated stored column, `CASE language … to_tsvector('<config>'::regconfig, text) … END`. S2 computes it in the indexer.
- **Partial GIN per language.** The query issues one sub-query per language present in the allowed set, each with a constant configuration (index-usable), combined with `UNION ALL`.
- **Ranking:** `ts_rank_cd(tsv, q, 32)`, then `bookId`, `chunkIndex`.
- **Verified in E5 on the disposable database** before use: `unaccent` creatable by the database owner (trusted extension); generated column accepted; partial GIN indexes used (`EXPLAIN`).
- **Cross-language limitation** is documented and tested (a Spanish query over an English book matches only shared tokens).
- **If D-5 is declined:** use the core `spanish`/`english` configurations without `unaccent`, and test and disclose the accent-sensitivity limitation.

### 9.4 Scope, retention, limits

| Item | Default (D-6, D-7, D-8) | Enforcement |
|---|---|---|
| **Indexing scope** | Published, has stored text, and **passes the book-level `IndexingPermission` (§9.6)**; there is no user-level check at indexing time | Indexer check; otherwise skipped (metric `skipped_scope`) |
| **Retention** | Current and previous set per book; previous kept up to 30 days; `prune` and `purge` commands; book delete cascades | Commands; at most 2 sets per book |
| Chunk size / overlap | ≈ 1,500 characters / 10% | Configuration |
| Chunks per book | ≤ 2,000 | Over → skipped, metric |
| Total index size | ≤ 250 MB (table + indexes) | Indexer checks `pg_total_relation_size`; refuses above budget |
| Indexing | Concurrency 1; per-book transaction; per-book `statement_timeout` 60 s; manual, off-peak | Command |
| Retrieval | `statement_timeout` 2 s; target p95 ≤ 150 ms for ≤ 10 books on a fixture of 10 × the largest book | Transaction-local timeout; integration measurement |
| Query / topK / budget | ≤ 500 code points / ≤ 20 / ≤ 8,000 tokens (default top-k 8, budget 6,000) | Validation |
| User fragments scanned | ≤ 5,000 rows per query | SQL `LIMIT` |

### 9.5 General

- **Authorization:** allowed pairs and the user filter are SQL predicates, never post-filters.
- **Determinism:** the same corpus, query, and parameters give the same ranked output.
- **Budgets:** enforced before the Gateway's `prepare`, so NEM-021 reservations stay bounded.
- **Privacy:** no query or passage text in logs, metrics, errors, or persistence.

### 9.6 Book-level index permission vs user-level eligibility (C-1)

- **Two authorizations:**
  - **Indexing time (book level):** may an index of this book version be created and kept?
  - **Query time (user level):** may this user, in this session, use the book now? This is answered by the **unchanged** `RightsService.eligibility(userId, bookId, 'research_analysis')` in the caller's (E6) turn step, plus the session set.
- **No user identity in indexing.** `RightsService.eligibility` needs a `userId` and ends with an ownership check, so the indexer **never calls it, never calls `OwnershipPort`, and never fabricates or impersonates a user** (architecture test).
- **`IndexingPermission.check(bookId)`** evaluates only NEM-019's book-level steps, from the same sources. Every failure denies:
  1. current hash from `TextIdentityPort`;
  2. the `book_ai_rights` row for that hash;
  3. `status = 'verified'` and the **exported** `isCompleteRecord` / `isWellFormedRecord` (reused, not re-implemented);
  4. `permittedOperations` includes **`retrieval_indexing`** (an explicit, distinct grant to store an index; data in the existing column, so no schema change);
  5. `reviewDate` not past;
  6. `RightsVerificationAuthorityPort.attest(...) === 'attested'`.
- **Default deny.** Any missing input, error, or non-`attested` answer means no chunks. With the current unbound ports, nothing is indexable.
- **Parity test.** `IndexingPermission` denies whenever `RightsService.eligibility` denies with a book-level reason, and additionally requires `retrieval_indexing`.
- **At query time:** `QueryContextSource` also re-checks `IndexingPermission` for each allowed book (cached per request). A book that no longer passes is excluded (`index_not_permitted`) and flagged for `purge`.
- Index permission never makes a book usable, and ownership never makes a book indexable.
- **NEM-019 code and bindings are unchanged.**

## 10. Security / privacy / copyright

- Chunk text storage per D-4; exposure trade-offs in discovery report §6. The runbook records the backup implication of the approved variant.
- Fixtures: invented or public-domain text only.
- Retrieved text reaches the Gateway only as delimited context data (accepted NEM-022 rule).
- Deletion: chunks are book-level (cascade); user content is read from `fragments` at query time; revocation → `purge`.

## 11. Acceptance criteria (proposed)

1. **Allowed set only.** Retrieval returns only chunks whose (`bookId`, `textHash`) is in `allowed`. An empty set or empty query is rejected or returns nothing. Adversarial tests (other books, other hashes, SQL-meta characters in the query) never leak, proven at SQL level.
2. **Stale never served.** After a simulated text replacement, chunks of the old hash are never returned, and the anchor resolver refuses old refs while the current hash differs.
3. **Hash authority.** The current hash always comes from `TextIdentityPort`. Changing only chunk rows cannot make a book retrievable (test). `computeTextHash` has a single definition. The module binding of `TEXT_IDENTITY_PORT` is unchanged.
4. **Two authorizations (C-1).**
   - A book is indexed only if `IndexingPermission` passes: verified, complete, well-formed, current hash, `retrieval_indexing` granted, not past review, attested. Every failure case and the unbound-port case create no chunks.
   - The indexer never calls `RightsService.eligibility` or `OwnershipPort` and uses no user identity (architecture test).
   - The parity test with `RightsService` book-level denials passes.
   - At query time, books failing user-level eligibility (unchanged `RightsService`) or current index permission return no passages.
5. **User isolation.** Highlight and note results contain only the requesting user's rows for allowed books. The `fragments` schema is unchanged.
6. **Anchors.** For every passage, `codePointSlice(sourceText, charStart, charEnd) == passage.text` under the recorded hash. Derived phrase ranges are consistent when a sync map exists.
7. **Full-text quality.** Accent-insensitive Spanish and English matching (with D-5), stemming, and stop words on fixtures. The partial GIN indexes are used. The cross-language limitation is documented by test.
8. **End to end (test code):** eligibility → `QueryContextSource` → unchanged Context Builder → accepted Gateway and simulator. `library` segments cite retrieved chunk refs and pass NEM-022's citation policy; a citation to a non-retrieved ref is a scope violation. **No `TurnService` or `ContextSourcePort` change.**
9. **Budgets and cost:** the context budget is never exceeded; NEM-021 reservations reflect the budgeted context.
10. **Limits:** every §9.4 limit is enforced fail-closed and measured; indexing is idempotent and transactional (a crash leaves no partial set); `sync_maps`, reader data, and `fragments` are byte-unchanged; `prune` and `purge` behave as specified.
11. **Storage variant (D-4):** the variant's extra criteria in §5.1 pass. Under either variant, `purge` removes all `tsvector` (and S1 text) rows for the book, and the runbook records that PostgreSQL dumps retain the lexical derivative until rotation.
12. **Regression:** all NEM-019, NEM-021, and NEM-022 suites pass unchanged; migrations run up and down; architecture and privacy tests pass; no provider, network, or credential use.

## 12. Required tests

- **Unit (≥ 80%):** chunker (boundaries, code-point offsets, Unicode, headings, overlap), `computeTextHash`, indexer (mocks; scope; limits; idempotency), retrieval (validation, budget), `QueryContextSource`, anchor resolver.
- **Integration (disposable PostgreSQL 16 + Redis):** allowed-pair and stale SQL filters, user isolation, eligibility, full-text configurations and `EXPLAIN` index use, migration up/down, crash safety, prune/purge, end-to-end citation flow, latency on a sized fixture, and the D-4 variant tests.
- **Architecture and security:** retrieval-technology isolation, single `computeTextHash`, no turn or port wiring, no content logging, no provider/HTTP/SDK, `sync_maps` and `fragments` read-only.
- **Regression:** NEM-019, NEM-021 (contract, ledger), NEM-022.

## 13. Observability

The §5.9 counters, no content labels, no dashboards while dark. The completion report records index size, indexing time, and retrieval latency.

## 14. Deployment / rollout

None. Branch and Draft PR only. Any production indexing would be a later, separately authorized operation (after E3 binding, rights attestation, merge, and a snapshot).

## 15. Documentation deliverables

Technical-note section (architecture, schema, hash mechanism, full-text configurations, runbook for index/prune/purge, limits), migration entries, completion report with raw output, Stage 2 extension points.

## 16. Open decisions (PO)

| ID | Decision | Recommended default | If declined |
|---|---|---|---|
| D-1 | TT-25 | Lexical at launch, vector-ready interface | Semantic now needs an image change and an embedding provider |
| D-2 | E5/E6 boundary | E5 dark components; E6 wires turns | E5 needs authority for NEM-019 changes |
| D-3 | Text-hash mechanism | SHA-256 of MinIO bytes; shared function; E3 binds | E5 binds (NEM-019 test exception) |
| D-4 | Chunk text storage | **No default: PO (with legal input if wanted).** Both S1 and S2 store a lexical derivative (`tsvector`) in PostgreSQL and its dumps; S1 adds verbatim text | — |
| D-5 | `unaccent` extension | Yes | Accent-sensitive matching |
| D-6 | Indexing scope and permission | Book-level `IndexingPermission` with an explicit `retrieval_indexing` grant; default deny | Reuse `research_analysis` (no separate grant to store an index), or index all published books (derived content stored for uncleared books) |
| D-7 | Retention | Current + previous, 30 days; purge on revocation | More storage and exposure |
| D-8 | Limits and defaults | §9.4 | Other values |
| D-9 | Identifier | PO reserves | — |

## 17. Stop conditions

- pgvector, embeddings, a provider, network, or credentials appear necessary.
- A change to `TurnService`, `ContextSourcePort`, module port bindings, `sync_maps`, `fragments` (schema or writes), frozen contract v1, or accepted NEM-022 behaviour appears necessary.
- A NEM-019, NEM-021, or NEM-022 test must change to pass.
- Authorization cannot be expressed as SQL predicates.
- Book-level index permission cannot be established without a user identity or without changing NEM-019 code or bindings.
- `unaccent`, the generated column, or index use cannot be verified on the disposable database (escalate; do not improvise).
- A product or legal value (D-4) would need to be assumed.

## 18. Completion report

Per the README standard: raw test output, measured index size, indexing time, retrieval latency, limit evidence, and Stage 2 notes.

## 19. Product Architecture review

`REVIEW-CHECKLIST.md`. Completion requires review and PO acceptance.
