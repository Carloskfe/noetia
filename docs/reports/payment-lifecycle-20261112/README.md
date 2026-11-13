# Payment Lifecycle Stabilization: report

**Mission:** NOETIA, Payment Lifecycle Stabilization (P0). PO authorization: approved, bounded implementation.
**Branch:** `fix/payment-lifecycle-stabilization-20261112`, stacked on PR #59 (`feat/public-ecosystem-site-20261112` at `e326b81`).
**Status:** Draft. Not merged, not deployed. No real purchases, Stripe credentials or production or staging access were used.
**STOP:** independent Product Architecture review is required before any merge, deployment or activation.

> **Correction round 1 (2026-11-13), PA independent review of `9a8b4d8`:** Checkpoints A and D were accepted provisionally; B and C needed correction. The corrections, real-PostgreSQL evidence, open STOP gates and the T-1/T-2 decision packet are in **§10**. Where §10 and earlier sections disagree, §10 is current. Reviewed head for this round: **`9a8b4d8`**. New head: see §10.1.

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

**Replay.** *(Superseded by §10.2: in this round the ledger was read before processing and written after it, which the PA showed is not exactly-once.)* A Stripe failure during a re-read throws, so Stripe retries.

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

**Real PostgreSQL 16** (disposable container, removed afterwards; log in `advisory-lock-check.txt`. It was originally saved as `.log`, which `.gitignore` excludes, so it was not in the PR until round 1):
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
| `confirmed` | `POST /subscriptions/sync` or a later `GET /subscriptions/me` reports `active`, `trialing` or `canceling` | "Your subscription is active" and "Start reading" *(round 1, §10.4; was "Subscription activated!")* |
| `pending` | Still `none` after **5 polls × 3 s** | "We're still confirming your subscription… If you completed checkout, this usually takes less than a minute", **Check again**, link to billing *(round 1; was "Payment received…")* |
| `problem` | `past_due` | Payment problem, link to billing |
| `auth` | 401 after the refresh fails | "Sign in…", link to `/login?next=%2Fbilling%2Fsuccess`. No automatic redirect |
| `error` | 5xx or network | "We couldn't confirm your subscription. Your payment isn't affected…", **Try again**, link to billing |
| `purchase` | `?purchase=tokens\|book\|gift` (one-time payments) | "We're confirming your purchase" with a conditional, kind-specific line; no API calls *(round 1; was "Payment received")* |

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

Request log (`browser-run.txt`, excerpt):
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

**None needed and none added**, in either round. Concurrency uses transaction-scoped advisory locks. Identity uses the existing `uq_subscriptions_user` and `stripeSubscriptionId` columns. Round 1 makes fulfillment exactly-once with the existing `stripe_processed_events` primary key (§10.2).

**Possible later hardening** (each needs PA approval): see §10.7. The `token_ledger.invoiceId` idea proposed here is no longer needed for correctness: per-invoice fulfillment keys cover it (§10.2).

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

**CI did not run for this PR.** `.github/workflows/ci.yml` triggers only on `pull_request` targeting `main` and has no `workflow_dispatch`. A PR stacked on PR #59 therefore gets no CI run.
- Changing the workflow would be a CI change, which needs its own mission, so the workflow was left alone.
- **Evidence is the local full runs in §6.2.** They are the same commands CI runs: unit tests with coverage, tsc, lint and build for both services.
- CI will run when the stack is retargeted to `main`, which needs PO authorization.
- **Expected CI result then, based on PR #59 run 43360737319:**
  - all tests pass;
  - failures only on the coverage gates that already fail on `main` (API branches, web, mobile) and on the E2E browser install ("Playwright does not support chromium on ubuntu26.04-x64").
- The mobile and worker services are untouched by this mission.

**Release remains BLOCKED:**
- PA review of this mission and PR #59;
- the PO trial-token decision;
- PO merge and deploy authorization; merging to `main` is a production deploy;
- Stripe production configuration, including the webhook endpoint subscribing to `customer.subscription.created`;
- Terms legal review (OP-3);
- NEM-024 restrictions: E-1 OPEN and BLOCKED; Checkpoint E NOT QUALIFIED.

