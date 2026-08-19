# PO-012 — Marketing & Breakage Treatment

**Status:** `DECIDED` · **Domain:** Economics · **Authority:** Product Owner
**Recorded by:** NEM-007 Phase A · **Resolves:** the breakage-residual gap in [NOF-002](../../analysis/creator-economics-stress-test.md) §6 · Q-15
`ACCOUNTING REVIEW REQUIRED`

---

## Decision

### Marketing — payment level
The **7.78%** Marketing allocation arises from **qualifying collected revenue**, on the
same basis as Causas ([PO-011](PO-011-causas-recognition-basis.md)).

### Creator allocations — redemption level
Creator economic allocations arise **only upon a qualifying paid book redemption**:

| Allocation | Share | Arises at |
|---|---|---|
| Author / Publisher | 36% | qualifying redemption |
| Narrator | 9% | qualifying redemption |

A paid token that **expires without qualifying redemption creates no creator royalty
obligation.** This confirms and does not alter
[PO-008](PO-008-creator-obligation-accrual.md).

### Residual
Residual value associated with unredeemed or expired paid tokens **remains with Noetia**,
after the applicable payment-level allocations (Causas, Marketing) have been taken.

Refer to it as:

```
BREAKAGE / RETAINED ECONOMIC VALUE
```

**Never "profit."** It is gross retained value before any operating cost — payment fees,
app-store commission, hosting, support, taxes — none of which are modelled or known. See
[NOF-002](../../analysis/creator-economics-stress-test.md) §F-1, where standard app-store
commission alone would leave Noetia ~15% of gross at full redemption.

## The resulting two-tier sequence

```
PAYMENT           Causas 2.22%  +  Marketing 7.78%        (PO-011, PO-012)
   ↓
REDEMPTION        Author/Publisher 36%  +  Narrator 9%    (PO-007, PO-008)
   ↓
RESIDUAL          Noetia — breakage / retained economic value
```

This closes the gap NOF-002 §6 identified, where no policy stated whether Marketing and
Causas arose at payment or at redemption. The NOF-002 model **assumed** expired value was
retained by Noetia and flagged the assumption; PO-012 makes it policy.

## Review boundary

`ACCOUNTING REVIEW REQUIRED` — breakage recognition, whether retained value is revenue,
deferred revenue or a liability, refund and chargeback treatment, and tax treatment. PO-012
decides the **product/business allocation**, not its accounting classification.

## Related

[PO-007](PO-007-canonical-revenue-allocation.md) · [PO-008](PO-008-creator-obligation-accrual.md) ·
[PO-011](PO-011-causas-recognition-basis.md) · [05-economic-framework](../../05-economic-framework.md)
