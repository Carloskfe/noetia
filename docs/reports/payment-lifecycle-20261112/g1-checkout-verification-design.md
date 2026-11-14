# G-1: Server-side Checkout verification. Architecture and design validation

| | |
|---|---|
| **Mission** | G-1 Server-Side Checkout Verification: Architecture and Design Validation (PO authorization, 2026-11-13) |
| **Type** | Diagnostic and architecture validation **only**. No production code, tests, endpoints, migrations, configuration or infrastructure changed. |
| **Repository / PR** | `Carloskfe/noetia`, PR #60 (Draft), stacked on PR #59 (Draft) |
| **Baseline** | PR #60 head `60dbe2403f58ef8625e78203b6e7e8ccdc11b75b`; PR #59 head `e326b81f262fbe99e10bb3fbeff6232f066eb230`; `main` `6a5e5c0850a73a9de432be87d5be647bd138dbe7` |
| **Status** | **Design proposal for independent PA review.** Recommendations here are not approvals. Nothing is merged, deployed or activated. |
| **Executed by** | Claude Code. Independent reviewer: Product Architecture. |

> **⚠ ROUND 2 SUPERSEDES PARTS OF THIS DOCUMENT. Implementation agents must follow [§R2, Round 2: PA findings resolution and PO-1 G-b closure](#r2-round-2-pa-findings-resolution-and-po-1-g-b-closure) at the end of this file.** Sections 1–15 below are kept unchanged as the round-1 investigation record. Where they conflict with §R2, **§R2 wins**. Superseded passages carry a **⛔ SUPERSEDED (R2)** marker. Superseded passages:
> - §5.2 S1 terminality and copy, S4 copy, S13 gift wording;
> - §6.2 response contract;
> - §6.3 token evidence;
> - §7.1 gift rows;
> - **§7.3 recommendation G-a (rejected; the PO chose G-b, final)**;
> - §8.1 anonymous gift route;
> - §8.2 stop on S1;
> - §8.3 `notCompleted`, `expired`, `paidProcessing`, `delivered.tokens`, `giftRecorded` and the `subscriptionActive` body;
> - §8.4 the G-a gift branch;
> - §9.1 the two-route recommendation;
> - §11 T-A4, T-F1 and T-W5;
> - §12 PA-1, PA-6 and PA-9;
> - §13 PO-1;
> - §14 scope.

**Evidence labels used throughout:**
- **[Verified: code]**: read in the source at the baseline, with a file and line reference.
- **[Verified: Stripe docs]**: Stripe's public API documentation, read on 2026-11-13 (`docs.stripe.com/api/checkout/sessions/object`, `docs.stripe.com/checkout/fulfillment`). Not checked against Noetia's Stripe account, which is unavailable to this agent.
- **[Inference]**: reasoning from the evidence. Not tested.
- **[Unverified]**: could not be checked from this environment.
- **[Proposal]**: recommended design. Not implemented.

---

## 1. Baseline and review scope

### 1.1 Pre-execution verification (2026-11-13)

| Check | Result |
|---|---|
| PR #60 head and state | `60dbe24`, **Draft**, open; base `feat/public-ecosystem-site-20261112` |
| PR #59 is the direct dependency | Yes. PR #59 (`e326b81`, Draft, base `main`) is an ancestor of PR #60's head. |
| Local branch | `fix/payment-lifecycle-stabilization-20261112` at `60dbe24`, clean, level with `origin` |
| Overlapping work | None found. No open PR, branch or commit touches a Checkout-status endpoint. No other worktree is on PR #60's branch. |
| Governance read | `CLAUDE.md` (mission governance); `docs/product-governance/COMMERCE-DECISIONS.md` (T-1, USD, D1–D6, F-01 Option B); report `README.md` §§10.4, 13, 14 |

The baseline has not changed materially, so no conflict STOP applies.

### 1.2 Code read

| Area | Files |
|---|---|
| Checkout creation | `services/api/src/subscriptions/subscriptions.service.ts` (`createCheckoutSession` :330, `createPurchaseSession` :509, `createTokenPackageSession` :533); `services/api/src/gifts/gifts.service.ts` (`createGiftSession` :51) |
| Webhooks and ledger | `subscriptions/webhooks.service.ts`; `subscriptions/stripe-fulfillment-ledger.ts`; `subscriptions/stripe-processed-event.entity.ts` |
| Subscription state | `subscriptions.service.ts` (`applyStripeSubscription` :940, `upsertFromWebhook` :878, `issueTrialStartTokens` :979, `syncSubscription` :846, `readSubscriptionStatus` :661); `subscription.entity.ts` |
| Controllers and guards | `subscriptions.controller.ts`; `gifts/gifts.controller.ts`; `auth/jwt-auth.guard.ts`; `auth/jwt.strategy.ts`; `app.module.ts` (global `ThrottlerGuard`) |
| Gifts | `gifts.service.ts` (`fulfillGift`, `claimGift`, `getGiftPreview`); `gift-card.entity.ts`; migration `1714000000043-CreateGiftCards.ts` |
| Web | `services/web/app/(billing)/billing/success/page.tsx`; `(billing)/gift/page.tsx`; `(billing)/pricing/page.tsx`; `lib/api.ts`; `lib/i18n/{en,es}.ts`; `tests/unit/app/billing/success-page.spec.tsx`; `sentry.client.config.ts` |
| Mobile | `services/mobile/src/screens/PaywallScreen.tsx` |
| Observability | `services/api/src/metrics/metrics.middleware.ts` |

---

## 2. Current-state flow analysis (Checkpoint A)

All four flows use Stripe-hosted Checkout with `payment_method_types: ['card']`. All four return to `${WEB_URL}/billing/success?…session_id={CHECKOUT_SESSION_ID}`. **[Verified: code]**

The mobile app does not create Checkout sessions. Its paywall opens `https://noetia.app/pricing` in the browser (`PaywallScreen.tsx:9,67`), so every Checkout starts and ends on the web. **[Verified: code]**

### A1. Subscription

| Step | Behaviour | Evidence |
|---|---|---|
| Creation | `POST /subscriptions/checkout` with `JwtAuthGuard` and `EmailConfirmedGuard`, under the `subscription-checkout:<userId>` advisory lock. Local and Stripe duplicate guards apply. The D1 trial applies only if eligible. Metadata is `{ noetiaUserId, noetiaPlanId, noetiaTrial }`, with `customer` set to the user's Stripe customer. | `subscriptions.service.ts:330-404` |
| Redirect | `success_url = /billing/success?session_id={CHECKOUT_SESSION_ID}`, with **no `purchase` parameter**. | `:393` |
| Session completion | `checkout.session.completed` in subscription mode runs `handleCheckoutCompleted`, which calls `applyStripeSubscription(session.subscription)`. It **re-reads the subscription from Stripe** and never trusts the payload. | `webhooks.service.ts:73-79,113-118` |
| Subscription events | `customer.subscription.created/updated`, `invoice.paid` and `invoice.payment_failed` all funnel into `applyStripeSubscription`. `customer.subscription.deleted` calls `cancelFromWebhook`. | `webhooks.service.ts:80-95` |
| Entitlement activation | `upsertFromWebhook` writes the user's **single** `subscriptions` row (conflict path `userId`) under `subscription-identity:<userId>`. The identity guard refuses to replace a live subscription with another one, logging `DUPLICATE_LIVE_SUBSCRIPTION` or `IGNORED_OTHER_SUBSCRIPTION_EVENT`. | `subscriptions.service.ts:878-931` |
| Trial-start tokens (T-1) | In the **same transaction**, once the row tracks this subscription and Stripe says `trialing`, the `fulfillment:trial-start-tokens:<sub>` key is claimed and `tokensPerCycle` is issued. Nothing is issued if the price maps to no plan. | `:966-991` |
| Renewal and annual allocations | `invoice.paid`, classified by `billing_reason` (D4/D5), claims `fulfillment:period-tokens:<sub>:<periodStart>` and `fulfillment:invoice-tokens:<in>`. A paid creation without a trial (returning subscriber, F-01 Option B) is granted **here, from the invoice, not from the session**. Annual cycles 1 to 11 come from the scheduler (`fulfillment:annual-cycle:…`). | `webhooks.service.ts:120-137`; `subscriptions.service.ts:588-640,264` |
| Success page | Calls `POST /subscriptions/sync`, then polls `GET /subscriptions/me` 5 times, 3 s apart. It shows "Your subscription is active" when the **account** is `active`, `trialing` or `canceling`. **It never reads `session_id`.** | `success/page.tsx:51-70` |

- **Authoritative Stripe objects:** the Checkout Session (`status`, `payment_status`, `subscription`, `metadata`), then the Subscription (`status`, `trial_end`, price), then Invoices.
- **Database records:** the `subscriptions` row (`stripeSubscriptionId`, `status`), `token_ledger` rows, and the ledger keys above.
- **No per-session fulfillment key exists for subscriptions.** The session relates to Noetia state only through `session.subscription`, which equals `subscriptions.stripeSubscriptionId`. **[Verified: code]**

### A2. Token package

| Step | Behaviour | Evidence |
|---|---|---|
| Creation | `POST /subscriptions/tokens/purchase` with `JwtAuthGuard` and `EmailConfirmedGuard`. Mode `payment`; metadata `{ tokenPackageId, userId }`; `customer` set. | `subscriptions.service.ts:533-550` |
| Completion and webhook | `checkout.session.completed` in payment mode runs `handlePaymentCompleted`. It claims `fulfillment:checkout-session:<cs>` in the event transaction, then `issueTokensForPurchasedPackage`. | `webhooks.service.ts:96-111` |
| Issuance | `pkg.tokenCount` paid tokens with 90-day expiry. **If the package no longer exists, it logs a warning and returns. The session key stays claimed and no token is issued** (finding G1-F4). | `subscriptions.service.ts:553-562` |
| Confirmation | Neutral copy: "Once your payment is confirmed, your tokens are added…". No API call. | `success/page.tsx:73,96-103` |

### A3. Individual book purchase

| Step | Behaviour | Evidence |
|---|---|---|
| Creation | `POST /subscriptions/books/:bookId/purchase` with `JwtAuthGuard` and `EmailConfirmedGuard`. Mode `payment`, ad-hoc USD `price_data`, metadata `{ bookId, userId }`, `customer` set. | `subscriptions.service.ts:509-531` |
| Client | **No caller found** in `services/web` or `services/mobile` (grep for the route). The endpoint exists but no current UI reaches it (finding G1-F6). | grep |
| Fulfillment | Same `fulfillment:checkout-session:<cs>` claim, then `addPurchasedBook`: `INSERT … ON CONFLICT DO NOTHING` on `UQ_user_books_user_book (userId, bookId)`. Ownership is permanent. | `webhooks.service.ts:110`; `subscriptions.service.ts:568-576`; migration 015 |
| Confirmation | Neutral copy, no API call. | `success/page.tsx` |

### A4. Gift purchase

| Step | Behaviour | Evidence |
|---|---|---|
| Creation | `POST /gifts/checkout` has **no guard**. The controller reads `req.user?.id`, but without a Passport guard `req.user` is never set, and the web page sends no `Authorization` header. So **`buyerUserId` is always `''`: every gift is recorded as anonymous** (finding G1-F2). No `customer` is set. Metadata is `{ type:'gift', buyerUserId, recipientEmail, tokenCount, message, occasion }`. | `gifts.controller.ts:11-24`; `gift/page.tsx:43-45`; `gifts.service.ts:65-87` |
| Fulfillment | `handlePaymentCompleted` claims `fulfillment:checkout-session:<cs>`. `fulfillGift` inserts the `gift_cards` row (`stripeSessionId` indexed, **not unique**; the ledger key is the guard). Emails to the recipient and buyer run **after commit, best-effort**: a failure is logged and not retried (open blocker "gift-email recovery"). | `webhooks.service.ts:104-108`; `gifts.service.ts:102-145`; `webhooks.service.ts:51-58` |
| Claim | The recipient redeems with `claimToken` and receives the tokens then. A push to the buyer is sent only if `buyerUserId` is set, which is currently never. | `gifts.service.ts:147-185` |
| Buyer confirmation | Generic copy only: no API call, no session id, e-mail or amount rendered. Pinned by the test "an unauthenticated gift buyer sees only generic copy…". | `success/page.tsx`; `success-page.spec.tsx:226` |

- **Authoritative records for gifts:** the Checkout Session, the `fulfillment:checkout-session:<cs>` key, and the `gift_cards` row.
- **"Gift recorded" ≠ "gift e-mailed" ≠ "gift claimed".** These are three different states.

### 2.5 Fulfillment semantics differ by flow

| Flow | Unit of fulfillment | Durable proof in Noetia | Can it change later? |
|---|---|---|---|
| Subscription | An **ongoing entitlement** plus allocations per billing period | The `subscriptions` row tracks `session.subscription` with an entitled status. Tokens are proved by `trial-start-tokens` / `period-tokens` keys. | **Yes**: cancel, past_due, end of period, or a later re-subscription |
| Token package | One grant | `fulfillment:checkout-session:<cs>` (with the G1-F4 caveat) | No. The tokens then follow normal expiry. |
| Book | Permanent ownership | `fulfillment:checkout-session:<cs>` **and** `user_books (userId, bookId)` | No. Ownership is permanent. |
| Gift | A gift record, later claimed by someone else | `fulfillment:checkout-session:<cs>` and `gift_cards.stripeSessionId` | Status `sent`, then `claimed` or `expired` (recipient side) |

---

## 3. Confirmed architecture findings

| ID | Finding | Evidence | Impact on G-1 |
|---|---|---|---|
| **G1-F1** | §10.4 assumed "a trial is `no_payment_required`". Stripe documents that a trial subscription session is **`paid`** once the $0 trial invoice is processed. `no_payment_required` is documented for setup mode or a billing-cycle anchor without proration. Stripe does not document a trial session's `payment_status` before that invoice is processed. | [Verified: Stripe docs] | **The contract must not infer "trial" or "charged now" from `payment_status`.** For subscriptions, `paid` and `no_payment_required` both mean "nothing owed now" and must be reported without saying "payment received". |
| **G1-F2** | Gift buyers are **never** linked to their Noetia account: `buyerUserId` is always empty. | [Verified: code] `gifts.controller.ts` has no guard; `gift/page.tsx` sends no token | The "gift with `buyerUserId`, that user only" branch of §10.4 is unreachable today. In practice **every** gift confirmation is the anonymous case. Fixing it changes `POST /gifts/checkout`, which is outside G-1 and needs a separate authorization. |
| **G1-F3** | `handlePaymentCompleted` fulfills on `checkout.session.completed` **without checking `payment_status`**, and `checkout.session.async_payment_succeeded/failed` are not handled. Safe today only because every session is card-only, where completion implies payment. Stripe's fulfillment guide skips fulfillment while `unpaid`. | [Verified: code] `webhooks.service.ts:96-111`; [Verified: Stripe docs] | Latent. If a delayed payment method were ever enabled, the ledger key would exist **before** payment, and "delivered" would precede "paid". **The G-1 verifier must report `payment` independently and never derive it from the ledger key.** The webhook fix is a separate decision (§12, PA-8). |
| **G1-F4** | Token package missing at fulfillment: the session key is claimed but **no tokens are issued** (warning only). | [Verified: code] `subscriptions.service.ts:553-562` | A key-based "delivered" would be a **false positive** in this edge case. Mitigated in the design (§6.3). A webhook fix would be separate. |
| **G1-F5** | The success page's sign-in link is `/login?next=%2Fbilling%2Fsuccess`. It **drops `session_id` and `purchase`**. | [Verified: code] `success/page.tsx:134` | After implementation, a signed-out buyer would return to a page that can no longer identify the session. The frontend work must carry them through (§8.4). |
| **G1-F6** | No web or mobile client calls `POST /subscriptions/books/:bookId/purchase`. | grep over `services/web`, `services/mobile` | A3 must still be covered (the endpoint exists), but there is no user-facing path to regress today. |
| **G1-F7** | `/subscriptions/sync`, called by the success page, **writes** the subscription row from Stripe, for the row's own subscription id only. The existing test "only reads state" counts it as read-only for entitlements. | [Verified: code] `subscriptions.service.ts:846-857` | The G-1 endpoint must **not** call `sync`, so that it stays strictly read-only. |
| **G1-F8** | Subscriptions have **no** `fulfillment:checkout-session:<cs>` key. The session's outcome is visible only through `session.subscription` and the user's row. | [Verified: code] | **§10.4's `fulfilled` field is semantically invalid for subscriptions** (§6). |
| **G1-F9** | Session ids appear in the success-page URL: browser history, any proxy access logs [Unverified: Traefik access-log setting], and Sentry breadcrumbs and replays once enabled. Sentry is currently off because the DSN is empty, and is configured with `maskAllText: false`. No `Referrer-Policy` header is set anywhere in the repo, so browsers use their default (`strict-origin-when-cross-origin`), which strips the query string cross-origin. [Inference] | [Verified: code] `sentry.client.config.ts`; grep | Relevant to the anonymous-gift trade-off (§7.3). |
| **G1-F10** | Throttling: a global `ThrottlerGuard` at **120 requests per 60 s per IP**, with default in-memory storage, so it applies per API instance. Route overrides use `@Throttle`, as in `auth.controller.ts`. | [Verified: code] `app.module.ts:34-36,74` | Reusable as-is. No Redis is needed (§10). |
| **G1-F11** | The metrics middleware labels requests by `req.route?.path ?? req.path`. A request that matches no route is labelled with its **raw path**. | [Verified: code] `metrics.middleware.ts:31` | If the route uses a path parameter, a mismatched path such as a trailing slash could put a session id into a Prometheus label. Low. A test should pin the templated label (§11). |

---

## 4. Risk classification

| Risk | Severity | Current exposure | With the proposed design |
|---|---|---|---|
| A redirect is treated as proof of payment | High | **Closed in the interim** (§10.4 copy): the page claims no payment | Payment is claimed only when Stripe's session says `complete` **and** `payment_status = paid` (one-time purchases) |
| Active subscription confused with *this* session | Medium | **Open**: "Your subscription is active" appears for any entitled account, whatever `session_id` says | Closed: requires `session.subscription == row.stripeSubscriptionId` |
| "Delivered" reported before fulfillment | High | Closed (neutral copy) | Closed: delivery reported only from durable Noetia evidence |
| Cross-customer disclosure | High | None (no lookup exists) | Ownership check with a uniform 404 (§7) |
| Duplicate grants or billing from the verifier | Critical | None | The endpoint has no write path (§9) |
| Anonymous gift session-id leakage | Low | None (no lookup) | Bounded by a minimal response. **Needs PA/PO approval** (§7.3) |
| Stripe load and cost | Low | — | ≤1 Stripe read per poll, ≤ about 11 per checkout (§10) |

---

## 5. Proposed state model and state machine (Checkpoint D)

### 5.1 Four separate dimensions

| Dimension | Source | Values |
|---|---|---|
| **Checkout** | Stripe `session.status` | `open` · `complete` · `expired` |
| **Payment** | Stripe `session.payment_status` | `paid` · `unpaid` · `no_payment_required` |
| **Fulfillment** (one-time purchases) | Noetia ledger key, plus evidence per kind | `pending` · `delivered` (tokens, book) / `recorded` (gift) |
| **Entitlement** (subscription) | Noetia `subscriptions` row compared with `session.subscription` | `not_recorded` · `active` · `payment_problem` · `ended` · `superseded` |

**The API returns these dimensions separately and never collapses them.** The web derives copy from the combination (§8).

### 5.2 State-transition matrix

"Copy" below names a **draft** copy key from §8.3; the wording is there.

| # | State | Authoritative evidence | Safe API response | Customer interpretation (copy key) | Poll? | Terminal? | Admin? |
|---|---|---|---|---|---|---|---|
| S1 ⛔ SUPERSEDED (R2: not terminal, no "no charge" claim) | Session open | Stripe `status=open` | `200 { checkout:'open', payment:'unpaid' }` | `notCompleted`: "This checkout hasn't been completed." | No | Yes, for the page | No |
| S2 | Complete and paid, not yet fulfilled | `complete` + `paid`; no ledger key / row not linked | `200 { checkout:'complete', payment:'paid', delivery:'pending' }` or `entitlement:'not_recorded'` | `paidProcessing`: "Payment confirmed. We're adding it to your account…" | **Yes** | No | Only if still pending past the polling window **and** Stripe's retry window [§5.3] |
| S3 | Complete, no payment required | `complete` + `no_payment_required` | Same shape with `payment:'no_payment_required'` | Subscription: as S2 / S7 without "payment confirmed". One-time: not expected under card-only, so treat as S2 without a payment claim | Yes | No | No |
| S4 ⛔ SUPERSEDED (R2: copy makes no charge claim) | Expired | `status=expired` | `200 { checkout:'expired' }` | `expired`: "This checkout expired without a charge." | No | **Yes** | No |
| S5 | Asynchronous payment processing | `complete` + `unpaid` | `200 { checkout:'complete', payment:'unpaid', … }` | `paymentProcessing`: "Your payment is still processing…" Never "payment received". | Yes, at a slower interval | No | No |
| S6 | Payment failure | Card declines keep the session **`open`** inside Stripe's page, and the customer never reaches `success_url` [Inference from Stripe Checkout behaviour]. A delayed-method failure would be `async_payment_failed`, unhandled (G1-F3) and unreachable under card-only. | As S1 / S5 | As S1 / S5 | — | — | — |
| S7 | Webhook processed, benefit delivered | One-time: ledger key (+ `user_books` row for books). Subscription: row tracks `session.subscription`, status entitled. | `delivery:'delivered'` / `gift:'recorded'` / `entitlement:'active'` | `delivered.tokens` / `delivered.book` / `giftRecorded` / `subscriptionActive` | No | **Yes** | No |
| S8 | Webhook retried or out of order | No effect on the reader. Ledger keys commit only with their effects, and `applyStripeSubscription` re-reads Stripe. | The current truth (S2 or S7) | As S2 / S7 | As S2 / S7 | — | No |
| S9 | Subscription activated through an **unrelated** session | Row's `stripeSubscriptionId ≠ session.subscription` | `entitlement:'superseded'` | `subscriptionOther`: "This checkout isn't linked to your current subscription. Check your billing page." | No | Yes | Only for `DUPLICATE_LIVE_SUBSCRIPTION` (already logged at webhook time) |
| S10 | Subscription canceled before revisit | Row tracks the session's subscription; status `canceled` | `entitlement:'ended'` | `subscriptionEnded`: "This subscription has ended." Status `canceling` stays `active`. | No | Yes | No |
| S11 | Stripe temporarily unavailable | Stripe connection error, 5xx or 429 | `503 { error:'checkout_status_unavailable' }` | `unavailable`: "We can't check right now. Your payment isn't affected." Offer retry. | Yes, with backoff, within the poll budget | No | No |
| S12 | Database temporarily unavailable | Query error | `503 { error:'checkout_status_unavailable' }` (same body) | As S11 | As S11 | No | No |
| S13 | Not found or not owned | Stripe `resource_missing`, ownership mismatch, malformed id, non-Noetia session | **`404 { error:'checkout_session_not_found' }`** for all of these, identically | `notFound`: "We couldn't find this purchase in this account. If you used a different account, sign in with it." | No | Yes | No |
| S14 | Not signed in (account purchases) | No or invalid JWT | `401` (existing guard behaviour) | Existing `auth` view, now **keeping** `session_id` (G1-F5) | No | — | No |
| S15 | Subscription `past_due` | Row tracks the session's subscription; status `past_due` | `entitlement:'payment_problem'` | Existing `problem` copy | No | Yes | No |

### 5.3 When pending becomes an operations matter

- **Polling stops after the window in §8.2.** The page then shows `paidProcessing` with "Check again" and the billing link, and never claims delivery.
- **Stripe's own retries recover a missed webhook.** Live mode retries for up to 3 days [Unverified for Noetia's account; per Stripe docs]. Events that throw are retried, including F-02's fail-closed path.
- **When a webhook was permanently ignored** (for example, missing metadata, where `handlePaymentCompleted` returns without a claim), recovery is an **admin re-send of the event from the Stripe Dashboard** through the existing exactly-once path. **The endpoint never recovers anything itself** (§9).

