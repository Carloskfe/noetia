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
8. [Content Ingestion](#content-ingestion)
9. [Database Migrations](#database-migrations)
10. [Testing](#testing)

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

**Supporting services:** Supabase Auth or Auth.js (social login), Stripe (subscriptions)

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
│   │   │   ├── generate_book_covers.py   # Generates placeholder covers for 12 initial books
│   │   │   ├── generate_bg_presets.py    # Generates imagen-1..5 + upload-slot placeholders
│   │   │   └── generate_presets.py       # Font preview thumbnails for ShareModal
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

### Production — MinIO
| Variable | Production value | Notes |
|----------|-----------------|-------|
| `MINIO_ENDPOINT` | `storage` | Docker service name (same in prod) |
| `MINIO_PUBLIC_URL` | `https://storage.noetia.app` | Traefik exposes MinIO API at this subdomain |

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

**NEVER paste multi-line content via SSH terminal.** The server terminal wraps long lines and the shell misinterprets line-breaks as command separators, corrupting files. This caused a 2-hour outage on 2026-05-12.

**To write a file on the server, use one of:**
```bash
# Option 1 — nano (safest for multi-line content)
nano /opt/traefik/traefik.yml
# Ctrl+K to delete lines, paste content, Ctrl+O to save, Ctrl+X to exit

# Option 2 — single-line Python (no newlines in command)
python3 -c "open('/path/file','w').write('line1\nline2\n')"

# Option 3 — base64 (immune to space/newline corruption)
# Generate on local: python3 -c "import base64; print(base64.b64encode(open('file').read().encode()).decode())"
# Apply on server:
echo <BASE64> | base64 -d > /path/file
```

**Traefik config is at `/opt/traefik/traefik.yml`.** If it gets corrupted:
1. Use nano to restore it
2. Content must have exact 2-space YAML indentation
3. `docker restart traefik` after any change
4. If Traefik won't start: `docker logs traefik --tail 10` to see the YAML parse error, then `sed -i 's/^  //' /opt/traefik/traefik.yml` to strip accidental extra indentation

**Traefik 502/404 diagnosis checklist:**
- `docker ps` → are web and api containers `(healthy)`? If `(unhealthy)` → Traefik drops their routes
- `docker exec traefik wget -qO- http://<container_ip>:3000` → can Traefik reach the container?
- `docker inspect <container> --format "{{.State.Health.Status}}"` → check health
- `docker inspect <container> --format '{{range .State.Health.Log}}Exit={{.ExitCode}} Output={{.Output}}{{"\n"}}{{end}}'` → see healthcheck failures
- `docker network inspect proxy` → confirm container is on the proxy network

**Known container gotchas:**
- Next.js 14 standalone `server.js` reads `HOSTNAME` env var for bind address. Docker sets `HOSTNAME` to the container ID. Without `HOSTNAME: "0.0.0.0"` in compose, Next.js binds to only one network interface → Traefik 502.
- Alpine `busybox wget` resolves `localhost` to `::1` (IPv6). Healthchecks must use `127.0.0.1` not `localhost`. Using `localhost` marks container unhealthy → Traefik drops the route → 404.
- Fix for both is in `docker-compose.server.yml` (already applied). If containers are recreated, these fixes are preserved.

---

## Infrastructure & Vendors

All third-party services used in production. Credentials are in `.env.production` on the server — never committed.

### DNS & Domain management
| Service | Provider | Notes |
|---------|----------|-------|
| `noetia.app` | Cloudflare | DNS-only mode (gray cloud) — Traefik handles SSL |
| `storage.noetia.app` | Cloudflare | MinIO API subdomain — DNS-only |
| `www.noetia.app` | Cloudflare | Permanent redirect to apex via Traefik |

### Transactional email
| Property | Value |
|----------|-------|
| Provider | Resend (resend.com) |
| Plan | Free tier (3,000 emails/month, 100/day) |
| Sending domain | `noetia.app` (DKIM + SPF + DMARC verified in Cloudflare) |
| From address | `noreply@noetia.app` |
| SMTP relay | `smtp.resend.com:465` (TLS) |
| Used for | Email confirmation, password reset |

### Payments
| Property | Value |
|----------|-------|
| Provider | Stripe (stripe.com) |
| Status | Not yet configured for production — keys empty in `.env.production` |
| Webhook endpoint | `https://noetia.app/api/webhooks/stripe` |

### Error tracking
| Property | Value |
|----------|-------|
| Provider | Sentry (sentry.io) |
| Status | SDK installed, not yet activated — set `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` to enable |

### Search
| Property | Value |
|----------|-------|
| Provider | Meilisearch (self-hosted, v1.7) |
| Location | Running in Docker on the Contabo VPS |
| Access | Internal only (no external port) |

### File storage
| Property | Value |
|----------|-------|
| Provider | MinIO (self-hosted, S3-compatible) |
| Location | Running in Docker on the Contabo VPS |
| Public URL | `https://storage.noetia.app` |
| Console | SSH tunnel only: `ssh -p 222 -L 9001:localhost:9001 root@84.247.140.175` |
| Buckets | `books/` (private) · `audio/` (private) · `images/` (public download) |

### CI/CD
| Property | Value |
|----------|-------|
| Provider | GitHub Actions |
| Trigger | Push to `main` branch |
| Auth | `DEPLOY_SSH_KEY` secret in GitHub repo settings |
| Deploy key location | `/root/.ssh/deploy_key` on server |

---

## Adding a Whisper Sync Map for a Book

Use this procedure whenever you have Whisper-generated VTT files for a book that currently has no phrase timestamps (`syncSource = 'auto'`).

**If coverage comes back below 90% after following this procedure**, do not just re-run Whisper — see [`docs/whisper-sync-troubleshooting.md`](docs/whisper-sync-troubleshooting.md) for the full diagnostic decision tree (announcement noise, untrimmed front/back matter, scattered footnotes/illustrations, story-order mismatches in multi-piece collections, shared-text bugs across volumes, and genuine edition/translation mismatches). That doc also applies to books received directly from authors/publishers with their own narration, not just LibriVox re-syncs.

### Step 1 — Prepare individual chapter VTTs

Run Whisper on each LibriVox chapter audio file with word-level timestamps:

```bash
whisper chapter_01.mp3 --language es --word_timestamps True --output_format vtt
whisper chapter_02.mp3 --language es --word_timestamps True --output_format vtt
# repeat for all chapters
```

Name the output files so they sort in chapter order (e.g. `01_prologue.vtt`, `02_chapter.vtt`). The merge tool orders by the first integer it finds in each filename.

### Step 2 — Place VTTs in the transcriptions directory

```
transcriptions/
└── Book Title/           ← directory named exactly as the book title
    ├── 01_chapter.vtt
    ├── 02_chapter.vtt
    └── ...
```

### Step 3 — Merge into a single VTT

Run from the repo root on your local machine (requires ts-node):

```bash
npx ts-node services/api/src/ingestion/merge-transcriptions.ts \
  --dir "transcriptions/Book Title" \
  --out "transcriptions/book-slug.merged.vtt"
```

This stitches all chapter VTTs into one file with adjusted timestamps and a 2-second gap between chapters.

### Step 4 — Commit and push

```bash
git add transcriptions/
git commit -m "chore: add Whisper VTT for Book Title"
git push
```

### Step 5 — Copy to server and run sync

```bash
# On the server
cd /opt/noetia && git pull

# Copy VTT into the running api container
docker cp transcriptions/book-slug.merged.vtt noetia-api-1:/app/transcriptions/book-slug.merged.vtt

# Run the alignment
docker compose --env-file .env.production -f docker-compose.server.yml exec -T -e DB_HOST=db api \
  node dist/ingestion/seed-sync-whisper.js \
  --book "Book Title" \
  --transcript /app/transcriptions/book-slug.merged.vtt
```

The script prints an alignment summary (phrase count, avg confidence, low-confidence phrases to spot-check) and saves the sync map to the database with `syncSource = 'whisper'`.

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

Migrations live in `services/api/src/migrations/` and are named `<timestamp>-<Description>.ts`.

**Run pending migrations inside the API container:**
```bash
docker compose exec api npm run migration:run
```

**Current migration history:**

| # | Migration | Description |
|---|-----------|-------------|
| 000 | `CreateUsersTable` | users table with auth fields |
| 001 | `AddUserType` | userType enum (personal, author, editorial) |
| 002 | `AddUserPreferences` | country, languages, interests |
| 003 | `AddUpdatedAt` | updatedAt timestamp |
| 004 | `CreateBooksTable` | books with category, audio/text keys |
| 005 | `CreateSyncMapsAndProgress` | phrase sync maps + reading progress |
| 006 | `CreateFragments` | user highlights |
| 007 | `CreatePlansTable` | subscription plans |
| 008 | `AddStripeCustomerId` | stripeCustomerId on users |
| 009 | `CreateSubscriptions` | subscriptions + book_purchases |
| 010 | `SeedPlans` | Individual + Reader plan seed data |
| 011 | `MakeFragmentPhraseIndicesNullable` | |
| 012 | `AddFreeLibrary` | isFree flag on books |
| 013 | `AddAudioStreamKey` | audioStreamKey on books |
| 014 | `AddUploadedBy` | uploadedById foreign key |
| 015 | `CreateUserBooksTable` | user library ownership |
| 016 | `CreateCollectionsTable` | book collections/series |
| 017 | `AddBookPriceCents` | per-title price in cents |
| 018 | `AddUserBookPurchaseType` | purchase vs credit redemption |
| 019 | `AddSubscriptionCredits` | creditBalance on subscriptions |
| 020 | `AddPlanCreditsPerCycle` | creditsPerCycle on plans |
| 021 | `AddHostingTier` | hostingTier enum on users |
| 022 | `AddBookAnalytics` | shareCount on books |
| 023 | `AddEmailConfirmed` | emailConfirmed boolean (default true for existing users; new local registrations start false) |
| 024 | `AddBookCollection` | collection varchar on books; auto-seeds Bible books with collection='Biblia' |
| 025 | `SeedCollectionsFromBookField` | Populates collections table from existing books.collection values |
| 026 | `FixCollectionsAndCovers` | Corrects collection slugs and adds themed cover URLs |
| 027 | `FixCollectionDataFinal` | Normalizes empty string → NULL, canonical Bible order, excludes Blasco Ibáñez |
| 028 | `UpdateThemedCoverUrls` | Sets /covers/*.png paths for 10 books + 2 collections |
| 029 | `LiteraturaInfantilCoverUrls` | Cover URLs for Literatura Infantil books (superseded by migration 030) |
| 030 | `CleanupLiteraturaInfantil` | Removes La Edad de Oro and Literatura Infantil collection; Pombo/Quiroga → standalone |
| 031 | `FixCuentosSelvaLanguage` | Deletes English Gutenberg text; re-ingested from Spanish Wikisource |
| 032 | `AddMissingIndexes` | idx_books_published_free, idx_books_collection, idx_books_category, idx_books_uploaded_by, idx_subscriptions_plan |
| 033 | `AddSyncSource` | syncSource VARCHAR on sync_maps ('auto'\|'srt'\|'vtt'\|'manual') |
| 034 | `CreateUploadCodes` | upload_codes table — admin-issued single-use courtesy upload codes |
| 035 | `CreateWaitlist` | waitlist_entries table — email, name, isAuthor, invitedAt |
| 036 | `CreateCausesAndPreferences` | causes table (3 seeded) + user_cause_preferences (up to 2 causes per user) |
| 037 | `RenameCausaToMedioAmbiente` | Renames "Conservación Ambiental" → "Medio Ambiente" in causes table |
| 038 | `RenameCreditsToTokens` | creditsRemaining → tokenBalance on subscriptions; creditsPerCycle → tokensPerCycle on plans |
| 039 | `RestructurePlansAndTokenPackages` | Plans: Individual $8.99, Duo $13.99, Family $18.99 (monthly+annual); token_packages table seeded (1/3/5/10 tokens) |
| 040 | `CreateTokenLedgerAndCourtesy` | token_ledger (90-day paid, 30-day promo/courtesy, FIFO redemption); courtesy_token_quotas; books.narratorId; subscriptions.linkedUserIds + nextTokenIssuanceAt |
| 041 | `UpdateStripeProductIds` | Sets real Stripe price IDs on plans and token_packages from env vars |
| 042 | `CreateSubscriptionInvites` | subscription_invites table for Duo/Family plan invite flow |
| 043 | `CreateGiftCards` | gift_cards table — token gifts with personal message, 1-year expiry |
| 044 | `AddUiLanguage` | uiLanguage VARCHAR(5) DEFAULT 'es' on users — Spanish/English i18n |
| 045 | `CreatePushTokens` | push_tokens table — Expo push tokens per user for notifications |
| 046 | `CreateClubs` | clubs table — name, description, type (public/private/author_event), owner, approval/token flags |
| 047 | `CreateClubMembers` | club_members — role, status (active/banned), ban tracking, per-member notification prefs |
| 048 | `CreateClubBooks` | club_books — reading list per club, status (active/completed/queued) |
| 049 | `CreateClubMessages` | club_messages — general chat (not phrase-anchored), soft delete |
| 050 | `CreateClubDiscussions` | club_discussions — phrase-anchored comments tied to sync map phraseIndex |
| 051 | `CreateClubPollsAndVotes` | club_polls + club_poll_options + club_poll_votes — book nomination voting |
| 052 | `CreateClubSessions` | club_sessions — Escucha Juntos scheduled live listening sessions |
| 053 | `AddPrivacySettings` | shareReadingProgress/Library/Profile/Fragments booleans on users |
| 054 | `CreateReadingStats` | reading_stats table — daily minutesRead + phrasesRead per user, unique (userId, date) |
| 055 | `AddReadingGoals` | goalWeeklyMinutes + goalWeeklyBooks nullable integers on users |
| 056 | `AddSyncCoverage` | syncCoverage (float), syncExceptions (int), syncAvgConfidence (float) on sync_maps — persists Whisper alignment quality |
| 057 | `CreateEventsTable` | append-only events table (userId, bookId, eventType VARCHAR(50), payload JSONB, createdAt); indexes on user_id, book_id, event_type, created_at, (user_id, event_type) |
| 058 | `AddFragmentThemes` | themes JSONB column on fragments — auto-tagged at creation with up to 3 thematic labels from the 20-theme Spanish taxonomy |
| 059 | `CreateUserPersonas` | user_personas table — dominantThemes, engagementArchetype, readingCadence, completionRate, socialAmplification, preferredPlatforms, topGenres, avgSessionMinutes, computedAt; indexes on archetype, cadence, computed_at |
| 060 | `AddAllowInsights` | allowInsights BOOLEAN DEFAULT TRUE on users — opt-out of reader persona computation and aggregate audience analysis. **Bug:** raw SQL added `allow_insights` (snake_case) instead of the entity's camelCase `allowInsights`, breaking every query that loads a `User` row (login, OAuth, password reset) until migration 061 |
| 061 | `FixAllowInsightsColumnName` | Renames `users.allow_insights` → `"allowInsights"` to match the `User` entity column |

---

## Sync Quality Status (audited 2026-06-24)

**Standard:** Whisper syncCoverage ≥ **90%** (raised from 85% on 2026-06-24 — see [`docs/whisper-sync-troubleshooting.md` § Why 90%](docs/whisper-sync-troubleshooting.md#why-90)). Books below this threshold have audio/text mismatches that produce broken phrase highlighting for readers. Books on `auto` sync are readable but have no phrase-level synchronization.

**Before re-syncing any book below threshold, read [`docs/whisper-sync-troubleshooting.md`](docs/whisper-sync-troubleshooting.md) first.** It's a living document — append every newly-discovered, validated bug/fix to it as you find them, not just at the end of a session. "Edition mismatch" was the only documented root cause as of 2026-06-04; as of 2026-06-24 there are at least 5 distinct root-cause categories (announcement noise, untrimmed front/back matter, scattered footnotes/illustrations, story-order mismatches in multi-piece collections, shared-text bugs across sibling volumes) — most below-threshold books are NOT genuine edition mismatches and have a real fix available.

### Spanish (40 books total)

| Status | Count | Books |
|--------|-------|-------|
| Whisper ≥ 90% ✅ | 8 | Marianela 99.8%, Romeo y Julieta 99.1%, Don Juan Tenorio 98.6%, Cuentos de Amor 98.0%, **Cuentos de la Selva 100.0%** (fixed 2026-06-24 — story-order mismatch, §7), **Lazarillo de Tormes 100.0%** (fixed 2026-06-25 — Wikisource subpages named with spelled-out ordinals "Tratado primero/segundo/cuarto..." were sorted alphabetically, completely scrambled; the 2026-05-29 "ASR errors" diagnosis was wrong, §7), **Platero y yo 98.2%** (fixed 2026-06-25 — missing "Grabado por" reader-credit pattern + untrimmed back-matter ÍNDICE, §2/§3), **Pepita Jiménez 96.8%** (fixed 2026-06-24 — missing announcement patterns "sección"/reader-credit, §2) |
| Whisper < 90% ❌ | 16 | El Gaucho Martín Fierro 82.4% (up from 55.4% 2026-06-25 — standalone stanza numbers "392" glued onto the next sentence, §4), Leyendas 80.6% (up from 58.8% — story-order mismatch + 5 unmatched chapters excluded, §7), Niebla 88.0%, Fábulas y Verdades 85.3% (re-audit under new threshold — was passing at 85%; unresolved 16-section-vs-11-fable count mismatch, §7), Salmos 81.0% (flat — likely the same standalone-verse-number issue as Martín Fierro, not yet confirmed, §4), Los Cuatro Jinetes 76.4% (confirmed edition mismatch, §6), El Sombrero de Tres Picos 75.2% (up from 70.6% — "Capítulo+Roman" sort fix + misplaced "Prefacio" now positioned correctly, §7; modest gain only, remaining gap unexplained), Doña Perfecta 71.6% (up from 69.0% — bare Roman-numeral sort fix, §7; modest gain, remaining gap unexplained), Crimen y Castigo 72.9% (front/back-matter + footnote trim applied, no improvement — **translator confirmed matching exactly** "Pedro Pedraza y Páez", ruling out §6; remaining gap unexplained), Orgullo y Prejuicio 64.4% (Roman-numeral sort fix confirmed correct against the live API — **flat, no improvement**, root cause still unexplained, §7), Viaje al Centro 67.5% (**confirmed §6 edition mismatch with direct evidence** — Wikisource text says "traducción de Anónimo", LibriVox credits "traducido por Antonio Ribot y Fonseré"), La Divina Comedia 66.0% (front/back-matter trim applied, up from 56.0% — still needs more), Don Quijote Vol. II 56.4%, Don Quijote Vol. I 54.4% (**both capped near 50% by a shared-`gutenbergId: 2000` text bug, §8 — not yet fixed**), La Odisea 60.6% (up from 58.6% — **CRLF bug found**: a ~276,000-char, 1700-entry glossary had been silently attached to the stored text the whole time; fixed, but only modest gain), La Isla del Tesoro 55.4% (Roman-numeral sort fix confirmed correct against the live API — **flat, no improvement**; translator confirmed matching "Manuel Caballero", ruling out §6; root cause still unexplained) |
| Auto sync only | 16 | 16 Bible books (ES) |

**Root cause varies — see `docs/whisper-sync-troubleshooting.md` for the per-book diagnostic process.** Do not assume "edition mismatch" without first confirming front/back matter and scattered noise are clean (§3-5) and checking for story-order/shared-text bugs (§7-8) — most of the books above were re-tested on 2026-06-24 and several have a known, documented next step rather than being a dead end.

### English (31 books total)

30 of 31 English books are on `auto` sync — no Whisper VTTs run. **Meditations**: 45.1% coverage (up from 42.6% 2026-06-24 — found and fixed a CRLF bug identical to La Odisea's: `narrativeEndPattern: '\nAPPENDIX\n'` never matched the real `\r\n` source, leaving the back-of-book correspondence appendix attached; also wouldn't have been safe even with CRLF fixed, since "APPENDIX" appears in a front-of-book table of contents first — anchored on the real closing sentence of Book Twelve instead). Confidence stuck flat at 25% even after the fix — likely a translation mismatch (Gutenberg #2680 is George Long's specific translation; not yet checked against what the LibriVox reader used). **Walden**'s identical CRLF bug was also found and fixed proactively, before it's ever been Whisper-attempted. Priority for next Whisper run: Jane Eyre (39 sections).

---

## Reader Persona Pipeline

Noetia builds a **derived reader profile** (persona) from behavioral signals. The pipeline has three layers:

### Layer 1 — Event stream (`events` table)
Append-only event log. Two event types are currently captured:
- `fragment_created` → `{ fragmentId, themes, textLength }` — emitted in `FragmentsService.create()`
- `fragment_shared` → `{ fragmentId, platform, format, themes }` — emitted in `SharingController.share()`

Events are fire-and-forget — errors are logged but never propagate to the user request.

### Layer 2 — Fragment theme tagging
`FragmentTaggerService` applies a **20-theme Spanish taxonomy** (`src/fragments/theme-taxonomy.ts`) at fragment creation time. Matching is case-insensitive keyword scoring; up to 3 themes are stored as JSONB on the fragment row.

Themes: `amor · aventura · belleza · conocimiento · destino · familia · fe · filosofia · heroismo · humanidad · identidad · justicia · libertad · muerte · naturaleza · poder · sufrimiento · tiempo · amistad · espiritualidad`

### Layer 3 — Persona computation (`user_personas` table)
`PersonaComputerService` runs 8 parallel SQL aggregations per user and upserts the result:

| Field | Source | Logic |
|-------|--------|-------|
| `dominantThemes` | `fragments.themes` | Top 5 by frequency |
| `engagementArchetype` | fragments + events + clubs | `social_sharer > community > deep_reader > browser > reader` |
| `readingCadence` | `reading_stats` (60-day window) | `daily (≥40 days) > weekend (ratio ≥0.6) > binge (≤10 days, ≥45 min avg) > irregular` |
| `completionRate` | `reading_progress` + `sync_maps` | books at phraseIndex ≥ 80% / total started |
| `socialAmplification` | `events` | `fragment_shared` / `fragment_created` |
| `preferredPlatforms` | `events` | Top 4 platforms by `fragment_shared` count |
| `topGenres` | `fragments` + `books` | Top 3 book categories by fragment count |
| `avgSessionMinutes` | `reading_stats` | Average minutesRead on active days (60-day window) |

**Nightly cron:** `@Cron(EVERY_DAY_AT_2AM)` — skips users with `allowInsights = FALSE`.

**Admin endpoints:**
- `POST /api/admin/personas/recompute` — trigger full recompute for all opted-in users
- `POST /api/admin/personas/:userId/recompute` — recompute a single user
- `GET /api/admin/personas/:userId` — inspect a user's current persona

**Opt-out:** Users can disable persona computation from **Profile → Privacy → Contribute to Noetia Insights**. Opted-out users are excluded from `computeAll()` and their existing persona row will not be refreshed.

---

## Testing

### Rule: Every service MUST have unit tests

For every service file created or modified, a corresponding unit test file MUST be created or updated in the same task. No service is considered "done" without its tests passing.

### File structure — Mirrored `tests/unit/` directory

All unit tests live under `tests/unit/` inside each service and MUST mirror the structure of `src/` exactly.

```
services/api/
├── src/
│   ├── auth/
│   │   └── auth.service.ts
│   └── email/
│       └── email.service.ts
└── tests/
    └── unit/
        ├── auth/
        │   ├── auth.service.spec.ts
        │   ├── email.service.spec.ts   ← mirrors src/email/
        │   └── token.service.spec.ts
        └── social/
            ├── social.controller.spec.ts
            └── social-token.service.spec.ts

services/image-gen/
├── templates/
│   └── pinterest.py
└── tests/
    └── unit/
        └── templates/
            └── test_pinterest.py
```

### Naming convention — per language

**TypeScript (api, worker, web, mobile):**
- Source:  `src/books/books.service.ts`
- Test:    `tests/unit/books/books.service.spec.ts`

The rule: **take the source path, replace `src/` with `tests/unit/`, and suffix the filename with `.spec`.**

**Python (image-gen):**
- Source:  `templates/pinterest.py`
- Test:    `tests/unit/templates/test_pinterest.py`

The rule: **take the source path, prepend `tests/unit/` to the directory, and prefix the filename with `test_`.**

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
