# Noetia Staging Environment

Permanent pre-production validation layer (created by **NEM-006A**). Establishes:

```
LOCAL DEVELOPMENT → STAGING → PRODUCTION
```

replacing the previous effective `dev → production` model. Staging is the safe place to validate application changes, migrations, PostgreSQL/**pgvector**, AI integrations (future), Stripe **test** behavior, background jobs, and deployment procedures **without risking production users or data**.

> **Repository-side complete; activation pending external actions.** All code/config for staging is in the repo (branch `nem-006a-staging`). Bringing staging *online* needs host-side setup and DNS — see [EXTERNAL-ACTIONS.md](EXTERNAL-ACTIONS.md). Nothing here changes production.

## Files
| Path | Purpose |
|------|---------|
| `docker-compose.staging.yml` | Isolated staging stack (pgvector DB, separate volumes/network, Traefik `staging.noetia.app`, basic-auth). |
| `.env.staging.example` | Staging env template (no secrets). Copy → `.env.staging` on the host. |
| `.github/workflows/cd-staging.yml` | Staging-only deploy (branch `staging`, project `noetia_staging`, dir `/opt/noetia-staging`). |
| `services/web/components/StagingBanner.tsx` | Env-gated "STAGING" ribbon (inert unless `NEXT_PUBLIC_APP_ENV=staging`). |
| `docs/staging/*` | This documentation + runbook + external actions + pgvector evidence + data policy + promotion checklist. |

## Topology & isolation model

```
PRODUCTION (project: noetia, dir /opt/noetia, main)   STAGING (project: noetia_staging, dir /opt/noetia-staging, staging)
  noetia-web/api/...                                    noetia_staging-web/api/...
  volumes: postgres_data, redis_data,                   volumes: postgres_data_staging, redis_data_staging,
           minio_data, meilisearch_data                          minio_data_staging, meilisearch_data_staging
  db: postgres:16-alpine                                db: pgvector/pgvector:pg16   (staging only)
  Stripe LIVE                                           Stripe TEST
  network: noetia_noetia_net                            network: noetia_staging_noetia_staging_net
  shared: external Traefik "proxy" network (distinct router names: noetia- vs noetia-staging-; hosts noetia.app vs staging.noetia.app)
```

**Isolation guarantees (§5, §13, §40):**
- **No shared writable state.** Separate PostgreSQL, Redis, Meilisearch, MinIO — distinct named volumes (`*_staging`), never the production volumes.
- **Separate compose project (`noetia_staging`).** Container prefix `noetia_staging-…` does **not** contain the substring `noetia-`, so production's `docker … --filter name=noetia-` teardown can never match staging (and staging only ever addresses its own project via `-p noetia_staging`).
- **Separate host directory `/opt/noetia-staging`** on the `staging` branch — a staging `git pull` never disturbs production's `/opt/noetia` (on `main`).
- **Separate deploy trigger.** `cd-staging.yml` runs on the `staging` branch/dispatch only; `cd.yml` (production) is unchanged and untouched.
- **Separate secrets** via `.env.staging` (DB, JWT, MinIO, Stripe **test**, future AI). No production secret reuse.

## Deployment
See [RUNBOOK.md](RUNBOOK.md). In brief, on the host once prerequisites exist:
```
cd /opt/noetia-staging && git pull origin staging
docker compose -p noetia_staging --env-file .env.staging -f docker-compose.staging.yml up -d --build
```
Or push to the `staging` branch to trigger `cd-staging.yml`.

## Hosting strategy (§6, §7)
Designed to **colocate on the existing Contabo VPS** with bounded resource limits (staging total ≈ ~2.0 GB memory cap; monitoring stack intentionally omitted). Production keeps priority. **Before activation, the operator must verify current host free capacity** (`free -h`, `df -h`, `docker stats`); **if capacity is insufficient, provision a separate small staging VPS instead of colocating** — do not compromise production reliability. This capacity check is a host-side action (see EXTERNAL-ACTIONS) because it cannot be measured from the repository.

## DNS (§8) — Product Owner action
`staging.noetia.app` (and `storage.staging.noetia.app`) must resolve to the Contabo host. Cloudflare DNS record(s) are a Product Owner action — exact records in [EXTERNAL-ACTIONS.md](EXTERNAL-ACTIONS.md). This mission does not (and cannot) modify DNS.

## Public-exposure protection (§9)
Staging is gated by **Traefik HTTP basic-auth** (`noetia-staging-auth` middleware, users from `STAGING_BASICAUTH`) on both web and api routers — crawlers/casual visitors cannot reach it, which also serves as effective `noindex`. Plus the visible **STAGING banner**. This is the smallest secure option consistent with the current Traefik architecture (no new identity platform).

## Stripe / Email / OAuth
- **Stripe:** TEST mode only (`sk_test_…`, test webhook secret). No real charges possible. See [EXTERNAL-ACTIONS.md](EXTERNAL-ACTIONS.md).
- **Email:** staging must not email real users — default `.env.staging` leaves SMTP unset (email effectively disabled) / `EMAIL_SAFE_MODE=true`. See [data-and-sanitization.md](data-and-sanitization.md).
- **OAuth:** blank by default → email/password login on staging; enabling Google/Facebook needs staging callback URLs registered in each provider console (Product Owner action).

## Monitoring, backups, rollback
- **Monitoring:** no duplicate Prometheus/Grafana stack; diagnose via `docker compose -p noetia_staging logs`. (Rationale: staging is disposable; §25.)
- **Backups:** staging data is disposable, but staging exists to **rehearse production recovery** — see [pgvector-validation.md](pgvector-validation.md) (restore test) and [data-and-sanitization.md](data-and-sanitization.md).
- **Rollback:** staging is torn down/reset without affecting production — [RUNBOOK.md](RUNBOOK.md) "Disable/Reset". Traefik changes are additive (new `noetia-staging-*` routers); removing the staging stack removes them. Production application/DB behavior is unchanged, so no production rollback is implicated.

## pgvector (B1) — validated
`pgvector/pgvector:pg16` was validated locally (isolated container): **PostgreSQL 16.14, `vector` 0.8.6, `CREATE EXTENSION vector` OK, `vector(768)` (PO-005 `gemini-embedding-001`) exact `<->` search OK** — same MAJOR version as production (16). Full evidence + the production-volume restore test in [pgvector-validation.md](pgvector-validation.md). **Production PostgreSQL is NOT changed** by this mission.

## Known follow-up (production CD hardening — NOT changed here per §12)
Production `cd.yml` tears down via `docker … --filter name=noetia-`. Staging is safe from this by construction (project `noetia_staging`). Still, a future mission should **tighten the production teardown to the production project** (`docker compose -p noetia … down`) rather than a broad name filter, to remove the class of risk entirely. Documented, not changed (§12).
