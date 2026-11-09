# E1 / E2 Mission Drafts — Dependency, Acceptance, and Risk Summary

**Status:** DRAFT documentation for independent Product Architecture review · **Date:** 2026-11-09
**Approved (2026-11-09):** both specifications approved and identifiers reserved by the PO ([PO-032](../operating-framework/decisions/product-owner/PO-032-approval-of-nem-021-and-nem-022-specifications.md)). **Execution is not authorized.** NEM-021's contract v1 checkpoint precedes ledger work, and NEM-021 must be accepted before NEM-022 executes.

**Revision 3 (2026-11-09):** F-4. `committed = settled (full actual) + held (unresolved reserved exposure) + compensated (separate adjustments only)`. An overrun is an audit classification inside *settled*, never an extra charge. Golden test: reserved $1.00, actual $1.40 → committed $1.40 (not $1.80). `zero_confirmed` requires authoritative no-charge evidence; an error category alone never releases a reservation.

**Revision 2 (2026-11-09):** architecture review corrections:
- **F-1:** a hard admission invariant plus a conditional spend bound, explicit overrun debt, and a fail-closed breaker;
- **F-2:** deterministic monetary arithmetic;
- **F-3:** one shared outcome/error model.

E1 and E2 specifications and this summary are updated; sequencing is unchanged.

**Authority:** [PO-031](../operating-framework/decisions/product-owner/PO-031-development-planning-baseline-and-e1-e2-drafting.md) (D-1): planning baseline accepted; **drafting only**. Nothing here executes, merges, deploys, reserves identifiers, or acquires a provider.

**Documents:**
- [E1 — Provider-Neutral AI Contract and Cost Accounting](../engineering-missions/APPROVED/NEM-021-provider-neutral-ai-contract-and-cost-accounting.md) (**`NEM-021`, approved and reserved 2026-11-09**)
- [E2 — Provider-Independent AI Gateway and Simulator v2](../engineering-missions/APPROVED/NEM-022-provider-independent-ai-gateway-and-simulator-v2.md) (**`NEM-022`, approved and reserved 2026-11-09**)

## 1. Sequencing (P0 packet §A4.1)

```
NEM-019 (accepted, #46)
   └── E1 phase 1: shared provider contract v1  ── Product Architecture checkpoint review; freeze v1
          └── E1 phase 2: cost-aware ledger (against v1 only)
                 └── E2: Gateway, simulator v2, provider contract suite (against v1; additive v1.x only)
```

