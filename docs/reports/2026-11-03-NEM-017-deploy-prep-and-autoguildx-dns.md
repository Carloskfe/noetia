# NEM-017: deployment branch preparation and AutoGuildX DNS-name inspection

> Engineering report (agent reporting protocol), under the PO's "Authorization for Deployment Preparation Only".
> **Done:** created and pushed `deploy/nem-017-on-006c`; read-only repository inspection; local disposable Docker tests.
> **Not done:**
> - no deploy, merge or PR merge
> - no push to `main` or `staging`
> - no server access, Docker network or container change, compose deployment, migration, Stripe or data change
> - `/opt/noetia-staging/reports/staging-content/` untouched

## 1. Mission and objective

1. Build a traceable branch that combines the deployed staging baseline `1295201` with NEM-017 (Draft PR #26), validate it, and push only that branch.
2. Inspect, read-only, whether AutoGuildX and Noetia production have conflicting Docker DNS names on the shared `proxy` network.

## 2. Date and status

- **Date:** 2026-11-03
- **Branch status:** `deploy/nem-017-on-006c` pushed at **`9192c50e07357876e9f1e197c3dd6b640d13d098`**
- **AutoGuildX inspection status:** repository evidence gathered; live confirmation pending (no authorized server access, §5.4)

## 3. Scope and exclusions

**In scope:**
- branch creation
- local validation and tests
- read-only reading of the AutoGuildX repository (`~/AutoGuildX`, `main` at `a09e9a8`, clean tree)

**Excluded:**
- the live rollout
- any AutoGuildX change
- any remediation for §6 (proposed as a separate mission)

## 4. Executive summary

- **Deploy branch.**
  - It's a single `--no-ff` merge commit on top of `1295201` (parent 1), with PR #26's head `02c98f7` as parent 2. There were no conflicts.
  - Compared with `1295201`, it changes **only** NEM-017's 11 files. `services/`, `scripts/`, `.github/`, `docker-compose.server.yml`, `docker-compose.yml` and `docker-compose.prod.yml` are byte-identical to `1295201`.
  - The NEM-006C storage limit (512M) is kept.
- **Validation.**
  - `docker compose config` passes for staging and for Traefik.
  - The isolation suite passes **30/30**.
  - The rollout rehearsal from the live `1295201` layout passes **18/18**. Traefik wasn't restarted, and production answered correctly to 452 of 452 monitor requests.
- **AutoGuildX.** Its production compose puts services named **`web` and `api`** on `proxy`, the same names Noetia production uses there.
  - Its `web` calls **`http://api:4000/api/v1`** server-side, and Noetia's `api` also listens on port 4000.
  - Docker's DNS fall-through (S19) is confirmed by local reproduction, so whenever one project's `api` is down or being recreated, the other project's `web` can reach the wrong `api`.
  - **Classification: POSSIBLE.** The repository and the container names the PO observed strongly indicate it. Live DNS names aren't verified yet, and no cross-project traffic has been observed. **`storage` doesn't collide.**
- **Recommendation:** **GO for deployment review.** The AutoGuildX finding doesn't block NEM-017. NEM-017 takes staging off `proxy`, which shrinks the collision set from three environments to two. It needs its own mission.

## 5. Findings and evidence

### 5.1 Deploy branch

| Check | Result |
|---|---|
| Starts from `1295201` | Parent 1 of `9192c50` is `129520193bb9…` |
| Includes PR #26 | Parent 2 is `02c98f73b5c8…`; `f434b32` and `58ec3cb` are ancestors |
| Commits added on top of `1295201` | 4: `58ec3cb`, `f434b32`, `02c98f7` and the merge |
| Merge conflicts | none (auto-merged `docker-compose.staging.yml`, `docs/staging/README.md`, `docs/staging/RUNBOOK.md`) |
| Other changes | none. The only difference from PR #26's version of the staging compose is NEM-006C's storage limit hunk |
| PR #27 report | **not** included (the branch is exactly baseline + PR #26) |
| Remote refs after push | `main` still `6a5e5c0`; `nem-006c-staging-content` still `1295201`; PR #26 head still `02c98f7`; no `staging` branch on the remote |

**Files changed relative to `1295201`:**
- `docker-compose.staging.yml`
- `infra/server/traefik/docker-compose.yml`
- `docs/staging/{README,RUNBOOK,EXTERNAL-ACTIONS}.md`
- `infra/tests/network-isolation/{README.md,mirror.py,run.sh,rollout.sh}`
- the NEM-017 mission record and report

That's 732 lines added and 16 removed.

### 5.2 Configuration validation (`docker compose config`, dummy env values)

| Item | Result |
|---|---|
| Staging `api` | networks `noetia_staging_net` and `proxy_staging`; label `traefik.docker.network=proxy_staging`; 0.75 CPU, 384M |
| Staging `web` | same as `api` |
| Staging `storage` | networks `noetia_staging_net` and `proxy_staging`; label `proxy_staging`; **0.5 CPU, 512M limit, 128M reservation** (NEM-006C) |
| Staging and `proxy` | `proxy` isn't referenced anywhere in the staging project |
| Traefik compose | networks `proxy` and `proxy_staging`, both `external: true` |
| `traefik.yml` provider default | `network: proxy` (unchanged), so production and AutoGuildX routing are unchanged |
| NEM-006C functionality | seeding script, ingestion code, tests and docs are identical to `1295201`. The seeding script's network selection still resolves to the staging internal network (see the 2026-11-03 compatibility report, §5.4) |

**Note.** `docker-compose.server.yml` on this branch (identical to `1295201`) is 8 lines behind production `main` (`6a5e5c0`), with no network, proxy or Traefik differences.
- That's pre-existing branch history.
- Production deploys from `/opt/noetia` on `main` and never reads this branch.
- Don't use this branch for production.

### 5.3 Local tests (Docker 29.9.1; all `s19h*` resources removed afterwards: 0 containers, 0 networks)

| Suite | Inputs | Result |
|---|---|---|
| `run.sh` | production = `6a5e5c0` `docker-compose.server.yml`; staging and Traefik = deploy branch | **30 / 30 PASS** (N1–N7, T1–T7, F1–F4, F1d–F4d, R1–R7, M1) |
| `rollout.sh` | before = live `1295201` staging and Traefik files; after = deploy branch | **18 / 18 PASS**. Traefik not restarted during the attach or the rollback; production answered `prod-web` to **452 / 452** monitor requests |

### 5.4 AutoGuildX DNS names: evidence

**Live access.** The only key loaded on this machine is the restricted offsite-backup key, not an authorized inspection credential. So I didn't access the server. The commands in §5.5 are for the PO.

**Repository evidence** (AutoGuildX `docker-compose.server.yml` at `a09e9a8`, project directory `/opt/autoguildx`):

| AutoGuildX service | Networks | Internal calls | Notes |
|---|---|---|---|
| `web` | `agx_net`, `proxy` | `API_URL: http://api:4000/api/v1` (server components / `generateMetadata`) | label `traefik.docker.network=proxy` |
| `api` | `agx_net`, `proxy` | `db:5432` | listens on 4000, global prefix `api/v1` |
| `db` | `agx_net` only | | not on `proxy`, so no collision |
| `posthog*` (`docker-compose.analytics.yml`, deployment status unknown) | `analytics_net`; `posthog` also on `proxy` | | no Noetia name collides |

**Noetia production** (`docker-compose.server.yml` at `6a5e5c0`):
- `api` (port 4000), `web` and `storage` are on `noetia_net` and `proxy`.
- `web` reaches the API through `INTERNAL_API_URL`. It defaults to `http://api:4000` in `services/web/app/s/[id]/page.tsx`. The `next.config.js` `/api` rewrite uses the same variable but defaults to `localhost:4000`. The live value lives in `.env.production` and needs verifying.
- `api` reaches MinIO at `MINIO_ENDPOINT=storage`.

**How a lookup resolves (mechanism confirmed by the NEM-017 local reproduction).**
- Docker's embedded DNS tries a container's networks in name order. `autoguildx_agx_net` and `noetia_noetia_net` both sort before `proxy`.
- **In normal operation**, each project's `api` resolves on its own internal network.
- When the name is missing there (the service is stopped, crashed, or between a compose stop and start), the lookup **falls through to `proxy`**, where the other project's `api` answers on the same port 4000.

**Classification:**

| Item | Class | Basis |
|---|---|---|
| `api` name collision on `proxy` (AutoGuildX ↔ Noetia production) | **POSSIBLE** (strongly indicated) | Repository service names, plus the PO-observed `autoguildx-api-1` and `noetia-api-1` on `proxy`. Live DNS names unverified |
| `web` name collision on `proxy` | **POSSIBLE**, low impact | Same basis. No internal consumer of the name `web` was found in either repository; Traefik routes by IP |
| `storage` collision | **NOT ESTABLISHED / unlikely** | AutoGuildX defines no `storage` service on `proxy`. Noetia staging's `storage` leaves `proxy` with NEM-017 |
| AutoGuildX `web` reaching Noetia `api` while AutoGuildX `api` is down | **POSSIBLE** | Requires the collision. Requests, including any forwarded headers or cookies, would reach Noetia's API and likely get 404 (`/api/v1/*` isn't a Noetia route). Not observed |
| Noetia `web` reaching AutoGuildX `api` while Noetia `api` is down | **POSSIBLE** | Requires the collision and `INTERNAL_API_URL` using `api`. Share pages would get wrong responses or errors. Not observed |
| Cross-project traffic has actually happened | **NOT ESTABLISHED** | No logs inspected |
| Fall-through mechanism on Docker 29.x | **CONFIRMED** (locally) | NEM-017 `run.sh`: original layout F1–F4 |

