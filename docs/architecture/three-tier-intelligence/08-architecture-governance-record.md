# 08 — Architecture Governance Record: NEM-003 and NEM-006

**Status:** Governance record under [PO-030](../../operating-framework/decisions/product-owner/PO-030-three-tier-architecture-governance.md) (TT-21, decided 2026-11-08). Documentation only.

This record states the standing of the two earlier Noetia+ missions relative to the three-tier architecture. It changes neither mission's original text.

## 1. NEM-003 — historical architecture

| | |
|---|---|
| Mission | NEM-003 — Noetia+ Product & Technical Integration Design |
| Location | `docs/noetia-plus/` on `main` (22 documents plus `EXECUTIVE_SUMMARY.md`, `README.md`, `PRODUCT-DECISIONS.md`) |
| Status | **Historical architecture documentation** (PO-030 rule 1). Listed in `docs/engineering-missions/README.md` as "Completed (legacy)" |
| What remains authoritative | PO-001…004 and ADR-001…004, recorded in `PRODUCT-DECISIONS.md` and `docs/architecture/adr/` |
| What is historical | NEM-003's design documents (`01`–`22`). Where they differ from the three-tier package, the three-tier package and its PO records and ADRs govern; the differences are listed in [02](02-reconciliation-report.md) |
| Edited by this record | **No** |

## 2. NEM-006 supersession

| | |
|---|---|
| Mission | NEM-006 — Noetia+ Implementation |
| Location | `docs/engineering-missions/COMPLETED/NEM-006-noetia-plus-implementation.md`, present **only** on branches without a PR (`nem-007-creator-rights`, `nem-009-resilience-impl`, `nof-001-operating-framework`, `nof-003-resilience`; identical on all four). **Not on `main`** |
| Prior status | **PAUSED**, no implementation commits; original approved prompt not repository-resident ("reconstructed summary"); prerequisites NEM-006B, NEM-006C, AI provider credentials (PO-005), evaluation methodology |
| Decision | **Formally superseded** by the three-tier architecture (PO-030 rule 2), effective 2026-11-08 |
| Successor | The three-tier roadmap ([06](06-implementation-roadmap.md)), beginning with the NEM-019 draft. NEM-019 does **not** resume NEM-006 and inherits no authorization from it |
| What is preserved | The NEM-006 record as written, including its prerequisites list. **NEM-006A, NEM-006B, NEM-006C are separate missions and are not superseded** by this record; where the roadmap needs them (for example NEM-006B before a production pgvector step), they remain prerequisites in their own right |
| Edited by this record | **No.** The mission file is on unmerged branches |

**Follow-up when the NEM-006 file reaches `main`** (separate authorization): add a status banner *"SUPERSEDED 2026-11-08 by PO-030; see `docs/architecture/three-tier-intelligence/08-architecture-governance-record.md`"* without changing its body. Its directory (`COMPLETED/`) does not match its paused status; moving it is a governance decision, not made here.

## 3. Effect on authority

Source-of-truth hierarchy (`docs/engineering-missions/README.md`): Product Owner decisions → approved ADRs → approved missions → code → baseline docs → historical documents. After PO-030:

- PO-026, PO-027, PO-028, PO-030 are decided Product Owner records.
- ADR-005 and ADR-006 were **accepted** on 2026-11-08 (revision 3) and carry ADR authority. *(Previously Proposed.)*
- NEM-019 is a **DRAFT**; it authorizes nothing until approved, and executes only on an explicit PO instruction.
- NEM-003 documents and the NEM-006 record are historical context where superseded.
