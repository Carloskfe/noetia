# 20 — Open Product Decisions

Per mission §44: where the product spec is incomplete, **engineering does not invent policy.** Each item: **Question · Why it matters · Options · Technical consequence · Recommended default (if any)**. Product Architecture decides.

> **UPDATE — NEM-005 resolved the three principal blockers.** Product Owner decisions **PO-001/002/003** ([PRODUCT-DECISIONS.md](PRODUCT-DECISIONS.md); ADR-[001](../architecture/adr/ADR-001-ai-provider-abstraction-and-model-routing.md)/[002](../architecture/adr/ADR-002-permission-aware-content-intelligence.md)/[003](../architecture/adr/ADR-003-source-aware-hybrid-intelligence.md)) resolve the **provider architecture & AI economics**, the **copyright/quotation & permission architecture**, and the **grounded-vs-general knowledge** question (now the three-mode Source-Aware model). Items below are annotated **RESOLVED** or **PARTIALLY RESOLVED**; the remaining subordinate decisions (final price, exact usage/quotation thresholds, exact provider/model selection, verified prices, publisher matrix, mode names/UX) stay open.

---

### D1 — Exact Noetia+ monthly price
- **Why:** sets the revenue side of the COGS ratio; the whole cost model targets < ~$10.
- **Options:** $5.99 / $6.99 / $7.99 / $8.99 / $9.99 (mission band).
- **Consequence:** each price changes the "max acceptable avg AI COGS/subscriber" (Healthy ≤30% ⇒ ~$1.80–$3.00 depending on price) and thus how aggressive routing/limits must be. Higher price → more model-tier headroom.
- **Recommended default:** engineering has no pricing authority; **needs verified provider prices ([D9]) first** to confirm any price yields a Healthy ratio.

### D2 — AI usage limits (fair-use thresholds)
- **Why:** bounds the heavy/extreme tail that can break the COGS ratio.
- **Options:** soft-only (warn) / soft+hard caps / model-specific caps / per-feature caps; expressed as hidden thresholds or visible allowances.
- **Consequence:** hard caps protect margin but can frustrate power users; soft-only risks cost blowout on the tail. Architecture supports all ([07](07-cost-and-usage-model.md)).
- **Recommended default:** **soft + hard caps, model-specific** (High-tier scarcer), surfaced as user-friendly units ([D10]); exact numbers set after real-cost modeling.

### D3 — May AI use general model knowledge? (grounding-only vs augmented)
> **RESOLVED (PO-003 / ADR-003):** Source-Aware Hybrid Intelligence — three modes (**This Book** tightly grounded / **My Knowledge** / **Expand**). General knowledge is allowed where the mode permits, **never invisibly blended and never attributed to a book**. This supersedes the "strictly grounded" recommended default below (kept for history).
- **Why:** core product identity ("not a generic chatbot") and copyright posture.
- **Options:** (a) **strictly grounded** — answer only from retrieved entitled content, refuse otherwise; (b) **grounded + general knowledge**, clearly separated ("from your books" vs "general context"); (c) hybrid per feature.
- **Consequence:** (a) safest for rights + brand, may feel limited; (b) more helpful, risks unattributed/copyright confusion and higher hallucination; needs UI separation + eval.
- **Recommended default:** **(a) strictly grounded for book Q&A**; allow general knowledge only in clearly-labeled, non-book features (e.g. learning-path rationale) — revisit with eval data.

### D4 — Quotation limits (verbatim length/proportion)
> **PARTIALLY RESOLVED (PO-002 / ADR-002):** *architecture* decided — **no universal fair-use word count is claimed**; quotation is governed by rights/contract/safety/context/purpose with anti-reconstruction safeguards and per-book quotation policy. **Exact technical thresholds remain OPEN (Product/Legal).**
- **Why:** copyright/legal exposure on licensed content.
- **Options:** a fixed max words/percentage per answer and per-book; publisher-configurable; stricter for licensed vs public-domain.
- **Consequence:** thresholds are **legal decisions**, not engineering ones ([14](14-security-and-copyright.md)) — engineering enforces whatever is set.
- **Recommended default:** **none hardcoded** — Product/Legal must specify; engineering ships a configurable policy with a conservative placeholder pending that ruling.

### D5 — AI conversations & knowledge assets after cancellation
- **Why:** ownership philosophy ("your intellectual work") vs storage cost + provider retention.
- **Options:** delete at period end / retain read-only + export / retain fully and re-enable on resub.
- **Consequence:** retain = ongoing storage + privacy obligations; delete = data loss for the user. Architecture supports soft-delete + export.
- **Recommended default:** **retain read-only + export; re-enable on resubscribe; hard-delete on account deletion.**

