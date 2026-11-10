# E5 — Knowledge Retrieval and Grounding: Discovery Report

**Status:** COMPLETE (read-only analysis) — for Product Architecture review.
**Authorization:** Product Owner, *"E5 Discovery and Engineering Mission Draft"* (2026-11-09): read-only analysis plus a documentation draft. **No implementation is authorized.**
**Changes made:** this report and a DRAFT mission ([`DRAFT/E5-knowledge-retrieval-and-grounding.md`](../engineering-missions/DRAFT/E5-knowledge-retrieval-and-grounding.md)). No code, migrations, database changes, extensions, dependencies, infrastructure, CI/CD, merges, deployments, or provider activity.

Legend: **[F]** verified repository fact (with source) · **[M]** measured in this session (local dev database, read-only) · **[A]** assumption · **[D]** missing decision.

---

## 1. Recommendation in one paragraph

Build E5 in **stages**.

**Stage 1 (proposed E5)** is lexical retrieval on **PostgreSQL's built-in full-text search**:
- a new, additive `ai_book_chunks` table built from each book's stored text by an offline chunker;
- authoritative X-3 anchors (`textHash`, `charStart`, `charEnd`), plus derived chapter and phrase-range references;
- retrieval behind a provider-independent `RetrievalPort`, filtered at query level to the session's eligible books;
- results feed NEM-019's `ContextSourcePort`, so they pass the Context Builder invariant and reach the accepted NEM-022 Gateway unchanged.

Stage 1 needs no embedding provider, no new service, no PostgreSQL image change, and no paid cost. It satisfies the ADR-004 guardrail that product logic never depends on the retrieval technology.

**Stage 2 (a separate future mission, after the launch gate)** adds pgvector embeddings and hybrid fusion behind the same port. This is semantic and cross-language retrieval, which ADR-004 requires eventually. It needs a production PostgreSQL image change and an embedding-provider decision, so it is out of scope now.

## 2. Phase 1 — Repository assessment

### 2.1 Text, structure, highlights, notes, ownership

| Item | Finding |
|---|---|
| Full book text | **[F]** Stored as a text object in the private MinIO `books` bucket. `books.textFileKey` points to it; read by `StorageService.getText` (`ingestion/whisper-sync.service.ts:38`); presigned for the reader (`books.controller.ts:101`). No book text is stored in PostgreSQL apart from sync maps |
| Sync maps | **[F]** `sync_maps.phrases` (jsonb) holds `SyncPhrase { index, text, startTime, endTime, type?: 'text' \| 'heading' \| 'paragraph-break', exception? }` (`books/sync-map.entity.ts`). Escucha Activa depends on them; **protected** |
| Chapters | **[F]** No chapter table. Chapters are derivable from `type = 'heading'` phrases. **[M]** The median book has 28 heading phrases; the largest has 89 |
| Highlights and notes | **[F]** `fragments`: `userId`, `bookId` (both `ON DELETE CASCADE`), `startPhraseIndex`, `endPhraseIndex`, `text` (the saved quotation), `note` (optional user note), `themes` jsonb. **There is no separate notes table**: a note is a field on a fragment |
| Ownership | **[F]** `user_books (userId, bookId, purchaseType: 'free' \| 'token' \| 'courtesy' \| 'purchase')` |
| AI rights | **[F]** NEM-019 `book_ai_rights` (per book + `textHash`), evaluated by `RightsService.eligibility` (default deny; stale `textHash` denied; F-12 authority port) |
| Text identity | **[F]** `TextIdentityPort.currentTextHash(bookId)` exists, bound to `UnboundTextIdentityPort` (returns `null`). Its production adapter is planned for E3 (P0 packet line 169) |

### 2.2 PostgreSQL capabilities, search, migrations