| Concern | How the drafts prevent conflict |
|---|---|
| **Schema ownership** | One module, `src/knowledge/ai/contract/`. E1 writes and freezes v1; the Gateway owns it from E2 onward. Architecture tests in both missions fail on duplicate definitions |
| **Contract changes** | E2 may extend additively (v1.x) and must re-run E1's suites. Anything incompatible is a stop condition requiring v2 and review |
| **Duplicate infrastructure** | Neither mission adds a service, an environment, or a CI change. Both reuse disposable local containers, the existing integration config, and the local VM rules |
| **Unauthorized product decisions** | Both missions use fixture values only. No model choice, no prices, no budget values, no capacity UI, no web capability (TT-18 open), no export or billing choices |
| **NEM-019 guarantees** | Both list B-1, B-2, B-5, B-6, F-12, dark registration, and router refusal of non-simulated providers as protected; all NEM-019 suites must pass unchanged |
| **Schema evolution** | E1 adds migrations ≥ 073 (additive; NEM-019's 069–072 untouched, including the legacy `outcome` CHECK; 068 belongs to NEM-016). E2 has no schema changes |
| **Outcomes and money math** | One outcome/error table (E1 §9.3) and one arithmetic specification (E1 §9.2) inside contract v1. E2 defines no categories and no pricing code of its own (architecture test) |

## 2. Acceptance-criteria summary

| Area | E1 | E2 |
|---|---|---|
| Contract | v1 reviewed before ledger work; `priceUsage` exact on two fixture pricing structures; `worstCaseCost ≥ actual` for all bounded fixtures | Consumes v1 only; contract suite (`runProviderContract`) passes on simulator v2; a broken adapter fails it |
| Money safety | **Admission invariant** `committed + worst case ≤ allowance` asserted at every admission under multi-user concurrency; exact capacity admitted, one over rejected; per-attempt reservations; pinned price versions; held on unknown usage. **Overrun**: full actual settled and counted once; the excess is classified for audit, not added again; breaker opens; admissions on that schema fail closed. Golden accounting test ($1.00 reserved, $1.40 actual → committed $1.40). Spend bound stated as conditional: `≤ allowance + Σ overruns`, with zero overruns when the model is correct | End-to-end across all outcome paths: admission invariant holds; within-reservation runs stay ≤ allowance; injected overrun is settled once (classified, not double-counted) and the breaker denies further admissions |
| Arithmetic | Golden vectors (fractional prices, tier boundary, modifier order independence), ceiling on reservation, half-up on settlement, BigInt only, overflow denied, no floating point | Uses E1 functions only; contract suite checks usage prices identically through E1 golden vectors |
| Outcomes | `ledgerActionFor` matches every §9.3 row; release only on **evidenced** `zero_confirmed` (provider-reported zero or contract-verified documented no-charge); an unevidenced rejection is held; exact legacy-column mapping | Every error maps to exactly one §9.3 row; retries only on retryable rows, each a new reserved attempt; `context_too_large` and `capability_unavailable` caught before reservation |
| Fail-closed | Missing schema, missing token count, unset policy, insufficient capacity (including after an overrun), exceeded unresolved bound, or open overrun breaker → deny before any call | No capability match or oversize context → no reservation; no call without a confirmed per-attempt reservation |
| Rights and scope | Unchanged (F-12) | Citations validated against the sealed allowed set; scope-violation path; origin rules |
| Dark and security | No SDK or HTTP client; no token or subscription imports | Same, plus no credential reads; router refuses non-simulated providers; injection fixtures |
| Regression | All NEM-019 tests unchanged | All NEM-019 and E1 tests unchanged; turn order and Context Builder invariant unchanged |
| Deletion | New rows cascade (B-2) | No new tables |

## 3. Decisions that genuinely block implementation

**No TT decision blocks either mission.** What remains before each can run:
1. **Identifier reservation** (`NEM-021`, `NEM-022`), a PO act.
2. **PO approval** of each specification after Product Architecture review.
3. A **separate explicit execution instruction** naming each mission (E2 only after E1 is accepted).

All product values (TT-09, TT-11, TT-16 prices, unit weights, the global allowance) stay fixtures; PO-005 stays at the gate.

## 4. Implementation risks

| Risk | Severity | Mitigation in the drafts |
|---|---|---|
| Contract v1 over-fits the two fixture structures and misses a future provider's pricing model | Medium | Non-token units, whole-request tiers, basis-point modifiers, versioning, additive v1.x path; checkpoint review before ledger work |
| Worst-case reservation is too conservative, wasting allowance capacity | Medium | Reserve the worst case, settle the actual; overrun metric; calibration happens at the gate with real usage |
| Worst case is wrong (e.g. an unmodelled charge), so the ledger under-reserves | High | Property tests (`worstCaseCost ≥ actual`); full actual settled and counted once; overrun classified for audit (not added again); **breaker fails closed on the affected schema**; in-flight attempts admitted before the breaker opens remain a reported residual; provider backstop at the gate; stop condition if a structure cannot be expressed |
| Rounding drift between reservation and settlement | Low | Single rounding step per attempt (ceiling vs half-up); exact BigInt intermediates; totals defined as sums of per-attempt amounts; golden vectors shared by E1 and E2 |
| Double-counting or premature release | Medium | One-obligation-once definition with a held → settled transition in the same transaction; golden and partial-settlement tests; release only with recorded evidence; contract suite fails adapters that claim zero usage without evidence |
| Outcome-category divergence between Gateway and ledger | Medium | One table in contract v1; E2 may not add categories outside it; contract suite covers every row |
| One global advisory lock limits admission throughput | Low (dark) / Medium (scale) | Short transactions; measure in E11; sharding is a later option without changing authority |
| Schema drift between E1 and E2 | Medium | Single module; duplicate-definition architecture tests; E2 re-runs E1 suites |
| Simulator realism gives false confidence | High | Stated explicitly: simulated tests are not validation (P0 §A6); real validation at the gate |
| Deep stacked-PR chain (#34 → #48 → E1 → E2) increases rebase and merge risk | Medium | Branch from the latest stack head; F-6 merge plan in E11; no merge without authorization |
| Local VM resource limits during heavier test suites | Low | `--maxWorkers=2`, one heavy job at a time, disposable containers (~60 MB) |
| Migration numbering collision with NEM-016 (068) | Low | Start E1 at 073; verify order before any deployment (D17) |

## 5. Restrictions honoured

Documentation only. No application code, migrations, infrastructure, CI/CD, Stripe, subscription, or production change. No environment created, no AI provider connected, no AI cost incurred, nothing merged or deployed. No ADR or earlier PO decision modified; PO-031 is added and the register updated.
