# 03 — Bounded Context Design

## Does the current structure support it? — CONFIRMED yes
Noetia's backend is a **modular monolith**: one NestJS process, feature modules with their own controller/service/entities/DTOs, shared infrastructure via injected services (Storage, Events, Search). A new bounded context is idiomatic here — it is another cluster of modules in the same process, not a new service. This preserves the "reader stability" boundary (a bug in a Noetia+ module cannot crash the reader modules any more than any other module can) while keeping deployment/ops unchanged.

**Recommendation:** implement Noetia+ as a **`knowledge/` context** (a parent folder of cohesive NestJS modules) inside `services/api/src`, plus new **queues in the existing `services/worker`**. Do **not** spin up a separate microservice for MVP — it would add ops/latency/cost with no benefit at current scale, and the async boundary (queues) already gives the isolation that matters.

## Submodule mapping

| Capability (from mission §8) | Realization | Where |
|------------------------------|-------------|-------|
| **AI Orchestrator** | NestJS service — turns a user intent into a plan (retrieve → build context → call model → cite → meter) | `knowledge/orchestrator` |
| **Semantic Retrieval** | Service over pgvector + Meili (hybrid) | `knowledge/retrieval` |
| **Context Builder** | Service — assembles permission-filtered, size-bounded context | `knowledge/context` |
| **Citation Engine** | Service — chunk → book/chapter/phrase-range → deep link | `knowledge/citation` |
| **Conversation Engine** | Module — sessions, messages, scope, persistence | `knowledge/conversation` |
| **Recommendation Engine** | Service — deterministic-first (personas/stats), LLM-optional | `knowledge/recommendations` |
| **Memory Engine** | Service + worker — resurfacing scoring | `knowledge/memory` |
| **Learning Engine** | Service — learning paths (post-MVP) | `knowledge/learning` |
| **Knowledge Graph** | Service — Postgres-relational first (no graph DB) | `knowledge/graph` (future) |
| **Content Generation** | Service + workers — drafts/flashcards/quizzes | `knowledge/create` |
| **Usage Metering** | Module + entity — AI accounting | `knowledge/metering` |
| **Model Router** | Service — task-class → model tier | `knowledge/ai` (with Gateway) |
| **AI Gateway / Provider abstraction** | Interface + adapters | `knowledge/ai/gateway` |
| **Safety / Copyright Guard** | Service — pre/post guards (injection, extraction, quotation) | `knowledge/safety` |
| **AI Analytics** | Reuses `EventsService` + metering rollups | `knowledge/*` + `events` |

## What is a module / service / worker / entity / external

- **NestJS modules (own controller + DI boundary):** `conversation`, `metering`, `retrieval`, `recommendations`, `memory`, `create`, plus a top-level `KnowledgeModule` that imports them and the shared `ai` (gateway+router) and `safety` providers.
- **Services (no controller):** orchestrator, context builder, citation, retrieval, model router, gateway, safety guard, recommendation, memory scorer.
- **Workers (BullMQ, in `services/worker`):** `plus-embed` (book/chunk embedding), `plus-knowledge-map`, `plus-create` (long generations), `plus-memory` (nightly resurfacing), `plus-recommend` (refresh). See [11](11-background-processing.md).
- **Persistence entities:** conversations, messages, chunks(+embeddings), knowledge assets, AI usage events, per-book AI permissions, feature entitlements/flags. See [09](09-data-model.md).
- **External provider integrations:** LLM + embedding providers behind the Gateway (adapters only; no SDK leaks into product code). See [06](06-ai-provider-architecture.md).

## Dependency direction (keeps the reader safe)
```
controllers (conversation, metering, ...)
        ↓
orchestrator  ──uses──▶ safety, entitlement, metering
        ↓
context builder ──uses──▶ retrieval (pgvector+Meili), permission resolver, citation
        ↓
ai gateway → model router → provider adapter (async/streamed)
```
- The reader modules **do not depend on** any `knowledge/*` module. The dependency is one-way (Noetia+ reads reader/book/fragment data via existing services/repos). Removing/disabling `KnowledgeModule` leaves the reader intact.
- All model calls are behind the Gateway; the orchestrator is the only place that composes a full request, making cost/permission/metering enforcement centralizable (no scattering).

## ADR candidates raised here
- **Monolith-module vs separate service** for Knowledge Intelligence (recommend module now).
- **Orchestrator-centric** enforcement point for permissions/metering/safety.
