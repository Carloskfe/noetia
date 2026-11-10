# NEM-024 — Checkpoint A Report (pre-execution)

**Status:** **BLOCKED AT PRE-EXECUTION CHECK — no implementation code written.** One approved stop condition is triggered (B-1). A second item (B-2) is a specification gap needing a PA ruling. Partial report under the reporting protocol (blocked work).
**Delivery state:** Branch `feat/nem-024-checkpoint-a` (documentation records only) · no implementation PR · not merged · not deployed.

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
