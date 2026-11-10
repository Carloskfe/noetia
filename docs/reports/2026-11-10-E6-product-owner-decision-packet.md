# E6 — Product Owner Decision Packet (Turn Orchestration and User Experience)

**Status:** DRAFT — for PO / PA decision. Prepared under PO *"E6 Turn Orchestration Discovery — documentation-only"* (2026-11-10). **No decision below is taken by this document.**
**Evidence:** [discovery report](2026-11-10-E6-turn-orchestration-discovery-report.md) · [11 lifecycle](../architecture/three-tier-intelligence/11-e6-turn-lifecycle-and-boundaries.md) · [12 inventory](../architecture/three-tier-intelligence/12-e6-interface-and-dependency-inventory.md) · [13 security](../architecture/three-tier-intelligence/13-e6-security-rights-and-failure-modes.md) · [14 UX](../architecture/three-tier-intelligence/14-e6-minimal-ux-proposal.md) · [DRAFT mission](../engineering-missions/DRAFT/E6-turn-orchestration-and-user-experience.md)

This packet lists only what is **genuinely required before implementation** (§1). Items needed before **launch** are listed separately (§3) and need no decision now.

---

## 0. Prerequisite action (not a decision): record NEM-022's status

**B-A — NEM-022 acceptance is not recorded.**
- The register and mission state "PA re-review F-3 addressed — returned for re-review" (2026-11-09). No acceptance record exists in the repository.
- E6 builds directly on Gateway v2 behaviour: per-attempt reservation, fail-closed streaming, and citation policy.
- **Before E6 execution:** record the PA re-review outcome and PO acceptance of NEM-022 (or its corrections).

## 1. Decisions required before implementation

| ID | Decision | Owner | Options | Recommendation | If not decided |
|---|---|---|---|---|---|
| **D-1** | **E6 scope boundary** (P0 packet assigns UI to E9; this discovery covers UX) | PO | **(a)** E6 = research-turn backend (question input, retrieval wiring, persistence, replay, streaming transport, citations v2) **+ one minimal web Q&A screen behind the existing flag**. Ask My Highlights is a later step (E6b, after TT-27); full UI is E9. **(b)** E6 backend only; all UI in E9. **(c)** E6 = everything in P0 E6 + E9 for Noetia+ (largest) | **(a)**: delivers a testable end-to-end slice with the smallest surface; keeps AMH (open TT-27) and E9 breadth out | Mission scope cannot be fixed |
| **D-2** | **Route for in-session highlights and notes** (protected-test exception) | **PA + PO** | **A:** one named, test-asserted `SELECT` on `fragments` (own rows, eligible selected books, capped) in `knowledge/user-content/`; the NEM-019 AC-10/17 test is amended to allow exactly that file, with a new positive test. **B:** read function exported by the fragments module and injected via `knowledge.registration` (changes two tests and the registration contract). **C:** defer My Knowledge; the MVP uses book passages only | **A**: smallest, preserves intent (no writes, no cross-user path, no reader coupling). **C** if the PO prefers zero protected-test changes now | E6 must use option C (no user knowledge) |
| **D-3** | **Authorize the accepted-surface amendments E6 needs** | **PA + PO** | Explicit authorization to change, in dark code only:<br>(1) `TurnDto` gains `question`;<br>(2) `TurnService` wires retrieval (+ D-2 source), persistence, and replay, **with the turn order unchanged**;<br>(3) `TurnResult` v2 (citations, exclusions, `turnId`);<br>(4) new routes `GET …/turns`, `POST …/turns/stream`, `GET /knowledge/me`;<br>(5) retrieval wiring by **direct injection of `QueryContextSource` into `TurnService`**, leaving `CONTEXT_SOURCE_PORT → EmptyContextSource` and NEM-019 test F-12 unchanged (alternative: extend the port with `query`, which changes the pinned binding test);<br>(6) register E5 providers in `KnowledgeModule` with **unbound** text-identity/authority ports (no production adapter) | Authorize (1)–(6) with direct injection | E6 stops at its first protected-surface change (stop condition) |
| **D-4** | **Conversation memory in model context** | PA (product effect: PO) | **(a)** Stateless turns: each question is answered from retrieval (+ highlights) only; history is persisted and displayed but not sent to the model. **(b)** Include bounded prior turns, which needs a new `ContextItem` kind and Context Builder invariant (accepted contract change) | **(a)** for the MVP; (b) as a later, separately approved change | Follow-up questions cannot rely on earlier turns |
| **D-5** | **Mission identifier** | PO | Reserve **NEM-024** (verified unused across the register, all branches, and PRs #24–#53) | Reserve NEM-024 | Draft keeps `NEM-0XX` |
| **D-6** | **Mobile in the MVP (TT-20)** | PO | (a) web first, mobile later; (b) parity; (c) mobile read-only history | **(a)**: React Native 0.74 has no streaming fetch, store billing is a separate risk, and E9 owns breadth | Mobile excluded by default from E6 (a) |
| **D-7** | **Sequencing relative to E3/E4** (P0: E6 depends on E1, E2, E3, E5) | PO | (a) build E6 dark now on fixture ports (the E5 precedent; production stays denied by unbound ports); (b) wait for E3 (text identity, authority) and E4 (qualifying plan) | **(a)**. Note for E3's design: the text-identity adapter must not re-hash the full object on every call (§2, R-2) | E6 waits for E3/E4 |

## 2. Carried exceptions (no waiver requested)

| ID | From | E6 handling |
|---|---|---|
| **E-1** | NEM-023: retrieval p95 594 ms vs 150 ms | **Not waived.** E6 adds per-stage latency histograms and reports end-to-end turn latency (excluding and including the simulated provider). E6 makes no ranking change and adds no cache. Closure needs the NEM-023 §17.5 benchmark plus a separate decision |
| **E-2** | NEM-023: global API branch coverage 78.75% vs 80% | **Not waived.** E6 acceptance requires its own new and changed code ≥ 80% branches and **no decrease** of the global figure. Closing E-2 needs a separate evidence-based decision |

## 3. Needed before launch, not before implementation (no decision now)

| Item | Why it can wait for a dark build |
|---|---|
| TT-11 behaviour at the limit | The `budget_exhausted` copy is configurable; the provisional P0 text (hard stop + upgrade prompt) is used in drafts |
| TT-13 quotation and reconstruction thresholds (F-2) | E6 can **record** per-(user, book) excerpt spans without content and enforce nothing until values exist (thresholds configurable, default "measure only"). Whether even recording is wanted is a PA question within the mission |
| TT-14 retention; answers citing revoked books | The dark build keeps history and shows "source no longer available"; deletion policy before launch |
| TT-10 capacity wording · TT-19 names | Copy only |
| TT-18 Expand | `broader` stays off |
| TT-22 Terms/Privacy for AI | Blocks any **real** provider; the simulator only until then |
| TT-27 saved quotations in Ask My Highlights | Blocks AMH (E6b), not the research turn |
| TT-25 semantic highlight search | Out of scope (no embeddings) |

## 4. Recommended package

Approve **D-1(a), D-2 A, D-3 (1)–(6) with direct injection, D-4(a), D-5 NEM-024, D-6(a), D-7(a)**. Record B-A first. Then review the DRAFT mission for approval.
