# 02 — Current Integration Surface

How Noetia+ composes onto existing production assets. Legend: **REUSE** (use as-is) · **EXTEND** (small additive change) · **NEW** (net-new) · **AVOID** (do not touch).

## Reuse map

| Existing asset | Verb | How Noetia+ uses it |
|----------------|------|---------------------|
| **PostgreSQL 16** (TypeORM, migrations-only) | REUSE / EXTEND | Primary store for all Noetia+ entities. Vector support requires the `pgvector` extension → image change (see [04](04-rag-and-retrieval.md)) — the one infra EXTEND. |
| **Redis 7** | REUSE | Cache (semantic results, public-domain answers), BullMQ backing, rate/fair-use counters. |
| **BullMQ + worker service** | EXTEND | New queues (embedding, knowledge-map, creation, resurfacing) consumed by the existing worker; API gains a `Queue` producer (small addition). |
| **Meilisearch (`books` index)** | REUSE | Stays lexical; becomes the lexical half of hybrid retrieval ([12](12-search-and-recommendations.md)). |
| **MinIO** | REUSE | Stores large generated artifacts (article/presentation drafts, exported knowledge maps) under a new prefix; book text already lives here for chunking. |
| **`Subscription` / `Plan` / Stripe / webhooks** | EXTEND | Add a Noetia+ plan + feature-entitlement mapping; reuse the (now idempotent) webhook path. No pricing changes in this mission. |
| **`SubscriptionGuard`** | REUSE / COMPOSE | Base for a `PlusEntitlementGuard` that adds feature-level checks ([08](08-entitlements-and-subscription.md)). |
| **`token_ledger`** | REUSE (as-is) — **DO NOT repurpose** | Book acquisition only. AI usage is metered separately ([07](07-cost-and-usage-model.md)). Explicit separation per mission §19. |
| **`user_personas`** (nightly cron, 20-theme taxonomy, 8 aggregations) | REUSE | Deterministic recommendation + memory signals before any LLM ([12](12-search-and-recommendations.md), [13](13-memory-and-knowledge-assets.md)). |
| **`EventsService.emit` / `events`** | REUSE | All `plus_*` analytics events ([16](16-observability.md)). |
| **`reading_stats` / `reading_progress`** | REUSE | GROW analytics; memory-engine completion signals. |
| **`fragments` (+ `themes`, `note`, phrase indices)** | REUSE (as source) | Highlights/notes are a retrieval scope and a knowledge-asset *source*; **not** overloaded (see [13](13-memory-and-knowledge-assets.md)). |
| **`shares` / quote cards / image-gen** | REUSE | CREATE outputs can flow into the existing share/quote-card pipeline. |
| **`sync_maps` (phrases: index/startTime/endTime)** | REUSE (read-only) | Citations map a chunk → phraseIndex range for deep-linking. **Pipeline itself: AVOID modifying.** |
| **Reader (`/reader/[id]`, `phraseIndex`, `seekToPhrase`)** | EXTEND (tiny) | Add a `?phrase=N` deep-link param honoring existing `seekToPhrase`/`scrollIntoView`. No behavior change otherwise. |
| **Escucha Activa / alignment pipeline** | AVOID | Untouched. Hard boundary. |
| **i18n ES/EN (web + mobile)** | REUSE | All Noetia+ UI strings; multilingual retrieval ([30 → 04](04-rag-and-retrieval.md)). |
| **Sentry / Prometheus / Grafana** | REUSE | AI-ops observability ([16](16-observability.md)). |
| **Author/publisher system (`userType`, book upload, `isPublished`)** | EXTEND | Per-book AI-permission flags authored here ([05](05-content-permissions.md), [11 Publisher AI Controls]). |
| **Public-domain catalog (`isFree`, ingestion)** | REUSE | The "Explore Public Knowledge" scope; safe to embed fully. |

## Producer gap (small, known) — CONFIRMED
The API does **not** currently import BullMQ as a *producer* (only the worker consumes `image-render`/`share-export`). Noetia+ adds a thin `QueueModule` in the API to enqueue jobs — an additive, low-risk change, not a new system.

## Composition principle
Every Noetia+ capability is assembled from the above rather than replacing anything. The only new *infrastructure* decision is the vector store (pgvector extension vs. external) — analyzed in [04](04-rag-and-retrieval.md). Everything else is new **application** code inside the existing modular monolith + worker.