| Item | Finding |
|---|---|
| Version and image | **[F]** Development and production both run `postgres:16-alpine` (`docker-compose.yml:105`, `docker-compose.server.yml:198`). **[M]** Server version 16.13 |
| Extensions in use | **[F]** Only `uuid-ossp` and `pgcrypto` (`infra/postgres/init.sql`) |
| Extensions available in that image | **[M]** `pg_trgm` and `unaccent` (contrib) are available but not installed. **`vector` (pgvector) is NOT available** in `postgres:16-alpine` |
| pgvector anywhere | **[F]** Only on the **staging** branch (`nem-006a-staging`), which uses a pgvector-enabled PostgreSQL 16 image ("staging only"). Not on `main`, not in production |
| Full-text search | **[F]** **None.** No `tsvector`, `to_tsquery`, or GIN index anywhere in `src` or migrations. Book search is `ILIKE` on title and author (`books.service.ts:32`) |
| Meilisearch | **[F]** v1.7, index `books`. Searchable: title, author, description; filterable: category, isFree, isPublished, language, meetsStandard (`search/search.service.ts:42-43`). **No book text, chunks, or fragments are indexed** |
| Migrations | **[F]** 000–074 on the NEM stack (073–074 from NEM-021). No retrieval tables |

### 2.3 Existing retrieval components

**[F]** There is no chunking, embedding, vector search, text full-text search, or retrieval service anywhere in the repository. The only seam is NEM-019's `ContextSourcePort.candidates(userId, sessionId, allowedBookIds)`. It is bound to `EmptyContextSource`, which returns `[]` and says explicitly "NEM-019 performs NO retrieval".

### 2.4 Integration with accepted work

| Component | What E5 must respect | Integration point |
|---|---|---|
| NEM-019 Context Builder | Invariant `research_session_context`: every chunk, highlight, and note belongs to a selected, eligible book; highlights and notes belong to the requesting user; a violation aborts the turn. Only Context Builders seal contexts | E5 supplies `ContextItem { kind: 'chunk' \| 'highlight' \| 'note', ref, bookId, userId?, text? }` through `ContextSourcePort`. **No change to the invariant** |
| NEM-019 turn | **[F]** `TurnService.run(userId, sessionId, clientKey)` has **no question or query input**: the stub carries no user message. **[D-2]** Retrieval needs a query, so either E5 adds an optional query to the port (additive) or turn wiring waits for E6 (conversations) |
| NEM-021 cost ledger | Retrieved text raises counted input tokens and therefore the worst-case reservation. **A context budget (max tokens per turn) must bound it before `prepare`** | E5 enforces a configurable context budget; no ledger change |
| NEM-022 Gateway | Citations must reference sealed-context refs (accepted citation policy); `library` requires chunk citations; context text travels in the neutralized data channel | E5 chunk `ref` = stable chunk id; the Gateway's citation `anchor` can carry the X-3 offsets. **No Gateway change** |
| ADR-002 / ADR-006 | Retrieval only within the explicit, server-derived allowed set, as a **query-level filter, not a post-filter** (03 §rule 6) | The retrieval SQL takes `allowedBookIds` as a mandatory, non-empty parameter |
| ADR-004 | pgvector is the approved vector store; Meilisearch stays lexical; the **Semantic Retrieval Interface is mandatory**; exact search first; chunks stay separate from sync phrases and only *reference* phrase ranges | Stage 1 defines that interface (`RetrievalPort`) with a lexical implementation; Stage 2 adds the vector implementation |
| X-3 (02 reconciliation) | Citation anchor = `textHash` + character range; phrase range is derived and re-resolvable | Chunk rows store `textHash`, `charStart`, `charEnd`; the phrase range is computed, not authoritative |

### 2.5 Rights, privacy, ownership, citation, and isolation constraints

