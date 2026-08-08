# ADR-004 — PostgreSQL + pgvector Semantic Retrieval

- **Status:** Accepted
- **Date:** 2026-08 (NEM-005A)
- **Decided by:** Product Owner (PO-004) + Product Architecture
- **Relates:** ratifies the recommendation in `docs/noetia-plus/04-rag-and-retrieval.md`; recorded as product policy in `docs/noetia-plus/PRODUCT-DECISIONS.md` (PO-004). Builds on ADR-001/002/003.

## Context
Noetia+ requires semantic (vector) retrieval to ground Noetia Brain answers in the user's entitled content. NEM-003 recommended PostgreSQL + pgvector; Product Architecture then reviewed the alternatives against Noetia's actual, already-operated infrastructure. The store must integrate cleanly with authoritative relational data (ownership, content permissions) so that authorization can be enforced **before** protected content enters model context (ADR-002), while keeping operational complexity low on the current single-node deployment.

## Decision
Noetia+ uses **PostgreSQL + pgvector** as the **authoritative semantic vector store**. **Meilisearch** remains responsible for lexical/full-text search and may participate in future hybrid retrieval. **No standalone vector database is introduced for the MVP.**

- **System of record:** PostgreSQL holds authoritative application data, ownership, content permissions, semantic chunks, embeddings (pgvector), provenance metadata, and citation relationships. Meilisearch remains a search/indexing system, not a system of record.
- **Semantic chunks stay separate from Escucha Activa sync phrases** (ADR/NEM-003 stance preserved): sync phrases are optimized for audio/text synchronization; semantic chunks are optimized for retrieval/AI context. Chunks **reference** a synchronization phrase range (`phraseIndexStart`/`phraseIndexEnd`) to enable provenance and future citation deep-linking **without** coupling AI chunking to reader synchronization.
- **Initial retrieval = exact vector search** while corpus size and measured performance permit. Do **not** introduce approximate-nearest-neighbor indexing (HNSW/IVFFlat) now — the initial goals are retrieval correctness, high recall, simple evaluation, and operational simplicity.
- **Retrieval abstraction is mandatory:** product/business logic (Noetia Brain) must not couple to pgvector-specific queries. A future **Semantic Retrieval Interface/service** sits between Noetia Brain and pgvector so the implementation technology can be replaced without rewriting the domain. pgvector is the approved implementation, **not** an irreversible architectural dependency.

## Rationale
Noetia already operates PostgreSQL, Redis, Meilisearch, MinIO, application services, background processing, and monitoring. pgvector adds semantic search inside the datastore the team already runs and backs up, gives transactional consistency and a natural join to relational permission data (ADR-002), and fits the expected MVP scale — without a new stateful service, backup system, monitoring target, upgrade lifecycle, or failure mode.

## Alternatives considered
- **Meilisearch-only semantic storage — Rejected** as the authoritative semantic store for the MVP (vector features are experimental/version-sensitive). Meilisearch remains strategically useful for lexical search and future hybrid retrieval.
- **Standalone vector database** (e.g. Qdrant, Weaviate, Pinecone, or equivalent) — **Rejected for the MVP**: operational complexity (another backup system, monitoring target, memory/CPU consumption, upgrade lifecycle, failure mode) is not currently justified by any requirement.
- **Redis vector storage — Rejected** for this role: Redis already carries cache/queues/sessions; persistent embedding workloads should not compete for that resource.
- **PostgreSQL + pgvector — Accepted:** existing operational expertise; existing backup system; relational permission integration; transactional consistency; low additional infrastructure complexity; sufficient expected MVP scale; migration compatibility; and a future abstraction that allows replacement.

## Consequences
**Positive:** one datastore/backup to operate; permission-aware retrieval via native joins; transactional consistency; minimal new ops surface; fast path to MVP.
**Negative:** vector workloads share Postgres resources (must be monitored); pgvector has a practical scale/concurrency ceiling; exact search cost grows with corpus (mitigated by scoped queries and, later, evidence-driven ANN).

## Guardrails
- Product logic depends on the **Semantic Retrieval Interface**, never on pgvector-specific SQL.
- **Exact search first**; add HNSW/IVFFlat only when measured evidence requires it (see triggers).
- Embedding **provider/model remains configurable under ADR-001**; PO-004 does not select an embedding model.
- **Multilingual (ES/EN, incl. cross-language)** retrieval is required (future implementation uses a qualified multilingual embedding model unless evaluation shows better).
- **Embedding versioning:** preserve metadata (provider/model, embedding version, dimensionality where needed, source content version/hash, generation status) so a model change is a **re-embedding operation**, not schema corruption.
- **Permission-aware (ADR-002):** retrieval must enforce entitlement, content scope, title-level AI permissions, public-domain status, and restricted-content rules **before** content enters model context.
- **Infrastructure safety (future implementation mission only):** PostgreSQL 16 compatibility verification; backup/snapshot verification; dev/staging verification before production; safe extension enablement; **additive** TypeORM migration; no recreation of the production database; no modification of previously deployed migrations; verification that existing tables/data remain intact; rollback/recovery planning. **NEM-005A authorizes none of these.**

## Future reconsideration triggers
Revisit via a **future ADR** if measured evidence shows: semantic corpus scale materially exceeds projections; retrieval latency becomes unacceptable; concurrency exceeds Postgres's practical retrieval capacity; vector workloads materially interfere with transactional workloads; specialized retrieval features become strategically necessary; or the infrastructure architecture moves beyond the current deployment model.

## Relationships
- **ADR-001 (Provider abstraction):** the embedding model is a configurable provider choice under ADR-001; ADR-004 selects only the vector *store*, not the model.
- **ADR-002 (Permission-aware content intelligence):** a primary reason for pgvector — semantic retrieval joins authoritative relational permission data so authorization precedes context inclusion.
- **ADR-003 (Source-aware hybrid intelligence):** chunk→phrase-range references support provenance and citation deep-linking into Escucha Activa across the This Book / My Knowledge / Expand modes.
- **NEM-003:** ratifies NEM-003's recommendation (`04-rag-and-retrieval.md`); does not rewrite or implement it.

## Product Owner decision
**PO-004 — Semantic Retrieval Store:** PostgreSQL + pgvector is the authoritative semantic vector store; Meilisearch stays lexical; no standalone vector DB for the MVP. See `docs/noetia-plus/PRODUCT-DECISIONS.md`.

## Open (subordinate) decisions — remain unresolved
Embedding provider/model selection; exact chunking parameters; fusion/reranking algorithm for hybrid retrieval; the point at which approximate indexing becomes warranted. These are evaluation/configuration decisions the abstraction is designed to absorb.
