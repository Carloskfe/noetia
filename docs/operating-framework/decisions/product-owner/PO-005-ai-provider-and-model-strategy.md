# PO-005 — Initial AI Provider & Model Strategy

**Status:** `DECIDED — CURRENT CONFIGURATION DECISION`
**Domain:** AI · **Authority:** Product Owner · **Governs:** [ADR-001](../../../architecture/adr/ADR-001-ai-provider-abstraction-and-model-routing.md)
**Implementation:** NOT IMPLEMENTED — no AI feature is live; credentials are reserved but unpopulated

> This is a **configuration decision, not a product principle.** It records what Noetia
> intends to run first. It may change on evaluation, cost, latency, or quality **without
> amending ADR-001**, and none of it is a customer-facing promise.

---

## Initial configuration

| Role | Provider / model |
|---|---|
| Primary embedding | Google `gemini-embedding-001`, initially **768 dimensions** |
| Standard generation (Ask This Book) | Google `gemini-3.5-flash-lite` |
| First fallback | OpenAI **GPT-5.6 Luna** |
| Candidate advanced reasoning | OpenAI **GPT-5.6 Terra** |
| Approved future / challenger | Anthropic **Claude Sonnet 5** |

The 768-dimension choice is already reflected in staging's validated pgvector setup
(`vector(768)` exact search, NEM-006A) and in the reserved `.env.staging` slots.

## Architectural constraints

- Provider and model choices **remain configurable** — no hard-coding into product behavior.
- **No model name is part of the customer promise** (PO-001). Users buy Noetia
  capabilities, not a named external model.
- Production must use **paid/commercial API configurations** consistent with the approved
  AI data-handling policy.
- **No voluntary training or data-sharing opt-in** with any provider (ADR-002).
- Changing provider or model does **not** require a new ADR; it requires a configuration
  change and, where material, an updated record here.

## Relationships

- Implements the routing philosophy of **PO-001 / ADR-001** (workload classes, cost bands).
- Constrained by **PO-002 / ADR-002** — permission before retrieval; no training on
  licensed content.
- Embedding store and dimensionality governed by **PO-004 / ADR-004** (pgvector,
  re-embedding treated as a versioned migration).

## Open

- Final retail price for Noetia+ — deliberately unset (PO-001) → Q-11.
- Exact production provider selection may differ from the above once evaluation runs.
