# PR #59: final integrated release qualification (2026-11-18)

**Mission:** *NOETIA — PR #59 Final Integrated Release Qualification* (PO: final qualification only).
**Scope of this run:** verification only. No application code, documentation, configuration, branch or pull request was modified. The single exception is this evidence folder, on the established evidence branch, which is separate from PR #59. Nothing was merged or deployed. No production secret was accessed.
**Recommendation:** **CONDITIONAL GO** (§8).

## 1. Revisions

| Item | SHA |
|---|---|
| PR #59 locked candidate HEAD | `eefe0fb85fd1253f8937ee2bb72401b977fdadda` (unchanged by this run) |
| `main` / production baseline | `a67afbd0d63c65af115137bba79bb8884df2c96e` |
| **Integrated merge tree** | **`6c6d8fea077f032ba93567d2ac6f94798411a6a7`** |

How the merge tree was produced:
- `git merge-tree --write-tree a67afbd eefe0fb` exits 0, with no conflicts.
- A cross-check gives the identical tree: a temporary worktree at `a67afbd`, then `git merge --no-commit --no-ff eefe0fb`, then `git write-tree`. The merge was never committed; the worktree HEAD stayed at `a67afbd`.

Full record: [`merge-rehearsal.txt`](merge-rehearsal.txt).

## 2. Integration and isolation

- **Changes vs `main`:** 89 files, +5092 / −579. 55 are `docs/reports/**`. The other 34 are all PR #59 scope (listed in `merge-rehearsal.txt`):
  - public-site web files;
  - Causas web, plus the API `causes` service and DTO;
  - `/pricing`, `/gift`, `lib/api.ts`, `lib/purchase-availability.ts`;
  - tests.
- **No unintended changes.** None of the following appears outside `docs/reports`: migrations, Stripe, `payments-activation`, webhooks, entitlement, `docker-compose*`, `infra/`, `.github/`, nginx/Traefik, `terms-of-service`, `.env*`, API `main.ts`, `gifts/`, `trusted-proxy`, mobile, worker.
- **PR #63** (`a67afbd`): all 13 files are **byte-identical to `main`** in the merge tree. The only `new Stripe(` in `services/` is `services/api/src/common/payments-activation.ts:51`, inside the fail-closed gate.
- **Legal texts:** `services/web/lib/legal/*` (Terms, Privacy, Cookies) are identical to `main`.
- **Other PRs:** none is included; no head is an ancestor of `eefe0fb`.
  - PR #60 `d8e61e2`;
  - PR #62 `ecddd52`;
  - PR #22 `d254eea`.

## 3. Build and test results (merge tree `6c6d8fea`)

Fresh `pnpm install --frozen-lockfile` (web + api). **Environmental note:** pnpm 10 skipped the native build of `bcrypt@5.1.1`, so the identical `napi-v3` binding was copied from an existing local install (`logs/api-env-note.txt`). Without it, the one suite that imports bcrypt cannot load. This is not a code issue.

