# NOETIA ENGINEERING MISSION — NEM-### (E5) — identifier pending PO reservation
## Knowledge Retrieval and Grounding (Stage 1: lexical, provider-independent)

**Status:** DRAFT — **not executable** (governance README: a DRAFT mission is never executed)
**Mission type:** IMPLEMENTATION (proposed)
**Implementation authorization:** NONE (requires PO approval of this specification **and** a separate execution instruction)
**Schema changes:** ADDITIVE ONLY (proposed: one new table, and optionally the `unaccent` contrib extension, pending D-5), applied to disposable test databases only
**Infrastructure changes:** NOT AUTHORIZED (none needed: no image change, no new service)
**Production deployment:** NOT AUTHORIZED (staging and merge to `main` also NOT AUTHORIZED)
**Product Owner approval:** REQUIRED

> Drafted under the PO instruction *"E5 Discovery and Engineering Mission Draft"* (2026-11-09). Evidence and alternatives: [E5 discovery report](../../reports/2026-11-09-E5-retrieval-discovery-report.md).

---

## 1. Context

NEM-019 provides sessions, rights eligibility, the Context Builder invariant, and an empty `ContextSourcePort`. NEM-021 provides the cost ledger; NEM-022 the accepted Gateway v2 with citation enforcement. **No retrieval exists** (discovery §2.3). Models therefore receive no book content.

ADR-004 approves PostgreSQL + pgvector as the future vector store behind a mandatory retrieval interface. Production PostgreSQL has no pgvector, and the PO strategy keeps paid AI off until the launch gate. E5 Stage 1 delivers grounded retrieval with **no provider, no new infrastructure, and no cost**.

## 2. Objective

Retrieve relevant, citable passages from the books a user may use in a session, and the user's own highlights and notes, and supply them as verified context through the existing Context Builder to the accepted Gateway. Retrieval is lexical (PostgreSQL full-text search) behind a technology-neutral `RetrievalPort`, so Stage 2 (pgvector or hybrid) can replace or augment it without domain changes.

**Done** = every §11 criterion proven on disposable databases with fixture texts.

## 3. Dependencies

- **Prerequisite decisions:**
  - **TT-25 closed** (D-1; recommended: lexical at launch);
  - D-2 to D-7 decided by the PO and Product Architecture;
  - identifier reserved (D-8).
- **Code:** NEM-022 accepted (Gateway v2), NEM-021 (ledger), NEM-019 (rights, Context Builder). Built on the NEM-022 branch stack, not on `main`.
- **E3 alignment:** E5 computes the text hash with one shared function behind the `TextIdentityPort` shape (D-3); E3 must reuse it.
- **Not required:** pgvector, an embedding provider, staging, CI changes, any paid service.
- **Test environment:** disposable `postgres:16-alpine` + Redis (the existing harness), within the VM limits (`--maxWorkers=2`, one heavy job at a time).

## 4. Source-of-truth references

ADR-002 (permission-aware), ADR-003 (source modes), **ADR-004** (store, interface, exact-first, chunks separate from sync phrases), ADR-005, **ADR-006** (allowed set, Context Builder invariant, trust boundary) · 03 research architecture (retrieval contract rules 6–8, permission pipeline, traceable citations, origins) · 02 reconciliation X-3 (anchor = `textHash` + character range) · P0 packet E5 row, TT-25 · NEM-019 technical note §1–§9, §11 (ledger), §12 (Gateway v2).

## 5. In scope

Only under `services/api` (plus tests and docs):

1. **Migration (additive, ≥ 075).** Table `ai_book_chunks`:
   - **Identity:** `id` (uuid), `bookId` (FK `books` `ON DELETE CASCADE`), `chunkIndex`.
   - **Anchors:** `textHash` (the source text version), `charStart`, `charEnd` (authoritative X-3 anchor), `phraseIndexStart`/`End` (derived, nullable).
   - **Content:** `chapterLabel` (nullable, from heading phrases), `language`, chunk `text` (pending D-4), a generated `tsvector` column with the language configuration, and a GIN index.
   - **Constraints:** a unique (`bookId`, `textHash`, `chunkIndex`). No user columns.
   - **Extension:** `unaccent`, only if D-5 approves.
2. **Chunker (pure, deterministic):**
   - book text plus optional sync phrases → chunks of configurable size and overlap, preferring paragraph and sentence boundaries, never splitting inside a word;
   - character offsets exact against the source text;
   - headings → chapter labels; phrase ranges derived when a sync map exists (read-only).
