# E6 — Product Architecture Final Review Package (pre-approval)

**Status:** DRAFT — prepared under PO *"E6 Final Mission Review Preparation"* (2026-11-10). Documentation only. **Authorizes no implementation and approves no decision.**
**Review target:** branch `docs/e6-turn-orchestration-discovery` (Draft PR #54).

**Decision state:**

| State | Items |
|---|---|
| **Approved** | **D-1(a)** — backend plus one minimal web Q&A interface (PO, 2026-11-10) |
| **Proposed baselines** (PO-indicated, **not approved**) | D-2(C), D-4(a), D-6(a), D-7(a), D-9(a) |
| **Open for PA judgement** (this package) | D-3, D-8, D-10, D-11, cancellation consistency, revocation during an active turn |
| **Open for PO** | D-5 (identifier) |

**Carried:**
- NEM-022: **ACCEPTED** at `f6a5cb7` (report §20); open global branch coverage 77.49%; intermittent-test monitoring note.
- NEM-023: accepted with **open exceptions E-1** (retrieval p95 594 ms vs 150 ms) and **E-2** (global branch coverage 78.75% vs 80%). Neither is waived.

**Companions:**
- [DRAFT mission rev 3](../engineering-missions/DRAFT/E6-turn-orchestration-and-user-experience.md)
- [decision packet rev 3](2026-11-10-E6-product-owner-decision-packet.md)
- [discovery report](2026-11-10-E6-turn-orchestration-discovery-report.md)
- [11](../architecture/three-tier-intelligence/11-e6-turn-lifecycle-and-boundaries.md)–[14](../architecture/three-tier-intelligence/14-e6-minimal-ux-proposal.md)

---

## 1. D-3 — Precise accepted-interface amendments

Verified against source on this branch. **Design rule:** every amendment is **additive and backward-compatible**, so existing NEM-019/021/022/023 tests run unchanged. Where that is impossible, the item is listed as a protected-test amendment needing explicit authorization (§1.3).

### 1.1 Amendments to accepted code (dark only)

| # | Surface (file) | Today (verified) | Proposed amendment | Compatibility proof |
|---|---|---|---|---|
| A1 | `TurnDto` (`sessions/sessions.dto.ts`) | `{ idempotencyKey: string /^[A-Za-z0-9_-]{8,64}$/ }` | `+ question: string` (`@IsString`, NFC-normalized and trimmed server-side, 1–500 code points; matching E5) — **required on the HTTP route** | DTO only; the global whitelist pipe already strips unknown fields. Route tests change only where they post a body (new tests, not edits) |
| A2 | `TurnService` constructor (`sessions/turn.service.ts`) | `(db, sessions, rights, contextBuilder, gateway, config, contextSource)`; positional in `tests/unit/knowledge/sessions/turn.service.spec.ts:44` and `tests/integration/knowledge/support/it-env.ts:206` | Append **optional** trailing dependencies: `retrieval?: QueryContextSource`, `turns?: TurnRecordStore`, `guard?: RetrievalGuard`, `cancels?: CancelRegistry` (`@Optional()` in Nest) | Existing positional constructions keep compiling; absent dependencies mean today's behaviour |
| A3 | `TurnService.run(userId, sessionId, clientKey)` | No question; returns `TurnResult` | `run(userId, sessionId, clientKey, question?: string, opts?: { signal?: AbortSignal; onStage?: (s) => void })` | Existing 3-argument calls behave **exactly as today**: no retrieval, no record, the same `TurnResult` fields. **The turn order steps 1–6 are unchanged**; retrieval runs inside step 2 only when `question` and `retrieval` are present |
| A4 | `TurnResult` (`sessions/turn.service.ts`) | `{ sessionId, segments: AnswerSegment[], excludedBookIds, settlement }` | **Additive** optional fields: `turnId?`, `status?`, `citations?` (per segment index: `{ref, kind, bookId, anchor, excerpt\|null, sourceState}`), `exclusions?` | Existing tests use `toMatchObject` / field checks (`turn.service.spec.ts:65,129`), so extra fields do not break them. **`AnswerSegment` (`ai/model-provider.ts`, also used by the legacy `model-gateway.service.ts`) is NOT changed**; citations live in a parallel structure |
| A5 | `SessionsController` (`sessions/sessions.controller.ts`) | 6 routes | Add **in the same controller**: `GET :id/turns`, `GET :id/turns/:turnId`, `POST :id/turns/stream`, `POST :id/turns/cancel`, and a capability probe (path per Q-1) | The NEM-019 architecture test pins `sessions.controller.ts` as the **only** controller in `knowledge/` (`architecture.spec.ts:138–139`). New routes in the same controller keep it unchanged. Each route carries `@DeclareCapability` (test §10) |
| A6 | `KnowledgeModule` providers (`knowledge.module.ts`) | No retrieval providers | Add `IndexingPermission`, `LexicalRetrievalService`, `QueryContextSource`, `AnchorResolver`, `StorageBookText` (+ `StorageModule` import), `RetrievalMetricsService`, `TurnRecordStore`, `RetrievalGuard`, `CancelRegistry`, recovery `@Interval` job | **No pinned binding changes:** `CONTEXT_SOURCE_PORT → EmptyContextSource`, `TEXT_IDENTITY_PORT → UnboundTextIdentityPort`, etc. stay (F-12 test). E5 classes get their ports from the **same unbound tokens**, so the real module still denies everything |
| A7 | Retrieval wiring | `contextSource.candidates(userId, sessionId, allowed)` (always empty) | `TurnService` merges `contextSource.candidates(...)` **and** `retrieval.resolve(...)` before `contextBuilder.build` | `ContextSourcePort` signature and binding unchanged (direct injection, not a port change) |
| A8 | Migration `ai_turns` (≥ 076) | — | Additive table (mission §5.5) | NEM-019 AC-19 and NEM-021 AC-13 migration tests are position-independent (B-3, D-1) |
| A9 | Web | No intelligence UI | New route `app/(research)/research/[sessionId]` + components; i18n keys in `lib/i18n/{en,es}.ts` | No reader file changes; reader suites unchanged (AC) |

### 1.2 Not amended (explicitly preserved)

- `ContextSourcePort` and all port bindings.
- `ContextBuilderService` and its invariant.
- `MODEL_PATHS` (still only `research_session.turn`).
- `AiGatewayService` (all methods and the streaming contract).
- `citation-policy.ts`, contract v1, the cost-ledger API and tables, `IntelligenceDenied` codes (reused; new codes only if PA approves, see Q-4).
- E5 retrieval classes.
- `fragments` and `sync_maps` (D-2 C baseline).
- `app.module.ts` and `knowledge.registration.ts`.

### 1.3 Protected-test amendments required

**None** under the baseline design (A1–A9). Two triggers would require one:
- a separate controller for the probe (Q-1 option b);
- any D-2 A/B later step.

Either needs its own explicit authorization.

### 1.4 New architecture tests E6 adds (positive guards)

- E6 code writes no ledger table (`ai_budget_ledger`, `ai_usage_events`, cost tables).
- No `fragments` / `sync_maps` SQL (redundant with NEM-019; kept explicit).
- `ai_turns` has no excerpt or verbatim text column, and the completion payload carries refs + anchors only.
- No content in logs, metrics, or SSE `stage` events.
- The three-argument `run` path is byte-for-byte equivalent in behaviour: the existing turn suites pass.

---

## 2. D-8 — Durable completion, persistence failure, idempotency

**Mechanism** (mission §9.2):
- Two database constraints:
  - the **NEM-021 ledger attempt key** `turnKey:a1` is unique, so there is at most one first reservation and at most one first provider call per turn key;
  - **`ai_turns` UNIQUE (`sessionId`, `keyHash`)**, so there is at most one record.
- Nothing else is relied on.
- **No exactly-once claim** is made beyond these two constraints.

| Question | Specification |
|---|---|
| When is a turn durably completed? | When `UPDATE ai_turns SET status = 'completed', … WHERE id = $1 AND status = 'accepted'` commits. It runs after the Gateway terminal event, by which point usage is already settled or held in the ledger (NEM-022 F-3). Settlement (a charge fact, ledger authority) and completion (a conversation fact) are separate |
| When is the record created? | `INSERT … status = 'accepted'` inside the existing step-4 lock transaction, so a record exists **iff** the session lock and turn count were committed for this turn |
| Persistence fails after settlement | One bounded retry. Then the answer is returned with `status: 'unrecorded'` (D-8 a, proposed). The charge stands; E6 never compensates; the row stays `accepted`; recovery → `interrupted`; a replay of that key → `result_unavailable`; metric `intelligence_turn_unrecorded_total`. *Alternative D-8 b:* withhold the answer and return an error (the user is charged with no answer) |
| Duplicates | Five-case table (mission §9.2 item 5): preflight race (the ledger admits one), in flight (`409 duplicate_turn {turnId, status}`), completed (`200` replay), failed/cancelled/interrupted (the stored status; a new key is required), released after a step-4 failure (`409 turn_failed`, new key) |
| Retries | Gateway-internal retries are separate reserved attempts (accepted NEM-022 behaviour; E6 adds none). A client retry with the same key never reserves or calls the provider again. A new question means a new key, which is a new charge by design |
| Recovery | An `@Interval` sweep: `accepted` rows older than `providerTimeoutMs × maxAttempts + grace` → `interrupted`. It **never writes ledger rows**; held attempts resolve through the existing NEM-021 reconciliation (60 s) |
| Account deletion | `ai_turns` → `ai_conversations` → `users` ON DELETE CASCADE. A late completion `UPDATE` affects 0 rows (no resurrection). The `deleteAccount` path is unchanged |
| Tests | A barrier-synchronised concurrent same-key test (one reservation, one provider invocation by spy, one row); failure injection on the completion write; a crash between lock and completion (recovery); deletion during flight |

**PA judgement requested:**
- the D-8 (a)/(b) policy;
- whether `unrecorded` delivery is acceptable given that the answer then exists only in the HTTP response.

---

## 3. D-10 — Historical citations and excerpts after rights revocation

| Element | Specification |
|---|---|
| Storage | `ai_turns.segments` holds generated text plus citations as **refs + anchors only** (`bookId`, `textHash`, `charStart`, `charEnd`). **No excerpt text.** This preserves NEM-023 S2: no verbatim book text in PostgreSQL |
| History read | Per cited book: `RightsService.eligibility(user, book, 'research_analysis')` **and** `IndexingPermission.check`, then S2 re-materialization (current hash = anchor hash → MinIO GET → hash verify → slice) |
| Outcomes | `sourceState: available` (excerpt shown) · `revoked` (ineligible or index permission withdrawn) · `stale` (text version changed) · `unavailable` (object missing or read failure; chunk purged). The last three give `excerpt: null` and "source no longer available" |
| Default (D-10 a, proposed) | Historical excerpts are **hidden** after revocation. The generated answer text remains (generated content, ADR-006). Final retention/redaction policy: **TT-14**. Because no excerpt is stored, any TT-14 outcome needs no data migration |
| Cost | History reads perform S2 work (one GET + hash per cited book per page), so they share the E-1 cost profile **and count toward the D-11 guard** (§4) |

**PA judgement requested:**
- (a) vs (b) keep vs (c) hide the whole answer;
- whether generated answer text quoting a revoked book should also be redacted before TT-14. Not proposed; it would need quotation detection, related to TT-13.

---

## 4. D-11 — Weighted concurrency, reader-latency acceptance, reader protection

**Measured** (discovery report §5.4; `node:20-alpine`, `--cpus=1 --memory=512m`; the production API image idles at 73–102 MiB):
- **CPU on the single event loop** is the constraint.
- Lag p99 is ~85 ms with one in-flight 10-book retrieval, ~169 ms with two, and ~96 ms with three 3-book retrievals.
- Memory: +~40 MB per concurrent 10-book turn (not binding).

| Element | Proposal |
|---|---|
| Guard | Per process: Σ (books whose S2 work is in flight) ≤ **W = 10**. Covers turn retrieval **and** history excerpt re-materialization |
| Admission point | **Before reservation** (step 2, before retrieval). Over the limit → `503` + `Retry-After` (`budget_unavailable` class); no charge, lock, or record |
| Fairness | No queueing in the MVP (reject, not wait), which avoids holding requests and memory |
| Reader protection — acceptance | On the **production image** under `--cpus=1 --memory=512m`, with disposable PostgreSQL / Redis / MinIO and a fixture of 10 books × ~2M code points: measure the p95 of `GET /books` and of the reader text endpoint (a) idle and (b) with sustained turns at W. **Pass if p95(b) − p95(a) ≤ Δ, where Δ is set by the PA** (Q-3). Reported with raw output |
| If it fails | Stop condition. In-scope remedies are limited to lowering W. Worker threads, reducing the per-book synchronous block (NEM-023 code), and a separate API container are out of scope (separate approvals) |
| E-1 | Unchanged and **not waived**. The guard limits interference; it does not improve retrieval latency |

**PA judgement requested:**
- W;
- Δ (Q-3);
- whether history reads share W or get a separate smaller budget (Q-5).

---

## 5. Cancellation — consistency between explicit cancel and disconnect

**Principle (D-9 a, proposed): only an explicit, authenticated cancel aborts a turn; a transport event never does.**
- **Web streaming:** closing the SSE body ends delivery only; the turn continues and is persisted. The UI's "Cancelar" sends `POST …/turns/cancel {idempotencyKey}` and then closes the stream.
- **Non-streaming:** the same rule applies.
- **Reload:** the client recovers the turn by `GET …/turns/:turnId` (or a same-key replay).

| Stage when cancel arrives | Action | Charge | Lock | Record |
|---|---|---|---|---|
| Before reservation | Stop at the next stage boundary | None | None | None |
| After reservation, before the lock commits | `gateway.release(prepared)` (held if the release cannot be written) | None | None | None |
| After the lock, before the provider call | Skip the invoke; `gateway.release(prepared)` | None | Stands | `cancelled` |
| During a provider attempt | `AbortSignal` → `client_abort`; no text released (F-1) | **Held** at the reserved amount until reconciliation | Stands | `cancelled` |
| After settlement | No effect | As settled | Stands | `completed` |

**Consistency rules:**
1. Cancel is idempotent: a repeat or late cancel returns the current status.
2. Cancel for an unknown key → `404`.
3. Cancel by another user is impossible: the key is server-namespaced by `userId` + `sessionId`.
4. The UI shows "Cancelada" only after the cancel response, never on stream close.
5. The registry is in-process, so a multi-instance deployment needs a shared channel (launch item).

**PA judgement requested:** whether "after the lock, before the provider call" should keep the lock (ADR-006: the turn was accepted) or treat the turn as never accepted. Keeping the lock is proposed because the lock transaction already committed.

---

## 6. Rights revocation during an active turn

| Moment of revocation | Behaviour |
|---|---|
| Before step 2 | The book is excluded and disclosed; with none left → `no_eligible_books` (no charge, lock, or record) |
| During step 2, after the book's eligibility check but before retrieval | Retrieval re-checks `IndexingPermission`, so the book is excluded (`indexNotPermitted`); user-level eligibility is not re-checked within the step |
| Between the end of step 2 and the provider call (prepare, lock) | **Not re-checked**: the context is already sealed. Window ≈ reservation + lock time (tens of ms) |
| During the provider call | Not re-checked; the answer may cite the revoked book. The answer is delivered (proposed), and the next history read hides the excerpt (D-10) |
| After completion | History read → `revoked`, excerpt hidden (D-10) |

**Proposed:** accept the residual window as documented (ADR-006 says rights are re-evaluated **per turn**). An optional post-generation re-check before release would hold the validated answer while eligibility is re-run. It is possible without a Gateway change, because `invoke` returns before E6 releases anything. It adds latency and drops already-paid answers.

**PA judgement requested** (Q-2): accept the residual, or require the post-generation re-check (and, if so, whether a dropped answer is shown as "source became unavailable").

---

## 7. Implementation sequence — independently reviewable checkpoints

Each checkpoint ends in a commit set with tests green and a PA review. A checkpoint does not start until the previous one is reviewed.

| Checkpoint | Content | Review evidence |
|---|---|---|
| **A — Turn wiring + record** | A1–A4, A6–A8; retrieval inside step 2; context budget; `ai_turns`; durable completion; duplicate table; replay; `TurnResult` additive fields. Only the non-streaming route | Existing NEM-019/021/022/023 suites unchanged and green; new unit + integration (barrier duplicates, completion failure, deletion cascade, migration up/down) |
| **B — Resilience** | Explicit cancel (registry + route) with the §5 matrix; recovery sweep; history and single-turn routes with D-10 re-materialization; W guard; stage metrics | Each §5 row and §6 row tested; guard admission before reservation; history redaction tests |
| **C — Transport + probe** | SSE stream route (Gateway per-attempt events + content-free `stage`); the capability probe (Q-1); `X-Accel-Buffering: no` | No text before the validated `segment`; stream close ≠ cancel; probe denies by default |
| **D — Minimal web Q&A (required, D-1 a)** | `/research/[sessionId]` per [14](../architecture/three-tier-intelligence/14-e6-minimal-ux-proposal.md): ask, stage states, answer with origin labels, citation dialog (excerpt / `sourceState`), "Open book" link, cancel, error mapping, read-only/fork notice, exclusions banner; en/es; accessibility | Jest component tests; one Playwright flow against the simulated local stack; i18n parity; reader suites unchanged |
| **E — Verification and report** | Reader-latency measurement (§4) on the production image; E-1 latency tables (3 and 10 books); coverage (E-2: new code ≥ 80% branches, no global decrease); completion report | Raw outputs; Δ against the PA threshold |

## 8. Remaining questions for PA judgement

| ID | Question | Proposed answer |
|---|---|---|
| **Q-1** | Capability probe location: (a) `GET /knowledge/sessions/capabilities` in `SessionsController` (no test amendment) vs (b) a separate `GET /knowledge/me` controller (amends the NEM-019 controller-list test) | (a) |
| **Q-2** | Revocation during an active turn: accept the residual window, or add a post-generation re-check | Accept and document |
| **Q-3** | Reader-latency threshold Δ (p95 increase allowed at W) | PA to set. The measurement method is fixed in §4 |
| **Q-4** | New `DenialReason` codes (`result_unavailable`, `turn_in_progress`) vs reusing `duplicate_turn` / `turn_failed` with a status payload | Reuse existing codes plus a status payload (no change to the accepted enum) |
| **Q-5** | Do history re-materializations share W with turns? | Share W (simplest; protects the reader) |
| **Q-6** | D-8 (a) `unrecorded` delivery vs (b) withhold | (a) |
| **Q-7** | Lock after a cancel between lock and provider call: keep (proposed) or roll back as "not accepted" | Keep |
| **Q-8** | D-10 (a) hide excerpts vs (b) keep vs (c) hide the answer, before TT-14 | (a) |
| **Q-9** | Whether the context budget allocator's default (6,000 passage tokens) is acceptable for the simulator-only phase | Accept as engineering configuration |
| **Q-10** | Entry point to the E6 screen: (a) URL-only, for sessions created through the API or fixtures; (b) one minimal "Research with Noetia+" button on the book page that creates a one-book session (touches a non-reader page; the book picker remains E9) | (a) for the dark build. (b) only if the PA wants a clickable path for review; it must not touch reader files |

**STOP for independent Product Architecture review.** No implementation, merge, or deployment.
