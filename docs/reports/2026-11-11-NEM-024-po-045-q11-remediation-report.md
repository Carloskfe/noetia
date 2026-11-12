# NEM-024 — PO-045 Q-11 Performance Remediation (Option D + A): Implementation and Requalification Report

**Date:** 2026-11-11 · **Authority:** [PO-045](../operating-framework/decisions/product-owner/PO-045-nem-024-q11-performance-remediation-authorization.md) (limited scope) · **Branch / PR:** `feat/nem-024-checkpoint-b`, Draft PR #56 · **Review:** independent Product Architecture (not yet performed)
**Starting commit:** `d937d2b57081ea805428d5bc667cfded28250a32` (verified equal to the remote branch head before execution) · **Ending commit:** the commit that adds this report (see PR #56)

## 1. Executive summary and verdict

| Question | Answer |
|---|---|
| Implementation (Option D + A) | **Complete.** One bounded S2 worker thread per API process does SHA-256 (through `computeTextHash`), whole-object strict UTF-8 validation and byte-level passage slicing. The storage read stays on the main path. No cache, no SQL change, no contract or configuration change |
| Correctness | **Equivalent.** Byte-level slicing equals `sliceCodePointRanges(decodeUtf8(bytes))` on fixed cases, 2,000 randomized cases and a 2.2 MB book, including BOM handling. `isStrictUtf8` agrees with `decodeUtf8` on 3,000 randomized byte strings. Every worker failure fails closed (`unavailable`); a hash mismatch stays `stale` |
| Regression | **Green.** API unit 2,005/2,005 (141 suites; branches 80.78%); API integration 216/216 (1 opt-in suite skipped, run separately); 6 architecture suites pass unchanged; TypeScript 0 errors; API lint 0 errors in `src`; API and web production builds complete; web unit 448/448; Playwright 2/2 (en, es) |
| **Q-11** (reader p95 Δ ≤ 50 ms, sampler off) | **NOT QUALIFIED.** W=10 `x10` **+90.7 / +93.9 ms ✗**; W=10 `p3x3` **+141.5 / +135.2 ms ✗**; W=6 `p3x2` **+103.9 ms ✗**; W=3 `p3x1` **+37.9 ms ✓** (but W=3 cannot admit a 10-book turn) |
| Improvement against a same-session baseline (`d937d2b`) | Worst Δ: `x10` +176.9 → +90.7/+93.9 (−47%); `p3x3` +194.7 → +141.5/+135.2 (−29%); `p3x2` +159.9 → +103.9 (−35%); `p3x1` +67.8 → +37.9 (−44%). Event-loop p99 under load fell from 194–233 to 111–116 ms at W=10 |
| 10-book capability at W=10 | **Intact.** 105 and 101 ten-book turns completed at W=10, 0 failed, 0 refused. At W=6 and W=3 the 10-book probe is refused (`guard: exceeds_limit`), as before; that is **not** evidence for the 10-book commitment |
| **E-1** (retrieval p95 ≤ 150 ms) | **OPEN.** p50 146 / p95 620 ms. The PostgreSQL ranking component (out of scope) dominates high-frequency queries |
| Checkpoint E | **Still NOT QUALIFIED — Q-11 BLOCKING.** |
| PA review / PO acceptance | **Awaiting** independent PA review and a PO decision. This report is agent self-assessment, not PA approval |

Per PO-045 §6.3, Q-11 still fails, so the findings are preserved here and **no further remedy was attempted.**

## 2. Commits

| Commit | Content |
|---|---|
| `92fecc5` | Governance: PO-045 record; mission status, register and decision index updated |
| `4ecd692` | Implementation and unit tests |
| `f3baac1` | Test tooling: Q-11 diagnostics gain S2-pool counters and per-thread CPU (opt-in) |
| this commit | This report, raw measurements, and status updates |

## 3. Changed files and why

| File | Change | Reason |
|---|---|---|
| `services/api/src/knowledge/retrieval/utf8-slice.ts` (new) | `sliceUtf8CodePointRanges`, `isStrictUtf8` (`buffer.isUtf8`) | Option A: slice by code points from bytes; validate the whole object without decoding it |
| `services/api/src/knowledge/retrieval/s2-worker.ts` (new) | Worker entry. Pure `runS2Job` (hash → UTF-8 → slice) and a message loop attached only inside a worker carrying the S2 role marker | Option D: CPU work off the event loop. Imports `computeTextHash`; defines no hash of its own |
| `services/api/src/knowledge/retrieval/s2-verification.service.ts` (new) | `S2VerificationPool`: one worker, bounded queue, timeouts, respawn, cool-down, shutdown, counters; `processS2Verifier()` process singleton; `markOwnedBytes` | Bounded lifecycle and fail-closed semantics (PO-045 §3.3) |
| `services/api/src/knowledge/retrieval/lexical-retrieval.service.ts` | The per-book S2 block delegates to `S2Verifier`. Optional 5th constructor parameter, defaulting to the process pool. `onModuleDestroy` stops the worker | Integration point. SQL, ordering, budget, metrics and return shapes unchanged |
| `services/api/src/knowledge/retrieval/storage-book-text.ts` | Marks each freshly concatenated, unpooled read buffer as owned (transferable) | Zero-copy transfer only where ownership is certain |
| `services/api/tests/unit/knowledge/retrieval/utf8-slice.spec.ts` (new) | Fixed + randomized equivalence; UTF-8 acceptance parity | §3.4 |
| `services/api/tests/unit/knowledge/retrieval/s2-worker.spec.ts` (new) | Job outcomes and ordering | §6.1 |
| `services/api/tests/unit/knowledge/retrieval/s2-verification.service.spec.ts` (new) | Real-thread lifecycle: init, completion, saturation, queue timeout, job timeout, crash, startup failure, cool-down, shutdown, failure storm, buffer ownership, the real entry point | §6.1 |
| `services/api/tests/unit/knowledge/retrieval/lexical-retrieval.s2-worker.spec.ts` (new) | Every worker outcome → existing exclusion and shape; no text from an unverified book | §6.1 |
| `services/api/tests/perf/q11-diagnostics.ts`, `tests/perf/README.md` | S2-pool counters, per-thread CPU, PO-045 procedure | Measurement only (opt-in `Q11_DIAG`) |

**Not changed:** `knowledge.module.ts` (the retrieval-architecture test pins its imports), every protected test, SQL, migrations, Docker or compose files, environment variables, Node flags, concurrency defaults, web and mobile code.

**Build wiring (PO-045 §5, permitted minimal):**

- The service imports the worker module by value (`S2_WORKER_FILE`), so any `tsc`/`nest build` that compiles the service also emits `s2-worker.js` next to it.
- From compiled JavaScript (production `dist/`, perf harness) the worker runs `s2-worker.js` directly.
- Only from TypeScript sources (jest, ts-node) is it loaded through `ts-node`'s transpile-only register. `ts-node` is an existing devDependency and is never reached from `dist/`.
- **Verified:**
  - `nest build` emits `dist/knowledge/retrieval/{s2-worker,s2-verification.service,utf8-slice}.js`;
  - a smoke test from `dist/` spawned the compiled worker (no ts-node) and returned the correct `ok` and `stale` outcomes;
  - the production Dockerfile copies `dist/` unchanged.

## 4. Worker architecture and lifecycle

```
main thread (event loop)                                  S2 worker thread (one per process)
  retrieve(): validate → SQL (unchanged) → per result book:
    bytes = BookTextPort.read(key)      [async, main]
    S2Verifier.verify(bytes, hash, ranges) ──postMessage──▶ runS2Job:
       (bytes transferred zero-copy if owned,                1. computeTextHash(bytes) === hash ? else stale
        otherwise copied first)                              2. isStrictUtf8(whole object)    ? else invalid_utf8
                                                             3. sliceUtf8CodePointRanges → passages
    ◀──────────────── { ok, passages } | stale | invalid_utf8 | error
  exclusions / budget / ordering (unchanged)
```

- **One worker per process.** `processS2Verifier()` is a lazy singleton. The worker starts on the first job, not at boot. One job executes at a time.
- **Start-up:** the worker posts `ready` after loading. Until then, jobs wait in the queue.
- **Shutdown:** `LexicalRetrievalService.onModuleDestroy` (Nest `enableShutdownHooks` is already on in `main.ts`) terminates the worker and resolves every running and queued job as `unavailable/shutdown`. A later job would start a fresh worker; the pool is not permanently closed, so test processes that build several app instances keep working.
- **Idle:** the worker is `unref()`'d when idle, so it never keeps a process alive. It is `ref()`'d while jobs are pending.
- **Memory:** the worker isolate has `resourceLimits.maxOldGenerationSizeMb = 128`, a Worker constructor option rather than a process flag. Book bytes are external `ArrayBuffer` memory and are dropped after each job. Nothing is cached between jobs.
- **Privacy:**
  - no logging anywhere in `retrieval/` (architecture test);
  - counters only, with no text, hash, key or identifier;
  - errors carry fixed labels only.

## 5. Bounds and failure behaviour

| Bound (default) | Value | Rationale |
|---|---|---|
| Queue capacity | 32 jobs | ≥ 3 × the 10 books one W=10 admission can put in flight. Observed max depth under load: 7 |
| Queue wait | 5 s | Also bounds worker start-up as seen by a job. Observed mean 46–95 ms, max 470 ms |
| Job execution timeout | 2 s | A 2 MB book takes ~8 ms in the capped container. Observed worker busy time max 201 ms under load |
| Worker start-up timeout | 5 s | Compiled start-up is ~30–100 ms |
| Consecutive failures before cool-down | 3 | No retry loop. A respawn happens only when a job is waiting |
| Cool-down | 5 s | Everything queued, and every new submission, fails fast without spawning |

| Event | Running job | Queued jobs | Worker |
|---|---|---|---|
| Hash mismatch | `stale` | unaffected | kept |
| Invalid UTF-8 (whole object) | `unavailable` (`invalid_utf8`); no partial passages | unaffected | kept |
| Exception in the job | `unavailable` (`worker_error`) | unaffected | kept |
| Malformed reply | `unavailable` (`bad_reply`) | unaffected | kept |
| Job timeout | `unavailable` (`timeout`); **not re-run** | kept for the next worker (never started, so not a retry) | terminated, lazily respawned |
| Crash / exit / uncaught error | `unavailable` (`crashed`); **not re-run** | kept for the next worker | discarded, lazily respawned |
| Start-up failure or no `ready` | – | kept until their own wait deadline or the cool-down | discarded; counted towards the cool-down |
| Queue full | new job `unavailable` (`saturated`) at once | unaffected | kept |
| Queue wait exceeded | that job `unavailable` (`queue_timeout`) | unaffected | kept |
| Cool-down active | new jobs `unavailable` (`cooling_down`) at once | failed (`cooling_down`) | none started |
| Shutdown | `unavailable` (`shutdown`) | failed (`shutdown`) | terminated |

Properties:

- `verify()` never rejects and always resolves.
- Every outcome other than `ok` maps to the existing `stale`/`unavailable` exclusion in `retrieve()`, and that book contributes no text.
- No main-thread fallback exists.
- S2 runs before any reservation, so worker recovery can never initiate a provider call or a ledger reservation.
- **Observed in the real runs:** two host freezes (11 s and 24 s, §11) each produced exactly one job timeout and one queue timeout. Both failed closed as `unavailable`; the worker was replaced; turns continued (0 failed turns).

**Byte buffers.** A buffer is transferred only if all of these hold:

- the runtime S2 adapter marked it as owned;
- it is a whole, non-shared `ArrayBuffer`;
- it is larger than zero bytes.

Node's pooled small `Buffer`s (< 4 KiB slices of a shared 8 KiB pool) are never marked. Any other buffer (test fixtures, caller-retained or reused buffers) is copied first, at 0.3–0.9 ms per 2 MB. Tests prove that:

- unmarked buffers are never detached and remain reusable;
- the shared pool and its neighbours survive;
- a marked buffer is detached exactly once.

In every Q-11 run, 100% of jobs were zero-copy transfers (for example 1,243 transferred, 0 copied).

## 6. Correctness and Unicode equivalence

The reference is the accepted `sliceCodePointRanges(decodeUtf8(bytes), ranges)`, which uses a fatal decoder with `ignoreBOM: true`.

**Fixed cases**, each asserting equality with the reference:

- ASCII and Spanish (`Érase … 𝔘na canción antigua`);
- astral characters and emoji with skin-tone modifiers;
- combining marks (`é`, `ñ`), with every (start, end) pair up to n+1;
- **BOM:** a leading U+FEFF is code point 0 and is *kept* in passages, as `ignoreBOM: true` keeps it; also a mid-text U+FEFF and a double BOM;
- CRLF, CR, LF, U+2028, U+2029;
- empty, duplicate, overlapping and unordered ranges;
- zero-length, negative, inverted, non-integer, NaN, ±Infinity, −0, and out-of-range offsets (all `null`, as before), plus the end-of-text offset;
- an empty object.

**Randomized cases** (deterministic PRNG, seeds in the spec):

- 2,000 texts over a 29-symbol alphabet (BOM, astral, combining marks, line separators, NUL, U+FFFD, U+FFFF, U+10FFFF) × 1–12 random ranges, including invalid offsets: **0 mismatches**;
- 3,000 random and mutated or truncated byte strings: `isStrictUtf8` and `decodeUtf8` acceptance **agree on every case**.

**Multi-megabyte:**

- a 2.2 MB mixed-script book with 43 passages (first, last, end-of-text and random positions): identical;
- the micro-benchmark (§10) re-checked identity on a 2.29 MB text.

**Invalid UTF-8.** Validation covers the whole object before any slicing. An object invalid anywhere returns `invalid_utf8`, and no passage of it is served, even if every requested range is itself valid. Order is unchanged: the hash is checked first, so a modified object that is also invalid is reported as `stale`, as before.

**Contract checks** (unit + integration, unchanged suites):

- per-request re-read and re-verify;
- a replaced object fails closed at once;
- excerpts keyed by citation (the Checkpoint B F-1 fix);
- token-budget trimming in rank order;
- exclusion sorting;
- metrics names and calls.

## 7. Regression, architecture, lint and build results

| # | Command (all on the development VM, sequential) | Result |
|---|---|---|
| 1 | `services/api`: `npx jest --maxWorkers=2 --coverage` | **141 suites, 2,005/2,005 passed**, 0 skipped. Global coverage 94.38% statements / **80.78% branches** / 92.50% functions / 95.58% lines; threshold 80% met. Checkpoint E: 80.20% branches. New `s2-verification.service.ts`: 95–96% statements, 94.7–96% branches |
| 2 | Architecture and protected-boundary suites (inside #1) | **Pass, unmodified:** `knowledge/architecture`, `gateway-architecture`, `contract-architecture`, `retrieval-architecture` (single `computeTextHash` definition, no logging, no network, module imports pinned), `turn-architecture`, `cost-architecture` |
| 3 | `services/api`: `npx jest -c jest.integration.config.js --runInBand` (disposable PostgreSQL 16, Redis 7, MinIO; `NODE_OPTIONS=--experimental-vm-modules`) | **12 suites passed, 1 skipped** (opt-in NEM-023 performance, run separately in #9). **216 passed, 1 skipped, 0 failed**: NEM-023 retrieval and retrieval-e2e (real MinIO, real worker), NEM-024 turn-question, turn-stream, turn-recovery (fencing, races, idempotency), sessions, ledger, gateway-e2e, account deletion, migrations |
| 4 | `services/api`: `tsc --noEmit` (`tsconfig.json`, `tsconfig.test.json`) | 0 errors |
| 5 | `services/api`: `eslint "src/**/*.ts"` | **0 errors**, 256 warnings (pre-existing `no-explicit-any`; same as Checkpoint E) |
| 6 | `services/api`: `eslint "tests/**/*.ts"` | **12 errors, all pre-existing and identical to Checkpoint E** (10 on `main`, 2 in the protected LW-5 test, N-2). **None** in PO-045 files, which have warnings only |
| 7 | `services/api`: `npm run build` (`nest build`) + `dist/` worker smoke test | **Completed**; worker emitted and executed from `dist/` without ts-node |
| 8 | `services/web`: `npx jest --coverage --maxWorkers=2` | **21 suites, 448/448**. The coverage gate fails, as it did before PO-045 (branches 76.25%); no web source changed |
| 9 | `services/web`: `tsc --noEmit` · `next lint` | 0 errors · 0 errors, 15 warnings (pre-existing) |
| 10 | `services/web`: `next build` (`NODE_OPTIONS=--max-old-space-size=2048`) | **Completed**; `ƒ /research/[sessionId]` 8.87 kB, 124 kB first load (unchanged) |
| 11 | `services/web`: Playwright `tests/e2e/research-qa.spec.ts` against `next start` (production build) | **2/2 (en, es)** |

**Test-stability note.** Three PO-045 lifecycle tests first failed intermittently under coverage. They used wall-clock sleeps and tight bounds, and this VM has multi-second host stalls (§11). They were rewritten in two steps: first to wait on observable pool state, then with freeze-tolerant bounds. After the first step, 1 of 14 repeated runs still failed: a 5 s jest timeout during a host stall. After the final change, 4 consecutive runs of the spec passed, and so did the full suite (#1). No production bound was changed to make tests pass.

## 8. Q-11 requalification

**Method** (PO-045 §6.3):

- Q-11 harness (real `AppModule`) on `node:20-alpine`, `--cpus=1 --memory=512m --memory-swap=512m`.
- Disposable PostgreSQL, Redis and MinIO; simulated provider only.
- The same three protected reader endpoints; 20 warm-ups + 1,000 measured requests per endpoint and condition.
- Idle and load measured in the same run.
- **Governing client method: sampler off** (`Q11_DOCKER_STATS=off`); diagnostics on (`Q11_DIAG=1`).
- **Baseline:** the pre-remediation tree `d937d2b`, compiled separately and run in the **same session** with the same command.
- Fixture: 10 books × 2,000,000 code points (≈2.14 MB each), 17,780 chunks; 40 reader books with 3,000-phrase sync maps.

### 8.1 Results: reader p95 (ms) and Δ against the same run's idle

| Run | W | Load | `/books` | `/books/:id` | `/sync-map` | Worst Δ | ≤ 50 ms? |
|---|---|---|---|---|---|---|---|
| **Baseline `d937d2b`** | 10 | idle | 12.6 | 18.8 | 90.2 | – | – |
| Baseline | 10 | x10 | 14.9 (+2.3) | 25.6 (+6.8) | 267.1 (**+176.9**) | +176.9 | No |
| Baseline | 10 | p3x3 | 89.7 (+77.1) | 163.6 (+144.8) | 284.9 (**+194.7**) | +194.7 | No |
| Baseline | 6 | p3x2 | 71.8 (+59.1) | 100.8 (+81.0) | 248.2 (**+159.9**) | +159.9 | No |
| Baseline | 3 | p3x1 | 21.3 (+9.4) | 48.3 (+29.8) | 153.2 (**+67.8**) | +67.8 | No (a 19.5 s host freeze in this run) |
| **PO-045, run 1** | 10 | idle | 12.6 | 18.2 | 78.4 | – | – |
| PO-045, run 1 | 10 | **x10** | 19.8 (+7.2) | 57.9 (+39.7) | 169.0 (**+90.7**) | +90.7 | **No** (an 11.2 s host freeze) |
| PO-045, run 1 | 10 | **p3x3** | 81.7 (+69.1) | 107.6 (+89.4) | 219.9 (**+141.5**) | +141.5 | **No** (a 24.5 s host freeze) |
| **PO-045, run 2 (clean)** | 10 | idle | 11.4 | 16.6 | 78.6 | – | – |
| PO-045, run 2 | 10 | **x10** | 20.4 (+9.0) | 51.8 (+35.2) | 172.5 (**+93.9**) | +93.9 | **No** |
| PO-045, run 2 | 10 | **p3x3** | 76.4 (+65.1) | 102.6 (+86.0) | 213.8 (**+135.2**) | +135.2 | **No** |
| PO-045 | 6 | **p3x2** | 50.4 (+38.2) | 59.4 (+42.2) | 185.3 (**+103.9**) | +103.9 | **No** |
| PO-045 | 3 | **p3x1** | 15.4 (+2.8) | 22.8 (+4.2) | 115.8 (+37.9) | +37.9 | **Yes** |

**Q-11 verdict per required workload:**

| Workload | Verdict |
|---|---|
| W=10 `x10` | **FAIL** |
| W=10 `p3x3` | **FAIL** |
| W=6 `p3x2` | **FAIL** |
| W=3 `p3x1` | **PASS** |

Q-11 is **not qualified**. The criterion requires every applicable workload *and* 10-book admission at W=10; only W=3 passes, and W=3 refuses 10-book turns.

**10-book probe:**

- W=6: `refused`, `budget_unavailable`, `guard: exceeds_limit`.
- W=3: the same.
- W=10: ten-book turns admitted and completed (105 and 101 turns, 0 failed, 0 refused).

### 8.2 Reader p50 / p95 / p99, sync-map (the worst endpoint)

| Condition | Baseline | PO-045 (run 2; W=6 and W=3 single runs) |
|---|---|---|
| W=10 idle | 31.8 / 90.2 / 121.0 | 31.4 / 78.6 / 110.6 |
| W=10 x10 | 30.9 / 267.1 / 420.1 | 29.7 / 172.5 / 302.3 |
| W=10 p3x3 | 38.6 / 284.9 / 431.2 | 38.2 / 213.8 / 300.6 |
| W=6 p3x2 | 35.4 / 248.2 / 352.8 | 32.1 / 185.3 / 276.9 |
| W=3 p3x1 | 30.7 / 153.2 / 237.0 | 29.3 / 115.8 / 196.7 |

The p50 is unchanged; the tail is shortened. All per-endpoint p50/p95/p99/max values are in the raw file.

### 8.3 Server-side resources under load

| Measure | Base x10 | PO-045 x10 (run 1 / run 2) | Base p3x3 | PO-045 p3x3 (run 1 / run 2) | Base p3x2 | PO-045 p3x2 | Base p3x1 | PO-045 p3x1 |
|---|---|---|---|---|---|---|---|---|
| Event-loop delay p99 (ms) | 233 | 113 / 114 | 194 | 111 / 116 | 167 | 103 | 102 | 91 |
| Event-loop stalls ≥ 100 ms | 127 | 43 / 45 | 209 | 61 / 67 | 126 | 33 | 37 | 15 |
| Event-loop utilization p50 | 0.81 | 0.77 / 0.77 | 0.91 | 0.90 / 0.89 | 0.87 | 0.85 | 0.78 | 0.77 |
| cgroup CPU p50 | 91% | 88% / 88% | 97% | 98% / 98% | 95% | 95% | 87% | 88% |
| Throttled CFS periods | 483 | 489 / 366 | 933 | 1,183 / 890 | 678 | 538 | 308 | 279 |
| Main-thread GC count / total ms | 4,571 / 11,102 | 4,030 / 9,025 · 4,016 / 9,599 | 5,697 / 16,239 | 4,999 / 17,551 · 4,962 / 16,694 | 5,003 / 13,920 | 4,388 / 12,215 | 4,153 / 27,790* | 3,939 / 8,469 |
| RSS max (MB) | 170 | 222 / 226 | 163 | 213 / 214 | 158 | 204 | 151 | 207 |
| PostgreSQL connections (max / active) | 5 / 3 | 5/3 · 3/3 | 7 / 5 | 7/5 · 6/4 | 6 / 4 | 6 / 4 | 5 / 3 | 4 / 3 |

\* includes the 19.5 s freeze window.

**Research turns:**

| Condition | Baseline p50 / p95 (ms) | PO-045 p50 / p95 (ms) |
|---|---|---|
| W=10 x10 (10-book) | 813 / 1,223 | 695 / 1,156 · 718 / 1,201 |
| W=10 p3x3 | 807 / 1,216 | 707 / 1,042 · 675 / 1,009 |
| W=6 p3x2 | 606 / 919 | 535 / 828 |
| W=3 p3x1 | 421 / 610 | 370 / 596 |

| Condition | Baseline throughput (turns/s) | PO-045 throughput (turns/s) |
|---|---|---|
| W=10 x10 | 1.21 | 1.19 / 1.34 |
| W=10 p3x3 | 3.68 | 3.56 / 4.38 |
| W=6 p3x2 | 3.15 | 3.78 |
| W=3 p3x1 | 1.94 | 2.69 |

**0 failed turns and 0 guard rejections in every PO-045 condition.**

### 8.4 Worker resources

| Measure | x10 (run 2) | p3x3 (run 2) | p3x2 | p3x1 |
|---|---|---|---|---|
| Jobs settled (ok / unavailable) | 493 / 0 | 1,242 / 0 | all ok | all ok |
| Zero-copy transfers / copies | 494 / 0 | 1,243 / 0 | 100% transfers | 100% transfers |
| Queue depth max / sampled mean | 6 / 0.30 | 7 / 0.32 | 4 | 2 |
| Queue wait mean (ms) | 93 | 46 | 32 | 14 |
| Worker busy time, total (s) — wall time in jobs, including throttled time | 12.0 | 30.9 | 18.2 | 6.4 |
| Worker busy time, max per job (ms) | 201 (session max) | – | – | – |
| Timeouts / crashes / respawns | 0 / 0 / 0 | 0 / 0 / 0 | 0 | 0 |

Run 1 had 1 timeout and 1 queue timeout during the freezes (§5).

**Memory.** The worker adds ~50 MB of RSS under load: max 204–226 MB vs 151–170 MB for the baseline, against a 512 MB limit. This is the worker isolate plus transferred book buffers awaiting GC. Idle RSS is unchanged (133–139 MB vs 126–132 MB), because the worker starts on the first job.

**Per-thread CPU.** `/proc/self/task` shows, at p3x3:

| Thread | CPU (s) |
|---|---|
| Main thread | 53–56 |
| S2 worker | ≈14–15 |
| Four other Node/V8 helper threads (≈11 s each) | ≈43–44 |

Those four helper threads use ≈2.9–3.6 s each even at idle. The baseline tooling (`d937d2b`) had no per-thread capture, so no per-thread baseline exists.

### 8.5 Historical comparison: synchronous `docker stats` sampler (not the qualification result)

Sync-map p95 Δ:

| W=10 load | Sampler sync | Sampler off |
|---|---|---|
| x10 | +117.7 | +90.7 / +93.9 |
| p3x3 | +201.3 | +141.5 / +135.2 |

The client recorded ~1.04–1.14 s stalls every sample, and sync-map p99 rose to 1.09–1.18 s at idle as well as under load: the same N-3 artifact as PO-044.

### 8.6 Interpretation (measured; no remedy implied)

1. **The remedy removed the long synchronous S2 blocks:** event-loop p99 roughly halved at W=10, and stalls ≥ 100 ms fell by 65–70%. Byte-level slicing cut the per-book CPU from 15.5 to 8.3 ms (§10).
2. **The reader still fails at W ≥ 6 because the single CPU quota stays saturated.** cgroup CPU p50 is 88–98% and throttled periods are unchanged or higher. All threads (main, S2 worker, V8 helpers) draw on the same 100 ms / 100 ms CFS quota, so worker CPU still delays the reader through throttling, even though it no longer blocks the event loop.
3. **Why the PO-044 proxy passed and the implementation does not.** The proxy (`s2worker`) served book bytes from a per-key cache. That excluded the main-thread **storage fetch**: the AWS SDK stream, chunk buffers and a 2 MB `Buffer.concat` per book per request, plus the GC and helper-thread work these allocations cause. The real implementation must re-read every object (AC-11/P-2), so that work remains. Under load, `getBytes` wall p95 is 200–250 ms. PO-044 §6.1 had listed this exclusion as a limit of the proxy.
4. The 10-book commitment is unaffected, and research turns are faster than the baseline.

Options that would address this remaining contention fall outside PO-045: CPU or runtime configuration (PO-044 option E), moving the fetch, a separate container, or any change to the per-request re-read contract. They need a separate PA review and PO decision. **None was attempted.**

## 9. E-1 retrieval performance (separate)

**Run:** `NEM023_PERF=1 NEM023_PERF_KEEP=1 … npx jest -c jest.integration.config.js --runInBand tests/integration/knowledge/retrieval-performance.int-spec.ts`. Uncapped host, production retrieval defaults, real MinIO, retrieval through the S2 worker.

| Measure | PO-045 (2026-11-11) | Earlier sessions |
|---|---|---|
| Retrieval p50 / p95 / max (ms, n = 100) | **146 / 620 / 981** | PO-044: 133 / 416; Checkpoint E: 368 / 842; NEM-023: p95 594 |
| Per-query p50 by match count | 0 → 8 ms; 42–1,145 → 85–152 ms; 2,322–9,855 → 252–611 ms | – |
| SQL-only (selective) | p50 2.2 ms, max 34 ms | – |

**E-1 status: OPEN** (target p95 ≤ 150 ms). The high-match-count queries scale with the PostgreSQL ranking work (NEM-023 P-1 b, PO-044 §4), which PO-045 does not authorize changing.

**Recommendation:** a separate, bounded authorization for the ranking component (for example the candidate-cap proposal), with its own measurement.

## 10. Micro-benchmark (unloaded, median of 30)

Workload: 2,290,909-byte Spanish and astral text, 8 passages of 1,500 code points each.

| Step | Host (uncapped) | Container (1 vCPU / 512 MB) |
|---|---|---|
| SHA-256 (`computeTextHash`) | 2.96 ms | 1.60 ms |
| Old: full decode (`decodeUtf8`) | 8.38 ms | 8.39 ms |
| **Old: decode + `sliceCodePointRanges`** | **15.57 ms** | **15.49 ms** |
| New: `isStrictUtf8` (whole object) | 0.32 ms | 0.15 ms |
| New: byte-level slice | 9.94 ms | 7.34 ms |
| **New: validate + byte-level slice** | **10.93 ms** | **8.30 ms** (−46%) |
| Copy fallback (2 MB) | 0.31 ms | 0.90 ms |
| Output identical | yes | yes |

## 11. Remaining exceptions and risks

| ID | Item | Status |
|---|---|---|
| **Q-11** | Reader p95 Δ above 50 ms at W=10 (`x10`, `p3x3`) and W=6 (`p3x2`) | **OPEN — BLOCKING** (Checkpoint E not qualified) |
| **E-1** | Retrieval p95 620 ms vs 150 ms | **OPEN** (ranking SQL; separate authorization needed) |
| Freeze anomaly | Multi-second stalls on this VM (see below) | **OPEN pre-launch operational risk** (not investigated beyond the evidence below; the production host was not touched) |
| N-3 | ~1 s client outliers | Historical **measurement artifact** of the synchronous `docker stats` sampler (PO-044 §5.1). Reproduced again here with the sync sampler, absent with it off. Not conflated with the freezes |
| RSS | +~50 MB under load (worker isolate) | Within the 512 MB limit; documented |
| History re-materialization | `turn.service.ts` (D-10 history) still hashes and decodes on the main thread | Outside the retrieval path and outside PO-045 scope; not exercised by Q-11. **Observation only** |
| Earlier exceptions (E-2, NEM-022 coverage, D-8, cancel-record persistence, in-process cancel, TT-14, SSE idle timeout, web coverage gate) | – | Unchanged, not waived |

**Freeze anomaly evidence:**

- Seen in Q-11 runs: 11.2 s and 24.5 s (PO-045 W=10 run 1) and 19.5 s (baseline W=3).
- A bounded experiment on the **uncapped** VM (no cgroup), using a 40 s main-thread drift detector:
  - a spinning worker thread produced stalls of 5.2–7.2 s;
  - a spinning **separate process** produced a **31 s** stall in one of two runs;
  - idle: 14 ms.
- The anomaly is therefore **not specific to worker threads or to the API.** It is consistent with host/VM vCPU scheduling on this development machine.
- Twenty hang/respawn cycles of the pool outside jest: 18 completed in 1.0–2.0 s; 2 were delayed to 29.9 s and 49.9 s by such stalls, and both jobs failed closed.

## 12. Deviations, unsuccessful experiments and limitations

| # | Item |
|---|---|
| DV-1 | **Pool injection without a module change.** `LexicalRetrievalService` takes an optional fifth constructor parameter that defaults to the process pool, because `knowledge.module.ts`'s retrieval imports are pinned by the protected retrieval-architecture test. The module factory is unchanged, and the default is the worker, never an in-loop path |
| DV-2 | **`StorageBookText` modified** (retrieval adapter) to mark owned buffers. Its read semantics are unchanged; the existing spec passes unchanged |
| DV-3 | **ts-node load path for TypeScript sources** (jest), so existing unit and integration suites exercise the real worker. Development-only; never reached from `dist/` |
| DV-4 | **Pool shutdown is not permanent:** a later job starts a new worker. This lets test processes that build several app instances share the process pool |
| DV-5 | **Test-only tooling extended** (`q11-diagnostics.ts`). PO-044 ablation modes are documented as historical and must not be used with the PO-045 code |
| DV-6 | **Baseline runs used the `d937d2b` tooling,** which has no per-thread or S2-pool capture. Those baseline columns are blank |
| DV-7 | **E-1 runs inside jest,** where the worker is loaded through ts-node transpilation: the same JavaScript semantics, plus one-time start-up |
| U-1 | **Unsuccessful:** the remedy did not meet Q-11 at W=10 or W=6 (§8). No second remedy was tried (PO-045 §6.3) |
| U-2 | **Unsuccessful at first:** three timing-based unit tests were flaky on this VM until rewritten to observe pool state (§7) |
| L-1 | **Not the literal production image** (the harness needs `@nestjs/testing`): same compiled code, same base image, same cap |
| L-2 | **Shared development VM:** idle sync-map p95 varied between 78 and 94 ms across boots. Every Δ is computed against the same run's idle, and the baseline was re-run in the same session. Two W=10 implementation runs bracket run-to-run variance (x10: +90.7 / +93.9; p3x3: +141.5 / +135.2) |
| L-3 | **Synthetic texts and a sequential reader client,** as in Checkpoint E and PO-044 |
| L-4 | **Single runs at W=6 and W=3** (implementation and baseline). The baseline W=3 run contains a 19.5 s freeze |

## 13. Rollback and risks

**Rollback is code-only:** revert `4ecd692`. Optionally revert `f3baac1`, which is test tooling only. There is no schema, migration, configuration, environment or infrastructure change to undo. After the revert, retrieval returns to the pre-PO-045 in-loop S2 path, with identical outputs.

**Risks if this were ever deployed** (it is not authorized):

- the worker's extra RSS (~50 MB under load);
- a dependency on `buffer.isUtf8` (Node ≥ 18.14; the base image is Node 20);
- worker failure modes, which fail closed as `unavailable` and could reduce answer grounding under host stalls rather than block it;
- Q-11 still fails at W ≥ 6.

## 14. Recommendation for PA review

**Submit for independent PA review of:**

- (a) the implementation and its contract preservation (§3–§6);
- (b) the regression evidence (§7);
- (c) the requalification findings (§8–§9).

**Facts relevant to the PA/PO decision:**

- Option D + A is a measured, contract-compatible improvement (worst Δ −29% to −47%; event-loop p99 roughly halved; faster turns).
- It is **insufficient on its own** for Q-11 at W=10 and W=6 under the current 1-vCPU container.
- The residual interference is CPU-quota contention, including the storage fetch the proxy had excluded.

**Decisions this raises (not taken here):**

| Decision | Owner |
|---|---|
| Whether to retain this remedy pending further work | PO, on PA advice |
| Whether to authorize any next step: configuration (option E), fetch placement, container isolation, or a re-examination of the per-request re-read cost | PO, after PA review |
| A separate E-1 ranking authorization | PO |
| A production-host check of the freeze anomaly | operations task |

**Status:**

| Item | State |
|---|---|
| Implementation | complete |
| Tests | passed |
| Q-11 | NOT qualified |
| Checkpoint E | still blocked |
| PA review | awaiting |
| PO acceptance | awaiting |

## 15. Raw data and reproducibility

| Item | Location |
|---|---|
| Aggregated raw measurements: 8 runs × conditions, per-endpoint percentiles, server stats, diagnostics, S2-pool counters, per-thread CPU, freeze lists, micro-benchmark, E-1, host-stall experiment. No tokens, secrets, text or PII; checked | [`2026-11-11-NEM-024-po-045-q11-raw-measurements.json`](2026-11-11-NEM-024-po-045-q11-raw-measurements.json) |
| Procedure | `services/api/tests/perf/README.md` (Checkpoint E, PO-044 and PO-045 sections) |
| Disposable resources | Containers `po045-pg`, `po045-redis`, `po045-minio` and the `po045-q11-*` / `po045-base-*` harness containers: **all removed after the runs**. The local `next start` used for Playwright was stopped. No unrelated Noetia or AutoGuildX service was stopped or modified |

**Commands, in order:**

1. Start the three disposable services.
2. Run the NEM-023 performance suite with `NEM023_PERF_KEEP=1` (fixture + E-1).
3. `npx tsc -p tests/perf/tsconfig.json --outDir <out>`.
4. Start one capped container per W.
5. Run `Q11_DOCKER_STATS=off Q11_DIAG=1 node <out>/tests/perf/q11-client.js <W> <scenarios> <out.json> <container>`.
6. Repeat with the baseline tree compiled to a second out-dir.
