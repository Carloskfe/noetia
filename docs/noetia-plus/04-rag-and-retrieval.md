# 04 — RAG & Retrieval

## Sync phrase ≠ semantic chunk (recommended: keep them separate)
**Recommendation: RAG chunks are a NEW, separate concept from Escucha Activa sync phrases.** Reasons:

- **Purpose differs.** A sync phrase is an *audio-alignment unit* (~≤200 chars, timed to narration; `sync_maps.phrases[].{index,startTime,endTime}`). Its size/boundaries are chosen for narration timing, not semantic completeness. RAG needs *semantically coherent passages* (roughly paragraph/section, ~256–512 tokens with overlap) so retrieval returns meaningful, self-contained context.
- **Stability boundary.** The alignment pipeline is reader-critical and must stay untouched. Deriving chunks separately means embedding/re-chunking never risks the sync map.
- **Linkage, not identity.** A chunk **references** the phrase-index range it spans (`phraseIndexStart..phraseIndexEnd`), so a citation can deep-link to the exact narrated passage — reusing the reader's `phraseIndex`/`seekToPhrase` primitives — without the chunk *being* a phrase.

So: **derive chunks from the same stored book text, aligned to phrase-index ranges for deep-linking, but sized for semantics.** One book → many phrases (audio) and, independently, many chunks (AI).

## Chunk metadata (recommended fields)
`bookId, authorId, publisherId, language, chunkIndex, charStart/charEnd (in stored text), phraseIndexStart, phraseIndexEnd, chapter, section, tokenCount, contentScope (owned/public/licensed/restricted), aiPermissions snapshot (or ref), textHash (content-version), embeddingModel, embeddingVersion`. (Entity in [09](09-data-model.md).)

## Embeddings — vector store recommendation

**Evaluated (mission §9.2):**

| Option | Op complexity | Cost | Multilingual ES/EN | Fit for single Contabo VPS + Docker + backups | Verdict |
|--------|---------------|------|--------------------|-----------------------------------------------|---------|
| A. Meili lexical only | lowest | lowest | good lexical | already deployed | insufficient for semantic Q&A |
| B. Meili hybrid/vector (experimental in v1.7) | low | low | model-dependent | one store, but vector features are experimental/version-sensitive | viable later; risk on experimental features |
| C. External vector DB (Qdrant/Weaviate/etc.) | **high** | added infra | good | another stateful service to run/back up on a small VPS | rejected for MVP (ops/cost) |
| D. **PostgreSQL + pgvector** | **low** | none beyond DB | good with a multilingual embedding model | **one datastore, one backup, migrations-native** | **RECOMMENDED** |
| E. Redis vector | medium | memory-bound | ok | competes with cache/queue memory | rejected |

**Recommendation: D — PostgreSQL + `pgvector`.** Rationale: it keeps everything in the datastore the team already operates and backs up nightly; chunks + embeddings + permissions + citations live in one transactionally-consistent place; retrieval joins naturally with ownership/permission tables (permission filtering happens *in the query*); no new stateful service on a memory-constrained VPS. The single infra change is swapping the `postgres:16-alpine` image for a pgvector-enabled Postgres 16 image (or installing the extension) + an additive `CREATE EXTENSION vector` migration — reversible, well-trodden.

**Scale note:** pgvector with an HNSW/IVFFlat index comfortably serves the expected volume (dozens–hundreds of owned books/user; catalog in the low thousands). If catalog-wide semantic scale ever outgrows pgvector, option C becomes an ADR revisit — the Gateway/retrieval interface makes that swap local.

**Multilingual:** use **one multilingual embedding model** covering ES + EN so cross-language retrieval works (ask in ES about EN text and vice-versa) without separate indexes. The specific model is provider-configurable ([06](06-ai-provider-architecture.md)); dimension is stored per embedding version so a model change is a re-embed job, not a schema break.

## Retrieval flow (hybrid)
```
query
  → intent/scope detection (which pillar, which content scope)
  → lexical retrieval (Meilisearch, existing)  ┐
  → semantic retrieval (pgvector kNN)           ┘ fuse (RRF or weighted)
  → PERMISSION FILTER (content scope + per-book AI perms)   ← mandatory, before context
  → rerank (cheap cross-encoder or model rerank; optional MVP)
  → context builder (size-bounded, citation-tagged)
  → LLM (via Gateway/Router)
  → citations (chunk → phrase range → deep link)
```
Permission filtering is applied **after** candidate retrieval and **before** context assembly — see [05](05-content-permissions.md). For MVP (Ask This Book / Ask My Highlights) the scope is tiny (one owned book or the user's own fragments), so semantic-only retrieval over that book's chunks is sufficient; hybrid + rerank matter more for library-wide scopes (Phase 2).

## Embedding lifecycle
- Chunk + embed **once per content version** (`textHash`); re-embed only when text or model version changes — a BullMQ `plus-embed` job ([11](11-background-processing.md)).
- Owned/public-domain content is embedded on ingest/first-use; licensed non-owned content is embedded **only** for permitted representations ([05](05-content-permissions.md)).
- Embedding is **async and never blocks reading**; a book with no embeddings yet simply isn't Ask-able yet (graceful — [35](19-release-roadmap.md)/failure modes in [14](14-security-and-copyright.md)/[16](16-observability.md)).

## ADR candidates
- **Semantic index technology** (recommend pgvector) — highest-priority ADR.
- **Chunking strategy** (size, overlap, phrase-range linkage).
- **Embedding model** (multilingual, dimension, versioning).
