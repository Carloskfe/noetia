# 19 — Release Roadmap

> **UPDATE (NEM-005):** the three principal blockers are **resolved** (PO-001/002/003; ADR-001/002/003; [PRODUCT-DECISIONS.md](PRODUCT-DECISIONS.md)). Phase 0 architecture is settled; remaining pre-build inputs are **subordinate selection/configuration** decisions (exact provider/model, verified prices, exact quotation thresholds, final price) — see [20](20-open-product-decisions.md). Implementation still requires a separate, explicitly-authorized implementation mission per NEM-004 governance.

The mission's phase sequence is **sound**; below is a validated/refined version with dependency ordering and cost discipline. Each phase ships behind flags ([18](18-feature-flags-rollout.md)) to beta → % rollout → GA.

## Phase 0 — Infrastructure (no user-facing AI)
Foundation everything else needs. **Def of done:** an internal, flagged test can Ask a public-domain book end-to-end.
- pgvector extension + `book_chunks` + embedding pipeline (`plus-embed`) — [04](04-rag-and-retrieval.md), [11](11-background-processing.md).
- AI Gateway + Model Router + one provider adapter (config-driven) — [06](06-ai-provider-architecture.md).
- Permission-aware retrieval + `ContentScopeResolver` + `book_ai_permissions` defaults — [05](05-content-permissions.md).
- Usage metering (`ai_usage_events`) + budget guard — [07](07-cost-and-usage-model.md), [16](16-observability.md).
- Feature-entitlement service + `PlusEntitlementGuard` + Noetia+ plan (data) — [08](08-entitlements-and-subscription.md).
- Feature flags + observability dashboard — [18](18-feature-flags-rollout.md), [16](16-observability.md).
- **Eval harness** (Spanish/English Q&A, citation accuracy, hallucination, extraction-refusal) — offline gate before any GA.

## Phase 1 — Ask (MVP)
- **Ask This Book**, **Ask My Highlights**, **citations → reader deep link**, semantic search, deterministic recommendations, usage transparency.
- **Def of done:** grounded answers with accurate citations that open the reader at the cited phrase; cost/subscriber within Healthy band on beta; reader unaffected under AI outage (verified).

## Phase 2 — Connect
- **Ask My Library**, compare books/authors, agreements/contradictions, LLM-explained recommendations, summarize highlights. Introduces `knowledge_assets` (comparison/summary). Hybrid retrieval + rerank earn their keep here.

## Phase 3 — Remember
- Resurfacing (deterministic first — [13](13-memory-and-knowledge-assets.md)), learning paths, GROW analytics surfaced. Mostly low-cost/existing data.

## Phase 4 — Create
- Social posts, articles, essays, outlines, speeches, flashcards, quizzes — traceable to sources; long generations async → assets (+ MinIO). Highest per-job cost → strict fair-use + async.

## Phase 5 — Intelligence
- Knowledge maps (Postgres/jsonb first), deeper personalization; **future-only** concepts (intellectual timeline/profile, public identity) kept architecturally possible, not built.

## Sequencing rationale (refinements to the mission)
1. **Recommendations move into Phase 1** (from "Connect") because they're deterministic over existing persona/stats data — a near-free DISCOVER win that doesn't wait on synthesis.
2. **Eval harness is part of Phase 0**, not an afterthought — grounding/citation quality gates GA.
3. **Mobile Ask** trails web Phase 1 by a short margin (not simultaneous — [17](17-web-mobile-ux.md)).
4. Each phase is **independently flaggable and reversible**; a phase can be paused on cost/quality without affecting shipped phases or the reader.

## Cross-cutting (every phase)
Permissions, metering, flags, observability, privacy, i18n, graceful degradation, and the reader-safety invariant apply from Phase 0 onward — they are not a later phase.
