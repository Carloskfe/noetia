# Noetia+ — Executive Summary (NEM-003)

**Audience:** Founder/CEO · Product Architecture · Lead Engineering · technical advisors.
**Nature:** DESIGN. No code, no migrations, no SDKs, no infra deployed. Provider prices treated as **UNKNOWN/configurable** — never fabricated.

---

## 1. What Noetia+ is
A **recurring intelligence layer built around the user's permanent library** — grounded Q&A with citations back into the reader, semantic discovery, cross-book synthesis, memory/resurfacing, and creation tools. Flagship = **Noetia Brain**. The organizing law, enforced in the architecture, is:

> **Books are permanent. Intelligence is the subscription.**

Ownership (`user_books`, permanent) and the Noetia+ subscription (recurring) are kept **technically orthogonal**: cancelling Noetia+ never removes an owned book or its reading, audio, highlights, or notes. Owned-book reading paths never call a Noetia+ check.

## 2. Recommended architecture (one picture)
A **new `knowledge/` bounded context inside the existing modular monolith** + new **BullMQ queues in the existing worker**. No microservice, no new datastore except a **pgvector extension on the existing Postgres**.

```
/plus/* controllers ─▶ Orchestrator ─▶ [Entitlement] [Safety] [Metering]
                              │
                     Context Builder ─▶ Retrieval (Meili lexical + pgvector semantic)
                              │              └▶ Permission-aware ContentScope filter
                     AI Gateway ─▶ Model Router ─▶ provider adapter (swappable)
                              │
                        Citations ─▶ deep link /reader/:id?phrase=N
```
Everything routes through the **Orchestrator**, so permissions, metering, safety, and cost control are enforced in one place — not scattered (the NEM-002A lesson applied).

## 3. Recommended MVP
**Phase 0 (infrastructure) + Phase 1 (Ask).** Concretely: **Ask This Book**, **Ask My Highlights**, **citations that open the reader at the cited passage**, **semantic search**, and **deterministic recommendations** (from data we already compute). This is the smallest slice that proves the entire stack and delivers day-one value, while keeping variable cost low (single-book scope, deterministic recs).

## 4. Cost-control strategy (the make-or-break)
Noetia+ must clear a **configurable `AI COGS / revenue` target** under a < $10 price. Levers, all designed in:
- **Model Router** — most traffic on Cheap/Mid tiers; frontier only for genuine synthesis.
- **Context discipline** — retrieval returns only top-k permitted chunks; hard context caps.
- **Caching** — book-level reusable computation shared safely; user-private computation cached per-user only.
- **Fair-use** — soft + hard + model-specific caps bound the heavy tail; user sees "requests/analyses/jobs", never tokens.
- **Global budget guard + kill switch** — spend cannot run away silently; degrade then disable.
- **Live telemetry** — a Grafana panel computes the real COGS/revenue ratio with bands **Excellent ≤15% · Healthy 15–30% · Caution 30–45% · Unsustainable >45%**.

A configurable cost model ([07](07-cost-and-usage-model.md)) turns verified provider prices into a **maximum acceptable average AI COGS per subscriber**. **Real prices are required before any pricing commitment** — they are an open decision, not fabricated here.

## 5. Strongest reusable Noetia assets
Noetia is unusually ready — most primitives already exist (verified in NEM-001/002):
- **Permanent-ownership + token/subscription/Stripe spine** → entitlements compose directly; ownership≠subscription is already the model.
- **`user_personas` (nightly) + `reading_stats` + fragment themes** → **deterministic recommendations & memory with near-zero LLM cost.**
- **Fragments + notes + shares + quote cards** → the CREATE/SHARE loop and Ask-My-Highlights scope.
- **`sync_maps` + reader `phraseIndex`/`seekToPhrase`** → **citation deep-links into Escucha Activa** with one tiny additive reader param.
- **BullMQ/Redis/MinIO/Meilisearch/Postgres** → async, cache, storage, lexical search, and (via pgvector) semantic — no new infra service.
- **EventsService, Prometheus/Grafana/Sentry, ES/EN i18n** → analytics, observability, and Spanish-first internationalization for free.

## 6. Largest engineering additions (net-new)
1. **pgvector + chunking/embedding pipeline** (`book_chunks`, `plus-embed`) — chunks are **separate from sync phrases** (linked by phrase range).
2. **AI Gateway + Model Router + provider adapters** — provider-agnostic, config-driven.
3. **Permission-aware retrieval + per-book AI permissions** — rights enforced before context.
4. **Usage metering + budget guard + cost telemetry** — separate from book tokens.
5. **Feature-entitlement service + `PlusEntitlementGuard` + feature flags.**
6. **Conversation + citation engines**; later, **`knowledge_assets`** (new entity, **not** an overload of `fragments`).

## 7. Largest risks
- **R1 AI cost > revenue** (heavy tail / context bloat) — mitigated by router, caps, budget guard, telemetry; partly a *pricing* decision.
- **R2 Copyright extraction / rights breach** — mitigated by permission-aware retrieval, quotation policy, training-OFF default; partly a *legal* decision.
- **R3 Reader regression** — mitigated by a hard one-way boundary + kill switch (low by design).
- Plus R4 privacy/Duo-Family leakage, R5 prompt injection, R6 hallucination/citations, R7 entitlement bypass, R8 vendor lock-in ([21](21-risk-register.md)).

