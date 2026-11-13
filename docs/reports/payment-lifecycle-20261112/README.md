# Payment Lifecycle Stabilization: report

**Mission:** NOETIA, Payment Lifecycle Stabilization (P0). PO authorization: approved, bounded implementation.
**Branch:** `fix/payment-lifecycle-stabilization-20261112`, stacked on PR #59 (`feat/public-ecosystem-site-20261112` at `e326b81`).
**Status:** Draft. Not merged, not deployed. No real purchases, Stripe credentials or production or staging access were used.
**STOP:** independent Product Architecture review is required before any merge, deployment or activation.

## 0. Summary

| Checkpoint | Result |
|---|---|
| **A**: duplicate-billing protection | **Done.** The server refuses a second subscription. The check covers the local record and Stripe itself, runs under a per-user database lock, reuses or expires open Checkout sessions, and fails safe (503) when Stripe can't be read. **No migration.** |
| **B**: webhook identity and consistency | **Done, except one part that is behind a STOP gate.** Subscription events re-read Stripe, so the result no longer depends on delivery order. A different Stripe subscription can never silently replace a live one. Duplicates are logged. **Recording `planId` earlier is NOT done:** it would change when trial tokens are issued (§3.4). PO decision needed. |
| **C**: post-payment confirmation | **Done.** `/billing/success` authenticates and has distinct states: confirmed, pending (limited polling), payment problem, sign-in required, and verification error. "Subscription activated" appears only once the backend reports an entitled status. |
| **D**: account billing | **Done.** Every protected call is authenticated. A failed load is never shown as "no active plan", and the portal never navigates to `/undefined`. Every action shows its errors and refreshes state on success. ES and EN. |

**Stacking check.** PR #59 branches from `main` with no other dependency, so stacking is safe. Neither PR #59 nor PRs #56–#58 were modified.

## 1. Commits and changed files

| Commit | Scope |
|---|---|
| `5c4a90c` | API: checkout duplicate guard (A) and webhook identity and order-independence (B), with tests |
| `b04d1c7` | API: one-time purchase success URLs carry `?purchase=tokens\|book\|gift` |
| `b657b46` | Web: `/billing/success` (C), `/account/billing` (D), `/pricing` handling of the API's 409/503, en/es strings, tests |
| (this commit) | Report, logs, screenshots |

**Changed files (15 code and test files):**
- **API source:**
  - `services/api/src/subscriptions/subscriptions.service.ts`
  - `services/api/src/subscriptions/webhooks.service.ts`
  - `services/api/src/gifts/gifts.service.ts`: success URL only
- **API tests:**
  - `services/api/tests/unit/subscriptions/subscriptions.service.spec.ts`
  - `services/api/tests/unit/subscriptions/webhooks.service.spec.ts`
  - `services/api/tests/unit/subscriptions/payment-lifecycle.spec.ts` (new)
  - `services/api/tests/unit/gifts/gifts.service.spec.ts`
- **Web pages:**
  - `services/web/app/(billing)/billing/success/page.tsx`
  - `services/web/app/(account)/account/billing/page.tsx`
  - `services/web/app/(billing)/pricing/page.tsx`
- **Web strings:** `services/web/lib/i18n/en.ts` and `es.ts`
- **Web tests:**
  - `services/web/tests/unit/app/billing/success-page.spec.tsx` (new)
  - `services/web/tests/unit/app/account/billing.spec.tsx` (new)
  - `services/web/tests/unit/app/billing/pricing.spec.tsx`

**Not changed:**
- **Pricing and plans:** prices, plan data, trial length (14 days), Checkout line items.
- **Tokens:** token quantities, expiry, eligibility and issuance timing.
- **Entitlement rules:** `SubscriptionGuard` and `ACTIVE_STATUSES`.
- **Causas:** the 2.22% Causas commitment.
- **Data and infrastructure:** migrations, infrastructure, legal texts.
- **Other work:** Noetia+ and NoetiaX remain "Coming Soon"; PO-053 is unchanged.

## 2. Checkpoint A: duplicate-subscription prevention

### 2.1 Strategy (`SubscriptionsService.createCheckoutSession`)

**Invariant:** one Noetia user never starts a second billable Stripe subscription. The server enforces this regardless of what the web client shows.

The steps below run inside one transaction that holds `pg_advisory_xact_lock(hashtext('subscription-checkout:<userId>'))`:

