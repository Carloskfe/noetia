## ADDED Requirements

### Requirement: BullMQ worker starts and connects to Redis
The `services/worker` directory SHALL contain a Node.js TypeScript application that initializes a BullMQ worker connected to Redis using the `REDIS_URL` environment variable and logs a successful connection on startup.

#### Scenario: Worker starts and connects
- **WHEN** the worker container starts with a valid `REDIS_URL`
- **THEN** the worker logs "Worker connected" and begins polling for jobs

#### Scenario: Redis connection failure is reported
- **WHEN** the worker starts with an unreachable Redis host
- **THEN** the worker logs a clear error message and exits with a non-zero code

### Requirement: Job handler stubs exist
The `services/worker/src/jobs` directory SHALL contain stub handler files for each planned job type: `image-render.job.ts` and `share-export.job.ts` — each exporting a `process(job: Job) -> Promise<void>` function that logs the job name and completes without error.

#### Scenario: Job stubs process without throwing
- **WHEN** a job of type `image-render` or `share-export` is enqueued in Redis
- **THEN** the worker picks it up, calls the stub handler, and marks the job as completed

### Requirement: Dockerfile builds a production image
The `services/worker/Dockerfile` SHALL produce a runnable image using a multi-stage build (build stage with dev deps for TypeScript compilation, production stage with only `dist/` and production `node_modules`).

#### Scenario: Docker image builds and worker starts
- **WHEN** `docker build -t noetia-worker .` is run inside `services/worker`
- **THEN** the build completes and the container starts the worker process without errors
