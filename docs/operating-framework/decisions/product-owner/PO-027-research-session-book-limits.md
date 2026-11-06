# PO-027 — Research Session Book Limits

**Status:** `DRAFT — NOT DECIDED`. Records preliminary ruling TT-04. Becomes `DECIDED` only when the Product Owner accepts this text.
**Domain:** Product, AI services · **Authority:** Product Owner
**Date:** 2026-11-06 · **Source:** T0 ruling TT-04
**Implementation:** `NOT IMPLEMENTED`

---

## Decision (proposed text)

1. Noetia+ supports a maximum of **3** selected books per analysis session.
2. NoetiaX supports a maximum of **10** selected books per analysis session.
3. The selected book set **locks at the first analysis turn**.
4. Changing the selection requires a **new or forked session**.

## Engineering requirements derived from this ruling

These are proposed for architecture review ([ADR-006](../../../architecture/adr/ADR-006-research-sessions-book-limits-and-source-scope.md)). They are not separate product decisions.

- Limits are enforced server-side. A client cannot supply or raise a limit.
- Concurrent requests cannot exceed a limit or change a locked set.
- A downgrade never deletes session history.

## Pending — not decided here

Retention after cancellation (TT-14) · whether monthly session counts exist (TT-06) · budget values (TT-09).

## Implementation boundary

Authorizes no implementation.
