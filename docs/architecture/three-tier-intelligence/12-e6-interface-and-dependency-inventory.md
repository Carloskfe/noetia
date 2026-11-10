# 12 — E6 Interface and Dependency Inventory (DISCOVERY, DRAFT)

**Status:** DRAFT, documentation-only — **revision 2** (PA review R-1…R-5). Verified against source on branch `docs/e6-turn-orchestration-discovery` (base `6c4b08e`). Paths are relative to `services/api` unless noted.

## 1. Reusable as is (no change proposed)

| Interface | Location | Contract E6 relies on |
|---|---|---|
| `IntelligenceDenied` + `DenialReason` | `src/knowledge/common/intelligence-denied.error.ts` | Stable `code` values with HTTP status. Server messages are English-only, so **clients map `code` → i18n** |
| `EntitlementService` / `QualifyingPlanPort` | `src/knowledge/entitlement/` | Deny-first tier resolution; `unknown` → deny |
| `CapabilityGuard`, `@DeclareCapability` | `src/knowledge/entitlement/capability.guard.ts` | Every route declares a capability (architecture test §10) |
| `SessionsService` (`create`, `get`, `addBook`, `removeBook`, `fork`, `books`, `lockOwned`, `resolveOrDeny`, `markOverLimit`) | `src/knowledge/sessions/sessions.service.ts` | Server-side limits, lock, fork, read-only |
| `RightsService.eligibility(userId, bookId, 'research_analysis')` | `src/knowledge/rights/rights.service.ts` | User-level eligibility; default deny |
| `ContextBuilderService.build` | `src/knowledge/sessions/context-builder.service.ts` | Invariant `research_session_context`; already accepts `highlight`/`note` items that require `userId === requester` |
| `AiGatewayService.prepare` / `invoke` / `stream` / `release` | `src/knowledge/ai/gateway/ai-gateway.service.ts` | Reservation before the call; per-attempt settlement; fail-closed per-attempt streaming; `AbortSignal` |
| `enforceCitations`, `originAfterRules` | `src/knowledge/ai/gateway/citation-policy.ts` | Scope violation drops the answer; `library` → chunks only; `user_content` → highlights/notes only |
| `CostLedgerService`, `CostReconciliationJobService` | `src/knowledge/metering/` | Durable settlement; held when unknown; 60 s reconciliation |
| Simulator v2 + provider contract suite | `src/knowledge/ai/simulator/`, `tests/unit/knowledge/ai/gateway/support/provider-contract.ts` | The only provider for E6 (no paid AI) |
| E5 `QueryContextSource.resolve` / `candidatesFor` | `src/knowledge/retrieval/query-context-source.service.ts` | Chunk items + disclosed exclusions (`unindexed`, `stale`, `unavailable`, `indexNotPermitted`) |
| E5 `AnchorResolver.resolve(ref)` | `src/knowledge/retrieval/anchor-resolver.ts` | `textHash:charStart-charEnd`; null when stale |
| E5 `IndexingPermission`, `LexicalRetrievalService`, `RetrievalPort` | `src/knowledge/retrieval/` | Unchanged (E-1 open) |
| Web `apiFetch` / token refresh | `services/web/lib/api.ts` | Bearer token from `localStorage` plus refresh cookie. Streaming must use `fetch` (not `EventSource`, which cannot send the header) |
| Mobile API client | `services/mobile/src/api/client.ts` | Bearer token. React Native 0.74 `fetch` has no streaming body, so mobile is **non-streaming** |
| i18n providers | `services/web/lib/i18n`, `services/mobile/src/i18n` | en/es parity test on web; 4-file rule for shared copy |

## 2. Reusable with a change to an accepted surface (needs explicit authorization, D-3)

| Surface | Today | Needed by E6 | Protection |
|---|---|---|---|
| `TurnDto` | `{ idempotencyKey }` | `+ question` (string, NFC, 1–500 code points) | Dark API contract (NEM-019 §10 whitelist) |
| `TurnService.run(userId, sessionId, clientKey)` | No question; `contextSource.candidates(...)` | Pass the question to retrieval; merge My Knowledge items; persist the turn; replay a stored turn on the same key | **NEM-019/NEM-022 accepted behaviour** (turn order must stay identical) |
| `ContextSourcePort.candidates(userId, sessionId, allowed)` | No query | Option A: add `query` (port change). Option B: `TurnService` calls `QueryContextSource` directly and leaves the port bound to `EmptyContextSource` | NEM-019 interface; NEM-019 F-12 test pins `CONTEXT_SOURCE_PORT → EmptyContextSource` |
| `TurnResult` | `segments: {origin, text, bookId?}[]`, `excludedBookIds`, `settlement` | v2: `turnId`, `segments[].citations[] {ref, kind, bookId, anchor, excerpt}`, `exclusions {ineligible, unindexed, stale, unavailable, indexNotPermitted}` | Dark response contract |
| `MODEL_PATHS` | `research_session.turn` only | `+ highlights.answer` (Ask My Highlights) with its invariant and test (when D-1 includes it) | AC-12a registry (an additive entry is the designed extension path) |
| NEM-019 `architecture.spec.ts` AC-10/17 and AC-16/17 | No knowledge SQL on, or import of, `fragments` | **Unchanged under D-2 C (recommended first implementation).** Only a later, separately authorized step (D-2 A/B) would add one test-asserted read route | **Accepted protected test** |

## 3. Missing components (to be built)

