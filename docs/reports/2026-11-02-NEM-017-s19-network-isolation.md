# NEM-017: S19 staging/production Docker network isolation

> Implementation report (agent reporting protocol). **Nothing was deployed, and no live Docker network, container or Traefik instance was changed.** All tests ran on a local, disposable Docker 29.9.1 environment.

## 1. Mission and objective

Eliminate the cross-environment Docker DNS resolution found in S19 (NEM-016 report §16), without disrupting production routing.

Mission record: `docs/engineering-missions/IN-PROGRESS/NEM-017-s19-network-isolation.md`

## 2. Date and status

- **Date:** 2026-11-02
- **Branch:** `infra/nem-017-s19-network-isolation`, from `nem-006a-staging` at `15e5762`, the only branch that holds the staging stack
- **Draft PR** targets `nem-006a-staging`
- **Status:** implemented and tested locally; awaiting review and PO authorization for the rollout

## 3. Scope and exclusions

**Changed:**
- the staging compose file
- the Traefik compose file (persisted attachment)
- staging docs
- a new local test harness

**Unchanged:**
- `docker-compose.server.yml` (production)
- all application code
- databases, Stripe, entitlements
- NEM-016 / PR #25 code
- the pending preview prompt (still an outstanding item)

## 4. Executive summary

- **Fix.**
  - Staging's `api`, `web` and `storage` leave production's `proxy` network for a dedicated external `proxy_staging` network, selected with `traefik.docker.network=proxy_staging`.
  - Traefik becomes the **only** container on both networks. It reaches backends by container IP and doesn't forward traffic between bridge networks.
  - No staging container shares a network with any production container, so service names can no longer cross environments.
  - Production configuration is unchanged.
- **Evidence: real compose files mirrored locally.**

  | Configuration | Result |
  |---|---|
  | NEM-017 | **30/30 checks pass**. A stopped service fails safely (DNS `EAI_AGAIN`), and nothing crosses between environments. |
  | Original | The same suite **fails 9 checks**: for example, staging storage down → **production storage 20/20**; production api down → **staging api 20/20**. |
  | Rollout rehearsal | **18/18**. Traefik was attached live without a restart; production returned only production to **485/485** monitor requests during the whole rollout and rollback. |

- **Operational finding.** Running `docker compose up -d` in `/opt/traefik` with the updated file **recreates Traefik**, a brief outage for every site on the host. The rollout therefore uses a live `docker network connect`, and the file only takes effect at a planned Traefik maintenance.
- **Recommendation: READY FOR DEPLOYMENT REVIEW** (§12).

## 5. Verified findings and changes

### 5.1 Network architecture: before and after

```
BEFORE (S19)                                            AFTER (NEM-017)
proxy:  traefik, prod api/web/storage,                  proxy:          traefik, prod api/web/storage
        staging api/web/storage   <- shared names       proxy_staging:  traefik, staging api/web/storage
noetia_noetia_net:  prod (all services)                 noetia_noetia_net:  prod (unchanged)
noetia_staging_noetia_staging_net: staging (all)        noetia_staging_noetia_staging_net: staging (unchanged)
```

### 5.2 Changes

| File | Change |
|---|---|
| `docker-compose.staging.yml` | `proxy` → `proxy_staging` (external, `name: proxy_staging`) for api, web and storage; `traefik.docker.network=proxy_staging` on all three routed services; isolation-contract header updated, including the project name corrected to `noetia_staging` (it said `noetia-staging`; noted as R4 in NEM-016 §15.5) |
| `infra/server/traefik/docker-compose.yml` | Traefik `networks: [proxy, proxy_staging]`; `proxy_staging` declared external |
| `docs/staging/README.md`, `RUNBOOK.md`, `EXTERNAL-ACTIONS.md` | Topology; one-time network setup (create plus live attach); a warning not to run `compose up` in `/opt/traefik`; post-deploy isolation checks |
| `infra/tests/network-isolation/` (`mirror.py`, `run.sh`, `rollout.sh`, `README.md`) | Local regression harness and rollout rehearsal |

