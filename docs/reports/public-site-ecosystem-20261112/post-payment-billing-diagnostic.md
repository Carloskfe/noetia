# Post-payment and account-billing diagnostic

**Requested by:** PA final payment-flow review of PR #59 at `25e956f`, section B.
**Status:** diagnosis and recommendation only. **Nothing here has been implemented.** Implementation needs further PO authorization.
**Method:**
- read the code at `f7c9118`;
- cross-reference the verified API auth contract (`services/api/tests/unit/subscriptions/subscriptions-auth.contract.spec.ts`).

There is no Stripe, staging or production access. Statements about Stripe's event sequence come from Stripe's documented behaviour and have **not** been observed on a live account. They are marked *(unverified)*.

## 1. Scope

| Surface | File |
|---|---|
| Post-payment page | `services/web/app/(billing)/billing/success/page.tsx` |
| Account billing page | `services/web/app/(account)/account/billing/page.tsx` |
| Unused helper | `services/web/lib/billing-utils.ts`: imported only by `tests/unit/app/billing/success.spec.ts`; no page uses it |
| API: sync, status, billing | `services/api/src/subscriptions/subscriptions.controller.ts`, `subscriptions.service.ts` |
| API: webhooks | `services/api/src/subscriptions/webhooks.controller.ts`, `webhooks.service.ts` |
| API: entitlement | `services/api/src/subscriptions/subscription.guard.ts` |

**Auth contract** (same as for `/pricing`): the JWT is read **only** from `Authorization: Bearer`, and the refresh cookie alone is rejected. Endpoint guards:

| Endpoint | Guards |
|---|---|
| `GET /subscriptions/me` | JWT |
| `POST /subscriptions/sync` | JWT |
| `GET /subscriptions/linked-users` | JWT |
| `DELETE /subscriptions/linked-users/:id` | JWT |
| `DELETE /subscriptions/invite/:id` | JWT |
| `POST /subscriptions/portal` | JWT + confirmed email |
| `POST /subscriptions/resume` | JWT + confirmed email |
| `POST /subscriptions/cancel` | JWT + confirmed email |
| `POST /subscriptions/invite` | JWT + confirmed email |

## 2. Answers

### 2.1 Are successful Stripe payments reconciled independently through webhooks?

**Yes.** Webhooks, not the browser, are the system of record.

**Webhook endpoint:** `POST /webhooks/stripe`.
- It verifies the `stripe-signature` header.
- It is idempotent through the `stripe_processed_events` ledger.
- A row is written only after the side effects succeed. A failure returns non-2xx, so Stripe retries.

**Handled events:**

| Event | Effect |
|---|---|
| `checkout.session.completed`, subscription mode | Upserts the subscription row by `userId`, as `status: 'active'`, with `stripeSubscriptionId` and `stripeCustomerId` |
| `checkout.session.completed`, payment mode | Gift fulfilment, token-package issue, or book purchase, keyed by metadata |
| `invoice.paid` | Upserts `active` and the period end, then issues the cycle's tokens |
| `invoice.payment_failed` | Sets `past_due` |
| `customer.subscription.updated` | Sets status, period, trial end **and `planId`** from the price |
| `customer.subscription.deleted` | Sets `canceled` |

The user is matched by `stripeCustomerId`. That ID is written to the user before the Checkout session is created, in `getOrCreateStripeCustomer`.

**Entitlement:** `SubscriptionGuard` reads only the subscription row: `active`, `trialing` or `canceling` grant access; `past_due` returns 403 `payment_required`. **The browser plays no part in granting access.**

### 2.2 Can a failed browser sync leave a customer without the expected entitlement?

**Not by itself.** `POST /subscriptions/sync` only re-reads Stripe for a row that **already** has a `stripeSubscriptionId`, and that ID is written only by the webhook. Two cases:

| Timing | Effect of sync |
|---|---|
| Before the webhook arrives | `{ status: 'none' }`; nothing written |
| After the webhook | Refreshes status, period and trial end |

**Today the browser sync always fails:** plain `fetch`, no Bearer, 401. Production entitlement is therefore already webhook-only. Two consequences:

