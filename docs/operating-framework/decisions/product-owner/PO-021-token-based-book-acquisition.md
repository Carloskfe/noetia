# PO-021 — Token-Based Book Acquisition

**Status:** `DECIDED` · **Domain:** Business, Rights, Access control · **Authority:** Product Owner
**Date:** 2026-10-29 · **Source:** Product Owner decision H1
**Resolves:** audit finding G4 (subscription granted all-access streaming) and decision H1 of the 2026-10-29 subscription audit
**Implementation:** `NOT IMPLEMENTED` — current code grants full paid-book access to any active subscriber; see the [impact assessment](../../../architecture/impact-assessments/PO-021-023-acquisition-and-noetia-plus.md)
**Amended:** 2026-10-29 by Product Owner decision **B-1** — strictly token-based acquisition (§Amendment 1)

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

## Amendment 1 — Strictly token-based acquisition (B-1, 2026-10-29)

`DECIDED` · Product Owner · resolves impact-assessment conflict **C-06**.

1. Paid books can be acquired **only through successful token redemption**.
2. **Direct per-title purchase is discontinued** as a future acquisition method. The PRD "Pay-per-Title" model is `SUPERSEDED BY PO-021 Amendment 1`.
3. Customers can obtain tokens **independently of subscriptions** (token packages, gift cards — [PO-023](PO-023-subscription-free-book-acquisition.md)).
4. **Existing legitimate purchases and permanent ownership entitlements remain intact.** A `user_books` row with `purchaseType = 'purchase'` is full, permanent ownership, exactly like a token acquisition. Nothing is migrated, converted, or revoked.
5. `POST /subscriptions/books/:bookId/purchase` is **retired through a separately approved engineering mission** — not disabled immediately. Until then it stays deployed; its fulfilment path must keep honouring any Checkout Session created before retirement.

Normative rule after Amendment 1:

```
paid-book acquisition  =  successful token redemption           (only path, from retirement onward)
paid-book ownership    =  any user_books row (token | purchase | courtesy | legacy)   (all permanent)
```

## Open — not decided here

- ~~Direct per-title purchase~~ — **resolved by Amendment 1.**
- Settlement treatment of **historical** direct purchases (gross value basis = the amount actually paid, recorded only in Stripe) — `ACCOUNTING REVIEW REQUIRED`; see the impact assessment §2 C-06 and §7.
- Free-sample specification (length, narration, rights permissions).
- Household access to other members' acquisitions.
- Transition for current subscribers who read non-owned books under the old behaviour.

## Implementation boundary

Implementation requires an approved engineering mission. The P0 mission **NEM-011** (acquisition bypass + atomic redemption) is unchanged by this decision and is not expanded into it.

## Related

[PO-022](PO-022-independent-noetia-plus-subscription.md) · [PO-023](PO-023-subscription-free-book-acquisition.md) · [PO-007](PO-007-canonical-revenue-allocation.md) · [PO-008](PO-008-creator-obligation-accrual.md) · [ADR-002](../../../architecture/adr/ADR-002-permission-aware-content-intelligence.md)
