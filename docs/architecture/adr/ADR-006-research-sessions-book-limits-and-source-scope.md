# ADR-006 — Research Sessions, Selected-Book Limits, Forking, Source-Scope Isolation, and Research Briefs

- **Status:** Proposed (draft; not accepted) — **revision 3, 2026-11-08**: review corrections B-2, B-3, B-4, B-5 incorporated (review PR #41, accepted by the PO); ready for formal acceptance review
- **Date:** 2026-11-06 (SA-002-T0); revised 2026-11-08 (SA-002-T0 Rev 2; review corrections)
- **Decided by:** pending: Product Architecture acceptance. Product Owner inputs: **PO-027, PO-028 (decided 2026-11-08)**, PO-029 (draft; TT-12 open), PO-030 (decided; requires this ADR)
- **Relates:** extends ADR-002, ADR-003, ADR-004 without altering their decisions; NEM-003 remains historical design.

## Context
Noetia+ allows 3 selected books per research session, and NoetiaX 10; **every selected book counts, including public domain** (PO-027). ADR-003 defines My Knowledge as the user's accumulated knowledge, which is broader than a session. A limit is meaningless if books can be rotated, if retrieval is unscoped, or if unselected content can reach the model through highlights, history, or planners.

## Decision

### Scope has two independent axes
**Source mode** (This Book, My Knowledge, Expand; ADR-003) and **session book set**. There is no fourth mode. In a session, My Knowledge means the selected books plus the user's own highlights and notes on those books.

### Session book set
- Stored in a normalized table, unique per session and position, with a database ceiling of position 1–10 at the highest approved limit. The tier limit comes from the resolver (ADR-005), never from a client; limits are **enforced server-side** (PO-027 rule 7).
- **Every selected book counts** toward the limit, including public-domain books (rule 3).
- **Eligibility = rights verification AND access basis (B-4).** Rights are verified **independently of ownership** (PO-027 rule 8): ownership never makes a book AI-eligible. The access basis is either a **verified, AI-eligible public-domain edition**, which may be selected without a `user_books` row (rule 4), or the user's **entitlement to a licensed book** under ADR-002. A verified licensed book the user is not entitled to is **not** selectable for full-text analysis. Which editions are verified is the rights resolver's job (PO-029 draft; TT-12, TT-26 open), so today no book is eligible.
- **Locks at the first accepted analysis turn.** A turn rejected in preflight does not lock. A provider failure after acceptance does.
- A locked set never changes. Changes create a new or forked session.

### Transaction safety
Selection changes and the lock each run in a short transaction holding a row lock on the session (`SELECT … FOR UPDATE`). Every turn reads the set and its hash after that lock. **No provider call happens while holding the lock.**

**Turn order (B-5).**
1. Resolve entitlement and tier policy (ADR-005).
2. Validate the book set and each book's eligibility.
3. Reserve budget in the ledger with the turn's idempotency key (ADR-005).
4. In one short transaction with `SELECT … FOR UPDATE` on the session: re-read the set and its hash and, on the first turn, record the lock; commit.
5. Call the provider **outside** any transaction.
6. Settle through the durable, idempotent settlement of ADR-005.

| Failure at | Effect |
|---|---|
| Steps 1–3 | Rejected in preflight: **no lock, no charge** |
| Step 4 | The reservation is released through the ledger (idempotent); no lock |
| Steps 5–6 | The lock stands. Settlement follows ADR-005: recorded from reported usage; if unknown or the ledger is unavailable, the reservation stays **held and unresolved** until reconciliation. **Settlement is never assumed** |

### Forking and history
- A fork is a new session with a parent reference. The parent stays immutable.
- **Generated context carries into a fork only if the parent's books are a subset of the fork's and rights still permit.** Otherwise the fork starts clean, because history can carry analysis of books the fork excludes. The user can still read the parent.

### Downgrade and loss of entitlement

| Event | Session at or under the new limit | Session over the new limit |
|---|---|---|
| NoetiaX → Noetia+ | Stays active; NoetiaX-only capabilities stop | `read_only`, plus offer to fork with up to 3 books |
| Upgrade | Set stays locked; fork to add books | — |
| Premium ends | `read_only` subject to the retention policy (TT-14) | Same |
| Rights revoked or book ineligible | Set unchanged; book excluded from new turns, and exclusion disclosed | Same |
| Book removed from the catalogue | Metadata snapshot keeps history readable; the book never blocks deletion | Same |

Downgrade never deletes history. Tier and rights are re-evaluated at every turn.

**Account deletion (B-2)** is the exception that removes history: it is never blocked, and every session, session book, conversation, highlight conversation, and Brief of that user is deleted by `ON DELETE CASCADE` from `users(id)` (ADR-005). Existing deletion code is not changed.

### Source-scope isolation
Every **research-session** path to a model passes through a **Context Builder invariant**: all chunks, highlights, and notes must belong to a selected, currently eligible book. **Every other path to a model has its own declared context invariant** (Ask My Highlights uses the Highlight Context Builder invariant below); no path to a model may exist without a declared invariant and a test that proves it (B-3). A violation aborts the turn and raises an alert. Retrieval requires an explicit, non-empty allowed set. Planner and tool arguments are validated against it.

### Trust boundary (PO-028)

| Class | Rule |
|---|---|
| User-authored note | User-private; never attributed to a book |
| Saved quotation (`fragments.text`) | **An assertion, not evidence.** Client-supplied and editable. **In a session:** governed by the book's AI permissions as if publisher text, and citable as the book only if verified against source text. **In Ask My Highlights:** private to the owner; how book AI permissions apply is **open (TT-27)** |
| Publisher-controlled text | Selected book, entitlement, and rights required |
| Generated content | Labelled by origin; scoped to its session |

### Origin labels (extends ADR-003)
Answer segments carry one of `library`, `synthesis`, `broader`, or **`user_content`** (notes and unverified highlights). The last is added so a user's words are never attributed to an author. Exact labels and UX remain future decisions.

### Highlight intelligence — Ask My Highlights (PO-028, decided 2026-11-08)
A **separate path from research sessions**. It may **search and answer** over the requesting user's own saved highlights **across the whole personal library**, independently of the 3/10 limit (rules 2, 3).

- **Highlight Context Builder invariant:** context may contain only the **requesting user's own** highlight and note rows (mandatory `userId` predicate) and book metadata. It never contains chunks, stored book text, or other users' or household members' rows. A violation aborts the request and raises an alert. This is how rule 5 (no indirect route to full-book retrieval) is enforced.
- **No session side effects:** it cannot add a book to a session, and a session cannot read its conversations.
- **Own usage controls:** metered against its own capability budget (ADR-005); no values set here (rule 4).
- **Privacy:** highlights and highlight conversations are private to the individual account (rule 6); never cached across users.
- **Origins:** answers carry `user_content` for the user's words; a claim may be attributed to a book only through a verified citation.
- **Open:** book-permission treatment of saved-quotation text (TT-27); semantic search, which sends highlights to a provider for embedding (TT-25); provider disclosure in Terms before real user data reaches a provider (TT-22); quotation thresholds (TT-13). Reconstruction safeguards (ADR-002) apply.

*Revision 1 text, superseded:* "Lexical search over the requesting user's own rows… It involves no model, no provider, no chunks, and no book text." Superseded by PO-028 rule 2 (answers permitted).

### Rights (PO-029)
Default deny. Eligibility requires an authoritative record for the exact text version. `isFree`, `pendingRights`, sync quality, `uploadedById`, and catalogue visibility are never evidence.

### Research Brief
A Research Brief is a **structured, versioned, immutable, user-private record of a research session** (three-tier [03 §6](../three-tier-intelligence/03-research-architecture.md#6-research-brief)).

- **Derived from a session, never standalone.** It requires at least one completed analysis turn and uses only that session's content and citations; there is no one-shot Brief endpoint. It does not replace the interactive conversation.
- **Scope is the session's scope.** It inherits the locked book set, the Context Builder invariant, origin labels, and rights as of each turn; excluded books and operations appear in a system-generated **limitations** section.
- **Immutable versions.** Regenerating creates a new version and uses budget; viewing or exporting a stored version uses no AI and no budget.
- **Excerpts only, private storage.** No full-text export; stored privately (never the public `images` bucket); no household or cross-user visibility.
- **Open:** export formats and sharing (TT-17); depth sections for NoetiaX (TT-07, TT-08); retention after cancellation or rights revocation (TT-14); quotation thresholds (TT-13).

## Consequences
**Positive:** limits are enforceable at several layers; exact vector search stays bounded; no route from highlights to book text; provenance holds.
**Negative:** forks lose context by default; a saved quotation needs verification before citation; locked sets add a little friction; most existing titles are ineligible until backfilled.

## Guardrails
- Mandatory concurrency tests: parallel adds at the limit; add versus first turn; parallel first turns; downgrade during an active turn.
- `fragments` is not altered, and reader paths do not call this context.
- Reconstruction safeguards (ADR-002) apply across sessions and exports.

## Alternatives considered
- **jsonb `sourceRefs` (NEM-003 `09`) — rejected:** cannot enforce limits under concurrency.
- **Editable set with a running count — rejected by PO-027.**
- **Always copy history to a fork — rejected:** carries excluded books' analysis across the limit.
- **Treat `fragments.text` as trusted — rejected:** it can be any client-supplied text.
- **A fourth "Selected Books" mode — rejected:** scope and source mode are different questions.

## Open (subordinate) decisions
~~Generation over highlights outside a session (TT-24)~~ resolved by PO-028 rule 2 · saved-quotation permissions in highlight answers (TT-27) · semantic highlight search and tier placement (TT-25) · eligible corpus and evidence standard (TT-12, TT-26) · Brief formats and sharing (TT-17) · retention (TT-14) · quotation thresholds (TT-13).

## Revision history
| Rev | Date | Change |
|---|---|---|
| 1 | 2026-11-06 | Drafted under SA-002-T0 from preliminary rulings |
| 2 | 2026-11-08 | Reconciled with decided PO-027 (public-domain books count; selection without library; eligibility independent of ownership; server-side) and PO-028 (Ask My Highlights search and answers across the library with its own controls; highlight Context Builder invariant). Research Brief section added (PO-030 rule 4). Still **Proposed** |
| 3 | 2026-11-08 | Review corrections (PR #41): **B-3** Context Builder invariant scoped to research sessions, with declared invariants for every other model path; **B-4** eligibility = rights verification AND access basis; **B-5** turn order and failure effects; **B-2** account deletion. Still **Proposed**. PO-027 and PO-028 unchanged |

## Legal note
Product and architecture policy, not legal advice.
