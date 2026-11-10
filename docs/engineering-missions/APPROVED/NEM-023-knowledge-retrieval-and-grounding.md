# NOETIA ENGINEERING MISSION — NEM-023 (E5)
## Knowledge Retrieval and Grounding (Stage 1: lexical, provider-independent)

**Status:** **COMPLETED — ACCEPTED WITH OPEN EXCEPTIONS (PO, 2026-11-10)** as a completed, disconnected development implementation (PR #53, reviewed commit `c5153ed`). **Open exceptions E-1 (retrieval p95 594 ms vs 150 ms) and E-2 (global API branch coverage 78.75% vs 80%) — not waived, relaxed, or satisfied.** Not merged, not deployed; production indexing blocked ([report §18](../../reports/2026-11-10-NEM-023-knowledge-retrieval-report.md#18-product-owner-acceptance-record-2026-11-10)).

> **Product Owner acceptance (2026-11-10):** *"NEM-023 Product Owner Acceptance Record — ACCEPTED WITH OPEN EXCEPTIONS"*.
> - **Accepted:** the approved development scope only (as amended by Amendment 1), at PR #53 commit `c5153ed`. Dark, disconnected: no module binding, no turn wiring.
> - **E-1 — retrieval performance:** p95 **594 ms** against the **150 ms** target (§9.4). **Open.**
> - **E-2 — global API branch coverage:** **78.75%** against the **80%** threshold. **Open.**
> - Neither requirement is waived, relaxed, or considered satisfied. Neither may be closed without new evidence and a separate decision.
> - **Verified-text cache:** removed after the PA follow-up (`cf64287`) and **remains absent**; every retrieval re-reads and re-verifies the MinIO object.
> - **Production-indexing blockers preserved (§14):** RB-1 (PO-029 corpus), RB-2 (TT-26 legal evidence standard), RB-3 (E3 adapters; verified, attested `retrieval_indexing` records), RB-5 (author opt-in / D6), RB-6 (legal position on the `tsvector` derivative), RB-7 (offsite backup retention), plus governance (merge, deployment, `unaccent` enablement, snapshot).
> - **Not authorized:** merge, deployment, production indexing, paid AI services, E6.
**Identifier:** `NEM-023`, reserved by the PO on 2026-11-10 ([PO-033](../../operating-framework/decisions/product-owner/PO-033-e5-knowledge-retrieval-decisions-and-nem-023-reservation.md))
**Mission type:** IMPLEMENTATION (proposed)
**Implementation authorization:** **GRANTED 2026-11-10** (PO *"EXECUTE NEM-023"*, reviewed specification `54ad768`): checkpoints A–C within the exact scope and stop conditions, **as amended by Amendment 1** (B-1, B-2) and the B-3 test exception
**Schema changes:** ADDITIVE ONLY (proposed: one table **without verbatim text** (S2), three text-search configurations, and the `unaccent` contrib extension if D-5 is approved), on disposable test databases only
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
> **Execution authorization (2026-11-10):** PO *"EXECUTE NEM-023 — Product Owner Authorization: GRANTED"*.
> - Execute **NEM-023** under the exact scope, checkpoints (A, B, C), restrictions, and stop conditions; reviewed specification commit `54ad768`.
> - Not authorized: merge, staging or production deployment, production indexing, production or staging credentials or data, paid or external AI, infrastructure or CI/CD, changes to protected NEM-019/021/022 contracts or behaviour, E6, scope expansion.
> - *"If any approved stop condition is triggered, stop immediately and report the blocker."*
> - Branch: `feat/nem-023-knowledge-retrieval`.
>
> **Amendment 1 (PO *"NEM-023 RESUME AUTHORIZATION — APPROVED"*, 2026-11-10): B-1, B-2, and B-3 Option A.**
> - **B-1 — user highlights and notes move to E6.** E5 returns **book passages only**. §5.6 is removed from E5 scope; `QueryContextSource` emits `chunk` items only. NEM-019's protections for `fragments` (architecture tests AC-10/17, AC-16/17) are **unchanged**. E6 is not implemented here.
> - **B-2 — no `sync_maps` input in Stage 1.** `chapterLabel`, `phraseIndexStart`, and `phraseIndexEnd` stay **nullable and unpopulated (NULL)**. `textHash`, Unicode code-point offsets, and citation correctness are preserved. E5 neither reads nor modifies `sync_maps`; filling these columns later needs its own approved path.
> - **B-3 — one intent-preserving amendment** of `tests/integration/knowledge/cost-migration.int-spec.ts` (NEM-021 AC-13): revert migrations newer than 074 first, then 074 and 073 **by name**, every existing assertion preserved; committed separately from E5 code and verified green on disposable PostgreSQL **before** Checkpoint A. No other protected test may change.
> - Sections changed by this amendment are marked *(Amendment 1)*.
>
> **Pre-execution result (2026-11-10): BLOCKED** (all three verified by probes; resolved by Amendment 1):
> - **B-1:** §5.6 needs `fragments`; NEM-019 architecture tests forbid it.
> - **B-2:** §5.2 needs `sync_maps`; same test.
> - **B-3:** any migration ≥ 075 fails the NEM-021 `cost-migration` AC-13 test.
>
> Options and recommendations: [report §6](../../reports/2026-11-10-NEM-023-knowledge-retrieval-report.md).

> **Revision 5 — final specification** (2026-11-10, PO *"NEM-023 Product Owner Approval and Mission Finalization"*):
> - Product decisions D-1, D-4, D-6, D-7, D-9 recorded as **DECIDED** ([PO-033](../../operating-framework/decisions/product-owner/PO-033-e5-knowledge-retrieval-decisions-and-nem-023-reservation.md)); identifier NEM-023 reserved.
> - D-7 made concrete: at most one previous set, a hard 30-day maximum, removed sooner (§9.4); revocation blocks retrieval immediately, plus active-index purge.
> - Compatibility of `retrieval_indexing` verified: no NEM-019 or contract-v1 change, no exception required (§9.7).
> - Production-indexing prerequisites made explicit (§14).
>
> **Revision 4** (2026-11-10, PO direction *"E5 Product Owner Direction and Final Rights Review"*):
> - **D-4: S2 selected in principle, subject to rights verification.** Original text stays in MinIO; PostgreSQL holds ids, offsets, hashes, metadata, and `tsvector`; S1 is out of scope.
> - `retrieval_indexing` is confirmed as an explicit book-level permission.
> - Rights blockers RB-1 to RB-7 gate **production indexing**.
> - Backup implications: purge does not reach offsite copies.
> - Decision classification; identifier **NEM-023** proposed.
>
> Packet: [E5 Product Owner decision packet](../../reports/2026-11-10-E5-product-owner-decision-packet.md).
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

Provide **dark, unwired** retrieval components that, given an allowed set already produced by the existing eligibility step and a query, return ranked, budget-bounded, citable **book passages** *(Amendment 1: the user's own highlights and notes are E6 scope)*. E6 will wire these components into turns through the unchanged Context Builder and the accepted NEM-022 Gateway.

**Done** = every §11 criterion proven on disposable databases with fixture texts.

## 3. Dependencies

- **Decisions before approval:** D-1 (TT-25) to D-9 (§16).
- **Code:** NEM-022 (Gateway v2), NEM-021 (ledger), NEM-019 (rights, Context Builder). Built on the NEM-022 branch stack, not `main`. *Reconciliation (2026-11-10):* when this specification was written, NEM-022 was described as "accepted" without a recorded decision (it was then returned for PA re-review). The PO **recorded NEM-022's acceptance on 2026-11-10 at commit `f6a5cb7`** after PA re-review ([NEM-022 report §20](../../reports/2026-11-09-NEM-022-gateway-simulator-v2-report.md#20-product-architecture-re-review-outcome-and-product-owner-acceptance-2026-11-10)). NEM-023 was built on exactly that commit (`f6a5cb7` is an ancestor of `6c4b08e`; no `services/` change between `f6a5cb7` and the NEM-023 base `54ad768`), so references below to the "accepted" Gateway now match the record. NEM-023's own status (accepted with open exceptions E-1, E-2) is unchanged.
- **E3:** E5 adds or reuses the single `computeTextHash` function. **Binding the real `TextIdentityPort` adapter in the module is E3's step**, not E5's (§9.1).
- **E6:** consumes `QueryContextSource` (§9.2).
- **PO decisions:** [PO-033](../../operating-framework/decisions/product-owner/PO-033-e5-knowledge-retrieval-decisions-and-nem-023-reservation.md).
- **Rights blockers (decision packet §3, RB-1 to RB-3 and RB-5 to RB-7; RB-4 resolved by PO-033)** gate **production indexing**, not fixture implementation: PO-029 undecided, TT-26 open, no verified records, `retrieval_indexing` vocabulary adoption, author opt-in and D6, legal treatment of the `tsvector` derivative for licensed titles, offsite backup retention.
- **Not required:** pgvector, an embedding provider, staging, CI changes, any paid service.
- **Test environment:**
  - isolated, **local, disposable** PostgreSQL 16 (`postgres:16-alpine`) and Redis containers (the existing harness);
  - a **local MinIO-compatible fixture** for S2 text reads: an in-process fake object store, or a disposable local MinIO container created for the run and removed afterwards;
  - VM limits (`--maxWorkers=2`, one heavy job at a time);
  - network rules in §9.5.

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
     - **Metadata:** `phraseIndexStart` and `phraseIndexEnd` (nullable); `chapterLabel` (nullable) — **all three NULL in Stage 1** *(Amendment 1, B-2)*; `language` (`es` | `en` | `simple`).
     - **Search:** `tsv` tsvector.
     - **Constraints:** UNIQUE (`bookId`, `textHash`, `chunkIndex`); CHECK `charStart < charEnd`.
     - **Indexes:** partial GIN on `tsv` per language; btree (`bookId`, `textHash`). No user columns.
   - **Storage: S2 (selected, §5.1).** No verbatim chunk text column; `tsv` is computed by the indexer from the MinIO text and stored.
2. **Chunker (pure, deterministic):**
   - book text → chunks *(Amendment 1, B-2: no sync-phrase input; no chapter labels or phrase ranges in Stage 1)*;
   - configurable size and overlap (D-8); prefers paragraph and sentence boundaries; never splits a word;
   - exact code-point offsets.
3. **Indexer (explicit command, offline):**
   - per book: **establish book-level index permission (§9.6; default deny)**; read the MinIO text; `textHash = computeTextHash(bytes)`, which must equal the hash the permission was granted for; chunk; write **one complete set in one transaction**;
   - idempotent (skips an existing set), resumable, concurrency 1, enforces the §9.4 limits;
   - **never writes sync maps, fragments, or reader data.**
   - Commands: `index <bookId|all>`, `prune` (non-current sets past grace), `purge <bookId>` (immediate).
4. **`computeTextHash`:** one shared pure function under `knowledge/rights/` (§9.1), with unit tests, if not already added by E3.
5. **`RetrievalPort` + lexical implementation** (§9.2, §9.3): per-language sub-queries with constant configurations, the allowed `(bookId, textHash)` pairs as SQL predicates, `ts_rank_cd` with deterministic tie-breaks, top-k, and budget trimming.
6. ~~**User content search**~~ — **moved to E6** *(Amendment 1, B-1)*. E5 does not read `fragments`.
7. **`QueryContextSource`** (§9.2): resolves current hashes through `TextIdentityPort`, calls `RetrievalPort`, and maps the results to NEM-019 `ContextItem`s (`chunk` only, with `text`) under a total context-token budget. **It is not bound to `ContextSourcePort`, and `TurnService` is unchanged.**
8. **Anchor resolver:** chunk ref → `{ bookId, textHash, charStart, charEnd, chapterLabel, phraseRange }` (`chapterLabel` and `phraseRange` are `null` in Stage 1, *Amendment 1*). It verifies the hash still equals the current text hash (otherwise the ref is unresolvable). Gateway citation anchors carry `textHash:charStart-charEnd`.
9. **Metrics (no content labels):** `intelligence_retrieval_total{outcome}`, `intelligence_retrieval_passages` (histogram), `intelligence_retrieval_excluded_total{reason}` (`stale` | `unindexed`), `intelligence_index_books_total{outcome}` (`indexed` | `skipped_scope` | `skipped_limit` | `exists`).
10. **Tests (§12), technical-note section, migration entries, completion report.**

### 5.1 Storage (D-4 — **S2 selected in principle by the PO, subject to rights verification**)

Only S2 is built. S1 is shown for the record and is **out of scope**.

| | S1 — chunk text in PostgreSQL (**not selected**) | **S2 — offsets + `tsvector` only; text from MinIO (selected)** |
|---|---|---|
| Columns | `text` + generated stored `tsv` (CASE on `language`) | No `text`; `tsv` computed by the indexer and stored |
| Retrieval | One SQL query returns ranked passages with text; snippets via `ts_headline` | SQL ranking, then MinIO GET per distinct result book (≤ 10), verify the object hash, slice by offsets; optional bounded in-memory LRU (no persistence) |
| Failure mode | PostgreSQL only | MinIO unavailable or object hash mismatch → that book returns nothing (fail closed) |
| Extra criteria | Purge removes text rows; backup note in the runbook | MinIO fault tests; latency measured with fetch; cache bounded and content-free in logs |

**Both variants store a lexical derivative of book content in PostgreSQL.** `tsvector` holds the chunk's stemmed, accent-folded words **with positions**, which approximately reconstructs the wording. So S2 is not "content only in MinIO". It is "**verbatim text** only in MinIO". Under S2, that derivative is in every PostgreSQL dump. **After a purge:**
- **on-server** PostgreSQL dumps keep it until they rotate out under the existing retention (7 daily + 4 weekly, about 28 days);
- **offsite** copies currently have **no automatic pruning** and **may persist indefinitely**.

That is why **RB-7 remains a production-indexing blocker** (§14).

Exposure, latency, and storage comparison: discovery report §6.

## 6. Out of scope

- pgvector, embeddings, hybrid fusion, any provider (Stage 2).
- Meilisearch indexing of chunks.
- Wiring `TurnService` or `ContextSourcePort` (E6); conversations; library-wide Ask My Highlights; **user highlight and note retrieval** *(Amendment 1, B-1)*; Briefs; reconstruction accounting (E6).
- Populating `chapterLabel` / phrase ranges; any read of `sync_maps` *(Amendment 1, B-2)*.
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

Reader, Escucha Activa, **`sync_maps`** (not read in Stage 1, *Amendment 1*), ownership, `user_books`, **`fragments`** (not read by E5, *Amendment 1*), tokens, Stripe, subscriptions, production data. NEM-019 guarantees (Context Builder invariant, turn order, F-12, default deny, **module bindings including `TEXT_IDENTITY_PORT → UnboundTextIdentityPort`**), NEM-021 frozen contract v1 and ledger, NEM-022 accepted Gateway behaviour. `app.module.ts` unchanged. Any need to touch these is a stop condition.

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
- **`tsv`** (S2): the indexer computes `to_tsvector('<config>'::regconfig, <chunk text read from MinIO>)` and stores it. There is no generated column, because there is no text column.
- **Partial GIN per language.** The query issues one sub-query per language present in the allowed set, each with a constant configuration (index-usable), combined with `UNION ALL`.
- **Ranking:** `ts_rank_cd(tsv, q, 32)`, then `bookId`, `chunkIndex`.
- **Verified in E5 on the disposable database** before use:
  - `unaccent` can be created by the database owner (trusted extension);
  - `noetia_es`, `noetia_en`, and `noetia_simple` produce the expected lexemes (accent folding, stemming, stop words) on ES and EN fixtures;
  - the `tsvector` the indexer stores equals `to_tsvector('<config>', <chunk text>)` for the MinIO text;
  - the partial GIN indexes are used (`EXPLAIN`).
- **Cross-language limitation** is documented and tested (a Spanish query over an English book matches only shared tokens).
- **If D-5 is declined:** use the core `spanish`/`english` configurations without `unaccent`, and test and disclose the accent-sensitivity limitation.

### 9.4 Scope, retention, limits

| Item | Default (D-6, D-7, D-8) | Enforcement |
|---|---|---|
| **Indexing scope** | Published, has stored text, and **passes the book-level `IndexingPermission` (§9.6)**; there is no user-level check at indexing time | Indexer check; otherwise skipped (metric `skipped_scope`) |
| **Retention (D-7, decided)** | The **current set and at most one previous set** per book. The previous set is removed **as soon as it is unnecessary**: by default at the first `prune` after the current set is complete **and** a configurable in-flight window (`previousSetGraceHours`, default 24) has elapsed. It is **never kept beyond 30 days** (a hard cap; not configurable). Book delete cascades | The indexer refuses to create a third set (old sets are pruned first); `prune` deletes previous sets past the window and **unconditionally past 30 days**; tests assert both bounds |
| **Revocation (D-7, decided)** | **Blocks retrieval immediately**: once the record is no longer `verified` with `retrieval_indexing` for the current hash, the query-time `IndexingPermission` re-check (and user-level eligibility) fail, so no passage is returned, **even before purge**. Revocation **requires purging the active index**: `purge <bookId>` removes every set (current and previous) | Tests: retrieval returns nothing right after revocation with chunks still present; after `purge`, zero rows remain for the book; the runbook gives the operator steps |
| Chunk size / overlap | ≈ 1,500 characters / 10% | Configuration |
| Chunks per book | ≤ 2,000 | Over → skipped, metric |
| Total index size | ≤ 250 MB (table + indexes) | Indexer checks `pg_total_relation_size`; refuses above budget |
| Indexing | Concurrency 1; per-book transaction; per-book `statement_timeout` 60 s; manual, off-peak | Command |
| Retrieval | `statement_timeout` 2 s; target p95 ≤ 150 ms for ≤ 10 books on a fixture of 10 × the largest book | Transaction-local timeout; integration measurement |
| Query / topK / budget | ≤ 500 code points / ≤ 20 / ≤ 8,000 tokens (default top-k 8, budget 6,000) | Validation |
| ~~User fragments scanned~~ | E6 scope *(Amendment 1)* | — |

### 9.5 General

- **Authorization:** allowed pairs and the user filter are SQL predicates, never post-filters.
- **Determinism:** the same corpus, query, and parameters give the same ranked output.
- **Budgets:** enforced before the Gateway's `prepare`, so NEM-021 reservations stay bounded.
- **Privacy:** no query or passage text in logs, metrics, errors, or persistence.
- **Network and credentials:**
  - **Permitted:** isolated tests may connect only to local, disposable PostgreSQL, Redis, and MinIO-compatible fixtures created for the test run.
  - **Prohibited:**
    - production credentials (e.g. `.env.production` or server secrets);
    - connections to production or staging systems (databases, MinIO, Redis, APIs);
    - external AI providers or SDKs;
    - paid services;
    - any other external network call.
  - S2 text reads go through a book-text port: its runtime adapter is the existing `StorageService`, and tests bind the local fixture. No HTTP client or provider SDK in `knowledge/*` (NEM-019 architecture test).

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

### 9.7 Compatibility of `retrieval_indexing` (verified 2026-11-10; no exception required)

| Protected item | Finding | Effect of introducing `retrieval_indexing` |
|---|---|---|
| NEM-019 `isWellFormedRecord` | Validates operations by **form only** (`^[a-z][a-z0-9_]*$`, `rights.service.ts:113`); no fixed list | `retrieval_indexing` is well formed; no record becomes malformed |
| NEM-019 `book_ai_rights.permittedOperations` | `text[] NOT NULL DEFAULT '{}'`; **no value constraint** (migration 071) | Stored as data; **no migration** |
| NEM-019 `RightsService.eligibility` | Tests only `permittedOperations.includes(operation)` for the requested operation | `research_analysis` decisions are unchanged with or without `retrieval_indexing` |
| NEM-019 module and tests | Fixtures grant only `research_analysis`; port bindings pinned by the architecture test | Unchanged; E5 fixtures add their own records |
| NEM-021 frozen contract v1 | Contains no rights operations (only capability keys and non-token units such as `tool_call`) | Untouched |
| NEM-022 Gateway | Consumes sealed contexts only | Untouched |

**Combined behaviour** (both permissions independent; most restrictive wins):

| Rights record grants | Query-time eligible? | Indexable? | Result |
|---|---|---|---|
| `research_analysis` only | Yes (if user-level checks pass) | No | No chunks; book reported `unindexed` (fail closed) |
| `retrieval_indexing` only | No | Yes | Chunks may exist but are never returned |
| Both | Yes | Yes | Retrievable |

If implementation finds that any of these facts no longer holds (for example, a later change adds an operation allowlist), it is a **stop condition**, and the change needs separate PO approval as an exception.

## 10. Security / privacy / copyright

- **S2 (selected):** verbatim text only in MinIO. PostgreSQL holds the lexical derivative (`tsvector`) and offsets.
- **Backups after a purge:**
  - on-server PostgreSQL dumps keep the derivative until they rotate out under the existing retention (7 daily + 4 weekly, about 28 days);
  - **offsite PostgreSQL copies have no automatic pruning and may persist indefinitely** (RB-7, a production-indexing blocker).

  The runbook records this.
- Fixtures: invented or public-domain text only.
- Retrieved text reaches the Gateway only as delimited context data (accepted NEM-022 rule).
- Deletion: chunks are book-level (cascade); E5 holds no user content *(Amendment 1)*; revocation → `purge`.

## 11. Acceptance criteria (proposed)

1. **Allowed set only.** Retrieval returns only chunks whose (`bookId`, `textHash`) is in `allowed`. An empty set or empty query is rejected or returns nothing. Adversarial tests (other books, other hashes, SQL-meta characters in the query) never leak, proven at SQL level.
2. **Stale never served.** After a simulated text replacement, chunks of the old hash are never returned, and the anchor resolver refuses old refs while the current hash differs.
3. **Hash authority.** The current hash always comes from `TextIdentityPort`. Changing only chunk rows cannot make a book retrievable (test). `computeTextHash` has a single definition. The module binding of `TEXT_IDENTITY_PORT` is unchanged.
4. **Two authorizations (C-1).**
   - A book is indexed only if `IndexingPermission` passes: verified, complete, well-formed, current hash, `retrieval_indexing` granted, not past review, attested. Every failure case and the unbound-port case create no chunks.
   - The indexer never calls `RightsService.eligibility` or `OwnershipPort` and uses no user identity (architecture test).
   - The parity test with `RightsService` book-level denials passes.
   - At query time, books failing user-level eligibility (unchanged `RightsService`) or current index permission return no passages.
5. **User isolation** *(Amendment 1)*: E5 stores and returns no user content; chunk tables have no user column; `fragments` is neither read nor changed. (Highlight/note isolation is E6's criterion.)
6. **Anchors.** For every passage, `codePointSlice(sourceText, charStart, charEnd) == passage.text` under the recorded hash. `chapterLabel` and phrase ranges are NULL in Stage 1 *(Amendment 1)*.
7. **Full-text quality.** Accent-insensitive Spanish and English matching (with D-5), stemming, and stop words on fixtures. The partial GIN indexes are used. The cross-language limitation is documented by test.
8. **End to end (test code):** eligibility → `QueryContextSource` → unchanged Context Builder → accepted Gateway and simulator. `library` segments cite retrieved chunk refs and pass NEM-022's citation policy; a citation to a non-retrieved ref is a scope violation. **No `TurnService` or `ContextSourcePort` change.**
9. **Budgets and cost:** the context budget is never exceeded; NEM-021 reservations reflect the budgeted context.
10. **Limits:** every §9.4 limit is enforced fail-closed and measured; indexing is idempotent and transactional (a crash leaves no partial set); `sync_maps`, reader data, and `fragments` are byte-unchanged; `prune` and `purge` behave as specified.
11. **Storage S2 (D-4):**
    - no verbatim chunk text is stored in PostgreSQL (schema test);
    - snippets come from the MinIO object only after its hash equals the chunk's and the current `textHash`; a MinIO fault or mismatch fails closed (tests);
    - latency is measured including the fetch;
    - `purge` removes all of a book's chunk rows;
    - the runbook records that, after a purge, on-server dumps keep the derivative until rotation under the existing retention (about 28 days), and offsite copies have no automatic pruning and may persist indefinitely (RB-7).
12. **Regression:** all NEM-019, NEM-021, and NEM-022 suites pass unchanged; migrations run up and down; architecture and privacy tests pass. Tests use only local disposable PostgreSQL, Redis, and MinIO-compatible fixtures, with **no production credentials, no production or staging connection, no external AI provider, and no paid service** (§9.5).

## 12. Required tests

- **Unit (≥ 80%):** chunker (boundaries, code-point offsets, Unicode, headings, overlap), `computeTextHash`, indexer (mocks; scope; limits; idempotency), retrieval (validation, budget), `QueryContextSource`, anchor resolver.
- **Integration (local disposable PostgreSQL 16 + Redis + MinIO-compatible fixture; §9.5):** allowed-pair and stale SQL filters, eligibility, `unaccent` and language-configuration lexemes, `EXPLAIN` GIN index use, migration up/down, crash safety, prune/purge, end-to-end citation flow, latency on a sized fixture, and the S2 tests (MinIO fault and hash mismatch fail closed).
- **Architecture and security:** retrieval-technology isolation, single `computeTextHash`, no turn or port wiring, no content logging, no provider/HTTP/SDK, `sync_maps` and `fragments` not accessed (*Amendment 1*).
- **Regression:** NEM-019, NEM-021 (contract, ledger), NEM-022.

## 13. Observability

The §5.9 counters, no content labels, no dashboards while dark. The completion report records index size, indexing time, and retrieval latency.

## 14. Deployment / rollout

None. Branch and Draft PR only. **Production indexing remains blocked** until **all** of these hold; each needs its own authorization:

| Prerequisite | Source |
|---|---|
| PO-029 (eligible corpus) decided | RB-1 |
| TT-26 legal evidence standard, jurisdictions, Named Verifier (`LEGAL REVIEW REQUIRED`) | RB-2 |
| E3 completed: production `TextIdentityPort` and verification-authority adapters bound | RB-3 |
| Verified, attested `book_ai_rights` records granting `retrieval_indexing` for exact text versions | RB-3, D-6 |
| For author or publisher titles: opt-in terms, UI, and contract language (D6) | RB-5 |
| Legal position on storing the `tsvector` derivative for licensed titles | RB-6 |
| Offsite backup retention policy, so a purge eventually reaches offsite copies (or an explicit PO acceptance of indefinite retention) | RB-7 |
| Merge, deployment, `unaccent` enablement under the ADR-004 infrastructure-safety steps, and a server snapshot | Governance |

## 15. Documentation deliverables

Technical-note section (architecture, schema, hash mechanism, full-text configurations, runbook for index/prune/purge, limits), migration entries, completion report with raw output, Stage 2 extension points.

## 16. Open decisions (PO)

| ID | Decision | Recommended default | If declined |
|---|---|---|---|
| D-1 | TT-25 | **DECIDED (PO-033):** PostgreSQL lexical at launch, technology-neutral interface; semantic later | — |
| D-2 | E5/E6 boundary | E5 dark components; E6 wires turns | E5 needs authority for NEM-019 changes |
| D-3 | Text-hash mechanism | SHA-256 of MinIO bytes; shared function; E3 binds | E5 binds (NEM-019 test exception) |
| D-4 | Chunk text storage | **DECIDED (PO-033): S2.** Text in MinIO; PostgreSQL stores ids, offsets, hashes, metadata, `tsvector`; no verbatim text | — |
| D-5 | `unaccent` extension | Yes | Accent-sensitive matching |
| D-6 | Indexing scope and permission | **DECIDED (PO-033):** explicit, verified, book-level `retrieval_indexing` for the exact text version; ownership never grants it; default deny | — |
| D-7 | Retention | **DECIDED (PO-033):** current + at most one previous set; previous ≤ 30 days and removed sooner; revocation blocks retrieval immediately and requires active-index purge; backup retention remains a production blocker | — |
| D-8 | Limits and defaults | §9.4 | Other values |
| D-9 | Identifier | **DECIDED (PO-033): NEM-023 reserved** | — |

**Status of decisions:**
- **PO decided (PO-033):** D-1, D-4, D-6 (RB-4 resolved: `retrieval_indexing` adopted), D-7, D-9.
- **Product Architecture, with the specification review:** D-2, D-3, D-5.
- **Engineering configuration (PA-reviewed):** D-8, including `previousSetGraceHours`.

## 17. Stop conditions

- pgvector, embeddings, an external AI provider, a paid service, a connection to production or staging, or production credentials appear necessary.
- A change to `TurnService`, `ContextSourcePort`, module port bindings, `sync_maps`, `fragments` (schema or writes), frozen contract v1, or accepted NEM-022 behaviour appears necessary.
- A NEM-019, NEM-021, or NEM-022 test must change to pass.
- Authorization cannot be expressed as SQL predicates.
- Book-level index permission cannot be established without a user identity or without changing NEM-019 code or bindings.
- Any §9.7 compatibility fact no longer holds (for example, an operation allowlist), so that introducing `retrieval_indexing` would change accepted NEM-019 behaviour. Present the exception for PO approval.
- `unaccent`, the language configurations, or GIN index use cannot be verified on the disposable database (escalate; do not improvise).
- A product or legal value (D-4) would need to be assumed.

## 18. Completion report

Per the README standard: raw test output, measured index size, indexing time, retrieval latency, limit evidence, and Stage 2 notes.

## 19. Product Architecture review

`REVIEW-CHECKLIST.md`. Completion requires review and PO acceptance.
