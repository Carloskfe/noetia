# NEM-021 — Phase 1 Completion Report: Shared Provider Contract v1

**Mission:** NEM-021 — Provider-Neutral AI Contract and Cost Accounting (E1), approved specification Revision 3 (PO-032)
**Authorization:** Product Owner execution instruction (2026-11-09), **Phase 1 only**. Stop for the Product Architecture checkpoint before Phase 2.
**Status:** **PHASE 1 COMPLETE, REVISION 2 (checkpoint corrections F-5 and F-6, §10) — AWAITING INDEPENDENT PRODUCT ARCHITECTURE CHECKPOINT RE-REVIEW.** Contract v1 is **not frozen**. Phase 2 (ledger) is **not started and not authorized**.
**Branch:** `feat/nem-021-provider-neutral-contract`, stacked on `docs/e1-e2-mission-drafts` (PR #49) → #48 → … → #46 (NEM-019 code) → … → #34. **Not merged; not deployed.**

---

## 1. Pre-execution check

| Check | Result |
|---|---|
| Full approved specification read | Yes (Revision 3, all sections; Phase 1 = §5 items 1–6, §9–§12) |
| Branch and dependency stack | PR #49 head `6afcb73` contains the accepted NEM-019 code (no service diff from #46) and the approved specification. The Phase 1 branch starts there |
| Existing contract, ledger, security boundaries | NEM-019's `model-provider.ts`, Gateway, router, `budget-ledger.service.ts` (legacy `UsageRecord`/`UsageOutcome`), B-6 global lock, F-12 authority port: **none modified** |
| Protected systems | Reader, Escucha Activa, tokens, Stripe, subscriptions, `user_books`, `fragments`, `app.module.ts`: untouched |
| Migrations / deployment / providers / infrastructure | None needed for Phase 1; none made |
| Material conflicts | **None.** Two minor points handled within engineering judgement (§6, items 1–2) |
| Execution recorded | NEM-021 status set to **IN PROGRESS — PHASE 1 ONLY** in the mission file and register (commit `c445174`) |

## 2. Contract v1 specification (as implemented)

Module: `services/api/src/knowledge/ai/contract/`, exported through `index.ts`. Version policy in `version.ts`: `CONTRACT_VERSION = '1.0.0'`, `SCHEMA_VERSION = 1`. After the freeze, changes are additive only (v1.x) and must keep every fixture and golden vector valid; incompatible changes need `schemaVersion: 2`.

| Artifact | Contract id | Key content |
|---|---|---|
| **Capability descriptor** (`capability.ts`) | `noetia.ai.capability` | provider/model keys; `simulated`; capabilities; model paths; `maxContextTokens`, `maxOutputTokens`; features (citations, structured output, streaming, token counting, embeddings, cache hints with lifetimes and `automaticWrites`); token counting `exact` or `estimated` with a conservative factor (≥ 10,000 bps); reasoning `within_output` or `separate_bound`; `noChargeErrorClasses` (F-4 documented evidence); **`nonTokenUnits`** — every potentially billable non-token operation, `[]` being the validated declaration that none is available (F-5) |
| **Normalized usage** (`usage.ts`) | `noetia.ai.usage` | per-class token counts (`inputUncached`, `cacheRead`, `cacheWrite` by lifetime, `output`, optional `reasoning`); `nonTokenUnits`; `outcome`, `error`, `usageCompleteness`, `zeroUsageEvidence`; attempt key and timestamps. **Unknown fields rejected** (no content can enter) |
| **Outcome model** (`outcomes.ts`) | part of v1 | the §9.3 table (`OUTCOME_TABLE`), `ledgerActionFor`, `isRetryable`, `hasAuthoritativeZeroEvidence`, `legacyOutcome` (exact mapping onto NEM-019's unchanged CHECK column) |
| **Rate engine** (`rates.ts`) | part of v1 | the **only** per-class arithmetic: `exactUsageSum`, `exactWorstCaseSum`, rate-table validation and dominance |
| **Pricing schema** (`pricing.ts`) | `noetia.ai.pricing` | id, version, provider/model, `micro-usd-per-million`, effective-from, `verifiedAt`, source note, `isTestFixture`, base rate table, whole-request tiers (strictly greater; strictly increasing thresholds; each tier ≥ the previous), factor-bps modifiers; `priceUsage` (half up), `worstCaseCost` (ceiling), `selectTier`, `canonicalModifierOrder` |
| **Unit weights** (`unit-weights.ts`) | `noetia.ai.unit-weights` | versioned per-class weights (no tiers, no modifiers); `unitsForUsage` (half up), `worstCaseUnits` (ceiling) |
| **Money** (`money.ts`) | part of v1 | BigInt-only exact rationals; pico-USD intermediates; single rounding (ceiling / half up); `bigint`-column overflow guard; count and rate bounds |
| **Errors** (`contract-error.ts`) | part of v1 | `ContractError` codes (incl. `missing_unit_bound`, `unit_declaration_mismatch`, `unvalidated_config`); every violation fails closed |
| **Validation boundary** (`validated.ts`) | part of v1 | the single runtime boundary (F-6): `assert*` validators return a deep-frozen copy registered as validated; every monetary function accepts only registered objects of the right kind (`Validated<T>` type + constant-time runtime check) |
| **Fixtures** (`fixtures/`) | part of v1 | pricing structure A (lifetime-specific cache writes, no tier, batch and region modifiers, a non-token unit); pricing structure B (whole-request tier above 200,000 input, automatic writes, reasoning rate); two descriptors (exact versus estimated counting; within-output versus separate reasoning bound; one documented no-charge class); unit weights; 14 usage records covering every outcome row. All invented, all `isTestFixture: true`, `verifiedAt: null` |

## 3. Implemented files

| File | Purpose |
|---|---|
| `src/knowledge/ai/contract/version.ts` | Version policy |
| `src/knowledge/ai/contract/contract-error.ts` | Fail-closed error type |
| `src/knowledge/ai/contract/money.ts` | Exact arithmetic, rounding, bounds |
| `src/knowledge/ai/contract/validation.ts` | Dependency-free validation helpers |
| `src/knowledge/ai/contract/outcomes.ts` | Shared outcome/error model and ledger actions |
| `src/knowledge/ai/contract/capability.ts` | Capability descriptor, validation, conservative token estimate |
| `src/knowledge/ai/contract/usage.ts` | Normalized usage, validation (F-4 evidence rules) |
| `src/knowledge/ai/contract/rates.ts` | Single rate engine (usage and worst case) |
| `src/knowledge/ai/contract/pricing.ts` | Pricing schema, `priceUsage`, `worstCaseCost` |
| `src/knowledge/ai/contract/unit-weights.ts` | Unit-weight schema, `unitsForUsage`, `worstCaseUnits` |
| `src/knowledge/ai/contract/validated.ts` | Validation boundary: seal on `assert*`, require on every monetary entry point (F-6) |
| `src/knowledge/ai/contract/index.ts` | Public entry point |
| `src/knowledge/ai/contract/fixtures/*` | 5 JSON fixtures and a typed index (configuration fixtures exported only through the boundary; raw JSON exported as `RAW_*` for validator tests) |
| `tests/unit/knowledge/ai/contract/*.spec.ts` | 7 suites, 196 tests (109 in revision 1; +87 for F-5/F-6) |
| `docs/engineering-missions/APPROVED/NEM-021-…md`, `docs/engineering-missions/README.md` | Execution authorization and Phase 1 status |
| `docs/reports/2026-11-09-NEM-021-phase-1-contract-v1-report.md` | This report |

**Not changed:** any NEM-019 file, migration, `package.json`, lockfile, CI, Docker, or infrastructure. No new dependency.

## 4. Tests and verification (actual results, 2026-11-09)

> Revision 1 results below. **Revision 2 results (after F-5/F-6) are in §10.4** and supersede these numbers.

```
# npx jest --runInBand tests/unit/knowledge/ai/contract
PASS contract-architecture.spec.ts · validation.spec.ts · worst-case.spec.ts · outcomes.spec.ts · pricing.spec.ts · money.spec.ts
Tests:       109 passed, 109 total

# contract coverage (--collectCoverageFrom src/knowledge/ai/contract/**)
All files  | 95.56 % stmts | 88.88 % branches | 98.43 % funcs | 99.26 % lines

# full api unit regression: npx jest --maxWorkers=2 --silent
Test Suites: 93 passed, 93 total
Tests:       1291 passed, 1291 total        (1,182 pre-existing, unchanged, + 109 new)

# NEM-019 integration regression on disposable PostgreSQL 16 + Redis 7 (containers removed afterwards)
Tests:       56 passed, 56 total

# npx tsc --noEmit -p tsconfig.test.json → exit 0 · npx eslint src/knowledge/ai/contract → exit 0
```

| Requirement | Evidence |
|---|---|
| AC-2 hand-computed costs for every class, tier, modifier, both fixtures | `pricing.spec`: fixture A every class plus a unit = 111,000 µUSD; batch 55,500; batch + region 61,050; fixture B tier = 454,000 |
| AC-3 conservative reservation | `worst-case.spec`: 8,000 seeded random in-bound attempts (cost) and 4,000 (units) across both fixtures, cache intents, modifiers, estimated counts, separate reasoning bounds, tier crossings: worst ≥ actual every time. Golden worst cases 430,500 / 211,500 / 407,500 / 762,500 / 116,325 µUSD; units 29 / 135 |
| AC-3a arithmetic | $0.01/M × 1 token: reservation 1 µUSD, settlement 0; half-up boundary 0.49 → 0, 0.50 → 1; tier at threshold versus one above (208,000 / 412,002); modifier order independence; 200-run determinism; overflow → `overflow`; invalid counts, rates, lifetimes, units, modifiers → `ContractError`; float scan of the contract module (with self-test) |
| AC-3b outcomes | all 17 table rows; **exhaustive** check of every outcome × error × completeness combination (rejected outside the table); evidence rules; exact legacy mapping |
| F-4 evidence | `zero_confirmed` without evidence → **hold**; `documented_no_charge` only when the descriptor declares that exact class with a non-blank reference; validators reject `zero_confirmed` without evidence, evidence without `zero_confirmed`, and `zero_confirmed` with non-zero counts |
| One contract, no duplicates | Architecture test: no contract type or pricing function defined anywhere else in `src/knowledge`; the contract imports nothing outside itself (no services, framework, network, or SDK) |
| Phase 1 boundaries | Architecture test: no migration ≥ 073; no NEM-019 file imports the contract yet |
| NEM-019 unchanged | Full unit and integration regression green; `git status` shows only the two new directories |

**Failures during the work, now fixed:**
- The float-scan test initially flagged string literals (`'1.0.0'`, a `§9.3` reference in a message). The scanner now strips string literals before checking, with a self-test proving it still catches float arithmetic.
- No product test failed.

**Limitation:** the repository's coverage configuration only collects `*.service.ts`/`*.provider.ts`, so contract coverage was measured separately (above). The global API branch-coverage gate still fails for pre-existing reasons, as documented in NEM-019.

## 5. Extension points for Phase 2 and NEM-022

`priceUsage`, `worstCaseCost`, `unitsForUsage`, `worstCaseUnits`, `conservativeInputTokens`, `ledgerActionFor`, `isRetryable`, `legacyOutcome`, `hasAuthoritativeZeroEvidence`, the `assert*`/`validate*` validators, `OUTCOME_TABLE`, and the fixtures. Phase 2 will store schemas validated by these functions and migrate NEM-019's legacy `UsageRecord` to `NormalizedUsage`. NEM-022 will emit `NormalizedUsage` and declare `CapabilityDescriptor`s.

## 6. Contract assumptions and open risks — for the checkpoint review

1. **Distinct names.** NEM-019 already exports `UsageRecord`/`UsageOutcome` from its ledger. The contract uses `NormalizedUsage`/`AttemptOutcome` to avoid a duplicate-schema collision; Phase 2 migrates the ledger onto the contract types.
2. **`ledgerActionFor` signature.** §5.4 lists `(outcome, error, completeness)`. To honour F-4 the function also takes the evidence field and the descriptor's no-charge declarations. Without them it holds.
3. **Tier monotonicity is required.** Each tier must be ≥ the previous table for every class; that is what makes worst case ≥ actual when the actual input is smaller than the reserved bound. A provider whose higher tier is cheaper for some class would need a schema change (v1.x or v2).
4. **Whole-request tiers only.** Marginal tiers (only the portion above a threshold repriced) are not expressible in v1, matching the approved specification. A provider with marginal tiering would need a v1.x addition.
5. **The worst case trusts the descriptor.** Cache writes are bounded by the declared intent unless `automaticWrites` is declared; reasoning is bounded by `maxOutputTokens` unless a separate bound is declared; every non-token unit the descriptor declares needs an explicit per-attempt bound (F-5, §10.1), and the descriptor's declaration must match the pricing schema exactly. Provider behaviour outside the descriptor becomes an overrun in Phase 2 (recorded and breaker-protected, §9.1).
6. **Modifiers are multiplicative factors.** Fixed per-request fees are modelled as a non-token unit (e.g. `request`), not as a modifier.
7. **`MAX_RATE` = 10¹² per million** is an engineering sanity bound, not a product value.
8. **Estimated token counts** depend on a correct conservative factor in the descriptor; it is calibrated at the launch-readiness gate.
9. **Fixture values are invented** and are not the provider prices recorded in the P0 packet.
10. **Rounding is per attempt;** totals are sums of rounded attempt amounts (as specified).

## 7. Deployment

None. Nothing merged, deployed, or connected; no AI provider, SDK, credential, network call, or cost.

## 8. Protected systems confirmation

Not modified: reader, Escucha Activa, sync, ownership, `user_books`, `fragments`, tokens, Stripe, subscriptions, `users.service.ts`, `app.module.ts`, every NEM-019 runtime file and migration, web, mobile, worker, CI/CD, Docker, infrastructure, staging, production.

## 9. Checkpoint request

Product Architecture is asked to review contract v1 (types, fixtures, functions, version policy, and the assumptions in §6) and, if accepted, **freeze it as v1**. **Phase 2 does not begin** until that review and a Product Owner instruction to continue.

**Revision 2:** returned for independent checkpoint re-review with corrections F-5 and F-6 (§10). Contract v1 is **not frozen** by this revision.

---

## 10. Revision 2 — checkpoint corrections F-5 and F-6 (2026-11-09)

Independent Product Architecture review raised two findings. Both are corrected inside the Phase 1 scope. The approved F-1…F-4 rules are unchanged (all their tests still pass unmodified in substance; only call sites were updated to pass explicit unit bounds and validated configuration).

### 10.1 F-5 (HIGH) — non-token unit bounds: CORRECTED

**Defect.** `AttemptBounds.nonTokenUnitBounds` was optional and `exactWorstCaseSum` only priced the keys present. Omitting the bound for a billable unit (e.g. `tool_call`) silently reserved 0 for it, so the settlement could exceed the reservation.

**Correction.**
- `CapabilityDescriptor.nonTokenUnits: string[]` is **required**: every potentially billable non-token operation the model can consume. `[]` is the validated declaration that none is available. Missing, malformed, or duplicate entries fail descriptor validation.
- `AttemptBounds.nonTokenUnitBounds` is **required** and must carry an explicit **own-property** bound for every declared unit (`0` disables the operation for that attempt). An inherited key such as `constructor` does not count as a bound.
- `worstCaseCost` requires the pricing schema to price **exactly** the descriptor's declared units (both directions). `worstCaseUnits` fails with `unpriced_unit` if the weights do not weight a declared unit.
- Failure codes: `missing_unit_bound` (absent, null, array, or non-object bounds; a declared unit without a bound), `unit_declaration_mismatch` (a bound for an undeclared unit; schema and descriptor disagree), `unpriced_unit`, `invalid_request` (negative, fractional, NaN, string, or unsafe bound).

**Tests** (`worst-case.spec.ts`):
- Negative: each failure path above, for both `worstCaseCost` and `worstCaseUnits` (17 tests), including the inherited-key case.
- Property (seeded, 4,000 attempts over 400 random descriptor/schema/weights triples, each declaring a random subset of 6 units, including `constructor`, priced through the validators): reservation ≥ settlement for cost and units, and **dropping any single declared bound fails closed** every time.
- Property (300 cases): raising any unit bound never lowers the reservation.
- The original AC-3 property tests now bound every declared unit.

### 10.2 F-6 (MEDIUM) — validated configuration boundary: CORRECTED

**Defect.** Monetary functions accepted any object shaped like a `PricingSchema` / `UnitWeightSchema` / `CapabilityDescriptor`. Validation was available but optional, so a malformed rate, tier, modifier, or descriptor could reach a calculation.

**Boundary chosen.** The existing `assert*` validators are the **single runtime boundary** (`validated.ts`):
- `assertPricingSchema`, `assertUnitWeightSchema`, and `assertCapabilityDescriptor` validate once and return a **deep-frozen copy** registered (in a module-private `WeakMap`) with its kind. The return types are `Validated<T>`.
- Every monetary entry point (`priceUsage`, `worstCaseCost`, `unitsForUsage`, `worstCaseUnits`, `conservativeInputTokens`, `declaresNoCharge`) calls `requireValidated`, a constant-time membership check. **No revalidation per calculation; no duplicated validation logic.**
- A raw object, a spread or JSON copy, a sealed object of another kind, or a primitive fails with `unvalidated_config`. Sealed objects cannot be changed after validation (frozen), and later changes to the input object do not reach the sealed copy.
- Internal helpers (`selectTier`, `exactWorstCaseSum`, `exactUsageSum`) are only reachable through those entry points or take validated types.
- Fixtures are exported through the boundary (`FIXTURE_*`), so tests exercise the real path; raw JSON stays available as `RAW_FIXTURE_*` for validator tests.

**Tests** (`validated.spec.ts`, new; mirrors `validated.ts`):
- All 8 monetary entry points × {sealed accepted; raw rejected; spread and JSON copies rejected; wrong kind rejected; null/undefined/primitives rejected}.
- Malformed **rates** (negative, fractional, string, above `MAX_RATE`, negative unit rate), **tiers** (below base, non-increasing thresholds, missing class, extra unit), **modifiers** (0, negative, fractional, invalid key), unit **weights**, and **descriptors** (negative limits, estimated counting without or below a 1.0 factor, missing unit declaration, unknown field): each is rejected by its validator **and** rejected with `unvalidated_config` if passed directly to a calculation.
- Deep-freeze (rates, tiers, modifiers, descriptor fields, weights); detachment from the input; repeated calculations on one sealed object.

**Mutation check.** With the own-property check reverted to `in`, and with `requireValidated` reduced to a null/object check, the new suites fail 48 tests. With the fixes restored, they pass.

### 10.3 Files changed in revision 2

`capability.ts`, `pricing.ts`, `rates.ts`, `unit-weights.ts`, `contract-error.ts`, `index.ts`, `fixtures/index.ts`, `fixtures/descriptors-fixture.json` (adds `nonTokenUnits`: `["tool_call"]` for A, `[]` for B), **new** `validated.ts`; tests `pricing.spec.ts`, `validation.spec.ts`, `worst-case.spec.ts`, **new** `validated.spec.ts`; this report. No NEM-019 file, migration, `package.json`, lockfile, CI, Docker, or infrastructure changed. No new dependency. No Phase 2 or NEM-022 work.

### 10.4 Revision 2 test results (actual, 2026-11-09)

```
# npx jest --maxWorkers=2 tests/unit/knowledge/ai/contract
PASS validated.spec.ts · pricing.spec.ts · validation.spec.ts · outcomes.spec.ts · contract-architecture.spec.ts · money.spec.ts · worst-case.spec.ts
Test Suites: 7 passed, 7 total
Tests:       196 passed, 196 total

# contract coverage (--collectCoverageFrom 'src/knowledge/ai/contract/**/*.ts')
Statements 96.92 % (535/552) · Branches 90.94 % (251/276) · Functions 98.63 % (72/73) · Lines 100 % (455/455)

# full api unit regression: npx jest --maxWorkers=2
Test Suites: 94 passed, 94 total
Tests:       1378 passed, 1378 total        (1,182 pre-existing + 196 contract)

# NEM-019 integration regression on disposable PostgreSQL 16 + Redis 7 (containers removed afterwards)
Test Suites: 4 passed, 4 total
Tests:       56 passed, 56 total

# npx tsc --noEmit -p tsconfig.test.json → exit 0
# npx eslint src/knowledge/ai/contract tests/unit/knowledge/ai/contract → exit 0 (0 errors; `no-explicit-any` warnings in test mutators only, as in revision 1)
```

**Failures during the work:** none in product tests. The session was interrupted once (host crash) mid-revision. The work was resumed from the uncommitted tree, re-verified from scratch, and one additional gap was found and fixed on review: the missing-bound check used `key in bounds`, which an inherited key (`constructor`) would satisfy. It now requires an own property, with a dedicated test.

### 10.5 Contract-v1 impact for the reviewer

- **Breaking versus revision 1** (acceptable: v1 is not frozen): `CapabilityDescriptor.nonTokenUnits` and `AttemptBounds.nonTokenUnitBounds` are now required; monetary functions take `Validated*` types and reject unsealed configuration.
- **Phase 2 implication:** stored schemas and descriptors must pass through `assert*` when loaded, before any calculation. That is the boundary, not each call site.
- **NEM-022 implication:** adapters and the simulator must declare `nonTokenUnits` and pass an explicit bound per declared unit on every attempt.

**Status:** returned to Product Architecture for independent checkpoint re-review. **Contract v1 is not frozen. Phase 2 and NEM-022 are not started.**
