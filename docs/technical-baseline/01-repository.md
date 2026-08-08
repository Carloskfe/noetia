# 01 — Repository

## Repository style — CONFIRMED

- **pnpm monorepo** (`pnpm-workspace.yaml`, `pnpm-lock.yaml`, root `package.json`). Workspace filter names use the `@noetia/<service>` convention (**CONFIRMED** from `.github/workflows/ci.yml`, e.g. `pnpm --filter @noetia/api`).
- Shared tooling at root: `tsconfig.base.json`, `.eslintrc.base.js`, `.prettierrc`.
- Not a greenfield project — production platform with live users, data, payments, subscriptions, and content.

## Top-level layout — CONFIRMED

```
/
├── services/            # all deployable units
│   ├── api/             # NestJS backend
│   ├── web/             # Next.js web app
│   ├── mobile/          # React Native (Expo) app
│   ├── worker/          # BullMQ async job processor
│   └── image-gen/       # Python (Flask) image service
├── infra/               # postgres init, redis conf, minio bucket setup, server bootstrap, traefik
├── nginx/               # dev reverse-proxy config
├── docs/                # PRD, TASKS, sync/migration/incident/monitoring docs
├── scripts/             # ops + sync/whisper tooling (bash/python/ts)
├── transcriptions/      # committed Whisper VTT files (per book)
├── openspec/            # OpenSpec change/spec workflow directory
├── reports/             # generated reports (e.g. load test)
├── docker-compose.yml            # local dev
├── docker-compose.prod.yml       # resource-limits overlay
├── docker-compose.server.yml     # production standalone deploy (Traefik)
├── .env / .env.example           # env templates
└── CLAUDE.md                     # developer guide (project instructions)
```

## Services / packages — CONFIRMED

| Package | Language / framework | Role |
|---------|----------------------|------|
| `services/api` | NestJS (Node.js, TypeScript) | REST API, business logic, WebSocket gateway, migrations, ingestion CLIs |
| `services/web` | Next.js (React, TypeScript) | Web reader + library + dashboards + public pages |
| `services/mobile` | React Native (Expo/EAS, TypeScript) | iOS/Android app, offline sync |
| `services/worker` | Node.js (BullMQ) | Async jobs: image render, share export |
| `services/image-gen` | Python (Flask, Pillow) | Quote-card rendering + chapter-alignment helper |

## API module inventory (bounded contexts) — CONFIRMED

`services/api/src` contains 24 feature modules plus infrastructure:

```
auth        authors     books       causes      clubs       codes
email       events      fragments   gifts       health      ingestion
library     metrics     personas    push        search      sharing
social      stats       storage     subscriptions  users     waitlist
```

Infrastructure files: `app.module.ts`, `main.ts`, `data-source.ts` (TypeORM CLI datasource), `instrument.ts` (Sentry init), `migrations/`, `types/`.

## Architecture style — INFERRED

- **Modular monolith** on the backend: one deployable NestJS process organized into feature modules (each with controller/service/entities/DTOs). Not microservices. **INFERRED** from single `app.module.ts` importing all feature modules into one process.
- **Separate deployable frontends** (web, mobile) and two small out-of-process helpers (`worker`, `image-gen`) — a "monolith + satellites" topology. **INFERRED**.
- Bounded contexts are expressed as NestJS modules; cross-module access is via injected services (e.g. `EventsService`, `StorageService` are shared). **CONFIRMED** (shared modules exist).

## Reusable / shared libraries — CONFIRMED

- **No shared internal npm package** (`packages/` directory does not exist). Cross-service reuse is by convention, not a shared library.
- Within `api`, `StorageModule`, `EmailModule`, `EventsModule`, and `search` (`MEILI_INDEX` provider) are imported by multiple feature modules — de-facto shared infrastructure.
- Within `web`, `lib/` holds shared client utilities (`api.ts`, `reader-utils.ts`, `share-utils.ts`, `i18n/`, `billing-utils.ts`, etc.).

## Tooling — CONFIRMED

- **TypeScript** across api/web/mobile/worker; **Python** for image-gen.
- **ESLint + Prettier** (root base configs).
- **Jest** for TS unit tests; **pytest** for Python; **Playwright** present in web deps (E2E). 
- **TypeORM** migrations (66 files, see [04-database.md](04-database.md)).
- CI/CD via **GitHub Actions** (see [02-architecture.md](02-architecture.md)).

## Notable repository observations — CONFIRMED

- `prueba.txt` (7 bytes) and `reports/` are committed artifacts unrelated to runtime.
- `transcriptions/` holds ~80 committed `*.merged.vtt` files (sync inputs), tracked in git.
- `openspec/` indicates an OpenSpec-based change workflow is (or was) in use.
- `node_modules/` appears present at root in the working tree (installed dependencies), which is normal for a working checkout.
