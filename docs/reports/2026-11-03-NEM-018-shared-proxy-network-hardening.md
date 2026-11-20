# NEM-018: shared proxy network hardening

> Investigation report (agent reporting protocol). **Nothing was deployed.** No VPS access, no live network, container, Traefik, database or volume change, no merge, no Stripe change, and no write to the AutoGuildX repository. All tests ran on a local, disposable Docker environment. **Local results are not production validation.**

## 1. Mission and objective

Investigate and design a safe, testable isolation strategy for Noetia production and AutoGuildX that prevents unintended cross-application DNS resolution while preserving Traefik routing and application connectivity.

Mission record: `docs/engineering-missions/IN-PROGRESS/NEM-018-shared-proxy-network-hardening.md`

## 2. Date and status

- **Date:** 2026-11-03
- **Branch:** `infra/nem-018-shared-proxy-hardening`, from `main` at `6a5e5c0`
- **Status:** investigation, tests and documentation complete. Awaiting Product Owner review. Stopped before any merge or live operation.

## 3. Scope and exclusions

**In scope:** repository inspection, local tests, a proposed AutoGuildX patch (not applied), a migration runbook, this report.

**Excluded:** every live operation; NEM-017 files and branches (read only, for the coexistence test); changes to Noetia application code or production compose.

**AutoGuildX access:** a clean local checkout and the public repository, both at `a09e9a8`, were available and read. What is actually deployed is unverified (§10).

## 4. Executive summary

- **The risk is real and goes beyond DNS names.** Reproduced locally with the real compose files:
  - When one application's `api` is stopped, its `web` reaches the other application's `api` (5/5 requests, both directions).
  - **Credentials can cross.** With Noetia's `api` stopped, a browser request to `noetia.app/api/*` is routed to Noetia `web`, whose build-time rewrite forwards it to `http://api:4000`, which resolves to AutoGuildX. A real Next.js 14.2.35 build forwarded the `Authorization` header, cookie and login body to the sink.
  - Any container on `proxy` can reach the others by IP, including Noetia's `/metrics` and MinIO.
- **This has not been observed in production.** No logs were inspected, and nothing here shows that it has ever happened.
- **It needs a stopped service.** A stopped or crash-looping `api` triggers it every time. A fast recreate only sometimes does (§5.4), so a normal deploy is not guaranteed to leak.
- **Recommendation: move AutoGuildX to a dedicated `proxy_agx` network and leave Noetia unchanged.** Traefik becomes the only shared container. 43/43 checks pass locally, 48/48 with NEM-017 staging as the three-network end state. The rollout rehearsal passes 34/34, with Noetia answering 641/641 and 262/262 monitor requests and its containers never recreated.
- **Unique aliases are not enough.** They fix the fall-through only for callers that adopt them; 13 checks still fail.
- **One ordering rule is critical.** AutoGuildX's CD removes its containers before running compose. If `proxy_agx` doesn't exist yet, the deploy fails and AutoGuildX stays down.

## 5. Verified findings

**Evidence classes:** **[R]** read in the repository · **[L]** reproduced locally · **[PO]** reported by the Product Owner from the live host; raw output not seen by this agent · **[U]** unverified hypothesis or assumption.

### 5.1 Current topology

```
                         Traefik v2.11  (80/443)
                                │
                              proxy   ← shared
       ┌──────────┬──────────┬──┴───────┬──────────┬──────────┐
    noetia     noetia     noetia       agx        agx      posthog
     api        web       storage      api        web     (if running)
       └──── noetia_noetia_net ┘        └ agx_net ┘      analytics_net
        (+ db, cache, search, …)         (+ db)          (+ its stores)
```

Plus Noetia staging, until NEM-017 moves it to `proxy_staging`.

