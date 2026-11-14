# G-1 implementation: authenticated, read-only Checkout verification

| | |
|---|---|
| **Mission** | G-1: Authenticated, Read-Only Checkout Verification Implementation (PO authority; prepared by PA), one bounded implementation and verification attempt |
| **Specification** | [`../g1-checkout-verification-design.md`](../g1-checkout-verification-design.md): §R4 copy (authoritative), §R3 architecture, §R2 security and tests |
| **Repository / PR** | `Carloskfe/noetia`, PR #60 (Draft), stacked on PR #59 (Draft, unchanged at `e326b81`) |
| **Initial HEAD** | `05c334f0e4ac1eeb7516aa79b68a2a4893c8f8c9` (verified = expected, Draft, unmerged; no overlapping G-1 work found) |
| **Status** | **Implemented and verified locally. Not merged, deployed or activated.** CI did not run (see §8). STOP for independent PA review. |

---

## 1. What was built

**One route,** `GET /subscriptions/checkout-sessions/:id/status`:
- **Access:** `JwtAuthGuard` only. There is no anonymous or optional-auth path, and no `EmailConfirmedGuard`.
- **Headers and limits:** `Cache-Control: no-store`, including on 404 and 503. The route allows 30 requests per minute per IP.
- **Where it lives:** a new `CheckoutStatusController`, under the existing `/subscriptions` prefix.

**A strictly read-only verifier,** `CheckoutStatusService`:
- **Stripe:** its only call is `checkout.sessions.retrieve`.
- **Database:** it only counts the session's `fulfillment:checkout-session:<cs>` key, counts one `user_books` row (books), and reads the caller's own `subscriptions` row (subscriptions).
- **Never:**
  - claims a key, issues tokens or adds a book;
  - writes a subscription;
  - calls `syncSubscription`, `applyStripeSubscription`, `upsertFromWebhook` or `issueTrialStartTokens`;
  - runs webhook fulfillment.

**Billing success page:**
- **With `session_id`:** calls the route and derives copy only from the verified response.
- **With `?purchase=gift`:** sends no request (G-b).
- **Without `session_id`:** behaviour is unchanged.

**Approved copy:** the 13 PO-2 message groups, verbatim, in web EN/ES.

## 2. Changed files

| File | Purpose |
|---|---|
| `services/api/src/subscriptions/checkout-status.service.ts` | **New.** The read-only verifier: id validation, kind and ownership from Stripe, R1-B token rules, book ownership evidence, entitlement for this session's subscription only, safe 404/503 |
| `services/api/src/subscriptions/checkout-status.controller.ts` | **New.** The single route: guard, throttle, `no-store` |
| `services/api/src/subscriptions/subscriptions.module.ts` | Wiring: registers the controller and service. Repositories already registered are reused; no new entity |
| `services/web/lib/checkout-status.ts` | **New.** Client contract: strict response → copy derivation, terminal rule, polling schedule, `Retry-After` handling, sign-in return path |
| `services/web/app/(billing)/billing/success/page.tsx` | Session-aware flow, bounded polling with abort/invalidation, state → copy rendering. The no-session and gift flows are unchanged |
| `services/web/lib/api.ts` | **Additive:** a 429 error now carries `retryAfter`, read from `Retry-After` / `Retry-After-global`. Nothing else changed |
| `services/web/lib/i18n/en.ts`, `es.ts` | `billing.success.status.*`: the 13 approved groups, verbatim. No existing string changed |
| `services/api/tests/unit/subscriptions/checkout-status.service.spec.ts` | **New.** 75 unit tests |
| `services/api/tests/unit/subscriptions/checkout-status.contract.spec.ts` | **New.** 13 HTTP contract tests (real JWT strategy, guard and throttler) |
| `services/web/tests/unit/lib/checkout-status.spec.ts` | **New.** 72 tests: derivation, polling budget, exact §R4.3 copy, claim guards, existing copy unchanged |
| `services/web/tests/unit/app/billing/success-session.spec.tsx` | **New.** 61 network-level page tests of the session flow |
| `services/web/tests/unit/app/billing/success-page.spec.tsx` | Existing tests re-pointed to the no-session flow they describe. Gift test extended with a session id |
| `services/web/tests/unit/lib/api.spec.ts` | +5 tests for the additive `retryAfter` field |
| `docs/reports/payment-lifecycle-20261112/g1-implementation/**` | This report, browser screenshots and test evidence |

**Not changed** (audited with `git diff --stat 05c334f`):
- the subscription and webhook services, the fulfillment ledger, token issuance and redemption;
- book ownership writes; gift checkout, notifications and claiming;
- migrations, scripts and the harness;
- Stripe integration and configuration, payment methods;
- mobile, Terms and Privacy Policy, infrastructure, PR #59;
- W-1, W-2, G-4 and G-5.