**Cosmetic: the status during the trial.**
- `checkout.session.completed` writes `active`, while Stripe reports `trialing` (`trial_period_days: 14`).
- A working sync would correct this. Access is the same either way, because both statuses are allowed.

**Real gap, independent of the browser: `planId` stays `null` after the first purchase.** Code reading, with the event sequence *(unverified)*:
- `planId` is written **only** from `customer.subscription.updated`.
- The first purchase emits:
  - `customer.subscription.created`, **not handled**;
  - `checkout.session.completed`, which carries no `planId`;
  - `invoice.paid` for the $0 trial invoice, also without a `planId`.
- `customer.subscription.updated` typically fires at the trial→active transition, about 14 days later. Until then, `planId` is `null`, and:
  - **No tokens for the trial invoice:** `issueTokensForNewSubscription` returns early when `sub.plan` is missing. Whether a trial should receive the cycle token is a product decision; today it silently receives none.
  - **No plan name:** `/subscriptions/me` returns `planId: null` and `planName: null`.
  - **Duplicate subscription not blocked:** `/pricing` cannot mark the plan current, so it does not prevent a second checkout for the same plan. The correction in `f7c9118` blocks checkout only when the status is *unknown*, and it marks a plan current only when `planId` is set.
- At the trial end, the order of `customer.subscription.updated` and `invoice.paid` is not guaranteed *(unverified)*. The first paid cycle's tokens could also be skipped if `invoice.paid` is processed first.

**Real gap, API side: a second subscription orphans the first.**
- `createCheckoutSession` never checks for an existing live subscription.
- `upsertFromWebhook` upserts on `conflictPaths: ['userId']`.
- A second checkout therefore overwrites the user's row with the new `stripeSubscriptionId`. The first Stripe subscription keeps billing, and Noetia no longer tracks it.
- This is a double-billing risk. **It is not a browser-sync issue, and it is outside "web only".**

### 2.3 How can the success page tell a successful sync from a failure?

**Today it cannot.** `.finally(() => setSynced(true))` shows the call-to-action whatever the result, and the copy is unconditional: "Subscription activated! Your account is now active."

`POST /subscriptions/sync` already returns everything needed, since it returns `getSubscriptionStatus`:

| Response | Meaning | Page should show |
|---|---|---|
| 200, `status ∈ {active, trialing, canceling}` | Webhook processed; access granted | **Confirmed**: current copy and CTA |
| 200, `status: 'none'` | Webhook not processed yet | **Pending**: re-check `/subscriptions/me` with backoff (e.g. 5 tries over about 20 s); then "Payment received; your access usually appears within a few minutes", with a retry and a link to account billing |
| 200, `past_due` | Payment problem | Link to manage billing |
| 401 after refresh | No session | `/login?next=/billing/success` |
| 5xx or network | Unknown | **Unconfirmed**: same pending copy with a retry. **Never** "activated" |

`session_id` (`{CHECKOUT_SESSION_ID}`) is in the URL but unused. It is not needed for this logic.

### 2.4 Which account-billing actions fail because the Bearer token is missing?

**All of them.** Every call uses plain `fetch` against Bearer-only endpoints:

| Action | Call | Today |
|---|---|---|
| Page load | `GET /subscriptions/me` | 401. The body `{message, statusCode}` has no `status`, so the page falls back to `'none'` and **every user, including paying subscribers, sees "No tienes un plan activo" and "Ver planes"**. That invites a second subscription; see §2.2. |
| Page load | `GET /subscriptions/linked-users` | 401, ignored |
| Gestionar facturación | `POST /subscriptions/portal` | 401. The page reads `url` as `undefined` and sets `window.location.href = undefined`, which navigates to `/undefined` |
| Actualizar estado | `POST /subscriptions/sync` | 401, ignored |
| Reanudar suscripción | `POST /subscriptions/resume` | 401, ignored |
| Invitar usuario | `POST /subscriptions/invite` | 401. Shows "No se pudo enviar la invitación." |
| Eliminar miembro | `DELETE /subscriptions/linked-users/:id` | 401, ignored |
| Revocar invitación | `DELETE /subscriptions/invite/:id` | 401, ignored |

