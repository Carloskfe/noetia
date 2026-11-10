# NEM-024 Checkpoint C — Completion Report: Transport (SSE) and Capability Probe

**Status:** **CHECKPOINT C IMPLEMENTED — AWAITING INDEPENDENT PRODUCT ARCHITECTURE REVIEW (2026-11-10).** Checkpoints D and E not started; not merged, not deployed, not activated.
**Authorization:** [PO-039](../operating-framework/decisions/product-owner/PO-039-nem-024-checkpoint-c-authorization.md) · **Baseline:** `39c0c37` (PO-038) · **Mission:** [NEM-024](../engineering-missions/APPROVED/NEM-024-research-turn-orchestration-and-minimal-bilingual-web-qa.md) §5 item 8, §9.3, §9.6, §9.7

## 1. Commits and PR

| Item | Value |
|---|---|
| Draft PR | https://github.com/Carloskfe/noetia/pull/56 (draft; base `feat/nem-024-checkpoint-a`) |
| Implementation and tests | `7b65510` |
| Documentation (PO-039, this report, status) | see the PR head |

## 2. Files changed

| File | Change |
|---|---|
| `src/knowledge/sessions/turn-stream.ts` (new) | SSE serializer (`formatSse`), result → events (`resultEvents`), safe error terminal (`errorTerminal`), transport runner (`streamTurn`), headers |
| `src/knowledge/sessions/sessions.controller.ts` | `GET capabilities` (declared **first**, before every `:id` route); `POST :id/turns/stream` |
| `src/knowledge/sessions/turn.service.ts` | **Additive only:** <br>• optional `run(…, { onStage })` (synchronous, not awaited, exception-isolated); <br>• `capabilities(userId)`; <br>• constants `TURN_QUESTION_MAX_CODE_POINTS` (500) and `TURN_HISTORY_PAGE_MAX` (50) replace the two literals (same values). <br>The turn order, lock, fencing, cancellation, and replay logic are untouched |
| `tests/unit/knowledge/sessions/turn-stream.spec.ts` (new) | 21 tests |
| `tests/unit/knowledge/sessions/turn.service.checkpoint-c.spec.ts` (new) | 11 tests |
| `tests/unit/knowledge/sessions/sessions.controller.spec.ts` | +7 HTTP tests (real Nest app, real guards and pipes, fake DB) |
| `tests/integration/knowledge/turn-stream.int-spec.ts` (new) | 15 tests over a real HTTP socket and real PostgreSQL |

No migration, no new dependency, no new provider, no infrastructure, no change to `app.module.ts`, the Gateway, the ledger, or any protected test.

## 3. SSE contract and event-order evidence

### 3.1 Contract

`POST /knowledge/sessions/:id/turns/stream`, body `TurnDto` (`idempotencyKey`, `question`); `JwtAuthGuard` + `CapabilityGuard` (`research_session`, `use`) + `ParseUUIDPipe` + global `ValidationPipe`.

- **Before the stream opens:** authentication, capability, UUID, and body errors are ordinary HTTP JSON errors (401, 403, 400). Guards run before pipes.
- **After it opens:** HTTP 200 with these headers:
  - `Content-Type: text/event-stream; charset=utf-8`
  - `Cache-Control: no-cache, no-transform`
  - `Connection: keep-alive`
  - **`X-Accel-Buffering: no`** (R-9; set by the response, no infrastructure change)

  Every outcome is then a `terminal` event.

Frames are `event: <type>\ndata: <one-line JSON>\n\n`. The order is fixed:

| # | Event | Data | Content? |
|---|---|---|---|
| 1 | `stage` (0–3, monotonic, each at most once) | `{ stage: 'checking' \| 'searching' \| 'composing' }` | **None** (only the stage name) |
| 2 | per segment *i*: `delta`, then `segment` | `{ segment, text }`; `{ segment, origin, bookId?, citations[] }` (TurnResult v2 citations: `ref, kind, bookId, anchor, excerpt\|null, sourceState`) | Validated answer and verified excerpts |
| 3 | `terminal` (exactly 1, last) | see 3.3 | — |

Stages:

| Stage | Emitted |
|---|---|
| `checking` | after question validation, before entitlement |
| `searching` | after per-book eligibility and guard admission, before retrieval |
| `composing` | after the lock transaction commits, **before** the final eligibility check. It is synchronous; nothing is added between the final check and `invoke` (§9.4) |

### 3.2 Text release: Gateway validation and G5 (no conflict)

The approved event list streams the Gateway's validated `segment`/`delta`. The accepted turn contract (G5, Checkpoint A; LW-8/LW-9) additionally requires that **the owner releases answer text only after its own T1 commit is confirmed**.

