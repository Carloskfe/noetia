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

---

## COMMERCE-W1-W2: financial protection for one-time purchases and paid-fulfillment exceptions (approved 2026-11-21)

| | |
|---|---|
| **Document ID** | COMMERCE-W1-W2 |
| **Decided by** | Product Owner. **FINAL approval, 2026-11-21** (mission COMMERCE-W1-W2-DOC) |
| **Status** | **Final.** Changing any of these rules requires a new explicit Product Owner decision. |
| **Scope** | Checkout safeguards related to subscriptions, one-time token-package purchases, individual book purchases, gifts, and paid-fulfillment exceptions |
| **Architecture reference** | PR60-I1 ([PR #60 comment](https://github.com/Carloskfe/noetia/pull/60#issuecomment-7065424483)) and PR60-I1-R1 ([PR #60 comment](https://github.com/Carloskfe/noetia/pull/60#issuecomment-7065619039)) |
| **Implemented in** | **Not implemented.** Approving these policies authorizes product policy only (see "What this approval does not authorize" below). |

This entry has three parts, kept deliberately separate:
- **Part A** is final PO policy.
- **Part B** is engineering design that is still pending Product Architecture review and is not policy.
- **Part C** lists the prerequisites for the financial launch.

### Part A: final Product Owner policies

#### W1-PO-1: original purchase protection

When a customer completes a valid, verified purchase, Noetia must honour the **original purchased quantity and agreed price**, even if the corresponding token package is later modified or deactivated.

- Fulfillment uses verified purchase-time information, never the package's later-modified quantity.
- Payment, currency, amount, product identity and purchased quantity must be validated against authoritative transaction evidence.
- An inactive package alone is not sufficient reason to deny a verified purchase.
- Missing, inconsistent or unverifiable purchase evidence must stop automatic fulfillment and create a reviewable exception.
- Noetia must never guess the number of tokens owed.

**Decision:** honour the original verified purchase.

#### W1-PO-2: paid-fulfillment exceptions

A confirmed paid purchase that cannot be fulfilled correctly must enter a **durable, auditable exception process**.

**Resolution target:** **48 consecutive calendar hours**, measured **from confirmed payment**.

**Resolution priority:**
1. Verify the transaction and attempt delivery of the exact purchased value.
2. If correct delivery is impossible, issue a **full refund** for the undelivered purchase.
3. If neither can be completed immediately, keep the exception open, escalate it, and maintain customer communication.

**Customer protection rules:**
- No paid purchase may be silently closed without fulfillment, a verified refund, or an explicitly authorized remedy.
- Customers must be informed **when a confirmed paid purchase runs into a material delivery problem**, and **again when resolution is completed**.
- An unresolved exception remains open and visible after the 48-hour target expires.
- A refund initiated within 48 hours satisfies the operator-action target **only when its outcome is tracked**. The customer's bank may take longer to return the funds.
- Duplicate webhook events, retries and repeated operator actions must not grant the same purchased value twice.

**Decision:** verified fulfillment first; refund if fulfillment is impossible; a 48-hour resolution target; customer notification; no silent closure.

#### W1-PO-3: duplicate book purchase

If a customer already has permanent ownership of a book before a separate paid purchase of it is fulfilled:
- The later duplicate purchase must not create an additional entitlement.
- The duplicate purchase must be **fully refunded**.
- Existing ownership must remain intact.
- Refund completion must be recorded against the duplicate transaction.
- No equivalent credit is issued as the default remedy.

**Decision:** full refund of the duplicate purchase.

#### W1-PO-4: refund after value delivery

If a payment is refunded after Noetia has delivered value:
- Books already redeemed or permanently owned must **not** be automatically revoked.
- Unused tokens associated with the refunded transaction must be **reviewed individually**.
- **No automatic token revocation is authorized.**
- The review must consider the transaction, the refund reason, the value already delivered and the available token balance.
- Any adjustment requires an authorized decision and an auditable record.
- Noetia must prevent accidental duplicate compensation.

**Decision:** preserve redeemed-book ownership; review unused tokens and refund circumstances case by case.

#### W2-PO: payment verification before fulfillment

For one-time purchases of tokens, books and gifts, Noetia must verify the transaction before delivering value. Required conditions include:
- an authoritative Stripe payment status of `paid`;
- the approved commercial currency, **USD**;
- the correct transaction amount;
- a verified product or purchase snapshot;
- a payment method authorized by Noetia;
- successful payment confirmation consistent with Stripe's associated payment records;
- no disqualifying refund or dispute condition at the time of a manually authorized grant.

**`checkout.session.completed` alone is not sufficient evidence of payment.**

A one-time purchase showing `unpaid`, `no_payment_required` or an unknown payment state must not produce purchased value without a separately approved commercial policy.

**Subscription trials are different:** valid free-trial token allocations remain governed by the approved **T-1** decision and must not be blocked by the one-time-purchase rules.

**Decision:** no confirmed valid payment, no one-time-purchase fulfillment.

#### Refund authority: initial financial release

- Refunds are made **manually in the Stripe Dashboard by authorized administrators**.
- **No automated refund engine is authorized.**
- Each refund must be linked to the original transaction and documented.
- A refund must not be recorded as completed before authoritative Stripe confirmation.
- Refund actions must not unintentionally trigger duplicate grants or the automatic deletion of permanent book ownership.
- Resolution records must distinguish fulfillment, refund, and cases still awaiting action.

**Decision:** manual, authorized Stripe refunds with durable reconciliation.

#### Implementation boundaries (part of the approved policy)

These decisions authorize product policy only. Engineering must preserve the previously approved:
- `PAYMENTS_ENABLED` activation gate;
- disabled purchase controls;
- T-1 initial trial-token allocation;
- USD currency policy;
- D1–D6 subscription rules;
- F-01 Option B;
- permanent ownership of redeemed books;
- Noetia+ and NoetiaX Coming Soon status.

Engineering choices about reconciliation, administrative interfaces, database records, scheduled checks and exception processing remain subject to independent Product Architecture review.

#### Governance

A change to any of these approved rules requires a new explicit Product Owner decision.

### Part B: pending engineering design choices (not policy; independent PA review required)

These are **open engineering questions**. They implement Part A and must not change it. The current proposal is PR60-I1-R1 (linked above). How Part A affects that proposal is under PA review.

| Area | Open choice |
|---|---|
| Exception and resolution records | How exceptions, refunds-in-progress and resolutions are durably recorded. R1 proposes keys in the existing `stripe_processed_events` table with no migration; an audit-column migration is optional and would need its own approval |
| Serialization and idempotency | Locking and state checks so webhooks, retries and operator actions cannot double-grant |
| Transient versus permanent failures | Which failures Stripe retries and which become durable exceptions; the trade-off between acknowledging a webhook and letting Stripe retry it |
| Reconciliation and scheduled checks | How often to check for unprocessed paid sessions and how the 48-hour clock is tracked from confirmed payment; whether the check re-runs fulfillment or only detects |
| Administrative interfaces | SQL-only operations or admin endpoints, and in which slice |
| Customer notifications | How the "delivery problem" and "resolution completed" notices are delivered (no such emails exist today) |
| Escalation | How cases past 48 hours and failed refunds are escalated |
| Refund and dispute events | How confirmed refunds are reconciled, and how a refund after delivery opens a W1-PO-4 review case (no refund or dispute handling exists in code today) |
| Payment verification detail | The exact W2-PO checks: re-reading the session from Stripe, purchase-time snapshot fields, card-only, USD, exact amount |

**Clarifications raised during PA analysis but not decided by this approval:** these stay open, and none is interpreted here.
1. For gift purchases, who receives the W1-PO-2 customer notifications (the buyer, the recipient, or both).
2. Whether new customer-facing refund and notification copy needs legal review before the financial launch.
3. The recipient or role for W1-PO-2 escalations.
4. Whether failed **subscription** token grants (for example, a renewal without a resolvable plan) fall under the W1-PO-2 exception process.
5. Whether an **unclaimed** gift card may be held during a W1-PO-4 review.

### Part C: financial-launch prerequisites

Payments stay disabled (`PAYMENTS_ENABLED` absent or not `true`) until **all** of the following are complete:
1. **Integration:** PR #60's lifecycle work is integrated on a main-based Draft PR, with the PR60-I1 P0 corrections. Every Stripe client goes through the activation gate (P0-I1), and the web purchase restrictions are kept (P0-I2).
2. **W-1/W-2 implementation and qualification:** Part A is implemented and qualified per the PA-reviewed design. That covers the exception process, the 48-hour tracking, customer notification, escalation, refund reconciliation and pre-fulfillment verification. It needs CI on the integrated tree and real-PostgreSQL concurrency and crash tests.
3. **Stripe configuration, verified by the PO in the Dashboard:**
   - every referenced Price is in USD (USD verification item above);
   - the portal configuration is verified (D4);
   - the webhook endpoint and its events are configured.
4. **Operations:** authorized administrators are named for manual refunds and exception handling, and the procedure is documented.
5. **Legal:** the Terms of Service §3 reconciliation and the pending Terms review (OP-3 / legal-gated PR #22) are complete. These policies do not modify the Terms.
6. **Reviews:** independent PA review of the implementation and release.
7. **Activation:** a separate, explicit Product Owner authorization to enable payments.

### What this approval does not authorize

- Any automated refund system.
- Any new admin endpoint or other functional implementation.
- Any merge, deployment or payment activation.
- Any change to the Terms of Service or other legal texts.

### Provenance of this file on `main`

- **Origin:** this register was first written on PR #60. Through the T-1, USD, D1–D6 and F-01 Option B sections it is a byte-identical copy of PR #60 head `d8e61e24e0b8c35c08c9d0f722f6ff6876d71689`, and those sections are unchanged.
- **References not yet on `main`:** some paths they cite exist only on the PR #60 branch until it is integrated:
  - `docs/reports/payment-lifecycle-20261112/` (report §11, §13, §14);
  - `services/web/lib/currency.ts`.