---

## 10. Correction round 1: PA independent review of `9a8b4d8` (2026-11-13)

**Scope:** correct deficiencies inside the existing PO-authorized mission. No new product policy. Accepted work is retained: the serialized checkout guard, Stripe checks with safe failures, authenticated account billing, bilingual errors, the Coming Soon presentation, the PO-053 single-cause policy, and existing economics.

**Not done, by instruction:** no merge, no deploy, no Stripe pricing change, no Causas 2.22% change, no premium activation, no NEM-024 change, no change to trial-token timing. The PR stays **Draft**, stacked on PR #59.

### 10.1 Commits and changed files

| Commit | Scope |
|---|---|
| `ad5013e` | API: exactly-once webhook fulfillment, atomic subscription identity, checkout-guard edge cases (P0, P0, §5), with unit tests |
| `9815fc2` | API: real-PostgreSQL verification script (`services/api/scripts/payment-safety-pg-check.ts`) |
| `fbbabc5` | Web: `/billing/success` no longer claims an unverified payment (P1 interim), en/es, tests |
| (report commit) | This section, evidence `.txt` files, updated screenshots |

**Changed files:**
- **API source:**
  - `services/api/src/subscriptions/webhooks.service.ts`
  - `services/api/src/subscriptions/subscriptions.service.ts`
  - `services/api/src/gifts/gifts.service.ts`
  - `services/api/src/subscriptions/stripe-fulfillment-ledger.ts` (new; helper functions, no new table)
- **API tests:**
  - `services/api/tests/unit/subscriptions/webhooks.service.spec.ts`
  - `services/api/tests/unit/subscriptions/subscriptions.service.spec.ts`
  - `services/api/tests/unit/subscriptions/payment-lifecycle.spec.ts`
  - `services/api/tests/unit/gifts/gifts.service.spec.ts`
  - `services/api/tests/unit/subscriptions/stripe-fulfillment-ledger.spec.ts` (new)
- **API verification script:** `services/api/scripts/payment-safety-pg-check.ts` (new; not part of `npm test`)
- **Web:**
  - `services/web/app/(billing)/billing/success/page.tsx` (doc comment only)
  - `services/web/lib/i18n/en.ts` and `es.ts` (`billing.success.*` copy; web-only namespace, so mobile is unaffected)
  - `services/web/tests/unit/app/billing/success-page.spec.tsx`
- **Evidence:**
  - `payment-safety-pg-check.txt`
  - `payment-safety-pg-check.negative-control.txt`
  - `browser-run-p1.txt`
  - 20 screenshots, 12 of them replaced. The round-1 `.log` files are re-added as `.txt` (see 10.8).

**Unchanged:** prices, plans, the 14-day trial, Checkout line items, token amounts, token expiry (90/30/30 days), trial-token timing, `SubscriptionGuard`/`ACTIVE_STATUSES`, Causas, legal texts, migrations, infrastructure, CI workflow.

### 10.2 P0: webhook idempotency, now exactly-once

**Finding confirmed.** At `9a8b4d8`, `handleEvent()` read the ledger, performed the side effects with auto-committed writes, and inserted the ledger row afterwards. The real-PostgreSQL negative control (10.5) reproduces every scenario the PA listed.

**Correction: one transaction per event, claim first** (`WebhooksService.handleEvent`):
1. `BEGIN`.
2. **Claim the event id:** `INSERT INTO stripe_processed_events ("eventId", type, "processedAt") VALUES (…) ON CONFLICT ("eventId") DO NOTHING RETURNING "eventId"`. If no row comes back, the event is already done: commit, log, return 2xx.
3. **Run every database side effect on the same transaction's `EntityManager`:**
   - the subscription row;
   - the token ledger;
   - `user_books`;
   - `gift_cards`;
   - the annual `nextTokenIssuanceAt`.