| Finding | Class | Source |
|---|---|---|
| Noetia `api`, `web`, `storage` are on `noetia_net` and `proxy` | R | `docker-compose.server.yml:41-43,99-101,279-281` |
| AutoGuildX `web`, `api` are on `agx_net` and `proxy` | R | AutoGuildX `docker-compose.server.yml` at `a09e9a8` |
| `posthog` is on `analytics_net` and `proxy` | R | AutoGuildX `docker-compose.analytics.yml`. Whether it runs live: U |
| `api` and `web` aliases overlap on the live `proxy` | PO | Mission brief |
| Live AutoGuildX matches `a09e9a8` | U | §10 |

**Origin of the aliases:** Compose registers each service name as a DNS alias on every network the service joins. Both projects use the service names `api` and `web`, so both names exist twice on `proxy`. Nobody configured them explicitly.

### 5.2 Who uses which name

| Caller | Name | On `proxy`? | Can fall through? | Source |
|---|---|---|---|---|
| Noetia `web` rewrite `/api/*` | `http://api:4000` | yes | **yes** | `services/web/next.config.js:17-24`, `services/web/Dockerfile:18` (baked at build; §5.3) |
| Noetia `web` SSR `/s/[id]` | `INTERNAL_API_URL`, default `http://api:4000` | yes | **yes** | `services/web/app/s/[id]/page.tsx:21` |
| AutoGuildX `web` `generateMetadata` | `http://api:4000/api/v1` | yes | **yes** (GET, no credentials) | AutoGuildX compose, `apps/web/src/app/[locale]/{events,profile,marketplace}/[id]/page.tsx` |
| Noetia `api` → MinIO | `storage` | yes | Only to staging, until NEM-017 lands. AutoGuildX has no `storage` | `services/api/src/storage/storage.service.ts:14` |
| Noetia `api` → `db`, `cache`, `search`, `image-gen` | those names | caller yes, targets no | No match on `proxy` today. A future service with one of these names on `proxy` would match | `.env.example`, compose |
| AutoGuildX `api` → `db` | `db` | caller yes, target no | Same as above | AutoGuildX compose |
| Noetia Prometheus → `api` | `api` | no | no | `infra/prometheus/prometheus.yml` |
| Anything → `web` | | | No internal consumer found in either repository | grep of both |
| Traefik → backends | | | No: it uses the container IP on the labelled network | Labels; L |

**No intentional cross-application dependency was found.** AutoGuildX reaches PostHog by public URL (`POSTHOG_HOST`), and neither repository references the other's services.

### 5.3 Credential forwarding path

Conditions: Noetia `api` is stopped, and Noetia `web` and AutoGuildX `api` are running.

1. Traefik drops the `noetia-api` router, since it doesn't route to stopped containers. [L]
2. `noetia.app/api/*` now matches the `Host(noetia.app)` router, so it goes to Noetia `web`. [L, labels at `docker-compose.server.yml:73,123`]
3. The web rewrite targets `http://api:4000`. That value is baked at build time; a different runtime `INTERNAL_API_URL` was ignored, and the target is in `.next/routes-manifest.json`. [L, real Next.js build; live image: U, prerequisite 4 in the runbook]
4. `api` no longer exists on `noetia_net`, so Docker DNS answers from `proxy` with AutoGuildX's `api`. [L]
5. Next.js forwards the method, path, `Authorization`, cookie and body. [L, real Next.js: POST `/auth/login` with a canary password arrived intact]

**What AutoGuildX does with it:** Noetia's paths have no `/api/v1` prefix, so AutoGuildX should answer 404. Its exception filter only logs status ≥ 500, and `main.ts` has no request logging. No body logging was found in the repository [R]. So the expected exposure is credentials reaching the other application's process and being discarded, not being stored. Both applications are on one host under one owner; there is no third-party disclosure.

The user-visible effect is a 404 from the wrong application instead of a 5xx. How the Noetia client reacts during that window wasn't tested [U].

