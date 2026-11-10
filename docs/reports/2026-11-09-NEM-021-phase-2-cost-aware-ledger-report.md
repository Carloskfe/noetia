# NEM-021 — Phase 2 Report: Cost-Aware Ledger

**Status:** **PHASE 2 IMPLEMENTED AND VERIFIED — AWAITING PRODUCT ARCHITECTURE REVIEW.** Every §5 item 7–15 is implemented. Every Phase 2 acceptance criterion (§11, AC-4 to AC-13) is proven by tests that ran in this session on a disposable database. **NEM-021 is not accepted**: that needs the final Product Architecture review (§19) and a separate Product Owner decision.
**Delivery state:** Not merged · Not deployed · NEM-022 not started.
**Revision:** 2 (2026-11-09). Supersedes revision 1, which recorded the pre-execution BLOCKED state (kept as history in §14).

---

## 1. Mission and objective

| Item | Value |
|---|---|
| Mission | NEM-021 — Provider-Neutral AI Contract and Cost Accounting (E1), specification Revision 3 (PO-032) |
| Type | IMPLEMENTATION |
| This iteration | Phase 2 (§5 items 7–15): cost-aware ledger on frozen contract v1 |
| Authorization | PO *"NEM-021 Phase 2 Execution Authorization"* (2026-11-09). The PO later approved **D-1**: an intent-preserving amendment of the NEM-019 migration integration test. Product Architecture approved **D-2**: replacing the Phase-1-only guard with Phase 2 safeguards. The PO's recovery instruction (2026-11-09, after a usage-limit interruption) confirmed that both authorizations remain valid and asked for recovery, completion, and verification only |
| Excluded | NEM-022, merge, deployment (staging or production), providers, credentials, paid APIs, AI costs, infrastructure, CI/CD, changes to frozen contract v1, real prices or budget values, unrelated Noetia functionality |

## 2. Date and status

2026-11-09. Lifecycle: In progress → BLOCKED (pre-execution) → unblocked by D-1/D-2 → implemented (interrupted once by a usage limit) → recovered → **completed, awaiting review**. Delivery: not merged, not deployed.

## 3. Repository baseline and recovery findings

