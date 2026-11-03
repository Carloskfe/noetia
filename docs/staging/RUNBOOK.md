# Staging Runbook

Operational procedures for the Noetia staging environment. **No secrets in this file.** All commands run on the Contabo host unless noted. Staging is always addressed with `-p noetia_staging -f docker-compose.staging.yml`; it never touches the production project.

Convenience alias (host):
```bash
alias dcs='docker compose -p noetia_staging --env-file .env.staging -f docker-compose.staging.yml'
```

## Network isolation (NEM-017) — one-time host setup, before the first staging deploy
Staging must never join production's `proxy` network. Create its dedicated Traefik network and attach the
**running** Traefik to it live — `docker network connect` does not restart Traefik and leaves production routes untouched:
```bash
docker network create proxy_staging
docker network connect proxy_staging traefik
docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}' traefik   # expect: proxy proxy_staging
```
Persist the attachment in `/opt/traefik/docker-compose.yml` (add `proxy_staging` under the service's `networks` and as an
external network — see `infra/server/traefik/docker-compose.yml`; edit with nano, never paste multi-line over SSH).
**Do NOT run `docker compose up` in `/opt/traefik` for this** — the changed file makes Compose *recreate* Traefik (a brief
outage for every site on the host). The file only takes effect at the next planned Traefik maintenance.

Verify isolation after any staging deploy:
```bash
docker network inspect proxy -f '{{range .Containers}}{{.Name}} {{end}}'          # must list NO noetia_staging-* container
docker network inspect proxy_staging -f '{{range .Containers}}{{.Name}} {{end}}'  # traefik + noetia_staging-{api,web,storage}
```

## Deploy staging
```bash
cd /opt/noetia-staging
git pull origin staging
dcs up -d --build --remove-orphans
```
Or push to the `staging` branch → `cd-staging.yml` runs the same steps.

## Verify staging
```bash
dcs ps                      # all services healthy?
dcs exec -T api wget -qO- http://127.0.0.1:4000/health
curl -su "$STAGING_USER:$STAGING_PASS" -o /dev/null -w "web:%{http_code}\n" https://staging.noetia.app
curl -su "$STAGING_USER:$STAGING_PASS" -o /dev/null -w "api:%{http_code}\n" https://staging.noetia.app/api/books
```

## View logs
```bash
dcs logs -f api            # or web / worker / db / search / storage / cache
dcs logs --tail 100 api
```

## Run migrations (rehearsal)
```bash
dcs exec -T -e DB_HOST=db api npm run migration:run:prod
# Check latest applied:
dcs exec -T db psql -U noetia -d noetia_staging -c "SELECT name FROM migrations ORDER BY timestamp DESC LIMIT 3;"
```

## Rebuild reader content (audio + sync maps)
```bash
scripts/seed-staging-content.sh --dry-run     # inventory only, never touches production
scripts/seed-staging-content.sh               # full run (~13 GB audio mirror + sync)
scripts/seed-staging-content.sh --skip-mirror # DB-side only, audio already present
```
Full procedure, per-title outcomes, and failure recovery: [content-seeding.md](content-seeding.md).

## Reset staging data (disposable)
```bash
dcs down                                   # stop staging containers (keeps volumes)
dcs down -v                                # ALSO delete staging volumes (full data reset)
dcs up -d --build                          # rebuild fresh
# NOTE: `-v` only removes the *_staging volumes under project noetia_staging.
```

## Restore into staging (rehearse production recovery)
```bash
# From a schema-only or SANITIZED production-equivalent dump (never raw prod PII):
cat sanitized_dump.sql | dcs exec -T db psql -U noetia -d noetia_staging
# See pgvector-validation.md for the PG16 restore-compatibility test.
```

## pgvector check (staging DB)
```bash
dcs exec -T db psql -U noetia -d noetia_staging -tAc "SELECT version();"
dcs exec -T db psql -U noetia -d noetia_staging -tAc "SELECT default_version FROM pg_available_extensions WHERE name='vector';"
# Extension is created by an additive migration in a future mission — do NOT create
# the NEM-006 semantic schema here (out of scope for NEM-006A).
```

## Disable staging
```bash
dcs down --remove-orphans                  # stop + remove staging containers (keeps volumes)
# Traefik staging routers disappear automatically (they are container labels).
# Production is unaffected.
```

## Confirm production unaffected (run after any staging action)
```bash
docker compose --env-file .env.production -f docker-compose.server.yml ps   # in /opt/noetia — all prod healthy?
curl -o /dev/null -w "prod-web:%{http_code}\n" https://noetia.app
curl -o /dev/null -w "prod-api:%{http_code}\n" https://noetia.app/api/books
# Prod containers (noetia-*) and volumes (postgres_data, ...) must be untouched.
```

## Safety reminders
- Never run a production compose file from `/opt/noetia-staging`, and never run a staging compose file from `/opt/noetia`.
- Never point `.env.staging` at production DB/Redis/MinIO/Meili hosts or the live Stripe key.
- `dcs down -v` only affects staging volumes; it can never delete `postgres_data`/`redis_data`/`minio_data`/`meilisearch_data` (production).