**The reverse direction is lower impact:** AutoGuildX has no rewrite (`apps/web/next.config.*`), and its server-side calls are unauthenticated GETs. Noetia would answer 404, so AutoGuildX renders fallback metadata [R; rendering not tested].

### 5.4 When fall-through happens

| Situation | Local result (`baseline`) | Class |
|---|---|---|
| `api` stopped (`docker stop`) | Wrong application 5/5, both directions, every run | L |
| Fast recreate (`up -d --force-recreate`), per-request connections | **Intermittent.** Wrong-application answers in 320 requests: Noetia side 9, 0, 12; AutoGuildX side 11, 0, 0 (three runs) | L |
| Fast recreate with a keep-alive client | One run: 261/320 and 263/320 answers from the wrong application. A connection opened in the window stays there | L, one run with a plain Node client; Next.js connection reuse not tested (U) |
| New container starting (DNS exists, not listening) | Own name resolves; `ECONNREFUSED`, no crossing | L |
| Crash loop or OOM kill between restarts | Same condition as stopped; not exercised directly | U |

Which network answers first was consistent with sort order (`autoguildx_agx_net`, `noetia_noetia_net` before `proxy`), so own services win when they're up. All 10 normal-operation checks pass. **In normal operation nothing misroutes.**

### 5.5 Reachability beyond DNS

On `proxy`, every container can open connections to every other by IP [L: X6–X8]. AutoGuildX `api` reached the stand-ins for Noetia `api` and MinIO. Noetia's `/metrics` has no application-level auth (`services/api/src/metrics/metrics.controller.ts`); it's only blocked at Traefik (`docker-compose.server.yml:65`). MinIO still needs its own credentials for private buckets. This doesn't mean a compromise has occurred; it means a compromised container in one application has a direct path to the other.

### 5.6 Traefik routing

- Static config uses `exposedByDefault: false` and `network: proxy` (`infra/server/traefik/traefik.yml`).
- Every routed service sets `traefik.docker.network` explicitly. Router, service and middleware names are prefixed (`noetia-*`, `agx-*`, `posthog`), so they don't collide. [R]
- A label naming a network Traefik isn't on still produces a route, to an unreachable IP: **504 after 30 s** [L: G2]. So Traefik must be attached before moving an application.

### 5.7 Discoveries outside this mission

- **PostHog is removed by every AutoGuildX deploy, if it shares the project.** `docker-compose.analytics.yml` runs from the same directory, so it has the same Compose project, and the CD job uses `--remove-orphans`. [L: D1. Live state: U]
- **AutoGuildX's CD removes containers before building** (`docker rm -f` of web, api, db, then `up --build`), so each deploy's downtime includes the image build. [R]
- **AutoGuildX `CLAUDE.md:198`** says the applications are "fully isolated". Line 229 also describes prefix stripping that its compose file contradicts. [R]
- **Noetia `next.config.js` rewrite** is the reason a stopped API becomes a forwarded request. It may be removable in production, since Traefik handles `/api`, but that's a reader-path change and needs separate analysis. Not proposed here.
- **`docs/reports/README.md`** isn't on `main` (it's on PR #23), so there's no index to update on this branch.

## 6. External references

None needed. Docker and Traefik behaviour was tested directly, on Docker 29.9.1, Compose 5.6.0, `traefik:v2.11`, Next.js 14.2.35. The live host runs Docker 29.4.3 per the NEM-017 record; the difference is not tested.

## 7. Risks

### Current state

| Level | Risk | Basis |
|---|---|---|
| **High** | Noetia user credentials or tokens forwarded to AutoGuildX while Noetia's API is stopped | L mechanism; not observed live; needs a stopped API |
| **Medium** | Direct network path between applications widens a compromise of either | L |
| **Medium** | Wrong-application answers instead of clear errors during failures | L |
| **Low** | AutoGuildX metadata requests reach Noetia | R, L |
| **Low** | `web` collision: no consumer found | R |

### Remediation options

