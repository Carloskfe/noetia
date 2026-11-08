# PO-026 — Premium Subscription Prerequisite

**Status:** `DECIDED` — approved by the Product Owner on 2026-11-08 as **TT-02** (*Product Architecture Decision Reconciliation — Three-Tier Architecture Governance and NEM-019 Preparation*). Supersedes the 2026-11-06 preliminary text, preserved below.
**Domain:** Business, Billing, AI services · **Authority:** Product Owner
**Date:** 2026-11-08 (preliminary ruling 2026-11-06) · **Source:** TT-02
**Implementation:** `NOT IMPLEMENTED`

---

## Decision (approved text, 2026-11-08)

Both **Noetia+** and **NoetiaX** require an active **Individual, Duo, or Family** book subscription.

1. Premium intelligence is an **add-on**, not a standalone replacement.
2. Cancelling premium intelligence **does not cancel** the underlying book subscription.
3. Ending the underlying book subscription **ends premium intelligence eligibility**.
4. Previously acquired books remain **permanently owned**.
5. Book tokens and AI usage budgets remain **completely separate**.
6. Household membership **does not automatically share** private knowledge, highlights, or AI conversations.

The Product Owner instructed that no prices, subscription states, grace periods, or billing mechanisms be invented in recording this decision.

## Normative rule

```
premium entitlement(user, tier) =
      user holds an active premium entitlement for tier
  AND user holds an active Individual, Duo, or Family book subscription
```

Unknown or unresolved prerequisite state means **deny the premium capability**. It never affects book access, tokens, or reading.

## Not decided by this record

| Open item | Consequence until decided | Tracker |
|---|---|---|
| Whether a **linked member** of a Duo or Family subscription (not the subscriber) satisfies the prerequisite | **Not assumed.** The approved text names the subscription types, not member eligibility. `linkedUserIds` grants nothing | TT-15 |
| Which subscription **states** count as active (`trialing`, `canceling`, `past_due`, …) | Not assumed | TT-15 |
| End timing, grace period, refunds or credits | Not assumed; lifecycle policy required before billing | TT-16 |
| Prices; one Stripe Subscription with items, or two | Not decided | TT-16 |
| Whether a no-charge pilot may bypass the prerequisite | Not permitted by this text | TT-23 |
| Internal language | "Book plan" internally; "Basic" is never customer-facing | PO-025 (draft) |

## Relationship to other records

| Record | Effect |
|---|---|
| PO-022 "separate, independently purchasable"; "does not require a book-token subscription" (PR #12, unmerged) | **Superseded in substance** by this decision. The exact amendment text ([PO-022 Amendment 1](../../analysis/t0-po-021-024-amendment-drafts.md#po-022-amendment-1)) still awaits PO acceptance |
| PO-023 rules 6, 7, 8 and Consequences (PR #12, unmerged) | Same: superseded in substance; [PO-023 Amendment 1](../../analysis/t0-po-021-024-amendment-drafts.md#po-023-amendment-1) text awaits acceptance |
| PO-022 economic separation | Unchanged |
| PO-021 ownership; PO-024 token rights | Unchanged; reinforced by rules 4 and 5 |
| PO-001 `BOOK TOKEN ≠ AI USAGE` | Reinforced by rule 5 |
| SA-003 Rev 5 working baseline (household members eligible, 72-hour grace; PR #36) | **Not adopted by this record.** It is a working recommendation, not a decision; see TT-15, TT-16 |

## Implementation boundary

Authorizes no implementation. On current code, premium billing is unsafe: see the [T0 report](../../../reports/2026-11-06-SA-002-T0-decision-closure.md#billing-hazards).

---

## Historical: preliminary text of 2026-11-06 (superseded, preserved unchanged)

**Status:** `DRAFT — NOT DECIDED`. Records preliminary ruling TT-02. Becomes `DECIDED` only when the Product Owner accepts this text together with the [PO-022 and PO-023 amendments](../../analysis/t0-po-021-024-amendment-drafts.md).
**Domain:** Business, Billing, AI services · **Authority:** Product Owner
**Date:** 2026-11-06 · **Source:** T0 ruling TT-02; extends the approved direction of 2026-10-30 to NoetiaX
**Implementation:** `NOT IMPLEMENTED`

---

### Decision (proposed text)

1. **Noetia+ and NoetiaX each require an active qualifying Noetia book subscription.**
2. Neither premium tier is available as a standalone subscription to a free account or a token-package-only customer.
3. Cancelling a premium tier **does not cancel** the underlying book plan.
4. When the qualifying book plan ends, the dependent premium entitlement ends, **according to a future approved lifecycle policy**.
5. Permanent book ownership and previously acquired token rights are preserved in every case.

### Normative rule

```
premium entitlement(user, tier) =
      user holds an active premium entitlement for tier
  AND user holds a qualifying book subscription
```

Unknown or unresolved prerequisite state means **deny the premium capability**. It never affects book access, tokens, or reading.

### What this does not decide

| Open item | Consequence until decided | Tracker |
|---|---|---|
| Which plans qualify | No plan is assumed to qualify in any implementation | TT-15 |
| Whether linked Duo or Family members qualify | **Not assumed.** `linkedUserIds` grants nothing | TT-15 |
| Which subscription states count as active (`trialing`, `canceling`, `past_due`) | Not assumed | TT-15 |
| End timing, grace period, refunds or credits | Lifecycle policy required before billing | TT-16 |
| One Stripe Subscription with items, or two | Open | TT-16 |
| Internal language | "Book plan" internally. "Basic" is never customer-facing | PO-025 |

### Relationship to earlier statements

| Earlier statement | Status under this record |
|---|---|
| PO-022 "separate, independently purchasable"; "does not require a book-token subscription" | Amended if accepted ([PO-022 Amendment 1](../../analysis/t0-po-021-024-amendment-drafts.md#po-022-amendment-1)) |
| PO-023 rules 6, 7, 8 and Consequences | Amended if accepted ([PO-023 Amendment 1](../../analysis/t0-po-021-024-amendment-drafts.md#po-023-amendment-1)) |
| PO-022 economic separation | **Unchanged**: separately identifiable revenue, no assumed creator allocation, outside the PO-010 basis |
| PO-021 ownership-based access | **Unchanged** |
| PO-024 token rights | **Unchanged** |
| PR #18 amendment drafts (Noetia+ only, "basic" wording) | Replaced as draft text if accepted |

### Implementation boundary

Authorizes no implementation. On current code, premium billing is unsafe: see the [closure report](../../../reports/2026-11-06-SA-002-T0-decision-closure.md#billing-hazards).
