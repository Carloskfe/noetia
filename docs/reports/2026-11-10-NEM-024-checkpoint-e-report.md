# NEM-024 Checkpoint E — Final Verification and Performance Qualification Report

**Status:** **CHECKPOINT E EXECUTED — NOT QUALIFIED: Q-11 FAILED AT W = 10, 6, AND 3 (§9.5 STOP CONDITION) — AWAITING INDEPENDENT PA REVIEW AND PO DECISION (2026-11-10).** NEM-024 is **not release-ready**. Not merged, not deployed, not activated, no paid provider used.
**Authorization:** [PO-043](../operating-framework/decisions/product-owner/PO-043-nem-024-checkpoint-e-authorization.md) · **Checkpoint D acceptance:** [PO-042](../operating-framework/decisions/product-owner/PO-042-nem-024-checkpoint-d-formal-acceptance.md) · **Baseline:** `be47cf2` · **Mission:** [NEM-024](../engineering-missions/APPROVED/NEM-024-research-turn-orchestration-and-minimal-bilingual-web-qa.md) §9.5, §11 items 11–14, §12, §13 · **Raw output:** [`2026-11-10-NEM-024-checkpoint-e-raw-measurements.json`](2026-11-10-NEM-024-checkpoint-e-raw-measurements.json)

## 0. Summary for the reviewer

| Area | Result |
|---|---|
| E1 regression | **All green.** API unit 1,956/1,956 · API integration 216/216 (1 opt-in suite skipped, run separately in E2) · web unit 448/448 · Playwright 2/2 (en, es) against the **production web build** · 6 architecture suites pass · TypeScript 0 errors · **API and web production builds complete** |
| E2 performance | **Q-11 FAILS at every W in the approved sequence.** The reader `GET /books/:id/sync-map` p95 delta is **+155 / +166 ms (W=10), +120 ms (W=6), +70 ms (W=3)**, against a ≤ 50 ms limit. Under §9.5, **W = 3 failing is a stop condition**, and W < 10 is a PO-027 conflict (Q-11). E-1 retrieval re-measured at **p95 842 ms** (target 150 ms) |
| E3 coverage | API global **94.34 / 80.20 / 92.48 / 95.46** (S/B/F/L), meeting 80% on this stack. Web **80.0 / 76.25 / 58.92 / 78.88**, below its gate (pre-existing) |
| E4 safety | Every listed property has passing evidence (§4). The SSE idle-timeout behaviour was demonstrated with a real proxy (§2.5) |
| Blocking | **B-1 (Q-11).** Escalation to PA and PO is required. No remedy was implemented, because every candidate is outside scope or needs a new authorization |
| New findings | N-1: the admission-cache Redis client refuses reservations until it connects (the first turn after a boot fails closed). N-2: two lint errors in the protected LW-5 test. N-3: about 1% of reader requests take ≈ 1 s, at idle and under load alike |

## 1. Governance and commits

| Item | Commit |
|---|---|
| PO-042 (Checkpoint D accepted) and PO-043 (Checkpoint E authorized); mission, register, and decision index | `7e8357c` |
| Performance tooling (test only: `services/api/tests/perf/`) | `33b26c8` |
| This report and the raw measurements | see the PR head |

**No `src/` file changed in Checkpoint E.** No protected test changed, no threshold changed, no dependency added, no production configuration touched.

## 2. E1 — Regression verification

**Environment:**

| Item | Value |
|---|---|
| Host | Development VM, Linux 7.0.0-43, 6 vCPU, 7.2 GiB RAM |
| Toolchain | Node 20.20.2, npm 10.8.2, Jest 29.7.0, Docker 29.9.3, Playwright 1.61.1 (Chromium) |
| Disposable services | `postgres:16-alpine`, `redis:7-alpine`, `minio/minio` on 127.0.0.1 only; removed afterwards |
| Host load | The VM was **not idle**: the main Noetia and AutoGuildX development stacks were running and were not stopped |

**Results:**

