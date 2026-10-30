# DRAFT — Proposed Amendments to PO-022 and PO-023 (Noetia+ Subscription Dependency)

**Status:** `PROPOSED — NOT APPROVED` · **Date:** 2026-10-30 · **Prepared for:** Product Owner review
**Source:** Product Owner working requirement W-1 ("Noetia+ is a premium platform add-on requiring an active basic subscription"), see [`noetia-plus-unit-economics.md`](noetia-plus-unit-economics.md) §0 and §9.

> These drafts do **not** modify the approved records. PO-022 and PO-023 remain in force as written (PR #12) until the Product Owner explicitly approves an amendment. On approval, each amendment would be appended to its record as "Amendment 1", following the PO-021 Amendment 1 pattern.

---

## Proposed PO-022 Amendment 1 — Noetia+ as a dependent add-on

**Title change (proposed):** "Independent Noetia+ Subscription" → "Noetia+ Premium Add-on"

### Replaces in "Decision"

| Current text | Proposed text |
|---|---|
| Noetia+ is a **separate, independently purchasable subscription** for premium platform services | Noetia+ is a **premium platform add-on** that **requires an active basic subscription** (Individual; Duo/Family eligibility per a separate decision) |
| has its **own subscription entitlement** | has its **own entitlement**, granted only while the basic subscription is entitled (`active`, `trialing`, or scheduled to cancel) **and** the Noetia+ item is active |
| is purchasable **independently** of the Individual, Duo, and Family book-token plans | is purchasable **only by** customers holding an eligible basic subscription |
| does **not** require a book-token subscription | *(deleted)* |
| has its **own** billing lifecycle, pricing, and cancellation handling | has its **own price**; its billing interval **matches** the basic subscription; it can be cancelled on its own; it **ends when the basic subscription ends**; its entitlement is **suspended** while the basic subscription is past due |

### Unchanged (restated for clarity)

- Noetia+ does **not** unlock paid books and is **not** required to access acquired books.
- Customer-owned books, notes, highlights, bookmarks, and saved fragments are preserved after any cancellation.
- **Economic separation (normative)** is unchanged: Noetia+ revenue is separately identifiable; no creator allocation assumed; never in the PO-010 token basis; `BOOK TOKEN ≠ AI USAGE`.

### Added

- **Billing structure (proposed, pending Q-E14):** basic and Noetia+ are billed as separate line items with separate prices, so token valuation and Noetia+ revenue remain separately attributable.
- **Discounts:** a promotion covering both lines must define its token allocation before activation, or the basic line's tokens are excluded from creator processing ([PO-013](../decisions/product-owner/PO-013-discount-attribution.md)).

### Still pending — not decided by this amendment

Price · annual offering · refund/credit when the basic plan ends mid-period · billing during `past_due` · Duo/Family eligibility · AI usage limits · **whether Causas and Marketing apply to Noetia+** (modelled at 10% as a planning assumption only; not decided here).

---

## Proposed PO-023 Amendment 1 — Noetia+ removed from the subscription-free path

### Replaces

| Rule | Current text | Proposed text |
|---|---|---|
| 6 | Individual, Duo, Family, and Noetia+ subscriptions are **optional** | Individual, Duo, and Family subscriptions are **optional**. Noetia+ is an optional add-on **available only with** an eligible basic subscription (PO-022 Amendment 1) |
| 7 | Customers may subscribe to **Noetia+ without** a book-token plan | **Deleted.** Free accounts and token-package-only customers cannot purchase Noetia+ |
| 8 | A customer may hold Noetia+ and a book-token subscription simultaneously, with **independent** entitlements and cancellation behaviour | A customer holding a basic subscription may add Noetia+. Cancelling Noetia+ does not affect the basic subscription; ending the basic subscription **ends Noetia+** at the same period end |

### Consequences (replaces first bullet)

A user can be in any combination of: free account · book-token plan · book-token plan + Noetia+ · owned books. Noetia+ requires a book-token plan; owned books never require anything.

### Unchanged

Rules 1–5: free accounts, token-package purchase, redemption, permanent ownership, and ownership-based access. Token-package revenue remains a first-class acquisition channel.

---

## Impact if approved (summary)

- Supersedes the PO-021–023 impact assessment's recommendation of two separate Stripe subscriptions; revisit in favour of one subscription with two items.
- Requires Terms of Service changes (dependency, cascade cancellation, refunds).
- Requires an implementation mission: per-item entitlements, cascade cancellation, multi-line webhook handling (today `webhooks.service.ts` reads only the first item and line).
- No change to PO-007, PO-010, PO-011, PO-012, PO-013, PO-021, or PO-024.
