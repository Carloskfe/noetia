# NEM-022 — Report: Provider-Independent AI Gateway and Simulator v2

**Status:** **BLOCKED AT PRE-EXECUTION CHECK — no implementation code written.** Two verified conflicts between the approved specification and accepted, frozen test baselines need a decision before implementation can start (§10b). Partial report under the reporting protocol (§2.2, blocked work).
**Delivery state:** Not merged · Not deployed · No Draft PR yet (created at the implementation checkpoint).

---

## 1. Mission and objective

| Item | Value |
|---|---|
| Mission | NEM-022 — Provider-Independent AI Gateway and Simulator v2 (E2), specification Revision 3 (PO-032) |
| Type | IMPLEMENTATION |
| Authorization | PO *"Product Owner Execution Authorization: NEM-022"* (2026-11-09): execute §5 items 1–12 and the matching acceptance criteria, on frozen contract v1 and the accepted NEM-021 ledger. **"If a prerequisite is missing or a stop condition applies, STOP and report it before writing implementation code."** Not authorized: merge, deployment, schema or migration changes, infrastructure, CI/CD, real providers, SDKs, endpoints, credentials, AI costs, protected systems, other missions, and **changing NEM-019 or NEM-021 tests merely to make NEM-022 pass** |

## 2. Date and status

2026-11-09. Lifecycle: Authorized → In progress (pre-execution check) → **BLOCKED**.

## 3. Repository baseline

