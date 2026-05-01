## 1. Root Workspace

- [x] 1.1 Create `pnpm-workspace.yaml` declaring `services/api`, `services/web`, `services/worker`
- [x] 1.2 Create root `package.json` with shared dev deps: TypeScript, ESLint, Prettier
- [x] 1.3 Create `tsconfig.base.json` with strict mode, `target: ES2022`, `moduleResolution: bundler`
- [x] 1.4 Create `.eslintrc.base.js` with shared rules for TypeScript projects
- [x] 1.5 Create `.prettierrc` at repo root
- [x] 1.6 Create `.env.example` with all required variables and inline comments
- [x] 1.7 Create `.gitignore` covering `node_modules`, `dist`, `.env`, `*.log`, Expo, Python cache

## 2. Docker Compose

- [x] 2.1 Write `docker-compose.yml` with services: api, web, image-gen, worker, db, cache, storage, proxy, search, monitor
- [x] 2.2 Define `noetia_net` bridge network and attach all services
- [x] 2.3 Configure volume mounts for hot-reload: api and web source directories
- [x] 2.4 Add health checks for db (pg_isready), cache (redis-cli ping), storage (MinIO /minio/health/live)
- [x] 2.5 Write `docker-compose.prod.yml` with production overrides (no source mounts, `NODE_ENV=production`)

## 3. Nginx

- [x] 3.1 Write `nginx/nginx.conf` with upstream blocks for api (port 4000) and web (port 3000)
- [x] 3.2 Add location routing: `/api/` → api, `/` → web
- [x] 3.3 Add `ssl/` directory with placeholder self-signed cert generation instructions

## 4. Infrastructure Config

- [x] 4.1 Write `infra/postgres/init.sql` enabling `uuid-ossp` and `pgcrypto` extensions
- [x] 4.2 Write `infra/redis/redis.conf` with AOF persistence, `maxmemory 256mb`, `allkeys-lru`
- [x] 4.3 Write `infra/minio/buckets.sh` creating `books` (private), `audio` (private), `images` (public-read) buckets
- [x] 4.4 Make `buckets.sh` idempotent (use `mc mb --ignore-existing`)

## 5. API Service Scaffold

- [x] 5.1 Initialize NestJS project in `services/api` with TypeScript and ESLint
- [x] 5.2 Extend `tsconfig.base.json` in `services/api/tsconfig.json`
- [x] 5.3 Install and configure TypeORM with PostgreSQL driver; read config from environment variables
- [x] 5.4 Create `GET /health` endpoint returning `{ "status": "ok" }`
- [x] 5.5 Create empty NestJS module files for: `auth`, `books`, `fragments`, `subscriptions`, `authors`, `sharing`, `users`
- [x] 5.6 Write multi-stage `services/api/Dockerfile` (build → production)
- [x] 5.7 Verify `pnpm build` compiles without TypeScript errors

## 6. Web Service Scaffold

- [x] 6.1 Initialize Next.js 14 project in `services/web` with App Router, TypeScript, and Tailwind CSS
- [x] 6.2 Extend `tsconfig.base.json` in `services/web/tsconfig.json`
- [x] 6.3 Create route group directories: `(reader)`, `(library)`, `(fragments)`, `(social)`, `(admin)` — each with a placeholder `page.tsx`
- [x] 6.4 Configure `tailwind.config.ts` with content paths for `app/**` and `components/**`
- [x] 6.5 Write multi-stage `services/web/Dockerfile` using Next.js standalone output
- [x] 6.6 Verify `pnpm build` compiles without errors

## 7. Mobile Scaffold

- [x] 7.1 Initialize Expo managed workflow project in `services/mobile` with TypeScript template
- [x] 7.2 Install and configure bottom tab navigator (Expo Router or React Navigation)
- [x] 7.3 Create four tab screens with placeholders: Library, Reader, Fragments, Account
- [x] 7.4 Create screen subdirectories: `src/screens/library`, `reader`, `fragments`, `account`, `auth`
- [x] 7.5 Create shared API client (`src/api/client.ts`) reading base URL from `EXPO_PUBLIC_API_URL`
- [x] 7.6 Verify `npx tsc --noEmit` passes

## 8. Image-Gen Service Scaffold

- [x] 8.1 Create `services/image-gen/app.py` with Flask app and `GET /health` endpoint
- [x] 8.2 Create `services/image-gen/templates/__init__.py` and stub files: `linkedin.py`, `instagram.py`, `facebook.py`, `whatsapp.py`
- [x] 8.3 Each template stub SHALL export `render(fragment: dict) -> bytes` returning a 1x1 placeholder PNG
- [x] 8.4 Write `services/image-gen/requirements.txt` with pinned versions: Flask, Pillow, pycairo
- [x] 8.5 Write `services/image-gen/Dockerfile` based on `python:3.11-slim` with `libcairo2` system dep

## 9. Worker Service Scaffold

- [x] 9.1 Initialize Node.js TypeScript project in `services/worker`
- [x] 9.2 Extend `tsconfig.base.json` in `services/worker/tsconfig.json`
- [x] 9.3 Install BullMQ and ioredis; connect worker to Redis using `REDIS_URL`
- [x] 9.4 Create `src/jobs/image-render.job.ts` stub: log job name and complete
- [x] 9.5 Create `src/jobs/share-export.job.ts` stub: log job name and complete
- [x] 9.6 Create `src/index.ts` that registers both job handlers and starts the worker
- [x] 9.7 Write multi-stage `services/worker/Dockerfile`
- [x] 9.8 Verify `pnpm build` compiles without TypeScript errors

## 10. CI/CD Pipelines

- [x] 10.1 Create `.github/workflows/ci.yml` triggered on `pull_request` to `main`
- [x] 10.2 Add CI steps: setup pnpm, restore cache (keyed by `pnpm-lock.yaml` hash), install deps
- [x] 10.3 Add CI matrix jobs for api, web, worker: lint → typecheck → build
- [x] 10.4 Create `.github/workflows/cd.yml` triggered on `push` to `main`
- [x] 10.5 Add CD step: build Docker images and stub deploy step (`echo "deploy to staging"`)

## 11. Verification

- [x] 11.1 Run `docker-compose up --build` and confirm all containers reach healthy state
- [x] 11.2 Verify `GET /health` returns 200 on api (port 4000) and image-gen (port 5000)
- [x] 11.3 Verify Next.js root page loads at `http://localhost:3000`
- [x] 11.4 Verify PostgreSQL, Redis, and MinIO are reachable from inside the api container
- [x] 11.5 Run `infra/minio/buckets.sh` and confirm three buckets exist in MinIO console
- [x] 11.6 Push a test branch and confirm CI workflow runs and all checks pass
