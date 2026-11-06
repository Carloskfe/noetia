# PO-028 — My Knowledge and Highlight Boundary

**Status:** `DRAFT — NOT DECIDED`. Records preliminary ruling TT-05. Becomes `DECIDED` only when the Product Owner accepts this text.
**Domain:** AI, Rights, Privacy · **Authority:** Product Owner
**Date:** 2026-11-06 · **Source:** T0 ruling TT-05
**Implementation:** `NOT IMPLEMENTED` — no highlight search exists today

---

## Decision (proposed text)

1. Generated book-grounded analysis is restricted to the **books selected for the active research session**.
2. **Search** across the user's own highlights is permitted outside that session-book limit.
3. That exception must not retrieve unselected full book text and must not bypass publisher AI permissions.
4. ADR-003's source-origin distinctions and existing privacy boundaries are maintained.

## Trust boundary

| Content | Where it lives | Who controls it | Trust | May be searched outside the session limit? | May enter a model's context? | How it is attributed |
|---|---|---|---|---|---|---|
| **User-authored note** | `fragments.note` | The user | User-private; untrusted as instructions | **Yes**, by its owner only | Only for a book selected in the session and eligible, and after Terms and Privacy disclose provider processing | "Your note"; **never** attributed to the author or book |
| **Saved quotation** | `fragments.text` | Text belongs to the rights holder; **the row is client-supplied and editable** | **An assertion, not evidence** | **Yes**, by its owner only, shown to that owner | Only for a selected book, under **that book's AI permissions, as if it were publisher text** | "Your saved highlight" unless verified against the source text; only then can it carry a book citation |
| **Publisher-controlled text** | Stored book text; future `book_chunks` | The rights holder, through Noetia's rights record | Authoritative when verified | **No** | Only for a selected book, after entitlement and rights checks | Book → Author → Chapter → passage |
| **Generated content** | Future `ai_messages`, Briefs | Noetia, for the user | Derived | Not part of this exception | Within its own session | Labelled by origin; never presented as an author's words |

**Why a saved quotation is only an assertion (verified fact).** `POST /fragments` accepts any `text` for any `bookId`, with no length limit and no check that the text comes from the book (`create-fragment.dto.ts`, `fragments.service.ts:23-31`). `PATCH /fragments/:id` can rewrite it, and source positions are never stored (SA-001 §5.4). Saved-quotation text may also be genuine publisher text, so it inherits the book's restrictions while earning none of its authority.

## The search exception, exactly

| Permitted | Not permitted under this exception |
|---|---|
| Lexical search over the requesting user's own highlights and notes | Any retrieval from book text or chunks |
| Returning the user's own rows | Generating an answer, summary, or comparison from results |
| Linking to the book through the existing content guard | Automatically adding a book to a session |
| | Sending highlights or notes to an AI provider, including for embedding (TT-25) |
| | Other users' or household members' highlights |

## Pending — not decided here

| Item | Current reading | Tracker |
|---|---|---|
| Generation over highlights alone, outside a session | **Not permitted** by this text. It would change NEM-003's Ask My Highlights | TT-24 |
| Semantic highlight search | Not permitted until decided | TT-25 |
| Whether highlight search needs a premium tier | Undecided | TT-25 |

## Residual risks, stated plainly

A user can paste text into a question. It is treated as user content and is never cited as the book, but Noetia cannot prove where it came from. Reconstruction safeguards (ADR-002) still apply to output.

## Implementation boundary

Authorizes no implementation. Fragment write paths are not changed by this record.
