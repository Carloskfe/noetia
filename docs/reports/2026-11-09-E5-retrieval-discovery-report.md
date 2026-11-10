# E5 — Knowledge Retrieval and Grounding: Discovery Report

**Status:** REVISION 4 (read-only analysis). **Superseded for decisions by [PO-033](../operating-framework/decisions/product-owner/PO-033-e5-knowledge-retrieval-decisions-and-nem-023-reservation.md) and the [NEM-023 final specification](../engineering-missions/DRAFT/NEM-023-knowledge-retrieval-and-grounding.md).** Kept as the analysis record. **PO direction (2026-11-10): S2 selected in principle, subject to rights verification** (see the [decision packet](2026-11-10-E5-product-owner-decision-packet.md)).
**Authorization:** Product Owner, *"E5 Discovery and Engineering Mission Draft"* (2026-11-09), and the Product Architecture review response on PR #52 (*"Architectural direction supported — changes required before mission approval"*). Documentation only.
**Changes made:** this report and the DRAFT mission ([`DRAFT/NEM-023-knowledge-retrieval-and-grounding.md`](../engineering-missions/DRAFT/NEM-023-knowledge-retrieval-and-grounding.md)). No code, migrations, database changes, extensions, dependencies, infrastructure, CI/CD, merges, deployments, or provider activity.

Legend: **[F]** verified repository fact (with source) · **[M]** measured (local dev database, read-only) · **[A]** assumption · **[D]** Product Owner decision (§9).

**Revision 3 changes** (final architecture clarifications on revision 2, `53fc73f`):
- **C-1 indexing eligibility (§8.1):** book-level authorization to *create* a retrieval index is separated from user-level ownership, rights, and session eligibility at query time. The offline indexer establishes permission without any user identity, and denies by default.
- **C-2 S2 exposure (§6):** PostgreSQL `tsvector` retains lexical information derived from book content in S2 too. The D-4 comparison now states the copyright, privacy, and backup exposure of that derivative.

Everything else from revision 2 is unchanged.

**Revision 2 changes** (review items 1–7):
1. An authoritative current-text-hash mechanism (§4).
2. The query interface and the E6 boundary (§5).
3. A storage comparison, with no option chosen (§6).
4. Spanish/English full-text search and accent handling (§7).
5. Indexing scope, retention, and resource limits (§8).
6. A table of preserved invariants (§10).
7. Product Owner decisions with defaults and consequences (§9).

---

## 1. Summary

The supported direction is preserved:
- **Stage 1 (E5):** lexical retrieval on PostgreSQL full-text search, behind a technology-neutral `RetrievalPort`.
- **Stage 2 (a separate mission, post-gate):** pgvector and hybrid retrieval behind the same port (ADR-004).

Stage 1 needs **no embedding provider, no new service, no PostgreSQL image change, and no paid cost.** The only proposed schema additions are one new table and two custom text-search configurations, plus the contrib extension `unaccent` (decision D-5). Those extensions are already in the running image, but not installed.

Revision 2 makes three things independent of the index:
- **text identity:** the hash comes from the MinIO object, never from chunk rows;
- **authorization:** the allowed set is supplied by the caller's existing eligibility step and enforced in SQL;
- **turn integration:** E5 is not wired into `TurnService`; E6 does that.

## 2. Repository facts (unchanged from revision 1; summary)

