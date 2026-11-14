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

---

## D1–D6: subscription policy (approved 2026-11-13)

| | |
|---|---|
| **Decided by** | Product Owner, "PO AUTHORIZATION: D1–D6 SUBSCRIPTION POLICY IMPLEMENTATION", baseline `1be3f48`, **2026-11-13** |
| **Status** | **Final.** A change needs an explicit new PO decision. |
| **Implemented in** | PR #60 (Draft, stacked on PR #59): `services/api/src/subscriptions/{subscriptions.service,webhooks.service,billing-cycles,stripe-fulfillment-ledger}.ts`, web `/pricing`, mobile paywall. Report §13. **Not merged or deployed.** |

### D1: one trial per eligible customer
- **One 14-day trial per eligible customer.** A customer who has already received a subscription trial does not get another. A returning subscriber may buy a new subscription, **without** a trial.
- **T-1 tokens are granted only when an eligible trial actually begins:** Stripe reports the subscription as trialing.
- **Nothing is clawed back:** trial tokens already granted and books already redeemed are kept.
- **Linked Duo/Family members** who never held their own subscription remain eligible when they subscribe on their own.
- **Gift and token-package purchases** alone do not use up eligibility.
- **Evidence used:** existing data only.
  - the Noetia account's subscription history;
  - the full history (canceled included) of every Stripe customer known for the account;
  - other Stripe customers registered under the **account e-mail**.

  There is no fingerprinting, no device or payment-card tracking, and no new personal data.
- **Fail safe:** if the history can't be verified, checkout returns 503 and **never charges unexpectedly**. The pricing page then doesn't mention a trial.
- **Known limit, no claim of perfect identification:** someone who deletes their account and signs up again with a **different e-mail**, or with different capitalization (e-mails aren't normalized at registration), isn't recognized. Closing that gap would need a new persistent identity mechanism, which isn't proposed.

#### D1 clarification: F-01 Option B, the returning-subscriber rule (PO, 2026-11-13, final)

Resolves the F-01 ambiguity raised in the PR #60 report §14.B. **Final product policy:** it may not be reopened or reinterpreted without a new explicit PO decision.

- **Rule:** a customer who has **previously started a subscription** is **not eligible** for another free trial. This covers:
  - previous free-trial subscribers;
  - previous **paid subscribers who never received a trial**;
  - previously started subscriptions that were **canceled before activation**.
- **Exception kept:** a subscription that expired as **`incomplete_expired`** without ever starting does **not** use up eligibility.
- **Still eligible:**
  - customers who only bought **books, gifts or token packages** (one-time payments, not subscriptions);
  - linked **Duo/Family members** with no subscription history of their own.
- **Unverifiable history:** the existing fail-closed behaviour applies. No checkout (503), never an unexpected charge, and no trial advertised.
- **Evidence used:** only existing subscription history, the Noetia account's own subscription record and the Stripe customers' subscription history. **No new identity-tracking mechanism is authorized.** The known limit above (an account recreated under a different e-mail) still stands.
- **No production code change is required.** The implementation at PR #60 head `aac79ef` already applies this rule:
  - `billing-cycles.ts subscriptionEverStarted`: any subscription other than `incomplete_expired` counts as started;
  - the own-subscription check in `subscriptions.service.ts`.

  The F-01 matrix tests in `subscriptions.service.spec.ts` pin it.

### D2: exactly 12 paid annual allocations
- **12 paid allocations per annual billing period.**
  - The paid annual invoice gives allocation 1.
  - The other 11 fall on **UTC calendar-month anniversaries** within that paid period, anchored to Stripe's billing anchor. Month-end anchors are clamped: Jan 31 → Feb 28/29, Feb 29 → Mar 29.
  - Daylight-saving time doesn't affect them.
- **The T-1 trial allocation is additional,** for eligible new subscribers.
- **Never early:** no allocation from the next annual period is granted before that period begins. Quantities and the 90-day expiry are unchanged.

### D3: cancellation preserves paid entitlements
- **Cancelled at period end** (`canceling`): renewal stops, but scheduled allocations continue until the paid period expires, and none come after.
- **Immediate termination, failed payment (`past_due`), and cancellation during an unpaid trial:** no further allocations.

### D4: no extra tokens from mid-cycle upgrades
- `subscription_update` and proration invoices never produce a token cycle. The new plan's entitlement applies from the next eligible billing cycle.
- The Stripe portal configuration is unchanged. **Verifying it** (proration and effective dates against the Terms' "plan changes take effect at the start of the next billing cycle") is **pending PO verification in the Stripe Dashboard**. Any change goes to separate approval.

### D5: valid $0 renewals
- A legitimate `subscription_cycle` invoice of **$0** still grants the normal cycle.
- **Grant:** renewals and paid creations without a trial.
- **No grant:**
  - the trial's $0 creation invoice (T-1 covers the trial);
  - plan changes and prorations;
  - manual and unrelated invoices.
- **Once per billing period,** enforced by the transactional ledger, so duplicate and reissued invoices grant once.
- No discount program is introduced.

### D6: bilingual disclosures
- English and Spanish copy covers:
  - first-time eligible customers;
  - returning subscribers without a trial;
  - the initial tokens included in the trial;
  - permanent ownership of books redeemed during the trial;
  - renewal and cancellation behaviour.
- **A trial is never advertised to a returning customer.** When eligibility can't be confirmed, no trial is mentioned.
- **App copy** is updated on `/pricing` and the mobile paywall.
- **Terms and Privacy Policy are not modified;** legal approval is required. Proposed Terms wording is in report §13.6.

