# NEM-022 — Completion Report: Provider-Independent AI Gateway and Simulator v2

**Status:** **COMPLETED — ACCEPTED (PO, 2026-11-10)** as a completed, disconnected development implementation at commit `f6a5cb7`, following independent Product Architecture re-review. F-1, F-2, and F-3 accepted as resolved for the reviewed implementation (§20). **Open:** the global API branch-coverage shortfall (77.49% vs 80%) is **not waived**; the intermittent test failure disclosed in §19.3 stays a monitoring note. *Historical status (revision 4):* "Re-review finding F-3 addressed — returned for Product Architecture re-review." §1–§19 are preserved unchanged as the record.
**Delivery state:** Accepted · Not merged · Not deployed · Not production-authorized · **Draft PR #51** (stacked on NEM-021 PR #50).
**Revision:** 4 (2026-11-09). §18 answers the first Product Architecture review (F-1, F-2) and §19 the re-review (F-3). **Current results (code HEAD `58ec673`):** unit 1,687/1,687 (NEM-022 166) · contract 212/212 · integration 111/111 (NEM-019 56, NEM-021 37, NEM-022 18) · tsc 0 · eslint 0 errors. Sections 1–17 are the revision 2 record; where §18 changes a statement, §18 wins. Revision 1 was the pre-execution BLOCKED report (history in §14).

---

## 1. Mission and objective

| Item | Value |
|---|---|
| Mission | NEM-022 — Provider-Independent AI Gateway and Simulator v2 (E2), specification Revision 3 (PO-032) |
| Type | IMPLEMENTATION |
| Authorization | PO *"Product Owner Execution Authorization: NEM-022"* (2026-11-09), §5 items 1–12 |
| Pre-execution decisions | **D-1, Option A — approved by Product Architecture** (2026-11-09): replace only the two obsolete Phase-2 boundary guards in `contract-architecture.spec.ts` with NEM-022 guards; keep every other frozen protection; record the new test-tree hash; contract source unchanged. **D-2, Option A — recommended by Product Architecture and confirmed by the Product Owner** (2026-11-09, explicit confirmation in session): migrate `TurnService` to the Gateway v2 per-attempt path, with only the minimum intent-preserving amendments to `turn.service.spec.ts`, the turn-related assertions in `ledger.int-spec.ts` and `sessions.int-spec.ts`, and the harness wiring in `it-env.ts`; no double reservation; no second accounting path for a turn |
| Excluded | Merge, deployment, schemas or migrations, infrastructure, CI/CD, real providers, SDKs, endpoints, credentials, paid AI, AI costs, protected systems, other missions, changing NEM-019/NEM-021 tests beyond D-1 and D-2 |

## 2. Date and status

2026-11-09. Lifecycle: Authorized → BLOCKED (pre-execution) → unblocked by D-1 and D-2 → implemented → verified → **awaiting review**.

## 3. Repository baseline and commits

