# S-ALT rollout and rollback runbook, DNS gate, staging rule (PA findings F-1 / F-2 / F-3)

> **Planning document. Nothing here is authorized to run.** Every server step needs a separate,
> explicit PO authorization naming PR #65 and its exact SHA. The PO runs server commands (split
> supervision); Claude merges SHA-pinned and watches CD/public probes. One-line commands only (never paste
> multi-line into the server terminal).

## F-1: Fail-closed deployment transition

### The hazard (DEP-1), measured
- The **old** web image has the `/api` rewrite baked to `http://api:4000`.
- During this deploy, CD (`up -d --wait`) recreates `api`, because its alias and env changed.
- While the old web is running and Noetia's api container is absent or restarting, two things go through the old web:
  - Traefik drops the api router, so `noetia.app/api/*` falls through to the web router.
  - The old web's SSR fetches.
- Both resolve `api` through `proxy` to AutoGuildX's api. That is exactly S19-e.
- CD gives no ordering guarantee that the old web is gone before the api is recreated.

`transition.sh` reproduces this with real Compose recreation semantics: healthchecks, `init`, `depends_on: [api]` as in production, real Traefik, and continuous traffic of credentialed POST `/api` every 100 ms, pages every 200 ms and SSR every 500 ms:

| Run | Foreign requests | Result |
|---|---|---|
| `forward compose-order` (= CD as-is) | 1 SSR share fetch reached the **AGX api** | **FAIL** |
| `forward compose-order` ×3 | 1 SSR share fetch reached the **AGX api** | **FAIL** |
| `forward web-first` | 0 | PASS |
| `forward web-first` ×3 | 0 | PASS |
| `rollback web-first` | 0 | PASS |
| `rollback compose-order` | 0, but this relies on Compose recreating the api before the web, which is not guaranteed and not relied on | (PASS) |

### Why "web-first" is fail-closed regardless of Compose order
Stop the old web **before** the merge. From then on, three things hold:
1. **No process using the generic `api` name exists.**
2. **The `/api` route fails closed.** `noetia.app/api/*` either reaches Noetia's api directly through Traefik, or gets a Traefik `404` when the api is absent: there is no web router to fall back to.
3. **The new web can only resolve `noetia-api.internal`.** It is created from the new image and config, which fails closed (`ENOTFOUND` → `500`).

Whatever order Compose then uses, no request can reach another project. Why this holds:
- `restart: unless-stopped` never restarts a manually stopped container, not even after a daemon restart.
- `up` *recreates* web because its image and environment changed, so it never starts the old container.

### Recommended sequence (single merge of PR #65)

