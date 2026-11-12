# PO-048 — NEM-024: E-1 Retrieval Performance, PostgreSQL Ranking Root-Cause Investigation (Diagnostic Only); PO-047 Conditionally Accepted

**Status:** `DECIDED` — Product Owner, 2026-11-11 (*NOETIA — Product Owner Authorization PO-048*, §1–§17). **DIAGNOSTIC ONLY.**
**Domain:** AI services, Retrieval performance, Governance · **Authority:** Product Owner · **Review:** independent Product Architecture
**Date:** 2026-11-11 · **Baseline:** Draft PR #56 (`feat/nem-024-checkpoint-b`) at `d00704962ea72e0c0309c1b8a0d700ce28195606` (verified equal to the remote head before execution) · **Execution agent:** Claude Code
**Related:** [PO-045](PO-045-nem-024-q11-performance-remediation-authorization.md) · [PO-046](PO-046-nem-024-residual-q11-performance-investigation-authorization.md) · [PO-047](PO-047-nem-024-q11-remediation-and-requalification-authorization.md) ([report](../../../reports/2026-11-11-NEM-024-po-047-q11-remediation-and-requalification.md))

> Identifier: `PO-048` verified unused on all remote branches and in the commit history on 2026-11-11.

## Decision A — PO-047 conditionally accepted for development progression

PO-047 is accepted **conditionally for development progression**, after independent PA review of its implementation and Q-11 evidence. This is **not** production acceptance or release authorization.

**Open exceptions retained:**

- the thin Q-11 margin at W=10 `p3x3` (minimum 1.8 ms);
- memory safety and supported object size for large books under the 512 MB API limit;
- host and runtime representativeness limits;
- every earlier exception.

**Other statuses:**

| Decision | Status |
|---|---|
| PO-045 | Retained provisionally |
| PO-046 | Accepted as completed diagnostics |
| Checkpoint E | **NOT QUALIFIED** |
| **E-1** | **OPEN** |

## Decision B — PO-048 authorized: diagnostic investigation of E-1

**Objective:** identify the smallest reliable, deterministic, rights-preserving and cost-efficient way to bring **end-to-end retrieval p95 ≤ 150 ms**. Separate PostgreSQL ranking from the other retrieval stages, and evaluate alternatives without implementing any of them.

**Questions:**

| # | Question |
|---|---|
| E1-Q1 | Time decomposition |
| E1-Q2 | Execution plans |
| E1-Q3 | Relevance-preserving optimization: exact vs approximate vs product decision |
| E1-Q4 | Minimal candidate |
| E1-Q5 | Production suitability |

**Authorized:**

- disposable local databases and synthetic data only; the existing NEM-023 suite and its fixture as the governing baseline, with ≥ 3 sessions;
- `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)`;
- query-frequency analysis and stage isolation;
- test-only SQL substitutions; temporary indexes or settings **in a disposable clone only**, recorded and cleaned up;
- committed changes limited to governance, `services/api/tests/perf/` (and essential test helpers), and `docs/reports/`.

**Correctness is mandatory:**

- A candidate is **exact-result-preserving** only with identical rows and order, unchanged rank semantics and predicates, deterministic ties, **and** a sound argument that no higher-ranked eligible result can be excluded.
- Any candidate cap must report recall@K, rank displacement and missing top results. It is **never** contract-compatible on the strength of a synthetic sample.

## Unchanged

E-1 p95 ≤ 150 ms (end to end); Q-11 ≤ 50 ms; ten books at W=10; eligibility (authorized book and hash pairs); deterministic ordering and tie-breaking; `RetrievalPort` and citation contracts; full-object re-read and SHA-256 on every retrieval; default-deny, privacy, fail-closed; no additional recurring cost or capacity.

## Not authorized

Changes to `services/api/src/`, including `RANK_SQL`; a production candidate cap; topK or book-limit changes; contract or ranking-semantics changes; production indexes or migrations; PostgreSQL deployment configuration; GIN or text-search configuration; weakened rights or hash validation; caches; S2 worker changes; API runtime flags; Dockerfile or Compose; a new database or search engine; more CPU or RAM; paid APIs or dependencies; web or mobile changes; weakened tests or thresholds; production or staging databases; customer text; merging PR #56 or removing Draft; deployment; activation; another mission; implementing any remedy.

## STOP gate

After the report, raw measurements and PR update: **STOP** for independent PA review and a new PO decision. A promising benchmark is a reason to report, not to implement.
