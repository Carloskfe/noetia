# PR #59: payment-availability UX correction (PO authorization 2026-11-18)

**Status:** PR #59 remains **Draft, DO NOT MERGE**. One bounded web commit was made. Nothing was merged or deployed, payments were not activated, and there were no secret or server changes. PR #60 and PR #62 were not modified.
**Recommendation:** **CONDITIONAL GO** for a future, separately authorized release of PR #59 alone (§8).

## 1. Revisions

| Item | SHA |
|---|---|
| PR #59 HEAD before | `0b9413faa1757c3f245852465151f6d0102775a6` |
| **PR #59 HEAD after** | **`fb970b50f0c17748bc2d5c2c09ed31904e0ef295`** |
| `main` | `a67afbd0d63c65af115137bba79bb8884df2c96e` (PR #63 deployed, payments disabled) |
| **Rehearsal tree** (`git merge-tree --write-tree a67afbd fb970b5`) | **`2ae5cf2d05a7a5729d795726100d004e302ccc82`**, no conflicts |

**[R]** `services/api` in `2ae5cf2d` is byte-identical to the previously qualified trees (`5b97b184`, `3db56163`), so the API results carry over: 75/75 suites, 1293/1293 tests, PR #63 gate + Causas suites 271/271. `git grep "new Stripe("` returns only `services/api/src/common/payments-activation.ts:51`.

## 2. Changed files (`git diff --stat 0b9413f fb970b5`: 10 files, +389 / −38)

| File | Change |
|---|---|
| `services/web/lib/purchase-availability.ts` | **New.** `PURCHASES_AVAILABLE = false` + `purchasesAvailable()`; documents the design and activation dependencies (§4) |
| `services/web/app/(billing)/pricing/page.tsx` | Unavailable notice; plan and token buttons disabled with "Not available yet"; gift entry shown as text; status banner hidden; early returns in `handleSelect`, `checkout` and `buyTokenPackage` |
| `services/web/app/(billing)/gift/page.tsx` | Unavailable notice; `<fieldset disabled>` makes the form read-only; submit disabled with "Not available yet"; early return in `handleSubmit`; delivery footer hidden while unavailable |
| `services/web/lib/i18n/{en,es}.ts` | New `pricing.unavailable.{notice,button,gift}`, `pricing.tokens.subtitleUnavailable`, `giftCard.send.{unavailable,unavailableButton}`; removed the now-unused `pricing.trial` |
| `services/web/tests/unit/app/billing/pricing.spec.tsx` | Existing flows run with availability mocked **on** (preserved path); new "purchases unavailable" suite (6 tests) |
| `services/web/tests/unit/app/billing/gift.spec.tsx` | **New** (3 tests: unavailable ×2, preserved path ×1) |
| `services/web/tests/unit/lib/purchase-availability.spec.ts` | **New** (default `false`; not driven by environment variables) |
| `services/web/tests/e2e/subscribe-to-unlock.spec.ts` | The 2 checkout flows `test.skip` while purchases are unavailable |
| `docs/reports/public-site-ecosystem-20261112/checkpoint-x/pr59-browser.mjs.txt` | `MODE` switch: default `unavailable` runs X07; `PURCHASES=available` runs the preserved X04/X05 checks |

Not touched: `services/api` (including the PR #63 gate), `CauseSelector` and Causas logic, checkout request contracts, prices, plan data, subscription and entitlement logic, migrations, infrastructure, mobile, CI.

## 3. Before and after behaviour (fail-closed default build)

| Surface | Before (`0b9413f`) | After (`fb970b5`) |
|---|---|---|
| `/pricing` header | "Subscriptions are not open yet." / "Las suscripciones aún no están abiertas." | **"Subscriptions and token purchases are not available yet."** / **"Las suscripciones y las compras de tokens aún no están disponibles."** (`role="status"`) |
| Plan buttons | Active "Choose plan" / "Elegir plan". A guest went to `/login`; signed in, the button opened the cause selector or started a checkout call, which then showed "Could not start payment. Please try again." | **Disabled** "Not available yet" / "Aún no disponible". No handler is attached; nothing happens |
| Token-package buttons | Active "Buy" / "Comprar". A guest went to `/login` after a credential-less 401 call; signed in, a purchase call started, then an error | **Disabled** "Not available yet" / "Aún no disponible"; no call |
| Token section subtitle | "Want to read more this month? Buy extra tokens without changing your plan." | "Additional tokens let you read more without changing your plan." / "Los tokens adicionales te permiten leer más sin cambiar de plan." |
| Gift entry on `/pricing` | Link "🎁 Gift tokens to someone" → `/gift` | Text "🎁 Token gifts are not available yet." / "🎁 Los regalos de tokens aún no están disponibles." (no link) |
| Status-unknown banner | "…You can still browse plans and buy tokens." | Not shown while unavailable (there is no purchase to protect) |
| `/gift` | Full purchase form; submit "Gift 1 Token — $9.99" called `/api/gifts/checkout` | Notice "Token gifts are not available yet. No gift can be purchased right now." / "Los regalos de tokens aún no están disponibles. Ahora mismo no se puede comprar ningún regalo."; packages and prices visible; inputs disabled; submit disabled "Not available yet"; no call |
| Existing subscriber | Current plan marked and disabled | Unchanged |
| Retry invitation | "Could not start payment. Please try again." reachable | Not reachable: no purchase call can start |

Screenshots: `unavailable-build/screenshots/pricing-unavailable-{en,es}.png`, `gift-unavailable-{en,es}.png`.

## 4. Availability-control design and activation dependency

- **Mechanism:** a reviewed **code constant** (`services/web/lib/purchase-availability.ts`), default **`false`**. Every purchase entry point reads `purchasesAvailable()`: render (disabled controls) and handlers (early return, defence in depth).
- **Why not an environment variable:** a `NEXT_PUBLIC_*` flag would be a second, operator-flippable switch outside review, which could leave the frontend out of step with the backend. Changing the constant needs a pull request, so it is reviewed as part of the financial release. A unit test pins that environment variables (`PAYMENTS_ENABLED`, `NEXT_PUBLIC_PAYMENTS_ENABLED`, `NEXT_PUBLIC_PURCHASES_AVAILABLE`) have no effect.
- **Not a payment-activation pathway:** it only decides what the web shows. Payment remains possible **only** through the API gate (PR #63: `PAYMENTS_ENABLED` exactly `true` **and** a real Stripe key). No secret or Stripe value is read or exposed by the web.
- **Inconsistent states:**
  - Web off + backend on: no purchases offered (safe).
  - Web on + backend off: the API refuses (`payments_not_configured`), and the page stays put and shows "Could not start payment." with no redirect. This is verified by X05 in the available-mode rehearsal, but it is a visible error, so the activation order below avoids it.
- **Activation (financial release only, separate PO authorization), as documented in the module:**
  1. PR #60 integrated, with every Stripe client going through `createStripeClient` (including `CheckoutStatusService`); financial gates G-1, G-4, G-5, W-1, W-2, USD-1, D4, webhooks and Terms/legal closed.
  2. Live-state pricing copy approved (subtitle, D1 trial wording, currency); the gift footer and token wording reviewed.
  3. Set `PAYMENTS_ENABLED=true`, verify the API boot line `[payments] ENABLED (Stripe live mode)`, then deploy the constant as `true`, never before.
  4. Kill switch: if the backend is disabled again, revert the constant in the same window.
- **Preserved for the future:** checkout, token purchase, gift checkout, the Causas selector, preference lookup and the status dialogs are unchanged behind the flag. They are verified by the unit suites with availability mocked on, and by the browser available-mode rehearsal (41/41).

## 5. Test results

| Check | Result | Evidence |
|---|---|---|
| Web `tsc --noEmit` | PASS | [R] `logs/web-typecheck.log` |
| Web `next lint` | 0 errors, 15 warnings (same count as before; none in changed files) | [R] `logs/web-lint.log` |
| Web unit, full suite (`jest --maxWorkers=2 --coverage`) | **27/27 suites, 394/394 tests.** Coverage 73.43 / 72.76 / 72.09 / 53.17, up from 73.03 / 72.76 / 71.61 / 52.32; below the 80% gate, as on `main`. `purchase-availability.ts` at 100% | [R] `logs/web-jest.log` |
| Negative control: pricing and gift pages patched to ignore availability (`purchasesAvailable()` → `true`) | **7 of 7 page-dependent unavailable-state tests fail.** On the first attempt, 2 "press every control" tests passed vacuously (no controls found). I fixed them to assert the controls exist before pressing, and then re-ran the control | [O] |
| Production build, fail-closed default | PASS | [R] `logs/web-build-unavailable.log` |
| **Browser, default build (`MODE=unavailable`)** | **33/33 PASS** | [R] `unavailable-build/browser-run.txt`, `browser-results.json`, screenshots |
| Production build, **local rehearsal** with the constant set to `true` (never committed; restored and confirmed `false` before the commit) | PASS | [R] `logs/web-build-available-rehearsal.log` |
| **Browser, rehearsal build (`MODE=available`)**: the preserved purchase path | **41/41 PASS** | [R] `available-rehearsal/browser-run.txt`, `browser-results.json` |

**How the required verifications map to checks (EN and ES):**
1. **Subscription controls non-actionable:** X07-pricing-{es,en}-{guest,signed-in} find 3 controls (2 plans + 1 package), all `disabled`. Unit tests check `disabled` + `aria-disabled`.
2. **Token controls non-actionable:** same checks. No "Buy" or "Comprar" control remains (unit).
3. **Gift entry points communicate unavailability:** X07 finds `a[href="/gift"]` count 0 and the gift text present; X07-gift-{es,en} find the notice, the email input disabled, and the submit label "Not available yet" / "Aún no disponible", disabled.
4. **No side effects from any press:** force-clicks plus dispatched `click` events on every disabled control, and a forced `submit` on `/gift`, produce effects `{"checkout":0,"tokens":0,"prefWrites":0,"gift":0,"stripe":0}`, the URL unchanged (no `/login` redirect) and no selector or dialogs. Unit tests cover guest and signed-in.
5. **Accurate message:** the exact approved EN/ES notice is shown; unit tests assert there's no trial wording and no "try again" / "inténtalo" / "intenta de nuevo" in any new string; X06-pricing-{es,en} find no trial wording.
6. **Existing routes unaffected:** X07-routes: `/login`, `/library`, `/discover` return 200 and the login form renders. The existing-subscriber current-plan display is checked by a unit test. The reader and library code is untouched (no diff outside billing pages, i18n and tests).
7. **Noetia+ / NoetiaX:** X02 (ES/EN × desktop/mobile) finds `comingSoon=2`, 0 premium links, 0 checkout links; X06-home-{es,en} find ≤3 / ≤10 books per session, "requires an active subscription" ×2, and no dates or prices.
8. **PR #63 gate intact:** see §1 [R].
9. **Future functionality preserved:** available-mode rehearsal 41/41 (X04 matrix, Causas X04-4/X04-11a/X03/X04-8, auth refresh, status block, X05) and the unit preserved-path suites.

**GitHub CI on `fb970b5`:** see the PR comment.

## 6. Remaining public-payment wording (identified, not changed)

1. `/pricing` "Annual · **2 months free**" / "2 meses gratis", and the "equivalent to $X/mo" lines: price representations, kept because prices are preserved. Review with USD-1.
2. `/pricing` line "2.22% of every payment supports Noetia Causes": a present-tense commitment. Legal review is still open (PO-053 policy approved).
3. `/gift` heading and subtitle "Gift Noetia: Send tokens to someone special…" are product descriptions; the notice directly below states unavailability. The package tiles keep their normal visual styling although the disabled fieldset makes them inert (cosmetic, P2).
4. Signed-in pages linking to `/pricing` ("View plans" in profile and account billing, "back to plans" after a canceled checkout) are navigation only. `/pricing` then states unavailability.
5. Account billing for **existing** subscribers (portal, cancel, resume): unchanged by design (existing-account functionality); the API still fails closed.
6. **Mobile app** (`services/mobile/src/i18n/{en,es}.ts`) `paywall.subtitle` "14-day free trial. Cancel anytime." is unchanged: out of scope (web only); needs its own instruction and mobile release.
7. `pricing.paymentError` "Could not start payment. Please try again.": no longer reachable while unavailable. Revisit with the live copy.

## 7. CI exceptions and operational risks

- **CI exceptions (baseline, `main` too):** coverage gates (API branches ~69, web ~73/53, mobile ~30/14/21) and the E2E runner failure (`Playwright does not support chromium on ubuntu26.04-x64`). The repository E2E suite was not run; its 2 checkout flows now skip when unavailable.
- **S19:** accepted for PR #63 only; PR #59 needs its own decision.
- **Deploy:** web rebuild and recreate (the usual short web and `/api` gaps); no migrations.
- **Open tabs** from before the deploy keep the old buttons until reload. Any purchase attempt from them still fails closed at the API (`payments_not_configured`), with no Stripe session.
- **PR #60** is stacked on this branch (base gained these commits; #60 itself unchanged). Its integration must keep `purchasesAvailable()` guards, or deliberately flip the constant as part of the financial release.

## 8. Gates and recommendation

| Gate | Status |
|---|---|
| G-X1: `PAYMENTS_ENABLED` ABSENT/EMPTY/FALSE and `STRIPE_SECRET_KEY` ABSENT/EMPTY at all layers + check D, immediately before and after release | OPEN |
| G-X2: PA acceptance of this correction | OPEN |
| G-X3: legal review of the Causas commitment wording and the premium-tier capability claims (PO approved the copy 2026-11-18) | OPEN |
| G-X4: PO acceptance of the CI exceptions | OPEN |
| G-X5: release controls (independent PO instruction naming PR #59 and **`fb970b5`**; idle CD; operator; backups) | OPEN |
| G-X6: post-release ES/EN acceptance: `/pricing` notice and disabled controls, `/gift` notice and disabled form, landing tiers, Causas, login/library/reader | OPEN |
| Release coupling: `PURCHASES_AVAILABLE` flips only in the financial release, after the backend is enabled (§4) | Recorded |
| S19 decision for PR #59 | OPEN |
| Financial gates (unchanged) | CLOSED |

**CONDITIONAL GO** for a future, separately authorized release of PR #59 at `fb970b5` alone. The merge should be pinned with `sha=fb970b50f0c17748bc2d5c2c09ed31904e0ef295` and produce tree `2ae5cf2d05a7a5729d795726100d004e302ccc82`; don't delete the branch (PR #60 is stacked on it).

## 9. Evidence location

| Evidence | Where | Durability |
|---|---|---|
| This report, both browser runs (transcripts + JSON), 10 screenshots, typecheck/lint/jest/build logs (local paths redacted) | Branch `evidence/pr59-integration-20261118`, folder `pr59-purchase-availability/` | Durable |
| This report | PR #59 conversation comment | Durable |
| Negative-control run output | Not retained (summary in §5) | [O]: re-run by replacing `purchasesAvailable()` with `true` in the two pages and running `jest tests/unit/app/billing` (expect 7 failures) |
