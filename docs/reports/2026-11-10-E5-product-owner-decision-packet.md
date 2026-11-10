# E5 — Product Owner Decision Packet (final specification preparation)

**Status:** **Outcome (2026-11-10): the PO decided D-1, D-4, D-6, D-7, and D-9 — see [PO-033](../operating-framework/decisions/product-owner/PO-033-e5-knowledge-retrieval-decisions-and-nem-023-reservation.md).** RB-4 is resolved (`retrieval_indexing` adopted). RB-1 to RB-3 and RB-5 to RB-7 still gate production indexing. The rest of this packet is the pre-decision record. Documentation only.
**Authorization:** PO *"E5 Product Owner Direction and Final Rights Review"* (2026-11-10): the PO selected **S2 in principle**; final specification preparation only.
**Related:** [discovery report, revision 4](2026-11-09-E5-retrieval-discovery-report.md) · [DRAFT mission, revision 4](../engineering-missions/DRAFT/NEM-023-knowledge-retrieval-and-grounding.md).
**Not legal advice.** This packet reports what the repository's rights decisions and licensing documents say. It does not determine copyright status.

---

## 1. Decisions recorded in this revision

| Item | Recorded |
|---|---|
| **D-4 storage** | **S2 selected in principle by the PO, subject to rights verification.** Original book text stays in MinIO. PostgreSQL stores chunk ids, offsets (code points), `textHash`, chapter and language metadata, and `tsvector`, but **no verbatim chunk text**. Snippets are cut from the MinIO object at retrieval, after verifying its hash. S1 is no longer in scope |
| **`retrieval_indexing`** | Confirmed as an **explicit, book-level permission** in the rights record's `permittedOperations`, granted per text version, **independent of user ownership**. Ownership never grants it (PO-027 rule 8); it never grants use. Query-time use still needs the unchanged user-level eligibility (`RightsService`) |

## 2. Rights review: can these books legally be indexed today?

**Sources reviewed:**
- PO-029 (eligible corpus);
- `07-rights-verification-requirements.md`;
- ADR-002 and `noetia-plus/05-content-permissions.md`;
- the P0 packet (TT-12, TT-26, D6, C2);
- the Terms of Service (`services/web/lib/legal/terms-of-service.ts`) and `docs/upload-guide.md`;
- `docs/operations/offsite-backups.md` and the backup scripts.

| Category | Policy position (repository) | Can it be indexed now? | Why not yet |
|---|---|---|---|
| **Public domain** | Allowed in principle. 05 (ratified via ADR-002) defaults public-domain titles to "all AI operations allowed". PO-029 names **verified** public-domain material as the evaluation and pilot corpus | **No, not yet** | The work being public domain is not enough: **each exact text version** must be verified for work, edition, **translation** (translator dates), added editorial material, jurisdiction, and permitted operations (07 §3). PO-029 is **`DRAFT — NOT DECIDED`**; the evidence standard, jurisdictions (Latin America, US, Spain), and Named Verifier (**TT-26**) are open, `LEGAL REVIEW REQUIRED`; no `verified` record exists; the production verification authority is unbound (F-12). Some catalogue entries are modern translations (07 §1), whose own rights must be cleared |
| **Author- or publisher-authorized** | Commercial expansion via **explicit opt-in, per title, per operation, revocable, with evidence** (07 §5; PO-029 rule 2). "**Opt-in is never inferred** from uploading a book, accepting general terms, or hosting tier" | **No** | No opt-in terms or UI exist (07 §6: "not designed"). Publisher contract language **(D6) is open**. **The Terms of Service and upload guide contain no AI or indexing clause.** The licensed default-permission matrix is a pending Product/Legal decision (05) |
| **Any other book** | Default deny | **No** | — |

**Conclusion:** **no book can be indexed in production today.** That is the correct default-deny outcome, not a defect. E5 can still be **implemented and tested on fixtures**, because its indexer denies whenever book-level permission cannot be established.

## 3. Rights and governance blockers (for production indexing; they do not block fixture implementation)

