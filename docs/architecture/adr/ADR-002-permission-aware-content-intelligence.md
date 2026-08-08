# ADR-002 — Permission-Aware Content Intelligence

- **Status:** Accepted
- **Date:** 2026-08 (NEM-005)
- **Decided by:** Product Owner (PO-002) + Product Architecture
- **Relates:** ratifies `docs/noetia-plus/05-content-permissions.md` and `14-security-and-copyright.md`; recorded as product policy in `docs/noetia-plus/PRODUCT-DECISIONS.md` (PO-002).

## Context
Noetia contains public-domain, licensed, owned, non-owned, and potentially restricted intellectual property. Noetia Brain exists to help users understand, analyze, connect, compare, remember, synthesize, and create from knowledge — **not** to reconstruct or substitute for copyrighted works.

> **Permanent principle:** Noetia Brain may help a user understand a copyrighted work but may not function as a mechanism for reconstructing or substituting for that work.

## Decision
AI retrieval and processing must be **permission-aware before protected content enters model context.** Authorization is enforced early, not by retrieving broadly and filtering afterward:
```
User request → requested source scope → entitlement check → content AI-rights check
            → authorized retrieval → reranking → context construction → model
```

**Content rights classes (minimum):**
- **PUBLIC DOMAIN** — full AI processing allowed **only when Noetia has verified the specific text/translation/edition is public domain or otherwise authorized.** A work's public-domain status does **not** automatically extend to a modern translation or edition.
- **OWNED / LICENSED BY USER** — the user has legitimately unlocked the book; Noetia Brain may perform authorized Q&A, explanation, summarization, comparison, analysis, synthesis, citation, short quotation, and knowledge connection — **subject to Noetia's rights agreement with the applicable rights holder.** User ownership does **not** by itself grant Noetia unrestricted AI rights over copyrighted content.
- **DISCOVERABLE / NON-OWNED LICENSED** — AI use restricted to contractually permitted material (metadata, descriptions, authorized previews/excerpts, publisher-approved semantic representations/embeddings). Possessing a catalog file does not imply unrestricted AI retrieval rights.
- **RESTRICTED** — no AI retrieval or model-context inclusion.

**Rights-holder AI controls:** the architecture must support **title-level AI permissions** (candidates: semantic indexing, AI Q&A, summarization, cross-book comparison, quotation, generated-content grounding, discoverability embeddings, recommendation participation, knowledge-map participation, model-improvement/training authorization). Exact field names/schema are a future implementation-mission decision.

**Training policy:** licensed content must **not** be intentionally used by Noetia to train or improve a general-purpose model without explicit authorization. Provider processing required to generate a requested response is conceptually separate from Noetia intentionally using content as training data; provider contracts/config are evaluated accordingly.

**Quotation & anti-reconstruction:** Noetia does **not** claim any universal word count or percentage is automatically lawful fair use. Quotation is governed by applicable rights, contractual permissions, product safety controls, context, and purpose. The architecture must support (thresholds are a future Product/Legal decision): output limits, source-specific quotation policies, sequential-extraction detection, request-history analysis where appropriate, refusal behavior, and abuse telemetry. It must detect/restrict reconstruction attempts (whole-chapter requests, continuation-to-reveal-next-passage, sequential extraction, cumulative reconstruction, bulk-quote requests, limit-bypass attempts).

## Consequences
**Positive:** stronger copyright controls; publisher flexibility; safer licensing negotiations; auditable content use.
**Negative:** additional metadata; authorization complexity; ingestion/indexing complexity; policy-management overhead.

## Guardrails
- Anti-reconstruction enforced; **no universal fair-use word-count assumption.**
- Specific **editions/translations** matter for public-domain determination.
- Rights-holder AI controls supported at title level.
- General-purpose model **training requires explicit authorization** (default off for licensed content).

## Legal note (PRODUCT POLICY vs LEGAL DETERMINATION)
This ADR records **product policy**, not a **legal determination**, and is **not legal advice.** Before commercial rollout of licensed-content AI features, Noetia should obtain legal review of licensing agreements, quotation policies, publisher AI permissions, content-processing terms, and provider data handling. Because the system is designed to remain **configurable**, technical architecture is not blocked on that review.

## Open (subordinate) decisions — remain unresolved
Exact fair-use/quotation technical thresholds; publisher-contract language; final publisher default-permission matrix — see `docs/noetia-plus/20-open-product-decisions.md`.
