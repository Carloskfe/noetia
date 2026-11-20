# NEM-018: AutoGuildX network migration (specification and runbook)

> **PROPOSED. NOT APPROVED AND NOT APPLIED.** Every step below needs explicit Product Owner authorization. Findings and test results are in [the report](../reports/2026-11-03-NEM-018-shared-proxy-network-hardening.md).

## 1. Target topology

```
                       Traefik (the only container on more than one proxy network)
             ┌───────────────┼─────────────────┐
           proxy        proxy_staging       proxy_agx  ← new
             │               │                 │
  Noetia prod            Noetia staging     AutoGuildX
  api web storage        api web storage    web api posthog
  (unchanged)            (NEM-017)
```

Project networks (`noetia_noetia_net`, `autoguildx_agx_net`, `autoguildx_analytics_net`, staging's) are unchanged. Traefik reaches backends by container IP on the network named in each container's `traefik.docker.network` label, so it doesn't use the colliding names.

## 2. AutoGuildX implementation specification

Apply [`autoguildx-proxy-agx.patch`](../../infra/tests/shared-proxy-isolation/autoguildx-proxy-agx.patch) to the AutoGuildX repository. It applies cleanly to `a09e9a8` (`git apply --check`).

| File | Change |
|---|---|
| `docker-compose.server.yml` | `proxy` → external `proxy_agx` on `web` and `api`; `traefik.docker.network=proxy_agx` on both; header updated |
| `docker-compose.analytics.yml` | The same for `posthog` |

Nothing else changes: router rules, ports, `API_URL=http://api:4000/api/v1`, `DATABASE_URL`, volumes and project name all stay as they are.

Also update `CLAUDE.md` in that repository, whose network description becomes wrong (lines 198, 200 and 223).

**No Noetia compose or application change is required.**

### Traefik compose file (after NEM-017 is settled)

`/opt/traefik/docker-compose.yml` must eventually list every network, or a future recreation disconnects that application. Don't edit `infra/server/traefik/docker-compose.yml` until NEM-017's version of it has landed, because NEM-017 changes the same lines.

```yaml
    networks:
      - proxy
      - proxy_staging   # NEM-017
      - proxy_agx       # NEM-018

networks:
  proxy:
    external: true
  proxy_staging:
    external: true
  proxy_agx:
    external: true
```

Also add `docker network create proxy_agx` to `infra/server/init.sh` at the same time, so a rebuilt server has it.

## 3. Prerequisites

All of these are read-only and are for the Product Owner to run, one line at a time.

| # | Command | Needed result |
|---|---|---|
| 1 | `docker ps --filter network=proxy --format '{{.Names}}  {{.Label "com.docker.compose.project"}}/{{.Label "com.docker.compose.service"}}'` | Only Noetia production, AutoGuildX and Traefik (plus staging if NEM-017 isn't finished). Anything else needs its own decision |
| 2 | `docker ps --filter name=posthog --format '{{.Names}} {{.Networks}}'` | Whether analytics runs. If it does, Step 3 applies |
| 3 | `git -C /opt/autoguildx log -1 --oneline` and `git -C /opt/autoguildx status --short` | `a09e9a8` and a clean tree. Otherwise re-validate the patch |
| 4 | `docker exec noetia-web-1 sh -c 'grep -o "http://api:4000" .next/routes-manifest.json \| head -1'` | Confirms the baked rewrite target on the live image |
| 5 | `docker network ls \| wc -l` | Confirms there's room for another bridge network in Docker's address pools |

Also confirm:
- NEM-017's rollout is finished and accepted. It performs the same live-attach operation first, so it proves that step on the real host.
- `/opt/traefik/docker-compose.yml` hasn't changed unexpectedly.
- A Contabo snapshot was taken and a low-traffic window for AutoGuildX was chosen.

## 4. Migration

**Order matters.** AutoGuildX's CD job runs `docker rm -f` on web, api and db **before** `docker compose up`. If `proxy_agx` is missing, compose then fails and AutoGuildX stays down (rehearsal checks P3 and P4). Steps 1 and 2 must come before the merge in Step 3.

Run each command as a single line. Never paste multi-line content into the server terminal.

| Step | Action | Checkpoint before continuing |
|---|---|---|
| 1 | `docker network create proxy_agx` | `docker network inspect proxy_agx` succeeds |
| 2 | `docker network connect proxy_agx traefik` **Never run `docker compose up` in `/opt/traefik` here: that recreates Traefik and interrupts every site.** | `docker inspect -f '{{.State.StartedAt}}' traefik` is unchanged, and `noetia.app` and `autoguildx.com` both answer |
| 3 | Merge the AutoGuildX PR to its `main`. Its CD job deploys. AutoGuildX is down from the `rm -f` until its new containers are up, as in any AutoGuildX deploy. If analytics runs, then run `docker compose --env-file .env.production -f docker-compose.analytics.yml up -d` in `/opt/autoguildx`, because the CD job's `--remove-orphans` removes it | CD succeeded; `autoguildx.com`, `/api/v1/health`, login and Socket.IO messaging work; `analytics.autoguildx.com` answers if used |
| 4 | Verify isolation (below) | All results as expected |
| 5 | At the next planned Traefik maintenance, update `/opt/traefik/docker-compose.yml` (§2) and the repository copy. Plain `docker restart traefik` keeps the attachment; a recreation from a stale file doesn't | File reviewed; a separately authorized window if Traefik will be recreated |

**Step 4 checks.** None of them stops a service.
- `docker exec autoguildx-web-1 node -e "require('dns').lookup('noetia-api-1',(e,a)=>console.log(e?e.code:a))"` must print an error code, not an address.
- `docker exec noetia-web-1 node -e "require('dns').lookup('autoguildx-api-1',(e,a)=>console.log(e?e.code:a))"` must print an error code, not an address.
- `docker network inspect proxy -f '{{range .Containers}}{{.Name}} {{end}}'` must list no `autoguildx-` container.
- Spot-test `noetia.app`: login, book list, audio stream.

Don't stop a production service to demonstrate the fall-through. The local tests already cover that mechanism.

## 5. Rollback

Traefik stays attached to `proxy_agx` until the end. Being attached to an extra network doesn't affect routing, so AutoGuildX can return to `proxy` at any time.

| Failure at | Rollback |
|---|---|
| Step 1 or 2 | `docker network disconnect proxy_agx traefik`, then `docker network rm proxy_agx`. No application was touched |
| Step 3 fails before the merge lands | Nothing to undo beyond the row above |
| Step 3 or 4 after deploy | Revert the AutoGuildX commit on its `main`. CD redeploys on `proxy`. Re-apply analytics if it runs. Then confirm routes, then undo Steps 1–2 |
| CD unavailable | In `/opt/autoguildx`: `git checkout <previous-sha> -- docker-compose.server.yml docker-compose.analytics.yml`, then `docker compose --env-file .env.production -f docker-compose.server.yml up -d --no-deps --no-build api web` |
| AutoGuildX unreachable after a Traefik recreation | `docker network connect proxy_agx traefik`. Recovers without a restart (rehearsal check G3) |

Rollback touches no database or volume. Noetia is never recreated in any path.
