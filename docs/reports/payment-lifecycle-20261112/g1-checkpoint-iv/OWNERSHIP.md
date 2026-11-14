# G1-I1 Checkpoint IV — disposable resource ownership inventory (local engine only)

Engine: context `default`, unix:///var/run/docker.sock, host <local-dev-vm> (Ubuntu 26.04, Docker 29.9.3).
Pre-existing resources (NOT owned, never touched): networks alexandria_alexandria_net, alexandria_noetia_net,
autoguildx_default, bridge, host, noetia_noetia_net, none; every container not named below.
Prefix check before creation: zero `g1q4*` containers/networks; no local route or network in 10.211.0.0/16.

## Networks (to be created by this mission)
| Name | Purpose | Subnet |
|---|---|---|
| g1q4-ext | "internet": external clients ↔ Traefik | Docker-assigned |
| g1q4-proxy | shared `proxy` equivalent (Traefik, web, AGX-like, impostor; API in before/rollback states) | Docker-assigned |
| g1q4-proxy-staging | `proxy_staging` equivalent | Docker-assigned |
| g1q4-noetia-net | `noetia_net` equivalent (API alias `api`, web, monitor) | Docker-assigned |
| g1q4-edge | `noetia_api_edge` equivalent, created by infra/server/noetia-api-edge-network.sh | 10.211.75.0/28, range .8/29, internal |
| g1q4-wrong-subnet / -norange / -notinternal / -gateway | R-03 deliberately misconfigured networks | 10.211.76–79.0/28 |
| g1q4r02_default | R-02 disposable compose project default network | Docker-assigned |

## Containers
g1q4-traefik, g1q4-api, g1q4-staging-api, g1q4-agx-api, g1q4-impostor, g1q4-agx-web, g1q4-web, g1q4-monitor,
g1q4-client-a, g1q4-client-b, g1q4-rogue, g1q4-static, g1q4r02-api-1 (R-02 compose project `g1q4r02`).

## Files
scratchpad/g1q4/dynamic/routes.yml (generated Traefik routes), this file.

No published host ports. No Docker socket mounted. Repo mounted read-only into upstream containers.
Cleanup removes exactly these names, each by explicit name.
