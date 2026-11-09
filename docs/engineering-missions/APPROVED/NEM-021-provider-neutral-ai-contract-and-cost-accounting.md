# NOETIA ENGINEERING MISSION — NEM-021 (E1)
## Provider-Neutral AI Contract and Cost Accounting

**Status:** **IN PROGRESS — PHASE 1 COMPLETE (REVISION 2: CHECKPOINT CORRECTIONS F-5, F-6), AWAITING PRODUCT ARCHITECTURE CHECKPOINT RE-REVIEW** (execution authorized 2026-11-09 for Phase 1 only; [Phase 1 report](../../reports/2026-11-09-NEM-021-phase-1-contract-v1-report.md)). Phase 2 is not started and not authorized. Specification: Revision 3, including corrections F-1…F-4. Approved by the Product Owner on **2026-11-09** ([PO-032](../../operating-framework/decisions/product-owner/PO-032-approval-of-nem-021-and-nem-022-specifications.md)). Drafted under [PO-031](../../operating-framework/decisions/product-owner/PO-031-development-planning-baseline-and-e1-e2-drafting.md).
**Identifier:** `NEM-021`, reserved by the PO on 2026-11-09 ([PO-032](../../operating-framework/decisions/product-owner/PO-032-approval-of-nem-021-and-nem-022-specifications.md)).
**Mission type:** IMPLEMENTATION
**Implementation authorization:** LIMITED to §5 **Phase 1** (items 1–6) — **active since 2026-11-09**. Phase 2 (items 7–15) is **not authorized** until Product Architecture reviews and freezes contract v1 and the PO authorizes continuation
**Schema changes:** ADDITIVE ONLY (new migrations ≥ 073), applied to disposable test databases only
**Infrastructure changes:** NOT AUTHORIZED
**Production deployment:** NOT AUTHORIZED (staging also NOT AUTHORIZED; merge to `main` NOT AUTHORIZED)
**Product Owner approval:** **GRANTED 2026-11-09** (specification only; [PO-032](../../operating-framework/decisions/product-owner/PO-032-approval-of-nem-021-and-nem-022-specifications.md))

> **APPROVED ≠ EXECUTE.** Execution requires a separate PO instruction naming this mission.

> **Execution authorization (2026-11-09):** *"I authorize execution of NEM-021 according to its approved specification, using the existing development branch and disposable local test environments. Stop for Product Architecture review after Phase 1 contract v1, before Phase 2 ledger implementation. Do not execute NEM-022, merge, deploy, connect AI providers, or incur AI costs."* Branch: `feat/nem-021-provider-neutral-contract`, stacked on PR #49.

> **Product Owner approval (2026-11-09).** *Product Owner Approval of E1/E2 Specifications* ([PO-032](../../operating-framework/decisions/product-owner/PO-032-approval-of-nem-021-and-nem-022-specifications.md)): this specification (Revision 3) is **approved** and identifier `NEM-021` reserved. Moved from `DRAFT/` to `APPROVED/`. Scope and acceptance criteria are unchanged by the approval. **Binding sequencing:**
> 1. Phase 1 (shared provider contract v1) requires its Product Architecture checkpoint review and freeze before any Phase 2 ledger implementation.
> 2. NEM-021 must be completed and accepted before NEM-022 executes.
>
> Not authorized: execution, merge, deployment, provider acquisition.