4. **Fulfillment keys.** Where money becomes value, claim a second key on the same primary key, in the same transaction:
   - `fulfillment:invoice-tokens:<invoiceId>`: subscription cycle tokens, once per invoice;
   - `fulfillment:checkout-session:<sessionId>`: token package, book or gift, once per Checkout session.
5. `COMMIT`. Only then are e-mails sent (gift recipient and buyer), and only by the delivery that performed the fulfillment.

**Why this is exactly-once (PostgreSQL semantics, verified in 10.5):**

| Scenario | Behaviour |
|---|---|
| Concurrent deliveries of the same event | The second `INSERT` blocks on the first transaction's uncommitted primary-key row. When the first commits, the second gets the conflict and does nothing. If the first rolls back, the second proceeds. |
| Crash after granting tokens, before recording the event | Both are in one transaction, so PostgreSQL rolls back both when the connection dies. Stripe's retry processes the event from scratch. |
| Different event ids, same invoice or session | The fulfillment key lets exactly one transaction grant. The others record their own event id and grant nothing. |
| Concurrent token-package or gift fulfillment | Same mechanism: per-session key. Gifts also check `gift_cards.stripeSessionId` inside the transaction (defence in depth for sessions fulfilled before this change). |
| Duplicate gift e-mail | E-mails run after commit, only in the winning delivery. A rolled-back attempt never e-mails a claim link for a gift row that doesn't exist. |
| Failed transaction, then a legitimate retry | Everything, including both claims, is rolled back, so the retry fulfills once. |

**Details:**
- **Trial gate preserved.** The invoice key is claimed **only when tokens are actually issued**: the row has a plan, as before. A $0 trial invoice that grants nothing today doesn't consume its key, so the trial-token behaviour in §3.4 is exactly unchanged. The two pinned trial tests still pass.
- **Book purchase:** `addPurchasedBook` now uses `INSERT … ON CONFLICT DO NOTHING`. Catching `23505`, as before, would abort the surrounding transaction.
- **Post-commit notifications are best-effort:** they're logged on failure and never rethrown. A throw there would make Stripe retry an event that's already recorded. `EmailService.send()` already swallows SMTP errors (pre-existing).
- **Unchanged:** token amounts, expiry, `reason` strings, `subscriptionId` linkage, trial eligibility.

**Infrastructure:** existing table, existing primary key, **no migration, no new table**. The `type` column distinguishes the row kinds: a Stripe event type, `fulfillment:invoice-tokens` or `fulfillment:checkout-session`.

**This is the one design decision taken under mission authority:** putting fulfillment keys in the event ledger rather than in a new table. It isn't a schema change, but it widens what the table holds. See 10.7 for the dedicated-table alternative if the PA prefers it.

### 10.3 P0: atomic webhook subscription identity

**Finding confirmed.** At `9a8b4d8`, `upsertFromWebhook()` ran its read, comparison and upsert as separate auto-committed statements. In the negative control, **15 of 25** concurrent rounds silently replaced a live subscription, both with no row yet and with an ended row (10.5).

**Correction.** `upsertFromWebhook` and `cancelFromWebhook` now run inside the webhook transaction (or their own, if called directly) under `pg_advisory_xact_lock(hashtext('subscription-identity:<userId>'))`. The row is read **after** the lock is granted. Under READ COMMITTED, that read sees every commit made before the lock, so the second of two concurrent webhooks for different Stripe subscriptions sees the first one's row. It is then rejected with `DUPLICATE_LIVE_SUBSCRIPTION`.

- **Re-subscription preserved:** a row whose subscription has ended still switches to a new live one (S5c, and the 25 rounds of S5b).
- **Nothing is cancelled, refunded or deleted.**
- **Lock ordering:** each event takes its own claim row first, then the user lock. The checkout guard uses a different key (`subscription-checkout:`), so there is no lock cycle.

### 10.4 P1: purchase confirmation. Interim shipped; verification is a STOP gate