| # | Command | Result |
|---|---|---|
| 1 | `services/api`: `npx jest -c jest.integration.config.js --runInBand` (disposable DB) | **12 suites passed, 1 skipped (opt-in NEM-023 performance); 216 passed, 1 skipped, 0 failed** |
| 2 | `services/api`: `npx jest --coverage --maxWorkers=2` | **137 suites, 1,956/1,956**; coverage gate met (§3) |
| 3 | Architecture and protected-boundary suites (part of #2) | **6/6 pass:** `knowledge/architecture`, `gateway-architecture`, `contract-architecture`, `retrieval-architecture`, `turn-architecture`, `cost-architecture` (no `fragments`/`sync_maps` access from E6, no E6 ledger writes, no SDK or HTTP client, model-path registry unchanged) |
| 4 | `services/api`: `tsc --noEmit` (source and tests) | 0 errors |
| 5 | `services/api`: `eslint "src/**/*.ts"` | **0 errors**, 256 warnings (pre-existing `no-explicit-any` style) |
| 6 | `services/api`: `eslint "tests/**/*.ts"` | **12 errors.** 10 are pre-existing on `main` (unused variables in auth, books, clubs, ingestion, social, subscriptions). **2 are on this stack:** `no-var-requires` in the **protected LW-5 test**, `turn-record.store.spec.ts:98` (N-2; not changed, see §6) |
| 7 | `services/api`: `npm run build` (`nest build`) | **Completed**, 7.2 s, peak RSS 625 MB; `dist/main.js` and the new modules emitted |
| 8 | `services/web`: `npx jest --coverage --maxWorkers=2` | **21 suites, 448/448**. The pre-existing coverage gate fails (§3) |
| 9 | `services/web`: `tsc --noEmit` (app, tests) · `next lint` | 0 errors · **0 errors**, 15 warnings (pre-existing `<img>` and hooks warnings outside the research route) |
| 10 | `services/web`: `next build` (`NODE_OPTIONS=--max-old-space-size=2048`) | **Completed**, 28.8 s, peak RSS 585 MB. `ƒ /research/[sessionId]` is 8.87 kB, 124 kB first load |
| 11 | `services/web`: Playwright `tests/e2e/research-qa.spec.ts` against **`next start`** (the production build) | **2/2 (en, es)** |

**Limitations:**

- Playwright simulates the knowledge API by route interception (D-D6, accepted).
- The full-stack research path in a real browser cannot run while the module is dark.

## 3. E3 — Coverage

**API** (Jest `collectCoverageFrom`: `src/**/*.service.ts` and `*.provider.ts`; threshold 80% on every metric):

| Point | Statements | Branches | Functions | Lines | Gate |
|---|---|---|---|---|---|
| NEM-022 head (`f6a5cb7`) | — | 77.49 | — | — | Fail |
| NEM-023 accepted (§17.4) | 93.92 | 78.75 | 91.80 | 95.08 | Fail |
| NEM-024 Checkpoint B | 94.34 | 80.07 | 92.57 | 95.47 | Pass |
| NEM-024 Checkpoint C | 94.34 | 80.20 | 92.48 | 95.46 | Pass |
| **NEM-024 Checkpoint E (this run)** | **94.34** | **80.20** | **92.48** | **95.46** | **Pass** (exit 0, no threshold message) |

Per scope at Checkpoint E (statements / branches):

| Scope | Statements | Branches |
|---|---|---|
| `knowledge/sessions` | 98.73 | 90.09 |
| `knowledge/retrieval` | 100 | 97.59 |
| `knowledge/ai/gateway` | 96.06 | 94.35 |
| `knowledge/metering` | 98.84 | 95.17 |

**Web** (`collectCoverageFrom: lib/**/*.ts`; threshold 80% on every metric):

| Point | Statements | Branches | Functions | Lines | Gate |
|---|---|---|---|---|---|
| Baseline before Checkpoint D | 72.80 | 72.44 | 51.74 | 71.61 | Fail |
| Checkpoint D (`3178e40`) | 78.52 | 75.16 | 57.40 | 77.45 | Fail |
| **Checkpoint D corrected / E (`be47cf2`)** | **80.00** | **76.25** | **58.92** | **78.88** | **Fail** (branches, functions, lines) |

`lib/research.ts` is at 98.7 / 95.75 / 96.15 / 100. The web shortfall comes from older `lib` modules outside NEM-024.

## 4. E2 — Performance qualification

### 4.1 Retrieval (E-1), the approved NEM-023 fixture

Setup:

- 10 invented books of 2,000,000 code points each, with production chunking: 17,780 chunks, a 66.7 MB index, and the GIN index used.
- S2 reads go through the **real `StorageService` against a disposable MinIO**.
- Uncapped host process. Command: `NEM023_PERF=1 NEM023_PERF_KEEP=1 NEM023_MINIO_* … jest … retrieval-performance.int-spec.ts`; Jest needs `NODE_OPTIONS=--experimental-vm-modules` for the AWS SDK.

| Measure | NEM-023 §17.3 | **Checkpoint E** |
|---|---|---|
| Retrieval, 100 calls (10 books, topK 8, budget 6,000) | p50 187 ms · p95 594 ms · max 669 ms | **p50 368 ms · p95 842 ms · max 963 ms** |
| Indexing per book (median) | 0.95 s | 1.43 s |
| MinIO GET per object · hash and decode | 7.1 · 8.5 ms | 8.9 · 9.2 ms |
| Ranking SQL alone (p50) | 1.6 ms | 2.2 ms |

**Target p95 ≤ 150 ms: NOT MET.** Both retrieval and indexing ran about 1.5× slower than in NEM-023 on the same fixture, consistent with the busier shared VM. **Non-production-representative.**

### 4.2 Q-11 reader interference (§9.5 acceptance test)

**Method:**

- **Server:** `services/api/tests/perf/q11-harness.ts`, in `node:20-alpine` under **`--cpus=1 --memory=512m --memory-swap=512m`**, on host networking. It runs the **real `AppModule`** compiled with the API's own TypeScript configuration, with `KNOWLEDGE_MODULE_ENABLED=true` and the simulated provider only.
- **Test-module overrides only:**
  - the four dark ports, bound to fixture answers;
  - the throttler storage, set to never block (the client is a single IP).
- **Container-only environment value:** `INTELLIGENCE_OVERALL_UNRESOLVED_UNITS_BOUND=1e9`, without which the dark ledger refuses every reservation.
- **Research load:** generated **in-process** through the real `TurnService`, so it shares the event loop with the reader endpoints. Turns run **continuously at the guard limit**. Before any measurement, one turn must **complete** (3 segments, 2 citations).
- **Reader client** (`q11-client.ts`): a separate host process, outside the cap, sending sequential keep-alive requests:
  - 20 warm-up requests, then **1,000 measured requests per endpoint per condition**;
  - endpoints `GET /books`, `GET /books/:id` (JWT and subscription guards), and `GET /books/:id/sync-map` (the reader's phrase-text payload: 3,000 phrases ≈ 300 KB);
  - 40 published fixture books with sync maps at ≥ 90% coverage.
- **Pass rule:** p95(load) − p95(idle) ≤ 50 ms **per endpoint**, with idle measured in the same container. Every response was `200`, and there were 0 socket retries.

**Results:**

| W | Condition (weight) | `GET /books` p95 (Δ) | `GET /books/:id` p95 (Δ) | `GET /books/:id/sync-map` p95 (Δ) | Event-loop p99 / max | Turns completed (p50 / p95) | CPU avg / max | Peak memory | Result |
|---|---|---|---|---|---|---|---|---|---|
| 10 | idle | 6.6 | 10.4 | 54.2 | 38.7 / 85.6 ms | — | 0.9 / 1.2% | 76 MiB | — |
| 10 | 1 × 10-book (10) | 9.9 (+3.4) | 18.3 (+7.9) | **209.2 (+155.0)** | 142.7 / 273.2 ms | 192 · 10-book 450 / 755 ms | 68.8 / 90.2% | 122 MiB | **FAIL** |
| 10 | 3 × 3-book (9) | **78.1 (+71.5)** | **122.8 (+112.4)** | **220.3 (+166.1)** | 130.1 / 220.9 ms | 896 · 3-book 512 / 761 ms | 104.6 / 116.2% | 112 MiB | **FAIL** |
| 6 | idle | 7.1 | 10.6 | 53.1 | 41.5 / 81.3 ms | — | 1.0 / 2.0% | 76 MiB | — |
| 6 | 2 × 3-book (6) | 55.6 (+48.5) | **88.7 (+78.1)** | **173.0 (+119.8)** | 106.8 / 180.4 ms | 599 · 3-book 380 / 572 ms | 97.9 / 110.5% | 102 MiB | **FAIL** |
| 6 | probe: one 10-book turn | refused before reservation: `budget_unavailable` · `guard: exceeds_limit` · `retryAfterSeconds: 1` | | | | | | | as designed |
| 3 | idle | 6.9 | 10.8 | 55.3 | 43.8 / 87.7 ms | — | 1.0 / 1.6% | 75 MiB | — |
| 3 | 1 × 3-book (3) | 12.2 (+5.3) | 42.4 (+31.6) | **124.8 (+69.5)** | 83.0 / 140.1 ms | 332 · 3-book 241 / 419 ms | 71.5 / 83.2% | 97 MiB | **FAIL** (sync-map) |
| 3 | probe: one 10-book turn | refused (`exceeds_limit`) | | | | | | | as designed |

All latencies are in ms, from the client.

**Database and resource pressure:**

| Measure | Value |
|---|---|
| PostgreSQL connections for the database | ≤ 7 (≤ 4 active) at peak (3 × 3-book); the TypeORM pool default is 10. No saturation |
| Memory | Never above 123 MiB RSS (cap 512 MiB); no OOM kill. **CPU is the binding constraint, not memory**, confirming the §9.5 discovery |
| CPU | `docker stats` shows ≈ 100% of the single vCPU at weights 6 and 9 |
| Guard refusals | 0 at the guard limit; no turn failures |

**Read-out against §9.5:**

1. **W = 10 fails.** One 10-book turn adds +155 ms to the sync-map p95. Three 3-book turns add +71 to +166 ms across all three endpoints.
2. **W = 6 fails** on two endpoints (+78, +120 ms).
3. **W = 3 fails** on the sync-map endpoint (+69.5 ms); `GET /books` (+5.3) and `GET /books/:id` (+31.6) pass. **Under §9.5, "if W = 3 fails: stop condition".** The remedies named there need separate approval:
   - worker threads;
   - reducing NEM-023's per-book synchronous block;
   - a separate container.
4. **Any W < 10 also means 10-book NoetiaX turns can never be admitted** (demonstrated by the probe). That is a product conflict with PO-027, and §9.5 requires escalation to PA and PO (Q-11).
5. The guard works as specified: weighted admission before reservation, `exceeds_limit` and `over_limit` without a charge, and no queueing.

**Representativeness: NON-PRODUCTION-REPRESENTATIVE.**

| Factor | Effect |
|---|---|
| The CPU and memory cap were reproduced (`--cpus=1`, 512 MiB, no swap) | Matches the deployment constraint |
| Not the literal production image: the same compiled code on the same base image (`node:20-alpine`) | The production image's `--omit=dev` install cannot include `@nestjs/testing`, which the port overrides need |
| The host was shared with other running stacks | Run-to-run variance |
| The fixture texts are synthetic | Real verified texts may behave differently |
| The client is sequential (one reader at a time) | Many concurrent readers would make the deltas **larger**, not smaller |

The direction of every bias other than host contention makes the real production result **no better**. Even the idle sync-map p95 (≈ 54 ms) and idle event-loop p99 (≈ 40 ms) show that serialising the reader payload is already heavy on one vCPU.

**N-3 (observed, unexplained): about 1% of requests take ≈ 1,050–1,280 ms**, in every condition including idle (the idle sync-map p99 is 1,055 ms, and every endpoint's max is ≈ 1.06 s at idle). The outliers affect idle and load equally, so the **p95 deltas are unaffected**. A periodic ~1 s stall in the capped container must be explained before any production latency claim. Candidates: CFS quota throttling of the capped process, a ~1 s timer in the boot graph, or a host network artifact.

### 4.3 Research-turn latency (simulator; AC-12)

Under the cap, with no other load:

| Turn | p50 | p95 |
|---|---|---|
| 3-book turn | 241 ms | 419 ms |
| 10-book turn | 450 ms | 755 ms |

These are end-to-end `TurnService.run` timings: entitlement, eligibility, retrieval, reservation, lock, final check, provider, settlement, and T1. Under the competing loads in §4.2 the figures rise to p50 380–512 ms and p95 572–761 ms.

### 4.4 Recovery and cancellation under interruption

All verified on real PostgreSQL in the regression run (E1 #1):

- **R1–R12** and **LW-1 to LW-10** (Checkpoint B), including:
  - the scheduled sweep after a fence;
  - lazy finalization from replay, history, single-turn reads, and cancel;
  - a crash with no owner;
  - the 200-interleaving monotonicity property.
- The Amendment 2 cancel-versus-lock-commit race property (25 seeded timings).
- Cancellation at every §9.3 stage.
- A disconnect at `composing` and during the provider attempt (Checkpoint C).

### 4.5 SSE under realistic idle timeouts (exception 9)

**Configuration analysis:**

| Hop | Timeout | Effect on a silent SSE response |
|---|---|---|
| Browser → Cloudflare | DNS-only (gray cloud): **no proxy** | None |
| Traefik v2.11 (`infra/server/traefik/traefik.yml`) | No `respondingTimeouts` set. Defaults: `writeTimeout` 0, `idleTimeout` 180 s (keep-alive idle only); `readTimeout` applies to reading the request | **Does not cut** a silent response |
| Dev nginx (`nginx/nginx.conf` `/api/`) | No override, so **`proxy_read_timeout` 60 s** | Cuts after 60 s of silence |
| API | The longest silent gap is between `composing` and `terminal`: provider time ≤ `INTELLIGENCE_PROVIDER_TIMEOUT_MS` (default 30 s) × attempts (default 1), plus completion writes (≤ 2 × 5 s). **≈ 40 s by default**; fence = 40 s + 30 s grace = 70 s | — |

**Live probe** (`tests/perf/sse-idle.ts`): disposable `nginx:1.25-alpine` in front of the harness, provider timeout 8 s, the simulator scripted to go silent (one delta, then a hang).

| Proxy timeout | Scenario | Via proxy | Same-key replay afterwards |
|---|---|---|---|
| 60 s | Normal turn | Stages at 36, 51, and 254 ms, then content and the terminal at 275 ms (**incremental, not buffered**) | `completed` |
| 60 s | **8 s silent** | Stages at 17–257 ms; **terminal `failed` (provider timeout) at 8,281 ms. Delivered** | `failed` (recorded) |
| 5 s | Normal turn | Terminal at 308 ms | `completed` |
| 5 s | **8 s silent** | Stages delivered, then **cut at 5,007 ms** (nginx: "upstream timed out … while reading upstream") | **`failed`, recorded by the server, which continued after the cut. No cancel** (D-9 a) |

**Conclusion:**

- With the default configuration, the longest silent gap (≈ 40 s) is below every proxy idle timeout on the path: nginx dev 60 s, Traefik none.
- Configurations that raise the provider timeout or the number of attempts can exceed 60 s. The cut is then **recoverable**: the turn is persisted, the web client's same-key recovery returns it (F-D2/F-D3), and nothing is double-charged.
- A heartbeat (an SSE comment frame) would be an **accepted-transport-contract change** (D-C1–D-C3) and was **not implemented**.

## 5. E4 — Safety and correctness verification

| Property | Evidence (all passing in this run unless noted) |
|---|---|
| Gateway validation, reservation, settlement, release | NEM-022 Gateway suites (unit, plus `gateway-e2e` integration). `turn-question`: happy path (retrieval → reserve → lock + T0 → final check → provider → settle → T1). The ledger settles inside the Gateway before T1. B-2 release failure → `unconfirmed`, held. Architecture: **no E6 writes to ledger tables** |
| Idempotent same-key replay | `turn-question` replay (no reservation, no provider call). `turn-stream` replay over SSE. Web: Ask again uses a new key; recovery uses the same key (F-D2) |
| No duplicate provider execution or billing | Concurrent duplicates: one reservation, one invocation (spy), one row. Duplicate while provisional → `pending`, one reservation. One provisional turn per session |
| Pre-lock and post-lock cancellation | Amendment 2 suite (pre-lock rollback, in-transaction blocked race, 25-timing property). §9.3 rows (after the lock, during the provider, after settlement). SSE cancel tests |
| PostgreSQL recovery after interruption | R1–R12, LW-1 to LW-10, the scheduled sweep and lazy finalization (§4.4) |
| Unrecorded responses (D-8) | `turn-question` persistence-failure injection. SSE `persisted:false, unrecorded:true`. Web "not saved" state. Replay → `pending`, then `interrupted`, never the answer |
| Capability and entitlement | Probe deny-first (no grant, prerequisite, flag off), unit and integration. HTTP route precedence. Web gating hides the screen before any session request |
| Rights-revoked citation protection | D-10 history redaction (available → revoked → stale → unavailable). The final eligibility check refuses with `book_ineligible` and releases. Web dialog never shows text for revoked, stale, unavailable, or deferred |
| Disconnect without implicit cancellation | Integration: disconnect at `composing` and during the provider (provider signal not aborted). **Live proxy cut (§4.5): the turn completed server-side.** Web: unmount and lost connection never call cancel |
| Browser recovery privacy | F-D1 suite: sessionStorage only, account-bound, 15-minute expiry, logout sweep, legacy purge. Playwright: no entry remains after recovery |
| English and Spanish errors | 20 error codes × en/es table test; every component state in both locales; i18n parity; Playwright per locale |

## 6. Findings

| Id | Severity | Finding | Proposed correction (not implemented) |
|---|---|---|---|
| **B-1** | **Blocking (release)** | **Q-11 fails at W = 10, 6, and 3** (§4.2): a §9.5 stop condition and a PO-027 conflict | **PA and PO decision required.** Options, each needing its own authorization:<br>(a) move S2 retrieval work (fetch, SHA-256, decode, slice) off the main event loop with a worker thread, within the same container (no infrastructure);<br>(b) reduce NEM-023's per-book synchronous work (incremental hashing, cached verified hashes per text version);<br>(c) a separate container for research (infrastructure cost);<br>(d) accept a larger reader delta or a smaller W, with the PO-027 consequence.<br>Engineering recommends evaluating **(a) first**: it targets the measured cause (CPU on one event loop) at no infrastructure cost. Re-run Q-11 with this harness afterwards |
| N-1 | Non-blocking | The admission-cache Redis client uses `enableOfflineQueue: false`, so a reservation before it connects is refused (`ledger_unavailable` → `budget_unavailable`). **The first turn after an API boot can fail closed** (observed every time in the harness; attempt 2 succeeds) | A `src` change (connect or await readiness before accepting turns, or allow a bounded offline queue) needs authorization. Safe as is (fail-closed, no charge) |
| N-2 | Non-blocking (hygiene) | Two `@typescript-eslint/no-var-requires` errors in the **protected** LW-5 test (`turn-record.store.spec.ts:98`), introduced on this stack | Replace the two inline `require` calls with `import { readFileSync } from 'fs'; import { join } from 'path';`. The assertion is unchanged. **Needs PA consent**, because it edits a protected test |
| N-3 | Non-blocking (investigate) | About 1% ≈ 1 s reader outliers in the capped container, at idle and under load (§4.2) | Investigate before any production latency claim. The deltas are unaffected |
| R-E1 | Non-blocking | E-1 re-measured worse (p95 842 ms) on the busier VM | Re-measure on a quiet host or real verified texts (NEM-023 §18 plan) |

## 7. E5 — Exception register

| # | Exception | Current status | Evidence | User or operational impact | Recommended disposition | PO action? |
|---|---|---|---|---|---|---|
| 1 | **E-1:** retrieval p95 vs 150 ms | **OPEN; not met** | p95 **842 ms**, p50 368 ms (§4.1); NEM-023 measured 594 ms | Slower answers (turn p50 ≈ 0.24–0.45 s with the simulator); it compounds B-1 | Keep open. Re-measure on real texts or a quiet host. Any ranking or candidate-cap remedy needs its own decision (NEM-023 P-1) | **Yes**, before launch |
| 2 | **E-2:** NEM-023 global API branch coverage (78.75% < 80%) | **Evidence now meets the threshold on this branch stack** | **80.20%** global branches (§3); every metric ≥ 80%; exit 0 | None for users; CI hygiene | **Recommend closure** once the stack is merged and `main` reproduces ≥ 80% (it is a stack figure until then) | **Yes** (formal closure) |
| 3 | **NEM-022 coverage exception** (77.49%) | **Evidence now meets the threshold on this branch stack** | Same run: 80.20% | As #2 | **Recommend closure**, under the same merge condition | **Yes** |
| 4 | **D-8:** unrecorded answer and a possible unseen charge | OPEN; inherent residual (by design) | Persistence-failure tests; SSE `persisted:false`; web "not saved"; metric `intelligence_turn_unrecorded_total` | A user may be charged for an answer they never saw, if both the completion write fails **and** the response is lost (rare double fault) | Keep as an **accepted residual risk**, with monitoring of the metric. Launch acceptance requires explicit PO sign-off | **Yes**, at launch |
| 5 | Cancellation terminal-record persistence failure | OPEN; documented residual | Amendment 2 and B-2 tests: `recorded:false`, released first, replay → `pending` | No charge. The user sees "processing" for that key until the history shows the real state | Keep documented. **No action** unless the PO wants a reconciliation job (new scope) | No (informational) |
| 6 | In-process-only cancellation | OPEN; **valid only for one API instance** | `docker-compose.server.yml` runs one `api`; registry tests | A cancel on another instance would not abort a live provider call (T3 still records) | Keep. A shared channel needs approval **before** horizontal scaling | Only before scaling |
| 7 | **Q-11:** weighted concurrency | **FAILED; BLOCKING** | §4.2: W=10, 6, and 3 all exceed 50 ms; the W=3 stop condition | Research load degrades the reader (+70 to +166 ms p95), the daily-user path that is priority 1 in CLAUDE.md | **Escalate** (B-1). Do not select any W. Re-qualify after an authorized remedy | **Yes**, PA and PO |
| 8 | **TT-14:** generated-answer retention and rights | **OPEN; unresolved** | Answer text is kept and returned in history (D-10 a default) | A rights or retention policy question for generated text that quotes books | PO decision before launch | **Yes**, before launch |
| 9 | SSE heartbeat and proxy idle timeout | OPEN, **low risk under the current configuration** | §4.5: the default silent gap ≈ 40 s is under nginx 60 s and Traefik's none. Live cut demonstrated; recovery via same-key replay | Only if provider timeout × attempts is raised past about 50 s; even then recoverable, with no double charge | **Recommend accepting as a documented risk**, with an operational rule: keep the maximum silent window below the smallest proxy timeout. A heartbeat is a transport-contract change and would need its own decision | Yes (accept or authorize a heartbeat) |
| 10 | Web coverage below its gate | OPEN; pre-existing | Branches **76.25%** vs 80 (72.44% before NEM-024); `research.ts` 95.75% | CI hygiene; no user impact | Keep open. A separate web-coverage task (older `lib` modules); NEM-024 already raised it | Yes (assign separately) |

**Nothing is closed or waived by this report.**

## 8. Engineering recommendations

| Category | Items |
|---|---|
| **Verified requirements** | **Function:** turn wiring and record; durable completion and idempotency; the duplicate table; the cancellation matrix including Amendment 2; fenced recovery R1–R12 and LW-1 to LW-10; D-10 redaction; the final eligibility check; the SSE contract (D-C1–D-C3) and the probe; the minimal bilingual web Q&A including F-D1–F-D3.<br>**Boundaries:** dark defaults; no `fragments`/`sync_maps` access from E6; no E6 ledger writes; the weighted guard's admission semantics.<br>**Quality:** API and web production builds; API coverage ≥ 80% on the stack |
| **Unverified requirements** | AC-11 / §9.5 reader protection (**failed**, not merely unverified). Production-image measurement (approximated, §4.2). Real verified texts (E-1 re-measurement). A full-stack browser flow with real research turns (the module is dark). Behaviour behind the real Traefik (analysed, not probed live) |
| **Blocking defects** | **B-1, Q-11**: §9.5 stop condition |
| **Non-blocking documented risks** | N-1 (boot fail-closed); N-2 (lint in the protected test); N-3 (≈ 1 s outliers); R-E1 (E-1 variance); exceptions 4, 5, 6, 9, and 10 |
| **Items requiring a new PO decision** | B-1 remedy path and W; exceptions 1, 2, 3, 4, 7, 8, 9, and 10 (as tabled); consent for the N-2 fix; whether to fix N-1 |

**NEM-024 is not release-ready.** Missing or failing evidence: Q-11 (failed), E-1 (not met), and TT-14 (undecided). Separately authorized launch prerequisites (mission §14) remain:

- E3/E4 adapters;
- TT-22, TT-11/13/14;
- NEM-023 RB-1..RB-7;
- billing (E10);
- the merge order.

## 9. Boundaries

**No `src/` file was changed.** The only new code is test tooling in `services/api/tests/perf/`.

Not done:

- no protected test or threshold changed;
- no dependency or service added (disposable local containers only, removed);
- no production configuration change;
- no merge, no staging or production deployment;
- no feature activation, no paid provider (simulator only);
- no subsequent mission started.

**STOP: submitted for independent Product Architecture review.**
