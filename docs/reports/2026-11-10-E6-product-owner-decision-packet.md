# E6 / NEM-024 — Product Owner Decision Packet (Turn Orchestration) — revision 6 (DECIDED)

**Status:** **DECIDED — all decisions approved by the PO on 2026-11-10 in [PO-034](../operating-framework/decisions/product-owner/PO-034-e6-research-turn-decisions-and-nem-024-assignment.md), for documentation and final independent PA sign-off only. Implementation NOT authorized.** Mission: [NEM-024](../engineering-missions/DRAFT/NEM-024-research-turn-orchestration-and-minimal-bilingual-web-qa.md) (proposed, review-ready). *Earlier revisions (1–5) are preserved below as the decision history.*

**Evidence:**
- [discovery report](2026-11-10-E6-turn-orchestration-discovery-report.md) (§11: revision responses)
- [11 lifecycle](../architecture/three-tier-intelligence/11-e6-turn-lifecycle-and-boundaries.md)
- [12 inventory](../architecture/three-tier-intelligence/12-e6-interface-and-dependency-inventory.md)
- [13 security](../architecture/three-tier-intelligence/13-e6-security-rights-and-failure-modes.md)
- [14 UX](../architecture/three-tier-intelligence/14-e6-minimal-ux-proposal.md)
- [DRAFT mission rev 2](../engineering-missions/DRAFT/NEM-024-research-turn-orchestration-and-minimal-bilingual-web-qa.md)

Only decisions **genuinely required before implementation** are in §1. Launch-time items are in §3.

---

## 0. Prerequisite P-0: NEM-022 status — **SATISFIED (recorded 2026-11-10)**

