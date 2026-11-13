# Payment Lifecycle Stabilization: report

**Mission:** NOETIA, Payment Lifecycle Stabilization (P0). PO authorization: approved, bounded implementation.
**Branch:** `fix/payment-lifecycle-stabilization-20261112`, stacked on PR #59 (`feat/public-ecosystem-site-20261112` at `e326b81`).
**Status:** Draft. Not merged, not deployed. No real purchases, Stripe credentials or production or staging access were used.
**STOP:** independent Product Architecture review is required before any merge, deployment or activation.

> **Correction round 1 (2026-11-13), PA independent review of `9a8b4d8`:** Checkpoints A and D were accepted provisionally; B and C needed correction. The corrections, real-PostgreSQL evidence, open STOP gates and the T-1/T-2 decision packet are in **§10**. Where §10 and earlier sections disagree, §10 is current. Reviewed head for this round: **`9a8b4d8`**. New head: see §10.1.
>
> **Round 2 (2026-11-13), PA review of `220e33d`:** the transactional webhook fulfillment and the atomic identity corrections were **provisionally accepted**. The **PO decided T-1** (initial cycle of tokens when the 14-day trial begins) and **USD** as the commercial currency; both are **final**. Round 2 implements T-1, verifies and marks USD, and records both decisions in [`docs/product-governance/COMMERCE-DECISIONS.md`](../../product-governance/COMMERCE-DECISIONS.md). See **§11**, which supersedes every earlier mention of a pending trial-token decision.
>
> **Round 3 (2026-11-13), PA review of `b320561`:** T-1 and USD were accepted for their bounded scope. Analysis and design only, no code changes: trial eligibility, annual cycle accuracy (13 cycles per year today; 20/20 double grants with two scheduler instances), paid-invoice eligibility, and launch-safeguard plans. See **§12**, including the PO decisions it needs.
>
> **Round 4 (2026-11-13), PO authorization D1–D6:** implemented. One trial per eligible customer; exactly 12 paid annual allocations; cancellation preserves paid entitlements; no tokens from upgrades; valid $0 renewals; bilingual disclosures. Also atomic token redemption and a scheduler that is safe across instances. See **§13**, which supersedes §12's open decisions.
>
> **PA follow-up F-01 / F-02 (2026-11-13):** F-02 was demonstrated and corrected: a renewal is never allocated without an authoritative billing period, and the event fails closed. F-01 was verified with no change; one case awaits a PO decision. See **§14**.

## 0. Summary

| Checkpoint | Result |
|---|---|
| **A**: duplicate-billing protection | **Done.** The server refuses a second subscription. The check covers the local record and Stripe itself, runs under a per-user database lock, reuses or expires open Checkout sessions, and fails safe (503) when Stripe can't be read. **No migration.** |
| **B**: webhook identity and consistency | **Done, except one part that is behind a STOP gate.** Subscription events re-read Stripe, so the result no longer depends on delivery order. A different Stripe subscription can never silently replace a live one. Duplicates are logged. *(Round 1:)* recording `planId` earlier was held for a PO decision. **Done in round 2:** the PO decided T-1, the plan is recorded on every event, and the trial grant is implemented (§11). |
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

### 3.4 Trial-token behaviour (historical: resolved by the PO's T-1 decision, implemented in §11)

> **Resolved.** The PO chose **T-1** on 2026-11-13. The order-dependent behaviour below is the **pre-round-2** state and no longer applies on this branch; see §11. The table of alternatives is kept only as a record of what was presented.

**Behaviour before round 2:**
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

**Outcome:** the PO decided **T-1**, which is final (§11). The customer wording for `/pricing` and the Terms still goes through the Terms review (OP-3).

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

1. ~~**Trial tokens (§3.4)**~~ — **decided: T-1** (PO, 2026-11-13); implemented in §11.
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
- ~~the PO trial-token decision~~ (decided T-1, 2026-11-13; implemented in §11);
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

Logs: `payment-safety-pg-check.txt` and `payment-safety-pg-check.negative-control.txt`. Both were **regenerated in round 2** with the extended script (§11.5). In the regenerated negative control, `9a8b4d8` shows 19/25 and 16/25 silent replacements for S5/S5b; the 15/25 figures above come from the round-1 run. Interleaving varies between runs. **Not covered by the script:** the book purchase. It relies on the `UQ_user_books_user_book` constraint plus the session key, and is covered by unit tests.

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
| G-2 | Trial tokens | PO | **Closed in round 2:** the PO decided **T-1**; implemented in §11 |
| G-3 | **Fulfillment keys in `stripe_processed_events`** (10.2): confirm, or request the dedicated table | PA | **Closed in round 2:** the PA allowed reusing the table, conditional on updating the entity comment and adding regression tests (both done, §11.3). Originally implemented without schema change. **Alternative (migration, not prepared as code):** `stripe_fulfillments("key" varchar PK, kind varchar, "stripeObjectId" varchar, "eventId" varchar, "createdAt" timestamptz default now())`, used identically |
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

### 10.9 Trial tokens (superseded)

The round-1 decision packet was presented to the PO, who decided **T-1** on 2026-11-13. That decision is final and is recorded in [`docs/product-governance/COMMERCE-DECISIONS.md`](../../product-governance/COMMERCE-DECISIONS.md). The implementation, tests, evidence and customer-disclosure draft are in **§11**. The comparison table and the round-1 recommendation have been withdrawn from this report.

### 10.10 Validation (local, round 1; round-2 results are in §11.8)

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

---

## 11. Round 2: T-1 implementation and USD verification (PA review of `220e33d`, 2026-11-13)

**PA decision being implemented:**
- The transactional webhook fulfillment and the per-user identity lock are **provisionally accepted**, and are kept unchanged here.
- **PO decisions, final:**
  - **T-1:** the plan's initial cycle of tokens is granted when a valid 14-day free trial begins.
  - **USD** is Noetia's commercial and financial currency.
- **Governance record:** [`docs/product-governance/COMMERCE-DECISIONS.md`](../../product-governance/COMMERCE-DECISIONS.md) (new; the PO has not assigned decision numbers). `docs/production-safety/03-webhook-idempotency.md` now carries a status note pointing here.

**Not done, by instruction:** no merge, no deploy, no live purchase, no premium activation, no migration, no change to trial duration, prices or economics. NEM-024: E-1 stays **OPEN / BLOCKED**, and Checkpoint E stays **NOT QUALIFIED**. The PR stays **Draft**, stacked on PR #59.

### 11.1 Commits and changed files

| Commit | Scope |
|---|---|
| `70f626a` | API: T-1 (plan on every event, once-per-subscription trial grant, $0 invoices grant no cycle), entity comment, unit tests |
| `dbf2748` | API: T-1 scenarios in the real-PostgreSQL verification script |
| `232b574` | Web and mobile: prices shown as explicitly marked US dollars; pricing metadata corrected to US$8.99 |
| (report commit) | This section, the governance record, the production-safety status note, regenerated evidence, USD screenshots |

**Code files:**
- **API source:**
  - `services/api/src/subscriptions/subscriptions.service.ts`
  - `services/api/src/subscriptions/webhooks.service.ts`
  - `services/api/src/subscriptions/stripe-fulfillment-ledger.ts`
  - `services/api/src/subscriptions/stripe-processed-event.entity.ts` (comment only)
- **API tests:**
  - `services/api/tests/unit/subscriptions/{subscriptions.service,webhooks.service,payment-lifecycle,stripe-fulfillment-ledger}.spec.ts`
- **API verification script:** `services/api/scripts/payment-safety-pg-check.ts`
- **Web:**
  - `services/web/lib/currency.ts` (new)
  - `services/web/tests/unit/lib/currency.spec.ts` (new)
  - `services/web/app/(billing)/pricing/{page,layout}.tsx`
  - `services/web/app/(billing)/gift/page.tsx`
  - `services/web/lib/i18n/{en,es}.ts`
  - `services/web/tests/unit/app/billing/pricing.spec.tsx`
- **Mobile:** `services/mobile/src/i18n/{en,es}.ts` (paywall price strings only)

### 11.2 T-1 design (on the accepted transactional architecture)

1. **Plan recorded on every subscription event.** `applyStripeSubscription` maps Stripe's current price to `planId` for **every** event: created, Checkout completed, updated, `invoice.paid`, `invoice.payment_failed`. Before, only `updated` did this. This removes the delivery-order dependence. An unknown price records `null`, as `updated` always did.
2. **Trial-start grant: once per Stripe subscription.** After the identity-guarded upsert, inside the same webhook transaction, the grant happens when Stripe reports the subscription `trialing` with a `trial_end`.
   - `issueTrialStartTokens` claims **`fulfillment:trial-start-tokens:<stripeSubscriptionId>`** and issues `tokensPerCycle` `paid` tokens with reason "Trial start (initial cycle)" and the 90-day expiry.
   - The key is **distinct from the per-invoice renewal keys** (`fulfillment:invoice-tokens:<in_…>`).
   - **Whichever signup event is processed first grants it;** all others find the key taken.
   - **No grant** for an identity-rejected duplicate subscription, a row without a plan (the key stays unclaimed), or a call outside a webhook transaction.
