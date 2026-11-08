# Architecture Decision Records (ADRs)

Durable, numbered records of significant Noetia architecture decisions. Markdown only — no ADR tooling. New ADRs continue the numeric sequence and are never renumbered or overwritten; a superseded ADR is marked `Superseded by ADR-NNN` rather than deleted.

Format per ADR: **Status · Date · Decided by · Context · Decision · Consequences · Guardrails**, plus open/subordinate decisions and (where relevant) a product-policy-vs-legal note.

## Index

| ADR | Decision | Status |
|-----|----------|--------|
| [ADR-001](ADR-001-ai-provider-abstraction-and-model-routing.md) | AI Provider Abstraction & Model Routing | Accepted |
| [ADR-002](ADR-002-permission-aware-content-intelligence.md) | Permission-Aware Content Intelligence | Accepted |
| [ADR-003](ADR-003-source-aware-hybrid-intelligence.md) | Source-Aware Hybrid Intelligence | Accepted |
| [ADR-004](ADR-004-postgresql-pgvector-semantic-retrieval.md) | PostgreSQL + pgvector Semantic Retrieval | Accepted |
| [ADR-005](ADR-005-tier-entitlements-prerequisites-and-budget-boundaries.md) | Tier Entitlements, Subscription Prerequisites, and AI Resource-Budget Boundaries | **Accepted** (rev 3, 2026-11-08) |
| [ADR-006](ADR-006-research-sessions-book-limits-and-source-scope.md) | Research Sessions, Selected-Book Limits, Forking, Source-Scope Isolation, and Research Briefs | **Accepted** (rev 3, 2026-11-08) |

## Provenance
ADR-001/002/003 were accepted via **NEM-005**, and **ADR-004 via NEM-005A**, recording Product Owner decisions PO-001/PO-002/PO-003/PO-004 (see [`docs/noetia-plus/PRODUCT-DECISIONS.md`](../../noetia-plus/PRODUCT-DECISIONS.md)). They are authoritative architecture that future implementation missions cite; they do **not** authorize implementation.

**ADR-005 and ADR-006** (revision 3) were accepted on 2026-11-08 by Product Owner authorization under SA-002-T0, after an independent Product Architecture review (PR #41) and incorporation of its corrections (PR #42). They record PO-026, PO-027, PO-028, and are required by PO-030. Acceptance does not approve NEM-019 or authorize implementation.

## Candidate future ADRs (not yet decided)
Raised by NEM-003, still open: KnowledgeAsset model; ~~feature-entitlement architecture; usage-metering design~~ (now decided at architecture level by [ADR-005](ADR-005-tier-entitlements-prerequisites-and-budget-boundaries.md); values remain open); conversation retention; chunking strategy; hybrid-fusion/rerank. These become ADRs when decided by future missions. *(Semantic-index technology is now decided — [ADR-004](ADR-004-postgresql-pgvector-semantic-retrieval.md).)*
