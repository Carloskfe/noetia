# NEM-006A — Permanent Staging Environment Foundation

| | |
|---|---|
| **Status** | COMPLETE — **awaiting Product Architecture review** |
| **Authorization** | LIMITED IMPLEMENTATION · staging only; production not authorized |
| **Branch** | `nem-006a-staging` (not merged) |
| **Commits** | `0dcd139` foundation · `3c71e5a` web-bundle isolation fix · `5aa9a7b` activation-order doc fix · `15e5762` API basic-auth removal |
| **Produced** | `docker-compose.staging.yml` · `cd-staging.yml` · [`docs/staging/`](../../staging/README.md) |

## Scope
Establish dev → staging → production with a permanently isolated staging environment:
separate compose project, volumes, network, database (PostgreSQL 16 + pgvector), object
store, and credentials; Traefik routing behind basic auth; staging-only CD.

## Outcome
Activated 2026-08-18 at `staging.noetia.app`. Isolation verified: staging `users`=0 vs
production 16; the client bundle contains only `staging.noetia.app/api`; all 12 production
containers held ~9 days uptime across the work.

## Deviations and findings
- The web Dockerfile hard-coded production `NEXT_PUBLIC_*`; a staging build would have
  read and written **production data**. Fixed in `3c71e5a` before activation.
- API basic-auth collided with the app's own Bearer tokens, making staging login
  impossible. Gate moved to the web surface only (`15e5762`).
- `EXTERNAL-ACTIONS.md` §2 instructed creating the `staging` branch first, which would have
  armed auto-deploy before the environment was proven. Corrected (`5aa9a7b`).

## Known limitation at acceptance
**Staging could not validate Escucha Activa** — no audio, no real sync maps. Recorded as a
known limitation and addressed by NEM-006C.

## Auto-deploy
**NOT ARMED.** The `staging` branch does not exist; arming it is a separate Product Owner
decision.
