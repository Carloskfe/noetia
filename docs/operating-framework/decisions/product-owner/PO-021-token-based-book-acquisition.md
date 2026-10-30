# PO-021 — Token-Based Book Acquisition

**Status:** `DECIDED` · **Domain:** Business, Rights, Access control · **Authority:** Product Owner
**Date:** 2026-10-29 · **Source:** Product Owner decision H1
**Resolves:** audit finding G4 (subscription granted all-access streaming) and decision H1 of the 2026-10-29 subscription audit
**Implementation:** `NOT IMPLEMENTED` — current code grants full paid-book access to any active subscriber; see the [impact assessment](../../../architecture/impact-assessments/PO-021-023-acquisition-and-noetia-plus.md)

---

## Decision

**Noetia is not an unlimited-access book streaming platform.** For paid books:

1. Users may discover books and access authorized free samples.
2. Full book access requires successful acquisition using a token.
3. Users may redeem an available token or purchase additional tokens.
4. An active Individual, Duo, or Family subscription does **not** automatically unlock books the user has not acquired.
5. Full reading and associated narration access is restricted to users with a valid **ownership entitlement**.
6. Once acquired, a book remains available in the user's personal library after subscription cancellation, subject to applicable licensing rights.
7. Free books remain accessible according to their existing free-content rules.

Free samples are a **conversion mechanism**. Sample length, narration availability, and publisher / rights-holder permissions are **not yet specified**.

## Access rule (normative)

```
full content access(user, book) =
      book is free (existing free-content rules)
   OR user holds an ownership entitlement for book (user_books)
   [OR the requested range is an authorized sample — once sample rules exist]
```

Subscription status — active, trialing, canceling, past due, canceled, or none — is **not** an input to full-content access.

## Consequences

- Every paid-book read is an acquisition, so every qualifying paid read maps to a creator obligation under [PO-007](PO-007-canonical-revenue-allocation.md) / [PO-008](PO-008-creator-obligation-accrual.md). Streaming reads with no creator obligation (audit G4) cease to exist once implemented.
- Subscriptions monetize token allowances and services, never catalogue access.

## Open — not decided here

- **Direct per-title purchase ("Pay-per-Title")** — defined in `docs/PRD.md` and implemented (`POST /subscriptions/books/:bookId/purchase`). This decision names tokens as the acquisition route and does not say whether per-title purchase remains. `CONFLICT — PO RULING REQUIRED` (impact assessment C-06).
- Free-sample specification (length, narration, rights permissions).
- Household access to other members' acquisitions.
- Transition for current subscribers who read non-owned books under the old behaviour.

## Implementation boundary

Implementation requires an approved engineering mission. The P0 mission **NEM-011** (acquisition bypass + atomic redemption) is unchanged by this decision and is not expanded into it.

## Related

[PO-022](PO-022-independent-noetia-plus-subscription.md) · [PO-023](PO-023-subscription-free-book-acquisition.md) · [PO-007](PO-007-canonical-revenue-allocation.md) · [PO-008](PO-008-creator-obligation-accrual.md) · [ADR-002](../../../architecture/adr/ADR-002-permission-aware-content-intelligence.md)
