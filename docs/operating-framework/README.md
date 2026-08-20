# Noetia Operating Framework

**Version 0.1** · established by NOF-001 · status: **ACCEPTED** — canonical Noetia Operating Framework v0.1

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

All 20 deliverables are at v0.1.

| # | Document |
|---|---|
| 00 | [Project Charter](00-project-charter.md) |
| 01 | [Strategic Direction](01-strategic-direction.md) |
| 02 | [Product Principles](02-product-principles.md) |
| 03 | [Product Framework](03-product-framework.md) |
| 04 | [Business Model Framework](04-business-model-framework.md) |
| 05 | [Economic Framework](05-economic-framework.md) |
| 06 | [User Rights & Ownership](06-user-rights-and-ownership.md) |
| 07 | [Creator & Rights Framework](07-creator-and-rights-framework.md) |
| 08 | [AI Governance Framework](08-ai-governance-framework.md) |
| 09 | [Architecture Framework](09-architecture-framework.md) |
| 10 | [Engineering Operating Model](10-engineering-operating-model.md) |
| 11 | [Operations Handbook](11-operations-handbook.md) |
| 12 | [Security & Privacy Framework](12-security-and-privacy-framework.md) |
| 13 | [Product Evolution Roadmap](13-product-evolution-roadmap.md) |
| 14 | [Shared Language](14-shared-language.md) |
| 15 | [Decision Registry](15-decision-registry.md) |

**Governance**

| Document | Purpose |
|---|---|
| [Documentation inventory](governance/documentation-inventory.md) | 96 documents classified, with canonical destinations |
| [Contradictions & gaps](governance/contradictions-and-gaps.md) | Conflicts and implementation gaps, tracked separately |
| [Product Owner questions](governance/product-owner-questions.md) | Open questions by priority; resolved ones kept as history |
| [Product Owner decisions](decisions/product-owner/) | PO-005 … PO-020 |
| [Resilience & disaster recovery](resilience/README.md) | NOF-003 — backup posture, failure model, RPO/RTO |

---

## Current status

**Open decisions**

| Item | Priority |
|---|---|
| Family plan: 5 or 6 seats (C-02) | P1 — deliberately **not** inferred from code |
| Promotional/courtesy token expiry (C-06) | P1 |
| Peer token gifting: committed or idea (C-07) | P1 |
| Free-library sunset trigger (C-10) | P1 |
| Anti-goals beyond "not a publisher" (Q-09) | P1 |
| Permanent ownership as a formal commitment | P1 — new |
| Noetia+ price · mode names · quotation thresholds · market boundary | P2 |

**Implementation gaps** — decided policy that no system yet enforces

| Gap | Severity |
|---|---|
| IG-02 — no creator settlement/payout engine | CRITICAL |
| IG-01 — Stripe pricing unverified against PO-006 | HIGH |
| IG-03 — staging cannot yet validate Escucha Activa | HIGH *(NEM-006C in progress)* |

**Review markers**

`ACCOUNTING REVIEW REQUIRED` — creator obligations, recognition, tax, refunds, breakage,
Causas treatment (PO-008 / IG-02)
`LEGAL REVIEW REQUIRED` — "ownership" terminology, licensing, quotation policy, publisher
AI permissions
`PRIVACY REVIEW REQUIRED` — before any regulatory-compliance claim; none is currently made

**Known absence:** no accessibility policy exists anywhere in the corpus.

**Superseded** — historical text preserved, never rewritten

| Source | Superseded by |
|---|---|
| `business/en\|es/01-business-plan.md` annual prices ($89.99 / $139.99 / $189.99) | PO-006 |
| Ambiguous "45%" usage | PO-007 |
| "Product Bible" terminology | Operating Framework (NOF-001 §2) |

---

## What this framework is not

- **Not legal, accounting, or tax advice.** Items needing professional review are marked.
- **Not a policy-invention instrument.** NOF-001 consolidated existing decisions. Where
  none existed, the gap is registered rather than filled.
- **Not finished.** v0.1 deliberately contains open questions. Prefer
  `OPEN — Product Owner decision required` over fabricated certainty.