| Area | Fact |
|---|---|
| Book text | **[F]** Private MinIO object `books.textFileKey`, read by `StorageService.getText`. No book text in PostgreSQL apart from `sync_maps.phrases` (Escucha Activa; **protected**) |
| Chapters | **[F]** Derivable from `type = 'heading'` phrases. **[M]** median book 28, largest 89 |
| Highlights and notes | **[F]** `fragments (userId, bookId, startPhraseIndex, endPhraseIndex, text, note, themes)`; there is no separate notes table |
| Ownership and rights | **[F]** `user_books`; NEM-019 `book_ai_rights` (book + `textHash`) evaluated by `RightsService` (default deny, F-12 authority) |
| PostgreSQL | **[F]** dev and production `postgres:16-alpine`; **[M]** 16.13; `pg_trgm` and `unaccent` available, not installed; **no pgvector** (staging branch only) |
| Search | **[F]** No text full-text search; book search is `ILIKE`; Meilisearch indexes book metadata only |
| Retrieval seam | **[F]** `ContextSourcePort.candidates(userId, sessionId, allowedBookIds)` → `EmptyContextSource` (returns `[]`) |
| Turn | **[F]** `TurnService.run(userId, sessionId, clientKey)` has no question input |
| Languages | **[F]** `books.language` defaults to `'es'`; the catalogue (`ingestion/catalogue.ts`) marks 39 titles `'en'`. **[M]** the dev database holds 39 Spanish books (a subset) |
| Sizes | **[M]** median book ≈ 124,000 characters (≈ 31,000 tokens **[A]**), largest ≈ 2.0 million characters (≈ 500,000 tokens) |
| Backups | **[F]** PostgreSQL dump daily, 7 daily + 4 weekly kept (`infra/server/backup-db.sh`); MinIO archive weekly, 4 kept (`backup-minio.sh`); the latest of each is copied offsite, encrypted (`docs/operations/offsite-backups.md`) |

## 3. Architecture comparison (summary; full table in revision 1, unchanged in substance)

| | A. PostgreSQL full-text search | B. pgvector | C. Hybrid | D. Meilisearch over chunks |
|---|---|---|---|---|
| New infrastructure | none (contrib `unaccent` only) | production image change | same as B | none, but a second copy of text |
| Provider and cost | none | embedding provider (post-gate) | same as B | none |
| Quality | lexical, stemmed, accent-folded; no paraphrase or cross-language | semantic, cross-language | best | lexical with typo tolerance |
| Authorization in SQL | **yes** | yes | yes | index-attribute filter (drift risk) |

**Staged recommendation unchanged:** A now (E5); B, then C later.

## 4. Authoritative current-text-hash mechanism (review item 1)

**Definition (one definition for the whole system):**
- `textHash = "sha256:" + lowercase-hex(SHA-256(exact bytes of the MinIO object at books.textFileKey))`;
- no normalization (byte-exact), so any byte change is a new text version;
- character offsets (`charStart`, `charEnd`) are **Unicode code-point indices** into the UTF-8-decoded text, re-resolvable identically in PostgreSQL (`substring`) and TypeScript (code-point slicing).

**Authority:**
- The current hash is computed **from the MinIO object**, never read from chunk rows.
- The component is a `TextIdentityPort` adapter: `currentTextHash(bookId)` reads `textFileKey` and hashes the object bytes.
- It may cache the hash keyed by (`textFileKey`, object ETag, size) and recomputes when the ETag or size changes. The cache holds a hash, never text.
- Chunk rows only *record* the hash they were built from. Retrieval compares the two, so a stale index can never certify itself.

**Coordination with E3 (owner of the adapter, P0 packet E3):**
- **Shared pure function.** `computeTextHash(bytes): string` lives in one new module under `knowledge/rights/` and is used by the E3 adapter, the E5 indexer, and future rights manifests. An architecture test enforces one definition. Whichever mission lands first adds it with its unit tests; the other reuses it.
- **E5 does not bind the port.** NEM-019's architecture test requires `TEXT_IDENTITY_PORT → UnboundTextIdentityPort` in the module (`tests/unit/knowledge/architecture.spec.ts:65`).
  - In the dark module, every book therefore stays ineligible and E5 retrieval returns nothing for real books: a consistent default deny.
  - Binding the real adapter is **E3's** step, under its own authorization (it changes an accepted NEM-019 guard).
  - E5 tests bind a fixture `TextIdentityPort`.
- **Accepted NEM-019 behaviour is untouched.** `RightsService` keeps comparing `book_ai_rights.textHash` with the port's value. E5 reads the same port, so eligibility and retrieval agree on the version.

**Residual race:** the text could be replaced between the eligibility check and retrieval. Retrieval re-reads the port (same cache key, so normally the same value) and only returns chunks for the hash it read. A changed text yields no chunks (fail closed) until the book is re-indexed, and its rights row must match the new hash before the book is eligible again.