1. **Local record.** If the status is `active`, `trialing`, `canceling` or `past_due`, the request gets **409 `subscription_exists`**. A missing `planId` is irrelevant: only the status counts.
2. **Open Checkout sessions.** The customer's open subscription-mode sessions are listed **before** the subscription check. A session that completes mid-request is then either still in this list (step 4) or already a subscription (step 3).
3. **Stripe subscriptions** (`subscriptions.list`, which by default returns every non-canceled subscription), for every Stripe customer ID known for the user.
   - Any `active`, `trialing`, `past_due`, `unpaid`, `incomplete` or `paused` subscription → 409 `subscription_exists`.
   - This covers a **missing or stale local record** and a **delayed webhook**.
   - A truncated list (`has_more` with nothing billable found) cannot prove "none" → fail safe.
4. **Pending sessions.**
   - An open session for the **same plan** (tagged with `metadata.noetiaPlanId`) is **reused**, which handles repeated clicks and retries.
   - Any other open subscription session is **expired** before the new one is created.
   - If a session can't be expired, it may be completing → **409 `checkout_pending`**.
   - Token-package (payment-mode) sessions are never touched.
5. **Fail safe.** Any Stripe error while checking → **503 `subscription_status_unavailable`**. It is never read as "no subscription".
6. **Create the session.** Price, quantity, `trial_period_days: 14`, success and cancel URLs are unchanged. The only addition is metadata `{ noetiaUserId, noetiaPlanId }`.

The guard **never** cancels or modifies an existing subscription.

**Why a lock plus listing, not a Stripe idempotency key alone.** An idempotency key keeps returning the same session for 24 hours, even after that session expires or completes, so it could hand back a stale URL. Two other options would each need a schema change and PA approval: a key bucketed by time, or a unique "pending checkout" row. The advisory lock needs no table or migration, works across API instances, and is released on commit or rollback. Listing and expiring sessions uses Stripe's own capabilities.

**Fail-closed caveat.** A stale local "live" record blocks checkout even if Stripe has since ended the subscription. "Refresh status" (`POST /subscriptions/sync`) reconciles it. This errs on the side of no duplicate charge.

### 2.2 Web handling (`/pricing`)

| Response | Message shown | Extra |
|---|---|---|
| 409 `subscription_exists` | "You already have a subscription…" | Link to `/account/billing` |
| 409 `checkout_pending` | "A checkout is still being completed…" | — |
| 503 `subscription_status_unavailable` | "We couldn't confirm your current subscription with our payment provider…" | — |

The status-unknown block from PR #59 (`f7c9118`) remains as an earlier check in the browser.

## 3. Checkpoint B: webhook identity and consistency

### 3.1 Changes (`webhooks.service.ts`, `SubscriptionsService.upsertFromWebhook` / `applyStripeSubscription`)

**Order independence.** These events now **re-read the subscription from Stripe** and apply its *current* state:
- `checkout.session.completed` (subscription mode);
- `customer.subscription.created` (newly handled);
- `customer.subscription.updated`;
- `invoice.paid`;
- `invoice.payment_failed`.

A late, duplicated or out-of-order delivery therefore writes the current truth, not the state captured in its payload. Statuses map through the existing `mapStripeStatus`. Before this change, the checkout and invoice events wrote `active` with `currentPeriodEnd = now`, even during a trial.

**Identity guard.** The single row per user (`uq_subscriptions_user`) may switch to a **different** Stripe subscription only when the current one is **not live** and the incoming one **is live**, as in a legitimate re-subscription. Otherwise the event is ignored and logged:
- `[subscription-identity] DUPLICATE_LIVE_SUBSCRIPTION user=… current=sub(status) incoming=sub(status) event=…` (error): two billable subscriptions for one user. This needs manual review and is never cancelled automatically.
- `[subscription-identity] IGNORED_OTHER_SUBSCRIPTION_EVENT …` (warning): a late event from an old subscription.

**Deletion.** `customer.subscription.deleted` still matches by its own `stripeSubscriptionId`, so a late delete of an old subscription cannot touch a newer one.

**Replay.** The event ledger (`stripe_processed_events`) is unchanged and still makes redelivery a no-op. A Stripe failure during a re-read throws, so Stripe retries.

**Nothing is destroyed.** No records are deleted or rewritten beyond the existing upsert. There is no migration.

### 3.2 Event-order matrix

