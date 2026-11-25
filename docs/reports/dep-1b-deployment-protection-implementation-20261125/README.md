# DEP-1B: deployment protection implementation preparation

**DO NOT MERGE — DEP-1B IS NOT APPROVED FOR ACTIVATION.** For independent Product Architecture code review only.
**Date:** 2026-11-25 · **Authorization:** PO bounded implementation, DEP-1B · **Status:** REVIEW (nothing activated)

**Labels:** **[M]** measured here · **[S]** read in source or API schema · **[D]** GitHub documentation · **[C]** community report · **[K]** general knowledge, unconfirmed · **[U]** unverified · **[P]** proposal.

## Summary

1. The proposed `cd.yml` deploys only the event SHA, behind the `production` Environment, with two fail-closed checks on the runner and more on the server. The server script is the DEP-1A design plus eight hardenings (§3).
2. **58 offline tests pass; 36 of 36 guard-removal mutants are caught [M].** Tests run the text that ships, extracted from the files.
3. **DEP-F1: UNVERIFIED — ACTIVATION GATE.** The schema accepts a `User` bypass and a `pull_request` mode, but no source proves Ruleset 2's behaviour on a *personal* repository.
4. **New finding, changes a DEP-1A recommendation:** adding `.env.production` to `.gitignore` (P-14) would *remove* a Git protection. Withdrawn (F-B1).
5. **New activation trap:** the SSH action will most likely check the server's **ECDSA** host key. Recording the Ed25519 fingerprint makes every deploy refuse (F-B2).
6. Rollback was rehearsed offline only. It is **not production-tested**.

## 1. Verified baseline [M]

| Item | Value |
|---|---|
| `main` | `8f2f294378a8cdc7472f2849ce533981605fcb01` (unchanged since DEP-1A) |
| PR #92 HEAD | `cba1e55d7a982a40605307b5d75bcce549a2662e` (as authorized); IR-3A #91 `a0ae125` |
| Branch / base | `docs/dep-1b-deployment-protection-20261125`, isolated worktree, from #92's HEAD, which contains `main` and adds documentation only |
| Read | `CLAUDE.md`, engineering-missions README, DEP-1A, IR-3A, `cd.yml`, `ci.yml`, all runbooks below |
| Rulesets / Environments | 0 / 0, read-only, before the work |

No material change, so no STOP.

## 2. Changed files

| File | Change |
|---|---|
| `.github/workflows/cd.yml` | Proposed workflow |
| `infra/tests/dep-1/test_deploy.py`, `mutants.py` | Offline harness (standard library + PyYAML, already present locally) |
| `docs/operations/production-deployment.md` | New: current vs future, activation checklist |
| `docs/operations/production-rollback.md` | New: rollback script and manual-deploy runbook |
| `CLAUDE.md`, `docs/incident-response.md`, `docs/secrets-rotation.md`, `docs/stripe-setup.md`, `docs/business/{en,es}/04-…` | Current procedure kept and labelled; future procedure marked **after activation only** |
| `docs/reports/dep-1b-…/` | This report, `tests.log.txt`, `mutants.log.txt` |

Corrected because unsafe or wrong **today**: "push a trivial commit" to test a key (it deploys production); P1 rollback by committing and pushing from the server; "CD runs after CI passes" (it does not wait); "old containers keep running" after a failed migration (new code is already live); stale cleanup and build steps. `.gitignore`, Dockerfiles, dependencies, compose files, application code and all source PRs are untouched.

## 3. Proposed workflow

```
push to main ─> run waits for Environment "production" (PO) ─> runner, no checkout
  1 ref is main, SHA well formed, SHA = tip of main now        (GitHub API, no production contact)
  2 key and BOTH fingerprints present, well formed, key matches (no network)
  3 ssh-action pinned by commit; host fingerprint mandatory; 30 s connect, 30 min command, 45 min job
      server: lock > env file > clean tree > branch > fetch > tip = SHA > fast-forward > SHA tracks no env file
              > ff-only merge > verify > build > verify > up --wait > migrate > verify > record > prune
```

