# E1 / E2 Mission Drafts — Dependency, Acceptance, and Risk Summary

**Status:** DRAFT documentation for independent Product Architecture review · **Date:** 2026-11-09
**Authority:** [PO-031](../operating-framework/decisions/product-owner/PO-031-development-planning-baseline-and-e1-e2-drafting.md) (D-1): planning baseline accepted; **drafting only**. Nothing here executes, merges, deploys, reserves identifiers, or acquires a provider.

**Documents:**
- [E1 — Provider-Neutral AI Contract and Cost Accounting](../engineering-missions/DRAFT/E1-provider-neutral-ai-contract-and-cost-accounting.md) (proposed `NEM-021`)
- [E2 — Provider-Independent AI Gateway and Simulator v2](../engineering-missions/DRAFT/E2-provider-independent-ai-gateway-and-simulator-v2.md) (proposed `NEM-022`)

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
| **Schema evolution** | E1 adds migrations ≥ 073 (additive; NEM-019's 069–072 untouched; 068 belongs to NEM-016). E2 has no schema changes |

## 2. Acceptance-criteria summary

| Area | E1 | E2 |
|---|---|---|
| Contract | v1 reviewed before ledger work; `priceUsage` exact on two fixture pricing structures; `worstCaseCost ≥ actual` for all bounded fixtures | Consumes v1 only; contract suite (`runProviderContract`) passes on simulator v2; a broken adapter fails it |
| Money safety | Global micro-USD allowance holds under multi-user concurrency; exact capacity admitted, one over rejected; per-attempt reservations; pinned price versions; held on unknown usage; overrun recorded and counted | End-to-end across success, retry, refusal, timeout, abort, and partial-stream paths keeps settled + held ≤ allowance |
| Fail-closed | Missing schema, missing token count, unset policy, exceeded allowance, or exceeded unresolved bound → deny before any call | No capability match → deny before reservation; no call without a confirmed per-attempt reservation |
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
| Worst case is wrong (e.g. an unmodelled charge), so the ledger under-reserves | High | Property tests (`worstCaseCost ≥ actual`); overrun metric; provider backstop at the gate; stop condition if a structure cannot be expressed |
| One global advisory lock limits admission throughput | Low (dark) / Medium (scale) | Short transactions; measure in E11; sharding is a later option without changing authority |
| Schema drift between E1 and E2 | Medium | Single module; duplicate-definition architecture tests; E2 re-runs E1 suites |
| Simulator realism gives false confidence | High | Stated explicitly: simulated tests are not validation (P0 §A6); real validation at the gate |
| Deep stacked-PR chain (#34 → #48 → E1 → E2) increases rebase and merge risk | Medium | Branch from the latest stack head; F-6 merge plan in E11; no merge without authorization |
| Local VM resource limits during heavier test suites | Low | `--maxWorkers=2`, one heavy job at a time, disposable containers (~60 MB) |
| Migration numbering collision with NEM-016 (068) | Low | Start E1 at 073; verify order before any deployment (D17) |

## 5. Restrictions honoured

Documentation only. No application code, migrations, infrastructure, CI/CD, Stripe, subscription, or production change. No environment created, no AI provider connected, no AI cost incurred, nothing merged or deployed. No ADR or earlier PO decision modified; PO-031 is added and the register updated.
