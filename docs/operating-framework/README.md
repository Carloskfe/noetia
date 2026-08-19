# Noetia Operating Framework

**Version 0.1** · established by NOF-001 · status: **DRAFT — not yet accepted by the Product Owner**

The Operating Framework is Noetia's institutional layer: the place that explains *why*
Noetia works the way it does, and which commitments should outlive any individual
feature, mission, or engineer.

It does not replace existing documentation. The technical baseline, ADRs, runbooks, and
business plan remain authoritative in their own domains. The framework connects them,
records where they disagree, and marks what has never been decided at all.

---

## How to read this framework

Every statement carries an epistemic status. This matters more than completeness — a
document that looks finished but silently invented an answer is worse than one with a
visible gap.

| Marker | Meaning |
|---|---|
| **DECIDED** | An explicit Product Owner decision or approved ADR exists |
| **IMPLEMENTED** | Verified in the repository as current behavior |
| **PROPOSED** | Written down somewhere but never approved |
| **PLANNED** | Approved in direction, not yet built |
| **INFERRED** | Reconstructed from evidence; no explicit decision found |
| **CONFLICTING** | Sources disagree — see the contradiction register |
| **OPEN** | No decision exists; Product Owner input required |

`INFERRED` is not a soft `DECIDED`. Where this framework infers, a future mission should
either confirm the inference as policy or correct it.

---

## Evidence hierarchy

When sources disagree, higher levels win — but disagreements are **recorded, never
silently resolved**.

1. Explicit Product Owner decisions (PO-001 …)
2. This framework, once accepted
3. Architecture Decision Records (ADR-001 …)
4. Approved Engineering Missions (NEM-…) and accepted completion reports
5. Current product and business documentation
6. Repository implementation — establishes what Noetia *does*, never what it *must always* do
7. Historical and proposal documents

---

## Contents

| # | Document | Status |
|---|---|---|
| — | [Documentation inventory](governance/documentation-inventory.md) | v0.1 |
| — | [Contradictions & gaps register](governance/contradictions-and-gaps.md) | v0.1 |
| — | [Product Owner question register](governance/product-owner-questions.md) | v0.1 |
| 00 | [Project Charter](00-project-charter.md) | v0.1 |
| 01 | [Strategic Direction](01-strategic-direction.md) | pending |
| 02 | [Product Principles](02-product-principles.md) | v0.1 |
| 03 | [Product Framework](03-product-framework.md) | pending |
| 04 | [Business Model Framework](04-business-model-framework.md) | pending |
| 05 | [Economic Framework](05-economic-framework.md) | pending |
| 06 | [User Rights & Ownership](06-user-rights-and-ownership.md) | pending |
| 07 | [Creator & Rights Framework](07-creator-and-rights-framework.md) | pending |
| 08 | [AI Governance Framework](08-ai-governance-framework.md) | pending |
| 09 | [Architecture Framework](09-architecture-framework.md) | pending |
| 10 | [Engineering Operating Model](10-engineering-operating-model.md) | pending |
| 11 | [Operations Handbook](11-operations-handbook.md) | pending |
| 12 | [Security & Privacy Framework](12-security-and-privacy-framework.md) | pending |
| 13 | [Product Evolution Roadmap](13-product-evolution-roadmap.md) | pending |
| 14 | [Shared Language](14-shared-language.md) | pending |
| 15 | [Decision Registry](15-decision-registry.md) | v0.1 |

---

## What this framework is not

- **Not legal, accounting, or tax advice.** Items needing professional review are marked.
- **Not a policy-invention instrument.** NOF-001 consolidated existing decisions. Where
  none existed, the gap is registered rather than filled.
- **Not finished.** v0.1 deliberately contains open questions. Prefer
  `OPEN — Product Owner decision required` over fabricated certainty.
