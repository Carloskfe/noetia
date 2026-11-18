# PR #59: final public-copy correction (PO decision 2026-11-18)

**Status:** PR #59 remains **Draft, DO NOT MERGE**. A bounded web copy and test commit was authorized and made. Nothing was merged or deployed, payments were not activated, and PR #60 and PR #62 were not modified.
**Recommendation:** **CONDITIONAL GO** for a future, separately authorized release of PR #59 alone (gates in §7).

## 1. Revisions

| Item | SHA |
|---|---|
| PR #59 HEAD **before** | `3b99ed350c46f6e74183a940cd75fc718ff0ed30` |
| PR #59 HEAD **after** (this correction) | **`0b9413faa1757c3f245852465151f6d0102775a6`** |
| `main` | `a67afbd0d63c65af115137bba79bb8884df2c96e` (PR #63 deployed) |
| Rehearsal tree, new (`git merge-tree --write-tree a67afbd 0b9413f`) | **`3db561638af60cb3cfd59436e4463de6a071cc7d`**, no conflicts |
| Rehearsal tree, previous (qualified 2026-11-18, [report](../pr59-integration-qualification/README.md)) | `5b97b184b2878dff227aa1f4e78cf51049ed23ae` |

**[R]** `git diff 5b97b184 3db56163` touches exactly the 6 files in §2. `services/api` is **byte-identical**, so the API results from the previous qualification carry over unchanged: 75/75 suites, 1293/1293 tests, and the PR #63 gate + Causas suites 271/271.

## 2. Changed files (`git diff --stat 3b99ed3 0b9413f`: 6 files, +57 / −13)

| File | Change |
|---|---|
| `services/web/lib/i18n/en.ts` | `pricing.trial`, `pricing.startTrial`, NoetiaX capability (+ "per session") |
| `services/web/lib/i18n/es.ts` | Same, in Spanish |
| `services/web/tests/unit/app/billing/pricing.spec.tsx` | +2 tests: the rendered page and en/es pricing strings contain no trial wording |
| `services/web/tests/unit/app/LandingContent.spec.tsx` | Pins "up to three / ten eligible books you select per session" |
| `services/web/tests/e2e/subscribe-to-unlock.spec.ts` | Locator follows the new button label ("Elegir plan"). Not run: E2E is not runnable in CI (§6) |
| `docs/reports/public-site-ecosystem-20261112/checkpoint-x/pr59-browser.mjs.txt` | X05 strict assertion; plan-button locator; new X06 copy checks |

Not touched: application components and pages, `services/api`, the PR #63 gate, Causas logic, prices, checkout contracts, Stripe, subscription and entitlement logic, migrations, infrastructure, mobile.

## 3. Before and after (public wording)

| Where | Before (EN / ES) | After (EN / ES) |
|---|---|---|
| `/pricing` subtitle (`pricing.trial`) | "14-day free trial. Cancel anytime." / "14 días de prueba gratuita. Cancela cuando quieras." | **"Subscriptions are not open yet."** / **"Las suscripciones aún no están abiertas."** |
| `/pricing` plan button (`pricing.startTrial`) | "Start free trial" / "Comenzar prueba gratuita" | **"Choose plan"** / **"Elegir plan"** |
| Landing, NoetiaX | "…across up to ten eligible books you select" / "…sobre hasta diez libros elegibles que seleccionas" | "…across up to ten eligible books you select **per session**" / "…que seleccionas **por sesión**" |
| Landing, Noetia+ | "…across up to three eligible books you select per session" / "…que seleccionas por sesión" | Unchanged (already matched the approved limit) |
| Both premium tiers | "Will require an active Noetia subscription." / "Requerirá una suscripción Noetia activa."; badges "Coming Soon" / "Próximamente"; "No dates or prices have been announced." | Unchanged (match the PO decision) |
| Causas | "We commit 2.22% of every payment to Causas Noetia. You choose one cause… If you don't choose one, it is distributed equally among all three." (+ ES) | Unchanged (PO-053) |

**Wording rationale:** "Subscriptions are not open yet" is factual while payments are disabled in production (PR #63 gate, flag absent). It promises no trial, sets no eligibility rule, and gives no date. **It must be revised as part of the financial release** (release-coupling gate in §7).

**Kept deliberately:** the `trialing` / "Free trial" / "Trial until" status labels in account billing. They only describe an existing subscription's state, so they are accurate and not a promise. The i18n **key names** `trial` and `startTrial` are unchanged, to keep the code diff at zero; a comment in the file explains why.

## 4. Test results

| Check | Result | Evidence |
|---|---|---|
| Web `tsc --noEmit` | PASS | [O] |
| Web `next lint` | 0 errors, 15 warnings (unchanged) | [O] |
| Web unit, full suite | **25/25 suites, 385/385** (383 earlier + 2 new). Coverage 73.03 / 72.76 / 71.61 / 52.32: unchanged; below the 80% gate, as on `main` | [R] [`logs/web-jest.log`](logs/web-jest.log) |
| Negative control: new tests run against the **old** i18n copy | **3 failed** (the 2 trial tests + the NoetiaX per-session check), so the tests detect the old wording | [O] |
| Web production build (final tree) | PASS | [R] [`logs/web-build.log`](logs/web-build.log) |
| **Browser suite** (Playwright 1.59.1, cached Chromium headless shell, `next start` on 127.0.0.1, every API call mocked, Stripe = local stub host, all other network blocked) on the final build | **41/41 PASS** | [R] [`browser-run.txt`](browser-run.txt), [`browser-results.json`](browser-results.json), [screenshots](screenshots/) |

**Browser checks:**
- **Approved limits:** X06-home-es and X06-home-en find "up to three…per session" and "up to ten…per session", the subscription requirement exactly ×2, and no dates or prices next to Noetia+ / NoetiaX.
- **Coming Soon:** X02 runs ES and EN at desktop and mobile widths and finds `comingSoon=2`, `premiumTierLinks=0`, `checkoutLinks=0`.
- **No trial promise:** X06-pricing-es and X06-pricing-en find the neutral subtitle and the new button label, and `trialWords=false` (`/free trial|14[- ]day|prueba gratuita|14 días|trial|prueba/i` over the whole page).
- **Payments disabled, no accidental Stripe redirect:** X05 (strict) stays on `/pricing` and shows `"Could not start payment."` ([screenshot](screenshots/pricing-payments-not-configured-en.png)).
- **No Causas regression:** X04-4, X04-11a, X03/X04-11b and X04-8 still pass: single-choice selector, Skip writes nothing, a failed save blocks checkout, a lookup error shows a notice. The ecosystem pages contain no two-cause or random-distribution wording.
- **Correction B (X05):** the assertion now requires the exact `paymentError` copy; the false positive is documented in the [previous report §5](../pr59-integration-qualification/README.md). Application behaviour was not changed to make it pass.

**PR #63 safeguard [R]:** in rehearsal tree `3db56163`, `git grep "new Stripe("` returns only `services/api/src/common/payments-activation.ts:51`; `createStripeClient(this.config)` is used in `gifts.service.ts`, `subscriptions.service.ts` and `webhooks.controller.ts`; `services/api` is identical to the previously qualified tree.

**GitHub CI on `0b9413f`:** run `44224187195`; results in the PR comment.

## 5. Remaining legal-review requirements

| Item | PO status | Legal status |
|---|---|---|
| Noetia+ / NoetiaX capability and limit wording, the subscription prerequisite, the "Coming Soon / no dates or prices" disclaimer | **Approved 2026-11-18** | **Not recorded.** Recommend legal review of the AI-capability claims before release |
| Causas: "We commit 2.22% of every payment to Causas Noetia" + one-cause / equal-split rule; `/pricing` "2.22% of every payment supports Noetia Causes" | Policy approved (PO-053, 2.22%) | **PENDING.** The "commit" / "supports" wording describes a financial commitment that isn't operational while payments are disabled. Legal sign-off required |
| Neutral pricing subtitle "Subscriptions are not open yet." | Applied per PO instruction | Low risk; include in the Terms/legal pass |
| Terms of Service (NOF-004, legal-gated draft #22) | — | Open, unchanged |

## 6. Remaining public wording that could imply payments or premium features are active (identified, **not changed**: outside the authorized scope or a pricing representation)

1. `pricing.paymentError`: "Could not start payment. **Please try again.**" / "…Intenta de nuevo." While subscriptions are closed, retrying can't succeed. **Suggest a PO decision** on neutral wording.
2. `/pricing`, "Annual · **2 months free**" / "2 meses gratis": an annual-discount pricing representation, kept because prices are preserved. Needs a PO and legal check with USD-1.
3. `/pricing` token packages: "Buy extra tokens without changing your plan" and the **"Buy"** buttons, plus the "🎁 Gift tokens to someone" link to `/gift` (gift purchase form, unchanged on `main`). All fail closed (`payments_not_configured`), but they read as purchasable.
4. Prices shown with `$`, not `US$` (USD-1).
5. **Mobile app:** `services/mobile/src/i18n/{en,es}.ts` `paywall.subtitle` still says "14-day free trial. Cancel anytime." This is shared copy (CLAUDE.md's 4-file rule). The web key is unchanged and **not rendered** on web. Mobile ships separately through EAS, and changing it was outside this web-only correction. **Needs its own PO instruction.**

## 7. Gates, exceptions and recommendation

| Gate / exception | Status |
|---|---|
| G-X1: `PAYMENTS_ENABLED` ABSENT/EMPTY/FALSE and `STRIPE_SECRET_KEY` ABSENT/EMPTY at all three layers + check D `[payments] disabled`, immediately before and after release | OPEN (blocking) |
| G-X2: PA acceptance (this correction and the previous qualification) | OPEN |
| G-X3: PO copy approval | **Premium tiers and trial wording: APPROVED 2026-11-18.** Legal review (§5): OPEN |
| G-X4: CI exceptions. Coverage gates (API branches ~69, web ~73/52, mobile ~30/14) and the E2E runner failure (`ubuntu26.04` Chromium) are baseline failures on `main` too. The repository E2E suite was not run | OPEN (PO acceptance) |
| G-X5: release controls (independent PO instruction naming PR #59 and **`0b9413f`**; idle CD; operator present; backups) | OPEN |
| G-X6: post-release ES/EN acceptance, including the neutral pricing subtitle and "Choose plan" | OPEN |
| **New: release coupling.** The neutral pricing copy must be revised in the financial release, before or together with `PAYMENTS_ENABLED=true` | Recorded |
| S19 shared-network risk: accepted for PR #63 only; a new PO decision is needed for PR #59 | OPEN |
| PR #60 is stacked on this branch. Its base gained this commit; #60 itself is unchanged. Don't delete the branch after merging | Note |
| Financial gates (G-1, G-4, G-5, W-1, W-2, USD-1, D4, webhooks, Terms, PR #60 integration) | CLOSED; not affected |

**Recommendation: CONDITIONAL GO** for a future, separately PO-authorized release of PR #59 at `0b9413f` alone, subject to G-X1, G-X2, G-X4, G-X5 and G-X6, the legal items in §5, and an S19 decision. The supervised procedure is unchanged from the previous report §11, except that the pinned HEAD is now `0b9413faa1757c3f245852465151f6d0102775a6` and the expected merged tree is `3db561638af60cb3cfd59436e4463de6a071cc7d`.

## 8. Evidence location

| Evidence | Where | Durability |
|---|---|---|
| This report, final-build browser transcript + JSON, 9 screenshots, web jest log and build log (local paths redacted) | Branch `evidence/pr59-integration-20261118`, folder `pr59-copy-correction/` | Durable |
| Same report | PR #59 conversation comment | Durable |
| Typecheck and lint console output; negative-control run output | Not retained beyond the summary lines here | [O]: re-run `pnpm --filter @noetia/web typecheck`, `pnpm --filter @noetia/web lint`; negative control = revert the two i18n files and run `jest tests/unit/app/billing/pricing.spec.tsx tests/unit/app/LandingContent.spec.tsx` |
| CI | GitHub Actions run `44224187195` | Durable while retained |
