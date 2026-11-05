# NEM-016: integrated staging candidate rc2

> Preparation report. **Nothing was deployed.** No SSH or VPS access, no staging or production request, no change to staging accounts, books, databases or storage, no orphan-image clean-up, no change to Traefik or AutoGuildX, no NEM-018 work, and no merge into `main`. All tests ran on this machine on disposable stacks. **Local results are not staging validation.**

## 1. Mission and objective

Prepare one reproducible NEM-016 staging release candidate that combines the implementation (PR #25), the acceptance harness (PR #30), the F1/F2 corrections (PR #31) and the R1/R2 corrections with the R3 audit (PR #32), using PR #29 as the earlier integration evidence.

## 2. Date and status

- **Date:** 2026-11-04
- **Status:** candidate prepared. Awaiting Product Owner review. Staging deployment is **not authorized**.
- **Verdict: PASS for local readiness. Deployment BLOCKED only on Product Owner authorization and the decisions in §10.**

## 3. Scope and exclusions

**In scope:** a dedicated candidate branch, protection and migration checks, the full local test suite, a release-readiness audit, a proposed procedure and a rollback plan.

**Excluded, as instructed:** every live operation, merging, the orphan-image clean-up, Traefik, AutoGuildX, NEM-018, and general-upload timeout hardening (still the design in the PR #32 report, §5.4, and not implemented).

## 4. Executive summary

- **Candidate: `dda5f9937c5571ac477c96076d59af9fe400b158`**, branch `staging-candidate/nem-016-rc2`. Tree `31b7277c27152c56a5910c5749dbf6b9473e88eb`.
- **No integration conflict.** The source PRs form one linear stack, so the candidate is the tip of PR #32, with no merge commit, cherry-pick or edit. No product or security decision was needed.
- **Against `aaf708e`, the commit staging is expected to run, the change is small to deploy:** only `services/api` and `services/image-gen` change. No migration, dependency, environment variable, Compose, web, worker or mobile change.
- **All local suites passed** (§9): 1209 API, 304 web, 188 mobile, 8 worker, 270 image-gen and 89 harness tests, plus every end-to-end script.
- **New: upgrade and rollback were rehearsed end to end, 53 of 53.** Rolling back from the candidate to `aaf708e` leaves the data untouched, keeps revocations in force, and the old sweep drains deletions the candidate queued.
- **Rollback is code-only and must not restore the database.** The rehearsal shows a restore brings back a share whose image is gone, and loses a share whose image stays public.
- **Staging can't produce an ACCEPTED verdict yet.** X9 and A14b stay BLOCKED there because the harness never deletes books on staging, and A13 can't be replayed. This needs a decision (§10).
- **Not fixed and still open:** F3, the upload hang, old orphaned images, and GitHub's coverage jobs, which already fail on `main` (§7).

## 5. Verified findings

**Evidence classes:** **[V]** verified in git or locally · **[PO]** stated by the Product Owner · **[U]** unverified, needs a read-only host check.

### 5.1 Exact commits

| PR | Branch | Head | In the candidate | Class |
|---|---|---|---|---|
| #25 implementation | `fix/nem-016-sa001-stage0-sharing-integrity` | `054b95f` | Yes, through merge `aaf708e` | V |
| #29 earlier integration | `docs/nem-016-integrated-staging-candidate` | `351c833` | Yes | V |
| #30 harness | `test/nem-016-acceptance-harness` | `239184c` | Yes | V |
| #31 F1/F2 | `fix/nem-016-f1-f2-share-lifecycle` | `a90b646` | Yes; app fix `74b8cfb` | V |
| #32 R1/R2/R3 | `fix/nem-016-residual-risks` | `dda5f99` | **Is the candidate**; app fix `2a8df49` | V |
| `main` | | `6a5e5c0` | Contained; nothing on `main` is missing | V |
| NEM-017 baseline | `deploy/nem-017-on-006c` | `9192c50` | Contained | V |

Nine commits sit between `aaf708e` and the candidate. No file is deleted compared with `aaf708e` or with PR #25's head [V].

### 5.2 What deploying it changes

Compared with `aaf708e`: 58 files, +6209 / −63, mostly harness and reports. Application source:

| Service | Files |
|---|---|
| `services/api` | `books.module.ts`, `books.service.ts`, `sharing.service.ts`, `share-lifecycle.service.ts`, `quote-integrity.service.ts`, `card-key.ts`, `orphan-image-audit.ts`, `audit-orphan-images.ts`, `social.controller.ts`, `storage.service.ts` |
| `services/image-gen` | `storage.py` |

**Byte-identical to `aaf708e` (same git object) [V]:** `services/api/src/migrations`, `docker-compose.staging.yml`, `docker-compose.server.yml`, `.env.staging.example`, `infra/server`, `scripts`, `pnpm-lock.yaml`, `services/api/package.json`, both changed services' Dockerfiles, and all of `services/web`, `services/worker` and `services/mobile`.

### 5.3 Protections preserved

| Protection | Evidence on the candidate | Class |
|---|---|---|
| Ownership, eligibility, background safety, duplicate prevention, deletion | Harness automated checks, 47 of 47; the negative control on `9192c50` still fails A1, A3, A4, A5, A7, A10, A12, A14, A15 and X1 | V |
| Quotation integrity | A2–A5 and A19. Only one source read gained a time limit; the comparison logic is unchanged. The rehearsal also refuses an altered quote with 422 | V |
| F1, stalled storage on deletions | 204 in about 5 s, paused and stopped; the sweep recovers | V |
| F2, book deletion withdraws shares | X9 and X8.book pass; images 404 | V |
| R1, share creation against book deletion | Forced interleavings fail on `a90b646` and hold on the candidate | V |
| R2, bounded share paths | Quote read 503 in 15 s; render 502 in 6–8 s; publish 502 in 10 s; sockets close | V |
| R3, audit is read-only | Listing, shares and outbox identical before and after. It has no delete mode | V |
| NEM-017 isolation | `run.sh` 30 of 30; compose and Traefik files unchanged | V |
| Reader and Escucha Activa | No reader, sync or audio file changes against `aaf708e`. **The manual reader test A20 hasn't run** | V for code; open at runtime |

### 5.4 Migration compatibility

| Finding | Class |
|---|---|
| No migration between `aaf708e` and the candidate; the directories are the same git object | V |
| The candidate reports no pending migration on an `aaf708e` schema at 068, before and after a rollback | V |
| R1 uses row locks, not schema | V |
| From the older `9192c50` schema, the earlier rehearsal still passes with this candidate, 45 of 45: exactly 067 and 068 pending, with failure drills and rollback | V |
| **Staging is at `aaf708e` with 068 applied** | PO, **U**; P0 stops if not |

If P0 finds staging isn't at `aaf708e` and 068, **stop**. This procedure doesn't apply, and 067 and 068 would need the PR #29 path.

### 5.5 Harness protection of existing staging records

The administrator `4219d326-b9fc-4aa9-8d35-6ce8b9e6e787` and CC0 fixture `68303e17-3a80-4f17-b3c1-8be00a66cc71` are pinned in `lib/guard.mjs`. These ids come from the Product Owner's brief; the first harness step checks the fixture, and baseline evidence checks the administrator.

Probed in-process with a fetch that counts calls and fails. **All were refused, with 0 network calls [V]:**

| Attempt | Result |
|---|---|
| Create a book, even flagged as the fixture upload | Refused |
| Delete the fixture, even when listed as deletable | Refused |
| Update the fixture; delete the administrator by id; update `/users/me`; any admin route | Refused |
| Log in as the administrator on staging | Refused |
| Fetch an image from the production storage origin | Refused |
| Use the administrator's or any non-synthetic address as a test account | Refused |
| Target missing, production, or `local` aimed at a non-loopback host | Refused |
| Staging with no authorization, one naming another commit, or a short SHA | Refused |
| Generate admin SQL for staging | Refused |

X6.admin and X6.protected passed in every local run. Staging clean-up also needs its own `--approve cleanup`.

**The authorization phrase is a speed bump, not approval.** Anyone can type it, so approval stays with the Product Owner.

On the candidate, X8 is no longer BLOCKED by the SHA check. X9 and A14b stay BLOCKED on staging by design.

### 5.6 Release-readiness audit

| Area | Finding | Result |
|---|---|---|
| Configuration | No new or changed environment variable; new limits are constants | Pass |
| Dependencies | Lockfile and `requirements.txt` unchanged. `storage.py` now imports `certifi` and `urllib3` directly, which are **transitive and unpinned**. Both local images resolve `urllib3 2.8.0` and `certifi 2026.10.23`; `pip check` is clean | Pass; P6 checks the host |
| API health | Compose healthcheck on `/health`; `--wait` covers it | Pass |
| image-gen health | **No Compose healthcheck**, so `--wait` only proves it's running. P6 adds an explicit probe | Handled in procedure |
| Worker health | No healthcheck; not recreated | Not applicable |
| Mixed versions | The API-to-image-gen request is unchanged except for a client timeout | Pass |
| Shutdown | Staging has no `init: true`, so stopping the API may wait for the 10 s kill, as at `aaf708e`. Not measured | Accepted |
| Secrets | No credential-like value in the diff; only local test placeholders | Pass |
| Branch safety | `cd.yml` triggers only on `main`, `cd-staging.yml` only on exact `staging`. `staging-candidate/nem-016-rc2` triggers neither | Pass |
| Rollback | §8 | Rehearsed |
| Lint and types | API ESLint: 0 errors, 262 warnings. `tsc` passes for API, web, mobile and worker | Pass |

## 6. External references

None needed. Tools tested: Docker 29.9.1, Compose 5.6.0, Node 20.20.2, `pgvector/pgvector:pg16`, `redis:7-alpine`, and the local `minio/minio:latest`, an image about 14 months old.

## 7. Risks

| Level | Risk | Handling |
|---|---|---|
| **High** | **A merge of PR #25 alone ships F1, F2, R1 and R2.** This branch can't go to `main` either: it also carries the staging baseline | Keep #25 blocked; decision 7 |
| **Medium** | **F3:** `Event` writes `userId`, migration 057 has `user_id`, so emitted events fail with `column "userId" of relation "events" does not exist`. Seen on both `aaf708e` and the candidate; on `main` since `4e0705f`. The persona pipeline reads `events`. Production unverified | Not fixed; decision 6 |
| **Medium** | **Staging can't reach ACCEPTED** while X9, A14b and A13 stay BLOCKED | Decision 3 |
| **Medium** | R1 can't be forced on staging, so its evidence is local | Decision 4 |
| **Medium** | General uploads still hang on a stalled store | Excluded here; separate decision |
| **Medium** | Old orphaned card images stay public. Their number is unknown | Clean-up excluded; audit not run |
| **Medium** | Builds share the host with production (image-gen 1.6 GB, API 1 GB) | G5; quiet window; production check |
| **Medium** | While rolled back to `aaf708e`, F1, F2, R1 and R2 return | Don't delete books or stall storage while rolled back |
| **Low** | A deploy during a render can leave an unreferenced card | Quiet window; audit reports these as ambiguous |
| **Low** | Local tests had no Traefik or TLS, used plain-HTTP MinIO, and Docker 29.9.1 rather than the host's recorded 29.4.3 | P6 and P7 on staging |
| **Low** | GitHub CI doesn't run here, because `ci.yml` only targets PRs into `main` | Local evidence only; see below |

**GitHub coverage jobs already fail on `main`.** PR #20, `main`'s tip, fails the API, web and mobile unit jobs on GitHub. Locally all tests pass, and only the global 80% coverage threshold fails:

| Service | Candidate: statements / branches / functions / lines | `main`: same order |
|---|---|---|
| API | 91.89 / **71.68** / 89.53 / 93.06 | 90.46 / **68.83** / 87.56 / 91.80 (one suite didn't load; see §9) |
| Web | **73.46 / 74.58 / 52.02 / 72.26** | **72.80 / 72.44 / 51.74 / 71.61** |
| Mobile | **30.22 / 15.29 / 21.24 / 31.75** | **29.61 / 14.17 / 20.86 / 31.28** |
| Worker | 100 / 100 / 100 / 100 | Not measured |
| image-gen | 94.64 total | Not measured |

The candidate doesn't lower any figure, but it doesn't meet the project's 80% rule for those three services either. `audit-orphan-images.ts` is also outside the API's coverage scope; earlier measured at 51% lines, and exercised by the real run.

## 8. Proposed staging deployment and rollback (not executed)

Requires separate authorization. Every command is one line, run from `/opt/noetia-staging`. Never run `git clean`, never push to a branch named `staging`, and never run a production compose file here.

`alias dcs='docker compose -p noetia_staging --env-file .env.staging -f docker-compose.staging.yml'`

### Gates: all must pass before P1

| Gate | Requirement | Owner |
|---|---|---|
| G0 | Authorization naming `dda5f9937c5571ac477c96076d59af9fe400b158` | PO |
| G1 | Checkout at `aaf708e…`; only `reports/staging-content/` untracked | Operator |
| G2 | NEM-017 isolation holds | Operator |
| G3 | Latest migration is 068 | Operator |
| G4 | SMTP empty; Stripe test key; `SHARE_BG_ALLOWED_HOSTS` unset | Operator |
| G5 | At least 5 GB free; no production deploy running; quiet window | Operator |
| G6 | Restore point and storage manifest written | Operator |

### P0. Read-only pre-flight, then restore point

| # | Command | Expected |
|---|---|---|
| 1 | `git rev-parse HEAD && git status --short` | `aaf708e93a8f4fff33570f0628813782c5d18ac5`; only `reports/staging-content/` untracked |
| 2 | `ls reports/staging-content \| wc -l` | Record the count |
| 3 | `dcs ps` | All running; those with healthchecks healthy |
| 4 | `docker network inspect proxy -f '{{range .Containers}}{{.Name}} {{end}}'` | No `noetia_staging-*` |
| 5 | `docker network inspect proxy_staging -f '{{range .Containers}}{{.Name}} {{end}}'` | `traefik` and staging `api`, `web`, `storage` |
| 6 | `dcs exec -T db psql -U noetia -d noetia_staging -c "SELECT count(*), max(timestamp) FROM migrations;"` | Latest `1748300000068` |
| 7 | `dcs exec -T db psql -U noetia -d noetia_staging -tA -c "SELECT count(*) FILTER (WHERE \"revokedAt\" IS NULL), count(*) FROM shares; SELECT count(*) FROM card_image_deletions;"` | Record the counts. Any outbox rows should be understood first |
| 8 | `grep -c '^SMTP_HOST=$' .env.staging; grep -c '^STRIPE_SECRET_KEY=sk_test_' .env.staging; grep -c '^SHARE_BG_ALLOWED_HOSTS=' .env.staging` | `1`, `1`, `0` (counts only) |
| 9 | `df -h / && free -h` | G5 |
| 10 | `dcs exec -T db pg_dump -U noetia -d noetia_staging -Fc > /root/staging-pre-rc2-$(date +%F).dump && ls -la /root/staging-pre-rc2-*` | Non-empty file |
| 11 | `dcs exec -T storage sh -c 'MC_HOST_l=http://$MINIO_ROOT_USER:$MINIO_ROOT_PASSWORD@127.0.0.1:9000 mc ls --recursive --json l/images' > /root/staging-pre-rc2-images-$(date +%F).json && wc -l /root/staging-pre-rc2-images-*` | Non-empty listing. If the image has no `mc` or the credentials need URL-escaping, stop and report; don't improvise |
| 12 | `docker tag noetia_staging-api:latest noetia_staging-api:rollback-aaf708e && docker tag noetia_staging-image-gen:latest noetia_staging-image-gen:rollback-aaf708e` | Both succeed. Adds a tag only; used for a fast rollback |

**Stop on any unexpected result.** The manifest holds object names and checksums, not secrets. It's a record for checking consistency, not a backup: MinIO deletions can't be undone from it.

### P1. Pin the candidate

`git fetch origin && git checkout --detach dda5f9937c5571ac477c96076d59af9fe400b158`

`git rev-parse HEAD` must print the full SHA, and the count from step 2 must not change.

### P2. Build only what changed; the old containers keep serving

`dcs build api image-gen`

Confirm production is healthy afterwards.

### P3. Confirm no migration is pending; this writes nothing

`dcs run --rm --no-deps -l traefik.enable=false -e DB_HOST=db api node node_modules/typeorm/cli.js migration:show -d dist/data-source.js`

There must be **no `[ ]` line**. If there is one, stop and go to RB1 below.

### P4. Preview

`dcs up -d --no-deps --dry-run api image-gen`

Only `api` and `image-gen` may appear. **If anything else does, stop.**

### P5. Start

`dcs up -d --no-deps --wait --wait-timeout 300 api image-gen`

### P6. Verify

| Check | Command | Expected |
|---|---|---|
| API health | `dcs exec -T api wget -qO- http://127.0.0.1:4000/health` | Healthy |
| image-gen health | `dcs exec -T image-gen python -c "import urllib.request as u; print(u.urlopen('http://127.0.0.1:5000/health', timeout=3).status)"` | `200` |
| image-gen dependencies | `dcs exec -T image-gen pip check` | No broken requirements |
| Isolation | P0 steps 4 and 5 again | Unchanged |
| Data | P0 steps 6 and 7 again | Unchanged |
| Logs | `dcs logs --tail 200 api image-gen \| grep -iE "error\|exception"` | Only known items; F3 may appear once events are emitted |
| Web and API through Traefik | RUNBOOK "Verify staging" | 200 |
| Production | RUNBOOK "Confirm production unaffected" | Healthy |
| Reader smoke | Open a seeded book with audio | Escucha Activa works; A20 confirms it fully |

### P7. Acceptance, each named by the Product Owner

Use the harness with `NEM016_DEPLOYED_SHA=dda5f9937c5571ac477c96076d59af9fe400b158`, `infra/tests/nem-016-acceptance/README.md`, and `MANUAL-CHECKLIST.md`, including A16 and A20. Disruptive tests stay separately approved: A8b, A11, A12, A15, A19 and X8. **Note that A11's and X8's storage interruptions affect only staging's MinIO, but must be run from the host.**

### Rollback

| Failure at | State | Action | Consistency |
|---|---|---|---|
| RB1: P0–P4 | Nothing live changed | `git checkout --detach aaf708e93a8f4fff33570f0628813782c5d18ac5` | Nothing to reconcile |
| RB2: P5 onward | New code misbehaving; schema unchanged | The four steps below | Data untouched; rehearsed |
| RB3: data damage only | Not a code problem | **Stop and ask the Product Owner**; see below | Restoring is destructive |
| RB4: going below `aaf708e` | Old code ignores revocations | **Not part of this rollback.** PR #29 §9 applies and needs a decision | Revoked shares would be served again |

**RB2 steps, one line each:**
1. `git checkout --detach aaf708e93a8f4fff33570f0628813782c5d18ac5`
2. `docker tag noetia_staging-api:rollback-aaf708e noetia_staging-api:latest && docker tag noetia_staging-image-gen:rollback-aaf708e noetia_staging-image-gen:latest`
3. `dcs up -d --no-deps --wait --wait-timeout 300 api image-gen`
4. Repeat P6, then check that `SELECT count(*) FROM card_image_deletions;` reaches 0 within about 10 minutes once storage is up.

If the tags are unavailable, use `dcs build api image-gen` at step 2 instead.

**Rules that keep the database and storage consistent:**
- **Don't restore the dump and don't run `migration:revert` as part of a code rollback.** The schema doesn't change.
- **Don't clear `card_image_deletions` by hand.** Those rows are the only record of images that must go. `aaf708e`'s sweep reads them correctly.
- **Revocations stay in force.** `aaf708e` honours `revokedAt`, including those the candidate wrote.
- **While rolled back:** no book deletions (F2) and no storage interruption (F1).
- **Roll forward** by repeating P1, P2, P4, P5 and P6. Rehearsed; the data doesn't change.

**Why not restore?** Rehearsed in the disposable stack. After a restore to the point before deployment:

| Share | In the restored database | In storage | Result |
|---|---|---|---|
| Revoked after the dump | **Live again** | Image already deleted | A withdrawn quote is served again, with a broken image |
| Created after the dump | **Gone** | Image still public | A public image with no record |

Restoring therefore needs a Product Owner decision, comparing the dump's shares and the outbox with the P0 manifest, and re-applying revocations made after the dump. **Don't delete objects to reconcile them**; orphan clean-up isn't authorized.

**Must survive every path:** `reports/staging-content/`, the administrator, the fixture, and the P0 dump and manifest. **MinIO deletions can't be undone by any path.**

## 9. Tests and verification performed

All local, on the exact candidate tree. Images were built from `git archive` of each exact commit. Worktree `HEAD` was `dda5f99`; the only additions were the two rehearsal files published here, which change no application code. After every run, no test container or network remained.

| Suite | Result |
|---|---|
| API unit tests | **1209 passed, 80 suites** |
| Web unit tests | **304 passed** |
| Mobile unit tests | **188 passed** |
| Worker unit tests | **8 passed** |
| image-gen `pytest`, in the built image with no network | **270 passed**, 94.64% coverage |
| Harness unit tests | **89 passed** |
| `tsc` for API, web, mobile, worker | Pass |
| API ESLint | 0 errors |
| `run-local.sh`: full matrix, clean-up, negative control | **80 of 80**; **47 of 47** automated checks PASS |
| `run-f1-f2.sh` (F1, F2, both outage modes, real sweep) | **41 of 41** |
| `run-r1-r2.sh` (R1, R2, R3) | **35 of 35** |
| `upgrade-rollback-rehearsal.sh` (new; exact flags from §8) | **53 of 53** |
| `migration-rehearsal.sh` (`9192c50` to candidate) | **45 of 45** |
| NEM-017 `network-isolation/run.sh` | **30 of 30** |
| `oneoff-labels-check.sh` | Label inherited; 150 of 150 served correctly in both variants |
| Retag rollback, throwaway project | Dry run lists only named services; retag recreates and rolls back; an unrelated service is left alone |
| API restarts, unhandled rejections, tokens in reports | 0, 0, 0 |

**R1 regression, forced interleavings:** on `a90b646`, X10.render, share-first, delete-first, double-delete and concurrent all fail; on the candidate, all nine X10 scenarios hold. X10.stress passed on the broken code too in this run. It's probabilistic, so the forced cases are the proof.

**Performance, small local samples:** share p50 53 ms on `a90b646` and 56 ms on the candidate; book deletion p50 22 ms and 13 ms. Within noise on this loaded machine.

**Local matrix verdict:** INCOMPLETE, 17 PASS, 0 FAIL, 0 BLOCKED, 17 NOT RUN. Those NOT RUN have manual or staging-only checks outstanding, so this is the expected local result and not a staging verdict.

### Failures along the way

| What happened | Cause | Handling |
|---|---|---|
| First API run: 1 suite failed to load, 1201 tests | My clean install: pnpm 10 skipped `bcrypt`'s native build. **Not the candidate** | Built the binding in the worktree; complete re-run gives 1209. Nothing committed |
| Jest exits 1 on API, web, mobile | The coverage threshold only; no test failed | Reported in §7 |
| Rehearsal first run: 51 of 53 | My check counted F3's log line as a schema error | Now fails on anything except that exact message and reports F3's count. F3 appeared on both commits. Re-run 53 of 53; repeated with the §8 flags, 53 of 53 |
| `main` API baseline: 1 suite failed to load, 940 tests | The same `bcrypt` gap in that temporary worktree | Those `main` API coverage figures are approximate; GitHub's failure on PR #20 is the independent evidence |
| CLI guard probes stopped at the run-id check, proving nothing | My probe | Replaced with the in-process probes in §5.5 |

### Not done, and limitations

- **No staging test.** No acceptance test ran on staging, so Traefik, TLS and real seeded data aren't exercised.
- **Manual checks haven't run,** including mobile (A16) and the protected reader (A20).
- **GitHub CI and Playwright weren't run on this candidate.** `services/web` is unchanged from `aaf708e`. Playwright passed on PR #25 at `054b95f`, before the staging baseline was merged.
- **Web and worker images weren't rebuilt.** Their trees are identical to `aaf708e`, built in PR #29, and they aren't redeployed.
- **`rollout.sh` wasn't re-run.** It rehearses the NEM-017 network move; those files are unchanged.
- **The P0 storage manifest was tested on the local MinIO image only.** Staging's image may differ.
- **The retag rollback was tested in a throwaway project,** using staging's Compose flags but not staging's image names. P0 step 12 confirms the names.
- **Not verified on the host:** deployed commit, migration state, environment values, disk space, and that the administrator and fixture exist as described.

## 10. Open questions and Product Owner decisions required

| # | Decision | Recommendation |
|---|---|---|
| 1 | **Authorize deployment of `dda5f99` by name,** with the procedure in §8? | Your call; ready from the code side |
| 2 | Approve the disruptive tests by name: A8b, A11, A12, A15, A19, X8, and the clean-up? | Approve the list you want, with the operator present |
| 3 | **How should F2 and A13 be judged on staging?** X9 and A14b never run there, and A13 can't be replayed, so the verdict can only be INCOMPLETE | Accept local evidence in writing. Alternatively approve a disposable book, which needs a harness change and new review. Don't use the fixture |
| 4 | Accept local evidence for R1, and the limits 15 s, 10 s, 30 s, 3 s and 8 s? | Yes, unless staging shows otherwise |
| 5 | Who runs it, and when? | Operator with you present, in a quiet window |
| 6 | **F3:** fix it, and verify production read-only? | Yes, as its own change |
| 7 | **The route to production.** Merging this branch would bring staging-only baseline content; PR #25 alone lacks the fixes | Bring `74b8cfb`, `2a8df49` and `dda5f99`'s comment fix to #25 only after staging acceptance. #25's other merge conditions remain |
| 8 | The 80% coverage rule on API, web and mobile, already failing on `main`? | Separate decision. It keeps CI red, which hides real regressions |

**Decisions still open from earlier reports:** the upload design and the R3 audit and clean-up policy (PR #32 §10), and the legacy-share audit (PR #25).

## 11. Changes made

| Item | Purpose |
|---|---|
| `staging-candidate/nem-016-rc2` at `dda5f99` | The candidate. Pushed as is; no new commit |
| `docs/nem-016-rc2-report`, on top of the candidate | This report and the rehearsal, so the candidate SHA stays pure |
| `infra/tests/staging-candidate/upgrade-rollback-rehearsal.sh`, `upgrade-rollback-driver.mjs` | Upgrade, rollback and roll-forward rehearsal, local only |
| This report | Deliverable |

The `docs/reports/README.md` index isn't on these branches (it's on PR #23), so no index was updated.

**Not modified:** `main`; PRs #25, #29, #30, #31, #32 and their branches; application code; migrations; CI/CD; staging; production; Traefik; AutoGuildX; NEM-018.

**Protected systems:** reader, Escucha Activa, permanent ownership, payments and business rules weren't touched by this work.

## 12. Next recommended action

The Product Owner reviews this report and decides §10. **Nothing runs on staging until then.** Recommendation only: decide 1 to 5 together, since they define the deployment window.
