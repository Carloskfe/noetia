# NEM-016: integrated staging candidate preparation

> Preparation report (agent reporting protocol). **Nothing was deployed.** No SSH or VPS access, no live database access, no live migration, no Traefik restart, no change to `/opt/noetia-staging`, and no change to NEM-016, NEM-017 or NEM-018 branches. All tests were local and disposable. **Local results are not staging validation.**

## 1. Mission and objective

Prepare an integration candidate combining NEM-016 (Draft PR #25) with the NEM-017 network-isolated staging baseline, verify it locally, and propose a migration-first staging procedure.

## 2. Date and status

- **Date:** 2026-11-03
- **Status:** preparation complete. Awaiting Product Owner review. Staging execution is **not authorized**.
- **Classification: READY FOR EXECUTION REVIEW.** No code or merge problem was found. Execution depends on the gates in §10.

## 3. Scope and exclusions

**In scope:** a separate integration branch, Compose validation, unit tests, image builds, a migration rehearsal with real images, this report.

**Excluded:** every live operation, the NEM-016 acceptance matrix (it needs staging), the production audit, the production deployment decision, NEM-018.

## 4. Executive summary

- **The candidate is a clean merge:** `staging-candidate/nem-016` at **`aaf708e93a8f4fff33570f0628813782c5d18ac5`**, no conflicts and no manual edits.
- **NEM-017 isolation is preserved exactly.** `proxy_staging`, Traefik labels, resource limits, the isolation tests and the seeding script are byte-identical to the live baseline. The NEM-017 suite passes 30/30.
- **NEM-016 is preserved exactly.** Compared with PR #25's head, the candidate differs only by the 28 baseline files.
- **Migration 067 comes with it.** You asked for 068, but NEM-016 is based on `main`, so **067 (plan display prices)** and 10 other `main` commits also reach staging. 067 and 068 run in one transaction. This needs your explicit approval (§10, decision 1).
- **The migration-first procedure works locally.** All 45 rehearsal checks pass using real images built from `9192c50` and `aaf708e`, including both failure drills, the old API on the new schema, and rollback.
- **The rollback has one real constraint:** after any share is revoked, old code would serve it again, and 068's `down` refuses to run. Full return then means restoring the dump, and MinIO deletions can't be undone.
- **Part of NEM-016's staging plan is out of date** and is corrected in §8: its "staging sync maps are empty" premise, its S19 check, and its host-local merge step.

## 5. Verified findings

**Evidence classes:** **[V]** verified in git or locally · **[PO]** stated by the Product Owner · **[U]** unverified, needs a read-only check on the host.

### 5.1 Exact commits

| Item | Commit | Class |
|---|---|---|
| Live staging baseline, `deploy/nem-017-on-006c` | `9192c50e07357876e9f1e197c3dd6b640d13d098` | V; live pin PO |
| NEM-016, `fix/nem-016-sa001-stage0-sharing-integrity` | `054b95fed03fed065ee9a6fc5f308ff26404153c` | V |
| `main`, already contained in NEM-016 | `6a5e5c0850a73a9de432be87d5be647bd138dbe7` | V |
| Merge base of baseline and NEM-016 | `9e682fb30d308dcef913cc5210ea4a25be106a00` | V |
| **Candidate**, `staging-candidate/nem-016` | **`aaf708e93a8f4fff33570f0628813782c5d18ac5`** | V |

The candidate is a single `--no-ff` merge: parent 1 is `9192c50`, parent 2 is `054b95f`. Its tree (`502482a`) equals what `git merge-tree` computed before the merge, so it has no manual edits.

**It adds 28 commits to the baseline:** 17 from NEM-016 and 11 from `main`.

Source branches are unchanged after the push: `9192c50`, `054b95f`, `6a5e5c0`. NEM-018's branch is still `35ab50b`. **No branch named `staging` exists**, so `cd-staging.yml` isn't armed.

### 5.2 Changed files

Compared with the live baseline: **85 files, +5316 / −663**.

| Area | Files | Contents |
|---|---|---|
| `services/api` | 55 | NEM-016 sharing, lifecycle, audit tool, migrations 067 and 068, tests; `main`'s lint fixes and graceful shutdown |
| `services/web` | 10 | ShareModal refusals, i18n, `share-utils`; `main`'s lint and e2e fixes |
| `services/mobile` | 4 | Share sheet, i18n |
| `services/image-gen` | 2 | Background loading restrictions, tests |
| `services/worker` | 1 | ESLint config |
| `docs` | 8 | NEM-016 record, report, fixture, S19 reproduction; `main`'s docs |
| Root | 5 | `.eslintrc.base.js`, `CLAUDE.md`, `pnpm-lock.yaml`, `.github/workflows/cd.yml`, `docker-compose.server.yml` |

The last two root files are production files and are inert here: staging doesn't read them, and this branch doesn't trigger `cd.yml`. Both are identical to `main`.

**Byte-identical to the baseline (empty diff):** `docker-compose.staging.yml`, `.env.staging.example`, `.github/workflows/cd-staging.yml`, everything under `infra/` and `scripts/`, `services/web/Dockerfile`, `services/web/next.config.js`. Bind-mounted files under `infra/` are therefore unchanged too.

### 5.3 NEM-017 guarantees

From `docker compose config` on the candidate, with throwaway values [V]:

| Service | Networks | `traefik.docker.network` | Limits |
|---|---|---|---|
| `api` | `noetia_staging_net`, `proxy_staging` | `proxy_staging` | 0.75 CPU, 384M |
| `web` | `noetia_staging_net`, `proxy_staging` | `proxy_staging` | 0.75 CPU, 384M |
| `storage` | `noetia_staging_net`, `proxy_staging` | `proxy_staging` | 0.5 CPU, 512M (NEM-006C) |
| `db` | `noetia_staging_net` | none | 0.75 CPU, 512M |
| `image-gen` | `noetia_staging_net` | none | 0.5 CPU, 384M |
| `search` | `noetia_staging_net` | none | 0.25 CPU, 256M |
| `worker` | `noetia_staging_net` | none | 0.5 CPU, 192M |
| `cache` | `noetia_staging_net` | none | 0.25 CPU, 128M |

No service references `proxy`. Volumes are only the four `*_staging` ones.

The real web build has the staging API in 26 static files and `https://noetia.app/api` in **0**.

### 5.4 Migration compatibility

| Finding | Class |
|---|---|
| Baseline stops at 066; candidate adds 067 and 068, and `migration:show` lists exactly those two | V |
| **067 and 068 run in one transaction.** When 068 hit its lock timeout, 067's price changes rolled back too | V |
| 067 aborts everything if a plan row has an unexpected price or is missing. A fresh chain has the expected values (`999`, `8900`, `1499`, `13500`) | V |
| The live staging DB is at 066 with those prices | **U**, gate G3 |
| **Old API on the new schema works** (A13): health, shares read, unknown share 404, no column errors | V |
| New API on the new schema works; new API on the old schema does not, which is why migration comes first | V; second part from NEM-016 §14.5 |
| **Legacy shares of ineligible books become 404 under the new code.** This is intended (S14), but it's a visible behaviour change | V |
| 068 fails in about 11 s when `shares` is locked, with no partial state | V |
| The P0 dump restores to 066 after dropping the database | V |

### 5.5 Corrections to the NEM-016 staging plan

| NEM-016 report says | Now | Effect |
|---|---|---|
| §15.2: staging sync maps are empty, so every ingested book fails the gate | NEM-006C seeded real sync maps for titles that reach coverage | A14 must select a book **below** the gate with a read-only query. A real eligible book can now also be tested (§8, A19). The fixture is still valid |
| §15.3 P0.4 / §16.6: S19 is NO-GO | NEM-017 is the live baseline [PO]. Replace with the RUNBOOK isolation checks | Lifted only if G2 passes on the host |
| §15.3 P1: merge on the host against `nem-006a-staging` | Use the pushed, pinned candidate | No merge on the host; no moving parts |
| §15.3 P3: plain `dcs run` | The one-off container **inherits `traefik.enable=true`**. Locally Traefik ignored it because its health is `starting`, with 150/150 requests served correctly. Adding `-l traefik.enable=false` also passed and removes the dependence on health timing | Procedure adds the label |

### 5.6 Drift inherited from `main`

- `main.ts` now calls `enableShutdownHooks()`, and its comment says that needs `init: true`, which production has and staging's compose doesn't. Staging's compose was deliberately left unchanged. The worst case should be a 10 s kill on stop, as before; not measured.
- Production also gained `start_interval: 5s`. Without it, a recreated staging API may take about 30 s to get traffic. `--wait` covers this in the procedure.

## 6. External references

None needed. Tools tested: Docker 29.9.1, Compose 5.6.0, `traefik:v2.11`, `pgvector/pgvector:pg16`. The host runs Docker 29.4.3 per the NEM-017 record; that difference isn't tested.

## 7. Risks

| Level | Risk | Mitigation |
|---|---|---|
| **High** | Rolling code back after a revocation re-serves revoked shares (test data on staging, the same rule in production) | Roll forward; §9 |
| **Medium** | 067 changes staging's displayed plan prices along with 068 | Decision 1. Matches production and is reversible |
| **Medium** | Staging API is public by design, and test accounts exist during the run | `@staging.invalid` accounts; no production data |
| **Medium** | E-mail safety relies on an empty `SMTP_HOST`; `EMAIL_SAFE_MODE` isn't implemented in code | Gate G4 |
| **Medium** | Image builds share the host with production (images up to 1.61 GB; CPU and disk) | Quiet window; G5; production check after each step |
| **Medium** | A branch named `staging` would arm auto-deploy | The candidate is deliberately named `staging-candidate/nem-016` |
| **Low** | `reports/staging-content/` is untracked and could be lost | Never run `git clean`; `git checkout` leaves it alone, and the candidate doesn't track that path; check before and after |
| **Low** | A live `shares` lock makes the migration fail | Fails in about 11 s with no change; retry |
| **Low** | MinIO test objects aren't covered by the DB dump | Test data only |

**Still open from NEM-016 and not addressed here:** S16, S17, S18, the legacy-share audit, the production deployment option (§14.5), and the pending preview prompt (§13.7). **Merge of PR #25 stays blocked** by its own conditions.

**Separate open item:** NEM-018 concerns production and AutoGuildX on `proxy`. Staging is off that network, so it doesn't affect this procedure.

## 8. Proposed staging procedure (not executed)

Every command is one line, run from `/opt/noetia-staging`. Requires separate authorization. The alias is from the RUNBOOK:

`alias dcs='docker compose -p noetia_staging --env-file .env.staging -f docker-compose.staging.yml'`

**P0. Read-only pre-flight, then restore point**

| # | Command | Expected |
|---|---|---|
| 1 | `git rev-parse HEAD && git status --short` | `9192c50…`; only `reports/staging-content/` untracked |
| 2 | `ls reports/staging-content \| wc -l` | Record the count |
| 3 | `dcs ps` | All healthy |
| 4 | `docker network inspect proxy -f '{{range .Containers}}{{.Name}} {{end}}'` | No `noetia_staging-*` |
| 5 | `docker network inspect proxy_staging -f '{{range .Containers}}{{.Name}} {{end}}'` | `traefik` and staging `api`, `web`, `storage` |
| 6 | `dcs exec -T db psql -U noetia -d noetia_staging -c "SELECT count(*), max(timestamp) FROM migrations;"` | Latest `1748300000066` |
| 7 | `dcs exec -T db psql -U noetia -d noetia_staging -c "SELECT name, interval, \"amountCents\" FROM plans WHERE name IN ('Individual Monthly','Individual Annual','Dual Reader Monthly','Dual Reader Annual');"` | Exactly 4 rows, at `999`, `8900`, `1499`, `13500` (or already at the new values) |
| 8 | `grep -c '^SMTP_HOST=$' .env.staging; grep -c '^STRIPE_SECRET_KEY=sk_test_' .env.staging; grep -c '^SHARE_BG_ALLOWED_HOSTS=' .env.staging` | `1`, `1`, `0` (counts only) |
| 9 | `df -h / && free -h` | Enough room for the builds |
| 10 | `dcs exec -T db pg_dump -U noetia -d noetia_staging -Fc > /root/staging-pre-nem016-$(date +%F).dump && ls -la /root/staging-pre-nem016-*` | Non-empty file |

**Stop on any unexpected result.**

**P1. Pin the candidate:** `git fetch origin && git checkout --detach aaf708e93a8f4fff33570f0628813782c5d18ac5`

Check `git rev-parse HEAD` and `git status --short`, and that the count from step 2 is unchanged. Never `git clean`, and never push to `staging`.

**P2. Build; the old app keeps serving:** `dcs build api web image-gen worker`

Confirm production is healthy afterwards.

**P3. Migrate first**
1. `dcs run --rm --no-deps -l traefik.enable=false -e DB_HOST=db api node node_modules/typeorm/cli.js migration:show -d dist/data-source.js` must list only 067 and 068 as `[ ]`.
2. `dcs run --rm --no-deps -l traefik.enable=false -e DB_HOST=db api npm run migration:run:prod`

**P4. Confirm before starting new code**
- Schema: 3 new `shares` columns, `card_image_deletions`, both new indexes.
- Prices: the new four values; `SELECT count(*) FROM shares WHERE "revokedAt" IS NOT NULL` is 0.
- A13: the old app still serves `/health` and `/api/books`.

**P5. Preview, then start**
1. `dcs up -d --dry-run --remove-orphans` should list only `api`, `web`, `image-gen`, `worker` for recreation. **If `db`, `cache`, `storage` or `search` appear, stop.**
2. `dcs up -d --remove-orphans --wait --wait-timeout 300`

**P6. Verify:** the RUNBOOK "Verify staging" and "Confirm production unaffected" sections, then checks 4 and 5 from P0 again, then `dcs logs --tail 200 api image-gen | grep -iE "error|exception"`.

**P7. Acceptance:** NEM-016 §15.4 A1–A18, with these changes:
- **A14:** choose the book with `SELECT b.id, b.title FROM books b LEFT JOIN sync_maps s ON s."bookId"=b.id WHERE b."uploadedById" IS NULL AND b."isPublished" AND COALESCE(s."syncCoverage",0) < 0.90 LIMIT 5;`. If none exists, A14 can't run and must be reported as such.
- **A19 (new):** share a real seeded eligible book. An excerpt of its text is accepted, with `quoteProvenance.source = sync_map`; a changed word is refused.
- **A20 (new), the protected reader:** open a seeded book, play audio in Escucha Activa, and confirm highlight sync, progress and fragments still work. NEM-016 shouldn't affect them, and this run is what shows it.
- **Fixture:** A1–A13 still use the CC0 fixture from §15.2.

## 9. Rollback constraints

| Failure at | State | Action | Limits |
|---|---|---|---|
| P0–P2 | Nothing live changed | `git checkout --detach 9192c50e07357876e9f1e197c3dd6b640d13d098`; remove unused images | None |
| P3 | Transaction rolled back; old app serving | Inspect, then retry. Nothing to undo | Rehearsed for both 067 and lock failures |
| P4 | Schema applied, old app serving | Stay there safely (A13), or revert as below | None |
| P5–P6, no revocation yet | New code unhealthy | Checkout `9192c50`, then `dcs up -d --build --remove-orphans`. Keep the schema | Old code works on the new schema |
| After any revocation or deletion | Old code would **serve revoked shares again** and doesn't drain the outbox | **Roll forward.** Otherwise treat it as a decision: on staging it's test data | §13.4 of the NEM-016 report |
| Schema revert | `migration:revert:prod` reverts one migration per run, 068 first | **068 refuses** while revoked shares or queued deletions exist. Don't delete them without approval | Rehearsed |
| Full return to the pre-run state | Stop `api`, `web`, `worker`; recreate the database; `pg_restore` the P0 dump; old code | Rehearsed locally | **Destructive on the staging DB; needs approval** |

**Can't be undone by any of these:** MinIO card-image deletions; MinIO test objects stay behind after a DB restore; any Redis rate-limit keys, until they expire.

**Must survive every path:** `reports/staging-content/`.

## 10. Staging execution gates and Product Owner decisions

**Gates: all must pass before P1**

| Gate | Requirement | Owner |
|---|---|---|
| G0 | Explicit execution authorization naming this candidate SHA | PO |
| G1 | Checkout at `9192c50`, `reports/staging-content/` present (P0.1–2) | Operator |
| G2 | Isolation holds on the host (P0.4–5) | Operator |
| G3 | Staging at 066, plan rows as expected (P0.6–7) | Operator |
| G4 | SMTP empty, Stripe test key, `SHARE_BG_ALLOWED_HOSTS` unset (P0.8) | Operator |
| G5 | Disk and memory adequate, no production deploy running, quiet window (P0.9) | Operator |
| G6 | Restore point written (P0.10) | Operator |
| G7 | Fixture text and data changes approved (NEM-016 §15.6) | PO |

**Decisions**

| # | Decision | Recommendation |
|---|---|---|
| 1 | **Accept 067 and the other `main` commits on staging?** The alternative, cherry-picking NEM-016 without them, would leave staging behind production | Accept. It matches production |
| 2 | Is the corrected procedure in §8 approved, including new tests A19 and A20? | Approve |
| 3 | Approve the staging data changes: test accounts, fixture, shares and revocations, MinIO pause (A11), account deletion (A12), optional fake social token (A8b) | Your call; all synthetic |
| 4 | Clean-up afterwards | Keep the data until review, then decide |
| 5 | Who runs it, and in which window? | Operator with you present; quiet window |

**Unverified until the host checks run:** the staging migration state, plan rows, env values, disk headroom, and which books fall under the quality gate.

## 11. Changes made

No application or production configuration change was made by this report.

| Item | Purpose |
|---|---|
| `staging-candidate/nem-016` at `aaf708e` (pushed; merge commit only) | The candidate |
| `docs/nem-016-integrated-staging-candidate` (pushed) | This report and the two scripts, on top of the candidate, so the candidate SHA stays pure |
| `infra/tests/staging-candidate/migration-rehearsal.sh` | Rehearsal with real images and a disposable database |
| `infra/tests/staging-candidate/oneoff-labels-check.sh` | One-off container versus Traefik |

**Not modified:** `/opt/noetia-staging`, staging and production, Traefik, Stripe, NEM-016, NEM-017 and NEM-018 branches. The `docs/reports/README.md` index isn't on these branches (it's on PR #23), so no index was updated.

**Protected systems:** the reader and Escucha Activa code weren't edited by this mission. The candidate includes NEM-016's approved sharing changes and `main`'s small lint-only edits (for example in `FragmentPopover.tsx`). A20 is the runtime check.

## 12. Tests, verification and next action

All local, on the candidate tree.

| Check | Result |
|---|---|
| API unit tests | **1143 passed, 78 suites** |
| API `tsc --noEmit` | pass |
| API ESLint on sharing and staging-content files | 0 errors, 8 pre-existing warnings in NEM-006C files; migration files are excluded by the ignore config |
| Web unit tests, `tsc` | **304 passed**, types pass |
| Mobile unit tests, `tsc` | **188 passed**, types pass |
| image-gen `pytest` | **264 passed**, 94.57% coverage |
| Worker unit tests | **8 passed**, from a clean install. The first run failed with `Cannot find module 'bullmq'`, caused by my symlinked `node_modules`, not by the candidate |
| Coverage for API, web, mobile, worker | Not measured here; NEM-016 reported API at 91.5% |
| `docker compose config` (staging) | Valid; see §5.3 |
| Image builds: `api`, `web`, `image-gen`, `worker` | All built |
| NEM-017 `run.sh` (candidate's staging and Traefik files; server compose identical to `main`) | **30/30** |
| `migration-rehearsal.sh` | **45/45** |
| `oneoff-labels-check.sh` | Label inherited; 150/150 served correctly in both variants |

NEM-017's `rollout.sh` wasn't re-run: it rehearses the network move, which is already live, and those files are unchanged.

**Harness corrections.** The first rehearsal showed 25 failures, all test defects: wrong latest-migration query, wrong expected price order, and a lock drill that left its server session holding the lock, which made the real migration time out. Only the corrected run is counted. An earlier version of the one-off check also tried a `--no-healthcheck` flag that `compose run` doesn't have; that was removed.

**Limitations:**
- No acceptance test (A1–A20) ran. They need staging, MinIO and image-gen working together.
- The rehearsal database has the migration chain only, not staging's real seeded data.
- A13 was checked with health, read paths and an old-shape SQL insert, not a share created through the old app. That's what P4 is for.
- TLS and real traffic weren't exercised; Docker 29.4.3 wasn't tested.
- GitHub CI doesn't run on this PR, because `ci.yml` only targets PRs into `main`. Results above are local only.

**Next action:** the Product Owner reviews this report and decides §10. Nothing proceeds until then.