---

## 6. Purchase-specific semantics (Checkpoint B, G2)

### 6.1 Is §10.4's `fulfilled` valid for subscriptions? **No.**

1. **No key exists.** `fulfillment:checkout-session:<id>` is never written for subscription sessions (G1-F8), so `fulfilled` would be permanently `false`.
2. **Fulfillment isn't a single event.** A subscription's benefit is an ongoing entitlement plus periodic allocations. A single boolean can't express `canceled`, `past_due` or `superseded` (S9, S10, S15).
3. **Initial tokens come from different events.** A trial grants on the subscription event (T-1). A paid creation grants on `invoice.paid` (D5 / F-01 Option B), possibly a separate event after the row is recorded. So "row recorded" does **not** imply "initial tokens granted".

### 6.2 Smallest correct alternative: a response that differs by kind [Proposal]

> ⛔ **SUPERSEDED (R2).** The corrected contract is in §R2.4: no gift variant, no `payment` field for subscriptions, and `delivery` can be `unconfirmed`.

```ts
type Checkout = 'open' | 'complete' | 'expired';
type Payment  = 'paid' | 'unpaid' | 'no_payment_required';

type CheckoutSessionStatus =
  | { kind: 'subscription'; checkout: Checkout; payment: Payment;
      entitlement: 'not_recorded' | 'active' | 'payment_problem' | 'ended' | 'superseded' }
  | { kind: 'tokens' | 'book'; checkout: Checkout; payment: Payment;
      delivery: 'pending' | 'delivered' }
  | { kind: 'gift'; checkout: Checkout; payment: Payment;
      gift: 'pending' | 'recorded' };
```