| Item | Value |
|---|---|
| Branch | `feat/nem-022-gateway-simulator-v2`, from the accepted NEM-021 head `f946124` (ancestry: NEM-021 PR #50 → #49 → … → #46) |
| Code HEAD verified | `1261832c80d9dfb5565b047726463c876b9be5b0` |
| Frozen contract source tree | `634266826c934e3d615a7342a04a5e7458c6a84d`: **unchanged** (no diff under `src/knowledge/ai/contract`) |
| Contract test tree | `d8de089…` (NEM-021 approved) → **`52aec852e9843e739aada63688b0d291f74e5458`** (D-1). Only `contract-architecture.spec.ts` changed. **This is the new approved test-tree baseline**, pending PA confirmation in this review |

| Commit | Content |
|---|---|
| `1d84116` | docs: authorization recorded; BLOCKED at pre-execution (revision 1) |
| `5e09f85` | **test: approved test amendments D-1 and D-2** (separate commit, as instructed). These reference the new Gateway, so they compile and pass from the next commit on |
| `0c54468` | feat: Gateway v2, simulator v2, `TurnService` migration, and NEM-022 test suites |
| `1261832` | fix: stop the provider call when a stream consumer abandons it (found while writing this report, §7 F-6) |
| *(docs commit)* | This report, technical note §12, mission status, register |

## 4. Scope

**In scope (done):** §5 items 1–12. **Out of scope (untouched):** real adapters, retrieval, sessions beyond the turn stub, product values, schema, CI, infrastructure, deployment. No contract v1.x addition was needed (§16).

## 5. Executive summary

NEM-022 delivers a provider-independent Gateway on frozen contract v1:
- **Negotiation and accounting:** capability negotiation over a simulated-only allowlist, a per-attempt reservation through the NEM-021 cost ledger before any provider call, and normalization of every result onto exactly one §9.3 row, with evidence discipline.
- **Calls:** bounded retries, each a new reserved attempt; streaming with abort and timeout.
- **Output:** validated structured output, and citation and origin enforcement.

Simulator v2 is deterministic and emulates caching, tiers, refusals, rate limits, timeouts, partial streams, and malformed output. The reusable `runProviderContract` suite passes against both simulator models, and a self-test shows deliberately broken adapters fail it.

`TurnService` now reserves and settles through the Gateway with an **unchanged turn order** and a single accounting path.

Results, this session, at code HEAD `1261832`:

| Suite | Result |
|---|---|
| API unit | **1,673/1,673** (112 suites); NEM-022 unit **152/152** |
| NEM-021 contract | **212/212** |
| Integration, fresh disposable PostgreSQL 16 + Redis 7 | **108/108** |
| TypeScript (build and test configs) | 0 errors |
| ESLint | **0 errors**; the warnings are `no-explicit-any`, all in test files |

The 108 integration tests break down as:
- NEM-019: 56/56. `sessions.int-spec.ts` and `account-deletion.int-spec.ts` pass **unchanged**; only five turn tests in `ledger.int-spec.ts` were amended (D-2).
- NEM-021: 37/37.
- NEM-022 end to end: 15/15.

## 6. Work completed

1. Recorded D-1 and D-2. Applied the approved test amendments as a separate commit (`5e09f85`):
   - **D-1:** the two guards replaced with "contract imports only in `metering/` and the Gateway layer `ai/`" and "`sessions/*` never imports the contract, cost ledger, rate cards, or legacy ledger; the turn service uses Gateway v2".
   - **D-2:** `turn.service.spec.ts` (27 tests, same count, same intent), five full-turn tests in `ledger.int-spec.ts`, and the `it-env.ts` wiring.
2. Implemented Gateway v2 (`src/knowledge/ai/gateway/`: types, templates, router, normalizer, citation policy, structured output, service) and simulator v2 (`src/knowledge/ai/simulator/`).
3. Migrated `TurnService` (step 3 `prepare`, step-4 failure `release`, steps 5–6 `invoke`). Swapped the module registrations to Gateway v2. The legacy Gateway, router, and simulator files are unchanged and no longer registered.
4. Added config (all optional) and three metrics.
5. Wrote the provider contract suite and its self-test, unit suites for every component, architecture and security tests, and the PostgreSQL end-to-end suite.
6. Verified: full unit regression, fresh-DB integration, tsc, ESLint, frozen-tree and protected-file checks. Containers removed.

## 7. Verified findings and design evidence

- **F-1. Turn order preserved (AC-9).** The reservation happens before the lock: `gateway.prepare` reserves attempt 1 at step 3. A lock failure releases a never-sent attempt. The provider call and settlement happen after the lock.
  - Asserted in the unit spec: `reserveAttempt` before the provider `invoke`, before `settleAttempt`.
  - Integration: lock failure → `['reservation', 'release']` on the attempt key, no provider call.
  - The Context Builder and its invariant code are unchanged; all its tests pass unchanged.
- **F-2. One accounting path per turn (D-2).** `turn.service.ts` imports neither the legacy ledger nor rate cards (D-1 guard). Per-turn units are the contract worst case from the fixture unit weights, so there is no double reservation.
- **F-3. The Gateway never decides settle/hold/release.** It produces normalized usage only; `CostLedgerService.settleAttempt` applies `ledgerActionFor` (architecture test: no ledger-action literals in Gateway code). Evidence discipline is enforced twice:
  - the contract validator rejects zero claims without evidence;
  - the Gateway downgrades `documented_no_charge` for an undeclared class to `unknown` (held).
- **F-4. Test-side corrections during the work** (no product defect):
  - a sealed-context spread kept its symbol brand, so the "unsealed" fixture was rewritten;
  - a wall-clock retry-after assertion was replaced by an event-gap measurement (the Gateway waited 44 ms for a 40 ms retry-after);
  - the contract harness threw instead of reporting on invalid records, and now reports;
  - the concurrency test admitted everyone until admissions were raced with all reservations held;
  - a failing first test cascaded leftover simulator scripts into the next test.
- **F-5. NEM-019 integration coupling was smaller than the D-2 authorization allowed.** Only the five full-turn tests in `ledger.int-spec.ts` needed amendment. `sessions.int-spec.ts` and `account-deletion.int-spec.ts` pass with the harness wiring alone. The harness maps NEM-019's legacy simulator vocabulary onto simulator v2:
  - failure with unknown usage → `provider_unavailable` (held);
  - failure with known usage → refusal with complete usage (settled);
  - abort → stream without usage (held);
  - hang → timeout;
  - throw → internal.
- **F-6. Abandoned streams (fixed in `1261832`).** A consumer that stopped iterating left the simulated call un-aborted. The attempt's `finally` now aborts the provider call; the attempt stays held (fail closed). Unit-tested.

## 8. External references

None. No provider documentation, price, endpoint, or network resource. All prices are E1 fixtures.

## 9. Risks and limitations

| ID | Rating | Item |
|---|---|---|
| R-1 | Low | **Legacy files kept.** `model-gateway.service.ts`, `model-router.service.ts`, `simulated-provider.service.ts` (and `model-provider.ts` types) are unchanged and unregistered, kept only because their NEM-019 unit test must pass unchanged. Removal is a later cleanup that needs that test retired |
| R-2 | Low | **Retries are off by default** (`maxProviderAttempts` 1, `maxRetryDelayMs` 0). They are operational settings and need configuration to take effect; enabled only in tests |
| R-3 | Info | **AC-8 "under-priced schema"** is exercised as actual usage beyond the reservation (the simulated provider ignores `max_tokens`). Reservation and settlement use the same pinned schema, so a cheaper schema alone cannot create actual > reserved in simulation. The model error is equivalent, and so is NEM-021 AC-9's approach. The full actual is settled once, the overrun is classified, and the breaker opens |
| R-4 | ~~Low~~ **Resolved in revision 3 (§18, F-1)** | **Streaming deltas carried text before validation.** Origins are asserted only in validated `segment` events, and a scope violation ends with `terminal.scopeViolation` and no segments, so stream consumers must discard deltas in that case. `TurnService` uses `invoke` and never exposes deltas |
| R-5 | Low | Context item `text` is optional and invented fixture text only, until a retrieval mission supplies content |
| R-6 | Info | The research-turn instruction template is engineering text (not customer-visible copy) and needs product review before any launch |
| R-7 | Info | Operational defaults: a turn output bound of 1,024 tokens, 0 billable tool calls per turn, and a 100 ms abort grace. Not product values |
| R-8 | Info | Integration tests are not in CI (no PostgreSQL there); raw output is in §13 |

**Unresolved failures:** none.

## 10. Decisions

**(a) Made under existing authority:**
- New files under `ai/gateway` and `ai/simulator`.
- The JSON-Schema-subset validator in-module (no new dependency; `ajv` is only transitive).
- Simulator models derived from the E1 fixtures with `estimated` counting.
- The contract harness lives in tests (`tests/.../support/provider-contract.ts`); no test code in `src`.
- A call aborted before it starts is released as never sent.
- No retry after any delta.
- Gateway conditions override adapter claims.

**(b) Requiring review:** Product Architecture to confirm the new approved contract test-tree hash `52aec85…` (D-1) and to review R-1 to R-4.

## 11. Acceptance-criteria matrix (§11)

| AC | Requirement | Status | Evidence (executed this session) |
|---|---|---|---|
| 1 | Negotiation selects only satisfying descriptors; `capability_unavailable` before any reservation | Complete, tested | `capability-router.service.spec` (refusals, per-feature, ordering); Gateway spec (no `reserveAttempt`, metric); e2e (0 reservation rows) |
| 2 | Every error → one §9.3 row; retries only for retryable rows, each a new reserved attempt, retry-after honoured; `context_too_large` and `capability_unavailable` before reservation; release only on evidenced zero | Complete, tested | `attempt-normalizer.spec` (every row, evidence); Gateway retry specs (attempts 1/2 reserved separately, 44 ms ≥ 40 ms retry-after, non-retryable, cap, after-deltas, denied retry); e2e rows (unevidenced held, evidenced released, undeclared `documented_no_charge` held) |
| 3 | Streaming order; abort cancels the call → `client_abort` / `aborted`, partial or unknown held | Complete, tested | Gateway spec (event order, mid-stream abort with partial usage, pre-start abort released, abandoned stream aborts the call); e2e client abort held at the reserved amount |
| 4 | Structured output: valid passes; invalid → `completed` + `malformed_output`, settled; never unvalidated | Complete, tested | `structured-output.spec`; Gateway spec; e2e malformed settled |
| 5 | Citation outside the sealed set → scope-violation path; `library` without valid citation never returned as `library` | Complete, tested | `citation-policy.spec`; Gateway spec (violation, metric, settled once; relabel); turn spec AC-14 |
| 6 | Simulator v2 reproduces cache write/read, tier repricing, refusals, 429s, timeouts, malformed output, deterministically | Complete, tested | `simulator-v2.spec` (identical events for the same seed and clock; cache write → read → re-write after expiry; automatic writes; tier −1 vs 0 via E1 `priceUsage`) |
| 7 | `runProviderContract(simulatorV2)` passes; a broken adapter fails | Complete, tested | `provider-contract.spec`: 17 scenarios plus golden vectors × 2 models pass; 12 broken-adapter variants plus pricing, non-simulated, and missing-scenario self-tests all fail as required |
| 8 | End to end through the E1 ledger: invariant at every admission under concurrency; settled + held ≤ allowance within reservations; overrun counted once, breaker opens, later admissions denied | Complete, tested | `gateway-e2e.int-spec` (15 tests: success exact pricing, retry, eight contract rows, abort, malformed, pre-reservation denials, 16-user race, overrun) |
| 9 | NEM-019 turn order and Context Builder tests pass unchanged; every path declares an invariant with a proving test | Complete, tested (D-2 amendments only) | Turn order preserved and asserted; Context Builder tests unchanged; NEM-019 `architecture.spec` (path registry, Gateway callers, sealers) passes unchanged |
| 10 | Dark: flag off → no module, no route; no SDK, HTTP client, or credentials; no non-simulated provider | Complete, tested | `gateway-architecture.spec`; NEM-019 `architecture.spec` (AC-18, routes) unchanged; router registration refusal |
| 11 | All NEM-019 and E1 suites pass unchanged | Complete, tested (D-1/D-2 exceptions only) | Unit 1,673/1,673; integration NEM-019 56/56, NEM-021 37/37; contract 212/212 |

**§5 items:** 1 Gateway on contract v1 ✓ · 2 negotiation ✓ · 3 errors and retries ✓ · 4 streaming ✓ · 5 structured output ✓ · 6 citations ✓ · 7 simulator v2 ✓ · 8 contract suite ✓ · 9 end-to-end settlement ✓ · 10 turn integration ✓ · 11 dark and security tests ✓ · 12 technical note (§12) and this report ✓.

## 12. Changed-file inventory (`1d84116..1261832`)

**New production code** (`src/knowledge/ai/`):

| File | Lines |
|---|---|
| `gateway/ai-gateway.service.ts` | 298 |
| `gateway/gateway.types.ts` | 174 |
| `gateway/attempt-normalizer.ts` | 100 |
| `gateway/citation-policy.ts` | 73 |
| `gateway/structured-output.ts` | 73 |
| `gateway/instruction-templates.ts` | 61 |
| `gateway/capability-router.service.ts` | 54 |
| `simulator/simulator-v2.ts` | 233 |
| `simulator/simulator-fixtures.ts` | 53 |

**Changed production code:**

| File | Change |
|---|---|
| `sessions/turn.service.ts` | +52/−52 (D-2) |
| `knowledge.module.ts` | +10/−9 (registrations) |
| `common/knowledge-config.ts` | +24 (optional settings) |
| `common/knowledge-metrics.service.ts` | +11 (3 counters) |
| `ai/verified-context.ts` | +5 (optional fixture `text`) |

**New tests:**
- Unit (`tests/unit/knowledge/ai/`): `gateway/ai-gateway.service.spec`, `attempt-normalizer.spec`, `capability-router.service.spec`, `citation-policy.spec`, `structured-output.spec`, `instruction-templates.spec`, `gateway-architecture.spec`, `provider-contract.spec`, `support/provider-contract.ts`, and `simulator/simulator-v2.spec`.
- Integration: `tests/integration/knowledge/gateway-e2e.int-spec.ts`.

**Amended under approval:**

| File | Change | Approval |
|---|---|---|
| `contract-architecture.spec.ts` | +16/−9 | D-1 |
| `turn.service.spec.ts` | +70/−50 | D-2 |
| `ledger.int-spec.ts` | +15/−7 | D-2 |
| `support/it-env.ts` | +63/−8 | D-2 |

**Not changed:**
- the contract source, fixtures, and golden vectors;
- every migration, `package.json`, `app.module.ts`, users, metering (cost ledger included), and the legacy AI files;
- `sessions.int-spec.ts` and `account-deletion.int-spec.ts`;
- CI/CD, Docker, and infrastructure.

## 13. Tests and validation (raw output, this session)

Unit: `npx jest --maxWorkers=2`. Integration: `jest -c jest.integration.config.js --runInBand` on freshly created `postgres:16-alpine` (512 MB) and `redis:7-alpine` (128 MB) containers at code HEAD `1261832`; containers removed afterwards (`docker ps -a --filter name=nem022` → 0).

```
# API unit regression (+ knowledge coverage)
Test Suites: 112 passed, 112 total
Tests:       1673 passed, 1673 total          (1,521 at NEM-021 acceptance + 152 NEM-022)
All files                            |   98.36 |    94.38 |   96.72 |   99.61 |
  ai-gateway.service.ts              |   95.18 |    93.87 |   88.46 |     100 |
  attempt-normalizer.ts              |      90 |    94.59 |     100 |     100 |
  capability-router.service.ts       |     100 |      100 |     100 |     100 |
  citation-policy.ts                 |     100 |      100 |     100 |     100 |
  instruction-templates.ts           |     100 |     87.5 |     100 |     100 |
  structured-output.ts               |     100 |    98.14 |     100 |     100 |
  simulator-fixtures.ts              |     100 |      100 |     100 |     100 |
  simulator-v2.ts                    |     100 |    95.23 |     100 |     100 |
  knowledge-config.ts                |     100 |      100 |     100 |     100 |
  knowledge-metrics.service.ts       |     100 |      100 |     100 |     100 |
  turn.service.ts                    |   98.66 |    83.87 |   85.71 |     100 |

# NEM-022 unit (gateway + simulator dirs)       Tests: 152 passed, 152 total
# NEM-021 contract (incl. D-1 guards)           Tests: 212 passed, 212 total
# Provider contract suite: 17 scenarios + golden vectors, both simulator models; self-test variants all fail as required

# Integration — fresh disposable PostgreSQL 16 + Redis 7
ledger 24 · sessions 25 · a-schema-migrations 6 · account-deletion 1   (NEM-019: 56)
cost-ledger 34 · cost-migration 3                                     (NEM-021: 37)
gateway-e2e 15                                                        (NEM-022: 15)
Test Suites: 7 passed, 7 total
Tests:       108 passed, 108 total
    ✓ success: the reservation is the E1 worst case and the settlement is exactly E1 priceUsage of the usage, with the pinned schema
    ✓ retry: each attempt reserves separately; an unevidenced rate limit stays held, an evidenced one is released
    ✓ contract row through the ledger: refusal with complete usage
    ✓ contract row through the ledger: refusal with partial usage
    ✓ contract row through the ledger: timeout
    ✓ contract row through the ledger: partial stream that ends without usage
    ✓ contract row through the ledger: invalid request without evidence
    ✓ contract row through the ledger: invalid request with provider-reported zero
    ✓ contract row through the ledger: undeclared documented_no_charge is held, never released
    ✓ contract row through the ledger: provider unavailable
    ✓ client abort mid-stream: client_abort / aborted with partial usage, held at the reserved amount
    ✓ structured output that fails validation is completed + malformed_output and settled
    ✓ capability_unavailable and context_too_large are decided before any reservation
    ✓ admission invariant under concurrent distinct users through the Gateway; settled + held ≤ allowance when usage stays within reservations
    ✓ overrun (the simulated provider ignores max_tokens): full actual settled once, overrun classified, breaker opens, later admissions denied

# First integration run after the TurnService migration (before the D-2 test amendments): only the five
# full-turn tests in ledger.int-spec failed (rows read by turn key, legacy settlement statement, worst-case units);
# sessions.int-spec and account-deletion.int-spec passed unchanged.

# TypeScript: tsc -p tsconfig.json → 0 · tsc -p tsconfig.test.json → 0
# ESLint (src/knowledge, tests/unit/knowledge, tests/integration/knowledge): 0 errors, 215 warnings (no-explicit-any, test files)
```

**Not executed:** CI (no PostgreSQL), staging, production, any real provider or network call.

## 14. Deviations and history

- **Revision 1 (pre-execution, `1d84116`):** BLOCKED on B-1 (frozen Phase-2 guards) and B-2 (turn integration vs. "NEM-019 suites unchanged"). Resolved by D-1 (PA) and D-2 Option A (PA recommendation plus PO confirmation).
- The D-2 authorization allowed amending `sessions.int-spec.ts`; that proved unnecessary (F-5).
- One fix after the implementation commit (`1261832`, F-6), with the full regression re-run afterwards.

## 15. Protected-systems confirmation

Not modified:
- reader, Escucha Activa, sync, ownership, `user_books`, `fragments`;
- tokens, Stripe, subscriptions;
- `users.service.ts`, `app.module.ts`;
- every migration (no schema change);
- the frozen contract source, fixtures, and golden vectors;
- the NEM-021 cost ledger and configuration services;
- web, mobile, worker, CI/CD, Docker, infrastructure, staging, production.

NEM-019 and NEM-021 tests are changed only as approved (D-1, D-2). No provider, SDK, endpoint, credential, paid service, or AI cost. Dark: the module still loads only behind `KNOWLEDGE_MODULE_ENABLED`, and no route was added.

## 16. Contract v1.x additions

**None.** Gateway v2 consumes contract v1 as frozen. No new error category, outcome, or field.

## 17. Next recommended action

Independent **Product Architecture review** (`REVIEW-CHECKLIST.md`), including confirmation of the new contract test-tree hash `52aec85…` and R-1 to R-4, then a separate **Product Owner acceptance decision**. *(Recommendation only. Not merged, not deployed; no other mission started.)*

---

## 18. Revision 3 — response to the Product Architecture review (2026-11-09)

**Review:** independent Product Architecture review of Draft PR #51 (head `4fad503`). Findings: **F-1** (HIGH, unvalidated streaming deltas) and **F-2** (MEDIUM, context ownership). Both are **confirmed and fixed** in commit **`3c49755`**. Frozen contract v1 is unchanged (source tree `6342668…`; contract test tree still `52aec85…`). No schema, migration, protected-system, provider, network, infrastructure, or CI change.

### 18.1 F-1 (HIGH) — unvalidated streaming deltas: fixed, fail closed

**Finding confirmed.** `runAttempt` yielded each provider delta immediately, so text could reach a streaming consumer before the attempt's citations, origins, and tool scope were validated. Any later violation could drop the final segments but could not retract delivered text. The same path also streamed raw structured-output JSON before schema validation.

**Why a per-segment release is not fail closed.** In the adapter stream, a citation or a `tool_call` may arrive at **any point until the `final` event**. A tool-scope violation can therefore arrive after every segment looks complete and validly cited. Releasing a segment early, even after its own citations check out, could still leak text that the whole-attempt check later rejects.

**Fix.** Deltas are buffered per segment for the whole attempt. They are released only after:
1. the adapter's `final` event (or the attempt's end by timeout, abort, or failure);
2. normalization onto the §9.3 table;
3. `enforceCitations` over **all** segments and **all** tool calls.

