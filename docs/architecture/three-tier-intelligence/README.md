# Three-Tier Product Architecture Reconciliation

**Noetia · Noetia+ · NoetiaX**

**Status:** PROPOSED: awaiting Product Architecture review. T0 preliminary rulings are reflected and drafted as PO-025…029 and ADR-005/006; [T0 report](../../reports/2026-11-06-SA-002-T0-decision-closure.md).
**Date:** 2026-11-06 · **Assignment ID:** `SA-002` (provisional) · **Authorization:** documentation and analysis only.

> Nothing here authorizes implementation. No application code, database, infrastructure, Stripe, or deployment was changed. NEM-003 and all ADRs and PO records are preserved as written. Facts were verified against `origin/main` at `6a5e5c0`. This is product and architecture analysis, not legal advice.

## Deliverables

| # | Deliverable | Document |
|---|---|---|
| 1 | Three-tier capability matrix | [01-capability-matrix.md](01-capability-matrix.md) |
| 2 | Reconciliation against NEM-003 and ADRs | [02-reconciliation-report.md](02-reconciliation-report.md) |
| 3 | Interactive research and Research Brief architecture | [03-research-architecture.md](03-research-architecture.md) |
| 4 | Entitlement and resource-budget design | [04-entitlements-and-budgets.md](04-entitlements-and-budgets.md) |
| 5 | Approved versus open decisions | [05-open-decisions.md](05-open-decisions.md) |
| 6 | Next Engineering Mission draft | [NEM-019 (DRAFT)](../../engineering-missions/DRAFT/NEM-019-tier-aware-intelligence-control-plane.md) |
| — | Roadmap | [06-implementation-roadmap.md](06-implementation-roadmap.md) |
| — | Rights verification requirements | [07-rights-verification-requirements.md](07-rights-verification-requirements.md) |
| — | Mission report | [2026-11-06 report](../../reports/2026-11-06-SA-002-three-tier-architecture-reconciliation.md) |

## The main conclusions

1. **The approved architecture holds.** No ADR needs replacing. Tiers fit as a resolver, a session book set, and per-tier budgets behind the existing Orchestrator.
2. **Eleven conflicts are raised for the PO, six of them High** ([02 §2](02-reconciliation-report.md#2-conflicts-raised-for-product-owner-review)). T0 ruled on four of them, including token expiry: PO-024 is preserved.
3. **Billing cannot safely carry a premium plan today.** One plan row would publicly list itself, mint book tokens, unlock all paid books, and overwrite the user's book plan ([02 §3](02-reconciliation-report.md#3-current-code-versus-the-design)).
4. **Depth must be testable.** Proposed gate: the same books and question on both tiers, measured against criteria the PO approves.
5. **Rights could leave nothing to analyse.** `books` has no rights or edition data, so default deny yields an empty corpus until the verified pilot set exists (PO-029, TT-26).
6. **The next step is low-risk.** NEM-019 builds limits, entitlement, and budgets with a fake provider: no AI spend, no billing, no deployment.

## How to review

Read the T0 report, this file, then [05](05-open-decisions.md), then [02 §2–§3](02-reconciliation-report.md). Everything else is depth for the decisions made there.

## Tags used

`PO`: Product Owner scope update · `ADR`: accepted decision · `PROPOSED`: this package's proposal · `OPEN → TT-nn`: needs a ruling. Code citations are `file:line` on `origin/main`.
