# Decision Registry

**v0.1** · NOF-001 · The index that answers *why does Noetia work this way?* without
searching dozens of documents.

Authority: **PO** (Product Owner decision) · **ADR** (architecture decision) ·
**NEM** (engineering mission) · **NOF** (operating framework mission) ·
**DOC** (stated in documentation, no formal decision record) ·
**CODE** (established only by implementation).

`DOC` and `CODE` are not decisions — they are *positions Noetia currently holds without a
decision record*. Promoting them is a Product Owner act, not an editorial one.

---

## Formal decisions

| ID | Type | Title | Status | Domain | Source | Implementation |
|---|---|---|---|---|---|---|
| PO-001 | PO | AI economics & provider independence | DECIDED | AI, economics | [PRODUCT-DECISIONS](../noetia-plus/PRODUCT-DECISIONS.md) | Not implemented (PLANNED) |
| PO-002 | PO | Copyright intelligence & permission-aware retrieval | DECIDED | AI, rights | same | Not implemented (PLANNED) |
| PO-003 | PO | Source-aware hybrid intelligence | DECIDED | AI, UX | same | Not implemented (PLANNED) |
| PO-004 | PO | Semantic retrieval store (pgvector) | DECIDED | AI, architecture | same | Validated in staging only (NEM-006A) |
| PO-005 | PO | Initial AI provider & model strategy | DECIDED — *current configuration* | AI | [PO-005](decisions/product-owner/PO-005-ai-provider-and-model-strategy.md) | NOT IMPLEMENTED |
| PO-006 | PO | Canonical subscription pricing | DECIDED | Business | [PO-006](decisions/product-owner/PO-006-canonical-subscription-pricing.md) | **UNVERIFIED** in Stripe → IG-01 |
| PO-007 | PO | Canonical revenue allocation | DECIDED | Economics | [PO-007](decisions/product-owner/PO-007-canonical-revenue-allocation.md) | NOT IMPLEMENTED → IG-02 |
| PO-008 | PO | Creator obligation accrual | DECIDED | Economics, Creator | [PO-008](decisions/product-owner/PO-008-creator-obligation-accrual.md) | NOT IMPLEMENTED → IG-02 · `ACCOUNTING REVIEW REQUIRED` |
| PO-009 | PO | Engineering mission traceability | DECIDED | Governance | [PO-009](decisions/product-owner/PO-009-engineering-mission-traceability.md) | Backfill performed by NOF-001 |
| PO-010 | PO | Token gross value basis | DECIDED | Economics | [PO-010](decisions/product-owner/PO-010-token-gross-value-basis.md) | NOT IMPLEMENTED → IG-02 · `ACCOUNTING REVIEW REQUIRED` |
| ADR-001 | ADR | AI provider abstraction & model routing | ACCEPTED | Architecture | [ADR-001](../architecture/adr/ADR-001-ai-provider-abstraction-and-model-routing.md) | PLANNED |
| ADR-002 | ADR | Permission-aware content intelligence | ACCEPTED | Rights | [ADR-002](../architecture/adr/ADR-002-permission-aware-content-intelligence.md) | PLANNED |
| ADR-003 | ADR | Source-aware hybrid intelligence | ACCEPTED | AI | [ADR-003](../architecture/adr/ADR-003-source-aware-hybrid-intelligence.md) | PLANNED |
| ADR-004 | ADR | PostgreSQL + pgvector semantic retrieval | ACCEPTED | Architecture | [ADR-004](../architecture/adr/ADR-004-postgresql-pgvector-semantic-retrieval.md) | Staging-validated |

**Supersession:** PO-006 supersedes the annual prices in `business/en|es/01-business-plan.md`.
PO-007 supersedes ambiguous "45%" usage. PO-004 explicitly does not alter PO-001…003.
PO-005 refines PO-001 without amending ADR-001. PO-010 completes PO-007/PO-008 by
supplying the basis the percentages apply to; it supersedes nothing.

**Decision status is not implementation status.** PO-007 and PO-008 are `DECIDED` while the
settlement engine is `NOT IMPLEMENTED`; PO-006 is `DECIDED` while Stripe is `UNVERIFIED`.
The registry keeps these columns apart deliberately — collapsing them is how a policy
starts being mistaken for a running system.

---

## Engineering missions

**Backfilled by NOF-001 under [PO-009](decisions/product-owner/PO-009-engineering-mission-traceability.md)**
into [`docs/engineering-missions/`](../engineering-missions/). Records are reconstructions
from commits and produced documentation, marked `HISTORICAL / PRE-GOVERNANCE BACKFILL` and
`RECONSTRUCTED SUMMARY` where the original approved prompt is not repository-resident. No
wording was invented.

