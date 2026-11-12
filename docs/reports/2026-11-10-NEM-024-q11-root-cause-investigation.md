# NEM-024: Q-11 Performance Root-Cause Investigation (PO-044, diagnostic only)

**Date:** 2026-11-10 · **Authority:** [PO-044](../operating-framework/decisions/product-owner/PO-044-nem-024-q11-root-cause-investigation-authorization.md) · **Baseline:** Draft PR #56 at `e7fdb70` · **Review:** independent Product Architecture

**Status: Checkpoint E remains NOT QUALIFIED. Q-11 remains BLOCKING.** This investigation implements no remedy.

What was and was not changed:

- **Unchanged:** production source code, configuration, infrastructure, concurrency defaults, accepted contracts, protected tests, and acceptance criteria.
- **Added (test tooling only):** `services/api/tests/perf/q11-diagnostics.ts`, with opt-in hooks in the harness and client.
- **Instrumentation:** every patch, ablation, and alternative configuration lived in a disposable test process or container and was discarded with it.

## 0. Summary

| Question | Finding | Confidence |
|---|---|---|
| Does the Q-11 failure reproduce? | **Yes, at W = 10, 6, and 3.** Clean worst reader Δp95: **+208 ms** (W=10, p3x3), **+113 ms** (W=6), **+71 ms** (W=3). Limit: 50 ms. | High |
| Principal cause | **Synchronous S2 work on the API event loop.** Each retrieval decodes every result book's full ~2.1 MB object (~13 ms per book), scans it to slice passages (~5 ms), hashes it (~1.6 ms), and buffers it through the AWS SDK. This also churns the heap, adding GC. Removing only this work (ablation `s2free`) makes **Q-11 pass at every W** (worst Δ +10.3 ms). Nothing else does that. | **High** |
| Amplifiers | (1) **CFS bandwidth throttling** of the 1-vCPU quota: 40–78% of 100 ms periods are throttled under load, and every thread pauses until the period ends. (2) **Young-generation GC pressure:** up to 70 scavenges per second. Each alone roughly halves Δ; neither alone passes. | High that they contribute; medium on the exact share |
| SHA-256 | **Minor:** 1.6 ms per 2 MB book; about 3% of CPU at x10. Memoizing it changes little. | High |
| E-1 retrieval p95 > 150 ms | Two independent parts: (a) S2 CPU, about 20 ms of main-thread work per book; (b) the **PostgreSQL ranking query for high-frequency terms**: p95 168–432 ms under load *even with S2 removed*. S2 work alone cannot meet E-1. | Medium-high |
| N-3 ~1 s outliers | **A measurement artifact in the Checkpoint E client:** `execFileSync('docker stats')` froze the client's own event loop for ~1.05 s every ~3 s. 126/126 outliers ≥ 800 ms coincide with a client stall. With the sampler off: 0 outliers ≥ 200 ms at idle (sync-mode control: 25). **Not a server stall.** | **High** |
| Other anomaly | **Multi-second container freezes:** 17 events of 4 s to 231 s in 9 of 28 measured conditions. The cgroup was throttled in *every* period while using 4–84% CPU. Host or kernel level; unexplained. Absent from Checkpoint E. | Cause: **inconclusive** |
| Recommended first intervention | **Move S2 per-book verification and slicing off the event loop into one bounded worker thread, with byte-level slicing (no full-text decode).** Per-request re-read and SHA-256 verification are unchanged; no cache. A synthetic proxy of this design **passed** at W=10 (Δ +4.1 / +26.9 ms). Not yet measured as a real implementation. | Medium (proxy, not implementation) |

## 1. Environment and commands

### 1.1 Environment

| Item | Value |
|---|---|
| Host | Development VM: 6 vCPU, 7.2 GiB RAM, kernel 7.0.0-43, cgroup v2, Docker. Shared with the running local Noetia and AutoGuildX stacks. |
| Host load during runs | Load average 0.8–4.9; host CPU 67–81% idle; steal 0; no swap activity (`vmstat`, `host.log`) |
| Server under test | Real `AppModule` (Q-11 harness, [Checkpoint E report §5](2026-11-10-NEM-024-checkpoint-e-report.md)) on `node:20-alpine`, `--cpus=1 --memory=512m --memory-swap=512m`. This matches production's `docker-compose.prod.yml` limits (`cpus: "1.0"`, `memory: 512M`; a CFS quota of 100 ms per 100 ms period). |
| Fixture | 10 NEM-023 books × 2,000,000 code points (≈2.14 MB UTF-8 each), 17,780 chunks; 40 reader books with 3,000-phrase sync maps |
| Disposable services | `postgres:16-alpine` :55432, `redis:7-alpine` :56379, `minio/minio` :59000, on 127.0.0.1 only. All uncapped. **Removed after the runs.** |
| Provider | Simulated only; no paid calls |
| Client | Host-side and uncapped, sequential keep-alive, 1,000 requests per endpoint per condition after 20 warm-ups. Pass rule unchanged: reader **p95 Δ ≤ 50 ms** against the same run's idle. |