Differences from DEP-1A §6.2, all stricter except the last:

| Change | Why |
|---|---|
| `git status` **failure** refuses | `[ -z "$(git status)" ]` treats an error as "clean": a fail-open in the DEP-1A draft |
| Ancestor check before any checkout | A refused fast-forward now leaves even a detached rollback checkout untouched |
| Unexpected branch, or detached HEAD not in the deployed log, refused | Unknown server state |
| Commit that tracks `.env.production` refused; missing or empty file refused | F-B1 |
| Git background maintenance off | A detached `git gc` child would inherit the lock descriptor and hold it [K] |
| Clean tree and SHA re-verified after build and before recording | Something changed the context mid-build |
| Both fingerprints format-checked (one line, 43 characters) | Empty, MD5, padded and multi-line values refused |
| Prune failure warns instead of failing a deploy that already succeeded | **Small semantic change** for PA to accept or reject |

Docker build, `up` and migration commands are byte-identical to today's (a test asserts it). `runs-on` becomes `ubuntu-24.04` (from `ubuntu-latest`).

**Third-party action [S][M].** `@v1.2.0` still resolves to the pinned commit `7eaf766`. The job has `contents: read` and no checkout. The action downloads `drone-ssh` 1.8.0 over HTTPS and runs it **without a checksum**, though the release publishes `checksums.txt`. Accepted as residual (DEP-1A F-A5). Remedy with DEP-1C: the runner's own `ssh` with a pinned `known_hosts`.

## 4. Exact-SHA proof

Scope: offline, real Git, stub Docker [M].
- The only expression in the server script is `${{ github.sha }}`. The SHA must equal the tip of `main` on the runner **and** on the server after a fresh fetch, be a descendant of local `main`, and equal `HEAD` before build, before `up` and before recording.
- `main` advancing during the build: the approved SHA is deployed and recorded, the new one is not.
- Not proven: real Docker uses that tree unchanged at every instant (checks are before and after, not during). Untracked files under `services/*` can enter a build context and are not checked. Files marked assume-unchanged are invisible to `git status`.

## 5. Offline validation

```
python3 -I infra/tests/dep-1/test_deploy.py -v     # 58 tests, OK, ~10 s
python3 -I infra/tests/dep-1/mutants.py            # 36/36 killed, ~3 min
```
Git, `flock` and `ssh-keygen` are real, on throwaway repositories and keys; `docker` and `gh` are stubs; `ssh`, `curl`, `scp` and `ssh-keyscan` are traps that fail the test if called. Runs sequentially. The success path runs under both `dash` and `bash`.

| Required scenario | Result |
|---|---|
| Expected SHA / successful mocked deployment | Accepted; exact SHA recorded |
| Malformed, superseded, unknown, feature-branch SHA | Refused, 0 Docker calls |
| Non-main reference (branch, tag, PR ref) | Refused on runner |
| Dirty tracked (modified, staged); `git status` error | Refused; edits preserved |
| Failed fetch, also with a stale `FETCH_HEAD` | Refused |
| Non-fast-forward (rewritten remote; local server commit) | Refused; checkout unchanged |
| Concurrent deployment; lock held during build, free after | Refused / confirmed |
| Missing, unreadable, public-only or passphrase key | Refused |
| Wrong key fingerprint; missing or malformed key/host fingerprint (22 cases) | Refused; key never printed, temporary file removed |
| Build failure | Stops before `up`; not recorded |
| Health failure (`up --wait` non-zero) | Stops before migrations; not recorded |
| Migration failure | Not recorded; retry of the same SHA succeeds |
| Existing `.env.production` | Byte-identical after every case |

**Pending, not executed:** Environment gate, real SSH action including a host mismatch, real Docker, migrations, timeouts and dropped connections, GitHub queueing, secret-scope fallback. Each needs GitHub settings or production.