Release happens only when the attempt is answered (`completed` or `refused`), has no scope violation, and is in text mode. The buffered chunks are then yielded in their original order and chunking, and each segment's chunks are followed by its validated `segment` event (origin and citations). In every other case nothing is yielded:
- any violation;
- `timed_out`, `aborted`, `failed`, or `rejected`;
- structured output, whose validated object is only in `terminal.response.structured`.

The retry rule is unchanged in effect: no retry once the provider has streamed output in an attempt (`providerStreamed`), so partial output is never paid for twice.

**Tradeoff (documented; technical note §12).** Incremental delivery is now **per attempt, not per provider token**. A consumer sees the first delta only after the attempt finishes and validates, so time to first token equals the attempt's duration. The stream contract is otherwise preserved: event types, order (per segment: deltas → `segment`; then `usage`, `terminal`), and original chunking.

A finer-grained release would require a stronger adapter contract that guarantees segment closure and no tool calls after text. That would be an adapter-contract change, not proposed here; it would need its own review.

**Supersedes `1261832`.** That fix aborted the provider when a consumer abandoned the stream mid-attempt. A consumer now receives no event while the provider streams, so there is no mid-attempt point to abandon. The `finally { ctrl.abort() }` stays, so every attempt's provider call is stopped when its read loop ends. Its test was replaced by one asserting that only `usage` and `terminal` reach the consumer from a timed-out attempt.

