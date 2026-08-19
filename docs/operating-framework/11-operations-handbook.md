# Operations Handbook

**v0.1** · NOF-001 · **Navigation layer only.** The detailed runbooks remain authoritative
and are linked, never absorbed — several are living documents that must not be frozen by
being copied here.

---

## Where things run

| | Production | Staging |
|---|---|---|
| Host | Contabo VPS · 8 vCPU / 24 GB / 400 GB | Same host, isolated |
| Path | `/opt/noetia` | `/opt/noetia-staging` |
| Compose project | default | `noetia_staging` |
| Domains | `noetia.app`, `storage.noetia.app` | `staging.noetia.app`, `storage.staging.noetia.app` |
| Access | Public | Basic-auth on the web surface |
| Deploy trigger | push to `main` (`cd.yml`) | push to `staging` (`cd-staging.yml`) — **not armed** |

Traefik v2.11 at `/opt/traefik` terminates TLS for both via Let's Encrypt HTTP-01.

## Task index

| Task | Runbook |
|---|---|
| Deploy production | [`CLAUDE.md` § Production Deployment](../../CLAUDE.md) |
| Deploy / operate staging | [`staging/RUNBOOK.md`](../staging/RUNBOOK.md) |
| First-time staging activation | [`staging/EXTERNAL-ACTIONS.md`](../staging/EXTERNAL-ACTIONS.md) |
| Rebuild staging content | [`staging/content-seeding.md`](../staging/content-seeding.md) |
| Run migrations | [`database-migrations.md`](../database-migrations.md) |
| Incidents — Traefik 502/404, unhealthy containers, DB, MinIO, SSL | [`incident-response.md`](../incident-response.md) |
| Monitoring and Grafana access | [`grafana-monitoring.md`](../grafana-monitoring.md) |
| Secret rotation | [`secrets-rotation.md`](../secrets-rotation.md) |
| Stripe configuration | [`stripe-setup.md`](../stripe-setup.md) |
| Whisper sync pipeline | [`sync-procedures.md`](../sync-procedures.md) · [`whisper-sync-troubleshooting.md`](../whisper-sync-troubleshooting.md) *(living)* |
| Content ingestion | [`CLAUDE.md` § Content Ingestion](../../CLAUDE.md) |
| Mobile build and release | [`eas-build.md`](../eas-build.md) · [`app-store-submission.md`](../app-store-submission.md) |
| Author upload specs | [`upload-guide.md`](../upload-guide.md) |

## Standing operational rules

**Never paste multi-line content into an SSH terminal.** Line breaks become command
separators and corrupt files — this caused a two-hour outage on 2026-05-12. Use `nano`, or
single-line `base64`.

**Take a snapshot before** infrastructure changes, schema-destructive migrations, kernel
reboots, or major dependency swaps. Three Contabo slots.

**After every production deploy:** `docker ps` all healthy; confirm the last migration
applied; spot-test one key endpoint (login, book list, or audio stream).

**Container gotchas already encoded** in compose: Next.js needs `HOSTNAME=0.0.0.0`, and
Alpine healthchecks must use `127.0.0.1` — `busybox wget` resolves `localhost` to IPv6
`::1`, marks the container unhealthy, and Traefik drops the route.

**Production reliability outranks any staging task.** Tooling that reads production
throttles and monitors production health, and stops rather than finishing.

## Backup and restore

`OPEN — a documented, tested backup and restore procedure was not found.` Staging exists
partly to rehearse production recovery
([`staging/README.md`](../staging/README.md)), and pgvector restore compatibility is
scoped to NEM-006B, but **no routine production backup schedule, retention policy, or
verified restore drill is recorded anywhere in the corpus.**

For a platform holding permanent user libraries and creator content, this is the most
serious operational gap the inventory surfaced. Recommended for the next operations
mission — recorded, not invented.

## Known deferred maintenance

- Pending kernel upgrade (6.8.0-134 → 137) and a deferred `docker.service` restart; both
  require a production-affecting window.
- Grafana login workaround active (cookie injection, 30-day sessions) — see
  [`grafana-monitoring.md`](../grafana-monitoring.md).
