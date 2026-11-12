# PO-043 — NEM-024 Checkpoint E: Execution Authorization (Final Verification and Performance Qualification)

**Status:** `DECIDED` — Product Owner, 2026-11-10 (*NEM-024 — Checkpoint D Formal Acceptance and Checkpoint E Execution Authorization*, §3–§7). **AUTHORIZE CHECKPOINT E ONLY.**
**Domain:** AI services, Governance · **Authority:** Product Owner · **Review:** independent Product Architecture
**Date:** 2026-11-10 · **Baseline:** Draft PR #56 at `be47cf2` · **Governance:** [PO-042](PO-042-nem-024-checkpoint-d-formal-acceptance.md)

> Identifier: `PO-043` verified unused on all remote branches on 2026-11-10; continues after PO-042.

## Decision

Checkpoint E is executed under the approved NEM-024 specification and its acceptance criteria (§9.5, §11 items 11–14, §12). Earlier approvals are not reinterpreted as permission to expand scope.

## Scope

**E1 — Regression:**

- API unit and PostgreSQL integration suites;
- web unit suite;
- English and Spanish Playwright flows;
- architecture and protected-boundary tests;
- TypeScript and lint;
- production builds for the API and the web.

Record commands, environment, counts, skips, and limitations. A production build is claimed only if it completes.

**E2 — Performance:** simulated providers and approved fixtures only. Measure:

- retrieval p50/p95;
- research-turn latency;
- reader-path p95 with and without concurrent research;
- CPU, memory, and database pressure;
- SSE under realistic idle timeouts;
- recovery and cancellation under interruption.

Q-11 runs in the sequence **W=10 → 6 → 3** as needed. W=10 is only a candidate and is not selected if the reader p95 delta exceeds 50 ms or another constraint fails. Results are labelled non-production-representative when the 1-vCPU/512 MB constraints cannot be reproduced accurately.

**E3 — Coverage:** API and web, measured independently (statements, branches, functions, lines), compared with earlier checkpoints, with a closure recommendation per exception. Thresholds are not weakened and protected tests are not changed.

**E4 — Safety and correctness:**

- Gateway validation, reservation, settlement, and release;
- idempotent replay;
- no duplicate execution or billing;
- pre-lock and post-lock cancellation;
- PostgreSQL recovery;
- unrecorded handling;
- capability and entitlement;
- revoked-citation protection;
- disconnect without cancellation;
- browser recovery privacy;
- en/es errors;
- investigation of the SSE heartbeat and idle-timeout risk.

**E5 — Exception register:** each of the ten exceptions, with status, evidence, impact, recommended disposition, and whether PO action is required. Nothing is silently closed or waived.

## Operating constraints

- Cost-efficient: existing infrastructure, fixtures, and tools.
- Disposable databases only; no destructive tests against production or staging; no paid provider calls.
- Reduce the footprint, or stop and document, if the host's resources are at risk.

## STOP conditions

Request authorization before:

- changing an accepted backend or transport contract;
- introducing a dependency or service;
- increasing infrastructure costs;
- changing production configuration;
- merging;
- deploying to staging or production;
- enabling paid providers;
- activating the research feature;
- starting a subsequent mission or expanding NEM-024.

**STOP after committing and pushing the Checkpoint E report; await independent PA review.**

## Exceptions carried (not waived)

1. E-1 — retrieval p95.
2. E-2 — NEM-023 branch coverage.
3. NEM-022 coverage exception.
4. D-8 — unrecorded answer and potential unseen charge.
5. Cancellation terminal-record persistence failure.
6. In-process-only cancellation signalling.
7. Q-11 — weighted concurrency qualification.
8. TT-14 — generated-answer retention and rights.
9. SSE heartbeat and proxy idle timeout.
10. Web coverage below its existing gate.
