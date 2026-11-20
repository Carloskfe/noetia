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

### PA question: does making Noetia web unavailable during the api recreation prevent credential forwarding?

**Yes**, with one precise condition. The old web must be unavailable for **the whole window in which Noetia's api can be absent**. That window runs from before CD's `up` starts until the new web (alias-only) replaces it. The reason:

- **The old web is the only Noetia component using the generic name.** It is the only one that resolves `api`:
  - its baked `/api` rewrite;
  - its SSR `INTERNAL_API_URL`, which comes from `.env.production`.
- **The other paths can't forward:**
  - The api's own S3 client and the internal-only services (`worker`, `image-gen`, `prometheus`) are not on `proxy`, or are switched by this PR.
  - Traefik never uses DNS. It routes to containers by label.
- **Both forwarding paths go through the old web.**
  - (a) While the api container is absent or unhealthy, Traefik drops the `noetia-api` router. So **every** `noetia.app/api/*` request, from the **browser and the mobile app alike** with their `Authorization` and cookies, falls through to the `noetia-web` router, then to the old web's rewrite, then to `api`, which resolves to AGX.
  - (b) SSR share pages fetch `api` from the old web.
- **With the old web stopped,** (a) gets a Traefik `404` (no router matches) and (b) doesn't exist. No Noetia request can leave the project, whatever order Compose recreates things in.
- **Measured:** `transition.sh … web-first`, 0 foreign requests forward ×1 and ×3 and on rollback. CD as-is leaked in 2 of 2 runs.

**The condition can't be met by stopping web only "around" the api recreation.** CD runs build and then `up` in one SSH script, so an operator timing `stop web` during the build is a race. A late stop leaves the old web up during the recreation, so it is **not** fail-closed. Web must therefore be stopped **before the merge**, which makes the outage include the in-CD web build.

### Options compared

| Option | Fail-closed guarantee | Web-page downtime | `/api` downtime (mobile + browser) | Operational steps | Rollback risk | Needs |
|---|---|---|---|---|---|---|
| **A. Web-first, single merge (recommended)** | **Yes**, independent of Compose order (tested) | **~5–7 min** (CD 4m18s–5m48s with the web rebuild, plus operator latency) | ~25 s (normal api gap) | PO: record state, `stop web`, verify. Claude: merge at SHA, watch CD. PO + Claude: A1–A9 | Rollback uses the same web-first sequence (tested 0 foreign); it restores pre-S-ALT S19 exposure; ~5–7 min again | PO authorization for the merge and the one server `stop` |
| B. Operator stops web during the CD build | **No**: race against `up` | ~1–3 min if on time | ~25 s | Watch the CD log, stop web before "Recreating changed containers" | A late stop means exposure | not acceptable |
| C. CD change: build → `stop web` → `up` | Yes (same mechanism as A, scripted) | **~1–2 min** (no build inside the window) | ~25 s | Edit `cd.yml` (one-time or conditional), then a normal merge | The revert also needs the CD step; a CD change affects every later deploy | CI/CD NEM mission + PO authorization (out of scope here) |
| D. Two-phase: (1) aliases + `MINIO_ENDPOINT` web-first, (2) web switch | Phase 1 yes. Phase 2 **only if the api is not recreated**, which can't be guaranteed in advance (build-cache loss changes the image ID), so it is guaranteed only if phase 2 is also web-first | (1) ~1–2 min (web image unchanged, cached). (2) 0 min or, if web-first, ~5–7 min | ~25 s in phase 1 | Two PRs, two merges, two acceptance rounds | Two rollback points, with a mixed state between phases | Scope change (split PR #65) |
| E. Disconnect the old web from `proxy` instead of stopping it | Yes | the same as A (Traefik reaches web only via `proxy`) | ~25 s | Live `docker network disconnect` | Live network op; reconnecting is manual | **excluded**: live network modification |
| F. CD as-is | **No** (leaked 2/2) | ~0 | ~25 s | none | — | **excluded**: accepts temporary credential exposure |
| G. Stop AutoGuildX during the deploy | Yes for AGX, not for staging (staging's api also advertises `api` on `proxy`) | ~0 | ~25 s | Cross-project operation | — | **excluded by PA** |

**Recommendation: A** now, with no repository or CD change beyond PR #65. **C** is the better long-term pattern if the PO wants shorter windows for future transitions, as a separate CI/CD mission.

### Recommended sequence (single merge of PR #65)

| Step | Who | Action (one line each) | Check / pass condition |
|---|---|---|---|
| 0 | — | **F-2 DNS gate: PASSED** (PA-accepted 2026-11-19; not repeated) | — |
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

### Residual risk for PO review (not accepted here)

No credential exposure remains on the deploy path if the sequence above is followed. The interruption of web pages for about 5–7 min is the cost, and the PO must decide it. Operator error is the remaining risk, mitigated by the step-4/5 checks and the abort table:
- starting the old web during `up`;
- merging before web is confirmed stopped.

## F-2: Pre-deployment DNS verification: PASSED (PA-accepted 2026-11-19)

The PO ran the verification through production's existing resolver:

| Name | Result |
|---|---|
| `noetia-api.internal` | `ENOTFOUND` |
| `noetia-storage.internal` | `ENOTFOUND` |
| `zz-s-alt-check.internal` (control) | `ENOTFOUND` |

PA accepted F-2 as passed for the current production DNS configuration. **No further pre-deployment DNS verification is requested.**

The exact names and the control fail identically with `ENOTFOUND`. That is a definitive negative answer, not a timeout, so no resolver, search domain or tailnet split DNS answers them. The `.internal` architecture is kept.

Post-deploy, the existing acceptance checks A2/A6/A9 (PR #65 §9) still confirm the positive case: the aliases resolve to Noetia's own containers, and stay invisible from AGX.

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