### 1.2 Commands

The full procedure is in `services/api/tests/perf/README.md` §PO-044.

```bash
# fixture (once)
NODE_OPTIONS=--experimental-vm-modules NEM023_PERF=1 NEM023_PERF_KEEP=1 NEM023_MINIO_*=… NEM019_DISPOSABLE_DB=1 DB_*=… \
  npx jest -c jest.integration.config.js --runInBand tests/integration/knowledge/retrieval-performance.int-spec.ts

# build
npx tsc -p tests/perf/tsconfig.json --outDir <out>

# server: one W per container; Q11_DIAG=1 enables diagnostics
docker run [--cpuset-cpus=N] --cpus=1 --memory=512m --memory-swap=512m --network host … \
  -e Q11_DIAG=1 [-e Q11_WORKER_NICE=19] node:20-alpine node [--max-semi-space-size=32] out/tests/perf/q11-harness.js

# ablation (diagnostic only)
curl 'http://127.0.0.1:4101/diag/mode?m=none|nohash|s2free|s2worker|bytescan'

# client
Q11_DOCKER_STATS=off|sync Q11_DIAG=1 [Q11_PROF=1] node <out>/tests/perf/q11-client.js <W> <scenarios> <out.json> <container>

# isolated micro-benchmark
curl 'http://127.0.0.1:4101/diag/bench?n=5'
```

### 1.3 What the diagnostics record (`q11-diagnostics.ts`)

- **Component timers:** runtime wrappers around:
  - `computeTextHash`, `decodeUtf8`, `sliceCodePointRanges`;
  - `StorageService.getBytes`, `LexicalRetrievalService.retrieve`;
  - `AiGatewayService.prepare`/`invoke`, `TurnService.run`;
  - the `pg` client round trip, grouped by SQL category; never parameters.
- **Event loop:** delay histogram, utilization per second, and a 10 ms drift detector that timestamps every stall ≥ 30 ms.
- **CPU:**
  - `process.cpuUsage`;
  - cgroup `cpu.stat` (usage, `nr_throttled`, `throttled_usec`) per second;
  - each 100 ms window in which throttling occurred.
- **GC:** `PerformanceObserver('gc')`, with timestamps.
- **CPU profile:** the built-in inspector `Profiler` (1 ms sampling), summarized by self time, category, and inclusive time of key frames.
- **Client side:**
  - a stall detector on the client's own event loop;
  - the start timestamp of every reader request ≥ 200 ms;
  - `docker stats` sampling selectable as `sync` (the Checkpoint E behaviour), `async`, or `off`.

No question text, passage text, SQL parameters, tokens, or PII are recorded. The raw file was checked: no tokens or secrets.

## 2. Reproduced baseline

### 2.1 Q-11 at each W

Reader p95 in ms, with Δ against the same run's idle; 1,000 requests per endpoint.

| Run | W | Load | `/books` | `/books/:id` | `/sync-map` | Worst Δ | ≤ 50 ms? |
|---|---|---|---|---|---|---|---|
| A: Checkpoint E method (sync `docker stats`, diagnostics off) | 10 | x10 | 14.8 (+7.3) | 23.4 (+12.9) | 281.1 (**+196.9**) | +196.9 | **No** |
| A | 10 | p3x3 | 110.7 (+103.3) | 212.4 (+201.9) | 412.7 (**+328.6**) | +328.6 | **No** |
| B: clean (sampler off, diagnostics on) | 10 | x10 | 12.7 (+1.3) | 27.9 (+12.1) | 238.3 (**+157.8**) | +157.8 | **No** |
| B | 10 | p3x3 | 92.1 (+80.8) | 195.7 (+179.8) | 288.0 (**+207.6**) | +207.6 | **No** |
| G: clean | 6 | p3x2 | 41.9 (+36.4) | 65.2 (+56.3) | 152.1 (**+113.4**) | +113.4 | **No** |
| H: clean | 3 | p3x1 | 11.1 (+4.9) | 35.9 (+27.1) | 114.8 (**+70.7**) | +70.7 | **No** |

