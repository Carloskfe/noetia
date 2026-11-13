# PR #59 — Checkout authentication blocker: diagnosis and remediation proposal

**Trigger:** PA finding "PR #59 checkout authentication blocker" on reviewed HEAD `1d75bb9`.
**Authorization:** diagnosis and remediation proposal only. **Nothing is implemented here.** The fix needs PA review and PO authorization.
**Date:** 2026-11-12. No production or staging access; no payment credentials; no real purchases; no real accounts.

## 1. Root cause (CONFIRMED)

The API accepts a JWT **only** from the `Authorization: Bearer` header:
- `services/api/src/auth/jwt.strategy.ts`: `jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken()`.
- The web client keeps the access token in `localStorage.access_token`.
- The httpOnly `refresh_token` cookie is used only by `POST /auth/refresh`, never by the JWT strategy.

`services/web/app/(billing)/pricing/page.tsx` calls protected endpoints with plain browser `fetch('/api/…')`:
- These calls go through the Next rewrite (`next.config.js`: `/api/:path*` → `INTERNAL_API_URL/:path*`) **with no Authorization header**.
- They therefore always return **401**, for guests and signed-in users alike.
- The existing client `lib/api.ts#apiFetch` attaches the Bearer token and refreshes once on a 401. Only `CauseSelector` uses it; the pricing page does not.

### Affected request paths (pricing page)

| Line | Request | Guard | Result today |
|---|---|---|---|
| `page.tsx:43` | `GET /api/subscriptions/plans` | public | 200 (fine) |
| `page.tsx:44` | `GET /api/subscriptions/token-packages` | public | 200 (fine) |
| `page.tsx:45` | `GET /api/subscriptions/me` | `JwtAuthGuard` | **always 401**, so `currentPlanId` is never set |
| `page.tsx:46` | `GET /api/causes/preferences` | `JwtAuthGuard` | **always 401**, so `hasPreferences = false` |
| `page.tsx:60` | `POST /api/subscriptions/checkout` | `JwtAuthGuard` + `EmailConfirmedGuard` | **always 401**: "Could not start payment" |
| `page.tsx:77` | `POST /api/subscriptions/tokens/purchase` | `JwtAuthGuard` + `EmailConfirmedGuard` | **always 401**: redirect to `/login?returnUrl=/pricing` (login reads `next`, so the return path is lost) |

### Predates PR #59: YES

- The pricing calls were introduced in `5a63acf` (2026-04-24, subscriptions billing) and `86c3dff` (2026-05-13, Causas preference lookup).
- The Bearer-only strategy dates from `b45588f` (2026-04-21).
- `git diff main...1d75bb9` touches none of `pricing/page.tsx`, `lib/api.ts`, `src/auth/*` or `src/subscriptions/*`.
- The PR #59 selector fix uses `apiFetch` and authenticates correctly. It made the defect *visible* (a successful save is now followed by a failing checkout), but did not cause it.

## 2. Verification method

1. **Backend contract (in-process, real code):** a throwaway Jest probe (deleted afterwards).
   - It booted the real `JwtStrategy`, `JwtAuthGuard`, `EmailConfirmedGuard`, `CausesController`, `SubscriptionsController`, `cookie-parser` and the global `ValidationPipe`, with services mocked.
   - It signed real JWTs and sent HTTP requests over loopback.
2. **Browser flows:** a local production build (`next start`) driven by Playwright.
   - Every API request was intercepted in the browser by a stub that reproduces the contract verified in step 1. Nothing reached the dev API container on `:4000`.
   - The "signed-in" session was a test token in `localStorage`, plus a refresh cookie for scenario 7.

### 2.1 Backend contract results

| Request | Auth sent | Status |
|---|---|---|
| `GET /subscriptions/plans`, `/token-packages` | refresh cookie only | 200 |
| `GET /subscriptions/me`, `GET /causes/preferences`, `POST /causes/preferences`, `POST /subscriptions/checkout`, `POST /subscriptions/tokens/purchase` | refresh cookie only (what the pricing page sends) | **401** |
| same | valid Bearer | 200 |
| `GET /causes/preferences`, user **with** a saved cause | Bearer | 200, JSON body |
| `GET /causes/preferences`, user with **no** saved cause | Bearer | **200, empty body (length 0)** |
| any protected request | expired Bearer | 401 |
| `POST /subscriptions/checkout`, unconfirmed email | Bearer | 403 `EMAIL_NOT_CONFIRMED` |

**Important for the fix:**
- "No preference" is a **200 with an empty body**.
- `apiFetch` turns an empty body into `{}`, so `!!prefs` would be `true`.
- A naive switch to `apiFetch` would therefore treat users with no preference as having one. The fix must test for a real preference record, not merely truthiness.

