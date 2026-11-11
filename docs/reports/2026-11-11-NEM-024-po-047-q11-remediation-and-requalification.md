# NEM-024 — PO-047 Q-11 Remediation (C + A) and Requalification Report

**Date:** 2026-11-11 · **Authority:** [PO-047](../operating-framework/decisions/product-owner/PO-047-nem-024-q11-remediation-and-requalification-authorization.md) (limited implementation + requalification) · **Branch / PR:** `feat/nem-024-checkpoint-b`, Draft PR #56 · **Review:** independent Product Architecture (**not yet performed**) · **PO acceptance:** **not yet given**

## 1. Executive summary

| Item | Result |
|---|---|
| Component C: `--single-threaded-gc` | **Implemented** in the API production image CMD only. Verified on the real production image (node 20.20.2): it starts, `/health` returns 200, the process runs as `node --single-threaded-gc dist/main`, the S2 worker works under the flag, SIGTERM stops cleanly, and no other process inherits the flag |
| Component A: S2 exact read | **Implemented:** `StorageService.getBytesExact` (`getBytes` unchanged) is an internally presigned GET into one validated, zero-filled, owned buffer. It is restricted to the configured private origin, follows no redirects, keeps Node's TLS verification, and has bounded timeouts. Every failure → `unavailable`; a complete read with different bytes → `stale` (the worker is unchanged) |
| Tests | **Green:** API unit 2,047/2,047 (branch coverage 80.97%); API integration 226 passed, 1 skipped (opt-in performance suite, run separately); TypeScript 0 errors; API lint 0 errors in `src` (12 pre-existing test-lint errors, none new); API build ✓; web unit 448/448; web `tsc` and `lint` 0 errors; web production build ✓ (Docker, see §11); Playwright 2/2 (en, es) |
| **Q-11** (sampler off; every endpoint, every run) | **All 9 required runs pass:** 3 valid runs per workload, no contamination, no reader errors. Worst Δp95: W=10 `x10` **+31.1** · W=10 `p3x3` **+48.2** · W=6 `p3x2` **+30.3** · W=3 `p3x1` **+11.8** ms |
| Minimum margin | **1.8 ms** (W=10 `p3x3`, run 1). The other `p3x3` runs had 6.9 and 7.6 ms. Every other workload has ≥ 18.9 ms. The `p3x3` margin is **thin**; see §15 |
| Ten-book commitment | Admitted and completed at W=10 in every run (101, 99, 102 ten-book turns; **0 failed, 0 refused**). As designed, the 10-book probe is refused at W=6 and W=3 |
| API-wide stability | **No adverse finding.** Against the pre-PO-047 baseline, main-thread GC pauses are *shorter* (p99 6–10 vs 48–79 ms), idle reader p95 is lower, event-loop p99 under load is about halved, RSS is unchanged (max ≤ 229 MB), and research throughput is up to ~2×. Limitation: the load windows were short (≤ 56 s) |
| **E-1** | **OPEN:** retrieval p95 603 ms (p50 286) vs 150 ms |
| Verdict | **Implementation complete; Q-11 requirement met in every required run, with thin margin on `p3x3`. Checkpoint E remains NOT QUALIFIED because E-1 is open. Ready for PA review; not accepted.** |

## 2. Authorization and scope

**PO-047** authorizes Components C and A only, plus requalification. It is recorded in `07e5bb1` (decision record, `PRODUCT-DECISIONS.md`, mission status, register). PO-045 remains provisional; PO-046 is accepted as completed diagnostics.

**Excluded and not done:**

- ranking SQL, contracts, weights or limits;
- caches, range reads, weakened validation;
- infrastructure, CPU or RAM;
- other flags;
- schema, dependencies, web or mobile;
- merge, Draft change, staging or production, activation;
- PO-046 fallback options.

**Preflight:** remote head = `0c2b186` (expected); PR #56 open, Draft, unmerged; clean tree; PO-047 unused.

## 3. Commits