| Option | Isolation result | Production impact | Risks |
|---|---|---|---|
| **A. AutoGuildX → `proxy_agx`** (recommended) | 43/43 | AutoGuildX: one deploy. **Noetia: none.** | Ordering (P3/P4); stale Traefik file (G2); change lives in another repository |
| B. Noetia → `proxy_noetia` | 43/43 | Recreates Noetia `api`, `web`, `storage` | Same checks pass, but it interrupts the reader for no extra isolation. Conflicts with Reader Stability First |
| C. Both move | Not run separately; A and B each already remove the overlap | Both of the above | The cost of B for a cleaner name only |
| D. Unique aliases, callers changed | **13 checks fail**; fixes F1, F2, E1 only | Noetia web rebuild (baked URL) and AutoGuildX change | Generic names and IP paths remain; every future caller must remember. Compose always adds the service name, so it can't be removed |
| E. Rename services | Not tested | Touches many configs and code defaults in both applications | Largest change; IP paths remain |

### After option A

| Level | Risk | Mitigation |
|---|---|---|
| **High if ordering is ignored** | AutoGuildX deploys before the network exists: outage | Runbook Steps 1–2 precede the merge; P3/P4 demonstrate it |
| **Medium** | Traefik recreated from a file without `proxy_agx`: AutoGuildX 504, Noetia unaffected | Runbook Step 5; recovery tested (G3) |
| **Low** | Live attach behaves differently on the real host | NEM-017 performs the same operation first; Noetia monitored throughout |
| **Low** | AutoGuildX's brief downtime during its deploy | Low-traffic window; local lower bound 12.6 s, plus build time in production |

**Noetia production risk:** no Noetia container is recreated. The only shared step is the Traefik attach, which didn't restart Traefik or lose a Noetia request locally.

## 8. Recommendations

**Required for isolation**
1. Option A: AutoGuildX moves to `proxy_agx`, using the tested patch and the runbook order.

**Required after migration**
2. Record `proxy_agx` in `/opt/traefik/docker-compose.yml`, the repository copy and `infra/server/init.sh`. Don't do this until NEM-017's edits to the Traefik file have landed.

**Optional, separate decisions**
3. Rule for new applications on this host: one proxy network per application, never `proxy`.
4. Fix the AutoGuildX PostHog project and orphan problem (§5.7).
5. Review Noetia's production `/api` rewrite and add application-level protection to `/metrics`.

Full steps, checkpoints and rollback: [`docs/operations/nem-018-autoguildx-network-migration.md`](../operations/nem-018-autoguildx-network-migration.md).

## 9. Tests and verification

**Local only.** `STAGING_COMPOSE=<NEM-017 staging> infra/tests/shared-proxy-isolation/all.sh` exits 0 on the final run: every suite matched its expected outcome.

| Suite | Passed | Failed | Meaning |
|---|---|---|---|
| `baseline` | 26 | 17 | **Reproduces the risk.** X1–X8, F1–F4, F1g, F2g, E1, M1, plus R1 (race) |
| `alias` | 30 | 13 | Option D leaves X1–X8, F1g, F2g, F3, F4, M1 failing |
| `noetia-moved` | 43 | 0 | Option B isolates |
| `recommended` | 43 | 0 | **Option A isolates** |
| `recommended` + NEM-017 staging | 48 | 0 | Three-network end state |
| `rollout.sh` | 34 | 0 | Migration, failure drills and rollback |
| `next-rewrite-check.sh` (run separately) | n/a | n/a | Real Next.js: credentials forwarded; target baked at build |

**Mission criteria (`recommended`):**

| Criterion | Checks |
|---|---|
| Noetia resolves its own services | N1–N7 |
| AutoGuildX resolves its own services | N8–N10 |
| Neither resolves the other's names through a shared network | X1–X5, F1–F4, F1g, F2g |
| Traefik reaches both applications | T1, T2, T4, T6, T7, T9, T11 |
| Routing behaviour preserved | T3 (prefix strip), T8 (no strip), T5, T10 (www redirects), T9 (websocket upgrade); also passes unchanged in `baseline` |

