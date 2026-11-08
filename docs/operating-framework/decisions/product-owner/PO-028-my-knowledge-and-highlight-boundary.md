# PO-028 — My Knowledge and Ask My Highlights

**Status:** `DECIDED` — approved by the Product Owner on 2026-11-08 as **TT-05, "Option A"**. Supersedes the 2026-11-06 preliminary text (search only), preserved below.
**Domain:** AI, Rights, Privacy · **Authority:** Product Owner
**Date:** 2026-11-08 (preliminary ruling 2026-11-06) · **Source:** TT-05
**Implementation:** `NOT IMPLEMENTED` — no highlight search or highlight-based answers exist today

> **Label note.** The approval was given as "Option A". In the only option table in the repository (three-tier `05`, PR #34), option (a) limits highlights to selected books without generation, and option (b) matches the approved rules. On 2026-11-08 the Product Owner confirmed that **the numbered rule text below is the decision**; "Option A" refers to a different option list.

---

## Decision (approved text, 2026-11-08)

1. Full-book research remains **restricted to the books selected** for the research session.
2. **Ask My Highlights** may **search and answer questions** using the user's own saved highlights **across their entire personal library**.
3. Highlight-based intelligence operates **independently of the three- or ten-book** full-text limit.
4. Highlight-based intelligence has **its own AI usage controls**.
5. Library-wide highlight access **must not become an indirect route** to unrestricted full-book retrieval.
6. Personal highlights and AI conversations remain **private to the individual account**.
7. Preserve the existing distinction between **This Book**, **My Knowledge**, and **Expand** (ADR-003).

The Product Owner instructed that no quantitative budgets, copyright thresholds, or AI pricing be invented in recording this decision.

## What changes from the preliminary ruling

| Topic | Preliminary (2026-11-06) | Decided (2026-11-08) |
|---|---|---|
| Highlights outside a session | Lexical **search** only; no generation (TT-24 default "No") | **Search and answers** over the user's own highlights, library-wide (rule 2). **TT-24 is resolved** |
| Relationship to the book limit | Separate from the limit | Independent of the limit (rule 3), with its own AI usage controls (rule 4) |
| Full-book text | Never retrieved outside selected books | Unchanged (rules 1, 5) |
| Privacy | Owner only | Unchanged; private to the individual account (rule 6) |

## Not decided by this record

| Item | Current reading (recommendation, not a decision) | Tracker |
|---|---|---|
| How **book AI permissions** apply when saved-quotation text (`fragments.text`) from a book **not** selected in any session, or with restrictive rights, is sent to a model for a highlight answer | Not decided. The preliminary trust boundary treated saved quotations as publisher text under that book's permissions; rule 2 does not state whether that still applies outside a session | **TT-27** (new) |
| Semantic highlight search (embeddings of notes and quotations) | Not decided | TT-25 |
| Which tiers offer Ask My Highlights | Not decided | TT-25 |
| Provider disclosure and Terms before highlights or notes reach an AI provider | Required before real user data reaches a provider | TT-22 |
| Quotation and anti-reconstruction thresholds for highlight answers | Not decided | TT-13 |
| Budget values and reset for highlight intelligence | Not decided | TT-09, TT-11 |
| Retention and export of highlight conversations | Not decided | TT-14 |

## Facts that still apply [CODE]

`POST /fragments` accepts any `text` for any `bookId`, with no length limit and no check that the text comes from the book (`create-fragment.dto.ts`, `fragments.service.ts:23-31`); `PATCH /fragments/:id` can rewrite it; source positions are never stored (SA-001 §5.4). A saved quotation is therefore a user-supplied **assertion**, not verified publisher text. This is why rule 5 needs explicit safeguards and why TT-27 matters.

## Implementation boundary

Authorizes no implementation. Fragment write paths are not changed by this record.

---

## Historical: preliminary text of 2026-11-06 (superseded, preserved unchanged)

**Status:** `DRAFT — NOT DECIDED`. Records preliminary ruling TT-05. Becomes `DECIDED` only when the Product Owner accepts this text.
**Domain:** AI, Rights, Privacy · **Authority:** Product Owner
**Date:** 2026-11-06 · **Source:** T0 ruling TT-05
**Implementation:** `NOT IMPLEMENTED` — no highlight search exists today

---

### Decision (proposed text)

1. Generated book-grounded analysis is restricted to the **books selected for the active research session**.
2. **Search** across the user's own highlights is permitted outside that session-book limit.
3. That exception must not retrieve unselected full book text and must not bypass publisher AI permissions.
4. ADR-003's source-origin distinctions and existing privacy boundaries are maintained.

### Trust boundary

| Content | Where it lives | Who controls it | Trust | May be searched outside the session limit? | May enter a model's context? | How it is attributed |
|---|---|---|---|---|---|---|
| **User-authored note** | `fragments.note` | The user | User-private; untrusted as instructions | **Yes**, by its owner only | Only for a book selected in the session and eligible, and after Terms and Privacy disclose provider processing | "Your note"; **never** attributed to the author or book |
| **Saved quotation** | `fragments.text` | Text belongs to the rights holder; **the row is client-supplied and editable** | **An assertion, not evidence** | **Yes**, by its owner only, shown to that owner | Only for a selected book, under **that book's AI permissions, as if it were publisher text** | "Your saved highlight" unless verified against the source text; only then can it carry a book citation |
| **Publisher-controlled text** | Stored book text; future `book_chunks` | The rights holder, through Noetia's rights record | Authoritative when verified | **No** | Only for a selected book, after entitlement and rights checks | Book → Author → Chapter → passage |
| **Generated content** | Future `ai_messages`, Briefs | Noetia, for the user | Derived | Not part of this exception | Within its own session | Labelled by origin; never presented as an author's words |

**Why a saved quotation is only an assertion (verified fact).** `POST /fragments` accepts any `text` for any `bookId`, with no length limit and no check that the text comes from the book (`create-fragment.dto.ts`, `fragments.service.ts:23-31`). `PATCH /fragments/:id` can rewrite it, and source positions are never stored (SA-001 §5.4). Saved-quotation text may also be genuine publisher text, so it inherits the book's restrictions while earning none of its authority.

### The search exception, exactly

| Permitted | Not permitted under this exception |
|---|---|
| Lexical search over the requesting user's own highlights and notes | Any retrieval from book text or chunks |
| Returning the user's own rows | Generating an answer, summary, or comparison from results |
| Linking to the book through the existing content guard | Automatically adding a book to a session |
| | Sending highlights or notes to an AI provider, including for embedding (TT-25) |
| | Other users' or household members' highlights |

### Pending — not decided here

| Item | Current reading | Tracker |
|---|---|---|
| Generation over highlights alone, outside a session | **Not permitted** by this text. It would change NEM-003's Ask My Highlights | TT-24 |
| Semantic highlight search | Not permitted until decided | TT-25 |
| Whether highlight search needs a premium tier | Undecided | TT-25 |

### Residual risks, stated plainly

A user can paste text into a question. It is treated as user content and is never cited as the book, but Noetia cannot prove where it came from. Reconstruction safeguards (ADR-002) still apply to output.

### Implementation boundary

Authorizes no implementation. Fragment write paths are not changed by this record.