- `kind` comes **only** from Stripe's session (`mode` and `metadata`), never from `?purchase=`.
- **Never returned:**
  - amounts or currency;
  - e-mails, names or messages;
  - Stripe customer, subscription or invoice ids;
  - plan, package, book or gift ids;
  - token counts;
  - the session's own timestamps.
- **No initial-token field in v1.** The current "Your subscription is active" copy makes no token claim, so none is needed (PA-6).

### 6.3 Evidence per kind

| Kind | Precondition for anything except S1/S4 | `delivered` / `recorded` / `active` when |
|---|---|---|
| subscription | `checkout=complete`, `session.subscription` present | `row.stripeSubscriptionId == session.subscription` **and** `row.status ∈ {trialing, active, canceling}`. `past_due` gives `payment_problem`; `canceled` gives `ended`; another id gives `superseded`; no row gives `not_recorded`. |
| tokens ⛔ SUPERSEDED (R2.6: the key alone is not proof) | `complete` and `payment=paid` (`unpaid` gives S5) | Ledger key `fulfillment:checkout-session:<cs>` exists. G1-F4 caveat: a key with nothing issued is possible only when the package was deleted after purchase. Accepted with a documented limitation, or fixed in the webhook separately (PA-9). |
| book | `complete` and `paid` | Ledger key exists **and** `user_books (metadata.userId, metadata.bookId)` exists. Ownership is permanent, so this cannot regress. |
| gift | `complete` and `paid` | Ledger key exists. **This means "recorded", never "sent" or "e-mailed" or "claimed"**: the e-mail is best-effort after commit, and its recovery is an open blocker. |

**Payment always comes from Stripe and never from the ledger (G1-F3).** A ledger key with `payment ≠ paid` is impossible under card-only. If it occurred, the response would still say `payment:'unpaid'`, and the web must not claim payment.

---

## 7. Authentication and privacy (Checkpoint C)

### 7.1 Ownership rules [Proposal]

