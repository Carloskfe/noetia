# Architecture Framework

**v0.1** · NOF-001 · The durable architectural philosophy. **This does not duplicate the
technical baseline** — [`docs/technical-baseline/`](../technical-baseline/README.md) (23
documents) remains authoritative for what the system *is*. This records what should stay
true as it changes.

---

## Philosophy

### Additive migrations, never destructive edits
Every schema change goes through a migration. **A deployed migration is never edited** —
TypeORM checksums each file, so editing a shipped one breaks `migration:run` everywhere.
Corrections are new migrations (the 060 → 061 pattern). Seed migrations are idempotent.

### Production data is protected by default
`SELECT COUNT(*)` before destructive statements; transactions for multi-table work;
snapshots before schema-destructive migrations or infrastructure changes. Protected
systems — Escucha Activa, ownership, production data, business-rule engines — require
explicit authorization to touch.

### Staging before production
A permanent staging environment (NEM-006A) validates migrations, infrastructure, and
product behavior first. Isolation is structural, not procedural: separate project,
volumes, network, database, and object store, with a fail-closed guard on any tooling that
writes.

### Provider abstraction over provider dependency
No external provider is permanently load-bearing. AI providers route behind a gateway
(ADR-001); pgvector sits behind a mandatory Semantic Retrieval Interface (ADR-004). The
pattern: **the interface is the commitment, the implementation is a choice.**

### Configuration over hard-coding
Prices, models, thresholds, and feature flags are configuration. COGS bands are explicitly
"not hard-coded into product behavior unless a future mission authorizes it."

Where this has been violated it shows: the ≥90% catalog quality gate is product policy
living in a service class (CODE-04).

### Rollback is a design property
Traefik changes are additive (new routers); staging teardown removes only staging;
migrations are forward-only with corrective follow-ups. Mobile OTA covers JS-only changes —
native changes require a full build, which is a **release** decision, not a hotfix.

### Recoverability is a design property, not an operational afterthought
State must be classifiable as canonical or reconstructable, and the reconstructable path must
be real. Two decisions already pay for themselves: the **VTT corpus lives in Git**, keeping
sync-map recovery at minutes rather than days of GPU work; and **Meilisearch is rebuildable
from PostgreSQL**, demonstrated in NEM-006C. Conversely, **object keys derived from title
slugs** make an object store portable across databases. See [resilience/](resilience/README.md).

### Observability is not optional
Prometheus, Grafana, cAdvisor, node-exporter, and Sentry are deployed. Health checks gate
Traefik routing — an unhealthy container is removed from the route rather than serving
errors.

## Boundaries

```
mobile (RN) ─┐
              ├─→ API (NestJS) ─┬─→ PostgreSQL   system of record + semantic store
web (Next) ──┘   business logic ├─→ Redis        sessions, sync state, job queues
                                 ├─→ MinIO        books, audio, images
                                 ├─→ Meilisearch  lexical search
                                 └─→ worker       async jobs (BullMQ)
                                     image-gen    quote-card rendering
```

| Component | Responsibility | Never |
|---|---|---|
| **PostgreSQL** | System of record: app data, ownership, permissions, semantic chunks, embeddings, provenance | — |
| **Redis** | Ephemeral state, queues, encrypted social tokens | System of record |
| **MinIO** | Large binary content. `books/` + `audio/` **private**, `images/` public | Serve private content unsigned |
| **Meilisearch** | Lexical/full-text | Authoritative vector store (ADR-004) |
| **worker / image-gen** | Async and CPU-bound work | Own business rules |

**API is the only writer of business state.** Web and mobile are clients; ingestion scripts
run inside the api container with its DI and entities rather than reimplementing rules.

## Web and mobile

Shared API, separate presentation. Web SSR reaches the API over the internal Docker
network; browsers use the public URL. **`NEXT_PUBLIC_*` are inlined at build time** — an
environment-specific bundle must be built with environment-specific build args, a lesson
learned when a staging build would otherwise have written to production data.

Mobile keeps its own reader screen and i18n strings; shared copy stays in lockstep across
platforms, platform-specific surfaces stay local.

## Durability rules with teeth

1. Never edit a deployed migration.
2. Never point a non-production environment at production data stores.
3. Never let an interface leak its implementation (pgvector, AI providers).
4. Never hard-code a business rule that policy may revise.
5. Never serve a title the platform cannot deliver cleanly (≥90% gate).

## Related

[`technical-baseline/`](../technical-baseline/README.md) · [ADRs](../architecture/adr/README.md) ·
[`database-migrations.md`](../database-migrations.md) · [11-operations-handbook](11-operations-handbook.md)
