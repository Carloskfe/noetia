# NOETIA ENGINEERING MISSION — NEM-010
## Near-Zero-Downtime Production Deploys (staging-validated)

**Status:** DRAFT
**Mission type:** INFRASTRUCTURE
**Implementation authorization:** LIMITED (see §5)
**Schema changes:** NOT AUTHORIZED
**Infrastructure changes:** SPECIFICALLY AUTHORIZED: CD workflow, compose files and a deploy script only (§5)
**Production deployment:** AUTHORIZED WITH CONDITIONS (§14)
**Product Owner approval:** REQUIRED

> Reminder: **APPROVED ≠ EXECUTE.** Even after Product Owner approval, this mission is executed only on an explicit Product Owner instruction naming it (e.g. "Execute NEM-010 according to the approved mission").

---

## 1. Context

Every push to `main` redeploys production through `.github/workflows/cd.yml`. This is known technical debt **H1** in [`technical-baseline/19-technical-debt.md`](../../technical-baseline/19-technical-debt.md). The recommended remedy is in [`production-safety/05-staging-strategy.md`](../../production-safety/05-staging-strategy.md) and [`06-remediation-plan.md`](../../production-safety/06-remediation-plan.md) P4: a staging gate plus blue-green or rolling deploys.

On 2026-10-29, while CI was being repaired, a deploy took noetia.app fully offline. Every URL returned Traefik's `404 page not found` for the whole deploy. The investigation that followed measured the cause and partly mitigated it.

### 1.1 Measurements (1–2 s external probes of `/` and `/api/books?limit=1`)

