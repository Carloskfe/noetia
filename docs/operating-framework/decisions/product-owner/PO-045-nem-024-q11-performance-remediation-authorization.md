# PO-045 — NEM-024: Q-11 Performance Remediation (Option D + A, Limited Implementation Authorization)

**Status:** `DECIDED` — Product Owner, 2026-11-11 (*NOETIA — Product Owner Authorization PO-045, NEM-024 — Q-11 Performance Remediation*, §1–§10). **LIMITED SCOPE: implementation, tests, documentation and reporting only.**
**Domain:** AI services, Performance, Governance · **Authority:** Product Owner · **Review:** independent Product Architecture
**Date:** 2026-11-11 · **Baseline:** Draft PR #56 (`feat/nem-024-checkpoint-b`) at `d937d2b57081ea805428d5bc667cfded28250a32` (verified equal to the remote branch head before execution) · **Execution agent:** Claude Code
**Related:** [PO-043](PO-043-nem-024-checkpoint-e-authorization.md) (Checkpoint E; Q-11 failed at W = 10, 6, 3) · [PO-044](PO-044-nem-024-q11-root-cause-investigation-authorization.md) (diagnostic investigation; [report](../../../reports/2026-11-10-NEM-024-q11-root-cause-investigation.md) §8–§9 recommended Option D + A)

> Identifier: `PO-045` verified unused on all remote branches and in the commit history on 2026-11-11; continues after PO-044.

## Decision

The Product Owner approves the narrowly scoped Q-11 remediation recommended by the PO-044 investigation: **Option D + A**.

- **D:** one bounded Node.js worker thread per API process performs the per-book S2 work — exact-byte SHA-256 through the existing `computeTextHash`, full-object strict UTF-8 validation, code-point→byte offset mapping, and decoding of the requested passages only.
- **A:** byte-level code-point slicing, which never materializes the whole book as a JavaScript string.

The storage read stays on the main asynchronous path. The worker stays inside the existing API process and deployment footprint.

This authorization supersedes PO-044's diagnostic-only restriction **solely for this implementation**. It supersedes no other product decision, accepted architecture, rights contract, financial control or release restriction. **This is a performance-isolation remedy, not a redesign of retrieval.**

## Unchanged criteria

- **Q-11:** p95(load) − p95(idle) ≤ **50 ms** for every protected reader endpoint, against the same run's idle baseline, in every required scenario (W=10 `x10`, W=10 `p3x3`, W=6 `p3x2`, W=3 `p3x1`), **and** the 10-book turn correctly admitted at W=10. Governing client method: **sampler off**; the synchronous `docker stats` method is kept only as a labelled historical comparison.
- **E-1:** retrieval p95 ≤ 150 ms. The PostgreSQL ranking component is **not** in scope; if E-1 stays above target it is recorded **OPEN**.
- No increase in infrastructure cost; no reduction in accepted product functionality; W=10 for the ten-book NoetiaX turn.

## Preserved contracts (non-negotiable)

- NEM-023 AC-11 / P-2: every retrieval re-reads and re-verifies the object; **no** verified-text, object, hash, version or passage cache.
- `RetrievalPort`, `RetrievalRequest`, `RetrievalResult`, `Passage`, exclusion and metrics contracts; ranking SQL, ordering, eligible-book selection, token-budget trimming, citation anchors.
- Hash mismatch → `stale`; storage failure, invalid UTF-8, worker failure, timeout, saturation or unavailability → `unavailable` (fail closed). Never unverified text; never a main-thread fallback for the full-book work.
- `computeTextHash` remains the single hash definition.
- NEM-021/022 ledger and settlement; NEM-024 idempotency, cancellation, fenced recovery, terminal finality; default-deny capability; privacy boundaries; no content in logs or metrics; dark feature, simulated provider only.
- Protected tests are not modified.

## Not authorized

Ranking SQL or the E-1 candidate cap; a separate container, service, queue infrastructure or server; new dependencies, paid APIs or providers; production or Docker configuration, CPU pinning, Node flags or memory changes; concurrency weights, admission rules, book limits or thresholds; API, SSE, rights or persistence contract changes; schema changes or migrations; frontend, mobile or reader features; AI pricing, entitlements, quotas or billing; weakening tests, coverage gates or security checks; merging PR #56 or taking it out of Draft; deployment to staging or production; activation; another mission or further remedies.

Minimal build wiring needed to package and run the worker inside the existing API build is permitted only if it changes neither deployment architecture nor runtime configuration, and must be documented.

## Deliverables and STOP gate

- Focused commits on `feat/nem-024-checkpoint-b`: governance (this record), implementation and tests, report.
- Report: `docs/reports/2026-11-11-NEM-024-po-045-q11-remediation-report.md` (§8C of the authorization), with reasonably sized raw measurements.
- PR #56 description updated; Draft status kept.
- **STOP** after reporting, for independent Product Architecture review and a Product Owner decision. Passing the PO-045 gates means **ready for PA review**, not approved for release. Checkpoint E is not qualified by this record.