**Evidence** (`ai-gateway.service.spec.ts`, describe *"review F-1"*, 7 tests):

| Test | Asserts |
|---|---|
| Out-of-scope citation arriving **after** the text | 0 `delta` and 0 `segment` events; `scopeViolation: true`; usage settled once |
| Disallowed tool call arriving **after** all text and valid citations | 0 deltas |
| Release timing | The first delta is observed only after the adapter yielded its `final` event (instrumented adapter) |
| Partial text then timeout; partial text then stream end without usage | 0 deltas |
| Structured output, even when valid | 0 deltas; object only in the terminal response |
| Released content | The released deltas for each segment concatenate exactly to the validated segment text; a relabelled origin appears only in `segment` events |

Also:
- Architecture guard (`gateway-architecture.spec.ts`): exactly one `yield { type: 'delta'` in the Gateway, located after `enforceCitations(`.
- End to end (`gateway-e2e.int-spec.ts`): an unauthorized citation streams nothing, while the attempt is still settled exactly once (`['reservation', 'settlement']`). The client-abort test now also asserts that no partial text was released.

**Mutation check** (old early-release `yield` restored inside the read loop, file restored by a shell `trap`, restore verified): **all 7 F-1 tests fail**:

```
✕ a citation outside the allowed set arriving AFTER the text: no delta or segment is ever emitted
✕ a tool call naming a disallowed book arriving AFTER all text and valid citations: nothing is emitted
✕ the first delta is released only after the adapter has sent its final event (whole-attempt validation)
✕ a timeout after partial text releases no text
✕ a stream that ends without usage after partial text releases no text
✕ structured output is never streamed: no delta even when valid; the validated object is only in the terminal response
✕ released deltas are exactly the validated segments (relabelled origins are asserted only in segment events)
Tests: 7 failed, 29 skipped, 36 total
```

