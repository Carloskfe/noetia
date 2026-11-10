# E6 — Product Owner Decision Packet (Turn Orchestration) — revision 2

**Status:** DRAFT — for PO / PA decision. Prepared under PO *"E6 Turn Orchestration Discovery — documentation-only"* (2026-11-10). Revised after the PA review of PR #54 (`e73c277`). **No decision below is taken by this document.**

**Evidence:**
- [discovery report](2026-11-10-E6-turn-orchestration-discovery-report.md) (§11: revision responses)
- [11 lifecycle](../architecture/three-tier-intelligence/11-e6-turn-lifecycle-and-boundaries.md)
- [12 inventory](../architecture/three-tier-intelligence/12-e6-interface-and-dependency-inventory.md)
- [13 security](../architecture/three-tier-intelligence/13-e6-security-rights-and-failure-modes.md)
- [14 UX](../architecture/three-tier-intelligence/14-e6-minimal-ux-proposal.md)
- [DRAFT mission rev 2](../engineering-missions/DRAFT/E6-turn-orchestration-and-user-experience.md)

Only decisions **genuinely required before implementation** are in §1. Launch-time items are in §3.

---

## 0. Prerequisite P-0: NEM-022 status (evidence, not a decision by this document)

| Evidence | Says |
|---|---|
| NEM-022 mission status line | "PA re-review finding F-3 addressed — **returned for Product Architecture re-review** (2026-11-09)" |
| Register row (README) | Same; "Not accepted; not merged, not deployed" |
| NEM-022 report §19 (last line) | "**NEM-022 is not accepted.** Not merged, not deployed" |
| Branch `feat/nem-022-gateway-simulator-v2` | Head `f6a5cb7` "report revision 4; F-3 response; returned for re-review"; no later commit |
| PR #51 | Draft; title "(RE-REVIEW; DO NOT MERGE)"; **no reviews, no comments** |
| PO decision records | PO-032 approves the NEM-022 *specification*; **no PO record accepts the implementation** |
| E5/NEM-023 documents | Describe NEM-022 as "accepted" from commit `4018ce3` (E5 discovery, 2026-11-09) onward. The session notes of the agent attribute this to the wording of the PO's E5 discovery instruction, **which is not stored in the repository**. No decision record backs it |

**Conclusion:**
- The repository contains **no evidence that acceptance was granted**.
- Whether the PO accepted NEM-022 outside the repository (as the E5 instruction wording suggested) **cannot be verified here**. It is not inferred.
- The NEM-023 "accepted NEM-022" wording is an unbacked description and should be corrected, or backed by a record, when P-0 is resolved.

**Exact prerequisite for E6:** one of
- (i) the PA re-review outcome of NEM-022 (`f6a5cb7`) **and** a PO acceptance record in the repository; or
- (ii) an explicit PO authorization for E6 to build on the unaccepted NEM-022 head, acknowledging that E6 inherits any later NEM-022 corrections.

## 1. Decisions required before implementation

