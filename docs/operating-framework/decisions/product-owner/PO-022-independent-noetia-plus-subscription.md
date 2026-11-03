# PO-022 — Independent Noetia+ Subscription

**Status:** `DECIDED` · **Domain:** Business, Billing, AI services · **Authority:** Product Owner
**Date:** 2026-10-29 · **Source:** Product Owner decision H2
**Resolves:** decision H2 of the 2026-10-29 subscription audit (Model A / B / C) — independent offering
**Implementation:** `NOT IMPLEMENTED` — the schema allows one subscription per user (`uq_subscriptions_user`); see the [impact assessment](../../../architecture/impact-assessments/PO-021-023-acquisition-and-noetia-plus.md)

---

## Decision

Noetia+ is a **separate, independently purchasable subscription** for premium platform services. Noetia+:

- has its **own subscription entitlement**;
- is purchasable **independently** of the Individual, Duo, and Family book-token plans;
- does **not** require a book-token subscription;
- does **not** unlock paid books;
- is **not** required to access previously acquired books;
- has its **own** billing lifecycle, pricing, and cancellation handling;
- preserves customer-owned books, notes, highlights, bookmarks, and saved fragments after cancellation.

## Economic separation (normative)

- Noetia+ revenue is **separately identifiable** in financial accounting.
- Noetia+ revenue is **not** assumed to carry the book-acquisition creator allocation ([PO-007](PO-007-canonical-revenue-allocation.md)). Any creator participation in Noetia+ revenue requires its own decision.
- Noetia+ revenue never enters the token gross-value basis ([PO-010](PO-010-token-gross-value-basis.md)).
- `BOOK TOKEN ≠ AI USAGE` ([PO-001](../../../noetia-plus/PRODUCT-DECISIONS.md)) is unchanged: Noetia+ usage never consumes book tokens.

## Pending — not decided here

Premium feature catalogue · AI usage limits · price · trial policy · household sharing rules · whether Causas Noetia and Marketing payment-level allocations ([PO-011](PO-011-causas-recognition-basis.md), [PO-012](PO-012-marketing-and-breakage-treatment.md)) apply to Noetia+ payments.

## Implementation boundary

No Stripe products, prices, migrations, or production changes until a mission is approved and the pending items above that it depends on are decided.

## Related

[PO-021](PO-021-token-based-book-acquisition.md) · [PO-023](PO-023-subscription-free-book-acquisition.md) · [PO-001 … PO-004](../../../noetia-plus/PRODUCT-DECISIONS.md) · NEM-003 [`08-entitlements-and-subscription.md`](../../../noetia-plus/08-entitlements-and-subscription.md)
