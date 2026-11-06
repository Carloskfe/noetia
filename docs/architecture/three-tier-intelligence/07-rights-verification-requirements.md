# 07 — Rights Verification Requirements and Dependencies

**Status:** PROPOSED, for preliminary ruling TT-12 ([PO-029](../../operating-framework/decisions/product-owner/PO-029-eligible-research-corpus.md)). `LEGAL REVIEW REQUIRED`. This is product policy, not a legal determination. No catalogue change, ingestion, or backfill is authorized.

---

## 1. Current state (verified)

| Fact | Evidence |
|---|---|
| `books` has no rights, edition, translator, or AI-permission fields | `book.entity.ts`; IG-04 (CRITICAL, open) |
| Ingestion sets `isFree: true` on creation | `ingestion.service.ts:68` |
| `isFree` governs catalogue readiness and the sync gate; a public-domain title can be `false` | `catalogue.ts` comments; Creator & Rights Framework |
| `pendingRights` is build-time only and never persisted | `catalogue.ts`; Framework |
| The catalogue has 86 entries; sources are Gutenberg, Wikisource, and Vatican | `catalogue.ts` |
| Some entries are translations, and the edition is chosen by sync fit, not rights | `catalogue.ts:353-367` (e.g., *El Príncipe*, Sánchez Rojas translation) |
| The Product Owner accepted that most or all existing titles may be `UNKNOWN` until backfill | Framework (NEM-007 Phase A) |

**Result: today no book is eligible.** That is correct behaviour under default deny.

## 2. Never evidence of rights

`isFree` · `pendingRights` or its absence · sync quality or `syncSource` · `uploadedById` · `category` · catalogue visibility · token eligibility · `author` string · PO-016 reconstructability · a source site listing a text as free.

A LibriVox recording's status says nothing about the **text**, and a work's status says nothing about a modern **translation or edition** (ADR-002).

## 3. What must be verified

Each record applies to **one exact text version** (`textHash`).

| Element | Required content |
|---|---|
| **Work** | Title, author(s), author death date, first publication date |
| **Edition** | Edition, publisher, year, source of the stored text |
| **Translation** | Translator(s), translator death date, translation date; or "not a translation" |
| **Added material** | Introductions, notes, modern editorial text: excluded or separately cleared |
| **Text identity** | `textHash`, and the source URL or identifier retrieved |
| **Rights basis** | `public_domain`, `rights_holder_opt_in`, or `licensed`, with its evidence |
| **Jurisdiction** | Where the determination holds (TT-26) |
| **Operations** | Which AI operations are permitted (ADR-002 list); training stays off for licensed content |
| **Accountability** | Verifier, date, evidence links, review date |

## 4. Status model

```
unknown (default) → pending_review → verified → revoked or expired
                         └→ rejected
```

Only `verified` allows processing, for its listed operations only.

| Event | Effect |
|---|---|
| Text changes (`textHash`) | Record no longer matches: **back to `unknown`** |
| Opt-in withdrawn or rights challenged | `revoked`: new turns exclude the book; derived shared artifacts are purged |
| Missing, partial, or malformed record | Denied |

A re-seeded sync map does not affect rights unless the text changed.

## 5. Corpus stages

| Stage | Corpus | Entry requirement |
|---|---|---|
| **Evaluation** (T2) | A small verified public-domain set in ES and EN | §3 complete |
| **Pilot** (T5–T7) | Same, or a modest extension | §3 complete; Terms and Privacy updated (TT-22) |
| **Commercial expansion** | Author or publisher opt-in first | Explicit, per title, per operation, revocable, with evidence; contract language (D6) |

Verification effort stays small on purpose. The free library is a beta tool, not the business (PRD), and the real corpus comes from authors.

**Opt-in is never inferred** from uploading a book, accepting general terms, or hosting tier.

## 6. Dependencies

| Dependency | State | Needed for |
|---|---|---|
| Legal evidence standard (TT-26) | Open; `LEGAL REVIEW REQUIRED` | Evaluation corpus sign-off |
| Jurisdiction scope (TT-26): target markets include Latin America, the US, and Spain, and terms differ by country | Open | Same |
| Named verifier (TT-26) | Open | Same |
| `book_ai_rights` schema | Proposed; empty table in NEM-019 | T2+ |
| Authoritative backfill (IG-04, NEM-007 Phase B) | Blocked | Beyond the pilot set |
| Author opt-in terms and UI | Not designed | Commercial expansion |
| Publisher contract language (D6) | Open | Commercial expansion |
| Provider data-handling review (PO-005) | Open | T4 |

## 7. Test requirements for later missions

`isFree = true` with no record is denied · partial record denied · record for an older `textHash` denied · an unlisted operation denied · a revoked record denied at the next turn · an owned book with no rights record denied · no real-book record seeded by a migration.