**Finding confirmed.**
- `/billing/success?purchase=…` showed "Payment received" on an untrusted query parameter.
- The subscription path showed "Subscription activated!" whenever the account was entitled, even when the `session_id` in the URL was unrelated.
- The pending state also said "Payment received…".

**Interim correction (shipped, no new API contract):** copy that never claims an unverified payment. ES and EN:

| State | Before | Now (EN / ES) |
|---|---|---|
| confirmed | Subscription activated! | *Your subscription is active* / *Tu suscripción está activa*: a statement about the **account**, which `/subscriptions/sync` re-reads from Stripe, not about this session |
| pending | Payment received — finishing setup… you won't be charged again | *We're still confirming your subscription… If you completed checkout, this usually takes less than a minute.* / *Aún estamos confirmando tu suscripción… Si completaste el pago, suele tardar menos de un minuto.* |
| purchase | Payment received | *We're confirming your purchase*, plus *Once your payment is confirmed, [tokens are added / the book is added / we email the gift…]* / *Estamos confirmando tu compra*, plus *Cuando se confirme tu pago, …* |

- **Unauthenticated gift buyers** see only generic copy: no API call, no transaction details.
- **Fulfillment stays webhook-only:** the page grants nothing.
- **Tests:**
  - a dictionary guard fails if any `billing.success` string in en or es says "payment received", "pago recibido", "won't be charged again" or "activated/activada";
  - a gift case asserts that no session id, e-mail or amount is rendered.
- **Screenshots** were refreshed for the changed views (10.6).

**STOP gate: server-side Checkout-session verification.** It needs a **new public API endpoint**, so it is documented here for PA review and **not implemented**.

*Exact minimal design:*

`GET /billing/checkout-sessions/:id/status` (optional JWT, throttled):
1. **Validate the id format** (`^cs_(test|live)_[A-Za-z0-9]+$`), then `stripe.checkout.sessions.retrieve(id)`.
2. **Check ownership:**
   - **Subscription / tokens / book:** requires authentication, and `metadata.noetiaUserId|userId === user.id` or `session.customer === user.stripeCustomerId`. Otherwise **404**: no existence oracle, and the same answer as an unknown id.
   - **Gift with `buyerUserId`:** that user only.
   - **Anonymous gift:** the session id, an unguessable value from Stripe's redirect, is the only credential. The response is limited to the fields below.
3. **Response:** `{ kind: 'subscription'|'tokens'|'book'|'gift', state: 'complete'|'processing'|'expired', fulfilled?: boolean }`.
   - `state` comes from `session.status` + `payment_status`. `complete` requires `status=complete` and `payment_status ∈ {paid, no_payment_required}`; a trial is `no_payment_required`.
   - `fulfilled` = the `fulfillment:checkout-session:<id>` key exists, from the ledger in 10.2.
   - **Never returned:** amounts, e-mails, names, customer or subscription ids.
4. **Web:**
   - **"Payment received"** only for `state=complete`.
   - **"Added to your balance / library"** only when `fulfilled`.
   - **Otherwise** the neutral copy above.
   - **Subscription:** "activated" only when `state=complete` **and** the account is entitled.
5. **Never grants** tokens or entitlements.

*Size:* one controller route, one service method, unit tests, and page wiring. Rate limiting reuses the existing throttler.

### 10.5 Real PostgreSQL evidence (concurrency, crash, retry)

**Method:**
- **Database:** a disposable `postgres:16-alpine` container (`pr60-pg`, port 55432 on localhost), never the dev, staging or production database. All **68 migrations** applied with the repository's own `migration:run`.
- **Script:** `scripts/payment-safety-pg-check.ts` builds the **real** `WebhooksService`, `SubscriptionsService` and `GiftsService` on a real TypeORM DataSource. Only Stripe, e-mail and push are faked; fake Stripe adds 0–8 ms of jitter so concurrent transactions interleave.
- **Concurrency is PostgreSQL's:** parallel calls use separate pool connections.
- **Crash:** a **child process** is `SIGKILL`ed right after its token insert, before COMMIT.
- **Negative control:** the same script against the reviewed head (`PGH_SRC=<checkout of 9a8b4d8>`).

