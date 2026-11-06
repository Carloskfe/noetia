# ADR-006 — Research Sessions, Selected-Book Limits, Forking, and Source-Scope Isolation

- **Status:** Proposed (draft; not accepted)
- **Date:** 2026-11-06 (SA-002-T0)
- **Decided by:** pending: Product Owner (PO-027, PO-028, PO-029) + Product Architecture
- **Relates:** extends ADR-002, ADR-003, ADR-004 without altering their decisions; NEM-003 remains historical design.

## Context
Noetia+ allows 3 selected books per analysis session, and NoetiaX 10. ADR-003 defines My Knowledge as the user's accumulated knowledge, which is broader than a session. A limit is meaningless if books can be rotated, if retrieval is unscoped, or if unselected content can reach the model through highlights, history, or planners.

## Decision

### Scope has two independent axes
**Source mode** (This Book, My Knowledge, Expand; ADR-003) and **session book set**. There is no fourth mode. In a session, My Knowledge means the selected books plus the user's own highlights and notes on those books.

### Session book set
- Stored in a normalized table, unique per session and position, with a database ceiling of position 1–10 at the highest approved limit. The tier limit comes from the resolver (ADR-005), never from a client.
- **Locks at the first accepted analysis turn.** A turn rejected in preflight does not lock. A provider failure after acceptance does.
- A locked set never changes. Changes create a new or forked session.

### Transaction safety
Selection changes and the lock each run in a short transaction holding a row lock on the session (`SELECT … FOR UPDATE`). Every turn reads the set and its hash after that lock. **No provider call happens while holding the lock.**

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

### Source-scope isolation
Every path to a model passes through a **Context Builder invariant**: all chunks, highlights, and notes must belong to a selected, currently eligible book. A violation aborts the turn and raises an alert. Retrieval requires an explicit, non-empty allowed set. Planner and tool arguments are validated against it.

### Trust boundary (PO-028)

| Class | Rule |
|---|---|
| User-authored note | User-private; never attributed to a book |
| Saved quotation (`fragments.text`) | **An assertion, not evidence.** Client-supplied and editable, so it is governed by the book's AI permissions as if publisher text, and is citable as the book only if verified against source text |
| Publisher-controlled text | Selected book, entitlement, and rights required |
| Generated content | Labelled by origin; scoped to its session |

### Origin labels (extends ADR-003)
Answer segments carry one of `library`, `synthesis`, `broader`, or **`user_content`** (notes and unverified highlights). The last is added so a user's words are never attributed to an author. Exact labels and UX remain future decisions.

### Highlight search exception (PO-028)
Lexical search over the requesting user's own rows, in PostgreSQL with a mandatory `userId` predicate. It is not placed in the shared Meilisearch index. It involves no model, no provider, no chunks, and no book text. It is separate from sessions and cannot add to one.

### Rights (PO-029)
Default deny. Eligibility requires an authoritative record for the exact text version. `isFree`, `pendingRights`, sync quality, `uploadedById`, and catalogue visibility are never evidence.

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
Generation over highlights outside a session (TT-24) · semantic highlight search and tier placement (TT-25) · retention (TT-14) · quotation thresholds (TT-13).

## Legal note
Product and architecture policy, not legal advice.
