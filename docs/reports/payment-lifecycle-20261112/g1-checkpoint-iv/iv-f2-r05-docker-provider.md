# IV-F2: R-05 Docker-provider coverage determination

**Date:** 2026-11-15
**Scope:** read-only review of existing tests and documents, plus the public Traefik source at the image version used locally.
**Not done:** no Docker socket mount, no privileged access, no harness change, no new Docker resources, no live access.

## 1. Question

Do existing tests or documented evidence show how **Traefik's Docker provider** behaves when the API's `traefik.docker.network` label is wrong or missing in the target topology? Specifically:

- API on `noetia_net` + `noetia_api_edge`;
- Traefik on `proxy` + `proxy_staging` + `noetia_api_edge`;
- provider default `network: proxy`.

## 2. Existing evidence, reviewed

| Source | What it shows | Does it cover the Docker-provider wrong-label path? |
|---|---|---|
| Checkpoint IV R-05 ([`evidence.txt`](evidence.txt) § R-05) | **File provider.** The route was forced to the API's `noetia-net` address, so every request returned 504; restoring it returned 200 | **No.** It exercises the consequence of selecting an unreachable address, not the provider's selection logic |
| Checkpoint IV harness ([`infra/tests/trusted-proxy/`](../../../../infra/tests/trusted-proxy/)) | `render-dynamic.sh` computes the address the Docker provider *would* pick from a correct label | **No.** It models the correct-label path only, by design |
| `strings` on the `traefik:v2.11` binary | Both fallback log strings exist | **Partial.** It shows the branch exists, not how it behaves at runtime |
| Checkpoint III live verification (§7) | Live: `providers.docker` with `exposedByDefault: false`, `network: proxy`; repo `traefik.yml` has `log.level: ERROR` | **No.** Configuration only |
| Production today | Every routed Noetia service uses `traefik.docker.network=proxy`, and the container *is* on `proxy` | **No.** Positive (label matches) path only |
| Checkpoint I | Forwarded-header handling on `traefik:v2.11` | Not related to network selection |

**Determination:** existing tests and documents **do not** give sufficient runtime coverage of the Docker-provider wrong-label or missing-label path. **R-05 remains "simulated (file provider)", not verified.**

## 3. Additional documentary evidence (source, not runtime)

Image used locally: `traefik:v2.11` → `org.opencontainers.image.version = v2.11.61`.

The source was read at tag `v2.11.61`: `pkg/provider/docker/config.go`, `getIPAddress` (lines 313–381), and `label.go` line 30 (`Network: p.Network`).

1. **Label present and the container is on that network:** Traefik returns that network's address. This is the production happy path.
2. **Label names a network the container is NOT on:**
   - Traefik logs `Could not find network named …` at **DEBUG**;
   - it then returns the address from `for _, network := range container.NetworkSettings.Networks`. That is a **Go map**, so iteration order is deliberately randomized and the "first available network" is **not deterministic**. It can differ between provider refreshes and container events;
   - the fallback also logs `Defaulting to first available network` at **WARN**.
3. **Label missing:** the provider default `p.Network` = `proxy` applies. The API is not on `proxy` in the target state, so this ends in the same non-deterministic fallback as case 2.
4. **Production log level is `ERROR`** (repository `traefik.yml`; Checkpoint III found the live file matches it for the reviewed settings). **Neither the DEBUG nor the WARN line would appear in production logs**, so a wrong label fails silently from the log's point of view.

### Outcome bound in the target topology (analysis, not verification)

The API's candidate networks are `noetia_net` and `noetia_api_edge`.

- **Fallback picks `noetia_api_edge`:** routing works and attribution is correct. The defect is masked until a later refresh picks the other network.
- **Fallback picks `noetia_net`:** Traefik is not attached to `noetia_net`, so the API is expected to be unreachable and requests return 504.
  - This was observed locally (Docker 29.9.3; R-05 file-provider simulation and R-04).
  - It depends on Docker's inter-bridge isolation. `noetia_net` is a plain bridge, not `internal`, and isolation was **not verified on the production daemon** (Docker 29.4.3).
