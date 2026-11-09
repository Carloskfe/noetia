# NOETIA ENGINEERING MISSION — E1 (proposed identifier NEM-021)
## Provider-Neutral AI Contract and Cost Accounting

**Status:** DRAFT — drafted under [PO-031](../../operating-framework/decisions/product-owner/PO-031-development-planning-baseline-and-e1-e2-drafting.md) (drafting only). **Not approved. Not authorized for execution.**
**Proposed identifier:** `NEM-021`, verified unused on every remote branch and PR title on 2026-11-09. **Not reserved:** reservation is a PO act.
**Mission type:** IMPLEMENTATION
**Implementation authorization:** LIMITED to §5 — *proposed*; becomes active only after PO approval **and** a separate explicit execution instruction naming this mission
**Schema changes:** ADDITIVE ONLY (new migrations ≥ 073), applied to disposable test databases only
**Infrastructure changes:** NOT AUTHORIZED
**Production deployment:** NOT AUTHORIZED (staging also NOT AUTHORIZED; merge to `main` NOT AUTHORIZED)
**Product Owner approval:** REQUIRED

> **APPROVED ≠ EXECUTE.** Execution requires a separate PO instruction naming this mission.

---

## 1. Context
NEM-019 delivered a dark control plane whose ledger counts **internal units** with a fixed per-turn reservation and a single-dimension rate card (`ai_rate_cards.microUsdPerUnit`, `ai_usage_events.unitsReported`). The pilot-readiness assessment (§5) and the P0 packet (§A4, §A4.1) found that a real provider would break that model:
- providers price input, output, cache writes (per lifetime), cache reads, long-context tiers, and modifiers separately;
- a fixed reservation can under-reserve a variable-cost turn;
- there is **no global spending allowance**, only a global *unresolved* bound (D14);
- retries are invisible to the ledger (D15).

Under [PO-031](../../operating-framework/decisions/product-owner/PO-031-development-planning-baseline-and-e1-e2-drafting.md) the product is completed on simulated providers. E1 makes cost accounting **provider-neutral and cost-aware** before any provider exists. It defines the shared contract that E2's Gateway will implement (packet §A4.1).

## 2. Objective
Deliver, dark and fully tested:
1. **Shared provider contract v1**, reviewed before any ledger work.
2. A **cost-aware ledger**: reservation of the worst-case cost of each provider attempt, priced by a configurable pricing schema, plus a **global micro-USD allowance**. The ledger keeps every NEM-019 guarantee.

**Done** means every criterion in §11 is proven by tests on simulated usage and fixture prices, with no provider, credential, SDK, or network call.