### 5.5 Read-only commands for the PO

Run these one line at a time. They read only Docker metadata or name resolution.

1. Proxy members and their compose identity:
   `docker ps --filter network=proxy --format '{{.Names}}  {{.Label "com.docker.compose.project"}}/{{.Label "com.docker.compose.service"}}'`
2. DNS names per network for the relevant containers:
   `for c in autoguildx-web-1 autoguildx-api-1 noetia-web-1 noetia-api-1 noetia-storage-1 traefik; do docker inspect -f '{{.Name}} {{range $k,$v := .NetworkSettings.Networks}}{{$k}}={{$v.DNSNames}} {{end}}' $c; done`
   - **A collision is confirmed** if both `autoguildx-api-1` and `noetia-api-1` list `api` under `proxy=`.
   - Do the same comparison for `web`.
3. The internal API URL each `web` uses (prints only that variable, whose value is a URL and not a secret):
   - `docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' noetia-web-1 | grep -E '^INTERNAL_API_URL='`
   - `docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' autoguildx-web-1 | grep -E '^API_URL='`
4. Current resolution, which should show the own-project IP only:
   - `docker exec autoguildx-web-1 getent hosts api`
   - `docker exec noetia-web-1 getent hosts api`
   - Compare with `docker inspect -f '{{.Name}} {{range $k,$v := .NetworkSettings.Networks}}{{$k}}={{$v.IPAddress}} {{end}}' autoguildx-api-1 noetia-api-1`
   - If `getent` is missing in an image: `docker exec <c> node -e "require('dns').lookup('api',{all:true},(e,a)=>console.log(e||a))"`