- **Trust cannot widen in any branch.** Express trusts only a TCP peer inside `10.211.75.8/29`, and only edge-network members hold those addresses.
  - If Traefik ever reached the API over a path other than the edge network, its source address would be outside R, so it would be untrusted and clients would fall back to today's shared bucket (fail-closed).
  - **The label risk is therefore an availability and attribution risk, not a trust-boundary risk.**
- The confirmed security limitation is unchanged: any container admitted to `noetia_api_edge` can forge forwarding headers. The exact-two-member invariant remains a mandatory deployment and operational safeguard, not proof of Traefik's identity.

## 4. Exact remaining verification requirement

To mark R-05 **verified**, the following must be observed with the **real Docker provider** of `traefik:v2.11.61`:

- `providers.docker` with `exposedByDefault: false`, `network: proxy`, `log.level: DEBUG` for the test only;
- an upstream container on two networks mirroring `noetia_net` + `noetia_api_edge`;
- Traefik on networks mirroring `proxy` + `proxy_staging` + `noetia_api_edge`.

| Case | Label | Must observe |
|---|---|---|
| V-a | `traefik.docker.network=<edge>` | Selected server URL = edge address, on every one of ≥ 20 provider refreshes or container restarts; 200; peer ∈ R |
| V-b | `traefik.docker.network=<a network the container is not on>` | The DEBUG and WARN log lines; the selected server URL on each of ≥ 20 refreshes or restarts (shows whether the selection actually varies); request outcome per selection (200 via edge, 504 via the internal network); trust never granted to a peer outside R |
| V-c | Label absent (provider default `proxy`) | Same as V-b |
| V-d | `traefik.docker.network=noetia_net` equivalent (wrong but present network) | Deterministic selection of the internal address; 504; the reachability result under the daemon's inter-bridge isolation |

"Selected server URL" means Traefik's view of the service's server address, read from DEBUG configuration logs (the dashboard is disabled in production and must stay disabled).

**Why this cannot be done inside the current authorization:** the Docker provider must read the Docker Engine API. Every way of giving it that access is outside what Checkpoint IV permits:

| Option | What it needs | Privilege effect | Status |
|---|---|---|---|
| A. Mount `/var/run/docker.sock` into a disposable Traefik | Socket mount | Root-equivalent host control from the test container | **Prohibited** without separate authorization |
| B. Read-only Docker socket proxy (e.g. a filtering proxy container) | Socket mount into the proxy container | Same host access, narrowed by filter | **Prohibited** (still a socket mount) |
| C. Stub Docker Engine API (`providers.docker.endpoint=tcp://<stub>:2375`; a small HTTP server returning canned `/version`, `/containers/json`, `/containers/{id}/json`, `/events`) | **No socket, no privilege.** It runs Traefik's real `getIPAddress` and fallback code against synthetic container JSON | None | **Changes the approved harness**, so it needs separate authorization. Network-isolation reachability (V-d) would still come from the real-network R-05/R-04 results, not the stub |
| D. Observe during an authorized production rollout | Rollout authorization | Production | Positive path (V-a) only; must not deliberately mislabel production |

## 5. Mitigations already in place (they lower the likelihood, not a substitute for verification)

- The label and the network move are in **one commit** (`docker-compose.server.yml`), and compose validation shows the API has `traefik.docker.network=noetia_api_edge` and the networks `noetia_api_edge` + `noetia_net`.
- `noetia_api_edge` is an external network with a fixed name, so there is no compose project prefix: the label string equals the real network name, which addresses the "missing the project's prefix" case.
- The post-deploy checks in §9 of the qualification report: two client networks show independent `X-RateLimit-Remaining-global`, the membership check shows exactly two members, and `/api/health` returns 200.
  - A fallback onto `noetia_net` would show up as 504s.
  - A fallback onto the edge network is functionally correct at that moment and is **not detectable** by these checks.

## 6. Decision requested from the PA

Choose one:

1. Authorize Option C (stub Docker API, no privilege) as a bounded harness extension to execute V-a…V-c.
2. Authorize a disposable socket-mounted run (Option A or B) for V-a…V-d.
3. Accept R-05 as **simulated plus source-analyzed**, recorded as a residual rollout risk with the §5 mitigations.

Until then, **R-05 stays NOT fully verified.**