## 6. DEP-F1: ruleset compatibility — **UNVERIFIED — ACTIVATION GATE**

| Question | Evidence | Verdict |
|---|---|---|
| Is a user-specific bypass actor accepted? | REST schema lists `User`, with `actor_id` required; says `OrganizationAdmin` is not applicable to personal repositories and does not exclude `User` [S]. GraphQL union includes `User` [M]. GitHub announced user actors for **repository-level** rulesets on 2026-05-07, through UI, REST and GraphQL [D]. The prose docs still list only roles, teams and apps [D]. | Very likely. **Personal repository: not stated. [U]** |
| Does `pull_request` mode work with `update`? | Docs: the actor must open a PR and "can then choose to bypass any branch protections and merge" [D]. The `update` rule is "only allow users with bypass permission" [S]. A report on a **personal public** repository with "Restrict updates" shows *"Merging is blocked"* **plus the bypass checkbox** [C, 2024]. | Likely works, but **as an explicit bypass on every release**. [U] |
| Which merge calls honour it? | One report: the direct merge endpoint does, **auto-merge does not** [C, 2026]. Auto-merge is off here [M, DEP-1A]. | [U] |
| Does layering keep the baseline? | "Rules are aggregated, and all rules apply"; bypass lists belong to one ruleset [D][S]. Two layered rulesets with bypass on one are reported in use [C]. That one bypass click cannot skip the *other* ruleset's required checks is **inferred**. | [U] — the most important test |
| Administrator-role fallback | `RepositoryRole` is in the schema; repository admins are listed as eligible [S][D]. On a personal repository only the owner has admin [D, DEP-1A]. **Equal to the user actor only once the agent no longer holds the owner's login.** | Equivalent *after* separation; worthless before. [U] |
| `exempt` mode | Schema: rules not run, **no bypass audit entry** [S]. | Rejected: loses the audit trail |
| Agent GitHub App | Not in any bypass list, so `update` should refuse it, including through the merge API. It must lack Administration (rulesets), Environments, Secrets, Workflows, Deployments; an App installed with Contents write can still push branches. | Design [P]; refusal [U] |

No isolated local equivalent exists: rulesets are enforced by GitHub. I did **not** create one, here or in a throwaway repository (that would also be a settings change).

**Smallest safe future verification (needs its own PO authorization, no production exposure):** the PO creates an empty **personal, public, scratch repository** with no workflows or secrets and applies both rulesets there. Then: (a) is the `User` actor accepted, (b) read back `current_user_can_bypass` = `pull_requests_only`, (c) direct push refused, (d) with a required check failing, can the PO's bypass merge? It must **not**, (e) with it passing, can the PO merge, (f) the App's merge refused, (g) repeat with the admin role. About 30 minutes, $0. Then delete it. Failure of (d) means Ruleset 2 must not be adopted.
**Ruleset 1 does not depend on this** and needs only its own read-back. Until (a)–(g) pass, nobody should claim "only the PO can merge".

## 7. DEP-F2: fail-closed protections

| Hazard | Control | Limit |
|---|---|---|
| Environment absent or misspelled | Checklist step 2 before merge; warning at the top of `cd.yml`; a test pins the spelling | **The workflow cannot detect this itself**: with no protection the job simply runs. If the fingerprint variables are unset the job still refuses, so an *auto-created empty* Environment deploys nothing — **unless the variables exist at repository scope.** Set them at Environment scope only |
| Missing Environment secret falls back to the repository one [D precedence] | Key must match `DEPLOY_KEY_FINGERPRINT` (a **new** key, so the old repository key is refused) | **Identity, not scope.** Step 8 checks the repository secret is gone, by name |
| Host fingerprint empty | Refused before SSH. Needed: source confirms an empty value selects `InsecureIgnoreHostKey` [S] | A wrong value is refused by the action, not tested here |

