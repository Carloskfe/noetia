# G1-I1 Checkpoint IX: Stage B-2 isolated Draft PR (qualification, runbook, rollback)

| | |
|---|---|
| **Mission** | G1-I1 Checkpoint IX: Stage B-2 Isolated Draft PR Preparation (PO: repository-only implementation and qualification) |
| **Baseline** | `main` = `3b35cb111116634beec71b655238ccbf11b0d52b` (Stage B-1 deployed and verified, trust inactive) |
| **Branch** | `release/g1-i1-b2-api-edge-network` (no upstream; pushed with an explicit refspec) |
| **Draft PR** | [#62](https://github.com/Carloskfe/noetia/pull/62) → `main`, titled **DO NOT MERGE**: Stage B-2 requires separate production authorization |
| **Commits** | `d34e5c9` chore(infra) · `569f25c` test(infra) · `672b0ca` docs · this report |
| **Sources** | PR #60 commits `5fe5d5a` (infra), `a4d82bf` (harness), `6fb9305` (incident-response §1a), all qualified in Checkpoint IV; applied cleanly to `main` |
| **Verdict** | **Prepared and locally qualified. Nothing applied anywhere. STOP for independent PA review.** |

## 1. Production evidence used (PO-supplied, read-only)

| Item | Value | Use |
|---|---|---|
| Docker networks | `172.17.0.0/16` … `172.22.0.0/16`; no overlap with `10.211.75.0/28` (P-1) | Subnet candidate stands |
| Host routes, policy routing incl. Tailscale table 52, interfaces | No overlap (P-2…P-4) | Subnet candidate stands |
| Traefik live attachments | `proxy`, `proxy_staging` | Repository Traefik compose lists both, plus the new network |
| Persisted `/opt/traefik/docker-compose.yml` | Lists `proxy` and `proxy_staging` | Live file needs **one** added entry (`noetia_api_edge`) |
| Persisted file SHA-256 (as supplied) | `a36142bb07981308bf8a1209ca26572318619eda4ac1f4cda1f4d6bdc490` | **Only 60 hex characters; a SHA-256 has 64.** Re-capture with `sha256sum` before the rollout edit (R-0 below) |
| API | Networks `noetia_noetia_net`, `proxy`; label `proxy` | Pre-change state; rollback target |
| Stage B-1 | `3b35cb1` deployed; `TRUSTED_PROXY_CIDRS` UNSET; startup log "disabled" | Code path present, inactive |

**Not yet supplied** (does not block this Draft PR; needed before rollout):
- the full contents of the live Traefik file;
- the Traefik image ID / tag and `StartedAt`;
- Docker and Compose versions;
- the `/opt/noetia` HEAD and cleanliness;
- B-1 login, reader and route smoke checks.

## 2. Changed files (14 before this report)

| File | Change |
|---|---|
| `docker-compose.server.yml` | API: `proxy` → `noetia_api_edge` (external, `name: noetia_api_edge`); keeps `noetia_net`; label `traefik.docker.network=noetia_api_edge`; header prerequisites |
| `infra/server/noetia-api-edge-network.sh` | From PR #60 (`ensure` / `check` / `members`), plus **new read-only `traefik` and `api` contract checks**; failures always print `STOP:` |
| `infra/server/init.sh` | Calls the helper's `ensure` on a fresh server (not executed) |
| `infra/server/traefik/docker-compose.yml` | Networks `proxy`, `proxy_staging`, `noetia_api_edge`. **Corrected** the PR #60 comment "rebases trivially": PR #26 conflicts textually in two hunks, and the resolution must keep all three entries |
| `infra/tests/trusted-proxy/{README.md,client.mjs,r02-v1.yml,r02-v2.yml,render-dynamic.sh,traefik-static.yml,upstream.ts}` | Checkpoint IV disposable harness (unchanged; no production effect) |
| `infra/tests/trusted-proxy/helper-contract.sh` | **New** network-contract test (35 cases, fake `docker`) |
| `CLAUDE.md` | B-1 deployed/inactive, B-2 prepared/not deployed, rollout order, mandatory post-deploy checks |
| `docs/incident-response.md` | §1a: symptoms, diagnosis (now including `traefik` / `api`), recovery, rollback |

**Excluded (verified by diff audit):**
- anything under `services/` (no application change);
- `.github/`, migrations, `.env*`;
- Stripe, payment, subscription, entitlement, public-site and mobile files.

PR #59, #60, #26 and #28 are untouched.

## 3. Network design

```
Internet ─► traefik ── proxy ─────────── noetia web/storage, AutoGuildX (unchanged)
                   ├── proxy_staging ─── staging (unchanged)
                   └── noetia_api_edge ─ noetia-api-1   (internal; 10.211.75.0/28; range .8/29; 2 members only)
noetia-api-1 ── noetia_noetia_net ─ web SSR, worker, Prometheus, db, cache, storage, search (unchanged)
```

- **Compose structure:** compared against `main` with `compose config` (no interpolation, scratch copies). **Only `api.networks` and the `traefik.docker.network` label change.** The other 11 services are identical: web, worker, image-gen, db, cache, storage, search, prometheus, node-exporter, cadvisor, monitor.
- **Trust:** Express trusts `X-Forwarded-For` only from `10.211.75.8/29`, which only edge members hold. Every other peer is attributed to its own address (B-1 code, Checkpoint IV T-I1-01…12).
- **Egress:** the API's outbound traffic (SMTP, OAuth, Stripe API, Sentry) uses `noetia_noetia_net`, a normal bridge. `noetia_api_edge` is `--internal` and provides no route. Egress is expected to keep working [INFERRED] but **has not been tested**, so it must be verified in-window (V-9).

## 4. Validation (local, non-production)

| Check | Result |
|---|---|
| `docker compose -f infra/server/traefik/docker-compose.yml config -q` | **PASS:** networks `noetia_api_edge`, `proxy`, `proxy_staging`, all external |
| `docker-compose.server.yml` `config --no-interpolate` (branch and `main`, scratch copies, empty env file) | **PASS** both. Structural diff: API networks and one label only |
| `bash -n` on the helper, `init.sh`, `render-dynamic.sh`, `helper-contract.sh` | **PASS** |
| `shellcheck` | **NOT RUN** (not installed) |
| `helper-contract.sh` (real helper, fake `docker`, no daemon) | **PASS: 35/35**, covering:<br>- IPAM STOPs (missing, driver, not internal, IPv6, 2 configs, subnet, gateway, no range, range = subnet);<br>- exact `create` flags; no recreation of an existing network; no "fix" of a wrong one;<br>- membership (Traefik-only pre-deploy, exact pair, third member, API missing, empty);<br>- Traefik (all three networks; `.8` and `.15` in range; `.3` and `.16` out; `proxy` or `proxy_staging` lost; not found);<br>- API (correct; stale label `proxy`; missing label; still on `proxy`; internal network missing; pre-B-2 topology; address out of range) |
| Negative control (contract test against a scratch copy with the `--internal` and label checks removed) | **4 failures**, exactly those cases: the test detects weakening |
| API `tsc --noEmit` | **PASS** |
| API full suite (`jest --maxWorkers=2`) | **PASS: 71/71 suites, 1028/1028** (identical to `main`; no application change) |
| API trusted-proxy + auth suites | **PASS: 153/153** |
| Real-network tests | **NOT RUN in this mission** (no Docker networks authorized). Checkpoint IV R-01…R-09 (disposable Traefik v2.11) remains the behavioural evidence; R-05 stays **NOT VERIFIED** with the Docker provider |
| CI on PR #62 | Runs on GitHub. Expected red only on the CI failures that also fail on `main`'s own code (coverage thresholds, Playwright runner image) |

## 5. Operational dependencies

The **runbook below is PROPOSED and NOT AUTHORIZED.** Run commands one line at a time on the server, and never paste multi-line content.

### Phase A: before the window
| # | Requirement |
|---|---|
| A-1 | PA review of PR #62; PO decisions D-V2 (NEM-017/018 order), D-V3 (window), D-V4 (risk acceptance: R-05, procedural membership boundary, recreation gap, deploy-time dependency re-resolution) |
| A-2 | Separate infrastructure rollout authorization naming Stage B-2, and a merge instruction naming PR #62 |
| A-3 | Contabo snapshot (infrastructure change); latest offsite backups confirmed; operator present with rollback authority; no CD running |
| A-4 | Same-day re-run of P-1…P-4 (no overlap with `10.211.75.0/28`) |
| A-5 | Record: `/opt/noetia` HEAD (= `main` at merge time) and tracked-change count (0); Traefik `docker inspect -f '{{.Image}} {{.State.StartedAt}}' traefik`; **R-0:** full `sha256sum /opt/traefik/docker-compose.yml` (64 characters) plus a backup copy `cp /opt/traefik/docker-compose.yml /opt/traefik/docker-compose.yml.pre-b2` |

### Phase B: infrastructure preparation (reversible; API untouched)
| # | Command | Must print / verify |
|---|---|---|
| B-1 | `bash /opt/noetia/infra/server/noetia-api-edge-network.sh ensure`. The helper is on the server only after this PR merges, so before the merge use a copy of the helper fetched for review, or the equivalent `docker network create --driver bridge --internal --subnet 10.211.75.0/28 --gateway 10.211.75.1 --ip-range 10.211.75.8/29 noetia_api_edge` followed by the `check` logic | `OK: 'noetia_api_edge' bridge, internal, IPv4-only…`; any `STOP:` → abort |
| B-2 | `docker network connect noetia_api_edge traefik` | `StartedAt` unchanged; `noetia.app`, `/api/health`, `storage.noetia.app`, staging and AutoGuildX answer |
| B-3 | helper `members traefik` and helper `traefik` | Both `OK` (Traefik only; on `proxy`, `proxy_staging`, edge; edge address in `.8/29`) |
| B-4 | `nano /opt/traefik/docker-compose.yml`: add `- noetia_api_edge` under the service `networks:` and `noetia_api_edge: { external: true }` under top-level `networks:`. **No `compose up`.** | `diff /opt/traefik/docker-compose.yml.pre-b2 /opt/traefik/docker-compose.yml` shows only those additions; `docker compose -f /opt/traefik/docker-compose.yml config -q` passes (parse only) |
| B-5 | `nano /opt/noetia/.env.production`: add `TRUSTED_PROXY_CIDRS=10.211.75.8/29` | The A1 token check prints `NONEMPTY`. This is harmless until the merge: the API's peer is still Traefik's `proxy` address, outside the range |

### Phase C: merge (production deploy)
- Re-run B-3 in the same window.
- Confirm no CD is running.
- Merge PR #62 only.
- Watch the CD run. A **red** run at `up -d` with "external network not found" means the old API is still serving: go to rollback row 1. A **green** CD is not acceptance.
- Expect the API recreation gap. Because `.env.production` changed, other services using it may also be recreated [INFERRED].

### Phase D: acceptance (all required)
| # | Check | Pass |
|---|---|---|
| V-1 | helper `members traefik noetia-api-1` | `OK` (exactly two) |
| V-2 | helper `traefik` | `OK` |
| V-3 | helper `api` | `OK` (networks exact; label = `noetia_api_edge`: **closes the R-05 fallback condition**) |
| V-4 | `docker logs noetia-api-1 2>&1 \| grep '\[trusted-proxy\]'` | `X-Forwarded-For honoured only from 10.211.75.8/29`; no WARN |
| V-5 | `https://noetia.app/api/health`, `/`, `storage.noetia.app`, staging, AutoGuildX | Unchanged statuses |
| V-6 | `docker exec noetia-web-1 wget -qO- http://api:4000/health`; Prometheus API target up | OK |
| V-7 | Two different client networks each make repeated public GETs | Independent `X-RateLimit-Remaining-global` sequences |
| V-8 | A forged `X-Forwarded-For` from an external client | The rate-limit bucket follows the real client |
| V-9 | **API egress** (non-financial): e.g. `docker exec noetia-api-1 node -e "require('https').get('https://accounts.google.com',r=>{console.log(r.statusCode);process.exit(0)}).on('error',e=>{console.log('ERR',e.code);process.exit(1)})"` | A status code, not `ERR` |
| V-10 | Login plus one authenticated read; one reader book with audio and phrase sync | Works |

No payment, checkout or Stripe call is made for acceptance.

## 6. Rollback and recovery

| Failure | Signal | Recovery |
|---|---|---|
| Edge network missing at merge | CD red at `up -d`; API container unchanged | Complete Phase B and redeploy, or revert PR #62 on `main`. Old API keeps serving |
| `STOP:` from `ensure`/`check` (wrong IPAM) | Helper output | Do not attach or merge. If the network has no members, the PA may authorize removal and recreation; **never recreate a network with members** |
| Traefik not on the edge network | `/api/*` 504 (~30 s) or 502; V-2 STOP | `docker network connect noetia_api_edge traefik` (no restart); confirm B-4 persisted |
| Wrong or missing API label (R-05) | V-3 STOP or intermittent 504 | Revert PR #62 on `main` (label and networks go back together). Never hot-edit labels |
| Unexpected edge member | V-1 STOP | `docker network disconnect noetia_api_edge <container>` immediately; investigate how it joined; treat an unexplained member as a Docker-control incident (contain, preserve evidence, rotate per `docs/secrets-rotation.md`) |
| Internal callers can't reach the API | V-6 fails | V-3 shows whether the internal network is present; otherwise revert |
| Persistent 502/504 after the gap | Public checks | **Revert PR #62 on `main`** (a production deploy). The API returns to `noetia_net` + `proxy` with label `proxy`; Traefik's edge attachment and the network may stay (harmless); `TRUSTED_PROXY_CIDRS` has no effect while the peer is outside the range |
| Limits still shared | V-7 fails, routing OK | Fail-safe. Check V-4 and the B-5 value; fix with nano and recreate through a normal deploy |
| Staging breaks | Staging fails, production fine | `docker network connect proxy_staging traefik`; check the persisted file |
| Live Traefik file edit wrong | B-4 diff or parse fails | Restore `/opt/traefik/docker-compose.yml.pre-b2` (Traefik isn't recreated by an edit, so there is no service impact) |
| Revert deploy fails | CD red | `docs/incident-response.md`; snapshot restore only by PO decision (data written after the snapshot is lost) |

**Rollback notes:**
- A rollback rebuilds images from source: CD prunes the previous image, and the API `Dockerfile` installs without a lockfile.
- **No zero-downtime claim:** every API recreation has a short gap.

## 7. Outstanding release gates

| Gate | Status |
|---|---|
| PR #62 PA review | **OPEN** |
| PO decisions D-V2, D-V3, D-V4 | **OPEN** |
| Infrastructure rollout authorization (Phase B + merge) | **NOT AUTHORIZED** |
| R-0: full 64-character SHA-256 and backup of the live Traefik file | **OPEN** (supplied hash is 60 characters) |
| Live Traefik file contents, image and `StartedAt`; Docker/Compose versions; `/opt/noetia` HEAD | **OPEN** (before rollout) |
| B-1 smoke: login, reader, routes | **OPEN** |
| API egress after the switch | **OPEN** (in-window V-9) |
| R-05 real Docker-provider negative path | **NOT VERIFIED: accepted exception**; mitigated by V-3 at every deploy and recreation |
| Membership boundary | Procedural (point-in-time V-1), **not** continuous enforcement and not proof of Traefik identity |
| Merge-order with PR #26 (NEM-017) | Textual conflict in the Traefik compose; resolution keeps all three networks |
| NEM-018 (AutoGuildX → `proxy_agx`) | Independent; separate window; Traefik-file edits done one at a time |
| Financial and public-site releases (PR #59, payment lifecycle) | **Separate; all financial gates CLOSED** |

## 8. STOP

**STOP for independent Product Architecture review.** PR #62 stays Draft and DO NOT MERGE. No network, attachment, Traefik, environment, CD or production change was made.