| # | Scenario | Corrected code (3 runs) | Reviewed head `9a8b4d8` |
|---|---|---|---|
| S1 | 8 concurrent deliveries of one `invoice.paid` | tokens = **1** | tokens = **8** |
| S2 | 6 concurrent events, **different ids**, same invoice | tokens = **1** | tokens = **6** |
| S3 | Token package: 4 duplicate + 4 distinct-id concurrent deliveries of one session (10-token package) | tokens = **10** | tokens = **80** |
| S4 | Gift: 6 concurrent deliveries (3 event ids) of one session | **1** gift row, **1** recipient e-mail, link matches the stored gift | **6** gift rows, **6** e-mails, links don't match |
| S5 | 25 rounds: two concurrent live subscriptions, no row yet | **0** silent replacements | **15/25** silent replacements |
| S5b | 25 rounds: same, previous row ended | **0** | **15/25** |
| S5c | Legitimate re-subscription after the old one ended | works | works (regression guard) |
| S6 | `SIGKILL` after the token insert, before recording the event; then Stripe retry + redelivery | after crash: tokens 0, event rows 0, claim rows 0 → after retry: tokens **1** | after crash: tokens **1**, event rows 0 → after retry: tokens **2** |
| S7 | Transaction fails after the token insert; then a retry | tokens 0 → **1** | tokens 1 → **2** |
| S8 | Duplicate arrives 50 ms into a 400 ms transaction | blocks until the first commits: the two finish within 1–3 ms of each other (425–451 ms in the three runs); Stripe read **once**; tokens 1 | not blocked; Stripe read twice; tokens **2** |
| | **Total** | **10/10, 3 of 3 runs** | **1/10** |

Logs: `payment-safety-pg-check.txt` (three runs) and `payment-safety-pg-check.negative-control.txt`. **Not covered by the script:** the book purchase. It relies on the `UQ_user_books_user_book` constraint plus the session key, and is covered by unit tests.

### 10.6 Checkout guard edge cases (§5)

- **Pagination.** At `9a8b4d8`, the open-session listing (`limit: 100`) ignored `has_more`. Now a truncated first page → **503 `subscription_status_unavailable`** and nothing is created or expired, the same rule already used for the subscription listing. Open sessions expire within 24 h, so a pathological account recovers by itself.
- **Timeout after Stripe created the session.**
  - **stripe-node v22** retries POSTs internally with **one auto-generated idempotency key** (`maxNetworkRetries` default 2), so its own retries can't create two sessions.
  - **If the call still fails ambiguously** (`StripeConnectionError` / `StripeAPIError`), the guard does **not** create again. Still under the checkout lock, it re-lists open sessions:
    - if Stripe did create the session for this plan, that session's URL is returned;
    - otherwise → **409 `checkout_pending`** (existing bilingual copy: "A checkout is still being completed…"). The user's retry goes through the guard, which reuses the session once it is visible.
  - **A definitive rejection** (for example `StripeInvalidRequestError`) is re-thrown unchanged, because nothing was created.
- **Tests (unit):**
  - 100 sessions with `has_more` → 503, no create or expire;
  - timeout + created session → returned, one create;
  - timeout + not visible → 409, then the retry reuses it, still one create;
  - timeout + re-list fails → 409;
  - a session for another plan is not returned;
  - a definitive error is re-thrown.
- **Residual (needs no new infrastructure to stay safe):** if Stripe's list showed a created session only after a delay longer than the user's retry, a second session could be created. Completing both would produce a second subscription, which the identity guard flags (`DUPLICATE_LIVE_SUBSCRIPTION`) and never silently adopts. Closing this fully needs a persisted pending-checkout record, which is a migration (10.7).

### 10.7 Unresolved STOP gates and decisions

