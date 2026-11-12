# PO-049 — NEM-024: E-1 Architecture Validation — Exact Ranking and Benchmark Representativeness (Diagnostic and Architectural Validation Only); PO-048 Accepted as Completed Diagnostics

**Status:** `DECIDED` — Product Owner, 2026-11-11 (*NOETIA — Product Owner Authorization PO-049*, §1–§17). **DIAGNOSTIC AND ARCHITECTURAL VALIDATION ONLY.**
**Domain:** AI services, Retrieval performance, Governance · **Authority:** Product Owner · **Review:** independent Product Architecture
**Date:** 2026-11-11 · **Baseline:** Draft PR #56 (`feat/nem-024-checkpoint-b`) at `689cdb33054978e3d39a4c496190c241acb64d77` (verified equal to the remote head before execution) · **Execution agent:** Claude Code
**Related:** [PO-045](PO-045-nem-024-q11-performance-remediation-authorization.md) · [PO-046](PO-046-nem-024-residual-q11-performance-investigation-authorization.md) · [PO-047](PO-047-nem-024-q11-remediation-and-requalification-authorization.md) · [PO-048](PO-048-nem-024-e1-ranking-root-cause-investigation-authorization.md) ([report](../../../reports/2026-11-11-NEM-024-po-048-e1-ranking-investigation.md))

> Identifier: `PO-049` verified unused on all remote branches, in the commit history and in the governance tree on 2026-11-11.

## Decision A — PO-048 accepted as a completed diagnostic investigation

PO-048 is accepted as completed **diagnostic** work, subject to its recorded limitations and the independent PA findings F-48-1..F-48-3. This accepts the investigation, **not** any proposed remedy.

## Decision B — statuses retained

| Item | Status |
|---|---|
| PO-045 | Retained provisionally |
| PO-046 | Accepted as completed diagnostics |
| PO-047 | Conditionally accepted for development progression; narrow Q-11 margin (1.8 ms, W=10 `p3x3`) and large-book memory risk **retained** |
| PO-048 | Accepted as completed diagnostics |
| **E-1** | **OPEN** |
| Checkpoint E | **NOT QUALIFIED** |
| Release | **BLOCKED** |

## Decision C — PO-049 authorized: bounded E-1 architecture validation

| Finding | Required investigation |
|---|---|
| **F-48-1** | Whether the proposed single-lexeme hybrid is genuinely exact: PostgreSQL 16 source audit, formal analysis, full-precision (unrounded) result-contract comparison, adversarial and property-based tests; verdict PROVEN EXACT / CONDITIONALLY EXACT / NOT EXACT / INCONCLUSIVE; counterexamples preserved as deterministic synthetic regression cases |
| **F-48-2** | Benchmark representativeness **without changing** the governing NEM-023 E-1 benchmark or criterion: supplementary, clearly labelled synthetic distributions (A governing, B more selective, C mixed realistic-style, D adversarial) |
| **F-48-3** | **At most two** further low-cost, exact-result-preserving ranking strategies, selected from the actual plans; stop if both fail |

**Objective:** determine whether end-to-end retrieval p95 ≤ 150 ms is achievable while preserving exact deterministic ranking, eligibility filtering, topK semantics, citation quality, full-object verification, the ten-book commitment and the one-vCPU low-cost envelope. A negative result is an acceptable outcome. The requirements may not be altered to produce a pass.

**Authorized changes:** this record and the existing decision/mission indexes and NEM-024 status; test-only diagnostics in `services/api/tests/perf/` (and necessary supporting test files); reports in `docs/reports/`. Experimental indexes or storage layouts only in disposable database clones, labelled, reversible and cleaned up.

## Retained exceptions

E-1 (open); Q-11 conditional development acceptance (thin margin, large-book memory under the 512 MB API limit, host representativeness); E-2; NEM-022 coverage; D-8; cancellation-record persistence; in-process-only cancellation; TT-14; SSE idle timeout; web coverage gate. None is waived.

## Not authorized

Any change to `services/api/src/` (including `RANK_SQL`), production SQL, migrations, production indexes, deployment configuration, Dockerfiles or Compose, protected test expectations, the E-1 acceptance rule or benchmark, web or mobile source, or product contracts; approximate ranking; a benchmark revision; additional CPU/RAM, paid services, search engines, database extensions, persistent containers or third-party dependencies; production or staging access; private customer text or analytics; merging PR #56 or removing Draft; deployment; activation; creating or executing PO-050 or any new mission; implementing any remedy.

## STOP gate

After the report, raw evidence and the Draft PR update: **STOP** for independent Product Architecture review and a Product Owner decision. A recommended architecture is not an approved architecture.