## 3. Dependencies
- **NEM-019** implementation (Draft PR #46, COMPLETED / accepted). E1 builds on that branch stack (base: the PR #48 head or its successor), **not on `main`**.
- **PO-031** (drafting); PO approval of this specification; a separate execution instruction.
- **Not required:** any TT decision, provider selection (PO-005), credentials, prices, budget values, staging, CI changes.
- **Test environment:** disposable local PostgreSQL and Redis containers (packet §A3.4 rule 3) using the existing `jest.integration.config.js` safeguards; the local VM resource rules (`--maxWorkers=2`, one heavy job at a time).

## 4. Source-of-truth references
PO-025…028, PO-030, PO-031 · ADR-005 (budget authority B-1, settlement and recovery B-5, account deletion B-2; units versus cost) · ADR-006 (turn order) · [04 §4](../../architecture/three-tier-intelligence/04-entitlements-and-budgets.md#4-resource-budgets) (units for per-user fair use; micro-USD global guard) · NEM-019 technical note §5 and §9 (B-6, F-12) · [Pilot-readiness assessment rev 3](../../architecture/three-tier-intelligence/10-pilot-readiness-assessment.md) §4.3, §5 · [P0 packet rev 3](../../operating-framework/analysis/p0-pilot-decisions-packet.md) §A1, §A3.4, §A4.1.

## 5. In scope
Only under `services/api`:

**Phase 1 — Shared provider contract v1** (`src/knowledge/ai/contract/`), then a **review checkpoint**:
1. **Capability descriptor:** provider key, model key, capability keys supported, model-path ids served, `maxContextTokens`, `maxOutputTokens`, feature flags (`citations`, `structuredOutput`, `streaming`, `cacheHints` with supported lifetimes, `tokenCounting`, `embeddings`), and token-counting method (`exact` | `estimated` with a conservative factor).
2. **Normalized usage record:** per-class token counts (`inputUncached`, `cacheWrite` keyed by lifetime, `cacheRead`, `output`, `reasoning` if reported separately), `nonTokenUnits` map, outcome (`success` | `failure` | `timeout` | `aborted` | `refused` | `rate_limited`), usage completeness (`complete` | `partial` | `unknown`), provider and model keys, attempt key, timestamps. No content fields.
3. **Pricing schema:** version, effective-from, `verifiedAt`, source note; per-class integer micro-USD prices per million tokens (or per unit); **threshold tiers that reprice the whole request** above an input-token threshold; modifiers (batch, region) as integer basis points; non-token unit prices; a test-fixture marker.
4. **Pure functions:** `priceUsage(usage, schema)`, and `worstCaseCost(descriptor, schema, inputTokens, maxOutputTokens, cacheIntent)`. The worst case prices every input token at the highest applicable class and tier, plus the output bound.
5. **Unit-weight schema** (ADR-005 internal units): versioned per-class weights mapping usage to allowance units, independent of prices.
6. **Deterministic fixtures:** at least two pricing fixtures modelled on **different published pricing structures** (one with lifetime-specific cache writes and no long-context tier; one with whole-request long-context repricing), each marked as a fixture, plus usage fixtures covering every class and outcome.

**Checkpoint:** Product Architecture reviews contract v1 (types, fixtures, functions, version policy) and freezes it as `v1` before Phase 2 starts.

**Phase 2 — Cost-aware ledger:**
7. **Additive migrations (≥ 073):**
   - `ai_pricing_schemas` (versioned, JSON validated against contract v1; fixture marker);
   - `ai_unit_weight_schemas`;
   - `ai_global_budget_policies` (period, allowance in micro-USD, overall unresolved bound in micro-USD; fixture marker; **no real values seeded**);
   - nullable columns on NEM-019 ledger and usage tables for reserved and settled micro-USD, per-class usage (JSON), pricing-schema id, attempt number.

   No NEM-019 migration is edited. User foreign keys keep `ON DELETE CASCADE` or `SET NULL` (B-2).
8. **Cost-aware reservation:**
   - per attempt, reserve `worstCaseCost` in micro-USD (global guard) and in units (per-user allowance), pinned to the pricing and weight schema versions current at reservation;
   - **deny** if no active schema exists for the provider and model, if the input-token count is unavailable and no conservative estimate is configured, or if any check fails.
9. **Global spending allowance (D14):** at admission, under the existing **B-6 global advisory lock** (taken before the scope lock), `settled + compensated + unresolved-reserved micro-USD + new worst case ≤ allowance`, or deny.
10. **Per-attempt reservation (D15):**
    - each provider attempt has its own idempotency key derived from the turn key and attempt number;
    - a ledger API exposes `reserveAttempt` / `settleAttempt` / `releaseAttempt`;
    - turn-level aggregation is for reporting only.
11. **Durable settlement:**
    - settle from the normalized usage record, priced with the **pinned** schema;
    - one resolution per attempt key (existing unique index pattern);
    - unknown or partial usage leaves the reservation **held at its reserved amount**;
    - actual cost above the reserved amount is recorded, raises `intelligence_cost_overrun_total`, and is counted against the allowance; it never adjusts other entries.
12. **Reconciliation:** extended to attempt keys and the micro-USD dimension; still settles only from durable usage evidence, flags expiry once, and never releases to zero.
13. **Fail-closed admission:** carries over B-1. New causes include a missing or expired pricing schema, an exceeded global allowance, and an exceeded micro-USD unresolved bound.
14. **Metrics (no content labels):** `intelligence_budget_reserved_micro_usd_total`, `intelligence_budget_settled_micro_usd_total`, `intelligence_cost_overrun_total`, `intelligence_global_allowance_rejected_total`, plus the six NEM-019 counters.
15. Tests (§12), a technical-note update, `docs/database-migrations.md` entries, and a completion report.

## 6. Out of scope
- Any real provider, SDK, credential, network call, or price presented as real.
- The Gateway, router, streaming, citations, and simulator changes: those are **E2** (E1 only adds fixtures and pure functions).
- Budget, allowance, price, or weight **values** beyond marked fixtures (TT-09, TT-11, TT-16 remain open).
- Customer-visible capacity UI (TT-10); any frontend.
- Stripe, subscriptions, plans, tokens, `user_books`, reader, Escucha Activa.
- CI/CD, Docker, infrastructure, staging, merges, deployments.
- Editing NEM-019 migrations 069–072 or any deployed migration.

## 7. Product rules
- `BOOK TOKEN ≠ AI USAGE`: no shared table, code path, or foreign key with tokens.
- Per-user allowances stay in **internal units** (ADR-005); the **global** guard is in micro-USD (04 §4). Price changes affect the global guard, not customer capacity, until a new weight version is approved.
- No value is invented beyond marked fixtures. Unset policy denies.
- No model or provider name appears in customer-visible responses.

## 8. Protected systems
Reader, Escucha Activa, sync, ownership, `user_books`, `fragments`, tokens, Stripe, subscriptions, production data, and **NEM-019's accepted guarantees** (B-1, B-2, B-5, B-6, F-12, dark registration, router refusal of non-simulated providers). `app.module.ts` is not changed. Any need to touch these is a stop condition.

## 9. Technical requirements
- **One contract module.** Ledger code imports contract types; no duplicate schema definitions anywhere (architecture test).
- **Integer arithmetic only:** micro-USD and token counts as integers or BigInt; basis-point modifiers; rounding up on reservation, exact on settlement.
- **Worst-case correctness:**
  - the tier is chosen from the input-token count at reservation;
  - cache intent decides whether input is priced at the write or the uncached class (whichever is higher if uncertain);
  - reasoning tokens are bounded by `maxOutputTokens` unless the descriptor states a separate bound.
- **Locking:** global lock → scope lock (fixed order); the duplicate-key pre-check is retained; admission is one transaction.
- **Pinned versions:** each reservation records the pricing- and weight-schema ids; settlement and reconciliation use them.
- Every new table and column respects B-2 (cascade or set null; no content).
- Statement timeout applies to new transactions (existing helper).

## 10. Security / privacy / copyright
No content, prompts, book text, or PII in usage records, ledger rows, logs, metrics, or fixtures. Pricing schemas carry no secrets. Fixture prices are labelled as fixtures and are never seeded by migrations.

## 11. Acceptance criteria
**Contract (Phase 1)**
1. Contract v1 types, fixtures, `priceUsage`, and `worstCaseCost` exist in one module and were reviewed at the checkpoint before any Phase 2 commit.
2. `priceUsage` reproduces hand-computed costs for every class, tier, and modifier on both pricing fixtures (table-driven tests).
3. `worstCaseCost ≥ priceUsage(usage)` for every usage fixture that respects the descriptor bounds (property-based or exhaustive test).

**Ledger (Phase 2)**
4. With variable-cost attempts from N distinct users in parallel, total `settled + held` micro-USD never exceeds the global allowance; exact capacity is admitted; one micro-USD over is rejected (real PostgreSQL).
5. Per-user unit allowances, per-scope unresolved bounds, and idempotency behave as in NEM-019 (all existing NEM-019 unit and integration tests pass unchanged).
6. Each retry attempt reserves separately; a turn with three attempts holds three reservations until each resolves.
7. Settlement uses the pinned schema even if a newer schema is activated mid-flight.
8. Unknown or partial usage holds at the reserved amount; a ledger outage at settlement holds; reconciliation settles exactly once; replays never double-charge.
9. Overrun (actual > reserved) is recorded once, increments the overrun metric, and counts against the allowance.
10. Missing schema, missing count, unset global policy, an exceeded global allowance, and an exceeded micro-USD unresolved bound each **deny before any provider call**.
11. Account deletion (unchanged `UsersService.deleteAccount`) removes every new row for the user; the FK schema test covers new tables.
12. Architecture tests: no provider SDK or HTTP client in `knowledge/*`; no schema duplication; no token or subscription imports; router still refuses non-simulated providers.
13. Migrations run up and down on a disposable database, and no existing table outside NEM-019's set is altered.

## 12. Required tests
- **Unit** (`tests/unit/knowledge/**`, ≥ 80%): contract functions (table-driven and property tests), schema validation, ledger services with mocks, metrics.
- **Integration** (disposable PostgreSQL and Redis): multi-user global-allowance race; exact versus over capacity; per-attempt retries; pinned-version settlement; held/overrun/reconciliation; account deletion; migrations up/down.
- **Regression:** the full NEM-019 suites (1,182 unit tests at acceptance; 56 integration tests) pass unchanged.
- Raw test output in the completion report (F-10: CI has no PostgreSQL).

## 13. Observability
The §5.14 counters plus the existing six. No dashboards while dark (E11 adds panels).

## 14. Deployment / rollout
No deployment. Branch and Draft PR only. Rollback = close the PR.

## 15. Documentation deliverables
Technical-note section (contract v1 and ledger v2), migration entries, a `docs/reports/` completion report, contract v1 review record.

## 16. Open decisions
**None blocks execution.**

| Decision | How E1 stays safe without it |
|---|---|
| TT-09, TT-11 values; global allowance; unit weights; prices | Fixtures only; unset denies |
| PO-005 provider | Contract is provider-neutral; fixtures model published structures without naming a selection |
| B-2 cost-record retention | Keep `CASCADE` (current) |
| Identifier reservation (`NEM-021`) | Needed before approval |

## 17. Stop conditions
STOP and mark BLOCKED if any of the following arise:
- a change outside §5 appears necessary (especially to NEM-019 migrations, the reader, tokens, Stripe, CI, or infrastructure);
- a real price, provider, or network call seems necessary;
- the contract cannot express a fixture pricing structure without a provider-specific branch;
- a NEM-019 test must change to pass;
- a product value would need inventing.

## 18. Completion report
Per the README standard, with the contract v1 review record, raw test output, and a list of contract extension points E2 will use.

## 19. Product Architecture review
Checkpoint review of contract v1 (Phase 1), then the final review using `REVIEW-CHECKLIST.md`. Completion requires review and PO acceptance.