| Item | Value |
|---|---|
| New branch | `feat/nem-022-gateway-simulator-v2`, created from the accepted NEM-021 head `f94612486188dfd4cb96a5354f150e36b56d9609` (stacked-PR ancestry preserved: NEM-021 PR #50 → #49 → … → #46) |
| Accepted NEM-021 commit | `bbd7c99` (code = `484f6ac`); acceptance record `f946124` |
| Contract source tree at branch point | `634266826c934e3d615a7342a04a5e7458c6a84d`: **matches** the frozen v1 baseline |
| Contract test tree at branch point | `d8de089995b57b0e86298d9a2609f5dbee08c980`: **matches** the approved (D-2) baseline |
| Migrations | 073 and 074 present; NEM-022 needs no schema change (§7 F-5) |

## 4. Scope and exclusions

In scope: the pre-execution verification required by the PO instruction §1 and the governance README. Implementation (§5 items 1–12) was **not started**. Excluded, as instructed: everything listed in §1.

## 5. Executive summary

The specification is sound, and the accepted NEM-021 baseline is intact. NEM-022 needs no schema change and no provider, network, or credential. Two preconditions fail, both by design of earlier, accepted work:

- **B-1 (frozen NEM-021 guard).** Two tests in the frozen contract test tree (approved hash `d8de089`) allow the contract to be imported **only** by `knowledge/metering`. They also pin the Gateway, router, provider, paths, simulator, and `turn.service.ts` by digest and forbid any `ai/` or `sessions/` file from importing the contract or the cost ledger. NEM-022 must do exactly that (§5.1, §5.2, §5.10, §9). A two-line probe made both tests fail. These guards were written as the Phase 2 → E2 hand-off ("Gateway, router, and turn execution remain outside Phase 2"), so they are meant to be replaced now. But they are frozen, and the PO instruction forbids changing NEM-021 tests to make NEM-022 pass → **decision D-1 (Product Architecture)**.
- **B-2 (turn integration conflicts with "NEM-019 suites unchanged").** Today `TurnService` reserves and settles each turn through the **legacy** units-only NEM-019 ledger. Spec §9 says the Gateway never calls a provider without a confirmed **per-attempt** reservation (E1 API), and §5.10 makes `TurnService` use that Gateway. AC-9 and AC-11 require every NEM-019 turn and ledger test to pass **unchanged**. Those tests assert the legacy per-turn ledger rows and drive the current Gateway and simulator API. All three requirements cannot hold together → **decision D-2 (Product Architecture; PO if a NEM-019 test exception is chosen)**.

Neither blocker is a product defect. Recommended resolutions are in §11.

## 6. Work completed

1. Read the full NEM-022 specification (Revision 3), the NEM-021 acceptance record (Phase 2 report §19, mission file), and the D-2 freeze record.
2. Verified the accepted NEM-021 baseline: branch head, both contract tree hashes, and migrations 073–074 (§3).
3. Inspected the NEM-019 AI layer:
   - `ai/model-gateway.service.ts`, `model-router.service.ts`, `model-provider.ts`, `model-paths.ts`, `simulated-provider.service.ts`, `verified-context.ts`;
   - `sessions/turn.service.ts` and `context-builder.service.ts`;
   - their unit tests, the NEM-019 integration harness `support/it-env.ts`, and `ledger.int-spec.ts`.
4. Ran a **temporary probe** (§7 F-1). The probe file was deleted straight afterwards, and `git status` is clean.
5. Created the NEM-022 branch, and recorded the authorization and BLOCKED status (mission file, register, this report). Documentation only.

## 7. Verified findings and evidence

**F-1 (B-1). Frozen guards forbid what NEM-022 must do.** `services/api/tests/unit/knowledge/ai/contract/contract-architecture.spec.ts`, inside *"Phase 2 boundaries (D-2)"*:
- *"contract integration is limited to the ledger/metering layer"*: any non-`metering/` file importing the contract fails;
- *"Gateway, router, and turn execution remain outside Phase 2 (unchanged; no contract or cost-ledger imports)"*:
  - SHA-256 digest `d35dca78…` over `ai/model-gateway.service.ts`, `ai/model-router.service.ts`, `ai/model-provider.ts`, `ai/model-paths.ts`, `ai/simulated-provider.service.ts`, `sessions/turn.service.ts`;
  - no file in `ai/` or `sessions/` may import `contract`, `cost-ledger`, `cost-config`, or `cost-reconciliation`.

NEM-022 requires the opposite:
- §9: "all types, outcome and error categories … come from contract v1", so the Gateway imports the contract;
- §5.1–§5.3, §5.7: the Gateway, router, and simulator are rebuilt on the contract;
- §5.9: reservation and settlement go through the cost ledger;
- §5.10: `TurnService` uses the new Gateway.

**Probe** (a two-line `src/knowledge/ai/zz-gateway-probe.ts` importing `CONTRACT_VERSION` from `./contract`; never committed; deleted):

```
✕ contract integration is limited to the ledger/metering layer
✕ Gateway, router, and turn execution remain outside Phase 2 (unchanged; no contract or cost-ledger imports)
    + "src/knowledge/ai/zz-gateway-probe.ts",
Tests: 2 failed, 11 passed, 13 total
```

These tests belong to the approved contract test tree `d8de089…`. Changing them needs Product Architecture review under the v1 freeze change control. The other D-2 guards remain valid for NEM-022 and should stay:
- historical migrations byte-identical;
- migrations ≥ 073 additive;
- no money primitives outside the contract;
- frozen source, fixtures, and golden vectors pinned.

**F-2 (B-2). Three requirements cannot all hold for turns.**

| Requirement | Source |
|---|---|
| (a) No provider call without a confirmed reservation **for that attempt** (per-attempt E1 API) | §9; §5.3 ("each attempt reserves and settles separately through E1's per-attempt API") |
| (b) `TurnService` uses the new Gateway; turn order and Context Builder invariant unchanged | §5.10, AC-9 |
| (c) All NEM-019 suites pass **unchanged** | AC-9, AC-11; PO instruction §5 |

Today `turn.service.ts` calls `ledger.reserve` (legacy, one units reservation per turn) before the Gateway, then `ledger.recordUsage` and `settle` / `release` on the legacy key (lines 82–144). The NEM-019 tests are bound to that:
- `tests/unit/knowledge/sessions/turn.service.spec.ts`: 24 assertions on `ledger.reserve`, `settle`, `release`, and `recordUsage`; it constructs `new ModelGatewayService(new ModelRouterService([sim]), TEST_CONFIG)` with `SimulatedProviderService`;
- `tests/integration/knowledge/support/it-env.ts:149-150`: the same construction for every NEM-019 integration suite;
- `ledger.int-spec.ts` and `sessions.int-spec.ts`: full turns that assert legacy reservation and settlement rows and exact unit budgets (e.g. `allowanceUnits: 10, reserveUnitsPerTurn: 10` admits exactly one turn).

Consequences of each way of satisfying (a) and (b):
- **Turns move onto per-attempt cost reservations.** The legacy rows those tests assert no longer appear, so NEM-019 tests change; that violates (c).
- **Turns keep the legacy turn reservation and the Gateway adds a per-attempt reservation.** Units are reserved twice, and both kinds count in the shared unresolved and allowance bounds (NEM-021 R-1/AC-5). Exact-budget tests such as the one above would then deny a turn they expect to admit, violating (c); this is analysis, not executed. It would also double-charge a user's unit allowance, which is a product-behaviour change.
- **Turns keep the legacy reservation and the Gateway skips its own reservation on the turn path.** That violates (a).

Not probed by code: any probe would itself be implementation. The coupling is shown by the file and line references above.

**F-3. No schema change is needed.** The Gateway, simulator, and contract suite are code; end-to-end settlement uses NEM-021's existing tables and API. No stop condition there.

**F-4. No provider, network, or credential is needed.** Simulated providers only; the router allowlist stays simulated-only.

**F-5. Dependencies.** Structured-output validation can use `class-validator` (already a direct dependency) or a small validator inside `knowledge/ai`. `ajv` is present only transitively, so using it would add a direct dependency; it is not proposed. Not a blocker.

**F-6. Other preconditions passed:** explicit authorization naming the mission; NEM-021 accepted; frozen hashes match; clean branch; disposable PostgreSQL/Redis workflow available within the VM limits; no product value needs inventing (TT-18: no web capability is built).

## 8. External references

None.

## 9. Risks

| ID | Rating | Risk |
|---|---|---|
| R-1 | **High** (schedule) | Implementation cannot start until D-1 and D-2 are decided |
| R-2 | Medium | Working around B-1 without approval, e.g. by placing the Gateway under `metering/` to dodge the guard, would defeat the guard's purpose and misplace the code. Not pursued |
| R-3 | Medium | Working around B-2 by double reservation would silently halve users' effective unit allowance. Not pursued |
| R-4 | Low | The probe ran only locally on a unit test; nothing persisted |

## 10. Decisions

**(a) Made under existing authority:**
- Stopped at the pre-execution check, as the PO instruction requires.
- Created the NEM-022 branch from the accepted NEM-021 head (pre-execution step 5).
- Ran a temporary, uncommitted probe to turn the suspected B-1 into a verified one.
- Recorded the authorization and BLOCKED status (governance records are in scope).

**(b) Requiring a decision:**

| ID | Decision | Owner |
|---|---|---|
| D-1 | Whether the two NEM-021 Phase-2-boundary guards may be replaced with NEM-022 boundary guards (contract source, fixtures, and golden vectors unchanged) | **Product Architecture** (v1 freeze change control) |
| D-2 | How `TurnService` integrates with the Gateway v2 and the cost ledger, given "NEM-019 suites unchanged" | **Product Architecture**; plus **Product Owner** if option A is chosen (a NEM-019 test exception) |

## 11. Recommendations

**D-1 options (B-1):**

| Option | What it means | Consequence |
|---|---|---|
| **A (recommended)** | PA authorizes replacing exactly two tests in `contract-architecture.spec.ts` with NEM-022 guards: (i) contract imports allowed only in `knowledge/metering/*` and the Gateway layer `knowledge/ai/*` (and no other knowledge folder); (ii) `sessions/*` may use the Gateway but never imports the contract, the cost ledger, or pricing directly; (iii) router allowlist and simulated-only checks unchanged. The other four D-2 tests stay unchanged. The contract **source** tree (`6342668…`) and every fixture and golden vector stay unchanged; `CONTRACT_VERSION` stays `1.0.0`. The new test-tree hash is recorded as the updated approved baseline | Same pattern as NEM-021 D-2. Keeps controlled wiring for the next phase |
| B | Keep the guards | NEM-022 cannot be implemented as specified |

**D-2 options (B-2):**

| Option | What it means | Consequence |
|---|---|---|
| **A (recommended)** | Turns move onto the per-attempt cost ledger through Gateway v2, which NEM-021 R-3 anticipated ("until NEM-022 moves turns onto attempts"). The PO authorizes one **intent-preserving** amendment set to the NEM-019 turn tests: `turn.service.spec.ts`, the turn-related cases in `ledger.int-spec.ts` and `sessions.int-spec.ts`, and the harness wiring in `it-env.ts`. Every turn-order step, lock, held-on-unknown, reconcile-once, and fail-closed assertion is kept, re-expressed on attempt keys and the cost ledger. NEM-019 ledger-only tests (legacy `reserve`/`settle` called directly) stay unchanged, because the legacy API remains | One accounting path for turns, with per-attempt retries and micro-USD guard. Records one explicit, PO-approved exception to "unchanged" (as NEM-021 D-1) |
| B | Turns stay on the legacy ledger. Gateway v2 is introduced **alongside** the current Gateway; `TurnService` keeps the current Gateway, so NEM-019 tests are fully unchanged. End-to-end cost settlement (§5.9, AC-8) is proven through Gateway v2 directly; §5.10 is deferred to a later mission | No NEM-019 test changes, but §5.10 is not delivered (needs a specification amendment), and turns stay units-only |
| Not viable | Double reservation (legacy turn + per-attempt) | Halves effective user allowance; fails NEM-019 exact-budget tests |

## 12. Changes made

- **New branch** `feat/nem-022-gateway-simulator-v2` (from `f946124`).
- `docs/engineering-missions/APPROVED/NEM-022-provider-independent-ai-gateway-and-simulator-v2.md`: execution authorization recorded; status BLOCKED.
- `docs/engineering-missions/README.md`: NEM-022 register row.
- `docs/reports/2026-11-09-NEM-022-gateway-simulator-v2-report.md`: this report.

**No application code, tests, fixtures, migrations, dependencies, configuration, CI/CD, or infrastructure changed.** The probe file was never staged and has been deleted.

## 13. Tests and validation

| Run | Result |
|---|---|
| Frozen tree hashes at the branch point (`git rev-parse HEAD:<path>`) | Both match (§3) |
| Probe: `npx jest tests/unit/knowledge/ai/contract/contract-architecture.spec.ts` with one `ai/` file importing the contract | 2 failed, 11 passed (F-1) |

**Not run:** NEM-022 tests (no NEM-022 code exists). The full regression was last run green at the accepted NEM-021 head (Phase 2 report §18.5: contract 212, unit 1,521, integration 93), and no code has changed since.

## 14. Deviations and discoveries

- Two accepted baselines (the frozen D-2 guards and the NEM-019 turn tests) encode "Gateway and turns are not yet on the contract or cost ledger". NEM-022 exists to change exactly that, so the conflict is structural and expected. It still needs explicit decisions under the freeze and the "unchanged tests" rules.

## 15. Protected-systems confirmation

Not modified: reader, Escucha Activa, sync, ownership, `user_books`, `fragments`, tokens, Stripe, subscriptions, `app.module.ts`, every NEM-019 and NEM-021 file and test, the frozen contract source and tests, migrations, web, mobile, worker, CI/CD, Docker, infrastructure, staging, production. No provider, credential, network call, or AI cost.

## 16. Open questions

- D-1 (PA) and D-2 (PA, plus PO for option A).
- Once unblocked, these points would be decided under engineering authority and recorded in the completion report:
  - structured-output validation via a small in-module validator (no new dependency);
  - the retry bound as configuration (fixture value only);
  - Gateway v2 placed in new files under `knowledge/ai/`.

## 17. Next recommended action

PA decision on D-1 and D-2 (and the PO decision if D-2 option A is chosen). On approval, start from this branch: apply the approved test amendments first as a separate commit, show the NEM-019 and NEM-021 suites green on them, then implement §5 items 1–12. *(Recommendation only; nothing is executed automatically.)*
