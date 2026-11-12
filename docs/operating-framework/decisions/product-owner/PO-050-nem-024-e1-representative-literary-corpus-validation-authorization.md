# PO-050 — NEM-024: E-1 Representative Literary Corpus Validation (Limited Diagnostic Validation Only); PO-049 Accepted as Completed Architecture Validation

**Status:** `DECIDED` — Product Owner, 2026-11-11 (*NOETIA — Product Owner Authorization PO-050*, §1–§18). **LIMITED DIAGNOSTIC VALIDATION ONLY.**
**Domain:** AI services, Retrieval performance, Governance · **Authority:** Product Owner · **Review:** independent Product Architecture
**Date:** 2026-11-11 (executed 2026-11-12) · **Baseline:** Draft PR #56 (`feat/nem-024-checkpoint-b`) at `bde618121b7e592e99d624e343836e3ecba9e62c` (verified equal to the remote head before execution) · **Execution agent:** Claude Code
**Related:** [PO-047](PO-047-nem-024-q11-remediation-and-requalification-authorization.md) · [PO-048](PO-048-nem-024-e1-ranking-root-cause-investigation-authorization.md) · [PO-049](PO-049-nem-024-e1-architecture-validation-authorization.md) ([report](../../../reports/2026-11-11-NEM-024-po-049-e1-architecture-validation.md))

> Identifier: `PO-050` verified unused on all remote branches, in the commit history and in the governance tree on 2026-11-12.

## Decision A — PO-049 accepted as completed architecture validation

PO-049's conclusions are accepted as **diagnostic evidence**, not as authorization to implement a ranking remedy. The findings that remain relevant are:

- The single-lexeme hybrid is conditionally exact.
- C1 threshold pruning is conditionally exact under documented invariants.
- The best exact configuration measured about 256–268 ms p95 on the governing synthetic benchmark, against the unchanged 150 ms requirement.
- Supplementary synthetic workloads B and C passed E-1 with the existing implementation, but they do not establish real user-workload representativeness.

## Decision B — PO-049 follow-on decisions

| Decision | Outcome |
|---|---|
| **D-1** exact package (C1, hybrid, inline `tsvector` migration) | **DEFERRED** — not to be implemented |
| **D-2** authentic literary workload validation | **APPROVED** — this record |
| **D-3** S2 worker, verification, concurrency or storage change | **DEFERRED** — the current S2 architecture is retained |

## Retained statuses

| Item | Status |
|---|---|
| PO-045 | Provisionally retained |
| PO-046 | Accepted diagnostics |
| PO-047 | Conditional development acceptance |
| PO-048 | Accepted diagnostics |
| PO-049 | Accepted architecture validation |
| **E-1** | **OPEN** |
| Q-11 | Conditional development acceptance; risks retained (1.8 ms margin at W=10 `p3x3`, large-book memory under the 512 MB API limit, host representativeness) |
| Checkpoint E | **NOT QUALIFIED** |
| Release | **BLOCKED** |

## Decision C — PO-050 authorized: authentic literary corpus validation

**Objective:** determine whether the **existing, unchanged** retrieval implementation meets the intended experience on real literary books with realistic reading and research questions. It answers Q-50-1 to Q-50-6:

| Question | Subject |
|---|---|
| Q-50-1 | Lexical frequency and chunk selectivity |
| Q-50-2 | Production retrieval performance |
| Q-50-3 | Categories over 150 ms and how often they occur |
| Q-50-4 | Effects of book length, corpus size, authorized book count and selectivity |
| Q-50-5 | Whether the governing benchmark is expected load, an adversarial stress test, or a mix |
| Q-50-6 | What further evidence is needed |

The study informs the Product Owner's decision; it does not make it.

**Corpus:**

- **Spanish:** ten distinct, authentic Spanish-language works, preferably originals rather than translations, rights-verified per work.
- **English:** three to five works as **supplementary** evidence only.
- **Texts:** natural lengths, with no padding or repetition.

**Storage discipline:** texts are acquired for **temporary local diagnostics only**.

- They are never committed, never placed in measurement JSON, never added to the catalogue or the live application, and deleted after validation.
- Only rights and source metadata, hashes and reproduction instructions are committed.

**Query set:** a Spanish set of about 30–40 queries (categories A–E) and a smaller English set, **frozen before timed measurement**. Only a content-minimized specification is committed: identifiers, categories, scopes, structure and query hashes. No paid LLM is used.

**Method:**

- **Implementation:** production indexer, `LexicalRetrievalService` and S2 worker, with real disposable PostgreSQL and MinIO.
- **Settings:** default topK and token budget.
- **No shortcuts:** no SQL substitution, no alternative ranking, no text or hash cache.
- **Volume:** at least three sessions of at least 100 measured requests each, in seeded order.
- **Reporting:** the governing benchmark A, the representative literary workload B and the adversarial protection C are reported **separately** and never merged into one percentile.

**Authorized changes:**

- this record, the decision index, the engineering-mission register and the NEM-024 status;
- test-only tooling in `services/api/tests/perf/`, plus necessary test-only helpers;
- reports in `docs/reports/`, with small rights/source and query manifests.

## Not authorized

- **Ranking and storage:**
  - modifying production retrieval SQL;
  - implementing C1 or the hybrid;
  - the inline `tsvector` migration;
  - production indexes;
  - schema or migration changes;
  - S2 worker changes;
  - caching verified books or hashes.
- **Contracts and benchmark:**
  - authorization or citation contract changes;
  - reducing the ten-book capability;
  - changing the governing E-1 benchmark or its 150 ms threshold;
  - disabling expensive benchmark queries.
- **Content and providers:**
  - private or unlicensed texts;
  - committing literary works;
  - an LLM evaluation provider.
- **Infrastructure and other code:**
  - infrastructure or recurring cost;
  - web or mobile code;
  - production or staging access.
- **Release and further work:**
  - merging PR #56 or removing Draft;
  - deployment or activation;
  - a new mission or any PO-051;
  - implementing any remedy.

## STOP gate

After the report, raw evidence and the Draft PR update: **STOP** for independent Product Architecture review and a Product Owner decision. A recommendation is not an approval.