## 5. E5 query interface and E6 boundary (review item 2)

**E5 delivers dark, unwired components:**

```ts
interface RetrievalPort {                               // technology-neutral (ADR-004)
  retrieve(req: RetrievalRequest): Promise<RetrievalResult>;
}
interface RetrievalRequest {
  allowed: ReadonlyArray<{ bookId: string; textHash: string }>; // non-empty; produced by the caller's eligibility step
  query: string;                                         // NFC-normalized, trimmed, 1–500 code points
  topK: number;                                          // 1–20 (default 8)
  budgetTokens: number;                                  // ≤ 8,000 (default 6,000)
}
interface RetrievalResult {
  passages: RetrievedPassage[];                          // ranked, within budget
  excluded: { unindexed: string[]; stale: string[] };    // bookIds, for disclosure (no text)
  truncated: boolean;
}
interface RetrievedPassage {
  chunkId: string; bookId: string; textHash: string; charStart: number; charEnd: number;
  chapterLabel: string | null; phraseRange: { start: number; end: number } | null; text: string; score: number;
}

/** E5's adapter for E6 to call. NOT a ContextSourcePort binding. */
interface QueryContextSource {
  candidatesFor(userId: string, allowedBookIds: readonly string[], query: string): Promise<ContextItem[]>;
}
```

`candidatesFor` resolves each allowed book's current hash through `TextIdentityPort`, calls `RetrievalPort`, and adds the user's own highlights and notes for the same books. It returns NEM-019 `ContextItem`s (`chunk`, `highlight`, `note`) with `text`, which E6 passes to the **unchanged** Context Builder.

**Boundary:**

| E5 (this mission) | E6 (later, own authorization) |
|---|---|
| Chunk table, configurations, indexer, `RetrievalPort` + lexical implementation, `QueryContextSource`, anchor resolver, highlight search on the user's rows | User message input on turns; calling `QueryContextSource` from the turn after step 2; any change to `ContextSourcePort` or `TurnService`; conversation persistence; reconstruction accounting; library-wide Ask My Highlights |
| `ContextSourcePort` stays bound to `EmptyContextSource`; **no `TurnService` change** | Binds grounded context into turns |
| End-to-end tests call eligibility (existing `RightsService` / `SessionsService`), then `QueryContextSource`, then the Context Builder, then the accepted Gateway **directly in test code** | Turn-level tests |

**Query safety:**
- The query is always a bound parameter to `websearch_to_tsquery` (never concatenated).
- A query that is empty after normalization returns no passages (there is no "match all").
- Over-length input is rejected.
- No query text is logged, stored, or used as a metric label.

## 6. Chunk-text storage: PostgreSQL vs offsets plus MinIO (review item 3) — **no option chosen**

**Both options put content-derived data in PostgreSQL.** Full-text search needs a `tsvector` per chunk in every option. A `tsvector` is **lexical information derived from the book content**: every non-stop-word of the chunk, stemmed and accent-folded, **with its position**. That is less than the text, but not nothing. Vocabulary, word order, and much of the wording can be reconstructed approximately from lexemes and positions, so it should be treated as a **derivative representation of the protected text**, not as neutral metadata.

S2 therefore does **not** keep book content solely in MinIO. It keeps only the *raw* text there. D-4 is a choice between **raw text + lexical derivative** (S1) and **lexical derivative only** (S2) in PostgreSQL. No option offers lexical search with zero content-derived data in PostgreSQL: the only alternative engine, Meilisearch, stores the text itself.