| # | Item | Owner | State |
|---|---|---|---|
| G-1 | **P1 server-side Checkout-session verification** (new endpoint, 10.4) | PA | Design ready; **not implemented**. Interim neutral copy shipped |
| G-2 | **Trial tokens T-1 vs T-2** (10.9) | PO | **Not implemented**; behaviour unchanged and pinned by tests |
| G-3 | **Fulfillment keys in `stripe_processed_events`** (10.2): confirm, or request the dedicated table | PA | Implemented without schema change. **Alternative (migration, not prepared as code):** `stripe_fulfillments("key" varchar PK, kind varchar, "stripeObjectId" varchar, "eventId" varchar, "createdAt" timestamptz default now())`, used identically |
| G-4 | **Pending-checkout record** to close the 10.6 residual | PA | Proposal only: `checkout_attempts("userId" uuid PK, "sessionId" varchar, "planId" uuid, "createdAt")`, written under the existing lock |
| G-5 | **Location of the verification script** (`services/api/scripts/`, outside `tests/unit`, because it uses a real database) | PA | Keep or drop. It doesn't run in `npm test` |
| G-6 | Pre-existing items from §8 (duplicate-account resolution, portal plan-switching, stale live records) | PO | Unchanged |

### 10.8 Residual risks, observed defects and evidence gaps (not fixed in this round)

- **[H] Pre-existing, outside this mission's scope: concurrent `redeemToken` can spend one token twice.** It reads the oldest active token, then updates it with no status condition. Two simultaneous redemptions could grant two permanently owned books for one token. Found while reviewing the token paths. Not changed, because the mission covers checkout and webhooks. **Recommend a separate PO-authorized fix:** a conditional `UPDATE … WHERE status='active' RETURNING`.
- **[M] Fulfillments recorded before this change have no fulfillment keys.** A *different-id* replay of such an invoice or token session could grant again. Gifts are protected by the `stripeSessionId` check.
  - Stripe does not normally emit distinct event ids for one `invoice.paid`.
  - Production Stripe keys are not active (D6), so there should be none.
  - **Before activation, run a read-only `SELECT count(*) FROM stripe_processed_events` on production to confirm.**
- **[M] Lost post-commit e-mail.** A crash between COMMIT and SMTP, or an SMTP failure (already swallowed by `EmailService`, pre-existing), leaves a gift recorded but not e-mailed. There is no resend tool; recommended as separate work.
- **[L] Connection held during Stripe reads.** The webhook transaction holds a pool connection during `subscriptions.retrieve`, bounded by the Stripe client timeout. The checkout guard (accepted in Checkpoint A) does the same. Acceptable at pre-launch volume.
- **[L] Stale snapshot under concurrency.** The Stripe snapshot is read before the per-user lock, so of two concurrent events for the *same* subscription, the later commit may write the slightly older snapshot. It converges on the next event. Identity is unaffected.
- **[L] Annual cron.** The annual-plan monthly cron is not guarded against two API instances running it at once (pre-existing).
- **Evidence gap from round 1, now closed.** Round 1 cited `advisory-lock-check.log` and `browser-run.log`, but `*.log` is gitignored, so those files were never in the PR. They are re-added as `.txt` from the local workspace, unmodified.

### 10.9 Trial tokens: decision packet for the PO (T-1 / T-2)

**Today (unchanged):** tokens come only from `invoice.paid`, and only if the row already has a `planId`, which only `customer.subscription.updated` writes. Whether a trial gets tokens on its $0 invoice depends on delivery order (§3.4). Tokens are `paid`, expire in **90 days**, and books redeemed with them are **owned permanently**.