| ID | Decision | Owner | Options | Recommendation |
|---|---|---|---|---|
| **D-1** | E6 delivery scope | PO | **(a)** backend + one minimal web Q&A screen behind the existing flag; **(b)** backend only (API, persistence, streaming transport); all UI in E9 (P0 packet); **(c)** P0 E6 + E9 for Noetia+ | **(b)** if the priority is the smallest reviewable change and P0 alignment; **(a)** if an end-to-end visible slice is wanted now. *Both remain open; the mission marks the D-1(a)-only items (scope 13, AC 14, Checkpoint C)* |
| **D-2** | User knowledge (highlights and notes) in the first implementation | **PA + PO** | **C (revised recommendation):** book passages only; no `fragments` access; NEM-019 protections unchanged. **A:** one named, test-asserted `SELECT` of own rows on eligible selected books (amends NEM-019 AC-10/17). **B:** read function from the fragments module injected via registration (changes two tests + the registration contract) | **C** for the first implementation. It avoids any change to accepted NEM-019 protections. A or B remain available as a **later**, separately authorized step with the isolation-first sequence in [13 §3.5](../architecture/three-tier-intelligence/13-e6-security-rights-and-failure-modes.md#35-adding-user-knowledge-later-without-weakening-isolation) |
| **D-3** | Authorize the accepted-surface amendments | **PA + PO** | In dark code only:<br>(1) `TurnDto.question`;<br>(2) `TurnService` wiring (retrieval, turn record, replay, cancel) with the turn order unchanged;<br>(3) `TurnResult` v2;<br>(4) routes: history, single turn, stream, cancel, `me`;<br>(5) direct injection of `QueryContextSource` (no binding or F-12 change);<br>(6) E5 providers registered with unbound ports | Authorize (1)–(6) |
| **D-4** | Conversation memory in model context | PA (product effect: PO) | (a) stateless; (b) bounded prior turns (needs a new `ContextItem` kind) | (a) |
| **D-5** | Identifier | PO | Reserve NEM-024 (verified unused) | Reserve |
| **D-6** | Mobile in the MVP (TT-20) | PO | (a) web first; (b) parity; (c) read-only history | (a). Moot under D-1(b) |
| **D-7** | Build before E3/E4 adapters | PO | (a) dark on fixture ports; (b) wait | (a); E3 design note R-2 (hash once per text version) |
| **D-8** *(new, R-3)* | Answer delivery when the turn record cannot be written after settlement | **PA** (product effect: PO) | **(a)** return the answer marked `unrecorded`; replay → `result_unavailable`. **(b)** withhold the answer and return an error (the user is charged with no answer) | **(a)**: the charge stands either way (NEM-021 authority); (a) avoids charging for an unseen answer |
| **D-9** *(new, R-4)* | Client disconnect vs explicit cancel | **PO + PA** | **(a)** disconnect continues to completion (persisted; same-key replay returns it); only explicit cancel aborts. **(b)** disconnect aborts like cancel (the attempt is held at the reserved amount, no answer) | **(a)**: mobile and network blips do not cost an unseen answer; explicit cancel stays available |
| **D-10** *(new, R-4)* | Historical excerpts after revocation (dark-build default; the final policy is TT-14) | **PO** | **(a)** hide excerpts (`source no longer available`); keep the generated answer text. **(b)** keep showing the excerpts. **(c)** hide the whole answer | **(a)**: the most conservative choice that needs no deletion; `ai_turns` stores no excerpt text, so (a) needs no data change if TT-14 later chooses otherwise |
| **D-11** *(new, R-5)* | Concurrency weight `W` and the acceptable reader-latency impact | **PA** | `W` = Σ selected books in flight per process. Measured: W=10 → lag p99 ~85 ms (one 10-book turn) or ~96 ms (three 3-book turns); W=20 → ~169 ms | **W = 10**. The PA sets the acceptable reader p95 delta, verified on the production image under the cap in Checkpoint D. If unmet, stop (no in-scope remedy) |

## 2. Carried exceptions (no waiver requested)

| ID | E6 handling |
|---|---|
| **E-1** retrieval p95 594 ms vs 150 ms | Not waived. Stage histograms; end-to-end tables for 3 and 10 books; no ranking change, cap, or cache. The guard (D-11) limits interference; it does not improve E-1 |
| **E-2** global branches 78.75% vs 80% | Not waived. New and changed code ≥ 80% branches; no global decrease |

## 3. Needed before launch, not before implementation

TT-11 (limit behaviour) · TT-13 (thresholds) · TT-14 (retention; D-10 is only the dark default) · TT-10/TT-19 (copy) · TT-18 (Expand) · TT-22 (Terms before any real provider) · TT-27 (Ask My Highlights) · TT-25 (semantic search) · the multi-instance cancel channel (only if the API is scaled out).

## 4. Recommended package

1. Resolve **P-0**.
2. Decide **D-1 ((a) or (b))**, **D-2 C**, **D-3 (1)–(6)**, **D-4(a)**, **D-5 NEM-024**, **D-6(a)**, **D-7(a)**, **D-8(a)**, **D-9(a)**, **D-10(a)**, **D-11 W=10** (plus the PA threshold).
3. Then PA review of mission revision 2 → PO approval.
