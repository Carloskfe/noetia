# 11 — Background Processing

Reuses the existing **BullMQ + Redis** substrate (worker service consumes queues; NEM-001 confirmed). Noetia+ adds new queues consumed by the same worker, and a thin **`Queue` producer** in the API (the one small addition — the API doesn't currently produce to BullMQ).

## Sync vs async boundary (reader-safety-driven)
- **Synchronous (request/response, streamed):** interactive Ask Q&A and retrieval-only search — but these depend on **precomputed** embeddings, so the expensive part is already async.
- **Asynchronous (BullMQ):** anything slow, bulk, or non-interactive. Never block a request (or the reader) on it.

## Proposed queues (worker)
| Queue | Trigger | Work | Priority |
|-------|---------|------|----------|
| `plus-embed` | book ingest / first Ask / text-version change | chunk + embed a book (pgvector upsert); set `aiIndexStatus` | high (gates Ask) |
| `plus-knowledge-map` | user request | build/refresh a knowledge map → asset | normal |
| `plus-create` | user request | long-form generation (article/presentation/bulk flashcards) → asset (+ MinIO for large) | normal |
| `plus-memory` | nightly cron | resurfacing scoring per user ([13](13-memory-and-knowledge-assets.md)) | low |
| `plus-recommend` | nightly / on-persona-update | refresh deterministic recommendations cache | low |
| `plus-usage-rollup` | nightly | aggregate `ai_usage_events` → monthly rollups; retention pruning | low |

## Patterns
- **Idempotent jobs** keyed by `(bookId, textHash, embeddingVersion)` for embedding, `(userId, period)` for rollups — safe re-runs (lesson reused from NEM-002A webhook idempotency).
- **Backpressure & budget:** embedding/creation jobs check the global AI budget guard before calling the Gateway; if over budget, they defer (retry with backoff) and emit an ops alert rather than overspend.
- **Failure isolation:** a failed job never affects the reader or other queues; retries with capped backoff; dead-letter for inspection; Sentry on exhaustion.
- **Concurrency limits:** per-queue worker concurrency capped to fit the VPS memory envelope (NEM-001: worker limited to 256M) — embedding batched, not parallel-unbounded.

## Nightly cadence (compose with existing crons)
The persona cron runs 02:00; the annual-token cron 01:00 (NEM-002A). Noetia+ nightly jobs (`plus-memory`, `plus-recommend`, `plus-usage-rollup`) slot into off-peak windows and are cheap/deterministic where possible to keep cost flat.

## Graceful degradation
If Redis/worker is down: Ask still works if embeddings already exist (retrieval reads pgvector directly); new embedding/creation jobs queue and drain later; the reader is entirely unaffected. See [16](16-observability.md)/[14](14-security-and-copyright.md) failure modes.
