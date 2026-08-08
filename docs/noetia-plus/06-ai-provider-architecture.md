# 06 — AI Provider Architecture

> **RATIFIED by PO-001 / [ADR-001](../architecture/adr/ADR-001-ai-provider-abstraction-and-model-routing.md) (NEM-005).** The provider-agnostic AI Gateway + dynamic model routing described here is an approved architecture decision. Workload classes map to the ADR's tiers: **low-cost** (classification, tagging, intent, query-rewrite, extraction, light summary, embedding, rec-augmentation) → Cheap; **standard intelligence** (Ask This Book / Ask My Highlights / grounded Q&A / synthesis / learning paths) → Mid; **advanced reasoning** (cross-book synthesis, contradiction, complex comparison, sophisticated maps, high-value long-form/presentations) → High. **No model name is part of the customer promise.** Exact provider/model selection + verified prices remain subordinate open decisions ([20](20-open-product-decisions.md) D9).

## Goal
Noetia product logic must **not** be hardwired to one AI SDK. Provider/model choices must be swappable and config-driven, so pricing/capability changes never require rewriting features.

## Layers
```
Knowledge Intelligence (orchestrator, retrieval, create, ...)
        ↓  (task-typed requests, provider-agnostic)
Model Router        — maps task class → model tier → concrete model
        ↓
AI Gateway / Provider Interface  — one internal contract (chat, embed, rerank, stream)
        ↓
Provider adapters
    ├── Anthropic
    ├── OpenAI
    ├── Google
    └── self-hosted / future
```

## AI Gateway (internal contract)
A single interface the rest of Noetia+ depends on — e.g. `chat(request): stream|result`, `embed(texts): vectors`, `rerank(query, docs): scores`. Requests are **provider-agnostic** (messages, system, max output, task class, language). The Gateway:
- selects the adapter for the routed model,
- normalizes responses + **usage** (input/output tokens, embeddings count) so metering is uniform ([07](07-cost-and-usage-model.md), [19-usage]),
- centralizes retries, timeouts, streaming, and failure translation,
- is the **only** place any vendor SDK is imported. No `openai`/`anthropic`/`google` import appears in feature modules — enforced by lint/review.

## Model Router
Maps **task class → model tier → concrete model** using **DB-backed config** (a routing table, admin-editable — [37]) with env fallback. Task classes and default tiers:

| Tier | Task classes | Why |
|------|--------------|-----|
| **Cheap** | classification, query rewriting, tagging, recommendation scoring, embeddings, rerank, simple summary | high volume, low complexity → smallest/cheapest model |
| **Mid** | highlight synthesis, standard Ask-Q&A, learning paths | quality matters, bounded context |
| **High** | cross-book synthesis, contradiction analysis, long-form creation, complex presentations | reasoning-heavy, larger context |

The router chooses by task class, **not** by feature — so a feature can emit multiple task classes (e.g. Ask = cheap query-rewrite + mid answer). Routing is overridable per environment/user-tier/experiment.

## Provider default (recommended, not locked)
A sensible default mapping is a **single provider family with three capability tiers** (a small/fast model for Cheap, a mid model for Mid, a frontier model for High) — e.g. Anthropic's Claude family (Haiku/Sonnet/Opus-class) maps cleanly onto the three tiers and is a strong ES/EN performer. **This is a default, not a lock-in:** the Router+Gateway make the concrete provider/model a config value. Final provider selection is an **OPEN DECISION** ([20](20-open-product-decisions.md)) and an **ADR** ([45]); do not add any SDK in this mission.

## Embeddings provider
Embeddings go through the same Gateway (`embed`). Use **one multilingual model** for ES/EN ([04](04-rag-and-retrieval.md)). Embedding provider can differ from the chat provider (they're independent Gateway operations). Dimension + model version are stored per vector so provider/model changes become re-embed jobs.

## Configuration & safety
- **No secrets here.** Provider keys are env vars (names only), read by adapters at startup; absence disables that adapter (mirrors the existing Stripe/Sentry "disabled when unconfigured" pattern) → Noetia+ degrades gracefully rather than crashing ([35]/[14](14-security-and-copyright.md)).
- **Kill switch:** a master Noetia+ flag ([18](18-feature-flags-rollout.md)) and per-provider enablement let ops disable a misbehaving/expensive provider instantly.

## ADR candidates
- **AI provider abstraction shape** (Gateway contract + adapter boundary).
- **Model routing table** (task-class taxonomy, tier mapping, override precedence).
- **Default provider/model family** (Product + cost decision).