### D6 — Publisher default AI permissions for licensed content
> **PARTIALLY RESOLVED (PO-002 / ADR-002):** *architecture* decided — title-level rights-holder AI controls, **training-off default** for licensed content, permission-before-retrieval, and editions/translations matter for public-domain status. **Exact default-permission matrix + publisher-contract language remain OPEN.**
- **Why:** governs what non-public-domain content AI may touch; rights + publisher trust.
- **Options:** permissive-by-default (opt-out) / conservative-by-default (opt-in) per operation; training always off.
- **Consequence:** permissive risks publisher pushback/rights issues; conservative limits early coverage but is safer. Per-book flags support either ([05](05-content-permissions.md)).
- **Recommended default:** **conservative opt-in for licensed content** (owner-only Q&A/summary by default; comparison/quote/discoverability opt-in); **public-domain & Noetia-owned: permissive**; **training OFF for all licensed content** (hard).

### D7 — Public intellectual profile / timeline (future)
- **Why:** privacy-sensitive social feature.
- **Options:** never / opt-in only / opt-in with granular controls.
- **Consequence:** any public exposure of reading/knowledge data is high privacy risk; must be opt-in + granular.
- **Recommended default:** **future-only, opt-in, off by default**; not built now, but data model avoids blocking it ([15](15-privacy.md)).

### D8 — Duo/Family Noetia+ model
- **Why:** entitlement + privacy interaction.
- **Options:** per-member subscription / shared Noetia+ across the pool.
- **Consequence:** shared Noetia+ must still keep **knowledge data per-member isolated** ([15](15-privacy.md)) — sharing entitlement never shares data.
- **Recommended default:** **per-member Noetia+** (intelligence is personal); shared book-token pools do not grant shared Noetia+.

### D9 — AI provider/model selection + provider training on data
> **PARTIALLY RESOLVED (PO-001 / ADR-001):** *economics & abstraction* decided — provider-agnostic AI Gateway + dynamic model routing, COGS target (~$1.50/mo normal-user) + bands, metering with **book token ≠ AI usage**, no model name promised to customers, no-training default. **Exact provider/model selection + verified prices remain OPEN** (and are configuration, not architecture).
- **Why:** cost, quality (ES/EN), and data-privacy posture; **prices are currently UNKNOWN** and must not be fabricated.
- **Options:** provider family + tier mapping ([06](06-ai-provider-architecture.md)); provider data-retention/no-training settings.
- **Consequence:** picks the real numbers in the cost model; determines privacy guarantees. Gateway makes the choice swappable.
- **Recommended default:** engineering recommends a **single-family, three-tier** default for simplicity ([06](06-ai-provider-architecture.md)) and **no-training / no-retention provider settings**; final selection is Product + verified-cost decision.

### D10 — User-facing usage units
- **Why:** UX + avoids exposing raw LLM tokens (mission §20).
- **Options:** "standard requests / deep analyses / creation jobs" / a single "credits" abstraction / hidden thresholds only.
- **Consequence:** affects UI, upsell, and how limits are communicated.
- **Recommended default:** **named units (standard requests / deep analyses / creation jobs)** mapped internally to task classes; never show tokens.

### D11 — AI usage raw-event retention
- **Why:** storage/privacy vs. analytics/audit needs.
- **Options:** keep raw `ai_usage_events` 30/90/365 days then aggregate / keep forever.
- **Consequence:** high row volume; longer retention = more storage + privacy scope.
- **Recommended default:** **raw ~90 days → monthly aggregates**; content never stored, only counts.

### D12 — AI-credit add-ons (separate from book tokens)
- **Why:** monetize heavy usage without endangering margin; must stay separate from `token_ledger`.
- **Options:** none / paid AI-credit packs (separate ledger) / higher tier plan.
- **Consequence:** if offered, needs a **separate** `ai_credit_ledger` ([09](09-data-model.md)) — do not reuse book tokens.
- **Recommended default:** **not at launch**; design keeps it possible.

---
**ADR-worthy among these:** D3, D6, D9. Semantic-index technology is now **decided** — PostgreSQL + pgvector ([ADR-004](../architecture/adr/ADR-004-postgresql-pgvector-semantic-retrieval.md) / PO-004). See [PRODUCT-DECISIONS.md](PRODUCT-DECISIONS.md) and the ADR index for the full decided/candidate list.