1. **Default deny.** Only books returned eligible by `RightsService` (verified rights with a matching `textHash`, F-12 authority) may be retrieved. `isFree` is not evidence.
2. **Stale-index rule.** A chunk whose `textHash` differs from the book's current text hash, or from the rights record, must never be retrieved. This makes E5 depend on a source of the current text hash (**[D-3]**: E3's `TextIdentityPort` adapter, or an E5-computed hash that E3 later adopts).
3. **Highlights and notes.** Only the requesting user's `fragments`, only for books in the allowed set. A saved quotation is **an assertion, not evidence** (F-17) and is labelled `user_content`, never `library`.
4. **No full-text export.** Excerpts only (PRD). E5 returns bounded excerpts within a context budget; reconstruction accounting is E6 (F-2).
5. **Copyright exposure.** **[D-4]** Chunk text in PostgreSQL duplicates book text that today lives only in private MinIO. That widens where the text sits, including database backups and the encrypted offsite backups. It needs a PO decision, possibly with legal input (C2). The alternative is storing only offsets and reading text from MinIO at retrieval time (slower, no duplication).
6. **Privacy.** Chunks hold no user data. Queries and retrieved text are never logged or used as metric labels. No query text is persisted in E5.
7. **Reader protection.** Indexing runs offline (an ingestion script or a low-concurrency worker job), never on the reader path. Sync maps are read-only inputs.

### 2.6 Resource implications

| Measure | Value |
|---|---|
| Corpus (dev, **[M]**) | 39 books, all Spanish. Sync-map JSON 22.5 MB in total (590 KB per book on average, 2.8 MB maximum). Whole dev database 28 MB |
| Text per book (**[M]**) | Median ≈ 124,000 characters (≈ 31,000 tokens at about 4 characters per token **[A]**); largest ≈ 2.0 million characters (≈ 500,000 tokens) |
| Production corpus (**[A]**) | About 66 books (free library), growing toward 50+ author titles. ≈ 20 MB of text, ≈ 5 million tokens |
| Chunks (**[A]**, about 1,500 characters each, 10% overlap) | ≈ 15,000 chunks for 66 books (≈ 8,000 for dev) |
| PostgreSQL growth, Stage 1 (**[A]**) | Chunk text ≈ 20–25 MB, plus `tsvector` and GIN index ≈ 1–2× the text: **≈ 50–80 MB in total**. Negligible on the 400 GB / 24 GB-RAM server |
| Indexing CPU and time (**[A]**) | Chunking plus `to_tsvector` is linear: seconds per book, minutes for the corpus, single-threaded, run offline |
| Query cost, Stage 1 (**[A]**) | GIN-indexed lexical query filtered to ≤ 10 books (≤ about 2,500 chunks): **expected well under 100 ms**. To be measured in E5 |
| Stage 2 storage (**[A]**) | 15,000 × 1,024-dimension float vectors ≈ 60 MB plus overhead. Exact search over ≤ 2,500 scoped vectors is cheap |
| Stage 2 cost (**[A]**) | One-time embedding of ≈ 5 million tokens, plus one query embedding per turn, at the **chosen provider's price** (no price assumed). A self-hosted model would mean a new service, which is infrastructure |
| Paid-provider cost, Stage 1 | **None** |
| Turn cost impact | Retrieval *lowers* model input cost against a whole-book context: a median 3-book Noetia+ set would be ≈ 93,000 tokens per turn whole-book, against a budgeted ≈ 4,000–8,000 retrieved tokens **[A]**. NoetiaX (10 books) and large books **cannot** fit whole |

## 3. Phase 2 — Architecture comparison