For comparison, Checkpoint E recorded sync-map Δ +155 / +166 / +120 / +69.5 ms. The failure reproduces. `probe10` is still refused under W=6 and W=3 (`budget_unavailable`, `guard: exceeds_limit`), as in Checkpoint E.

### 2.2 Resources under load (clean runs)

| Measure | W=10 x10 | W=10 p3x3 | W=6 p3x2 | W=3 p3x1 | Idle (reader only) |
|---|---|---|---|---|---|
| Event-loop delay p99 / max (ms) | 210 / 490 | 201 / 310 | 111 / – | 95 / – | 74 / 108 |
| Event-loop stalls ≥ 100 ms | 128 in 82 s | 234 in 138 s | – | – | 0 |
| Event-loop utilization p50 | 0.83 | 0.92 | 0.87 | 0.78 | 0.67 |
| cgroup CPU p50 | 92% | 99% | – | – | 80% |
| Throttled CFS periods | 484 (≈59% of periods) | 1,071 (≈78%) | 505 | 260 | 158 (≈32%) |
| GC count / total pause | 4,521 / 11.2 s (14%) | 6,054 / 17.8 s (13%) | 5,038 / 8.9 s | 4,250 / 5.7 s | 3,548 / 5.9 s |
| RSS max | 172 MB | 173 MB | 161 MB | 153 MB | 131 MB |
| PostgreSQL connections (max / max active) | 5 / 3 | 7 / 5 | 6 / 4 | 5 / 3 | 2 / 2 |
| Research throughput (turns/s) | 1.32 | 3.76 | – | – | – |
| Turn latency p50 / p95 (ms) | 749 / 1,172 (10-book) | 788 / 1,164 | 461 / 644 | 306 / 432 | – |

Three observations follow:

- **The idle reference is not light.** The sequential client keeps the reader path busy at about 70–80% of the CPU quota. Sync-map p50 is about 27 ms, including JSON parsing of a 3,000-phrase JSONB row and response serialization. The container is already throttled in about 30% of periods with no research running.
- **Memory is not the constraint:** RSS stays at or below 177 MB of 512 MB.
- **Database connections are not the constraint:** at most 7.

### 2.3 Host contention and run-to-run variability

- **Idle drift between boots:** idle sync-map p95 varied from **35 to 95 ms** across boots on the same day. Every Δ is computed against its own run's idle, and comparisons in §6 use the same boot where possible.
- **Same-condition repeats:** W=10 x10 sync-map Δ was +197 (A), +158 (B), and +161 (B-prof). W=10 p3x3 was +329, +208, and +202. The +197 and +329 readings came from the sync-sampler method (§5).
- **Uncapped neighbours:** PostgreSQL and MinIO run uncapped on the same host. The host client recorded its own stalls of up to 384 ms under x10, which is host contention, but those overlap only 8 of the 88 loaded outliers.
- **Retrieval-only variance:** the NEM-023 suite (uncapped host, no other load) gave retrieval p50/p95 **133 / 416 ms** this session, against 368 / 842 ms in Checkpoint E and 594 ms p95 in NEM-023.

## 3. CPU and event-loop profiling evidence

Inspector CPU profile, W=10. The x10 profile is clean (86 s, 34,804 samples). The p3x3 profile is **contaminated** by a 100 s freeze (§5.2) and is used only qualitatively.

