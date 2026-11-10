# PO-035 — NEM-024 Specification Approval and Checkpoint A Execution Authorization

**Status:** `DECIDED` — Product Owner, 2026-11-10 (*NEM-024 — Product Owner Approval + Checkpoint A Execution Authorization*).
**Domain:** AI services, Governance · **Authority:** Product Owner
**Date:** 2026-11-10 · **Source:** Draft PR #54, reviewed commit `2e0cb54`; Product Architecture final specification sign-off granted
**Implementation:** **Checkpoint A only** (see the boundaries below)

> Identifier: `PO-035` was verified unused on all remote branches on 2026-11-10 and continues the sequence after PO-034.

---

## Decisions

1. **APPROVED:** the finalized [NEM-024 engineering specification](../../../engineering-missions/APPROVED/NEM-024-research-turn-orchestration-and-minimal-bilingual-web-qa.md) (reviewed commit `2e0cb54`). The mission moves from `DRAFT/` to `APPROVED/`.
2. **AUTHORIZED:** implementation of **Checkpoint A only**:
   - additive `TurnDto.question` (validation and normalization);
   - backward-compatible `TurnService` wiring with retrieval inside the step-2 boundary;
   - eligible book-passage retrieval and context-budget enforcement;
   - additive `TurnResult` fields;
   - `ai_turns` (idempotency constraints, `attemptToken`, `fenceAt`, a partial unique index for one provisional turn per session);
   - an atomic session lock + turn count + accepted-turn creation;
   - durable completion and replay;
   - the final user-rights and book-indexing eligibility check immediately before invocation;
   - correct reservation release or hold on failure;
   - the non-streaming route and additive provider registration;
   - the Checkpoint A tests and evidence.
3. **NOT AUTHORIZED:** Checkpoints B, C, D, E; merge; deployment; production AI providers; production indexing; infrastructure changes; E7, E8, E9; mobile; unrelated refactoring.

## Required safeguards (from the authorization)

- Preserve the NEM-019/021/022/023 accepted contracts, the Gateway and ledger settlement authority, and the accepted turn ordering.
- No `fragments` / `sync_maps` access; no paid AI.
- Preserve the reader's functionality and performance.
- Use the PostgreSQL fence semantics including F-7; release no answer text without a confirmed completion outcome.
- Backward compatibility with existing tests and interfaces.
- *"If an excluded component is necessary to make Checkpoint A safe, STOP and request a scope decision."*

## Preserved

PO-034 and every decision in it; NEM-023 exceptions E-1 and E-2; NEM-022's coverage shortfall (not waived).

## Execution record

Pre-execution check result (2026-11-10): **BLOCKED.** See the [Checkpoint A report](../../../reports/2026-11-10-NEM-024-checkpoint-a-report.md) (blocker B-1: an accepted NEM-023 architecture test forbids the wiring that D-3 authorizes).
