# PR #59 Checkpoint X: independent release qualification (consolidated)

| | |
|---|---|
| **Mission** | Checkpoint X: PR #59 Independent Release Qualification (PO: read-only assessment and local testing), plus the PA follow-up (documentation-only authorization for this report and the PR description) |
| **Baseline** | `main` = `3b35cb1` (G1-I1 Stage B-1 deployed and inactive); PR #59 = `e326b81` (Draft); PR #60 `d8e61e2`, PR #62 `ecddd52`, PR #26 `02c98f7`, PR #28 `35ab50b`: all Draft, untouched |
| **Recommendation** | **CONDITIONAL GO** for a future, separately authorized release (§9). **Not** a release authorization. PR #59 stays **Draft, DO NOT MERGE** |

Evidence for this checkpoint: [`checkpoint-x/`](checkpoint-x/).
Earlier reports in this directory: [`README.md`](README.md), [`checkout-auth-diagnostic.md`](checkout-auth-diagnostic.md), [`post-payment-billing-diagnostic.md`](post-payment-billing-diagnostic.md).

## 1. Scope and baseline

- **Merge:** a simulated merge of PR #59 onto `main` (`git merge-tree`) is **clean**; tree `93784b1`.
- **No overlap** with Stage B-1 files or with PR #62. **No** migration, Stripe configuration, `.github/` or mobile change.
- **27 code files** (vs base `6a5e5c0`, excluding reports):
  - **Public site:** `LandingContent.tsx`, `page.tsx`, `fonts.ts` and `fonts/playfair-display.ttf`, `(corporate)/{about,company,milestones}/content.tsx`, `causas/page.tsx`, `components/Footer.tsx`, `tailwind.config.ts`, i18n `en.ts`/`es.ts`.
  - **Causas:** `components/CauseSelector.tsx`; `api/src/causes/causes.service.ts`, `dto/save-preferences.dto.ts`.
  - **`/pricing` authentication:** `(billing)/pricing/page.tsx`, `lib/api.ts` (optional `redirectOnAuthFailure`; default unchanged).
  - **Tests:** 10 web/API specs.
- **No payment logic changed.** No subscription, webhook, entitlement, token or Stripe API code. Checkout and token-purchase request bodies are identical (`{planId}`, `{packageId}`).

## 2. Evidence provenance

### 2.1 Executed during Checkpoint X (2026-11-15/16, local, merged tree `main` + #59 unless stated)