## 3. Final API contract (as implemented, §R3.4)

```ts
type CheckoutSessionStatus =
  | { kind: 'subscription'; checkout: 'open'|'complete'|'expired';
      entitlement: null | 'not_recorded' | 'active' | 'payment_problem' | 'ended' | 'superseded' }
  | { kind: 'tokens'; checkout: …; payment: 'paid'|'unpaid'|'no_payment_required';
      delivery: null | 'pending' | 'unconfirmed' }            // 'delivered' is not representable
  | { kind: 'book';   checkout: …; payment: …;
      delivery: null | 'pending' | 'delivered' | 'unconfirmed' };
```

**Errors:**

| Status | Body | When |
|---|---|---|
| `401` | (guard) | No or invalid JWT |
| `404` | `{ "error": "checkout_session_not_found" }`, byte-identical in every case | Malformed id (no Stripe call), unknown, another account's, gift, non-Noetia or wrong mode |
| `429` | (throttler) | Rate limit reached; carries `Retry-After-global` |
| `503` | `{ "error": "checkout_status_unavailable" }` | Stripe, database or unmappable state; no detail |

**Kind and ownership** come only from Stripe `mode` and Noetia's server-written metadata:
- **subscription:** `noetiaUserId` must equal the caller. Sessions without metadata fall back to `customer == user.stripeCustomerId`.
- **tokens / book:** `metadata.userId` must equal the caller. When both customers are set, `session.customer` must equal `user.stripeCustomerId`.
- A token package takes precedence over a book, as in the webhook.

**Evidence rules:**
- **Tokens (R1-B):** complete + paid with no key gives `pending`; with the key, `unconfirmed`. The service has no `token_ledger` dependency and does no timestamp or reason comparison (source-audited by a test).
- **Book:** `delivered` needs the key **and** the caller's `user_books` row. Key without row gives `unconfirmed`, with one WARN log (truncated id). Row without key gives `pending`.
- **Subscription:** the caller's row must track exactly `session.subscription`:
  - `trialing`, `active` or `canceling` gives `active`;
  - `past_due` gives `payment_problem`;
  - `canceled` gives `ended`;
  - another **live** subscription gives `superseded`;
  - another **ended** subscription, no row, or no id gives `not_recorded`, which is non-terminal. *Implementation detail:* this avoids a terminal "not linked" answer for a returning subscriber whose new subscription the webhook hasn't recorded yet.

**Never returned:** amounts, currency, e-mails, names, Stripe or internal ids, token counts, timestamps. Tests assert a key whitelist.

## 4. Implemented state → copy (§R4.4)

| Verified state | Copy | Heading | Action | Terminal |
|---|---|---|---|---|
| `checkout: open` | A1 `checkoutOpen` | none | Check again | no |
| `checkout: expired` | A2 `checkoutExpired` | none | Continue → `/` | yes |
| tokens/book complete, payment ≠ paid | A3 `paymentNotConfirmed` | none | Check again | no |
| tokens paid, no key (`pending`) | A4 `paidProcessing.tokens` | none | Check again | no |
| tokens paid + key (`unconfirmed`) | T1 `tokenPaymentConfirmed` | none | Go to billing (token balance) | yes |
| book paid, no key (`pending`) | B1 `paidPending.book` | none | Check again | no |
| book key + ownership (`delivered`) | B2 `delivered.book` | none | Start reading → `/library` | yes |
| book key, no ownership (`unconfirmed`) | B3 `unconfirmed.book` | none | Continue → `/library` | yes |
| subscription `active` | C1 body | existing `title` | Go to billing | yes |
| subscription `ended` | C2 `subscriptionEnded` | none | Go to billing | yes |
| subscription `superseded` | C3 `subscriptionOther` | none | Go to billing | yes |
| subscription `not_recorded` | existing `pendingTitle` / `pendingBody` | existing | Check again, Go to billing | no |
| subscription `payment_problem` | existing `problemTitle` / `problemBody` | existing | Go to billing | yes |
| `404` | D1 `notFound` | none | Sign in (keeps `session_id`) | yes |
| `503`, `429`, network, contract-violating body | D2 `unavailable` | none | Check again | no |
| `401` | existing `authTitle` / `authBody` | existing | Sign in (keeps `session_id` + permitted `purchase`) | yes |
| `?purchase=gift` | existing `purchaseTitle` / `purchaseBody.gift` | existing | Continue | — (no request) |

**Rendering rules:**
- **No new headings:** every new G-1 message renders without an `<h1>`, and `purchaseTitle` never heads a result.
- **While verifying,** the existing neutral "We're confirming your purchase" is shown.
- **Buttons and links** reuse existing labels only (`checkAgain`, `viewBilling`, `continue`, `cta`, `signIn`).