3. **$0 invoices grant no cycle.** `handleInvoicePaid` skips the renewal grant when `amount_paid === 0`. This covers the trial's `subscription_create` invoice and $0 prorations, so neither can produce a second initial grant.
4. **Paid cycles are unchanged.** The first paid invoice (day 15) and every later paid invoice grant `tokensPerCycle` once per invoice id, as before.
5. **Annual plans.** The trial grant does **not** touch `nextTokenIssuanceAt`. The monthly schedule starts at the first **paid** annual invoice (+30 days), exactly as before. The cron only issues to `active` rows, so it can never issue during a trial.
6. **Cancellation is unchanged.** A trial cancelled before payment keeps its initial tokens (`paid`, 90 days) and any books redeemed. No claw-back, and no paid cycle.
7. **No browser path.** Grants come only from verified webhooks, inside the transaction. `/billing/success` grants nothing.
8. **No migration.** Existing columns and the existing `stripe_processed_events` primary key.

**Behaviour change to note:** a $0 invoice that isn't a trial (for example a 100%-off coupon cycle) now grants no cycle. No such coupons exist today. Before T-1 the trial grant depended on delivery order (§3.4), and a paid invoice with no prior `updated` event granted nothing; the negative control shows both (11.5).

### 11.3 Ledger reuse: PA conditions met

- **Entity comment updated.** `stripe-processed-event.entity.ts` no longer says rows are written "only after" processing. It describes the claim-first transaction and the two kinds of key (Stripe event id; `fulfillment:<kind>:<id>` with `type = fulfillment:<kind>`). Deployed migration 066 is **not** edited.
- **Regression tests** (`stripe-fulfillment-ledger.spec.ts`, 8 tests):
  - stable key formats for all three kinds;
  - no collision with `evt_…` ids or between kinds;
  - the trial key is distinct from an invoice key for the same id;
  - the `type` column names the kind;
  - a database error propagates (rollback);
  - an unexpected driver result fails safe (no fulfillment).

### 11.4 USD verification

| Item | Where | Result |
|---|---|---|
| Gift Checkout amount | `gifts.service.ts`, `price_data.currency: 'usd'` | **Verified (code)** |
| Book purchase Checkout amount | `subscriptions.service.ts`, `price_data.currency: 'usd'` | **Verified (code)** |
| Subscription plans (6 rows) | Stripe Price objects referenced by `plans.stripePriceId` | **PENDING.** Currency is defined in Stripe. There is no Stripe access from this environment, and no credentials were used or exposed. The PO should confirm in the Stripe Dashboard that each referenced price has currency `usd` |
| Token packages | Stripe Price objects referenced by `token_packages.stripePriceId` | **PENDING** (same reason) |
| Stored display amounts | `plans.amountCents`, `token_packages.amountCents` | Integer US cents; read as USD everywhere. Unchanged |
| Terms of Service | `lib/legal/terms-of-service.ts` | States `USD` explicitly in both languages ✔. The annual figures there are the subject of the separate legal-gated PR #22 (NOF-004); not touched |
| **Display: web `/pricing`** (plan cards, annual equivalent, token packages) | `formatUsd` | **Corrected:** bare `$8.99` → **`US$8.99`** in ES and EN |
| **Display: web `/gift`** | `formatUsd` | **Corrected** to `US$` |
| **Display: web token copy** (`unlocks3`) | `en.ts` / `es.ts` | **Corrected:** `US$8.33` |
| **Display: `/pricing` metadata** | `pricing/layout.tsx` | **Corrected:** "desde $9.99/mes" was both bare and outdated → "desde US$8.99/mes", matching migration 067 |
| **Display: mobile paywall** | `mobile/src/i18n/{en,es}.ts` | **Corrected:** `US$8.99/mo` etc. |
| E-mails and API copy | `services/api/src` | No price amounts rendered |

**Why `US$`:** in much of Latin America (MXN, COP, ARS, CLP…), a bare `$` is the local peso, so `$8.99` would misstate the price for Spanish-speaking readers.

**Browser check** (`browser-run-usd.txt`): `/pricing` and `/gift`, ES/EN, desktop/mobile, 8/8 runs. Every amount is `US$…`, **0 bare-`$` amounts**, no horizontal overflow. Screenshots: `screenshots/{pricing,gift}-usd--{es,en}--{desktop,mobile}.jpg`.

