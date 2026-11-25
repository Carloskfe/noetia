# IR-3A: release readiness, test preservation and quality-gate assessment

**Status:** COMPLETE. No STOP condition was triggered. **Awaiting independent Product Architecture review.**
**Date:** 2026-11-25 · **Authorization:** PO execution authorization IR-3A (bounded).
**Nature:** one test-only commit on PR #80, plus documentation. Nothing was merged or deployed, and no setting was changed.

**Labels:** **[M]** measured in this session · **[D]** GitHub documentation read in this session · **[K]** general GitHub knowledge, not confirmed in the pages read · **[E]** estimate · **[P]** proposal.

## Summary

| Workstream | Result |
|---|---|
| **A: E2E correction** | Preserved on PR #80 (`135f82d`). Adding it to the other approved heads rebuilds PR #90's validated tree **exactly** (`a10c175`). |
| **B: mobile coverage** | 80% is reachable but not small: it needs the reader **and** club screens tested, and the PR #69 test dependency. Reusing #69, #70 and #72 unchanged lifts branches only from 38.38% to 46.69%. |
| **C: deployment safety** | Option C (ruleset plus Environment) is free on this public repository. **But the agent and the PO share one admin GitHub identity, so no GitHub approval is independent until that changes.** A bare Environment gate would also deploy "latest `main`", not the approved commit. |
| **D: API margin** | The proposed deletion test and #66 **each add 0 branches**. A 12-case club-membership spec measured **+10** (80.02% → 81.07%). |
| **E: checklist** | §9. Finding: **Q4 as written is looser than the deployed validator** and must be tightened before the PO runs it. |

---

## 1. Baselines [M]

Re-read from GitHub at the start. Every head matches, and every PR is open and Draft.

| Ref | SHA | Ref | SHA |
|---|---|---|---|
| `main` | `8f2f294` | #85 | `82c3d2e` |
| #78 | `8114379` | #86 | `6fb81cb` |
| #80 (before) | `28aa668` | #87 | `fd5f819` |
| **#80 (after)** | **`349fe80`** | #88 | `0aaf975` |
| #81 | `c4106a2` | #64 | `723d8a1` |
| #83 | `0f14735` | #90 | `a169e7c` (unchanged) |
| #66 | `9c9e490` | #69 / #70 / #72 | `3bc8712` / `9f4a192` / `395e6e9` |