| Criterion | **S1 — chunk text in PostgreSQL** | **S2 — offsets + `tsvector` in PostgreSQL; text read from MinIO at retrieval** |
|---|---|---|
| Where publisher content lives | Raw text in MinIO **and** PostgreSQL (`ai_book_chunks.text`); **lexical derivative (`tsvector`) in PostgreSQL** | Raw text in MinIO only; **lexical derivative (`tsvector`: stemmed words with positions) in PostgreSQL** |
| Copyright exposure | A verbatim copy of each indexed book's text **plus** its lexical derivative in the database | **No verbatim copy, but a reconstructable lexical derivative** of each indexed book in the database. Whether that is acceptable for licensed titles is a rights and legal question (TT-26 / C2), not an engineering one |
| Privacy exposure | No personal data: chunks and `tsvector`s are book-level. Highlights and notes are tokenized at query time only and **never persisted** | Same |
| Backup exposure **[F]** | Raw text **and** derivative added to every PostgreSQL dump: about 11 on-server copies (7 daily + 4 weekly), plus the daily offsite copy, on top of MinIO's 4 weekly archives | **The lexical derivative is added to every PostgreSQL dump** (the same about 11 on-server copies plus the daily offsite copy). Raw text stays only in MinIO's 4 weekly archives |
| Access surface | Database read access (or an SQL-injection defect) exposes verbatim text and the derivative | Database read access exposes the derivative; verbatim text still needs MinIO credentials |
| Rights and takedown | Revocation or deletion must purge chunk rows (raw text and derivative): cascade on book delete, `purge` on revocation. **On-server dumps keep both until rotation** under the existing retention (about 28 days); **offsite copies have no automatic pruning and may persist indefinitely** | `purge` removes the derivative rows; **on-server dumps keep the derivative until rotation** (about 28 days); **offsite copies have no automatic pruning and may persist indefinitely** (RB-7); raw text follows MinIO's lifecycle |
| Storage **[A]** (66 books, ≈ 20 MB of text) | ≈ 20–25 MB text + ≈ 30–55 MB `tsvector`/GIN = **≈ 50–80 MB**; dumps grow by about that much each | ≈ **30–55 MB**; no extra text in dumps |
| Retrieval latency **[A]** | One SQL query returns ranked passages with text: **expected tens of milliseconds** | SQL ranking, then one MinIO GET per distinct result book (≤ 10). Objects are median ≈ 124 KB, largest ≈ 2 MB; **expected +5–30 ms per book, more for the largest**, unless cached. A cache is a new in-memory copy of text (bounded LRU; no Redis persistence) |
| Availability | Retrieval depends on PostgreSQL only | Also depends on MinIO. A MinIO outage means retrieval fails closed |
| Consistency | Transactional with the chunk rows | Requires the MinIO object to still match `textHash` (checked; a mismatch returns nothing for that book) |
| Snippets and highlighting | `ts_headline` on stored text | Must slice fetched text by offsets |
| Engineering effort | Lower | Moderately higher (fetch, cache, and slice path; MinIO fault tests) |

Neither option avoids storing content-derived data in PostgreSQL and its backups. S2 avoids only the verbatim duplicate.

**PO decision (2026-11-10): S2, in principle, subject to rights verification.** One further backup fact: **offsite PostgreSQL copies are never pruned today** (`offsite-backups.md`, known gap 4). A derivative purged from the database therefore persists offsite indefinitely (decision packet RB-7). It specifies the schema and acceptance criteria for both variants, and implementation builds only the approved one.

## 7. Spanish/English full-text search and accent handling (review item 4)

**Built-in facts (PostgreSQL 16 core):** the text-search configurations `spanish` and `english` exist (Snowball stemmers and stop-word lists) and need no extension. **The Snowball stemmers do not fold accents:** a stored `canción` and a typed `cancion` do not match.

**Proposed configurations** (one additive migration; requires `unaccent`, decision D-5):
- `CREATE EXTENSION IF NOT EXISTS unaccent;` — a contrib extension present in the running image **[M]**. **[A]** It is marked trusted since PostgreSQL 13, so the database owner can create it without superuser. E5 verifies this on the disposable database before any use.
- `noetia_es` (`COPY = spanish`), `noetia_en` (`COPY = english`), and `noetia_simple` (`COPY = simple`, the fallback for other languages). Each is altered so that word token types (`asciiword`, `asciihword`, `hword_asciipart`, `word`, `hword`, `hword_part`) map to `unaccent, <language>_stem` (`unaccent, simple` for the fallback).

