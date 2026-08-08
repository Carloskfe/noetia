# 22 — Implementation Epics

Roadmap → Epics. **Not** broken into stories (that follows Product Architecture review). Each Epic: objective · dependencies · systems · risk · expected migrations · backend · frontend · mobile · observability · tests · definition of done. **Nothing here is authorized to build yet.**

---

## E0.1 — Vector foundation & embedding pipeline
- **Objective:** chunk + embed books into pgvector; make a book "Ask-able".
- **Deps:** none (Phase 0 root).
- **Systems:** Postgres(+pgvector), MinIO(book text), worker/BullMQ, Gateway(embed).
- **Risk:** Med (infra image change).
- **Migrations (expected):** `CREATE EXTENSION vector`; `book_chunks`. (Design-only now.)
- **Backend:** chunker, `plus-embed` job, retrieval read path.
- **Frontend/Mobile:** none.
- **Observability:** embedding latency/backlog, index status.
- **Tests:** chunk boundaries, phrase-range linkage, idempotent re-embed, permission-join on retrieval.
- **DoD:** a public-domain book embeds and returns permission-filtered semantic hits with correct phrase-range citations.

## E0.2 — AI Gateway, Model Router & provider adapter
- **Objective:** provider-agnostic chat/embed/rerank with task-class routing.
- **Deps:** none.
- **Systems:** new `knowledge/ai`, config.
- **Risk:** Med (external provider).
- **Migrations:** none (routing table can be config/DB — small).
- **Backend:** Gateway interface, one adapter, router, normalized usage output.
- **Observability:** per-model latency/error/cost hooks.
- **Tests:** adapter contract, router mapping, graceful "provider unconfigured/unavailable".
- **DoD:** a task-typed request routes to a model and returns a normalized result + usage; swapping the adapter needs no feature change.

## E0.3 — Permission-aware retrieval & content scopes
- **Objective:** enforce OWNED/PUBLIC/LICENSED/RESTRICTED before context.
- **Deps:** E0.1.
- **Systems:** `knowledge/retrieval`, `user_books`, `book_ai_permissions`.
- **Risk:** High (rights).
- **Migrations:** `book_ai_permissions` (+ defaults seed).
- **Backend:** `ContentScopeResolver`, query-time filter + backstop.
- **Tests:** each scope; intersection (owned but publisher-restricted → restricted); restricted never retrieved.
- **DoD:** no restricted/licensed-full content can enter context under any scope.

## E0.4 — Usage metering, budget guard & cost telemetry
- **Objective:** account every AI call; expose COGS/revenue.
- **Deps:** E0.2.
- **Systems:** `knowledge/metering`, Redis, Prometheus/Grafana.
- **Risk:** Med.
- **Migrations:** `ai_usage_events`.
- **Backend:** metering writer, Redis fair-use counters, budget guard, config pricing.
- **Observability:** cost/subscriber, COGS ratio bands, tier mix.
- **Tests:** cost calc from config prices, counter increments, budget trip → degrade.
- **DoD:** every model call produces a usage row; the COGS/revenue panel is live.

## E0.5 — Entitlements, Noetia+ plan & feature flags
- **Objective:** capability-gated access; ownership≠subscription; progressive rollout.
- **Deps:** billing (existing).
- **Systems:** `subscriptions`/`plans`, new entitlement service, flags.
- **Risk:** Med (revenue).
- **Migrations:** `plus_capability_grants`, `feature_flags`; a Noetia+ `plans` row (data). **No Stripe products in this mission.**
- **Backend:** `PlusEntitlementGuard`, `@RequiresCapability`, flag resolver (Redis-cached), master kill switch.
- **Frontend/Mobile:** upgrade-prompt handling for 402/403.
- **Tests:** capability allow/deny, master/kill flag, % rollout determinism, **reader path never calls entitlement**.
- **DoD:** a flagged capability is grantable to beta users; disabling the master flag leaves the reader fully working.

## E0.6 — Evaluation harness (quality gate)
- **Objective:** offline eval before any GA.
- **Deps:** E0.1–E0.3.
- **Systems:** test tooling, eval datasets.
- **Risk:** Med.
- **Tests/DoD:** ES + EN + cross-language Q&A sets, citation-accuracy, hallucination, grounding, extraction-refusal — with thresholds that gate rollout.

## E1.1 — Ask This Book + Ask My Highlights + Citations (MVP)
- **Objective:** the flagship grounded Q&A with reader deep-links.
- **Deps:** E0.1–E0.6.
- **Systems:** `knowledge/{orchestrator,context,citation,conversation}`, reader `?phrase=`.
- **Risk:** High (first user-facing AI).
- **Migrations:** `ai_conversations`, `ai_messages`.
- **Backend:** orchestrator, context builder, citation engine, conversation CRUD, `/plus/ask` (stream), `/plus/citations/:id/resolve`.
- **Frontend:** Ask entry in reader/book/fragment; conversation UI; citation → `/reader/:id?phrase=N`.
- **Mobile:** Ask-this-book + citations (fast-follow).
- **Observability:** ask latency, failure, cost, citation-click events.
- **Tests:** grounded answer, citation resolves to correct phrase, entitlement/limit errors, no-sources refusal, reader unaffected on provider outage.
- **DoD:** beta users ask an owned book and jump from a citation into Escucha Activa; COGS within Healthy on beta.

## E1.2 — Deterministic recommendations + semantic search (DISCOVER)
- **Objective:** near-zero-cost DISCOVER.
- **Deps:** E0.1 (search), personas (existing).
- **Systems:** `knowledge/recommendations`, Meili + pgvector, `plus-recommend` job.
- **Risk:** Low.
- **Migrations:** none (cache table optional).
- **Backend:** deterministic scorer, `/plus/recommendations`, `/plus/search`.
- **Frontend:** recs row (library), semantic search in search UI.
- **Tests:** scoring determinism, permission-filtered search, exclude owned/culled.
- **DoD:** personalized recs + semantic search with no LLM spend.

## E2.x — Connect (Ask My Library, compare, contradictions, summaries)
- **Deps:** E1.1; introduces `knowledge_assets`, hybrid rerank. **Risk:** Med-High (cost/scale). Migrations: `knowledge_assets`. Async for heavy comparisons.

## E3.x — Remember (resurfacing, learning paths, GROW)
- **Deps:** fragments/stats/personas (existing). **Risk:** Low-Med. `plus-memory` job; mostly deterministic.

## E4.x — Create (posts/articles/outlines/flashcards/quizzes)
- **Deps:** E2 assets. **Risk:** Med (per-job cost). Async → assets + MinIO; strict fair-use.

## E5.x — Intelligence (knowledge maps, deeper personalization)
- **Deps:** E2/E3. **Risk:** Med. Postgres/jsonb graph first; future-only timeline/profile kept possible.

---
**Critical path to MVP:** E0.1 → E0.2 → E0.3 → E0.4 → E0.5 → E0.6 → E1.1 (+ E1.2 in parallel after E0.1). E0.3, E0.5, E1.1 carry the highest risk and deserve the most review.
