# NEM-017: pre-deployment compatibility verification (live staging `1295201`)

> Verification report (agent reporting protocol). **Read-only review.** Nothing was deployed or merged. No server file, Docker network, container or Traefik instance was changed, and no production data was accessed. Draft PR #26 is unchanged. The only Docker activity was the disposable local test harness (`s19h*` resources, all removed).

## 1. Mission and objective

Check that the NEM-017 network change (Draft PR #26) can be applied safely to the staging configuration that is actually deployed. Then give an exact, minimal deployment plan for the live server, with verification and rollback commands.

## 2. Date and status

- **Date:** 2026-11-03
- **Inputs, as reported by the Product Owner's read-only inspection:**
  - Docker Engine 29.4.3
  - production is `main` at `6a5e5c0`
  - staging is `nem-006c-staging-content` at `1295201`
  - Traefik is attached only to `proxy`
  - staging and production `api`/`web`/`storage` are both on `proxy`
  - `proxy_staging` doesn't exist
  - AutoGuildX is on `proxy`
  - staging has an untracked `reports/staging-content/`
- **Status:** compatible. A deployment plan is ready, pending PO authorization.

## 3. Scope and exclusions

**Reviewed:**
- the changes from `nem-006a-staging` to `nem-006c-staging-content`
- network and label differences
- whether the merge is clean
- Traefik and AutoGuildX routing
- Docker 29 specifics
- the untracked reports directory
- the NEM-006C seeding script's network handling

**Not done:**
- any server access
- any change to PR #26
- creation of the combined deploy branch, which needs authorization (§10)

## 4. Executive summary

1. **NEM-006C changes 10 files. Three overlap with PR #26:**
   - `docker-compose.staging.yml`
   - `docs/staging/README.md`
   - `docs/staging/RUNBOOK.md`
2. **Hunks don't conflict.** NEM-006C's only compose change is the staging `storage` memory limit, raised from 192M to 512M. A trial merge of PR #26 into `1295201` **completes with no conflicts**. The rendered result keeps the 512M limit and moves exactly `api`, `web` and `storage` to `proxy_staging`.
3. **The merged configuration passes everything locally:**
   - `run.sh` passes 30 of 30.
   - The rollout rehearsal from the *live* `1295201` layout passes 18 of 18. Traefik was not restarted, and production answered correctly to all 466 monitor requests, sent through Traefik's published port.
   - The live `1295201` layout itself fails 11 checks, confirming S19 is present in production today.
4. **Production, AutoGuildX and TLS routing are preserved.** Traefik's default provider network stays `proxy`. Only staging labels name `proxy_staging`.
5. **Docker 29.4.3 needs no change to the procedure.** I added read-only pre-checks (§8, step 0).
6. **`reports/staging-content/` is safe.** No step deletes it, and the change adds no files under `reports/`.
7. **One compatibility note on NEM-006C's seeding script.** It still selects the right network after NEM-017, but only because of network name sort order (§5.4). Hardening it is a follow-up, not a blocker.
8. **One residual risk outside NEM-017.** AutoGuildX shares `proxy` with Noetia production, so the same name fall-through can apply between them (§9).

## 5. Verified findings

### 5.1 `nem-006a-staging` → `nem-006c-staging-content` (12 commits, `15e5762..1295201`)

| Area | Change | Interaction with NEM-017 |
|---|---|---|
| `docker-compose.staging.yml` | `storage`: limits change from `0.25 CPU / 192M` to `0.5 CPU / 512M`, and the reservation from 96M to 128M | Adjacent to, but separate from, NEM-017's `storage` network and label lines. Merges cleanly. |
| `docs/staging/README.md` | New "Content" section | Separate hunk. Clean. |
| `docs/staging/RUNBOOK.md` | New "Rebuild reader content" section | Separate hunk. Clean. |
| `scripts/seed-staging-content.sh` | New script: audio mirror from production to staging, plus sync rebuild | Detects networks at runtime (§5.4). |
| `services/api/src/ingestion/*`, tests, `docs/staging/content-seeding.md` | Staging content tooling | None. No network references. |

NEM-006C doesn't touch networks, Traefik labels, `infra/server/traefik/` or production compose.

### 5.2 Trial merge (local scratch worktree, not committed or pushed)

`git merge --no-commit origin/infra/nem-017-s19-network-isolation` on top of `1295201` auto-merged all three shared files with no conflicts. Rendering the merged file with `docker compose config` and dummy env values gives:

| Service | Networks | `traefik.docker.network` | Memory limit |
|---|---|---|---|
| api | `noetia_staging_net`, `proxy_staging` | `proxy_staging` | 384M |
| web | `noetia_staging_net`, `proxy_staging` | `proxy_staging` | 384M |
| storage | `noetia_staging_net`, `proxy_staging` | `proxy_staging` | **512M** (NEM-006C kept) |
| db, cache, search, image-gen, worker | `noetia_staging_net` | none | unchanged |

`proxy_staging` is declared `external: true`, `name: proxy_staging`, and `proxy` is no longer referenced. The merge changes nothing under `services/` or `scripts/`, so no images need rebuilding.

### 5.3 Differences that matter on the live server

| Live now (`1295201`) | After NEM-017 |
|---|---|
| Staging `api`/`web`/`storage` are on `noetia_staging_noetia_staging_net` and `proxy` | They are on `noetia_staging_noetia_staging_net` and `proxy_staging` |
| Label `traefik.docker.network=proxy` | `…=proxy_staging` |
| Traefik is on `proxy` | Traefik is on `proxy` and `proxy_staging` |
| Router names, Host rules and middlewares | Unchanged |

### 5.4 NEM-006C seeding script (`scripts/seed-staging-content.sh`)

- **Production network.** It takes the first network of `noetia-storage-1`, which is `noetia_noetia_net` (it sorts before `proxy`). NEM-017 doesn't change this.
- **Staging network.** It lists staging storage's networks, drops the line `^proxy$`, and takes the first remaining one.
  - After NEM-017 the list is `noetia_staging_noetia_staging_net` then `proxy_staging`. Go templates iterate maps in sorted order, so the first entry is still the internal network.
  - **The result is correct**, but by sort order rather than by intent. The comment "sits on the staging network and on proxy" also becomes stale.
  - Recommended follow-up, in NEM-006C's scope and not done here: exclude `^proxy(_staging)?$`.
- **Mirror container.** It addresses both MinIO servers by IP and joins both internal networks itself. NEM-017 doesn't affect it. It's a short-lived bridge between the two environments' internal networks for the length of a mirror run. That's existing NEM-006C design, noted only for completeness.
- **`--dry-run`** skips the network-detection phase, so it can't confirm the item above. §8, step 4 includes a direct read-only check.

### 5.5 Untracked `reports/staging-content/`

- It isn't covered by `.gitignore`, which is why it shows as untracked.
- Switching branches or fast-forwarding keeps untracked files. Git would refuse only if the incoming commit added a tracked file at the same path, and NEM-017 adds nothing under `reports/`.
- `docker compose up` doesn't touch the host checkout.
- **Never run `git clean` or `git stash -u` in `/opt/noetia-staging`.**

## 6. Traefik, production and AutoGuildX routing

- **Default network.** `traefik.yml` sets `providers.docker.network: proxy`.
  - Production containers and AutoGuildX containers (labelled `proxy` or unlabelled) keep resolving to their `proxy` IPs.
  - Only the three staging containers name `proxy_staging`.
- **Live attach.** `docker network connect proxy_staging traefik` doesn't restart Traefik or change its static or dynamic configuration. The rehearsal checked `StartedAt` before and after.
- **Default gateway and published ports.** Traefik keeps `proxy` as its first network: it was attached first and its name sorts before `proxy_staging`, at equal gateway priority. The rehearsal sent its monitor through Traefik's published host port during the attach, and no request failed.
- **TLS.** ACME HTTP-01 for the staging hosts goes through the same entrypoints and certificate resolver. Router names are unchanged, so the existing certificates in `acme.json` stay keyed to the same domains. TLS can't be tested locally.
- **AutoGuildX.** Its containers and networks aren't touched. Traefik doesn't forward between `proxy` and `proxy_staging`, and AutoGuildX doesn't join `proxy_staging`.

## 7. Docker Engine 29.4.3

- **Already tested on Docker 29.** The local harness ran on Engine 29.9.1, and the network-connect, DNS, embedded-resolver and multi-network behaviour exercised is the same across 29.x.
- **Traefik and Docker 29's API.** Traefik v2.11 builds older than the Docker-29 compatibility fix fail with "client version … is too old". Production Traefik is routing on 29.4.3 today, so its running binary is compatible. A live `network connect` doesn't change the binary.
  - **The risk is recreating Traefik**, which could pull a different `traefik:v2.11` image. That's one more reason never to run `compose up` in `/opt/traefik` during this rollout.
  - Step 0 records the image and checks the logs.
- **`docker compose --dry-run`** (Compose ≥ 2.17, bundled with Engine 29) previews which services would be recreated without acting. Step 2.1b uses it, after the network exists, because dry-run aborts on a missing external network.
- **Compose `name:` on an external network** is supported. Missing external networks fail before any container changes, which E1 verified.
- **Procedure changes needed for 29.4.3:** none. Only the pre-checks were added.

## 8. Deployment plan (not executed; requires PO authorization)

Conventions:
- Every command is **one line**, typed or pasted one at a time. Never paste multi-line blocks over SSH.
- Run as root on the server in `/opt/noetia-staging` unless a step says otherwise.
- Shorthand for this session, one line: `alias dcs='docker compose -p noetia_staging --env-file .env.staging -f docker-compose.staging.yml'`
- `<DEPLOY_REF>` is the combined branch from §10, decision 1. Proposed name: `deploy/nem-017-on-006c`. It's a merge of `1295201` and PR #26, with no other changes.

**Step 0: read-only pre-checks.** Stop if any result differs from what's expected.

| # | Command | Expected |
|---|---|---|
| 0.1 | `docker version --format '{{.Server.Version}}'` | `29.4.3` |
| 0.2 | `git -C /opt/noetia-staging rev-parse --short HEAD; git -C /opt/noetia-staging status --porcelain` | `1295201`; only `?? reports/` |
| 0.3 | `docker network ls --format '{{.Name}}' \| grep -x proxy_staging` | no output |
| 0.4 | `docker inspect -f '{{.Config.Image}} {{.Image}} {{.State.StartedAt}}' traefik` | Record all three values (for 2.2) |
| 0.5 | `docker logs --since 1h traefik 2>&1 \| grep -ciE 'too old\|level=error'` | `0`, or only known noise |
| 0.6 | `docker network inspect proxy -f '{{range .Containers}}{{.Name}} {{end}}'` | Record the list (production, staging, AutoGuildX, traefik) |
| 0.7 | `cp /opt/traefik/docker-compose.yml /opt/traefik/docker-compose.yml.bak-nem017` | Backup only. This file isn't edited until step 6. |
| 0.8 | Baseline HTTP checks (see 5.1–5.3) | All as expected before anything changes |
| 0.9 | Contabo server snapshot (console) | Recommended by `CLAUDE.md` for infrastructure changes |

**Step 1: fetch and preview. Changes no files in the working tree.**
- 1.1 `git -C /opt/noetia-staging fetch origin <DEPLOY_REF>`
- 1.2 `git -C /opt/noetia-staging diff --stat HEAD FETCH_HEAD`. Expect only docs, `docker-compose.staging.yml`, `infra/server/traefik/docker-compose.yml` and `infra/tests/network-isolation/*`.
- 1.3 `git -C /opt/noetia-staging show FETCH_HEAD:docker-compose.staging.yml > /tmp/nem017-staging.yml`
- 1.4 The recreation preview (`--dry-run`) runs in step 2.1b. Compose's dry-run aborts with "network proxy_staging declared as external, but could not be found" until the network exists (verified locally).

**Step 2: create the network and attach Traefik live.** This is the only step that touches production's Traefik.
- 2.1 `docker network create proxy_staging`. Bridge driver, the same default as `proxy` (created the same way by `infra/server/init.sh`). Nothing is attached to it yet, so this alone changes no routing.
- 2.1b Preview: `docker compose -p noetia_staging --project-directory /opt/noetia-staging --env-file /opt/noetia-staging/.env.staging -f /tmp/nem017-staging.yml --dry-run up -d --no-build --pull never`
  - Expect recreation of **only** `api`, `web` and `storage`.
  - If it would recreate anything else, stop. That means the live containers have drifted from `1295201`. Undo with `docker network rm proxy_staging`.
- 2.2 `docker network connect proxy_staging traefik`, then confirm:
  - `docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}{{.State.StartedAt}}' traefik` prints `proxy proxy_staging` and the **same** `StartedAt` as 0.4.
- 2.3 Repeat the production and AutoGuildX HTTP checks (5.1, 5.3). If anything fails, go to R2.

**Step 3: move staging.** Staging is unavailable for a few seconds.
- 3.1 `git switch -c deploy/nem-017-on-006c FETCH_HEAD`. The old branch `nem-006c-staging-content` stays at `1295201` for rollback, and `reports/` is kept.
- 3.2 `dcs up -d --no-build --pull never --wait`
- 3.3 `dcs ps`: all services are healthy.

**Step 4: isolation checks.**
- 4.1 `docker network inspect proxy -f '{{range .Containers}}{{.Name}} {{end}}'` lists **no** `noetia_staging-*`. Production, AutoGuildX and traefik are as in 0.6.
- 4.2 `docker network inspect proxy_staging -f '{{range .Containers}}{{.Name}} {{end}}'` lists exactly `traefik`, `noetia_staging-api-1`, `noetia_staging-web-1` and `noetia_staging-storage-1`.
- 4.3 `docker exec noetia_staging-web-1 getent hosts api storage` returns only staging IPs. Cross-check with `docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}' noetia_staging-api-1 noetia_staging-storage-1`.
- 4.4 `docker exec noetia-web-1 getent hosts api storage` returns only production IPs. It's read-only and runs inside the production container, with no data access.
- 4.5 Seeding-script network selection, read-only:
  - `docker inspect noetia_staging-storage-1 --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{"\n"}}{{end}}' | grep -v '^proxy$' | grep -v '^$' | head -1`
  - Expect `noetia_staging_noetia_staging_net`.

**Step 5: routing checks.** Run these from the server or a workstation.
- 5.1 Production:
  - `curl -s -o /dev/null -w '%{http_code}\n' https://noetia.app/` → `200`
  - `…/api/health` → `200`
  - `https://storage.noetia.app/minio/health/live` → `200`
- 5.2 Staging:
  - `https://staging.noetia.app/` → `401` without credentials
  - `curl -s -o /dev/null -w '%{http_code}\n' -u <user> https://staging.noetia.app/` (curl prompts for the password, which isn't echoed) → `200`
  - `https://staging.noetia.app/api/health` → `200` (basic auth is dropped on the API router, per `15e5762`)
  - `https://storage.staging.noetia.app/minio/health/live` → `200`
- 5.3 AutoGuildX: its health URL → its expected status (PO to supply the host).
- 5.4 `docker logs --since 10m traefik 2>&1 | grep -iE 'level=error|unable' | tail -20` → no new errors.
- 5.5 The runbook's "production unaffected" checks, plus the deployment-verification block in `CLAUDE.md`.

**Step 6: persist the Traefik attachment.** Optional, and can be deferred.
- Edit `/opt/traefik/docker-compose.yml` with **nano** to match the repository's version (add `proxy_staging` under the service's `networks` and as an `external: true` network).
- **Do not run `docker compose up` in `/opt/traefik`.**
- The live attachment already survives `docker restart traefik`, daemon restarts and reboots. It's lost only if Traefik is recreated. This edit makes a future intentional recreation keep the network.

**Expected impact:**
- **Production and AutoGuildX:** no downtime.
- **Staging:** a few seconds during step 3.2.

## 9. Rollback and risks

**Rollback, in reverse order.** All commands are one line and were rehearsed locally.

| # | When | Commands |
|---|---|---|
| R1 | A staging problem after step 3 | `git -C /opt/noetia-staging switch nem-006c-staging-content` then `dcs up -d --no-build --pull never --wait`. Staging returns to `proxy`, the known pre-NEM-017 state, which brings S19 back. |
| R2 | A Traefik or production problem after step 2 | Run R1 first if step 3 ran. Then `docker network disconnect proxy_staging traefik`. Confirm `StartedAt` is unchanged and production is 200. |
| R3 | Clean-up | `docker network rm proxy_staging`. It refuses while any container is attached, which is safe. If step 6 ran: `cp /opt/traefik/docker-compose.yml.bak-nem017 /opt/traefik/docker-compose.yml`. |

**Last resort:** `docker restart traefik`. It keeps its networks and causes a short outage for every site. Never recreate Traefik.

**Risks:**
- **AutoGuildX ↔ Noetia production (new, outside NEM-017).** They share `proxy`. If an AutoGuildX container answers to `api`, `web`, `storage`, `db` or another name Noetia uses, the S19 fall-through applies between them.
  - Read-only check: list `proxy` members with their DNS names, using `docker inspect -f '{{.Name}} {{(index .NetworkSettings.Networks "proxy").DNSNames}}' <container>` for each AutoGuildX container.
  - If names collide, the remedy needs its own mission, either a dedicated AutoGuildX network or environment-specific aliases.
- **`/opt/traefik` file drift.** The file isn't managed by git. Step 0.7 backs it up, and step 6 is a manual edit.
- **Accidental Traefik recreation.** It causes an outage for every site and may pull a different image (§7). Mitigation: the runbook warning, and the step 6 edit.
- **Live container drift from `1295201`.** If containers were changed by hand since that commit, step 2.1b detects it.
- **Seeding script relying on sort order** (§5.4).

## 10. Product Owner decisions

1. **Deploy ref.**
   - **Recommended:** authorize creating and pushing `deploy/nem-017-on-006c`. It would be the verified clean merge of `1295201` and PR #26, with nothing else, and would give the server a traceable commit.
   - **Alternatives:**
     - retarget PR #26 to `nem-006c-staging-content` and merge it there
     - merge on the server, which is less traceable
2. **Rollout window and authorization** for steps 2–5, including step 2, which touches production's Traefik.
3. **Snapshot** before step 2 (recommended).
4. **Step 6 timing:** now, or deferred.
5. **AutoGuildX name-collision check** (§9): authorize the read-only inspection.
6. **NEM-006C follow-up:** harden the seeding script's network filter.

## 11. Changes made

- This report only, on `docs/nem-017-predeploy-verification` (stacked on PR #26's branch).
- PR #26, the server and all other PRs are unchanged.

## 12. Next recommended action

The PO decides on items 1–3 in §10. Once authorized:
1. I create the deploy ref.
2. The operator runs step 0 and reports the results.
3. Steps 1–5 follow in one window.
4. After step 5 passes, the NEM-016 staging pre-flight (report §15) can proceed.

The pending preview prompt stays a separate outstanding item.
