# PO-022 / PO-023 Amendments — Noetia+ Subscription Dependency

**Direction:** `APPROVED by the Product Owner (2026-10-30)` · **Amendment text:** `DRAFT — awaiting Product Owner review before it is applied to the records`
**Prepared for:** Product Owner review · **Related:** [`noetia-plus-unit-economics.md`](noetia-plus-unit-economics.md) §0, §9 · PR #18

> The Product Owner has approved the product direction recorded below. The PO-022 and PO-023 record files (PR #12, unmerged) are **not modified** by this document. On approval of the wording, each amendment would be appended to its record as "Amendment 1", following the PO-021 Amendment 1 pattern. Nothing here is decided by inference: every item not in the approved decision is listed as **pending**.

---

## Approved decision (Product Owner, 2026-10-30, verbatim)

> Noetia+ is a premium add-on that requires an active basic Noetia subscription.
>
> The basic subscription is the prerequisite for Noetia+ eligibility.
>
> Noetia+ cannot be purchased or maintained as a standalone premium subscription by a free account or a customer who only purchases token packages.
>
> Cancellation of Noetia+ must not cancel the basic subscription.
>
> When the basic subscription ends, Noetia+ entitlement must also end. Detailed billing, refunds, grace periods, and cancellation synchronization remain subject to further Product Owner decisions.

Approved documentation constraints from the same instruction: preserve the distinction between basic-subscription revenue and Noetia+ premium-service revenue; preserve permanent ownership of acquired books and existing token rights; keep the $6.00 Noetia+ price and the 10% Causas/Marketing treatment as **planning assumptions only**.

---

## PO-022 Amendment 1 — Noetia+ as a premium add-on (draft wording)

**Title change (proposed):** "Independent Noetia+ Subscription" → "Noetia+ Premium Add-on"

### Replaces in "Decision"

| Current text | Amended text | Basis |
|---|---|---|
| Noetia+ is a **separate, independently purchasable subscription** for premium platform services | Noetia+ is a **premium add-on** for premium platform services that **requires an active basic Noetia subscription**. The basic subscription is the prerequisite for Noetia+ eligibility | Approved |
| is purchasable **independently** of the Individual, Duo, and Family book-token plans | **cannot be purchased or maintained as a standalone premium subscription** by a free account or by a customer who only purchases token packages | Approved |
| does **not** require a book-token subscription | *(deleted)* | Approved |
| has its **own subscription entitlement** | has its **own entitlement**, which **ends when the basic subscription ends** | Approved |
| has its **own** billing lifecycle, pricing, and cancellation handling | has its **own pricing**. **Cancelling Noetia+ does not cancel the basic subscription.** Billing, refunds, grace periods, and cancellation synchronization are **pending** (below) | Approved + pending |

### Unchanged (restated)

- Noetia+ does **not** unlock paid books and is **not** required to access acquired books.
- Customer-owned books, notes, highlights, bookmarks, and saved fragments are preserved after any cancellation — of Noetia+ or of the basic subscription.
- **Existing token rights are unaffected:** tokens already issued keep their expiry, redemption, and gifting rules (PO-024) regardless of Noetia+ status; Noetia+ never consumes or grants book tokens.
- **Economic separation (normative):** Noetia+ revenue is separately identifiable from basic-subscription revenue; no creator allocation is assumed; Noetia+ revenue never enters the PO-010 token basis; `BOOK TOKEN ≠ AI USAGE`.

### Pending — not decided by this amendment

| Item | Note |
|---|---|
| Which plans qualify as "basic subscription" | Individual clearly; **Duo/Family owners and linked members** undetermined |
| Which subscription states count as "active" | e.g. `trialing`, scheduled-to-cancel, `past_due` |
| Timing of Noetia+ end | Same instant / same period end as the basic plan |
| Grace period and behaviour while the basic plan is past due | Suspend, continue, or end |
| Billing structure | One Stripe subscription with two line items vs two subscriptions; interval matching |
| Refunds / credits | When the basic plan ends during a paid Noetia+ period, including annual |
| Price, annual offering, trial, AI usage limits | $6.00 is a **planning assumption** only |
| Causas / Marketing on Noetia+ | 10% modelled as a **planning assumption** only; not decided (PO-011/PO-012 unchanged) |
| Treatment of discounts spanning both lines | PO-013 applies; allocation rule undecided |

---

## PO-023 Amendment 1 — Noetia+ removed from the subscription-free path (draft wording)

| Rule | Current text | Amended text | Basis |
|---|---|---|---|
| 6 | Individual, Duo, Family, and Noetia+ subscriptions are **optional** | Individual, Duo, and Family subscriptions are **optional**. Noetia+ is an optional add-on available **only with an active basic subscription** (PO-022 Amendment 1) | Approved |
| 7 | Customers may subscribe to **Noetia+ without** a book-token plan | **Deleted.** Free accounts and customers who only purchase token packages **cannot purchase or maintain** Noetia+ | Approved |
| 8 | A customer may hold Noetia+ and a book-token subscription simultaneously, with **independent** entitlements and cancellation behaviour | A customer with an active basic subscription may add Noetia+. **Cancelling Noetia+ does not cancel the basic subscription.** When the basic subscription ends, **Noetia+ entitlement ends**. Synchronization details are pending (PO-022 Amendment 1) | Approved + pending |

**Consequences (replaces the first bullet):** a user can be in any combination of free account · basic subscription · basic subscription + Noetia+ · owned books. Noetia+ requires a basic subscription; owned books never require anything.

**Unchanged:** rules 1–5 — free accounts, token-package purchase, redemption, permanent ownership, and ownership-based access. Token-package revenue remains a first-class acquisition channel.

---

## Conflicts with other records (to reconcile when the amendments are applied)

| # | Document | Conflict |
|---|---|---|
| C-1 | **PO-022** (PR #12) | "Separate, independently purchasable"; "does not require a book-token subscription"; independent lifecycle → resolved by Amendment 1 once applied |
| C-2 | **PO-023** rules 6–8 and "Consequences" (PR #12) | Noetia+ without a book plan; independent entitlements → resolved by Amendment 1 once applied |
| C-3 | `docs/noetia-plus/PRODUCT-DECISIONS.md` "Later decisions" (PR #12) | Summarises PO-022 as "separate, independently purchasable"; PO-023 as "all subscriptions are optional and may be held together" |
| C-4 | PO-021–023 impact assessment (PR #12) | Titles and analyses "Independent Noetia+"; recommends **two separate Stripe subscriptions** *because of* independence — basis no longer holds; structure is now pending |
| C-5 | NEM-003 `08-entitlements-and-subscription.md` (`main`) | Calls ownership and Noetia+ "orthogonal" (still true for **books**); entitlement resolution checks only the Noetia+ subscription status — must also require the basic subscription |
| C-6 | Terms of Service | Silent on the dependency; Causas promised on "every payment" (relevant to the 10% planning assumption) — legal review |
| — | PO-021, PO-024, PO-007, PO-010–PO-013 | **No conflict.** Book ownership, token rights, and allocation rules are untouched |
