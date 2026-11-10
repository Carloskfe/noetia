# NEM-022 — Completion Report: Provider-Independent AI Gateway and Simulator v2

**Status:** **IMPLEMENTED AND VERIFIED — AWAITING PRODUCT ARCHITECTURE REVIEW.** §5 items 1–12 are implemented. Every acceptance criterion (§11, AC-1 to AC-11) is proven by tests run in this session, including a fresh disposable PostgreSQL run. **NEM-022 is not accepted**: that needs the independent Product Architecture review (§19) and a separate Product Owner decision.
**Delivery state:** Not merged · Not deployed · Draft PR (stacked on NEM-021 PR #50).
**Revision:** 2 (2026-11-09). Supersedes revision 1, the pre-execution BLOCKED report (kept as history in §14).

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
| R-4 | Low | **Streaming deltas carry text before validation.** Origins are asserted only in validated `segment` events, and a scope violation ends with `terminal.scopeViolation` and no segments, so stream consumers must discard deltas in that case. `TurnService` uses `invoke` and never exposes deltas |
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
