# PO-047 — NEM-024: Q-11 Performance Remediation and Requalification (Components C + A, Limited Implementation)

**Status:** `DECIDED` — Product Owner, 2026-11-11 (*NOETIA — Product Owner Authorization PO-047, NEM-024 — Q-11 Performance Remediation and Requalification*, §1–§18). **LIMITED IMPLEMENTATION + REQUALIFICATION ONLY.**
**Domain:** AI services, Performance, Runtime configuration, Governance · **Authority:** Product Owner · **Review:** independent Product Architecture
**Date:** 2026-11-11 · **Baseline:** Draft PR #56 (`feat/nem-024-checkpoint-b`) at `0c2b18622dac39367d08cdaa0ad0248df02cdda0` (verified equal to the remote head before execution) · **Execution agent:** Claude Code
**Related:** [PO-045](PO-045-nem-024-q11-performance-remediation-authorization.md) (retained provisionally) · [PO-046](PO-046-nem-024-residual-q11-performance-investigation-authorization.md) (accepted as the completed diagnostic investigation; [report](../../../reports/2026-11-11-NEM-024-po-046-residual-performance-investigation.md))

> Identifier: `PO-047` verified unused on all remote branches and in the commit history on 2026-11-11.

## Decision

One bounded implementation and requalification attempt, based on PO-046, with two components:

| Component | Change | Scope |
|---|---|---|
| **C — Runtime GC** | `--single-threaded-gc` | Applied to the existing **API process only**, in the API's actual production startup mechanism. No other V8 flag. No change to CPU, memory, worker count, Node version or admission weights |
| **A — Optimized S2 read** | A production-safe, byte-exact S2 object read: an internally presigned GET (private endpoint, existing client and credentials) into a validated, preallocated, owned buffer | The S2 worker keeps SHA-256 (`computeTextHash`), whole-object strict UTF-8 and byte-level slicing; `stale` and `unavailable` are unchanged. Confined to `storage.service.ts` and `storage-book-text.ts` unless essential |

**Requirements for Component A:**

- Destination constrained to the configured storage endpoint; no redirects; TLS verification preserved; bounded timeouts.
- Strict validation of status, length and completeness; every failure → `unavailable`; a complete read with a different hash → `stale`.
- No logging of URLs, keys or content; no new dependency.

**Retained decisions:**

| Item | Status |
|---|---|
| PO-045 | Retained provisionally, not accepted |
| PO-046 | Accepted as completed diagnostics |
| Checkpoint E | **NOT QUALIFIED** |
| Q-11 | **BLOCKING** until independent review of the qualification evidence |
| E-1 | **OPEN** |
| Earlier release prohibitions | All in force |

## Qualification gate

- **At least three independent, valid runs** per required workload: W=10 `x10`, W=10 `p3x3`, W=6 `p3x2`, W=3 `p3x1`.
- Compiled PO-047 code with the actual flag; 1 vCPU / 512 MB / no swap; disposable services; simulated provider; **sampler off**.
- **Pass:** for **every endpoint, every scenario and every valid run**, p95(load) − p95(idle) ≤ 50 ms, with every ten-book turn admitted and completed at W=10. Runs are never averaged.
- **Any valid run above 50 ms → STOP** and report. No further tuning, strategies or scope.

An API-wide stability assessment and an E-1 re-measurement (separate; E-1 stays OPEN if it fails) are required.

## Not authorized

Ranking SQL; retrieval contracts; concurrency weights; the ten-book limit; caches; range-only reads; weakened HTTP, TLS, rights or hash validation; ledger or billing changes; paid providers; infrastructure, services or containers; CPU or RAM increases; other runtime flags; web or mobile features; schema or migrations; dependencies; relaxed thresholds; removing protected tests; production data; live services; staging or production deployment; merging PR #56 or removing Draft; another mission; the PO-046 fallback options.

## STOP gate

After implementation, tests, requalification, report and PR update: **STOP** for independent PA review and PO acceptance. Passing tests is not PO acceptance.
