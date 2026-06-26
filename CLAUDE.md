# Noetia — Developer Guide

Noetia is a multimodal reading + social sharing platform. For full product context see [`docs/PRD.md`](docs/PRD.md).

---

## Product Hierarchy

**Every engineering decision must respect this order:**

### 1. Reader experience — top priority
The reader is the daily active user. The reading engine (sync, audio, fragments, sharing) must be fast, correct, and reliable before any other work ships. When two features compete for time, the one that affects active readers wins.

### 2. Author and company experience — second priority
Authors are the content supply chain. Without their books, there are no readers. The upload pipeline, sync tooling, review workflow, and author analytics are business-critical infrastructure — not admin tools.

### 3. Free library — beta acquisition tool, not the business
The ~40 public-domain books exist to give beta users a complete reading experience before the author catalog grows. **New free-library titles will not be added after 6–12 months.** Do not over-engineer free-library ingestion, sync maps, or catalog management. Once there are 50+ author titles, the free library hero placement in the UI will be replaced by curated author content.

> This hierarchy is not about importance to the company — authors are as important as readers. It reflects **frequency of interaction**: readers use the app daily; authors upload occasionally. Features that affect daily active users are prioritized over features that affect the occasional upload flow.

---

## Table of Contents

1. [Git Workflow](#git-workflow)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Environment Variables](#environment-variables)
5. [Docker Dev Volume Mounts](#docker-dev-volume-mounts)
6. [Production Deployment](#production-deployment)
7. [Infrastructure & Vendors](#infrastructure--vendors)
8. [Whisper Sync Map](#whisper-sync-map)
9. [Content Ingestion](#content-ingestion)
10. [Database Migrations](#database-migrations)
11. [Reader Persona Pipeline](#reader-persona-pipeline)
12. [Development Safety Rules](#development-safety-rules)
13. [Testing](#testing)
14. [Voice & Style Guide](#voice--style-guide)
15. [Reference Documents](#reference-documents)

---

## Git Workflow

After completing any meaningful unit of work, commit and push to GitHub immediately so progress is never lost.

**Commit after every:**
- Completed task or group of tasks from a sprint
- Bug fix or hotfix
- Config or infrastructure change
- Documentation update

**Commit message format:**
```
<type>: <short description>

Types: feat | fix | chore | docs | ci | refactor
```

**Examples:**
```
feat: add JWT auth endpoints to api service
fix: add missing public/ dir for Next.js web service
chore: bump actions/checkout to v5
docs: update project structure in CLAUDE.md
```

**Push after every commit:**
```bash
git add <specific files>
git commit -m "<type>: <description>"
git push
```

Never batch multiple unrelated changes into a single commit. Small, focused commits make it easy to track progress and revert if needed.

---

## Tech Stack

| Service     | Technology            | Purpose                                    |
|-------------|-----------------------|--------------------------------------------|
| `api`       | NestJS (Node.js + TS) | REST/GraphQL API, business logic           |
| `web`       | Next.js (React)       | Web reader + admin dashboard               |
| `mobile`    | React Native          | iOS + Android app, offline sync            |
| `db`        | PostgreSQL 16         | Users, books, fragments, subscriptions     |
| `cache`     | Redis 7               | Sessions, phrase-sync state, job queues    |
| `storage`   | MinIO                 | Books, audio files, generated images (S3)  |
| `image-gen` | Python + Pillow/Cairo | Quote card image generation microservice   |
| `worker`    | BullMQ (Node.js)      | Async jobs: image rendering, share exports |
| `proxy`     | Nginx (dev) / Traefik (prod) | Reverse proxy, SSL termination      |
| `search`    | Meilisearch           | Book and fragment full-text search         |
| `monitor`   | Grafana + Prometheus  | Metrics and alerting                       |

---

## Project Structure

```
noetia/
├── docker-compose.yml           # Local dev
├── docker-compose.prod.yml      # Production resource limits overlay
├── docker-compose.server.yml    # Standalone server deploy (Traefik, no nginx)
├── .env.example
├── docs/
│   ├── PRD.md
│   ├── TASKS.md
│   └── stripe-setup.md
│
├── services/
│   ├── api/                        # NestJS backend
│   │   ├── src/
│   │   │   ├── auth/               # Google, Facebook, Apple, email auth
│   │   │   │   ├── auth.service.ts     # register, confirmEmail, resendConfirmation
│   │   │   │   ├── token.service.ts    # JWT, refresh, pwd-reset, email-confirm tokens
│   │   │   │   └── redis.provider.ts
│   │   │   ├── email/              # Email delivery (nodemailer, SMTP)
│   │   │   │   ├── email.service.ts    # sendEmailConfirmation, sendPasswordReset
│   │   │   │   └── email.module.ts
│   │   │   ├── books/              # Book catalog, streaming, DRM, sync maps
│   │   │   ├── fragments/          # Highlights and fragment sheets
│   │   │   ├── subscriptions/      # Stripe plans and billing
│   │   │   ├── authors/            # Author/publisher module
│   │   │   ├── sharing/            # Share engine, deep links
│   │   │   ├── social/             # OAuth account linking + publish per platform
│   │   │   │   ├── social.controller.ts
│   │   │   │   ├── social-token.service.ts   # AES-256-CBC encrypted tokens in Redis
│   │   │   │   ├── social-oauth.config.ts    # Shared platform OAuth config (LinkedIn, FB, IG, Pinterest)
│   │   │   │   └── publishers/
│   │   │   │       ├── linkedin.publisher.ts
│   │   │   │       ├── facebook.publisher.ts
│   │   │   │       ├── instagram.publisher.ts
│   │   │   │       └── pinterest.publisher.ts
│   │   │   ├── library/            # User library, access control
│   │   │   ├── ingestion/          # Book ingestion (Gutenberg, Librivox, Wikisource)
│   │   │   ├── search/             # Meilisearch integration
│   │   │   ├── storage/            # MinIO S3 client
│   │   │   ├── stats/              # Reading stats: heartbeat UPSERT, 7-day chart, streak, goals
│   │   │   ├── users/              # User profiles, settings, privacy toggles, weekly goals
│   │   │   └── migrations/         # TypeORM migrations (see §Database Migrations)
│   │   ├── tests/unit/             # Mirrors src/ exactly
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── web/                        # Next.js web app
│   │   ├── app/
│   │   │   ├── (reader)/           # Synchronized reading UI + Modo Escucha Activa
│   │   │   ├── (library)/          # Book catalog, discovery, Mi Biblioteca (with collection grouping)
│   │   │   ├── (fragments)/        # Fragment sheet and editor
│   │   │   ├── (social)/           # Quote card preview and sharing
│   │   │   └── (admin)/            # Author/publisher dashboard
│   │   ├── components/
│   │   │   ├── BookGrid.tsx        # Book grid with next/image covers + language badge
│   │   │   ├── ReaderTopBar.tsx    # Back/discover/clubs links + font/dark/audio/chapter/fragments controls — fully i18n
│   │   │   ├── ShareModal.tsx      # Instagram, Facebook, LinkedIn, Pinterest formats
│   │   │   ├── StatsTab.tsx        # 7-day bar chart, streak, goal progress rings, goal form
│   │   │   └── PrivacyTab.tsx      # 4 privacy toggle switches with optimistic PATCH
│   │   ├── lib/
│   │   │   ├── i18n/               # LanguageProvider, useTranslation(); en.ts + es.ts; syncs language to/from API on mount
│   │   │   ├── use-reading-heartbeat.ts  # 60s interval hook — POST /api/stats/heartbeat, tracks phrasDelta
│   │   │   └── share-utils.ts      # SharePlatform, ShareFormat, FORMAT_PLATFORM_MAP
│   │   ├── public/
│   │   │   ├── covers/             # Themed book cover PNGs — volume-mounted in docker-compose.yml
│   │   │   ├── backgrounds/        # imagen-1..5.png + upload-slot.png (preset backgrounds)
│   │   │   └── presets/            # Font preview thumbnails
│   │   ├── sentry.client.config.ts # Sentry browser SDK (loads when NEXT_PUBLIC_SENTRY_DSN is set)
│   │   ├── sentry.server.config.ts # Sentry server SDK
│   │   ├── sentry.edge.config.ts   # Sentry edge SDK
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── mobile/                     # React Native app
│   │   ├── src/
│   │   │   ├── screens/
│   │   │   ├── i18n/               # LanguageProvider, useTranslation(); en.ts + es.ts; syncs language to/from API
│   │   │   └── offline/            # Offline sync logic
│   │   └── package.json
│   │
│   ├── image-gen/                  # Python image generation service
│   │   ├── app.py                  # Flask API — POST /generate
│   │   ├── storage.py              # MinIO client (supports MINIO_PUBLIC_URL rewrite)
│   │   ├── templates/              # Quote card design templates
│   │   │   ├── base.py             # Core Pillow render_card, gradient, luminance utils
│   │   │   ├── linkedin.py         # 1200×627 (post), 1200×675 (twitter-card)
│   │   │   ├── instagram.py        # 1080×1080 (post), 1080×1920 (story/reel)
│   │   │   ├── facebook.py         # 1200×630 (post), 1080×1920 (story/reel)
│   │   │   ├── pinterest.py        # 1000×1500 (pin), 1000×1000 (pin-square)
│   │   │   └── whatsapp.py         # kept for backwards compatibility
│   │   ├── scripts/
│   │   │   ├── generate_book_covers.py   # Book cover PNGs
│   │   │   ├── generate_bg_presets.py    # imagen-1..5 + upload-slot placeholders
│   │   │   └── generate_presets.py       # Font preview thumbnails
│   │   ├── tests/unit/
│   │   ├── Dockerfile
│   │   └── requirements.txt
│   │
│   └── worker/                     # BullMQ async job processor
│       ├── src/jobs/
│       │   ├── image-render.job.ts
│       │   └── share-export.job.ts
│       ├── Dockerfile
│       └── package.json
│
├── nginx/
│   ├── nginx.conf
│   └── ssl/
│
└── infra/
    ├── postgres/
    │   └── init.sql
    ├── redis/
    │   └── redis.conf
    ├── minio/
    │   └── buckets.sh              # Creates buckets + folder structure:
    │                               #   books/covers/
    │                               #   images/share/
    │                               #   images/backgrounds/presets/
    │                               #   images/backgrounds/user/
    └── server/
        ├── init.sh                 # One-time Ubuntu 24.04 setup (run as root)
        └── traefik/
            ├── docker-compose.yml  # Traefik v2.11 container
            └── traefik.yml         # Static config — Let's Encrypt, entrypoints
```

Each service that contains a `src/` directory also has a sibling `tests/unit/` directory that mirrors it exactly (see [Testing](#testing)).

---

## Environment Variables

**Local dev:** copy `.env.example` to `.env` and fill in values.
**Production:** create `.env.production` on the server at `/opt/noetia/.env.production`. This file is never committed — keep it in a password manager.

Key variables:

### API
| Variable | Default | Notes |
|----------|---------|-------|
| `JWT_SECRET` | `changeme` | **Change in production** |
| `JWT_EXPIRES_IN` | `15m` | Access token lifetime |
| `WEB_URL` | `http://localhost:3000` | Used in email confirmation + reset links |
| `API_URL` | `http://localhost:4000` | Used as OAuth callback base URL |

### Email (SMTP)
| Variable | Default | Notes |
|----------|---------|-------|
| `SMTP_HOST` | `mailhog` | Dev: Mailhog; Prod: SendGrid, SES, etc. |
| `SMTP_PORT` | `1025` | |
| `SMTP_SECURE` | `false` | Set `true` for port 465 |
| `SMTP_USER` | _(empty)_ | Leave empty for Mailhog |
| `SMTP_PASS` | _(empty)_ | |
| `SMTP_FROM` | `Noetia <noreply@noetia.app>` | Sender name + address |

### MinIO / Storage
| Variable | Default | Notes |
|----------|---------|-------|
| `MINIO_ENDPOINT` | `storage` | Docker service name |
| `MINIO_PORT` | `9000` | |
| `MINIO_PUBLIC_URL` | `http://localhost:9000` | **Required** — rewrites internal Docker hostname in presigned URLs so browsers can download images. Set to CDN/public URL in production. |
| `MINIO_ACCESS_KEY` | `minioadmin` | **Change in production** |
| `MINIO_SECRET_KEY` | `changeme` | **Change in production** |

### Social OAuth (account linking for sharing)
| Variable | Notes |
|----------|-------|
| `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` | LinkedIn app credentials |
| `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` | Meta app credentials |
| `INSTAGRAM_APP_ID` / `INSTAGRAM_APP_SECRET` | Instagram Basic Display API |
| `PINTEREST_APP_ID` / `PINTEREST_APP_SECRET` | Pinterest developer app |
| `SOCIAL_TOKEN_SECRET` | AES-256 key for encrypting stored tokens — **change in production** |
| `INSTAGRAM_PUBLISH_ENABLED` | `false` — set `true` only after Meta App Review |

### Sentry (error tracking)
Leave all Sentry vars empty in development — the SDK skips initialization when DSN is absent.

| Variable | Notes |
|----------|-------|
| `SENTRY_DSN` | API (server-side) DSN from your Sentry project |
| `NEXT_PUBLIC_SENTRY_DSN` | Web (browser-side) DSN — same or separate project |
| `SENTRY_ORG` | Sentry org slug (for source-map uploads during CI build) |
| `SENTRY_PROJECT` | Sentry project slug |
| `SENTRY_AUTH_TOKEN` | Token for source-map uploads — set in CI secrets only |

### Stripe
See [`docs/stripe-setup.md`](docs/stripe-setup.md) for full setup instructions.

> **Production MinIO:** `MINIO_ENDPOINT=storage` (same Docker name) · `MINIO_PUBLIC_URL=https://storage.noetia.app`

---

## Docker Dev Volume Mounts

The `docker-compose.yml` mounts source directories as read-only volumes so changes take effect **without a container rebuild**. If a file is NOT listed below, you must `docker compose up -d --build <service>` after changing it.

| Service | Mounted path | What it covers |
|---------|-------------|----------------|
| `api` | `services/api/src` | All NestJS source files |
| `web` | `services/web/app` | Next.js pages and layouts |
| `web` | `services/web/components` | React components |
| `web` | `services/web/lib` | Shared utilities |
| `web` | `services/web/public` | Static assets (covers, backgrounds, presets) |
| `web` | `services/web/next.config.js` | Next.js config (image domains, rewrites) |

**Files that still require a rebuild:** `package.json`, `Dockerfile`, `tsconfig.json`, `tailwind.config.*`, any new dependency.

---

## Production Deployment

### Server

| Property | Value |
|----------|-------|
| Provider | Contabo (contabo.com) — Cloud VPS 30 SSD |
| IP | `84.247.140.175` |
| OS | Ubuntu 24.04 LTS |
| Specs | 8 vCPU · 24 GB RAM · 400 GB SSD · 600 Mbit/s · unlimited traffic |
| Snapshots | 3 available (use before major changes) |
| Domains | `noetia.app`, `storage.noetia.app` |

### Architecture

```
Internet (80/443)
      │
   Traefik v2.11       /opt/traefik/   — auto SSL via Let's Encrypt
   ┌────┴──────────────────┐
   │                       │
noetia.app             storage.noetia.app
noetia.app/api/*           │
   │                    MinIO API
   ├── web:3000             (presigned URLs for browser downloads)
   └── api:4000

Internal only (no host ports):
  PostgreSQL · Redis · Meilisearch · Grafana (127.0.0.1:3001)
```

### Auto-deploy (GitHub Actions)

Every push to `main` triggers `.github/workflows/cd.yml`:
1. SSHes into server using `DEPLOY_SSH_KEY` secret
2. `git pull origin main`
3. `docker compose --env-file .env.production -f docker-compose.server.yml up -d --build`
4. Runs pending migrations
5. Prunes unused Docker images

### Manual deploy commands

```bash
# SSH in (port 222 — changed from default 22 for security)
ssh -p 222 root@84.247.140.175

# Deploy manually (same as what CI runs)
cd /opt/noetia
git pull origin main
docker compose --env-file .env.production -f docker-compose.server.yml up -d --build
docker compose --env-file .env.production -f docker-compose.server.yml exec -T api npm run migration:run:prod

# View logs
docker compose -f docker-compose.server.yml logs -f api
docker compose -f docker-compose.server.yml logs -f web

# Check running containers
docker ps

# Access MinIO console (SSH tunnel — run on local machine)
ssh -p 222 -L 9001:localhost:9001 root@84.247.140.175
# Then open http://localhost:9001 in browser

# Access Grafana (SSH tunnel — run on local machine)
ssh -p 222 -L 3001:localhost:3001 root@84.247.140.175
# Then open http://localhost:3001 in browser
```

### First-time server setup

See `infra/server/init.sh` — run once as root on a fresh Ubuntu 24.04 server. Installs Docker, configures UFW firewall, creates `/opt/traefik`, `/opt/noetia`, `/opt/autoguildx`, and the `proxy` Docker network.

Traefik must be started first before any project containers:
```bash
cd /opt/traefik && touch acme.json && chmod 600 acme.json && docker compose up -d
```

### Critical server operations — hard-won lessons

**NEVER paste multi-line content via SSH terminal.** The shell misinterprets line-breaks as command separators, corrupting files — caused a 2-hour outage on 2026-05-12. Use nano or base64 instead:

```bash
# nano (safest)
nano /opt/traefik/traefik.yml  # Ctrl+O save, Ctrl+X exit

# base64 (immune to newline corruption — generate on local, apply on server)
# Local: python3 -c "import base64; print(base64.b64encode(open('file').read().encode()).decode())"
echo <BASE64> | base64 -d > /path/file
```

**Traefik config** is at `/opt/traefik/traefik.yml` — requires exact 2-space YAML indentation. After any change: `docker restart traefik`. If it won't start: `docker logs traefik --tail 10`; strip extra indentation with `sed -i 's/^  //' /opt/traefik/traefik.yml`.

**Traefik 502/404 diagnosis:** see [`docs/incident-response.md §1`](docs/incident-response.md#1-traefik-502--404) for the full checklist. Quick checks: `docker ps` (confirm containers are `(healthy)`); `docker network inspect proxy` (confirm container is on the proxy network).

**Known container gotchas** (both fixed in `docker-compose.server.yml`):
- Next.js requires `HOSTNAME: "0.0.0.0"` — Docker sets `HOSTNAME` to the container ID, causing Next.js to bind to a single interface → Traefik 502.
- Alpine healthchecks must use `127.0.0.1` not `localhost` — `busybox wget` resolves `localhost` as `::1` (IPv6), marking the container unhealthy → Traefik drops the route.

---

## Infrastructure & Vendors

Credentials are in `.env.production` on the server — never committed.

| Category | Provider | Key facts |
|----------|----------|-----------|
| DNS | Cloudflare | DNS-only (gray cloud) — Traefik handles SSL. DKIM+SPF+DMARC verified on `noetia.app` |
| Email | Resend | Free (3K/mo, 100/day). SMTP: `smtp.resend.com:465`. From: `noreply@noetia.app` |
| Payments | Stripe | Keys not yet in `.env.production`. Webhook: `/api/webhooks/stripe` |
| Error tracking | Sentry | SDK installed; activate by setting `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` |
| Search | Meilisearch | Self-hosted v1.7 — internal Docker only (no external port) |
| File storage | MinIO | Self-hosted. **`books/` + `audio/` = private; `images/` = public.** Console: SSH tunnel port 9001 |
| CI/CD | GitHub Actions | Trigger: push to `main`. Auth: `DEPLOY_SSH_KEY` → `/root/.ssh/deploy_key` on server |

---

## Whisper Sync Map

Full pipeline — Colab GPU setup (`scripts/whisper-colab.ipynb`), step-by-step VTT procedure, known gotchas (`mkdir -p /app/transcriptions` before every `docker cp`; `/app/transcriptions` is wiped on each deploy), and current quality status by book — is in [`docs/sync-procedures.md`](docs/sync-procedures.md).

Root-cause diagnosis for books below 90% (announcement noise, front/back matter, story-order mismatches, edition mismatches) is in [`docs/whisper-sync-troubleshooting.md`](docs/whisper-sync-troubleshooting.md).

---

## Content Ingestion

All ingestion scripts run inside the `api` container (TypeORM + NestJS DI):

```bash
# Ingest all catalogue books (skips existing, fetches text from Gutenberg/Wikisource)
docker compose exec api npx ts-node -r tsconfig-paths/register src/ingestion/seed-ingestion.ts

# Seed/update the collections table from books.collection values
docker compose exec api npx ts-node -r tsconfig-paths/register src/ingestion/seed-collections.ts

# Download and store audio zip files from LibriVox
docker compose exec api npx ts-node -r tsconfig-paths/register src/ingestion/seed-audio.ts

# Store M4B stream URLs (browser-playable audio)
docker compose exec api npx ts-node -r tsconfig-paths/register src/ingestion/seed-audio-stream.ts

# Fetch and store cover images from Open Library CDN
docker compose exec api npx ts-node -r tsconfig-paths/register src/ingestion/seed-covers.ts
```

Book text sources: Gutenberg (`gutenbergId`) or Spanish Wikisource (`wikisourceTitle` / `wikisourceTitles`).  
All catalogue entries are in `services/api/src/ingestion/catalogue.ts`.  
Themed cover PNGs live in `services/web/public/covers/` (generate with `services/image-gen/scripts/generate_themed_covers.py`).

---

## Database Migrations

**Run pending migrations:**
```bash
# Dev
docker compose exec api npm run migration:run
# Production
docker compose --env-file .env.production -f docker-compose.server.yml exec -T -e DB_HOST=db api npm run migration:run:prod
```

Full history (000–061 through `FixAllowInsightsColumnName`), golden rules, and how to generate a new migration: [`docs/database-migrations.md`](docs/database-migrations.md).

> **Critical rule:** Never edit a migration after deployment — write a corrective migration instead. Migrations 060 → 061 are the canonical example.

---

## Sync Quality Status

Current book-by-book coverage numbers, pass/fail status, and the diagnostic SQL are in [`docs/sync-procedures.md § Sync Quality Status`](docs/sync-procedures.md#3-sync-quality-status). Standard: `syncCoverage` ≥ **90%**. Last audited 2026-06-25.

`docs/whisper-sync-troubleshooting.md` is a living document — append every newly-validated bug/fix as you find it, not batched at session end.

---

## Reader Persona Pipeline

Event stream → fragment theme tagging (20-theme taxonomy) → nightly persona computation (8 SQL aggregations), admin endpoints, opt-out flow: [`docs/persona-pipeline.md`](docs/persona-pipeline.md).

---

## Development Safety Rules

Hard-won rules that are not obvious from the code.

### Production data
- **Always `SELECT COUNT(*)` before a destructive `DELETE` or `UPDATE`.** Never run bulk deletes without a `WHERE` clause.
- Use transactions for operations that touch more than one table.
- Take a **server snapshot** (Contabo console → Snapshots) before: running a migration that drops or renames a column, making any infrastructure change, or switching a major dependency. You have 3 snapshot slots.

### Schema / migrations
- **Never edit a migration after it has been deployed.** TypeORM checksums each file — editing a shipped migration breaks `migration:run` everywhere. Write a new corrective migration instead (pattern: migrations 060 → 061).
- Every schema change must go through a migration, not a raw `ALTER TABLE` on the server.
- Seed-data migrations must be idempotent (`ON CONFLICT DO NOTHING` or existence check).

### Secrets and logging
- `.env.production` is never committed — confirm with `.gitignore` before any `git add .`
- **Never log JWT payloads, passwords, raw tokens, or user PII.** API errors must surface as `HttpException` with a safe message — not raw database or stack trace output.
- Stripe webhook handlers must verify the `stripe-signature` header before processing any event.

### Deployment verification
After every production deploy, run:
```bash
docker ps                               # all containers (healthy)?
# Check last migration applied:
docker compose -f docker-compose.server.yml exec -T db \
  psql -U noetia -d noetia \
  -c "SELECT name FROM typeorm_migrations ORDER BY timestamp DESC LIMIT 3;"
```
Spot-test one key endpoint (login, book list, or audio stream) before closing the deploy.

### Mobile OTA updates (EAS)
OTA updates are safe for **JavaScript-only changes**. Any change to native code, new native package, or `app.config.ts` config requires a full `eas build` and store submission — an OTA cannot update native binaries.

---

## Testing

### Rule: Every service MUST have unit tests

For every service file created or modified, a corresponding unit test file MUST be created or updated in the same task. No service is considered "done" without its tests passing.

### File structure and naming convention

All tests live under `tests/unit/` inside each service, mirroring `src/` exactly.

| Language | Source | Test |
|----------|--------|------|
| TypeScript | `src/books/books.service.ts` | `tests/unit/books/books.service.spec.ts` |
| Python | `templates/pinterest.py` | `tests/unit/templates/test_pinterest.py` |

Rule: replace `src/` with `tests/unit/`, suffix `.spec` (TS) or prefix `test_` (Python).

### Non-negotiable behaviors

- NEVER create a service file without also creating its corresponding test file under `tests/unit/` following the mirrored structure above.
- NEVER place test files inside `src/`, `/docs/`, or any other directory.
- Tests must cover: happy path, edge cases, and error/failure scenarios.
- Every public method in the service must have at least one test.
- Mock ALL external dependencies (databases, APIs, third-party clients). No test should touch a real database or make a real network call.
- Tests must be fully isolated — no shared state between test cases.

### Run commands per service

| Service     | Run tests                        | Run with coverage                          | Coverage threshold |
|-------------|----------------------------------|--------------------------------------------|--------------------|
| `api`       | `npm run test`                   | `npm run test:cov`                         | 80%                |
| `worker`    | `npm run test`                   | `npm run test:cov`                         | 80%                |
| `web`       | `npm run test`                   | `npm run test:cov`                         | 80%                |
| `mobile`    | `npm run test`                   | `npm run test -- --coverage`               | 80%                |
| `image-gen` | `pytest`                         | `pytest --cov=. --cov-report=term-missing` | 80%                |

### Before marking any task complete, verify

- [ ] A test file exists at the correct mirrored path under `tests/unit/`
- [ ] The test file name follows the naming convention for its language (`.spec.ts` / `test_*.py`)
- [ ] All tests pass with the run command above
- [ ] Coverage for the modified service is above 80%
- [ ] No test depends on a real database or external network call

---

## Voice & Style Guide

Guidelines for all user-facing copy — i18n strings, error messages, email templates, push notifications.

**i18n rule:** Always update all 4 files in the same PR:
`services/web/lib/i18n/{en,es}.ts` · `services/mobile/src/i18n/{en,es}.ts`

### Register and tone

- **"tú" form throughout** — `¿No tienes cuenta?`, `Inténtalo de nuevo.` — never formal "usted"
- **Warm and direct** — speak like a thoughtful peer, not a help desk
- App name in copy: always "Noetia" — never "la app" or "la plataforma"

### Copy patterns

| Context | Pattern | Example (ES) |
|---------|---------|--------------|
| Loading / submitting | verb + `…` (unicode, not `...`) | `Cargando…` · `Guardando…` · `Enviando…` |
| Success | affirmative past tense | `Email confirmado` · `Guardado` |
| Generic error | statement + action | `Algo salió mal. Inténtalo de nuevo.` |
| Validation error | specific + corrective hint | `La contraseña debe tener al menos 8 caracteres` |
| Destructive confirm | name the consequence | `¿Eliminar este fragmento? Esta acción no se puede deshacer.` |

Rules: sentence case on all labels (`Iniciar sesión`, not `Iniciar Sesión`); no `¡` or `!` in errors or loading states; no `"Error:"` prefix on messages.

### Canonical Spanish terms

| Concept | Use | Not |
|---------|-----|-----|
| User highlight | Fragmento | highlight, marcador, nota |
| User's book list | Biblioteca | librería, colección |
| Synchronized listening mode | Escucha Activa | (proper noun — always both words capitalized) |
| Reading clubs | Clubes de Lectura | clubs, círculos |
| Subscription credit | Token | crédito (renamed migration 038) |
| Active phrase | Frase | oración, cue |

---

## Reference Documents

All docs live in `docs/`. Engineering-relevant docs:

| Document | Purpose |
|----------|---------|
| [PRD.md](docs/PRD.md) | Product vision, feature specs, roadmap, KPIs |
| [TASKS.md](docs/TASKS.md) | Sprint tracker and active backlog |
| [sync-procedures.md](docs/sync-procedures.md) | Whisper pipeline, VTT steps, quality status table |
| [whisper-sync-troubleshooting.md](docs/whisper-sync-troubleshooting.md) | Root-cause diagnosis for books below 90% coverage |
| [database-migrations.md](docs/database-migrations.md) | Migration history (000–061), golden rules, run commands |
| [persona-pipeline.md](docs/persona-pipeline.md) | Event stream, theme tagging, persona computation, opt-out |
| [stripe-setup.md](docs/stripe-setup.md) | Stripe products, webhook registration, env vars |
| [upload-guide.md](docs/upload-guide.md) | Author file specs — text, audio, cover, SRT/VTT |
| [eas-build.md](docs/eas-build.md) | EAS build and OTA updates |
| [app-store-submission.md](docs/app-store-submission.md) | iOS and Android store submission steps |
| [grafana-monitoring.md](docs/grafana-monitoring.md) | Monitoring, Tailscale access, password reset |
| [incident-response.md](docs/incident-response.md) | Playbooks — Traefik 502, container unhealthy, DB, MinIO, SSL |
| [secrets-rotation.md](docs/secrets-rotation.md) | Which secrets need rotation and how |
| [business/](docs/business/) | Business plans, PM docs, technical architecture (EN + ES) |
| [store-listings/](docs/store-listings/) | App Store privacy labels, Google Play data safety |