| Category (self time) | Idle | x10 |
|---|---|---|
| idle (event loop waiting) | 41.9% | 25.1% |
| garbage collector | 17.8% | 16.5% |
| **TextDecoder (`decodeUtf8`, full book)** | 0% | **10.5%** |
| node internals: Buffer slice and copy, `writev` (response writes) | 13.1% | 14.5% |
| pg driver (row parsing; mostly the reader's sync-map rows) | 8.0% | 5.5% |
| Nest / Express / auth | 8.0% | 5.4% |
| **E5 retrieval JS (`sliceCodePointRanges`)** | 0% | **4.6%** |
| TypeORM | 3.1% | 3.2% |
| crypto (SHA-256 `update`) | 0.6% | 2.5% |
| AWS SDK (MinIO stream) | 0% | 1.3% |
| gateway + simulator, `turn.service` | 0% | 0.9% |

Inclusive time of key frames at x10:

| Frame | Share |
|---|---|
| `decodeUtf8` | 10.7% |
| `sliceCodePointRanges` | 4.4% |
| `computeTextHash` | 2.7% |
| `getBytes` / AWS SDK | 1.7% |
| `Buffer.concat` | 1.3% |
| **Total S2** | **≈21% of wall time**, against 0% at idle |

`JSON.stringify` is 3.6%, almost all reader responses (5.8% at idle). The gateway and simulator account for only 0.4%.

**The mechanism.** In `LexicalRetrievalService.retrieve`, the per-book continuations of the `Promise.all` S2 block each run SHA-256 plus a full decode synchronously, about 15 ms per book. When several MinIO reads complete in the same poll phase, those continuations run back to back without yielding. Slicing then runs for every result book in one loop. A 10-book turn can therefore hold the event loop for about 150–200 ms in one stretch. Measured stall p95 was **273 ms** at x10 and **198 ms** at p3x3, including throttling pauses. A reader request needs several event-loop turns (auth, user lookup, book or sync-map query, serialization), and each waits behind such a block. `/sync-map` has the most and the longest of those steps, which is why it degrades most.

**Correlation.** Of the loaded reader requests ≥ 200 ms, 98% at x10 and 83% at p3x3 overlap a server stall ≥ 100 ms, and 100% overlap a stall ≥ 50 ms. GC pauses ≥ 20 ms overlap 34–42%. Throttling windows overlap 98–100%, but throttling occurs in 40–57% of all 100 ms windows, so that overlap alone is weak evidence.

## 4. Component-level timing breakdown

### 4.1 Isolated micro-benchmark

`/diag/bench`, under the cap, unloaded, 10 books × 5 iterations; ms per 2.14 MB book.

| Step | p50 | p95 | Notes |
|---|---|---|---|
| `getBytes` (MinIO fetch + stream + `Buffer.concat`, wall) | 16.4–18.7 | 73–82 | Mostly I/O wait; main-thread CPU about 3% of the x10 profile |
| SHA-256 (`computeTextHash`) | **1.6** | 6–12 | Hardware-accelerated; minor |
| Full decode (`TextDecoder`, fatal) | **13.2–13.7** | 62–64 | Materializes a 2 MB string |
| `buffer.isUtf8` + `toString` (same output) | 11.9–13.5 | 58–67 | **No cheaper decoder:** the cost is materializing the string |
| `sliceCodePointRanges` (8 passages across the book) | **5.0–6.0** | 59–65 | Scans the UTF-16 string up to the furthest offset |
| **Byte-level alternative:** `isUtf8` + code-point scan over bytes + decode passages only | **7.3** | 71 | **Output identical** to decode + slice on all 50 samples; replaces 19.2 ms with 7.3 ms and allocates no 2 MB string |
| Turn-sized `JSON.stringify` | 0.07 | 0.23 | Negligible |

The p95 values are inflated about 4–10× even unloaded, because the benchmark loop plus V8's GC helper threads overrun the 1-CPU quota and get throttled (§4.3).

### 4.2 In-path timers under load

| Condition | `retrieve` wall p50 / p95 | Rank SQL p50 / p95 | Main-thread S2 CPU per turn (decode + slice + SHA) | `prepare` p50 | `invoke` p50 |
|---|---|---|---|---|---|
| W=10 x10, production behaviour | 443 / 778 | 117 / 437 | 107 + 31 + 18 = **156 ms** | 93 | 23 |
| W=10 p3x3, production behaviour | 269 / 608 | 61 / 261 | 50 + 21 + 8 = **79 ms** | 226 | 27 |
| W=10 x10, `bytescan` | 249 / 440 | 98 / 353 | 2 + 26 + 12 = **40 ms** | 109 | 18 |
| W=10 x10, `s2free` (no S2 CPU) | 118 / 442 | 70 / 432 | 0 | 70 | 23 |
| W=10 p3x3, `s2free` | 63 / 186 | 48 / 168 | 0 | 87 | 23 |

Reading the components:

- **Database.** Ranking runs in PostgreSQL, which is uncapped and in another container, so it does not block the API event loop. The figures above are wall time seen by Node, including callback delay. All other per-turn queries (ledger, policies, turn records) have p50 of 1–10 ms.
- **`prepare`.** Its wall time grows with load (93 → 226 ms) while its CPU share stays small (gateway ≈ 0.4% of profile), so the time is spent waiting for the event loop and the database. It is not a CPU cause.
- **Simulated provider.** `invoke` p50 18–27 ms; ≈0.4% of CPU.
- **Serialization.** Turn result JSON ≈ 0.07 ms. Reader response serialization is a fixed idle cost (5.8% CPU at idle), not interference.
- **E-1.** With S2 removed, retrieval p95 under load is still 186–442 ms, set by the ranking query for frequent terms. The NEM-023 per-query table shows the same growth with match count (p50 5 ms at 0 matches, 392 ms at 9,855 matches). **E-1 has a database-ranking component that no S2 or API-process remedy addresses.** NEM-023 P-1 option (b), a deterministic candidate cap, is the relevant existing alternative. It is outside this mission's authorization.

### 4.3 GC and throttling

- **GC.** The full-book decode (a 2 MB string per book) and `Buffer.concat` (2 MB per book) allocate heavily. GC took 14% of wall time at x10 (scavenge plus mark-compact; max pause 292 ms when it coincided with throttling).
  - Diagnostic `--max-semi-space-size=32`: scavenges fell from 4,521 to 354 and GC time from 11.2 s to 2.0 s. Worst Δ dropped from +158 to +70.5 (x10) and from +208 to +105 (p3x3). **Not passing.** RSS rose to 248 MB.
- **Throttling.** Node runs more than one thread: V8 GC helpers, the libuv pool, and the inspector or a worker when present. Under a CFS quota, parallel threads can use up the 100 ms budget before the period ends, after which **every** thread, including the event loop, pauses until the next period.
  - Diagnostic `--cpuset-cpus=<one core>` (same quota, so threads share one core and cannot over-consume in parallel): throttled periods at x10 fell from 484 to 30. Worst Δ dropped to +58 (x10) and +75 (p3x3). **Not passing.**

## 5. Analysis of the one-second outliers (N-3)

### 5.1 Finding: a client-side measurement artifact

The Checkpoint E client sampled `docker stats --no-stream` with `execFileSync` every ~2 s. That call takes about 1.05 s and **blocks the client's own event loop**. Any reader request in flight then appears about 1 s slower.

| Evidence | Result |
|---|---|
| Reproduction run A (sync sampler) | 21 / 118 / 243 outliers ≥ 200 ms (idle / x10 / p3x3). **All 126 outliers ≥ 800 ms coincide with a client stall** (median 1,068 ms). 22 / 39 / 70 client stalls ≥ 500 ms. |
| Causal control, same boot | Sampler **on** (`sync`): 25 outliers ≥ 200 ms at idle, max 1,094 ms. Sampler **off**: **0** outliers ≥ 200 ms at idle, max 157 ms. |
| Across all 15 later idle runs with the sampler off | 0–3 outliers ≥ 200 ms, all inside the freeze events of §5.2 |

The other candidate causes were each checked:

| Candidate | Result |
|---|---|
| Container throttling | Present, but produces stalls of ≤ 100 ms per period, not ~1 s |
| GC | Max pause 89 ms at idle |
| Event-loop blocking | Server stall max 108 ms at idle |
| Database | `SELECT sync_maps` max 104 ms at idle |
| Periodic timers | The harness's 1 s sampler showed no matching server-side stall |
| Host contention | Load average ≤ 4.9 on 6 vCPU, steal 0 |

**N-3 is closed as a measurement artifact.** It is not a server or production behaviour. The p95 conclusions of Checkpoint E stand: the clean method fails as well (§2.1). The tooling now defaults diagnostic runs to `Q11_DOCKER_STATS=off`; the Checkpoint E default (`sync`) is kept for reproducibility. A PA decision on which method governs future Q-11 runs is requested (§9).

### 5.2 Separate, unexplained anomaly: multi-second freezes

**What was seen.** 17 events of 4.4–230.8 s occurred across 9 conditions. In each, the cgroup was throttled in every CFS period, for example 2,307 of 2,307 periods during the 230.8 s event, while using only about 4–84% CPU. The event loop and, once, the worker thread stopped. RSS was normal, there was no OOM, and the host was not swapping.

**When it happened.** Occurrences were spread across boots:

| Run | Mode | Events |
|---|---|---|
| B-W10-prof | profiler on | 1 |
| C-W10-s2worker | worker | 2 |
| E (single-core cpuset boot) | none, worker, bytescan | 13, in every run of that boot |
| G-W6-bytescan | bytescan | 1 |

There were none in Checkpoint E or in the B, C, D, F, and H clean runs.

**Effect on the results.** Each event delays one or two requests, which shows in max and p99, not p95. It does make the throughput figures unreliable in the affected runs: E-W10-cpuset-s2worker-nice19 x10 completed 68 turns in a 164 s window.

**Interpretation.** The pattern points to CFS bandwidth control on this host or kernel, not to application code. **The cause is not established.** A first hypothesis, that an extra thread is required, was refuted: freezes also occurred in single-thread `none` mode. The event matters for any production performance claim and should be checked on the production host, which runs a different kernel, before launch (§7).

## 6. Remedy comparison

### 6.1 What was measured

All runs below are clean: sampler off, diagnostics on. Worst reader Δp95 in ms.

| Mode or configuration | Contract status | W=10 x10 | W=10 p3x3 | W=6 p3x2 | W=3 p3x1 |
|---|---|---|---|---|---|
| `none`: production behaviour | n/a | +157.8 ✗ | +207.6 ✗ | +113.4 ✗ | +70.7 ✗ |
| `nohash`: SHA-256 memoized per object (stands in for "verify once per version") | **Breaks AC-11 / P-2** | +108.9 ✗ | +165.8 ✗ | – | – |
| `bytescan`: no full decode; per-request read and SHA-256 kept; whole-object fatal UTF-8 check kept | **Compatible** (output identical) | +82.0 ✗ | +106.4 ✗ | +73.3 ✗ | +51.8 ✗ |
| `s2free`: no S2 CPU on the main thread (bytes cached, verification memoized) | **Breaks AC-11 / P-2** (upper bound only) | **+0.2 ✓** | **+10.3 ✓** | **+8.7 ✓** | **+10.1 ✓** |
| `s2worker`: synthetic worker-isolation proxy; S2 CPU (SHA-256 + decode + slice) runs in a worker the turn awaits | Proxy of a compatible design | **+4.1 ✓** | **+26.9 ✓** | not run | not run |
| Single-core cpuset + `none` | Infrastructure configuration | +58.4 ✗ | +74.7 ✗ | – | – |
| Single-core cpuset + `bytescan` | Infrastructure configuration + compatible code | +53.2 ✗ | +66.1 ✗ | – | – |
| Single-core cpuset + `s2worker`, worker at nice 19 | Infrastructure configuration + proxy | **−0.8 ✓** | **+0.6 ✓** | – | – |
| `--max-semi-space-size=32` + `none` | Runtime configuration | +70.5 ✗ | +105.3 ✗ | – | – |

Research turn latency, p50 / p95 in ms:

| Condition | Production | `s2worker` | `s2free` | `bytescan` |
|---|---|---|---|---|
| 10-book (x10) | 749 / 1,172 | 493 / 853 | 434 / 744 | 455 / 697 |
| 3-book (p3x3) | 788 / 1,164 | 375 / 546 | – | 542 / 801 |

**No mode lowered research capability.** 10-book turns were exercised at W=10 in every condition. The remedies **reduce** turn latency.

**Limits of the `s2worker` proxy.**

- Main-thread bytes are served from a per-key cache, so the **fetch's own CPU** (AWS SDK stream and `Buffer.concat`, ≈3% of the x10 profile) and **transfer costs** are excluded.
- The worker does the same SHA-256, decode, and slice work per result book, and the turn awaits it.
- It is a **measurement proxy, not an implementation.** It does not show that a real implementation would pass Q-11 (§8).

### 6.2 Options compared

The worker-thread options keep per-request read, verification, and the fail-closed rules. Only *where* the work runs changes.

| Option | Reader improvement | CPU and memory | Complexity | New failure modes | 10-book commitment | Contract compatibility | Authorization needed |
|---|---|---|---|---|---|---|---|
| **A. Byte-level slicing** in `retrieve`: replace full decode + string scan with `isUtf8` + byte scan + passage decode | **Measured:** about −45% on Δ. **Fails at every W** (+52 to +106). | S2 CPU per book about −60%; no 2 MB strings, so less GC | Low: about 1 function, plus property tests for astral characters, BOM, invalid UTF-8, out-of-range offsets | Offset-mapping bugs, guarded by identical-output tests against `sliceCodePointRanges` | Kept | **Compatible** (fatal validation of the whole object kept) | PO: `src` change |
| **B. Version-aware verification** (skip SHA-256 per version) | **Measured** (proxy): small, Δ −30%; SHA is only 1.6 ms/book | Minimal | Medium | Trusting ETags; stale-hash callers | Kept | **Conflicts** with AC-11's per-request re-verification and the P-2 removal unless redesigned (for example an ETag-keyed cache that still compares the caller's hash) | PA + PO contract decision. **Not recommended:** low value. |
| **C. Verified-text cache** (`s2free`-like) | **Measured upper bound:** passes everywhere | +≈4 MB per cached book (bytes + string); bounded LRU of 10 books ≈ 40 MB | Medium | Staleness, memory pressure | Kept | **Conflicts** with NEM-023 AC-11 / P-2 (cache removed; "every retrieval re-reads and re-verifies") | PA + PO contract change |
| **D. Worker-thread S2 isolation**: one bounded worker verifies, validates, and slices; the main thread gets passages only | **Measured by proxy:** passes at W=10 (+4.1 / +26.9). Real implementation **not measured.** | Same total CPU. Worker isolate +≈10–30 MB (**estimate**). Book bytes transferred zero-copy. Turns get faster (proxy p50 493 vs 749 ms). | Medium-high: worker lifecycle, queue bound, timeouts, respawn on crash | Worker crash or hang (must fail closed as `unavailable`); quota contention between threads; the §5.2 freezes were seen twice with a worker active | Kept | **Compatible:** same per-request read, SHA-256, and fail-closed semantics, no cache | PO: `src` change; PA review of the threading design |
| **D + A.** Option D with byte-level slicing inside the worker | **Estimate:** at least as good as D, since the worker's CPU demand falls about 60%, which lowers quota contention and throttling | Lower than D | D + A | As D | Kept | Compatible | As D |
| **E. Runtime and container configuration**: single-core cpuset; larger semi-space | **Measured:** each alone −55% to −65% on Δ; neither passes alone. Cpuset + worker at nice 19 brought Δ to ≈0 (proxy). | Semi-space: RSS +≈75 MB | Low code, but deployment configuration | Cpuset ties the API to one host core; research may starve behind a busy reader at nice 19. All freezes in the cpuset boot (unexplained). | Kept | No contract impact | **Production configuration and infrastructure change:** PO, plus SA review. Not authorized here. |
| **F. Separate research container** | **Estimate:** isolates research CPU completely | +1 container, +≈150–250 MB, extra CPU allocation | Medium (deployment, networking) | Inter-service failure modes | Kept | Architecture change (ADR-level) | **Not authorized:** infrastructure and cost |
| **G. Accept a smaller W or a larger delta** | n/a | n/a | n/a | n/a | **Breaks** the 10-book NoetiaX turn under W < 10 (PO-027) | n/a | PO |

