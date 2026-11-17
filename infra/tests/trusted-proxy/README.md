# G1-I1 trusted-proxy disposable harness (Checkpoint IV)

Local-only fixtures used to qualify the G1-I1 trusted-proxy correction against a real `traefik:v2.11`. Results:
[`docs/reports/payment-lifecycle-20261112/g1-checkpoint-iv-qualification.md`](../../../docs/reports/payment-lifecycle-20261112/g1-checkpoint-iv-qualification.md).

**Safety rules (mandatory):**
- Local Docker engine only. Before starting, check `docker context ls` and `DOCKER_HOST`; never point this at a server.
- Every resource uses the `g1q4-` prefix. Inventory first; remove only those names, each by explicit name.
- No published host ports, no Docker socket mounted into any container, no `prune`.
- Run commands **one at a time**: Checkpoint IV ran each step as a separate, auditable command, and there is
  deliberately no all-in-one script.

| File | Role |
|---|---|
| `upstream.ts` | Stand-in for the Noetia API (and staging/AGX upstreams). Runs the **real** `services/api/src/common/trusted-proxy.ts` (`applyTrustedProxy`, as `main.ts`) with the API's exact throttler config: `global` 120/min, `/limited` 30/min like the Checkout-status route. `/whoami` returns `req.ip` and the TCP peer. |
| `client.mjs` | Sequential HTTP client run inside client containers: `req` (N requests, forged/rotating/multiple `X-Forwarded-For` lines, rate-limit headers) and `monitor` (availability during changes). |
| `traefik-static.yml` | Traefik static config with the production entrypoint defaults (no `forwardedHeaders`). Harness-only differences: plain HTTP, the file provider instead of the Docker provider (no socket mount), and a 3 s dial timeout. |
| `render-dynamic.sh` | Writes Traefik's routes from `docker inspect` (read-only), atomically: the address Traefik's Docker provider would select via `traefik.docker.network`. An optional override simulates a wrong label. |
| `r02-v1.yml`, `r02-v2.yml` | R-02: a compose file requiring a missing external network must fail without replacing the running service |

**Topology used:**
- `g1q4-ext`: external clients a and b, plus Traefik.
- `g1q4-proxy`: shared, like `proxy`. Members: Traefik, web, AGX-like containers, an impostor with the aliases `api` and `g1q4-api`. The API is on it only in the before and rollback states.
- `g1q4-proxy-staging`: Traefik plus the staging upstream.
- `g1q4-noetia-net`: the API (alias `api`), web and monitor.
- `g1q4-edge`: created by `infra/server/noetia-api-edge-network.sh` (`EDGE_NETWORK=g1q4-edge`, production IPAM `10.211.75.0/28`, range `.8/29`, internal). Members: Traefik and the API only, apart from the deliberate negative controls.