**Columns and indexes:**
- `language` on each chunk: `'es'`, `'en'`, or `'simple'`, from `books.language`; unknown values map to `'simple'`.
- `tsv`:
  - **S1:** a generated stored column, `CASE language WHEN 'en' THEN to_tsvector('noetia_en'::regconfig, text) WHEN 'es' THEN to_tsvector('noetia_es'::regconfig, text) ELSE to_tsvector('noetia_simple'::regconfig, text) END`. `to_tsvector(regconfig, text)` is immutable; E5 verifies the generated column on the disposable database.
  - **S2:** there is no text column, so the indexer computes `to_tsvector(<config>, $text)` and stores it.
- Partial GIN indexes, one per language (`… USING gin (tsv) WHERE language = 'es'`, and likewise for `en` and `simple`), plus a btree on (`bookId`, `textHash`).

**Query:**
- One sub-query per language present in the allowed set, each with a **constant** configuration so its partial GIN index is used, for example `tsv @@ websearch_to_tsquery('noetia_es', $q)`, combined with `UNION ALL`.
- Ranked by `ts_rank_cd(tsv, q, 32)`, then `bookId`, `chunkIndex` (deterministic tie-break).
- **Each sub-query also constrains `(bookId, textHash) ∈ allowed` in the same `WHERE` clause.**

**Highlights and notes:** `fragments` has no language column, so the language comes from the fragment's book. `to_tsvector` is computed at query time over **the requesting user's rows for the allowed books only**, capped by the limits in §8. No index is added to the protected `fragments` table.

**Known limitation:** cross-language queries (a Spanish question over an English book) match only shared tokens such as names and numbers. This is disclosed to users as an indexing limitation and resolved in Stage 2 (multilingual embeddings, ADR-004).

**Without `unaccent` (core only), the consequence:** accent-sensitive matching. Queries typed without accents, which is common on mobile, miss accented Spanish words. Stemming still works for correctly accented input.

## 8. Indexing scope, retention, and resource limits (review item 5)

### 8.1 Two separate authorizations (C-1)

| | **Book-level index permission** (indexing time) | **User-level eligibility** (query time) |
|---|---|---|
| Question answered | May a retrieval index (`tsvector`, and text under S1) **of this book version be created and kept**? | May **this user**, in **this session**, use this book's content now? |
| Who evaluates | E5's `IndexingPermission.check(bookId)`: **no user identity** | The unchanged NEM-019 `RightsService.eligibility(userId, bookId, 'research_analysis')`, called by the existing turn/session step (E6), plus the session book set (ADR-006) |
| Inputs | Current hash (`TextIdentityPort`); the `book_ai_rights` row for that hash; the verification authority (`RightsVerificationAuthorityPort`, F-12) | All of the left column, **plus** ownership/entitlement (`OwnershipPort`) for licensed books, tier, and the session limits |
| Never uses | Any user id, `OwnershipPort`, or session data | — |

**Why a separate check.** `RightsService.eligibility` requires a `userId`, and ends with an ownership check for licensed books (`rights.service.ts:136-182`). Calling it from an offline job would need a **fabricated user**. That would deny every licensed book (wrong for a book-level question) or, if the identity were privileged, blur user and system authority. **E5 never fabricates or impersonates a user.**

**How the indexer obtains authoritative permission** (read-only use of NEM-019; no NEM-019 code changes). `IndexingPermission.check(bookId)` evaluates exactly the **book-level** steps of NEM-019's chain, using the same sources:
1. `hash = TextIdentityPort.currentTextHash(bookId)`. Null or an error means deny (`text_identity_unknown`).
2. Read the `book_ai_rights` row for (`bookId`, `hash`). None means deny.
3. `status = 'verified'`, `isCompleteRecord`, `isWellFormedRecord`: the **exported NEM-019 validators**, reused, not re-implemented. Otherwise deny.
4. `permittedOperations` contains **`retrieval_indexing`**. This is a distinct operation key: permission to *store* an index is granted explicitly, separately from `research_analysis`. It is data in the existing `text[]` column, so no schema change. Absent means deny.
5. `reviewDate`, if present, not past. Otherwise deny.
6. `RightsVerificationAuthorityPort.attest(...) === 'attested'`. `not_attested`, `unknown`, or an error means deny.