## 7. Confidence and remaining uncertainties

| Statement | Confidence | Basis or remaining gap |
|---|---|---|
| S2 main-thread work is the principal cause of Q-11 | **High** | Removing only S2 CPU flips every W from fail to pass, in the same boots, against the same idle reference. The profile shows S2 is ≈21% of wall time under load and 0% at idle. Stall p95 matches the per-turn S2 block sizes. |
| SHA-256 is not a material contributor | High | 1.6 ms/book; 2.7% of profile; the `nohash` gain sits within run-to-run noise |
| Throttling and GC amplify, but do not cause on their own | Medium-high | Each configuration change roughly halves Δ while the S2 work remains. Exact shares are uncertain because idle varies between boots (35–95 ms). |
| N-3 is a client artifact | **High** | 126/126 coincide with client stalls; disappears causally with the sampler off |
| A worker-thread implementation would pass Q-11 | **Medium; NOT established** | Proxy only: fetch CPU and transfer excluded; W=6 and W=3 not run with the proxy; quota contention on the production kernel unknown |
| E-1 cannot be met by S2 remedies alone | Medium-high | With S2 removed, ranking SQL p95 is still 168–432 ms under load. Uncapped and shared PostgreSQL adds variance. |
| Cause of the multi-second freezes | **Low / inconclusive** | CFS bandwidth pattern on this VM; not reproduced deliberately; production kernel and host not tested |
| Non-representativeness | Unchanged from Checkpoint E | Not the literal production image (needs `@nestjs/testing`); shared VM; synthetic texts; sequential reader client |

