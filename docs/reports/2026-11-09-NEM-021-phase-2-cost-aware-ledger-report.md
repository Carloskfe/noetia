# NEM-021 — Phase 2 Report: Cost-Aware Ledger

**Status:** **BLOCKED AT PRE-EXECUTION CHECK — no Phase 2 code written.** Two preconditions fail. Both need a decision before implementation can start (§10b). Partial report under the reporting protocol (§2.2, blocked work).
**Delivery state:** Not merged · Not deployed.

---

## 1. Mission and objective

| Item | Value |
|---|---|
| Mission | NEM-021 — Provider-Neutral AI Contract and Cost Accounting (E1), specification Revision 3 (PO-032) |
| Type | IMPLEMENTATION |
| This iteration | Phase 2 (§5 items 7–15): cost-aware ledger |
| Authorization | Product Owner, *"NEM-021 Phase 2 Execution Authorization"* (2026-11-09): explicitly authorizes execution of Phase 2 per the approved specification, plus required tests, documentation, and governance records. Not authorized: NEM-022, merge, deployment, AI providers, credentials, AI costs, new infrastructure, CI/CD, changes to frozen contract v1 without Product Architecture review, and modifying NEM-019 migrations or tests to make regressions pass. **If any precondition fails, STOP and report the blocker** |

## 2. Date and status

2026-11-09. Lifecycle: **In progress → BLOCKED** (pre-execution check). Delivery: not merged, not deployed.

## 3. Repository baseline

