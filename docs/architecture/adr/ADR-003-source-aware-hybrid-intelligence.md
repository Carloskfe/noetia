# ADR-003 — Source-Aware Hybrid Intelligence

- **Status:** Accepted
- **Date:** 2026-08 (NEM-005)
- **Decided by:** Product Owner (PO-003) + Product Architecture
- **Relates:** updates `docs/noetia-plus/01-product-scope.md` and `10-api-design.md`; recorded as product policy in `docs/noetia-plus/PRODUCT-DECISIONS.md` (PO-003).

## Context
Strictly grounded AI (Noetia sources only) limits usefulness; invisible blending of general model knowledge with Noetia-derived knowledge undermines provenance and trust. Noetia Brain must be helpful **and** honest about where each idea comes from.

> **Core principle — Source-Aware Intelligence:** Noetia-derived knowledge and general model knowledge must not be invisibly blended. The user should be able to understand the provenance of important claims.

## Decision
Noetia Brain is **not** permanently restricted to Noetia sources. It may use broader model knowledge **when the selected experience permits it**, but provenance must remain distinguishable. Three conceptual modes are approved (customer-facing names are a future UX decision):

- **Mode 1 — This Book.** Source scope = the selected authorized book. Answers grounded in that book. General model knowledge may assist language/reasoning internally but must **not** silently introduce substantive external claims as if from the book. If the book cannot support the answer, Noetia communicates that limitation. **This Book remains tightly grounded.**
- **Mode 2 — My Knowledge.** Source scope = owned books + highlights + notes + authorized Noetia sources + public-domain Noetia sources where appropriate. Intended to be the **core Noetia Brain experience** — the user's accumulated Noetia knowledge environment.
- **Mode 3 — Expand.** Broader intelligence beyond the Noetia knowledge base (general model knowledge; future web/research; other explicitly authorized external knowledge). When substantive claims originate outside Noetia's grounded sources, **provenance must be distinguishable.**

**Provenance:** Noetia should answer *"where did this idea come from?"* For Noetia-grounded content, citations should identify Book → Author → Chapter/Section → semantic chunk → reader/sync location, and, where possible, a citation click should **deep-link into Escucha Activa** at the relevant location. Hybrid answers should be capable of distinguishing *FROM YOUR LIBRARY* vs *BROADER CONTEXT* (and, where useful, *CONNECTION / SYNTHESIS*) — exact labels/UX are future decisions.

**Intellectual provenance** (architectural direction, not a mandated schema): preserve the chain User → Book → Passage → Highlight → Note → AI Answer → Knowledge Asset → Generated Output. Not every relationship requires its own entity; future missions decide persistence.

## Consequences
**Positive:** stronger trust; product differentiation; flexible intelligence; better grounding; clearer citations.
**Negative:** additional UX complexity; context routing; provenance metadata; more complex answer generation.

## Guardrails
- **Never attribute external/general knowledge to a book.**
- Citations required where practical for Noetia-derived claims.
- Source scopes explicit per request/mode.
- **This Book remains tightly grounded.**

## Strategic differentiation
Noetia Brain is not "generic chatbot + books". Differentiation: permanent personal library, synchronized reading/listening, highlights/notes, knowledge accumulation, source-aware intelligence, provenance, intellectual memory, knowledge connections, and creation grounded in what the user has actually read. Product-direction language (not final marketing): *"Ask what you've read. Connect what you've learned. Know where every idea came from."*

## Open (subordinate) decisions — remain unresolved
Final customer-facing mode names; final hybrid-answer UX (labels/icons/layout); provenance persistence design — see `docs/noetia-plus/20-open-product-decisions.md`.
