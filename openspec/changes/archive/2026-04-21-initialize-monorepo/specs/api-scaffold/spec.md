## ADDED Requirements

### Requirement: NestJS application starts and is healthy
The `services/api` directory SHALL contain a runnable NestJS application with TypeScript, ESLint, Prettier, and a `/health` GET endpoint that returns `{ status: "ok" }` with HTTP 200.

#### Scenario: Health check passes
- **WHEN** the api container is running and a GET request is sent to `/health`
- **THEN** the response is HTTP 200 with body `{ "status": "ok" }`

#### Scenario: TypeScript compiles without errors
- **WHEN** `pnpm build` is run inside `services/api`
- **THEN** the TypeScript compiler exits with code 0 and emits to `dist/`

### Requirement: Database connection is configured
The `services/api` application SHALL use TypeORM configured via environment variables (`DATABASE_URL` or individual `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`) and connect to PostgreSQL on startup.

#### Scenario: Successful database connection
- **WHEN** the api service starts with valid database environment variables
- **THEN** TypeORM connects to PostgreSQL and logs a successful connection message

#### Scenario: Failed connection is reported clearly
- **WHEN** the api service starts with an unreachable database host
- **THEN** the application logs a clear error message and exits with a non-zero code

### Requirement: Module structure matches domain
The `services/api/src` directory SHALL contain empty module folders for each domain: `auth/`, `books/`, `fragments/`, `subscriptions/`, `authors/`, `sharing/`, `users/` — each with a minimal NestJS module file.

#### Scenario: Module directories exist
- **WHEN** the api scaffold is created
- **THEN** each domain directory contains at least a `<domain>.module.ts` file that NestJS can import without error

### Requirement: Dockerfile builds successfully
The `services/api/Dockerfile` SHALL produce a runnable image using a multi-stage build (build stage with dev deps, production stage with only `dist/` and production `node_modules`).

#### Scenario: Docker image builds
- **WHEN** `docker build -t noetia-api .` is run inside `services/api`
- **THEN** the build completes without errors and the resulting image starts the NestJS app
