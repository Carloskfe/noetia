# NEM-024 (E6) — Product Architecture Final Review Package — revision 5 (for final sign-off)

**Status:** DRAFT — prepared under PO *"E6 Final Mission Review Preparation"* (2026-11-10). **Revision 5** answers F-7: the cutoff semantics are made precise; the fence applies to a transition's **statement start**, not its commit (§7.7). **Revision 4** (2026-11-10): the PO approved all decisions in **PO-034** (documentation and final PA sign-off only), and the mission is finalized as **NEM-024**. PostgreSQL fence semantics under lock waits are added (§7.6). **Revision 3** answered F-6 (PA review of `4e2c041`): `interrupted` is **terminal**, and recovery is **fenced** by database time (§7). **Revision 2** answered F-1 to F-5 (review of `ccb3acc`; §9). Documentation only. **Authorizes no implementation and approves no decision.**
**Review target:** branch `docs/e6-turn-orchestration-discovery` (Draft PR #54).

**Decision state:** **all decisions approved by the PO (PO-034, 2026-11-10)**: D-1(a), D-2(C), D-3, D-4(a), D-5 (NEM-024), D-6(a), D-7(a), D-8(a), D-9(a), D-10(a), D-11 (W = 10 candidate; reader p95 delta ≤ 50 ms), plus the final eligibility check, terminal fenced recovery, one provisional turn per session, and cancellation behaviour. **Implementation is not authorized.** Remaining for the PA: Q-4, Q-5, Q-7, Q-9, Q-10, Q-12 (§10). Q-11 goes to the PO only if triggered.

**Carried:**
- NEM-022: **ACCEPTED** at `f6a5cb7` (report §20); open global branch coverage 77.49%; intermittent-test monitoring note.
- NEM-023: accepted with **open exceptions E-1** (retrieval p95 594 ms vs 150 ms) and **E-2** (global branch coverage 78.75% vs 80%). Neither is waived.

**Companions:**
- [DRAFT mission rev 4](../engineering-missions/APPROVED/NEM-024-research-turn-orchestration-and-minimal-bilingual-web-qa.md)
- [decision packet rev 4](2026-11-10-E6-product-owner-decision-packet.md)
- [discovery report](2026-11-10-E6-turn-orchestration-discovery-report.md)
- [11](../architecture/three-tier-intelligence/11-e6-turn-lifecycle-and-boundaries.md)–[14](../architecture/three-tier-intelligence/14-e6-minimal-ux-proposal.md)

---

## 1. D-3 — Precise accepted-interface amendments

Verified against source on this branch. **Design rule:** every amendment is **additive and backward-compatible**, so existing NEM-019/021/022/023 tests run unchanged.

### 1.1 Amendments to accepted code (dark only)

| # | Surface (file) | Today (verified) | Proposed amendment | Compatibility proof |
|---|---|---|---|---|
| A1 | `TurnDto` (`sessions/sessions.dto.ts`) | `{ idempotencyKey: string /^[A-Za-z0-9_-]{8,64}$/ }` | `+ question: string` (`@IsString`, NFC-normalized and trimmed server-side, 1–500 code points; matching E5), required on the HTTP route | DTO only; the global whitelist pipe already strips unknown fields |
| A2 | `TurnService` constructor (`sessions/turn.service.ts`) | `(db, sessions, rights, contextBuilder, gateway, config, contextSource)`; positional in `turn.service.spec.ts:44` and `it-env.ts:206` | Append **optional** trailing dependencies (`@Optional()`): `retrieval?: QueryContextSource`, `indexPermission?: IndexingPermission`, `turns?: TurnRecordStore`, `guard?: RetrievalGuard`, `cancels?: CancelRegistry` | Existing positional constructions keep compiling; absent dependencies mean today's behaviour |
| A3 | `TurnService.run(userId, sessionId, clientKey)` | No question | `run(userId, sessionId, clientKey, question?: string, opts?: { signal?: AbortSignal; onStage?: (s) => void })` | Existing 3-argument calls behave **exactly as today**. Turn order steps 1–6 unchanged; retrieval inside step 2; the final eligibility check (§6) sits between step 4 and step 5 and only runs when `question` is present |
| A4 | `TurnResult` | `{ sessionId, segments: AnswerSegment[], excludedBookIds, settlement }` | **Additive** optional fields: `turnId?`, `status?`, `citations?` (per segment index: `{ref, kind, bookId, anchor, excerpt\|null, sourceState}`), `exclusions?` | Existing tests use `toMatchObject` / field checks (`turn.service.spec.ts:65,129`). **`AnswerSegment` (`ai/model-provider.ts`, shared with the legacy `model-gateway.service.ts`) is unchanged** |
| A5 | `SessionsController` (`sessions/sessions.controller.ts`) | 6 routes | Add **in the same controller**: `GET capabilities` (**capability probe: `GET /knowledge/sessions/capabilities`, declared before the `:id` routes** so `ParseUUIDPipe` never sees it), `GET :id/turns`, `GET :id/turns/:turnId`, `POST :id/turns/stream`, `POST :id/turns/cancel` | The NEM-019 architecture test pins `sessions.controller.ts` as the **only** controller in `knowledge/` (`architecture.spec.ts:138–139`), so it is unchanged. Each route carries `@DeclareCapability` (test §10); the probe declares `research_session` / `history`, so an unentitled user gets the standard denial (UI hidden) |
| A6 | `KnowledgeModule` providers | No retrieval providers | Add `IndexingPermission`, `LexicalRetrievalService`, `QueryContextSource`, `AnchorResolver`, `StorageBookText` (+ `StorageModule` import), `RetrievalMetricsService`, `TurnRecordStore`, `RetrievalGuard`, `CancelRegistry`, the recovery `@Interval` job | No pinned binding changes (F-12 test); E5 classes use the **same unbound** port tokens, so the real module denies everything |
| A7 | Retrieval wiring | `contextSource.candidates(...)` (always empty) | `TurnService` merges `contextSource.candidates(...)` **and** `retrieval.resolve(...)` before `contextBuilder.build` | `ContextSourcePort` signature and binding unchanged |
| A8 | Migration `ai_turns` (≥ 076) | — | Additive table (mission §5.5), including `attemptToken`, `fenceAt`, and the partial unique index of §7 | NEM-019 AC-19 / NEM-021 AC-13 are position-independent |
| A9 | Web | No intelligence UI | `app/(research)/research/[sessionId]` + components; i18n keys in `lib/i18n/{en,es}.ts` | No reader file changes |

### 1.2 Not amended (explicitly preserved)

- `ContextSourcePort` and all port bindings; `ContextBuilderService` and its invariant; `MODEL_PATHS`.
- `AiGatewayService` (all methods and the streaming contract); `citation-policy.ts`; contract v1.
- The cost-ledger API and tables; `IntelligenceDenied` codes (reused).
- E5 retrieval classes; `fragments` and `sync_maps` (D-2 C baseline).
- `app.module.ts`, `knowledge.registration.ts`.

### 1.3 Protected-test amendments required

~~**None** under this design.~~ **Correction (2026-11-10, Checkpoint A pre-execution check):** one is required. The accepted NEM-023 test *"no turn or port wiring"* (`tests/unit/knowledge/retrieval/retrieval-architecture.spec.ts`) forbids A6/A7; it was overlooked here. Proposed intent-preserving amendment and decision: [NEM-024 Checkpoint A report](2026-11-10-NEM-024-checkpoint-a-report.md) §3–§4 (B-1). A later D-2 A/B step would need its own authorization.

### 1.4 New architecture tests E6 adds

- E6 writes no ledger table.
- No `fragments` / `sync_maps` SQL.
- `ai_turns` has no excerpt or verbatim text column.
- No content in logs, metrics, or SSE `stage` events.
- The 3-argument `run` path is unchanged (the existing suites pass).
- The final eligibility check reads no cached decision (§6).

---

## 2. D-8 — Durable completion, persistence failure, idempotency (F-2 corrected)

**Mechanism:**
- Only two database constraints are relied on:
  - the **NEM-021 ledger attempt key** `turnKey:a1` (unique), so there is at most one first reservation and one first provider call per turn key;
  - **`ai_turns` UNIQUE (`sessionId`, `keyHash`)**, so there is at most one record.
- Status transitions are **conditional single-statement updates** (§7).
- **No exactly-once claim.**

| Question | Specification |
|---|---|
| Record creation | `INSERT … status = 'accepted', attemptToken, fenceAt = statement_timestamp() + T_max + grace` inside the existing step-4 lock transaction (database time) |
| Durable completion | When the conditional completion `UPDATE` (§7) commits. This happens after the Gateway terminal event, by which time usage is settled or held in the ledger (NEM-022 F-3). Settlement (charge, ledger authority) and completion (conversation record) are separate facts |
| Persistence fails after settlement (D-8 a, proposed) | One bounded retry. Then the server **attempts** to return the answer with `unrecorded: true` (a response marker, **not** a state). The charge stands; E6 never compensates. The row stays `accepted` until its fence passes, then becomes `interrupted` (terminal). Before the fence, replay → `409 {status: accepted}`; after it, replay → `interrupted`. Metric `intelligence_turn_unrecorded_total` |
| **What D-8 (a) does and does not guarantee** | It **does not guarantee** that the user sees the answer they were charged for. Delivery of the `unrecorded` response is **best effort**: if the HTTP response or SSE terminal event is lost (network failure, tab closed, app backgrounded, proxy timeout), the answer is **lost**. It exists only in that response, and replay never reproduces it (`409 accepted` before the fence, `interrupted` after it). The user is then **charged for an answer never seen**. D-8 (a) only avoids **withholding** an answer the server still holds. *Alternative D-8 (b):* return an error and discard the answer, which is a certain unseen charge |
| Network failure with a **recorded** turn | The ordinary case. If the response is lost but the completion committed, the turn is recoverable: a same-key replay or `GET …/turns/:turnId` returns the stored result with no new charge. With D-9 (a), a disconnect does not cancel, so the turn continues to completion |
| Combined failure (record failed **and** response lost) | Unseen charge, as above. Bounded by the rarity of a completion-write failure; counted by `intelligence_turn_unrecorded_total`; disclosed in the report as a known residual |
| Duplicates | Mission §9.2 item 5: preflight race (the ledger admits one); in flight before the fence (`409 duplicate_turn {status: accepted}`); after the fence (lazy → `interrupted`); completed (`200` replay); failed, cancelled, or interrupted (the stored status; a new key needs explicit user action); released after a step-4 failure (`409 turn_failed`); a different key while one is provisional (released at step 4, `409 duplicate_turn`; §7.4) |
| Retries | Gateway-internal retries are separate reserved attempts (accepted NEM-022); E6 adds none. A client retry with the same key never reserves or calls the provider again |
| Account deletion | `ai_turns` → `ai_conversations` → `users` CASCADE; a late conditional update affects 0 rows; `deleteAccount` is unchanged |

---

## 3. D-10 — Historical citations and excerpts after rights revocation

| Element | Specification |
|---|---|
| Storage | `ai_turns.segments` holds generated text plus citations as **refs + anchors only**. No excerpt text (NEM-023 S2 preserved) |
| History read | Per cited book: user-level `RightsService.eligibility(user, book, 'research_analysis')` **and** book-level `IndexingPermission.check(book)`, then S2 re-materialization (current hash = anchor hash → GET → verify → slice) |
| Outcomes | `available` · `revoked` (either check fails) · `stale` (the text version changed) · `unavailable` (object missing or read failure; chunk purged). Only `available` shows the excerpt |
| Default (D-10 a, proposed) | Excerpts hidden after revocation; the generated answer text remains pending **TT-14** |
| Cost | History reads perform S2 work and count toward the D-11 guard (Q-5) |

---

## 4. D-11 — Weighted concurrency, reader-latency acceptance (F-4 corrected)

**Measured** (discovery report §5.4; `node:20-alpine`, `--cpus=1 --memory=512m`; the production image idles at 73–102 MiB):
- CPU on the single event loop is the constraint.
- Lag p99 is ~85 ms (one 10-book retrieval), ~169 ms (two), ~96 ms (three 3-book retrievals), and ~56 ms (one 3-book retrieval).

| Element | Proposal |
|---|---|
| Guard | Per process: Σ books whose S2 work is in flight ≤ **W**. Covers turn retrieval and history excerpt re-materialization. Admission is **before reservation**; over the limit → `503` + `Retry-After`; no charge, lock, or record. No queueing |
| **W status** | **W = 10 is a candidate, not accepted.** The value is accepted only by the measurement below |
| **Acceptance criterion (proposed)** | **Reader endpoint p95 delta ≤ 50 ms** under **sustained permitted retrieval load** at W, against idle, on the **production API image** |
| Method | Disposable PostgreSQL / Redis / MinIO; fixture 10 books × ~2M code points.<br>1. Measure the p95 of `GET /books` and the reader text endpoint over ≥ 1,000 requests each, (a) idle and (b) while turns run continuously at the guard limit.<br>2. **Delta = p95(b) − p95(a), per endpoint.**<br>3. Raw output attached |
| If it fails | **Reduce W and retest**, in order **10 → 6 → 3**, recording each result. The accepted W is the largest that passes. Never assume a value passes |
| Consequence if W < 10 | A NoetiaX 10-book turn can never be admitted (its weight exceeds W). That is a **product conflict** with PO-027 (10-book sessions), **not an engineering choice** → stop and escalate to PA + PO (Q-11). The measured single-turn lag (~85 ms p99 at 10 books) suggests this outcome is **plausible** |
| If W = 3 fails | Stop condition; remedies outside scope (worker threads, reducing NEM-023's per-book synchronous block, or a separate container) need separate approval |
| E-1 | Unchanged, **not waived**. The guard limits interference; it does not improve retrieval latency |

---

## 5. Cancellation — consistency between explicit cancel and disconnect

**Principle (D-9 a, proposed): only an explicit, authenticated cancel aborts a turn; a transport event never does.**
- **Stream close:** closing the SSE body ends delivery only; the turn continues and is persisted.
- **UI cancel:** "Cancelar" sends `POST …/turns/cancel {idempotencyKey}`, then closes the stream.
- **Reload:** the client recovers by `GET …/turns/:turnId` or a same-key replay.

| Stage when cancel arrives | Action | Charge | Lock | Record (conditional update, §7) |
|---|---|---|---|---|
| Before reservation | Stop at the next stage boundary | None | None | None |
| After reservation, before the lock commits | `gateway.release(prepared)` (held if the release cannot be written) | None | None | None |
| After the lock, before the provider call | Skip the invoke; `gateway.release(prepared)` | None | Stands | `accepted → cancelled` |
| During a provider attempt | `AbortSignal` → `client_abort`; no text released (F-1) | **Held** at the reserved amount until reconciliation | Stands | `accepted → cancelled` |
| After settlement | No effect | As settled | Stands | `completed` |

**Consistency rules:**
1. Cancel is idempotent: a repeat or late cancel returns the current status.
2. An unknown key → `404`.
3. Keys are server-namespaced by `userId` + `sessionId`, so another user cannot cancel.
4. The UI shows "Cancelada" only after the cancel response.
5. The registry is in-process; a multi-instance deployment needs a shared channel (launch item).

---

## 6. Rights revocation during an active turn (F-3 corrected)

**Two distinct authorizations are preserved (NEM-023 §9.6):**
- **User-level research rights:** `RightsService.eligibility(userId, bookId, 'research_analysis')`. May this user use this book now?
- **Book-level indexing permission:** `IndexingPermission.check(bookId)`. May the index of this exact text version be used?

They are evaluated independently, the most restrictive wins, and neither substitutes for the other.

### 6.1 Final eligibility check (new)

| Element | Specification |
|---|---|
| Position | **After the step-4 lock transaction commits and immediately before `gateway.invoke` / `gateway.stream`.** No other awaited operation may sit between the check's completion and the invoke call (architecture-asserted ordering test). No external I/O is added inside the lock transaction, so ADR-006's "no provider call while holding the lock" is unchanged |
| Inputs | The sealed context's `allowedBookIds` and the set of books contributing `chunk` items |
| Checks (fresh, no cached decision from step 2 or from `QueryContextSource`'s per-request cache) | (1) **user-level:** `RightsService.eligibility(user, b, 'research_analysis')` for **every** book in `allowedBookIds`; (2) **book-level:** `IndexingPermission.check(b)` for **every** book contributing chunk items. In both, the current hash must still equal the hash used in step 2 |
| On failure (any book fails either check) | **Do not invoke.** Call the existing `gateway.release(prepared)` for the never-sent attempt. If the release cannot be written, the attempt stays **held** and the existing NEM-021 reconciliation resolves it from the no-provider evidence. **No charge** for a released attempt. The record goes `accepted → failed` with an internal reason (`user_rights_changed` / `index_permission_changed`). The lock stands (the step-4 transaction already committed; consistent with Q-7). The user gets the existing `book_ineligible` denial with an `exclusions` payload naming the book(s); asking again uses a new key, and the next turn excludes the book |
| No rebuild in place | Rebuilding the context without the book would change the counted input after reservation. The attempt key `turnKey:a1` cannot be reserved twice, so a new attempt would need a new turn. **Abort-and-retry** is specified instead |
| Contracts | **Gateway and ledger unchanged.** Only existing methods are used (`release` for a never-invoked prepared call; reconciliation as accepted) |
| Cost | One extra pass of eligibility + index-permission checks per turn. With fixture ports this is negligible. With E3 it depends on the text-identity design (discovery R-2: the hash must not be recomputed from the full object per call) |

### 6.2 Remaining windows

| Moment of revocation | Behaviour |
|---|---|
| Before step 2 | Excluded and disclosed; with none left → `no_eligible_books` (no charge, lock, or record) |
| Between step 2 and the final check | **Caught by the final check** → release, `failed`, `book_ineligible` |
| Between the final check and the invoke | No awaited operation exists there (ordering test). Effectively closed |
| During the provider call | Not re-checked; the answer may cite the revoked book. It is delivered; the next history read hides the excerpt (D-10) |
| After completion | History read → `revoked`, excerpt hidden (D-10) |

---

## 7. Recovery — fenced, terminal-safe state machine (F-5, revised for F-6)

**Problem (F-6):** revision 2 let `interrupted → completed` happen. A client that had already shown "interrupted" could then see "completed": two contradictory outcomes, and an invitation to pay again.

**Revised principle:**
- **Every terminal state is final.** `interrupted` is **terminal**.
- A turn may be finalized as `interrupted` **only by a finalization statement that starts at or after its fence**. A transition statement that starts at or after the fence can never succeed; one that started before it may still commit shortly after it (§7.7).
- Before the fence, the turn is **provisional** (`accepted`) for every reader.

The lease of revision 2 is removed (no renewal timers).

### 7.1 Mechanism (existing PostgreSQL + `@Interval` + Node timers; no new table or service)

| Element | Specification |
|---|---|
| Columns (in the new `ai_turns`, additive) | `attemptToken uuid` (random per request) and `fenceAt timestamptz` = `statement_timestamp() + T_max + grace`, set **by the database** at insert in the step-4 lock transaction |
| T_max | `providerTimeoutMs × maxProviderAttempts + Σ allowed retry delays + completion-write budget`, computed at insert from the active configuration (Q-12) |
| Owner self-bound | The owning request starts a monotonic timer of **T_max** at insert. When it fires, the request aborts its provider call through the existing `AbortSignal` and stops attempting transitions. `grace` (proposed 30 s) separates the owner's last possible write from the fence |
| **Fencing predicate** | Every owner or cancel transition includes `AND statement_timestamp() < fenceAt` (database clock, evaluated at **statement start**). A transition **started** at or after the fence can never succeed, even from a frozen-then-resumed process. A transition started before the fence may acquire the row lock and **commit after** the fence (bounded by `statement_timeout`); it succeeds only if no other terminal transition committed first (§7.7) |
| Finalization | `UPDATE ai_turns SET status = 'interrupted' WHERE id = ANY($ids) AND status = 'accepted' AND statement_timestamp() >= fenceAt`. Run by (a) the `@Interval` sweep (e.g. 60 s), **and** (b) **lazily**, inside every replay, history, single-turn, and cancel read, before responding. No reader ever sees `accepted` after the fence, or `interrupted` before it. **Never touches the ledger** |
| One in-flight turn per session | **Partial unique index** `UNIQUE (sessionId) WHERE status = 'accepted'` on `ai_turns`. A second turn with a **different** key while one is provisional fails at the step-4 insert → step-4 failure → the existing `releaseOrHold` releases the reservation (**no charge**) → `409 duplicate_turn {status: 'accepted', turnId}` (the existing code; Q-4). A preflight `SELECT` gives the same answer earlier; the index is the guarantee |
| Owner outcome when a transition is fenced (0 rows) | The owner returns **the row's current terminal status** (re-read) and **releases no answer text**. For example, a completion fenced out after `interrupted` → the client receives `interrupted`, never the answer. The charge, if any, stands per the ledger. This rare residual (the owner overran T_max + grace, e.g. a frozen process) is counted by `intelligence_turn_fenced_total` and disclosed |
| Persistence failure (DB error, not fence) | Covered by §2: `unrecorded: true` answer delivery (best effort). The row is later finalized `interrupted`; history shows "not saved", **consistent** with the response's explicit "not saved to your history" label. This is the only case where the answer was shown, and it was explicitly labelled unsaved |

### 7.2 Final state-transition table

States: **`accepted`** (provisional) · **`completed`**, **`failed`**, **`cancelled`**, **`interrupted`** (terminal). All transitions are single conditional `UPDATE` statements.

| # | From | To | Actor | Condition (all in one statement) | On 0 rows |
|---|---|---|---|---|---|
| T0 | — | `accepted` | Owner (step-4 lock transaction) | INSERT; UNIQUE (`sessionId`, `keyHash`); partial UNIQUE (`sessionId`) WHERE `accepted` | Step-4 failure: release, no charge, `409 duplicate_turn` |
| T1 | `accepted` | `completed` | Owner | `status = 'accepted' AND attemptToken = $owner AND statement_timestamp() < fenceAt` | Re-read; return that terminal status; **no text released** |
| T2 | `accepted` | `failed` | Owner (provider/validation failure, final eligibility check, timeout at T_max) | `status = 'accepted' AND attemptToken = $owner AND statement_timestamp() < fenceAt` | Re-read; return that status |
| T3 | `accepted` | `cancelled` | Explicit cancel (authenticated, same user) | `status = 'accepted' AND statement_timestamp() < fenceAt` | Lazy-finalize, then return the current status (idempotent) |
| T4 | `accepted` | `interrupted` | Sweep or any lazy reader | `status = 'accepted' AND statement_timestamp() >= fenceAt` | No-op (already terminal) |
| — | any terminal | any | anyone | **Never** (no statement matches a terminal status) | — |

**Exclusivity (precise, F-7):** the time predicates partition **statements by their start time**: T1–T3 can match only if they started before `fenceAt`, and T4 only if it started at or after `fenceAt`. That predicate is **not** what guarantees uniqueness, because a pre-fence T1 and a post-fence T4 can be in flight at the same moment. **Uniqueness comes from the row lock plus the status predicate:** every transition updates the same row and requires `status = 'accepted'`, the row lock serialises them, and under READ COMMITTED a waiting statement re-checks its `WHERE` clause against the committed row version after the lock is released. So **at most one terminal transition commits per row**, whatever the commit order (§7.7).

### 7.3 Replay, cancel, and completion around the fence

| Situation | Replay (same key) | History / single turn | Cancel | Late owner completion |
|---|---|---|---|---|
| Before the fence, owner alive | `409 duplicate_turn {status: accepted, turnId}` (provisional, "still processing") | `accepted` (provisional) | T3 → `cancelled` (held or released per §5) | T1 → `completed` |
| Before the fence, owner crashed | Same (provisional) until the fence | Same | T3 → `cancelled` (the held attempt resolves through NEM-021 reconciliation) | — |
| After the fence (owner possibly alive but past its own T_max) | T4 lazily → `interrupted` (terminal), unless a **pre-fence** owner or cancel statement holds the row, in which case T4 waits and returns that winner's terminal status | `interrupted` (or the pre-fence winner's status) | T4 lazily, then returns the terminal status | An owner T1 **started** at or after the fence → 0 rows → returns `interrupted`, no text. An owner T1 started before the fence may still win (§7.7) |
| After any terminal state | That terminal status (`200` for `completed` with the stored result) | Same | Returns the terminal status | Fenced (0 rows) |

### 7.4 No unintended duplicate paid turns

- **Same key:** the ledger attempt-key uniqueness means no second reservation or provider call (NEM-021, unchanged).
- **Different key while one is provisional:** the partial unique index means no second accepted turn, and its reservation is released (no charge).
- **Client rules (doc 14):**
  - the client **never** auto-resubmits with a new key;
  - while `accepted`, it polls the turn or replays with the same key;
  - a new key is used only after a **terminal** status **and** an explicit user action ("Preguntar de nuevo").
- **Ledger authority:** unchanged. E6 writes no ledger rows; held attempts (crash, cancel during the provider call) resolve through NEM-021 reconciliation.

### 7.5 Deterministic race tests (integration, real PostgreSQL)

**Determinism technique:** the fence decision is **time-predicate based, not order based**. Tests insert rows with an explicit `fenceAt` in the **past** (`now() - 1 s`) or the **future** (`now() + 1 h`), so outcomes do not depend on scheduling. Order-based races (T1 vs T3) use two connections synchronised by `pg_advisory_lock` barriers, and assert **exactly one** winner over **both** orders.

| # | Test | Expected (deterministic) |
|---|---|---|
| R1 | Completion before the fence, then sweep | `completed`; the sweep affects 0 rows |
| R2 | Fence passed: sweep, then the owner completion | `interrupted`; completion 0 rows; the owner's `run` result is `interrupted` with **no segments**; ledger rows written only by the Gateway |
| R3 | Fence passed: completion and finalize in parallel (both orders) | Always `interrupted`; completion always 0 rows |
| R4 | Fence in the future: completion and finalize in parallel (both orders) | Always `completed`; finalize always 0 rows |
| R5 | Fence in the future: cancel vs completion (barrier, both orders) | Exactly one of `cancelled` / `completed`. The loser reports the winner's status. If `cancelled` wins, the owner releases no text |
| R6 | Fence passed: cancel | Lazy finalize → `interrupted`; the cancel response is `interrupted` |
| R7 | Replay before the fence → `409 accepted`; replay after the fence → `interrupted`; then completion attempted | The sequence of observed statuses is `accepted, interrupted, interrupted`: **never** changes after the first terminal observation |
| R8 | Second turn with a different key while one is `accepted` (concurrent, barrier) | One `accepted` row; the other request is released at step 4 (ledger shows reservation + release, i.e. no charge) and gets `409 duplicate_turn` |
| R9 | Crash: no owner; reads before and after the fence | `accepted` before, `interrupted` after, via lazy finalize even if the sweep has not run |
| R10 | Final eligibility check fails before the fence | T2 → `failed`; release; `book_ineligible` |
| R11 | Account deletion during flight | Every T1–T4 affects 0 rows; nothing is resurrected |
| R12 | **Monotonicity property test:** seeded interleavings (≥ 200) of {T1, T2, T3, T4, read} with the fence in the past or future | Once any read observes a terminal status, every later read returns the same status; at most one terminal transition succeeds per row |

### 7.6 PostgreSQL time semantics under concurrent transactions and lock waits

- **Clock:** all fence predicates and `fenceAt` use **`statement_timestamp()`**. `now()` is the transaction-start time and would be stale inside a longer transaction.
- **Isolation:** each transition is its own single-statement transaction.
- **Lock waits:** a blocked statement keeps its statement-start timestamp. On lock release, READ COMMITTED re-evaluates the `WHERE` clause against the latest row version, so `status = 'accepted'` blocks any second terminal transition.
- **Decision instant:** the statement start. An owner write that started before the fence may commit just after it, and that is still a single final outcome (T4 either blocks behind it or finds the row terminal). Full guarantee: §7.7.
- **Bound:** the knowledge `statement_timeout` (5 s) bounds lock waits; grace (30 s) exceeds it.
- **Lock-wait tests LW-1 to LW-6** (mission §9.2 item 7a) add to R1–R12:
  - pre-fence T1 blocked past the fence;
  - T4 blocked behind T1;
  - T4 first, then a late T1;
  - T3 vs T1 under lock contention;
  - the `now()` transaction-start trap, plus an architecture test that every transition uses `statement_timestamp()` as its own statement;
  - a lazy reader blocked behind a writer.

### 7.7 Cutoff semantics and guarantees (F-7)

**Three distinct instants for every transition statement:**

| Instant | What it is | Role |
|---|---|---|
| **Statement start** (`statement_timestamp()`) | When the single-statement transaction begins executing | **Fence cutoff is evaluated here.** Stable for the whole statement, including any lock wait and the READ COMMITTED re-check |
| **Row update** | When the statement acquires the row lock and writes the new row version (possibly after waiting for another transaction's row lock) | **Ordering point:** the row lock serialises transitions; a waiter re-checks `status = 'accepted'` against the committed version |
| **Transaction commit** | When the single-statement transaction commits (immediately after the update, autocommit) | **Visibility point:** only now can any other transaction or reader observe the terminal status |

**Corrected cutoff rule:**
- **The fence restricts when a transition may be attempted, not when it may commit.**
- An owner or cancel transition whose statement **starts at or after `fenceAt`** never succeeds.
- One whose statement **starts before `fenceAt`** may update and commit after `fenceAt`, but only if it is the first terminal transition to commit for that row.
- **Bound:** such a late commit is limited by the knowledge `statement_timeout` (5 s) plus the lock-wait time behind another short single statement. `grace` (30 s) separates the owner's self-abort (T_max) from the fence, so in normal operation owner statements start well before it.

**Guarantees (and the mechanism behind each):**

| # | Guarantee | Mechanism |
|---|---|---|
| G1 | At most one terminal transition commits per row | Same-row update + `status = 'accepted'` predicate + row lock + READ COMMITTED re-check after the lock wait |
| G2 | **A terminal outcome, once observable, never changes** | A terminal status becomes observable only after its transaction commits. Every later transition requires `status = 'accepted'` and therefore affects 0 rows |
| G3 | **No status read returns `accepted` once its finalization statement started at or after the fence** | Every status-returning read (replay, history, single turn, cancel) first runs T4 as its own statement. If a pre-fence transition holds the row, T4 waits for that commit and then finds the row terminal (0 rows); otherwise T4 finalizes. The status is read only after T4 returns, and no non-finalizing status read is exposed by the API |
| G4 | A status read never returns `interrupted` before the fence | T4 cannot match a statement started before `fenceAt` |
| G5 | **A late owner cannot change an observed outcome or release an answer after losing** | The owner releases answer text **only after its own T1 returned 1 row and the commit was confirmed**. 0 rows → re-read and return that terminal status, with no text. An ambiguous outcome (error after sending the commit, e.g. a dropped connection) → re-read by `id`: release text only if the row is `completed` **with this request's `attemptToken`**; otherwise return the stored status with no text |
| G6 | No owner write that *starts* after the fence succeeds | `statement_timestamp() < fenceAt` is false for every statement started at or after `fenceAt` |

**What is not guaranteed:** that no write *commits* after `fenceAt`. A pre-fence transition can, and the race tests below prove this is safe.

**Additional lock-wait tests** (mission §9.2 item 7a, extending LW-1 to LW-6):

| # | Scenario | Expected |
|---|---|---|
| LW-1 (sharpened) | T1 **starts** before the fence and blocks on a held row lock until after the fence | T1 commits `completed`. The test records `statement_timestamp()` of T1 < `fenceAt` **and** a commit `clock_timestamp()` > `fenceAt`, proving the commit-after-fence case explicitly. A later T4 affects 0 rows; no read observed `interrupted` |
| LW-7 | A frozen owner: T1 **starts after** the fence with no competing transaction (row still `accepted`) | 0 rows (fence predicate); the owner returns `interrupted` after its lazy T4; no text |
| LW-8 | T1 and T4 issued so that T4 **acquires the row lock first** while T1 (started before the fence) waits | T4 commits `interrupted` first; T1 re-checks, finds `status <> 'accepted'`, 0 rows; the owner releases no text (G2, G5) |
| LW-9 | Ambiguous commit: a fault injected after T1's commit is sent (unit level with an injected driver error; integration level by terminating the owner's backend between the update and the client acknowledgement where feasible) | The owner re-reads: if `completed` with its `attemptToken` → text released once; otherwise the stored status, no text |
| LW-10 | A reader's T4 issued after the fence while a pre-fence T3 (cancel) holds the row | The reader waits and returns `cancelled`; never `accepted` (G3) |

## 8. Implementation sequence — independently reviewable checkpoints

Each checkpoint ends with tests green and a PA review before the next starts.

| Checkpoint | Content | Review evidence |
|---|---|---|
| **A — Turn wiring + record** | A1–A4, A6–A8; retrieval in step 2; context budget; `ai_turns` with `attemptToken`, `fenceAt`, and the one-provisional-turn-per-session index; durable completion; duplicate table; replay; **final eligibility check (§6)**; additive `TurnResult` fields; non-streaming route | Existing suites unchanged; barrier duplicates; completion failure; final-check failure (release, no charge); ordering test; deletion cascade; migration up/down |
| **B — Resilience** | Explicit cancel (§5) with fenced conditional updates; fenced finalization (sweep + lazy reads) and the one-in-flight-per-session index (§7); history and single-turn routes with D-10 re-materialization; W guard; stage metrics | §5 rows; §7.5 tests R1–R12; history redaction; guard before reservation |
| **C — Transport + probe** | SSE stream route (per-attempt Gateway events + content-free `stage`); `GET /knowledge/sessions/capabilities`; `X-Accel-Buffering: no` | No text before the validated `segment`; stream close ≠ cancel; the probe denies by default |
| **D — Minimal web Q&A (required, D-1 a)** | `/research/[sessionId]` per doc 14 and mission §5.1 | Jest component tests; one Playwright flow on the simulated stack; i18n parity; accessibility; reader suites unchanged |
| **E — Verification and report** | **Reader-latency acceptance (§4: ≤ 50 ms p95 delta, W reduction 10 → 6 → 3 if needed)**; E-1 latency tables (3 and 10 books); E-2 coverage; completion report | Raw outputs; accepted W; escalation if W < 10 (Q-11) |

## 9. Responses to the PA review of `ccb3acc` (F-1 to F-5)

| ID | Finding | Correction | Where |
|---|---|---|---|
| F-1 | Superseded D-1 text implied both options were open; the probe route was not standardized | D-1 is recorded as approved (a) everywhere; revision-2 text is marked superseded. The probe is **`GET /knowledge/sessions/capabilities` in `SessionsController`** (declared before `:id`) in the mission, packet, package, report, and doc 14. Q-1 is closed | Mission §5 item 8; packet D-1 and D-3; §1 A5; doc 14 §2.2; report §7, §8, §11 |
| F-2 | `unrecorded` was presented as preventing an unseen charge | D-8 (a) stays proposed, with an explicit statement that delivery is **best effort** and that a lost response plus a failed record means an unseen charge. The network-failure cases are distinguished | §2; mission §9.2; packet D-8 |
| F-3 | Revocation between step 2 and invoke was accepted as a residual | **Final eligibility check** after the lock commit and immediately before invoke. User-level rights and book-level index permission are checked separately and fresh. On failure: `gateway.release` (held if not writable), `failed`, `book_ineligible`, lock stands. Gateway and ledger are unchanged | §6; mission §9.4; doc 13 |
| F-4 | W=10 was presented as the value | W=10 is a **candidate**. Acceptance is reader p95 delta ≤ 50 ms under sustained load vs idle on the production image; reduce 10 → 6 → 3 and retest; W < 10 is escalated as a product conflict | §4; mission §9.5; packet D-11 |
| F-5 | An age-only sweep could interrupt a live turn | *Revised for F-6 and F-7:* finalization only by statements started at or after a database-time **fence**; owner statements started after it never succeed; seven race tests, now replaced by R1–R12 plus LW-1 to LW-10 | §7; mission §9.2 items 7–8 |
| **F-7** | The text claimed no owner write could commit after `fenceAt`, but `statement_timestamp()` is the statement start | The cutoff is redefined as **statement start**. Statement start, row update, and commit are distinguished; guarantees G1–G6 with mechanisms; late-commit and late-owner cases proven by LW-1 (sharpened) and LW-7 to LW-10. No redesign | §7.1, §7.2, §7.3, §7.7; mission §9.2 items 7, 7a |
| **F-6** | `interrupted → completed` contradicted a terminal state clients may already have seen | **`interrupted` is terminal; no terminal state ever changes.** The lease is replaced by `fenceAt` (DB time). All owner and cancel writes are fenced (`statement_timestamp() < fenceAt`); finalization requires `statement_timestamp() >= fenceAt` (partitioning statements by start time); uniqueness of the terminal transition comes from the row lock plus the status predicate (F-7, §7.7). Lazy finalization in every read means no client sees `accepted` after the fence or `interrupted` before it. A fenced owner releases no text. A partial unique index allows one provisional turn per session (no unintended duplicate paid turns). Twelve deterministic race tests (§7.5). No new table or service | §7; mission §9.2–§9.3; packet; docs 13, 14 |

## 10. Remaining questions for PA judgement

| ID | Question | Proposed answer |
|---|---|---|
| ~~Q-1~~ | ~~Probe location~~ | **Closed by F-1:** `GET /knowledge/sessions/capabilities` in `SessionsController` |
| ~~Q-2~~ | ~~Accept the revocation residual~~ | **Superseded by F-3** (final eligibility check) |
| ~~Q-3~~ | ~~Reader threshold~~ | **Closed: approved by the PO (PO-034 D-11):** ≤ 50 ms p95 delta |
| Q-4 | New `DenialReason` codes vs reusing existing codes + a status payload | Reuse (`duplicate_turn`, `turn_failed`, `book_ineligible` + payload) |
| Q-5 | History re-materialization shares W with turns? | Share |
| ~~Q-6~~ | ~~D-8 policy~~ | **Closed: D-8(a) approved (PO-034)** |
| Q-7 | Lock after a cancel or final-check failure between lock and invoke: keep vs roll back | Keep (the lock transaction committed) |
| ~~Q-8~~ | ~~D-10 policy~~ | **Closed: D-10(a) approved (PO-034)** |
| Q-9 | Context budget default (6,000 passage tokens) for the simulator phase | Accept as engineering configuration |
| Q-10 | Entry point: URL-only vs one book-page button | URL-only for the dark build |
| **Q-11** *(new)* | If the reader test passes only at W < 10, how should 10-book (NoetiaX) turns be handled? Options: (a) escalate to the PO (product conflict with PO-027) and leave NoetiaX turns unadmitted in the dark build; (b) allow a single over-weight turn only when nothing else is in flight (likely breaks the 50 ms criterion); (c) separate approval of an out-of-scope remedy | (a). Not decided by engineering |
| **Q-12** | Fence parameters: T_max derived from the configuration (provider timeout × attempts + retry delays + completion-write budget) and `grace` = 30 s; sweep every 60 s | Accept as engineering configuration; verified by R1–R12. With today's defaults (30 s provider timeout, 1 attempt), crash finalization takes ≈ 60–75 s |
| ~~Q-13~~ | ~~`interrupted → completed` overwrite~~ | **Closed by F-6:** `interrupted` is terminal; no overwrite |
| ~~Q-14~~ | ~~One provisional turn per session~~ | **Closed: approved by the PO (PO-034)** |

**STOP for independent Product Architecture re-review.** No implementation, merge, or deployment.