| Kind | Auth | Owner check (all must hold) |
|---|---|---|
| subscription | JWT required | If `metadata.noetiaUserId` is present, it must equal `user.id`. If absent (sessions created before PR #60 carried no metadata, [Verified: `main`]), `session.customer` must equal `user.stripeCustomerId`. |
| tokens / book | JWT required | `metadata.userId == user.id`, **and** `session.customer == user.stripeCustomerId` when both are set |
| gift, `buyerUserId` set | JWT required, that user only | `metadata.buyerUserId == user.id`. Unreachable today (G1-F2), but kept so a future fix can't widen access. |
| gift, `buyerUserId` empty | **Decision required (§7.3)** | — |

**Why metadata is trusted:**
- Noetia writes it server-side with the secret key when it creates the session.
- Checkout customers can't modify it.
- Anyone able to forge it already holds Noetia's secret key [Inference].
- **The check applies to the authenticated route only.** Metadata is never used as an anonymous credential.

### 7.2 Enumeration, oracles, timing and errors

- **One negative answer.** Unknown, malformed, not owned, not a Noetia session (no recognised metadata), and wrong Stripe mode (`resource_missing`) all return the **same `404 { error: 'checkout_session_not_found' }`**. Malformed ids short-circuit before Stripe. The format `^cs_(test|live)_[A-Za-z0-9]{10,200}$` is public, so skipping the Stripe call reveals nothing.
- **Timing.** Unknown ids and not-owned ids both cost one Stripe retrieve, so their timing is similar [Inference]. An owned id adds one or two indexed database reads; the difference reveals only "this is yours", which the caller already knows.
- **Enumeration.** Stripe session ids are long random strings [Unverified: exact entropy is not documented]. Throttling (§10) bounds online guessing further.
- **Errors.** Stripe and database errors return `503 { error: 'checkout_status_unavailable' }` with no Stripe message. Logs carry the user id and a **truncated** session id (`cs_live_…last 6`), never metadata or e-mails. This follows the CLAUDE.md rule against logging PII.
- **Account switching.** User A completes checkout, user B signs in on the same browser, and B gets a 404 (S13). The copy invites B to sign in with the account that was used, without confirming that the purchase exists.
- **Expired sessions.** These are retrievable and owned, and report `checkout:'expired'` (S4). An expired access token goes through the existing `apiFetch` refresh, then 401.

### 7.3 Is a Checkout session id enough to authorise anonymous gift confirmation? **Security trade-off: PA/PO approval required**

> ⛔ **SUPERSEDED (R2).** **PO-1 is decided: Option G-b, final.** G-a is **rejected** and G-c is **rejected / deferred**. No anonymous lookup of any kind is authorised. The analysis below is kept as historical evidence only.

| Option | What the anonymous buyer sees | Exposure if the session id leaks (G1-F9) | New mechanism? |
|---|---|---|---|
| **G-a: session id as bearer, minimal response** | `{ kind:'gift', checkout, payment, gift }`, so "payment confirmed, gift recorded" | Someone holding the id learns that *a* gift purchase exists and its state. No recipient, buyer, amount, message or token count. Stripe objects can't be reached without the secret key. | No |
| **G-b: no anonymous lookup (status quo)** | The current generic copy, plus the gift-confirmation e-mail sent after commit | None | No |
| G-c: signed, short-lived nonce in `success_url` | As G-a | Lower: the nonce is bound and expires | **Yes, a new credential.** Excluded by the mission unless separately authorised |

**Recommendation [Proposal]: G-a**, limited exactly to the four fields above, on a separate anonymous route with its own stricter throttle (§8.1). This lets the PO disable it independently.

- **Residual risk:** low sensitivity. It mainly matters on shared devices (browser history) and if Sentry is later enabled with replay text unmasked. Masking `session_id` in Sentry is a recommended condition, implemented with the endpoint.
- **G-b is safe as well.** The cost is only the anonymous buyer's confidence on the success page.
- **This changes current behaviour pinned by a test** ("no API calls" for gifts, `success-page.spec.tsx:226`), so it needs **explicit approval (PO-1)**.

Because of G1-F2, choosing G-a in practice covers **all** gift buyers.

---

## 8. API contract and frontend behaviour (G1, G4)

### 8.1 API [Proposal]

> ⛔ **SUPERSEDED (R2).** Only the authenticated route remains (§R2.4). The gift route is **removed**.

Two thin routes over one shared read-only verifier (Option 2B, §9).

| | Account purchases | Anonymous gift (only if PO-1 = G-a) |
|---|---|---|
| Route | `GET /subscriptions/checkout-sessions/:id/status` | `GET /gifts/checkout-sessions/:id/status` |
| Guard | `JwtAuthGuard` (existing). **No `EmailConfirmedGuard`**, because a buyer who completed checkout already passed it at creation. | None |
| Kinds answered | subscription, tokens, book, and gift with `buyerUserId == user.id` | **gift with empty `buyerUserId` only**. Every other kind returns 404. |
| Throttle | `@Throttle({ default: { limit: 30, ttl: 60_000 } })` per IP | `@Throttle({ default: { limit: 12, ttl: 60_000 } })` per IP |
| Validation | `:id` must match `^cs_(test|live)_[A-Za-z0-9]{10,200}$`, else 404 | Same |
| 200 | `CheckoutSessionStatus` (§6.2), with `Cache-Control: no-store` | Gift variant only, `no-store` |
| Errors | `401` (guard) · `404 { error:'checkout_session_not_found' }` · `429` (throttler) · `503 { error:'checkout_status_unavailable' }` | `404` · `429` · `503` |

- **Placement.** Under existing controller prefixes (`/subscriptions`, `/gifts`) rather than §10.4's new `/billing` prefix, so no new controller or module wiring is needed (PA-3).
- **Status codes.** HTTP status follows the existing `HttpException` conventions: error bodies are `{ error: '<code>' }`, as in `subscription_exists` and `checkout_pending`.

### 8.2 Polling [Proposal]

> ⛔ **SUPERSEDED (R2.8).** `open` is no longer a stop state.

- **Start:** immediately on load.
- **Interval:** 2 s for 5 attempts, then 4 s for 5 attempts. That is at most 11 requests over about 32 s, inside both throttles.
- **Stop early on:** S1, S4, S7, S9, S10, S13, S15, or a 401.
- **On 503:** continue with backoff inside the same budget. **On 429:** honour `Retry-After` and stop at budget end.
- **After the budget:** show the current non-terminal state (S2, S5, S11) with **"Check again"**, which starts a new budget, and the billing / library link. Never claim delivery.
- **Cancellation:** keep the existing `run` counter and add an `AbortController` per request. Unmounting aborts in-flight requests.
- **Removed from this page:** `POST /subscriptions/sync` and the `/subscriptions/me` poll. They are replaced by the session endpoint. `/account/billing` keeps `sync`.

### 8.3 Bilingual copy: **drafts only, requires PO approval (PO-2)**

> ⛔ **SUPERSEDED (R2.10).** Use the corrected drafts in §R2.10.

These restate facts the API can prove. They add no promise, timeline or legal wording beyond the existing strings. Existing keys are reused where possible.

| Key | EN (draft) | ES (draft) |
|---|---|---|
| `paidProcessing` | Payment confirmed. We're adding your purchase to your account. | Pago confirmado. Estamos agregando tu compra a tu cuenta. |
| `paymentProcessing` | Your payment is still processing. We'll update this page when it's confirmed. | Tu pago aún se está procesando. Actualizaremos esta página cuando se confirme. |
| `delivered.tokens` | Your tokens are in your balance. | Tus tokens ya están en tu saldo. |
| `delivered.book` | The book is in your library. | El libro ya está en tu biblioteca. |
| `giftRecorded` | Payment confirmed. Your gift has been registered. | Pago confirmado. Tu regalo quedó registrado. |
| `subscriptionActive` | Existing `title` / `body`, now shown only when this checkout's subscription is the active one | Existing `title` / `body` |
| `subscriptionEnded` | This subscription has ended. You can review it on your billing page. | Esta suscripción terminó. Puedes revisarla en tu página de facturación. |
| `subscriptionOther` | This checkout isn't linked to your current subscription. Check your billing page. | Este pago no está vinculado a tu suscripción actual. Revisa tu página de facturación. |
| `notCompleted` | This checkout wasn't completed, so no charge was made. | Este pago no se completó, así que no se hizo ningún cargo. |
| `expired` | This checkout expired without a charge. | Este pago expiró sin ningún cargo. |
| `notFound` | We couldn't find this purchase in this account. If you used a different account, sign in with it. | No encontramos esta compra en esta cuenta. Si usaste otra cuenta, inicia sesión con ella. |
| `unavailable` | We can't check right now. Your payment isn't affected. Try again in a moment. | No podemos verificarlo ahora. Tu pago no se ve afectado. Inténtalo de nuevo en un momento. |

- **One wording to check:** `notCompleted` says "no charge was made". That holds for an `open` card-only session, but **PA should confirm it** against G-4, where a pending session may still complete. If in doubt, drop the clause.
- **No gift copy says "sent" or "e-mailed".**
- **Web-only strings.** They go into `services/web/lib/i18n/{en,es}.ts`, because the success page is web-only (mobile opens `/pricing` on the web). The en/es parity test applies, and the existing dictionary guard against "payment received" stays. The **only** wording that may say payment is confirmed is `paidProcessing` / `giftRecorded`, and only when `payment=paid`. The guard needs a narrowly scoped update to allow this (PA-10).

### 8.4 Navigation and the anonymous buyer

- **Sign-in link keeps the session.** It becomes `/login?next=<encoded /billing/success?session_id=…&purchase=…>`, fixing G1-F5. Login already honours `next` (CLAUDE.md, `s/[id]`).
- **No session id in the URL** (direct visit): keep today's account-status flow unchanged, so the page's behaviour is unchanged.
- **Anonymous gift:**
  - **G-a:** the gift route is called, and the same polling rules apply.
  - **G-b:** today's generic copy is kept.
  - In both cases nothing personal is shown.
- **Links:** subscription goes to `/account/billing`; tokens and book go to the library; gift goes to `/gift`, or home.

---

## 9. Alternatives (Checkpoint G, §11) and the read-only invariant (Checkpoint E)

### 9.1 Comparison

> ⛔ **SUPERSEDED (R2.4).** The selected architecture is the shared verifier behind **one** authenticated route.

| Criterion | **Option 1: one unified endpoint, optional JWT** | **Option 2B (recommended): two thin routes, one shared verifier** | Option 2A: fully separate verifiers |
|---|---|---|---|
| Correctness | Same contract | Same contract | Duplicated mapping can drift |
| Security | Needs a **new optional-auth guard**: an absent token means anonymous, while a present but invalid token must still return 401. One handler mixes anonymous and authenticated branches, so a branching bug can expose account purchases anonymously. | Existing `JwtAuthGuard` only. The anonymous route is **structurally limited** to gifts with an empty buyer and can be removed or disabled alone. | As 2B |
| Complexity | Medium (new guard plus branching) | Low: one service method, two controller methods | Higher |
| Cost | Same | Same | Same |
| Reuse | Full | Full (shared `CheckoutStatusService.verify(sessionId, viewer)`) | Low |
| Testing burden | Optional-auth matrix × kinds | Each route's guard plus shared mapping tests | Two mapping suites |
| Maintainability | One place, but riskier changes | Clear boundaries | Drift |

**Recommendation: Option 2B.** This is a recommendation, not approval (PA-1). If PO-1 chooses G-b, Option 2B has only the authenticated route.

### 9.2 Read-only with respect to financial fulfillment

The verifier does only the following:
- one `stripe.checkout.sessions.retrieve`;
- `SELECT`s on `stripe_processed_events`, `subscriptions` and `user_books` (plus the guard's existing user lookup).

It never calls `claimStripeKey`, `issueTokens`, `addPurchasedBook`, `fulfillGift`, `applyStripeSubscription`, `upsertFromWebhook`, `syncSubscription`, or any Stripe write. **It cannot grant tokens, create ownership, activate subscriptions, send gifts, or cause duplicate processing.** Implementation tests should pin this with spies (§11, T-RO).

**Invariants preserved [Inference, from the design]:**
- **T-1, D1–D6, F-01 Option B, F-02:** untouched, because the verifier writes nothing and reads only the subscription row and the existing keys.
- **Exactly-once:** only webhooks claim keys.
- **Permanent ownership:** `user_books` is read only.
- **Atomic redemption:** not involved.
- **Subscription identity:** the identity guard is not called. The verifier compares ids only.
- **USD and token economics:** no amounts are read or returned.
- **Gift fulfillment and notification separation:** "recorded" is reported, never "sent".

### 9.3 Reconciliation is a separate architectural decision, not part of G-1

Stripe's fulfillment guide **recommends** triggering fulfillment from the landing page as well as webhooks, with an idempotent fulfillment function [Verified: Stripe docs]. Noetia's ledger keys could make that safe, but it would turn this endpoint into a **writer**: it would claim keys and grant value from a browser-initiated request. **That breaks this mission's read-only restriction, so it is not proposed.** It is listed as **PA-8**, for a separate decision with its own mission if wanted, together with G1-F3 (`payment_status` and async events in webhooks).

---

## 10. Cost and performance (Checkpoint F)

| Item | Per status request | Per checkout (polling budget) |
|---|---|---|
| Stripe API calls | 1 `checkout.sessions.retrieve` (no `expand`) | ≤ 11, usually 1 to 3 (webhooks normally land within seconds [Inference]) |
| Database queries | JWT user lookup (existing) + 1 ledger `SELECT` by primary key + at most 1 of: `subscriptions` by `userId` (unique), or `user_books` by the unique pair. **≤ 3, all indexed.** | ≤ 33 |
| New tables, Redis, queues or infrastructure | **None.** `stripe_processed_events`, `subscriptions`, `user_books` and the existing throttler suffice. | — |
| Stripe unavailable | 503, client backoff inside the budget. No retries inside the request (beyond stripe-node's default network retries). | Bounded |
| Rate limits | Account route 30/min/IP; gift route 12/min/IP; global 120/min/IP. The budget of 11 per 32 s fits. Stripe's read limit is far above this [Unverified for Noetia's account; Stripe documents per-mode limits]. | — |

- **Stateless:** no cache, because correctness needs current Stripe and database state, and the volume is tiny.
- **No migrations:** existing keys and the unique constraints are enough.
- **G-4 stays separate:** the pending-Checkout ambiguity is a creation-time concern. This design only reads the outcome of a known session id.

---

## 11. Mandatory implementation tests (G5)

> ⛔ **SUPERSEDED (R2.9).** The authoritative test list is §R2.9.

**API: `tests/unit/subscriptions/checkout-status.service.spec.ts` plus controller specs, all external dependencies mocked:**

| ID | Test |
|---|---|
| T-A1 | 401 without a JWT on the account route; the gift route needs none |
| T-A2 | Cross-account: a session owned by user A returns **404** to user B, with a body identical to an unknown id, for each kind |
| T-A3 | Metadata matches but `customer` mismatches (tokens / book) → 404. Subscription without metadata → customer fallback. Metadata present but wrong → 404, even if the customer matches |
| T-A4 | Anonymous gift route: a subscription, tokens or book session → 404; a gift with `buyerUserId` set → 404; an empty-buyer gift → 200 minimal body |
| T-A5 | Malformed id → 404 **without** a Stripe call. Stripe `resource_missing` → 404. Non-Noetia metadata → 404 |
| T-A6 | The response never contains amount, currency, e-mail, name, message, token count, or a customer, subscription, invoice, plan, package, book or gift id (snapshot of allowed keys per kind) |
| T-P1 | Mapping for each combination of `status × payment_status` (S1–S5) and kind. A trial subscription with `paid` is never treated as "charged now" (G1-F1) |
| T-P2 | One-time purchase with a ledger key but `payment_status` `unpaid` → `payment:'unpaid'`, and the web never claims payment (G1-F3) |
| T-F1 | Tokens: key absent → `pending`, present → `delivered`. The G1-F4 limitation is pinned as documented |
| T-F2 | Book: key without a `user_books` row → `pending`; both → `delivered`; book already owned before purchase → `delivered` |
| T-F3 | Gift: key → `recorded`; no wording or field implies "sent" |
| T-S1 | Subscription: row tracks the session's subscription with `trialing`, `active` or `canceling` → `active`; `past_due` → `payment_problem`; `canceled` → `ended`; a different id → `superseded`; no row → `not_recorded` |
| T-S2 | Entitled account but an **unrelated** session → not `active` (S9) |
| T-O1 | Duplicate and out-of-order webhooks (simulated ledger and row states in any order) give the same final response |
| T-E1 | Stripe connection error, 5xx or 429 → 503 `checkout_status_unavailable`, no Stripe message in the body. Database error → the same 503 |
| T-RO | **Read-only:** spies assert that no `claimStripeKey`, `issueTokens`, `addPurchasedBook`, `fulfillGift`, `applyStripeSubscription`, `upsertFromWebhook`, `syncSubscription`, repository `save/insert/update/upsert`, or Stripe write method is called, on any path |
| T-T1 | Throttle decorators are present with the agreed limits. The metrics label is the route template, never a raw session id (G1-F11) |
| T-L1 | Logs contain only a truncated session id and no metadata |

**Web: `services/web/tests/unit/app/billing/success-page.spec.tsx`:**

| ID | Test |
|---|---|
| T-W1 | Every state S1–S15 renders its copy key in **EN and ES**. Never "payment received" unless `payment=paid`. Never "delivered" without `delivery='delivered'`. Never "subscription active" unless `entitlement='active'`. |
| T-W2 | Polling: the schedule is bounded (≤ 11), stops on terminal states, `Check again` restarts, and unmount aborts (AbortController plus the run counter) with no state update after unmount |
| T-W3 | 503 → backoff; 429 honours `Retry-After`; 401 → sign-in link **keeps** `session_id` and `purchase` |
| T-W4 | `?purchase=` never decides `kind`. A `purchase=book` URL for a subscription session renders subscription states. |
| T-W5 | Gift: G-a → only the gift route is called, and no personal data is rendered. G-b → no API call (the existing test is kept). |
| T-W6 | No `session_id` → today's account-status flow, unchanged |
| T-W7 | The page calls no write endpoint, including `/subscriptions/sync` in the session flow |
| T-W8 | The i18n parity test and the "payment received" dictionary guard still pass, with the guard scoped per PA-10 |

**Real-PostgreSQL addition (optional, PA-11):** one scenario in `scripts/payment-safety-pg-check.ts`. A status poll that runs concurrently with webhook fulfillment never observes "delivered" before COMMIT, and never changes row or key counts.

---

## 12. Open PA decisions

> ⛔ **SUPERSEDED (R2.12).**

| ID | Decision | Recommendation |
|---|---|---|
| PA-1 | Option 1 vs Option 2B vs 2A | **2B** |
| PA-2 | Response contract: kind-specific dimensions, no `fulfilled` for subscriptions (§6.2) | Accept |
| PA-3 | Route placement: `/subscriptions/…` and `/gifts/…` vs a new `/billing/…` prefix | Existing prefixes |
| PA-4 | Throttle limits (30 and 12 per minute per IP) | Accept or adjust |
| PA-5 | Polling schedule (≤ 11 requests over about 32 s) | Accept or adjust |
| PA-6 | Expose initial-token state for subscriptions? | **No** in v1 |
| PA-7 | Logging: truncated session id; Sentry masking of `session_id` before Sentry is enabled | Accept |
| PA-8 | Landing-page reconciliation (Stripe's recommendation) **and** G1-F3 (`payment_status` and async events in webhooks): a separate architectural decision and mission | Defer; record as a follow-up |
| PA-9 | G1-F4 (deleted token package means a key with no tokens): accept as a documented limitation, or fix in the webhook in a separate mission (make it throw, so Stripe retries) | Separate fix |
| PA-10 | Scoped change to the "payment received" dictionary guard, so "Payment confirmed" is allowed only in the keys used when `payment=paid` | Accept |
| PA-11 | Add one real-PostgreSQL scenario for concurrent read-during-fulfillment | Optional |
| PA-12 | G1-F2 (gift buyers never linked): a separate mission, because it changes `POST /gifts/checkout` | Separate |

## 13. Product Owner decisions that are genuinely unavoidable

> ⛔ **SUPERSEDED (R2.3, R2.12).** PO-1 is closed as G-b.

| ID | Decision | Why it can't be avoided |
|---|---|---|
| **PO-1** | **Anonymous gift confirmation:** G-a (session id as bearer, minimal four-field response, own throttle) or G-b (no lookup; generic copy as today) | It's a security and privacy trade-off, and it changes behaviour pinned by a test. Explicitly requested by the mission (§6). |
| **PO-2** | **Customer-facing copy** for the new states (§8.3 drafts, EN and ES) | These are new customer statements. They are drafted from facts only, but D6 practice gives copy approval to the PO. |

**No new product policy is required.** Trial, pricing, tokens, ownership and cancellation rules are all unchanged.

---

## 14. Recommended bounded implementation mission (for PA/PO consideration, not started)

> ⛔ **SUPERSEDED (R2.13).**

**Proposed title:** "G-1 implementation: read-only Checkout-session status (Option 2B)". It would be bounded as follows.

**Scope:**
- `CheckoutStatusService` with the shared verifier, in `services/api/src/subscriptions/`;
- `GET /subscriptions/checkout-sessions/:id/status`;
- `GET /gifts/checkout-sessions/:id/status`, only if PO-1 = G-a;
- the success-page rewrite of the session flow (§8);
- web i18n keys (EN and ES);
- the tests in §11.

**Excluded:**
- webhooks and fulfillment;
- G1-F2, G1-F3 and G1-F4 fixes;
- reconciliation (PA-8);
- G-4;
- migrations, configuration and infrastructure;
- Terms and Privacy Policy;
- prices and token rules;
- the mobile app;
- PR #59.

**Gates:**
- **Coverage:** ≥ 80% for the new service.
- **Tests:** the existing payment suites stay green (`--maxWorkers=2`).
- **Read-only:** T-RO is mandatory.
- **Evidence:** screenshots of the EN and ES states.
- **Hand-off:** STOP for PA review.

**Size estimate [Inference]:**
- **API:** one service of about 150 lines, two controller methods, and about 40 API tests.
- **Web:** a page rewrite of about 200 lines and about 15 web tests.

---

## 15. STOP and release restrictions

- **Mission-type STOP status:**
  - none of the §13 STOP conditions is triggered;
  - no new policy is needed;
  - the endpoint can't write;
  - the anonymous case is safe under G-a or G-b, pending PO-1;
  - no invariant is weakened;
  - no migration or infrastructure is needed;
  - the contract separates checkout, payment, fulfillment and entitlement;
  - governance permits this documentation-only commit;
  - the baseline is unchanged.
- **Nothing was implemented:** no production code, tests, scripts, migrations, configuration, Terms, Privacy Policy, PR #59, or Stripe access.
- **PR #60 remains Draft.** No merge, deployment or activation. Merging to `main` deploys to production and needs an explicit PO instruction naming the PR.
- **Release blockers are unchanged** (report §13.11, §14.G):
  - PA review and a PO merge instruction;
  - **G-1 (this design, pending PA, PO-1 and PO-2, and then an implementation mission)**;
  - G-4, G-5, gift-email recovery, USD-1, the portal configuration check, and Stripe production webhook configuration;
  - Terms wording (OP-3);
  - NEM-024 E-1 OPEN/BLOCKED, Checkpoint E NOT QUALIFIED.

**STOP for independent PA review.**

---

## R2. Round 2: PA findings resolution and PO-1 G-b closure

| | |
|---|---|
| **Mission** | G-1 / Round 2: resolve PA findings G1-R1 to G1-R5 (PO authorization, 2026-11-13). Documentation-only architecture correction. |
| **Status** | **Authoritative selected design** for G-1. It supersedes the passages marked ⛔ above. **Not implemented; not approved for implementation.** STOP for PA review. |

### R2.1 Baseline verification (2026-11-13)

| Check | Result |
|---|---|
| PR #60 | Head `7acd72e2f41929d3b7f04d749665bb42e3c4c788` = expected baseline; **Draft**, open, unmerged |
| PR #59 | Head `e326b81f262fbe99e10bb3fbeff6232f066eb230`, Draft, the unchanged direct parent |
| Local branch | `fix/payment-lifecycle-stabilization-20261112` at `7acd72e`, clean, level with `origin` |
| Governance read | `CLAUDE.md`; `COMMERCE-DECISIONS.md` (T-1, USD, D1–D6, F-01 Option B); this design (§§1–15) |
| Code re-inspected for R1–R5 | `subscriptions.service.ts` (`issueTokens` :79, `issueTokensForPurchasedPackage` :553, `addPurchasedBook` :568, `applyStripeSubscription` :940, `issueTrialStartTokens` :979, `issueTokensForNewSubscription` :588); `plans.service.ts` (`findTokenPackageById` :26); `token-ledger.entity.ts`; `token-package.entity.ts`; migrations 040 (token_ledger), 015 (user_books), 066 (stripe_processed_events); `webhooks.service.ts`; `stripe-fulfillment-ledger.ts`; `gifts.service.ts`, `gifts.controller.ts`; `success/page.tsx`; the four `checkout.sessions.create` call sites; `tests/` (grep) |
| Material divergence from the design's assumptions | **One, and it widens G1-F4** (R2.2, R1): the webhook's package lookup filters `active = true`. So a token key without tokens arises when the package is **inactive** at fulfillment, not only when it is deleted. Nothing else diverges, and this is not a baseline change, so no STOP applies. |

### R2.2 Resolution matrix

| Finding | Verdict | Resolution (detail in) | Code change needed? |
|---|---|---|---|
| **G1-R1** token fulfillment false positive (High) | **Confirmed, reproduced on real PostgreSQL. Resolved in the read-only design** | Delivery = ledger key **and** token rows written **in the same transaction** as that key. The new `unconfirmed` state covers a key without proven issuance. The frontend never says "tokens added" without proof. (R2.6) | None for G-1. An optional webhook correction (W-1) is proposed separately and is not implemented. |
| **G1-R2** premature Checkout finality (Medium) | **Confirmed. Resolved** | `open` is non-terminal and polled within the budget, with neutral copy afterwards. No copy claims "no charge" or "failed" for `open` or `expired`. (R2.5, R2.8, R2.10) | None |
| **G1-R3** entitlement vs token allocation (Medium) | **Confirmed** (active ≠ allocated). **Resolved per PA's provisional position** | No token field in v1. Subscription copy makes **no** token or payment claim. The existing "full access" body is flagged for PO-2. (R2.7) | None |
| **G1-R4** anonymous gift confirmation | **PO decision final: G-b. Applied** | The anonymous route, bearer authorisation and gift polling are removed. The authenticated route answers no gift session. Gift behaviour is unchanged. G-a is rejected; G-c is rejected or deferred. (R2.3) | None |
| **G1-R5** payment-method / webhook assumptions (Medium) | **Confirmed: latent, not active.** All four creation paths are card-only in code, but **no test pins it**, and omitting the list would hand the choice to Dashboard settings | Assumptions A1–A5 are documented. G-1 reads `payment_status` independently of the ledger. A STOP gate (SG-PM) is defined, plus a separate narrow corrective mission (W-2), not implemented. (R2.11) | None for G-1 |

### R2.3 PO-1 decision record: **G-b, final**

- **Decision (PO, 2026-11-13, final):** anonymous gift purchasers keep receiving the **existing generic confirmation messaging**.
- **Not authorised:** an anonymous gift-status endpoint, public session lookup, session-id bearer authorisation, any new credential, or related implementation. This decision is not reopened here.
- **Alternatives:** **G-a** (session id as bearer) is **rejected**. **G-c** (signed nonce, a new credential) is **rejected / deferred**: it would need a new PO decision and its own mission.

**Effect on the selected architecture:**

| Element | Result |
|---|---|
| `GET /gifts/checkout-sessions/:id/status` | **Removed.** Never to be built under G-1. |
| Authenticated route and gift sessions | A session whose Stripe metadata says `type = 'gift'` is **not answered**: it gets the uniform `404 checkout_session_not_found`, whoever asks. Because of G1-F2, no gift has a buyer account anyway. |
| Success page with `?purchase=gift` | **Unchanged:** the existing generic copy, **no API call**, nothing personal rendered. The existing test (`success-page.spec.tsx:226`) stays as is. |
| `POST /gifts/checkout`, gift fulfillment, e-mails, claiming, e-mail recovery | **Unchanged.** No JWT is added. G1-F2 is recorded as a finding only, with no action under G-1. |

`?purchase=gift` only ever **suppresses** the API call and shows conditional copy ("Once your payment is confirmed…"). It never leads to a payment or delivery claim, so this untrusted parameter cannot cause a false statement.

### R2.4 Corrected endpoint and response contract (selected) [Proposal]

**Architecture:** Option 2B's shared verifier behind **one** authenticated route, under the existing `/subscriptions` prefix. No second route is created.

| | |
|---|---|
| Route | `GET /subscriptions/checkout-sessions/:id/status` |
| Guard | `JwtAuthGuard` (existing). No `EmailConfirmedGuard` (rationale in §8.1). |
| Kinds answered | `subscription`, `tokens`, `book`, determined **only** from Stripe (`mode` and `metadata`). Gift sessions and non-Noetia sessions return 404. |
| Ownership | §7.1 rows for subscription, tokens and book (metadata user match; customer fallback only for a subscription session without metadata) |
| Validation | `:id` matches `^cs_(test\|live)_[A-Za-z0-9]{10,200}$`, else 404 with no Stripe call |
| Throttle | `@Throttle({ default: { limit: 30, ttl: 60_000 } })` per IP, on top of the global 120/min |
| Headers | `Cache-Control: no-store` |
| Errors | `401` (guard) · `404 { error: 'checkout_session_not_found' }` (unknown, malformed, not owned, gift, non-Noetia, wrong mode) · `429` · `503 { error: 'checkout_status_unavailable' }` (Stripe or database) |

```ts
type Checkout = 'open' | 'complete' | 'expired';
type Payment  = 'paid' | 'unpaid' | 'no_payment_required';

type CheckoutSessionStatus =
  | { kind: 'subscription';
      checkout: Checkout;
      // null unless checkout === 'complete'
      entitlement: null | 'not_recorded' | 'active' | 'payment_problem' | 'ended' | 'superseded' }
  | { kind: 'tokens' | 'book';
      checkout: Checkout;
      payment: Payment;
      // null unless checkout === 'complete' AND payment === 'paid'
      delivery: null | 'pending' | 'delivered' | 'unconfirmed' };
```

**Changes from §6.2, and why:**
1. **No gift variant** (G-b).
2. **No `payment` field for subscriptions.** A trial session reports `paid` for a $0 invoice (G1-F1), so subscription payment state can't support any customer statement. Leaving the field out makes "payment received" for a subscription **impossible to render from the API**. Subscription outcome is expressed only through `entitlement`.
3. **`delivery` gains `unconfirmed`, and is `null` unless the checkout is complete and paid** (R2.6, R2.11). The frontend can't show delivery for an unpaid or incomplete session, even if a ledger key exists.

**Never returned:** amounts or currency; e-mails or names; customer, subscription, invoice, plan, package or book ids; token counts; timestamps.

### R2.5 Corrected state machine and terminal-state rules

| # | Condition (server evidence) | Response | Poll within budget? | Terminal? | After the budget, or terminal: copy key (R2.10) | Admin? |
|---|---|---|---|---|---|---|
| R-S1 | `checkout=open` | `{checkout:'open', …: null}` | **Yes** (it may complete in another window, or the redirect may have outrun Stripe [Inference]) | **No** | `checkoutOpen` + "Check again". **No "no charge" or "failed" claim.** | No |
| R-S2 | `checkout=expired` | `{checkout:'expired'}` | No | Yes. Stripe: "No further processing will occur" | `checkoutExpired`, with **no charge claim** | No |
| R-S3 | tokens/book, `complete`, `payment ≠ paid` | `delivery: null` | Yes | No | `paymentNotConfirmed` | If it persists past Stripe's retry window, review (impossible under card-only; see A2) |
| R-S4 | tokens/book, `complete` + `paid`, **no key** | `delivery:'pending'` | Yes | No | `paidPending.{tokens,book}` + "Check again" | Only if pending past Stripe's retry window (§5.3) |
| R-S5 | tokens/book, `paid`, key **and** issuance proven (R2.6) | `delivery:'delivered'` | No | **Yes** | `delivered.{tokens,book}` | No |
| R-S6 | tokens/book, `paid`, key **but issuance not proven** | `delivery:'unconfirmed'`; server logs `WARN [checkout-status] fulfillment key without proven issuance` with user id and truncated session id | No (it can't change without intervention) | **Yes** | `unconfirmed.{tokens,book}` | **Yes**: investigate and grant manually through existing admin tools. The verifier never grants. |
| R-S7 | subscription, `complete`, no row tracking `session.subscription` | `entitlement:'not_recorded'` | Yes | No | Existing `pendingTitle` / `pendingBody` | As R-S4 |
| R-S8 | subscription, row tracks it, status `trialing`, `active` or `canceling` | `entitlement:'active'` | No | Yes | `subscriptionActive`, with **no token or payment claim** (R2.7) | No |
| R-S9 | subscription, row tracks it, `past_due` | `'payment_problem'` | No | Yes | Existing `problem` | No |
| R-S10 | subscription, row tracks it, `canceled` | `'ended'` | No | Yes | `subscriptionEnded` | No |
| R-S11 | subscription, row tracks **another** subscription | `'superseded'` | No | Yes | `subscriptionOther` | Only for `DUPLICATE_LIVE_SUBSCRIPTION`, which is already logged |
| R-S12 | Stripe or database unavailable | `503` | Yes, with backoff | No | `unavailable` | No |
| R-S13 | Unknown, malformed, not owned, gift, non-Noetia | `404` | No | Yes | `notFound` | No |
| R-S14 | No JWT or refresh failed | `401` | No | — | Existing `auth` view; the sign-in link **keeps** `session_id` and `purchase` (G1-F5) | No |
| — | `?purchase=gift` | **no request** | — | — | Existing generic gift copy (G-b) | No |

**Terminal rule.** Polling stops **only** on R-S2, R-S5, R-S6, R-S8 to R-S11, R-S13 and R-S14. Every other state continues until the budget ends, then shows its copy with "Check again". Pressing it starts a new budget.

### R2.6 Corrected fulfillment evidence (G1-R1)

**Trace of the current token transaction [Verified: code]:**
1. `handleEvent` opens **one** transaction.
2. `claimStripeKey(event.id)` runs, then `handlePaymentCompleted` claims `fulfillment:checkout-session:<cs>` with `INSERT … VALUES (…, now())`.
3. `issueTokensForPurchasedPackage` calls `plansService.findTokenPackageById(id)`, which is **`findOneBy({ id, active: true })`**.
4. If that returns null, it logs a warning and returns. **The transaction commits with the key and no token row.**
5. Otherwise `issueTokens` calls `tokenRepo.save(...)` with the same `EntityManager`. `token_ledger."createdAt"` is `DEFAULT now()` (migration 040), and TypeORM inserts `DEFAULT` for a `@CreateDateColumn`.

**When a key exists without tokens:** the package is **inactive or deleted** between Checkout creation and webhook processing. For example, an admin deactivates or replaces a package while a customer is paying, or a webhook retry arrives after a deactivation. Reactivating the package later does not undo it. So "the package exists now" is **not** valid evidence either.

**Durable link between tokens and a session (existing data, no migration).** No column references the session: `token_ledger` has `userId`, `subscriptionId` (null for packages), `reason` (`Purchased <name>`), `issuedAt` (application time) and `createdAt` (database `now()`). But PostgreSQL's `now()` is the **transaction start time**, so the key's `"processedAt"` and the token rows' `"createdAt"` are **identical** when, and only when, they were written in the same transaction:

```sql
-- proof of issuance for a token-package session (read-only)
SELECT count(*) FROM token_ledger t
JOIN stripe_processed_events k ON k."eventId" = 'fulfillment:checkout-session:' || $session
WHERE t."userId" = $metadataUserId
  AND t."createdAt" = k."processedAt"
  AND t."subscriptionId" IS NULL AND t.type = 'paid' AND t.reason LIKE 'Purchased %';
```

**Evidence: real PostgreSQL probe.**
- **Setup:** disposable `postgres:16-alpine` with all 68 migrations, removed afterwards. The **real** `WebhooksService` and `SubscriptionsService` ran with fake Stripe. The probe was a scratchpad copy of the harness and is **not committed**; no repository script changed.

| Probe | Result |
|---|---|
| P1 normal purchase | Key present; correlated rows = package count (10); `createdAt == processedAt` **PASS** |
| P2 package inactive at fulfillment, reactivated afterwards | Key present, **0 tokens**. A key-only check would report "delivered": **false positive reproduced**. Correlation = 0, so "not proven". **PASS** |
| P3 40 rounds × 3 concurrent purchases by one user, plus a concurrent non-webhook grant with reason `Purchased forged` | Correlated count wrong in **0/120** sessions; `processedAt` collisions between sessions **0**; the forged grant never matched. **PASS** |
| P4 tokens later redeemed | Issuance still proven. Rows are never deleted except by account deletion, which removes the requester too. **PASS** |

**Properties and limits (stated plainly):**
- **Fails safe under refactor.** If issuance ever moved to another transaction, or `createdAt` were set by the application, the timestamps would differ and the result would be `unconfirmed`. That is a **false negative, never a false positive**.
- **Residual false-positive condition.** All of the following must hold at once:
  - the session's own fulfillment issued **nothing**;
  - **another** paid, non-subscription `Purchased …` grant for the **same user** ran in a different transaction that started in the **same microsecond**.
  
  0 occurrences in 120 concurrent trials. This is the only known path, and it is far below any practical threshold [Inference]. PA should accept or reject it explicitly (PA-R1).
- **Implicit coupling.** The design relies on how the webhook writes rows today. The implementation must pin that coupling with a test (T-R1d) so a refactor shows up as a test failure, not silent `unconfirmed` answers.
- **Read-only.** One extra indexed `SELECT`, using the `token_ledger (userId, …)` index.
- **Atomicity.** Under READ COMMITTED, the verifier never sees the key without the rows of a transaction still in flight: they commit atomically.

**Fallback if PA rejects the correlation (R1-B):** tokens report only `pending` or `unconfirmed`, **never `delivered`**, until a webhook correction makes the key sufficient. The copy then says "Payment confirmed. Check your token balance." with no arrival claim. This is safe but less informative.

**The four required outcomes:**

| Outcome | Evidence | `delivery` |
|---|---|---|
| Payment confirmed, issuance proven | `paid` + key + correlated ≥ 1 | `delivered` |
| Payment confirmed, fulfillment pending | `paid` + no key | `pending` |
| Payment confirmed, fulfillment uncertain (verification couldn't run) | Stripe or database error | **HTTP 503**, no `delivery` at all |
| Key present, issuance not proven | `paid` + key + correlated = 0 | `unconfirmed` |

**Books.** `delivered` needs the key **and** `user_books (metadata.userId, metadata.bookId)`. A key without the row gives `unconfirmed`. A row without the key (the book was already owned) gives `pending` until the key exists (conservative). Ownership is permanent, so `delivered` can't regress, except when the book row itself is deleted, which cascades.

**Subscriptions.** As in §6.3: `session.subscription == row.stripeSubscriptionId` plus status. No token evidence is used (R2.7).

**Separate webhook correction W-1 (proposed, NOT implemented, needs its own authorization).**
- **Change:** `issueTokensForPurchasedPackage` would **throw** when the package can't be resolved. The transaction (and the key) would roll back, Stripe would retry, and an operator would see the failure.
- **Policy question first:** should a customer who paid for a package that became inactive mid-checkout receive it (look up by id regardless of `active`), or be held for manual review? That is a **PO policy decision for W-1** (W1-PO), not part of G-1.
- **After W-1,** a key alone would imply issuance. The correlation can stay as defence in depth.

### R2.7 Subscription entitlement vs token allocation (G1-R3)

**Verified relationships [Verified: code]:**

| Path | Entitlement written | Initial tokens written | Same transaction? |
|---|---|---|---|
| Eligible trial (T-1) | `applyStripeSubscription` → `upsertFromWebhook` | `issueTrialStartTokens`, only if `applied && sub.status === 'trialing' && trial_end && row.plan` | **Yes**. But the row can be `trialing` **without** tokens when the price maps to no plan (`row.plan` null; the key stays unclaimed). |
| Returning subscriber, paid creation (D1 / F-01 Option B) | Any subscription event (created, updated, checkout completed) | `invoice.paid` with `subscription_create` and amount > 0, under the period and invoice keys | **No.** The row can be `active` before `invoice.paid` is processed. F-02's fail-closed path can delay the grant further. |
| Renewals and annual cycles | — | `invoice.paid` / scheduler | Independent of the session |

**Conclusion.** An active entitlement **does not** prove initial allocation. G-1 v1 **omits** token verification for subscriptions, per PA's provisional position, **on the condition** that no subscription state renders a token-delivery or payment claim.

**Permissible statements when entitlement is active and allocation unknown:**
- "Your subscription is active."
- Navigation to billing or the library.

**Not permitted:**
- any token count or arrival;
- "payment received" or "confirmed";
- "full access … start reading right away".

The existing approved interim `body` ("Your account has full access. Start reading right away.") **can be read as a promise that books are available now**, which depends on tokens. It is flagged for PO-2, with a neutral draft in R2.10.

T-1, D1–D6 and F-01 Option B are untouched, because nothing in the verifier writes.

### R2.8 Security, privacy, polling and failure behaviour

**Security and privacy (unchanged from §7 except gifts):**
- **Authenticated route only.** No anonymous access path exists anywhere in the selected design.
- **One uniform 404** for unknown, malformed, not owned, gift and non-Noetia sessions.
- **Error bodies** carry no Stripe messages.
- **Logs** carry the user id and a truncated session id only.
- **Never returned:** the fields listed in R2.4.
- **Sentry:** mask `session_id` before Sentry is ever enabled (PA-7). Existing controls are enough: the throttler, `JwtAuthGuard`, and Stripe's unguessable ids. No privacy risk needs a new control, so the STOP gate is not triggered.

**Polling:**
- **Start:** immediately on load.
- **Schedule:** 2 s × 5, then 4 s × 5, so at most 11 requests in about 32 s.
- **Stop:** only on the terminal states in R2.5.
- **`open` keeps polling** (R-S1) inside the same budget. There is no longer polling and no redirect back to Checkout: a recovery workflow is **out of scope**, and G-4 stays separate.
- **503:** backoff inside the budget. **429:** honour `Retry-After`.
- **Unmount:** abort (`AbortController` plus the existing run counter).
- **Check again:** starts a new budget.
- **Not called** on the session flow: `POST /subscriptions/sync` or `/subscriptions/me`.
- **No `session_id`:** today's account-status flow, unchanged.
- **`?purchase=gift`:** no request.

**Frontend derivation rule (normative).** The page chooses copy **only** from this function of the API response. `?purchase=` never selects kind or state, except the gift suppression in R2.3. Nothing is inferred from `/subscriptions/me`, `/sync` or any other subscription.

```text
gift param             → giftGeneric (no request)
401                    → auth (keep session_id)
404                    → notFound
503 / 429 after budget → unavailable
subscription: checkout open → checkoutOpen | expired → checkoutExpired
              entitlement null/not_recorded → pending | active → subscriptionActive | payment_problem → problem
              ended → subscriptionEnded | superseded → subscriptionOther
tokens|book:  checkout open → checkoutOpen | expired → checkoutExpired
              delivery null (complete, payment ≠ paid) → paymentNotConfirmed
              pending → paidPending.<kind> | delivered → delivered.<kind> | unconfirmed → unconfirmed.<kind>
```

### R2.9 Updated implementation-test requirements (authoritative)

These replace §11. They keep T-A1 to T-A3, T-A5, T-A6, T-F2, T-F3 (moot now), T-S1, T-S2, T-O1, T-E1, T-RO, T-T1, T-L1 and T-W1 to T-W8 as amended below.

| ID | Test |
|---|---|
| T-A4′ | **Gift sessions** (empty or non-empty `buyerUserId`) → uniform 404 on the authenticated route, with a body identical to an unknown id. **No gift route exists** (route-table assertion). |
| T-R1a | Tokens: `paid`, key, correlated rows → `delivered` |
| T-R1b | Tokens: `paid`, key, **no** rows (package inactive at fulfillment) → **`unconfirmed`**, never `delivered`. Negative control: the same fixture through a key-only check would say delivered, and the test asserts the verifier does not. |
| T-R1c | Tokens: key plus a same-user `Purchased …` grant with a **different** `createdAt` → `unconfirmed`. A trial or renewal grant at the same instant (non-null `subscriptionId` or another reason) → not counted. |
| T-R1d | Coupling pin: issuance rows and the key share the transaction timestamp. Real-PostgreSQL scenario in the harness (PA-11), or a unit assertion that `issueTokens` leaves `createdAt` to the database default. |
| T-R1e | Book: key without a `user_books` row → `unconfirmed`; row without key → `pending`; both → `delivered` |
| T-R1f | `unconfirmed` emits exactly one WARN log, with no metadata |
| T-R2a | `open` is **not** terminal: polling continues within the budget; an `open` → `complete` transition during polling reaches the right state |
| T-R2b | `open` after the budget and `expired` render copy **without** any "no charge", "not charged", "failed" or "sin cargo" wording (dictionary guard on those keys, EN and ES) |
| T-R3a | Subscription `entitlement:'active'` with **no** trial-start or period key in fixtures → page shows `subscriptionActive` and **no** token or payment wording (dictionary guard: no "token", "pago", "payment", "full access", "acceso completo") |
| T-R3b | The subscription response has **no `payment` property** (schema snapshot) |
| T-R5a | Tokens/book `complete` + `unpaid` **with** a ledger key (simulated anomaly) → `delivery: null` and copy `paymentNotConfirmed`, never delivered or "payment confirmed" |
| T-R5b | `no_payment_required` on tokens/book → `delivery: null` (not paid, so no payment or delivery claim) |
| T-R5c | `complete` + `paid` + no key → `pending`, regardless of `?purchase=` |
| T-W5′ | `?purchase=gift` → **no API request**, existing generic copy, no session id, e-mail or amount rendered (the existing test is kept) |
| T-W9 | Derivation rule: a table-driven test over every response shape in R2.4 → exactly the copy key in R2.8. `?purchase=tokens` with a subscription response renders subscription copy. An entitled account from another source never yields `subscriptionActive` without `entitlement:'active'`. |

**Removed:** T-A4 (anonymous gift 200) and the G-a branch of T-W5.

### R2.10 Draft bilingual copy implications

> **DRAFT — REQUIRES PRODUCT OWNER APPROVAL (PO-2).** Not approved for publication. These replace the §8.3 entries named; other §8.3 entries (`subscriptionEnded`, `subscriptionOther`, `notFound`) stay drafts.

| Key | EN (DRAFT, PO-2) | ES (DRAFT, PO-2) |
|---|---|---|
| `checkoutOpen` | This checkout hasn't been completed yet. If you finished paying in another window, check again in a moment. | Este pago aún no se ha completado. Si terminaste de pagar en otra ventana, vuelve a comprobarlo en un momento. |
| `checkoutExpired` | This checkout expired before it was completed. | Este pago expiró antes de completarse. |
| `paymentNotConfirmed` | We haven't received confirmation of your payment yet. | Aún no recibimos la confirmación de tu pago. |
| `paidPending.tokens` | Payment confirmed. Your tokens haven't been added yet. This usually takes less than a minute. | Pago confirmado. Tus tokens aún no se han agregado. Suele tardar menos de un minuto. |
| `paidPending.book` | Payment confirmed. The book hasn't been added to your library yet. This usually takes less than a minute. | Pago confirmado. El libro aún no se ha agregado a tu biblioteca. Suele tardar menos de un minuto. |
| `delivered.tokens` | Payment confirmed. Your tokens have been added to your balance. | Pago confirmado. Tus tokens se agregaron a tu saldo. |
| `delivered.book` | Payment confirmed. The book is in your library. | Pago confirmado. El libro ya está en tu biblioteca. |
| `unconfirmed.tokens` | Payment confirmed, but we couldn't confirm that your tokens were added. Check your token balance, and contact us if they're missing. | Pago confirmado, pero no pudimos confirmar que tus tokens se agregaran. Revisa tu saldo de tokens y contáctanos si no aparecen. |
| `unconfirmed.book` | Payment confirmed, but we couldn't confirm that the book was added. Check your library, and contact us if it's missing. | Pago confirmado, pero no pudimos confirmar que el libro se agregara. Revisa tu biblioteca y contáctanos si no aparece. |
| `subscriptionActive` title | *(existing)* Your subscription is active | *(existing)* Tu suscripción está activa |
| `subscriptionActive` body | You can manage your plan from your billing page. *(replaces the existing "full access… start reading right away", flagged under R2.7)* | Puedes gestionar tu plan desde tu página de facturación. |
| `unavailable` | We can't check right now. Your payment isn't affected. Try again in a moment. *(unchanged)* | No podemos verificarlo ahora. Tu pago no se ve afectado. Inténtalo de nuevo en un momento. |
| gift | *(existing generic copy, unchanged; G-b)* | *(existente, sin cambios)* |

**Rules applied:**
- **"Payment confirmed" / "Pago confirmado"** appears only in token and book keys reachable with `payment = 'paid'`, **never** in subscription keys.
- **No key claims** "no charge", "failed", "sent" or "e-mailed".
- **"Tokens added" or "book in library"** appears only for `delivered`.
- **"Contact us"** points to the existing `/contact` page; no new channel.
- **Web only:** `services/web/lib/i18n/{en,es}.ts`. The parity test applies. The "payment received" guard needs a scoped allowance for "Payment confirmed" (PA-10).
- **Not changed here:** Terms and Privacy Policy.

### R2.11 Payment-method and webhook assumptions (G1-R5)

**Card-only at every creation path [Verified: code]:** `subscriptions.service.ts:387` (subscription), `:516` (book), `:542` (tokens), and `gifts.service.ts:67` (gift) all pass `payment_method_types: ['card']`.

The code sets none of the options that could make a completed payment-mode session unpaid or zero-amount: `allow_promotion_codes`, `discounts`, `payment_intent_data.capture_method` or `payment_method_collection`.

**Could Dashboard settings widen this?** Not while the explicit list is passed [Inference from Stripe docs]. Stripe's dynamic-payment-methods guide tells integrations that list methods explicitly to *"remove `payment_method_types` from your integration code"* to manage them in the Dashboard. The overview says *"If your integration lists payment methods explicitly with `payment_method_types`, you must update your code to add a payment method."* The converse risk is real: **if a future edit drops the parameter, Stripe falls back to Dashboard-managed methods**, which can include delayed-notification methods common in Latin America [Inference]. **No test pins `['card']` at any of the four call sites** (grep of `services/api/tests`: 0 matches). The restriction is enforced by code alone.

**Assumptions under which `checkout.session.completed` is sufficient for today's payment-mode fulfillment:**

| ID | Assumption | Status |
|---|---|---|
| A1 | Every payment-mode session is created with `payment_method_types: ['card']` | **Verified: code** (3 sites). Not test-pinned. |
| A2 | A card Checkout session reaches `complete` only after the card payment succeeded (3DS happens inside Checkout), so `payment_status = 'paid'` | **[Inference / Unverified]**: Stripe's fulfillment guide still checks `payment_status` in its sample |
| A3 | No manual capture, discounts or promotion codes (amount > 0, captured) | Verified: code (absent) |
| A4 | Subscription-mode sessions don't depend on it: entitlement comes from re-reading the subscription, and tokens from T-1 (`trialing`) or `invoice.paid` (fires only when an invoice is paid) | Verified: code |
| A5 | The production webhook endpoint subscribes to `checkout.session.completed` (and the subscription and invoice events) | **Unverified**: Stripe production webhook configuration is an open release blocker |

**How G-1 interprets `payment_status`:**
- It is read from Stripe on every request and **never** derived from the ledger.
- `delivery` is evaluated only when `payment === 'paid'`.
- For subscriptions it is not returned at all.

So even if A1 or A2 were violated, the endpoint **cannot** produce a payment or delivery claim for an unpaid session (T-R5a, T-R5b).

**Future STOP gate SG-PM (to record in the release-blocker list).** Before any of the following:
- enabling a non-card payment method;
- removing or widening `payment_method_types` at any call site;
- adding promotion codes, discounts or manual capture to Checkout;

**STOP for a PA review and complete W-2 first.**

**Separate corrective mission W-2 (proposed, narrowly scoped, NOT implemented):**
1. **Test-only:** pin `payment_method_types: ['card']` at all four call sites.
2. **Webhook guard:** `handlePaymentCompleted` claims the session key and fulfills **only** when `session.payment_status === 'paid'`. Otherwise it logs and returns without claiming.
3. **Async events,** only if delayed methods are ever approved: handle `checkout.session.async_payment_succeeded` through the same path, and log `…async_payment_failed`.

Item 1 is low-risk and could precede launch. Items 2 and 3 change webhook execution and need their own authorization (PA-W2).

### R2.12 Remaining risks, STOP gates and open decisions

**Remaining risks:**

| Risk | Level | Mitigation |
|---|---|---|
| Token correlation residual (same-user, same-microsecond, other-transaction grant plus a session that issued nothing) | Negligible [Inference; 0/120 measured] | PA-R1 acceptance, or the R1-B fallback; W-1 removes the cause |
| A refactor silently breaks the correlation | Low (fails safe to `unconfirmed`) | T-R1d pin |
| A future edit drops `['card']` | Medium (latent) | SG-PM; W-2 item 1 |
| Gift buyers never linked (G1-F2) | Recorded only | Out of G-1 (G-b); any change needs a new PO decision |
| Gift e-mail failure is invisible to the buyer | Unchanged (existing blocker) | Gift-email recovery mission (not G-1) |

**STOP-gate review (mission §12): none triggered.**
1. No finding needs production code for G-1.
2. No new field, table or infrastructure.
3. No commercial policy changed.
4. The response can't yield a false payment or delivery claim (R2.4, R2.6, R2.11).
5. Privacy is constrained by existing controls.
6. G-b is honoured with gift behaviour unchanged.
7. The baseline is unchanged.
8. Nothing expands into G-4 or another mission: W-1 and W-2 are proposals only.

**Open PA decisions:**

| ID | Decision | Recommendation |
|---|---|---|
| PA-1′ | Selected architecture: Option 2B shared verifier, **one** authenticated route, `/subscriptions` prefix | Accept |
| PA-2′ | Contract R2.4: no subscription `payment` field, nullable `delivery` / `entitlement`, `unconfirmed` | Accept |
| **PA-R1** | Token issuance proof by same-transaction timestamp correlation (R2.6), including its stated residual; **or** fallback R1-B (never `delivered` for tokens before W-1) | Accept the correlation |
| PA-4 / PA-5 | Throttle 30/min/IP; polling ≤ 11 requests over about 32 s, `open` included | Accept |
| PA-7 | Truncated session ids in logs; mask `session_id` in Sentry before enabling it | Accept |
| PA-8 | Browser-triggered reconciliation stays out of G-1 (separate decision) | Confirm |
| PA-10 | Scoped allowance for "Payment confirmed" in the dictionary guard (token and book keys only) | Accept |
| PA-11 | The real-PostgreSQL harness scenario for T-R1d and read-during-fulfillment | Recommend (makes the coupling pin real) |
| PA-W1 | Whether to commission W-1 (webhook fail-closed on an unresolved package) | Recommend, after W1-PO |
| PA-W2 | Whether to commission W-2 (item 1 test pins; items 2–3 webhook payment-status guard) | Recommend item 1 before launch; items 2–3 before SG-PM |
| PA-SG | Add SG-PM to the release-blocker register | Accept |

**Product Owner decisions:**

| ID | Decision | Status |
|---|---|---|
| PO-1 | Anonymous gift confirmation | **Closed: G-b (final, 2026-11-13)** |
| **PO-2** | EN/ES wording (R2.10 plus the remaining §8.3 drafts), including replacing the existing `subscriptionActive` body | **Open** |
| W1-PO | *Only if W-1 is commissioned:* should a package purchase that became inactive mid-checkout be honoured, or held for manual review? | Not required for G-1 |

### R2.13 Recommended bounded implementation scope (for PA/PO consideration; not started, not authorised)

**Proposed title:** "G-1 implementation: authenticated read-only Checkout-session status".

**Includes:**
- `CheckoutStatusService` (shared verifier, R2.4 to R2.6);
- **one** route: `GET /subscriptions/checkout-sessions/:id/status`;
- the success-page session flow, following the R2.8 derivation rule;
- web i18n keys, **only after PO-2 approval**;
- the tests in R2.9, with T-R1d through the harness if PA-11 is accepted.

**Excludes:**
- any gift route or gift change;
- webhook changes (W-1, W-2);
- reconciliation;
- G-4;
- mobile;
- migrations, configuration and infrastructure;
- Terms and Privacy Policy;
- prices and token rules;
- PR #59.

**Gates:**
- **Coverage:** ≥ 80% for the new service.
- **Existing payment suites stay green:** `--maxWorkers=2`.
- **T-RO and T-R1b** are mandatory.
- **Evidence:** EN and ES screenshots for every R2.5 state.
- **Hand-off:** STOP for PA review.

### R2.14 Confirmation: no implementation

- **The only file changed is this design document.** It gained the §R2 section, a superseded-sections banner at the top, and ⛔ markers inline; §§1–15 are otherwise unchanged as historical evidence.
- **Nothing else changed:** no application code, tests, scripts, migrations, Stripe integration or configuration, webhook execution, token issuance, book ownership, gift flow, frontend, eligibility or economics, Terms, Privacy Policy, Noetia+/NoetiaX, PR #59, infrastructure, staging or production.
- **The R1 probe** ran from a scratchpad copy against a disposable local container, which has been removed. It made no Stripe requests or transactions.
- **PR #60 remains Draft.** No merge, deployment or activation.

**STOP for independent PA review.**
