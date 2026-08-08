# Noetia — Technical Baseline

> **Mission NEM-001 — Repository Archaeology & Technical Baseline**
> Prepared by the Repository Archaeologist for the Product Architecture Team.
> Purpose: allow the team to understand the entire current platform **without reading source code**.

This baseline is **descriptive, not prescriptive**. Nothing here redesigns, refactors, or proposes implementation. It documents what exists, as of the analysis date, with the source code as the single source of truth.

## Source of truth

The **code wins**. Where documentation (CLAUDE.md, docs/) conflicts with source, this baseline follows the source and flags the conflict.

## Labeling standard

Every material statement carries one label:

| Label | Meaning |
|-------|---------|
| **CONFIRMED** | Verified directly from source code. |
| **INFERRED** | High-confidence conclusion, not explicitly stated in code. |
| **UNKNOWN** | Cannot be confirmed from what was analyzed. |
| **OUT OF SCOPE** | Deliberately not analyzed. |

## Document index

| # | Document | Covers |
|---|----------|--------|
| — | [EXECUTIVE_SUMMARY.md](EXECUTIVE_SUMMARY.md) | ≤5-page summary for CEO / CPO / Lead Architect / Lead Engineer |
| 01 | [01-repository.md](01-repository.md) | Monorepo layout, packages, tooling |
| 02 | [02-architecture.md](02-architecture.md) | Services, runtime topology, deployment |
| 03 | [03-domain-model.md](03-domain-model.md) | Business entities, relationships, lifecycles |
| 04 | [04-database.md](04-database.md) | PostgreSQL schema, migrations, tables |
| 05 | [05-api.md](05-api.md) | REST surface, modules, controllers |
| 06 | [06-reader.md](06-reader.md) | Reader, Escucha Activa, sync, offline |
| 07 | [07-authentication.md](07-authentication.md) | JWT, refresh, OAuth, guards |
| 08 | [08-subscriptions.md](08-subscriptions.md) | Stripe, plans, webhooks, billing |
| 09 | [09-token-economy.md](09-token-economy.md) | Tokens, ledger, gifts, courtesy quotas |
| 10 | [10-search.md](10-search.md) | Meilisearch index & pipeline |
| 11 | [11-storage.md](11-storage.md) | MinIO object storage |
| 12 | [12-author-system.md](12-author-system.md) | Author/publisher upload & catalog |
| 13 | [13-admin-system.md](13-admin-system.md) | Admin capabilities |
| 14 | [14-mobile.md](14-mobile.md) | React Native app & offline |
| 15 | [15-analytics.md](15-analytics.md) | Events, personas, stats |
| 16 | [16-security.md](16-security.md) | Security posture |
| 17 | [17-observability.md](17-observability.md) | Metrics, logging, monitoring |
| 18 | [18-testing.md](18-testing.md) | Test suites & CI gates |
| 19 | [19-technical-debt.md](19-technical-debt.md) | Prioritized debt register |
| 20 | [20-opportunities.md](20-opportunities.md) | Latent capabilities |
| 21 | [21-noetia-plus-readiness.md](21-noetia-plus-readiness.md) | Readiness assessment for Noetia+ |

## Method & coverage

- Analysis was performed by direct inspection of the repository (`services/{api,web,mobile,worker,image-gen}`, `infra/`, `docs/`, `.github/`, `docker-compose*.yml`).
- Entity schemas, module/controller inventories, migration list, guards, Stripe webhook handlers, search/storage services, and CI config were read directly (**CONFIRMED**).
- Deep line-by-line reading of every service method was **not** exhaustive; behavioral claims not directly read are marked **INFERRED** or **UNKNOWN**.
- No source code was modified; no migrations were created; no commits were made.

## Constraint compliance

No secrets, API keys, passwords, private keys, production credentials, environment-variable *values*, customer PII, or payment secrets appear in this baseline. Environment variables are referenced by **name** only.