**Polling:**
- the first request goes immediately, then 2 s × 5 and 4 s × 5: at most 11 requests over about 30 s;
- it stops on terminal states;
- a 429 `Retry-After` extends the wait (capped at 30 s) but never adds requests;
- "Check again" starts a new budget;
- the in-flight request is aborted and the run invalidated on unmount or a new run, so no state updates after cancellation.

## 5. Verification results (local; actual commands)

| # | Check | Command | Result |
|---|---|---|---|
| 1 | New API unit tests | `npx jest tests/unit/subscriptions/checkout-status.service.spec.ts --maxWorkers=2` | **75/75 pass** |
| 2 | New controller / security tests (HTTP) | `npx jest tests/unit/subscriptions/checkout-status.contract.spec.ts --maxWorkers=2` | **13/13 pass** |
| 3 | New service coverage | `--coverage` on the two new API files | `checkout-status.service.ts`: **99.08 % statements, 96.2 % branches, 100 % functions, 100 % lines** (≥ 80 %) |
| 4 | New web tests | `npx jest tests/unit/app/billing tests/unit/lib/checkout-status.spec.ts tests/unit/lib/api.spec.ts tests/unit/lib/i18n.spec.ts --maxWorkers=2` | **251/251 pass**; `lib/checkout-status.ts` 100 % coverage |
| 5 | Full API suite (existing subscription and payment tests included) | `npx jest --maxWorkers=2` (services/api) | **1295/1295 tests pass**; 75/76 suites. The one failing suite, `tests/unit/auth/auth.controller.spec.ts`, **fails identically at the baseline**: the `bcrypt` native binding isn't built in this worktree (`Cannot find module …/bcrypt_lib.node`). Environment only; unrelated to G-1. |
| 6 | Full web suite | `npx jest --maxWorkers=2` (services/web) | **587/587 pass**; 30/30 suites |
| 7 | TypeScript | `npx tsc --noEmit` (api and web) | **0 errors** |
| 8 | API build | `npm run build` (`nest build`) | **OK**, new files emitted to `dist/` |
| 9 | Web build | `npm run build` (`next build`) | **OK**; `/billing/success` compiled |
| 10 | Lint | API `npx eslint <new and changed files>`; web `next lint --file …` | API **0 errors** (37 `no-explicit-any` warnings, the repository's existing style); web **no warnings or errors** |
| 11 | EN/ES parity | `tests/unit/lib/i18n.spec.ts` | **pass** |
| 12 | Exact copy vs §R4.3 | `tests/unit/lib/checkout-status.spec.ts` parses the §R4.3 table **from the design document** and compares all 13 groups, EN and ES | **13/13 exact**, plus an independent literal check of T1 |
| 13 | Existing copy unchanged | the same file compares every pre-G-1 `billing.success` value with the `05c334f` baseline | **unchanged**; only `status` was added |
| 14 | Real PostgreSQL | disposable `postgres:16-alpine`, all **68** migrations, the real service with an in-memory Stripe fake ([`evidence/g1-pg-probe.out.txt`](evidence/g1-pg-probe.out.txt)) | **10/10 pass.** Results below; the container was removed afterwards. |
| 15 | Browser | production build (`next start`), headless Chromium, API answered by in-browser interception ([`evidence/browser-shots.js.txt`](evidence/browser-shots.js.txt)) | **34 screenshots** (17 states × EN/ES) in [`screenshots/`](screenshots/), with [`evidence.json`](screenshots/evidence.json) recording each view, copy key, request count and visible text |

**Row 14 results:**
- the token key with no token rows gives `unconfirmed`;
- book key + row gives `delivered`; key without row gives `unconfirmed`;
- **a read during an uncommitted fulfillment** gives `pending`, and after commit `delivered`: the key and the row become visible together;
- the subscription states map correctly from the real table;
- the read-only counts were unchanged by the verifier.

Raw outputs: [`evidence/api-full.txt`](evidence/api-full.txt), [`evidence/api-g1.txt`](evidence/api-g1.txt), [`evidence/web-full.txt`](evidence/web-full.txt), [`evidence/web-g1.txt`](evidence/web-g1.txt).

**Mandatory negative controls (all covered and passing):**
- a token key with zero tokens (unit and real PostgreSQL);
- earlier unrelated tokens, and a coinciding timestamp (no token data is readable by the service; source audit);
- a paid book without ownership;
- an unpaid session with a key (tokens and books);
- an unrelated active subscription (`superseded`, never `active`);
- a subscription active before its first allocation (no token evidence is read; no token or payment copy);
- complete but unpaid;
- duplicate and out-of-order observations (repeated reads are identical; a later event moving the row gives `superseded` or `ended`);
- malformed or unexpected inputs never yield token `delivered`, on the server (type plus construction) or the client (strict derivation; a contract-violating `delivered` renders `unavailable`).

## 6. R1-B and G-b confirmation

- **R1-B:**
  - A token response cannot contain `delivered`: the type excludes it, the server builds it from the key alone, and tests cover every state, key and odd-input combination.
  - The client has **no** token-delivery copy at all.
  - The verifier reads no `token_ledger`, balance, timestamp or `reason`.
  - `tokenPaymentConfirmed` appears only for `{tokens, complete, paid, unconfirmed}` from an authenticated owner.
- **G-b:**
  - `?purchase=gift` sends no request (asserted with a session id present) and keeps the existing generic copy.
  - The route answers every gift session with the uniform 404.
  - No gift route exists (source audit of every controller).
  - `POST /gifts/checkout`, notifications, claiming and recovery are untouched.

## 7. Residual risks and observations (for PA)

| # | Item | Effect | Recommendation |
|---|---|---|---|
| **R-1** | *(Correction, Checkpoint I: the 120/min limit is per route handler, not across all routes; see [`../g1-checkpoint-i/README.md`](../g1-checkpoint-i/README.md) §A.)* **The rate limit is effectively global behind Traefik.** The API does not set Express `trust proxy` and the throttler tracks `req.ip`. In production, every client therefore shares the proxy's IP, so the route's 30/min (and the existing global 120/min for all routes) is shared by **all users per API instance**. A handful of buyers polling at once could exhaust it. | Fails safe: buyers see D2 `unavailable` ("can't verify right now"), never a false claim. But it's a real launch-capacity risk, and it already exists for the global limit. | Before launch, a separate change: set `trust proxy` for Traefik's hop (infrastructure / global behaviour; **out of this mission's scope**), or relax this route's limit. PA decision. |
| R-2 | The `401` view uses the existing approved `authTitle` / `authBody` as §R4.4 binds ("Sign in to confirm your **subscription**" / "Your payment isn't affected"), even for token or book sessions | Pre-existing approved wording; not a false payment claim, but a payment-outcome statement in an error state | PO/PA may want kind-neutral sign-in wording (a new PO decision) |
| R-3 | No "contact support" **link**: T1 and B3 mention support, but `billing.success` has no approved link label | Customers must find `/contact` via the footer | PO may approve a label; then link `/contact` |
| R-4 | §R4.5 observations, implemented verbatim: O-1 Spanish "biblioteca" in lowercase; O-2 D1 shown for a gift session reached without `?purchase=gift`; O-3 C1 repeats the kept title (see `09-subscription-active.*.png`) | Wording only | As recorded in §R4.5 |
| R-5 | The no-session flow still shows the retired `body` ("full access… start reading right away") in its existing "confirmed" view, which the mission said to preserve | All four Checkout `success_url`s include `session_id`, so it's reachable only by direct navigation | Retire it in a later copy change |
| R-6 | Sentry `session_id` masking (PA-7) not implemented. Sentry is not enabled; the API logs only truncated ids | None today | Prerequisite before enabling Sentry |
| R-7 | Stripe test-fixture realism: unit and contract tests use synthetic sessions; no real Stripe object was retrieved (as required) | Field names follow the stripe-node types (`status`, `payment_status`, `mode`, `metadata`, `customer`, `subscription`) | Exercise once in staging with Stripe test mode, when authorized |
| R-8 | During the real-PostgreSQL probe, the **first** attempt constructed the real stripe-node client with the fake key `sk_test_probe` before my in-memory fake was installed. **One unauthenticated request reached Stripe's API and was rejected** (`StripeAuthenticationError`); the service correctly answered 503. The key was fabricated, belongs to no account, and no transaction, object or account data was involved. The probe was then fixed to inject the fake before any call. | No financial or account effect | Recorded for transparency |

**Release blockers (unchanged; none is cleared by this implementation):**
- W-1 (token package unavailable at fulfillment);
- SG-PM, with W-2 item 1;
- A5, the production Stripe webhook events;
- Stripe production keys and configuration;
- USD-1;
- the Stripe portal check (D4);
- the Terms review (OP-3);
- G-4 and G-5;
- **plus R-1 above.**

E-1 stays OPEN/BLOCKED and Checkpoint E stays NOT QUALIFIED.

## 8. CI

**CI did not run.** PR #60 is stacked on PR #59 and CI does not run on stacked PRs. Every result above is a **local** run on the development VM, not a CI result.

## 9. Hand-off

- **PR status:** PR #60 remains Draft and PR #59 is unchanged. Nothing was merged, deployed or activated.
- **Prohibited actions:** no production or staging access, and no real Stripe transaction (see R-8 for the single rejected unauthenticated request).
- **Next step:** STOP for independent PA review. **A successful implementation is not production release authorization.**
