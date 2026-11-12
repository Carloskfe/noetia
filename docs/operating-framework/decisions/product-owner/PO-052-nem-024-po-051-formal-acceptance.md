# PO-052 — NEM-024: Formal Acceptance of PO-051 as a Completed Diagnostic Investigation

**Status:** `DECIDED` — Product Owner, 2026-11-12, after the independent Product Architecture assessment. **GOVERNANCE AND DOCUMENTATION ONLY.**
**Domain:** AI services, Retrieval performance, Governance · **Authority:** Product Owner · **Review:** independent Product Architecture
**Date:** 2026-11-12 · **Baseline:** Draft PR #56 (`feat/nem-024-checkpoint-b`) at `477627dc90fbcda2b6f8c161076503d732b26a09` (verified equal to the remote head) · **Recording agent:** Claude Code
**Related:** [PO-051](PO-051-nem-024-e1-plan-stability-and-workload-class-validation-authorization.md) ([report](../../../reports/2026-11-12-NEM-024-po-051-e1-plan-stability-and-workload-class-validation.md)) · [PO-050](PO-050-nem-024-e1-representative-literary-corpus-validation-authorization.md) · [D13](../../../noetia-plus/20-open-product-decisions.md)

> Identifier: `PO-052` verified unused on all remote branches, in the commit history and in the governance tree on 2026-11-12. The only prior mentions were PO-051's prohibition on creating it autonomously.

## Decisions

1. **PO-051 accepted** as a completed diagnostic investigation, with **all documented limitations retained**. This covers:
   - the plan-stability investigation;
   - the near-limit authentic-corpus measurements;
   - the workload-class assessment.

   The retained limitations are:
   - the authentic cohort is 54% of the governing size, so full-size behaviour is extrapolated;
   - the per-row cost difference relative to PO-050 is unresolved;
   - PO-050's exact probe state was not reproduced;
   - the query mix is author-constructed;
   - the host is the shared development VM.

   This accepts evidence, **not** any recommendation.
2. **E-1 remains OPEN and BLOCKED.** The governing 150 ms p95 benchmark is unchanged and unmet.
3. **Checkpoint E remains NOT QUALIFIED.**
4. **Q-11** keeps its conditional development acceptance and its outstanding risks: the 1.8 ms W=10 `p3x3` margin, large-book memory under the 512 MB API limit, and host representativeness.
5. **PR #56** remains Draft, open and unmerged.
6. **Production release and activation remain BLOCKED.**
7. **Not authorized:**
   - C1 threshold pruning;
   - single-lexeme hybrid ranking;
   - the inline `tsvector` storage migration;
   - S2 optimization;
   - any performance-policy revision (including workload classes or threshold changes);
   - any revision of the protected `ginUsed` assertion.

   PO-051's recommendations (R-1 to R-5) remain **unapproved**.
8. **D13**, natural-language question retrieval quality, is preserved as a **separate, unresolved** retrieval-quality concern.

## Status after this decision

| Item | Status |
|---|---|
| PO-047 | Conditionally accepted for development progression |
| PO-048 | Accepted diagnostics |
| PO-049 | Accepted architecture validation |
| PO-050 | Accepted diagnostic investigation |
| **PO-051** | **Accepted diagnostic investigation (this record)** |
| **E-1** | **OPEN — BLOCKED** (p95 ≤ 150 ms; unchanged, unmet) |
| Q-11 | Conditional development acceptance; risks retained |
| Checkpoint E | **NOT QUALIFIED** |
| D13 | OPEN, separate product concern |
| PR #56 | Draft, open, unmerged |
| Release / activation | **BLOCKED** |

## Authorized work

Governance and documentation updates only: this record, the decision register, the engineering-mission index, the NEM-024 status and the PR #56 description.

## Not authorized

- Changes to production code, tests, performance benchmarks, database configuration or infrastructure.
- Any new engineering investigation or implementation mission.
- Merge, deployment or activation.

**STOP** after recording.