| Component | Kind | Notes |
|---|---|---|
| `ai_turns` table | Additive migration (≥ 076) | Columns:<br>• `id`<br>• `sessionId` (FK `ai_conversations`, CASCADE)<br>• `turnIndex`<br>• `keyHash` (UNIQUE with session)<br>• `question` (user content)<br>• `segments` jsonb (validated output; citations as **refs + anchors only, no excerpt text**, keeping S2's "no verbatim book text in PostgreSQL")<br>• `exclusions` jsonb<br>• `status` (`accepted` provisional; `completed` / `failed` / `cancelled` / `interrupted` terminal), `settlement`<br>• `attemptToken`, `fenceAt`<br>• `createdAt`, `completedAt`<br>• partial UNIQUE (`sessionId`) WHERE `accepted`<br>No provider or model names. Deletion cascades via the session → user (ADR-005 B-2). **The NEM-021 AC-13 and NEM-019 AC-19 tests are already position-independent (B-3, D-1)** |
| Turn record, durable completion, replay, recovery | Service in `knowledge/sessions/` + `@Interval` sweep | Per mission §9.2: ledger attempt-1 uniqueness = no second reservation or provider call; `ai_turns` uniqueness = no second record; replay after completion; `interrupted` (terminal) only after the database-time fence (sweep + lazy reads); never writes ledger rows |
| Explicit cancel | `POST …/turns/cancel` + in-process `AbortController` registry | Mission §9.3; disconnect is not a cancel (D-9 a) |
| History excerpt re-materialization | `knowledge/sessions/` helper | Re-check eligibility + S2 fetch per cited book on history reads; `sourceState` for revoked, stale, unavailable (D-10 a) |
| Concurrency guard | `knowledge/sessions/` | Weighted by selected books in flight (W = 10 proposed, measured; D-11) |
| History endpoint | `GET /knowledge/sessions/:id/turns` | `history` capability declaration exists (`get`) |
| Streaming endpoint | `POST /knowledge/sessions/:id/turns/stream` (SSE body over `fetch`) | Events: `stage` (preflight / retrieving / composing), Gateway `segment` + `delta` (per attempt, after validation), `terminal` (`TurnResult` v2). Client disconnect → `AbortSignal` |
| Citation enrichment | `knowledge/sessions/` helper | Join Gateway citations with E5 passages (excerpt = the verified passage text already in context) and `AnchorResolver` |
| User-content source | **Deferred (D-2 C).** Later: `knowledge/user-content/` per an approved D-2 A/B | Own highlights and notes for eligible selected books only; isolation tests first (13 §3.5) |
| Context budget allocator | `knowledge/sessions/` | Splits the turn context budget (passages vs highlights) before `prepare` |
| Retrieval-stage metrics | Separate service (pattern of `RetrievalMetricsService`) | Turn stage durations (histograms) without content labels; needed to measure E-1's end-to-end impact |
| Web UI | `services/web/app/(research)/…` + components | See [14](14-e6-minimal-ux-proposal.md); scope per D-1 (E6 vs E9) |
| Mobile UI | `services/mobile/src/screens/research/` | Only if D-6 includes mobile |
| Ask My Highlights path | Model path, Highlight Context Builder, capability | Only after TT-27 (D-1) |

## 4. Dependencies and their state (verified 2026-11-10)

| Dependency | State in repository | Effect on E6 |
|---|---|---|
| NEM-019 (control plane) | **COMPLETED — PO-accepted** (register); Draft PR #46, not merged | Foundation |
| NEM-021 (contract v1, cost ledger) | **COMPLETED — ACCEPTED**; Draft PR #50, not merged | Accounting |
| **NEM-022 (Gateway v2, simulator v2)** | **COMPLETED — ACCEPTED (PO, 2026-11-10)** at `f6a5cb7` after PA re-review; F-1/F-2/F-3 resolved (NEM-022 report §20). Open: global branch coverage 77.49% vs 80% (not waived); intermittent-test monitoring note | **P-0 satisfied.** E6 builds on `f6a5cb7` |
| NEM-023 (retrieval) | **ACCEPTED WITH OPEN EXCEPTIONS E-1, E-2**; Draft PR #53 | Retrieval; latency inherits E-1 |
| E3 (text identity + verification authority adapters) | Not started; ports unbound | With the unbound ports every book is denied in the real module. E6 can be built and tested dark on fixture ports (the E5 precedent) **if the PO accepts that sequencing** (D-7) |
| E4 (qualifying-plan adapter, TT-15) | Not started | Same: fixture port in tests |
| P0 packet (E1–E11 sequence; Draft PR #48, in this ancestry) | DRAFT, not decided | Assigns frontend to **E9** and E6's decision inputs to TT-08/11/13/14/18/19/27. This instruction includes UX in E6, a **scope conflict** (D-1) |
| `main` | None of the above merged | E6 must also be built on the branch stack. Merge order is a later governance decision |

## 5. Mission numbering

- **Verified:** the register (`docs/engineering-missions/README.md`) lists NEM-019, NEM-021, NEM-022, and NEM-023 (NEM-020 is used by the SA-003 billing inventory).
- `git grep "NEM-024"` across **all** remote branches, and the titles of PRs #24–#53, find **no** use of NEM-024.
- **NEM-024 therefore appears available, but it is not reserved.** Reservation is a PO act (D-5), as for NEM-023 (PO-033 D-9). The draft mission uses the placeholder `NEM-0XX (proposed NEM-024)`.