Because the load always falls back to "no plan", none of the other controls are reachable in practice.

The profile page (`app/(library)/profile/page.tsx`) already uses `apiFetch('/subscriptions/me')`, so its plan summary can disagree with the billing page.

## 3. Recommendation: smallest safe correction

These are proposed as **separate missions**. Only R-1 is web-only and low-risk. R-2 changes Stripe and subscription handling, which PR #59 does not authorize.

### R-1 (web only): authenticate and report the success and account-billing pages honestly

Reuse the same mechanism as `/pricing`: `apiFetch` with `{ redirectOnAuthFailure: false }` where the page must render its own state. No API, Stripe or entitlement change.

**1. Success page**
- Call `apiFetch('/subscriptions/sync', { method: 'POST' }, OPTIONAL_AUTH)`.
- Implement the states in §2.3: confirmed, pending (with bounded polling of `/subscriptions/me`), unconfirmed with retry, and auth → `/login?next=/billing/success`.
- Show "activated" only when confirmed.
- New web en/es strings, following the four-file rule only where copy is shared. The success page is web-only.

**2. Account billing page**
- Route every call through `apiFetch`.
- When `/me` fails, show an error with a retry, **not** "no active plan".
- Portal: navigate only if a `url` is returned; otherwise show an error.
- Show failures for sync, resume, invite, remove and revoke, and keep the current Spanish copy. Localizing it is a separate finding.

**3. `lib/billing-utils.ts`**
- Delete it with its test, or port it to `apiFetch`. Today it is dead code that encodes the header-less pattern.

**Join and gift claim** (S-1) have the same pattern and could be included, or kept separate.

**Tests for R-1:**
- **Success page:**
  - Bearer sent;
  - sync live → confirmed;
  - sync `none` → polling → confirmed;
  - polling exhausted → pending copy, never "activated";
  - 5xx and network → unconfirmed plus retry, then retry succeeds;
  - 401 with refresh failing → login with `next`;
  - expired token plus refresh → confirmed.
- **Account billing:**
  - Bearer on every call;
  - `/me` 5xx → error state, not "no plan";
  - subscriber renders the plan card;
  - portal returns `url` → navigates; portal failure → no navigation to `undefined`;
  - invite 401 with refresh → retried with the new token;
  - resume, remove and revoke failures shown.
- **API contract** (extend `subscriptions-auth.contract.spec.ts`):
  - `sync`, `portal`, `resume`, `linked-users`, `invite` and `DELETE` reject a refresh cookie alone and accept a valid Bearer;
  - `portal` and `resume` with an unconfirmed email → 403.

### R-2 (API, Stripe handling): needs explicit PO authorization; touches subscription handling, not economics

- **Record `planId` at creation.** Handle `customer.subscription.created`, or derive the price from the subscription in `checkout.session.completed`. This also removes the trial-token gap. Whether a trial should receive tokens must be confirmed by the PO first.
- **Reject duplicate subscriptions.** `createCheckoutSession` should return 409 when the user already has a subscription in `active`, `trialing`, `canceling` or `past_due`. `/pricing` would then direct plan changes to the billing portal.
- **Correct the trial status.** Write the real Stripe status (`trialing`) from the webhook instead of `active`.
- **Tests for R-2:**
  - webhook unit tests for each event order;
  - service test for the 409;
  - contract test that a duplicate checkout is rejected.

### Order

1. R-1 (success page and account billing) together with S-2 (`noetia_token`), because both affect paying users.
2. R-2 before any real-money activation. The duplicate-subscription and `planId` gaps should block the payment launch more than any web issue does.

## 4. Boundaries

- Diagnosis only: no code, API, Stripe, economics, entitlement, migration or infrastructure change.
- No Stripe, staging or production access was used.
- PR #59 stays Draft. PRs #56–#58 are untouched. NEM-024: E-1 OPEN and BLOCKED, Checkpoint E NOT QUALIFIED; release BLOCKED.