### 2.2 Required scenarios (observed at `1d75bb9`)

| # | Scenario | Observed |
|---|---|---|
| 1 | Signed-in user **with** a saved cause chooses a plan | Preference lookup 401, so the **selector is shown** with "If you don't choose one, it is distributed equally among all three". The saved cause stays active in the DB. Skip leaves it untouched (correct); save overwrites it. **Confirms the PA concern:** the UI implies the equal-split default while a saved choice remains in force. |
| 2 | Signed-in user, no saved cause | Selector shown (correct only by accident: the lookup 401 and the real "no preference" result look identical) |
| 3 | Guest opens `/pricing` | Plans render, with no redirect on load (good). Two protected 401s on load. Plan → selector → **skip** → checkout 401, "Could not start payment", no sign-in prompt. Plan → selector → **save** → `apiFetch` 401 → refresh 401 → redirect to `/login` **without** `next` |
| 4 | Selects one cause, save succeeds | Save 200 (Bearer), then **checkout 401**, "Could not start payment" |
| 5 | Save fails, then retry | 500: alert shown, selection kept (PR #59 behaviour correct). Retry 200, then **checkout 401** |
| 6 | Continue without choosing | No preference request (correct), then **checkout 401** |
| 7 | Expired access token, valid refresh session | Selector save: 401 → `/auth/refresh` 200 → retry 200 (`apiFetch` works). Lookups and checkout send no token, so **checkout 401** |
| 8 | Subscription checkout / token-package purchase | Checkout: **401 for every signed-in user**, so no subscription can start from `/pricing`. Token package: 401, then redirect to `/login?returnUrl=/pricing` (wrong parameter; the return path is lost) |

**Lookup outcomes are not distinguished.** Today "missing preference", "unauthorized lookup" and "network or server failure" all collapse to `null`, then `hasPreferences = false`, and the selector is shown.

## 3. Proposed minimal correction (NOT implemented)

**Principles:**
- Reuse `apiFetch` and its de-duplicated refresh; no second auth mechanism.
- Public pricing stays public.
- No redirect on page load.
- Same endpoints, methods and bodies, so there is **no billing-contract change**.

### 3.1 `services/web/lib/api.ts` (small, backward-compatible)

- Add an optional third argument: `apiFetch(path, init?, opts?: { redirectOnAuthFailure?: boolean })`.
  - The default is `true`, which keeps today's behaviour for every existing caller.
  - With `false`, a 401 that survives the refresh **throws** `{status: 401}` instead of setting `window.location`.
- No other behaviour change.

### 3.2 `services/web/app/(billing)/pricing/page.tsx`

- **Public data:** keep the plain `fetch` for `plans` and `token-packages`.
- **Session detection:** `hasSession = !!localStorage.access_token`.
  - **Guest:** skip `me` and `preferences` entirely. No protected calls, no redirect.
  - **Signed-in:** `apiFetch('/subscriptions/me', {}, {redirectOnAuthFailure:false})` and `apiFetch('/causes/preferences', {}, {redirectOnAuthFailure:false})`.
- **Preference state:** `'none' | 'saved' | 'unknown'`.
  - `saved`: the response contains a preference record (`'cause1Id' in prefs`).
  - `none`: an empty body (`{}`).
  - `unknown`: any error, including a 401 after refresh.
- **Plan click:**
  - Guest: `router.push('/login?next=/pricing')` (on intent, never on load).
  - `saved`: checkout directly.
  - `none`: `CauseSelector` (unchanged).
  - `unknown`: **checkout directly, without the selector**. The server-side preference is untouched and the UI makes no equal-split claim it cannot verify.
    - Alternative for the PA: retry the lookup once on click, then fall back as above.
- **`checkout(planId)` and `buyTokenPackage(id)`:** `apiFetch(..., {method:'POST', body}, {redirectOnAuthFailure:false})`.
  - A 401 sends the user to `/login?next=/pricing`; that also fixes the `returnUrl`/`next` mismatch.
  - Other errors keep the existing `t.pricing.paymentError`.
  - `window.location.href = url` on success is unchanged.
- **Unchanged:** `CauseSelector`, i18n (no new copy), and the API.

**Files:** `lib/api.ts`, `app/(billing)/pricing/page.tsx`, plus tests. Estimated at about 40–60 changed lines of production code.

### 3.3 Not changed

Stripe, prices, plan and package data, checkout and purchase request bodies, entitlements, allocation, subscription economics, the API auth contract, and infrastructure.

## 4. Regression-test plan

| Layer | Test | Asserts |
|---|---|---|
| API integration (proposed `tests/unit/subscriptions/subscriptions-auth.contract.spec.ts`, inside the existing `testRegex`; no config change) | In-process Nest app with the real `JwtStrategy`, guards, controllers and `ValidationPipe`, signed JWTs, loopback HTTP; same shape as the §2 probe | Refresh cookie only → 401 on `me`, `preferences` (GET/POST), `checkout`, `tokens/purchase`; Bearer → 200; expired → 401; unconfirmed email → 403; no preference → **200 with empty body** (pins the contract the web relies on) |
| Web unit, `tests/unit/lib/api.spec.ts` | Real `apiFetch` with mocked `global.fetch` | Authorization header attached; one refresh then retry with the new token; `redirectOnAuthFailure:false` throws a 401 without touching `window.location`; the default still redirects |
| Web, `tests/unit/app/billing/pricing.spec.tsx` (rewritten to mock **network** `fetch`, not `apiFetch`) | Real `apiFetch` and the real `CauseSelector` | Guest: only public requests on load and no redirect; plan → `/login?next=/pricing`. Signed-in: `me`, `preferences`, checkout and purchase carry `Authorization: Bearer`. Saved preference → direct checkout, no selector. Empty body → selector. Lookup 500 or 401 → no selector, no equal-split text, checkout proceeds. Save then checkout; save fails then retry then checkout; skip then checkout. Expired token → refresh → retried checkout continues. Checkout 401 after refresh → `/login?next=/pricing`. Checkout and purchase bodies unchanged |
| Browser (local procedure; CI E2E is environmentally broken) | Playwright against `next start`, with the §2 stub enforcing Bearer | Scenarios 1–8 re-run; expected: 1 → direct checkout; 3 → login with `next`; 4–7 → `__checkout_reached`; 8b → `__tokens_checkout_reached` |

Coverage thresholds stay unchanged.

## 5. Operational and security risks

- **Current impact (pre-existing):**
  - In any environment running this code, **no signed-in web user can start a subscription or buy a token package from `/pricing`**.
  - Current subscribers are not recognized: the "current plan" button is not disabled.
  - Users with a saved cause are shown the default-split message.
  - There is no data corruption, and an unwanted overwrite happens only if the user actively saves.
- **Fix risks:**
  - Restoring `me` re-enables the current-plan guard, as intended.
  - With checkout reachable, the `EmailConfirmedGuard` 403 surfaces as the generic payment error (pre-existing copy gap; recorded, not changed).
  - The `redirectOnAuthFailure` flag defaults to today's behaviour, so other callers are unaffected.
- **Security:**
  - No new credential surface: the token stays in `localStorage` as today, and the refresh token stays httpOnly.
  - Cookie-based JWT extraction is **not** proposed: it would add a second mechanism and a CSRF surface.
- **Isolation:** yes. The fix is web-only, in two files, with no billing-contract change.

## 6. Related findings (recorded; outside this fix's scope)

1. **The same unauthenticated-`fetch` pattern on other protected surfaces (pre-existing; found by code review, not runtime-verified):**
   - `app/(account)/account/billing/page.tsx` (`me`, `linked-users`, `portal`, `sync`, `resume`, `invite`, deletes);
   - `app/(billing)/billing/success/page.tsx` (`sync`);
   - `app/(auth)/join/page.tsx` (`auth/me`, `invite/accept`);
   - `app/(auth)/gift/claim/page.tsx` (`auth/me`, `gifts/claim`);
   - `lib/billing-utils.ts` (only tests use it).
2. **Token-key mismatch (pre-existing; reader-affecting; code evidence only).**
   - `components/StatsTab.tsx`, `components/PrivacyTab.tsx`, `lib/use-reading-heartbeat.ts` and `lib/i18n/index.tsx` read `localStorage.noetia_token`, which **no code writes**; the login flow writes `access_token`.
   - Those requests send `Bearer null` to guarded endpoints (`/stats/*`, `/users/me`).
   - Likely effects: lost reading heartbeats and stats, failed privacy saves, no server language sync.
   - Recommend separate priority triage, since reader experience is priority 1.
3. **Pricing and billing Causas copy:** `t.pricing.causasText` ("2.22% of every payment supports") and `t.billing.causas` ("…supports social causes") still imply executed contributions.
4. **"Every payment" vs "qualifying payment"** (PO-053 OP-1) is still open. Public copy says "every payment".
5. **Cookie consent:** the public cookie-consent UX and legal findings from the ecosystem assessment (Draft PR #57) remain open.
6. **CI:**
   - The coverage gates were already failing on `main`: API branches 68.88%, web 72.8%, mobile 29.61%.
   - E2E fails because the runner can't install Chromium ("Playwright does not support chromium on ubuntu26.04-x64").
   - All unit tests pass.

## 7. STOP

No code was changed. PR #59 stays Draft. Implementation awaits PA review and PO authorization. No merge or deployment.