Source: `payment-lifecycle.spec.ts`. It runs the real `WebhooksService` and `SubscriptionsService` against in-memory tables and a stateful fake Stripe.

| # | Sequence | Result |
|---|---|---|
| 1 | created → completed → $0 `invoice.paid` → updated(active) → paid `invoice.paid` | Row `trialing` from the first event; `active` with `planId` after the update; cycle tokens after the paid invoice |
| 2 | `invoice.paid` **first**, then completed, then created | Row created from Stripe (`trialing`); no extra tokens |
| 3 | completed delivered **after** the subscription became active | Status, `planId` and period end are not regressed. Before: reset to `active`/now |
| 4 | Stale `updated` payload (`trialing`) after the trial ended | Writes Stripe's current `active` |
| 5 | Same `invoice.paid` delivered twice | One token grant |
| 6 | Stripe unavailable during a webhook | Error (non-2xx); nothing recorded; the retry succeeds |
| 7 | `invoice.payment_failed` | `past_due` from Stripe |
| 8 | **Second live subscription** (created / completed / updated / paid) while the first is live | Row keeps the first; no tokens for the second; `DUPLICATE_LIVE_SUBSCRIPTION` logged; nothing cancelled |
| 9 | Re-subscription after the old one ended, then late updated/deleted for the old one | Row moves to the new subscription; late old events are ignored |
| 10 | Checkout guard across the lifecycle: new → repeated click (reused) → paid with webhook delayed (409) → after webhooks (409) | One Checkout session created in total |
| 11 | Checkout cancelled (customer left Stripe) | The next attempt reuses the still-open session; no subscription |
| 12 | Subscription ended → subscribe again | Allowed |

### 3.3 Concurrency and idempotency evidence

**Unit tests** (`subscriptions.service.spec.ts`; the test advisory lock is a per-key mutex):
- **Same plan:** two concurrent requests → exactly **one** Stripe session is created, and the second request **reuses** it.
- **Different plans:** two concurrent requests → only **one** open subscription session remains.
- **Lock key:** asserted as `SELECT pg_advisory_xact_lock(hashtext($1))` with `subscription-checkout:<userId>`.

**Real PostgreSQL 16** (disposable container, removed afterwards; log in `advisory-lock-check.log`):
```
same user:       A acquired after 3ms | A commit | B acquired after 307ms | B commit
different users: C acquired after 2ms | A acquired after 1ms | C commit | A commit
after rollback:  acquired in 1ms
```

**Negative control:** with the original `createCheckoutSession` and `upsertFromWebhook` restored, **33 of the 37** new guard and identity tests fail. The 4 that pass are regression guards: an invalid plan is still rejected; canceled subscriptions don't block; nothing is cancelled; `planId` is written only when passed.

### 3.4 Trial-token behaviour: STOP gate (PO decision required)

**Current behaviour, unchanged by this mission.** It is pinned by the two "Trial-token behaviour" tests.
- Tokens are issued only from `invoice.paid`, via `issueTokensForNewSubscription`. They are issued only when the subscription row already has a `planId`.
- `planId` is written only from `customer.subscription.updated`.
- **So whether a new trial receives its cycle tokens on the $0 trial invoice depends on webhook delivery order:**

| Order | Trial tokens |
|---|---|
| `updated` arrives **before** the trial `invoice.paid` (e.g. Checkout attaching the default payment method) | **Yes** |
| `updated` arrives **after** | **None** |

- **Annual plans:** the monthly cron issues only to `status = 'active'` rows. Its first run comes 30 days after the first grant, after the 14-day trial.
- **Re-subscription:** the row keeps the previous subscription's `planId` until the next `updated` event (pre-existing).

**Why this was not changed.** Recording `planId` at creation (from `customer.subscription.created` or `checkout.session.completed`) is the natural identity fix. But it would make **every** trial receive tokens on the $0 invoice, which is a new entitlement rule. Per the mission, this **stops here**.

**Policy alternatives for the PO:**

| Option | Rule | Financial impact | User experience |
|---|---|---|---|
| **T-1** | Tokens on the $0 trial invoice: every trial gets `tokensPerCycle` at signup | A trial user can redeem a book and cancel before paying. Cost is up to one cycle's tokens per trial: 1 token for Individual, the plan's count for Duo and Family | Immediate value during the trial |
| **T-2** | Tokens only after the **first paid invoice** (`amount_paid > 0`) | No unpaid redemption | The trial gives library access but no token until day 15. Must be stated in plan copy and Terms |
| **T-3** | Keep today's behaviour | Unpredictable | Some trials get tokens and some don't; not defensible |

