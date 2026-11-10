# PO-033 — E5 Knowledge Retrieval Decisions and NEM-023 Reservation

**Status:** `DECIDED` — approved by the Product Owner on 2026-11-10 (*NEM-023 Product Owner Approval and Mission Finalization*).
**Domain:** Retrieval, Rights, Governance · **Authority:** Product Owner
**Date:** 2026-11-10 · **Source:** Draft PR #52 (E5 discovery, decision packet `b045dff`)
**Implementation:** Documentation only

> Identifier: `PO-033` was verified unused on all 55 remote branches on 2026-11-10 and continues the PO sequence after PO-032.

---

## Decisions (approved text, 2026-11-10)

| ID | Decision |
|---|---|
| **D-1** | "PostgreSQL lexical retrieval at launch, behind a technology-neutral interface. Semantic retrieval remains a future stage." (Closes TT-25 with option (a).) |
| **D-4** | "S2 storage. Original book text remains in MinIO. PostgreSQL stores chunk identifiers, character offsets, text hashes, metadata, and `tsvector`, without verbatim chunk text." |
| **D-6** | "Indexing requires explicit, verified, book-level `retrieval_indexing` permission for the exact text version. User ownership does not grant indexing permission." |
| **D-7** | "Retain the current and at most one previous index version. The previous version may remain for a maximum of 30 days and must be removed sooner when unnecessary. Revocation immediately blocks retrieval and requires active-index purging. Backup-retention limitations remain documented production blockers." |
| **D-9** | "Reserve mission identifier **NEM-023** for E5." |

## Consequences recorded

- **Rights vocabulary:** `retrieval_indexing` is adopted as a title-level AI permission, realising ADR-002's candidate "semantic indexing" for retrieval indexes of any kind. It is stored as data in `book_ai_rights.permittedOperations` for one exact `textHash`.
  - It is a **book-level** grant. It is never derived from ownership, upload, general terms, or hosting tier (07 §5).
  - It never grants use: query-time eligibility (`research_analysis` via NEM-019's `RightsService`) is still required.
- **Compatibility (verified in the repository, 2026-11-10):** introducing the operation changes **no accepted behaviour**.
  - NEM-019 validates operations by form only (`^[a-z][a-z0-9_]*$`), and the `permittedOperations` column has no value constraint.
  - `RightsService.eligibility` tests only the requested operation.
  - Frozen contract v1 has no rights operations.

  No exception is required.
- **Production indexing stays blocked** until rights blockers RB-1 to RB-7 (decision packet §3) are resolved, including offsite backup retention.

## What this decision does and does not authorize

| | Status |
|---|---|
| D-1, D-4, D-6, D-7 as recorded above | **Decided** |
| Reservation of identifier `NEM-023` for E5 | **Reserved** (mission register updated) |
| Finalizing the NEM-023 specification for Product Architecture review | **Authorized** (documentation only) |
| **Approval of the NEM-023 specification for execution** | **Not yet**: follows the Product Architecture review |
| **Execution** of NEM-023; code, migrations, extensions | **Not authorized** |
| Production indexing; merge; deployment (staging or production); CI/CD or infrastructure; paid providers | **Not authorized** |
| E6 or unrelated work | **Not authorized** |

## Relationship to other records

- Builds on PO-029 (draft, eligible corpus), ADR-002, ADR-004, ADR-006, PO-027 rule 8, and 07 (rights verification).
- **Identifier note:** two unmerged reports (SA-003 and the NEM-020 billing inventory, 2026-11-07) used "NEM-021/022/023" as *proposed* billing-roadmap identifiers. PO-032 already assigned NEM-021 and NEM-022 to E1 and E2, and this record assigns NEM-023 to E5. The mission register is authoritative, and those billing proposals need new identifiers when drafted.
- Changes no existing PO record or ADR. Supersedes nothing.