| ID | Title | Status | Source of reconstruction |
|---|---|---|---|
| NEM-001 | Technical baseline (repository archaeology) | COMPLETE | [record](../engineering-missions/COMPLETED/NEM-001-technical-baseline.md) · `7e78eac` |
| NEM-002 | Production safety & business-critical verification | COMPLETE | [record](../engineering-missions/COMPLETED/NEM-002-production-safety.md) · `bdc6843`, `1a6f695`, `a3b9b36` |
| NEM-002A | — | **Not separately identifiable**; folded into NEM-002 | — |
| NEM-004 | Engineering mission governance | COMPLETE | [record](../engineering-missions/COMPLETED/NEM-004-mission-governance.md) · `1b619bf` |
| NEM-003 | Noetia+ product & technical integration design | COMPLETE (design only) | [record](../engineering-missions/COMPLETED/NEM-003-noetia-plus-design.md) · `d4bef79` |
| NEM-005 | Record PO-001…003 + ADR-001…003 | COMPLETE | [record](../engineering-missions/COMPLETED/NEM-005-product-decisions-and-adrs.md) · `3b44b82` |
| NEM-005A | Accept ADR-004 (pgvector) | COMPLETE | [record](../engineering-missions/COMPLETED/NEM-005A-pgvector-decision.md) · `9e682fb` |
| NEM-006 | Noetia+ implementation | **PAUSED** | [record](../engineering-missions/COMPLETED/NEM-006-noetia-plus-implementation.md) — no commits |
| NEM-006A | Permanent staging environment foundation | COMPLETE (awaiting review) | [record](../engineering-missions/COMPLETED/NEM-006A-staging-foundation.md) · `0dcd139`, `3c71e5a`, `5aa9a7b`, `15e5762` |
| NEM-006B | Production PG16 restore-compatibility proof | NOT STARTED | Referenced in staging docs; no record created |
| NEM-006C | Full-catalog reader-validatable staging content | IN PROGRESS | [record](../engineering-missions/IN-PROGRESS/NEM-006C-staging-content.md) · `b16aec7`, `b39fd7f`, `ccccf25`, `4f8907c` |
| NOF-001 | Operating Framework foundation | IN PROGRESS | [record](../engineering-missions/IN-PROGRESS/NOF-001-operating-framework.md) · `64e6bf9` |

---

## Positions held without a decision record

The most consequential gap in the registry. Each is load-bearing for the business, and
none has a PO decision file.

| ID | Position | Authority today | Registered issue |
|---|---|---|---|
| DOC-01 | Monthly pricing $8.99 / $13.99 / $18.99 | Business plan + PRD (agree) | — |
| ~~DOC-02~~ | Annual pricing | **Promoted → PO-006** | C-01 RESOLVED; IG-01 open |
| ~~DOC-03~~ | Revenue split 45 / 36 / 9 / 2.22 / 7.78 | **Promoted → PO-007 / PO-008** | C-03 policy RESOLVED; IG-02 open |
| ~~DOC-04~~ | "45%" ambiguity | **Resolved → PO-007** | C-04 RESOLVED |
| DOC-05 | Family seat count | PRD says 6, business plan says 5 | C-02 · Q-05 |
| DOC-06 | Causas Noetia 2.22% of every payment | Business plan; `causes` table exists | Allocation not computed → C-03 |
| CODE-01 | Token expiry 90 days | `TOKEN_EXPIRY_DAYS` constant | Promotional window inferred → C-06 |
| CODE-02 | Shared Duo/Family token pool, separate libraries | `linkedUserIds` resolution in redemption | — |
| CODE-03 | Redeemed book access is permanent | `user_books` has no expiry | **Still not formally decided** → [06-user-rights](06-user-rights-and-ownership.md). Intent is documented; a decision record is not |
| CODE-04 | Catalog quality gate ≥90% sync coverage | `books.service.ts` | Product rule living only in code |
| DOC-07 | Free-library sunset after 6–12 months | `CLAUDE.md` | No start date → C-10 · Q-08 |
| DOC-08 | Reader-first product hierarchy | `CLAUDE.md` | Strong candidate for charter promotion |

---

## Analysis informing these decisions

| Analysis | Subject | Outcome |
|---|---|---|
| [NOF-002 creator economics stress test](analysis/creator-economics-stress-test.md) | Model A (actual consideration) under 11 scenarios | Allocation structurally sound (creator ≤45% of cash); GATE D = **NO** — NEM-007 blocked on IG-04, C-11, breakage residual, Q-14 |

## How to use this registry

**Answering "why does Noetia work this way?"** — find the behavior, read its authority
column. `PO`/`ADR` means it was decided. `DOC`/`CODE` means it is merely true.

**Before changing a behavior** — a `PO`/`ADR` row needs a superseding decision. A
`CODE` row may be a bug, an accident, or an unrecorded decision; establish which before
treating it as policy (NOF-001 §3).

**When adding a decision** — add the row here in the same change that creates the record.
The registry is only useful if it stays complete.