**Recommendation: decide between T-1 and T-2.** Either is a few lines in `handleInvoicePaid`/`issueTokensForNewSubscription` plus early `planId` recording, with tests. Both need consistent wording in `/pricing` and the Terms; the Terms are still under legal review (OP-3).

## 4. Checkpoint C: post-payment confirmation (`/billing/success`)

| State | When | Shows |
|---|---|---|
| `checking` | While verifying | "Confirming your subscription…", never "activated" |
| `confirmed` | `POST /subscriptions/sync` or a later `GET /subscriptions/me` reports `active`, `trialing` or `canceling` | "Subscription activated!" and "Start reading" |
| `pending` | Still `none` after **5 polls × 3 s** | "Payment received — finishing setup… you won't be charged again", **Check again**, link to billing |
| `problem` | `past_due` | Payment problem, link to billing |
| `auth` | 401 after the refresh fails | "Sign in…", link to `/login?next=%2Fbilling%2Fsuccess`. No automatic redirect |
| `error` | 5xx or network | "We couldn't confirm your subscription. Your payment isn't affected…", **Try again**, link to billing |
| `purchase` | `?purchase=tokens\|book\|gift` (one-time payments) | "Payment received" with a kind-specific line; no subscription calls |

- The page only reads state: it never calls checkout. Webhooks remain authoritative.
- Requests go through `apiFetch`, which sends the Bearer token and makes one shared refresh.

## 5. Checkpoint D: account billing (`/account/billing`)

| Action | Before | Now |
|---|---|---|
| Load status | 401 → shown as "No tienes un plan activo" to everyone | Bearer. A failure, network error or malformed body shows an **error with retry**, never "no plan". 401 → `/login?next=%2Faccount%2Fbilling` |
| Linked users | 401, ignored | Bearer. A failure hides only the members card |
| Manage billing (portal) | 401 → `window.location.href = undefined` → `/undefined` | Navigates **only** to a returned `http(s)` URL; otherwise "We couldn't open the billing portal…" |
| Refresh status (sync) | 401, ignored | Bearer; reloads; "Status updated."; failure → error |
| Resume | 401, ignored | Bearer; reloads; "Subscription resumed."; failure → error |
| Invite | 401 → generic Spanish error | Bearer; success message and reload; `plan_full`, `plan_does_not_support_sharing` or a generic error, localized |
| Remove member | 401, ignored | Bearer; reloads; "Member removed."; failure → error, member kept |
| Revoke invitation | 401, ignored | Bearer; reloads; "Invitation revoked."; failure → error |

- **Cancellation:** the page has no cancel control; cancellation runs through the Stripe portal, unchanged.
- **Localization:** the page now uses the **existing** `billing.*` keys, so Spanish copy is word-for-word unchanged and English readers get English. New messages exist in both languages.
- **Not changed:** the account layout header ("Account / Billing") is still hard-coded in English; recorded in §7.

## 6. Validation

### 6.1 Tests

| Suite | Tests | Negative control (against the previous code) |
|---|---|---|
| API `subscriptions.service.spec.ts`: checkout guard (A) | 28 | 33 of the 37 checkout-guard and identity-guard tests fail |
| API `subscriptions.service.spec.ts`: identity guard (9) and Stripe re-read (4) (B) | 13 | identity guard included above |
| API `payment-lifecycle.spec.ts` (new): event-order matrix | 14 | — |
| API `webhooks.service.spec.ts`: dispatch updated | 22 | — |
| Web `success-page.spec.tsx` (new) | 18 | **18/18 fail** |
| Web `account/billing.spec.tsx` (new) | 25 | **25/25 fail** |
| Web `pricing.spec.tsx` (+3 for 409/503) | 38 | 3/3 new fail; the 35 earlier tests pass |

The suites cover the mission's lifecycle list:
- new eligible subscription;
- existing active subscription and existing trial;
- duplicate and concurrent checkout;
- checkout cancellation and completion;
- delayed, duplicated and out-of-order webhooks;
- post-payment pending and confirmed;
- authentication expiry and refresh;
- billing-portal access;
- account-billing errors and recovery.

### 6.2 Checks (local)

