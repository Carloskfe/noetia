# PO-008 — Creator Obligation Accrual

**Status:** `DECIDED` (policy) · **Domain:** Economics, Creator
**Authority:** Product Owner · **Resolves:** Q-02 · policy half of [C-03](../../governance/contradictions-and-gaps.md)
**Implementation:** `NOT IMPLEMENTED` → [IG-02](../../governance/contradictions-and-gaps.md#implementation-gaps)
`ACCOUNTING REVIEW REQUIRED`

---

## Principle

> A qualifying paid book redemption creates the corresponding creator economic obligation
> **when the redemption occurs**. The absence of an automated settlement or payout engine
> does not eliminate or defer creation of that obligation.

The obligation is a fact about what happened, not a by-product of having built software to
track it. Every qualifying redemption since launch has created one.

## Lifecycle

```
EARNED → PENDING → PAYABLE → PAID
             ↘  ADJUSTED / REVERSED  ↙
```

`ADJUSTED` / `REVERSED` covers refunds, corrections, fraud, and other valid adjustments.

## Traceability a future implementation must preserve

- gross token value
- author/publisher allocation · narrator allocation (PO-007)
- self-narrated combination, where it applies
- redemption identity · book · creator/rightsholder
- earning date · payout status · adjustments

Sufficient to answer, for any creator and period: *what was earned, from which
redemptions, and what remains unpaid.*

## Explicitly out of scope

NOF-001 does **not** design the accounting implementation. The following require
professional review before commercial reliance — `ACCOUNTING REVIEW REQUIRED`:

accounting classification · revenue recognition · tax treatment · refund treatment ·
liability treatment · Causas Noetia accounting treatment · payout reporting

## Current reality

No payout or settlement engine exists
([`technical-baseline/19-technical-debt.md`](../../../technical-baseline/19-technical-debt.md);
`09-token-economy.md` records payout computation as `UNKNOWN` at code level). Redemptions
are recorded in `token_ledger` and `user_books`, so the **underlying events are captured**
even though obligations are not computed — a reconstruction is possible but has not been
performed or verified.

**The policy being decided does not close the engineering gap.** IG-02 remains OPEN/HIGH.