**Inconclusive or unsuccessful experiments, reported explicitly:**

1. The p3x3 CPU profile is contaminated by a 100 s freeze; only the x10 profile is used quantitatively.
2. The "extra thread causes freezes" hypothesis was refuted.
3. No cheaper equivalent decoder exists: `isUtf8` + `toString` costs the same as `TextDecoder`.
4. The throughput figure for E-W10-cpuset-s2worker-nice19 x10 is unreliable because of a freeze.
5. The `s2worker` proxy was not run at W=6 or W=3.

## 8. Recommended first intervention

**Option D + A: isolate the S2 per-book work in one bounded worker thread, and slice from bytes inside it.** Reasons:

1. It removes the measured principal cause from the event loop. The `s2free` upper bound passes at every W.
2. It is the only option measured to pass, even by proxy, at W=10 in the **current production container configuration** (+4.1 / +26.9 ms).
3. It preserves the accepted contracts:
   - per-request MinIO re-read;
   - SHA-256 verification against the caller's current hash;
   - whole-object fatal UTF-8 validation;
   - fail-closed `stale` / `unavailable`;
   - no cache.
4. It keeps the 10-book NoetiaX turn at W=10 and makes turns faster.
5. It needs no new dependency (`worker_threads` is built in) and no infrastructure.