**Existing tests adjusted to the new contract (not weakened):**
- The event-order test now asserts each segment's deltas precede its `segment` event.
- The client-abort tests abort on a timer, since no delta arrives mid-attempt, and additionally assert that no text was released.
- The retry-after test now times the provider calls (second call ≥ 39 ms after the first for a 40 ms retry-after) instead of consumer receipt, which was flaky (14–36 ms across runs) because receipt timing is not the Gateway's wait. An instrumented run showed the Gateway's wait correct (≈ 42 ms).

### 18.2 F-2 (MEDIUM) — context ownership: fixed

**Finding confirmed.** `prepare` checked the context's seal, path, and invariant, but not that the sealed context (`ctx.userId`) belongs to the user whose budget pays (`request.budget.userId`). `TurnService` always passes matching values, but the Gateway did not enforce it.

**Fix.** In `prepare`, right after the seal and invariant check and **before** template rendering, negotiation, reservation, or any provider call: `ctx.userId !== request.budget.userId` → `IntelligenceDenied('scope_violation')` and `intelligence_scope_violation_total` is incremented.

**Evidence:**
- Unit (*"review F-2"*, 2 tests): a context sealed for another user, and a budget naming another user, are both rejected with `scope_violation`; `reserveAttempt` is not called; the adapter's `invoke` is not called; the scope-violation metric is incremented; no capability metric fires.
- End to end: a foreign context leaves **0 reservation rows** and makes no provider call.
- Architecture guard: the ownership check precedes the reservation call.

