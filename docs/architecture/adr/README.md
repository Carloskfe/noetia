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

## Provenance
ADR-001/002/003 were accepted via **NEM-005**, and **ADR-004 via NEM-005A**, recording Product Owner decisions PO-001/PO-002/PO-003/PO-004 (see [`docs/noetia-plus/PRODUCT-DECISIONS.md`](../../noetia-plus/PRODUCT-DECISIONS.md)). They are authoritative architecture that future implementation missions cite; they do **not** authorize implementation.

## Candidate future ADRs (not yet decided)
Raised by NEM-003, still open: KnowledgeAsset model; feature-entitlement architecture; usage-metering design; conversation retention; chunking strategy; hybrid-fusion/rerank. These become ADRs when decided by future missions. *(Semantic-index technology is now decided — [ADR-004](ADR-004-postgresql-pgvector-semantic-retrieval.md).)*
