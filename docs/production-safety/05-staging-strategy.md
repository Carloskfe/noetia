# 05 — Staging Strategy (Design Only)

**Status: DESIGN. Not implemented.** This documents options and a recommendation so the team can decide; no infrastructure or CI changes are made here.

## Problem being solved — CONFIRMED
Today every push to `main` triggers `cd.yml` to rebuild and redeploy **production** (`docker compose … up -d --build` + migrations), with a brief API-down window and `/app/transcriptions` wiped each deploy. There is **no pre-production environment** — docs commits and code commits both bounce prod, and nothing is validated against a prod-like stack before users see it. This is the highest-leverage release-safety gap.

## Design constraints — CONFIRMED (from current infra)
- Single Contabo VPS, Docker Compose, Traefik v2.11 + Let's Encrypt, Cloudflare DNS.
- CD is SSH-based from GitHub Actions; compose files: `docker-compose.yml` (dev), `docker-compose.server.yml` (prod), `docker-compose.prod.yml` (limits overlay).
- Prod memory footprint is a few GB (sized for a small VPS).

## Options

### Option A — Separate small staging VPS (recommended)
- A second, cheaper VPS runs the full stack via a `docker-compose.staging.yml` at `staging.noetia.app`.
- **Isolation:** total — separate DB, Redis, MinIO, Meili, and its own resource envelope. A staging mistake can never touch prod data or prod uptime.
- **Cost:** one additional small instance.
- **CD:** a `staging` branch deploys to the staging host; `main` deploys to prod. Promotion = merge `staging → main`.

### Option B — Same host, second compose project (budget)
- Run a second compose project on the prod VPS (`-p noetia-staging`) with separate volumes/ports and a `staging.noetia.app` Traefik router.
- **Isolation:** logical only — shares CPU/RAM/disk with prod (resource contention + shared blast radius for host-level failures). Separate DB/volumes are mandatory.
- **Cost:** none beyond existing box (but competes for the ~24 GB host).
- **Risk:** an OOM or disk-fill in staging can degrade prod. Acceptable as an interim step, not a durable answer.

### Option C — Ephemeral per-PR previews (heaviest)
- Spin up a stack per PR (cloud/containers), tear down on merge.
- **Isolation:** excellent, but the most infra/CI work and cost; overkill for current team size. Note only.

## Recommendation — INFERRED
**Option A (separate small staging VPS) with a `staging` branch gate.** Rationale: real data/uptime isolation is the whole point of staging, and Option B's shared-host contention undermines that on a single small box. If budget forbids a second instance short-term, **Option B is an acceptable bridge** provided staging uses entirely separate DB/MinIO/volumes and is memory-capped so it cannot starve prod.

## Non-negotiables for whichever option — INFERRED (safety)
1. **Never point staging at production data stores.** Separate Postgres + MinIO. Seed staging from a **sanitized** dump (PII scrubbed) or the ingestion seeders — never a raw copy of prod PII.
2. **Stripe in TEST mode on staging** (test keys + a test-mode webhook endpoint) — staging must never touch live billing.
3. **Separate secrets** (`.env.staging`), separate OAuth callback URLs (`staging.noetia.app`), separate Sentry environment tag.
4. **Robots-noindex / auth wall** on staging so it isn't publicly indexed.
5. **CD change:** split the single `main → prod` trigger into `staging → staging` and `main → prod`, with prod promotion being a deliberate merge (optionally a manual approval gate in Actions).

## Migration/rollback interplay — CONFIRMED relevance
Staging is where migrations get validated before prod (the current "migrations run straight on prod after deploy" flow has no dry run). This directly de-risks the schema-change path.

## Out of scope for NEM-002
Provisioning, `docker-compose.staging.yml`, DNS, CI edits, and data-sanitization scripts are **implementation** — deferred until the team approves an option.