Byte-level slicing (A) alone is **not** recommended as the first step: it was measured to fail at every W. It is folded into D to lower the worker's CPU demand. Configuration options (E) are held in reserve for a separately authorized step, only if D + A fails re-measurement.

**This recommendation is not a claim that Q-11 will pass.** That requires measuring the implementation under equivalent conditions.

## 9. Proposed implementation scope (requires separate authorization)

**In scope**, if authorized:

1. **`services/api/src/knowledge/retrieval/`:**
   - Add an S2 worker module (`worker_threads`): **one** worker, a bounded queue, a per-job timeout, and respawn on crash.
   - Main thread: run the `getBytes` read as today, then transfer the bytes zero-copy to the worker.
   - Worker:
     - compute `computeTextHash` and compare it with the row's hash;
     - validate fatal UTF-8 with `buffer.isUtf8` over the whole object;
     - map code-point offsets by a byte scan;
     - decode passages only;
     - return `{passages}`, `stale`, or `unavailable`.
   - Every worker error, timeout, or crash becomes the book's existing fail-closed exclusion. There is no retry that could double-charge, because S2 sits before any reservation.
2. **`LexicalRetrievalService.retrieve`:** delegate the per-book block to the worker. The SQL, ordering, budget trimming, metrics, and returned shapes are unchanged.
3. **Tests:**
   - unit tests for the byte-slicing function: identical-output property tests against `sliceCodePointRanges` across astral characters, BOM, CRLF, invalid UTF-8, and out-of-range offsets;
   - worker unit tests for timeout, crash, and stale/unavailable mapping;
   - existing retrieval integration suites to pass **unchanged**;
   - protected tests and the architecture boundary (single `computeTextHash` definition) kept.