**Rollout rehearsal:**
- Noetia monitor: 641/641 during migration, 262/262 during rollback, all `noetia-web 200`.
- AutoGuildX monitor: never answered by Noetia; about 12.6 s of failures per deploy (404, 502).
- Traefik not restarted by the attach, recovery or disconnect.
- Noetia container IDs unchanged.

**Harness corrections made during this work.** Earlier runs failed for test reasons, not system reasons, and are not counted above:
- Keep-alive inflated R1/R2. The probe now uses per-request connections; the keep-alive result is reported in §5.4.
- M1's name parsing, M2/M4's multi-line parsing and G2's timeout were wrong.
- One staging check had the wrong expectation: the staging API deliberately has no basic auth (`docker-compose.staging.yml`, label comment).
- `all.sh` leaked `STAGING_COMPOSE` into every variant, and baseline R1/R2 were first treated as deterministic. Both fixed; R1/R2 are now reported but not compared for `baseline`.
- B6 used `RestartCount`, which can't detect recreation. It now compares container IDs.

**Limitations:**
- Applications are identity responders, except in the Next.js check. In `baseline`, E1's "HTTP 200" is the stand-in; the real AutoGuildX should answer 404 (§5.3).
- TLS uses Traefik's self-signed certificate, not Let's Encrypt.
- Healthchecks aren't mirrored, and the `/api/metrics` source-IP block can't be tested locally.
- Real AutoGuildX behaviour, real traffic and Docker 29.4.3 are not covered.
- The outage figure is a lower bound.
- A failed lookup here sometimes shows as `ERR:TIMEOUT` at the probe's 1.5 s limit; how fast it fails on the host depends on its upstream DNS.

## 10. Open questions and Product Owner decisions

**Decisions**

| # | Decision | Recommendation |
|---|---|---|
| 1 | Which option? | A: move AutoGuildX |
| 2 | Open NEM-018's implementation phase, and who opens the AutoGuildX PR? | Authorize a PR with the tested patch; no write to that repository has been made |
| 3 | Timing relative to NEM-017 | After NEM-017 is accepted, so the attach is proven and the Traefik edits don't collide |
| 4 | AutoGuildX downtime window, and a snapshot | Low-traffic window; snapshot per project safety rules |
| 5 | If PostHog runs: accept re-applying it after the deploy, or fix the project split first? | Re-apply now, fix separately |
| 6 | Whether to review the Noetia rewrite and `/metrics` hardening | Separate mission; not needed for isolation |
| 7 | Whether to merge this PR | Docs and tests only, but **a merge to `main` triggers a production deploy** (`.github/workflows/cd.yml:5`). Group with other changes |

**Missing information, read-only for the Product Owner** (commands in the runbook §3): full membership of `proxy`; whether PostHog runs; the deployed AutoGuildX commit; the rewrite target on the live Noetia image; the network count. The Product Owner's raw alias output would also confirm §5.1.

## 11. Changes made

No application, production configuration, NEM-017 or AutoGuildX change.

| File | Purpose |
|---|---|
| `infra/tests/shared-proxy-isolation/` | Local tests, rollout rehearsal, AutoGuildX fixtures and proposed patch |
| `docs/operations/nem-018-autoguildx-network-migration.md` | AutoGuildX specification, migration runbook, rollback |
| `docs/engineering-missions/IN-PROGRESS/NEM-018-shared-proxy-network-hardening.md` | Mission record |
| This report | Findings |

**Protected systems:** Escucha Activa, the reader, ownership, production data, business-rule engines and Stripe were not modified. No migrations.

## 12. Next recommended action

The Product Owner reviews this report, runs the read-only commands once NEM-017 is settled, and decides §10. Nothing further happens until then.
