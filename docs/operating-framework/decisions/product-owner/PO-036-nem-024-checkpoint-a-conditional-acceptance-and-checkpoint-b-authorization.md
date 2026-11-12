# PO-036 — NEM-024 Checkpoint A Conditional Acceptance and Checkpoint B Authorization

**Status:** `DECIDED` — Product Owner, 2026-11-10 (*NEM-024 — Product Owner Authorization: Checkpoint B*). **Checkpoint B authorized — conditional.**
**Domain:** AI services, Governance · **Authority:** Product Owner
**Date:** 2026-11-10 · **Source:** Draft PR #55, reviewed commit `bfab9e4`
**Implementation:** **Checkpoint B only**

> Identifier: `PO-036` verified unused on all remote branches on 2026-11-10; continues after PO-035.

## Decisions

1. **Checkpoint A ACCEPTED conditionally**, consistent with the independent Product Architecture review.
2. **AUTHORIZED: NEM-024 Checkpoint B only.** Scope:
   - explicit authenticated cancellation;
   - terminal-state recovery and database-fenced finalization;
   - the periodic recovery sweep and lazy finalization;
   - turn history and single-turn retrieval;
   - rights-aware historical citation redaction;
   - the weighted research-turn concurrency guard;
   - idempotent replay and terminal-state consistency;
   - the required failure-handling, concurrency, security, and regression tests.
3. **Mandatory release condition:** stranded `accepted` turns must be safely recovered, and recovery behaviour verified, **before any user-facing release**. The recovery requirements, in summary:
   - (A) recovery after an interrupted completion, independent of the original process;
   - (B) the approved PostgreSQL fence semantics (F-6, F-7);
   - (C) scheduled **and** lazy recovery; no status endpoint exposes an expired `accepted` turn without first attempting finalization;
   - (D) recovery never reserves, invokes a provider, or alters the NEM-021 ledger; the D-8 residual is preserved;
   - (E) real-PostgreSQL race evidence (applicable R1–R12, LW-1 to LW-10), with no mocked substitutes.
4. **Rights and privacy:** historical excerpts are revalidated against current eligibility before being returned; revoked excerpts are never exposed. Generated answers stay distinct from source excerpts. No `fragments` or `sync_maps` access. **TT-14 is not resolved.**
5. **Resources:** respect 1 vCPU / 512 MB. W = 10 is a test candidate, with the 10 → 6 → 3 fallback evaluation preserved; a product-capability conflict is escalated to the PO. No new infrastructure or paid services.
6. **NOT AUTHORIZED:** Checkpoints C, D, E (no SSE, capability endpoint, bilingual web UI, or performance qualification); merge; deployment; production activation; production providers; user-facing functionality.
7. *"If Checkpoint B requires a change to another protected architecture test or accepted contract, STOP and request explicit approval."*

## Preserved

PO-034, PO-035, NEM-024 Amendment 1; NEM-023 E-1/E-2 and NEM-022's coverage shortfall (not waived).
