# PO-013 — Discount Attribution

**Status:** `DECIDED` · **Domain:** Economics · **Authority:** Product Owner
**Recorded by:** NEM-007 Phase A · **Resolves:** Q-14 at the product-policy level
`ACCOUNTING REVIEW REQUIRED` where implementation requires it

---

## Decision

### Unambiguous discounts — PO-010 applies
Where a discount applies **directly and unambiguously** to a subscription or token package,
[PO-010](PO-010-token-gross-value-basis.md) applies using **actual consideration**. A 20%
discount on a subscription reduces every token's basis by 20%, and creator allocations
follow.

### Ambiguous bundles — no runtime invention
Where a discount or promotion covers **multiple heterogeneous benefits** and the portion
attributable to tokens **cannot be objectively determined**, Noetia must **not invent an
economic allocation at runtime.**

Such promotions must either:

1. **define their token allocation explicitly before activation**; or
2. **remain excluded from creator-economic processing** until an approved allocation rule
   exists.

## Why this is the right shape

A runtime guess would silently determine what creators are owed. [NOF-002](../../analysis/creator-economics-stress-test.md)
§10 measured the materiality: a 20% discount on a Family-annual token yields **$1.80** to a
self-narrated creator against **$4.50** from a full-price add-on token — a 150% spread,
driven entirely by an allocation rule nobody would have approved.

PO-013 makes the choice explicit and prior. A promotion either arrives with its token
allocation already decided, or it does not participate in creator economics at all. Neither
path fabricates a number.

## Design consequence for NEM-008

A settlement implementation must be able to identify tokens whose basis is **not
determinable** and hold them out of processing rather than defaulting them to list price or
to zero. This is a required capability, not an edge case.

## Status of Q-14

`RESOLVED at the product-policy level.` Accounting implementation may still require review
where a promotion's structure raises recognition questions.

## Related

[PO-010](PO-010-token-gross-value-basis.md) · [PO-007](PO-007-canonical-revenue-allocation.md) ·
[05-economic-framework](../../05-economic-framework.md) ·
[NOF-002 §10](../../analysis/creator-economics-stress-test.md)