| Check | Result |
|---|---|
| API unit tests | **1022/1022** pass. One suite (`auth.controller.spec`) can't load locally because the `bcrypt` native binding isn't built in this worktree; it runs on CI |
| API coverage | Branches 69.04%, up from 68.88%; gate (80%) failing on `main` before this mission |
| API tsc / eslint / `nest build` | pass / 0 errors (warnings only, pre-existing style) / pass |
| Web unit tests | **429/429** pass (27 suites) |
| Web coverage | 73.48% statements, up from 73.03%; gate (80%) failing on `main` before this mission |
| Web tsc / `next lint` (changed files) / `next build` | pass / no warnings or errors / pass |
| Thresholds | Unchanged |

### 6.3 Local browser integration

Local production build (`next start`), Playwright, with browser-side stubs that enforce Bearer like the API. Each of the 9 scenarios ran in ES and EN at 1280 and 390 px: 36 runs, all reaching the expected state with **no horizontal overflow**.

Request log (`browser-run.log`, excerpt):
```
success-pending:  200 POST /subscriptions/sync auth=Bearer, then 5 × 200 GET /subscriptions/me auth=Bearer → pending
success-auth:     401 POST /subscriptions/sync auth=none, 401 POST /auth/refresh → sign-in prompt (no redirect)
account-billing-portal-error: 404 POST /subscriptions/portal auth=Bearer → error shown, URL unchanged
pricing-subscription-exists:  409 POST /subscriptions/checkout auth=Bearer → message + billing link
```

### 6.4 Screenshots (ES and EN, desktop and mobile)

Files in `screenshots/` are named `<name>--{es,en}--{desktop,mobile}.jpg`:
- `success-confirmed`
- `success-pending`
- `success-error`
- `success-auth`
- `success-purchase-tokens`
- `account-billing`
- `account-billing-load-error`
- `account-billing-portal-error`
- `pricing-subscription-exists`

### 6.5 Previously accepted PR #59 behaviour

All earlier `/pricing` tests still pass unchanged: authentication, Causas lookup states, status-unknown block. PO-053 selector tests pass, and the landing tests for the Noetia+/NoetiaX "Coming Soon" labels pass. None of those files changed.

## 7. Database migrations

**None needed and none added.** Concurrency uses a transaction-scoped advisory lock. Identity uses the existing `uq_subscriptions_user` and `stripeSubscriptionId` columns.

**Possible later hardening** (each needs PA approval):
- an `invoiceId` column on `token_ledger`, to make token grants idempotent per invoice even if a crash lands between the grant and the event-ledger write;
- a table recording duplicate-subscription incidents, instead of logs only.

## 8. Remaining Product Owner decisions

1. **Trial tokens (§3.4):** T-1 or T-2. This also unblocks recording `planId` at creation.
2. **Existing duplicate subscriptions, if any:** how to resolve accounts flagged `DUPLICATE_LIVE_SUBSCRIPTION` (refund or cancel; manual). A read-only Stripe audit before activation is recommended.
3. **Plan changes:** with duplicates refused, changing plan means the Stripe portal (or a future in-app flow). Confirm that the portal's plan-switching configuration is what the PO wants.
4. **Stale "live" local records:** checkout fails closed until "Refresh status" runs. Confirm this trade-off is acceptable.

**Recorded, not implemented (separate workstreams):**
- the reader-heartbeat and statistics token-key mismatch (`noetia_token`, S-2);
- privacy-settings authentication;
- language-preference sync;
- join and gift-claim authentication (S-1 remainder);
- cookie-consent redesign;
- Noetia+ and NoetiaX research;
- Causas 2.22% allocation (OP-4);
- the hard-coded English account-layout header;
- the unused `lib/billing-utils.ts`, which still uses header-less `fetch` but is imported only by its own test.

## 9. CI status and release blockers

**CI:** see the Draft PR. Expected failures, identical to `main` and PR #59:
- coverage gates: API branches, web, mobile;
- E2E: "Playwright does not support chromium on ubuntu26.04-x64".

All tests are expected to pass.

**Release remains BLOCKED:**
- PA review of this mission and PR #59;
- the PO trial-token decision;
- PO merge and deploy authorization; merging to `main` is a production deploy;
- Stripe production configuration, including the webhook endpoint subscribing to `customer.subscription.created`;
- Terms legal review (OP-3);
- NEM-024 restrictions: E-1 OPEN and BLOCKED; Checkpoint E NOT QUALIFIED.
