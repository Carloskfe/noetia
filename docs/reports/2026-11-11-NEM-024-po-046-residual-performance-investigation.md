# NEM-024 — PO-046 Residual Q-11 Performance Investigation (diagnostic only)

**Date:** 2026-11-11 · **Authority:** [PO-046](../operating-framework/decisions/product-owner/PO-046-nem-024-residual-q11-performance-investigation-authorization.md) (diagnostic only; PO-045 retained provisionally) · **Branch / PR:** `feat/nem-024-checkpoint-b`, Draft PR #56 · **Review:** independent Product Architecture (not yet performed)

**Status: Checkpoint E remains NOT QUALIFIED; Q-11 BLOCKING; E-1 OPEN.** No production code, configuration, infrastructure or contract was changed. Every variant below ran as a test-tooling runtime patch or a container flag in disposable containers.

## 1. Executive summary

**Q1 — Storage-fetch overhead.** The storage read path is the **principal remaining cause** (confidence: high).

- **Upper-bound ablation:** removing the SDK/network read while keeping a fresh 2 MB allocation and the full worker verification (`fetchcached`, which breaks AC-11) cuts the worst reader Δp95 at W=10:

  | Workload | Production | `fetchcached` |
  |---|---|---|
  | `x10` | +89.9 / +89.3 ms | **+28.8 / +19.1 ms** |
  | `p3x3` | +140.0 / +135.7 ms | **+40.0 / +35.4 ms** |

- **Worker CPU is secondary:** removing it alone (`s2memo`) gives only about −22 ms.
- **Cost per object:** a 2.2 MB read costs ≈ **39 ms of CPU**, of which ≈ **23 ms is on four V8 helper threads**. Only ≈ 3 ms is the SDK's CRC check and ≈ 2 ms is `Buffer.concat`.

**Q2 — CPU contention.** The quota is saturated, and the dominant amplifier is **V8's parallel/concurrent garbage collection running on four platform helper threads inside a one-vCPU quota** (confidence: high).

- **The pool is V8's:** `--v8-pool-size=1` collapses the four helpers into one; `UV_THREADPOOL_SIZE=1` does not change them.
- **Sensitivity:** `--single-threaded-gc` halves the read's CPU (39 → 18 ms per object) and halves the idle reader's own sync-map p95 (≈ 80 → ≈ 42 ms).
- **Under load (production code, single-threaded GC):**

  | Workload | Worst Δp95 | Status |
  |---|---|---|
  | W=10 `x10` | +31.5 / +36.5 ms | ✓ |
  | W=10 `p3x3` | +54.5 / +59.7 ms | ✗ |
  | W=6 `p3x2` | +34.7 ms | ✓ |
  | W=3 `p3x1` | +16.2 ms | ✓ |

**Q3 — Event-loop interference.** Remaining **synchronous research work on the main thread is small** (confidence: medium-high).

| Main-thread wall share | `x10` | `p3x3` |
|---|---|---|
| Fetch (SDK + concat) | 4.2% | 5.6% |
| Worker messaging | 0.4% | 1.1% |
| `retrieve` sync part | 0.3% | 0.8% |
| Main-isolate GC | 21–22% | 21–22% |

GC takes 21–22% of main-thread wall at idle and under load alike, so reader latency tracks **GC and quota contention**, not long research blocks.

**Q4 — Minimal remedy.** Single-threaded GC (C) **plus** a leaner contract-equivalent read (A: presigned raw HTTP into one preallocated buffer) **passed every required workload in the runs measured.** The margin at `p3x3` is thin (one run at +49.8 ms). C alone is the largest single lever, but fails `p3x3` by 4–10 ms.

| Workload | Worst Δp95 (C + A) | Status |
|---|---|---|
| W=10 `x10` | +24.7 / +31.1 ms | ✓ |
| W=10 `p3x3` | +43.0 / +49.8 ms | ✓ |
| W=6 `p3x2` | +31.8 ms | ✓ |
| W=3 `p3x1` | +13.2 ms | ✓ |

**Q5 — Architecture boundary.** Within one container and one vCPU, with AC-11's full-object re-read on every retrieval:

- the **ten-book scenario (`x10`) can meet Q-11 robustly** with configuration alone (C);
- the **full W=10 envelope (`p3x3`) is only marginally achievable** (A + C, 2 runs, margin 0.2–7 ms);
- the ceiling (C + cached bytes: `p3x3` +21.5 ms) shows that what remains is the network read itself.

**This is plausible but not established with confidence.** Neither these measurements nor an extrapolation from this VM can rule out that the full envelope needs more CPU, a separate research container, or a change to the per-request re-read contract.

**Recommendation** (unapproved): authorize one bounded remediation step, **C + A**, with a strengthened requalification (≥ 3 runs per workload). Fallback, if `p3x3` is not robust: a PO/PA decision between a separate research container or extra CPU (cost) and a contract re-examination of the per-request full-object re-read (§14).

**Host-related uncertainty.** **Freezes of 1–26 s appeared in 11 of 59 measured conditions.** Server and client froze simultaneously, so these are whole-VM scheduling anomalies, not cgroup throttling. Affected runs are labelled. They lower confidence in any single run, which is why the conclusions above rest on repeated runs.

## 2. Scope and authorization verification

- PO-046 recorded in `31a8327`:
  - decision record, `docs/noetia-plus/PRODUCT-DECISIONS.md`, mission status, register;
  - PO-045 marked **retained provisionally**, not accepted.
- PO-046 was verified unused on all remote branches and in history beforehand.
- Read before work: the decision register, NEM-024 mission, PO-043/044/045 and their reports and raw files, NEM-023 AC-11/P-2 (the verified-text cache was removed in `cf64287`; every retrieval re-reads and re-verifies), and the PO-045 retrieval, storage and worker code.
- **Production `src/` unchanged:** `git diff 98b9996 -- services/api/src` is empty.
- Unchanged: protected tests, Dockerfiles, Compose files, environment, schema, thresholds and admission rules.

## 3. Baseline