| | **T-1: tokens when the trial begins** | **T-2: tokens after the first paid invoice** |
|---|---|---|
| Rule | Record `planId` when the subscription is created; issue `tokensPerCycle` on the $0 trial invoice | Record `planId` when the subscription is created; issue only for `invoice.paid` with `amount_paid > 0` (from day 15) |
| Per-trial grant | Individual **1**, Duo **2**, Family **4** tokens (seeded plan values) | Same counts, but only after payment |
| Cost exposure | A trial user can redeem and cancel before paying, and **keeps the books permanently** (ownership principle). Exposure per trial = up to one cycle of tokens, plus any per-redemption author/narrator payout the PO's rules attach to an unpaid redemption (payout rule to be confirmed by the PO) | No unpaid redemption |
| Abuse surface | Repeat trials. Mitigation would need a per-customer trial limit, which Stripe can't do by itself | None new |
| Annual plans | First cycle at trial start; monthly drip as today | First cycle at the first paid invoice |
| Implementation (after approval) | Small: `planId` at creation plus the existing issuance path. Tests for both orders | Small: `planId` at creation plus an `amount_paid > 0` condition. Tests for both orders |

**Required customer disclosures (draft; `/pricing` and the Terms; the Terms are under legal review, OP-3):**
- **T-1**
  - EN: *"Your 14-day free trial includes {n} token(s). Books you redeem are yours to keep, even if you cancel during the trial."*
  - ES: *"Tu prueba gratuita de 14 días incluye {n} token(s). Los libros que canjees son tuyos para siempre, aunque canceles durante la prueba."*
- **T-2**
  - EN: *"Your plan's tokens arrive with your first payment, when the 14-day free trial ends. During the trial you have your plan's access, without tokens."*
  - ES: *"Los tokens de tu plan llegan con tu primer pago, al terminar la prueba gratuita de 14 días. Durante la prueba tienes el acceso de tu plan, sin tokens."*

**Recommendation:** **T-2**. It is the only option with no unpaid, permanent value transfer and no new abuse surface, and its disclosure is a single sentence. T-1 is defensible only with an accepted per-trial cost and a repeat-trial control. **Neither option is implemented.**

### 10.10 Validation (local)

| Check | Result |
|---|---|
| API unit tests (full, `--maxWorkers=2`) | **1064/1064** pass. One suite (`auth.controller.spec`) can't load because the `bcrypt` native binding isn't built in this worktree; same environmental issue as round 1, unrelated |
| API suites changed | `subscriptions.service.spec` 114, `payment-lifecycle.spec` 26, `webhooks.service.spec` 30, `gifts.service.spec` 15, `stripe-fulfillment-ledger.spec` 6 (all pass) |
| API coverage (changed files) | `webhooks.service.ts` 100% statements / 95.2% branches; `subscriptions.service.ts` 91.8 / 81.0; `gifts.service.ts` 97.3 / 84.6. Global branches 70.8%: gate (80%) failing on `main` before this mission, threshold unchanged |
| API `tsc --noEmit` / eslint (changed files) | pass / 0 errors (`any` warnings, existing style) |
| Real PostgreSQL script | **10/10** in 3 consecutive runs; negative control **1/10** |
| Web unit tests (full) | **432/432** pass (27 suites), including i18n en/es parity; `success-page.spec` 21 |
| Web `tsc` / `next lint` (changed files) | pass / no warnings or errors |
| Browser (Next dev from this worktree, Playwright, API stubbed in-browser with Bearer enforced) | 5 views × ES/EN × 1280/390 px = **20/20** reached the expected state, **no horizontal overflow** (`browser-run-p1.txt`) |
| Screenshots | Replaced: `success-confirmed`, `success-pending`, `success-purchase-tokens`. New: `success-purchase-book`, `success-purchase-gift`. Each in ES/EN, desktop/mobile |
| CI | **Did not run** (stacked PR; `ci.yml` triggers only on PRs to `main`, §9). No green CI is claimed |

### 10.11 Protected systems

- **No change** to:
  - the reader / Escucha Activa;
  - permanent book ownership;
  - business-rule engines (prices, token economics, Causas 2.22%, PO-053);
  - NEM-024 restrictions;
  - production or staging data or infrastructure.
- **No Stripe account, key or real purchase** was used.
- **Disposable database:** the container was removed after the evidence runs.

**STOP for independent Product Architecture review.**
