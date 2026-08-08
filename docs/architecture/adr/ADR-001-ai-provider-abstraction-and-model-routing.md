# ADR-001 — AI Provider Abstraction & Model Routing

- **Status:** Accepted
- **Date:** 2026-08 (NEM-005)
- **Decided by:** Product Owner (PO-001) + Product Architecture
- **Supersedes / relates:** ratifies the design in `docs/noetia-plus/06-ai-provider-architecture.md` and `07-cost-and-usage-model.md`; recorded as product policy in `docs/noetia-plus/PRODUCT-DECISIONS.md` (PO-001).

## Context
Noetia+ requires AI while targeting an affordable recurring subscription (mainstream interest ~$7.99–$8.99, band $5.99–$9.99 — final price NOT set here). Noetia cannot safely depend, economically or technically, on a single AI provider or model: prices change, quality/latency/language performance vary by task, and availability is not guaranteed. No individual external model is part of the Noetia+ customer promise — users purchase Noetia intelligence capabilities, not access to a particular external model.

## Decision
Noetia+ uses a **provider-agnostic AI Gateway** with **dynamic model routing**. Product logic depends only on a normalized internal contract (chat / embed / rerank); concrete providers/models are selected by a **Model Router** according to workload class, and are configuration, not code. Workloads route to the lowest-cost qualified option:

- **Low-cost workloads** (classification, tagging, intent detection, query rewriting, simple extraction, lightweight summarization, embedding, basic recommendation augmentation) → cheapest qualified model/service.
- **Standard intelligence workloads** (Ask This Book, Ask My Highlights, standard grounded Q&A, standard synthesis, learning-path assistance) → efficient models meeting Noetia quality thresholds.
- **Advanced reasoning workloads** (cross-book synthesis, contradiction analysis, complex comparison, sophisticated knowledge maps, high-value long-form creation, complex presentations) → higher-cost models, used selectively.

**Economic target (management guardrail, not a billing rule):** normal-user average AI/infrastructure COGS **≤ ~$1.50/month**. Operating bands for `AI COGS / Noetia+ revenue` (configurable): **Excellent ≤15% · Healthy >15–25% · Caution >25–35% · Intervention Required >35%**.

**Metering vs. currency:** internal metering tracks provider, model, input/output tokens, embeddings, retrieval ops, duration, estimated cost, cache usage, and failures. **Raw LLM tokens must not become the primary customer-facing unit.** Book acquisition tokens and AI usage are separate economic concepts and must not be merged (`BOOK TOKEN ≠ AI USAGE`).

## Consequences
**Positive:** provider competition and cost optimization; task-specific routing; resilience to outages; fast adoption of new models; reduced vendor lock-in.
**Negative:** abstraction complexity; ongoing evaluation burden; provider-response normalization; more complex observability.

## Guardrails
- Provider/model **configurable**; no model name promised to customers.
- Usage **metered**; **estimated cost captured** per call; live COGS/revenue telemetry.
- **Quality evaluation required before routing changes** (offline eval sets, incl. ES/EN + cross-language).
- Provider pricing is **stored/configured**, never hard-coded into architecture (prices are time-sensitive).

## Open (subordinate) decisions — remain unresolved
Exact provider selection; exact model selection; verified provider prices; final retail price; final AI fair-use limits. These are selection/configuration decisions the abstraction is designed to absorb — see `docs/noetia-plus/20-open-product-decisions.md`.

## Legal note
This ADR is **product/architecture policy, not legal advice**. Provider data-handling and contract terms require appropriate review before commercial rollout (see ADR-002 §Legal note).