3. **Indexer (offline):**
   - a script or low-concurrency job, run per book;
   - reads the MinIO text and computes `textHash` (D-3);
   - writes one complete chunk set per (`bookId`, `textHash`) in a single transaction; idempotent; skips an existing set;
   - **never touches sync maps or the reader**;
   - old chunk sets are kept while referenced, then pruned by an explicit command.
4. **`RetrievalPort` (technology-neutral)** — `retrieve({ allowedBookIds, query, language?, topK, budgetTokens })` returns ranked `RetrievedPassage { chunkId, bookId, textHash, charStart, charEnd, chapterLabel, phraseRange?, text, score }`:
   - `allowedBookIds` is **required and non-empty**; there is no "all books" form;
   - the filter is applied **inside the SQL**, together with `textHash = current text hash` (stale chunks are never returned).
5. **Lexical implementation:** `websearch_to_tsquery` on the book's language configuration (Spanish and English), `ts_rank_cd`, deterministic tie-breaking, top-k, then trimmed to the context budget.
6. **Highlight and note retrieval:** lexical search over the **requesting user's own** `fragments` (`text`, `note`), restricted to the allowed set and returned as `highlight` / `note` items. Library-wide Ask My Highlights (PO-028) is E6.
7. **Context source adapter:** `RetrievalContextSource implements ContextSourcePort` maps passages to `ContextItem { kind: 'chunk', ref: chunkId, bookId, text }` and highlights/notes to `{ kind: 'highlight' | 'note', userId, … }`, under a total **context token budget**. Binding it in the module **replaces `EmptyContextSource` only behind the existing dark flag**. Query input per D-2: an explicit query parameter on the adapter; turn wiring of the user question is E6.
8. **Citation integrity:**
   - each chunk ref resolves to a persisted chunk of the allowed set with a current `textHash`;
   - a resolver returns the X-3 anchor and the derived phrase range for display;
   - Gateway citations (accepted NEM-022 policy) reference these refs; the anchor string carries `textHash:charStart-charEnd`.
9. **Metrics (no content labels):** `intelligence_retrieval_total{outcome}`, `intelligence_retrieval_passages` (histogram), `intelligence_retrieval_stale_excluded_total`, `intelligence_index_chunks_total`.
10. **Tests (§12), a technical-note section, migration entries, and a completion report.**

## 6. Out of scope

- pgvector, embeddings, hybrid fusion, any embedding or model provider (Stage 2, a separate mission after TT-25/PO-005 and an infrastructure mission).
- Meilisearch indexing of chunk text.
- `TurnService` user-question wiring, conversations, Ask My Highlights across the library, Briefs (E6).
- Reconstruction accounting (E6).
- Reader deep links (a protected-system change).
- Any frontend, staging, CI/CD, infrastructure, merge, or deployment.
- Changes to frozen contract v1 or to accepted NEM-022 behaviour.

## 7. Product rules

- Retrieval only within the session's eligible books (ADR-006); default deny.
- Saved quotations are assertions, labelled `user_content` (F-17).
- Excerpts only, within budgets; never full-text export.
- No model or provider name in customer-visible output.
- `BOOK TOKEN ≠ AI USAGE`.

## 8. Protected systems

Reader, Escucha Activa, **sync maps** (read-only input), ownership, `user_books`, `fragments` (read-only), tokens, Stripe, subscriptions, production data, NEM-019/021/022 guarantees (Context Builder invariant, turn order, ledger, Gateway citation policy), frozen contract v1. `app.module.ts` unchanged. Any need to change these is a stop condition.

## 9. Technical requirements

- **Retrieval abstraction:** product code depends only on `RetrievalPort` (ADR-004 guardrail; architecture test: no `tsvector`/`ts_rank`/`vector` SQL outside the lexical implementation).
- **Authorization:** the allowed set and the current-hash filter are SQL predicates, not post-filters. The empty set is rejected. Rights are always evaluated by the existing `RightsService` before retrieval.
- **Isolation:** highlight and note queries constrain `userId` in SQL; one user's rows never appear for another.
- **Determinism:** the same corpus, query, and parameters give the same ranked output (stable tie-breakers).
- **Budgets:** `topK` and `budgetTokens` are configurable (D-7 defaults). Budgets are enforced before the Gateway's `prepare`, so NEM-021 worst-case reservations stay bounded.
- **Indexing safety:** offline, transactional per book, idempotent, resumable, low concurrency; no impact on the reader path.
- **Privacy:** no query or passage text in logs, metrics, or errors.
- **Performance targets** (to be validated with a production-sized fixture; proposed): retrieval p95 ≤ 150 ms for ≤ 10 books on the disposable database; indexing ≤ 30 s per median book.

