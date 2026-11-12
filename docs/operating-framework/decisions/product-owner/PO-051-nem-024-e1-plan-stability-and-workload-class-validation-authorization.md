# PO-051 — NEM-024: E-1 Plan Stability and Workload-Class Architecture Validation (Bounded Diagnostic and Architecture Validation Only); PO-050 Accepted as Completed Diagnostics

**Status:** `DECIDED` — Product Owner, 2026-11-12 (*NOETIA — Product Owner Authorization PO-051*, §1–§14). **BOUNDED DIAGNOSTIC AND ARCHITECTURE VALIDATION ONLY.**
**Domain:** AI services, Retrieval performance, Governance · **Authority:** Product Owner · **Review:** independent Product Architecture
**Date:** 2026-11-12 · **Baseline:** Draft PR #56 (`feat/nem-024-checkpoint-b`) at `b9828557466e7d5a63997283a60f472452b5d59b` (verified equal to the remote head before execution) · **Execution agent:** Claude Code
**Related:** [PO-048](PO-048-nem-024-e1-ranking-root-cause-investigation-authorization.md) · [PO-049](PO-049-nem-024-e1-architecture-validation-authorization.md) · [PO-050](PO-050-nem-024-e1-representative-literary-corpus-validation-authorization.md) ([report](../../../reports/2026-11-12-NEM-024-po-050-real-literary-corpus-e1-validation.md))

> Identifier: `PO-051` verified unused on all remote branches, in the commit history and in the governance tree on 2026-11-12.

## Decision A — PO-050 accepted as a completed diagnostic investigation

PO-050 is accepted with its limitations retained. The accepted findings are:

- The governing benchmark measured p95 of about 570–598 ms.
- The authentic Spanish workload measured 79.5–83.7 ms p95, and the English workload 65.3–67.6 ms.
- The authentic corpus was substantially smaller than the governing fixture.
- The governing fixture used a sequential-scan plan where the protected `ginUsed` assertion expects GIN usage.
- Seven of 15 natural-language question searches returned no passages.

These findings are diagnostic evidence only. They neither establish production readiness nor justify changing the acceptance standard.

## Decision B — PO-051 authorized (one bounded mission, separate conclusions)

| Item | Scope |
|---|---|
| **P-3** plan stability | Why the governing fixture alternates between GIN and sequential-scan plans, and whether this materially changes E-1 latency. Disposable databases only; planner controls such as `SET LOCAL enable_seqscan = off` are permitted for **diagnosis only**. No configuration, index or SQL change |
| **P-1** workload classes | Architectural comparison: single criterion, typical plus adversarial classes, or a primary criterion plus stress safeguards. **No threshold** is to be selected and no binding criterion introduced |
| **P-2** near-limit authentic corpus | **Feasibility gate first.** At most one bounded size-comparability measurement with rights-cleared authentic works, under the ten-book limit and `maxChunksPerBook = 2,000`, with no padding. Queries predeclared before timing |

## Decision C — Retrieval quality kept separate

**P-4** (natural-language questions returning no passages) is **recorded as a separate product concern** for later PO/PA analysis. There is no implementation: no query rewriting, semantic search, embeddings, fallback retrieval or `websearch_to_tsquery` change.

## Decision D — Remedies still deferred

The following stay deferred:

- C1 threshold pruning;
- the single-lexeme hybrid;
- inline `tsvector` storage;
- S2 worker changes;
- additional infrastructure;
- changes to the 2,000-chunk limit.

The large-book memory, Q-11 margin and long-work chunk-limit risks remain open.

## Protected status

| Item | Status |
|---|---|
| PO-047 | Conditionally accepted for development progression |
| PO-048 | Accepted diagnostics |
| PO-049 | Accepted architecture validation |
| PO-050 | Accepted diagnostic investigation |
| PO-051 | Authorized diagnostic validation |
| **E-1** | **OPEN** (p95 ≤ 150 ms) |
| Q-11 | Conditional development acceptance; risks retained |
| Checkpoint E | **NOT QUALIFIED** |
| PR #56 | Draft, unmerged |
| Release | **BLOCKED** |

## Authorized changes

- This record, the decision register, the mission index and the NEM-024 status.
- One concise retrieval-quality concern record in the existing structure.
- Test-only diagnostics under `services/api/tests/perf/`.
- Reports and content-minimized metadata in `docs/reports/`.

## Not authorized

- **Code and data:**
  - `services/api/src/`;
  - production SQL;
  - migrations or indexes;
  - Dockerfiles or Compose files;
  - web or mobile code;
  - the S2 worker;
  - protected test assertions (including `ginUsed`);
  - performance thresholds;
  - retrieval contracts;
  - PostgreSQL configuration.
- **Benchmark:**
  - any revision;
  - removing expensive queries;
  - reducing the book count;
  - reclassifying a failure as a pass.
- **Access and resources:**
  - production or staging access;
  - customer text;
  - new providers or infrastructure.
- **Release and further work:**
  - merging, removing Draft, deployment or activation;
  - PO-052 or any new mission.

## STOP gate

After the report, raw evidence and the Draft PR update: **STOP** for independent Product Architecture review and a Product Owner decision.
