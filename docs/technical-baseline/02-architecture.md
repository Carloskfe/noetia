# 02 — Architecture

## Runtime services — CONFIRMED

Composed via Docker Compose. Dev (`docker-compose.yml`) defines these services:

| Service | Image / build | Role |
|---------|---------------|------|
| `proxy` | Nginx (dev) / Traefik (prod) | Reverse proxy, TLS termination (prod) |
| `api` | build `services/api` | NestJS backend |
| `web` | build `services/web` | Next.js app |
| `image-gen` | build `services/image-gen` | Python image service |
| `worker` | build `services/worker` | BullMQ job processor |
| `db` | `postgres:16-alpine` | PostgreSQL |
| `cache` | `redis:7-alpine` | Redis |
| `storage` | `minio/minio` | S3-compatible object store |
| `search` | `getmeili/meilisearch:v1.7` | Full-text search |
| `prometheus` | `prom/prometheus` | Metrics scraping |
| `node-exporter` | `prom/node-exporter` | Host metrics |
| `cadvisor` | `gcr.io/cadvisor/cadvisor` | Container metrics |
| `monitor` | `grafana/grafana` | Dashboards |

**CONFIRMED** from `docker-compose.yml` and `docker-compose.server.yml`.

## Production topology — CONFIRMED

- **Provider:** Contabo VPS, Ubuntu 24.04 (per CLAUDE.md; **CONFIRMED** the compose file `docker-compose.server.yml` is the production overlay).
- **Reverse proxy / TLS:** Traefik v2.11 with Let's Encrypt (per CLAUDE.md + `infra/server/traefik/`).
- **DNS:** Cloudflare (DNS-only) per CLAUDE.md. **INFERRED** at infra level; not verifiable from code alone → treat provider as **INFERRED**, the Traefik config as **CONFIRMED** (files present).
- **Public routes:** `noetia.app` (web), `noetia.app/api/*` (api), `storage.noetia.app` (MinIO presigned URLs). **CONFIRMED** from CLAUDE.md + presign logic in `storage.service.ts`.
- **Internal-only services:** db, cache, search, worker, image-gen, monitoring — no host ports in prod. **INFERRED** from compose.

## Production resource limits — CONFIRMED

`docker-compose.server.yml` sets per-service memory limits/reservations (`deploy.resources`):

| Service | Limit | Reservation |
|---------|-------|-------------|
| api | 512M | 256M |
| web | 512M | 256M |
| image-gen | 512M | 256M |
| worker | 256M | 128M |
| db | 512M | 256M |
| cache | 256M | 64M |
| storage | 256M | 128M |
| search | 512M | (…) |

**CONFIRMED**. This is a **single-node** deployment sized for a small VPS — total committed memory is a few GB. **INFERRED:** no horizontal scaling / clustering is configured.

## Inter-service communication — CONFIRMED / INFERRED

- Web → API over HTTP (`services/web/lib/api.ts`; SSR uses an internal base URL, browser uses public `/api`). **CONFIRMED** (SSR base handling was a documented fix).
- API → PostgreSQL via TypeORM. **CONFIRMED**.
- API → Redis via `ioredis` (refresh tokens, and see worker/queues). **CONFIRMED** (dependency + `redis.provider.ts`).
- API → Meilisearch via `meilisearch` client. **CONFIRMED**.
- API → MinIO via AWS S3 SDK (`@aws-sdk` style `PutObjectCommand`/`GetObjectCommand`). **CONFIRMED**.
- API → image-gen and worker: **INFERRED** the worker consumes a BullMQ queue on Redis and image-gen is called over HTTP; exact call path not fully traced → **INFERRED**.
- Real-time: **WebSocket gateway** in API (`clubs/club-session.gateway.ts`) using Socket.IO; web consumes via `hooks/useClubSession.ts`. **CONFIRMED**.

## CI/CD — CONFIRMED

Two GitHub Actions workflows:

- **`ci.yml`** — on push/PR: matrix per service runs lint / typecheck / build; unit tests with coverage (`pnpm --filter @noetia/<svc> test:cov`) for api/web/worker/mobile; pytest with coverage for image-gen. Coverage gate ≥ 80% (per CLAUDE.md + job names).
- **`cd.yml`** — on push to `main`: SSH to server, `git pull`, `docker compose --env-file .env.production -f docker-compose.server.yml up -d --build`, then run migrations (`npm run migration:run:prod`).

**CONFIRMED** from workflow files. **INFERRED:** every push to `main` triggers a full rebuild + brief redeploy; there is no separate staging environment.

## Configuration — CONFIRMED

- Environment via `.env` (dev) / `.env.production` (server, not committed). `.env.example` documents variable names.
- TypeORM DB connection reads `DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASS` with in-code defaults (`app.module.ts`). Defaults are development-only; production overrides via env. **CONFIRMED**.
