# Noetia — Commerce Decisions (subscriptions, tokens, currency)

Durable record of **Product Owner decisions** on Noetia's commercial model: subscriptions, trials, tokens and currency. Implementation missions treat these as **authoritative product policy**: they may not reinterpret them, and any change requires a new, explicit PO decision.

- **Scope:** the basic Noetia subscription and its tokens. Noetia+ decisions live in [`docs/noetia-plus/PRODUCT-DECISIONS.md`](../noetia-plus/PRODUCT-DECISIONS.md). Locked pricing, revenue split and token rules predate this register and are documented in the business plan ([`docs/business/`](../business/)).
- **Decision IDs:** the PO has not assigned decision numbers. Entries are named descriptively until it does.
- **Not legal advice:** customer-facing wording that depends on these decisions still goes through the Terms review (OP-3).

---

## T-1: initial cycle of tokens when the free trial begins

| | |
|---|---|
| **Decision** | When a valid **14-day free trial** begins, the subscriber receives the plan's **first cycle of tokens** (`tokensPerCycle`: Individual 1, Duo 2, Family 4, per the seeded plans). |
| **Decided by** | Product Owner; communicated in the PA review of PR #60 (reviewed head `220e33d`), **2026-11-13** |
| **Status** | **Final.** The T-2 alternative (tokens only after the first paid invoice) was **not** chosen. Re-opening it requires a new PO request. |
| **Implemented in** | PR #60 (Draft, stacked on PR #59), `services/api/src/subscriptions/subscriptions.service.ts` (`issueTrialStartTokens`, `applyStripeSubscription`) and `webhooks.service.ts` (`handleInvoicePaid`). Report: `docs/reports/payment-lifecycle-20261112/README.md` §11. **Not merged or deployed.** |

**Product rules that follow:**
1. **Once per trial subscription.** The initial cycle is granted exactly once per Stripe subscription, whichever webhook arrives first: subscription created, Checkout completed, subscription updated, or the $0 trial invoice.
2. **No second initial grant.** The $0 trial invoice, and any other $0 invoice, grants no cycle.
3. **Normal issuance continues.** The **first paid invoice** (day 15) grants the normal cycle, and so does each later paid invoice. Annual plans begin their monthly schedule from the first **paid** annual invoice. The trial never starts, shifts or adds a scheduled cycle.
4. **Unchanged:** paid-token **90-day** expiry, token quantities, **permanent ownership** of redeemed books, and cancellation behaviour. A trial cancelled before payment keeps its initial tokens and any books already redeemed; nothing is clawed back.
5. **Never from the browser.** Tokens are granted from verified Stripe webhooks only, never from a browser redirect or the success page.
6. **No pricing change.** Trial duration (14 days), prices and financial economics are unchanged by this decision.

**Known exposures (accepted with T-1, follow-ups recommended):**
- **Repeat trials.** Every new subscription Checkout currently includes a 14-day trial, so a returning customer can start another trial and receive another initial cycle. A trial-eligibility rule (for example, one trial per customer) is a separate product decision; see report §11.6.
- **Cost of a cancelled trial.** Each trial cancelled before payment costs up to one cycle of tokens, plus whatever per-redemption payout rule applies to an unpaid redemption.

**Customer disclosure (draft, for `/pricing` and the Terms; legal review OP-3):**
- EN: *"Your 14-day free trial includes {n} token(s). Books you redeem are yours to keep, even if you cancel during the trial."*
- ES: *"Tu prueba gratuita de 14 días incluye {n} token(s). Los libros que canjees son tuyos para siempre, aunque canceles durante la prueba."*

---

## USD as Noetia's commercial and financial currency

| | |
|---|---|
| **Decision** | **USD** is Noetia's commercial and financial currency: what customers are charged, what prices are expressed in, and what financial accounting uses. |
| **Decided by** | Product Owner; communicated in the PA review of PR #60, **2026-11-13** |
| **Status** | **Final.** |

**Product rules that follow:**
1. **Charges in USD.** Every Stripe price and every ad-hoc Checkout amount is in **USD**.
2. **Explicitly marked.** Every customer-facing price is marked as US dollars (`US$8.99`, or `$8.99 USD` in legal text), in both languages. A bare `$` is not allowed, because in much of Latin America it reads as the local peso. Web uses `services/web/lib/currency.ts` (`formatUsd`).
3. **Amounts unchanged.** Stored amounts (`amountCents`) are integer **US cents**. This decision doesn't change any amount.

**Verification status (2026-11-13, PR #60 report §11.4):**

| Item | Status |
|---|---|
| Gift and book Checkout amounts (`currency: 'usd'` in code) | **Verified in code** |
| Subscription plan prices and token-package prices (Stripe Price objects referenced by ID) | **PENDING.** Currency is set in Stripe and could not be verified from the available environment (no Stripe access). The PO should confirm in the Stripe Dashboard that every referenced price is `usd`. |
| Web pricing, gift and token displays; pricing metadata; mobile paywall | **Marked as US$** (PR #60) |
| Terms of Service | Already state `USD` explicitly. The annual figures are pending the separate legal-gated PR #22 |