| Deploy flow | web gap | `/api` gap | Notes |
|---|---|---|---|
| Original (`down` → `up --build`) | ~6 min | ~6 min | Whole stack, db included, down for the full image build |
| Build-first + `up --wait` (PR #5) | ~3–4 s | ~10 s | api stop hit Docker's 10 s SIGKILL timeout |
| + graceful shutdown (PR #7), deploy of #9 | ~11 s | ~24 s | api now stops in ~1 s; see timeline |

The PR #7 deploy itself measured a 36 s api recreate step. One sample is not enough to say why.

### 1.2 Deploy timeline from `docker events` on the host (deploy of #9, UTC)

```
00:34:58  create new api (temp name) · kill old api
00:34:59  old api stop/die            ← graceful shutdown works (~1 s)
00:35:03  old api destroyed · new api renamed
00:35:04  web: kill/die/destroy/recreate ← web did not change
00:35:13  new api start               ← 14 s after the old one stopped
00:35:20  web healthy
00:35:23  api healthy                 ← /api served again
```

### 1.3 Remaining root causes

1. **Stop-before-start.** `docker compose up` replaces a container by stopping the old one before it starts the new one. Nothing serves the route during that window (container removal + start + ~10 s app startup + healthcheck). Graceful shutdown cannot fix this.
2. **Web is recreated with api.** In `docker-compose.server.yml`, web has `depends_on: - api`, so Compose recreates web whenever api is recreated. Web needs no start ordering: it calls the api per request (`INTERNAL_API_URL ?? 'http://api:4000'` in `next.config.js` and `app/s/[id]/page.tsx`).
3. **Requests reach the api before it is ready.** `/api` returned HTTP 500 (not 404) for a few seconds before the healthcheck passed. This has not been explained yet.

### 1.4 Governance exception record: PRs #5–#7

The README says *"CI/CD must not be modified except by a mission that specifically authorizes it."* The following changes were made under step-by-step Product Owner instruction, but **without a mission**. The Product Owner accepted them as an exception on 2026-10-29. NEM-010 adopts them as its baseline, and they are not to be reverted.

| PR | Change | Status |
|---|---|---|
| #5 `8ecb9d2` | `cd.yml`: build first, then `up -d --remove-orphans --wait --wait-timeout 300` (removed the full `down`). Compose: `start_interval: 5s` on api/web healthchecks | merged, deployed |
| #6 `2b3f06c` | `cd.yml`: `concurrency.cancel-in-progress: false` | merged, deployed |
| #7 `a8e4400` | api: `init: true` (compose) + `app.enableShutdownHooks()` | merged, deployed |

**Related deviations (recorded, not exceptions):**
- PRs #8 and #9 were comment-only api changes merged **solely to trigger measurement deploys**. This goes against "minimize unnecessary pushes". Future measurement happens on staging (§14).
- On 2026-10-29 a merge cancelled an in-progress old-script deploy right after its `down`. The site was down for ~4 min (≈23:34–23:38 UTC). PR #6 prevents this from recurring.

## 2. Objective

Routine production deploys (an api and/or web image change, no migrations) cause **no user-visible downtime on web** and **≤ 2 s on `/api`**, with the new deploy flow proven on staging before it reaches production.

## 3. Dependencies

- **Staging environment (NEM-006A, COMPLETE / awaiting review; NEM-006C IN-PROGRESS).** It is live at `staging.noetia.app` as compose project `noetia_staging` in `/opt/noetia-staging`. `docker-compose.staging.yml`, `cd-staging.yml` and `docs/staging/` exist **only on unmerged branches** (`nem-006a-staging`, `nem-006c-staging-content`), and staging auto-deploy is **not armed**. See Open decision D1.
- PRs #5–#7 (baseline, §1.4).
- Host: Docker Engine ≥ 25 and Compose ≥ 2.20 (in practice already met, since `start_interval` and `--wait-timeout` work in prod).

## 4. Source-of-truth references

- [`engineering-missions/README.md`](../README.md): authorization, "Current production-deployment warning"
- [`technical-baseline/19-technical-debt.md`](../../technical-baseline/19-technical-debt.md) H1 · [`technical-baseline/02-architecture.md`](../../technical-baseline/02-architecture.md) (CD description)
- [`production-safety/05-staging-strategy.md`](../../production-safety/05-staging-strategy.md) · [`06-remediation-plan.md`](../../production-safety/06-remediation-plan.md) P4
- [`incident-response.md`](../../incident-response.md) §1 (Traefik 502/404) and §7 (CI/CD)
- `CLAUDE.md` § Production Deployment, § Development Safety Rules (snapshot before infra change)
- Code: `.github/workflows/cd.yml`, `docker-compose.server.yml`, `services/api/src/main.ts`, `services/web/next.config.js`

## 5. In scope

1. **Remove web's `depends_on: - api`** in `docker-compose.server.yml` (and the staging equivalent).
2. **Start-new-before-stop-old for `api` and `web`.** Bring up a second container from the new image next to the old one. Traefik already load-balances containers that share router/service labels. Wait until the new one is healthy, then stop and remove the old one. Implemented either as an in-repo script (`infra/server/rolling-deploy.sh`) or with the `docker rollout` CLI plugin (D2).
3. **`cd.yml` deploy step** updated to use (2) for api and web. Non-routed services (worker, image-gen) and stateful services (db, cache, storage, search) keep the current `up -d --wait` behaviour.
4. **Explain and, if in scope, fix the pre-healthy HTTP 500s** (§1.3 #3).
5. **Deploy timeline in the CD log.** Record `docker events` (api/web only) during the swap and print it, so future measurement needs no SSH listener.
6. The same flow applied to the staging compose and staging deploy procedure, to validate it there.
7. Documentation deliverables (§15).

## 6. Out of scope

- Arming staging auto-deploy (creating the `staging` branch), which is a separate PO decision (NEM-006A).
- Traefik static config (`/opt/traefik/traefik.yml`) and any change to the Traefik container.
- Stateful services (db, cache, storage, search) and monitoring containers: no rolling, no config changes.
- Migration strategy changes beyond ordering (D3), plus any schema change.
- A second VPS, an image registry, or CI-built images.
- Application code changes beyond what §5.4 strictly requires.
- CI unit-test coverage thresholds (a separate open item).

## 7. Product rules

No product, pricing, token or ownership rules are affected. Reader-first priority (CLAUDE.md § Product Hierarchy) is the reason for this mission: every routine deploy currently interrupts active readers, including Escucha Activa sessions.

## 8. Protected systems

- **Escucha Activa / reader:** must not be degraded. No reader code changes. A deploy must not break an in-progress session any more than today; ideally less.
- **Production data:** db, MinIO and search containers must not be recreated by this work.
- **Permanent book ownership and business-rule engines:** untouched.

## 9. Technical requirements

- Zero-downtime swaps must not use `container_name` (it would break scaling). Keep Compose's default `noetia-<svc>-<n>` naming.
- **Memory headroom:** api and web each have `limits.memory: 512M`. A swap briefly runs two of each, adding about 1 GB. Confirm host headroom before the first prod run (the host has 24 GB, but staging shares it).
- If the new container never becomes healthy within a timeout, the deploy **fails and leaves the old container serving**. No partial state.
- Health gating stays as it is: Traefik routes only to `healthy` containers. Keep `127.0.0.1` in healthchecks (incident-response §1).
- Graceful shutdown (PR #7) must be kept: the old container should drain in about 1 s after it leaves rotation.
- `cancel-in-progress: false` stays (PR #6).
- **Two versions run at once** for a few seconds during a swap, so old and new code briefly share the DB. See D3 for migrations.

## 10. Security / privacy / copyright

- No new secrets, no new open ports, no credentials in the CD log. The printed event timeline contains container names and timestamps only.
- A third-party plugin, if chosen in D2, must be version-pinned and checksum-verified on install.

## 11. Acceptance criteria

Measured with an external probe at ≤ 1 s intervals on `/` and `/api/books?limit=1` (staging: with basic auth).

1. **Staging:** 3 consecutive deploys with an api + web image change: web shows **0** non-200 samples, `/api` shows **≤ 2 s** of non-200.
2. **Staging:** a deploy whose new api never turns healthy fails the job, and the old api keeps serving (0 non-200 on `/api`).
3. **Staging:** a deploy with an api-only change does **not** recreate web (confirmed in the CD event timeline).
4. **Staging:** two pushes in quick succession are queued, not cancelled, and both complete.
5. **Production:** the first deploy after acceptance meets criterion 1's thresholds, the CD log contains the event timeline, `docker ps` shows everything healthy, and there are no pending migrations.
6. The documentation in §15 is updated.

## 12. Required tests

- Staging drills (criteria 1–4) recorded with probe logs and CD event timelines in the completion report.
- If an in-repo script is chosen: `shellcheck` clean, plus a dry-run mode that prints the plan without acting.
- **Negative cases:** new container unhealthy (2), new container fails to start (bad env, should behave like 2), and a host with the old container already unhealthy (the swap must still complete).
- Existing CI (lint, typecheck, build, E2E) stays green.

## 13. Observability

- New: a per-deploy event timeline in the CD log (§5.5).
- Unchanged: Prometheus, Grafana and cAdvisor. Optional, not required: a Grafana annotation per deploy.

## 14. Deployment / rollout

1. All work is on a feature branch. **No measurement-only pushes to `main`.**
2. Staging deploys run **manually** per `docs/staging/RUNBOOK.md`, because auto-deploy is not armed.
3. Production goes ahead only after criteria 1–4 are met **and** the Product Owner gives an explicit go.
4. Before the first production deploy: take a **Contabo snapshot** (CLAUDE.md § Development Safety Rules) and confirm no CD run is in progress.
5. Verify the first production deploy with an external probe and `docker ps`.
6. **Rollback:** revert the `cd.yml`/compose commit. The next deploy then uses the PR #5–#7 flow (known-good, ~10–25 s gap). A manual deploy is documented in incident-response §7.

## 15. Documentation deliverables

- `incident-response.md` §1: add "deploy in progress" and "dependent service recreated" as known 404 causes, with the event-timeline diagnosis.
- `incident-response.md` §7: update the manual-deploy commands to the new flow.
- `CLAUDE.md` § Production Deployment / Auto-deploy steps: describe the new flow.
- `technical-baseline/02-architecture.md` (CD description) and `19-technical-debt.md` H1: mark the downtime part resolved. Release gating via staging stays open unless D1 resolves it.

## 16. Open decisions

| # | Question | Why it matters | Options | Recommended default |
|---|---|---|---|---|
| **D1** | Which staging compose/runbook does this mission build on, given they exist only on unmerged branches? | Criteria 1–4 need a staging stack that matches prod | (a) merge NEM-006A/006C first; (b) NEM-010 works on top of the `nem-006c-staging-content` branch; (c) validate against a throwaway compose project on the host | (a), or (b) if 006C review is far off |
| **D2** | In-repo script vs `docker rollout` plugin? | Maintenance vs speed; a new host dependency | (a) `infra/server/rolling-deploy.sh` (~30 lines, no dependency); (b) pinned plugin binary | (a) |
| **D3** | Migration ordering under rolling deploys | Old and new code share the DB during a swap; today migrations run *after* the new api is up | (a) keep as-is and require expand/contract (additive-first) migrations; (b) run migrations from the new image in a one-off container *before* the swap; (c) deploys with pending migrations fall back to the current flow | (b) plus additive-first (already the README "Additive Database Evolution" principle) |
| **D4** | Downtime target | Sets the acceptance bar | 0 s web / ≤ 2 s api (as written) or stricter | As written |

D1 and D3 are **material**. Execution is blocked until they are decided.

## 17. Stop conditions

STOP and ask the Product Owner if:
- the swap would require recreating any stateful service (db, cache, storage, search);
- host memory headroom is insufficient for double api/web during a swap;
- staging cannot be brought to parity with prod compose without changes outside §5;
- any Traefik static-config change appears necessary;
- the pre-healthy 500s (§1.3 #3) turn out to need reader or api code changes beyond a trivial fix;
- a drill shows the old container stopping before the new one is healthy.

## 18. Completion report

Per the README Completion Report Standard: Mission · Status · Changed Files · Database (none expected) · Tests (drill logs) · Verification (probe logs + CD timelines for staging and the first prod deploy) · Deployment · Deviations · Risks · Discoveries · Protected Systems Confirmation · Commit SHAs · Recommended Next Step.

## 19. Product Architecture review

Reviewer: Product Architecture, using [`REVIEW-CHECKLIST.md`](../REVIEW-CHECKLIST.md). Verdict: APPROVE / APPROVE WITH FOLLOW-UP / REJECT-REMEDIATE. Completion requires the review **and** Product Owner acceptance.

---

> **STOP after completing authorized work. Do not begin another mission without explicit Product Owner authorization.**