**Default deny:**
- any failure, exception, or missing input means **no chunks are created** (counted as `skipped_scope`);
- with today's module bindings (unbound text identity and authority), **no book is indexable** in the dark module or in production;
- fixtures prove both the allow and the deny paths.

**Drift guard:** a **parity test** runs both evaluators over the same fixture records. `IndexingPermission` must deny whenever `RightsService.eligibility` denies with a book-level reason (`text_identity_unknown`, `no_rights_record`, `not_verified`, `incomplete_record`, `malformed_record`, `review_expired`, `not_attested`), and must additionally require `retrieval_indexing`. An architecture test forbids the indexer from importing `OwnershipPort` or calling `RightsService.eligibility`.

**At query time both apply:**
- the caller's user-level eligibility (unchanged `RightsService`, from E6's turn step), which supplies the `allowed` set;
- E5 re-checks book-level index permission for each allowed book (cached per request). A book whose index permission no longer holds is excluded (`excluded.index_not_permitted`) and flagged for `purge`.

**Index permission alone never makes a book usable, and ownership alone never makes a book indexable** (consistent with PO-027 rule 8: ownership never makes a book AI-eligible).

### 8.2 Scope

**Conservative scope (default, D-6):** index a book only if it is published, has a stored text object, **and passes `IndexingPermission.check`** (§8.1).
- *Consequence:* in production nothing is indexed until E3 (the text-identity adapter, the manifest-based authority) exists **and** rights records grant `retrieval_indexing` with attestation. There is zero content-derived data in PostgreSQL until then; development and tests use fixtures.
- *Alternative (not recommended):* index all published books and rely only on query-time eligibility. That stores derived content (and text under S1) for books never cleared for indexing.

**Retention and pruning (default, D-7):**
- At most **two chunk sets per book**: the current `textHash` and the immediately previous one, kept up to **30 days** so in-flight answers can still resolve anchors.
- Durable citations (E6 Briefs) will later define references that block pruning; until then nothing references old sets.
- An explicit, idempotent **prune** command removes non-current sets past the grace period.
- An explicit **purge** command removes every set for a book immediately, for rights revocation or takedown. Book deletion cascades.
- No automatic background job in E5.

**Measurable resource limits (defaults, D-8; enforced in code and verified in the completion report):**

| Limit | Default | Enforcement |
|---|---|---|
| Chunks per book | ≤ 2,000 (the largest measured book is ≈ 1,330 at 1,500 characters) | Over the cap → book skipped, counted in a metric |
| Total index size (table + indexes) | ≤ 250 MB | The indexer checks `pg_total_relation_size` and refuses a new set above budget (fail closed) |
| Indexing concurrency | 1 book at a time; per-book transaction; per-book statement timeout 60 s | Command option; run manually, off-peak |
| Indexing time | Target ≤ 30 s per median book (measured) | Reported |
| Retrieval statement timeout | 2 s | Transaction-local `statement_timeout` |
| Retrieval latency | Target p95 ≤ 150 ms for ≤ 10 allowed books on a fixture sized like 10 copies of the largest book | Measured in integration |
| Query length / topK / budget | ≤ 500 code points / ≤ 20 / ≤ 8,000 tokens | Validated |
| User fragments scanned per query | ≤ 5,000 rows | `LIMIT` in SQL |
| Database growth | S1 ≈ 50–80 MB; S2 ≈ 30–55 MB for about 66 books **[A]** | Measured and reported |

## 9. Product Owner decisions required

