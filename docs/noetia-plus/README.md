# Noetia+ — Product & Technical Integration Design (NEM-003)

> **DESIGN MISSION.** No production code, no migrations, no AI SDKs, no vector DBs, no Stripe products, no deployment. Everything here is a proposal for Product Architecture review.
> Grounded in the existing production repository (verified in NEM-001/002). Where a claim is not verified from code it is labeled **INFERRED**, **UNKNOWN**, or **OPEN DECISION**.

## What Noetia+ is (one paragraph)
Noetia+ is a **recurring intelligence layer built around the user's permanent Noetia library** — semantic discovery, grounded Q&A with citations back into the reader, cross-book synthesis, memory/resurfacing, and creation tools. Its flagship capability is **Noetia Brain**. The organizing principle is **"Books are permanent. Intelligence is the subscription."** — owning a book is forever; Noetia+ is a separate recurring service *around* owned/eligible content, and cancelling it never removes an owned book.

## Non-negotiable
**READER STABILITY FIRST.** Noetia+ is strictly additive. It must not touch the reader, Escucha Activa, or the alignment/sync-map pipeline; AI failure/latency/outage must never affect reading or audio; Noetia+ must be disable-able with zero reader impact.

## Document index

| # | Document | Answers |
|---|----------|---------|
| — | [EXECUTIVE_SUMMARY.md](EXECUTIVE_SUMMARY.md) | ≤8-page summary + readiness verdict |
| 01 | [01-product-scope.md](01-product-scope.md) | What Noetia+ is; the five pillars; MVP boundary |
| 02 | [02-current-integration-surface.md](02-current-integration-surface.md) | Exactly what existing assets we reuse and how |
| 03 | [03-bounded-context-design.md](03-bounded-context-design.md) | Knowledge Intelligence context; modules/services/workers |
| 04 | [04-rag-and-retrieval.md](04-rag-and-retrieval.md) | Chunking, embeddings, hybrid retrieval, vector-store recommendation |
| 05 | [05-content-permissions.md](05-content-permissions.md) | Permission-aware retrieval; content scopes; publisher AI controls |
| 06 | [06-ai-provider-architecture.md](06-ai-provider-architecture.md) | Provider abstraction + model router |
| 07 | [07-cost-and-usage-model.md](07-cost-and-usage-model.md) | Configurable cost model; COGS bands; scenarios |
| 08 | [08-entitlements-and-subscription.md](08-entitlements-and-subscription.md) | Feature entitlements; ownership vs subscription separation |
| 09 | [09-data-model.md](09-data-model.md) | Proposed entities (reuse/extend/new/future) |
| 10 | [10-api-design.md](10-api-design.md) | Proposed API surface |
| 11 | [11-background-processing.md](11-background-processing.md) | BullMQ queues & async boundaries |
| 12 | [12-search-and-recommendations.md](12-search-and-recommendations.md) | Meili + semantic coexistence; recommendation engine |
| 13 | [13-memory-and-knowledge-assets.md](13-memory-and-knowledge-assets.md) | Memory engine; KnowledgeAsset model |
| 14 | [14-security-and-copyright.md](14-security-and-copyright.md) | Prompt injection, anti-extraction, entitlement bypass |
| 15 | [15-privacy.md](15-privacy.md) | Private-by-default; deletion; Duo/Family isolation |
| 16 | [16-observability.md](16-observability.md) | AI ops metrics; cost-per-subscriber telemetry |
| 17 | [17-web-mobile-ux.md](17-web-mobile-ux.md) | Surfaces in web + mobile |
| 18 | [18-feature-flags-rollout.md](18-feature-flags-rollout.md) | Master + capability flags; beta; % rollout |
| 19 | [19-release-roadmap.md](19-release-roadmap.md) | Phased delivery (validated/revised) |
| 20 | [20-open-product-decisions.md](20-open-product-decisions.md) | Decisions Product must make |
| 21 | [21-risk-register.md](21-risk-register.md) | Risks × severity × mitigation |
| 22 | [22-implementation-epics.md](22-implementation-epics.md) | Roadmap → engineering Epics |
| 45 | (in 20/03/04/...) | ADR candidates listed in §"ADR candidates" of relevant docs + summarized in 20 |

## Reading order for reviewers
Start with `EXECUTIVE_SUMMARY.md`, then `01`, `03`, `04`, `05`, `07`, `08`. Those seven carry the load-bearing decisions; the rest is depth.

## Constraint compliance
No secrets/PII. No code changed. No entity/migration created. No provider/model committed as final. Provider prices are treated as **UNKNOWN/configurable** — never fabricated.
