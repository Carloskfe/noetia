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
| ADR-001 | ADR | AI provider abstraction & model routing | ACCEPTED | Architecture | [ADR-001](../architecture/adr/ADR-001-ai-provider-abstraction-and-model-routing.md) | PLANNED |
| ADR-002 | ADR | Permission-aware content intelligence | ACCEPTED | Rights | [ADR-002](../architecture/adr/ADR-002-permission-aware-content-intelligence.md) | PLANNED |
| ADR-003 | ADR | Source-aware hybrid intelligence | ACCEPTED | AI | [ADR-003](../architecture/adr/ADR-003-source-aware-hybrid-intelligence.md) | PLANNED |
| ADR-004 | ADR | PostgreSQL + pgvector semantic retrieval | ACCEPTED | Architecture | [ADR-004](../architecture/adr/ADR-004-postgresql-pgvector-semantic-retrieval.md) | Staging-validated |

**Supersession:** none recorded. PO-004 explicitly does not alter PO-001…003.

---

## Engineering missions

Reconstructed from commits and produced documentation — **no mission file exists in the
repository** (→ C-05). Every row is Level 6 evidence standing in for Level 4.

| ID | Title | Status | Source of reconstruction |
|---|---|---|---|
| NEM-002 | Production safety & business-critical verification | COMPLETE | [`production-safety/`](../production-safety/README.md) |
| NEM-003 | Noetia+ product & technical integration design | COMPLETE | [`noetia-plus/`](../noetia-plus/README.md), commit `d4bef79` |
| NEM-005 | Record PO-001…003 + ADR-001…003 | COMPLETE | `PRODUCT-DECISIONS.md`, commit `3b44b82` |
| NEM-005A | Accept ADR-004 (pgvector) | COMPLETE | ADR-004, commit `9e682fb` |
| NEM-006 | Noetia+ implementation | PAUSED | Referenced by NEM-006A/B/C as the resumed target |
| NEM-006A | Permanent staging environment foundation | COMPLETE (awaiting acceptance) | commits `0dcd139`, `3c71e5a`, `5aa9a7b`, `15e5762` |
| NEM-006B | Production PG16 restore-compatibility proof | NOT STARTED | Referenced in staging docs |
| NEM-006C | Full-catalog reader-validatable staging content | IN PROGRESS | commit `b16aec7` |
| NOF-001 | Operating Framework foundation | IN PROGRESS | this document |

---

## Positions held without a decision record

The most consequential gap in the registry. Each is load-bearing for the business, and
none has a PO decision file.

| ID | Position | Authority today | Registered issue |
|---|---|---|---|
| DOC-01 | Monthly pricing $8.99 / $13.99 / $18.99 | Business plan + PRD (agree) | — |
| DOC-02 | Annual pricing | Business plan and PRD **disagree** | C-01 · Q-01 |
| DOC-03 | Revenue split 45 / 36 / 9 / 2.22 / 7.78 | Business plan only; no payout engine | C-03 · Q-02 |
| DOC-04 | "45%" used for two different shares | Business plan, internally inconsistent | C-04 · Q-03 |
| DOC-05 | Family seat count | PRD says 6, business plan says 5 | C-02 · Q-05 |
| DOC-06 | Causas Noetia 2.22% of every payment | Business plan; `causes` table exists | Allocation not computed → C-03 |
| CODE-01 | Token expiry 90 days | `TOKEN_EXPIRY_DAYS` constant | Promotional window inferred → C-06 |
| CODE-02 | Shared Duo/Family token pool, separate libraries | `linkedUserIds` resolution in redemption | — |
| CODE-03 | Redeemed book access is permanent | `user_books` has no expiry | Never stated as policy → 06-user-rights |
| CODE-04 | Catalog quality gate ≥90% sync coverage | `books.service.ts` | Product rule living only in code |
| DOC-07 | Free-library sunset after 6–12 months | `CLAUDE.md` | No start date → C-10 · Q-08 |
| DOC-08 | Reader-first product hierarchy | `CLAUDE.md` | Strong candidate for charter promotion |

---

## How to use this registry

**Answering "why does Noetia work this way?"** — find the behavior, read its authority
column. `PO`/`ADR` means it was decided. `DOC`/`CODE` means it is merely true.

**Before changing a behavior** — a `PO`/`ADR` row needs a superseding decision. A
`CODE` row may be a bug, an accident, or an unrecorded decision; establish which before
treating it as policy (NOF-001 §3).

**When adding a decision** — add the row here in the same change that creates the record.
The registry is only useful if it stays complete.
