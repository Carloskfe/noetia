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

## PO-044: root-cause diagnostics (test only; opt-in)

| File or flag | Purpose |
|---|---|
| `q11-diagnostics.ts` | Loaded by the harness only when `Q11_DIAG=1`. Records component timers, `pg` round trips by SQL category, event-loop delay, utilization and stall timestamps, cgroup `cpu.stat` throttling, GC entries, and on-demand CPU profiles from the built-in inspector. Also runs an isolated S2 micro-benchmark (`/diag/bench`) and diagnostic ablations (`/diag/mode?m=none\|nohash\|s2free\|s2worker\|bytescan`) |
| `Q11_DOCKER_STATS` (client) | `sync` is the Checkpoint E behaviour: it blocks the client about 1 s per sample and **produces the N-3 outliers**. `async` does not block. `off` is the default for diagnostic runs |
| `Q11_DIAG=1` / `Q11_PROF=1` (client) | Reset and snapshot the diagnostics around each measurement, and/or CPU-profile it (writes `/prof/*.cpuprofile` when a writable `/prof` is mounted) |
| `Q11_WORKER_NICE` (server) | Nice value the `s2worker` proxy thread sets for itself |

Every ablation except `none` is **diagnostic only**. `nohash` and `s2free` deliberately bypass the accepted per-request re-read and re-verify contract (NEM-023 AC-11/P-2) to measure how much interference they account for. `s2worker` is a synthetic proxy, not an implementation. `bytescan` keeps per-request reads and SHA-256 and replaces only the full decode. The results are in `docs/reports/2026-11-10-NEM-024-q11-root-cause-investigation.md`.

Example: one W per container, with a writable profile directory.

```bash
docker run [--cpuset-cpus=N] --cpus=1 --memory=512m --memory-swap=512m --network host -v <out>:/app/out:ro -v <prof>:/prof … \
  -e Q11_DIAG=1 node:20-alpine node [--max-semi-space-size=32] out/tests/perf/q11-harness.js
curl 'http://127.0.0.1:4101/diag/mode?m=bytescan'
Q11_DOCKER_STATS=off Q11_DIAG=1 node <out>/tests/perf/q11-client.js 10 x10,p3x3 out.json <container>
```

## PO-045: requalification of the S2 worker remedy (test only)

- `q11-diagnostics.ts` snapshots now include `s2pool` (deltas of `processS2Verifier().stats()` since the last reset: jobs, outcomes, worker restarts, zero-copy transfers vs copies, queue depth sampled every 10 ms, queue wait, worker busy time) and `threads` (per-thread CPU from `/proc/self/task`; the S2 worker is its own task).
- With the PO-045 code the main thread no longer calls `computeTextHash`/`decodeUtf8`/`sliceCodePointRanges` during retrieval, so the `s2:*` timers stay empty and the PO-044 ablation modes no longer affect the retrieval path. **Use mode `none` only.** Do not use `s2free`/`s2worker`: their `getBytes` cache would hand one owned buffer to the worker twice.
- Governing method: `Q11_DOCKER_STATS=off Q11_DIAG=1`. `Q11_DOCKER_STATS=sync` is kept only as a labelled historical comparison.
- Same-session baseline: compile the pre-remediation tree (`git archive d937d2b services/api/{src,tests,tsconfig.json,package.json}`) to a second out-dir and run it with the same container command.
- Results: `docs/reports/2026-11-11-NEM-024-po-045-q11-remediation-report.md`.
