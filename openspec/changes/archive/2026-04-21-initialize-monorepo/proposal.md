## Why

The Noetia project exists as documentation and design artifacts only — there is no working codebase yet. To begin feature development, the full monorepo scaffold must be initialized: all services, Docker configuration, shared tooling, and CI/CD pipelines need to be in place so every subsequent sprint can build on a consistent, runnable foundation.

## What Changes

- Initialize the root monorepo with `docker-compose.yml`, `docker-compose.prod.yml`, and `.env.example`
- Scaffold the `services/api` NestJS project (TypeScript, ESLint, Prettier, TypeORM)
- Scaffold the `services/web` Next.js project (TypeScript, Tailwind CSS)
- Scaffold the `services/mobile` React Native project (Expo)
- Scaffold the `services/image-gen` Python Flask service with Dockerfile
- Scaffold the `services/worker` BullMQ Node.js service with Dockerfile
- Add `nginx/nginx.conf` with reverse proxy routing for all services
- Add `infra/` configuration for PostgreSQL (`init.sql`), Redis (`redis.conf`), and MinIO (`buckets.sh`)
- Configure GitHub Actions CI pipeline (lint, typecheck, build on PR)
- Configure GitHub Actions CD pipeline (deploy to staging on merge to main)

## Capabilities

### New Capabilities

- `monorepo-root`: Root workspace configuration, Docker Compose orchestration, environment variables, and shared tooling
- `api-scaffold`: NestJS application shell with TypeScript, database connection, health check endpoint, and module structure
- `web-scaffold`: Next.js application shell with TypeScript, Tailwind, and base layout
- `mobile-scaffold`: React Native (Expo) application shell with navigation structure
- `image-gen-scaffold`: Python Flask microservice shell with health check and Dockerfile
- `worker-scaffold`: BullMQ worker shell with Redis connection and Dockerfile
- `infra-config`: PostgreSQL init schema, Redis config, MinIO bucket setup scripts
- `ci-cd-pipeline`: GitHub Actions workflows for lint/test/build on PRs and staging deploy on main

### Modified Capabilities

## Impact

- Creates the entire working codebase from scratch — all services become runnable via `docker-compose up`
- Unblocks all subsequent sprints (auth, reader engine, social layer, etc.)
- Establishes shared TypeScript config, ESLint rules, and Prettier formatting as project-wide standards
- No existing code is affected (greenfield)