**F-B2 [S].** The action compares **one** SHA-256 fingerprint with the key negotiated. Its Go library (`x/crypto` v0.29.0) prefers ECDSA, then RSA, then **Ed25519 last**. If the server offers ECDSA (the Ubuntu default [K]; real server [U]) the Ed25519 fingerprint never matches. Fails closed, but would block the first release. The checklist says which file to read.

**Order correction for activation:** GitHub reads repository secrets when a run is **queued** and Environment secrets when the job **starts** [D]. A run already waiting may still hold the old repository secret after it is deleted. No run may be queued or waiting at step 8.

## 8. DEP-F3: rollback rehearsal

`production-rollback.md` contains the script (extracted by one `sed` line, because multi-line pastes over SSH corrupt). Default mode is `check`. Offline results [M]:

| Case | Result |
|---|---|
| Check mode | Nothing changed |
| Apply | Detached at target; build, `up`; **no migration, no prune**; `rollback` recorded |
| Return: revert commit → gated deploy | Back on `main`, recorded |
| Target not recorded, not in `main`, malformed, tracks the env file | Refused |
| Migrations differ, including after a **failed, unrecorded** deploy | Refused. Compared with local `main`, not `HEAD`: comparing with `HEAD` as in DEP-1A §9 would miss it when detached (mutant 32) |
| `docker-compose.server.yml` differs | Refused: conservative, covers stateful image and network (S-ALT) changes |
| Dirty tree, lock held, env missing | Refused |
| Fails at build / `up` | Not recorded; retry succeeds |
| Checkout moves during build | Stops before `up` |
| `git pull origin main` while detached | Silently moves forward: documented as forbidden |
| §6 manual deploy one-liner | Runs the workflow's own script, recorded |

**This does not qualify the runbook as production-tested.** Remaining PO-supervised validation is in its §8. The log is empty until the PO writes the baseline line, so there is no rollback target before that. Rebuilding old commits inherits §9.

## 9. DEP-F4: reproducibility

| Level | Today | After this PR |
|---|---|---|
| Exact source commit | No | **Yes** (§4 limits) |
| Exact dependency resolution | No | **No** |
| Exact image | No | **No** |
| Exact runtime | No | **No**: `latest`/minor tags, env file, database and volumes are outside Git |

| Input [M] | Why the same SHA can differ |
|---|---|
| api, web, worker: `COPY package.json`, then `npm install` (api and worker twice; the production stage with `--legacy-peer-deps`) | No lockfile in effect at install time. `services/api/package-lock.json` exists but is copied only after the install; web and worker have none; CI tests `pnpm-lock.yaml`. **CI and production can run different dependencies.** Build and production stages can also differ from each other |
| `node:20-alpine`, `python:3.11-slim` | Moving tags |
| image-gen | Direct packages pinned, transitive not; `apt-get` unpinned |
| Compose | `minio/minio:latest`; `postgres:16-alpine`, `redis:7-alpine`, `getmeili/meilisearch:v1.7` float within a version; others use fixed-looking but mutable tags |
| Docker layer cache | Usually *hides* drift until `package.json` changes or the cache is lost, so a rollback may reuse or re-resolve unpredictably [K] |

`build` does not pull base images already present, and `up` does not re-pull service images [K], so drift appears mainly on rebuild or a new host.
**Residual risk:** an approved or rolled-back SHA may run dependencies nobody tested. **Smallest later remedy [P], separate missions:** (1) lockfile installs in the three Node Dockerfiles; (2) pin base and service images by digest; (3) build in CI, push by digest, deploy the digest (also makes rollback build-free). No bit-for-bit claim is made.

## 10. Identity separation

The agent and the PO still share one admin login, so **every control here can be approved, edited or removed by that login**. Until the owner's credentials leave the agent's machine and a limited App is used (DEP-1A §7), this is protection against accidents. The App must not hold `Workflows`: it could then not push this PR's kind of change, by design.

## 11. Activation sequence