- **Starting commit:** `0c2b18622dac39367d08cdaa0ad0248df02cdda0`
- **Ending commit:** the report commit (see PR #56)

| Commit | Content |
|---|---|
| `07e5bb1` | Governance (PO-047) |
| `3233ec2` | Component C: runtime configuration |
| `f624bcb` | Component A: S2 exact read, plus unit and integration tests |
| report commit | This report, raw measurements, status updates |

## 4. Changed-file inventory

| File | Kind | Change |
|---|---|---|
| `services/api/Dockerfile` | Runtime configuration | `production` stage CMD → `["node", "--single-threaded-gc", "dist/main"]`, with a comment |
| `services/api/src/storage/storage.service.ts` | Production source | New `getBytesExact`, `S2ReadError`, bounds and constants, the private-origin record, a keep-alive agent per protocol, and two protected test seams (timeouts, agent factory). `getBytes`, `getText`, `upload`, `presign` and `publicUrl` are unchanged |
| `services/api/src/knowledge/retrieval/storage-book-text.ts` | Production source | Uses `getBytesExact` when the storage object provides it (the runtime `StorageService` always does); otherwise `getBytes`. See DV-1 |
| `services/api/tests/unit/storage/storage.service.s2-read.spec.ts` | New test | 38 transport, validation and security cases over loopback sockets |
| `services/api/tests/unit/storage/fixtures/*` | New test fixtures | Test-only TLS certificates (CA key deleted) and README |
| `services/api/tests/unit/knowledge/retrieval/storage-book-text.s2-read.spec.ts` | New test | Adapter → real worker; truncated read → `unavailable` with no worker call; replaced object → `stale` |
| `services/api/tests/integration/storage/s2-exact-read.int-spec.ts` | New test (opt-in) | Real SigV4 presigning against disposable MinIO; byte equivalence with the SDK read |
| Governance and report documents | Documentation | – |

**Unchanged:**

- every accepted or protected test, including the NEM-023 `storage-book-text.spec.ts` and `storage.service.spec.ts`;
- the S2 worker, pool, retrieval service and SQL;
- Compose files and environment;
- web and mobile.

## 5. Runtime flag placement and compatibility

**Placement.** The API's production startup is the Dockerfile `production` stage CMD. Both `docker-compose.server.yml` (CD, production and staging) and the `docker-compose.prod.yml` overlay build `target: production` and do not override `command`. So one line changes the API process everywhere it is deployed.

**Not affected:**

| Process | Why |
|---|---|
| `npm run migration:run:prod` (CD `exec` step) | Separate `node` process; verified, `execArgv` `[]` |
| Development (`target: development`, `nest start --watch`) | Different stage |
| Web, worker, MinIO, PostgreSQL, Redis | Different images |

`NODE_OPTIONS` was deliberately not used, because it would leak into migrations and `npm`. `package.json` `start` (`node dist/main`) is not used by any deployment and was left unchanged, so no second configuration location exists.

**Verification on the real production image** (built locally from the Dockerfile `production` target, run with `--init --cpus=1 --memory=512m` against disposable services; image removed afterwards):

| Check | Result |
|---|---|
| Node version and flag acceptance | v20.20.2 accepts `--single-threaded-gc` |
| Configured CMD | `["node","--single-threaded-gc","dist/main"]` |
| Actual process | PID 1 `docker-init -- … node --single-threaded-gc dist/main`; PID 7 `node --single-threaded-gc dist/main` |
| `GET /health` | 200 `{"status":"ok"}` |
| `NODE_OPTIONS`; a separately exec'd `node` | empty; `execArgv` does not include the flag |
| Worker inheritance | Workers inherit `execArgv` (`["--single-threaded-gc"]`); no `ERR_WORKER_INVALID_EXEC_ARGV` (V8 flags are process-wide) |
| Compiled S2 worker under the flag (from `/app/dist`) | `ok` (exact passages), `stale`, `invalid_utf8` → `unavailable`, crash → `unavailable` then recovered, timeout → `unavailable` then recovered, shutdown OK |
| Graceful stop (SIGTERM via tini) | 0.21 s, exit 143. This is the documented clean stop in `main.ts` (137 would mean SIGKILL) |

## 6. Optimized storage-read design

```
LexicalRetrievalService → StorageBookText.read → StorageService.getBytesExact → S2 worker (unchanged) → passages
```

1. **Sign:** `getSignedUrl(this.client, GetObject{bucket,key}, {expiresIn: 60})`. This is the **private** client, never `presignClient`. A signing error → `sign`.
2. **Destination:** the signed URL's origin must equal the configured private origin (`MINIO_USE_SSL` / `MINIO_ENDPOINT` / `MINIO_PORT`), and the scheme must be http or https. Otherwise → `destination`, and no request is made. The method takes a key, never a URL, so it is not a general-purpose fetcher.
3. **Request:** `http` or `https` chosen from the configured scheme, with a dedicated keep-alive agent (16 sockets) and Node's TLS verification defaults. The `accept-encoding: identity` header is sent. Timeouts: idle 5 s, total 15 s.
4. **Response accepted only if all of these hold:**
   - status exactly 200;
   - no `Content-Range`;
   - encoding absent or `identity`;
   - `Content-Length` is a 1–15 digit string, a safe integer, and ≤ `S2_MAX_OBJECT_BYTES`;
   - `Buffer.alloc(len)` succeeds (zero-filled, unpooled, owned);
   - every chunk fits (`off + chunk ≤ len`, else `overflow`);
   - the response ends complete with `off === len`.
5. **Resolve** with the buffer. `StorageBookText` marks it owned, and the PO-045 pool transfers it zero-copy (100% of jobs in every run). The worker then hashes the whole object (`computeTextHash`), validates strict UTF-8 and slices code points.
6. **Retry:** one retry, and only for `ECONNRESET`/`EPIPE` on a **reused** keep-alive socket before any response (Node's documented keep-alive race), within the same total deadline. A failure on a fresh connection is never retried.

**Size bound.** `S2_MAX_OBJECT_BYTES` = 500 MB is the existing, enforced book-upload limit (`books.controller.ts`, `FileFieldsInterceptor` `fileSize`). It is **not a new product limit**.

- The author guide's 10 MB text guideline is not enforced, and the free-library ingestion path has no limit.
- Adopting 10 MB would therefore have made existing large books newly unavailable, which amounts to a product decision.
- **Memory note for PA:** a single object near 500 MB cannot be buffered in a 512 MB container by either the old path (chunks + concat, about 2×) or the new path (1×). PO-047 does not make that case worse.

**Zero-byte objects:** `Content-Length: 0` → an empty buffer, then the worker, exactly as before.

## 7. Security and error-handling assessment

| Concern | Handling | Evidence |
|---|---|---|
| Presigned URL secrecy | Built inside `getBytesExact`; never returned, stored or logged. `S2ReadError` carries only `name` and `reason` | Tests assert errors contain no key, path, host or signature |
| Public endpoint misuse | The private client signs; the origin check rejects anything else | Unit test (`destination`); integration with `MINIO_PUBLIC_URL=https://public.invalid` still reads privately |
| Arbitrary destinations and redirects | Origin and scheme pinned; any non-200 fails and `Location` is never followed | A redirect-target server is never contacted |
| TLS | Node defaults (`rejectUnauthorized` true). A self-signed certificate → `tls`. A trusted CA (test seam only) → success | Unit tests |
| Size and length abuse | Strict `Content-Length` grammar and bound before allocation; overflow and truncation checks | Unit tests: malformed, oversized (no allocation attempted), larger or shorter than announced |
| Unbounded wait | Idle 5 s, total 15 s. The old SDK path set no request timeout | Unit tests: idle stall, slow trickle, no response |
| Partial or uninitialized data | Zero-filled allocation; resolve only on exact completion; on error the buffer is dropped | Unit and adapter tests: truncated → never reaches the worker |
| Credentials | Existing credentials and client; nothing new | – |
| Logging | No logger or console anywhere in the path | The retrieval architecture test (unchanged) still passes |

**Error mapping:** every `S2ReadError` (and any other throw) inside `StorageBookText.read` is caught in `LexicalRetrievalService` → `unavailable`, unchanged code. A **complete** read whose bytes differ → the worker's hash mismatch → `stale`. A **truncated** read never reaches the worker, so it is never `stale`.

**Body larger than announced.** Under HTTP/1.1 framing the body ends at `Content-Length`. Trailing bytes belong to no response and are discarded by Node's parser, so they can never enter the buffer. If the framed bytes differ from the object, the worker's full-object SHA-256 mismatches and the outcome is `stale`. The test asserts that only the framed bytes are ever accepted.

**Transport check.** The SDK's optional response CRC32 is not applied on this path. End-to-end integrity is unchanged: the full-object SHA-256 against the caller's current hash on every retrieval (AC-11), which is strictly stronger.

## 8. Exact-byte equivalence

**Integration** (disposable MinIO, real SigV4; `s2-exact-read.int-spec.ts`): `getBytesExact` equals `getBytes` equals the uploaded bytes, with identical SHA-256, for:

- Spanish, combining marks, emoji/ZWJ/U+10FFFF, BOM;
- **invalid UTF-8** bytes (byte-exact; the worker still rejects them);
- empty;
- a 3.2 MB mixed-script object.

Also: 50 concurrent reads of the large object are all exact. A missing object and wrong credentials → `S2ReadError(status)`. **10/10 pass.**

**Unit tests** (loopback): the same text set plus a 3 MB object are exact; the buffer is the whole `ArrayBuffer` (transferable); 10 concurrent reads return independent exact buffers; HTTPS success with the test CA.

**Full-suite proof:** the NEM-023 retrieval performance suite (real MinIO through `StorageBookText`) and all 216 prior integration tests pass on the new path.

## 9. UTF-8 and Unicode equivalence

The S2 worker, `utf8-slice.ts` and their PO-045 equivalence tests are **unchanged**: fixed and 2,000 randomized cases against `sliceCodePointRanges(decodeUtf8())`, including BOM, astral characters, combining marks, CRLF, and invalid or out-of-range offsets. The read path only supplies bytes.

New end-to-end check: real socket read → real worker → passages identical to the in-loop reference, for a BOM-prefixed Spanish and emoji text (`storage-book-text.s2-read.spec.ts`).

## 10. Worker lifecycle and fail-closed testing

- **Unchanged PO-045 pool tests pass:** init, completion, saturation, queue and job timeout, crash, startup failure, cool-down, shutdown, failure storm, buffer ownership.
- **Under the flag** (production image, §5): `ok`, `stale`, `invalid_utf8`, crash/recovery, timeout/recovery, shutdown.
- **Under load:** 0 worker timeouts, crashes or restarts, and 0 `unavailable` outcomes across all 9 qualification runs.

## 11. Test, architecture and build results

| # | Command | Result |
|---|---|---|
| 1 | `services/api`: `npx jest --maxWorkers=2 --coverage` | **143 suites, 2,047/2,047.** Global 94.44% statements / **80.97% branches** / 92.68% functions / 95.66% lines (threshold 80% met; PO-045: 80.78% branches). `storage.service.ts` 98.3% statements / 91.9% branches |
| 2 | Architecture suites (inside #1) | **Pass, unmodified:** knowledge, gateway, contract, retrieval, turn, cost architecture |
| 3 | `services/api`: integration (`jest.integration.config.js --runInBand`, disposable PostgreSQL, Redis, MinIO) | **13 suites passed, 1 skipped** (opt-in NEM-023 performance, run separately in §19). **226 passed, 1 skipped, 0 failed**: +10 new exact-read tests; turn, idempotency, cancellation, fencing, ledger and rights suites all green |
| 4 | `tsc --noEmit` (`tsconfig.test.json`) | 0 errors |
| 5 | `eslint "src/**/*.ts"` | **0 errors**, 256 warnings (unchanged) |
| 6 | `eslint "tests/**/*.ts"` | **12 errors, all pre-existing** (same files as before; none in PO-047 files) |
| 7 | `npm run build` | ✓; `dist/storage/storage.service.js` and the S2 worker emitted |
| 8 | Production API image (`docker build --target production`) | ✓ (§5) |
| 9 | `services/web`: `npx jest --maxWorkers=2 --coverage` | **21 suites, 448/448.** The web coverage gate fails, as before (branches 76.25%; no web change) |
| 10 | `services/web`: `tsc --noEmit` · `next lint` | 0 errors · 0 errors |
| 11 | `services/web`: production build | **✓ in Docker** (`docker build --target production`); `ƒ /research/[sessionId]` 8.1 kB / 124 kB first load. See the environment note below |
| 12 | Playwright `tests/e2e/research-qa.spec.ts` against the production web image | **2/2 (en, es)** |

**Environment note (not caused by PO-047).** During this session the main checkout's `services/web/node_modules` became empty: modified at 12:32, 0 entries. The PO-047 worktree symlinks to it. A host-side `next build` therefore failed with `Cannot find module '@sentry/nextjs'`.

- That directory was not modified by this work.
- To avoid touching the developer's checkout, the web production build ran in a disposable Docker build of the web Dockerfile (image removed afterwards).
- Playwright ran via `npx @playwright/test@1.61.1`, the same version, with the locally cached browsers.

## 12. Q-11 methodology and run inventory

| Item | Setting |
|---|---|
| Harness | Q-11 harness (real `AppModule`), `node:20-alpine` v20.20.2, **`node --single-threaded-gc`** (the same invocation as the production CMD; recorded from `/proc/1/cmdline` for every run) |
| Cap | `--cpus=1 --memory=512m --memory-swap=512m` |
| Code | Compiled PO-047 code; production behaviour (diagnostic mode `none`; no cached or memoized substitution) |
| Services | Disposable PostgreSQL 16, Redis 7, MinIO |
| Fixture | 10 × 2M-code-point books (rebuilt for this session) |
| Provider | Simulated |
| Client | **`Q11_DOCKER_STATS=off`**, 20 warm-ups, 1,000 measured requests per endpoint per condition, idle and load in the same run |
| Isolation | A **fresh harness container for every run** |

The driver (`qualify47.sh`, scratchpad) evaluated each run against the rule as it finished and would have **stopped at the first valid failure**. A run counted as valid only if neither its idle nor its load condition contained a server event-loop gap ≥ 1 s.

**Inventory:** 9 runs = 3 × W=10 (`x10` + `p3x3`), 3 × W=6 (`p3x2` + 10-book probe), 3 × W=3 (`p3x1` + probe). **All 9 valid, with 0 contaminated runs and 0 repeats.**

All W=10 runs were in one VM boot: rebooting the development VM is not practical inside a session. Fresh containers, idle baselines per run, and a fixture rebuilt in this session are the independence measures.

## 13. Results: three valid observations per required workload

| Workload | Run 1 | Run 2 | Run 3 | Worst | Minimum margin | Range | Verdict |
|---|---|---|---|---|---|---|---|
| W=10 `x10` | +31.1 | +31.0 | +28.0 | +31.1 | 18.9 | 3.1 ms | **PASS ×3** |
| W=10 `p3x3` | +48.2 | +43.1 | +42.4 | +48.2 | **1.8** | 5.8 ms | **PASS ×3** |
| W=6 `p3x2` | +27.0 | +30.3 | +27.9 | +30.3 | 19.7 | 3.3 ms | **PASS ×3** |
| W=3 `p3x1` | +9.2 | +11.8 | +9.0 | +11.8 | 38.2 | 2.8 ms | **PASS ×3** |

Values are worst-endpoint Δp95 in ms. **Every endpoint in every run is ≤ 50 ms** (§14). No result was averaged.

## 14. Per-endpoint idle and loaded p50 / p95 / p99 (ms) and Δp95

| Run | Condition | `/books` p50 / p95 / p99 | `/books/:id` p50 / p95 / p99 | `/sync-map` p50 / p95 / p99 | Δp95 `/books` / `/books/:id` / `/sync-map` | Worst Δ | Margin | Reader errors |
|---|---|---|---|---|---|---|---|---|
| W10-run1 | idle | 3.1 / 5.8 / 10.2 | 4.9 / 9.7 / 15.6 | 17.9 / 25.8 / 30.1 | – | – | – | 0 |
| W10-run1 | **x10** | 3.1 / 8.9 / 40.6 | 4.9 / 14.0 / 47.4 | 19.9 / 56.9 / 103.4 | +3.1 / +4.2 / +31.1 | **+31.1** | 18.9 | 0 |
| W10-run1 | **p3x3** | 4.2 / 25.8 / 53.5 | 8.0 / 42.7 / 74.2 | 25.4 / 74.0 / 113.8 | +20.0 / +33.0 / +48.2 | **+48.2** | 1.8 | 0 |
| W10-run2 | idle | 3.1 / 5.8 / 9.5 | 5.0 / 9.6 / 15.4 | 18.4 / 29.1 / 34.3 | – | – | – | 0 |
| W10-run2 | **x10** | 3.1 / 8.4 / 40.6 | 5.1 / 15.4 / 48.7 | 20.0 / 60.0 / 95.2 | +2.6 / +5.7 / +31.0 | **+31.0** | 19.0 | 0 |
| W10-run2 | **p3x3** | 4.2 / 25.2 / 45.4 | 7.5 / 39.4 / 68.7 | 25.9 / 72.1 / 104.2 | +19.3 / +29.7 / +43.1 | **+43.1** | 6.9 | 0 |
| W10-run3 | idle | 3.0 / 5.8 / 8.7 | 4.8 / 9.0 / 15.7 | 17.8 / 26.4 / 31.5 | – | – | – | 0 |
| W10-run3 | **x10** | 3.0 / 8.1 / 38.6 | 5.0 / 16.8 / 52.0 | 19.5 / 54.5 / 84.2 | +2.3 / +7.8 / +28.0 | **+28.0** | 22.0 | 0 |
| W10-run3 | **p3x3** | 4.0 / 24.9 / 47.5 | 7.2 / 41.8 / 62.7 | 26.0 / 68.8 / 100.1 | +19.1 / +32.8 / +42.4 | **+42.4** | 7.6 | 0 |
| W6-run1 | idle | 2.9 / 5.6 / 12.9 | 4.9 / 9.2 / 15.5 | 18.0 / 27.0 / 32.6 | – | – | – | 0 |
| W6-run1 | **p3x2** | 3.8 / 18.3 / 44.5 | 5.8 / 27.6 / 48.0 | 22.3 / 54.0 / 85.9 | +12.7 / +18.4 / +27.0 | **+27.0** | 23.0 | 0 |
| W6-run2 | idle | 3.0 / 5.8 / 10.6 | 4.9 / 9.1 / 15.0 | 18.1 / 26.7 / 31.5 | – | – | – | 0 |
| W6-run2 | **p3x2** | 3.9 / 19.9 / 41.5 | 5.7 / 24.2 / 39.1 | 22.6 / 57.1 / 81.7 | +14.1 / +15.1 / +30.3 | **+30.3** | 19.7 | 0 |
| W6-run3 | idle | 2.9 / 5.5 / 9.0 | 4.9 / 9.1 / 15.8 | 18.0 / 27.0 / 32.1 | – | – | – | 0 |
| W6-run3 | **p3x2** | 3.8 / 16.2 / 39.1 | 5.8 / 23.7 / 52.5 | 23.1 / 54.9 / 93.9 | +10.6 / +14.6 / +27.9 | **+27.9** | 22.1 | 0 |
| W3-run1 | idle | 3.1 / 5.8 / 10.8 | 4.9 / 8.5 / 13.7 | 18.2 / 27.2 / 33.1 | – | – | – | 0 |
| W3-run1 | **p3x1** | 3.1 / 7.9 / 17.2 | 5.0 / 12.0 / 27.7 | 20.0 / 36.4 / 53.1 | +2.0 / +3.5 / +9.2 | **+9.2** | 40.8 | 0 |
| W3-run2 | idle | 3.0 / 5.2 / 8.4 | 4.6 / 8.8 / 18.6 | 18.0 / 27.4 / 30.9 | – | – | – | 0 |
| W3-run2 | **p3x1** | 3.0 / 6.8 / 16.4 | 5.0 / 12.4 / 22.9 | 19.9 / 39.2 / 56.2 | +1.6 / +3.6 / +11.8 | **+11.8** | 38.2 | 0 |
| W3-run3 | idle | 3.0 / 5.6 / 11.8 | 4.8 / 8.7 / 13.0 | 17.9 / 28.4 / 34.3 | – | – | – | 0 |
| W3-run3 | **p3x1** | 3.0 / 7.3 / 19.2 | 5.0 / 10.6 / 26.2 | 19.6 / 37.4 / 52.8 | +1.7 / +1.9 / +9.0 | **+9.0** | 41.0 | 0 |

**Comparison with the pre-PO-047 baseline.** Baseline = PO-045 code, default GC, same harness and day (PO-046 runs B1/B2); clearly labelled as a different configuration.

| Workload | Baseline worst Δ | PO-047 worst Δ (3 runs) |
|---|---|---|
| `x10` | +89.9 / +89.3 | +31.1 / +31.0 / +28.0 |
| `p3x3` | +140.0 / +135.7 | +48.2 / +43.1 / +42.4 |
| `p3x2` | +103.9 (PO-045) | +30.3 max |
| `p3x1` | +37.9 (PO-045) | +11.8 max |

The PO-047 loaded `p3x3` sync-map p95 (68.8–74.0 ms) is at or below the baseline's **idle** sync-map p95 (69.4–80.4 ms).

## 15. Margin and confidence

| Workload | Margin |
|---|---|
| `p3x3` (minimum) | **1.8 ms** (run 1); 6.9 and 7.6 ms in runs 2 and 3. Mean of the three Δ = 44.6 ms, shown for information only (no averaging is used for the verdict) |
| Other workloads | ≥ 18.9 ms |

**Why `p3x3` stays tight:**

- **The load is closed-loop.** PO-047 runs `p3x3` at **9.1 turns/s**, against 3.9–4.4 for the baseline, so the API does about twice the research work while the reader stays within budget.
- **The idle reference also fell** (sync-map p95 26–29 ms, against 69–80 ms for the baseline and ≈ 43 ms in PO-046's single-threaded-GC runs). That makes the relative criterion stricter. Part of the idle improvement may be session-to-session host variance.

**Confidence:**

- High that PO-047 meets the criterion under these conditions (9/9 valid runs).
- **Medium that `p3x3` would hold robustly** on a different host or kernel, or across further runs. A run above 50 ms is plausible given the 1.8–7.6 ms margins and PO-046's earlier diagnostic value of +49.8 ms.
- The production image and kernel were not measured under load; the harness uses the same compiled code, base image, flag and cap.

## 16. Research-turn admission and completion

| Workload | Turns completed per run | Failed / refused | Turn p50 / p95 (ms) | Throughput (turns/s) |
|---|---|---|---|---|
| W=10 `x10` (10-book) | 101 / 99 / 102 | **0 / 0** | 396–402 / 640–684 | 2.40–2.46 (baseline 1.23–1.42; p50 664–728 ms) |
| W=10 `p3x3` | 540 / 537 / 522 | 0 / 0 | 325–330 / 471–483 | 9.05–9.11 (baseline 3.89–4.35) |
| W=6 `p3x2` | 349 / 348 / 355 | 0 / 0 | 260 / 403 (run 1) | 7.4 |
| W=3 `p3x1` | 179 / 178 / 180 | 0 / 0 | 202 / 322 (run 1) | 4.8 |

10-book probe: W=6 and W=3 → `refused`, `budget_unavailable`, `guard: exceeds_limit` (expected; not evidence for PO-027). **The ten-book commitment is met at W=10.**

## 17. CPU, GC, throttling, memory and event loop (W=10; PO-047 runs 1–3 vs baseline B1/B2)

| Measure | PO-047 `x10` | Baseline `x10` | PO-047 `p3x3` | Baseline `p3x3` |
|---|---|---|---|---|
| cgroup CPU p50 | 85% | 89–90% | 95–96% | 98% |
| Throttled periods | 145–161 | 357–385 | 351–371 | 883–965 |
| Main-thread GC count / total ms | 3,898–3,916 / 3,899–4,194 | 4,033–4,054 / 10,007–16,539\* | 4,562–4,605 / 6,660–7,044 | 4,881–4,989 / 18,544–18,584 |
| GC pause p99 / max (ms) | 6.0–6.8 / 33–46 | 47.5–55.9 / 328 (and 7,218\*) | 8.8–10.4 / 51–63 | 77–79 / 104–126 |
| Event-loop delay p99 / max (ms) | 48–54 / 270–287 | 114–118 / 350 (7,239\*) | 51–56 / 93–117 | 111–121 / 261–301 |
| Event-loop stalls ≥ 100 ms | 4–9 | 42–49 | 0–1 | 56–81 |
| RSS p50 / max (MB) | 168–172 / 211–225 | 177–181 / 212–236 | 169–171 / 204–211 | 171–174 / 213–227 |
| Heap max / external max (MB) | ≈ 70–71 / 80–122 | ≈ 62–65 / 105–142 | ≈ 71 / 99–109 | ≈ 61 / 102–111 |
| S2 queue max; worker timeouts or crashes | 6; 0 | 6; 0 | 5; 0 | 4–6; 0 |

\* Baseline B2 `x10` contained a 7.2 s host freeze.

**Idle:** sync-map p95 26–29 ms vs 69–80 ms; GC pause p99 4.4–4.6 vs 9–11 ms; throttled periods 25–30 vs 121–122.

## 18. API-wide stability

- **GC pauses:** single-threaded GC produced **no long pauses**. Main-thread pause p99 and max fell at idle and under load, because GC no longer waits on quota-starved helper threads. The largest single pause in all PO-047 runs was 62.7 ms (baseline: 328 ms, without counting the freeze).
- **Reader latency:** improved at idle and under load on every endpoint (§14); 0 HTTP errors in 27,000 measured reader requests.
- **Memory:** RSS max 202–229 MB (limit 512 MB), the same as the baseline. Within load windows RSS rose 0–26 MB (baseline 5–13 MB) with heap bounded at 56–63 MB, and there was no accumulation across consecutive conditions on the same boot (raw `rssTimelineMb`). **Limitation:** windows of ≤ 56 s cannot exclude slow growth over hours.
- **Worker:** start-up, operation and recovery verified under the flag (§5, §10); 0 failures under load.
- **Restart and shutdown:** the production image starts healthy and stops cleanly in 0.21 s (143).
- **Throughput and latency:** research turns are about 40–55% faster at p50 and throughput is up to ~2×; there are no failures.
- **Unrelated API operations:** the flag is process-wide, but every API unit and integration suite passes, and reader endpoints improved. No other API workload (auth, payments, social) was load-tested; the flag affects only GC scheduling, not semantics.

**No adverse finding was recorded.**

## 19. E-1 retrieval measurement

**Run:** `NEM023_PERF=1 NEM023_PERF_KEEP=1 … retrieval-performance.int-spec.ts`. Uncapped host, real MinIO, PO-047 read path and S2 worker, default GC (jest process).

| Session | Retrieval p50 / p95 (ms) | Per-object fetch median | n |
|---|---|---|---|
| **PO-047** | **286 / 603** | 6.6 ms | 100 |
| PO-046 | 428 / 763 | – | 100 |
| PO-045 | 146 / 620 | 10.8 ms | 100 |

- **Query mix (p50 by match count):** 0 → 7 ms; 42–1,145 → 58–93 ms; 2,322–9,855 → 167–342 ms.
- **SQL ranking:** selective-query SQL p50 1.7 ms, but high-match queries scale with ranking work.
- **S2:** per-object fetch median 6.6 ms; the suite's own hash + decode measure is 9.0 ms.

**E-1: OPEN** (p95 603 vs 150 ms). The ranking component (out of scope) dominates. Checkpoint E is **not** qualified by Q-11 alone.

## 20. Host-stall observations and limitations

- **No host freeze ≥ 1 s occurred in any of the 9 qualification runs.** Earlier sessions saw them in 11 of 59 PO-046 conditions.
- The idle reference differed noticeably from earlier sessions (§15).
- **Not tested:**
  - the production host and kernel under load;
  - a VM reboot between W=10 runs;
  - sustained multi-hour load.
- The load is synthetic and closed-loop.

## 21. Remaining exceptions and risks

| Item | Status |
|---|---|
| **`p3x3` margin** | Passes 3/3, but with 1.8–7.6 ms. **Risk** that a further run, or another host, exceeds 50 ms |
| **E-1** | **OPEN** (603 ms) |
| Checkpoint E | **NOT QUALIFIED** (E-1, and PA/PO review of Q-11 pending) |
| DV-1: adapter fallback | `StorageBookText` keeps a `getBytes` fallback for storage doubles that implement only the accepted NEM-023 surface. This keeps `storage-book-text.spec.ts` unmodified. The runtime `StorageService` always takes the new path. The alternative is an intent-preserving amendment of that test, which needs PO approval. **For PA** |
| DV-2: protected test seams | `StorageService` has `s2IdleTimeoutMs`/`s2TotalTimeoutMs` and `createS2Agent` (overridden only by test subclasses: short timeouts, trusting a test CA). Production values are fixed |
| DV-3: committed test fixtures | Throwaway test certificates; the CA key was deleted |
| Size bound | 500 MB = the enforced upload limit; objects near it cannot fit in 512 MB on either path |
| Transport CRC | The SDK's optional CRC32 response check is not used on this path. Full-object SHA-256 remains the integrity gate |
| Environment | The main checkout's `services/web/node_modules` was found empty (§11). Not modified by this work; needs a reinstall by the developer for host-side web builds |
| Earlier exceptions (E-2, NEM-022 coverage, D-8, cancel-record persistence, in-process cancel, TT-14, SSE idle timeout, web coverage gate, freeze anomaly) | Unchanged; not waived |

## 22. Rollback

Both rollbacks are code and configuration only; there is no schema, data or infrastructure change.

- **Component C:** revert `3233ec2` (the Dockerfile CMD line). The next image build runs `node dist/main` again.
- **Component A:** revert `f624bcb`. `StorageBookText` returns to `getBytes`. All S2 semantics are unchanged.
- Either can be reverted alone. Q-11 would then regress towards the PO-046 values (C alone: `p3x3` ≈ +55–60 ms; A alone: no gain).

## 23. Resource and operating-cost effects

- **No new infrastructure, container, CPU, RAM or dependency.**
- CPU use under load is lower per unit of work (fewer throttled periods while doing ~2× the research turns).
- RSS is unchanged.
- No recurring cost.

## 24. Raw evidence and reproduction

**Raw file:** [`2026-11-11-NEM-024-po-047-q11-requalification-raw-measurements.json`](2026-11-11-NEM-024-po-047-q11-requalification-raw-measurements.json) (≈ 147 KB). It contains:

- 9 runs, each with the recorded process `cmdline`;
- per-endpoint percentiles and status counts, Δ, server stats, event loop, GC by kind, throttling, timeline summaries, the per-second RSS series, S2-pool counters, per-thread CPU, freeze lists;
- E-1;
- the production-image verification facts.

It contains no secrets, URLs, keys or text (checked). The baseline is in the PO-046 raw file (runs `B1-none`, `B2-none`).

**Reproduce:**

1. Start disposable `postgres:16-alpine`, `redis:7-alpine` and `minio/minio` on 127.0.0.1.
2. Build the fixture with the NEM-023 performance suite (`NEM023_PERF_KEEP=1`).
3. `npx tsc -p tests/perf/tsconfig.json --outDir <out>`.
4. Per run, start a fresh container: `docker run --cpus=1 --memory=512m --memory-swap=512m --network host … node:20-alpine node --single-threaded-gc out/tests/perf/q11-harness.js` (with `INTELLIGENCE_TURN_WEIGHT_LIMIT=<W>`).
5. Run `Q11_DOCKER_STATS=off Q11_DIAG=1 node <out>/tests/perf/q11-client.js <W> <scenarios> <out.json> <container>`.
6. For the exact-read integration suite: `NEM023_MINIO_*=… npx jest -c jest.integration.config.js tests/integration/storage`.

All disposable containers and images (`po047-*`) were removed.

## 25. Final implementation verdict

**Components C and A are implemented within PO-047's scope, verified functionally and for security, and the full regression is green.**

- **Q-11:** met in all 9 required valid runs (every endpoint ≤ 50 ms), with the ten-book turn admitted and completed at W=10. The W=10 `p3x3` margin is thin (minimum 1.8 ms).
- **E-1:** remains OPEN.
- No merge, deployment or activation was performed.

## 26. Decisions still required

| Decision | Owner |
|---|---|
| Independent review of scope, security of `getBytesExact`, flag placement, the full-object integrity contract, failure handling, regression trustworthiness, the Q-11 evidence and its `p3x3` margin | PA |
| DV-1: accept the adapter fallback, or authorize an intent-preserving amendment of `storage-book-text.spec.ts` | PA / PO |
| Whether the thin `p3x3` margin is acceptable for development progression, or more qualification evidence is needed (for example additional runs or a production-like host) | PO |
| Acceptance or rejection of PO-047, and the final status of PO-045 | PO |
| E-1 (ranking): a separate authorization | PO |
| Checkpoint E: remains blocked pending E-1 and the decisions above | – |