**Resolved configuration** (`docker compose config` with throwaway values):
- staging api, web and storage: networks `[noetia_staging_net, proxy_staging]`, label `traefik.docker.network=proxy_staging`
- cache, db, image-gen, search and worker: `[noetia_staging_net]` only
- **staging services on `proxy`: none**
- Traefik: `[proxy, proxy_staging]`

**Environment-specific hostnames: not required.**
- After the move, the only container on both sides is Traefik, which doesn't resolve backend names.
- In each environment, `api` and `storage` exist only within that environment.
- A stopped service resolves to nothing (F1d–F4d).
- Unique internal aliases remain an optional hardening step. They would change production env and compose, so they're left for a separate change.

## 6. Traefik compatibility

| Item | Assessment |
|---|---|
| Network attachments | Traefik must be on `proxy` (production, unchanged) **and** `proxy_staging`. Attaching a running container with `docker network connect` **doesn't restart it** (verified: `StartedAt` unchanged, S2b/RB2b). |
| Docker provider | `providers.docker.network: proxy` stays the default, so production routers are unchanged. Staging containers override it per container with the `traefik.docker.network=proxy_staging` label (the pre-existing mechanism, now pointing at the new network). |
| Routers | Unchanged. Names `noetia-*` / `noetia-staging-*`; Host rules `noetia.app`, `www.noetia.app`, `storage.noetia.app` / `staging.noetia.app`, `storage.staging.noetia.app`. Verified locally: T1–T7, including staging basic-auth 401/200 and the API strip-prefix. |
| TLS | Router `tls.certresolver=letsencrypt` labels and the ACME HTTP challenge (entrypoint `web`) don't depend on the backend network, so they're unchanged. **Not testable locally** (no public DNS or Let's Encrypt); certificates in `acme.json` are kept across a Traefik recreation. |
| Service-to-service | Internal traffic stays on each project network (N1–N7). Traefik doesn't route between bridge networks. |
| Restart or recreation? | **Live attach: no restart.** **`docker compose up -d` with the updated Traefik file: recreates Traefik** (verified locally, E2), a brief outage for every routed site on the host, **including the other project on the same host** (`/opt/autoguildx`). With the file updated but `proxy_staging` missing, `up -d` **fails before touching Traefik** (E1, safe). |
| Ordering | Attach Traefik **before** moving staging. If staging moves first, staging routes return errors until the attach. Production is unaffected either way. |

## 7. Tests and verification (actual results)

**`run.sh` on the NEM-017 configuration** (production compose taken from `origin/main`):
```
── Normal traffic stays in-environment
PASS  N1    staging web → api                                            {"stg-api":20}
PASS  N2    staging api → storage                                        {"stg-storage":20}
PASS  N3    staging api → db                                             {"stg-db":20}
PASS  N4    staging api → cache                                          {"stg-cache":20}
PASS  N5    production web → api                                         {"prod-api":20}
PASS  N6    production api → storage                                     {"prod-storage":20}
PASS  N7    production api → db                                          {"prod-db":20}
── Traefik routes both environments (TLS omitted locally)
PASS  T1    noetia.app → production web                                  {"prod-web":1}
PASS  T2    noetia.app/api → production api                              {"prod-api":1}
PASS  T3    storage.noetia.app → production storage                      {"prod-storage":1}
PASS  T4    staging.noetia.app (auth) → staging web                      {"stg-web":1}
PASS  T5    staging.noetia.app (no auth) → 401                           {"401":1}
PASS  T6    staging.noetia.app/api → staging api                         {"stg-api":1}
PASS  T7    storage.staging.noetia.app → staging storage                 {"stg-storage":1}
── S19 fall-through: a stopped service must fail safely
PASS  F1    staging storage DOWN: staging api → storage                  {"ERR:TIMEOUT":20}
PASS  F1d   staging storage DOWN: DNS lookup of storage                    {"ERR:EAI_AGAIN":1}
PASS  F2    production storage DOWN: production api → storage            {"ERR:TIMEOUT":20}
PASS  F2d   production storage DOWN: DNS lookup of storage                 {"ERR:EAI_AGAIN":1}
PASS  F3    production api DOWN: production web → api                    {"ERR:TIMEOUT":20}
PASS  F3d   production api DOWN: DNS lookup of api                         {"ERR:EAI_AGAIN":1}
PASS  F4    staging api DOWN: staging web → api                          {"ERR:TIMEOUT":20}
PASS  F4d   staging api DOWN: DNS lookup of api                            {"ERR:EAI_AGAIN":1}
── Recreation: no cross-environment answer while a container is replaced
PASS  R1    staging api recreated: staging web → api                     {"stg-api":316,"ERR:ECONNREFUSED":4}
PASS  R2    staging storage recreated: staging api → storage             {"stg-storage":319,"ERR:ECONNREFUSED":1}
PASS  R3    production api recreated: production web → api               {"prod-api":319,"ERR:ECONNREFUSED":1}
PASS  R4    production storage recreated: prod api → storage             {"prod-storage":319,"ERR:ECONNREFUSED":1}
PASS  R5    production routing during staging recreation                   {"prod-web": 60}
PASS  R6    after Traefik recreation: noetia.app → production web        {"prod-web":1}
PASS  R7    after Traefik recreation: staging.noetia.app/api → staging api {"stg-api":1}
── Network membership
PASS  M1    no staging container on production's proxy network             {"0":1}
PASSED: 30  FAILED: 0
```

**`run.sh` on the ORIGINAL configuration (baseline; the suite must detect S19):**
```
── Normal traffic stays in-environment
PASS  N1    staging web → api                                            {"stg-api":20}
PASS  N2    staging api → storage                                        {"stg-storage":20}
PASS  N3    staging api → db                                             {"stg-db":20}
PASS  N4    staging api → cache                                          {"stg-cache":20}
PASS  N5    production web → api                                         {"prod-api":20}
PASS  N6    production api → storage                                     {"prod-storage":20}
PASS  N7    production api → db                                          {"prod-db":20}
── Traefik routes both environments (TLS omitted locally)
PASS  T1    noetia.app → production web                                  {"prod-web":1}
PASS  T2    noetia.app/api → production api                              {"prod-api":1}
PASS  T3    storage.noetia.app → production storage                      {"prod-storage":1}
PASS  T4    staging.noetia.app (auth) → staging web                      {"stg-web":1}
PASS  T5    staging.noetia.app (no auth) → 401                           {"401":1}
PASS  T6    staging.noetia.app/api → staging api                         {"stg-api":1}
PASS  T7    storage.staging.noetia.app → staging storage                 {"stg-storage":1}
── S19 fall-through: a stopped service must fail safely
FAIL  F1    staging storage DOWN: staging api → storage                  {"prod-storage":20}
FAIL  F1d   staging storage DOWN: DNS lookup of storage                    {"172.22.0.4":1}
FAIL  F2    production storage DOWN: production api → storage            {"stg-storage":20}
FAIL  F2d   production storage DOWN: DNS lookup of storage                 {"172.22.0.8":1}
FAIL  F3    production api DOWN: production web → api                    {"stg-api":20}
FAIL  F3d   production api DOWN: DNS lookup of api                         {"172.22.0.6":1}
FAIL  F4    staging api DOWN: staging web → api                          {"prod-api":20}
FAIL  F4d   staging api DOWN: DNS lookup of api                            {"172.22.0.3":1}
── Recreation: no cross-environment answer while a container is replaced
PASS  R1    staging api recreated: staging web → api                     {"stg-api":319,"ERR:ECONNREFUSED":1}
PASS  R2    staging storage recreated: staging api → storage             {"stg-storage":319,"ERR:ECONNREFUSED":1}
PASS  R3    production api recreated: production web → api               {"prod-api":318,"ERR:ECONNREFUSED":2}
PASS  R4    production storage recreated: prod api → storage             {"prod-storage":319,"ERR:ECONNREFUSED":1}
PASS  R5    production routing during staging recreation                   {"prod-web": 60}
PASS  R6    after Traefik recreation: noetia.app → production web        {"prod-web":1}
PASS  R7    after Traefik recreation: staging.noetia.app/api → staging api {"stg-api":1}
── Network membership
FAIL  M1    no staging container on production's proxy network             {"3":1}
PASSED: 21  FAILED: 9
```

**`rollout.sh`: rollout and rollback rehearsal from the original configuration:**
```
── Initial state: ORIGINAL configuration
PASS  I1 (noetia.app/ → prod-web)
PASS  I2 (staging.noetia.app/api/books → stg-api)
── Step 1: docker network create proxy_staging
PASS  S1 network created
PASS  S1b (noetia.app/ → prod-web)
── Step 2: docker network connect proxy_staging traefik  (live, no restart)
PASS  S2 Traefik attached live
PASS  S2b Traefik not restarted
PASS  S2c (noetia.app/ → prod-web)
PASS  S2d (staging.noetia.app/api/books → stg-api)
── Step 3: recreate staging with the NEM-017 compose (proxy_staging)
PASS  S3a (staging.noetia.app/api/books → stg-api)
PASS  S3b (storage.staging.noetia.app/ → stg-storage)
PASS  S3c (noetia.app/ → prod-web)
PASS  S3d no staging container on proxy
── Rollback R1: staging back to the ORIGINAL compose
PASS  RB1 (staging.noetia.app/api/books → stg-api)
── Rollback R2: docker network disconnect proxy_staging traefik ; network rm
PASS  RB2 detached and removed
PASS  RB2b Traefik never restarted
PASS  RB3 (noetia.app/ → prod-web)
PASS  RB4 (staging.noetia.app/api/books → stg-api)
PASS  MON production answered prod-web to all 485 monitor requests
PASSED: 18  FAILED: 0
```

**Notes:**
- F-tests time out (`ERR:TIMEOUT`) because the DNS lookup fails (`EAI_AGAIN`) after the embedded resolver forwards the unknown name upstream. That's a safe failure.
- Recreation tests (R1–R4) pace 320 requests over 8 s or more, with a 1 s stop timeout, so the replacement gap is really exercised (`ECONNREFUSED` seen).
- During the fast Compose recreation no cross-environment answer occurred even in the original configuration. The S19 leak needs the service to stay down: stopped, crashed or restarting (F1–F4).
- Extra edge tests (ad hoc, local): **E1**, where `up -d` with the updated Traefik file and `proxy_staging` missing returned `network … declared as external, but could not be found` and left Traefik running and not restarted; and **E2**, where `up -d` after a live attach still reported `Recreated`.
- Every local test resource was removed afterwards (0 containers, 0 networks).

**Limits of local testing:**
- No TLS or Let's Encrypt.
- Applications replaced by responders (networks and labels are real).
- Docker 29.9.1 locally; the host's Docker version is unknown.
- The host's actual `/opt/traefik/docker-compose.yml` is a manually uploaded copy, not git-managed, and may differ from the repository [A].

## 8. Rollout and recovery plan (not executed; needs PO authorization)

**Production impact by step:**

| Step | Command | Production impact |
|---|---|---|
| 0 | **Preconditions (read-only):** `docker ps`; `docker network ls`; `docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}' traefik`; `docker network inspect proxy -f '{{range .Containers}}{{.Name}} {{end}}'`; `docker version --format '{{.Server.Version}}'`; back up `/opt/traefik/docker-compose.yml` (`cp`) and diff it with the repository; optional Contabo snapshot | none |
| 1 | `docker network create proxy_staging` | none (new network) |
| 2 | `docker network connect proxy_staging traefik` | **Touches the production Traefik** (live attach, no restart; verified locally). Then confirm `https://noetia.app` and `/api/books` return 200. |
| 3 | In `/opt/noetia-staging`: check out the NEM-017 compose; `docker compose -p noetia_staging --env-file .env.staging -f docker-compose.staging.yml up -d` | staging only. Staging is briefly unavailable while api, web and storage are recreated. |
| 4 | **DNS verification:** `docker network inspect proxy` lists **no** `noetia_staging-*`; `docker network inspect proxy_staging` lists Traefik plus the staging api, web and storage; `docker exec noetia_staging-api-1 node -e "require('dns').lookup('storage',{all:true},(e,a)=>console.log(e||a))"` returns only the staging storage IP (compare with `docker inspect`). | none (read-only) |
| 5 | **Routing verification:** `curl` to `noetia.app`, `noetia.app/api/books`, `storage.noetia.app` (production) and `staging.noetia.app` (with the basic-auth user), `staging.noetia.app/api/books`, `storage.staging.noetia.app`; RUNBOOK "Confirm production unaffected" | none |
| 6 | Persist: edit `/opt/traefik/docker-compose.yml` with nano to add `proxy_staging`. **Don't run `compose up`.** | none now; takes effect at the next planned Traefik recreation |

**Recovery and rollback** (rehearsed: RB1–RB4):
- **R1.** Staging back to the previous compose: `git checkout <previous>` then `dcs up -d`. Staging only.
- **R2.** `docker network disconnect proxy_staging traefik`, then `docker network rm proxy_staging`. Live, no restart (verified).
- **R3.** Restore the `/opt/traefik/docker-compose.yml` backup.
- **Failure at step 2:** Traefik keeps serving `proxy` (the attach is additive). Retry or skip; staging can stay on the old configuration.
- **Failure at step 3:** staging routes error, production is unaffected. Fix forward or apply R1.
- **If Traefik is ever recreated with an old file lacking `proxy_staging`:** staging routing stops, production is unaffected. Re-run step 2.

**Expected downtime:**
- production: **none** (steps 1, 2, 4 and 5 are live and additive)
- staging: seconds during step 3

**Operational risks:**
- step 2 is the only operation on a production-critical container
- the host's Traefik compose copy may differ from the repository
- an unplanned `docker compose up -d` in `/opt/traefik` after step 6 would recreate Traefik (an outage of a few seconds for every site)

## 9. Risks remaining

| Risk | Level | Note |
|---|---|---|
| Live attach on the production Traefik | Low | Verified non-restarting locally; additive; rollback rehearsed |
| `/opt/traefik` file drift (not git-managed) | Medium | Back it up and diff it in step 0 |
| Accidental Traefik recreation | Medium | Documented warning in RUNBOOK; schedule any recreation in a quiet window |
| Host Docker version differs from local 29.9.1 | Low | Network isolation (no shared network) doesn't depend on DNS ordering semantics |
| **Production exposure until rollout** | **High** | S19 remains live while staging runs on `proxy`. Interim: keep staging stopped (NEM-016 §16.5). |
| Defence-in-depth hostnames not implemented | Low | Optional, separate change |

## 10. Product Owner decisions

1. Authorize the rollout (§8 steps 0–6) and a window, including step 2 on the production Traefik.
2. Optional Contabo snapshot before step 2.
3. When to apply the persisted Traefik file (the next planned Traefik maintenance).
4. Merge path: this PR targets `nem-006a-staging`, which is itself not merged to `main` (the staging stack's acceptance is pending).
5. Interim: keep staging stopped until the rollout?

## 11. Changes made

See §5.2. No application code, no production compose, no live infrastructure.

**Reporting-protocol note:** the protocol (`docs/reports/README.md`) is still only on PR #23's branch, so this report isn't in an index yet. Add it when the protocol lands.

## 12. Next recommended action

**READY FOR DEPLOYMENT REVIEW.** The fix is complete, minimal and locally proven, and the rollout is rehearsed with production continuously monitored.

Next:
1. Product Architecture review
2. PO authorization of the §8 rollout
3. after the rollout, the NEM-016 §15.3 P0 checks, which unblock NEM-016 staging execution

The **pending preview prompt** stays a separate outstanding item.