- **Expected and actual starting commit:** `98b99965447a4faa02018c3c7baa9b99a2b9fb08`. The remote head was equal; the tree was clean apart from untracked `node_modules` symlinks.
- **Commits:** `31a8327` (governance), `1c46805` (tooling), and the report commit (see PR #56).

## 4. Environment and methodology

| Item | Value |
|---|---|
| Server | Q-11 harness (real `AppModule`), `node:20-alpine`, `--cpus=1 --memory=512m --memory-swap=512m`, `Q11_DIAG=1`, PO-045 code |
| Client | Host, uncapped, **`Q11_DOCKER_STATS=off`**, 20 warm-ups + 1,000 requests per endpoint per condition, idle and load in the same run |
| Services | Disposable `postgres:16-alpine`, `redis:7-alpine`, `minio/minio` on 127.0.0.1 (recreated, fixture rebuilt, **removed afterwards**) |
| Fixture | 10 × 2,000,000-code-point books (2.14–2.29 MB), 17,780 chunks; 40 reader books with 3,000-phrase sync maps |
| Provider | Simulated only |
| Per-thread CPU | `/proc/self/task/*/stat`. The main thread is the process id; the S2 worker shows up as its own task; the four V8 platform threads appear as same-sized `node` tasks |

**Variant kinds:**

| Kind | Variants |
|---|---|
| **Production** | `none` |
| **Contract-equivalent** | `fetchinst`, `fetchraw`, `fetchworker` (proxy) |
| **Upper bound; breaks AC-11/P-2** | `fetchcached`, `s2memo`, `both` |
| **Sensitivity** (container flags only) | `--single-threaded-gc`, `--v8-pool-size=1`, `--max-semi-space-size=16`, `UV_THREADPOOL_SIZE=1` |

Upper-bound and sensitivity results are **never** Q-11 evidence.

**Run inventory:** 21 Q-11 runs and 59 measured conditions (63 including the four probe-only 10-book admission checks), plus 4 micro-benchmark sets. Order and boots are in the raw file. Mode comparisons share a boot where possible. Round 2 re-ran the key ablations on a fresh boot in reverse order.

## 5. Reproduced Q-11 baseline (production behaviour, PO-045 code)

| Run | `x10` worst Δ | `p3x3` worst Δ | Notes |
|---|---|---|---|
| A1 (CPU profile on) | +88.8 | +126.9 | **Contaminated:** freezes of 4.1 s (idle) and 5.1 s (`x10`); profiler overhead |
| B1 | **+89.9** | **+140.0** | clean |
| B2 (fresh boot) | **+89.3** | **+135.7** | one 7.2 s freeze in `x10` |
| PO-045 report (for reference) | +90.7 / +93.9 | +141.5 / +135.2 | – |

These reproduce PO-045 within ±5 ms. W=6 and W=3 were not re-run with production behaviour in PO-046. The PO-045 values stand: +103.9 ms ✗ and +37.9 ms ✓.

## 6. Storage-fetch decomposition

### 6.1 Micro-benchmark

Setup: capped container (1 vCPU / 512 MB), sequential reads of the 10 fixture objects, values per 2.2 MB object. Every variant was verified byte-identical by SHA-256 before timing.

**Default runtime:**

| Variant | Wall p50 / p95 (ms) | Process CPU | Main thread | Other threads | Main GC (n / ms) | Notes |
|---|---|---|---|---|---|---|
| `prod` (StorageService.getBytes) | 24.0 / 86.3 | **39.2** | 16.2 | **22.8** (4 threads × 4.8–6.3) | 0.95 / 6.3 | – |
| `noCrc` (SDK, no response CRC) | 22.2 / 85.7 | 36.5 | 13.8 | 22.3 | 0.93 / 2.8 | 33 chunks; concat 2.2 ms |
| `prealloc` (SDK stream → one preallocated buffer) | 19.2 / 97.5 | 37.7 | 15.0 | 22.7 | 0.90 / 3.9 | no concat |
| `sdkBytes` (`transformToByteArray`) | 30.4 / 82.5 | 44.2 | 17.2 | 27.3 | 0.97 / 4.3 | – |
| `rawHttp` (presigned GET → preallocated buffer) | 18.5 / 78.0 | **31.6** | 12.7 | 19.0 | 0.78 / 3.1 | 33 chunks |
| `cached` (in-memory copy, reference) | 1.0 / 5.4 | 2.2 | 1.3 | 0.8 | 0 / 0 | – |

**Thread-pool identification:**

| Runtime | `prod` process CPU | Other threads | Wall p95 | Conclusion |
|---|---|---|---|---|
| `UV_THREADPOOL_SIZE=1` | 38.5 | 21.8, still 4 threads | – | **Not libuv** |
| `--v8-pool-size=1` | 33.2 | 15.8 on **one** thread | – | **V8 platform threads** |
| `--single-threaded-gc` | **17.9** | **4.0** | 32.0 | The helper work is **GC** |

Under `--single-threaded-gc`, `rawHttp` costs 14.2 ms and `cached` 1.2 ms.

### 6.2 Answering the decomposition items

| # | Item | Finding | Evidence |
|---|---|---|---|
| 1 | Request and network wait | Wall p50 ≈ 18–24 ms per object, mostly waiting; dominated by receiving 2.2 MB over loopback | Wall − CPU (main thread) |
| 2 | SDK stream processing | ≈ 7 ms CPU per object (`prod` − `rawHttp`), including signing, middleware and the response CRC (`noCrc` saves 2.7 ms) | §6.1. Profile: `crc32` 452 ms over ~500 objects ≈ 0.9 ms each |
| 3 | Chunk allocation and copy | ≈ 33 chunks of ~64 KB per object. Each is a new ArrayBuffer-backed `Buffer` | `chunksPerObject` |
| 4 | `Buffer.concat` | 2.2 ms sync per object (one 2.2 MB copy) | `noCrc` concat timer |
| 5 | Main-thread work | 12.7–16.2 ms CPU per object | Main-thread CPU |
| 6 | GC attributable to the read path | ≈ **0.8–0.95 main-isolate GCs per object**, plus ≈ **19–23 ms of helper-thread GC CPU** per object. Under load, helpers fall from ~5.4 s each (`x10`) and ~11 s each (`p3x3`) to idle levels (~2.8–4 s) when the network read is removed | §6.1; Q-11 thread table, §7 |
| 7 | Worker transfer | Zero-copy (100% transfers); messaging is 0.4–1.1% of main-thread wall | Profile; S2-pool counters |
| 8 | End-to-end read latency under load | `getBytes` wall p95 ≈ 200–250 ms (PO-045). This is mostly **waiting on the CPU quota**, not I/O: wall p95 unloaded is 78–86 ms | – |

**Classification.** The read's cost is **CPU work, made worse by GC overhead on helper threads that compete for the quota, and the resulting CFS throttling.** It is not I/O wait. Storage wall-clock latency is **not** main-thread CPU: per object, wall ≈ 24 ms, main thread ≈ 16 ms, helpers ≈ 23 ms (helpers run concurrently and are quota-bound).

The SDK itself is a minor part. Even a raw HTTP read costs 32 ms of CPU per object under the default GC.

## 7. CPU-quota and throttling analysis (W=10)

| Condition | cgroup CPU p50 | Throttled periods | Main thread (s) | S2 worker (s) | 4 V8 helpers (s each) | Main GC (n / ms) | Turns/s | Worst Δ |
|---|---|---|---|---|---|---|---|---|
| Production `x10` (B1) | 89% | 357 | 34.3 | 4.9 | 5.3–5.5 | 4,054 / 10,007 | 1.42 | +89.9 |
| Production `p3x3` (B1) | 98% | 883 | 52.6 | 14.3 | 10.5–10.9 | 4,989 / 18,584 | 4.35 | +140.0 |
| `fetchcached` `p3x3` (B1) | 94% | 386 | 35.9 | 12.5 | 3.3–3.5 | 4,255 / 8,985 | 7.72 | +40.0 |
| `s2memo` `p3x3` (B1) | 97% | 853 | 53.8 | 0.1 | 12.7–12.8 | 5,081 / 15,877 | 4.48 | +117.6 |
| Single-threaded GC `p3x3` (S1) | 95% | 434 | 48.1 | 12.0 | 1.0–1.1 | 4,592 / 7,476 | 6.59 | +54.5 |
| Single-threaded GC + raw read `p3x3` (C6) | 94% | 369 | 46.2 | 11.2 | 0.9–1.2 | 4,408 / 7,553 | 6.10 | +49.8 |

Observations:

- **Helper-thread GC CPU is the largest controllable consumer of quota:** about 21 s (`x10`) and 42–51 s (`p3x3`) per condition in production. It follows the network read, not the worker.
- **Throttling halves when helper GC goes away** (883 → 386–434 periods).
- **The load is closed-loop.** Faster configurations run **more** research (`p3x3` turns/s 4.35 → 6.1–7.7) and still deliver a smaller reader regression. The Δ comparison therefore understates the efficiency gain.
- **Memory:** RSS max 205–237 MB in every configuration (limit 512 MB). `--max-semi-space-size=16` adds ~50 MB (268–284 MB).

## 8. Main-thread and worker contention

**Main-thread CPU profile** (A1; wall share; it includes time spent waiting while throttled; contaminated by short freezes, so treat as indicative):

| Category | idle | `x10` | `p3x3` |
|---|---|---|---|
| Garbage collector | 22.2% | 22.0% | 21.3% |
| Idle | 34.1% | 27.5% | 18.2% |
| Reader path: pg row parsing, Express JSON `stringify`, socket `writev`, typeorm | ≈ 24% | ≈ 21% | ≈ 24% |
| SDK + `Buffer.concat` (research) | – | 4.2% | 5.6% |
| Worker messaging | – | 0.4% | 1.1% |
| `retrieve` sync, gateway, turn service | – | ≈ 0.8% | ≈ 3.0% |

**Remaining synchronous research work is small.** No single research block explains the regression. Event-loop stalls ≥ 100 ms per condition:

| Condition | `x10` | `p3x3` |
|---|---|---|
| Production | 42 | 56 |
| `fetchcached` | 13 | 12 |
| `both` | 10 | 2 |

These track the read path's GC, not synchronous research code.

**Worker contention:**

- Worker CPU removal (`s2memo`) gains about 22 ms. Worker queue depth max 5–7, mean wait 17–95 ms. No saturation and no timeouts outside freezes.
- **Moving the fetch into the worker** (`fetchworker`, a contract-equivalent proxy):
  - default GC: `x10` +29.7 ms ✓; `p3x3` +97.3 ms ✗, with an 8.7 s freeze;
  - single-threaded GC: +31.8 / +57.8 ms, no better than single-threaded GC alone.
- The quota, not the thread, is binding.

**Not executed:** the `workernice` mode was built but not run. The evidence placed the controllable contention in V8 GC helpers, not in the S2 worker. Repeating scheduling experiments would have added host load without answering an open question. CPU pinning was not re-tested; PO-044 §6.1 already has cpuset measurements.

## 9. Controlled causal experiments: summary and limits

Worst reader Δp95 at W=10, ms; `x10` / `p3x3`.

| Variant | Contract | Round 1 | Round 2 / repeat |
|---|---|---|---|
| Production | – | +89.9 / +140.0 | +89.3 / +135.7 |
| `s2memo` (no worker CPU) | **Breaks** | +68.1 / +117.6 | – |
| `fetchcached` (no SDK/network/chunks) | **Breaks** | +28.8 / +40.0 | +19.1 / +35.4 |
| `both` | **Breaks** | +3.6 / +16.8 | – |
| `--v8-pool-size=1` | Sensitivity | +44.8 / +87.9 | – |
| `--single-threaded-gc` | Sensitivity | +31.5 / +54.5 | +36.5 / +59.7 |
| `--single-threaded-gc --max-semi-space-size=16` | Sensitivity | +24.0 / +53.2 | – |
| Fetch in worker (proxy) | Equivalent proxy | +29.7 / +97.3 | – |
| Fetch in worker + single-threaded GC | Proxy + sensitivity | +31.8 / +57.8 | – |
| Raw read, default GC | Equivalent | +108.5 / +133.7 (**contaminated:** 19.5 s and 9.3 s freezes) | – |
| **Raw read + single-threaded GC** | Equivalent + sensitivity | **+24.7 / +43.0** | **+31.1 / +49.8** |
| Single-threaded GC + `fetchcached` (ceiling) | **Breaks** | +3.7 / +21.5 | – |
| Single-threaded GC, W=6 `p3x2` / W=3 `p3x1` | Sensitivity | +34.7 / +16.2 | – |
| Raw read + single-threaded GC, W=6 / W=3 | Equivalent + sensitivity | +31.8 / +13.2 | – |

The 10-book probe was refused (`guard: exceeds_limit`) at W=6 and W=3 in every configuration. At W=10, 10-book turns were admitted in every run, with **0 failed turns** across all 63 conditions.

**Limits:**

- **Attribution:**
  - Contributions are approximately additive: fetch ≈ 60–100 ms, worker ≈ 20 ms, together ≈ 86–123 ms against `both`.
  - "GC" here means V8 GC triggered by the read path's ArrayBuffer churn. The exact V8 trigger (young-generation ArrayBuffer accounting vs external-memory pressure) was not isolated.
  - The ablations remove the read's main-thread work and its helper-thread GC together, so their shares are inferred from the micro-benchmark (16 : 23 ms per object), not separated under load.
- **Run counts:** most variants ran once or twice. The `p3x3` result for C + A has a margin of 0.2 ms in one of two runs.
- **Representativeness:** these are not the literal production image or kernel. The production host (8 vCPU, `cpus: 1.0` quota) was not tested; its CFS and GC behaviour is expected to be similar but is **unverified**.

## 10. Host freeze observations

- **Scale:** 11 of 59 measured conditions contained at least one server event-loop gap ≥ 1 s (1.0–25.8 s).
- **Each coincided with a client-side stall of almost the same length** (for example 7,226 ms server / 7,186 ms client; 25,798 / 25,757). The client runs on the host, uncapped, in a different process and cgroup. A simultaneous stall in both is therefore **whole-VM scheduling**, not cgroup throttling and not the N-3 client artifact (the sampler was off).
- **Not stress-induced:** freezes occurred under every kind of variant, and sometimes at idle (A1, C7). The PO-045 experiment (§11 there) had already shown that one spinning process can stall another process for up to 31 s on this VM. No further stress tests were run (PO-046 §5F).
- **Effect on results:**
  - p95 over 1,000 requests absorbs a single frozen request, but a freeze can still distort a condition: worker timeouts in PO-045, inflated GC maxima;
  - contaminated runs are labelled in §5, §9 and the raw file, and no conclusion rests on a contaminated run alone.
- **Production:** not investigated, and no claim is made about the production host.

## 11. Remedy options

Kind of evidence: **M** = measured with contract-equivalent code; **UB** = upper bound; **S** = sensitivity (configuration differs from production); **E** = engineering estimate; **H** = untested hypothesis.

| | A. Leaner storage read (presigned raw HTTP → one preallocated buffer) | B. Fetch inside the worker | C. Single-threaded GC (`--single-threaded-gc` for the API process) | D. Separate research container | E. A + C combined |
|---|---|---|---|---|---|
| **1. Evidence** | M (micro): −19% CPU per object (39.2 → 31.6 ms; with C, 17.9 → 14.2). M (Q-11, with C): `p3x3` +54.5/+59.7 → +43.0/+49.8 | M (proxy): default GC +29.7 / +97.3; with C +31.8 / +57.8 | S: `x10` +31.5/+36.5 ✓, `p3x3` +54.5/+59.7 ✗, W=6 +34.7 ✓, W=3 +16.2 ✓ (2 + 2 + 1 + 1 runs); idle reader p95 ≈ halved | UB (indirect): `both` +3.6 / +16.8 and the ceilings show near-zero Δ when research CPU leaves the quota. E for the real thing | S + M: `x10` +24.7 / +31.1, `p3x3` +43.0 / +49.8, W=6 +31.8, W=3 +13.2 — all ✓ |
| **2. Confidence** | Medium (small effect, 2 runs) | Medium: no added benefit with C | **High** that it helps; medium-low that it alone passes `p3x3` (it did not) | Medium (not tested) | Medium: passes, thin `p3x3` margin |
| **3. Reader effect** | ≈ −5 to −12 ms at `p3x3` with C; none visible without C | Helps `x10` without C; nothing beyond C | ≈ −55 to −80 ms at `p3x3`; idle sync-map p95 80 → 42 ms | Likely Δ ≈ 0–20 ms (E) | Passes all workloads in 2 runs |
| **4. Research latency and throughput** | Slightly faster | Neutral | 10-book p50 664–766 → 540–544 ms; `p3x3` turns/s 4.35 → 5.7–6.6 | Depends on the allocation (E) | 10-book p50 590–621 ms; `p3x3` 5.9–6.1 turns/s |
| **5. Ten-book capability** | Kept | Kept | Kept (admitted at W=10; 0 failures) | Kept | Kept |
| **6. CPU / memory** | Less CPU; same RSS | Same CPU; worker heap grows (SDK in the worker) | ≈ −50% read CPU; RSS unchanged (205–229 MB). Longer single-threaded GC pauses possible; main-isolate GC total actually fell (≈ 18.6 → 7.5 s at `p3x3`) | +1 container, +≈150–250 MB RAM, +CPU quota | As C, with slightly less CPU |
| **7. Operating cost** | None | None | **None** | **New capacity allocation** (no purchase on the 8 vCPU / 24 GB host, but more allocated CPU and RAM) | None |
| **8. Complexity** | Low–medium: one S2 read method; error and timeout handling; unit tests | Medium–high: SDK and credentials inside the worker, lifecycle, memory | **Very low:** one runtime flag on the API process | High: deployment, networking, inter-service failure modes, ADR | Low |
| **9. New failure modes** | Presigned-URL expiry or clock skew, HTTP errors (fail closed as `unavailable`), loss of SDK retries and transport CRC. SHA-256 still verifies every byte | Worker crash takes the fetch with it | Process-wide GC behaviour change, for reader and research alike. A future move to more than one vCPU would want re-evaluation | Service-to-service failures | A + C |
| **10. Contract compatibility** | **Compatible:** per-request full-object read, exact bytes, SHA-256, strict UTF-8 unchanged | Compatible | **Compatible** (no code or contract impact) | Architecture change (ADR level) | Compatible |
| **11. Authorization needed** | PO + PA: `src` change (S2 adapter) | PO + PA (threading design) | **PO + PA (and SA): tracked production runtime configuration** (Dockerfile CMD or Compose `NODE_OPTIONS` for the API service) | PO + PA/SA: infrastructure, cost, ADR | Both A and C authorizations, as one bounded step |

**Other variants measured or considered (E-candidates), not recommended:**

| Variant | Finding | Why not |
|---|---|---|
| `--v8-pool-size=1` | +44.8 / +87.9 | Partial; weaker than C |
| `--max-semi-space-size=16` with C | +24.0 / +53.2 | ≈ C alone at `p3x3`, with RSS +50 MB |
| `noCrc` (SDK option `responseChecksumValidation`) | −2.7 ms per object | Too small alone |
| `prealloc` | −1.5 ms per object | Too small alone |
| Partial (range) reads plus metadata-based identity checks | **H** | Would cut bytes read by about 99%, but **conflicts with AC-11/P-2** (full-object hash per request). Contract change only |

## 12. Cost and resource implications

| Option | Recurring cost | One-off engineering effort | Resource effect |
|---|---|---|---|
| A | None | Small (one adapter method, tests, requalification) | Less CPU |
| B | None | Medium–high | Worker heap +SDK; same CPU |
| **C** | **None** | Minimal (a flag), plus requalification | ≈ −50% read CPU; RSS unchanged |
| D | **Increased allocated capacity**: extra CPU quota and RAM; also operational burden | High | Isolated research CPU |
| E = A + C | None | Small | Best measured |

## 13. Contract and architecture compatibility

**A, B, C and E** preserve:

- AC-11/P-2: per-request full-object re-read; no cache;
- exact-byte SHA-256 via `computeTextHash`; whole-object strict UTF-8; code-point slicing;
- `stale` vs `unavailable`; ranking SQL; budgets and citations;
- ledger; idempotency, cancellation, fencing; reader isolation; privacy; default-deny; dark feature with simulated providers.

**D** changes the deployment architecture.

**The partial-read hypothesis** and **every cached-byte or memoized variant** (`fetchcached`, `s2memo`, `both`) **conflict with AC-11/P-2.** They are upper bounds only, and none is presented as a remedy.

## 14. Recommended next intervention and fallback

**Primary (unapproved): option E = C + A as one bounded remediation step.**

1. Add `--single-threaded-gc` to the **API process only**, in tracked runtime configuration.
2. Read S2 book objects through an SDK-presigned `node:http` GET into one buffer preallocated from `Content-Length`. Keep:
   - the per-request full-object read;
   - exact-byte SHA-256;
   - strict UTF-8;
   - fail-closed `unavailable` on any HTTP, length or timeout error.
3. Requalify with **at least 3 runs per required workload** on fresh boots (sampler off), plus the full regression suite.

**Why this is the smallest reasonable intervention:**

- **C is configuration only:** no code, no cost, no contract impact. It is measured as the largest single lever (Δ −55 to −80 ms) and halves the idle reader's latency too.
- **A is a small, contract-equivalent code change.** It accounted for the remaining 5–12 ms at `p3x3` and is the only measured contract-compatible addition that crossed the threshold.
- **B adds complexity without benefit once C is in place.**
- **D adds capacity and architecture.**

**Order:** C could be authorized and requalified first (it alone qualifies `x10`, W=6 and W=3), with A added if `p3x3` still fails. Measured evidence favours authorizing both together, because C alone failed `p3x3` in 2 of 2 runs.

**Fallback (requires a new architectural decision):** if `p3x3` does not pass robustly after E (for example, any of ≥ 3 runs > 50 ms), the remaining interference is the irreducible cost of re-reading ≈ 2.2 MB objects per retrieval inside one vCPU. The PO would then choose between:

- **(i)** separate research execution (D) or extra CPU for the API: cost and infrastructure;
- **(ii)** a PA contract re-examination of AC-11's full-object re-read on every retrieval (for example, verifying identity per object version while still reading only passage ranges): rights and integrity contract;
- **(iii)** a PO review of the admission envelope (for example, how many concurrent smaller turns share W=10). The ten-book commitment stays untouched in every case.

No fallback is recommended for implementation now.

## 15. Exact authorization needed for the primary proposal

A separate PO decision (PO-047 or as assigned), with PA review, that would:

1. authorize a **tracked runtime-configuration change** for the API service only: `--single-threaded-gc` via the API container's Node invocation (production Dockerfile CMD, or `NODE_OPTIONS` in `docker-compose.server.yml` / `docker-compose.prod.yml`). This overrides PO-046 §8 "Node.js runtime flags in tracked production configuration" for this one flag;
2. authorize a **`src` change** limited to the S2 read path (`StorageBookText`, plus a byte-exact read method in `StorageService` if needed), with unit tests. Contracts unchanged; no dependency (`@aws-sdk/s3-request-presigner` is already a dependency);
3. require **requalification:** Q-11 at W=10 (`x10`, `p3x3`), W=6 and W=3, ≥ 3 runs each, sampler off, plus E-1 re-measurement and the full API/web regression;
4. keep in force: no merge, deployment or activation without further decisions; E-1 ranking stays a separate track.

## 16. Remaining exceptions and risks

| Item | Status |
|---|---|
| **Q-11** | **OPEN — BLOCKING** (production code unchanged; nothing qualified) |
| **E-1** | **OPEN.** This session's sample: p50 428 / p95 763 ms (PO-045: 146 / 620). Large session-to-session variance; the ranking SQL component is out of scope |
| Whole-VM freezes | **OPEN** pre-launch operational risk; development VM only; production not examined |
| `p3x3` margin | Even the best contract-compatible configuration passed by 0.2–7 ms; robustness unproven |
| Representativeness | Not the production image or kernel; closed-loop synthetic load; synthetic texts |
| History re-materialization | Main-thread hash + decode in `turn.service.ts`: unchanged observation from PO-045; not on the Q-11 path; not investigated |
| Earlier exceptions (E-2, NEM-022 coverage, D-8, cancel-record persistence, in-process cancel, TT-14, SSE idle timeout, web coverage gate) | Unchanged; not waived |

## 17. Changed files and commits

| Commit | Files |
|---|---|
| `31a8327` | `docs/operating-framework/decisions/product-owner/PO-046-…md` (new), `docs/noetia-plus/PRODUCT-DECISIONS.md`, `docs/engineering-missions/README.md`, `docs/engineering-missions/APPROVED/NEM-024-…md` |
| `1c46805` | `services/api/tests/perf/q11-diagnostics.ts` (PO-046 modes), `services/api/tests/perf/s2-fetch-bench.ts` (new), `services/api/tests/perf/README.md` |
| report commit | This report; `2026-11-11-NEM-024-po-046-residual-performance-raw-measurements.json`; status lines |

**No change under `services/api/src`, `services/web`, `services/mobile`, Dockerfiles or Compose.**

**Tests:** the tooling is opt-in and outside the unit suite (`tests/unit/` regex) and the production build. It compiles with `tsc -p tests/perf/tsconfig.json` and has 0 lint errors. The production code is unchanged since `98b9996`, so the PO-045 regression results still apply; the suites were not re-run.

## 18. Raw measurements and reproducibility

- **Raw file:** [`2026-11-11-NEM-024-po-046-residual-performance-raw-measurements.json`](2026-11-11-NEM-024-po-046-residual-performance-raw-measurements.json) (≈ 437 KB). It contains:
  - 21 runs and 63 conditions (59 measured plus 4 probes), each with a contamination label;
  - endpoints, Δ, server stats, event loop, GC, throttling, timeline, S2-pool counters, per-thread CPU;
  - profile summaries;
  - 4 micro-benchmark sets;
  - the E-1 sample.

  It contains no text, keys, credentials, tokens or PII (checked). Component timers were trimmed to retrieval, S2, sync-map and turn categories.
- **Not committed (size):** `.cpuprofile` files, `vmstat` traces, and full client outputs. They are regenerable.
- **Procedure:** `services/api/tests/perf/README.md` §PO-046.
  1. Start the three disposable services.
  2. Build the fixture with the NEM-023 performance suite (`NEM023_PERF_KEEP=1`).
  3. `tsc -p tests/perf/tsconfig.json --outDir <out>`.
  4. Boot the capped harness (optionally with a labelled sensitivity flag).
  5. `curl /diag/mode?m=<mode>`.
  6. `Q11_DOCKER_STATS=off Q11_DIAG=1 node <out>/tests/perf/q11-client.js 10 x10,p3x3 <out.json> <container>`.
  7. For the micro-benchmark: `node out/tests/perf/s2-fetch-bench.js <rounds> <concurrency>` in the capped container.
- **Clean-up done:** every `po046-*` container (services, harness, benchmark) was removed. No unrelated service was touched.
