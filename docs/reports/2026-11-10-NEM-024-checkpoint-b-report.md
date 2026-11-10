# NEM-024 — Checkpoint B Report (cancellation, recovery, history, guard)

**Status:** **ACCEPTED FOR DEVELOPMENT PROGRESSION — [PO-038](../operating-framework/decisions/product-owner/PO-038-nem-024-checkpoint-b-formal-acceptance.md) (2026-11-10, reviewed `a127c89`).** Exceptions preserved (PO-038). C–E not authorized; not merged, not deployed.
**Authorization:** [PO-036](../operating-framework/decisions/product-owner/PO-036-nem-024-checkpoint-a-conditional-acceptance-and-checkpoint-b-authorization.md): Checkpoint A accepted conditionally; Checkpoint B authorized with a **mandatory release condition** (stranded `accepted` turns recovered and verified before any user-facing release).
**Delivery state:** Branch `feat/nem-024-checkpoint-b` (stacked on PR #55) · Draft PR (see §1) · not merged · not deployed · simulated provider only · no user-facing functionality activated.

## 1. Commits

| Step | Commit |
|---|---|
| PO-036 record; mission and register | `75a68fa` |
| **Checkpoint B implementation and tests** | **`56dfe61`** |
| This report | see the PR head |

## 2. Files and architectural surfaces

| File | Change | Surface |
|---|---|---|
| `src/knowledge/sessions/turn-record.store.ts` | Additive | **T3** `cancel` (`status = 'accepted' AND statement_timestamp() < "fenceAt"`); **T4** `finalize(ids)` and `sweep(limit)` (`status = 'accepted' AND statement_timestamp() >= "fenceAt"`); history listing and single-row lookup scoped to the session. Each transition is one CTE-wrapped statement in its own transaction |
| `src/knowledge/sessions/turn-cancel.registry.ts` | **New** | In-process `Map<serverTurnKey, AbortController>` (server keys are namespaced by user + session) |
| `src/knowledge/sessions/turn-guard.ts` | **New** | Weighted guard, Σ books with in-flight S2 work ≤ W; candidate W = 10 via `INTELLIGENCE_TURN_WEIGHT_LIMIT` (the 10 → 6 → 3 evaluation) |
| `src/knowledge/sessions/turn-recovery.job.ts` | **New** | `@Interval('intelligence-turn-recovery', 60_000)` sweep; non-overlapping; counts-only logging; no ledger access |
| `src/knowledge/sessions/turn-metrics.service.ts` | **New** | Stage histogram; finalized{via}, cancelled, guard rejections, unrecorded, fenced; fixed labels only |
| `src/knowledge/sessions/turn.service.ts` | Additive | Lazy T4 on replay; cancel registration and boundary checks; guard around retrieval (before reservation); `cancel()`, `history()`, `turnView()` with D-10 re-materialization; new optional trailing dependencies (S2 reader token, guard, registry, metrics) |
| `src/knowledge/sessions/turn-status.error.ts` | Additive | `retryAfterSeconds`, `guard` in the status payload |
| `src/knowledge/sessions/sessions.dto.ts` | Additive | `CancelTurnDto { idempotencyKey }` |
| `src/knowledge/sessions/sessions.controller.ts` | Additive | `GET :id/turns` (history), `GET :id/turns/:turnId`, `POST :id/turns/cancel`, all in the existing controller with declared capabilities (`history`, `history`, `use`) |
| `src/knowledge/knowledge.module.ts` | Additive | Registry, metrics, recovery job, guard factory, `TURN_BOOK_TEXT → useExisting StorageBookText` |
| Tests | New / extended | Unit: `turn-guard`, `turn-cancel.registry`, `turn-recovery.job`, `turn-metrics.service`, `turn.service.checkpoint-b` (24), store (+3). Integration: **`turn-recovery.int-spec.ts` (32)**; harness `turn-env.ts` extended. The Checkpoint A spec mock gained `finalize`/`cancel` (lazy finalization now runs on replay) |

**No protected test or accepted contract changed.** The B-1 allow-list, NEM-019 single-controller and capability rules, NEM-021/NEM-022 boundaries, bindings, Gateway, ledger, contract v1, Context Builder, `MODEL_PATHS`, E5 classes, `fragments`, `sync_maps`, and `app.module.ts` are all unchanged; every architecture suite passes.

## 3. Recovery design and proof (release condition)

| Requirement | Design | Proof (real PostgreSQL) |
|---|---|---|
| **A** Interrupted completion recovers independently of the owner | A row stranded in `accepted` (both completion writes failed, D-8) is finalized as `interrupted` by the sweep once its fence passes; no owner process is involved | "A + C (scheduled)": a real stranded turn stays `accepted` before its fence; after the fence the sweep makes it `interrupted`; replay then returns `interrupted` |
| **B** Database-fenced finalization | T1/T2/T3 require `statement_timestamp() < "fenceAt"`; T4 requires `>=`; all require `status = 'accepted'`; row lock + READ COMMITTED re-check guarantee one terminal commit; terminal states are never overwritten; a late owner releases no text | R2, R3, R4, R5, LW-2–LW-6, LW-10, R12 (below) |
| **C** Scheduled **and** lazy | `TurnRecoveryJobService` sweep; lazy T4 in **replay, history, single-turn, cancel** before any status is returned | "C (lazy)" × 4 routes: each finalizes an expired stranded turn **without** the sweep and reports `interrupted`; R9 (crash, no owner): `accepted` before the fence, `interrupted` after, via a read alone |
| **D** Billing separation | Recovery never reserves, invokes a provider, or touches ledger tables | Total `ai_budget_ledger` + `ai_usage_events` row count unchanged across sweep and lazy finalization; the stranded turn's ledger stays `reservation`, `settlement` (the **D-8 residual is preserved**: charged, answer only best-effort delivered) |
| **E** Concurrency evidence | Real PostgreSQL; no mocked substitutes | §4 |

## 4. Race tests (real PostgreSQL)

| Test | Result |
|---|---|
| R1 completion before the fence, then finalize → `completed`; finalize 0 rows | ✓ |
| R2 owner loses to finalization during the provider call → T1 0 rows → `interrupted`, **no answer text**; settlement stands | ✓ |
| R3 fence passed: completion ∥ finalize, both orders → always `interrupted` | ✓ ×2 |
| R4 fence future: completion ∥ finalize, both orders → always `completed` | ✓ ×2 |
| R5 cancel vs completion under a held row lock, both issue orders → exactly one winner | ✓ ×2 |
| R6 cancel after the fence → lazy finalize → `interrupted` | ✓ |
| R7 observed statuses `accepted → interrupted → interrupted` (a completion attempt after the fence changes nothing) | ✓ |
| R9 crash: read-only recovery at the fence | ✓ |
| **R12 monotonicity property:** 200 seeded interleavings of {T1, T2, T3, T4, read}, fence past or future → at most one terminal transition per row; once observed, the terminal status never changes; future-fence rows never `interrupted` | ✓ |
| R8, R10, R11 (second key while provisional; final-check failure; deletion) | ✓ in the Checkpoint A suite (unchanged, passing) |
| **LW-1, LW-7, LW-8** | ✓ in the Checkpoint A suite |
| **LW-2** pre-fence T1 holds the row across the fence; a post-fence T4 blocks, then 0 rows | ✓ |
| **LW-3** T4 committed after the fence; a later T1 → 0 rows | ✓ |
| **LW-4** T3 ∥ T1 under row-lock contention, both orders → exactly one | ✓ |
| **LW-5** transaction-start trap: inside a transaction opened before the fence, `now() < fenceAt` is still true while `statement_timestamp() < fenceAt` is false (plus a source guard: every transition uses `statement_timestamp()`, never `now()`) | ✓ |
| **LW-6 / LW-10** a lazy reader started after the fence waits behind an in-flight pre-fence T1 / T3 and returns `completed` / `cancelled`, never `accepted` | ✓ ×2 |
| LW-9 (ambiguous commit) | Unit-level evidence (Checkpoint A, G5 re-read); not reproduced in integration (requires killing a backend between commit and acknowledgement) |

## 5. Cancellation (real ledger)

| Stage | Result |
|---|---|
| Before reservation | Cancel → `cancel_requested`; the owner stops; **no ledger rows, no record** |
| After reservation, before the lock | Observed at the lock (N-B1): record `cancelled`, ledger `reservation` → `release` (no charge) |
| After the lock, before the provider | Endpoint T3 `cancelled`; owner releases; **no provider call**; ledger `reservation` → `release` |
| During the provider attempt (provider streaming) | Abort → `client_abort`; **ledger never shows a release** (held for NEM-021 reconciliation); record `cancelled` |
| After settlement | `completed`; repeated cancel idempotent |
| Disconnect | No transport path reaches the registry; the HTTP route passes no request-abort signal (D-9 a) |

Unit: owner T3 losing to finalization reports the stored status; registry entries are always removed; a cancel for another user's session → `not_found`.

## 6. Rights redaction (D-10) and authorization

- One completed turn was read repeatedly while the source was changed. Each citation went: **available** (the excerpt exactly equals `codePointSlice(source, start, end)`) → **revoked** (user rights revoked) → **revoked** (indexing permission withdrawn) → **available** (restored) → **stale** (text version replaced) → **unavailable** (object missing).
- The generated answer text was unchanged throughout. TT-14 is not resolved: answer text is kept, and only excerpts are hidden.
- A revoked excerpt is never returned.
- Re-validation checks **user-level** `RightsService.eligibility` **and** **book-level** `IndexingPermission.check`; the hash must match the current version, and the object bytes must hash to it.
- Authorization: another user's `history`, `turnView`, and `cancel` → `not_found`.

## 7. Concurrency guard and resource impact

- **Behaviour (real PostgreSQL):** a turn heavier than W is refused before reservation (`budget_unavailable`, `guard: exceeds_limit`, no ledger rows). A second concurrent turn over W is refused (`over_limit`) with no reservation or record; the first completes; capacity is released, and the refused user's next turn completes. History excerpt re-materialization shares W and degrades to `sourceState: 'deferred'` instead of failing.
- **Resource basis:** the E6 discovery measurement on the production image under 1 vCPU / 512 MB (idle 73–102 MiB; ~40 MB and ~85 ms event-loop lag p99 per in-flight 10-book retrieval).
- **W = 10 remains a candidate.** The reader p95 ≤ 50 ms qualification and the 10 → 6 → 3 evaluation are **Checkpoint E** (not authorized). If only W < 10 passes, 10-book turns could not be admitted (Q-11, product escalation).

## 8. Regression (fresh disposable `postgres:16-alpine` + `redis:7-alpine`, removed afterwards)

| Suite | Result |
|---|---|
| **All integration suites** (NEM-019, NEM-021, NEM-022, NEM-023, NEM-024 A and B) | **11 passed, 1 skipped (opt-in performance); 196/196** |
| Checkpoint B integration | **32/32** |
| Full API unit suite (`npx jest --maxWorkers=2 --coverage`) | **134 suites, 1,902/1,902** |
| Coverage | `knowledge/sessions` 98.86% statements / **87.9% branches** / 100% functions / 99.6% lines. **Global branches 79.77%**: E-2 open (80% gate), improved from 79.49% |
| Typecheck (source and tests) | 0 errors |
| ESLint (`src/knowledge/sessions`, module) | 0 problems |

## 9. Deviations and notes for review

| ID | Note |
|---|---|
| **N-B1** | A cancel arriving **after reservation but before the lock** is observed at the first post-lock boundary. The turn is recorded `cancelled` with its reservation **released**, and the **session lock stands**. The matrix said "no lock, no record", but a pre-lock abort would leave no record, so a same-key replay would answer `pending` forever (the B-2 gap). PA judgement requested |
| **N-B2** | If the abort reaches the Gateway **before** the provider call starts, the accepted Gateway releases the never-sent attempt (no charge). "Held at the reserved amount" applies only once the provider attempt is in flight. Behaviour of accepted NEM-022 code, observed in testing |
| **N-B3** | History re-materialization reads object bytes through a DI token (`TURN_BOOK_TEXT`) typed with `BookTextPort` from `retrieval.types` (allowed by the B-1 allow-list); the module (allow-listed) binds it to the existing `StorageBookText`. `TurnService` imports no other retrieval internals; code-point slicing is a local helper. PA confirmation requested that this is within the B-1 intent |
| N-B4 | Guard refusal on a turn → `503 budget_unavailable` with `retryAfterSeconds` in the body (no `Retry-After` header). On history → excerpts `deferred` (reads never fail for capacity) |
| N-B5 | The cancel registry is in-process (single API instance). T3 itself is database-only, so a cancel records correctly even when the owner is gone; aborting a live owner on another instance would need a shared channel (launch item) |
| N-B6 | Lazy finalization re-reads after T4, so a status that changed concurrently is never reported stale (G3) |

## 10. Remaining exceptions and risks

- **E-1:** retrieval p95 594 ms vs 150 ms. Not waived.
- **E-2:** global branch coverage 79.77% vs 80%. Not waived.
- NEM-022's coverage shortfall remains open.
- Q-11 remains possible at Checkpoint E.
- TT-14 is unresolved.

## 11. Confirmation

- **Not done:** no merge, no deployment, no production activation, no production or paid provider, no infrastructure or CI/CD change, no user-facing functionality.
- **Untouched:** Checkpoints **C, D, and E** (no SSE, no capability probe, no web UI, no performance qualification).

**STOP after Checkpoint B, for independent Product Architecture review.**

---

## 12. Targeted PA verification (review of `c9e1e5e`): F-1 to F-4

### F-1 — History citation mapping: **defect found and fixed** (fix commit `5689f46`)

- **Finding:** in `toViews`, `parsed` is a `Map` keyed by `turnId | ref | anchor`. A citation repeated **within one turn** (in two segments, or twice in one segment) was therefore **deduplicated**, so `sliced[book]` held one excerpt per unique key. The view loop, however, advanced the per-book `cursor` once per **occurrence**. After a repeated citation, every later citation of the same book in the page received its **neighbour's excerpt**. Distinct ranges, interleaved books, stale citations, and identical anchors in *different* turns were correct only because their keys were unique; the shift appeared whenever a repeat existed earlier in the page.
- **Proof before the fix:** the two new repeated-citation unit tests failed exactly as predicted; the three unique-key tests passed.
- **Fix (mapping only):** excerpts are stored in `excerptByKey` and looked up by each citation's own key. The occurrence cursor is removed. No other behaviour changed.
- **Deterministic tests:**
  - **Unit** (`turn.service.checkpoint-b.spec.ts`, "F-1", 5):
    - repeated identical citations within and across segments, followed by a distinct range;
    - distinct ranges of one book out of order, interleaved with a second book and a stale citation (the stale one does not shift later excerpts);
    - identical anchors in two completed turns, with a repeat in the newer turn;
    - the same ref with two different anchors;
    - one object fetch per book per page.

    The fixtures include an astral character, so code-point and UTF-16 offsets differ.
  - **Integration** (real PostgreSQL + S2 store): two completed turns with repeated citations, an identical anchor across turns, and interleaved books. Every excerpt equals `codePointSlice(source, start, end)`.
- **Results:** unit spec 29/29 · Checkpoint B integration 33/33.

### F-2 — Cancellation boundary N-B1: reconciliation and **proposed Amendment 2** (not applied)

**Approved matrix (mission §9.3):** "after reservation, before the lock commits → `gateway.release`; lock: none; record: none".

**Implemented:** an abort arriving in that window is observed at the first post-lock boundary. The lock transaction has committed (session lock, `turnCount + 1`, a T0 record), so the owner releases the attempt through the Gateway and commits T3 → `cancelled`.

| Concern | Why the implemented behaviour is safe | Residual |
|---|---|---|
| **Idempotency** | The `cancelled` row holds the turn key (UNIQUE), so a same-key replay returns `cancelled`. The ledger's attempt-key uniqueness prevents any second reservation or provider call | None |
| **Charging** | The never-sent attempt is released through the Gateway (reported `released`, or `unconfirmed` → held for NEM-021 reconciliation). No provider call, no settlement | None |
| **Turn accounting** | `turnCount` and `turnIndex` count *accepted* turns (ADR-006 lock semantics). They are never billing inputs (billing is ledger-only). History shows an accepted-then-cancelled turn honestly | The count includes a turn that produced no answer |
| **User expectation** | Cancelling is an explicit action on a turn the user started | **The book set becomes locked by a turn that produced no answer.** Changing books then requires a fork (ADR-006) |

**Mismatch with the approved matrix:** lock and record exist where the matrix says none. Taking the matrix literally (abort before the lock, no record) would leave a same-key replay answering `pending` indefinitely, the same gap B-2 closed for step-4 failures. That is why it was not implemented literally.

**Proposed Amendment 2 (for PO decision; a contract change, not applied):**

| Option | Behaviour | Change needed |
|---|---|---|
| **A** | Amend the matrix row to the implemented behaviour: lock stands, `turnCount + 1`, record `cancelled`, reservation released | Specification only; no code |
| **B (recommended)** | Matrix-faithful: check the cancel signal **inside the step-4 lock transaction before taking the lock**. On abort, the transaction rolls back (**no lock, no turn count**), the Gateway releases, and a terminal **`cancelled`** record is written by the B-2 idempotent mechanism (`turnIndex` NULL, observed `reservationRelease`), so replay returns `cancelled` | **Extends the B-2 exception** from terminal `failed` records to terminal `cancelled` records: a new exception, **PO approval required**. Small code change plus tests |
| C | Literal matrix (no lock, no record) | Rejected: replay would return `pending` indefinitely |

**Until decided:** the code stays as implemented (Option A behaviour), and the deviation is recorded here and in the mission (§9.3 note).

### F-3 — History reader boundary N-B3: **confirmed within the B-1 intent**

- **B-1 intent:**
  - E5 is wired only at two approved points (the module registers providers; `TurnService` consumes the facade);
  - `TurnService` never reaches the indexer, the ranking service, or the raw `RetrievalPort`;
  - bindings are unchanged.
- **Implementation:**
  - `TURN_BOOK_TEXT` is defined in `turn.service.ts`, typed `BookTextPort` (from `retrieval.types`, on the B-1 allow-list), and bound in the module as `{ provide: TURN_BOOK_TEXT, useExisting: StorageBookText }`. It is an alias of the existing E5 S2 adapter provider: no new reader, no new import path.
  - `TurnService` calls only `read(key)`, and only after re-validating user rights and index permission. Code-point slicing is a local helper, not an import of E5 internals.
- **Architecture-test evidence (all passing):**
  - **NEM-023 B-1 test (unchanged):** importers of `retrieval/` are only `knowledge.module.ts` and `turn.service.ts`, by exact allow-listed paths; `TurnService` names no `BookIndexer` / `LexicalRetrievalService` / `RetrievalPort`; the module registers no indexer; bindings `CONTEXT_SOURCE_PORT → EmptyContextSource` and `TEXT_IDENTITY_PORT → UnboundTextIdentityPort` are pinned.
  - **New NEM-024 test `tests/unit/knowledge/sessions/turn-architecture.spec.ts` (5, additive):**
    - `TURN_BOOK_TEXT` is referenced only by `turn.service.ts` and `knowledge.module.ts`;
    - the binding is exactly `useExisting: StorageBookText`;
    - `TurnService` imports `BookTextPort, decodeUtf8` from `retrieval.types` and nothing from storage, SDK, or MinIO;
    - the reader is used only via `.read`, after `rights.eligibility` and `indexPermission.check`;
    - no other `sessions/` file imports `retrieval/`.
  - NEM-019 `architecture.spec.ts` (unchanged): pass.
  - Combined run: **33/33**.

### F-4 — Multi-instance limitation N-B5: **consistent with the approved deployment; documented**

**Approved deployment assumption (verified):**
- `docker-compose.server.yml` defines **one** `api` service, with no `replicas` and no `scale`.
- `KNOWLEDGE_MODULE_ENABLED` is set in **no** compose file or env example, so the module is **off by default** (NEM-019 §5.6), and no production activation is authorized.
- Staging is likewise a single colocated stack.

**Limitation (documented, no infrastructure added):**
- The abort signal reaches the owner only when the cancel request lands on the **same process**.
- The **T3 transition is database-only**, so the `cancelled` outcome, idempotency, and terminal consistency hold on any instance.
- On a different instance, the in-flight provider call is **not interrupted**. The owner's later T1 loses, so no text is released, but the provider attempt runs to completion and is **settled (charged)**, so a cancel would not save cost.

**Condition recorded (launch item):** before the API is scaled beyond one instance with the knowledge module enabled, a shared cancellation channel must be designed and approved separately. Recovery (sweep, lazy finalization) is already multi-instance safe, because all transitions are single conditional statements.

### 12.1 Regression after F-1 (fresh disposable `postgres:16-alpine` + `redis:7-alpine`, removed afterwards)

| Suite | Result |
|---|---|
| All integration suites | **11 passed, 1 skipped (opt-in performance); 197/197** |
| Full API unit suite | **135 suites, 1,912/1,912** |
| Coverage | `knowledge/sessions` 98.86% statements / **89.14% branches**; **global branches 79.95%** (E-2 open, improved from 79.77%) |
| Typecheck (source, tests) · ESLint | 0 errors · 0 problems |

### 12.2 Disposition

| ID | Disposition |
|---|---|
| F-1 | **Defect confirmed and fixed** (mapping only); deterministic unit and real-PostgreSQL evidence |
| F-2 | **Reconciled**; deviation documented with a safety analysis; **Amendment 2 proposed** (Option B recommended; extends the B-2 exception, so PO approval is required). Behaviour unchanged until decided |
| F-3 | **Confirmed** within the B-1 intent; architecture evidence, unchanged B-1 test plus an additive NEM-024 test |
| F-4 | **Confirmed** consistent with the single-instance, flag-off deployment; limitation and launch condition documented; no infrastructure added |

No Checkpoint C, D, or E work; no merge; no deployment; no production activation; no new protected-contract exception applied.

**STOP for final independent Checkpoint B review.**

---

## 13. Amendment 2 (PO-037, Option B): cancellation before lock commit

### 13.1 Commits and files

| Commit | Content |
|---|---|
| `99f5d5c` | Implementation and tests |
| see the PR head | PO-037 record, mission Amendment 2, this section |

| File | Change |
|---|---|
| `src/knowledge/sessions/turn.service.ts` | Sentinel `CancelledBeforeLockCommit`; synchronous `signal.aborted` check as the **last action inside** the step-4 transaction; `cancelled` lock outcome routed to `step4Failure(…, 'cancelled')`; replay of a `cancelled` record includes its release outcome |
| `src/knowledge/sessions/turn-record.store.ts` | `recordStep4Failure` accepts `status: 'failed' \| 'cancelled'` (validated; default `failed`); the reason is NULL for `cancelled` |
| `tests/unit/knowledge/sessions/turn.service.checkpoint-b.spec.ts` | +4 (in-transaction abort, release failure, record failure, replay) |
| `tests/unit/knowledge/sessions/turn-record.store.spec.ts` | +1 (cancelled record; status validation); existing assertions updated for the explicit `status` |
| `tests/unit/knowledge/sessions/turn.service.question.spec.ts` | One assertion updated (the explicit `status: 'failed'` argument) |
| `tests/integration/knowledge/turn-recovery.int-spec.ts` | The N-B1 test replaced by Amendment 2 behaviour; +4 integration tests; post-lock assertions added |
| `docs/operating-framework/decisions/product-owner/PO-037-…md`, mission | Decision record; Amendment 2 in the mission (§9.2 item 1a, §9.3 row and boundary note) |

### 13.2 Race resolution

- **Single decision point:** a synchronous `signal.aborted` check **inside** the step-4 transaction, after `lockOwned` (`FOR UPDATE`), the set check, `turnCount + 1`, and the T0 insert, immediately before the transaction function returns (COMMIT).
- **Abort seen there:** the sentinel is thrown, and PostgreSQL rolls back the session lock, the turn count, and the provisional row **atomically**; none were ever visible to other transactions. Then the Gateway release runs, then the idempotent terminal `cancelled` record (`ON CONFLICT DO NOTHING`; `turnIndex` NULL; `reservationRelease` = `released` only if the Gateway call completed, else `unconfirmed`). There is no provider call, and the ledger is untouched by E6.
- **Abort arriving after that check:** the transaction is already committing, so the turn is accepted and the **existing post-lock semantics** apply (owner release + T3, or endpoint T3). Lock and count stand; nothing is retroactively unlocked.
- **No third state:** the check is synchronous and the commit is a single transaction outcome, so every cancel resolves to one of the two branches.
- **Concurrent endpoint:** while the transaction is uncommitted, the provisional row is invisible to the cancel endpoint, so it returns `cancel_requested` and only signals; the owner makes the decision. Once committed, the endpoint can commit T3 itself (fenced, conditional); the owner's later T3 then affects 0 rows and reports the stored status.
- **Constraints preserved:**
  - UNIQUE (`sessionId`, `keyHash`) gives one record per key;
  - the one-provisional-turn index is unaffected (`cancelled` is not `accepted`);
  - the fence semantics are unchanged (the record is terminal at insert);
  - terminal monotonicity is unchanged.

### 13.3 PostgreSQL evidence (real database)

| Test | Result |
|---|---|
| After reservation, before the lock → `lockedAt` NULL, `bookSetHash` NULL, `turnCount` 0; record `cancelled` / `turnIndex` NULL / `released`; ledger `reservation`, `release`; replay → `cancelled`; 2 repeated cancels → `cancelled`; no new reservation, **no provider call**; the session then accepts a new question normally (count → 1) | ✓ |
| **Cancel while the lock transaction executes** (the owner blocked on the session row held `FOR UPDATE` by another connection, confirmed through `pg_stat_activity`; cancel → `cancel_requested`; lock released) → transaction rolled back; no lock; count 0; `cancelled` NULL index; ledger `reservation`, `release` | ✓ |
| Release failure → `unconfirmed` recorded and reported; ledger `reservation` only (held; no release claimed) | ✓ |
| Terminal-record persistence failure → `recorded: false`; released first (no charge); no lock; replay → `409 pending` (the documented B-2-class residual) | ✓ |
| After lock commit (post-lock) → lock stands; `turnCount` 1; record `cancelled` with `turnIndex` 1; released; no provider call | ✓ |
| **Race property:** 25 seeded cancel-vs-lock-commit timings. Each outcome is exactly one of: (no row, no lock); (no lock, count 0, `cancelled` NULL index, `reservation`/`release`); or (locked, count 1, index 1, terminal `cancelled`/`completed`). Never more than one reservation or provider call | ✓ |
| Before reservation; during the provider attempt; after settlement (unchanged) | ✓ |

Unit (deterministic): in-transaction abort (sentinel → rollback, Gateway release, `cancelled` record with `reason: null`, no provider call, no post-lock T3), release failure → `unconfirmed`, record failure → `recorded: false`, replay of the `cancelled` record (no Gateway call): **33/33** in the Checkpoint B spec.

### 13.4 Regression (fresh disposable `postgres:16-alpine` + `redis:7-alpine`, removed afterwards)

| Suite | Result |
|---|---|
| All integration suites (NEM-019, 021, 022, 023, 024 A and B) | **11 passed, 1 skipped (opt-in performance); 201/201** (R1–R12 and LW-1 to LW-10 coverage unchanged and passing) |
| Full API unit suite | **135 suites, 1,917/1,917** |
| Coverage | `knowledge/sessions` 98.87% / **89.52% branches**. **Global: 94.34% statements / 80.07% branches / 92.57% functions / 95.47% lines.** The 80% gate is met on this branch stack for the first time. *E-2 is not declared resolved:* closing it needs a separate decision based on this evidence |
| Typecheck (source, tests) · ESLint | 0 errors · 0 problems |

### 13.5 Remaining exceptions and risks

- **E-1:** retrieval p95, not waived.
- **E-2:** coverage evidence now at 80.07%; open pending decision.
- NEM-022's coverage shortfall is a separate record; open.
- **Residual:** if the terminal `cancelled` record cannot be written, a same-key replay answers `pending` (the same class as B-2; no charge, since the release ran first).
- Single-instance cancel signalling (N-B5).
- Q-11 is possible at Checkpoint E.
- TT-14 is open.

### 13.6 Authorization boundaries

- **Only** Amendment 2 was implemented, extending the B-2 terminal-record exception to `cancelled`.
- **Unchanged:** the Gateway and ledger and their authority, the unique key, the one-provisional index, fencing, terminal monotonicity, post-lock semantics, and every protected test.
- **Not done:** no Checkpoint C, D, or E; no merge; no deployment; no production activation; no production providers; no infrastructure; no unrelated refactoring.

**STOP after Amendment 2, for final independent Product Architecture review of Checkpoint B.**
