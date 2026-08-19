# Creator & Rights Framework

**v0.1** · NOF-001 · Who supplies the catalog, what they are owed, and what rights they
retain. `LEGAL REVIEW REQUIRED` for all copyright conclusions.

---

## Why creators are structural

Noetia is **not a content publisher** — the catalog is built by authors, publishers, and
companies ([Charter](00-project-charter.md)). Creators are the supply chain, not a cost
centre. This is why they sit second in the product hierarchy while the free library, which
Noetia controls entirely, sits third.

## Roles

| Role | Description |
|---|---|
| **Writer / Author** | Creates the work |
| **Publisher / Rights holder** | Holds distribution rights; may be the author |
| **Narrator / Voice creator** | Produces the audio |
| **Self-narrating author** | Writer **and** narrator in one party |

The model must support `writer == narrator` and `writer != narrator` as equally normal.
Both cases are represented in `courtesy_token_quotas(role ∈ author | publisher | narrator)`
— the one place the system already distinguishes them.

## Economic participation

**DECIDED — [PO-007](decisions/product-owner/PO-007-canonical-revenue-allocation.md)**

| Title type | Author/Publisher | Narrator | Combined |
|---|---|---|---|
| Separate narrator | 36% | 9% | paid to two parties |
| **Self-narrated** | 36% | 9% | **45% to one party** |

The "45% creator share — highest in the category" claim is accurate **only** for the
self-narrated case. Author-facing material must never use "45%" without saying whose share
it is.

**Obligations accrue at redemption** (PO-008), whether or not software computes them. The
amount is the token's gross value per
**[PO-010](decisions/product-owner/PO-010-token-gross-value-basis.md)** — the actual
consideration attributable to that token, which differs between monthly and annual plans.
No settlement engine exists → [IG-02](governance/contradictions-and-gaps.md#implementation-gaps).

## Compensation models

`PARTIALLY DECIDED` — royalty is decided (PO-007). The business plan references **advance**
and **hybrid** narrator arrangements; no approved mechanics were found.

`OPEN (P1):` advance and hybrid narrator compensation, payout thresholds, and payout
cadence are undocumented.

## Contribution paths

**IMPLEMENTED**

| Path | What the creator supplies | Notes |
|---|---|---|
| Full submission | Text + narrated audio | Author-owned master recording; self-narrated case |
| Text-only | Text file | Narration `TBD` — author-produced or future Noetia production |

Upload specifications: [`upload-guide.md`](../upload-guide.md). Author uploads **bypass
the ≥90% sync quality gate** — creators manage their own quality through the review flow,
unlike ingested public-domain titles.

## Rights controls

**DECIDED (PO-002 / ADR-002) · NOT IMPLEMENTED**

Rights holders get title-level AI controls: indexing · Q&A · summary · comparison ·
quotation · grounding · discoverability embeddings · recommendation and knowledge-map
participation · training.

**Defaults that are already policy:**

- Licensed content must **not** train or improve a general-purpose model without explicit
  authorization.
- **Ownership ≠ unrestricted AI rights.** A user owning a book does not grant Noetia
  unlimited AI use of it; that is governed by Noetia's rights agreement with the creator.
- Noetia Brain may help a reader *understand* a work but must never *reconstruct or
  substitute for* it.

Schema and enforcement are future implementation decisions.

## Content rights classes

| Class | AI treatment |
|---|---|
| **Public domain** | Only when the **specific text, translation, and edition** is verified — a modern translation is not automatically PD |
| **Owned / licensed by user** | Q&A, explain, summarize, compare, analyze, synthesize, cite, short-quote — subject to the rights agreement |
| **Discoverable / non-owned** | Only contractually permitted metadata, previews, excerpts |
| **Restricted** | No AI retrieval or context |

## Courtesy tokens

**IMPLEMENTED** — `courtesy_token_quotas` lets admins grant non-purchased tokens to
contributors by role. These create **no** creator allocation (not qualifying paid
redemptions).

## Open and review

| Item | Status |
|---|---|
| Advance / hybrid narrator terms | `OPEN` P1 |
| Payout thresholds and cadence | `OPEN` P1 |
| Quotation thresholds | `OPEN` P2 (Q-12) — deliberately unset by PO-002 |
| Publisher contract language | `OPEN` — `LEGAL REVIEW REQUIRED` |
| Narrator-facing tooling | FUTURE — an economic party with no product surface |

`LEGAL REVIEW REQUIRED` — licensing agreements, quotation policy, publisher AI
permissions, content-processing terms, provider data handling, and any fair-use
conclusion. Economic design and copyright conclusions are **separate**; this document
decides only the former.