**Pricing inaccuracies that are not about currency (recorded, not changed; owned by the NOF-004 presentation PR #21):**
- the Family card says "Hasta 5 usuarios / Up to 5 users" on web and mobile, but the plan allows 4 profiles;
- plan cards show raw names ("Individual Monthly", "Dual Reader");
- the mobile paywall lists "Full library access".

`components/PlanCard.tsx` / `lib/plan-utils.ts` also format prices without a currency marker, but no page uses them (dead code).

### 11.5 Real PostgreSQL evidence

Same method as 10.5: a disposable `postgres:16-alpine` container (removed afterwards), all **68 migrations**, the real services, fake Stripe/e-mail only, separate pool connections, and a `SIGKILL`ed child for crashes. The script now has **16 scenarios**: S1–S8 from round 1 plus T1–T6.

| # | T-1 scenario | Corrected (`70f626a`, 3 runs) | `220e33d` (pre-T-1) |
|---|---|---|---|
| T1 | 15 rounds × **11 concurrent** signup deliveries (created/completed/updated/$0 invoice; duplicates + new ids) | **0** rounds ≠ 1 token | 5/15 rounds wrong |
| T2 | **All 24 delivery orders** of the four signup events | **0** orders ≠ 1 token | **12/24** orders grant **0** (order dependence) |
| T3 | `SIGKILL` right after the trial grant inserted tokens, before COMMIT; then retry + other events | after crash: tokens 0, trial claim 0, row 0 → after retry: **1** | no trial grant at all (tokens 0) |
| T4 | Trial cancelled before paying, then late events | **1** token kept and active; row `canceled` | "passes" by accident: the $0 invoice granted a token on an already-cancelled subscription |
| T5 | First paid invoice (4 concurrent deliveries, 3 ids), then next month | **2** → **3** | **0 → 0** (no `updated` event → no plan → no tokens at all) |
| T6 | Annual: trial grant → cron during trial (even with a forced overdue pointer) → first paid annual invoice → cron not due → cron when due → cron again | 1 → 1 → **2** (schedule **+30.00 days**) → 2 → **3** → 3 | 0 throughout |

**S1–S8** (round-1 guarantees) still pass on the corrected code: **16/16 in each of 3 runs**. Negative controls with the same script:
- `220e33d`: **11/16** (all S scenarios pass; T-1 scenarios fail);
- `9a8b4d8`: **2/16**.

Logs: `payment-safety-pg-check.txt` and `payment-safety-pg-check.negative-control.txt`.

### 11.6 Residual risks: follow-up recommendations (not implemented)

| Risk | Recommendation |
|---|---|
| **Ambiguous Checkout-session visibility window** (10.6) | Persist a pending-checkout record under the existing lock: `checkout_attempts`, a migration needing PA approval (G-4). Until then, the identity guard flags any resulting duplicate and never adopts it silently |
| **Concurrent redemption of one token for several books** (pre-existing, `redeemToken`) | A conditional `UPDATE token_ledger SET status='redeemed' … WHERE id=$1 AND status='active' RETURNING id`, plus the `user_books` insert in the same transaction. Small, no migration. Needs its own PO authorization |
| **Repeat free-trial eligibility / T-1 abuse** | Every subscription Checkout currently sets `trial_period_days: 14`, so a returning customer gets another trial and, under T-1, another initial cycle (unit test "re-subscribing … granted again"). Recommend a PO trial-eligibility rule, for example one trial per Noetia user / Stripe customer: omit `trial_period_days` when the user has had any subscription. This is product policy, not implemented |
| **Server-side verification of Checkout success** (G-1) | Implement the endpoint designed in 10.4 after PA approval. The interim neutral copy stays until then |
| **Gift e-mail lost after a successful commit** | A resend path: an admin action, or an idempotent "gift e-mail pending" marker (a migration). `EmailService` already swallows SMTP errors, so today a failed send is only logged |

**Other observations (not changed):**
- **Annual drip cadence (pre-existing, economics).** The monthly schedule advances by 30 days, so a paid annual year receives the invoice grant plus 12 scheduled grants (days 44 … 374 after a day-14 first payment), **13 cycles per 365 days**. With T-1 the trial adds its one initial cycle on top, as decided. The cadence itself predates this mission and is a PO/finance question.
- **Schedule arithmetic uses local time** (`setDate(+30)`), so `nextTokenIssuanceAt` can move by the daylight-saving hour depending on the server's timezone (pre-existing). The tests tolerate it and also pass under `TZ=UTC`.

### 11.7 Remaining STOP gates

| # | Item | Owner | State |
|---|---|---|---|
| G-1 | Server-side Checkout-session verification (new endpoint) | PA | Design in 10.4; not implemented |
| G-4 | Pending-checkout record (migration) | PA | Proposal only |
| G-5 | Location of the real-database verification script (`services/api/scripts/`) | PA | Keep or drop |
| G-6 | §8 items 2–4 (duplicate-account resolution, portal plan-switching, stale live records) | PO | Unchanged |
| USD-1 | Confirm in Stripe that every referenced subscription and token-package price is `usd` | PO | **Pending verification** |
| T1-D | T-1 customer disclosure wording on `/pricing` and in the Terms (draft in the governance record) | PO / legal (OP-3) | Not published |

**Closed:** G-2 (T-1 decided and implemented) and G-3 (ledger reuse accepted, conditions met). **No migration** was needed for T-1.

### 11.8 Validation (local)

| Check | Result |
|---|---|
| API unit tests (full, `--maxWorkers=2`) | **1110/1110** pass. The one non-loading suite is `auth.controller.spec`: the `bcrypt` native binding isn't built in this worktree (environmental, unrelated, as in rounds 0–1) |
| API suites changed | `subscriptions.service.spec` 121, `payment-lifecycle.spec` 60 (incl. 24 delivery orders, annual timeline), `webhooks.service.spec` 33, `stripe-fulfillment-ledger.spec` 8, `gifts.service.spec` 15; all also pass under `TZ=UTC` |
| API coverage (changed files) | `webhooks.service.ts` 100% statements / 95.3% branches; `subscriptions.service.ts` 92.0 / 82.2; `gifts.service.ts` 97.3 / 84.6. Global branches 71.05%: the gate (80%) was failing on `main` before this mission; threshold unchanged |
| API `tsc --noEmit` / eslint | pass / 0 errors (`any` warnings, existing style) |
| Real PostgreSQL script | **16/16** in 3 consecutive runs; negative controls 11/16 (`220e33d`), 2/16 (`9a8b4d8`) |
| Web unit tests (full) | **441/441** pass (28 suites), incl. i18n en/es parity, `currency.spec`, and the `/pricing` USD assertion |
| Web `tsc` / `next lint` (changed files) | pass / no warnings or errors |
| Mobile unit tests (full) | **179/179** pass (24 suites). Run with the main checkout's `node_modules` linked temporarily, because this worktree has none; the link was removed afterwards |
| Browser | `/pricing` and `/gift` USD display: 8/8 runs, 0 bare-`$` amounts, no overflow |
| CI | **Did not run** (stacked PR, §9). No green CI is claimed |

### 11.9 Release restrictions (unchanged)

- **No merge, deployment, live purchase or premium activation.** Merging to `main` is a production deploy and needs a PO merge instruction naming the PR.
- **Protected systems untouched:**
  - the reader / Escucha Activa;
  - permanent book ownership;
  - the Causas 2.22% policy and PO-053;
  - prices;
  - NEM-024 (E-1 **OPEN / BLOCKED**, Checkpoint E **NOT QUALIFIED**);
  - production and staging data and infrastructure.

**STOP for independent PA review.**

---

## 12. Round 3: trial eligibility, annual cycle accuracy, paid-invoice eligibility, launch-safeguard plans (PA review of `b320561`, 2026-11-13)

**PA decision:** the T-1 and USD implementation is accepted for its bounded scope. **This round is analysis and design only. No implementation code was changed,** because these are economic-policy questions. Nothing was merged, deployed or purchased. T-1 and USD are final and are not reopened. PR #60 stays Draft, stacked on PR #59.

**New evidence (throwaway harnesses on the real services at `b320561`; source appended to each file):**
- `annual-schedule-simulation.txt`: the real webhook and subscription services, a fake clock, 2 years of daily cron;
- `annual-cron-concurrency.txt`: two scheduler instances against a disposable PostgreSQL 16 with all 68 migrations; the container was removed afterwards.

### 12.1 Findings

| ID | Sev. | Finding | Evidence |
|---|---|---|---|
| **R3-1** | P0 / H | Every subscription Checkout sets `trial_period_days: 14`, so **returning customers get another trial and, under T-1, another initial cycle**. Deleting the account removes the local `subscriptions` row (`users.service.ts deleteAccount`) but not the Stripe customer, so re-registering also resets eligibility | `subscriptions.service.ts createCheckoutSession`; unit test "re-subscribing … granted again" |
| **R3-2** | P0 / H | **Annual over-grant.** The monthly schedule advances by **30 days**, so a 365-day paid period receives the invoice cycle plus **12** scheduled cycles = **13** (14 in the first 379 days counting T-1). The Terms promise "monthly tokens", which is 12 per year | Simulation A: grants on days 14, 44.5 … 374.5, renewal 379 |
| **R3-3** | P0 / H | **Annual under-grant after cancel-at-period-end.** The cron only issues to `status='active'`. A subscriber who sets cancel-at-period-end becomes `canceling` and receives **no further monthly cycles** for the rest of the paid year. The Terms say *"Cancellation takes effect at the end of the current billing period."* | Simulation B: cancellation requested on day 60 → **2 of 12** paid cycles |
| **R3-4** | P0 / H (latent) | **The scheduler is not safe with multiple instances.** It does find → issue → advance the pointer with no claim, so two API processes running the cron at the same time both grant. Production runs one `api` container, and the ingestion scripts don't load `ScheduleModule`, so this is latent until a scale-out or an overlapping container | Real PostgreSQL: **20/20** rounds double-granted, 40 grants instead of 20 |
| R3-5 | M | The schedule uses local-time `setDate(+30)`, so it shifts by the DST hour depending on the server's timezone | §11.6; addressed by the R3-2 fix |
| **R3-6** | P1 / M | `handleInvoicePaid` grants a full cycle for **any** paid invoice, whatever its `billing_reason`: `subscription_update` (an upgrade proration), `manual`, `subscription_threshold`. An immediate upgrade therefore grants an extra full cycle of the new plan. The Terms say plan changes take effect at the next cycle | `webhooks.service.ts handleInvoicePaid` (only checks `amount_paid === 0`) |
| R3-7 | P1 / L | A renewal's identity is the **invoice id**, not the billed **period**. A voided invoice re-issued for the same period would grant twice | `issueTokensForNewSubscription` key `invoice-tokens:<in_…>` |
| R3-8 | P1 / policy | A $0 `subscription_cycle` invoice (100%-off coupon) grants nothing under the current `amount_paid === 0` rule. No discount policy exists | §11.2 note |

### 12.2 P0: trial eligibility (design; not implemented, needs PO approval)

**Smallest reliable signal, using existing data only.** The check runs inside `createCheckoutSession`, which already holds the per-user checkout lock and already lists Stripe subscriptions for every known customer id. A user is **trial-eligible** only if **all** of these hold:
1. **No local history.** The user has no `subscriptions` row with a non-null `stripeSubscriptionId`. Rows persist after cancellation (status `canceled`); only account deletion removes them.
2. **No Stripe history.** `stripe.subscriptions.list({ customer, status: 'all' })` for each known customer (`users.stripeCustomerId`, `subscriptions.stripeCustomerId`) returns no subscription that ever started: `trial_start != null`, or any status other than `incomplete_expired`. This is the same call the guard already makes, with `status: 'all'` added. A truncated list or a Stripe error → **503** `subscription_status_unavailable`, the existing fail-safe; the user is never charged by surprise.
3. **Optional, recommended:** `stripe.customers.list({ email })` for the user's normalized e-mail returns no *other* customer with subscription history. This catches deleted-and-re-registered accounts. Matching relies on the e-mail, so it is a deterrent, not proof.

**Effect.**
- **Eligible:** unchanged; Checkout includes `trial_period_days: 14` and T-1 grants at trial start.
- **Not eligible:** Checkout omits the trial, so the first invoice is `subscription_create` with an amount above $0. Stripe never reports `trialing`, so **no T-1 grant**. The first paid invoice grants the normal cycle (existing path).

No webhook change is needed: T-1 already keys off Stripe's `trialing` status.

**UI contract (additive).** `GET /subscriptions/me` adds `trialEligible: boolean`. `/pricing` and the mobile paywall then show "Start free trial" or "Subscribe" and pick the matching disclosure (12.5 E).

**Recommended policy (for PO decision):**
- **One free trial per person:** per Noetia account, per Stripe customer, and per e-mail when check 3 is adopted. Returning subscribers start paying on day 1.
- **Linked Duo/Family members** who never held their own subscription remain eligible.
- **Gift recipients and token buyers** remain eligible.

**Files:**
- `subscriptions.service.ts` (`createCheckoutSession`, `getSubscriptionStatus`)
- web `app/(billing)/pricing/page.tsx` + i18n
- mobile paywall + i18n

**Regression tests** (unit + payment-lifecycle; the real-PostgreSQL script for the lock):

| Scenario | Expected |
|---|---|
| First-time user | Trial; T-1 grant; first paid invoice grants |
| Cancelled **during** trial, re-subscribes | **No trial**; charged on day 1; **no T-1 grant**; first invoice grants exactly once |
| Cancelled **after paying** (monthly or annual), re-subscribes | No trial |
| Local row missing (deleted account) but Stripe history exists | No trial |
| Only an `incomplete_expired` Stripe subscription | Eligible |
| Stripe list error or `has_more` | 503; no session |
| Linked member subscribing for themselves | Eligible (pending PO) |
| Two concurrent checkouts | Existing lock; one session |
| Same e-mail on a new account (if check 3 is adopted) | No trial |

### 12.3 P0: annual token cycle accuracy

**Complete schedule, Individual Annual** (1 token per cycle; trial starts 2027-01-01 12:00 UTC; first paid invoice 2027-01-15; renewal 2028-01-15). Dates are when a cycle becomes due; the daily 01:00 run grants it.

| Event | Current code (simulation A) | Proposed correction |
|---|---|---|
| Trial start (T-1) | 2027-01-01, 1 cycle | same |
| First paid annual invoice | 2027-01-15, 1 cycle | same |
| Scheduled monthly cycles | 02-15, 03-17, 04-16, 05-16, 06-15, 07-15, 08-14, 09-13, 10-13, 11-12, 12-12, **2028-01-11**, so **12** | 02-15, 03-15 … 12-15 (calendar months from the paid date), so **11** |
| Paid cycles in the paid period | **13** | **12** (invoice + 11) |
| Renewal invoice 2028-01-15 | 1 cycle (starts year 2) | same |
| Cancel at period end, requested day 60 | **2** paid cycles (stops at `canceling`) | **12** if the PO confirms that cycles continue until period end (R3-3); otherwise 2 |
| Immediate cancellation (deleted) on day 100 | 3 paid cycles, then stops | same (stops on `canceled`) |
| Monthly plans | 1 per paid invoice (12/yr) + T-1 | unchanged |

Month-end anchors are clamped: an anchor of Jan 31 gives Feb 28, Mar 31, Apr 30, and so on.

**Smallest correction** (`subscriptions.service.ts issueMonthlyTokensForAnnualPlans` and `issueTokensForNewSubscription`; **no migration, no price change, T-1 untouched**):
1. **Calendar months, UTC.** The k-th scheduled cycle (k = 1…11) is due at `addMonthsClamped(periodStart, k)`, where `periodStart = currentPeriodEnd − 12 months`. `currentPeriodEnd` is already stored from Stripe on every event. This replaces +30 days in local time and fixes R3-5.
2. **Cap at the paid period.** Issue only cycles that are due before `currentPeriodEnd`; the renewal invoice owns the next period's first cycle. That gives exactly 12 per paid period, and missed days are caught up.
3. **Concurrency.** Claim each cycle with `fulfillment:annual-cycle:<stripeSubscriptionId>:<currentPeriodEnd ISO>:<k>` (existing ledger, existing primary key) in the **same transaction** as the grant. Any number of instances, or a re-run, grant each cycle once.
   - **Alternative:** a conditional pointer update, `UPDATE … SET "nextTokenIssuanceAt"=:next WHERE id=:id AND "nextTokenIssuanceAt"=:old RETURNING`.
   - `nextTokenIssuanceAt` then becomes informational.
4. **Status filter, PO decision.** Today only `active` rows get cycles. Recommended: include **`canceling`**, which is paid through period end, as the Terms describe. Keep `past_due` and `canceled` excluded. **This restores entitlement and needs explicit authorization.**

**Regression tests:**
- the simulation's 2-year timeline: exactly 12 paid cycles per period + T-1;
- Jan 31 and Feb 29 anchors;
- a DST boundary under two timezones;
- catch-up after 3 missed days;
- two concurrent schedulers → each cycle once (real PostgreSQL; today 20/20 double);
- cancel at period end on day 60 → 12 if (4) is approved, else 2;
- immediate cancellation;
- renewal mid-month;
- `past_due` at renewal → no cycles.

**PO decisions:**
- (a) confirm **12 cycles per annual period** as the contract;
- (b) whether **`canceling` annual subscribers keep their monthly cycles until period end**.

Both change the economic entitlement relative to today's code (one fewer cycle per year; restored cycles after cancel-at-period-end). **Any already-issued over- or under-grants:** there are 0 active annual subscriptions on production (production-safety doc 01), so no remediation is expected. Confirm with a read-only count before launch.

### 12.4 P1: paid-invoice eligibility (design; no policy introduced)

**Recommended rule for cycle tokens** (`webhooks.service.ts handleInvoicePaid`, `subscriptions.service.ts issueTokensForNewSubscription`):

| `billing_reason` | Grants a cycle? |
|---|---|
| `subscription_cycle` | **Yes** (regular renewal; also the first invoice after a trial) |
| `subscription_create` with `amount_paid > 0` | **Yes** (a subscription started without a trial, e.g. a returning customer under 12.2) |
| `subscription_create` with $0 | No (the trial invoice; T-1 handles the trial) |
| `subscription_update` (plan change or proration) | **No.** The next `subscription_cycle` grants the new plan's amount, consistent with the Terms |
| `manual`, `subscription_threshold`, other | **No** |
| `subscription_cycle` with $0 (coupon) | **PO decision** (R3-8); no discounts exist today. Recommended: grant, since the period is entitled, but **not implemented** without approval |

**Identity:** key renewals by the billed **period**, `fulfillment:period-tokens:<stripeSubscriptionId>:<subscription line period.start>`, read from the invoice's subscription line item (`lines.data[].period.start`). Do not use `invoice.period_start`, which refers to the previous period on subscription invoices. Keep the invoice-id key as a second guard. A re-issued invoice for the same period, or two event ids, then grant once.

**Annual plans:** the yearly `subscription_cycle` invoice stays the k=0 cycle of 12.3.

**PO decision:** whether an immediate **upgrade** should grant anything mid-cycle (for example, the token difference). Recommended: no; the new amount applies from the next cycle, matching the Terms. Also confirm the Stripe portal's plan-change proration setting (§8 item 3).

**Regression tests:**
- a paid `subscription_update` → no cycle;
- a $0 renewal (coupon) → per PO decision;
- a regular `subscription_cycle` → once;
- duplicate delivery and a different event id → once;
- a voided and re-issued invoice for the same period → once;
- a non-trial `subscription_create` above $0 → once;
- the trial `subscription_create` at $0 → none (T-1 only);
- `manual` / `subscription_threshold` → none;
- an annual yearly invoice → k=0 only.

### 12.5 Remaining launch safeguards: implementation plans

**A. Atomic book-token redemption** (`subscriptions.service.ts redeemToken`; no migration)
- **Problem:** it picks the oldest active token, then updates it unconditionally, so two concurrent redemptions can consume one token for two books, and both books are kept permanently.
- **Plan:** do it all in one transaction:
  1. expire stale tokens;
  2. `UPDATE token_ledger SET status='redeemed', "redeemedAt"=now(), "bookId"=$book WHERE id = (SELECT id FROM token_ledger WHERE "userId"=$owner AND status='active' AND "expiresAt">now() ORDER BY "issuedAt" LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING id`;
  3. no row → `no_tokens_remaining`;
  4. `INSERT INTO user_books … ON CONFLICT ("userId","bookId") DO NOTHING RETURNING id`; no row → throw `already_owned`, which rolls back the token.
  - The linked-member pool path uses the same statement with the owner's id.
- **Tests:**
  - unit;
  - real PostgreSQL: 5 concurrent redemptions of 1 token for 5 books → 1 book, 1 token used; 2 concurrent redemptions of the same book → 1 ownership, 1 token used; linked member and owner at the same time → 1.

**B. Server-side Checkout-session confirmation (G-1)**
- **Plan:** implement the design in §10.4:
  - `GET /subscriptions/checkout-sessions/:id/status` (optional JWT, throttled, id format check, ownership check, 404 for others);
  - returns `{kind, state, fulfilled}` from `sessions.retrieve` and the `fulfillment:checkout-session` key, with no personal data.
- **Files:**
  - `subscriptions.controller.ts`, `subscriptions.service.ts`;
  - web `billing/success/page.tsx` + i18n: "Payment received" only when `state=complete`, "added" only when `fulfilled`.
- **Tests:**
  - ownership (owner, other user, anonymous gift);
  - each state;
  - Stripe error → neutral copy;
  - no grant path.

**C. Checkout ambiguity after Stripe timeouts (G-4, no migration)**
- **Plan:** use **existing Redis** (`auth/redis.provider.ts`) plus a **Stripe idempotency key**, under the existing checkout lock:
  1. read or set `checkout:attempt:<userId>:<planId>` = nonce (TTL 23 h, shorter than Stripe's 24 h idempotency window and the 24 h session lifetime) **before** `sessions.create`;
  2. pass `idempotencyKey: checkout:<userId>:<planId>:<nonce>`.
  - **Effect:** a retry after an ambiguous failure replays the same request, so Stripe returns the session it already created. That closes the visibility window.
- **Clean-up:** delete the nonce when the guard expires that plan's session, or once a subscription exists.
- **Failure handling:**
  - Redis unavailable → 503, fail safe;
  - Stripe `idempotency_error` (parameters changed) → 409 `checkout_pending`.
- **Alternative:** the `checkout_attempts` table (a migration).
- **Tests:** timeout then retry → one session; Redis down → 503; plan switch → nonce cleared, new session; nonce TTL expiry.

**D. Stripe USD price-object verification (USD-1)**
- **Plan:** a read-only script, `services/api/scripts/verify-stripe-prices.ts`, that the **PO runs** with a **restricted key** (Prices: read), passed via environment variable at run time and never stored or logged.
- **Inputs:** price ids from the public `GET /api/subscriptions/plans` and `/token-packages`; no database access needed.
- **Checks** (`prices.retrieve`):
  - `currency === 'usd'`;
  - `unit_amount === amountCents`, so the displayed amount equals the charged amount;
  - `recurring.interval` matches the plan (packages: `one_time`);
  - `active`;
  - `livemode` as expected.
- **Output:** a pass/fail table; non-zero exit on any mismatch.
- **Tests:** unit tests with a mocked Stripe client (match, wrong currency, amount drift, inactive, missing price).

**E. Bilingual T-1 disclosures (T1-D; legal approval required, OP-3)**

Where the copy appears:
- web `pricing.trial` / `pricing.subtitle` and the plan-card token line;
- mobile `paywall.subtitle` and the plan rows;
- the Terms "Free trial" clause (overlaps legal-gated PR #22);
- optionally `/billing/success` while `trialing`.

**Draft copy:**

| Surface | EN | ES |
|---|---|---|
| Pricing subtitle (eligible) | 14-day free trial, with your plan's first tokens included. Cancel anytime. | 14 días de prueba gratuita, con los primeros tokens de tu plan incluidos. Cancela cuando quieras. |
| Plan card (n = 1 / 2 / 4) | Includes {n} token(s) to start your trial | Incluye {n} token(s) para empezar tu prueba |
| Terms clause | New subscribers receive a 14-day free trial that includes the plan's first monthly tokens. Books redeemed with these tokens remain yours, even if you cancel during the trial. One free trial per person. | Los nuevos suscriptores reciben 14 días de prueba gratuita que incluyen los primeros tokens mensuales del plan. Los libros canjeados con estos tokens siguen siendo tuyos aunque canceles durante la prueba. Una prueba gratuita por persona. |
| Returning subscriber (if 12.2 adopted) | Welcome back. Your subscription starts today. | Te damos la bienvenida de nuevo. Tu suscripción comienza hoy. |

The sentence "One free trial per person" applies only if the PO adopts 12.2.

**Tests:** i18n parity, and a conditional render by `trialEligible`.

### 12.6 Product Owner decisions required

1. **Trial eligibility (12.2):** adopt one trial per person (account + Stripe customer; e-mail check optional). Do linked members remain eligible?
2. **Annual contract (12.3):** confirm **12 monthly cycles per annual period** (T-1 extra, as decided).
3. **Annual cancel-at-period-end (12.3, R3-3):** do monthly cycles continue until period end?
4. **Upgrades (12.4):** no mid-cycle grant (recommended), or a token difference? Also confirm the portal proration setting.
5. **$0 renewal invoices (12.4, R3-8):** grant or not, if discounts are ever introduced.
6. **Disclosures (12.5 E):** approve the copy for legal review.
7. Existing items: USD-1 (Stripe price check), §8 items 2–4.

### 12.7 Status

- **Code changed in this round:** none. Only this report section, the governance-record pointer and two evidence files.
- **Tests:** the existing suites at `b320561` are unchanged; results are in §11.8. Both harnesses ran the real services, and the temporary harness files were deleted after the runs.
- **STOP gates:**
  - G-1, G-4, G-5, USD-1, T1-D (§11.7);
  - the PO decisions above.
- **Release restrictions unchanged:** no merge, deploy, live purchase or premium activation. NEM-024: E-1 **OPEN / BLOCKED**, Checkpoint E **NOT QUALIFIED**.

**STOP for independent PA review and PO decisions.**

---

## 13. Round 4: PO D1–D6 implementation, atomic redemption, scheduler concurrency (PO authorization, baseline `1be3f48`, 2026-11-13)

**Authorization:** PRODUCT OWNER APPROVED, bounded implementation of D1–D6, atomic token redemption, and annual-scheduler concurrency.

**Preflight:**
- local, remote and PR head were all `1be3f48`, so there was no concurrent work to overwrite;
- the PR is Draft;
- it is stacked on the current PR #59 head (`e326b81`);
- I read the governance record and §12, and re-read the subscription, webhook, ledger and redemption code before changing anything.

**Not done, by instruction:**
- no merge, deploy, production-data change, Stripe price change, live charge or premium activation;
- no new Checkout-verification API, Redis checkout idempotency, Stripe price verification, gift-e-mail recovery, or work on unrelated systems;
- no migration;
- NEM-024: E-1 stays **OPEN / BLOCKED**, and Checkpoint E stays **NOT QUALIFIED**.

The decisions are recorded as final in [`docs/product-governance/COMMERCE-DECISIONS.md`](../../product-governance/COMMERCE-DECISIONS.md), section "D1–D6".

### 13.1 Commits and changed files

| Commit | Scope |
|---|---|
| `c8b1611` | API: D1 eligibility, D2/D3 annual schedule, D4/D5 invoice classes, atomic redemption, unit tests |
| `6487eb5` | Web `/pricing` and mobile paywall: D6 copy (en/es), tests |
| `267212e` | Real-PostgreSQL script: D1, A1–A4, I1, R1–R3 scenarios |
| (report commit) | Governance record, this section, evidence, screenshots |

The API changes are one commit because they share `subscriptions.service.ts`; no interactive partial staging was available.

**Files:**

| Area | Files |
|---|---|
| API source | `src/subscriptions/billing-cycles.ts` (new, pure rules); `subscriptions.service.ts`; `webhooks.service.ts`; `subscriptions.controller.ts` (`/me?trialEligibility=1`); `stripe-fulfillment-ledger.ts` (two new key kinds) |
| API tests | `billing-cycles.spec.ts` (new, 32); `subscriptions.service.spec.ts` (150); `payment-lifecycle.spec.ts` (67); `webhooks.service.spec.ts` (39); `stripe-fulfillment-ledger.spec.ts` (8) |
| API script | `scripts/payment-safety-pg-check.ts` |
| Web | `app/(billing)/pricing/page.tsx`; `lib/i18n/{en,es}.ts`; `tests/unit/app/billing/pricing.spec.tsx` (46) |
| Mobile | `src/api/subscriptions.ts`; `src/screens/PaywallScreen.tsx`; `src/i18n/{en,es}.ts`; `tests/unit/screens/PaywallScreen.spec.ts` |
| Docs | `docs/product-governance/COMMERCE-DECISIONS.md`; this report; `payment-safety-pg-check.txt`; `payment-safety-pg-check.negative-control.txt`; `browser-run-d6.txt`; 16 screenshots `pricing-trial-{guest,eligible,returning,unverified}--{es,en}--{desktop,mobile}.jpg` |

### 13.2 Compliance matrix

| Requirement | Implementation | Evidence |
|---|---|---|
| **D1** one 14-day trial per eligible customer | `createCheckoutSession`: trial only if there is no local subscription history **and** no started subscription in the Stripe history (`status:'all'`, every known customer id + other customers with the account e-mail); otherwise **no `subscription_data`** | unit "D1" (12); payment-lifecycle "D1" (2); PG **D1** |
| D1 returning subscriber can buy again, without a trial | same; session tagged `noetiaTrial:'no'` | unit; PG D1 (Noetia-row and Stripe-only history) |
| D1 T-1 only when an eligible trial begins | T-1 still keys off Stripe `trialing`, so a no-trial session never triggers it | payment-lifecycle "after a cancelled trial … no second T-1 grant" |
| D1 no claw-back | no code touches granted tokens or owned books | payment-lifecycle cancellation tests |
| D1 linked members eligible; gift/token buyers eligible | members have no own row; one-time payments are not subscriptions | unit (2) |
| D1 fail safe | truncated or failed history → **503**; `trialEligible:null` → no trial advertised | unit (3 cases); PG D1 ("history unverifiable → 503, no session") |
| D1 no invasive identity tracking | only the account e-mail and existing Stripe customers; limits documented (13.9) | code review |
| **D2** exactly 12 paid annual allocations | invoice = cycle 0 (once per period); scheduler cycles 1…11 on UTC calendar-month anniversaries of Stripe's `current_period_start` + `billing_cycle_anchor`, strictly inside the period | `billing-cycles.spec` (Jan 31, Feb 29, leap years, DST, year boundary); payment-lifecycle "D2" timeline; PG **A1** |
| D2 never the next period early | cycles filtered to `< current_period_end`; the renewal invoice opens the next period | payment-lifecycle "renewal"; PG A1 (400 days, nothing after) |
| D2 quantities and 90-day expiry | `issueTokens` unchanged | unit (`tokensPerCycle`), existing expiry tests |
| **D3** cancel at period end keeps allocations | candidates `active` **and** `canceling`; Stripe `active` (incl. cancel-at-period-end) required; nothing once the period has expired | unit; payment-lifecycle "D3" (12 paid); PG **A4** (11 scheduled) |
| D3 immediate termination / failed payment / unpaid-trial cancellation | Stripe status `canceled` / `past_due` / `trialing` → nothing | payment-lifecycle (3 tests); unit (status table) |
| **D4** no tokens from upgrades | `classifyInvoice`: `subscription_update` → none | `billing-cycles.spec`; webhooks (4 cases); payment-lifecycle; PG **I1** |
| D4 portal configuration | **not changed**; verification pending (13.10) | — |
| **D5** valid $0 renewals | `subscription_cycle` at any amount grants; trial `subscription_create` at $0 grants none; paid creation grants | `billing-cycles.spec`; webhooks; payment-lifecycle; PG I1 |
| D5 once per billing period | `fulfillment:period-tokens:<sub>:<period start from the subscription line>` + invoice-id key, in the webhook transaction | unit "reissued invoice"; payment-lifecycle "voided-and-reissued"; PG I1 (3 invoices, same period → 1) |
| **D6** bilingual disclosures | `/pricing`: guest / eligible / returning / unverified states, included tokens per plan, ownership, renewal/cancellation; mobile paywall subtitle follows the same rule | pricing spec (7 new, EN+ES); PaywallScreen spec (3); 16 screenshots |
| D6 never advertise a trial to a returning customer | returning → "Welcome back… your subscription starts today" + "Subscribe"; unverified → no trial words | screenshots (`trial-mentions=0` when unverified); tests |
| **Atomic redemption** | one transaction: `UPDATE … WHERE id = (SELECT … FOR UPDATE SKIP LOCKED)`, then wait/retry; ownership `INSERT … ON CONFLICT DO NOTHING`; a conflict throws, so the token rolls back; shared pool unchanged | unit (6); PG **R1–R3** |
| **Scheduler concurrency** | per-cycle claim `fulfillment:annual-cycle:<sub>:<period start>:<k>` in the grant's transaction | PG **A2** (two instances), **A3** (SIGKILL), unit re-run |
| No migration, no price change, no new infrastructure | existing table/primary key, existing transactions | — |

### 13.3 Real PostgreSQL evidence

**Method:** disposable `postgres:16-alpine` (removed afterwards); 68 migrations; the real services; fake Stripe, e-mail and push; synthetic accounts.
- A2 runs two scheduler instances, each with its own DataSource and pool.
- A3 kills the child process with `SIGKILL` mid-transaction.

| # | Scenario | Corrected (3 runs) | `1be3f48` (before) |
|---|---|---|---|
| D1 | First-time / returning (Noetia row) / Stripe-only history / 4 concurrent checkouts / history unverifiable | trial 14 / none / none / **1** session / 503, no session | trial 14 / **14** / **14** / 1 / **no error** |
| A1 | One annual period: invoice + daily scheduler for 400 simulated days | **12** paid; cycles k = 1…11 claimed; none after the end | **1** |
| A2 | Two scheduler instances, 20 rounds × 3 due cycles | 60 / 60 | **40 / 60** (one cycle each, granted twice) |
| A3 | Scheduler `SIGKILL` after granting, before COMMIT | after crash 0 tokens, 0 claims → after two runs **3** | n/a (no per-cycle scheduler) |
| A4 | Annual cancelled at period end | **11** scheduled until expiry, none after | **0** |
| I1 | Paid upgrade + manual invoice; then a $0 renewal + 2 reissues of it, concurrently | **0**, then **1** | 2, then 2 |
| R1 | One token, 5 books at once | **1** book, 1 token used | **5 books for 1 token** |
| R2 | Duo shared pool: owner + member at once (10 rounds × 1 and 2 tokens) | 0 wrong | 0 wrong (race not hit in this run) |
| R3 | Same book ×4 at once, 3 tokens | 1 owned, 1 used, 2 still active | passed (race not hit) |

- **Round 1–2 scenarios** (S1–S8, T1–T6) still pass. Total **25/25 in each of 3 runs**; negative control **18/25**.
- **R2 and R3 on the old code** passed in that run only because the race window wasn't hit. R1 shows the defect deterministically.
- **Script change after the runs:** an unused constant was removed to satisfy lint. Behaviour is identical.

### 13.4 Annual timeline: exactly 12 paid allocations

Unit timeline (`payment-lifecycle.spec`, real services, fake clock, daily scheduler at 01:00 UTC). Individual Annual: trial 2027-01-01, paid period 2027-01-15 12:00 → 2028-01-15 12:00 UTC.

| Allocation | Date granted |
|---|---|
| T-1 (trial, additional) | 2027-01-01 |
| Paid 1: the annual invoice | 2027-01-15 |
| Paid 2–12: scheduler | 02-16, 03-16, 04-16, 05-16, 06-16, 07-16, 08-16, 09-16, 10-16, 11-16, 12-16. Each is due on the 15th at 12:00 UTC; the next daily run grants it |
| Before the renewal | nothing more |
| Year 2 | a new invoice on 2028-01-15, then 11 more: **12** paid |

Other cases:

| Case | Result |
|---|---|
| Cancel at period end on day 60 | 12 paid, then nothing after 2028-01-15 |
| Immediate termination, day 100 (Apr 11) | T-1 + cycle 0 + Feb + Mar, then nothing |
| Renewal `past_due` | nothing in the unpaid period |
| Jan 31 anchor | Feb 28, Mar 31, Apr 30, May 31 …; 12 paid |

Round 3 measured 13 paid cycles per period for the previous code.

### 13.5 Trial and invoice eligibility results

**API**

| Suite | Tests | Result |
|---|---|---|
| `subscriptions.service.spec` | 150 | pass. Includes D1 checkout (12), `getTrialEligibility` / `me?trialEligibility` (6), `issueDueAnnualCycles` (10), period keys (3), atomic redemption (6) |
| `billing-cycles.spec` | 32 | pass. Calendar (Jan 31, Feb 29, leap year, DST, year boundary), 11-cycle windows, invoice classes (10 cases), period extraction, history signal |
| `webhooks.service.spec` | 39 | pass. D4 (4 invoice kinds), D5 ($0 renewal, paid creation) |
| `payment-lifecycle.spec` | 67 | pass. 24 T-1 delivery orders; D1 re-subscription; D2/D3 timelines; D4/D5; reissue |
| `stripe-fulfillment-ledger.spec` | 8 | pass |

All suites also pass under `TZ=UTC` and `TZ=America/New_York`.

**Web and mobile**

| Suite | Tests | Result |
|---|---|---|
| Web `pricing.spec` | 46 | pass. 7 D6 tests: guest, eligible, returning, unverified, status failure, EN and ES |
| Mobile `PaywallScreen.spec` | — | +3 tests |

### 13.6 Bilingual copy (D6)

**Shipped in the app** (web `/pricing`; mobile paywall subtitle uses the equivalent strings):

| State | EN | ES |
|---|---|---|
| Guest | New subscribers get a 14-day free trial with their plan's first tokens included. Cancel anytime. | Los nuevos suscriptores tienen 14 días de prueba gratuita con los primeros tokens de su plan incluidos. Cancela cuando quieras. |
| Eligible | Your 14-day free trial includes your plan's first tokens. Cancel anytime. | Tu prueba gratuita de 14 días incluye los primeros tokens de tu plan. Cancela cuando quieras. |
| Eligible, per plan | Includes {n} token(s) to start your trial | Incluye {n} token(s) para empezar tu prueba |
| Eligible / guest | Books you redeem during the trial are yours to keep, even if you cancel. | Los libros que canjees durante la prueba son tuyos para siempre, aunque canceles. |
| Returning | Welcome back. You've already had your free trial, so your subscription starts today. | Qué bueno verte de nuevo. Ya disfrutaste tu prueba gratuita, así que tu suscripción comienza hoy. |
| Unverified | Prices in US dollars. Cancel anytime. | Precios en dólares estadounidenses. Cancela cuando quieras. |
| Everyone | Plans renew automatically. If you cancel, you keep your access and your plan's tokens until the end of the period you paid for. | Los planes se renuevan automáticamente. Si cancelas, conservas tu acceso y los tokens de tu plan hasta el final del período que pagaste. |

**CTAs:** Start free trial / Comenzar prueba gratuita (eligible) · Get started / Empezar (guest) · Subscribe / Suscribirme (returning or unverified).

The copy keeps the existing page styles (small grey and emerald notes) in the established Quiet Editorial register: sentence case, "tú", no exclamation marks.

**Proposed Terms wording: not applied** (legal approval required, OP-3; overlaps legal-gated PR #22). It would replace "Free trial: when available, terms will be specified at the time of subscription":
- **EN:** "Free trial: new subscribers receive one 14-day free trial per customer, including the plan's first monthly tokens. Books redeemed with those tokens remain yours even if you cancel during the trial. Returning subscribers are not eligible for another trial. Annual plans include 12 monthly token allocations per paid year; if you cancel, renewal stops and your allocations continue until the end of the period you paid for. Plan upgrades take effect at the next billing cycle and do not add a token allocation."
- **ES:** "Prueba gratuita: los nuevos suscriptores reciben una prueba gratuita de 14 días por cliente, que incluye los primeros tokens mensuales del plan. Los libros canjeados con esos tokens siguen siendo tuyos aunque canceles durante la prueba. Quienes ya fueron suscriptores no tienen derecho a otra prueba. Los planes anuales incluyen 12 asignaciones mensuales de tokens por año pagado; si cancelas, la renovación se detiene y tus asignaciones continúan hasta el final del período que pagaste. Los cambios a un plan superior se aplican en el siguiente ciclo de facturación y no añaden una asignación de tokens."

### 13.7 Atomic redemption evidence

**Before (`1be3f48`, real PostgreSQL R1):** one token bought **5 books** when redeemed in parallel.

**Now:**
- R1 → 1 book, 1 token.
- R2 → a Duo owner and a linked member sharing 1 token: exactly one succeeds. With 2 tokens, both succeed with distinct tokens (10 + 10 rounds).
- R3 → four parallel redemptions of the same book: 1 ownership; the losers' tokens are rolled back (2 of 3 stay active).

**Unit tests** cover: the statement sequence, rollback on an ownership conflict, the already-owned fast path, no tokens, the owner-pool fallback (ownership goes to the redeeming member), and the unknown book.

### 13.8 Validation

| Check | Result |
|---|---|
| API unit (full, `--maxWorkers=2`) | **1184/1184** pass. The one non-loading suite, `auth.controller.spec`, is environmental (`bcrypt` native binding not built in this worktree), as in every round |
| API coverage | `webhooks.service.ts` 100 / 95.6 (statements / branches); `subscriptions.service.ts` 92.9 / 84.6; `gifts.service.ts` 97.3 / 84.6. Global branches 72.2%; the gate (80%) was failing on `main` before this mission; **threshold unchanged** |
| API `tsc` / eslint / `nest build` | pass / **0 errors** (87 `any` warnings, existing style) / pass |
| Real PostgreSQL script | **25/25** in 3 runs; negative control 18/25 |
| Web unit (full) | **448/448** (28 suites). Includes i18n en/es parity, PO-053 selector tests and the Noetia+/NoetiaX Coming Soon landing tests, all unchanged and passing |
| Web `tsc` / `next lint` (changed files) / **`next build`** | pass / clean / **compiled successfully** |
| Mobile unit (full) / `tsc` | **182/182** / pass. Run with the main checkout's `node_modules` linked temporarily, removed afterwards |
| Browser | `/pricing` D6 states: 16/16 reached the expected state; no overflow; 0 trial mentions when unverified |
| CI | **Did not run** (stacked PR, §9). No green CI is claimed |

### 13.9 Known limitations

- **D1 identity is not proof of a person.** A deleted-and-recreated account is recognized only when it reuses the same e-mail, exact-match (e-mails aren't normalized at registration). A different e-mail evades the rule. Closing that would need a new persistent identity mechanism, which isn't proposed and would need PA/PO approval.
- **Stripe cost of eligibility.** `?trialEligibility=1` calls Stripe, roughly 1 + N list calls. Only `/pricing` and the mobile paywall ask for it; every other `/me` caller is unchanged.
- **The annual scheduler reads Stripe.** It makes one Stripe read per annual subscription only when a cycle may be due (the `nextTokenIssuanceAt` hint), so about 12 calls per subscription per year. If Stripe is down, that day's cycles are granted on a later run within the period.
- **Pre-existing display issue (not this mission).** Individual and Duo plan cards show no taglines with the current plan names; this belongs to the presentation PR (#21). Family "up to 5 users" vs 4 seats is also still open there.
- **Single API commit,** as explained in 13.1.

### 13.10 Remaining launch gates (not expanded here)

| Gate | Status | Smallest next action |
|---|---|---|
| Server-side Checkout-session verification (G-1) | Open | PA approves the §10.4 endpoint design; then implement (`subscriptions.controller/service`, success page) |
| Stripe USD price-object verification (USD-1) | **Pending: requires Stripe account access** | PO runs the read-only check from §12.5 D with a restricted key, or confirms each referenced price is `usd` in the Dashboard |
| Checkout ambiguity after Stripe timeouts (G-4) | Open | PA approves the §12.5 C design (existing Redis + Stripe idempotency key); then implement |
| Gift-e-mail recovery | Open | PO/PA choose an admin resend action (no migration) or a pending marker (migration) |
| Stripe portal configuration (D4) | **Pending verification** | PO confirms in the Dashboard that plan changes take effect at the next billing cycle, matching the Terms; any change goes to separate approval |
| Terms wording for D1–D6 (T1-D) | Draft in 13.6 | Legal review (OP-3), coordinated with PR #22 |
| Verification-script location (G-5) | Open | PA: keep `services/api/scripts/` or drop |

### 13.11 Release blockers

- PA review of this round;
- PO merge and deploy instruction naming the PR (merging to `main` is a production deploy);
- the gates above;
- Stripe production configuration: webhook events incl. `customer.subscription.created`, the USD price check, the portal check;
- Terms review (OP-3);
- NEM-024: E-1 **OPEN / BLOCKED**, Checkpoint E **NOT QUALIFIED**.

**Unchanged:**
- **Product rules:** prices, trial length (14 days), token quantities, 90-day expiry, permanent ownership.
- **Policy:** Causas 2.22% and PO-053; Noetia+/NoetiaX remain Coming Soon.
- **Protected systems:** reader / Escucha Activa; production and staging systems.

**STOP for independent Product Architecture review.**

---

## 14. PA follow-up: F-01 / F-02 verification and conditional remediation (mission of 2026-11-13)

Bounded verify-then-remediate mission. **No new business rules.**

### 14.A Baseline

| | |
|---|---|
| Branch / PR | `fix/payment-lifecycle-stabilization-20261112` / PR #60 (**Draft**), base `feat/public-ecosystem-site-20261112` (PR #59, Draft, head `e326b81`, **unchanged**) |
| `main` | `6a5e5c0` |
| Expected baseline = initial HEAD | `38752e7378b9323422d54cf177582ed4aac7ccce`: local, remote and PR head all matched; the working tree was clean |
| Overlap check | No other open branch (PR #59, NEM-016/019/022/024 branches) touches `services/api/src/subscriptions` or `gifts` |
| Code commits | `5936cb5` F-02 correction + F-01/F-02 tests; `72b4507` PostgreSQL script F-02 scenarios |
| Final HEAD | the report commit that adds this section (SHA given in the PR comment) |

**Files changed (code):**
- `services/api/src/subscriptions/subscriptions.service.ts`: F-02, plus the new `resolveInvoicePeriodStart`;
- `services/api/src/subscriptions/billing-cycles.ts`: doc comment only;
- tests: `subscriptions.service.spec.ts`, `payment-lifecycle.spec.ts`, `billing-cycles.spec.ts`;
- `services/api/scripts/payment-safety-pg-check.ts`.

**Evidence:**
- `f02-reproduction-before-fix.txt` (new);
- `payment-safety-pg-check.txt` (regenerated);
- `payment-safety-pg-check.negative-control.txt` (regenerated against `38752e7`).

### 14.B F-01: trial eligibility. Verdict: **STOP for a PO decision** (no behaviour change)

**Sources, verbatim:**
- **PO authorization D1** (2026-11-13):
  - "Implement one 14-day trial per eligible customer."
  - "**A customer who already received a subscription trial is not entitled to another.**"
  - "**A returning subscriber may purchase another subscription, without a new trial.**"
  - "T-1 tokens are granted only when an eligible trial actually begins."
  - "Reuse existing Noetia account and Stripe customer history."
- **Governance record** (`COMMERCE-DECISIONS.md` §D1) restates the same.
- **Report §12.2** (the recommendation that preceded D1) proposed: "One free trial per person … Returning subscribers start paying on day 1."

**Trace:**
- `/pricing` and the mobile paywall call `GET /subscriptions/me?trialEligibility=1`, which goes to `getTrialEligibility`.
- `POST /subscriptions/checkout` calls `createCheckoutSession`, under the checkout lock.
- Both apply `trialEligible = !local.stripeSubscriptionId && !history.started`, where `history.started` is any Stripe subscription with `subscriptionEverStarted(sub)`, i.e. `trial_start` set or status ≠ `incomplete_expired`.
- `subscriptionEverStarted` has a single call site (`inspectStripeSubscriptionHistory`).

**Policy-to-code matrix.** Every row is pinned by the new "F-01 matrix" tests in `subscriptions.service.spec.ts` (7 cases + 3 unverifiable cases, all passing).

| Case | Current behaviour | Expected under D1 | Source | Verdict |
|---|---|---|---|---|
| First-time customer, no history | trial | trial | "one 14-day trial per eligible customer" | ✅ matches |
| Previously received a trial (incl. cancelled during the trial) | no trial | no trial | "already received a subscription trial is not entitled to another" | ✅ matches |
| **Previously subscribed and paid, never had a trial** | **no trial** | **not clearly determined** | Sentence 2 ("returning subscriber … without a new trial") points to *no trial*; sentence 1 (the entitlement is lost by *receiving* a trial) points to *trial* | ⚠ **PO decision** |
| Previous subscription never activated (`incomplete_expired`) | trial | trial (no subscription, no trial ever began) | "one trial per eligible customer"; T-1 "only when an eligible trial actually begins" | ✅ matches |
| **Never activated but `canceled`** (an incomplete subscription cancelled before it expired; no trial, never paid) | **no trial** (current signal can't tell it from a paid one) | **not clearly determined** (D1 doesn't address it) | — | ⚠ **PO decision** |
| Returning customer with a cancelled Noetia subscription row | no trial | no trial | "returning subscriber … without a new trial" | ✅ matches |
| Duo/Family member subscribing independently (no own subscription) | trial | trial | "Linked Duo/Family members who have never held their own subscription remain eligible" | ✅ matches |
| Stripe history unavailable / incomplete / truncated | checkout **503**, no session; eligibility `null` → no trial advertised | fail safe, never charge unexpectedly | "If the history cannot be verified, fail safely" | ✅ matches |

**Why no correction.** D1's two sentences give different answers for a former paid subscriber who never received a trial, and D1 is silent on a never-activated subscription that ended `canceled`. Per mission §3 and STOP gate 1, F-01 stops here. The current behaviour is the conservative reading (no trial) and is **unchanged**; the tests only characterize it.

**How much the decision matters in practice.** Until D1, every Checkout-created subscription included a 14-day trial (`trial_period_days: 14`). Since D1, Checkout omits the trial only for customers who are already ineligible. So **for every subscription that came through Noetia's Checkout, both readings give the same result.** The two rules differ only for:
- subscriptions created outside Checkout (Stripe Dashboard or API);
- incomplete subscriptions cancelled before they expired.

**Decision required (PO).** Should a customer whose only subscription history has **no trial** be offered a trial?

| Option | Rule | Smallest code change (if chosen; not implemented) |
|---|---|---|
| **A** | "Trial received" rule: eligible unless a previous subscription **received a trial** | `subscriptionEverStarted` → `trial_start != null`. The local-row check (any own subscription) is relaxed to rely on that Stripe signal; local rows don't keep trial history across re-subscriptions. Tests flip on the two PENDING-PO rows |
| **B** | "Returning subscriber" rule: any previously **started** own subscription (paid or trial) ends eligibility | Current code; for the never-activated `canceled` case, the PO may also accept it as returning. No code change |
| B′ | B, but a never-activated `canceled` subscription doesn't count | Needs a reliable "was ever active/paid" signal from Stripe (e.g. checking the subscription's paid invoices): one more Stripe read per historical subscription; to be designed only if chosen |

No option requires fingerprinting, identity tracking, a schema change or new personal data.

### 14.C F-02: invoice period identity. Verdict: **defect demonstrated; corrected (fail-closed)**

**Proof that the fallback is reachable** (shapes from the repository's own Stripe library, stripe-node 22.1.0, API `2026-04-22.dahlia`):
- `Invoice.lines` doc: "sorted as follows: (1) pending invoice items (including prorations) …, (2) subscription items …".
- `Invoices.listLineItems` doc: "When retrieving an invoice, you'll get a lines property containing the total count of line items and the **first handful** of those items."
- A renewal after several plan changes therefore arrives with ten `{ parent: { type: 'invoice_item_details', invoice_item_details: { proration: true } } }` lines, `has_more: true`, and **no subscription line**, so `invoicePeriodStart()` returns `null`.
- **Pinned by** `billing-cycles.spec` "F-02 reachability" (and the sibling "dahlia subscription-item proration lines are not the billed period").

**Execution path, before the fix (`38752e7`):**
1. `handleInvoicePaid`: `classifyInvoice` gives `renewal`, and `grantsCycle` is true.
2. `issueTokensForNewSubscription(sub, em, invoiceId, null)`.
3. The period key is **skipped** because the period is `null`; only `fulfillment:invoice-tokens:<invoiceId>` is claimed.
4. A **different** invoice id for the same period claims its own invoice key, so it allocates again.

**Demonstrated on the unchanged code:**
- `f02-reproduction-before-fix.txt` (payment-lifecycle "F-02" test: **2 allocations, expected 1**);
- real-PostgreSQL negative control F2a: **10 of 10 rounds** double-allocated.

**Caveat, stated honestly:** under Stripe's documented behaviour, one renewal period produces one `subscription_cycle` invoice, and staff-created replacement invoices are `manual` (never allocated). So two *distinct* grant-eligible invoices for one period are not a documented Stripe outcome. The reproduction uses synthetic invoices. The defect is that D5's once-per-period guarantee rested on that Stripe invariant instead of the ledger whenever the period was missing. The correction removes that dependence.

**Correction** (`subscriptions.service.ts issueTokensForNewSubscription` + new `resolveInvoicePeriodStart`; no schema, no persistent state, no policy change, no new infrastructure):
1. **Period in the payload:** used as before; no Stripe call.
2. **Otherwise**, inside the same webhook transaction, read the period from **Stripe's own line items for that invoice** (`invoices.listLineItems`, limit 100, paginated, bounded to 20 pages), using the same subscription-line rule. This is Stripe's authoritative identifier; nothing is invented or inferred from timestamps.
3. **Still unknown,** or a Stripe error: **throw**. The webhook transaction rolls back, so **nothing is allocated and nothing is recorded as fulfilled**: no event row, no invoice key, no period key. Stripe retries the event, and a legitimately unfulfilled cycle is never marked fulfilled.

Unchanged:
- the invoice-id key (kept as a second guard);
- classification: D4 exclusions, D5 $0 renewals, paid creations;
- the T-1 trial grant;
- annual cycle 0 and the D2/D3 scheduler.

Non-allocating invoice classes never reach the new path, so they cause no Stripe call.

**Invoice structures tested:**

| Structure | Unit | Lifecycle (real services) | PostgreSQL |
|---|---|---|---|
| Renewal with an identifiable subscription line (legacy `type:'subscription'`, dahlia `parent.subscription_item_details`) | ✅ | ✅ | ✅ (A1, I1) |
| Valid $0 renewal, truncated payload | — | ✅ once | — |
| Absent / malformed period (10 proration lines, `has_more`) | ✅ null | ✅ resolved from line items | ✅ F2a |
| Subscription line only on page 2 of Stripe line items | ✅ pagination | — | — |
| Reissued invoice (different id), same period | ✅ | ✅ | ✅ F2a (and I1) |
| Two concurrent events for the same period | — | — | ✅ F2a (4 deliveries × 10 rounds) |
| Proration / `subscription_update`, manual | ✅ | ✅ (no line-item read) | ✅ I1 |
| Trial creation ($0) and paid creation | ✅ | ✅ | ✅ (T1–T5) |
| Crash/rollback before commit | ✅ (throw → no claims) | ✅ fail closed, then retry allocates once | ✅ F2b; S6/A3 crash scenarios |
| Delayed / out-of-order delivery | — | ✅ later period first, then earlier: one each | ✅ (S-series re-reads) |
| No invoice id and no period | ✅ fails closed | — | — |

**Remaining risks:**
- **Persistent failure.** If an allocating invoice never has a subscription line, which isn't expected for `subscription_cycle` or paid `subscription_create`, the event keeps failing until Stripe stops retrying (about 3 days in live mode). It is logged as `[invoice-period] … could not be determined`. Recovery is manual replay after investigation. Nothing is ever double-allocated.
- **Extra Stripe read.** There is one extra Stripe read, only when the payload lacks the subscription line. It is not recurring infrastructure.
- **Webhook API version.** The production webhook endpoint's Stripe API version is not visible here. Both legacy and dahlia line shapes are recognized in payloads, and `listLineItems` always uses stripe-node's pinned dahlia version.

### 14.D Verification

**Commands** (all from `services/api` unless noted; Node 20; synthetic data; fake Stripe):
- `npx tsc --noEmit -p tsconfig.json` → pass
- `npx eslint src/subscriptions src/gifts scripts tests/unit/subscriptions` → **0 errors** (241 `any` warnings, existing style)
- `npx nest build` → exit 0
- `TZ=UTC npx jest --maxWorkers=2 --coverage` → **1207/1207 tests pass**. 73 of 74 suites load; `auth.controller.spec` **does not load** because the `bcrypt` native binding isn't built in this worktree. That is environmental, not a test failure, and **not a green full suite**.
- `TZ=America/New_York npx jest tests/unit/subscriptions` → 370/370
- **Real PostgreSQL** (disposable `postgres:16-alpine`, 68 migrations, removed afterwards): `PGH_PORT=55432 PGH_PASS=… npx ts-node --transpile-only -P tsconfig.json scripts/payment-safety-pg-check.ts`, **three runs: 27/27, 27/27, 27/27** (F2a and F2b pass in each)
- Negative control (`PGH_SRC=<checkout of 38752e7>`): **25/27**; only F2a (10/10 rounds double-allocated) and F2b (allocated on an undeterminable period) fail

**Suites changed:**

| Suite | Tests | Result |
|---|---|---|
| `subscriptions.service.spec` | 165 | +6 F-02, +10 F-01 matrix; 2 existing tests updated to the authoritative-period path; all pass |
| `payment-lifecycle.spec` | 73 | +6 F-02; all pass |
| `billing-cycles.spec` | 34 | +2; all pass |
| `webhooks.service.spec` | 39 | unchanged; pass |
| `stripe-fulfillment-ledger.spec` | 8 | unchanged; pass |

**Coverage:** `subscriptions.service.ts` 92.4% statements / 85.1% branches; `webhooks.service.ts` 100 / 95.6. Thresholds unchanged.

**Web and mobile:** no code changed in this mission; not re-run (round-4 results stand: 448/448, 182/182, `next build` pass).

### 14.E Scope compliance

**Not performed:**
- no merge;
- no deployment;
- no production, staging, Stripe-account or real-payment access;
- no customer transactions;
- no change to prices, Price IDs or currency;
- no change to the 14-day trial, token quantities, 90-day expiry or ownership;
- no reinterpretation of T-1 or D1–D6;
- no change to Causas / PO-053 / 2.22%;
- no Noetia+/NoetiaX, reader, Escucha Activa or research-orchestration changes;
- no new infrastructure, libraries, migrations or persistent storage;
- no unrelated refactoring;
- no Terms or Privacy Policy change;
- PR #59 untouched; PR #60 stays Draft.

**Open:** **F-01 policy decision (PO)**, 14.B. No architectural decision is open from F-02.

### 14.F Requested PA verdict (advisory, not PA approval)

**ACCEPT WITH FOLLOW-UP:**
- **F-02:** corrected, fail-closed, with proof and regression evidence.
- **F-01:** behaviour verified and pinned, with **no change**. The paid-without-trial and never-activated-`canceled` cases need a Product Owner decision (options A / B / B′ in 14.B) before any code change.

**STOP for independent PA review.**