| Step | Who | Action (one line each) | Check / pass condition |
|---|---|---|---|
| 0 | PO | **F-2 DNS gate** (below) | all criteria met, otherwise STOP |
| 1 | Claude | `gh run list --workflow cd.yml --limit 3`: no deploy running or queued; PR #65 HEAD = authorized SHA; CI state recorded | idle; SHA matches |
| 2 | PO | `docker inspect -f '{{.Name}} {{.State.StartedAt}} {{.Image}}' noetia-api-1 noetia-web-1 noetia-storage-1` | record the values (needed to decide the abort path) |
| 3 | PO | `cd /opt/noetia && docker compose --env-file .env.production -f docker-compose.server.yml stop web` | — |
| 4 | PO | `docker ps -a --filter name=noetia-web-1 --format '{{.Names}} {{.Status}}'` | `Exited` |
| 5 | Claude | `curl -s -o /dev/null -w '%{http_code}' https://noetia.app/` and `curl -s https://noetia.app/api/health` | `404` (no web router); api `200` |
| 6 | Claude | merge PR #65 **at the authorized SHA** (`gh pr merge 65 --match-head-commit <sha>`) | merged |
| 7 | Claude | watch the CD run; record the log lines `Container noetia-api-1 Recreate`, `noetia-storage-1 Recreate`, `noetia-web-1 Recreate/Started` | CD success |
| 8 | PO + Claude | **Post-deploy acceptance A1–A9** (PR #65 §9, F-2 post-deploy below) | all pass |
| 9 | Claude | publish the release record on PR #65 | — |

Note: after a successful S-ALT deploy, **later deploys need no special sequencing**. The web only uses the alias, so any future api recreation fails closed.

### Expected interruption (production estimate)

| Window | Web pages, incl. web readers | `/api` via Traefik (mobile app, browser API calls) | Share pages | MinIO (audio, covers) |
|---|---|---|---|---|
| step 3 → CD `up` | down (Traefik 404) | **up** | down | up |
| api recreation inside `up` | down | 404 for the usual api gap (~25 s, debt H1) | down | up |
| storage recreation | down | api S3 calls fail for a few seconds | down | a few seconds |
| **Total** | **≈ CD duration + operator latency: ~5–7 min** | **~25 s** (same as any api deploy) | = web pages | **a few seconds** |

- The CD duration comes from history: the last 6 production runs took 4m18s–5m48s, and this PR rebuilds the web image (~2.5–3.5 min of it).
- In the harness, which has no build time, pages were out about 4.6 s and `/api` about 10 s (8 s modelled api boot).
- Choose a low-traffic window. The mobile app is mostly unaffected.

### Abort and recovery (no step may restart the old web while the api is being recreated)

| Situation | Action | Why it is safe |
|---|---|---|
| Abort before step 6 | `docker start noetia-web-1` | api untouched; the old web resolves `api` to the running Noetia api |
| CD failed **before** `up` (pull or build), and the api `StartedAt` is unchanged from step 2 | `docker start noetia-web-1` (the old container keeps its old image by ID), then fix and retry from step 0 | api untouched |
| CD failed **during or after** `up` (api `StartedAt` changed) | **Do not start the old web container.** Re-run the CD job (`gh run rerun <id>`, which repeats the same `up`) or PO `cd /opt/noetia && docker compose --env-file .env.production -f docker-compose.server.yml up -d --wait`. If the api can't become healthy, keep web stopped (fail closed) and use the rollback below | the new web fails closed; the old web could fall through while the api restarts |
| Deployed but `/api` or SSR returns 500 | `docs/incident-response.md` §10 (alias diagnosis); `up -d --no-deps api storage web` through compose | after S-ALT, every recreation fails closed |

### Rollback (revert PR #65)
- **Authorization:** needs a PO decision naming the revert PR and SHA.
- **Risk acceptance:** the PO must explicitly accept that the system returns to the **pre-S-ALT S19 exposure**. After rollback, every api recreation is again exposed.
- **Sequence:**
  1. Steps 1–2 as above.
  2. PO stops web (now the *new* web) exactly as in step 3, and checks as in steps 4–5.
  3. Claude merges the revert at its SHA.
  4. CD rebuilds the old-style web (≈ the same interruption) and recreates api and storage without the aliases.
- **Verify:**
  - `docker exec noetia-web-1 printenv INTERNAL_API_URL` → `http://api:4000`;
  - `docker exec noetia-api-1 printenv MINIO_ENDPOINT` → `storage`;
  - A5 and A7 public checks.
- **Tested:** `rollback web-first`, 0 foreign requests.
- **Never** hot-fix by editing `INTERNAL_API_URL` or `MINIO_ENDPOINT` on the server.

### Alternatives (each needs a separate PO decision; not recommended here)

| Option | Interruption | Why not recommended now |
|---|---|---|
| **CD change:** build → `stop web` → `up` | ~1–2 min (no build inside the window) | changes `cd.yml`, which needs a CI/CD mission (NEM) and authorization; best long-term for any future transition of this kind |
| **Two-phase:** (1) aliases and `MINIO_ENDPOINT` only, web-first, short window because the web build is cached; (2) web switch only | (1) ~1–2 min, (2) ~0 | splits PR #65 (scope change). Phase 2 is fail-closed **only if the api is not recreated**, which can't be guaranteed in advance (e.g. build-cache loss changes the image ID), so phase 2 would also need web-first to be guaranteed |
| **Pre-building on the server** to shorten the window | unverified | a build from the GitHub URL did **not** reuse the cache locally (269 s vs 1.3 s for a same-tree path build), because the cache depends on the exact working-tree contents; it adds server-side state |
| Stopping AutoGuildX during the deploy | — | excluded by PA |
| CD as-is (accept the transition window) | ~25 s | **temporary credential exposure: excluded by PA**; shown to leak in `transition.sh forward compose-order` |

**Residual risk for PO review (not accepted here):** none on the deploy path if the sequence above is followed. The interruption of web pages for about 5–7 min is the cost, and the PO must decide it. Operator error is the remaining risk, mitigated by the step-4/5 checks and the abort table:
- starting the old web during `up`;
- merging before web is confirmed stopped.

## F-2: Pre-deployment DNS gate (production's existing resolver, read-only)

Run on the server before step 3, one line at a time. Lookups go through each container's real resolver: Docker embedded DNS → host upstream, including the tailnet. The host lookups cover the host resolver directly.

| # | Command | Pass |
|---|---|---|
| D1 | `docker exec noetia-web-1 node -e "const d=require('dns');for(const n of ['noetia-api.internal','noetia-storage.internal','zz-s-alt-control.internal','noetia-api.internal.tail52ba4d.ts.net','noetia-storage.internal.tail52ba4d.ts.net','api','github.com']){const t=Date.now();d.lookup(n,{all:true},(e,a)=>console.log(n.padEnd(44),e?e.code:a.map(x=>x.address).join(','),(Date.now()-t)+'ms'))}"` | see criteria |
| D2 | the same command with `noetia-api-1` instead of `noetia-web-1` | see criteria |
| D3 | `for n in noetia-api.internal noetia-storage.internal zz-s-alt-control.internal; do echo "$n: $(getent ahosts $n \| head -1 \|\| true)"; done` | all empty |
| D4 | `docker inspect -f '{{.Name}} {{(index .NetworkSettings.Networks "noetia_noetia_net").IPAddress}}' noetia-api-1 noetia-storage-1` | reference IPs for D1 `api` |
| D5 | `docker exec noetia-web-1 sh -c "grep -E '^(search\|options\|# ExtServers\|# Overrides)' /etc/resolv.conf"` | records the search domain, any `ndots` and the upstream servers |
| D6 | `tailscale dns status 2>&1 \| head -40` | no split-DNS route for `internal` or `noetia-*` |

**Criteria:**
- **G-a:** in both containers, `noetia-api.internal`, `noetia-storage.internal`, the control `zz-s-alt-control.internal` and the two search-domain forms return `ENOTFOUND` (or `EAI_AGAIN`). **Any address means STOP**: residual R-5 is real, and the design returns to PA.
- **G-b:** the control and the two exact names behave identically. This shows no record or route exists for the exact names specifically.
- **G-c:** `api` from web returns Noetia's `noetia_net` api IP from D4. This is the positive control that the resolver works.
- **G-d:** `github.com` resolves. This proves the upstream is reachable, so the negative answers are real answers and not timeouts.
  - If `github.com` fails (`EAI_AGAIN`), the upstream is unreachable from the containers. Today the exact names would fail closed anyway, but **record it and return to PA** before deploying.
  - In that case the gate cannot show how a reachable upstream would answer.
- **G-e:** D3 is empty, and D6 shows no `internal` split DNS.
- **Record the `ms` timings.** They give the expected fail-closed latency, R-6: `EAI_AGAIN` after a resolver timeout makes slow 500s.

**Post-deploy repeat** (part of acceptance):
- D1 from web: `noetia-api.internal` = Noetia api's `noetia_net` IP; the control still `ENOTFOUND`.
- D2 from api: `noetia-storage.internal` = the storage IP.
- `docker exec autoguildx-web-1 node -e "require('dns').lookup('noetia-api.internal',(e,a)=>console.log(e?e.code:a))"` → not found, because the aliases are invisible on `proxy`. Use `getent hosts` if AGX web has no node.
- If staging is running: the same from `noetia_staging-web-1` → not found.

## F-3: Staging compatibility requirement when staging later syncs with `main`

**No staging change is authorized by this PR.** Facts:
- Staging (`-p noetia_staging`, `docker-compose.staging.yml`, deployed `1295201`) builds its web from its own branch's Dockerfile, which still hard-codes `ENV INTERNAL_API_URL=http://api:4000`.
- `.env.staging.example` sets `INTERNAL_API_URL=http://api:4000` and `MINIO_ENDPOINT=storage`.
- Staging's api, web and storage are on `noetia_staging_net` + `proxy`: NEM-017 / PR #26 (`proxy_staging`) is not applied.
- **PR #65 does not touch `docker-compose.staging.yml`.**

**When staging syncs with a `main` that contains PR #65:**
- Its web is built from the new Dockerfile, so the `/api` rewrite defaults to `http://noetia-api.internal:4000`.
- Staging then **must** have all of the following, in the same sync:

```yaml
# docker-compose.staging.yml (documentation only, not applied)
  api:
    environment:
      MINIO_ENDPOINT: noetia-storage.internal          # literal: overrides .env.staging
    networks:
      noetia_staging_net:
        aliases: [noetia-api.internal]                 # staging's OWN internal network only
      proxy: {}                                        # (proxy_staging after NEM-017): NO aliases here
  web:
    build:
      args:                                            # keep the existing NEXT_PUBLIC_* args
        INTERNAL_API_URL: http://noetia-api.internal:4000
    environment:
      INTERNAL_API_URL: http://noetia-api.internal:4000   # literal: overrides .env.staging (SSR)
  storage:
    networks:
      noetia_staging_net:
        aliases: [noetia-storage.internal]
      proxy: {}
```

**Rules:**
- **ST-1: same names, different networks.** Production and staging may both use `noetia-api.internal` / `noetia-storage.internal`, because aliases are network-scoped. Production's web can only see production's `noetia_net`, and staging's web only staging's.
- **ST-2: never declare a `*.internal` alias on `proxy` or `proxy_staging`.**
  - A `*.internal` alias on a shared network would make production's web fall through to staging, or the reverse, whenever one side's api is down.
  - Contract C2/C4/C13 enforce this for production. Staging needs the same check before its sync is deployed.
  - `contract.sh` reads only `docker-compose.server.yml`; parameterizing it for staging would be a separate authorized change.
- **ST-3: all three parts in the same sync.** Missing parts fail in different ways:
  - Missing api alias: staging `/api` and SSR return `500`. This fails closed, but staging is broken.
  - Missing runtime `INTERNAL_API_URL`: SSR keeps `http://api:4000` from `.env.staging`, and can reach **production's or AGX's api** while staging's api is down.
  - Missing storage part: the staging api's S3 client keeps `storage`, and can reach **production's MinIO** on `proxy` while staging's storage is down. This is a cross-environment path.
- **ST-4: staging transition.** The staging deploy that introduces this must use web-first (stop `noetia_staging-web-1` before its `up`), for the same reason as F-1: the old staging web resolves `api` and can reach production's api.
- **ST-5: verification after the staging sync deploy:**
  - From `noetia_staging-web-1`, `noetia-api.internal` = the staging api's `noetia_staging_net` IP.
  - From `noetia-web-1`, `noetia-api.internal` = the production IP only.
  - `printenv` and the `routes-manifest.json` check as A3/A4 with staging container names.
- **Until staging syncs:**
  - Staging keeps its current exposure. Its web resolves `api` across `proxy`, where production's api still advertises the generic service name `api` (Compose adds it on every network; PR #65 does not remove it).
  - That staging→production direction is the staging equivalent of the inbound residual R-1, closed only by network separation (NEM-017 / PR #62 / NEM-018).