## 10. Security / privacy / copyright

- Chunk text storage per D-4 (PO/legal) — backup-exposure change noted.
- No customer content in fixtures (invented or public-domain texts only).
- Injection: retrieved text enters the Gateway only as delimited context data (accepted NEM-022 rule).
- Deletion: chunks are book-level (cascade on book delete); user content is read from `fragments` at query time, so account deletion needs no new step.

## 11. Acceptance criteria (proposed)

1. Retrieval returns only chunks of books in `allowedBookIds`. An empty set is rejected. A chunk from any other book is never returned, proven by SQL-level tests including adversarial queries.
2. A chunk whose `textHash` differs from the current text hash is never returned (stale-index test after a simulated re-ingestion).
3. Ineligible books (unverified, revoked, stale rights, non-owned licensed) produce no passages. Eligibility comes from the unchanged `RightsService`.
4. Highlight and note retrieval returns only the requesting user's rows for allowed books; other users' rows never appear.
5. Every passage carries a valid X-3 anchor: `text == sourceText.slice(charStart, charEnd)` for the recorded `textHash`; the derived phrase range is consistent when a sync map exists.
6. End to end with the accepted Gateway and simulator: retrieved chunks pass the Context Builder invariant; `library` segments cite retrieved chunk refs and pass the NEM-022 citation policy; a citation to a non-retrieved ref is a scope violation.
7. The context budget is never exceeded, and NEM-021 reservations reflect the budgeted context (no overrun from retrieval).
8. Indexing is idempotent and transactional (a crash mid-book leaves no partial set). Sync maps, reader data, and fragments are byte-unchanged.
9. Ranking is deterministic and the lexical quality floor holds on fixtures (ES and EN known-answer queries).
10. All NEM-019, NEM-021, and NEM-022 suites pass unchanged; migrations run up and down; architecture and privacy tests pass; no provider, network, or credential use.

## 12. Required tests

- **Unit (≥ 80%):** chunker (boundaries, offsets, headings, overlap, Unicode), indexer (mocks), retrieval service, context-source adapter, budget trimming, anchor resolver.
- **Integration (disposable PostgreSQL 16 + Redis):** allowed-set and stale-hash SQL filters, user isolation, rights eligibility end to end, migration up/down, indexing idempotency and crash safety, Gateway end-to-end citation flow, latency on a sized fixture.
- **Architecture and security:** retrieval-technology isolation, no content logging, no provider/HTTP/SDK, sync-map read-only.
- **Regression:** NEM-019, NEM-021 contract and ledger, NEM-022 suites.

## 13. Observability

The §5.9 counters. No content labels. No dashboards while dark.

## 14. Deployment / rollout

None. Branch and Draft PR only. Production indexing, if later authorized, would be a separate operational step after merge (with a snapshot).

## 15. Documentation deliverables

Technical-note section (retrieval architecture, chunk schema, indexing runbook), migration entries, completion report with raw test output, Stage 2 extension points.

## 16. Open decisions

D-1 (TT-25) · D-2 (query input) · D-3 (text hash source) · D-4 (chunk text storage, legal) · D-5 (`unaccent`) · D-6 (indexing scope) · D-7 (chunk and budget defaults) · D-8 (identifier). Details and recommendations: discovery report §4.

## 17. Stop conditions

- pgvector, embeddings, a provider, network, or credentials appear necessary.
- A change to sync maps, the reader, `fragments` writes, frozen contract v1, or accepted NEM-022 behaviour appears necessary.
- A NEM-019, NEM-021, or NEM-022 test must change to pass.
- Authorization cannot be expressed as a query-level filter.
- A product or legal value (D-4) would need to be assumed.

## 18. Completion report

Per the README standard: raw test output, measured index size, indexing time, retrieval latency, and the Stage 2 interface notes.

## 19. Product Architecture review

`REVIEW-CHECKLIST.md`. Completion requires review and PO acceptance.