Read before execution: the IR-1 report (#89), IR-2L (`4f941ac`), the IR-2H and IR-2H-C reports (#90 comments), and the mission-governance README. **The PA acceptance of IR-2H-C is not recorded on GitHub**; I relied on the PO authorization, which calls the correction approved. PA acceptance of #64 at `723d8a1` is recorded in #90's report.

## 2. Workstream A: PR #80 correction

| Commit | Content |
|---|---|
| `135f82d` | `git cherry-pick -x a169e7c`: **only** `services/web/tests/e2e/sign-up-to-read.spec.ts`, +5 / −1 |
| `349fe80` | PR #80's own report, new §13 (documentation only) |

**Identity [M]:**
- The patch-id equals `a169e7c`'s (`b6c98d64…`).
- The resulting file blob is identical (`03d9044`).
- There was no conflict: the file on #80 was the same as the one the fix was written against.

**Requirements:**
- The HTTP 409 mock is unchanged.
- The expected text is `en.auth.register.errors.emailTaken`, read from the canonical dictionary.
- The raw message is asserted absent (`toHaveCount(0)`).
- No test was removed or skipped.

**Local validation at `135f82d` [M]:**

| Check | Result |
|---|---|
| `tsc --noEmit` | pass |
| `next lint` on the spec | 0 warnings, 0 errors |
| `playwright test --list`, `BASE_URL` forced to a closed loopback port | loads, 3 tests |
| Web unit tests (`--ci --coverage`) | 35/35 suites, **615/615** tests, 20/20 snapshots |
| **Browser run of the spec** | **Not run.** Chromium isn't installed, nothing was downloaded, and CI doesn't run on this stacked PR. Evidence: the same blob passed on #90, run `45523204643` (13 passed / 9 skipped / 0 failed). |

PR #80 targets `feat/nem-025-checkpoint-a`, so the push matches no workflow trigger.

## 3. Dependency implications for PR #87

PR #87 (`fd5f819`) is based on the old #80 head `28aa668`. It was **not** touched.

- **No conflict [M]:** #87 doesn't change the spec or any file under `lib/i18n` or `tests/e2e`. `merge-tree` of the new #80 with #87, and with #64, is clean.
- **The combined result equals the validated one [M]:** #86 + #87 + #88 + #85 + #64 + `135f82d` gives tree **`a10c17538ebc07b8733ad22f561f1ccf938a2579`**, which is PR #90's tree. Both merge orders give it. With `349fe80`, the only further difference is PR #80's report.
- **The hazard [M]:** an integration that takes the web tip from #87 alone (as IR-2H did) **loses the fix** and the E2E failure returns.

**Precise follow-up [P]:** in the future authorized integration, do one of these:
1. **Preferred:** merge #80's head **and** #87's head into the integration branch. No change to #87 is needed.
2. If #87 itself must be self-sufficient, run `git merge origin/feat/nem-025-checkpoint-b1a` on #87's branch (a merge, not a rebase). This changes #87's SHA and needs authorization.

**Gate:** before any release, the integrated tree's `sign-up-to-read.spec.ts` must be blob `03d9044`.

## 4. Workstream B: mobile coverage gap

### 4.1 Collection and toolchain [M]
- `collectCoverageFrom`: all of `src/**/*.{ts,tsx}` except `src/navigation/**`. Four global 80% thresholds. `testEnvironment: node`, ts-jest, with a hand-written `react-native` mock. This is identical on the candidate and on #69/#70/#72.
- No renderer is installed on `main` or the candidate.
- B1-B's own harness stubs React hooks and captures the **first render only**; state setters do nothing. It can execute branches, but it can't verify state changes, effects or interaction sequences.
- CI has no mobile typecheck or lint job.

### 4.2 Measured coverage
Run in a disposable worktree at `a169e7c`, since removed.

| Tree | Tests | Statements | Branches | Functions | Lines |
|---|---:|---:|---:|---:|---:|
| Candidate (equals CI) | 270 | 46.26 | **38.38** (266/693) | 32.64 (143/438) | 49.24 |
| + #69 + #70 (test-only + dev dependency) | 383 | 61.14 | **46.46** (322/693) | 50.68 | 64.22 |
| + #72 (adds the M-D3/M-D6 fixes) | 388 | 61.28 | **46.69** (325/696) | 50.79 (223/439) | 64.33 |

All 17 mobile snapshots stay unchanged in every variant, and the final variants pass every test.

**One unexplained anomaly:** the first run of the #69 + #70 variant failed all 16 new LibraryScreen tests ("Couldn't find a navigation object", so the navigation mock didn't apply). Ten later runs passed: six more of that variant, then (with `--no-cache` ×2 and fresh cache directories ×2) four more. The symlinked `node_modules` in the disposable worktree is a plausible cause, but **not proven**. Watch for it in hosted CI.

### 4.3 Where the remaining gap is
State after reusing #69, #70 and #72. Uncovered branches, out of 371:

| Area | Files (uncovered branches / functions) | Branches |
|---|---|---:|
| **Reader** | `ReaderScreen` 113/64 (0% branches), `ShareSheet` 39/16 (0%), `AudioPlayerBar` 7/3 | **159** |
| **Clubs** | `ClubScreen` 72/34, `LiveSessionScreen` 25/17, `ClubsScreen` 20/14 | **117** |
| **Auth, account, other screens** | `SocialAuthButtons` 15, `FragmentsScreen` 13, `LoginScreen` 12, `OnboardingTour` 11, `RegisterScreen` 8, `AccountScreen` 7, `TourContext` 1 | **67** |
| **Paywall** | `PaywallScreen` 18, `api/subscriptions` 2 | **20** (reserved for #60) |
| Residue | `api/client` 3, i18n 2, others 3 | 8 |

**`ReaderScreen`, the most-used screen, has 0 of 113 branches and 0 of 64 functions tested.** That is the main quality risk, independent of any percentage.

## 5. Reusable mobile work

| PR | Reuse | Conflict with NEM-025 |
|---|---|---|
| **#69** | Yes: the renderer helper, the functional list mocks and the LibraryScreen behaviour tests. **Adds dev dependencies** `react-test-renderer@18.2.0` and its types (+25 lockfile lines, dev-only; the bundle was byte-identical in its own report). | None textually; merges clean |
| **#70** | Yes: 97 behaviour tests for hooks, offline and i18n | **One:** add/add on `tests/unit/i18n/index.spec.ts`. The two specs are complementary. Measured fix: keep both, with #70's renamed `index.provider.spec.ts`. No other edit was needed. |
| **#72** | Yes, but it is a **product fix** (audio and socket leaks, M-D3/M-D6), so it needs its own decision | Inherits #70's |

- The B1-B harness stays as it is, for golden masters. The two harnesses coexist (measured), so no duplicate framework is introduced.
- #70 also pins **M-D7** (the app never stores the user ID, so `isHost` is wrong on mobile) as an expected failure. It needs the separately designed PR-B (issue #71).
- The orphaned `services/mobile/package-lock.json` (PR #69, finding A6) is unrelated and stays open.

## 6. Minimum mobile remediation

**Can the current toolchain alone do it?** Not meaningfully. 81% of the original branches are in components (#68). Without a renderer, tests could only call first renders: numbers without behaviour. **Not recommended.**

**Projection** for "reuse #69, #70 and #72, then cover X% of each target file" [E], computed from the §4.2 file data:

| Cumulative step | S / B / F at 85% | S / B / F at 90% |
|---|---|---|
| Reuse only | 61 / 47 / 51 | 61 / 47 / 51 |
| + Reader | 75 / 66 / 67 | 76 / 67 / 68 |
| + Auth and account | 81 / 73 / 75 | 82 / 75 / 77 |
| + Clubs | **89 / 86 / 87** | **92 / 89 / 90** |

- **Clubs is unavoidable.** Perfect (100%) coverage of everything except clubs and paywall gives about 80.3% branches, so it isn't a practical route.
- **Reader + Clubs only, at 90%** gives about 81% branches and 81% functions: the smallest passing set, but thin. Auth and account work supplies the safety margin.

**Smallest practical sequence [P]** (each step separately authorized and reviewed):

| Step | Scope | Effort [E] | Expected branches | Why |
|---|---|---|---:|---|
| **M-1** | Port #69 + #70 onto the candidate (one rename) | 0.5 agent-day | 46% | Already written and reviewed |
| **M-2** | Reader: `ReaderScreen`, `ShareSheet`, `AudioPlayerBar` (Escucha Activa, fragments, offline, errors) | 1.5–2 days, about 900–1,200 test lines | 66–67% | **Highest user value** |
| **M-3** | Clubs: `ClubScreen`, `LiveSessionScreen`, `ClubsScreen` (roles, bans, polls, socket events). Should follow the M-D7 decision, so a wrong host state isn't pinned as correct | 1.5–2 days, about 800–1,100 lines | 80–83% [E] | Needed for 80 |
| **M-4** | Auth, account, fragments, tour | 1 day, about 500–700 lines | 86–89% | Security value plus margin |

**Total: about 4.5–5.5 agent-days, 2,200–3,000 test lines, $0 spend, one dev dependency.** The mobile gate stays red until M-3 at the earliest. The reader is a protected system, so M-2 must be test-only.

**Bounded assessment.** 80% is achievable, but not in one small mission. Alternatives for the PO (no choice made here):

| Alternative | Consequence |
|---|---|
| **B-1** Complete M-1 to M-4 before any release | Cleanest; delays release by about a week of agent time |
| **B-2** Recorded, time-limited exception for the **web/API release only**; mobile tests must pass, the gate stays red, and M-1 and M-2 come before any OTA or store build | The web/API release carries mobile *source* but ships no mobile binary. **The gate is not altered**; the exception is a written PO decision |
| **B-3** M-1 + M-2 first, then decide | Covers the riskiest screen in about 2–2.5 days; the gate is still red |
| **B-4** Change the threshold or exclusions | Prohibited in this mission; not recommended |

## 7. Workstream C: deployment safety

### 7.1 Actual state [M]
- Personal account (`User`), **public** repository, one collaborator (`Carloskfe`, admin).
- No branch protection, **0** rulesets, **0** environments. The API answers these queries; none was rejected for plan reasons.
- `DEPLOY_SSH_KEY` is the only Actions secret, at **repository** level. It opens a **root** SSH session on production.
- `cd.yml`: `push` to `main`, then root SSH, `git pull origin main`, build, `up`, migrations. No `workflow_dispatch`.
- Actions: all actions allowed, no SHA pinning. The default token is read-only.

### 7.2 Findings

| ID | Finding | Consequence |
|---|---|---|
| **F-C1** | **Shared identity.** Agent work and the PO use the same admin login. `gh` here reports `viewerPermission: ADMIN`. | Any approval the PO can give, this token could also give through the API. Admin rights can also remove the rules. A gate stops *accidents*, not a misbehaving holder of that token. |
| **F-C2** | **Approved commit ≠ deployed commit.** The script runs `git pull origin main`, so an approved run deploys whatever `main` is at that moment. | A commit merged after approval is deployed unapproved. Any Environment gate **must** also pin the deploy to `github.sha`. |
| **F-C3** | **Queue semantics.** By default a newer pending run **replaces** the older pending one in the group, whatever `cancel-in-progress` says [D]. | While one release waits, an earlier queued one can be silently dropped. With F-C2, its content still ships later. How long a run awaiting approval holds the group was not verified. |
| **F-C4** | **Repository-level secret.** A workflow added on *any* branch can read it when it is pushed by someone with write access [K]. | Branch protection on `main` alone doesn't protect production. Moving the secret into an Environment limited to `main` does. |
| **F-C5** | **Solo approver.** GitHub doesn't let a PR author approve their own PR [K]. | "1 required approval" with one account **blocks every PR** or forces a bypass. |
| **F-C6** | **Required checks and red gates.** On today's `main`, the API, web, mobile and E2E jobs are red. | Requiring checks needs the combined release content first; the mobile job can't be required until §6 is decided. |
| **F-C7** | **Visibility.** On Free, required reviewers and the admin-bypass switch are available **only for public repositories** [D]. | If the repository goes private, the Environment gate is lost unless a paid plan is bought. |

### 7.3 Options

| | **A: ruleset/branch protection on `main`** | **B: Environment `production` on the deploy job** | **C: minimal combination** |
|---|---|---|---|
| Stops direct or force pushes | **Yes** | No | **Yes** |
| Stops accidental merge of a Draft or red PR | Draft: GitHub won't merge a Draft until it is marked ready [K], but that is one click. Required checks stop red PRs. | No: the merge lands; the deploy waits | Yes + waits |
| Explicit approval before production changes | No: a merge still deploys at once | **Yes**: the job waits up to 30 days for a reviewer, and Environment secrets stay unavailable until approval [D] | **Yes** |
| Review before merge | Only with a second account (F-C5) | No | Optional |
| Separates CI from release | Partly | **Yes** | **Yes** |
| Protects the SSH key from other branches | No | **Yes**, if the secret moves and deployment branches are limited to `main` | **Yes** |
| Admin bypass | Classic protection exempts admins **by default**; "Do not allow bypassing" closes it [D]. A ruleset with an empty bypass list applies to admins [K]. An admin can still edit or delete either. | Admins bypass **by default**; can be switched off on a public repository [D]. An admin can switch it back on. | Same |
| Workflow change needed | No | **Yes**: `environment: production` + SHA pin (needs its own CI/CD mission) | Yes, same |
| Cost | $0 | $0 | **$0** |
| Daily friction | PR for every change | One click per deploy | Both |

Draft status is **not** a protection: it can be cleared by anyone with write access, and it never blocks a direct push.

Server-side root access, the Contabo console and existing SSH keys remain outside every option.

### 7.4 Recommended minimum: Option C [P]

1. **Ruleset on `main`, empty bypass list:** require a PR, **0 required approvals** (F-C5), block force pushes and deletion. Add required checks later: lint/typecheck/build ×3, API, web, worker and image-gen unit tests, and E2E (after #64). Mobile stays out of the list until the §6 decision. This is *not* a threshold change.
2. **Environment `production`:** required reviewer = PO; deployment branches = `main` only; admin bypass **off**; `DEPLOY_SSH_KEY` moved from repository to Environment scope. Keep "prevent self-review" **off** while only one human account exists, or nobody could approve.
3. **Small `cd.yml` change:** add `environment: production`, and deploy exactly `${{ github.sha }}`: fetch, verify the SHA is on `main`, check it out, and **refuse if it is older than what is live** unless explicitly marked as a rollback. Keep `cancel-in-progress: false`, `--wait`, and the migration step.
4. **Identity (closes F-C1; PO choice).** Run the agent under a separate free machine account with **write, not admin**, and keep the owner login for the PO only. Then "1 required approval" and "prevent self-review" become real controls. Without this, 1–3 guard against accidents only. GitHub's terms allow one machine account per person [K].

**Ordering constraint:** apply 1 and 2 first, then 3. Merging 3 to `main` is itself a push that deploys (no app change, ~25 s `/api` gap possible), so make it part of a planned release or the last unguarded one. Creating the Environment *without* the workflow line changes nothing. Moving the secret **before** the workflow uses the Environment makes the next deploy fail (before it touches the server) [E].

**Backups and rollback are preserved:** nothing above touches server scripts, cron, snapshots or migrations. Rollback by revert PR keeps working but passes through the gates. The emergency path stays the documented manual deploy over SSH by the PO. With pinned deploys, the server checkout is detached, so the **manual procedure in `CLAUDE.md` (`git pull origin main`) must be updated in the same mission**.

**Effort [E]:** settings about 15 minutes (PO); workflow mission about 0.5 agent-day with a rehearsal. The first verification is a docs-only merge that must **wait** and be rejectable without touching the server.

## 8. Workstream D: API coverage resilience

Measured on tree `a10c175` [M]; each probe was discarded.

| Variant | Tests | Branches | Change |
|---|---:|---:|---:|
| Baseline | 1,615 | 757/946 = **80.02%** | — |
| + #66 EmailService spec | 1,642 | 757/946 | **0** (superseded by B2-A1) |
| + proposed deletion test (`it.each(['pt','fr-CA',undefined])`, cleanup rejecting) | 1,618 | 757/946 | **0** |
| **+ 12 cases in `club-members.service.spec.ts`** | 1,627 | **767/946 = 81.07%** | **+10** |

- **The deletion test has regression value only.** It closes the IR-2L §6 gap and passes, but adds no margin. Worth adding in the same mission; it is not a coverage fix.
- **#66:** optional regression value (+27 tests), no coverage value. It can stay out.
- **Recommended smallest improvement [P]:** the 12 club-membership cases. They verify access control: an expired or forged invite, an invite to a deleted club, owner protection from role change/removal/ban, a non-member leaving or editing preferences, the book-ownership gate and unlimited capacity. One file, about 60 lines, no source change. **No overlap with #60** (it changes no file under `clubs`). It gives a margin of 10 branches.
- **Not recommended for this purpose:** `subscriptions` (27 uncovered) and `gifts` (13) because #60 is rewriting them; `auth` (16, OAuth) and the sync/alignment services because they are protected systems.
- The probe code is not committed and would be written properly under its own authorization. The probe's owner-protection assertions passed, so no defect was found there.

## 9. Release-readiness checklist

**Who:** **C** = Claude Code can do it safely · **PO** = PO-run, production/console access · **A** = Claude only after explicit PO authorization.

### Before
| # | Check | Who | Pass condition |
|---|---|---|---|
| 1 | SHAs of every source PR pinned and unchanged; E2E spec blob `03d9044` | C | exact match |
| 2 | Combined tree rebuilt; hosted CI on that exact tree | A | all jobs pass, except decided exceptions (§11) |
| 3 | No migration, dependency, compose or env change in the diff | C | `git diff --name-only` (true for `a10c175`) |
| 4 | **Q4, corrected** (below), read-only | **PO** | every row well formed and within length |
| 5 | French flags: no `FR_CA_ENABLED=true` in `.env.production` or the running API; no `NEXT_PUBLIC_FR_CA_ENABLED` at web build | **PO** (values) / C (code) | absent or not `true`. Code: `FR_CA_TRANSACTIONAL_READY=false` [M, IR-2L] |
| 6 | Payments: `PAYMENTS_ENABLED` absent/false at every layer, using the secret-safe checks in `docs/reports/payments-activation-gate/final-qualification.md` | **PO** | disabled |
| 7 | Backup freshness: last server PostgreSQL dump < 24 h and MinIO < 7 days; the **offsite** copies `VERIFIED` or `SKIP_VERIFIED` | **PO** (server) / PO on this VM (offsite log) | both recent |
| 8 | A restore drill has never been completed ("Full restore drill ⏳" in `offsite-backups.md`) | **PO decision** | accept the risk or run the drill first |
| 9 | Contabo snapshot slot (3 maximum) free; take one | **PO** | taken, name recorded |
| 10 | No CD running: `gh run list --workflow cd.yml` | C | idle |
| 11 | Post-S-ALT acceptance (#73) confirmed | PO | recorded |

**Correction to Q4 (finding F-E1) [M]:** the SP-1 report's Q4 uses `[^]]+`, which accepts whitespace inside the brackets. The deployed pattern is `/^Expo(?:nent)?PushToken\[[^\]\s]+\]$/` with a 255-character limit (the column is already varchar 255). A token containing whitespace would pass Q4 but be rejected by the API. Aligned, counts-only, read-only form [P], **not executed**:

```sql
BEGIN READ ONLY;
SELECT platform,
       (token ~ '^Expo(nent)?PushToken\[[^][:space:]]+\]$' AND length(token) <= 255) AS well_formed,
       count(*)
  FROM push_tokens GROUP BY 1, 2 ORDER BY 1, 2;
ROLLBACK;
```
`platform` values also matter: the API now accepts only `ios`, `android`, `web` or `unknown`. Any other value in the output means an installed client could get a 400. The result holds counts only; no token leaves the server.

### Sequencing
1. Fold the stack into **one** release merge (never several; never the docs PRs alone). Include #64.
2. Option C protections (§7.4) before that merge if the PO wants approval-gated deployment.
3. #85 goes in only after Q4 passes: the same release, or (IR-1's recommendation) a second one.
4. Expect a gap of about 25 s on `/api`. The web client tolerates the old API, and the new API tolerates old clients [M, IR-1].
5. Any mobile distribution is a **separate** decision.

### Rollback
- No migration, so rollback = revert the merge and redeploy (through any approval gate).
- **Not reversible by code:** token rows evicted by single-owner registration or account deletion, and `users.uiLanguage` values written at registration. Both are authorized behaviour.
- Data rollback would use a snapshot or dump, losing later writes: last resort, PO only.
- **Gap:** I found no written code-rollback procedure in `incident-response.md`, `production-safety/` or `operations/`. A short runbook is proposed (§10).

### After
| # | Check | Who |
|---|---|---|
| 12 | CD run success; `docker ps` healthy; latest migration unchanged | C (CD) / PO (server) |
| 13 | Public probes: `/`, `/api/health`, `/discover`, `/login`, `/register` HTML | A |
| 14 | Payments log line `[payments] disabled (…)` | PO |
| 15 | French not selectable in web; registration with a disposable account | PO (or A) |
| 16 | Reader smoke test: open a book, Escucha Activa, fragment | PO |
| 17 | Push registration 400 rate and email failures for 24 h | PO |

### Mobile
- The web/API release needs no mobile build.
- #88 and #81 are JavaScript-only, so OTA-eligible by the project's rule, **but** #69/#70/#72 were not part of any EAS evidence.
- Before an OTA: the coverage decision, an internal preview on a device, `EXPO_PUBLIC_FR_CA_ENABLED` absent from the build/update environment, and a runtime-version match. A native change would need a store build; none is in the set.

## 10. Recommended sequence of bounded missions [P]

| # | Mission | Depends on | Size |
|---|---|---|---|
| 1 | **PA review of IR-3A** | — | — |
| 2 | **DEP-1:** Option C settings (PO) plus the `cd.yml` SHA pin and the rollback runbook | D-1, D-2 | 0.5 day |
| 3 | **API-T1:** club-membership spec + deletion regression test (test-only, on the #86/#85 integration lineage PA selects) | PO authorization | 0.5 day |
| 4 | **MOB-1:** port #69 + #70 with the rename | D-3, D-4 | 0.5 day |
| 5 | **MOB-2:** reader tests | MOB-1 | 1.5–2 days |
| 6 | **MOB-3 / MOB-4:** clubs, then auth | MOB-1; M-D7 decision for clubs | 2.5–3 days |
| 7 | **IR-3B:** rebuild the combined candidate with the new #80 head and run hosted CI | 3 (and 4–6 if B-1) | 0.5 day |
| 8 | **Release execution**, PO-supervised | 2, 7, checklist | 0.5 day |

## 11. Unresolved PO decisions

| ID | Decision | My recommendation |
|---|---|---|
| **D-1** | Deployment safety: A, B, C or none | **C**, before the next merge |
| **D-2** | Separate machine identity for agent work (F-C1) | **Yes**; otherwise approval is not independent |
| **D-3** | Mobile gate: B-1, B-2, B-3 or other | For the PO alone. The reader gap (§4.3) argues for at least M-2 before any mobile distribution |
| **D-4** | Accept `react-test-renderer` + types (dev-only) | Needed for any meaningful mobile remediation |
| **D-5** | #72 (M-D3/M-D6) and M-D7 (PR-B): schedule | Before the clubs tests |
| **D-6** | API margin: accept 80.02% or authorize API-T1 | API-T1 |
| **D-7** | Run the corrected Q4 (F-E1) | Yes, PO-run |
| **D-8** | Restore drill before release | PO risk decision |
| **D-9** | #85: same release or second | Second, per IR-1 |
| **D-10** | #64 in the release merge | Yes |
| **D-11** | Disposal of PR #90 (close, delete branch) after review | After PA confirms it is no longer needed |

## 12. Scope compliance

- **Code:** one E2E spec on PR #80, and PR #80's own report. No application, API-test or mobile-test change was committed.
- **Probes:** the mobile and API probes ran only in a disposable detached worktree (`../Noetia-ir3a-tmp`), removed afterwards. Nothing from it was committed or pushed.
- **Not touched:** #87, #90, #64 and every other source PR; thresholds, exclusions, Jest config, dependencies, lockfiles, workflows, repository settings, Environments, secrets.
- **Not performed:** merge, deployment, SQL, Q4, server, staging or production access, EAS build or OTA, spending. GitHub settings were only **read** (secret *names* only).
- **No workflow ran:** the push to #80's branch and this docs branch match no trigger. This docs PR is based on the IR-1 docs branch, not `main`, **because a PR into `main` would run an E2E job that defaults to `https://noetia.app` on that tree** (IR-1 finding).
- **Resources:** one job at a time, `--maxWorkers=2`, $0.

**Sources [D]:** GitHub Docs: *Deployments and environments*; *About rulesets*; *About protected branches*; *Control workflow concurrency*.

**STOP FOR INDEPENDENT PRODUCT ARCHITECTURE REVIEW.** The Product Owner retains authority over all subsequent engineering, quality-gate and release decisions.