- **Record:** the Product Owner accepted NEM-022 on 2026-11-10 as a completed, disconnected development implementation at commit `f6a5cb7`, following independent Product Architecture re-review. F-1, F-2, and F-3 were accepted as resolved.
  - [NEM-022 report §20](2026-11-09-NEM-022-gateway-simulator-v2-report.md#20-product-architecture-re-review-outcome-and-product-owner-acceptance-2026-11-10); NEM-022 mission status; register.
- **Carried from NEM-022 (not waived):** global API branch coverage **77.49% vs 80%**; a monitoring note for one unreproduced intermittent test failure (NEM-022 report §19.3).
- **NEM-023 wording reconciled:** NEM-023 mission §3 and report §19 note that "accepted" was unbacked when first written and now matches the record (NEM-023 was built on `f6a5cb7`). NEM-023's own status is unchanged.
- **Scope of this update:** P-0 only. **No E6 decision (D-1 to D-11) is approved, and the DRAFT mission is not approved.**

### Historical evidence (revision 2, before the acceptance was recorded)

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

## Decision state (revision 6, 2026-11-10 — PO-034)

| ID | Approved decision (PO-034) |
|---|---|
| D-1(a) | Backend plus one minimal web Q&A interface (E9 keeps broader UX) |
| D-2(C) | Eligible book passages only |
| D-3 | The six additive interface amendments, subject to accepted-contract protection (review package §1) |
| D-4(a) | Stateless model context with persisted display history |
| D-5 | NEM-024 assigned (verified unused) |
| D-6(a) | Web-first implementation |
| D-7(a) | Fixture simulator, dark development |
| D-8(a) | Best-effort `unrecorded` delivery, with its documented residual risk (record failed **and** response lost → an unseen charge) |
| D-9(a) | A client disconnect does not cancel; explicit authenticated cancellation does |
| D-10(a) | Hide revoked historical excerpts; retain generated answer text pending TT-14 |
| D-11 | W = 10 is a performance-test **candidate, not a guaranteed production capacity**; reader p95 delta ≤ 50 ms under sustained permitted load on the production API image capped at 1 vCPU / 512 MB |
| Also accepted | Final eligibility check · terminal database-fenced recovery · one provisional turn per session · the specified cancellation behaviour |

**Still open (non-blocking for finalization):**
- PA engineering questions Q-4, Q-5, Q-7, Q-9, Q-10, Q-12 (review package §10);
- Q-11 (PO, only if the reader test passes only at W < 10);
- launch-time items (§3).

---

*Decision history (revisions 1–5) follows; statuses in the table below are as of revision 5 and are superseded by the table above.*

## 1. Decisions required before implementation

| ID | Decision | Owner | Options | Recommendation |
|---|---|---|---|---|
| **D-1** — ✅ **APPROVED (a), PO 2026-11-10** | E6 delivery scope | PO | **Approved:** backend plus **one minimal web Q&A interface**; E9 keeps all broader UX (mission §5.1) | — *(Options (b) backend-only and (c) were considered and are not selected; see the revision 2 history in the discovery report §11 R-5)* |
| **D-2** — proposed baseline (not approved) | User knowledge (highlights and notes) in the first implementation | **PA + PO** | **C (revised recommendation):** book passages only; no `fragments` access; NEM-019 protections unchanged. **A:** one named, test-asserted `SELECT` of own rows on eligible selected books (amends NEM-019 AC-10/17). **B:** read function from the fragments module injected via registration (changes two tests + the registration contract) | **C** for the first implementation. It avoids any change to accepted NEM-019 protections. A or B remain available as a **later**, separately authorized step with the isolation-first sequence in [13 §3.5](../architecture/three-tier-intelligence/13-e6-security-rights-and-failure-modes.md#35-adding-user-knowledge-later-without-weakening-isolation) |
| **D-3** | Authorize the accepted-surface amendments | **PA + PO** | In dark code only:<br>(1) `TurnDto.question`;<br>(2) `TurnService` wiring (retrieval, turn record, replay, cancel) with the turn order unchanged;<br>(3) `TurnResult` v2;<br>(4) routes: history, single turn, stream, cancel, capability probe (`GET /knowledge/sessions/capabilities`, in `SessionsController`);<br>(5) direct injection of `QueryContextSource` (no binding or F-12 change);<br>(6) E5 providers registered with unbound ports | Authorize (1)–(6) |
| **D-4** — proposed baseline (not approved) | Conversation memory in model context | PA (product effect: PO) | (a) stateless; (b) bounded prior turns (needs a new `ContextItem` kind) | (a) |
| **D-5** | Identifier | PO | Reserve NEM-024 (verified unused) | Reserve |
| **D-6** — proposed baseline (not approved) | Mobile in the MVP (TT-20) | PO | (a) web first; (b) parity; (c) read-only history | (a). Moot under D-1(b) |
| **D-7** — proposed baseline (not approved) | Build before E3/E4 adapters | PO | (a) dark on fixture ports; (b) wait | (a); E3 design note R-2 (hash once per text version) |
| **D-8** *(new, R-3)* | Answer delivery when the turn record cannot be written after settlement | **PA** (product effect: PO) | **(a)** attempt to return the answer marked `unrecorded` (**best effort**); the row stays provisional until its fence, then becomes `interrupted` (terminal); replay never reproduces the answer. **(b)** withhold the answer and return an error | **(a)**, proposed. **Neither option prevents an unseen charge:** under (a), if the response is also lost (network failure, closed tab), the answer is lost and the charge stands; (b) makes the unseen charge certain. The charge always stands (NEM-021 authority). Review package §2 |
| **D-9** *(new, R-4)* — proposed baseline (a) (not approved) | Client disconnect vs explicit cancel | **PO + PA** | **(a)** a disconnect or stream close **never** cancels (at any stage, including preflight); the turn continues and, once recorded, a same-key replay returns it. Only the explicit, authenticated cancel endpoint aborts. **(b)** disconnect aborts like cancel (held at the reserved amount, no answer) | **(a)**: a dropped connection does not by itself lose a **recorded** answer (an unrecorded one is covered by D-8) |
| **D-10** *(new, R-4)* | Historical excerpts after revocation (dark-build default; the final policy is TT-14) | **PO** | **(a)** hide excerpts (`source no longer available`); keep the generated answer text. **(b)** keep showing the excerpts. **(c)** hide the whole answer | **(a)**: the most conservative choice that needs no deletion; `ai_turns` stores no excerpt text, so (a) needs no data change if TT-14 later chooses otherwise |
| **D-11** *(new, R-5)* | Concurrency weight `W` and reader-latency acceptance | **PA** | **Candidate W = 10** (Σ selected books with S2 work in flight per process). **Acceptance (proposed): reader endpoint p95 delta ≤ 50 ms** under sustained permitted retrieval load, against idle, on the production API image (1 vCPU / 512 MB) | W = 10 is a **candidate, not accepted**. If the test fails, reduce W **10 → 6 → 3** and retest. If the accepted W < 10, 10-book turns cannot be admitted, a product conflict with PO-027, so escalate (review package Q-11) |

## 2. Carried exceptions (no waiver requested)

| ID | E6 handling |
|---|---|
| **E-1** retrieval p95 594 ms vs 150 ms | Not waived. Stage histograms; end-to-end tables for 3 and 10 books; no ranking change, cap, or cache. The guard (D-11) limits interference; it does not improve E-1 |
| **E-2** global branches 78.75% vs 80% | Not waived. New and changed code ≥ 80% branches; no global decrease |

## 3. Needed before launch, not before implementation

TT-11 (limit behaviour) · TT-13 (thresholds) · TT-14 (retention; D-10 is only the dark default) · TT-10/TT-19 (copy) · TT-18 (Expand) · TT-22 (Terms before any real provider) · TT-27 (Ask My Highlights) · TT-25 (semantic search) · the multi-instance cancel channel (only if the API is scaled out).

## 4. Recommended package (revision 3)

1. ~~Resolve P-0~~ (satisfied) · ~~D-1~~ (approved: (a)).
2. **PO:** confirm or change the proposed baselines D-2(C), D-4(a), D-6(a), D-7(a), D-9(a); reserve D-5 (NEM-024).
3. **PA:** judge D-3, D-8, D-10, D-11, the final eligibility check, the fenced recovery state machine, and Q-4 to Q-12 / Q-14 in the [final review package](2026-11-10-E6-pa-final-review-package.md).
4. PA review of mission revision 4 → PO approval → an explicit execution instruction naming the mission.

*Revision 2 package text (superseded; D-1 is now approved (a)):* resolve P-0; decide D-1, D-2 C, D-3 (1)–(6), D-4(a), D-5 NEM-024, D-6(a), D-7(a), D-8(a), D-9(a), D-10(a), D-11 W=10 (plus the PA threshold); then PA review of mission revision 2 → PO approval.
