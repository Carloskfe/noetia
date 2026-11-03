# Network-isolation regression tests (NEM-017 / S19)

**Local only — never run on the server.** Docker, python3, curl and openssl are required. Every project and network
uses the `s19h` prefix and is removed on exit.

| Script | What it proves |
|---|---|
| `run.sh` | For the **real** compose files (mirrored by `mirror.py`: real networks and Traefik labels, application replaced by an identity responder): normal traffic stays in-environment; Traefik routes all six hosts; a **stopped** `api`/`storage` **fails safely** (DNS `EAI_AGAIN`, no answer from the other environment); container recreation never yields a cross-environment answer; no staging container is on `proxy`. Exit 0 = all passed. |
| `rollout.sh` | A rehearsal of the production rollout and rollback, starting from the original configuration: create `proxy_staging`, attach the **running** Traefik live (asserts it is not restarted), move staging, roll back. A monitor requests the production site every 50 ms throughout and must only ever see production. |
| `mirror.py` | Generates the harness compose files from `docker compose config --format json`. Name prefixes preserve Docker's network sort order. TLS is omitted locally. |

```bash
# Production runs main's compose file; pass it explicitly when testing from another branch:
git show origin/main:docker-compose.server.yml > /tmp/prod.yml
PROD_COMPOSE=/tmp/prod.yml infra/tests/network-isolation/run.sh
# Baseline: the same suite against the ORIGINAL configuration must FAIL the F* and M1 checks:
git show origin/nem-006a-staging:docker-compose.staging.yml > /tmp/stg-before.yml
git show origin/nem-006a-staging:infra/server/traefik/docker-compose.yml > /tmp/traefik-before.yml
PROD_COMPOSE=/tmp/prod.yml STAGING_COMPOSE=/tmp/stg-before.yml TRAEFIK_COMPOSE=/tmp/traefik-before.yml infra/tests/network-isolation/run.sh
PROD_COMPOSE=/tmp/prod.yml BEFORE_STAGING=/tmp/stg-before.yml BEFORE_TRAEFIK=/tmp/traefik-before.yml infra/tests/network-isolation/rollout.sh
```
