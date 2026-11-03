# NOETIA ENGINEERING MISSION — NEM-017
## S19: staging/production Docker network isolation

**Status:** IN PROGRESS → awaiting REVIEW (implementation and local tests complete; Draft PR open)
**Mission type:** INFRASTRUCTURE (remediation)
**Implementation authorization:** FULL-WITHIN-SCOPE: implementation, local testing, documentation, Draft PR
**Schema changes:** NOT AUTHORIZED (none)
**Infrastructure changes:** configuration files only. **No live network, container or Traefik operation.**
**Production deployment:** NOT AUTHORIZED. The rollout needs a separate PO authorization.
**Product Owner approval:** GRANTED 2026-11-02 ("Approved to implement; deployment requires separate authorization")

## 1. Context
NEM-016 rev 5 (S19) reproduced cross-environment Docker DNS fall-through on the shared external `proxy` network: staging and production `api`, `web` and `storage` resolve to each other's containers whenever a same-named service is down.

## 2. Objective
Remove every container-level path between staging and production without changing production services or routing.

## 3–4. Dependencies and sources
- NEM-006A staging stack (branch `nem-006a-staging`)
- NEM-016 report §16
- `docker-compose.server.yml` (main)
- `docker-compose.staging.yml`
- `infra/server/traefik/`

## 5. In scope
- `docker-compose.staging.yml`: staging moves to a dedicated `proxy_staging` network
- `infra/server/traefik/docker-compose.yml`: persist Traefik's second attachment
- staging docs
- the local test harness `infra/tests/network-isolation/`

## 6. Out of scope
- Production compose and services (unchanged)
- Live operations
- Environment-specific internal hostnames (defence in depth; not needed after isolation, see the report)
- S16/S17/S18
- NEM-016 code

## 8. Protected systems
Production services, data and routing: not modified. Traefik is touched only through its compose file, which is not applied (see report §6).

## 11–12. Acceptance and tests
Report §4: `run.sh` 30/30 on the new configuration; the same suite **fails** the S19 checks on the original configuration; `rollout.sh` 18/18.

## 14. Deployment
Not authorized. The procedure is in report §6.

## 17. Stop conditions
None triggered: no production service change, no live operation, no data touched.

## 18. Completion report
`docs/reports/2026-11-02-NEM-017-s19-network-isolation.md`

## 19. Review
Pending.

> **STOP. Await Product Owner authorization for any live infrastructure operation.**
