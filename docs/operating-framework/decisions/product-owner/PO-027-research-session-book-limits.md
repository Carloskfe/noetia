# PO-027 — Research Session Book Limits

**Status:** `DECIDED` — approved by the Product Owner on 2026-11-08 as **TT-04**. Supersedes the 2026-11-06 preliminary text, preserved below.
**Domain:** Product, AI services, Rights · **Authority:** Product Owner
**Date:** 2026-11-08 (preliminary ruling 2026-11-06) · **Source:** TT-04
**Implementation:** `NOT IMPLEMENTED`

---

## Decision (approved text, 2026-11-08)

1. **Noetia+** supports a maximum of **three** books per research session.
2. **NoetiaX** supports a maximum of **ten** books per research session.
3. **Every selected book counts** toward the limit, including public-domain books.
4. **Verified, AI-eligible public-domain editions** may be selected **without first adding them** to the user's personal library.
5. The selected book set **becomes locked at the first analysis turn**.
6. Changing the book set requires a **new or forked** research session.
7. Limits must be **enforced server-side**.
8. Copyright and edition eligibility must be **verified independently of book ownership**.

## Consequences for architecture (for review in [ADR-006](../../../architecture/adr/ADR-006-research-sessions-book-limits-and-source-scope.md))

- A client cannot supply or raise a limit; concurrent requests cannot exceed a limit or change a locked set.
- Ownership never makes a book AI-eligible, and lack of ownership never blocks a **verified** public-domain edition (rules 4, 8). Which editions are verified is governed by rights verification, still open (TT-12, TT-26).
- A downgrade never deletes session history (ADR-006 draft).

## Not decided by this record

Retention after cancellation (TT-14) · monthly session counts (TT-06) · budget values (TT-09) · the eligible launch corpus and evidence standard (TT-12, TT-26).

## Implementation boundary

Authorizes no implementation.

---

## Historical: preliminary text of 2026-11-06 (superseded, preserved unchanged)

**Status:** `DRAFT — NOT DECIDED`. Records preliminary ruling TT-04. Becomes `DECIDED` only when the Product Owner accepts this text.
**Domain:** Product, AI services · **Authority:** Product Owner
**Date:** 2026-11-06 · **Source:** T0 ruling TT-04
**Implementation:** `NOT IMPLEMENTED`

---

### Decision (proposed text)

1. Noetia+ supports a maximum of **3** selected books per analysis session.
2. NoetiaX supports a maximum of **10** selected books per analysis session.
3. The selected book set **locks at the first analysis turn**.
4. Changing the selection requires a **new or forked session**.

### Engineering requirements derived from this ruling

These are proposed for architecture review ([ADR-006](../../../architecture/adr/ADR-006-research-sessions-book-limits-and-source-scope.md)). They are not separate product decisions.

- Limits are enforced server-side. A client cannot supply or raise a limit.
- Concurrent requests cannot exceed a limit or change a locked set.
- A downgrade never deletes session history.

### Pending — not decided here

Retention after cancellation (TT-14) · whether monthly session counts exist (TT-06) · budget values (TT-09).

### Implementation boundary

Authorizes no implementation.