If raw Gateway events were relayed as they arrive, text could be sent and the turn could still end `cancelled` (endpoint T3) or `interrupted` (T4), which would break G5.

**Resolution, with neither guarantee weakened:** `delta`/`segment` are derived from the `TurnResult` that `TurnService` returns, and `TurnService` returns it only after:
1. the Gateway's terminal event: every attempt validated and settled, or held (NEM-022 F-1/F-3);
2. this request's T1 commit is confirmed, or in the D-8(a) `unrecorded` case.

**Consequence (disclosed as D-C1):**
- Release is per turn, not per attempt.
- The additional delay is only the T1 write.
- The Gateway already releases text per attempt, after validation, not per token.
- This matches the mission's UX rule: "content-free stage states while the turn runs (no token-by-token text)", §5 item 13.
- Gateway `usage` and `retry` events are not relayed, because they carry cost and attempt internals.

### 3.3 Terminal

| Outcome | When | Fields |
|---|---|---|
| `completed` | recorded, replayed, or D-8 | `statusCode 200, turnId, settlement ('settled' \| 'held'), persisted, unrecorded?, replayed?, result (TurnResult v2)` |
| `failed` / `cancelled` / `interrupted` | recorded terminal states (status payload) | `statusCode, code, message, status, turnId?, reservationRelease?, recorded?, exclusions?` |
| `pending` | a provisional duplicate (`status: accepted`), or the guard (`retryAfterSeconds`, `guard`) | as above |
| `unknown` | the owner could not confirm anything (no text) | as above |
| `denied` | plain denials (`no_eligible_books`, `not_found`, `invalid_request`, …) | `statusCode, code, message` |

- **Persistence:**
  - `persisted: true` only for a durably recorded completion.
  - D-8(a) gives `persisted: false, unrecorded: true`; it is never represented as saved.
  - `recorded: false` failures give `persisted: false`.
- **Unexpected errors:** they become a generic `turn_failed` (502). Nothing from the original error is surfaced: no message, stack, or SQL.

### 3.4 Evidence (real PostgreSQL + real HTTP socket)

| Test | Result |
|---|---|
| Frames are `stage×3 → (delta, segment)×n → terminal`. **Server-side log:** the first content frame follows both `gateway:terminal` and `T1:committed`; before it, only `stage` frames were written. Streamed text = terminal result = stored record; ledger `reservation`, `settlement` | ✓ |
| Replay: `checking → content → terminal(replayed)`; no `prepare`, no provider call | ✓ |
| Duplicate key while provisional → `terminal pending`, 409, `status: accepted`; one completion, one reservation, one row | ✓ |
| Provider failure → `terminal failed` (recorded); no content | ✓ |
| Explicit cancel after the lock → `terminal cancelled`; T3 recorded; no content | ✓ |
| Cancel before the lock commits (Amendment 2) → `terminal cancelled`, `released`; `lockedAt` NULL, `turnCount` 0 | ✓ |
| D-8(a) → `completed`, `persisted: false`, `unrecorded: true`. Then the same key → `pending` (409); after the fence → `interrupted`, never the answer | ✓ |
| Unit: while the turn runs, only `stage` frames exist (no answer or excerpt bytes); newline-injection in content cannot split a frame; stages monotonic and content-free | ✓ |

## 4. Disconnect ≠ cancellation (D-9 a)

- The turn promise is not linked to the connection.
- `streamTurn` only stops writing once `close` or `error` fires, or a write throws.
- It never calls `end()` on a destroyed response, and never rejects.

| Test | Result |
|---|---|
| The client socket is destroyed at `stage: composing`; the provider runs only after the server observed `close` → the turn **completes and is persisted**; a same-key replay returns it (no provider call); one reservation | ✓ |
| Disconnect **during** the provider attempt → the provider's `AbortSignal` is **not** aborted (no `client_abort`); completed; ledger `reservation`, `settlement` (not held) | ✓ |

## 5. Capability probe

`GET /knowledge/sessions/capabilities`: `JwtAuthGuard` + `CapabilityGuard` (`research_session`, **`use`**; deny-first), then `TurnService.capabilities` (single resolver).

```json
{ "tier": "noetia_plus", "capabilities": ["research_session"],
  "features": { "researchTurns": true, "streaming": true, "cancellation": true, "history": true },
  "limits": { "maxBooks": 3, "questionMaxCodePoints": 500, "historyPageMax": 50 } }
```

