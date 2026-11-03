# PO-023 — Subscription-Free Book Acquisition

**Status:** `DECIDED` · **Domain:** Business, Billing, Access control · **Authority:** Product Owner
**Date:** 2026-10-29 · **Source:** Product Owner decision H3
**Implementation:** `PARTIAL` — token purchase and API redemption work without a subscription; no UI redeems tokens, the mobile app is locked behind a subscription paywall, and the schema allows one subscription per user. See the [impact assessment](../../../architecture/impact-assessments/PO-021-023-acquisition-and-noetia-plus.md)

---

## Decision

1. Customers may create and keep a **free Noetia account** without a recurring subscription.
2. Free-account customers may **purchase token packages** independently.
3. Purchased tokens may be **redeemed** to acquire paid books.
4. Acquired books remain in the customer's personal library **without** an active subscription.
5. Full reading and narration access depends on **book ownership, not subscription status** ([PO-021](PO-021-token-based-book-acquisition.md)).
6. Individual, Duo, Family, and Noetia+ subscriptions are **optional**.
7. Customers may subscribe to **Noetia+ without** a book-token plan.
8. A customer may hold **Noetia+ and a book-token subscription simultaneously**, with independent entitlements and cancellation behaviour ([PO-022](PO-022-independent-noetia-plus-subscription.md)).

## Consequences

- A user can be in any combination of: free account · book-token plan · Noetia+ · owned books. None of these requires another, except that redeeming needs a token.
- Token-package revenue is a first-class acquisition channel, not a subscriber add-on; its gross value per token follows [PO-010](PO-010-token-gross-value-basis.md) §2.

## Pending — not decided here

Whether the 90-day paid-token expiry applies unchanged to tokens bought by free accounts (current code and Terms: yes, 90 days for all paid tokens).

## Related

[PO-021](PO-021-token-based-book-acquisition.md) · [PO-022](PO-022-independent-noetia-plus-subscription.md) · [PO-010](PO-010-token-gross-value-basis.md)
