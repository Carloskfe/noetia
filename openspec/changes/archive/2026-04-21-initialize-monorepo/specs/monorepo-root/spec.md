## ADDED Requirements

### Requirement: Root workspace configuration exists
The repository SHALL contain a root `pnpm-workspace.yaml` that declares all Node.js service paths, a root `package.json` with shared dev dependencies (TypeScript, ESLint, Prettier), and a shared `tsconfig.base.json` extended by each service.

#### Scenario: Developer installs dependencies
- **WHEN** a developer runs `pnpm install` at the repo root
- **THEN** all Node.js service dependencies are installed and deduped under a shared `node_modules`

#### Scenario: Shared TypeScript config is inherited
- **WHEN** a service's `tsconfig.json` extends `../../tsconfig.base.json`
- **THEN** compiler options (strict, target, moduleResolution) are applied without repetition

### Requirement: Docker Compose orchestrates all services
The repository SHALL contain a `docker-compose.yml` that defines and connects all services (api, web, mobile is excluded from compose, image-gen, worker, db, cache, storage, proxy, search, monitor) on a shared `noetia_net` bridge network.

#### Scenario: Full stack starts from scratch
- **WHEN** a developer runs `docker-compose up --build`
- **THEN** all services start, pass their health checks, and are reachable at their defined ports within 60 seconds

#### Scenario: Services resolve each other by name
- **WHEN** the `api` service connects to `db:5432`
- **THEN** the connection resolves to the PostgreSQL container without manual IP configuration

### Requirement: Environment variables are documented
The repository SHALL contain a `.env.example` file listing every required environment variable with placeholder values and inline comments describing each variable's purpose.

#### Scenario: New developer onboards
- **WHEN** a developer copies `.env.example` to `.env` and fills in values
- **THEN** `docker-compose up` starts all services without missing-variable errors

### Requirement: Production compose override exists
The repository SHALL contain a `docker-compose.prod.yml` that overrides image tags, removes volume mounts for source code, and sets `NODE_ENV=production` and `FLASK_ENV=production`.

#### Scenario: Production build is applied
- **WHEN** `docker-compose -f docker-compose.yml -f docker-compose.prod.yml up` is run
- **THEN** no local source directories are mounted into containers and production environment flags are set