| Check | Result |
|---|---|
| Web `tsc --noEmit` | PASS |
| Web `next lint` | PASS: 0 errors; no warning in any PR #59-changed file |
| Web unit tests (`jest --maxWorkers=2`) | **PASS: 25/25 suites, 383/383** (`main`: 19/298) |
| Production web build (`next build`) | **PASS** (`/`, `/about`, `/company`, `/milestones`, `/causas`, `/pricing`) |
| API `tsc --noEmit` | PASS |
| API focused (causes, subscriptions, auth, common) | **PASS: 17 suites, 313/313** |
| API full suite | **PASS: 73/73 suites, 1064/1064** |
| API ESLint `src/causes` | 0 errors, 2 warnings |
| **Browser suite** against the real build (`next start` on loopback), every API call mocked, Stripe redirect target a locally fulfilled stub host, all other network blocked; Playwright 1.59.1 with a locally cached Chromium headless shell | **PASS: 37/37** ([`browser-results.json`](checkpoint-x/browser-results.json); script [`pr59-browser.mjs.txt`](checkpoint-x/pr59-browser.mjs.txt)) |
| **Stripe-disabled executed proof** (scratch spec on `main`, whose `subscriptions/` and `gifts/` code is byte-identical to `main` + #59; never committed) | **PASS: 16/16** ([`stripe-disabled.spec.ts.txt`](checkpoint-x/stripe-disabled.spec.ts.txt), [`stripe-disabled-run.txt`](checkpoint-x/stripe-disabled-run.txt)) |
| GitHub CI on PR #59 (`43360737319`, `e326b81`): job logs re-read | Lint/typecheck/build PASS. Unit-test jobs fail only on coverage thresholds that also fail on `main`; every test passes, and coverage is slightly **higher** than `main` (API branches 68.88 vs 68.83; web 73.03/72.76/52.32/71.61 vs 72.8/72.44/51.74/71.61; mobile identical). E2E fails at "Install Playwright browsers" (runner image unsupported), as on `main` |

### 2.2 Supported only by earlier reports (not re-executed in Checkpoint X)

| Claim | Source |
|---|---|
| Earlier web counts 319/325/347 and screenshot sets (`screenshots/*.jpg`) | `README.md` §2, §6, §8.5 |
| Backend contract results and the pre-fix 401 observation | `checkout-auth-diagnostic.md` §2 |
| Webhooks as the system of record; behaviour of the success-page sync and account billing | `post-payment-billing-diagnostic.md` §2 |
| PA payment-flow review of `25e956f` | `README.md` §9.1 |
| axe / Lighthouse | **Never run** (`README.md` U-9); still not run |

### 2.3 Not run

- **Repository Playwright E2E (`tests/e2e/*`):** needs a running backend, and CI cannot install Chromium on the `ubuntu-26.04` runner. **UNRESOLVED**, retained as a limitation.
- Accessibility tooling (axe/Lighthouse).

## 3. Public ecosystem (browser, ES/EN, 1280 px and 375 px)

All 22 checks pass:
- Noetia is shown as available, with an account CTA.
- **Noetia+ and NoetiaX are labelled "Coming Soon" / "Próximamente", with no link, button, price, checkout or activation path.**
- No link to checkout, billing or upgrade anywhere.
- No horizontal overflow on `/`, `/causas`, `/about`, `/company` or `/milestones`.
- Exactly one footer on each page.
- The mobile menu opens, and closes with Escape.
- `html lang` follows the language.
- No two-cause, random-distribution, executed-contribution or unsourced-statistic wording.
- The Quiet Editorial direction is applied consistently.

**Copy needing approval (retained):** the cards state "up to three / up to ten eligible books" and "Will require an active Noetia subscription". These are public product commitments that need **PO product and legal sign-off** (ecosystem UX/legal assessment, PR #57). They are not an activation.

## 4. Causas policy (PO-053): compliant

| Requirement | Evidence (executed) |
|---|---|
| Exactly one cause | DTO `@IsEmpty` on `cause2Id`, `@Equals(false)` on `randomDistribution`, re-checked in the service (unit tests). Browser: 3 radios; selecting another replaces the first (never 2 checked) |
| No cause | `cause1Id` null = equal split (copy on `/causas`, the landing page and the selector) |
| No multi-cause path | No UI path; the API returns 400. Only web calls the endpoint (no mobile caller) |
| Existing preference preserved | "Continue without choosing" and "continue after lookup error" make **no** write (browser) |
| Failed save never proceeds | 500 → error shown, selection kept, **no checkout**; "Try again" → checkout (browser) |
| Saved body | `{"cause1Id":"c-env","cause2Id":null,"randomDistribution":false}` with Bearer (browser) |

## 5. `/pricing` authentication matrix (browser, executed)

| # | Case | Result |
|---|---|---|
| 1 | Guest visits | PASS: no redirect, plans shown, no preference lookup |
| 2 | Guest picks a plan / token package | PASS: `/login?next=/pricing`. The token package first makes one credential-less API attempt (401) |
| 3 | Signed in, saved cause | PASS: direct checkout |
| 4 | Signed in, no saved cause | PASS: selector → one cause saved → checkout |
| 5 | Expired access token, valid refresh | PASS: exactly one refresh, retried with the new token |
| 6 | No access token, valid refresh | PASS: treated as signed in |
| 7 | Authentication failure | PASS: `/login?next=/pricing` |
| 8 | Preference lookup failure | PASS: explicit notice; cancel = no checkout; continue = checkout, no write |
| 9 | Checkout with Bearer | PASS: `Authorization: Bearer …`, body `{"planId":"plan-ind"}` |
| 10 | Token package with Bearer | PASS: body `{"packageId":"pkg-1"}` |
| 11 | Cancel and retry | PASS |
| 12 | No accidental overwrite | PASS |
| — | Subscription status unknown | PASS: banner; subscription checkout blocked |
| — | Active subscriber | PASS: current plan disabled |
| — | API `400 payments_not_configured` | PASS: stays on `/pricing` with "Could not start payment. Please try again." ([screenshot](checkpoint-x/pricing-payments-not-configured-en.png)) |

## 6. Payment boundary (mandatory gate)

### 6.1 Does the Stripe-disabled condition prevent new live Checkout sessions server-side?

**Yes, if and only if `STRIPE_SECRET_KEY` is absent or empty.**

**Code evidence (`main` = `main` + #59):** a Stripe client is constructed in exactly three classes, each only when the key is truthy:
- `services/api/src/subscriptions/subscriptions.service.ts:56-57`: `this.stripe = stripeKey ? new Stripe(stripeKey) : null`. Every Stripe call goes through `requireStripe()` (`:190-192`), which throws `400 payments_not_configured`. That covers customer creation (`:199`), subscription checkout (`:211`), portal (`:226`), book purchase (`:238`), token package (`:264`), cancel/resume/retrieve (`:485`, `:495`, `:503`).
- `services/api/src/gifts/gifts.service.ts:41-48`: same pattern; gift checkout (`:66`).
- `services/api/src/subscriptions/webhooks.controller.ts:27-28,37-38`: no client means every webhook is rejected (`Stripe is not configured`), so there is no fulfillment.

No other `new Stripe(` exists in `services/api/src`.

**Executed evidence (16/16, `stripe-disabled-run.txt`):**
- **With the key absent and with it empty:**
  - no Stripe client is constructed;
  - subscription checkout, token-package checkout, book purchase and **anonymous gift checkout** all reject with `payments_not_configured`, and `checkout.sessions.create` is never called;
  - cancel and resume reject;
  - the webhook endpoint rejects.
- **Positive controls:**
  - a test key builds the client and `createCheckoutSession` does call `checkout.sessions.create`, so the guard is what blocks it;
  - **any non-empty value, even a placeholder, builds a client.**
- **Not separately exercised:** the portal (in the fixture it stops at `no_billing_account` before the guard; code shows `requireStripe()` at `:226`).

**Consequence:** the release condition is **`STRIPE_SECRET_KEY` absent or empty**, not "no live key".
- A test key (`sk_test_…`) would create real test-mode sessions.
- A restricted live key (`rk_live_…`) would create live ones.
- The earlier proposed check `grep -c '^STRIPE_SECRET_KEY=sk_live_'` is therefore **superseded** by the token check in §8.

### 6.2 Does PR #59 make a previously inaccessible payment endpoint reachable?

**No new endpoint is added or unguarded.** `POST /subscriptions/checkout` and `POST /subscriptions/tokens/purchase` are already deployed behind `JwtAuthGuard` + `EmailConfirmedGuard`. Any signed-in client sending a Bearer token can call them today.

**What changes** is that the **official web path** to them starts working. On `main`, `/pricing` sends no Bearer token, so the web path always gets 401.

**Already reachable without PR #59:** `POST /gifts/checkout` has **no guard** (anonymous by design) and the production `/gift` page calls it today. Stripe Checkout creation therefore already depends only on the key being configured.

`/account/billing` portal and resume also lack the Bearer token on `main`. PR #59 doesn't touch them (fixed in #60).

### 6.3 Residual risk while PR #60 is unreleased

If a key were configured, the repaired web path would run `main`'s pre-#60 backend:

| Behaviour | Conflict |
|---|---|
| `createCheckoutSession` has **no server-side duplicate-subscription guard**; the status-unknown block is client-side | Duplicate subscriptions possible |
| `trial_period_days: 14` on **every** checkout; the page says "14-day free trial" | Contradicts **final PO decision D1** (one trial per customer; implemented only in #60) |
| `/billing/success` always shows **"Subscription activated!"**, including after a token-package purchase; its sync call lacks a Bearer token (silent 401) | **Misleading payment confirmation** (fixed by #60 / G-1) |
| Webhook fulfillment not exactly-once | #60 corrections absent |

**Classification:**
- **Key absent or empty:** risk **contained**. The API refuses before any Stripe call; the user sees a payment error; no session, charge or fulfillment is possible.
- **Key present (test or live):** **P0.** PR #59 must not ship before the financial release.
- **Today's exposure is independent of PR #59:** the gift path already depends only on the key.

### 6.4 Is an additional payment-disable safeguard necessary?

**Not required for releasing PR #59 under the absent-or-empty condition.** The existing server-side guard enforces it, as shown above.

**Recommended (fragility):** the only control is an environment value that will be restored deliberately when payments launch (D6 follow-up). If it were restored before the financial release, live sessions would open immediately on the pre-#60 backend, including the anonymous gift path.

**Smallest proposed correction (NOT implemented; needs its own authorization; API only, no policy change):**
- Add an explicit fail-closed flag `PAYMENTS_ENABLED` (default **false**) checked in the existing three guards: `SubscriptionsService.requireStripe()`, `GiftsService.requireStripe()`, and the client construction in `WebhooksController`, so a key alone never enables payments.
- Add unit tests for absent/false/true.
- Set the flag to true only as part of the financial lifecycle release.

**Alternative with no code:** a recorded governance gate saying "restoring `STRIPE_SECRET_KEY` is a financial-release action only", plus the §8 token check at every release.

## 7. Defects

| Severity | Item |
|---|---|
| **P0** | **None in PR #59.** (The §6.3 exposures are P0 only if PR #59 ships with any Stripe key configured.) |
| **P1** | **None in the code.** §6 is a P1 **release gate**: `STRIPE_SECRET_KEY` absent or empty, verified at release |
| P2 | Noetia+/NoetiaX capability wording needs PO/legal approval |
| P2 | Guest token-package click makes one credential-less API attempt before the login redirect (harmless; could short-circuit like the plan flow) |
| P2 | During deployment, stale browser tabs saving two causes or random get a 400 until reload |
| P2 | "14-day free trial" copy and `$` (not `US$`) are inconsistent with D1/USD until #60; they match today's `main` and matter only with payments enabled |

## 8. Release-gate register

| # | Gate | Status |
|---|---|---|
| G-X1 | **`STRIPE_SECRET_KEY` absent or empty in production**, PO-verified at release with the token-only checks below (A1 file, A2 effective deploy configuration). Both must print `UNSET` or `EMPTY`; `NONEMPTY` or `ERROR` = NO-GO | **OPEN (blocking)** |
| G-X2 | PA acceptance of this qualification (including the status-unknown correction) | **OPEN** |
| G-X3 | PO product and legal approval of the Noetia+/NoetiaX public copy | **OPEN** |
| G-X4 | Repository E2E / CI runner limitation accepted (coverage-threshold failures also occur on `main`) | **OPEN (PO acceptance)** |
| G-X5 | Release controls: idle CD, operator present, backup confirmed, explicit merge instruction naming PR #59 (merge = production deploy) | **OPEN** |
| G-X6 | Post-release acceptance (no payment): landing and `/causas` ES/EN; `/pricing` guest; signed-in checkout attempt shows "Could not start payment" (proves payments disabled); Causas save; health, login, reader | **OPEN** |
| G-X7 | (Recommended) `PAYMENTS_ENABLED` fail-closed safeguard (§6.4), or the governance gate on key restoration | **PROPOSED** |
| — | Financial gates (G-1, G-4, G-5, W-1, W-2/SG-PM, USD-1, D4, production webhooks, gift recovery, Terms/legal, NEM-024) | **CLOSED: not affected or qualified by PR #59** |


**G-X1 checks** (run one line each on the production host; they print a token, never the value; tested locally against unset / empty / `""` / `''` / `sk_test_` / `rk_live_` / placeholder / duplicate / missing-file fixtures):

```
f=/opt/noetia/.env.production; R='^[[:space:]]*(export[[:space:]]+)?STRIPE_SECRET_KEY[[:space:]]*='; if [ ! -r "$f" ]; then echo ERROR; else n=$(grep -Ec "$R" "$f"); if [ "$n" -eq 0 ]; then echo UNSET; elif [ "$n" -gt 1 ]; then echo ERROR; elif grep -Eq "${R}[[:space:]]*(\"\"|'')?[[:space:]]*$" "$f"; then echo EMPTY; else echo NONEMPTY; fi; fi
```

```
cd /opt/noetia && docker compose --env-file .env.production -f docker-compose.server.yml config --format json 2>/dev/null | python3 -c 'import sys,json; e=json.load(sys.stdin)["services"]["api"].get("environment") or {}; v=e.get("STRIPE_SECRET_KEY"); print("UNSET" if v is None else "EMPTY" if str(v).strip()=="" else "NONEMPTY")' 2>/dev/null || echo ERROR
```

## 9. Recommendation

**CONDITIONAL GO** for a future, separately authorized release of PR #59 alone, conditional on G-X1 through G-X6.

**NO-GO** if G-X1 shows any configured `STRIPE_SECRET_KEY`.

## 10. Integration plan (unchanged)

1. **PR #59 first:** clean onto `main`; no overlap with B-1 or #62.
2. **PR #62** is independent; either order works, and each merge is its own deploy.
3. **Financial lifecycle** goes from a fresh branch off `main`, never by merging #60 directly:
   - keep `main`'s versions of the B-1 artifacts (`CLAUDE.md`, the trusted-proxy integration spec);
   - drop #60's older copies of the B-2 infrastructure files;
   - #60's `/pricing`, `lib/api.ts` and i18n changes apply on top of #59.

## 11. Boundaries

- No production, staging, Docker or Stripe access.
- No application-code change. This report and its evidence are the only repository change.
- No merge or deployment. PR #60 and PR #62 untouched.
- Temporary scratch worktrees were removed.

**STOP for independent Product Architecture review.**