| ID | Decision | Recommended default | Consequence of the default | Consequence of the alternative |
|---|---|---|---|---|
| **D-1** | TT-25: lexical or semantic at launch (the P0 packet requires it closed before E5) | **Lexical at launch**, vector-ready interface | No paraphrase or cross-language matching at launch; no provider or cost | Semantic now needs a production image change and an embedding provider before the gate |
| **D-2** | E5/E6 boundary | **E5 delivers dark components; E6 wires turns** (§5) | No grounded turns until E6; zero change to NEM-019 turn behaviour | E5 would need authority to change `ContextSourcePort`/`TurnService` (NEM-019 test exceptions) |
| **D-3** | Text-hash mechanism | **SHA-256 of MinIO bytes, one shared function; E3 binds the port** (§4) | Production retrieval stays empty until E3 binds the adapter | E5 binds it, which needs a NEM-019 architecture-test exception |
| **D-4** | Chunk text storage (legal sensitivity) | **S2 — selected in principle by the PO (2026-11-10), subject to rights verification**: verbatim text only in MinIO; PostgreSQL holds the lexical derivative and offsets | Final for licensed titles once legal answers RB-6 (the derivative) and RB-7 (offsite retention); see the decision packet | S1 is no longer in scope | S1: verbatim text **and** lexical derivative in PostgreSQL and its dumps; simpler and faster. S2: **lexical derivative** in PostgreSQL and its dumps, verbatim text only in MinIO; MinIO in the retrieval path. **Neither avoids content-derived data in PostgreSQL** |
| **D-5** | Install `unaccent` (contrib) | **Yes**, in the additive E5 migration | Accent-insensitive Spanish and English | Core only: accent-sensitive misses |
| **D-6** | Indexing scope and permission | **Book-level `IndexingPermission` (§8.1) with an explicit `retrieval_indexing` operation; default deny** | Empty production index until E3 and attested rights grant `retrieval_indexing` | Reuse `research_analysis` as the indexing grant (no separate consent to store an index); or index all published books (derived content stored for uncleared books) |
| **D-7** | Retention | **Current + previous set, 30-day grace; explicit purge on revocation** | Bounded storage; anchors survive one re-ingestion | Longer retention: more storage and exposure |
| **D-8** | Resource limits and retrieval defaults | **§8 table** | Measurable, fail-closed bounds | Other values |
| **D-9** | Mission identifier | PO to reserve | — | — |

## 10. Preserved invariants (review item 6)

| Invariant (owner) | How E5 preserves it |
|---|---|
| Allowed set explicit, non-empty, server-derived; query-level filter (ADR-006; 03 rule 6) | `RetrievalRequest.allowed` is required and non-empty, built by the caller's existing eligibility step; enforced as SQL predicates (`(bookId, textHash) ∈ allowed`), never post-filtered |
| Default deny; F-12 authority (NEM-019) | Query-time eligibility only through the unchanged `RightsService`. Indexing only through the book-level `IndexingPermission` (same ports, exported validators, attestation required, no user identity). With unbound ports, nothing is eligible or indexable |
| User vs system authority | The indexer never uses or fabricates a user identity, never calls `OwnershipPort`, and never calls `RightsService.eligibility` (architecture test) |
| Context Builder invariant `research_session_context` (NEM-019) | E5 returns `ContextItem`s; only the unchanged Context Builder seals them. E5 never calls `sealContext` (NEM-019 architecture test) |
| User isolation (ADR-006) | Highlight and note SQL constrains `userId = $requestingUser` and `bookId ∈ allowed` |
| Citation anchors (X-3) | `textHash` + code-point offsets per chunk; anchor resolver; NEM-022 citation policy unchanged |
| Turn order, ledger, Gateway (NEM-019/021/022) | No change; E5 budgets bound the context before `prepare`, so NEM-021 reservations stay bounded |
| Frozen contract v1 (NEM-021) | Not touched |
| Escucha Activa / sync maps (protected) | Read-only input for chapter labels and phrase ranges |
| Trust boundary (F-17) | Saved quotations and notes are `user_content`, never `library` |
| No content in logs or metrics | Architecture test (existing pattern) |

## 11. Not done (by instruction)

No implementation, migration, extension, dependency, service, CI/CD, infrastructure, staging, production, database modification, merge, deployment, or provider activity. Assumptions marked **[A]** are verified only in E5, on disposable databases.