| Item | Value |
|---|---|
| Branch | `feat/nem-021-provider-neutral-contract` (Draft PR #50, stacked on #49 → … → #46) |
| Working copy | Git worktree `/home/carloskfe/Noetia-nem019`. The main checkout is on an unrelated branch and was not touched |
| Head at recovery | `70a47bd` (local = `origin`). Clean apart from the untracked `services/api/node_modules` symlink (dev convenience, never staged) |
| Uncommitted or unpushed work at recovery | None. No stash |
| Frozen contract baseline | `697f8ea947bbb486028d71a8cc5d9931ac9e7ce8` |

**Recovered commits (already pushed before the interruption):**

| Commit | Content | State found |
|---|---|---|
| `9e445b6` | docs: Phase 2 authorization recorded; BLOCKED at pre-execution check | Superseded by this revision |
| `8da1626` | test: approved test corrections D-1 and D-2 | In scope (verified in §7) |
| `70a47bd` | wip: migration 073, cost config, cost ledger, attempt key, reconciliation job, metrics, module, unit and integration tests | Marked "INCOMPLETE". Its own message recorded one failing integration assertion (AC-9 breaker-closure count) and no docs or report |

**New commits in this session:**

| Commit | Content |
|---|---|
| `a006bde` | fix: breaker-closure count (D-A), partial-release guard (D-B), new AC-11/AC-13 integration suite |
| *(docs commit)* | This report, technical note §11, migration 073 entry, mission status, register |

**Recovery verdict.** The WIP was substantial and mostly correct, but not complete. Independent review found:
- the recorded failure, whose root cause is a product bug, not a test bug (D-A);
- a second, unrecorded accounting defect (D-B);
- no integration coverage for AC-11 (account deletion over the new tables) or AC-13 (migration 073 up/down);
- no documentation.

All four gaps are closed in this session (§6).

## 4. Scope and exclusions

In scope: §5 items 7–15, with their tests, documentation, and governance records. Excluded, as instructed: everything in §1 "Excluded". The Gateway, turn path, router, and simulator are **not** wired to the cost ledger: that is NEM-022 (Phase 1 report, F-4). The cost services are registered in `KnowledgeModule`, which stays unregistered in `app.module.ts` (dark). There is no controller.

## 5. Executive summary

Phase 2 delivers a per-attempt, cost-aware ledger on frozen contract v1:
- worst-case micro-USD reservations, pinned to pricing and weight schema versions;
- a global micro-USD allowance enforced under the B-6 global lock;
- evidence-aware settlement, partial settlement, and release;
- once-only accounting of overruns, with a per-schema breaker;
- reconciliation;
- five new metrics.

It is built on NEM-019's append-only ledger table, so both ledgers share the same locks, unique-resolution indexes, and unit bounds.

Results in this session:

| Suite | Result |
|---|---|
| NEM-021 contract (unit) | 212/212 |
| API unit regression | 1,511/1,511 (102 suites). Knowledge coverage: 98.5% statements, 94.0% branches |
| Integration, fresh disposable PostgreSQL 16 + Redis 7 | 85/85: NEM-019 56/56, Phase 2 29/29 |
| TypeScript (`tsconfig.test.json` and `tsconfig.json`) | 0 errors |
| ESLint (changed files) | 0 errors |

The frozen contract source tree is unchanged (`6342668…`).

**Two defects were found and fixed during recovery (§7, D-A and D-B).** One residual design question is flagged for review (§10b, R-1).

## 6. Work completed in this session

1. Recovery inspection: branch, HEAD, remote parity, worktree, stash; recovered-commit inventory (§3).
2. Read the specification, the Phase 1 freeze record, the revision 1 report, and the register.
3. Verified the frozen trees and the D-1/D-2 scope (§7).
4. Reviewed every Phase 2 source file against §5 items 7–15 and §9.1–§9.3.
5. Ran the existing tests. Unit passed; integration had 1 failure (AC-9).
6. **Fix D-A** (`cost-config.service.ts`): breaker closure counted wrongly on real PostgreSQL.
7. **Fix D-B** (`cost-ledger.service.ts`): a partially settled attempt could be released.
8. **New integration suite** `cost-migration.int-spec.ts`: AC-13 and AC-11.
9. New unit tests for D-A and D-B, plus a D-B integration regression test.
10. Full verification from a fresh database. Containers removed afterwards.
11. Documentation: technical note §11, `docs/database-migrations.md` (073), this report, mission status, register, PR #50 description.

## 7. Verified findings and evidence

**Frozen contract (verified at HEAD).**

| Tree | Baseline `697f8ea` | HEAD | Verdict |
|---|---|---|---|
| `services/api/src/knowledge/ai/contract` | `634266826c934e3d615a7342a04a5e7458c6a84d` | `634266826c934e3d615a7342a04a5e7458c6a84d` | **Unchanged** |
| `services/api/tests/unit/knowledge/ai/contract` | `4d01b88fbf027d59a8bd73a158102425a3bb1a6f` | `d8de089995b57b0e86298d9a2609f5dbee08c980` | Changed **only** in `contract-architecture.spec.ts` (D-2). `git diff --stat 697f8ea` lists that single file. **`d8de089…` is the approved updated test-tree baseline** |

The D-2 test also pins, by SHA-256 digest:
- the contract source with its fixtures and golden vectors (`aabc0d14…`);
- the other contract test files (`518dcac7…`);
- the 72 historical migrations (`4d9726fb…`);
- the Gateway, router, provider, paths, simulator, and turn files (`d35dca78…`).

All four digests pass.

**D-1 evidence** (`a-schema-migrations.int-spec.ts`, commit `8da1626`, +32/−4). The positional loop (`for i < 4 undoLastMigration`) is replaced by two steps:
1. revert every migration newer than 072, bounded at 100;
2. revert 072…069 **by name**, asserting the name before each revert.

Every original assertion is kept:
- 10 tables before;
- 0 after the revert;
- snapshot equal after the revert;
- last remaining migration `ReconcilePlanDisplayPrices1748300000067`;
- 10 tables after up;
- zero seeded rights, budget, and rate-card rows;
- snapshot equal, compared at the same "072 is latest" state.

The full schema is then restored. **Scope:** no other NEM-019 test changed. `git diff --numstat 57cc998 HEAD -- services/api/tests` shows deletions only in the D-1 and D-2 files. Every other test change adds a file or adds lines. Result: 6/6 in this suite.

**D-2 evidence** (`contract-architecture.spec.ts`, +74/−5). The single test *"Phase 1 adds no migration and touches no NEM-019 runtime file"* is replaced by five Phase 2 checks:
1. migrations ≥ 073 are additive only, and historical migrations are byte-identical;
2. contract imports are limited to `knowledge/metering`;
3. the Gateway, router, and turn files are unchanged and import no contract or cost code;
4. no money primitive or per-million/bps arithmetic exists outside the contract;
5. the frozen source, fixtures, and golden vectors are pinned by digest.

Contract source unchanged; `CONTRACT_VERSION` stays `1.0.0`.

**D-A — breaker closure miscounted (product bug, fixed).** `activatePricingSchema` returned `closed.length` from a bare `UPDATE … RETURNING`. On PostgreSQL, TypeORM returns `[rows, rowCount]` for UPDATE, so the count was **always 2**. That was the integration failure the WIP commit recorded:

```
● AC-9: injected overrun … › expect(received).toEqual(expected)
-   "closedBreakers": 1,
+   "closedBreakers": 2,
```

The unit mock returned a plain row array, so unit tests hid it. The closure state written to the database was correct; only the returned count was wrong. **Fix:** `WITH closed AS (UPDATE … RETURNING …) SELECT count(*)::int`. The unit mock now models the real statement. AC-9 passes.

**D-B — partial obligation could be released (accounting bug, fixed).** A partial settlement writes `ai_partial_settlements` but, by design, no `ai_usage_events` row: that keeps a later final settlement's evidence free for reconciliation. Two release paths ignored the partial:
- `releaseAttempt` only checked `ai_usage_events`;
- a later evidenced `zero_confirmed` usage released directly.

Either path wrote a release row. Because `globalState` counts partials only for open attempts, the partial amount (e.g. $0.30 of real cost) **left `committed` entirely**. That breaks §9.1 once-only accounting (an obligation counted zero times) and §5.11 (release only on evidenced zero).

**Fix:**
- `releaseAttempt` throws `CostLedgerError`;
- release via `settleAttempt` returns `held`;
- the release `INSERT` itself carries `AND NOT EXISTS (partial)` as a race backstop;
- a blocked release on a still-open attempt reports `held`, not `already_resolved`.

Only a final settlement resolves a partially settled attempt.

**Implementation review: verified points (no change needed).**
- **Admission:** global lock → scope lock with the NEM-019 keys. The global policy is re-read under the lock. Duplicate pre-check, then breaker, scope and overall unit bounds, micro-USD unresolved bound, invariant, and unit allowance. One transaction under the statement timeout (`KnowledgeDbService.transaction`).
- **Pricing:** comes only from the contract (`worstCaseCost`, `priceUsage`, `guardColumn`). BigInt end to end; values above 2⁶³−1 are denied as `column_overflow`.
- **Settlement:** uses the schema id and modifiers pinned on the reservation. The full actual is never capped. The overrun row and breaker are written in the settlement's transaction. Overruns are never summed into `committed` (architecture test).
- **Release evidence:** `provider_reported_zero`, or `documented_no_charge` only when the reservation's pinned `noChargeDeclarations` declare that error class.
- **Idempotency:** one resolution per key (NEM-019 partial unique index; the database refusal is tested). Overruns are unique per attempt. Partials are unique per (attempt, cumulative amount).
- **Reconciliation:** evidence only. Expiry is flagged once. Never releases to zero. Parallel passes are safe.
- **Legacy compatibility:** legacy settle, release, and reconcile see only `attemptNumber IS NULL` rows; see R-1.
- **Privacy:** usage JSON holds counts and enums only, validated by `assertNormalizedUsage`, which rejects extra fields such as `prompt` (unit test). Logs hold counts only. Metric labels carry no user, book, provider, or model.

## 8. External references

None. No provider documentation, price, or network resource was used. All prices are contract fixtures or invented golden values.

## 9. Risks, defects, and limitations

| ID | Rating | Item |
|---|---|---|
| R-1 | Medium (review) | **NEM-019 runtime file touched.** `budget-ledger.service.ts` (+14/−3) exports `UNRESOLVED` and adds `attemptNumber IS NULL` to legacy settle and reconcile. For every row NEM-019 can create (`attemptNumber` is always NULL), behaviour is identical: all 56 NEM-019 integration tests and the unchanged NEM-019 unit tests pass. The filter prevents the legacy path from settling a cost-ledger attempt with units-only semantics. It is inside §5 (item 7 adds the columns to the NEM-019 ledger table, and the shared table requires both services to agree). It is not covered by D-1, so it is flagged for explicit PA confirmation (§10b) |
| R-2 | Low (spec residual, §9.1) | In-flight attempts admitted before a breaker opens may still overrun. This is reported, not prevented |
| R-3 | Low (design) | Legacy NEM-019 turn reservations carry no micro-USD, so they hold 0 in the global state until NEM-022 moves turns onto attempts. Their legacy settlement `costMicroUsd` does count in *settled* |
| R-4 | Low (design) | Partial settlements are cumulative; the **maximum** recorded partial counts. A smaller later partial is ignored, so the count is never lower than the highest reported usage |
| R-5 | Low | The micro-USD Prometheus counters use `Number(bigint)`, because Prometheus counters are floating point. This is observability only: accounting reads the ledger rows. Documented in the code; the BigInt architecture test covers the ledger files |
| R-6 | Low | The settled window is a rolling `periodDays` window (calendar roll-over is configuration; no product value needed). Held exposure counts regardless of age |
| R-7 | Info | Integration tests are not in CI: CI has no PostgreSQL (F-10). Raw output is in §13 |
| R-8 | Info | ESLint reports 63 `no-explicit-any` **warnings**, all in test files (mocks and fixtures), as in Phase 1 and NEM-019. 0 errors |

**Unresolved failures:** none.

## 10. Decisions

**(a) Made under existing engineering authority:**
- D-A and D-B fixes (defects inside authorized Phase 2 code).
- Per-attempt key `<turnKey>:a<n>` (n ≤ 99); one resolution per attempt key.
- Global period: rolling `periodDays` window from the active global policy.
- `releaseAttempt` is reserved for requests that were never sent. Provider-side rejections release only through evidenced `settleAttempt`.
- Breaker scope is per pricing schema id. Closure requires activating a *different* version with a review reference; re-activating the broken schema is refused.

**(b) Requiring review:**

| ID | Decision | Owner |
|---|---|---|
| R-1 | Confirm that the `budget-ledger.service.ts` change (legacy paths restricted to `attemptNumber IS NULL`, `UNRESOLVED` exported) is acceptable as part of §5, or direct an alternative | **Product Architecture** |

## 11. Acceptance-criteria matrix (§11, Phase 2)

| AC | Requirement | Status | Evidence (all executed this session) |
|---|---|---|---|
| 4 | Invariant at every admission (N users, parallel); settled + held ≤ allowance when actual ≤ reserved; exact capacity admitted, +1 µUSD rejected | **Complete, tested** | `cost-ledger.int-spec` AC-4 ×2. 20 users in parallel; the instrumented `committedBefore + reserved ≤ allowance` holds for every admission; serialization proof (each admission saw exactly the sum before it); real PostgreSQL |
| 5 | NEM-019 unit allowances, scope bounds, idempotency unchanged; NEM-019 tests pass unchanged | **Complete, tested** (D-1 the only amendment; R-1 for review) | NEM-019 integration 56/56; unit regression 1,511/1,511; AC-5 coexistence test |
| 6 | Each retry reserves separately; 3 attempts hold 3 reservations | **Complete, tested** | AC-6 |
| 7 | Pinned schema used after a newer one is activated | **Complete, tested** | AC-7 (v2 at 3×; settlement priced with v1; the next admission uses v2) |
| 8 | Unknown/partial holds; outage holds; reconciliation once; replays never double-charge | **Complete, tested** | AC-8 ×4 (incl. concurrent reconcilers and the database refusal) |
| 9 | Injected overrun: exact, classified once, counted once, breaker until reviewed replacement, admissions stop, total = allowance + overruns | **Complete, tested** (after D-A) | AC-9 |
| 9a | Golden accounting 1.00/1.40 → committed 1.40; replay and reconcile ×2 unchanged; partial 1.00 → 1.00 → 1.10 | **Complete, tested** (+ D-B regression) | AC-9a ×3 |
| 9b | No evidence → held; `provider_reported_zero` or declared `documented_no_charge` → released | **Complete, tested** | AC-9b ×4 |
| 10 | Missing schema, count, global policy; insufficient capacity (incl. after overrun); µUSD bound; open breaker → deny before any provider call | **Complete, tested** | AC-10 ×8; the breaker denial is in AC-9; no reservation row written |
| 11 | `deleteAccount` removes every new row; FK schema test covers new tables | **Complete, tested** (added this session) | `cost-migration.int-spec` AC-11 ×2 (9 FKs: the 2 to `users` CASCADE, the rest CASCADE or SET NULL; the unchanged `UsersService.deleteAccount` leaves 0 rows in all 4 user tables; another user's rows survive) |
| 12 | No provider SDK or HTTP client; no schema duplication; no token or subscription imports; router refuses non-simulated | **Complete, tested** | `architecture.spec.ts` (AC-16/17/18), D-2 checks, `cost-architecture.spec.ts`, `model-gateway.service.spec.ts` "refuses a non-simulated provider" |
| 13 | Migrations up/down on a disposable database; no existing table outside NEM-019's set altered | **Complete, tested** (added this session) | `cost-migration.int-spec` AC-13: whole-schema snapshot (columns, constraints, indexes) outside 073's additions is identical with 073, after down, and after up; added columns are all nullable; nothing seeded; legacy `outcome` CHECK intact |

**§5 items 7–15:**

| Item | Status |
|---|---|
| 7 Migrations ≥ 073 | Complete, tested (AC-13, unit `1748300000073…spec`) |
| 8 Cost-aware reservation | Complete, tested |
| 9 Global allowance (D14) | Complete, tested |
| 10 Per-attempt reservation (D15) | Complete, tested |
| 11 Durable settlement | Complete, tested (D-B fixed) |
| 12 Reconciliation | Complete, tested |
| 13 Fail-closed admission | Complete, tested |
| 14 Metrics | Complete, tested (`knowledge-metrics.service.spec`): the four named counters, plus `intelligence_overspend_micro_usd_total` (§9.1 rule 4) and the six NEM-019 counters |
| 15 Tests, technical note, migration entries, report | Complete |

Nothing is partially implemented, missing, or blocked.

## 12. Changes made (Phase 2, `57cc998..HEAD`)

**Source (`services/api/src`):**

| File | Change |
|---|---|
| `migrations/1748300000073-CreateCostAwareLedger.ts` | New (+183) |
| `knowledge/metering/cost-ledger.service.ts` | New (+638) |
| `knowledge/metering/cost-config.service.ts` | New (+236) |
| `knowledge/metering/cost-reconciliation-job.service.ts` | New (+34) |
| `knowledge/metering/attempt-key.ts` | New (+19) |
| `knowledge/knowledge.module.ts` | +7 (registers the three services; no controller) |
| `knowledge/common/knowledge-metrics.service.ts` | +26/−1 (five counters) |
| `knowledge/metering/budget-ledger.service.ts` | +14/−3 (R-1) |

**Tests:**
- New unit suites: `cost-ledger.service.spec`, `cost-config.service.spec`, `cost-reconciliation-job.service.spec`, `attempt-key.spec`, `cost-architecture.spec`, `budget-ledger.legacy-scope.spec`, `1748300000073-CreateCostAwareLedger.spec`.
- Additive: `knowledge-metrics.service.spec`.
- New integration: `cost-ledger.int-spec`, `cost-migration.int-spec`, `support/cost-env`.
- Amended under approval: `a-schema-migrations.int-spec` (D-1), `contract-architecture.spec` (D-2).

**Docs:** this report; technical note `09-…technical-note.md` §11; `docs/database-migrations.md` (073); mission file status; `docs/engineering-missions/README.md` register.

Not changed: CI/CD, Docker, infrastructure, `package.json`, configuration, any other service.

## 13. Tests and validation (raw output, this session)

Unit runs: `npx jest --maxWorkers=2`. Integration runs: `jest -c jest.integration.config.js --runInBand` against disposable `postgres:16-alpine` (512 MB) and `redis:7-alpine` (128 MB) on `127.0.0.1:55432/56379`, database `nem019_test`. The final integration run used a **freshly created** container. Both containers were removed afterwards.

```
# 1. NEM-021 contract tests
$ npx jest --maxWorkers=2 tests/unit/knowledge/ai/contract
Test Suites: 7 passed, 7 total
Tests:       212 passed, 212 total          (208 at freeze; D-2 replaced 1 test with 5)

# 2. Phase 2 unit tests (cost-*, attempt-key, legacy-scope, migration 073, metrics)
Test Suites: 8 passed, 8 total
Tests:       117 passed, 117 total

# 3. Full api unit regression with knowledge coverage
$ npx jest --maxWorkers=2 --coverage --collectCoverageFrom='src/knowledge/**/*.ts'
Test Suites: 102 passed, 102 total
Tests:       1511 passed, 1511 total
All files                            |   98.54 |    93.95 |   96.87 |    99.5 |
  attempt-key.ts                     |     100 |      100 |     100 |     100 |
  budget-ledger.service.ts           |   99.09 |    97.77 |     100 |     100 | 335
  cost-config.service.ts             |   98.11 |    93.33 |     100 |     100 | 62,215-227
  cost-ledger.service.ts             |   98.73 |    93.75 |     100 |     100 | 263,470,487,504,601,627-631
  cost-reconciliation-job.service.ts |     100 |      100 |     100 |     100 |
  knowledge-metrics.service.ts       |     100 |      100 |     100 |     100 |

# 4. Integration — initial run at recovered HEAD 70a47bd (before fixes)
Tests:       1 failed, 80 passed, 81 total
  ● AC-9 … "closedBreakers": expected 1, received 2           (→ D-A)

# 5. Integration — final run, fresh database, HEAD a006bde
PASS tests/integration/knowledge/cost-ledger.int-spec.ts        26 tests
PASS tests/integration/knowledge/cost-migration.int-spec.ts      3 tests
PASS tests/integration/knowledge/ledger.int-spec.ts             24 tests  (NEM-019)
PASS tests/integration/knowledge/sessions.int-spec.ts           25 tests  (NEM-019)
PASS tests/integration/knowledge/a-schema-migrations.int-spec.ts 6 tests  (NEM-019, D-1)
PASS tests/integration/knowledge/account-deletion.int-spec.ts    1 test   (NEM-019)
Test Suites: 6 passed, 6 total
Tests:       85 passed, 85 total

  NEM-021 cost-aware ledger on real PostgreSQL
    ✓ AC-6: each retry reserves separately; a turn with three attempts holds three reservations until each resolves
    ✓ AC-7: settlement uses the pinned schema even if a newer schema is activated mid-flight
    ✓ AC-9: injected overrun — exact record, once-only accounting, breaker until reviewed replacement, admissions stop, total = allowance + overruns
    ✓ AC-5: legacy NEM-019 reservations and attempts share the per-scope and overall unresolved bounds; legacy paths never resolve attempts
    ✓ compensation is a separate signed entry counted once in committed
    AC-4: admission invariant (F-1)
      ✓ N distinct users in parallel, variable costs: committed + reservation ≤ allowance at EVERY admission
      ✓ exact capacity is admitted; one micro-USD over is rejected
    AC-8: unknown and partial usage, ledger outage, reconciliation, replay
      ✓ unknown usage holds the reserved amount; expiry flags once and never releases to zero
      ✓ ledger outage at settlement → held; reconciliation settles exactly once; replays never double-charge
      ✓ concurrent reconcilers and concurrent settlements never double-settle
      ✓ the database itself refuses a second resolution for an attempt key
    AC-9a: golden accounting (F-4)
      ✓ reserve $1.00, actual $1.40 → settled 1.40, held 0, overrun 0.40, committed 1.40 (not 1.80); replay and reconcile change nothing
      ✓ partial: reserved 1.00 → partial 0.30 → final 1.10 gives committed 1.00 → 1.00 → 1.10
      ✓ a partially settled attempt can never be released: the partial obligation stays in committed
    AC-9b: release requires authoritative evidence (F-4)
      ✓ a rejected attempt with an error category but no evidence is HELD, not released
      ✓ provider_reported_zero releases
      ✓ documented_no_charge releases only when the attempt descriptor declares that class (B declares rate_limited; A does not)
      ✓ a never-sent attempt is released through releaseAttempt; a provider-reported attempt cannot be released that way
    AC-10: each condition denies before any provider call (no reservation written)
      ✓ missing pricing schema
      ✓ expired pricing schema
      ✓ unset global policy
      ✓ exceeded micro-USD unresolved bound
      ✓ missing unit weights
      ✓ missing input-token count
      ✓ insufficient capacity, including after an overrun
      ✓ per-user unit allowance still applies to attempts (ADR-005 units)
  NEM-021 migration 073 on a disposable database
    ✓ AC-13: 073 runs down and up; it only adds; no other table, column, constraint, or index is altered; no value is seeded
    ✓ AC-11 (B-2): every FK to users from 073 is ON DELETE CASCADE; every other new FK is CASCADE or SET NULL
    ✓ AC-11: the unchanged deleteAccount path removes every cost-ledger row for the user; shared configuration remains

# 6. TypeScript
$ npx tsc --noEmit -p tsconfig.test.json   → exit 0
$ npx tsc --noEmit -p tsconfig.json        → exit 0

# 7. ESLint (metering, metrics, module, migration 073, Phase 2 + D-2 tests, integration)
✖ 64 problems (0 errors, 64 warnings)      → exit 0
   63 × @typescript-eslint/no-explicit-any (test files only); 1 × migration file ignored by the project pattern
```

**Executed vs. not executed.** Everything above ran in this session; no result is copied from an earlier report. **Not executed:** CI (it has no PostgreSQL), staging, production, any provider or network call.

**Interim run (before the final one):** the new AC-11 tests first failed on test-side mistakes, both corrected: a guessed FK count (≥ 10; the true count is 9), and an overrun opening the breaker before later reservations in the same test (correct behaviour). They passed on rerun, and again in the final fresh run.

## 14. Deviations and discoveries

- **History (revision 1):** the pre-execution check found B-1 (positional NEM-019 migration test) and B-2 (frozen Phase-1 guard). Resolved by D-1 (PO) and D-2 (PA) as recommended in revision 1, option A for both. Applied as a separate commit (`8da1626`) before Phase 2 code.
- **Interruption:** the implementing session stopped at the usage limit after pushing `70a47bd`. Nothing was lost: local equalled origin, with no stash or uncommitted change.
- **D-A** showed that FakeDb unit mocks cannot catch driver return shapes. The integration suite is the real guard, as intended (F-10).
- **D-B** was not visible in the WIP tests: every test released attempts that had no partial settlement.
- R-1 (NEM-019 runtime file touched) is reported for explicit review rather than treated as covered.

## 15. Protected-systems confirmation

Not modified:
- reader, Escucha Activa, sync, ownership, `user_books`, `fragments`;
- tokens, Stripe, subscriptions;
- `users.service.ts` (deletion verified through the unchanged path), `app.module.ts`;
- the Gateway, router, provider, paths, simulator, and `turn.service.ts` (digest-pinned by D-2);
- NEM-019 migrations 069–072 and every historical migration (digest-pinned);
- the frozen contract source, fixtures, and golden vectors (tree `6342668…` and digest);
- web, mobile, worker, CI/CD, Docker, infrastructure, staging, production.

The only NEM-019 runtime change is R-1. No provider, credential, paid API, network call, or AI cost. No real price, allowance, or weight: fixtures only, nothing seeded, and unset configuration denies.

## 16. Open questions and unresolved items

- R-1 (PA confirmation).
- Contract extension points NEM-022 will use (already in Phase 1 §18): `reserveAttempt` / `settleAttempt` / `releaseAttempt` / `compensateAttempt`; `AttemptDenied.cause` (internal) mapped to neutral reasons; `attemptIdempotencyKey(turnKey, n)`; descriptor `noChargeErrorClasses` (pinned at reservation).

## 17. Next recommended action

Independent **Product Architecture review** of Phase 2 (`REVIEW-CHECKLIST.md`), including R-1, then a separate **Product Owner acceptance decision**. NEM-022 stays not authorized until NEM-021 is accepted. *(Recommendation only; nothing is executed automatically. No merge or deployment has occurred.)*
