# PO-044 — NEM-024: Q-11 Performance Root-Cause Investigation (Diagnostic-Only Authorization)

**Status:** `DECIDED` — Product Owner, 2026-11-10 (*NEM-024 — Product Owner Authorization: Q-11 Performance Root-Cause Investigation*, §1–§7). **DIAGNOSTIC INVESTIGATION ONLY.**
**Domain:** AI services, Performance, Governance · **Authority:** Product Owner · **Review:** independent Product Architecture
**Date:** 2026-11-10 · **Baseline:** Draft PR #56 at `e7fdb70` · **Related:** [PO-043](PO-043-nem-024-checkpoint-e-authorization.md) (Checkpoint E; this record is separate from it and does not extend it)

> Identifier: `PO-044` verified unused on all remote branches on 2026-11-10; continues after PO-043.

## Decision

The Product Owner authorizes a **limited diagnostic investigation** into the performance failures found in NEM-024 Checkpoint E.

The authorization does **not** approve any of the following:

- an implementation remedy;
- an architectural redesign;
- a changed concurrency limit;
- a relaxed performance target;
- additional infrastructure.

**Checkpoint E remains NOT QUALIFIED — Q-11 BLOCKING.**

## Objectives

Find the principal causes of:

- the Q-11 reader p95 degradation at W = 10, 6, and 3;
- E-1 retrieval p95 above its 150 ms target;
- the N-3 reader outliers of about one second.

The bottlenecks are to be measured, not assumed. Worker threads are not presumed to be the answer.

## Authorized diagnostic work

**A. Reproducible baseline.** Reuse the Checkpoint E harness and approved synthetic fixtures under the same 1-vCPU / 512 MB constraint. Record:

- idle and loaded p50, p95, and p99;
- event-loop delay and utilization;
- CPU use and throttling;
- memory and garbage collection;
- database latency and connections;
- research throughput.

The 50 ms reader p95-delta requirement is unchanged. Host contention and run-to-run variability are documented.

**B. CPU and event-loop bottlenecks.** Measure the contribution of each of these:

- ranking and candidate processing;
- storage reads;
- SHA-256 verification;
- decoding and slicing;
- citation and segment preparation;
- JSON serialization;
- database operations;
- the simulated provider;
- any other synchronous work found.

Use bounded profiling, timing instrumentation, and existing Node.js diagnostics, with no new dependencies.

**C. N-3 outliers.** Correlate them with:

- CPU throttling;
- garbage collection;
- event-loop blocking;
- database or network activity;
- periodic timers;
- host contention.

No cause is to be attributed without supporting measurements.

**D. Remedy evaluation, with no implementation.** Compare:

- reducing synchronous work in the retrieval path;
- incremental or version-aware verification, where it is compatible with the accepted rights and integrity contracts;
- worker-thread isolation in the existing container;
- other minimal optimizations supported by evidence.

A separate container may be discussed as a higher-cost alternative; it is **not** authorized. For each option, assess:

- reader-latency improvement;
- CPU and memory;
- complexity;
- failure modes;
- the 10-book NoetiaX commitment;
- contract compatibility;
- the authorization required.

Measured results are kept distinct from engineering estimates.

## Constraints

| Authorized | Not authorized |
|---|---|
| Diagnostic scripts and profiling with existing dependencies | Production source-code changes |
| Disposable local test services | Changes to accepted architectural contracts |
| Temporary, reversible instrumentation | A worker-thread implementation |
| Repeated measurements | New containers or infrastructure, or paid services |
| Documentation and test-only commits | Relaxing the 50 ms reader protection |
| | Reducing the 10-book capability |
| | Changing concurrency defaults |
| | Merging or deploying PR #56 |
| | Activating research or paid providers |

Protected tests are not modified, and acceptance criteria are not weakened.

## Deliverable and STOP gate

- **Report:** `docs/reports/2026-11-10-NEM-024-q11-root-cause-investigation.md`, covering:
  1. the environment;
  2. the baseline;
  3. profiling evidence;
  4. the component breakdown;
  5. the outliers;
  6. the remedy comparison;
  7. confidence levels;
  8. the recommended first intervention;
  9. the exact proposed scope;
  10. raw data and reproducibility.
- **Reporting rules:** inconclusive experiments are reported explicitly. No remedy is claimed to pass Q-11 unless it was measured under equivalent conditions.
- **Commits:** the governance record, tooling, and report are committed to the existing Draft PR branch.
- **STOP:** after reporting. Implementing any remedy needs independent PA review and a separate Product Owner decision.