### 18.3 Changed files (revision 3, `3c49755`)

- `src/knowledge/ai/gateway/ai-gateway.service.ts` (+29/−12).
- `tests/unit/knowledge/ai/gateway/ai-gateway.service.spec.ts`: F-1 and F-2 tests, adjusted tests.
- `tests/unit/knowledge/ai/gateway/gateway-architecture.spec.ts`: guard.
- `tests/integration/knowledge/gateway-e2e.int-spec.ts`: two tests added, abort test adjusted.

Not changed: the contract, migrations, metering, sessions (`TurnService` uses `invoke`, unaffected), NEM-019 and NEM-021 tests, and everything else.

### 18.4 Tests and validation, revision 3 (raw, this session, code HEAD `3c49755`)

```
# API unit regression (+ knowledge coverage)
Test Suites: 112 passed, 112 total
Tests:       1683 passed, 1683 total            (+10: 7 F-1, 2 F-2, 1 architecture guard)
All files                            |   98.37 |     94.4 |   96.72 |   99.62 |
  ai-gateway.service.ts              |   95.33 |    93.06 |   88.46 |     100 |
# NEM-022 unit (gateway + simulator)    Tests: 162 passed, 162 total
# NEM-021 contract                      Tests: 212 passed, 212 total
# Gateway spec, three consecutive runs  Tests: 36 passed ×3 (retry-after assertion stable)

# Integration — fresh disposable PostgreSQL 16 + Redis 7 (containers removed afterwards)
ledger 24 · sessions 25 · a-schema-migrations 6 · account-deletion 1   (NEM-019: 56)
cost-ledger 34 · cost-migration 3                                     (NEM-021: 37)
gateway-e2e 17                                                        (NEM-022: 17)
Test Suites: 7 passed, 7 total
Tests:       110 passed, 110 total
    ✓ client abort mid-stream: client_abort / aborted with partial usage, held at the reserved amount; no partial text released
    ✓ review F-1: an unauthorized citation releases no text to the stream, while the usage is still settled exactly once
    ✓ review F-2: a context sealed for another user is rejected before any reservation

# TypeScript: build 0 · test 0
# ESLint (src/knowledge, tests/unit/knowledge, tests/integration/knowledge): 0 errors, 224 warnings (no-explicit-any, test files)
```