> **Revision 3 (2026-11-09):** review correction F-4: each monetary obligation is counted exactly once (§9.1); overrun is an audit classification, not an extra charge; `zero_confirmed` requires authoritative no-charge evidence (§9.3).
> **Revision 2 (2026-11-09):** review corrections F-1 (global allowance invariant and overruns, §9.1), F-2 (deterministic monetary arithmetic, §9.2), F-3 (one shared outcome/error model, §9.3). Acceptance criteria and tests updated to match. Mission structure and contract-first sequencing unchanged.

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
2. **Normalized usage record:** per-class token counts (`inputUncached`, `cacheWrite` keyed by lifetime, `cacheRead`, `output`, `reasoning` if reported separately), `nonTokenUnits` map, **`outcome`** and optional **`error`** per the shared outcome model (§9.3), **usage completeness** (`complete` | `partial` | `unknown` | `zero_confirmed`), **`zeroUsageEvidence`** (`provider_reported_zero` | `documented_no_charge` | `none`; §9.3), provider and model keys, attempt key, timestamps. No content fields.
3. **Pricing schema:** version, effective-from, `verifiedAt`, source note; per-class prices as integer **micro-USD per million tokens** (non-token units: micro-USD per million units); **threshold tiers that reprice the whole request** when input tokens are **strictly greater** than the threshold; modifiers as integer **factor basis points** (10,000 = ×1.0); arithmetic per §9.2; non-token unit prices; a test-fixture marker.
4. **Pure functions:** `priceUsage(usage, schema)` (settlement rounding) and `worstCaseCost(descriptor, schema, inputTokens, maxOutputTokens, cacheIntent)` (reservation rounding). The worst case prices every input token at the highest applicable class and tier, plus the output bound. Both follow §9.2 exactly. A shared `ledgerActionFor(outcome, error, completeness)` encodes the §9.3 table.
5. **Unit-weight schema** (ADR-005 internal units): versioned per-class weights mapping usage to allowance units, independent of prices.
6. **Deterministic fixtures:** at least two pricing fixtures modelled on **different published pricing structures** (one with lifetime-specific cache writes and no long-context tier; one with whole-request long-context repricing), each marked as a fixture, plus usage fixtures covering every class and outcome.

**Checkpoint:** Product Architecture reviews contract v1 (types, fixtures, functions, version policy) and freezes it as `v1` before Phase 2 starts.

