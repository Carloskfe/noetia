# Staging Runbook

Operational procedures for the Noetia staging environment. **No secrets in this file.** All commands run on the Contabo host unless noted. Staging is always addressed with `-p noetia_staging -f docker-compose.staging.yml`; it never touches the production project.

Convenience alias (host):
```bash
alias dcs='docker compose -p noetia_staging --env-file .env.staging -f docker-compose.staging.yml'
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
