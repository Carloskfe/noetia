# PO-030 — Three-Tier Architecture Governance

**Status:** `DECIDED` — approved by the Product Owner on 2026-11-08 as **TT-21** (*Product Architecture Decision Reconciliation — Three-Tier Architecture Governance and NEM-019 Preparation*). Replaces the T0 preliminary ruling of 2026-11-06, which left NEM-006 paused.
**Domain:** Governance, Architecture · **Authority:** Product Owner
**Date:** 2026-11-08 · **Source:** TT-21
**Implementation:** Documentation only

> Identifier: `PO-030` was verified unused on every remote branch on 2026-11-08 and continues the PO sequence (PO-025…029 are the T0 drafts).

---

## Decision (approved text, 2026-11-08)

1. Preserve **NEM-003** as historical architecture documentation.
2. **Formally supersede** the paused **NEM-006** implementation plan while preserving its historical record.
3. Prepare **ADR-005** covering tier entitlements, eligibility, and AI budgets.
4. Prepare **ADR-006** covering research sessions, book limits, and Research Brief architecture.
5. Record the approved Product Owner decisions in the authoritative Product Decision Register.
6. Reconcile **NEM-019** with these approved decisions.
7. Do **not** automatically approve or execute NEM-019.

## How each rule is carried out

| Rule | Record |
|---|---|
| 1 | NEM-003 (`docs/noetia-plus/`) is not edited. Its status is recorded in the [governance record](../../../architecture/three-tier-intelligence/08-architecture-governance-record.md) |
| 2 | [Governance record §2](../../../architecture/three-tier-intelligence/08-architecture-governance-record.md#2-nem-006-supersession). The NEM-006 mission file is not on `main` and is not edited |
| 3, 4 | [ADR-005](../../../architecture/adr/ADR-005-tier-entitlements-prerequisites-and-budget-boundaries.md), [ADR-006](../../../architecture/adr/ADR-006-research-sessions-book-limits-and-source-scope.md), both **Proposed** |
| 5 | [`docs/noetia-plus/PRODUCT-DECISIONS.md`](../../../noetia-plus/PRODUCT-DECISIONS.md), the decision register on `main` |
| 6, 7 | [NEM-019](../../../engineering-missions/DRAFT/NEM-019-tier-aware-intelligence-control-plane.md) revision 3; status remains **DRAFT** |

## Not decided by this record

Acceptance of ADR-005 and ADR-006 (Product Architecture, then PO) · approval of NEM-019 · merge order and timing · the eventual home of the PO records directory (`docs/operating-framework/`, not yet on `main`).

## Implementation boundary

Authorizes no implementation and no execution of NEM-019.
