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

## PO-046: residual-interference diagnostics (test only; opt-in)

New `/diag/mode` values in `q11-diagnostics.ts`. All are runtime patches inside the disposable harness process; production `src/` is unchanged.

| Mode | Kind | What it does |
|---|---|---|
| `fetchinst` | Contract-equivalent | Same SDK calls as `StorageService.getBytes`, with phase timers (send → headers, first chunk, stream, `Buffer.concat`, chunk count) |
| `fetchcached` | **Upper bound; breaks AC-11/P-2** | After the first real read, `getBytes` returns a fresh copy of cached bytes. Removes the SDK, the network and chunking; keeps the 2 MB allocation and the real worker verification |
| `s2memo` | **Upper bound; breaks AC-11/P-2** | Real fetch; the worker result is memoized by (hash, ranges) |
| `both` | **Upper bound** | `fetchcached` + `s2memo` |
| `fetchworker` | Contract-equivalent proxy (candidate B) | A test worker does the real SDK read plus `runS2Job`; the main thread never touches book bytes. Test-only and unbounded; not an implementation |
| `fetchraw` | Contract-equivalent read variant (candidate A) | `node:http` GET of an SDK-presigned URL into one buffer preallocated from `Content-Length`; exact bytes |
| `workernice` | Scheduling sensitivity | `setpriority(19)` on the S2 worker's thread id |

`s2-fetch-bench.ts`: storage-read micro-benchmark for the capped container. Variants: `prod`, `noCrc`, `prealloc`, `sdkBytes`, `rawHttp`, `cached`. It reports per-object wall time, process CPU, main-thread CPU, per-helper-thread CPU and main-isolate GC. Every variant is checked byte-identical by SHA-256 before timing.

```bash
docker run --rm --cpus=1 --memory=512m --memory-swap=512m [-e UV_THREADPOOL_SIZE=1] --network host \
  -v <out>:/app/out:ro -v <api node_modules>:/app/node_modules:ro -w /app -e NEM019_DISPOSABLE_DB=1 -e DB_*=… -e MINIO_*=… \
  node:20-alpine node [--single-threaded-gc|--v8-pool-size=1] out/tests/perf/s2-fetch-bench.js <rounds> <concurrency>
```

Node flags such as `--single-threaded-gc`, `--v8-pool-size` and `--max-semi-space-size` were used only as labelled **sensitivity experiments** in disposable containers. They are not tracked configuration.

Results: `docs/reports/2026-11-11-NEM-024-po-046-residual-performance-investigation.md`.

## PO-048: E-1 retrieval-ranking diagnostics (test only; opt-in)

`e1-ranking-diag.ts` runs against the disposable fixture left by the NEM-023 performance suite (`NEM023_PERF=1 NEM023_PERF_KEEP=1`). Run it from `services/api`:

```bash
NEM019_DISPOSABLE_DB=1 DB_HOST=127.0.0.1 DB_PORT=55432 DB_NAME=<db>_test DB_USER=… DB_PASS=… MINIO_*=… \
  npx ts-node -T -P tsconfig.json tests/perf/e1-ranking-diag.ts <info | explain | fingerprint | sql <variant> <reps> | e2e <fwd|rev|shuffle:N> <rounds>>
```

- **Baseline SQL:** `RANK_SQL` and `STATUS_SQL` are read verbatim from `src/knowledge/retrieval/lexical-retrieval.service.ts`, so the baseline is always the authorized SQL.
- **Query identifiers:** queries are identified only as Q0..Q9, the governing mix. `E1_EXTRA=1` switches to the adversarial multi-term set X0..X9, which is diagnostic only and not part of the benchmark. No book ids, hashes, keys or text are printed.
- **`e2e`:** uses the production `LexicalRetrievalService` with the real MinIO, `StorageBookText` and the S2 worker, instrumented per stage. `E1_SUBST=<variant>` substitutes the ranking SQL (test-only, diagnostic).
- **`sql` variants:**

  | Variant | Class |
  |---|---|
  | `base` | Production SQL |
  | `jitoff`, `workmem` | Exact settings |
  | `branchlimit`, `hybrid200` | Exact structural |
  | `twostage50`/`200`/`400`, `cap500`/`2000` | Lossy |
  | `norank`, `detoast`, `tsrank` | Semantic change, diagnostic only |

  Every run reports equivalence with the production result: identical rows and order, recall@8, and the first missing rank.
- **Storage experiments:** `lz4`, `EXTERNAL` and `MAIN` storage for `tsv` were tested only in disposable database clones (`CREATE DATABASE <x>_test TEMPLATE nem019_test`, then `ALTER TABLE … ALTER COLUMN tsv SET STORAGE/COMPRESSION …` and a rewrite). They were dropped afterwards. **No migration.**

Results: `docs/reports/2026-11-11-NEM-024-po-048-e1-ranking-investigation.md`.