**Not executed:** CI (no PostgreSQL), staging, production, any real provider or network call.

### 18.5 Status

F-1 and F-2 are fixed and proven, and the R-4 limitation is resolved by F-1. R-1 to R-3 are unchanged and remain for review. **Returned for independent Product Architecture re-review. NEM-022 is not accepted.** Not merged, not deployed; no other mission started.

---

## 19. Revision 4 — response to the Product Architecture re-review: F-3 (2026-11-09)

**Finding F-3 (HIGH): settlement happened after consumer-visible stream yields.** **Confirmed and fixed** in commit **`58ec673`**. Frozen contract v1, migrations, protected systems, CI/CD, and other application code are unchanged.

### 19.1 Confirmation (deterministic, before the fix)

The F-1 fix released validated `delta` and `segment` events *before* `costLedger.settleAttempt(usage)`. An async generator suspends at each `yield`, so a consumer that stops reading (or calls `return()`) after the first delta never resumes it, and the settlement code never runs.

Regression tests written first and run on the unchanged code (`3c49755`):

```
✕ a consumer that stops after the first delta cannot prevent settlement of a completed attempt
    Expected number of calls: 1   Received number of calls: 0          (settleAttempt)
✕ full consumption: settled exactly once, and before the first delta or segment reached the consumer
✕ ledger failure at settlement: attempted before the first delta, the attempt is held, and an early close changes nothing
✓ scope violation: settled exactly once, nothing released (F-1 preserved)
Tests: 3 failed, 1 passed
```

On real PostgreSQL, with the pre-fix Gateway restored temporarily (file restored by a shell `trap`, restore verified), the early-close attempt was left as `['reservation']` with no settlement row:

```
✕ review F-3: a consumer that closes the stream after the first delta still leaves the attempt settled in the ledger
    - "settlement"     (received ['reservation'] only)
```

### 19.2 Fix

In `runAttempt`, the order after the provider read loop is now:
1. normalize the usage (unchanged);
2. validate citations, origins, and tool scope over the whole attempt (unchanged; F-1);
3. **settle** through `costLedger.settleAttempt` (a ledger failure → `ledger_error`, attempt held; unchanged handling);
4. only then release the buffered, validated deltas and `segment` events (unchanged F-1 rule).

Nothing else changed:
- **F-1:** the release decision and content are identical.
- **F-2:** the ownership check is still before reservation.
- **Normalization:** the §9.3 mapping and evidence discipline are untouched.
- **Idempotency:** one settlement per attempt key, enforced by the cost ledger.
- **Retries:** the decision happens after the attempt returns, on the same fields.
- **Ledger failure:** an attempt that cannot be settled stays held, and the validated answer is still returned, as before.

A consumer that closes the stream early can now only skip *later* events (the rest of the text, later attempts, the terminal event). It can no longer leave a completed attempt unresolved.

Between attempts, the next reservation happens only after the consumer pulls past the `usage` and `retry` events. An early close there simply means no next reservation, so nothing is left unresolved.

### 19.3 Tests

**Unit** (`ai-gateway.service.spec.ts`, describe *"review F-3"*, 4 tests):

