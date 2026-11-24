# IR-2L — Local-only combined integration validation

**Status:** VALIDATION COMPLETE. No STOP condition triggered. **Awaiting independent Product Architecture review.**
**Date:** 2026-11-24 · **Authorization:** PO execution authorization IR-2L (validation only), following PA acceptance of IR-1 (PR #89, `c450a6e`).
**Nature:** documentation only. This report contains no application code, and the integration candidate was **never committed, pushed or merged**.

Evidence labels: **[V]** verified by command output in this session · **[P]** proposal · **[A]** assumption or inference.

---

## 1. Verified baseline and source commits

All heads were re-read from GitHub immediately before assembly. Every one matches the authorization table, so no source changed [V].

| PR | Branch | Base | HEAD (GitHub) | Matches authorization | State |
|---|---|---|---|---|---|
| #78 | `feat/nem-025-checkpoint-a` | `main` | `81143790e6` | yes | Draft, open |
| #80 | `feat/nem-025-checkpoint-b1a` | #78 | `28aa668082` | yes | Draft, open |
| #81 | `feat/nem-025-checkpoint-b1b` | #78 | `c4106a2b02` | yes | Draft, open |
| #83 | `feat/nem-025-checkpoint-b2a1` | #78 | `0f14735961` | yes | Draft, open |
| #85 | `fix/sp-1-i1-push-token-isolation` | `main` | `82c3d2e0cc` | yes | Draft, open |
| #86 | `feat/nem-025-b2a2a-api` | #83 | `6fb81cbc4d` | yes | Draft, open |
| #87 | `feat/nem-025-b2a2a-web` | #80 | `fd5f819a76` | yes | Draft, open |
| #88 | `feat/nem-025-b2a2a-mobile` | #81 | `0aaf975158` | yes | Draft, open |

`main` = `8f2f294378a8cdc7472f2849ce533981605fcb01` (matches) [V].

**Ancestry check [V]:** all eight heads contain `main` `8f2f294`. #78 is an ancestor of #80, #81 and #83; #83 ⊂ #86, #80 ⊂ #87, #81 ⊂ #88. This matches the IR-1 graph, so the three tips #86, #87 and #88 plus #85 carry every approved change with no duplicated commits.

## 2. Local assembly method

**Environment checks [V]:**
- 7.2 GiB RAM (about 4.7 GiB available) and 37 GB free disk.
- The primary checkout's existing changes (`.claude/settings.local.json`, untracked `nem024e-q11`) were left untouched.
- All eight source worktrees were clean before and after the run.

**Isolation [V]:**
- A new detached worktree `../Noetia-ir2l` was created at `main` `8f2f294`, with no branch and no ref.
- The candidate tree was loaded into it with `git read-tree -u --reset`.
- **No commit object was created**: no merge commit, no dangling commit and no integration ref. No source branch was modified, rebased or pushed.
- Assembly used tree-level three-way merges only. Git 2.53's `merge-tree --merge-base` accepts trees:

```
T1 = merge-tree --write-tree --merge-base=8114379 6fb81cb fd5f819   # #86 ⊕ #87 over #78
T2 = merge-tree --write-tree --merge-base=8114379 T1      0aaf975   # ⊕ #88 over #78
T3 = merge-tree --write-tree --merge-base=8f2f294 T2      82c3d2e   # ⊕ #85 over main
```

**Order independence [V]:** the reverse order (#85⊕#86 over `main`, then #88, then #87 over #78) produced the **same tree**.

**Dependencies:** no packages were installed and no lockfile changed. The existing `node_modules` were reused through untracked symlinks: API and mobile from `../Noetia-nem025a`, web from `../Noetia-b1a`, worker from the primary checkout. These are the same installs used for the source-PR evidence. The candidate changes no `package.json` or lockfile relative to `main` [V].

## 3. Candidate tree identity

**Tree `c954941d41f613425f1d273fc501b170b5101490`** [V]
- It equals the tree of IR-1's in-memory N3, so it is reproducible from the SHAs above.
- It is 150 files from `main` (+15,668 / −1,743).
- It contains no migrations, workflows, Docker, infrastructure, `.env`, dependency or lockfile changes [V].

**Provenance [V]:** 149 of the 150 changed paths are byte-identical to the same path in one of the four source heads. **Exactly one file is a genuine combination**: `services/api/src/users/users.service.ts`.
- Against #86, the candidate adds only #85's `Logger` field and the best-effort push-token cleanup block.
- Against #85, it adds only #86's `accountEmailLocale` import and its call.

## 4. Exact included PRs

**Included:** #78, #80, #81, #83, #86, #87 and #88 (NEM-025 Checkpoint A, B1-A, B1-B, B2-A1 and B2-A2a), plus #85 (SP-1-I1).

**Excluded as instructed:** #60, #64, #66, #67, #69, #70 and #72. As a result, no GitHub-hosted E2E is part of this validation, and **Playwright was not run**.

## 5. Conflict results

- **Textual:** none. All three tree merges returned rc=0 in both orders [V].
- **Semantic, `users.service.ts`:** the combination keeps the order #85 established and #86's farewell normalization unchanged (see §6) [V].
- **Semantic, elsewhere:** none found. The API, web and mobile test totals equal the sum of the source PRs exactly (§8–§10). No previously passing source-PR test fails [V].

## 6. Combined account-deletion sequence

**Code on the candidate [V]:**
1. `findOneBy`; an unknown user returns.
2. Six dependent-row deletes in their original order: `user_books`, `token_ledger`, `user_cause_preferences`, `courtesy_token_quotas`, `subscriptions`, `waitlist_entries` (by email).
3. `repo.delete(userId)`.
4. Best-effort push-token cleanup: `DELETE FROM "push_tokens" WHERE "userId" = $1`, in try/catch, with a static warning only.
5. The farewell email if the user has an email, in `accountEmailLocale(user.uiLanguage)`; send failures are swallowed.

| # | Requirement | Result | Evidence |
|---|---|---|---|
| 1 | Dependent-row cleanup order preserved | PASS [V] | `users.delete-order.golden-master` (2 snapshots, captured on unchanged `main`) |
| 2 | User deletion occurs | PASS [V] | same; `users.service.spec` |
| 3 | Push cleanup afterwards, best-effort | PASS [V] | delete-order test 1 (cleanup at index after `repo.delete`, exactly once); `users.delete-push-cleanup` test 9 |
| 4 | Farewell uses the normalized locale | PASS [V] | `account-email.golden-master` N-1 block: farewell for stored `pt`, `EN`, `fr`, `""` and `fr-CA` gives a Spanish body with `lang="es"`. These run through the **combined** `deleteAccount`, so the cleanup query executes in the same call |
| 5 | Push-cleanup failure does not prevent the farewell | PASS [V] | `users.delete-push-cleanup` test 10 |
| 6 | Earlier deletion failures keep their semantics | PASS [V] | tests 11 and 11b: rejects, no user delete, no cleanup, no email |
| 7 | Deleted accounts cannot trigger Expo submissions | PASS [V] | `push.single-owner` tests 7 and 7b (orphaned registrations → zero submissions; gift-claim path) |
| 8 | Single-owner push registration | PASS [V] | `push.single-owner` tests 1–6, including 40 interleaved rounds and the control without the lock |
| 9 | Push-failure logging leaks no identifiers | PASS [V] | `push.submission-log-redaction` (5 tests); `push.single-owner` test 15 |

**Coverage gap (reported, not fixed).** No in-repo test asserts, in one scenario, the combination of:
- an **invalid stored language**,
- a **failing push cleanup**, and
- a farewell that still follows in canonical Spanish.

The order tests use valid `en`/`es`, where normalization is the identity. The N-1 tests use a succeeding cleanup.

To close the gap without changing the repository, an **out-of-tree probe** was run against the built candidate (`dist/`). It lived in a scratch directory, not in the repo, and is not a test addition. Results [V]:

```
"en"   pushFails=false  → …waitlist_entries > repo.delete > push-cleanup > farewell["reader@example.com","Reader","en"]
"en"   pushFails=true   → … > repo.delete > push-cleanup > warn(static) > farewell[…,"Reader","en"]
"pt"   pushFails=true   → … > repo.delete > push-cleanup > warn(static) > farewell[…,"Lector","es"]
"fr-CA" pushFails=true, FR_CA_ENABLED=true → … > push-cleanup > warn(static) > farewell[…,"Lector","es"]
"EN"   pushFails=false  → … > push-cleanup > farewell[…,"Lector","es"]
undefined pushFails=true → … > push-cleanup > warn(static) > farewell[…,"Lector","es"]
""     pushFails=false, FR_CA_ENABLED=true → … > push-cleanup > farewell[…,"Lector","es"]
```

The injected cleanup error message contained a push token, a user ID and an email. **None reached the log**: the warning is the static string `account deletion: push-token cleanup failed (registrations left inert)`.

**Smallest proposed follow-up [P], not implemented:** add one `it.each(['pt', 'fr-CA', undefined])` case to `services/api/tests/unit/users/users.delete-push-cleanup.spec.ts`. With the cleanup query rejecting, it would assert:
- `order.slice(-2)` equals `[PUSH_CLEANUP, 'sendFarewell']`;
- `sendFarewell` is called with `('gone@example.com', 'Ana', 'es')`.

That is about 10 test lines and no product change. It needs separate authorization.

## 7. Complete golden-master results

**Stored snapshot files compared with their accepted source commits (blob hashes) [V]:**

| Snapshot file | Count | Identical to |
|---|---|---|
| `api/tests/unit/email/__snapshots__/email.golden-master.spec.ts.snap` (B2-A1) | 46 | #83 `0f14735` and #86 `6fb81cb` |
| `api/tests/unit/auth/__snapshots__/account-email.golden-master.spec.ts.snap` (B2-A2a) | 12 | #86 `6fb81cb` |
| `api/tests/unit/push/__snapshots__/push.golden-master.spec.ts.snap` (SP-1-I1) | 16 | #85 `82c3d2e` |
| `api/tests/unit/users/__snapshots__/users.delete-order.golden-master.spec.ts.snap` (SP-1-I1) | 2 | #85 `82c3d2e` |
| **Required total** | **76** | all byte-identical |
| `web/tests/unit/golden-master/__snapshots__/b1a-web.spec.tsx.snap` (B1-A, additional) | 20 | #80 and #87 |
| `mobile/tests/unit/golden-master/__snapshots__/b1b-mobile.spec.tsx.snap` (B1-B, additional) | 17 | #81 and #88 |

**Execution on the candidate [V]:**
- All runs used `jest --ci`, so missing snapshots fail instead of being written. `-u` was never used.
- The four API golden-master suites: **93 tests, 76/76 snapshots passed**, none obsolete or written.
- Full-suite runs: web 20/20 and mobile 17/17 snapshots passed.
- After all runs, the worktree had **zero changes** against the candidate tree (`git diff` empty).

**Intentional corrections preserved:** the B2-A2a N-1 block, an explicit expectation edit documented in #86, passes unchanged.

## 8. API test results

**Full unit suite:** `jest --ci --coverage --maxWorkers=2`, 37 s [V].
- **92/92 suites, 1,615/1,615 tests, 76/76 snapshots.**
- Arithmetic check: `main` 1,293, plus #85's 73 = 1,366, plus NEM-025's 249 = 1,542 at #86. Combined: 1,293 + 73 + 249 = **1,615** exactly. No test was lost or shadowed.

**Targeted re-run (verbose)** of `auth`, `users`, `push` and `email`: 27 suites, 421 tests, all passed [V].

| Required check | Result | Evidence (test names abridged) |
|---|---|---|
| Spanish local registration | PASS | `register-locale` 1 (es UI) |
| English local registration | PASS | `register-locale` 2; account-email "registration persists the client language and confirms in it" |
| Omitted language → Spanish | PASS | `register-locale` 3; golden master `register/omitted` |
| `fr-CA` rejected, gate off | PASS | `register-locale` 5; `register.dto.spec` |
| `fr-CA` rejected, `FR_CA_ENABLED=true` | PASS | 5, 5b (400 before lookup, nothing stored, no email), 5c (omitted still Spanish); no enumeration signal |
| Locale persistence | PASS | `register-locale` 6 (`GET /users/me` reports the stored value) |
| Confirmation language | PASS | golden master `register/*`; `register-locale` 1–3 |
| Resend-confirmation language | PASS | golden master `resend/es`, `resend/en`; N-1 block |
| Password-reset language | PASS | golden master `password-reset/*`; N-1 block |
| Farewell language | PASS | golden master `farewell/*`, `farewell/no-name/*`; N-1 block; §6 probe |
| Invalid stored-language normalization | PASS | N-1 block, 15 cases: `pt`, `EN`, `fr`, `""`, `fr-CA` × three emails |
| ES/EN email golden masters | PASS | 46 + 12 snapshots byte-identical |
| Auth and OAuth non-interference | PASS | `register-locale` 12 (OAuth creation unchanged, method arities unchanged); `auth.service.spec` Google, Facebook and Apple cases. No OAuth source file is modified [V] |
| Gift/subscription non-interference | PASS | No gift, subscription, payment, Stripe, checkout or webhook file is in the candidate diff [V]. The `gifts`, `subscriptions` and `webhooks` suites pass unchanged within the 1,615. The push gift-claim path is covered by `push.single-owner` 7b |

## 9. Web test results

**Full suite** (`--coverage`): **37/37 suites, 624/624 tests, 20/20 snapshots** in 15 s [V]. This is identical to #87's report (624), which includes B1-A.

| Required check | Result | Evidence |
|---|---|---|
| Registration sends the interface language | PASS | `register-page.spec`: sends the active language `es` / `en` |
| ES and EN transmitted | PASS | `register-request.spec`: es UI and en UI → POST carries `uiLanguage` |
| `fr-CA` excluded | PASS | "never sends fr-CA from registration, even with the web French gate on"; "fr-CA UI → no uiLanguage is sent" |
| OAuth unchanged | PASS | "OAuth entry points are rendered unchanged (SocialAuthButtons, no props)". The candidate's only OAuth-adjacent web changes (`(social)/social/page.tsx`, `auth/callback/page.tsx`) are B1-A copy-to-dictionary edits, byte-identical to #80 [V] |
| Language provider preserved | PASS | `lib/i18n/index.spec.tsx`, `locales.spec.ts`, B1-A golden master |
| i18n parity | PASS | `i18n.spec.ts`; `pages.spec.tsx` structural parity es/en/fr-CA |

## 10. Mobile test results

**Full suite** (`--coverage`): **33/33 suites, 270/270 tests, 17/17 snapshots** [V]. This is identical to #88's report (270), which includes B1-B. The coverage gate fails; see §12.

| Required check | Result | Evidence |
|---|---|---|
| Registration submits the supported locale | PASS | `RegisterScreen.locale.spec`: es / en; `register-request.spec` |
| `fr-CA` not sent | PASS | "never sends fr-CA from registration, even with the app French gate on" |
| Compatible with an older API | PASS [V code] / [A runtime] | The request adds one optional field. `main`'s API uses `ValidationPipe({ whitelist: true, transform: true })` **without** `forbidNonWhitelisted`, and `RegisterDto` on `main` has no `uiLanguage`, so an older API strips the field and registers in Spanish. This is verified from code; no older API was run. |
| OAuth unchanged | PASS | "OAuth entry point is rendered unchanged and is not called by local registration". `SocialAuthButtons.tsx` differs from `main` only by B1-B error-string dictionary keys, byte-identical to #81 [V] |
| Language-provider behaviour | PASS | `i18n/index.spec.ts`, `locales.spec.ts`, `fr-ca.spec.ts`, `b1b-keys.spec.ts` |
| B1-B tests and golden master | PASS | `golden-master/b1b-mobile.spec.tsx` (17 snapshots) |

No mobile build, OTA, native configuration change, renderer or dependency was involved.

## 11. Worker test results

The worker package is **unchanged** relative to `main` [V].
- Unit tests: 2/2 suites, 8/8 tests; coverage 100 / 100 / 100 / 100 (gate passes).
- Typecheck: passes.
- Lint: 0 errors, 3 warnings.
- Build (`tsc`): passes.

## 12. Coverage measurements versus thresholds

All runs used existing Jest configuration and the 80% global thresholds; nothing was changed [V]. Coverage output went to a scratch directory (`--coverageDirectory` only).

| Package | Statements | Branches | Functions | Lines | 80% gate | `main` (CI, branches) | Source-PR reference |
|---|---|---|---|---|---|---|---|
| API | 91.83 (2193/2388) | **80.02 (757/946)** | 90.52 (344/380) | 93.27 (1900/2037) | **PASS**, Jest rc=0 | 69.14 (fail) | #86 78.98, #85 70.09 |
| Web | 86.75 | 83.01 (303/365) | 83.39 | 87.03 | **PASS** | 72.76 (fail) | #87 83.01 |
| Mobile | 46.26 | 38.38 (266/693) | 32.64 | 49.24 | **FAIL** (all four) | 14.17 (fail) | #88 38.38 |
| Worker | 100 | 100 (0/0) | 100 | 100 | PASS | pass | unchanged |

**API margin is zero.** 80% of 946 branches is 756.8, so 757 covered branches are required and 757 are covered. Any change that adds one uncovered branch to `*.service.ts` or `*.provider.ts`, or removes one covered branch, fails the gate.
- Local and CI figures have agreed before: #85 measured 70.09 locally and 70.09 in CI run `45373240653` [V].
- The candidate was **not** run in GitHub CI, so the CI value is **unverified** [A].

The passing API figure is a measurement, not an inference from test counts.

## 13. Typecheck, lint and build results

| Package | Typecheck | Lint | Build | Matches baseline |
|---|---|---|---|---|
| API | pass (`tsc --noEmit`, 0 lines) | 0 errors / **253** warnings | pass (`nest build`) | yes: #85 reported 253 (one pre-existing `any` removed), #86 reported 254 because it lacks #85 |
| Web | pass | 0 errors / 15 warnings (`next lint`) | pass (`next build`, "Compiled successfully"; local fonts only, no network) | yes: #87 and B1-A reported 15 |
| Mobile | pass | no lint script in the package (no other quality checks available) | n/a (no build; EAS excluded) | yes |
| Worker | pass | 0 errors / 3 warnings | pass | unchanged package |

## 14. Existing versus introduced failures

| Failure | Classification |
|---|---|
| Mobile 80% coverage gate (38.38 branches) | **Pre-existing**: `main` 14.17 in CI; improved, not caused, by B1-B and B2-A2a |
| API coverage gate | **No longer failing** (80.02); it fails on `main` (69.14). The margin is zero (§12) |
| Web coverage gate | **No longer failing** (83.01); it fails on `main` (72.76) |
| GitHub E2E (Playwright install on Ubuntu 26.04; default `baseURL` = production) | **Pre-existing / environmental**; excluded from IR-2L; #64 not included |
| Lint warnings (API 253, web 15, worker 3) | **Pre-existing**; no errors |

**Integration-induced failures: none.** **Unverified:** the GitHub-hosted CI value of each gate on this exact tree.

## 15. Security and OAuth non-interference findings

- **French stays inert [V]:**
  - `FR_CA_TRANSACTIONAL_READY = false` in `email/locale.ts`.
  - The API, web and mobile gates enable only on the exact string `'true'`.
  - Registration rejects `fr-CA` with the gate on or off.
  - The stored `fr-CA` value gets Spanish emails and push payloads with the gate on.
  - Neither flag appears in `docker-compose*.yml` or `.env.example`.
- **No identifier leakage [V]:**
  - Push submission failures log a static constant.
  - Ownership-reassignment and cleanup logs contain no token, user ID or email; the redaction tests and the §6 probe confirm this.
- **OAuth [V]:**
  - No OAuth backend logic changed.
  - The OAuth user-creation payload and method arities are pinned by tests.
  - The client-side OAuth files differ only by i18n string extraction, byte-identical to accepted B1 PRs.
- **Commerce [V]:** no payment, Stripe, subscription, gift or webhook source is in the candidate. The payment gate (`PAYMENTS_ENABLED`) is untouched.
- **No real external calls [V]:**
  - Nodemailer and the Expo client are mocked in every suite.
  - The probe used in-memory fakes.
  - No SMTP or Expo endpoint was contacted.

## 16. Remaining CI and release blockers

1. **API gate margin is zero**: a PA decision. Options: (a) accept as measured; (b) a narrowly scoped test addition for headroom (for example the §6 follow-up, or #66's EmailService spec), with no threshold change.
2. **Mobile coverage gate** fails (pre-existing). It needs a recorded PA/PO decision; #69, #70 and #72 are separate decisions.
3. **#64 not accepted.** CI E2E would still try to load production if the browser install ever succeeded. No CI result counts as E2E evidence until #64 is accepted.
4. **`main` is unprotected and every merge deploys** (IR-1 G-1/G-2). The release should be one merge, not a series.
5. **PO-only gates (IR-1):**
   - Q4, the production push-token format check, blocks the #85 release recommendation.
   - Confirm no French flag in `.env.production`.
   - Confirm a recent backup and a free snapshot slot.
6. **The candidate was never exercised by GitHub CI.** If CI evidence is required, it needs a separate authorization, and only together with #64 (IR-1 §6).
7. **The §6 combined-path test gap.** It is closed by the probe for this validation only; the proposed test needs authorization.

## 17. Resource and operational cost observations

| Step | Wall time |
|---|---|
| API full suite with coverage | 37 s |
| API typecheck + lint + build | about 1–2 min [A] (not timed) |
| Web suite | 15 s |
| Web typecheck + lint + build | about 1–2 min [A] (not timed) |
| Mobile suite | 9 s |
| Worker | under 30 s |

- All runs were sequential with `--maxWorkers=2`.
- No out-of-memory events, containers, downloads or installs.
- **Disk:** build outputs (`dist/`, `.next/`) were created only inside the disposable worktree.
- **Cost:** no spend; GitHub Actions was not used.

## 18. Recommended next bounded mission [P]

**IR-3 — release-candidate decision package (docs/decision only).**
- PA/PO record decisions on blockers 1–3 (API margin, mobile gate, #64).
- Optionally authorize the about-10-line §6 follow-up test.
- The PO runs Q4 and the G-6/backup checks.

The release mechanics (folding the stack into its parent branches, then one merge to `main`) stay a separate, later execution authorization, as IR-1 recommended.

## 19. Production and staging confirmation

- **No production or staging environment was touched.** No SSH, server command, SQL, migration, container start/stop, `.env.production` access, deployment, build/OTA or Playwright run.
- **No merge or ref change:**
  - No GitHub merge, no merge commit and no integration ref.
  - No source PR modified, rebased or pushed.
  - **The integration candidate was never pushed.**
- **The report branch:** this report is the only thing pushed, as a docs-only branch from `main`. That branch push matches no workflow trigger (`ci.yml` runs on `pull_request` to `main`; `cd.yml` on push to `main`).
  - No pull request was opened for it, deliberately. A PR into `main` would start `ci.yml`, including the E2E job whose default `baseURL` is production. That job currently dies at browser install (#89 run `45392842630`), but IR-2L excludes E2E against production.
  - Opening a Draft PR for this report remains the PO's or PA's choice.

## 20. Cleanup

- Build artifacts (`services/api/dist`, `services/web/.next`, `services/web/tsconfig.tsbuildinfo`, `services/worker/dist`) and the disposable worktree `../Noetia-ir2l` (detached, no branch) were removed after evidence collection.
- The untracked `node_modules` symlinks went with the worktree. The targets they point to (the source worktrees' installs) were not touched.
- No source worktree, branch, backup or development data was modified.
- The candidate is reproducible at any time from §2, giving tree `c954941`.
