# NEM-021 — Phase 1 Completion Report: Shared Provider Contract v1

**Mission:** NEM-021 — Provider-Neutral AI Contract and Cost Accounting (E1), approved specification Revision 3 (PO-032)
**Authorization:** Product Owner execution instruction (2026-11-09), **Phase 1 only**. Stop for the Product Architecture checkpoint before Phase 2.
**Status:** **PHASE 1 COMPLETE — AWAITING PRODUCT ARCHITECTURE CHECKPOINT REVIEW AND CONTRACT-V1 FREEZE.** Phase 2 (ledger) is **not started and not authorized**.
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
| **Capability descriptor** (`capability.ts`) | `noetia.ai.capability` | provider/model keys; `simulated`; capabilities; model paths; `maxContextTokens`, `maxOutputTokens`; features (citations, structured output, streaming, token counting, embeddings, cache hints with lifetimes and `automaticWrites`); token counting `exact` or `estimated` with a conservative factor (≥ 10,000 bps); reasoning `within_output` or `separate_bound`; `noChargeErrorClasses` (F-4 documented evidence) |
| **Normalized usage** (`usage.ts`) | `noetia.ai.usage` | per-class token counts (`inputUncached`, `cacheRead`, `cacheWrite` by lifetime, `output`, optional `reasoning`); `nonTokenUnits`; `outcome`, `error`, `usageCompleteness`, `zeroUsageEvidence`; attempt key and timestamps. **Unknown fields rejected** (no content can enter) |
| **Outcome model** (`outcomes.ts`) | part of v1 | the §9.3 table (`OUTCOME_TABLE`), `ledgerActionFor`, `isRetryable`, `hasAuthoritativeZeroEvidence`, `legacyOutcome` (exact mapping onto NEM-019's unchanged CHECK column) |
| **Rate engine** (`rates.ts`) | part of v1 | the **only** per-class arithmetic: `exactUsageSum`, `exactWorstCaseSum`, rate-table validation and dominance |
| **Pricing schema** (`pricing.ts`) | `noetia.ai.pricing` | id, version, provider/model, `micro-usd-per-million`, effective-from, `verifiedAt`, source note, `isTestFixture`, base rate table, whole-request tiers (strictly greater; strictly increasing thresholds; each tier ≥ the previous), factor-bps modifiers; `priceUsage` (half up), `worstCaseCost` (ceiling), `selectTier`, `canonicalModifierOrder` |
| **Unit weights** (`unit-weights.ts`) | `noetia.ai.unit-weights` | versioned per-class weights (no tiers, no modifiers); `unitsForUsage` (half up), `worstCaseUnits` (ceiling) |
| **Money** (`money.ts`) | part of v1 | BigInt-only exact rationals; pico-USD intermediates; single rounding (ceiling / half up); `bigint`-column overflow guard; count and rate bounds |
| **Errors** (`contract-error.ts`) | part of v1 | `ContractError` codes; every violation fails closed |
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
| `src/knowledge/ai/contract/index.ts` | Public entry point |
| `src/knowledge/ai/contract/fixtures/*` | 5 JSON fixtures and a typed index |
| `tests/unit/knowledge/ai/contract/*.spec.ts` | 6 suites, 109 tests |
| `docs/engineering-missions/APPROVED/NEM-021-…md`, `docs/engineering-missions/README.md` | Execution authorization and Phase 1 status |
| `docs/reports/2026-11-09-NEM-021-phase-1-contract-v1-report.md` | This report |

**Not changed:** any NEM-019 file, migration, `package.json`, lockfile, CI, Docker, or infrastructure. No new dependency.

## 4. Tests and verification (actual results, 2026-11-09)

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
5. **The worst case trusts the descriptor.** Cache writes are bounded by the declared intent unless `automaticWrites` is declared; reasoning is bounded by `maxOutputTokens` unless a separate bound is declared; non-token units must be declared as bounds before the call. Provider behaviour outside the descriptor becomes an overrun in Phase 2 (recorded and breaker-protected, §9.1).
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