| Test | Result |
|---|---|
| **Route precedence:** `/capabilities` → 403 `prerequisite_missing` (guard), **not** 400 from `ParseUUIDPipe`; `/not-a-uuid` → 400. The handler is declared before `get` | ✓ |
| Entitled → exact shape above (HTTP) | ✓ |
| Real resolver: tier, sorted capability keys, and `maxBooks` from the active policy | ✓ |
| Deny-first: no grant → `no_entitlement`; no qualifying plan → `prerequisite_missing`; flag disabled → `feature_disabled` (existing flag behaviour) | ✓ |
| No budget, allowance, units, USD, ledger, price, cost, balance, provider, model, secret, policy id or version, rollout, or flag in the response | ✓ |
| Module flag off → no knowledge route exists (existing AC-1 test, unchanged) | ✓ |

## 6. Rights, eligibility, and privacy

| Test | Result |
|---|---|
| All books revoked → `terminal denied no_eligible_books` (403); no `prepare`, no record, no content | ✓ |
| Revoked between preflight and the provider (final check) → `terminal failed book_ineligible`, `released`; no text | ✓ |
| Another user's session → `terminal denied not_found` with only `outcome, statusCode, code, message` | ✓ |
| The question, the answer text, and the word "faro" never reach `console.*` or `Logger` across a success and an internal failure; the error terminal has no question, stack, `Error`, SQL, or table names | ✓ |

## 7. Test and regression results (fresh disposable `postgres:16-alpine` + `redis:7-alpine`, removed afterwards)

| Suite | Result |
|---|---|
| All integration suites (NEM-019, 021, 022, 023, 024 A, B, **C**) | **12 passed, 1 skipped (opt-in performance); 216/216** (previously 201 + 15 new) |
| Full API unit suite | **137 suites, 1,956/1,956** (previously 1,917 + 39 new) |
| Coverage | **Global: 94.34% statements / 80.20% branches / 92.48% functions / 95.46% lines.** `turn-stream.ts` 100% / 96.42% branches; `turn.service.ts` 88.92% branches |
| Typecheck (source, tests) | 0 errors |
| ESLint | 0 errors in Checkpoint C files. Two pre-existing `no-explicit-any` warnings in `lexical-retrieval.service.ts`, and pre-existing errors in `turn-record.store.spec.ts` (`require`), are unchanged |

Checkpoint A and B suites (`turn-question`, `turn-recovery`, and the unit specs) pass unchanged, including R1–R12 and LW-1 to LW-10.

## 8. Deviations and new risks

| Id | Item | Disposition |
|---|---|---|
| **D-C1** | Text is released per turn, after T1 (§3.2), not as raw per-attempt Gateway events | Required by G5; strengthens. **PA confirmation requested** |
| **D-C2** | Stage names follow doc 14 (`checking / searching / composing`); doc 12 lists `preflight / retrieving / composing` | UX-facing names for Checkpoint D; **PA to confirm** |
| **D-C3** | Once the stream opens, denials are `terminal` events in an HTTP 200 stream (`statusCode` inside); pre-stream errors remain HTTP errors | Standard SSE practice; documented |
| **D-C4** | Doc 11 (row 9b) says "client-disconnect → `AbortSignal`" | Superseded by D-9 (a), as the mission states; implemented as D-9 (a) |
| R-C1 | **No SSE heartbeat.** A long provider attempt with no frames could hit an idle proxy timeout. The turn is unaffected (replay recovers it) | Within the current proxy defaults; revisit at Checkpoint E or launch (no infrastructure change now) |
| R-C2 | D-8 delivery over SSE is still best effort. A lost terminal after an unrecorded completion is an unseen charge (unchanged D-8 residual) | Carried |
| R-C3 | The probe's `features` reflect wiring, not rollout. Rollout is enforced by the guard (deny-first) | By design |

## 9. Exceptions carried forward (not waived)

- **E-1:** retrieval p95, 594 ms vs 150 ms.
- **E-2:** branch coverage is 80.20% on this stack; closing it needs a separate decision.
- **NEM-022 coverage exception.**
- **D-8:** best-effort `unrecorded` delivery.
- **Cancellation-record persistence:** a failed write leaves the replay `pending`.
- **In-process-only cancellation** (N-B5).
- **Q-11:** W=10 is a candidate; Checkpoint E.
- **TT-14:** answer retention and rights.

## 10. Boundaries

Done: only Checkpoint C.

Not done:
- no Checkpoint D or E;
- no merge, deployment, activation, or production flag;
- no paid provider;
- no infrastructure;
- no ledger access from E6;
- no new persistence;
- no change to accepted A/B contracts or protected tests.

**STOP: submitted for independent Product Architecture review of Checkpoint C.**
