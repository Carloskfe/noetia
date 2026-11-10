# NEM-024 — Checkpoint A Report (pre-execution)

**Status:** **CHECKPOINT A IMPLEMENTED — AWAITING INDEPENDENT PRODUCT ARCHITECTURE REVIEW (2026-11-10).** B-1 and B-2 were approved (§8); results are in §9. §1–§7 are the record of the blocked pre-execution check.
**Delivery state:** Branch `feat/nem-024-checkpoint-a` · **Draft PR #55** · not merged · not deployed · simulated provider only.

## 1. Authorization

| Item | Value |
|---|---|
| Mission | NEM-024 — Research-Turn Orchestration and Minimal Bilingual Web Q&A; specification approved at `2e0cb54` (PA final sign-off granted) |
| Authorization | PO *"NEM-024 — Product Owner Approval + Checkpoint A Execution Authorization"* (2026-11-10), recorded as [PO-035](../operating-framework/decisions/product-owner/PO-035-nem-024-specification-approval-and-checkpoint-a-authorization.md). **Checkpoint A only** |
| Branch | `feat/nem-024-checkpoint-a`, from `2e0cb54` (ancestry: E6 docs PR #54 → NEM-023 PR #53 → E5 docs PR #52 → NEM-022 PR #51 → NEM-021 → NEM-019). `main` untouched |

## 2. Pre-execution check

| Check | Result |
|---|---|
| Mission read in full; PO-034 and PO-035 consistent | Pass |
| `TurnService` constructor/`run` positional use in accepted tests (`turn.service.spec.ts:44`, `it-env.ts:206`) | Pass: optional trailing parameters keep them compiling (D-3 A2/A3) |
| `TurnResult` assertions use `toMatchObject` / field checks | Pass (additive fields safe) |
| NEM-019 `architecture.spec.ts`: single controller, port bindings, gateway-caller registry, sealers, log content | Pass: routes stay in `SessionsController`; bindings unchanged; `turn.service.ts` is the registered model path |
| NEM-022 `gateway-architecture.spec.ts`: `controllers: [SessionsController]`, simulated adapters only | Pass |
| NEM-021 `cost-architecture.spec.ts` / `contract-architecture.spec.ts`: module registers cost services; `sessions/*` imports no ledger, contract, or pricing module | Pass (and it constrains B-2: the turn code must not consult the ledger) |
| Migration-ordering tests (NEM-019 AC-19, NEM-021 AC-13, NEM-023 migration 075 test) with a new migration 076 | Pass by design (all are position-independent: "revert newer first") |
| **NEM-023 `retrieval-architecture.spec.ts` — "no turn or port wiring"** | **FAIL — B-1** |

## 3. Blockers

### B-1 — An accepted NEM-023 architecture test forbids the wiring that D-3 authorizes (stop condition)

`tests/unit/knowledge/retrieval/retrieval-architecture.spec.ts`, test *"no turn or port wiring: nothing outside retrieval/ imports it; the module, TurnService, and ContextSourcePort are untouched"* (lines 30–37) asserts:
- no file outside `src/knowledge/retrieval/` imports from `retrieval/`;
- `knowledge.module.ts`, `sessions/turn.service.ts`, `context-source.port.ts`, and `app.module.ts` never mention `retrieval/`, `QueryContextSource`, `LexicalRetrieval`, `BookIndexer`, or `IndexingPermission`;
- the bindings `CONTEXT_SOURCE_PORT → EmptyContextSource` and `TEXT_IDENTITY_PORT → UnboundTextIdentityPort` are unchanged.

Checkpoint A's approved D-3 items **A6** (register the E5 providers in `KnowledgeModule`) and **A7** (inject `QueryContextSource` and `IndexingPermission` into `TurnService`) necessarily violate the first two assertions. The test encoded NEM-023's "dark, unwired until E6" boundary, and E6 is the step it was waiting for.

**Probe** (temporary one-line import in `knowledge.module.ts`; reverted; tree clean):

```
✕ no turn or port wiring: nothing outside retrieval/ imports it; the module, TurnService, and ContextSourcePort are untouched
  +   "src/knowledge/knowledge.module.ts",
Tests: 1 failed, 8 passed, 9 total
```

**Stop condition hit:** NEM-024 §17, *"any other NEM-019/021/022/023 test needing change"*; PO-035, *"Maintain backward compatibility with existing tests."*

**Specification error disclosed:** the PA review package §1.3 stated *"Protected-test amendments required: None."* That was wrong: this NEM-023 test was overlooked when D-3 was drafted. The rest of D-3 holds.

**Workarounds rejected:**
- placing the wiring inside `retrieval/` and importing it under another name;
- re-exporting through a differently named module;
- moving the provider registration into another file.

Each would pass the test's text while defeating its intent, which is the same R-2 principle applied in NEM-023 and E6 discovery.

### B-2 — Specification gap: replay after a step-4 failure (PA ruling)

NEM-024 §9.2 item 5 says a same-key replay after a step-4 failure (reservation released, no `ai_turns` row) returns `409 turn_failed`. In code, that case is **indistinguishable** from "original request still between reservation and lock":
- the Gateway's `prepare` raises the same `duplicate_attempt` → `duplicate_turn` in both cases;
- there is no row in either case;
- the only distinguishing fact (a `release` entry) is in the NEM-021 ledger, which `sessions/*` may not consult (NEM-021 `contract-architecture.spec.ts`: turns reach the ledger only through the Gateway).

This is not a stop condition by itself, but the specified behaviour cannot be implemented as written without breaking that boundary.

## 4. Decisions required

| ID | Decision | Options | Recommendation |
|---|---|---|---|
| **B-1** (PO + PA, protected-test exception) | Allow the D-3 wiring | **A:** one **intent-preserving amendment** of the NEM-023 test *"no turn or port wiring"* (B-3 / D-1 pattern), **in its own commit, shown green before any NEM-024 code**:<br>• replace "nothing outside `retrieval/` imports it" with "**only** `knowledge.module.ts` (provider registration) and `sessions/turn.service.ts` (turn wiring) import from `retrieval/`, and they import only `QueryContextSource`, `IndexingPermission`, `AnchorResolver`, `LexicalRetrievalService`, `StorageBookText`, `RetrievalMetricsService`, and the types file";<br>• add "`turn.service.ts` never references `LexicalRetrievalService`, `BookIndexer`, or `RetrievalPort` directly";<br>• keep every other assertion unchanged: `context-source.port.ts` and `app.module.ts` never mention retrieval, and the two pinned bindings `CONTEXT_SOURCE_PORT → EmptyContextSource` and `TEXT_IDENTITY_PORT → UnboundTextIdentityPort`.<br>**B:** defer Checkpoint A | **A**: it preserves the test's lasting intent (bounded wiring, unchanged bindings, no indexer in turns) and records E6 as the approved wiring point |
| **B-2** (PA) | Replay after a step-4 failure | **(i)** Replay returns `409 duplicate_turn {status: 'unknown'}` in both cases; the client waits briefly, then asks with a new key on explicit user action (no ledger read; a weaker answer). **(ii)** After a step-4 failure, after the existing release, insert a **terminal `failed` row** (`failureReason`, no lock, nullable `turnIndex`) so a replay returns `turn_failed` exactly; a deviation from "step-4 failures create no row". **(iii)** A read-only Gateway accessor for attempt state (a change to accepted NEM-022 code; not recommended) | **(ii)**: exact replay semantics with no ledger access from `sessions/*`; the row is terminal and harmless to the partial unique index |

If **B-1 A** and a **B-2** option are approved, implementation proceeds from this branch:
1. the NEM-023 test amendment as its own commit, with the NEM-023 and NEM-024-relevant suites green;
2. then Checkpoint A as specified.

## 5. Work completed

1. Recorded the PO approval and the Checkpoint A authorization ([PO-035](../operating-framework/decisions/product-owner/PO-035-nem-024-specification-approval-and-checkpoint-a-authorization.md)); mission moved `DRAFT/` → `APPROVED/` (`git mv`); register updated; links repointed.
2. Ran the pre-execution check (§2) and the B-1 probe (reverted).
3. This report.

**No application code, tests, migrations, dependencies, CI/CD, or infrastructure changed.** No disposable containers were needed (probe was a unit test only). No provider; no cost.

## 6. Protected-systems confirmation

Not modified: NEM-019, NEM-021, NEM-022, NEM-023 code, tests, and bindings; `fragments`; `sync_maps`; the reader; migrations; `main`; CI/CD; infrastructure. Checkpoints B–E untouched.

## 7. Next action

PO + PA decision on B-1 (protected-test exception) and a PA ruling on B-2. *(Recommendation only.)*

---

## 8. PO decision on B-1 and B-2 (2026-11-10)

PO *"NEM-024 Checkpoint A — Product Owner Approval of B-1 and B-2"* approves **both** amendments together, recorded as mission **Amendment 1**.

| ID | Decision | Effect |
|---|---|---|
| B-1 | **Option A** | One intent-preserving amendment of the NEM-023 test *"no turn or port wiring"*, in its own commit before any Checkpoint A code. It permits only the approved module registration and `TurnService` dependencies; it keeps the prohibition on direct indexer or retrieval-service access from `TurnService` and the two port bindings. No alias imports; no unrelated assertion weakened |
| B-2 | **Option ii** | A terminal `failed` record after a step-4 failure and the release: idempotent; not a successful turn; no extra reservation or charge; no interference with the one-provisional-turn index; no ledger query; `reservationRelease` reported conservatively (`released` only when the Gateway release completed without error). Concurrency and persistence-failure tests required. Semantics: mission §9.2 item 1a |

Scope: only these two amendments, then Checkpoint A. No other architecture exception; Checkpoints B–E, production providers, infrastructure, merge, and deployment are not authorized.

---

## 9. Checkpoint A completion

### 9.1 Commits

| Step | Commit |
|---|---|
| PO-035 record; BLOCKED report | `f68acde` |
| Amendment 1 (B-1, B-2 approval) | `78ac996` |
| **B-1 protected-test amendment (separate)** | **`8ceb062`** |
| Checkpoint A implementation and tests | **`6f152a3`** |
| This report; mission §5.5 columns | see the PR head |

### 9.2 Files and architectural surfaces

| File | Change | Surface |
|---|---|---|
| `src/migrations/1748300000076-CreateAiTurns.ts` | **New**, additive | `ai_turns`: UNIQUE (`sessionId`, `keyHash`); partial UNIQUE (`sessionId`) WHERE `accepted`; FK to `ai_conversations` ON DELETE CASCADE; CHECKs; no excerpt column |
| `src/knowledge/sessions/turn-record.store.ts` | **New** | T0 insert inside the lock transaction; T1/T2 as single conditional `UPDATE`s in a CTE, fenced by `statement_timestamp()`, owner token required; idempotent B-2 record; `fenceSeconds` |
| `src/knowledge/sessions/turn-status.error.ts` | **New** | Existing `DenialReason` codes plus a content-free status payload (Q-4) |
| `src/knowledge/sessions/turn.service.ts` | **Additive** (D-3 A2/A3/A4/A7) | Optional trailing dependencies; `run(…, question?)`. The 3-argument body is unchanged; the question path is in `runQuestion` |
| `src/knowledge/sessions/sessions.dto.ts` | **Additive** (A1) | `question` (required string, transport bound 4,000); the service normalizes NFC + trim and enforces 1–500 code points |
| `src/knowledge/sessions/sessions.controller.ts` | One line (A5) | Passes `dto.question` to the existing turn route. No new route (history, stream, cancel, and probe are Checkpoints B/C) |
| `src/knowledge/knowledge.module.ts` | **Additive** (A6) | `StorageModule` import; E5 providers via factories on the **same unbound** rights/text-identity ports; `TurnRecordStore`. Bindings unchanged; indexer not registered |
| `tests/unit/knowledge/retrieval/retrieval-architecture.spec.ts` | **B-1 amendment** (`8ceb062`) | Allow-list of two importers and named modules; indexer and ranking service barred from `TurnService` |
| New tests | — | `turn.service.question.spec.ts` (38), `turn-record.store.spec.ts` (6), `turn-status.error.spec.ts` (2), `sessions.dto.spec.ts` (1), `sessions.controller.spec.ts` (2), `tests/integration/knowledge/turn-question.int-spec.ts` (18), `support/turn-env.ts` |

**Unchanged:** the Gateway, the ledger and its settlement authority, contract v1, `ContextSourcePort` and its binding, `TEXT_IDENTITY_PORT`, `ContextBuilderService`, `MODEL_PATHS`, E5 retrieval classes, `fragments`, `sync_maps`, `app.module.ts`, `knowledge.registration.ts`, and every accepted test other than the authorized B-1 amendment.

### 9.3 Turn order as implemented

1 entitlement → 2 session gate, **replay lookup**, set, per-book eligibility, **retrieval (E5 facade)**, Context Builder → 3 Gateway `prepare` (the ledger attempt-key uniqueness is the duplicate gate) → 4 lock transaction (`FOR UPDATE`, set-hash check, `turnCount + 1`, **T0 insert**) → 4b **final eligibility check** (fresh `RightsService.eligibility` for every allowed book and fresh `IndexingPermission.check` with the same text hash for every chunk-contributing book) → 5 `gateway.invoke` (no awaited operation between 4b and 5) → 6 per-attempt settlement inside the Gateway → 7 **T1**.

- **Failures before reservation:** no lock, no charge, no record.
- **Step-4 failure:** Gateway release, then a B-2 record.
- **Final-check failure:** release, T2 `failed` (`book_ineligible`), lock stands.
- **Provider failure:** T2 `failed`.
- **T1 lost:** the winner's status, no text.
- **T1 erroring twice:** re-read; release text only if the row is `completed` with this token, deliver `unrecorded` if the row is still `accepted` (D-8), otherwise the stored status; a re-read failure gives `unknown` with no text.

### 9.4 Test commands and results (fresh disposable `postgres:16-alpine` + `redis:7-alpine`, removed afterwards)

| Suite | Command | Result |
|---|---|---|
| Architecture suites, before any code (after B-1) | `npx jest --runInBand <5 architecture specs>` | **57/57** |
| Architecture suites, after the wiring | same, plus the registration spec | **65/65** |
| NEM-024 integration | `npx jest -c jest.integration.config.js --runInBand tests/integration/knowledge/turn-question.int-spec.ts` (env as in NEM-023 §10) | **18/18** |
| **All integration suites** (NEM-019/021/022/023/024) | `npx jest -c jest.integration.config.js --runInBand` | **10 passed, 1 skipped (opt-in performance); 164/164** |
| **Full API unit suite** | `npx jest --maxWorkers=2 --coverage` | **129 suites, 1,869/1,869** |
| Coverage | same run | `knowledge/sessions` 99.24% statements / **91.27% branches** / 100% functions / 100% lines (`turn.service.ts` 89.7% branches; `turn-record.store.ts` 95.45%). **Global branches 79.49%**: E-2 still open (80% gate), improved from 78.75% |
| Typecheck | `tsc --noEmit -p tsconfig.json` and `-p tsconfig.test.json` | 0 errors |
| Lint | `eslint src/knowledge/sessions src/knowledge/knowledge.module.ts <migration>` | 0 errors (1 ignore-pattern warning) |

### 9.5 Evidence by requirement

| Requirement | Evidence (integration, real PostgreSQL, unless marked unit) |
|---|---|
| Migration and rollback | 076 down → `ai_turns` gone, whole schema outside it identical; up → identical; partial unique index definition; FK CASCADE; no excerpt column; no row seeded |
| Idempotency | Five concurrent same-key requests → **one** ledger reservation (`reservation`, `settlement`), **one** provider invocation (spy), **one** record; losers get `duplicate_turn`. Replay → stored result, no new ledger rows, no provider call |
| One provisional turn per session | A second key during an in-flight turn (deterministic gate inside the first provider call) → step-4 failure via the partial index; ledger shows `reservation`, `release`; terminal `failed` record with `turnIndex` NULL; `turnCount` stays 1; replay returns the recorded denial with no new reservation |
| B-2 | Idempotent under 6 concurrent writes (one row). Release failure → `unconfirmed`, ledger keeps only `reservation` (held). Failure-record write failure → `recorded: false`, released first (no charge), replay → `409 {status: pending}` |
| Final eligibility check | User-level revocation **and** indexing-permission withdrawal, injected after reservation → no provider call, ledger `reservation` + `release`, record `failed`/`book_ineligible` with `turnIndex` 1. Unit: hash change and check exceptions fail closed; ordering log shows `final.*` immediately before `invoke` |
| Settlement ordering | Inside the first completion attempt the ledger already shows `reservation`, `settlement` (settlement precedes T1) |
| Persistence failure (D-8) | Completion fails twice → answer returned `unrecorded: true`; charge stands; row stays `accepted`; replay → `409 {status: accepted}` |
| Answer release (G5) | A terminal outcome committed first → T1 0 rows → `interrupted`, no answer text in the response; ledger settlement unchanged |
| Fence semantics (F-7) | **LW-7:** a transition started after the fence → 0 rows with no competitor. **LW-1:** T1 started before the fence, blocked by a held row lock past it → commits; `completedAt < fenceAt` and `clock_timestamp() > fenceAt` (statement start < fence < commit). **LW-8:** a terminal update committed first → the blocked pre-fence T1 re-checks and affects 0 rows. Owner token required; terminal never changes |
| Deletion | User delete → `ai_turns` rows gone; a late T2 → 0 rows |
| Protected data | `fragments`, `sync_maps`, `user_books` checksums unchanged across a question turn |
| Module wiring (unit) | The real `KnowledgeModule` boots (flag on): `TurnService` has all four dependencies; the turn route with a question still denies by default (`prerequisite_missing`) |

### 9.6 Deviations and notes

- **N-1:** guards run before validation pipes in Nest, so an unentitled request without `question` gets 403, not 400. The required-field rule is proven at the DTO level.
- **N-2:** the B-2 record and the `turnIndex`-nullable column are per Amendment 1 (mission §9.2 item 1a, §5.5).
- **N-3:** replay of a completed turn returns citations with `excerpt: null`, `sourceState: 'deferred'`. Excerpt re-materialization on history reads is Checkpoint B (D-10).
- **N-4:** a provisional row whose completion write failed stays `accepted` until fenced finalization (T4), which is Checkpoint B, so in Checkpoint A its replay answers `409 accepted`. The owner's own bound is the Gateway's per-attempt provider timeout, from which `fenceAt` is derived; no extra self-abort timer is added (cancellation and timers are Checkpoint B).
- **N-5:** each transition runs as `SET LOCAL statement_timeout` + one data statement in its own transaction; `statement_timestamp()` is that data statement's start.
- **Lock-wait tests LW-2 to LW-6 and LW-9/LW-10** involve T3/T4 (cancel, finalization), which are Checkpoint B, and are not run here.

### 9.7 Remaining exceptions

- **E-1:** retrieval p95 (594 ms vs 150 ms), not waived.
- **E-2:** global branch coverage 79.49% vs 80%, not waived (improved).
- NEM-022's coverage shortfall is not waived.

### 9.8 Confirmation

- **Not done:** no merge, no deployment, no paid or production provider, no production indexing, no infrastructure or CI/CD change.
- **Untouched:** Checkpoints **B, C, D, and E**; E7, E8, E9; mobile.

**STOP after Checkpoint A, for independent Product Architecture review.**