4. **Re-measurement:** Q-11 W=10 → 6 → 3 with this harness, plus E-1 and turn latency, with the sampler off. The new code must also be run with the sampler on, for comparison with Checkpoint E.

**Out of scope:**

- caches;
- contract changes;
- concurrency defaults;
- container or runtime configuration (cpuset, Node flags);
- E-1 ranking changes (NEM-023 P-1 b);
- a separate container;
- merge, deploy, or activation.

**Decisions requested:**

| Decision | Owner |
|---|---|
| Authorize option D + A as specified above | PO |
| Accept the sampler-off client method (§5.1) for future Q-11 runs, keeping the sync method only for comparison | PA |
| Record N-3 as closed (measurement artifact) | PA + PO |
| Before launch, check the §5.2 freeze anomaly on the production host and kernel; propose as a separate operations task | PA + PO |
| Address the E-1 ranking component separately, on its own track | PO |

## 10. Raw data and reproducibility

| Item | Location |
|---|---|
| Aggregated raw measurements (28 conditions + 2 micro-benchmarks; percentiles, timers, GC, throttling, timelines, profile summaries, freeze list; no tokens or secrets) | [`2026-11-10-NEM-024-q11-root-cause-raw-measurements.json`](2026-11-10-NEM-024-q11-root-cause-raw-measurements.json) |
| Diagnostics module | `services/api/tests/perf/q11-diagnostics.ts` |
| Harness and client | `services/api/tests/perf/q11-harness.ts` (opt-in `Q11_DIAG`), `services/api/tests/perf/q11-client.ts` (`Q11_DOCKER_STATS`, `Q11_DIAG`, `Q11_PROF`, outlier and client-stall capture) |
| Procedure | `services/api/tests/perf/README.md` §PO-044 |
| Per-request event streams, `.cpuprofile` files, `vmstat` traces | Kept in the session scratchpad only; not committed because of size. Regenerable with the commands in §1.2. |

**Run names** in the raw file:

| Run | Configuration |
|---|---|
| A | Checkpoint E method |
| B | Clean; profile; sync-idle control |
| C | Ablations `nohash`, `s2free`, `s2worker` |
| D | `bytescan` |
| E | Single-core cpuset |
| F | Semi-space |
| G | W=6 |
| H | W=3 |

**To reproduce:** start the three disposable services, build the fixture, compile, then for each W run `boot.sh W 1` and the client with `Q11_DOCKER_STATS=off Q11_DIAG=1`. Set the mode with `/diag/mode` before each client pass. Each condition takes about 1–4 minutes. Keep to one heavy job at a time on the development VM.
