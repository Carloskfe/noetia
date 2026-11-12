# PO-038 — NEM-024 Checkpoint B: Formal Acceptance

**Status:** `DECIDED` — Product Owner, 2026-11-10 (*NEM-024 Checkpoint B — Formal Acceptance*). **ACCEPTED FOR DEVELOPMENT PROGRESSION.**
**Domain:** AI services, Governance · **Authority:** Product Owner
**Date:** 2026-11-10 · **Source:** Draft PR #56, reviewed commit `a127c89` ([Checkpoint B report](../../../reports/2026-11-10-NEM-024-checkpoint-b-report.md), §1–§13)

> Identifier: `PO-038` verified unused on all remote branches on 2026-11-10; continues after PO-037.

## Decision

The Product Owner formally **accepts NEM-024 Checkpoint B for development progression**.

Acceptance covers:

- PostgreSQL-fenced recovery of stranded turns;
- explicit cancellation, including Amendment 2 / Option B ([PO-037](PO-037-nem-024-checkpoint-b-amendment-2-cancellation-before-lock.md));
- history and single-turn retrieval;
- rights-aware citation redaction;
- corrected repeated-citation mapping (F-1);
- weighted concurrency protection.

The mandatory recovery condition of [PO-036](PO-036-nem-024-checkpoint-a-conditional-acceptance-and-checkpoint-b-authorization.md) is **satisfied at the development checkpoint level**.

## Evidence

Claude Code reported:

- 1,917/1,917 unit tests passing;
- 201/201 integration tests passing (1 opt-in performance suite skipped);
- PostgreSQL recovery and concurrency tests passing;
- global branch coverage of 80.07%;
- TypeScript and ESLint clean.

Product Architecture reviewed these results through repository inspection and the submitted evidence. **It did not independently rerun the complete test suite.**

## Exceptions preserved — not waived

1. **E-1:** NEM-023 retrieval p95 remains 594 ms against a 150 ms target.
2. **E-2:** Global branch coverage reaches 80.07% on the reviewed branch stack, but formally closing this exception requires a separate decision.
3. **NEM-022 coverage exception:** remains open independently.
4. **D-8:** best-effort `unrecorded` delivery and the associated billing/response-loss residual risk remain.
5. **Cancellation persistence:** a failed terminal-record write may leave a same-key replay `pending`.
6. **Multi-instance cancellation:** live cancellation signalling is in-process only. A shared mechanism requires separate approval before scaling beyond one API instance.
7. **Q-11:** W=10 remains a performance-test candidate, subject to Checkpoint E qualification.
8. **TT-14:** generated-answer retention and rights treatment remain unresolved.

## Not authorized

Checkpoints C, D, and E; merging (PR #56 stays a draft and unmerged); deployment; production activation; paid AI providers; infrastructure changes.
