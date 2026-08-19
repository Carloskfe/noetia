# AI Governance Framework

**v0.1** · NOF-001 · Consolidates PO-001…PO-005 and ADR-001…ADR-004 at the principle
level. **No AI capability is implemented** — every principle below governs work not yet
built.

---

## The four permanent principles

These are framed to outlive any provider, model, or feature.

### 1. Augmentation, never substitution
> Noetia Brain may help a user **understand** a copyrighted work but must not function to
> **reconstruct or substitute for** it. — PO-002 / ADR-002

The strongest language in the corpus, and explicitly permanent.

### 2. Permission before retrieval
Entitlement **and** content-AI rights are enforced **before** protected content enters
model context — not filtered afterwards. This is why PostgreSQL is the semantic store:
permission data and vectors live in one authoritative system (ADR-004).

### 3. Source-aware intelligence
Noetia-derived knowledge and general model knowledge must **never be invisibly blended**
(PO-003). Grounded claims cite Book → Author → Chapter → chunk → reader location, ideally
deep-linking into Escucha Activa. **External knowledge is never attributed to a book.**

### 4. No model name is a customer promise
Users buy Noetia capabilities, not a named external model (PO-001). Provider and model are
**configuration decisions**, revisable without touching product policy.

## Intelligence modes

| Mode | Scope |
|---|---|
| **This Book** | Tightly grounded in the selected book |
| **My Knowledge** | Owned books + highlights + notes + authorized/public-domain sources — the core experience |
| **Expand** | Broader knowledge, with provenance kept distinguishable |

Names are provisional → Q-10.

## Provider and model configuration

**DECIDED — [PO-005](decisions/product-owner/PO-005-ai-provider-and-model-strategy.md)**,
marked `CURRENT CONFIGURATION DECISION` and revisable without amending ADR-001.

| Role | Initial choice |
|---|---|
| Embedding | Google `gemini-embedding-001`, 768d |
| Standard generation | Google `gemini-3.5-flash-lite` |
| First fallback | OpenAI GPT-5.6 Luna |
| Advanced reasoning candidate | OpenAI GPT-5.6 Terra |
| Approved challenger | Anthropic Claude Sonnet 5 |

Constraints: paid/commercial API tiers · **no voluntary training or data-sharing opt-in** ·
configurable, never hard-coded.

## Workload routing

**DECIDED (PO-001 / ADR-001)** — route by capability, quality, latency, language, context,
availability, and cost:

| Class | Examples | Routing |
|---|---|---|
| Low-cost | classification, tagging, intent, query-rewrite, extraction, embedding | cheapest qualified |
| Standard | Ask This Book, grounded Q&A, synthesis, learning paths | efficient models meeting quality thresholds |
| Advanced | cross-book synthesis, contradiction detection, complex comparison, long-form | higher-cost, selectively |

## Cost governance

- Target: normal-user AI/infra COGS **≤ ~$1.50/month** (guardrail, not a billing rule).
- COGS bands: Excellent ≤15% · Healthy 15–25% · Caution 25–35% · Intervention >35%.
- Metering: provider, model, tokens, embeddings, retrieval, duration, estimated cost,
  cache, failures.
- **`BOOK TOKEN ≠ AI USAGE`** — never merged. Raw LLM tokens are not a customer-facing unit.

## Retrieval architecture

**DECIDED (PO-004 / ADR-004)**

- PostgreSQL + pgvector is the **authoritative** semantic store; Meilisearch stays lexical.
- **Semantic chunks stay separate from Escucha Activa sync phrases**, referencing a phrase
  range for provenance — AI chunking is never coupled to reader sync.
- **Exact vector search first**; approximate indexing (HNSW/IVFFlat) only on measured
  evidence.
- A mandatory **Semantic Retrieval Interface** keeps pgvector an implementation, not an
  irreversible dependency.
- Multilingual ES/EN including cross-language; re-embedding is treated as a migration.

Validated in staging only (PG 16.14, vector 0.8.6, `vector(768)`). **Production PostgreSQL
is unchanged** — that proof is NEM-006B.

## Data handling and privacy

- No training on licensed content without explicit authorization.
- No voluntary provider training/data-sharing opt-in.
- Rights-holder AI controls at title level.
- User privacy toggles and persona opt-out already exist for non-AI analytics
  ([`persona-pipeline.md`](../persona-pipeline.md)) and are the natural precedent.

## Evaluation and grounding

`OPEN` — PO-001 anticipates routing on quality thresholds, and PO-003 requires answerable
provenance, but **no evaluation methodology, hallucination benchmark, or grounding
acceptance criteria exists**. Building intelligence features without one would make
"quality threshold" unfalsifiable.

Recommended for the mission that first implements retrieval.

## Open

| Item | Priority |
|---|---|
| Final Noetia+ retail price | P2 (Q-11) |
| Quotation thresholds — `LEGAL REVIEW REQUIRED` | P2 (Q-12) |
| Customer-facing mode names | P2 (Q-10) |
| Evaluation and grounding methodology | `OPEN` — new |
