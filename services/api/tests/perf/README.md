# NEM-024 Checkpoint E: performance tooling (test only)

This tooling is never imported by `src/`, never part of `npm test`, and never part of CI. It runs only against **disposable local** PostgreSQL, Redis, and MinIO containers.

| File | Purpose |
|---|---|
| `q11-harness.ts` | Server side of the Q-11 reader-interference measurement. See the details below |
| `q11-client.ts` | Host-side client, outside the cap. Sends sequential keep-alive requests (≥ 1,000 per endpoint per condition) to `GET /books`, `GET /books/:id`, and `GET /books/:id/sync-map`, and samples `docker stats` |
| `sse-idle.ts` | SSE through a proxy with an idle timeout: timestamps each frame, reports whether the terminal arrived or the connection was cut, then replays the same key |
| `tsconfig.json` | Compiles `src/`, these files, and the integration fixture helpers to an out-of-tree directory |

## What `q11-harness.ts` does

1. Boots the **real `AppModule`** with `KNOWLEDGE_MODULE_ENABLED=true`. The research load runs **in-process** through the real `TurnService`, so it shares the event loop with the reader endpoints.
2. Applies test-module overrides only:
   - the four dark ports, bound to fixture answers;
   - the throttler storage, so it never blocks.
3. Waits until one real turn **completes** before any measurement starts.

## Procedure (as run for the Checkpoint E report)

**1. Disposable services** (local only):

- `postgres:16-alpine` on 127.0.0.1:55432, database `nem019_test`;
- `redis:7-alpine` on 56379;
- `minio/minio` on 59000.

**2. Fixture:** run the NEM-023 performance suite once with `NEM023_PERF=1 NEM023_PERF_KEEP=1 NEM023_MINIO_*`. This creates 10 books of about 2M code points each, indexed in PostgreSQL and stored in MinIO. Jest needs `NODE_OPTIONS=--experimental-vm-modules` for the AWS SDK.

**3. Compile:**

```bash
npx tsc -p tests/perf/tsconfig.json --outDir <out>
```

**4. Run the server under the deployment cap, one W per container:**

```bash
docker run --cpus=1 --memory=512m --memory-swap=512m --network host \
  -v <out>:/app/out:ro -v <api node_modules>:/app/node_modules:ro -w /app \
  -e NEM019_DISPOSABLE_DB=1 -e DB_HOST=127.0.0.1 -e DB_PORT=55432 -e DB_NAME=nem019_test -e DB_USER=noetia -e DB_PASS=test \
  -e REDIS_URL=redis://127.0.0.1:56379 -e MINIO_ENDPOINT=127.0.0.1 -e MINIO_PORT=59000 -e MINIO_ACCESS_KEY=… -e MINIO_SECRET_KEY=… \
  -e KNOWLEDGE_MODULE_ENABLED=true -e INTELLIGENCE_OVERALL_UNRESOLVED_UNITS_BOUND=1000000000 \
  -e INTELLIGENCE_TURN_WEIGHT_LIMIT=<W> -e JWT_SECRET=<local> -e NODE_ENV=production \
  node:20-alpine node out/tests/perf/q11-harness.js
```

`INTELLIGENCE_OVERALL_UNRESOLVED_UNITS_BOUND` is required because the dark module's ledger otherwise fails closed. It is a **test-container** value only; production configuration is unchanged.

**5. Run the client on the host:**

```bash
node <out>/tests/perf/q11-client.js <W> <scenarios> <out.json> <container>
```

The scenarios are:

| Scenario | Load | Weight |
|---|---|---|
| `x10` | One continuous 10-book turn | 10 |
| `p3x3` | Three continuous 3-book turns | 9 |
| `p3x2` | Two continuous 3-book turns | 6 |
| `p3x1` | One continuous 3-book turn | 3 |
| `probe10` | One 10-book turn under the current W | Admitted or refused |

## Limitations

- **Not the literal production image.** The production image's `npm install --omit=dev` cannot include `@nestjs/testing`, which the port overrides need. The harness instead runs the same compiled code on the same base image (`node:20-alpine`) under the same cap.
- **Shared host.** The development VM is not idle: other project containers run alongside, so absolute numbers carry run-to-run variance.
