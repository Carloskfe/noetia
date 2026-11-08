# ADR-005 — Tier Entitlements, Subscription Prerequisites, and AI Resource-Budget Boundaries

- **Status:** Proposed (draft; not accepted) — **revision 2, 2026-11-08**, reconciled with decided PO-026 and PO-028; ready for Product Architecture review
- **Date:** 2026-11-06 (SA-002-T0); revised 2026-11-08 (SA-002-T0 Rev 2)
- **Decided by:** pending: Product Architecture acceptance. Product Owner inputs: **PO-026 (decided 2026-11-08)**, PO-028 rule 4 (decided), PO-025 (draft), PO-030 (decided; requires this ADR)
- **Relates:** builds on ADR-001, ADR-002; PO-021…024. Extends NEM-003 `08` and `07`, which remain unchanged as historical design.

## Context
Noetia has three customer-facing tiers. Both premium tiers require an active **Individual, Duo, or Family** book subscription, as an add-on rather than a replacement (PO-026, decided 2026-11-08). Book ownership and tokens must stay independent of AI entitlement and budgets. On current code a premium plan row is unsafe: it would be listed publicly, issue tokens, unlock paid books, and overwrite the user's plan. Existing cancellation would also stop the entire Stripe subscription.

## Decision
A single **entitlement resolver** inside `knowledge/` is the only place tier is determined.

- **Output:** tier, capabilities, limits, budget policy, policy version, denial reason. Feature code never reads plans, subscriptions, or Stripe.
- **Tier policy is versioned data.** A limit or capability change is a new policy version under PO authority.
- **Resolution is deny-first.** Flags and rollout can only restrict. **Grants never bypass the prerequisite.** (This corrects the ordering in NEM-003 `18`.)
- **Prerequisite is a port.** The resolver asks a `QualifyingPlanPort` for `qualifying`, `not_qualifying`, or `unknown`; **`unknown` denies**. PO-026 names the qualifying subscription types (Individual, Duo, Family). Mapping real subscriptions, **linked members**, and **states** to these answers is a later mission, after TT-15; until then no production adapter exists.
- **Eligibility ends with the book subscription** (PO-026 rule 3). Cancelling premium never acts on the book subscription (rule 2).
- **Resource budgets are a separate domain.** Each premium tier has its own policy, and policies are keyed by **capability** as well as tier, so highlight-based intelligence has **its own AI usage controls** (PO-028 rule 4). No values are set here. Allowances use internal resource units; actual cost is recorded separately in micro-USD from versioned rate cards. Reservation precedes any model call and settlement follows it.

## Boundaries (normative)

| Boundary | Rule |
|---|---|
| Reader, content guard, library | Never call the resolver. A premium state never changes book access |
| `knowledge/*` and tokens | No import of `TokenLedger`, `TokenPackage`, or redemption; no shared table or foreign key |
| Billing | Premium invoices issue no tokens. Cancelling a premium tier must act on the premium line or subscription only |
| Household | Resolver keyed by individual `userId`. `linkedUserIds` grants nothing unless TT-15 says otherwise. **Household membership never shares private knowledge, highlights, or AI conversations** (PO-026 rule 6) |
| Stripe shape | Resolver is structure-neutral; it reads a normalized entitlement, never Stripe objects |
| Failure | Unknown entitlement denies AI and affects nothing else |

## Consequences
**Positive:** one enforcement point; billing structure can be chosen later; token and ownership guarantees are testable by architecture tests; dark delivery is possible with simulated ports.
**Negative:** a port with no production adapter until billing work lands; a new policy table and budget ledger; two measures (units, cost) to keep aligned.

## Guardrails
- No premium plan row before product-line work (M-C, M-D) and ownership enforcement (NEM-013).
- No budget value, model price, or subscription price is set by this ADR. Values follow measurement and PO approval.
- COGS bands per PO-001 (15/25/35), reported **per tier**.
- `BOOK TOKEN ≠ AI USAGE`.

## Alternatives considered
- **Compose on `SubscriptionGuard` (NEM-003 `08`) — rejected:** that guard is the book-content gate; coupling breaks PO-021.
- **Plan checks in controllers — rejected:** scattered checks (NEM-002A lesson).
- **Budgets in dollars only — rejected:** a provider price change would silently shrink customer capacity.
- **Grants bypass the prerequisite — rejected:** contradicts PO-026. A pilot exception would need its own decision (TT-23).

## Open (subordinate) decisions
Qualifying plans, linked members, and states (TT-15) · billing structure and lifecycle (TT-16) · budget values and targets (TT-09) · customer visibility (TT-10) · limit behaviour (TT-11) · pilot participants (TT-23).

## Revision history
| Rev | Date | Change |
|---|---|---|
| 1 | 2026-11-06 | Drafted under SA-002-T0 from preliminary rulings |
| 2 | 2026-11-08 | Reconciled with decided PO-026 (qualifying subscription types; add-on; eligibility ends with the book subscription; household privacy) and PO-028 rule 4 (separate usage controls for highlight intelligence). Still **Proposed** |

## Legal note
Product and architecture policy, not legal advice.