**Phase 2 — Cost-aware ledger:**
7. **Additive migrations (≥ 073)** (NEM-019's `ai_usage_events.outcome` CHECK is **not** altered; new nullable columns `contractOutcome`, `errorCategory`, and `usageCompleteness` carry the §9.3 model, and the legacy column receives the mapped value):
   - `ai_pricing_schemas` (versioned, JSON validated against contract v1; fixture marker);
   - `ai_unit_weight_schemas`;
   - `ai_global_budget_policies` (period, allowance in micro-USD, overall unresolved bound in micro-USD; fixture marker; **no real values seeded**);
   - nullable columns on NEM-019 ledger and usage tables for reserved and settled micro-USD, per-class usage (JSON), pricing-schema id, attempt number, and the §9.3 outcome fields;
   - an append-only `ai_cost_overruns` table keyed by attempt (**classification records** of excess already included in settled cost; never summed into `committed`) and an overrun-breaker table keyed by pricing-schema id (open/closed, opened-at, closed-by-review reference).

   No NEM-019 migration is edited. User foreign keys keep `ON DELETE CASCADE` or `SET NULL` (B-2).
8. **Cost-aware reservation:**
   - per attempt, reserve `worstCaseCost` in micro-USD (global guard) and in units (per-user allowance), pinned to the pricing and weight schema versions current at reservation;
   - **deny** if no active schema exists for the provider and model, if the input-token count is unavailable and no conservative estimate is configured, or if any check fails.
9. **Global spending allowance (D14):** at admission, under the existing **B-6 global advisory lock** (taken before the scope lock), apply the **admission invariant** and the overrun rules in §9.1, or deny.
10. **Per-attempt reservation (D15):**
    - each provider attempt has its own idempotency key derived from the turn key and attempt number;
    - a ledger API exposes `reserveAttempt` / `settleAttempt` / `releaseAttempt`;
    - turn-level aggregation is for reporting only.
11. **Durable settlement:**
    - settle from the normalized usage record, priced with the **pinned** schema;
    - one resolution per attempt key (existing unique index pattern);
    - unknown or partial usage leaves the reservation **held at its reserved amount**;
    - actual cost above the reserved amount is **never capped or hidden**: the full actual is settled; the excess is **classified** as an overrun (audit record, not an additional charge); the §9.1 breaker trips. No other entry is ever adjusted;
    - release (no charge) happens **only** when usage is `zero_confirmed` **with authoritative evidence** (§9.3).
12. **Reconciliation:** extended to attempt keys and the micro-USD dimension; still settles only from durable usage evidence, flags expiry once, and never releases to zero.
13. **Fail-closed admission:** carries over B-1. New causes:
    - a missing or expired pricing schema;
    - no remaining capacity (`committed ≥ allowance`, including after an overrun);
    - an exceeded micro-USD unresolved bound;
    - an **open overrun breaker** for the pricing schema in use (§9.1).
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
- **Monetary arithmetic, allowance invariant, and outcome model:** see §9.1–§9.3. Floating-point arithmetic on money or tokens is prohibited (architecture test).
- **Worst-case correctness:**
  - the tier is chosen from the input-token count at reservation;
  - cache intent decides whether input is priced at the write or the uncached class (whichever is higher if uncertain);
  - reasoning tokens are bounded by `maxOutputTokens` unless the descriptor states a separate bound.
- **Locking:** global lock → scope lock (fixed order); the duplicate-key pre-check is retained; admission is one transaction.
- **Pinned versions:** each reservation records the pricing- and weight-schema ids; settlement and reconciliation use them.
- Every new table and column respects B-2 (cascade or set null; no content).
- Statement timeout applies to new transactions (existing helper).

### 9.1 Global allowance invariant, overruns, and capacity (F-1)

**Definitions, per allowance period. Each monetary obligation is counted exactly once:**

| Term | Meaning | In `committed`? |
|---|---|---|
| **Settled** | The **full actual cost** of every resolved attempt, including any amount above its reservation | Yes |
| **Held** | For each unresolved attempt, its unresolved reserved exposure: `max(0, reserved − settled so far for that attempt)`. Zero once the attempt is fully resolved | Yes |
| **Compensated** | Separately established adjustments (signed) that are **not** already included in settled or held, e.g. a later provider-invoice correction recorded as a compensating entry | Yes |
| **Overrun** | `actual − reserved` for an attempt whose actual exceeds its reservation: an **auditable classification** of excess that is already inside *settled* | **No.** Never added again |

- `committed = settled + held + compensated`
- `capacity = allowance − committed`, which may be negative after an overrun.

**Transition rule:** when an attempt settles, its held exposure is replaced by its settled actual in the same transaction, so the obligation moves from *held* to *settled* and is never in both. A partial settlement reduces held by the settled amount, floored at zero. Release sets held to zero with no settled amount.

**Admission invariant (hard; enforced by the ledger):** an attempt is admitted only if, at that moment, under the B-6 global lock, `committed + worstCaseCost(attempt) ≤ allowance`. The invariant holds at **every admission**; it is what the ledger guarantees and what tests assert.

**Spend bound (conditional, not absolute):** `final settled cost ≤ allowance + Σ recorded overruns`. Overruns are **zero whenever the worst-case model is correct**: the pricing schema matches billing, the descriptor bounds hold, and the provider honours `max_tokens`. The ledger cannot make an absolute dollar guarantee against a wrong model. That residual belongs to the external provider limit at the gate.

**Overrun treatment:**
1. Settlement records the **full actual cost** in *settled*. The excess (`actual − reserved`) is written once as an **overrun classification** for that attempt (idempotent by attempt key) for audit, metrics, and the breaker. It is **not** added to `committed` again.
2. Because *settled* already contains the excess, capacity may go negative; **no admission succeeds while `capacity < worstCaseCost` of the requested attempt**.
3. Any overrun **opens a breaker** on the pricing schema used: new admissions priced with that schema **fail closed** (`budget_unavailable`). It closes only when a reviewed replacement schema version is activated; the review reference is recorded.
4. `intelligence_cost_overrun_total` and `intelligence_overspend_micro_usd_total` increment; no content.
5. Settled cost, including excess, belongs to the period in which it was settled. Nothing is carried into the next period automatically; period roll-over is configuration and needs no product value now.
6. **Reconciliation** follows the same rule: settling a held attempt from evidence moves it from held to settled; any overrun classification is written at that point only; a later correction is a compensating entry, never an edit and never a second settlement.

**In-flight exposure:** attempts already admitted when the breaker opens may still overrun under the same model error. That residual is bounded by those attempts' reservations times the pricing error and is reported, not prevented. It is listed as a residual risk.

### 9.2 Deterministic monetary arithmetic (F-2)

| Item | Rule |
|---|---|
| Price units | Integer **micro-USD per 1,000,000 tokens** (or per 1,000,000 non-token units). Any price with up to 6 decimal places in USD per million is exact (e.g. $0.01/M = 10,000; $0.125/M = 125,000) |
| Exact intermediate | `Σ_class tokens_c × price_c` as **BigInt**, in pico-USD (10⁻⁶ micro-USD). No intermediate rounding |
| Tier selection | Before pricing: the tier is chosen from the request's **total input tokens** (all input classes); "above threshold" means strictly greater; the chosen tier prices **all** classes |
| Modifiers | Integer factor basis points, applied as exact rational multiplication in a **canonical order** (batch, then region, then any others by key ascending): numerator × factor, denominator × 10,000. Exact arithmetic makes the result order-independent; the canonical order is fixed for auditability |
| Rounding (single, at the end) | Reservation (`worstCaseCost`): **ceiling** to integer micro-USD. Settlement (`priceUsage`): **round half up** to integer micro-USD. Allowance units use the same rules with unit weights |
| Aggregates | Turn, user, and period totals are sums of per-attempt rounded amounts (documented, so totals are reproducible from ledger rows) |
| Bounds and overflow | Token counts are integers within `[0, 2⁵³−1]` and within descriptor bounds. Prices ≤ a configured maximum (schema validation). All money math in BigInt. Values written to `bigint` columns must be ≤ 2⁶³−1, otherwise the request is **denied** (fail closed) and a validation error is recorded |
| Floating point | Prohibited for money and tokens (architecture test over `knowledge/*`) |
| Reproducibility | The same usage, schema version, and modifiers always produce the same micro-USD. Settlement and reconciliation use the schema version pinned at reservation |

### 9.3 Shared outcome and error model (F-3)

One model in contract v1, used by E1 (settlement) and E2 (Gateway, retries, contract tests). **`outcome`** says what happened to the attempt; **`error`** says why (absent on success); **`usageCompleteness`** says what the ledger may do.

| `error` (category) | `outcome` | Usage completeness | Retryable (E2) | Ledger action (E1) |
|---|---|---|---|---|
| — | `completed` | `complete` | — | Settle actual |
| `malformed_output` (structured output failed validation) | `completed` | `complete` | No (default) | Settle actual; caller gets a failure |
| `refusal` | `refused` | `complete` or `partial` | No | Settle reported; partial → hold the remainder of the reservation until reconciliation |
| `invalid_request` | `rejected` | `zero_confirmed` **only with evidence**, else `unknown` | No | Release if evidenced; otherwise hold |
| `context_too_large` (provider-reported) | `rejected` | `zero_confirmed` **only with evidence**, else `unknown` | No | Release if evidenced; otherwise hold. The Gateway should catch it **before reservation** from the descriptor; reaching the provider is a defect metric |
| `rate_limited` | `rejected` | `zero_confirmed` **only with evidence**, else `unknown` | Yes, after retry-after, as a **new attempt** | Release this attempt if evidenced; otherwise hold |
| `provider_unavailable` | `failed` | `unknown` unless the provider confirms zero | Yes (bounded), new attempt | Hold (or release if `zero_confirmed`) |
| `timeout` | `timed_out` | `unknown` | Yes (bounded), new attempt | Hold |
| `client_abort` | `aborted` | `partial` or `unknown` | No | Hold |
| `internal` | `failed` | `unknown` | No | Hold |
| `capability_unavailable` (Gateway decision) | `not_sent` | n/a | No | **No reservation is made**; no usage record |

**Rules:**
- **`zero_confirmed` requires authoritative no-charge evidence**, recorded in `zeroUsageEvidence`:
  - `provider_reported_zero`: the provider's response for that attempt carries a usage object reporting zero billable units; or
  - `documented_no_charge`: the adapter's declared capability descriptor states, with a reference to the provider's documentation, that this error class is never billed, and contract tests verify the adapter only claims it for that class.
- **An error category alone never authorizes release.** Without evidence, completeness is `unknown` and the reservation is **held**.
- The simulator marks its evidence explicitly so tests cover both evidenced and unevidenced rejections.
- Release only on evidenced `zero_confirmed`; otherwise settle reported usage or hold.
- Legacy NEM-019 `ai_usage_events.outcome` gets a mapped value: `completed` → `success`; `refused`, `rejected`, and `failed` → `failure`; `timed_out` → `timeout`; `aborted` → `aborted`. The precise values live in the new nullable columns.
- The table is part of contract v1. Additions (new categories) are additive v1.x changes and must include a row here.


## 10. Security / privacy / copyright
No content, prompts, book text, or PII in usage records, ledger rows, logs, metrics, or fixtures. Pricing schemas carry no secrets. Fixture prices are labelled as fixtures and are never seeded by migrations.

## 11. Acceptance criteria
**Contract (Phase 1)**
1. Contract v1 types, fixtures, `priceUsage`, and `worstCaseCost` exist in one module and were reviewed at the checkpoint before any Phase 2 commit.
2. `priceUsage` reproduces hand-computed costs for every class, tier, and modifier on both pricing fixtures (table-driven tests).
3. `worstCaseCost ≥ priceUsage(usage)` for every usage fixture that respects the descriptor bounds (property-based or exhaustive test).
3a. **Arithmetic (F-2):**
   - golden vectors with fractional prices (e.g. 1 token at $0.01/M: reservation 1 micro-USD by ceiling, settlement 0 by half-up);
   - tier boundary at exactly the threshold versus one above;
   - modifier combinations give identical results in any input order;
   - determinism across repeated runs;
   - overflow and out-of-range inputs are denied;
   - no floating point in money paths (architecture test).
3b. **Outcome model (F-3):** `ledgerActionFor` returns the §9.3 action for every row; release happens only on **evidenced** `zero_confirmed`; the legacy-column mapping is exact.

**Ledger (Phase 2)**
4. **Admission invariant (F-1):**
   - with variable-cost attempts from N distinct users in parallel, `committed + reservation ≤ allowance` holds at **every** admission (instrumented check);
   - when actual ≤ reserved for all attempts, final settled + held ≤ allowance;
   - exact capacity is admitted, and one micro-USD over is rejected (real PostgreSQL).
5. Per-user unit allowances, per-scope unresolved bounds, and idempotency behave as in NEM-019 (all existing NEM-019 unit and integration tests pass unchanged).
6. Each retry attempt reserves separately; a turn with three attempts holds three reservations until each resolves.
7. Settlement uses the pinned schema even if a newer schema is activated mid-flight.
8. Unknown or partial usage holds at the reserved amount; a ledger outage at settlement holds; reconciliation settles exactly once; replays never double-charge.
9. **Overrun (F-1), with an injected under-priced schema:**
   - actual cost is recorded exactly and never capped;
   - the excess is classified once as an overrun record;
   - `committed` counts the obligation **exactly once** (through settled);
   - the breaker opens and denies new admissions on that schema until a reviewed replacement is activated;
   - admissions stop while capacity is insufficient;
   - final total equals the allowance bound plus exactly the injected overruns (no hidden or double-counted amount).
9a. **Golden accounting test (F-4):**
   - reservation 1,000,000 micro-USD ($1.00), no other obligations: `committed` = 1,000,000 (held) before settlement;
   - actual 1,400,000 ($1.40): after settlement, settled = 1,400,000, held = 0, overrun classification = 400,000, and **`committed` = 1,400,000, not 1,800,000**;
   - replaying settlement and running reconciliation twice leave all four values unchanged;
   - a partial settlement case (reserved 1.00, partial 0.30 settled, then final 1.10) gives committed 1.00 → 1.00 → 1.10, never above the true obligation.
9b. **Release evidence (F-4):** a `rejected` attempt with an error category but `zeroUsageEvidence = none` is **held**, not released. The same attempt with `provider_reported_zero` or a contract-verified `documented_no_charge` is released.
10. Missing schema, missing count, unset global policy, insufficient capacity (including after overrun), an exceeded micro-USD unresolved bound, and an open overrun breaker each **deny before any provider call**.
11. Account deletion (unchanged `UsersService.deleteAccount`) removes every new row for the user; the FK schema test covers new tables.
12. Architecture tests: no provider SDK or HTTP client in `knowledge/*`; no schema duplication; no token or subscription imports; router still refuses non-simulated providers.
13. Migrations run up and down on a disposable database, and no existing table outside NEM-019's set is altered.

## 12. Required tests
- **Unit** (`tests/unit/knowledge/**`, ≥ 80%): contract functions (table-driven and property tests), schema validation, ledger services with mocks, metrics.
- **Integration** (disposable PostgreSQL and Redis): multi-user race asserting the admission invariant at every admission; exact versus over capacity; injected-overrun breaker and once-only accounting (golden test §11.9a); per-attempt retries; pinned-version settlement; held/release per the §9.3 table; reconciliation; account deletion; migrations up/down.
- **Arithmetic golden vectors and property tests** (§9.2), shared as fixtures with E2.
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