5. Whether the analytics stack runs, and on which networks:
   `docker ps --filter name=posthog --format '{{.Names}} {{.Networks}}'`

**Don't** stop or restart any service to demonstrate the fall-through. Normal operation won't show it, and the local reproduction already establishes the mechanism.

## 6. Recommended future remediation (separate mission; not implemented)

Proposed mission, NEM-018 candidate: **AutoGuildX / Noetia production network isolation.** Apply the NEM-017 pattern:
- a dedicated Traefik network for one project, for example `proxy_agx`, created and live-attached to Traefik
- that project's `web`/`api` moved to it, with a `traefik.docker.network` label

**Recommendation:** move AutoGuildX, not Noetia production.
- Production keeps `proxy` and stays unchanged.
- The change lives in the AutoGuildX repository, with its own brief AutoGuildX recreation.

**Lighter interim option:** point each `web` at a project-unique name, for example `INTERNAL_API_URL=http://noetia-api-1:4000`. That is still a production config change needing its own authorization.

Prerequisite: the §5.5 results.

## 7. Risks and assumptions

- **Assumed** that the live AutoGuildX deployment matches repository `a09e9a8`. The container names the PO observed are consistent with it, but this is unverified.
- **Assumed** that Noetia's live `INTERNAL_API_URL` uses `api` (the code default). Verify with §5.5, command 3.
- **TLS** isn't testable locally (unchanged from the NEM-017 report).
- The risks from the compatibility report still apply:
  - `/opt/traefik` file drift
  - accidental Traefik recreation
  - live container drift (detected by the dry-run in step 2.1b)
  - the seeding script relying on network name sort order
- The deploy branch's `docker-compose.server.yml` is behind `main` (§5.2). It's harmless for staging, but the branch must never deploy production.

## 8. Recommendation

**GO for deployment review** of `deploy/nem-017-on-006c` at `9192c50`. This isn't a deployment: the live rollout still needs separate authorization.

The AutoGuildX finding is orthogonal to NEM-017, and the NEM-017 rollout reduces it; it doesn't widen it.

## 9. Actions still requiring separate PO authorization

1. The NEM-017 live rollout (compatibility report §8, steps 0–6), with a window and a snapshot.
2. The step 6 edit to `/opt/traefik/docker-compose.yml`.
3. Running the §5.5 read-only commands (by the PO), or granting read-only inspection access.
4. Opening the NEM-018 candidate (AutoGuildX isolation) as a mission.
5. The NEM-006C seeding-script network-filter hardening.
6. Merge paths for PRs #26, #27 and `deploy/nem-017-on-006c`. None are merged.
7. NEM-016 staging pre-flight, after the rollout.

The pending preview prompt is still a separate outstanding item.

## 10. Changes made

- New branch `deploy/nem-017-on-006c` (`9192c50`), pushed. No PR opened for it.
- This report, added to the existing Draft PR #27 branch.

## 11. Tests and verification

See §5.2 and §5.3. All local Docker test resources were removed.

## 12. Next recommended action

1. The PO runs the §5.5 commands and shares the output.
2. The PO decides on the NEM-017 rollout window.
3. The PO decides whether to open the AutoGuildX isolation mission.
