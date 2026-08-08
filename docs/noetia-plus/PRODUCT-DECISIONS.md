# Noetia+ — Product Decisions (PO-001 / PO-002 / PO-003)

Durable record of the Product Owner decisions that resolve the three principal blockers from NEM-003. Recorded by **NEM-005**. These are **product/architecture policy** (not legal advice) and are authoritative for future implementation missions. Each is backed by an Architecture Decision Record.

> A future governance mission may migrate these into a formal Product Bible. Until then, this file is the canonical location.

---

## PO-001 — AI Economics & Provider Independence
→ **[ADR-001](../architecture/adr/ADR-001-ai-provider-abstraction-and-model-routing.md)**

- Noetia+ must **not** depend permanently on one AI provider or model. Use a **provider-agnostic AI Gateway** with **dynamic model routing**; workloads route by capability/quality/latency/language/context/availability/cost.
- **No model name is part of the customer promise** — users buy Noetia intelligence capabilities, not a particular external model.
- **Workload classes:** low-cost (classification, tagging, intent, query-rewrite, extraction, light summary, embedding, rec-augmentation → cheapest qualified); standard intelligence (Ask This Book / Ask My Highlights / grounded Q&A / synthesis / learning paths → efficient models meeting quality thresholds); advanced reasoning (cross-book synthesis, contradiction, complex comparison, sophisticated maps, high-value long-form/presentations → higher-cost selectively).
- **Pricing intent:** mainstream ~$5.99–$9.99/mo (interest ~$7.99–$8.99). **Final retail price NOT set here.**
- **Economic target (guardrail, not a billing rule):** normal-user average AI/infra COGS **≤ ~$1.50/mo.**
- **COGS bands** (`AI COGS / Noetia+ revenue`, configurable): **Excellent ≤15% · Healthy >15–25% · Caution >25–35% · Intervention Required >35%.** Not hard-coded into product behavior unless a future mission authorizes it.
- **Metering:** track provider/model/tokens/embeddings/retrieval/duration/est-cost/cache/failures. **Raw LLM tokens are not the customer-facing unit.** `BOOK TOKEN ≠ AI USAGE` — never merged.

## PO-002 — Copyright Intelligence & Permission-Aware Retrieval
→ **[ADR-002](../architecture/adr/ADR-002-permission-aware-content-intelligence.md)**

- **Permanent principle:** Noetia Brain may help a user *understand* a copyrighted work but must not function to *reconstruct or substitute for* it.
- **Content rights classes:** PUBLIC DOMAIN (only when the specific text/translation/edition is verified — a modern translation is not automatically PD); OWNED/LICENSED-BY-USER (authorized Q&A/explain/summarize/compare/analyze/synthesize/cite/short-quote/connect — **subject to Noetia's rights agreement**; ownership ≠ unrestricted AI rights); DISCOVERABLE/NON-OWNED LICENSED (only contractually permitted metadata/previews/excerpts/approved representations); RESTRICTED (no AI retrieval/context).
- **Permission before retrieval:** entitlement + content-AI-rights enforced **before** protected content enters model context.
- **Rights-holder AI controls** supported at title level (indexing, Q&A, summary, comparison, quotation, grounding, discoverability embeddings, recommendation/knowledge-map participation, training). Schema is a future implementation decision.
- **Training default:** licensed content must **not** be used to train/improve a general-purpose model without explicit authorization.
- **Quotation:** no universal word-count/percentage is claimed as automatic fair use; governed by rights/contract/safety/context/purpose; anti-reconstruction safeguards required. **Thresholds are a future Product/Legal decision.**

## PO-003 — Source-Aware Hybrid Intelligence
→ **[ADR-003](../architecture/adr/ADR-003-source-aware-hybrid-intelligence.md)**

- Noetia Brain is **not** permanently restricted to Noetia sources; it may use broader model knowledge where the selected mode permits — but **Noetia-derived and general knowledge must not be invisibly blended** (principle: **Source-Aware Intelligence**).
- **Three modes** (final names = future UX): **This Book** (tightly grounded in the selected book), **My Knowledge** (owned books + highlights + notes + authorized/public-domain Noetia sources — the core experience), **Expand** (broader/general/authorized-external knowledge with distinguishable provenance).
- **Provenance:** Noetia should answer "where did this idea come from?" — Noetia-grounded claims cite Book → Author → Chapter/Section → chunk → reader/sync location, ideally deep-linking into Escucha Activa. Hybrid answers can distinguish *FROM YOUR LIBRARY* vs *BROADER CONTEXT* (labels/UX = future).
- **Never attribute external knowledge to a book.**

---

## Blockers closed by these decisions
The three principal NEM-003 blockers are **resolved**:
1. Provider architecture / economic philosophy → **PO-001 / ADR-001.**
2. General copyright / quotation architecture → **PO-002 / ADR-002.**
3. Grounded-only vs broader model knowledge → **PO-003 / ADR-003.**

## Still open (subordinate) — not resolved here
Final retail price · exact fair-use/quotation technical thresholds · final AI fair-use limits · exact provider selection · exact model selection · publisher-contract language · final customer-facing intelligence-mode names · final UX presentation. See [`20-open-product-decisions.md`](20-open-product-decisions.md).

## Legal
This document is **product policy, not legal advice.** Before commercial rollout of licensed-content AI features, obtain legal review of licensing agreements, quotation policies, publisher AI permissions, content-processing terms, and provider data handling. The architecture is deliberately configurable so it is not blocked on that review.
