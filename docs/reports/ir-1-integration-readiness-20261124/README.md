# IR-1: integration readiness (diagnostic and design only)

**Mode:** read-only investigation plus this documentation-only Draft PR.
- No code, workflow, branch integration, merge, deployment, SQL, Q4 or backup procedure was run.
- Conflict checks used `git merge-tree` in the local clone only. It writes objects but no branches, refs or pushes.

**Evidence labels:** **[V]** verified in this investigation · **[M]** measured earlier, cited from the named PR report · **[A]** assumption or estimate · **[P]** proposal.

**STOP FOR INDEPENDENT PRODUCT ARCHITECTURE REVIEW.**

---

## 1. Current branch and PR heads [V]

Checked on 2026-11-24 after `git fetch`. `main` = `8f2f2943` (#59, squash-merged 2026-11-20).

| PR | Head | Base | Relation to `main` |
|---|---|---|---|
| #78 Checkpoint A | `81143790` | `main` | On `8f2f294`, 3 ahead, 0 behind |
| #80 Web B1-A | `28aa6680` | #78 | Contains #78; 0 behind `main` |
| #81 Mobile B1-B | `c4106a2b` | #78 | Contains #78; 0 behind |
| #83 Email B2-A1 | `0f147359` | #78 | Contains #78; 0 behind |
| #86 API B2-A2a | `6fb81cbc` | #83 | Contains #83; 0 behind |
| #87 Web B2-A2a | `fd5f819a` | #80 | Contains #80; 0 behind |
| #88 Mobile B2-A2a | `0aaf9751` | #81 | Contains #81; 0 behind |
| #85 SP-1-I1 | `82c3d2e0` | `main` | On `8f2f294`, 5 ahead, 0 behind |
| #77, #79, #82, #84 (docs) | `4ef2906d`, `e24c729c`, `0ad54f75`, `824992d8` | `main` | Each touches only its own `docs/…` folder |
| #64 CI-1 | `86bc453c` | `main` | On `a67afbd`, 2 behind |
| #66 CI-2 | `9c9e4903` | `main` | On `a67afbd`, 2 behind |
| #67 CI-3 | `255a9ce3` | `main` | On `a67afbd`, 2 behind |
| #69 CI-4.0 | `3bc8712d` | `main` | On `a67afbd`, 2 behind |
| #70 CI-4.1 | `9f4a1923` | `main` | Contains #69 |
| #72 PR-A (mobile fix) | `395e6e9c` | `main` | Contains #70 |
| #60 payment lifecycle | `d8e61e24` | `feat/public-ecosystem-site-20261112` | **Stale.** Based on #59 at `e326b81`, before #59 was squash-merged; 56 ahead, 4 behind `main`. |

## 2. Deployment safety [V]

| Question | Finding |
|---|---|
| What runs on pull requests? | `ci.yml` runs only on `pull_request` targeting `main`: lint/typecheck/build (api, web, worker), unit tests with 80% coverage gates (api, web, worker, mobile), image-gen pytest and Playwright E2E. It references **no secrets** and runs on GitHub-hosted runners. **PRs into feature branches (#80, #81, #83, #86–#88) get no CI.** |
| What triggers production deployment? | `cd.yml` runs on `push` to `main`. It connects over SSH as `root@84.247.140.175:222` with `secrets.DEPLOY_SSH_KEY`, then runs `git pull`, `docker compose build/up` and `migration:run:prod`. |
| Would pushing or merging into `main` deploy? | **Yes. Every push or merge to `main` deploys, including docs-only merges.** CD runs are queued and never cancelled. |
| Approval gates? | **None.** `main` has no branch protection and no rulesets, and the repo has no environments (`gh api`: "Branch not protected", `[]`, no environments). Nothing but the Draft status and human discipline stops an accidental merge from deploying. |
| Can an integration branch be tested without production? | **Yes.** (a) Locally, with no GitHub involvement. (b) Push the integration branch and open a **Draft PR into `main`**: CI runs on the `pull_request` event, and CD does not run unless the PR is merged. A branch with no PR gets no CI. |
| Could a CI step reach production? | **Yes, read-only, through E2E.** On `main`, `services/web/playwright.config.ts` sets `baseURL: process.env.BASE_URL ?? 'https://noetia.app'`, and CI doesn't set `BASE_URL`. **E2E therefore loads the live production site, not the PR's build.** The three specs mock their API calls with `page.route` (registration and checkout included), so writes are not expected [A], but page loads and any unmocked request reach production. It is masked today only because the job fails earlier: `ubuntu-latest` is Ubuntu 26.04, and Playwright can't install Chromium there. **#64 fixes both**: it pins `ubuntu-24.04` and builds and serves the PR's own web build on loopback, refusing non-loopback targets. |
| Secrets exposure on PRs | Same-repo PR workflows could read secrets, but `ci.yml` uses none. `DEPLOY_SSH_KEY` appears only in `cd.yml`. The repo is **public**, so fork PRs get no secrets. |
| How to prevent accidental deployment | [P] Integration PRs stay **Draft**, titled "DO NOT MERGE", from a branch named `integration/…`. They never merge; the release mission decides that. Retarget nothing to `main` until release. Optionally the PO adds branch protection or a required-review rule on `main` and a GitHub environment with approval for `cd.yml`. **That is a CI/CD change, not authorized here; it is recommended for a separate decision.** |

## 3. Integration dependency graph [V]

```
main 8f2f294 ─┬─ #78 Checkpoint A ─┬─ #80 B1-A web ──── #87 B2-A2a web
              │                    ├─ #81 B1-B mobile ─ #88 B2-A2a mobile
              │                    └─ #83 B2-A1 email ─ #86 B2-A2a api
              ├─ #85 SP-1-I1 (independent of NEM-025; same base)
              ├─ docs #77 #79 #82 #84 (no code; no implementation depends on them)
              └─ (a67afbd, 2 behind) #64 · #66 · #67 · #69 ─ #70 ─ #72
#59 (merged, squash) ··· #60 (still on pre-squash #59 e326b81; must be rebased on main)
```

- **Required parents:** #78 for all NEM-025 PRs; #83 for #86; #80 for #87; #81 for #88.
- **Independent:**
  - #85 vs. NEM-025;
  - the API, web and mobile surfaces of B2-A2a. Their wire contract is backward compatible both ways: an older API's `ValidationPipe({whitelist:true})` drops `uiLanguage`, and older clients omit it.
- **No dependency, infrastructure, workflow, migration or env-file change in the core set:** #78, #80, #81, #83, #85, #86, #87 and #88 touch no `package.json`, lockfile, `Dockerfile`, compose file, `.github/` or migration.

## 4. Conflict and semantic-risk matrix

**Textual results [V]:** chained `git merge-tree`.
- `N1` = #86 + #87: clean. `N2` = N1 + #88: clean. `N3` = N2 + #85: clean. `N3` contains #78, #80, #81, #83, #85, #86, #87 and #88.
- N3 + #64: clean. N3 + #66: clean. N3 + #69: clean.
- N3 + #67: **conflict**, in `services/web/tests/unit/lib/i18n.spec.ts`. B1-A rewrote the en/es/fr-CA parity spec.
- N3 + #70 and N3 + #72: **add/add conflict**, in `services/mobile/tests/unit/i18n/index.spec.ts`. Checkpoint A added the same path.
- N3 + #60: **19+ conflicts**, including `CLAUDE.md`, `docker-compose.server.yml`, `main.ts`, `gifts.service.ts`, `subscriptions.service.ts`, billing, pricing and corporate pages, and web i18n. The cause is #60's stale pre-squash base, which re-applies #59, #61 and #63 history.

**Shared files:**

| Pair | Shared files | Textual | Semantic assessment |
|---|---|---|---|
| #85 × #86 | `users/users.service.ts` `deleteAccount` | Clean | [V] The merged `N3` order is: dependent-row deletes → `repo.delete(user)` → **push cleanup** (#85, try/catch) → **farewell** with `accountEmailLocale(user.uiLanguage)` (#86). Both PRs' intended order survives. [V] #85's deletion golden master records `sendFarewell('reader@example.com','Ana','en')`, and its cleanup spec expects `'es'`. `accountEmailLocale` maps `en`→`en` and `es`→`es`, so both stay valid [A until executed]. #86's golden-master harness mocks `manager.query`, so #85's extra query is absorbed [A]. |
| #83 × #86 | `email/locale.ts`, `email.service.ts`, two specs | Stacked | By design. #86 calls the B2-A1 resolver; EmailService runtime is unchanged. |
| #80 × #87 | `app/(auth)/register/page.tsx` | Stacked | By design (three lines) |
| #78 × #80/#81 | i18n dictionaries, `LanguageScreen` | Stacked | By design |
| #66 × NEM-025 | none (`tests/unit/auth/email.service.spec.ts`) | Clean | [M, #86 report §15] #66's spec passes **32/32** against #86. |
| #67 × #78/#80 | `web/tests/unit/lib/i18n.spec.ts` | **Conflict** | #67's i18n part predates the trilingual spec. **Superseded.** |
| #70/#72 × #78 | `mobile/tests/unit/i18n/index.spec.ts` | **Add/add** | Two different specs at the same path. Needs a manual reconciliation, or one renamed. |
| #60 × NEM-025 | web/mobile `i18n/en.ts`, `es.ts`; corporate pages (via #80) | Conflict (stale base) | See below |

**Semantic interactions without textual conflict:**
- **Email foundation and account callers [V].** Account emails (registration, resend, reset, farewell) are normalized by N-1. Gift, waitlist and invitation emails still call EmailService unchanged and keep the raw `<html lang>` (X-4 open for those, by B2-D6).
- **Push language [V].** `PushService.buildContent` uses `lang === 'en'` else Spanish, which is the same effective mapping as N-1 for bodies. B2-B is not started.
- **#60 gifts and subscriptions × #85 [V].** #60 keeps `pushService.sendToUser(gift.buyerUserId, 'gift_claimed', …)` and `sendToUser(sub.userId, 'invite_accepted', …)` with unchanged signatures. The SP-1 send guard and single-owner logic live in `PushService`, so #60 needs no change to benefit.
- **#60 × B2-A1/B2-A2a [V].** #60 calls `sendGiftCard`, `sendGiftConfirmation` and `sendPlanInvite` with unchanged signatures and no `lang`. B2-A1 preserved those signatures, and B2-A2a didn't touch those callers. Signature-compatible; behaviour compatibility is unverified until #60 is rebased [A].
- **Clients × API [V by design and tests in #86, #87, #88].** Any deployment order is safe. A mobile JS change needs OTA or a store build, which is not authorized; old app versions keep working.
- **French gate [V code].** `FR_CA_TRANSACTIONAL_READY = false` (code constant); API `FR_CA_ENABLED` and web `NEXT_PUBLIC_FR_CA_ENABLED` fail closed. Registration rejects `fr-CA` even with the gate on (#86 rev 2). **Neither flag appears in `docker-compose.server.yml` or `.env.example` [V].** The production `.env.production` value is **unverified** [A]; see gate G-6.
- **Coverage-gate interaction [M/A].** See §5. A clean merge does not mean the gates pass.

## 5. Existing CI remediation reuse plan

**Current CI failure set [V].** Run `45373240653` on #85, a `main`-based PR, which docs PRs #82 and #84 match:
- **API unit tests:** fail the coverage gate only, at 70.09% branches. All 1,366 tests pass.
- **Web unit tests:** fail the coverage gate only, at 72.76%.
- **Mobile unit tests:** fail the coverage gate only, at 14.17%.
- **E2E:** fails at the Playwright install on Ubuntu 26.04.
- **Pass:** lint, typecheck and build for API, web and worker; worker unit tests; image-gen.

**Coverage baselines by lineage.** Branches %; local measurements from each PR's report unless marked CI. They aren't additive across lineages.

| Package | `main` (CI) | NEM-025 stack head | Notes |
|---|---|---|---|
| API | 69.14 (70.09 with #85) | **78.98** at #86 [M] | B2-A1 already lifted `email.service.ts` to 100%. **Estimated combined N3: about 79.7–80.0 [A]**, borderline; must be measured. |
| Web | 72.76 | **83.01** at #87 [M] | Likely passes 80 on the stack [A] |
| Mobile | 14.17 | **38.38** at #88 [M] | Far below 80 |
| Worker, image-gen | pass | unchanged | — |

| PR | Still useful? | Reuse recommendation [P] |
|---|---|---|
| **#64 CI-1** (E2E on ubuntu-24.04 against the local build) | **Yes, critical.** It fixes the only infrastructure-type failure, and stops CI E2E from loading production. | Needed before any CI result can count as E2E evidence. Workflow change: needs its own PA/PO acceptance (CI-1 is awaiting PA). Merge-clean with N3. |
| **#66 CI-2** (EmailService EN/ES spec) | **Coverage gain superseded** by B2-A1; still a valid **regression spec** (32/32 on #86). | Optional; keep as an extra regression test. No obsolete assumptions found: it asserts current ES/EN output and valid `lang` only. |
| **#67 CI-3** (web `clubs.spec` plus i18n interpolation) | `clubs.spec.ts`: probably still useful [A]. The `i18n.spec.ts` part is **superseded** by B1-A's trilingual spec and conflicts. | Reuse **only** `clubs.spec.ts`. The web gate likely passes on the stack without it [A]. #67's finding D-1 (clubs `?search=undefined`) is a product defect, not fixed, tracked separately. |
| **#69 CI-4.0** (adds `react-test-renderer` dev dependency and lockfile) | Useful only for raising mobile coverage. | **Not needed for integration.** It adds a dependency and lockfile change, which this mission forbids introducing; it is its own PA decision. B1-B's shallow harness covers the NEM-025 mobile tests without it. |
| **#70 CI-4.1** (hook and logic tests) | Partly useful | Add/add conflict with Checkpoint A's `i18n/index.spec.ts`. If reused, rebase onto the NEM-025 stack and rename or reconcile that spec. Mobile still won't reach 80 [M: #68 assessment]. |
| **#72 PR-A** | A product fix, not CI remediation | Out of scope for integration |

**Minimum path to reliable CI [P]:**
1. Accept #64 (workflow).
2. Treat mobile coverage as a **documented pre-existing red gate**; judge mobile by test pass counts and the NEM-025 golden masters.
3. Measure the API gate on the combined tree. If it lands just under 80%, the PA decides between a narrowly scoped test addition (no threshold change) and accepting the known gap.

**No thresholds are lowered, and no new framework, dependency or service is introduced.**

## 6. Recommended integration sequence [P]

1. **IR-2 (validation):** a disposable integration branch, as in §7. Nothing reaches `main`.
2. **Release decision (a later PO mission):** collapse the stack so production gets **one deploy**, not five:
   - (a) merge #86 → #83's branch, #87 → #80's, #88 → #81's;
   - (b) merge #80, #81 and #83 into #78's branch;
   - (c) merge #78's branch into `main` as **one** release.

   Merges into feature branches do not trigger CD [V]. #85 goes either as a second, separately reviewed release or in the same window. Two releases are recommended: smaller blast radius, and #85 needs Q4 first.
3. **Docs PRs #77, #79, #82, #84:** no implementation depends on them [V]. Merging any of them deploys [V], so fold them into a release merge or leave them as Draft records. **Do not merge them on their own.**
4. **#60:** separate track. It must be rebased onto current `main` (its base was squash-merged) and re-qualified. It is not part of this integration.
5. **Mobile #88:** the API and web release don't require it. Shipping it needs a separate OTA authorization.

## 7. Proposed isolated validation method (IR-2) [P]

**Branch:** `integration/ir-2-<date>`, created from `main` `8f2f294`.
- Merge, in order: #86 (which brings #78 and #83), #87 (#80), #88 (#81) and #85. All are verified textually clean.
- Optionally add #64 (workflow, if accepted), #66 and #67's `clubs.spec.ts` only.
- **Never merged; deleted after the PA review.**

**Step 1: local, no GitHub CI, $0.** Run with `--maxWorkers=2`, one job at a time:
- full API, web, mobile and worker unit suites with coverage;
- typecheck, lint and builds (`nest build`, `next build`).

**Step 2 (optional): a Draft PR from the integration branch into `main`**, titled "DO NOT MERGE — IR-2 validation". This produces GitHub CI evidence. CI runs on the PR; CD runs only on merge [V].
- **Only with #64 included.** Otherwise E2E either fails at install or, if the runner image changes, loads production.
- The repo is public, so standard runners are free [V].

**Coverage map.** Every item uses existing tests in the combined tree; no new tests are needed except where noted.

| Area | Evidence in the combined tree |
|---|---|
| ES/EN registration; locale persistence | #86 `register-locale.spec.ts` 1–6, DTO spec; #87 page spec; #88 screen spec |
| Existing-account emails | #86 `account-email.golden-master` (12 snapshots) |
| French fail-closed | #86 tests 5, 5b, 5c, 11; B2-A1 locale and templates specs; web and mobile `fr-CA`-not-sent tests; Checkpoint A gate specs |
| Push single owner | #85 `push.single-owner.spec.ts` (real-Postgres evidence script `concurrency-check.ts`, re-run only if the PA wants it, in a disposable local container) |
| Deleted-account push protection; cleanup | #85 send-guard tests 7/7b; `users.delete-push-cleanup.spec.ts` 9–11b |
| Email and push golden masters | B2-A1 46 + B2-A2a 12 + #85 push 16 + deletion order 2 = **76 snapshots, all must be unchanged** |
| OAuth non-interference | #86 test 12 (payload, arities); web and mobile `SocialAuthButtons` assertions |
| Gift and subscription non-interference | #86 test 13 (callers don't use the resolver); existing `gifts`/`subscriptions` suites on `main`; #66 spec |
| Cross-surface compatibility | Whitelist-strip behaviour (old API × new client). A direct test is a small optional addition: an e2e-style ValidationPipe test. |
| Security and regression | #86 enumeration and 409 tests; #85 redaction (F-SP1-I1-1), DTO and throttle tests; full suites |

**Known limits on interpreting results [V/A]:**
- **Mobile coverage gate:** red, pre-existing.
- **API gate:** may sit at about 80 [A].
- **E2E:** meaningless without #64.
- **Local vs. CI:** local runs share `node_modules` via symlinks across worktrees, and CI uses `pnpm install --frozen-lockfile`. Small environment differences are possible.
- **What can't be validated before release:**
  - SMTP delivery and real Expo delivery (by design: mocks);
  - production token formats (Q4).

## 8. Release-readiness gates (for a later decision; none executed) [P]

| Gate | Requirement |
|---|---|
| **G-1 Combined evidence** | IR-2 local results (and optionally CI) on the combined tree. All suites pass, all 76 snapshots unchanged, builds pass. |
| **G-2 CI disposition** | PA/PO record for each red gate. Mobile coverage: accepted as pre-existing. API gate: measured and decided. E2E: #64 accepted or E2E explicitly waived. |
| **G-3 Q4** | The PO runs the read-only, counts-only Q4 (#84 §11, #85 report) and confirms every stored push token matches the new `EXPO_PUSH_TOKEN_PATTERN`. **Blocks #85 release.** |
| **G-4 Backup and rollback** | No migration in the set [V], so rollback is a code revert plus redeploy. Before release: the PO confirms the latest offsite backup and an available Contabo snapshot slot (CLAUDE.md, `offsite-backups.md`). Note that #85's token deletions (single-owner eviction, deletion cleanup) can't be undone by a code revert. They are authorized behaviour; devices re-register on next app use [A]. |
| **G-5 Sequencing** | One merge per release (§6). Check `gh run list` first, so no merge lands mid-deploy (CD queues). Expect a ~25 s `/api` gap per deploy. |
| **G-6 French and payment gates** | The PO confirms `.env.production` has **no** `FR_CA_ENABLED=true` and no web `NEXT_PUBLIC_FR_CA_ENABLED=true` at build time. `PAYMENTS_ENABLED` is unchanged by this release. `FR_CA_TRANSACTIONAL_READY` stays `false` [V code]. |
| **G-7 No financial or data change** | Verified by diff review [V]: the core set touches no Stripe, checkout, token, ledger, subscription, gift or pricing code, and adds no migration. Runtime data effects are limited to the authorized ones: `users.uiLanguage` set at local registration (`es`/`en`), and push-token eviction and cleanup. |
| **G-8 Post-deploy checks** | CLAUDE.md deployment verification. Spot-test registration ES/EN with a disposable account only if the PO authorizes it. |

## 9. Unresolved blockers

1. **[V] `main` is unprotected and every merge deploys.** Not a blocker for IR-2, but the main operational risk. Recommend protection and an environment approval as a separate CI/CD decision.
2. **[V] CI E2E targets production by default.** Masked by the install failure. #64 is the remedy and needs acceptance before any integration Draft PR into `main` relies on E2E.
3. **[A] The API coverage gate on the combined tree is borderline (about 80).** It needs measuring.
4. **[V] The mobile coverage gate is far below 80** and needs a formal disposition.
5. **[V] #60 is on a stale, pre-squash base**, with 19+ conflicts against the combined tree. It must be rebased separately; it is excluded from this integration, per B2-D6.
6. **[A] Q4 not run.** It gates the #85 release.
7. **[A] The production `.env.production` French and payment flag values are unverified** (PO-only access).

**No STOP condition was triggered:**
- no protected behaviour change;
- no migration;
- no semantic conflict found between accepted changes;
- no infrastructure or spend needed;
- no French or payment impact.

Findings 1 and 2 are pre-existing workflow properties, reported for the PA, not caused or changed by this mission.

## 10. Effort and operational cost [A]

| Item | Effort | Cost |
|---|---|---|
| IR-2 local validation (branch build, four suites, builds, report) | About 0.5 agent-day; dev VM limits (`maxWorkers=2`, one heavy job) | $0 |
| Optional Draft PR CI run | About 15 min of runner time per run | $0 (public repo, standard runners) |
| #67 `clubs.spec` reuse, #66 inclusion | Negligible | $0 |
| Possible narrowly scoped API test top-up (if the gate is under 80) | 0.25–0.5 agent-day | $0 |
| Release (later): one deploy | Existing CD; ~25 s `/api` gap | $0 incremental |
| Branch protection or environment approval (separate decision) | Configuration only | $0 |

## 11. Exact proposed next engineering mission [P]

**IR-2: combined integration validation (no merge, no deploy).**
- **Scope:**
  - Create the disposable branch `integration/ir-2-<date>` from `main` `8f2f294`.
  - Merge #86, #87, #88 and #85 into it, plus #66 and #67's `clubs.spec.ts` if the PO authorizes.
  - Run the full local suites, typecheck, lint and builds.
  - Confirm all 76 golden-master snapshots are unchanged and measure the coverage gates.
  - Publish a report.
- **Optional, with separate PO consent:**
  - push the branch and open a Draft "DO NOT MERGE" PR into `main` for CI evidence, **only if #64 is accepted and included**;
  - close the PR and delete the branch after the review.
- **Excluded:**
  - merges into any PR branch or `main`;
  - deployment, SQL, Q4 and backups;
  - #60;
  - workflow edits, unless #64 is separately accepted;
  - threshold changes, new dependencies (#69), mobile builds or OTA, French or payment changes.

## 12. Explicit STOP conditions for IR-2 [P]

STOP and report if:
- any merge in the sequence conflicts textually, or needs a code edit beyond the PRs as accepted;
- any of the 76 golden-master snapshots changes;
- any test fails that passed on its source PR;
- the combined tree needs a migration, dependency, workflow, threshold or infrastructure change;
- a semantic conflict appears between #85 and #86 (deletion order, farewell locale, push guard);
- French could become reachable, or payment, gift or subscription behaviour changes;
- E2E or any CI step would target a non-loopback host;
- an action would push to `main`, merge, deploy, or touch staging or production.

---

**STOP FOR INDEPENDENT PRODUCT ARCHITECTURE REVIEW.**

The Product Owner retains authority over integration, release and subsequent missions.