| Item | Value |
|---|---|
| Branch | `feat/nem-021-provider-neutral-contract` (Draft PR #50, stacked on #49 → … → #46) |
| Head examined | `57cc998` (contract-v1 freeze record), clean and in sync with origin |
| Frozen contract baseline | `697f8ea947bbb486028d71a8cc5d9931ac9e7ce8` |
| Contract source tree at HEAD | `634266826c934e3d615a7342a04a5e7458c6a84d`: **matches** the frozen baseline |
| Contract test tree at HEAD | `4d01b88fbf027d59a8bd73a158102425a3bb1a6f`: **matches** the frozen baseline |

## 4. Scope and exclusions

In scope: the pre-execution check required by the governance README and the PO instruction §2. Phase 2 implementation was **not started**, because the check failed. Excluded, as instructed: NEM-022, merge, deployment, infrastructure, CI/CD, providers, credentials, AI costs.

## 5. Executive summary

The pre-execution check passed on every point except two, and both are caused by the specification's own requirement for **additive migrations numbered ≥ 073** (§5 item 7):

- **B-1 (NEM-019 regression test).** NEM-019's migration test reverts "the last four migrations" and expects to land on migration 067. With **any** migration ≥ 073 present, it reverts the wrong four and fails. A one-table probe migration reproduced this: 4 of 6 tests in that suite failed. The specification (§11 AC-5, §12, §17) and the PO instruction forbid changing NEM-019 tests to make regressions pass. Implementing Phase 2 as specified therefore fails a NEM-019 test that cannot be changed without authorization.
- **B-2 (frozen contract test).** The frozen contract-v1 test tree contains a Phase-1-only guard: "Phase 1 adds no migration and touches no NEM-019 runtime file". Phase 2 must add migrations ≥ 073 (§5.7), and ledger code must import contract types (§9). The probe made this test fail. Changing it changes the frozen test tree (`4d01b88`), and the freeze's change control requires explicit Product Architecture review first.

Neither blocker is a defect in the product code. Both are test assertions tied to an earlier phase. Recommended resolutions are in §11. Each is narrow and keeps the original intent.

## 6. Work completed

1. Read the full approved specification (all sections, with emphasis on §§5, 9–12, 17–19) and the governance pre-execution checklist.
2. Inspected the NEM-019 control plane and ledger:
   - `budget-ledger.service.ts`, `rate-card.service.ts`, `reconciliation-job.service.ts`, `admission-cache.ts`, `knowledge-db.service.ts`, `knowledge-config.ts`, `knowledge-metrics.service.ts`, `knowledge.module.ts`;
   - `turn.service.ts`, `model-gateway.service.ts`, `model-provider.ts`;
   - migration `1748300000072-CreateIntelligenceMetering.ts`;
   - the integration harness (`support/it-env.ts`) and all four integration suites.
3. Confirmed the division of work with NEM-022 (§7 F-4).
4. Verified both frozen tree hashes against the baseline (§3).
5. Ran a **temporary probe**: one additive migration (`1748300000073`, creating a single empty table, never committed), with the frozen contract architecture test and the NEM-019 migration integration suite on a disposable PostgreSQL 16 container. The probe file was deleted and the container removed straight afterwards; `git status` is clean.
6. Recorded the Phase 2 authorization and the BLOCKED status in the mission file and register, and wrote this report.

## 7. Verified findings and evidence

**F-1 (B-1). NEM-019 migration test is positional.** `services/api/tests/integration/knowledge/a-schema-migrations.int-spec.ts:29-46`:
- line 32 reverts exactly four migrations (`for (let i = 0; i < 4; i++) await ds.undoLastMigration(...)`);
- line 33 expects zero NEM-019 tables afterwards;
- line 36 expects the last remaining migration to be `ReconcilePlanDisplayPrices1748300000067`.

The test assumes migration 072 is the newest. Probe result with one migration 073:

```
✕ AC-19: migrations 069–072 run down and up; no existing table is altered; revert restores the prior schema
    Expected: 0   Received: 3          (073, 072, 071, 070 reverted; 069's three tables remain)
✓ seeds: tier policies are exactly 3 and 10
✕ AC-15f: every FK from a knowledge table to users is ON DELETE CASCADE or SET NULL
    Expected: >= 4   Received: 1       (cascade: database left at the 069 state by the failed test)
✓ every FK from a knowledge table (to anything) is CASCADE or SET NULL
✕ the database rejects position 11 directly                        (cascade)
✕ the database rejects a duplicate book and a duplicate position   (cascade)
Tests: 4 failed, 2 passed, 6 total
```

AC-19 is the root failure. The other three fail only because it leaves the database partly reverted. The specification requires both migrations ≥ 073 (§5.7, §11 AC-13) and NEM-019 tests that "pass unchanged" (§11 AC-5, §12). §17 lists "a NEM-019 test must change to pass" as a stop condition.

**F-2 (B-2). Frozen Phase-1 guard.** `services/api/tests/unit/knowledge/ai/contract/contract-architecture.spec.ts:54-59` asserts:
- no migration matching `17483000000(7[3-9]|[89]\d)` exists;
- no file in `src/knowledge` outside the contract imports it.

Phase 2 must add migrations ≥ 073 (§5.7) and must import contract types into ledger code (§9: *"Ledger code imports contract types"*). Probe result:

```
✕ Phase 1 adds no migration and touches no NEM-019 runtime file (contract is not yet wired in)
Tests: 1 failed, 8 passed, 9 total
```

This test belongs to the frozen test tree `4d01b88…`. Under the freeze's change control (mission file, freeze record), changing it requires explicit Product Architecture review.

**F-3. Other unit tests are unaffected.** The only other migration-specific unit test (`tests/unit/migrations/1748300000072-CreateIntelligenceMetering.spec.ts`) tests migration 072 in isolation and does not depend on later migrations. The FK checks at `a-schema-migrations.int-spec.ts:53-72` filter on the NEM-019 table list. Once AC-19 no longer fails (and no longer leaves the database partly reverted), new tables would not affect them.

**F-4. Split of work with NEM-022 confirmed.** NEM-022 owns the Gateway and "end-to-end settlement through the E1 ledger" (NEM-022 spec lines 35, 147). Phase 2 therefore delivers the ledger API (`reserveAttempt` / `settleAttempt` / `releaseAttempt`), migrations, reconciliation, breaker, and metrics. It does not rewire `turn.service.ts`, so NEM-019's turn path and its tests stay unchanged.

**F-5. Other preconditions: passed.**
- Authorization is explicit and names the mission and phase.
- Frozen hashes match.
- The branch is clean and in sync with origin.
- No infrastructure, CI, or protected-system change is needed.
- No product value needs inventing: fixtures only, and unset policy denies.
- The disposable PostgreSQL/Redis workflow works on this VM, within the resource limits.

## 8. External references

None.

## 9. Risks

| ID | Rating | Risk |
|---|---|---|
| R-1 | **High** (schedule) | Phase 2 cannot start until B-1 and B-2 are decided. |
| R-2 | Medium | Working around B-1 without authorization would breach the specification's no-test-change rule. For example, moving E1 migrations outside `src/migrations` would also leave them unrun by the production migration runner and would need config or CI changes. Not pursued. |
| R-3 | Low | The probe ran only against a disposable local container. Nothing persisted. |

## 10. Decisions

**(a) Made under existing authority:**
- Stopped at the pre-execution check, as the PO instruction requires.
- Ran a temporary, uncommitted probe to turn suspected blockers into verified ones.
- Recorded the authorization and BLOCKED status (governance records are in scope).

**(b) Requiring a decision:**

| ID | Decision | Owner |
|---|---|---|
| D-1 | How the NEM-019 migration test (AC-19) may coexist with migrations ≥ 073 (options in §11) | **Product Owner**: the specification and the PO instruction forbid changing NEM-019 tests |
| D-2 | Whether the Phase-1-only guard in the frozen contract test tree may be re-scoped for Phase 2 (contract **source** unchanged) | **Product Architecture**: freeze change control |

## 11. Recommendations

**D-1 options (B-1, NEM-019 migration test):**

| Option | What it means | Consequence |
|---|---|---|
| **A (recommended)** | Authorize one **intent-preserving** amendment to `a-schema-migrations.int-spec.ts` AC-19: revert any migrations newer than 072 first, then revert 072…069 **by name**, with every existing assertion kept (zero NEM-019 tables after revert, last remaining migration 067, schema snapshot unchanged, empty seeds after up). Phase 2 adds its own up/down test for 073+ (AC-13). | Same guarantees as today, independent of later migrations. Every other NEM-019 test stays unchanged. The report would record the single, PO-approved exception to "unchanged" |
| B | Leave the test unchanged and run the NEM-019 suite against a schema limited to migrations ≤ 072 (separate test data source or config) | The unchanged test never runs against the real Phase 2 schema, so the evidence is weaker. It also adds test infrastructure |
| C | Amend the specification (AC-5 / §12) to replace the positional test with a combined 069–07x up/down test | Same as A, done at specification level; needs a specification revision |
| Not viable | Put E1 migrations outside `src/migrations`, or edit NEM-019 migrations | The production migration runner would not pick them up (or config/CI changes are needed); editing NEM-019 migrations is forbidden |

**D-2 options (B-2, frozen Phase-1 guard):**

| Option | What it means | Consequence |
|---|---|---|
| **A (recommended)** | PA authorizes replacing that one test with Phase 2 guards: (i) migrations ≥ 073 are additive only; (ii) only `src/knowledge/metering/*` may import the contract; (iii) `turn.service.ts`, the Gateway, and the router still do not import it until E2. The contract **source** tree (`6342668…`) and every fixture and golden vector stay unchanged; `CONTRACT_VERSION` stays `1.0.0`. The new test-tree hash is recorded as the updated test baseline. | Keeps the guard's purpose (controlled wiring) for Phase 2 and adds no contract change |
| B | Keep the frozen test unchanged | Phase 2 cannot add its required migrations without failing it. Not workable |

## 12. Changes made

- `docs/engineering-missions/APPROVED/NEM-021-provider-neutral-ai-contract-and-cost-accounting.md`: Phase 2 authorization recorded verbatim; status changed to BLOCKED (pre-execution check).
- `docs/engineering-missions/README.md`: NEM-021 register row.
- `docs/reports/2026-11-09-NEM-021-phase-2-cost-aware-ledger-report.md`: this report.

**No application code, tests, fixtures, migrations, configuration, CI/CD, or infrastructure changed.** The probe migration was temporary, never staged or committed, and has been deleted. No database outside the disposable local container was touched, and the container has been removed.

## 13. Tests and validation

| Run | Result |
|---|---|
| Frozen tree hashes (`git rev-parse HEAD:<path>` against the baseline) | Both match |
| Probe: `npx jest tests/unit/knowledge/ai/contract/contract-architecture.spec.ts` with migration 073 present | 1 failed, 8 passed (F-2) |
| Probe: `jest -c jest.integration.config.js --runInBand tests/integration/knowledge/a-schema-migrations.int-spec.ts` (disposable PG16) with migration 073 present | 4 failed, 2 passed (F-1) |

**Not run:** Phase 2 tests (no Phase 2 code exists). The full NEM-019 regression was last run green at the frozen baseline (Phase 1 report §11.4: 1,390 unit, 56 integration), and nothing has changed since.

## 14. Deviations and discoveries

- The specification's two requirements, "migrations ≥ 073" and "NEM-019 tests pass unchanged", are incompatible as written, because one NEM-019 test is positional (F-1).
- A Phase-1-scoped guard sits inside the frozen test tree (F-2). The freeze record lists the contract **test** tree hash, so retiring that guard falls under change control.

## 15. Protected-systems confirmation

Not modified: reader, Escucha Activa, sync, ownership, `user_books`, `fragments`, tokens, Stripe, subscriptions, `users.service.ts`, `app.module.ts`, every NEM-019 file and migration, the frozen contract source and tests, web, mobile, worker, CI/CD, Docker, infrastructure, staging, production. No provider, credential, network call, or AI cost.

## 16. Open questions and unresolved items

- D-1 (PO) and D-2 (PA), above.
- Once unblocked, these design points would be decided under engineering authority and recorded in the completion report. None needs a product value.
  - **Legacy turn reservations.** NEM-019's legacy turn reservations stay units-only until E2 moves turns onto `reserveAttempt`. Legacy settlement costs (`costMicroUsd`) still count in global *settled*.
  - **Allowance period.** The global allowance period uses the same rolling-day window as NEM-019 allowances. Held exposure counts regardless of age.
  - **Per-attempt idempotency key.** Derived as `<turnKey>:a<attemptNumber>`, with one resolution per attempt key (existing partial unique index).

## 17. Next recommended action

PO decision on D-1 and PA decision on D-2. On approval, start Phase 2 from `57cc998` without re-reading the scope: apply the approved test amendments first, as a separate commit, and show the NEM-019 suite green on them before any Phase 2 code. *(Recommendation only; nothing is executed automatically.)*