| Check | Result | Log |
|---|---|---|
| API `tsc --noEmit` | PASS | `logs/api-typecheck.log` |
| API unit, full (`jest --maxWorkers=2 --coverage`) | **75/75 suites, 1293/1293 tests PASS.** Exit 1 **only** because global branch coverage is 69.14% against an 80% gate (pre-existing; `main` 68.83) | `logs/api-jest.log` |
| API focused (common incl. PR #63 gate, causes, subscriptions, gifts) | **13/13 suites, 480/480** | `logs/api-jest-focused.log` |
| API PR #63 gate specs (`payments-activation.spec`, `.gate.spec`) | **2/2 suites, 229/229**: only exactly `"true"` enables; every other value, missing key, placeholder, test or live key while disabled → no Stripe client | `logs/api-jest-payments-gate.log` |
| API ESLint `src/causes` | 0 errors, 2 warnings | `logs/api-lint-causes.log` |
| Web `tsc --noEmit` | PASS | `logs/web-typecheck.log` |
| Web `next lint` | **0 errors**, 15 warnings (pre-existing, unrelated files; same count as earlier runs) | `logs/web-lint.log` |
| Web unit, full (`jest --maxWorkers=2 --coverage`) | **28/28 suites, 411/411 PASS.** Exit 1 **only** for the global coverage gate: 73.43 / 72.76 / 53.17 / 72.09 vs 80. Pre-existing; `main` 72.8 / 72.44 / 51.74 / 71.61, so PR #59 is higher | `logs/web-jest.log` |
| Web production build (`next build`) | **PASS**: 45 static pages. The routes manifest has `/causas` and **no** `/causas/terms`; `grep causas/terms` over `.next/server` and `.next/static` finds 0 matches | `logs/web-build.log` |

## 4. Browser verification

**Setup:**
- the real production build (`next start` on `127.0.0.1:3459`) of the merge tree;
- Playwright 1.59.1 with the locally cached Chromium headless shell (build 1228);
- every API call mocked; all other network aborted; axe-core 4.11.3 injected from a local file.

| Suite | Result | Evidence |
|---|---|---|
| Checkpoint X harness, unchanged (`docs/reports/public-site-ecosystem-20261112/checkpoint-x/pr59-browser.mjs.txt`, default fail-closed mode) | **33/33 PASS** | `checkpoint-x-harness/` |
| X08 final-qualification suite ([`x08/pr59-final-x08.mjs`](x08/pr59-final-x08.mjs)) | **39/39 PASS** | `x08/x08-run.txt`, `x08/x08-results.json`, screenshots |

**What X08 checks.** Spanish and English, at desktop 1280×900 and mobile 375×812, unless noted:
- **Homepage, Causas section:**
  - present and visible: section 4 of 6 `h2`s, after the ecosystem and Clubs;
  - badge "Programa en preparación" / "Planned program";
  - "2,22% de los ingresos netos elegibles, después de las comisiones de procesamiento de pago" / "2.22% of eligible net receipts, after payment-processing fees";
  - partnerships pending; the PO-053 rule; the three causes;
  - **no** settlement or refund wording.
- **Homepage, Noetia+ / NoetiaX:**
  - Próximamente / Coming Soon;
  - 3 / 10 eligible books per session;
  - "Requerirá / Will require an active Noetia subscription";
  - "pueden cambiar / may change";
  - 0 links or buttons on the premium cards.
- **`/causas`:**
  - the three causes, the badge and the net-receipts wording;
  - independent charitable organizations;
  - the disclosure "no agreement has been signed and no contribution has been made";
  - 0 terms links; no "every payment / total payment" wording.
- **`/causas/terms`:** **HTTP 404**, with no draft text. Across `/`, `/causas`, `/company`, `/about`, `/milestones`, `/pricing`, `/gift` and `/login` (footer included), there are **0 links** to it.
- **`/company`:** no 45 / 36 / 9 / 2.22 / 7.78 percentages and no "Distribución de ingresos / Revenue distribution". The qualitative business text, "What we offer authors" and the Causas social-impact line are present.
- **`/pricing` and `/gift`:**
  - the unavailable notice;
  - every purchase control and the gift submit are disabled, labelled "Aún no disponible / Not available yet";
  - the Causas line uses the planned / net wording.
- **Login → library → reader:**
  - a wrong password shows the error and stays on `/login`;
  - the correct password leads to `/library` with the token saved, and the book is listed;
  - the reader loads the book with Bearer auth and renders the title and phrases, with no uncaught page errors;
  - a guest opening the reader goes to `/login?next=/reader/<id>`.
- **Layout:** no horizontal overflow on any checked page or viewport; no uncaught page errors on the public pages.

**Accessibility (axe, WCAG 2 A/AA, desktop):**
- Homepage ES/EN: **0 violations**.
- `/causas` ES/EN: **1 serious `color-contrast` node**, the existing "Write to causas@noetia.app" button (white text on `bg-emerald-500`). It is **pre-existing**: the identical class is on `main` (`a67afbd`, `app/causas/page.tsx:226`), introduced in `0e8364a` (2026-05-13). It is **not a PR #59 regression**. Recorded as a follow-up.

**Screenshots** (`x08/`):
- `home-{es,en}-{desktop,mobile}.png` and `home-causas-section-*.png`;
- `causas-*`, `company-*`, `pricing-*`, `gift-*`, `library-*`, `reader-*`;
- `causas-terms-404.png`.
The Checkpoint X set is in `checkpoint-x-harness/`.

**Limits:**
- The library and reader run against mocked API data. The local dev API requires auth for book content, and no local account or password was created or used. This rules out web-side regressions; backend reading paths are unchanged (no API change outside `causes`).
- No Lighthouse run.
- Repository Playwright E2E (`tests/e2e`) needs a live backend, and its CI job cannot install Chromium on `ubuntu-26.04` runners.

## 5. Payment safeguards

| Safeguard | Verified |
|---|---|
| Web `PURCHASES_AVAILABLE` | `export const PURCHASES_AVAILABLE: boolean = false;` in the merge tree. Browser X07 and X08 confirm that every purchase control is disabled and no purchase call can start |
| API gate (PR #63) | Files byte-identical to `main`; 229/229 gate tests. Stripe is constructed only when `PAYMENTS_ENABLED` is exactly `"true"` **and** a real key is present; otherwise `null` (fail closed) |
| Production `PAYMENTS_ENABLED` value | **Not verified here.** No production server or secret access, by design. The PO or server operator confirms it at deploy |

## 6. Release isolation

There are no changes to any of the following:
- Stripe configuration or payment activation;
- subscription entitlement calculations;
- database migrations;
- infrastructure or Docker networking;
- PR #60 financial-lifecycle work;
- PR #62 network-isolation work;
- the legal Terms of Service.

**Known contradiction, not resolved by this release.** The published Terms of Service §3 (`services/web/lib/legal/terms-of-service.ts` L42–44 ES, L139–141 EN) still says "2.22% of every payment is automatically allocated to … causes selected by Noetia". That contradicts the approved Causas policy (C-1, C-2, C-5, C-6, C-7) and the new site copy. Reconciling it is a **hard prerequisite before commercial / payment activation**, and needs a separate legal-gated PR coordinated with Draft PR #22. See `docs/reports/public-site-ecosystem-20261112/causas-alignment-20261118/terms-of-service-legal-gate-spec.md` on PR #59.

## 7. Known CI exceptions (PR #59 CI run `44297680206` on `eefe0fb`)

- **Coverage gates (pre-existing; `main` has never met them):**
  - web unit: tests 28/28 pass; coverage 73.43%;
  - api unit: tests 1293/1293 pass; branch coverage 69.14%;
  - mobile unit: tests 179/179 pass; coverage 29.61%.
- **E2E:** fails at browser installation ("Playwright does not support chromium on ubuntu26.04-x64") before any test runs.
- **Passing:** lint, typecheck and build for web, api and worker; worker and image-gen unit tests.
- **Not yet run in CI:** PR #59's CI runs on the branch (base `6a5e5c0`), not on the merge tree. Locally, the merge tree reproduces the same pass/fail profile (§3).

## 8. Recommendation and supervised deployment

**CONDITIONAL GO** for the supervised, information-only production release of PR #59, subject to:
1. Independent PA acceptance of this qualification.
2. PO acceptance of the known CI exceptions (§7) and of the S19 temporary network risk. Both are PO decisions per the mission.
3. Production `PAYMENTS_ENABLED` remains unset or not exactly `true`, confirmed by the PO or server operator, and `PURCHASES_AVAILABLE` stays `false`.
4. The Terms of Service contradiction is accepted as a **hard gate before payment activation**, not a condition of this release.

**Supervised deployment steps.** Merging to `main` deploys production.
1. Check `gh run list` for an in-flight CD run; never merge mid-deploy.
2. Confirm PR #59 is still at `eefe0fb`, `main` is still `a67afbd`, and the merge result is tree `6c6d8fea`. If `main` has moved, re-qualify.
3. Merge (PO-authorized), then watch the CD run to completion. Expect a ~25 s `/api` gap.
4. Server checks (PO / operator): `docker ps` all healthy; last migrations unchanged (PR #59 adds none); the API boot line shows payments **disabled**.

**Post-deployment public probes:**
- `/` → 200, Causas section with "Programa en preparación" / net-receipts wording, Noetia+/NoetiaX "Próximamente";
- `/causas` → 200, three causes and the disclosure, no terms link;
- `/causas/terms` → **404**;
- `/company` → no percentage breakdown;
- `/pricing`, `/gift` → "not available yet" and disabled controls;
- `/login` renders; `/api/health` → `{"status":"ok"}`;
- `/legal/terms` unchanged (expected; §6).

**Rollback:** revert the merge commit on `main`. It is code-only: no migration, configuration or data change.