`production-deployment.md`: 12 steps (0–11), each a separate PO approval, with pass conditions. STOP gates: dirty server tree; Environment read-back not exact; variables at repository scope; fingerprint of the wrong algorithm; run does not wait at step 6; any queued run at step 8; Ruleset 2 before §6 (a)–(g). **Merging this PR is itself a production deploy.**

## 12. Remaining unverified controls

Environment wait, branch policy and admin-bypass switch · rulesets (§6) · host mismatch refusal · server tree, branch, tools and host keys · how the server authenticates `git fetch` · whether `fuser` exists · remote behaviour on timeout · other `authorized_keys` entries and GitHub/OAuth apps · everything in §5 "Pending".

## 13. Risks and recovery

| Risk | Sev. | Recovery |
|---|---|---|
| Merged before the Environment exists | **Critical** | Fails closed only if the variables are unset; do not merge early |
| Ruleset 2 misbehaves | High | Disable it; Ruleset 1 is unaffected |
| **F-B1 [M]** A commit tracks `.env.production`: Git refuses to overwrite an untracked file but **silently overwrites an ignored one**. Ignoring it in `.gitignore` would make `git pull` destroy the server's file in that case | High | Guard in both scripts; P-14 should instead be a CI or push check that refuses such a commit. Today's `git pull` workflow has no guard |
| Wedged remote run holds the lock | Medium | Runbook §4; never delete the lock file. Killing a parent alone does not release it while a child lives (seen in a test) [M] |
| Server tree is dirty at activation | Medium | Step 0 |
| Migration fails after `up` | Medium, existing | New code on old schema: forward fix |
| `drone-ssh` unverified binary sees the key | Medium, existing | DEP-1C |
| Deployed log is an unsigned file; root can edit it | Low | Cross-check with the Actions run |
| #92's base branches merge and GitHub retargets this PR to `main` | Low | Later pushes would then run CI, including the production-targeting E2E: close or retarget first |

## 14. Resources and cost

$0. No dependency or infrastructure added. Tests: one process, small temporary directories, self-cleaning. The harness is not wired to CI.

## 15. Confirmation: no operational changes

**Performed:** read-only GitHub queries (schema introspection, rulesets, Environments, metadata), public documentation and action/library source, offline tests on disposable directories, commits on one new branch, one Draft PR.
**Not performed:** merge, deployment, dispatch, approval or re-run · ruleset, Environment, secret, variable, App, token or identity changes · production or staging SSH · SQL, migrations, live Docker · changes to payments, French, OAuth, application logic, source PRs, coverage thresholds, Dockerfiles, dependencies, `.gitignore` · rollback execution outside the harness. **Protected systems untouched.**
**Trigger safety [M]:** `cd.yml` fires only on push to `main`, `ci.yml` only for PRs into `main`; this PR's base is the DEP-1A branch, and `cd-staging.yml` is absent. Run check after publication: in the PR comment.

**Decisions for the PO after PA review:** (1) accept §3's prune change; (2) authorize §6's scratch-repository test; (3) withdraw P-14 or replace it with a commit check; (4) activation, separately.

**Sources.** [D]: GitHub Docs, *About rulesets*, *Available rules for rulesets*, *Creating rulesets for a repository*, *Deployments and environments*, *Manage environments*, *Secrets reference*; [GitHub changelog 2026-05-07](https://github.blog/changelog/2026-05-07-repository-rulesets-user-bypass-and-branch-renaming). [S]: `github/rest-api-description` `api.github.com.json` (SHA-256 `6d9bbb20…4aa7`), GraphQL introspection, `appleboy/ssh-action` at `7eaf766`, `drone-ssh` v1.8.0, `easyssh-proxy` v1.5.0, `golang/crypto` v0.29.0. [C]: [community discussion 113172](https://github.com/orgs/community/discussions/113172).

**STOP FOR INDEPENDENT PRODUCT ARCHITECTURE REVIEW.**
