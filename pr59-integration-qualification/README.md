# PR #59: integration qualification on post-#63 `main` (reporting only)

**Status:** PR #59 remains **Draft, DO NOT MERGE**. This is a repository-only rehearsal: nothing was merged, deployed or pushed to PR #59, and payments were not activated. PR #60 and PR #62 were not touched.
**Date:** 2026-11-18. **Recommendation:** **CONDITIONAL GO** for a future, separately authorized release of PR #59 alone (gates in §8).

## 1. Exact tested revisions

| Item | SHA |
|---|---|
| `main` (PR #63 merged and deployed) | `a67afbd0d63c65af115137bba79bb8884df2c96e` |
| PR #59 HEAD | `3b99ed350c46f6e74183a940cd75fc718ff0ed30` (Draft, `mergeable=true`, 15 commits, 78 files; branched from `6a5e5c0`) |
| Rehearsal tree (`git merge --no-ff` of PR #59 onto `main`, local only) | **`5b97b184b2878dff227aa1f4e78cf51049ed23ae`** |
| Squash-equivalent tree (`git merge-tree --write-tree a67afbd 3b99ed3`) | `5b97b184…` (identical) |
| PR #60 / PR #62 HEADs at the time | `d8e61e2` (Draft, **based on PR #59's branch**) / `ecddd52` (Draft, base `main`) |

**Reproduce:** `git merge-tree --write-tree a67afbd0d63c65af115137bba79bb8884df2c96e 3b99ed350c46f6e74183a940cd75fc718ff0ed30` should print `5b97b184b2878dff227aa1f4e78cf51049ed23ae`.

## 2. Evidence classes

- **[R] Reproducible:** anyone can re-derive it from GitHub (source at the SHAs above, GitHub Actions logs) or from the artifacts in this evidence folder.
- **[O] Observed:** results I read from my own terminal during the rehearsal. **The full logs were not retained**; only the summary lines quoted here exist. Each [O] item lists the command to re-run it.

## 3. Merge rehearsal and scope

- **[R]** No conflicts.
- **[R]** Changed files (78):
  - **API (5):** `services/api/src/causes/causes.service.ts`, `services/api/src/causes/dto/save-preferences.dto.ts`, `tests/unit/causes/causes.service.spec.ts`, `tests/unit/causes/dto/save-preferences.dto.spec.ts` (new), `tests/unit/subscriptions/subscriptions-auth.contract.spec.ts` (new).
  - **Web (22):**
    - pages: `app/(billing)/pricing/page.tsx`, `app/(corporate)/{about,company,milestones}/content.tsx`, `app/LandingContent.tsx`, `app/page.tsx`, `app/causas/page.tsx`;
    - components and libraries: `components/{CauseSelector,Footer}.tsx`, `lib/api.ts`, `lib/i18n/{en,es}.ts`;
    - styling and fonts: `tailwind.config.ts`, new `app/fonts.ts` and `app/fonts/playfair-display.ttf`;
    - 7 specs.
  - **Docs (51):** `docs/reports/public-site-ecosystem-20261112/**` (reports, Checkpoint X evidence, screenshots).
- **[R]** Not touched: migrations, `package.json` or `pnpm-lock.yaml`, Dockerfiles, compose files, `.github/`, `infra/`, `services/mobile`, any Stripe-owning class, and `common/payments-activation.ts`.

## 4. Financial gate (mandatory)

| Check | Result | Class |
|---|---|---|
| `git grep -n "new Stripe(" -- services` on the rehearsal tree | One hit only: `services/api/src/common/payments-activation.ts:51` | [R] |
| Stripe-owning classes | `SubscriptionsService` (l.58), `GiftsService` (l.44) and `WebhooksController` (l.30) all use `createStripeClient(this.config)` | [R] |
| Other `STRIPE_SECRET_KEY` reads in `services/api/src` or `services/web` | None outside the gate file | [R] |
| `git diff --quiet a67afbd 5b97b184 -- services/api/src/{common,subscriptions,gifts} services/api/src/main.ts` | **Identical**: PR #59 changes no gate or payment file | [R] |
| PR #60 financial code (`CheckoutStatusService`, `checkout-status`) present? | **No.** (`common/trusted-proxy.ts` is Stage B-1, already on `main` via #61) | [R] |
| PR #63 gate suites `payments-activation.spec.ts` + `payments-activation.gate.spec.ts`, run on the rehearsal tree with Stripe mocked. With `PAYMENTS_ENABLED` absent, `false`, `TRUE`, `1` and similar, every checkout path, including **anonymous gift checkout over HTTP**, plus portal, cancel, resume, sync and webhooks, gets no Stripe client and makes no Stripe call | PASS (part of the 271/271 below) | [O] (suites are in the repo; re-run: `npx jest tests/unit/common/payments-activation`) |
| Production after the PR #63 deploy (2026-11-18 01:03 UTC): `POST /api/gifts/checkout` returns `400 {"error":"payments_not_configured"}`; `POST /api/webhooks/stripe` returns `400 Stripe is not configured` | As stated | [O] (public curl; re-runnable) |
| Browser: signed-in plan checkout with the API mocked to `400 payments_not_configured` stays on `/pricing` and shows "Could not start payment." | PASS (after correction, §5) | [R] `screenshots/pricing-payments-not-configured-en.png`, `browser-results-corrected-run.json` |

No real Stripe call or transaction was made anywhere.

## 5. Finding: X05 browser test was a false positive (corrected and re-run)

- **Defect:** in the committed Checkpoint X script (`docs/reports/public-site-ecosystem-20261112/checkpoint-x/pr59-browser.mjs.txt` at `3b99ed3`, line 257), X05 decides "payment error shown" with the regex `/(payment|pago)[^.]*\./i` on the whole page body. In Run 1 it matched the unrelated copy **"…payment supports Noetia Causes."** ([`browser-run1-original-script.txt`](browser-run1-original-script.txt)). The "no redirect" half of X05 was valid; the "error shown" half was **not** actually tested. The same weakness applies to Checkpoint X's earlier 37/37 claim for X05.
- **Correction (rehearsal only, not applied to PR #59):** require the exact `t.pricing.paymentError` text ([`x05-correction.patch`](x05-correction.patch)).
- **Run 2 with the corrected assertion:** X05 PASS, with `error="Could not start payment."`; suite **37/37** ([`browser-results-corrected-run.json`](browser-results-corrected-run.json)). The screenshot shows the red message: [`screenshots/pricing-payments-not-configured-en.png`](screenshots/pricing-payments-not-configured-en.png).
- **Follow-up (P2):** a docs-only fix to the committed script in PR #59 needs separate approval, because it would change PR #59's HEAD.

## 6. Test results

### 6.1 Executed in this mission (rehearsal tree `5b97b184`; `pnpm install --frozen-lockfile`, lockfile unchanged by #59)

| Check | Result | Class |
|---|---|---|
| API `tsc --noEmit` | PASS | [O] |
| API `nest build` | PASS | [O] |
| API ESLint `src/causes` | 0 errors, 2 warnings | [O] |
| API full suite (`jest --maxWorkers=2 --coverage`) | **75/75 suites, 1293/1293 tests.** Branch coverage **69.14%** (< 80% gate; `main` CI 69.08%) | [O] |
| API focused: PR #63 gate (2) + causes service + DTO + subscriptions auth contract | **5/5 suites, 271/271** | [O] |
| Web `tsc --noEmit` | PASS | [O] |
| Web `next lint` | 0 errors, 15 warnings | [O] |
| Web unit (`jest --maxWorkers=2 --coverage`) | **25/25 suites, 383/383.** Statements 73.03 / branches 72.76 / lines 71.61 / functions 52.32 (< 80% gate; at or above `main` CI's 72.8 / 72.44 / 71.61 / 51.74 on every metric) | [O] |
| Web production build (`next build`) | PASS; `/`, `/about`, `/company`, `/milestones`, `/causas`, `/pricing` built | [O] |
| Browser suite: Playwright 1.59.1, cached Chromium headless shell, `next start` on 127.0.0.1, every API call mocked, Stripe = local stub host, all other network blocked | Run 1: 37/37 (X05 false positive). **Run 2 (corrected): 37/37** | [R] transcript + JSON + 9 screenshots in this folder |
| Mobile | Not run (PR #59 changes no mobile file) | — |

**What the browser suite covers (all passed):**
- **Ecosystem pages:** landing in ES and EN at 1280 px and 375 px: 3 tiers, 2 marked "Coming Soon", 0 links into the premium tiers, 0 checkout links, 1 footer, 0 px horizontal overflow, correct `html lang`. The mobile menu opens and closes.
- **Content pages:** `/causas`, `/about`, `/company`, `/milestones` in ES and EN, desktop and mobile: 1 footer, no overflow, no two-cause or random-distribution wording.
- **Pricing, guest:** no redirect and no preference lookup on arrival. Choosing a plan goes to `/login?next=/pricing`. Choosing a token package also goes there, after one credential-less 401 call.
- **Pricing, signed in:**
  - **Saved cause:** straight to checkout; Bearer token sent; `{planId}` body unchanged.
  - **No saved cause:** a single-choice selector with 3 radios; saving one cause sends `{"cause1Id":…,"cause2Id":null,"randomDistribution":false}`, then checkout.
  - **Skip:** no preference write.
  - **Failed save:** an error is shown, the selection is kept, no checkout; retry succeeds.
  - **Preference lookup error:** an explicit notice, with no equal-split claim.
  - **Token package purchase:** Bearer token sent; `{packageId}` body unchanged.
- **Auth:** an expired token refreshes once; a refresh cookie with no access token signs in; a failed refresh goes to login.
- **Status:** an unknown subscription status shows a banner and blocks checkout; for an active subscriber, the current-plan button is disabled.
- **Payment boundary (X05):** covered in §5.

### 6.2 Earlier results (not re-run here)
- **Checkpoint X (2026-11-15/16)** on the old base: web 383/383, API 1064/1064, 16/16 Stripe-disabled proof (key-absent condition, now superseded by the PR #63 gate), browser 37/37 (X05 affected by §5). Source: `docs/reports/public-site-ecosystem-20261112/checkpoint-x-qualification.md` in PR #59.
- **Never run:** axe or Lighthouse accessibility tooling; the repository Playwright E2E suite (`tests/e2e/*`), which needs a backend and a CI runner that can install Chromium.

### 6.3 Known baseline CI failures (GitHub Actions) [R]
- **PR #59 run `43994211538` (head `3b99ed3`, old base):**
  - API: 1064/1064 pass, branches 68.88%.
  - Web: 383/383 pass, 73.03 / 72.76 / … coverage.
  - Mobile: 179/179 pass, 29.61 / 14.17 coverage.
  - E2E: `Playwright does not support chromium on ubuntu26.04-x64`.
- **`main` baseline (PR #62 run `43780254233`, PR #63 runs `44205729325` / `44207735119`):** the same coverage-only and E2E-runner failures.
- CI has **not** run on the combined tree: the PR's CI uses the old base.

### 6.4 New regressions
**None found.** Every test passes; coverage is at or above baseline; builds pass.

## 7. Causas (PO-053) [R] (source at `3b99ed3`)
- **One cause or none.** `SavePreferencesDto`: `cause2Id` must be absent or null (`@IsEmpty`), `randomDistribution` must be absent or `false` (`@Equals(false)`). `CausesService.savePreferences` rejects the same again, rejects unknown or inactive causes (`400 Unknown cause.`), and always writes `cause2Id=null, randomDistribution=false`.
- **No silent proceed.** `CauseSelector.handleSave` calls `onSave` only after a successful POST; on failure it shows an error and keeps the selection.
- **No accidental overwrite.** The selector opens only when `GET /causes/preferences` returns no row (`pricing/page.tsx` `routeByPreference`). Skip makes no API call. A preference lookup error shows a notice; "Continue" makes no preference write.
- **Copy** describes a commitment and allocation rules; nothing states a contribution has been paid out.

## 8. Remaining release gates

| Gate | Status |
|---|---|
| **G-X1** (revised now that #63 is live): `PAYMENTS_ENABLED` ABSENT/EMPTY/FALSE and `STRIPE_SECRET_KEY` ABSENT/EMPTY in the file, effective Compose config and running container; checks A–C of `docs/reports/payments-activation-gate/final-qualification.md` §2.2 on `main`; plus check D `LOG OK [payments] disabled`. Run immediately before and after the release | OPEN (blocking) |
| G-X2: PA acceptance of this qualification | OPEN |
| G-X3: PO and legal approval of the public copy (§9) | OPEN |
| G-X4: PO acceptance of the CI coverage and E2E runner limitations (§6.3) | OPEN |
| G-X5: release controls (independent PO instruction naming PR #59 and `3b99ed3`; idle CD; operator present; backups verified) | OPEN |
| G-X6: post-release acceptance (§11) | OPEN |
| G-X7: fail-closed `PAYMENTS_ENABLED` safeguard | **CLOSED: PR #63, deployed `a67afbd`** |
| S19 shared-network risk: the PO accepted it for PR #63 only; **a new decision is needed for PR #59** | OPEN |
| Financial gates (G-1, G-4, G-5, W-1, W-2/SG-PM, USD-1, D4, webhooks, gift recovery, Terms/legal, NEM-024, PR #60 integration including `CheckoutStatusService` gating) | CLOSED; not affected or qualified by PR #59 |

## 9. Public copy requiring PO (and legal) approval [R] (`services/web/lib/i18n/{en,es}.ts` at `3b99ed3`)

| Copy (EN; ES equivalent at the stated line) | Class | Ask |
|---|---|---|
| en:904 "Source-aware AI research across **up to three eligible books** you select per session" / es:901 | Future functionality | Approve the Noetia+ limit as public wording |
| en:912 "Advanced source-aware investigation across **up to ten eligible books** you select" / es:909 | Future functionality | Approve the NoetiaX limit |
| en:907, 915 "**Will require an active Noetia subscription.**" / es:904, 912 | Future prerequisite | Approve |
| en:917 "Noetia+ and NoetiaX are not available yet. These descriptions reflect their approved direction and may change. No dates or prices have been announced." / es:914 | Disclaimer | Approve together with the rows above |
| en:932, 954–955 "We commit 2.22% of every payment to Causas Noetia. You choose one cause… If you don't choose one, it is distributed equally among all three." / es:929, 951–952 | Approved policy (PO-053, 2.22%) in marketing wording | PO and legal confirm "We commit" |
| en:335, 391 "**14-day free trial.** Cancel anytime." and "Start free trial"; `$` prices; "Annual · 2 months free" (pricing page) | **Pre-existing on `main`**; conflicts with D1 (one trial per customer, implemented only in #60) and USD-1 | PO decides whether it may stay public until the financial release |

## 10. Risks and limitations

- **P0:** none in PR #59. It would become P0 only if `PAYMENTS_ENABLED=true` were set before the financial release (G-X1).
- **P1:** release gates G-X1, G-X3 and S19 (§8).
- **P2:**
  1. X05 false positive in committed evidence (§5); a docs-only fix needs approval.
  2. Legacy `user_cause_preferences` rows with `cause2Id` set or `randomDistribution=true` are kept and count as "saved" (checkout proceeds without the selector). No allocation code consumes them today; future allocation must apply PO-053. Count: `SELECT COUNT(*) FROM user_cause_preferences WHERE "cause2Id" IS NOT NULL OR "randomDistribution";`
  3. A guest clicking a token package makes one credential-less API call (401) before the login redirect. Harmless.
  4. Tabs left open across the deploy that save two causes or random get a 400 until reload.
  5. **[O] Visual:** `/pricing` keeps the previous light style (white background, blue primary buttons), while the landing and corporate pages use the dark Quiet Editorial style (`screenshots/pricing-*.png` vs `screenshots/landing-*.png`). It's consistent with PR #59's scope (pricing logic only), but it's a visible inconsistency.
  6. The cookie banner is fixed and overlaps content in full-page captures; this is the existing limitation.
  7. `tailwind.config.ts` changes, so the web image genuinely rebuilds. Expect the usual ~25 s `/api` and a few seconds of web unavailability during CD, as observed in the PR #63 deploy.
  8. **PR #60 is stacked on PR #59's branch.** `delete_branch_on_merge=false`, so a squash merge leaves #60 untouched. **Don't delete the branch by hand**, or GitHub retargets #60 to `main`.
- **Limitations:** CI has not run on the combined tree; the [O] logs were not retained; no accessibility tooling; no repository E2E; mobile not run.

## 11. Supervised release checklist (split supervision; PO keeps SSH)

**Pre-merge (PO, server, each command one line):**
- `git rev-parse HEAD` returns `a67afbd…`; `git status --porcelain` shows only the known backup-script mode changes and untracked files.
- `docker ps`: everything healthy, including staging, AutoGuildX and Traefik. Record the container baseline (ID, StartedAt, health).
- Checks A–C for both variables pass; check D returns `LOG OK [payments] disabled`.
- Backups present and offsite copies verified; no staging or infrastructure deploy running.
- S19 decision recorded; quiet, attended window.

**Merge (Claude, after an explicit PO instruction):**
1. Re-verify PR HEAD `3b99ed3…`, `main` `a67afbd…` and an idle CD queue.
2. `gh pr ready 59`.
3. `gh api -X PUT repos/Carloskfe/noetia/pulls/59/merge -f merge_method=squash -f sha=3b99ed350c46f6e74183a940cd75fc718ff0ed30`. Don't delete the branch.
4. Confirm the merged tree equals `5b97b184…`.
5. Watch CD to completion with a health poll.

**After the deploy:**
- **Claude (public):**
  - `/api/health` 200;
  - `/`, `/about`, `/company`, `/milestones`, `/causas`, `/pricing` return 200;
  - `GET /api/causes` lists 3 causes;
  - gift checkout returns `400 payments_not_configured`;
  - webhook returns 400;
  - unauthenticated `POST /api/causes/preferences` returns 401.
- **PO (server and browser):**
  - Deployed HEAD equals the merge SHA; backup-script changes and untracked files preserved.
  - Check D still disabled; checks A–C unchanged.
  - Only `noetia-*` application containers changed; Traefik, staging and AutoGuildX unchanged.
  - CD log shows `No migrations are pending`.
  - Browser checks:
    - landing and Causas in ES and EN, desktop and mobile;
    - `/pricing` as a guest goes to login;
    - signed in, a plan goes through the selector or straight on and ends at "Could not start payment." with no Stripe redirect;
    - saving one cause works;
    - login, library and opening a book in the reader work.

**Rollback** (separate PO instruction only):
- Revert the PR #59 squash commit on `main` (a new CD deploy). That keeps PR #63's gate, so no key re-check is needed, and no migrations are involved.
- Re-check S19 exposure and confirm CD is idle first.
- Preferences saved under the new rules remain valid under the old code.

## 12. Evidence location

| Evidence | Where | Durability |
|---|---|---|
| This report, Run 1 transcript, corrected-run JSON, X05 patch, 9 screenshots (all mock data; the only "tokens" are the fake `tok-valid` strings) | Branch `evidence/pr59-integration-20261118`, folder `pr59-integration-qualification/` (orphan branch; contains no code; triggers no workflow) | **Durable** |
| Same report | PR #59 conversation comment | Durable |
| Full jest, tsc, lint and build console logs; Run 1 `browser-results.json` (overwritten by Run 2); rehearsal worktree (removed) | Not retained | **Unavailable**: re-run with the commands in §6.1 |
| CI logs | GitHub Actions runs listed in §6.3 | Durable while GitHub retains the logs |
