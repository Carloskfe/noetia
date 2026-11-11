# PO-046 — NEM-024: Residual Q-11 Performance Investigation (Diagnostic-Only Authorization) and Provisional Retention of PO-045

**Status:** `DECIDED` — Product Owner, 2026-11-11 (*NOETIA — Product Owner Authorization PO-046, NEM-024 — Residual Q-11 Performance Investigation*, §1–§13). **DIAGNOSTIC ONLY.**
**Domain:** AI services, Performance, Governance · **Authority:** Product Owner · **Review:** independent Product Architecture
**Date:** 2026-11-11 · **Baseline:** Draft PR #56 (`feat/nem-024-checkpoint-b`) at `98b99965447a4faa02018c3c7baa9b99a2b9fb08` (verified equal to the remote head before execution) · **Execution agent:** Claude Code
**Related:** [PO-043](PO-043-nem-024-checkpoint-e-authorization.md) · [PO-044](PO-044-nem-024-q11-root-cause-investigation-authorization.md) · [PO-045](PO-045-nem-024-q11-performance-remediation-authorization.md) ([report](../../../reports/2026-11-11-NEM-024-po-045-q11-remediation-report.md))

> Identifier: `PO-046` verified unused on all remote branches and in the commit history on 2026-11-11; continues after PO-045.

## Decisions

**A — PO-045 retained provisionally.** The PO-045 implementation (one bounded S2 worker thread with byte-level slicing) stays on the Draft branch pending further evaluation. This is **provisional retention, not acceptance**: PO-045 is not finally accepted, NEM-024 is not complete, and nothing is authorized for release.

**B — PO-046 authorized: diagnostic investigation only.** Find out why PO-045 still fails Q-11 at W=10 and W=6, and identify the smallest reliable, contract-compatible, cost-efficient next remedy. Questions:

| # | Question |
|---|---|
| Q1 | Storage-fetch overhead (SDK, streaming, buffer assembly, allocation, GC) |
| Q2 | CPU-quota saturation and throttling among the main thread, S2 worker and runtime helper threads |
| Q3 | Remaining synchronous main-thread work and its correlation with reader latency |
| Q4 | Minimal viable remedy without weakening contracts or raising cost |
| Q5 | Whether one container with one vCPU can satisfy both the ten-book commitment and reader protection, or an explicit statement that the evidence cannot establish it |

## Unchanged

- Q-11: reader p95 Δ ≤ **50 ms** (sampler off; 20 warm-ups + ≥ 1,000 requests per endpoint; same-run idle).
- E-1: retrieval p95 ≤ 150 ms.
- PO-027 ten-book capability; NEM-023 AC-11/P-2 (every retrieval re-reads and re-verifies; no verified-text or hash cache); exact-byte SHA-256; whole-object strict UTF-8; code-point slicing; `stale`/`unavailable`; ranking SQL and ordering; token budgets and citations; ledger and settlement; NEM-024 idempotency, cancellation and fenced recovery; reader isolation; privacy; default-deny; dark feature, simulated providers.

## Authorized

- Reuse of the Q-11 harness, approved synthetic fixtures, simulated provider, and disposable PostgreSQL, Redis and MinIO, under 1 vCPU / 512 MB / no swap.
- Opt-in diagnostic tooling under `services/api/tests/perf/`. No new dependency.
- Diagnostic ablations and substitutions inside disposable test processes or containers, explicitly labelled. Cached-byte or skipped-verification runs are **upper bounds only**: never contract-compatible, never Q-11 evidence.
- Sensitivity experiments with different CPU affinity, runtime or scheduling settings, **only in disposable test containers**, labelled as such.

## Not authorized

Permanent `src/` changes; implementing or merging any remedy; reader source changes; production Dockerfile or Compose changes; new containers in the deployment; more CPU, memory or capacity; tracked Node runtime flags; dependencies; API or SSE contract changes; schema or migrations; ranking or retrieval behaviour changes; book-limit or admission changes; relaxed thresholds; weakened protected tests; verified-text cache or skipped verification; paid AI; activation; billing or entitlement changes; production data; stopping unrelated workloads; merging PR #56; staging or production deployment; another mission; acting on a recommendation without new authorization.

## Deliverables and STOP gate

- Report: `docs/reports/2026-11-11-NEM-024-po-046-residual-performance-investigation.md` (§10C), with content-free raw measurements.
- Opt-in tooling under `services/api/tests/perf/`; PR #56 description updated; Draft state kept.
- **STOP** after reporting, for independent PA review and a PO decision. Completing the investigation does **not** authorize implementing the recommended remedy.