| Case | Asserts |
|---|---|
| Early close after the first delta | `settleAttempt` called exactly once with the completed usage; no release |
| Full consumption | Settled exactly once, and settlement had already happened when the consumer saw every `delta` and `segment` |
| Scope violation | Settled once, nothing released |
| Ledger failure | Settlement attempted before the first delta; an early close changes nothing; full consumption reports `ledger_error` and `held`, and the validated answer is still returned |

**Architecture guard:** `this.costLedger.settleAttempt(usage)` precedes the only `yield { type: 'delta'`.

**Integration** (real PostgreSQL): a consumer that closes after the first delta leaves `['reservation', 'settlement']` and held = 0.

**Test-harness hygiene (found while verifying):** the provider-contract harness raced each call against a 2-second deadline timer it never cleared. That kept Jest workers alive ("A worker process has failed to exit gracefully"). The timer is now cleared, and the warning is gone. It was test code only.

**Honest note:** during verification, one gateway-and-simulator run reported `1 failed, 165 passed`, and the failing test's name was not captured. It did not reproduce in 19 further runs (16 normal, 3 under CPU contention), nor in the final full regression. The most likely candidates are the wall-clock-bounded tests (abort grace and timeout tests in the tens of milliseconds) under load, possibly together with the leaked timer fixed above. If it recurs, those bounds should be widened.

### 19.4 Results (this session)

Unit runs are at code HEAD `58ec673`. The integration run used the same Gateway code; the only later change is the unit-test harness timer.

```
# API unit regression (final, at 58ec673)
Test Suites: 112 passed, 112 total
Tests:       1687 passed, 1687 total              (+4 F-3 unit tests; no worker-exit warning)
# NEM-022 unit (gateway + simulator)  Tests: 166 passed, 166 total   (19 consecutive clean runs after the fix)
# NEM-021 contract                    Tests: 212 passed, 212 total
# Coverage: ai-gateway.service.ts 95.36 stmts / 92.85 branches / 88.46 funcs / 100 lines; knowledge total 98.37 / 94.38 / 96.72 / 99.62

# Integration — fresh disposable PostgreSQL 16 + Redis 7 (containers removed afterwards)
ledger 24 · sessions 25 · a-schema-migrations 6 · account-deletion 1   (NEM-019: 56)
cost-ledger 34 · cost-migration 3                                     (NEM-021: 37)
gateway-e2e 18                                                        (NEM-022: 18)
Test Suites: 7 passed, 7 total
Tests:       111 passed, 111 total
    ✓ review F-3: a consumer that closes the stream after the first delta still leaves the attempt settled in the ledger

# TypeScript: build 0 · test 0      ESLint: 0 errors (225 warnings, no-explicit-any, test files)
```

**Changed files (`58ec673`):**
- `src/knowledge/ai/gateway/ai-gateway.service.ts`: settlement moved before the release step.
- `tests/unit/knowledge/ai/gateway/ai-gateway.service.spec.ts`: 4 tests.
- `tests/unit/knowledge/ai/gateway/gateway-architecture.spec.ts`: guard.
- `tests/unit/knowledge/ai/gateway/support/provider-contract.ts`: deadline timer cleared.
- `tests/integration/knowledge/gateway-e2e.int-spec.ts`: 1 test.

**Not executed:** CI (it does not run on this PR; see the CI baseline investigation), staging, production, any provider.

### 19.5 Status

F-3 is fixed and proven at unit and PostgreSQL level, with F-1 and F-2 preserved. **Returned for independent Product Architecture re-review. NEM-022 is not accepted.** Not merged, not deployed.


---

## 20. Product Architecture re-review outcome and Product Owner acceptance (2026-11-10)

**PO decision (2026-11-10):** *"Record Product Owner acceptance of NEM-022."* The Product Owner accepts NEM-022 as a **completed, disconnected development implementation at commit `f6a5cb7`**, following independent Product Architecture re-review.

| Item | Record |
|---|---|
| Product Architecture re-review | Completed (outcome as stated in the PO decision). **F-1** (fail-closed streaming), **F-2** (context ownership), and **F-3** (settle before any consumer-visible event) accepted as **resolved** for the reviewed implementation |
| Accepted implementation | Branch `feat/nem-022-gateway-simulator-v2`, commit `f6a5cb7` (code `58ec673`); Draft PR #51 |
| **Open — global API branch coverage** | **77.49%** vs the **80%** requirement ([CI baseline investigation](2026-11-09-NEM-022-ci-baseline-investigation.md)). **Not waived** and not considered satisfied. Pre-existing gap on `main` (68.83%); NEM-022 raised it by +1.35 points |
| **Monitoring note — intermittent test failure** | §19.3: one gateway-and-simulator run reported `1 failed, 165 passed`, with the test name not captured. It did not reproduce in 19 further runs or in the final regression. The likely candidates are the wall-clock-bounded abort/timeout tests under load. **If it recurs:** capture the test name and widen those bounds (a separate, authorized change) |
| Not authorized by this acceptance | Merging, deployment, production use, paid AI activation, waiving any coverage requirement |
| Delivery state | Draft PR #51 remains **draft**. Not merged, not deployed |

This section is documentation only; no code, test, migration, contract, CI/CD, or infrastructure changed.
