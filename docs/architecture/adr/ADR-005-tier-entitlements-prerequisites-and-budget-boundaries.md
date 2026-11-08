# ADR-005 — Tier Entitlements, Subscription Prerequisites, and AI Resource-Budget Boundaries

- **Status:** Proposed (draft; not accepted) — **revision 3, 2026-11-08**: review corrections B-1, B-2, B-5 incorporated (review PR #41, accepted by the PO); ready for formal acceptance review
- **Date:** 2026-11-06 (SA-002-T0); revised 2026-11-08 (SA-002-T0 Rev 2; review corrections)
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
- **Resource budgets are a separate domain.** Each premium tier has its own policy, and policies are keyed by **capability** as well as tier, so highlight-based intelligence has **its own AI usage controls** (PO-028 rule 4). No values are set here. Allowances use internal resource units; actual cost is recorded separately in micro-USD from versioned rate cards. Reservation precedes any model call and settlement follows it, as specified below.
- **Budget authority (B-1).** The PostgreSQL ledger is the **only authority** for allowances, reservations, and settlements. Redis, if used, is an admission-control cache that can be rebuilt from the ledger and is never the sole record of a reservation. If the reservation store or the ledger is unavailable, errors, or rejects a write, the request is **denied before any model call** (fail closed). Every reservation carries an idempotency key (one per turn or request), an owner, a capability, and an expiry. Budget keys in any shared store are namespaced and always carry an expiry. No values are set here.
- **Durable settlement and recovery (B-5).**
  - A reservation is **written to the ledger before** any provider call. Settlement is a separate ledger entry keyed by the same idempotency key, protected by a uniqueness constraint, so a replay or retry **can never charge twice**.
  - **Settlement is never assumed.** After a provider success, failure, timeout, or abort, settlement records the usage the Gateway reports. If actual usage is unknown, or the ledger cannot be written at that moment, the reservation stays **held and unresolved**: it continues to count against the budget at its reserved amount and is never released to zero automatically.
  - A **reconciliation process** retries settlement idempotently from durable records (the reservation entry and the Gateway's usage record) until it resolves. A later correction is a separate compensating entry referencing the original key, never an edit or a second settlement.
  - An expired reservation is **not** silently released; reconciliation either settles it from evidence or keeps it held, and flags it.
  - **Fail-closed admission while integrity is threatened:** when unresolved reservations for a user and capability, or overall, exceed configured bounds (age or amount; values set later), new admissions in that scope are **denied** until reconciliation clears them.
- **Account deletion is never blocked (B-2).** Every table keyed by a user references `users(id)`. Rows holding user content or user-derived data (sessions, session books through the session, conversations, Briefs, grants) use `ON DELETE CASCADE`. Usage and budget records use `ON DELETE CASCADE` or `ON DELETE SET NULL` and hold no content; never `RESTRICT` or `NO ACTION`. Existing deletion code (`users.service.ts` `deleteAccount`) is not changed. Whether anonymized cost records are retained after deletion is an open PO/PA choice.

## Boundaries (normative)

| Boundary | Rule |
|---|---|
| Reader, content guard, library | Never call the resolver. A premium state never changes book access |
| `knowledge/*` and tokens | No import of `TokenLedger`, `TokenPackage`, or redemption; no shared table or foreign key |
| Billing | Premium invoices issue no tokens. Cancelling a premium tier must act on the premium line or subscription only |
| Household | Resolver keyed by individual `userId`. `linkedUserIds` grants nothing unless TT-15 says otherwise. **Household membership never shares private knowledge, highlights, or AI conversations** (PO-026 rule 6) |
| Stripe shape | Resolver is structure-neutral; it reads a normalized entitlement, never Stripe objects |
| Failure | Unknown entitlement, an unavailable reservation store or ledger, or unresolved reservations beyond bounds deny AI and affect nothing else |
| Account deletion | Never blocked; user content cascades (B-2) |

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
| 3 | 2026-11-08 | Review corrections (PR #41): **B-1** budget authority and fail-closed reservation store; **B-5** durable, idempotent settlement and recovery, no duplicate charges, fail-closed admission while unresolved reservations threaten integrity; **B-2** account deletion never blocked. Still **Proposed**. PO-026 and PO-028 unchanged |

## Legal note
Product and architecture policy, not legal advice.
