# Security & Privacy Framework

**v0.1** · NOF-001 · Consolidated principles. **No regulatory compliance is claimed** —
no GDPR, CCPA, COPPA, or equivalent assessment appears in the corpus, and none is asserted
here. `PRIVACY REVIEW REQUIRED` before any compliance claim is made publicly.

---

## Principles

### Environments never share data stores
Production and staging are structurally isolated: separate database, object store, cache,
search, network, and credentials. Tooling that writes must **fail closed** — the NEM-006C
seeder refuses to run unless `APP_ENV`, `DB_NAME`, and `MINIO_PUBLIC_URL` independently
agree it is staging. A single environment variable is never sufficient proof of
destination.

### No production PII leaves production
Staging defaults to **synthetic data**. Production-derived data is permitted only after
sanitization, never as a raw copy. Categories requiring removal or transformation are
enumerated in [`staging/data-and-sanitization.md`](../staging/data-and-sanitization.md):
names, emails, OAuth identities, password hashes, refresh tokens, payment identifiers,
notes, private fragments and clubs, invite/claim/reset tokens, API credentials, and
personal analytics.

Catalog content is **not** PII — NEM-006C mirrors public-domain audio while copying no user
data.

### Secrets are never committed
`.env.production` and `.env.staging` are gitignored and live only on the host. Rotation
policy: [`secrets-rotation.md`](../secrets-rotation.md).

### Never log credentials or PII
No JWT payloads, passwords, raw tokens, or user PII in logs. API errors surface as
`HttpException` with safe messages — never raw database output or stack traces.

### Payment integrity
Stripe webhooks verify the `stripe-signature` header before processing, with idempotency
on event handling (NEM-002 remediation). Staging uses **test-mode keys only**.

### Least exposure at the edge
Internal services bind no host ports — PostgreSQL, Redis, Meilisearch, and Grafana are
reachable only inside Docker or over Tailscale/SSH tunnel. MinIO serves `books/` and
`audio/` **privately** via presigned URLs; only `images/` is public. SSH runs on a
non-default port behind UFW.

### Staging is not public
Basic auth gates the staging web surface. The API sits behind JWT exactly as production
does — a deliberate, recorded trade: HTTP Basic and Bearer share the `Authorization`
header, so gating both made login impossible.

## Authentication and authorization

| Layer | Mechanism |
|---|---|
| Identity | Email/password + Google, Facebook, Apple OAuth |
| Session | JWT access (15 min) + rotating refresh token |
| Email verification | Confirmation tokens; `EmailConfirmedGuard` on subscriptions and gifts |
| Admin | Role-gated routes — inventory in [`production-safety/04-admin-authorization.md`](../production-safety/04-admin-authorization.md) |
| Social publishing | Per-platform OAuth tokens, AES-256-CBC encrypted in Redis |

Refresh-token **rotation** is implemented with de-duplicated concurrent refresh — a
correctness property, not just a performance one: without it, parallel requests invalidate
each other's tokens and eject the user.

## Content protection

DRM considerations for book text and audio are specified in [`PRD.md`](../PRD.md) §Security
& DRM. Private buckets plus time-bounded presigned URLs are the enforcement mechanism.

AI-side protection is governed separately by PO-002 — permission before retrieval, no
training on licensed content, anti-reconstruction safeguards.

## User privacy controls

**IMPLEMENTED** — four privacy toggles with optimistic update; persona computation has an
explicit opt-out ([`persona-pipeline.md`](../persona-pipeline.md)). Store-facing
declarations exist for both platforms
([Apple](../store-listings/apple-app-privacy.md) ·
[Google Play](../store-listings/google-play-data-safety.md)).

## AI-provider data handling

**DECIDED (PO-005 / ADR-002):** paid/commercial API tiers; **no voluntary training or
data-sharing opt-in**; licensed content never trains a general-purpose model without
explicit authorization.

## Open

| Gap | Note |
|---|---|
| **Regulatory posture** | No GDPR/CCPA/other assessment exists. Do not claim compliance → `PRIVACY REVIEW REQUIRED` |
| **Data retention / deletion** | No policy found for account deletion, data export, or retention windows |
| **Backup security** | No documented backup procedure → see [11-operations-handbook](11-operations-handbook.md) |
| **Incident disclosure** | Technical playbooks exist; no user-notification policy |

These are recorded as absences, not drafted as policy.
