# NOETIA ENGINEERING MISSION — NEM-018
## Shared proxy network hardening (Noetia production and AutoGuildX)

**Status:** IN PROGRESS → awaiting REVIEW (investigation, local tests and documentation complete; Draft PR open)
**Mission type:** INFRASTRUCTURE (discovery and design)
**Implementation authorization:** LIMITED: investigation, local tests, documentation, Draft PR
**Schema changes:** NOT AUTHORIZED (none)
**Infrastructure changes:** NOT AUTHORIZED. No VPS access; no live network, container or Traefik operation.
**Production deployment:** NOT AUTHORIZED. Merge, staging and production deployment all need separate authorization.
**Product Owner approval:** mission brief issued by the Product Owner on 2026-11-03.

## 1. Context
Noetia production and AutoGuildX share one VPS and the external Docker network `proxy`. A live inspection by the Product Owner found overlapping `api` and `web` DNS aliases. No cross-application misrouting incident is confirmed.

## 2. Objective
Investigate and design a safe, testable isolation strategy that prevents unintended cross-application DNS resolution while preserving Traefik routing and application connectivity.

## 3–4. Dependencies and sources
- NEM-017 (`proxy_staging`, deployed separately; read only, never modified here)
- `docker-compose.server.yml`, `infra/server/traefik/`, `services/web/next.config.js`, `services/web/Dockerfile`
- AutoGuildX repository at `a09e9a8` (read only)

## 5. In scope
- `infra/tests/shared-proxy-isolation/` (local tests and the proposed AutoGuildX patch)
- `docs/operations/nem-018-autoguildx-network-migration.md` (specification and runbook)
- `docs/reports/2026-11-03-NEM-018-shared-proxy-network-hardening.md` (report)
- This mission record

## 6. Out of scope
The VPS, live Docker networks and containers, databases, volumes, Traefik restarts, merges, deployments, migrations, Stripe, NEM-017 files and branches, and any write to the AutoGuildX repository.

## 8. Protected systems
Escucha Activa, the reader, ownership, production data and business-rule engines: not touched. No application code or production configuration changes.

## 11. Acceptance criteria
See the mission brief's deliverables A–E; results are in the report.

## 14. Deployment
None performed. The proposed production steps are in the runbook and each needs Product Owner authorization.

## 17. Stop conditions
Stop before any merge, deployment, production configuration change or live infrastructure operation, then wait for Product Owner authorization.
