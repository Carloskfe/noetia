# NEM-024 — Checkpoint B Report (cancellation, recovery, history, guard)

**Status:** **CHECKPOINT B IMPLEMENTED — AWAITING INDEPENDENT PRODUCT ARCHITECTURE REVIEW (2026-11-10).**
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
