# PO-007 — Canonical Revenue Allocation

**Status:** `DECIDED` · **Domain:** Economics · **Authority:** Product Owner
**Resolves:** [C-04](../../governance/contradictions-and-gaps.md) · Q-03
**Implementation:** `NOT IMPLEMENTED` — no settlement engine computes this (see PO-008, IG-02)

---

## Allocation per qualifying token redemption

Of gross value:

| Allocation | Share |
|---|---|
| **Noetia** | 45% |
| **Author / Publisher** | 36% |
| **Narrator** | 9% |
| **Marketing** | 7.78% |
| **Causas Noetia** | 2.22% |
| **Total** | **100%** |

## The "45%" ambiguity, resolved

Two different shares are both 45%, and conflating them was the defect:

| Phrase | Correct meaning |
|---|---|
| **Noetia's share** | 45% — Noetia operating revenue |
| **Creator share** | 36% + 9% = 45% — **only when author/publisher and narrator interests are combined**, e.g. a self-narrated title |

**Rule:** never write "45%" without saying whose. In author-facing material, "45% creator
share" is accurate **only** for the self-narrated case. For a title where the narrator is
a separate party, the author/publisher receives **36%** and the narrator **9%**.

[`01-business-plan.md:429`](../../../business/en/01-business-plan.md) markets "45% royalty
— highest in the category" without that qualification. It is retained as historical
evidence and marked ambiguous; canonical statements live in
[07-creator-and-rights-framework](../../07-creator-and-rights-framework.md).

## Scope

- Applies to **qualifying paid token redemptions**. Free-library access and courtesy
  tokens create no creator allocation — see PO-008 for what "qualifying" means.
- Governs allocation only. **Accounting classification, revenue recognition, and tax
  treatment are out of scope** — `ACCOUNTING REVIEW REQUIRED` (PO-008).

## Related

[PO-008](PO-008-creator-obligation-accrual.md) · [05-economic-framework](../../05-economic-framework.md) · [07-creator-and-rights-framework](../../07-creator-and-rights-framework.md)