The two irreducible residuals (**cost**, **copyright**) are as much policy as engineering — hence the open decisions.

## 8. Release phases
**0 Infra → 1 Ask (MVP) → 2 Connect → 3 Remember → 4 Create → 5 Intelligence.** Each ships behind flags (beta → % → GA), independently reversible. Recommendation moved into Phase 1 (deterministic); the eval harness is part of Phase 0 (quality gate). Mobile Ask trails web Phase 1 slightly. ([19](19-release-roadmap.md), [22](22-implementation-epics.md)).

## 9. Product decisions still required (engineering will not invent these)
Price (D1); usage limits (D2); grounded-only vs general knowledge (D3); quotation limits — legal (D4); post-cancellation retention (D5); publisher default permissions (D6); public profile (D7); Duo/Family Noetia+ model (D8); provider selection + no-training posture + **verified prices** (D9); usage-unit naming (D10); usage retention (D11); AI-credit add-ons (D12). Full analysis with recommended defaults in [20](20-open-product-decisions.md).

**ADRs accepted (NEM-005 / NEM-005A):** AI provider abstraction ([ADR-001](../architecture/adr/ADR-001-ai-provider-abstraction-and-model-routing.md)); permission-aware content intelligence ([ADR-002](../architecture/adr/ADR-002-permission-aware-content-intelligence.md)); source-aware hybrid intelligence ([ADR-003](../architecture/adr/ADR-003-source-aware-hybrid-intelligence.md)); **semantic-index technology = PostgreSQL + pgvector** ([ADR-004](../architecture/adr/ADR-004-postgresql-pgvector-semantic-retrieval.md)). **Still candidate (future ADRs):** KnowledgeAsset model; feature-entitlement architecture; usage metering; conversation retention; chunking strategy; hybrid-fusion/rerank.

## 10. The §48 questions, answered
1. **What is Noetia+?** §1 / [01](01-product-scope.md). 2. **Reused?** §5 / [02](02-current-integration-surface.md). 3. **Built?** §6 / [22](22-implementation-epics.md). 4. **Data changes?** [09](09-data-model.md). 5. **Retrieval?** [04](04-rag-and-retrieval.md)/[12](12-search-and-recommendations.md). 6. **Rights?** [05](05-content-permissions.md)/[14](14-security-and-copyright.md). 7. **Cost control?** §4 / [07](07-cost-and-usage-model.md). 8. **Under a viable price?** §4 + cost model (pending verified prices). 9. **Fail safely?** reader-safety boundary + graceful degradation ([03](03-bounded-context-design.md)/[21](21-risk-register.md)). 10. **Incremental rollout?** [18](18-feature-flags-rollout.md)/[19](19-release-roadmap.md). 11. **Risks?** [21](21-risk-register.md). 12. **Product decisions?** [20](20-open-product-decisions.md). 13. **Epics?** [22](22-implementation-epics.md).

## 11. Readiness verdict

```
READY FOR PRODUCT REVIEW
```

**Why:** the architecture is coherent, composes onto verified existing assets, honors the permanent-ownership philosophy in code, keeps the reader strictly protected, and has concrete cost-control and rights-enforcement mechanisms plus a phased, reversible rollout. The design is complete enough for Product Architecture to make the outstanding **product/legal/pricing** decisions.

**Caveat — UPDATED by NEM-005:** the three principal blockers are now **RESOLVED** by Product Owner decisions **PO-001/002/003** (ADR-[001](../architecture/adr/ADR-001-ai-provider-abstraction-and-model-routing.md)/[002](../architecture/adr/ADR-002-permission-aware-content-intelligence.md)/[003](../architecture/adr/ADR-003-source-aware-hybrid-intelligence.md); [PRODUCT-DECISIONS.md](PRODUCT-DECISIONS.md)): **(a)** provider-agnostic AI Gateway + dynamic routing with a ~$1.50/mo COGS target and configurable bands; **(b)** permission-aware content intelligence with anti-reconstruction and a product-policy/legal separation; **(c)** source-aware hybrid intelligence (This Book / My Knowledge / Expand). What **remains** before build is now **subordinate**: verified provider prices, exact provider/model selection, exact quotation thresholds, final retail price — all *configuration/selection*, which the architecture is designed to absorb. Implementation still requires a separate, explicitly-authorized implementation mission (NEM-004 governance); do not start E0/E1 without one.

**Recommended next mission (NEM-004):** an **implementation-authorization** mission scoped to **Phase 0 only** (E0.1–E0.6: pgvector + embeddings, Gateway/Router, permission-aware retrieval, metering + budget guard, entitlements + flags, eval harness) — behind the master flag, no user-facing AI — contingent on the three inputs above and a chosen ADR for the semantic index. Ship Phase 0 on staging first (the environment recommended in NEM-002).
