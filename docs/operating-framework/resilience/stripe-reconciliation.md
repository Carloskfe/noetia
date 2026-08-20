# Stripe Reconciliation After Restore

**NEM-009** · `ACCOUNTING REVIEW REQUIRED` · Procedure only — **no financial correction is
performed or authorized here.**

## The problem a restore creates

Stripe is authoritative for payments; Noetia is authoritative for entitlement. Restoring
PostgreSQL to an earlier point rolls back Noetia's record while **Stripe's is unchanged**.

Every event between the recovery point and the incident is at risk:

| Divergence | Effect on the user |
|---|---|
| Paid, restore predates it | Charged; **no tokens** issued |
| Token redeemed, restore predates it | Token restored but **book missing from the library** |
| Subscription cancelled after recovery point | Shows active locally; **Stripe stops billing** |
| Subscription started after recovery point | Billed by Stripe; **no local subscription** |
| Gift claimed after recovery point | Claim token reusable — **double redemption** |

The asymmetry that matters: **ownership loss is invisible to the user until they look for a
book they paid for**, which may be long after the incident.

## Procedure

**1. Establish the window** — recovery point timestamp to incident time.

**2. Extract Stripe truth for the window** — from the Stripe dashboard or API: payments,
subscription creations/cancellations, refunds, disputes.

**3. Compare against restored local state** — subscriptions by status and period end, token
issuance for each payment, `user_books` rows for each redemption.

**4. Classify each discrepancy** — money received without entitlement · entitlement without
money · state drift with no financial effect.

**5. Correct only under authorization.** `stripe_processed_events` (migration 066) provides
idempotency, so replaying webhooks is *safer* than manual edits — but **no correction is
authorized by NEM-009.** Both PO-018 (destructive recovery needs authorization) and
`ACCOUNTING REVIEW REQUIRED` apply.

**6. Ownership takes priority.** Under P2, a redeemed book is permanent. Where evidence shows
a redemption that the restore lost, **restoring the user's access is the default**, even before
the financial reconciliation completes. Ownership is Noetia's core promise; a reconciliation
delay must not silently shrink a reader's library.

**7. Notify.** If any user's entitlement was reduced, tell them. `LEGAL REVIEW REQUIRED` for
notification obligations.

## Creator obligations

Once NEM-008 exists, a restore that loses redemptions also loses **creator obligations**
(PO-008 — the obligation arises at redemption). Reconstruction depends on `token_ledger` plus
the plan price at issuance (PO-010), and NOF-002 §12 already flagged that `plans` is mutable.
**A restore is therefore also a creator-economics event**, not only a user-facing one.

## What must not be done

No balance adjustment, refund, credit, or write-off without Product Owner authorization and
accounting review. Reconciliation **produces a report**; it does not move money.