| ID | Blocker | Owner | Unblocks |
|---|---|---|---|
| **RB-1** | **PO-029** (eligible corpus) is still `DRAFT — NOT DECIDED` | PO | Any AI processing policy |
| **RB-2** | **TT-26**: legal evidence standard, jurisdictions, Named Verifier (`LEGAL REVIEW REQUIRED`) | PO + legal | Verified public-domain records |
| **RB-3** | No `verified` `book_ai_rights` records; production authority and text-identity adapters unbound (E3); backfill IG-04 blocked | Engineering (E3) after RB-2 | Any indexable book |
| **RB-4** | **`retrieval_indexing`** is not yet part of the rights operation vocabulary (the ADR-002 list; 05's `semanticIndexingAllowed` is design only). The PO must adopt it, and record whether a public-domain verification grants it by default | PO | `IndexingPermission` grants |
| **RB-5** | Author/publisher opt-in terms, UI, and contract language **(D6)**; no AI clause in the Terms of Service or upload guide | PO + legal | Author-authorized indexing |
| **RB-6** | Whether storing the **`tsvector` lexical derivative** (and serving MinIO snippets) is permitted for **licensed** titles | Legal | Licensed-title indexing |
| **RB-7** | **Offsite backups have no retention or pruning** ("the script never deletes"; runbook known gap 4). A `purge` cannot reach offsite PostgreSQL copies, so a revoked book's `tsvector` persists there **indefinitely** until an offsite retention policy exists | PO (policy) + an infrastructure mission | Effective revocation for licensed titles |

## 4. Default deny, revocation, purge, and backups (S2)

- **Default deny at indexing:** no chunks unless `IndexingPermission` passes for the current text version:
  - verified, complete, well-formed record;
  - `retrieval_indexing` granted;
  - not past review;
  - attested;
  - no user identity involved.

  With today's bindings, nothing is indexable.
- **Default deny at query time:** user-level eligibility (the unchanged `RightsService`, by E6's caller) **and** a fresh book-level `IndexingPermission` re-check, plus the current-hash match. Any failure excludes the book.
- **Revocation** (07 §4: opt-in withdrawn or rights challenged → `revoked`):
  - the next query excludes the book at once (the record is no longer `verified`);
  - `purge <bookId>` deletes all its chunk rows (`tsvector`, offsets, hashes);
  - book deletion cascades.

  Under S2, no verbatim text is in PostgreSQL to purge.
- **Text change:** a new `textHash` returns the record to `unknown` (07 §4). Old chunks stop matching immediately and are pruned after the grace period.
- **Backup retention after a purge:**

  | Copy | What it still holds | How long |
  |---|---|---|
  | On-server PostgreSQL dumps | The `tsvector` derivative | Until rotation: 7 daily + 4 weekly, **up to about 28 days** |
  | Offsite PostgreSQL copies | The `tsvector` derivative | **Indefinitely** (RB-7) |
  | MinIO archives | The original text (unchanged by E5) | Existing lifecycle (4 weekly; offsite likewise unpruned) |

## 5. D-1 to D-9: which need the PO, and which are configuration

| ID | Decision | Recommended default | Needs |
|---|---|---|---|
| D-1 | TT-25: lexical at launch | Lexical, vector-ready interface | **PO approval** (product) |
| D-2 | E5 delivers dark components; E6 wires turns | As drafted (PA-reviewed) | Product Architecture; approved with the mission |
| D-3 | Text hash = SHA-256 of MinIO bytes via `TextIdentityPort`; E3 binds | As drafted (PA-reviewed) | Product Architecture; **PO only for E3/E5 sequencing** |
| D-4 | Storage | **S2, selected in principle** | **PO: recorded**; final once RB-6 and RB-7 are answered for licensed titles |
| D-5 | `unaccent` contrib extension (additive migration) | Yes | Product Architecture with mission approval. Its production enablement follows the ADR-004 infrastructure-safety steps at deploy time |
| D-6 | Indexing scope: book-level `IndexingPermission`, explicit `retrieval_indexing` | As drafted | **PO approval** (rights policy), with **RB-4** |
| D-7 | Retention: current + previous set, 30-day grace, `purge` on revocation | As drafted | **PO approval** (exposure). **Offsite retention (RB-7) is a separate PO and infrastructure decision** |
| D-8 | Limits and retrieval defaults (chunk size and overlap, ≤ 2,000 chunks per book, ≤ 250 MB, timeouts, top-k, budgets) | §9.4 of the draft | **Engineering configuration** (PA-reviewed); not a PO decision |
| D-9 | Mission identifier | **NEM-023** (§6) | **PO reservation** |

**PO actions needed to approve the E5 specification:** D-1, D-6 (with RB-4), D-7, the D-9 reservation, and confirmation of D-4 (S2) as recorded.

**Not needed for approval:** RB-1, RB-2, RB-3, RB-5, RB-6, and RB-7 gate **production indexing**, not fixture implementation.

## 6. Proposed mission identifier

**NEM-023.**
- Governance: identifiers are reserved by the PO (README "Mission identifier reservations"); a reservation is not approval.
- NEM-018 to NEM-022 are in use (NEM-020 billing/D6; NEM-021 E1; NEM-022 E2).
- "NEM-023" appears nowhere in the repository.
- Proposed title: *"NEM-023 (E5) — Knowledge Retrieval and Grounding (Stage 1: lexical, provider-independent, S2 storage)"*.
- E3 (rights and text adapters) has no identifier yet. Reserving NEM-023 for E5 does not constrain E3's.

## 7. Not done

No implementation, migration, extension, infrastructure, CI/CD, merge, deployment, or provider activity. No legal determination is made: the rights statements above report repository documents and open items.
