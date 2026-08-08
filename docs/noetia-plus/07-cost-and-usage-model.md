# 07 — Cost & Usage Model

**Provider prices are UNKNOWN / not verified in this mission and MUST NOT be fabricated.** This is a *configurable framework*: every price is a variable. The illustrative numbers below are clearly marked **[PLACEHOLDER]** and exist only to show the math shape; Product must supply real, verified prices before any pricing commitment.

## Business target
Noetia+ retail target: **below ~$10/mo** (exploration band $5.99–$9.99; mainstream interest ~$7.99–$8.99). The architecture must keep **average AI COGS per subscriber** within a configurable fraction of revenue.

**Metering principle (PO-001 / [ADR-001](../architecture/adr/ADR-001-ai-provider-abstraction-and-model-routing.md)):** internal metering tracks provider, model, input/output tokens, embeddings, retrieval ops, duration, estimated cost, cache usage, and failures — but **raw LLM tokens must not become the primary customer-facing unit**, and **book acquisition tokens and AI usage are separate economic concepts that must never be merged** (`BOOK TOKEN ≠ AI USAGE`). Customer-facing units stay user-friendly ("standard requests / deep analyses / creation jobs").

## Cost model (formula)
Per-subscriber monthly AI COGS =
```
Σ over features f of:
   interactions[f]          (avg per user/month)
 × ( inputTokens[f]  × price_in[model(f)]
   + outputTokens[f] × price_out[model(f)]
   + embeddings[f]   × price_embed )
 × (1 − cacheHitRate[f])
 + fixed infra share (pgvector storage, worker CPU) / subscribers
```
All bracketed terms are **config variables** (per env), stored so production can recompute the real ratio from telemetry ([16](16-observability.md), [46]).

Config variables (placeholders to be replaced with verified values):
`price_in[tier]`, `price_out[tier]`, `price_embed`, `interactions_per_user[feature]`, `avg_input_tokens[feature]`, `avg_output_tokens[feature]`, `cache_hit_rate[feature]`, `infra_fixed_monthly`, `subscribers`.

## User personas (usage, not identity)
| Persona | Ask Q&A / mo | Deep analyses / mo | Creation jobs / mo | Notes |
|---------|-------------|--------------------|--------------------|-------|
| Light | ~10 | 0–1 | 0 | mostly recommendations (deterministic, ~free) |
| Normal | ~40 | ~3 | ~1 | typical engaged reader |
| Heavy | ~150 | ~15 | ~5 | power user |
| Extreme | ~500+ | ~50+ | ~20+ | must be bounded by fair-use ([20-fair-use](20-fair-use.md)/[fair use in 07]) |

## Illustrative scenario math — [PLACEHOLDER PRICES]
> Numbers below use **invented** per-1M-token prices purely to demonstrate the model. **Do not treat as real.** Replace with verified provider pricing.

Assume [PLACEHOLDER]: Cheap $0.30/$1.50 in/out per 1M tok; Mid $3/$15; High $15/$75; embed $0.10/1M. Assume an Ask = ~4k input (retrieved context) + ~0.6k output on the **Mid** tier, embeddings amortized (once per book/version), cache hit ~20% on public-domain/common queries.

- **Normal user** ≈ 40 Ask × (4000×$3 + 600×$15)/1e6 × 0.8 + 3 deep (High) + 1 creation ≈ **~$0.6–1.2 [PLACEHOLDER]** / mo.
- **Light user** ≈ **~$0.15–0.4 [PLACEHOLDER]** / mo.
- **Heavy user** ≈ **~$3–6 [PLACEHOLDER]** / mo.
- **Extreme user** (unbounded) could exceed retail — **hence fair-use is mandatory** (below).

The point is **not** these numbers; it's that the model shows the dominant levers are: **tier routing** (keep most traffic Cheap/Mid), **context size** (retrieval discipline), **cache hit rate**, and **bounding the extreme tail**.

## Maximum acceptable average AI COGS per subscriber (target)
Define a configurable target as a fraction of net revenue:
```
target_max_avg_COGS = target_ratio × (retail_price − payment_fees − other_COGS_share)
```
**Operating bands** for `AI COGS / Noetia+ revenue` — **ratified by PO-001 / [ADR-001](../architecture/adr/ADR-001-ai-provider-abstraction-and-model-routing.md)** (configurable management guardrails; not hard-coded into product behavior unless a future mission authorizes it):

| Band | Ratio | Meaning |
|------|-------|---------|
| **Excellent** | ≤ 15% | strong margin; room to invest in quality |
| **Healthy** | > 15–25% | sustainable target zone |
| **Caution** | > 25–35% | tighten routing/limits; investigate heavy tail |
| **Intervention Required** | > 35% | throttle / raise limits / reprice — alert |

**Approved architectural target (PO-001):** **normal-user average AI/infrastructure COGS ≤ ~$1.50/month** — a target, not a hard-coded billing rule. At a [PLACEHOLDER] $7.99 retail, "Healthy" (≤25%) ⇒ average AI COGS ≲ ~$2.00/subscriber — headroom above the ~$1.50 target, with Heavy/Extreme users controlled by fair-use. **Re-derive with verified provider prices before launch** (prices are time-sensitive examples, stored/configured — never hard-coded into architecture; PO-001).

## Fair-use levers (design, not final — see [20](20-open-product-decisions.md))
- **User-facing units, not tokens:** "standard requests", "deep analyses", "creation jobs" (hide raw LLM tokens — mission §20).
- **Soft monthly limits** (upgrade prompt), **hard limits** (block with graceful message), **model-specific limits** (High tier scarcer than Cheap), **throttling** (rate + burst), optional **future AI-credit add-ons** (separate from book tokens — [19-usage]).
- Enforced by the metering module against per-user counters in Redis + `ai_usage_events` ([09](09-data-model.md)).

## Cost-control invariants (architecture guarantees)
1. Most traffic routes to Cheap/Mid (router default).
2. Context size is bounded by the Context Builder (hard cap).
3. Reusable book-level computation is cached/persisted once per version ([22](22-implementation-epics.md)/[caching in 22]); user-private computation is cached per-user only ([15](15-privacy.md)).
4. The extreme tail is bounded by fair-use before it can blow the ratio.
5. Telemetry exposes the live `COGS/revenue` ratio ([16](16-observability.md)).

## ADR candidates
- **Usage-unit abstraction** (requests/analyses/jobs vs tokens).
- **Fair-use policy shape** (soft/hard/model-specific).
