# PO-026 — Premium Subscription Prerequisite

**Status:** `DRAFT — NOT DECIDED`. Records preliminary ruling TT-02. Becomes `DECIDED` only when the Product Owner accepts this text together with the [PO-022 and PO-023 amendments](../../analysis/t0-po-021-024-amendment-drafts.md).
**Domain:** Business, Billing, AI services · **Authority:** Product Owner
**Date:** 2026-11-06 · **Source:** T0 ruling TT-02; extends the approved direction of 2026-10-30 to NoetiaX
**Implementation:** `NOT IMPLEMENTED`

---

## Decision (proposed text)

1. **Noetia+ and NoetiaX each require an active qualifying Noetia book subscription.**
2. Neither premium tier is available as a standalone subscription to a free account or a token-package-only customer.
3. Cancelling a premium tier **does not cancel** the underlying book plan.
4. When the qualifying book plan ends, the dependent premium entitlement ends, **according to a future approved lifecycle policy**.
5. Permanent book ownership and previously acquired token rights are preserved in every case.

## Normative rule

```
premium entitlement(user, tier) =
      user holds an active premium entitlement for tier
  AND user holds a qualifying book subscription
```

Unknown or unresolved prerequisite state means **deny the premium capability**. It never affects book access, tokens, or reading.

## What this does not decide

| Open item | Consequence until decided | Tracker |
|---|---|---|
| Which plans qualify | No plan is assumed to qualify in any implementation | TT-15 |
| Whether linked Duo or Family members qualify | **Not assumed.** `linkedUserIds` grants nothing | TT-15 |
| Which subscription states count as active (`trialing`, `canceling`, `past_due`) | Not assumed | TT-15 |
| End timing, grace period, refunds or credits | Lifecycle policy required before billing | TT-16 |
| One Stripe Subscription with items, or two | Open | TT-16 |
| Internal language | "Book plan" internally. "Basic" is never customer-facing | PO-025 |

## Relationship to earlier statements

| Earlier statement | Status under this record |
|---|---|
| PO-022 "separate, independently purchasable"; "does not require a book-token subscription" | Amended if accepted ([PO-022 Amendment 1](../../analysis/t0-po-021-024-amendment-drafts.md#po-022-amendment-1)) |
| PO-023 rules 6, 7, 8 and Consequences | Amended if accepted ([PO-023 Amendment 1](../../analysis/t0-po-021-024-amendment-drafts.md#po-023-amendment-1)) |
| PO-022 economic separation | **Unchanged**: separately identifiable revenue, no assumed creator allocation, outside the PO-010 basis |
| PO-021 ownership-based access | **Unchanged** |
| PO-024 token rights | **Unchanged** |
| PR #18 amendment drafts (Noetia+ only, "basic" wording) | Replaced as draft text if accepted |

## Implementation boundary

Authorizes no implementation. On current code, premium billing is unsafe: see the [closure report](../../../reports/2026-11-06-SA-002-T0-decision-closure.md#billing-hazards).
