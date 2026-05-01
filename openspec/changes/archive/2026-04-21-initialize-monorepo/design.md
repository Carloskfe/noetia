## Context

Noetia has no working codebase — only documentation and design artifacts exist. All services are defined in `CLAUDE.md` and `docs/PRD.md`. This change creates the entire project scaffold from scratch: a Docker-based monorepo with 6 services (api, web, mobile, image-gen, worker, proxy), shared infrastructure (PostgreSQL, Redis, MinIO), and CI/CD pipelines. Every subsequent sprint depends on this scaffold being runnable.

## Goals / Non-Goals

**Goals:**
- All services start successfully via `docker-compose up`
- Health check endpoint on each runnable service
- Shared TypeScript config, ESLint, and Prettier enforced across api, web, worker
- PostgreSQL, Redis, and MinIO reachable from api service
- GitHub Actions runs lint + typecheck + build on every PR
- Staging deploy triggered on merge to main

**Non-Goals:**
- No feature implementation (auth, reader, fragments, etc.) — scaffolds only
- No production Kubernetes setup — Docker Compose only at this stage
- No real SSL certificates — self-signed or HTTP for local dev
- No data seeding or test fixtures

## Decisions

### Monorepo structure: flat `services/` over Nx/Turborepo
Nx and Turborepo add caching and build graph features, but introduce significant tooling overhead for a greenfield project. A flat `services/` directory with per-service `package.json` files keeps the structure transparent and easy to navigate. If build times become a problem post-launch, Turborepo can be layered in.

**Alternative considered:** Turborepo — rejected for complexity at this stage.

### Package manager: pnpm workspaces
pnpm workspaces give monorepo-level `node_modules` deduplication without a build tool. Faster installs than npm and cleaner disk usage than Yarn. A root `pnpm-workspace.yaml` points to `services/api`, `services/web`, `services/worker`.

**Alternative considered:** npm workspaces — rejected; pnpm is faster and avoids phantom dependencies.

### React Native: Expo managed workflow
Expo reduces native toolchain friction significantly. For the MVP, no custom native modules are needed (audio playback, file storage, and sharing all have Expo SDK support). Bare workflow can be ejected later if needed.

**Alternative considered:** Bare React Native — rejected; adds setup burden without benefit at scaffold stage.

### Python service: Flask over FastAPI
The `image-gen` service has one job: receive a fragment payload, render an image, return a URL. Flask is simpler and has no async requirements for this use case. FastAPI would be premature.

**Alternative considered:** FastAPI — rejected; async not needed for CPU-bound image rendering.

### Docker Compose networking: single shared network
All services share one Docker bridge network (`noetia_net`). Services reference each other by container name (e.g., `api` calls `db:5432`). This keeps the `docker-compose.yml` readable and avoids inter-network routing complexity.

### CI/CD: GitHub Actions over CircleCI / GitLab CI
Project is hosted on GitHub. Native Actions integration avoids external credentials and has generous free tier. Separate workflow files for CI (on PR) and CD (on push to main) keep concerns separated.

## Risks / Trade-offs

`pnpm workspace hoisting` → some packages may not resolve correctly if a service has a transitive dep conflict. Mitigation: pin `nodeLinker: node-modules` in `.npmrc` and test with `pnpm install --frozen-lockfile` in CI.

`Expo managed workflow lock-in` → if a native module is needed before MVP, ejecting mid-sprint is disruptive. Mitigation: audit all planned features against Expo SDK before committing; document the eject path.

`Single Docker network` → in production, services should be isolated. Mitigation: `docker-compose.prod.yml` can introduce service-specific networks; not a concern for local dev.

`No staging environment defined yet` → CD pipeline deploys to staging but the staging server spec is undefined. Mitigation: CD job is scaffolded but marked as a no-op (`echo "deploy"`) until infra is provisioned.
