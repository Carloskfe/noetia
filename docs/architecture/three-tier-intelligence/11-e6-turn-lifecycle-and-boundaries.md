# 11 — E6 Turn Lifecycle and Component Boundaries (DISCOVERY, DRAFT)

**Status:** DRAFT (revision 2, PA review R-1…R-5) — documentation-only discovery under PO *"E6 Turn Orchestration Discovery — documentation-only"* (2026-11-10). Authorizes no implementation.
**Baseline:** branch `docs/e6-turn-orchestration-discovery`, from NEM-023 head `6c4b08e`. The ancestry includes the NEM-019, NEM-021, and NEM-022 branches. **None of these is merged into `main`** (Draft PRs #46, #50, #51, #53).
**Companion documents:**
- [12 — interfaces and dependencies](12-e6-interface-and-dependency-inventory.md)
- [13 — security, rights, failure modes](13-e6-security-rights-and-failure-modes.md)
- [14 — minimal UX](14-e6-minimal-ux-proposal.md)
- [discovery report](../../reports/2026-11-10-E6-turn-orchestration-discovery-report.md)

Legend: **IMPL** = implemented (dark, on the unmerged branch stack) · **PART** = partly implemented · **MISSING** = not implemented · **E6** = proposed for E6 · *(other)* = owned by another mission.

---

## 1. Lifecycle overview (proposed research-session turn)

```
 Client (web; mobile per D-6)
   │ POST /knowledge/sessions/:id/turns  { idempotencyKey, question }        ← question: MISSING (E6)
   ▼
 [0] Auth + route gate ── JwtAuthGuard, CapabilityGuard(research_session,'use'); module only if KNOWLEDGE_MODULE_ENABLED='true'   IMPL
 [1] Entitlement ──────── SessionsService.resolveOrDeny → EntitlementService → QualifyingPlanPort (book-plan prerequisite)        IMPL (port unbound → deny)
 [2] Session gate ─────── owned? active (not read_only)? set size ≤ tier limit?                                                   IMPL
 [3] Per-book eligibility  RightsService.eligibility(user, book, 'research_analysis') → TextIdentityPort, book_ai_rights,
                          authority, OwnershipPort                                                                                 IMPL (ports unbound → deny)
 [4] Retrieval ────────── QueryContextSource.candidatesFor(user, eligible, question) → IndexingPermission → LexicalRetrieval (S2)   IMPL in E5, NOT WIRED
 [5] My Knowledge ─────── own highlights and notes on eligible selected books                                                     NOT IN FIRST IMPLEMENTATION (D-2 C); later, separately authorized
 [6] Context ──────────── ContextBuilderService.build (research_session_context invariant) → sealed VerifiedContext                IMPL
 [7] Prepare ──────────── AiGatewayService.prepare: negotiate → count → reserve attempt 1 (NEM-021 cost ledger)                     IMPL
 [8] Lock tx ──────────── SELECT … FOR UPDATE; first-turn lock; set-hash check  + INSERT ai_turns(status='accepted')              IMPL (+ record: E6)
 [8b] Final check ────── fresh user-level eligibility + book-level index permission; fail → release, record failed, book_ineligible   E6 (F-3)
 [9] Provider call ────── gateway.invoke (today) | gateway.stream (per-attempt release; F-1/F-3)                                  IMPL (HTTP streaming MISSING)
[10] Settlement ───────── per attempt in the Gateway; held when unknown; reconciliation every 60 s                                IMPL
[11] Citations ────────── enforceCitations (scope + origin rules) → AnchorResolver (E5)                                           PART (TurnResult drops citations)
[12] Complete turn ────── UPDATE ai_turns SET status='completed' (refs + anchors, no excerpt text) — durable completion point      MISSING (E6; mission §9.2)
[13] Respond ──────────── JSON (and per-attempt stream events)                                                                     PART
   ▼
 Client: render segments with origin labels, citation chips → excerpt panel / open book                                            MISSING (UX: see 14)
```

Order invariant (ADR-006 B-5, unchanged; [8b] adds a check after the lock commit with no I/O inside the lock transaction and no Gateway/ledger change): **[1]–[7] preflight with no lock and no charge; failure at [8] releases the attempt; at [9]–[10] the lock stands and settlement is never assumed.** E6 inserts [4]–[5] inside the existing step 2 (before reservation), so the invariant is preserved.

## 2. Stage-by-stage ownership

| # | Stage | Existing owner (file) | Interface | Status | Missing integration (E6 unless noted) |
|---|---|---|---|---|---|
| 0 | Entry and authentication | `sessions.controller.ts` (`POST :id/turns`) | `TurnDto { idempotencyKey }` | IMPL | `question` field (NFC, 1–500 code points, matching E5); stream variant; `GET :id/turns` history. **This changes the dark API contract** (D-3) |
| 0b | Module gate | `knowledge.registration.ts` | env `KNOWLEDGE_MODULE_ENABLED` | IMPL | None; it stays off by default |
| 1 | Tier and subscription eligibility | `entitlement.service.ts` | `QualifyingPlanPort` (`UnboundQualifyingPlanPort` → `unknown` → deny) | IMPL (dark) | Production adapter is *E4* (TT-15). E6 tests bind fixtures |
| 1b | Book-plan prerequisite (PO-026) | Same port | `qualifying \| not_qualifying \| unknown` | IMPL (dark) | *E4* |
| 2 | Selected-book set and session lock | `sessions.service.ts`, `turn.service.ts` steps 2 and 4 | `books()`, `lockOwned()`, `bookSetHash` | IMPL | None (reused unchanged) |
| 3 | Book-level rights and user-level eligibility | `rights.service.ts` | `eligibility(user, book, op)`; ports `TextIdentityPort`, `RightsVerificationAuthorityPort`, `OwnershipPort` | IMPL (dark) | Production adapters are *E3* (text identity, authority) and *ADR-002 ownership mission*. E6 binds fixtures in tests |
| 4 | Retrieval (book passages) | `retrieval/query-context-source.service.ts` (E5) | `candidatesFor(userId, allowedBookIds, query)` / `resolve()` | IMPL, unwired | Wire into the turn: `ContextSourcePort.candidates(userId, sessionId, allowed)` has **no query parameter** (D-3). The module binding `CONTEXT_SOURCE_PORT → EmptyContextSource` is pinned by NEM-019 test F-12 (D-3) |
| 4b | Index permission re-check | `retrieval/indexing-permission.ts` | `check(bookId)` | IMPL | None |
| 5 | My Knowledge (own highlights and notes, selected books) | None | — | MISSING | **Not in the first implementation (D-2 C recommended)**: a read route to `fragments` would need an exception to NEM-019 AC-10/17 / AC-16/17. Later path: [13 §3.5](13-e6-security-rights-and-failure-modes.md#35-adding-user-knowledge-later-without-weakening-isolation) |
| 6 | Context construction | `context-builder.service.ts` | `build(userId, allowed, items)` → sealed context | IMPL | Budget split between passages and highlights; no conversation-history item kind exists (D-4) |
| 7 | Reservation | `ai-gateway.service.ts` `prepare` → `cost-ledger.service.ts` `reserveAttempt` | `GatewayRequest`, `PreparedCall` | IMPL | None |
| 8 | Lock transaction | `turn.service.ts` step 4 | — | IMPL | None |
| 9 | Provider call (non-streaming) | `gateway.invoke` | `GatewayResponse` | IMPL | None |
| 9b | Streaming | `gateway.stream` → events `delta`, `segment`, `usage`, `retry`, `terminal` | AsyncGenerator | IMPL in Gateway; not exposed | HTTP transport (SSE over `fetch`), client-disconnect → `AbortSignal`. **Release is per attempt, after validation and settlement (F-1/F-3)**, so there is no token-by-token text |
| 10 | Settlement, compensation, reconciliation | `cost-ledger.service.ts`; `cost-reconciliation-job.service.ts` (`@Interval` 60 s) | Ledger entries keyed by attempt | IMPL | None. Compensation is an operator action (adjustment key), never a turn path |
| 10b | Retry | Gateway (`maxProviderAttempts`, default 1; no retry once streamed) | Config | IMPL | Client retry semantics: the same key currently yields **`duplicate_turn` 409**, with no stored result to return (E6: replay returns the persisted turn) |
| 10c | Cancellation and timeout | Gateway (`AbortSignal`, `providerTimeoutMs`) | `client_abort` / `timeout` → **held** at the reserved amount | IMPL | Explicit cancel endpoint and in-process registry. **Client disconnect is not a cancellation** (D-9 a). Per-stage matrix: [13 §5.1](13-e6-security-rights-and-failure-modes.md#51-cancellation-matrix-r-4-the-gateway-streaming-contract-is-unchanged) |
| 11 | Citation validation | `citation-policy.ts` (`enforceCitations`) | Scope violation drops the answer; origin relabelling | IMPL | `TurnResult` keeps only `{origin, text, bookId}` (`toAnswerSegment`), so **citations are dropped**. E6 returns citations `{ref, kind, bookId, anchor, excerpt?}` via `AnchorResolver` and E5 passages |
| 12 | Conversation persistence and durable completion | None (`ai_conversations` holds session metadata only) | — | MISSING | `ai_turns` (FK session CASCADE; UNIQUE session + key hash). Row inserted `accepted` in the step-4 lock transaction; `completed` when the completion update commits; `unrecorded` delivery on write failure (D-8); recovery → `interrupted`. The ledger stays the sole charge authority (mission §9.2) |
| 13 | Response and presentation | Controller JSON | `TurnResult` | PART | Response schema v2 (D-3); web UI; mobile per D-6 |

## 3. Parallel paths that E6 must keep separate (PO-028, ADR-006)

| Path | Model? | Context | Invariant | Budget capability | Status |
|---|---|---|---|---|---|
| **Research turn (This Book / My Knowledge in session)** | Yes | Chunks of eligible selected books, plus the user's own highlights and notes **on those books** | `research_session_context` (exists) | `research_session` | Core of E6 |
| **Ask My Highlights** (library-wide) | Yes | Only the requesting user's highlight and note rows plus book metadata; **never chunks or book text** | Highlight Context Builder invariant (**new model path**, not yet registered in `MODEL_PATHS`) | Its own capability (PO-028 rule 4) | Blocked on TT-27 → separate step (D-1) |
| **Highlight search** (no AI) | No | The user's own rows | User predicate | None | Not a knowledge path. Could live in `fragments` (outside `knowledge/`). Out of E6 MVP scope (D-1) |
| **Expand** (`broader`) | Yes | Model knowledge only | Origin `broader`, no citations | — | TT-18 undecided; not in the MVP |

The origin labels already enforced by the Gateway are:
- `library`: book chunks only;
- `user_content`: own highlights and notes only;
- `broader`: no citations;
- otherwise `synthesis`.

## 4. Boundary rules E6 must not break

1. `TurnService` order and lock semantics (ADR-006 B-5).
2. One accounting path per turn: the Gateway v2 per-attempt cost ledger (NEM-022 D-2).
3. Fail-closed streaming: no text before validation and settlement (NEM-022 F-1/F-3).
4. Contract v1 frozen (NEM-021).
5. `fragments` and `sync_maps` schema unchanged. Reader untouched; citation navigation is **link only**.
6. Default deny at every port; **no production adapters bound by E6**.
7. `BOOK TOKEN ≠ AI USAGE`. No import of token, plan, or subscription code into `knowledge/`.
8. Every model path has a declared invariant and a proving test (AC-12a).

Items 3, 5 and 6 are the ones most likely to be pressured by UX wishes (live typing, deep links into the reader, "it works in prod"). Each is documented as a constraint in [14](14-e6-minimal-ux-proposal.md).
