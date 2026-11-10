# PO-034 — E6 Research-Turn Decisions and NEM-024 Assignment

**Status:** `DECIDED` — approved by the Product Owner on 2026-11-10 (*NEM-024 Formal Mission Finalization*), **for documentation and final independent Product Architecture sign-off only**.
**Domain:** AI services, Rights, Governance · **Authority:** Product Owner
**Date:** 2026-11-10 · **Source:** Draft PR #54 (E6 discovery), latest reviewed commit `54820a6`
**Implementation:** **NOT AUTHORIZED.** Documentation only. NEM-024 may be executed only after final PA sign-off, PO approval of the specification, and an explicit PO instruction naming the mission.

> **Identifiers verified on 2026-11-10:**
> - `NEM-024`: unused on every remote branch (`git grep` across `refs/remotes/origin/*`) except the E6 discovery branch itself, where it appeared only as the placeholder "proposed NEM-024". No PR title uses it. Not in the register.
> - `PO-034`: unused on every remote branch; continues the sequence after PO-033.

---

## Decisions (approved, 2026-11-10)

| ID | Decision |
|---|---|
| **D-1(a)** | Backend plus **one minimal web Q&A interface**. E9 keeps all broader UX |
| **D-2(C)** | **Eligible book passages only.** No highlights or notes; no `fragments` access; NEM-019 protections unchanged |
| **D-3** | The **six additive interface amendments**, subject to accepted-contract protection:<br>(1) `TurnDto.question`;<br>(2) `TurnService` wiring (retrieval, turn record, replay, cancel) with the turn order unchanged;<br>(3) additive `TurnResult` fields;<br>(4) routes in the existing `SessionsController` (history, single turn, stream, cancel, capability probe `GET /knowledge/sessions/capabilities`);<br>(5) direct injection of `QueryContextSource` (no port or binding change);<br>(6) E5 providers registered with unbound ports |
| **D-4(a)** | **Stateless model context** with **persisted display history** |
| **D-5** | Assign **NEM-024** to E6 (identifier verified unused) |
| **D-6(a)** | **Web-first** implementation |
| **D-7(a)** | **Fixture simulator, dark development** (production ports stay unbound) |
| **D-8(a)** | **Best-effort `unrecorded` delivery**, with its documented residual risk: if the completion write fails **and** the response is lost, the user is charged for an answer never seen |
| **D-9(a)** | **A client disconnect does not cancel**; explicit authenticated cancellation does |
| **D-10(a)** | **Hide revoked historical excerpts**; retain generated answer text pending TT-14 |
| **D-11** | **W = 10 is a performance-test candidate, NOT a guaranteed production capacity.** Reader p95 delta must be **≤ 50 ms** under sustained permitted load on the **production API image capped at 1 vCPU / 512 MB** |

**Also accepted:**
- the **final eligibility check** before provider invocation (fresh user-level research rights + book-level indexing permission; release on failure);
- **terminal, database-fenced recovery** (`interrupted` is terminal; no terminal state changes);
- **one provisional turn per session**;
- the **specified cancellation behaviour**.

## Consequences recorded

- The specification is finalized as [NEM-024](../../../engineering-missions/DRAFT/NEM-024-research-turn-orchestration-and-minimal-bilingual-web-qa.md) (`DRAFT/`, status *proposed, review-ready*). It moves to `APPROVED/` only after the final PA sign-off and PO approval of the specification.
- Accepted contracts of NEM-019, NEM-021, NEM-022 (accepted at `f6a5cb7`), and NEM-023 are preserved.
- The NEM-023 exceptions **E-1** (retrieval p95 594 ms vs 150 ms) and **E-2** (global branch coverage 78.75% vs 80%) remain open and not waived. NEM-022's coverage shortfall (77.49%) also remains open.
- Provider usage stays **simulated**; every production integration stays **disabled**.

## Not decided by this record

| Item | Owner |
|---|---|
| Remaining PA engineering questions (review package §10: Q-4, Q-5, Q-7, Q-9, Q-10, Q-12) | PA |
| **Q-11** — handling of 10-book (NoetiaX) turns if the reader test passes only at W < 10 (a product conflict with PO-027) | PO, if triggered |
| Launch-time items: TT-10, TT-11, TT-13, TT-14, TT-18, TT-19, TT-22, TT-25, TT-27; E3/E4 adapters; billing | Separate decisions |

## Implementation boundary

This record **does not authorize** implementation, merge, deployment, production indexing, paid providers, or E6/E9 work beyond documentation.