| Criterion | A. PostgreSQL full-text search | B. pgvector semantic | C. Hybrid (A + B, fused) | (D. Meilisearch over chunks) |
|---|---|---|---|---|
| New infrastructure | **None.** Core FTS needs no extension. `unaccent`/`pg_trgm` are optional contrib extensions already in the image (one additive `CREATE EXTENSION`) | Production PostgreSQL image change to a pgvector build: snapshot, compatibility verification, infrastructure mission | Same as B | None (already running), but chunk text is copied into a second store |
| Provider and cost | None | Embedding provider (PO-005/ADR-001), paid or self-hosted; blocked until the launch gate by PO strategy | Same as B | None |
| Quality | Lexical with stemming (Spanish and English configurations); misses synonyms and paraphrase; **no cross-language** | Semantic, paraphrase-robust, cross-language with a multilingual model (ADR-004 guardrail) | Best recall and precision; standard for RAG | Lexical plus typo tolerance; ranking not tunable to citations |
| Authorization | Native SQL join and filter on `allowedBookIds` and `textHash` in one query (query-level filter) | Same (ADR-004's main reason) | Same | A filter on an index attribute: correctness depends on index sync; outside the system of record (ADR-004) |
| Determinism and testing | Fully deterministic; runs on the existing disposable `postgres:16-alpine` | Needs a pgvector image for tests, plus simulated embeddings | Both | Needs a Meilisearch test container |
| Citation anchors | Chunk row carries the X-3 anchor | Same | Same | Must mirror anchors |
| Operational risk | Lowest | Medium (image change, re-embedding on model change) | Medium | Low-to-medium (index drift, data duplication) |
| Fit with ADR-004 | Fits: the interface first, the lexical implementation inside PostgreSQL | The approved vector store | ADR-004 "future hybrid" | Rejected as the system of record for semantic chunks; lexical role only |

**Staged recommendation:**

| Stage | Contents | Why |
|---|---|---|
| **1 (E5, now)** | A behind `RetrievalPort`; chunk schema already carries everything Stage 2 needs except the vector itself (stable chunk ids, `textHash`, offsets, language); highlight search lexical on the user's own `fragments` rows (matches TT-25 option (a), provisional) | Zero provider, zero infrastructure, zero cost; immediately unblocks E6 with real grounded context on simulated models |
| **2 (separate mission, post-gate)** | B, then C: an `ai_chunk_embeddings` table (pgvector), embedding versioning (ADR-004), RRF fusion, exact search first | Adds semantic and cross-language retrieval once the image change and embedding provider are approved; no domain rewrite |

## 4. Missing decisions (for the PO and Product Architecture)

| ID | Decision | Recommendation |
|---|---|---|
| **D-1 (TT-25)** | Lexical or semantic retrieval at launch. The P0 packet requires it closed **before** E5 | **(a) lexical at launch with a vector-ready interface**; semantic as Stage 2 at the gate |
| **D-2** | Query input: `TurnService` has none. Add an optional query to `ContextSourcePort` / the turn (additive, NEM-019 files) in E5, or deliver retrieval plus the context source in E5 and wire the user question in E6 | Deliver the retrieval service and an E5 context-source adapter with an explicit query parameter; **turn wiring of the user's question in E6**, which owns messages. Keeps NEM-019 turn behaviour unchanged in E5 |
| **D-3** | Source of the current text hash (X-3, stale-index rule) | E5 computes SHA-256 of the stored MinIO text object at indexing, behind the existing `TextIdentityPort` shape; E3 adopts the same function (one definition) |
| **D-4** | Store chunk text in PostgreSQL, or only offsets with text read from MinIO at retrieval | Store chunk text (simpler, faster, transactional), **subject to PO/legal confirmation** of the backup-exposure change |
| **D-5** | `unaccent` / `pg_trgm` contrib extensions (additive migration) or core FTS only | Core FTS plus `unaccent` (accent-insensitive Spanish); defer `pg_trgm` |
| **D-6** | Which books are indexed: all published books with stored text (eligibility at query time), or only rights-verified books | Index all published books with text; **eligibility enforced at query time** (re-indexing on rights changes not needed) |
| **D-7** | Chunk size, overlap, top-k, and context budget (engineering defaults, configurable) | About 1,500 characters, 10% overlap, top-k 8, context budget 6,000 tokens (to be tuned in E5 with fixtures) |
| **D-8** | Mission identifier reservation | PO to reserve |

## 5. Assumptions to validate in E5

Production book count and text sizes (only dev was measured); the token estimate of about 4 characters per token (simulator approximation); Spanish/English stemming quality on the corpus; query latency on a production-sized fixture; whether every published book has a stored text object (**[M]** dev: 38 of 39 have `textFileKey`).

## 6. Not done (by instruction)

No implementation, migration, extension installation, dependency, service, CI/CD, infrastructure, staging, or production change. No database modification. One read-only analysis query on the local dev database was cancelled server-side after it ran too long, leaving no state behind. No merge, deployment, or provider activity. NEM-021 and NEM-022 are untouched.
