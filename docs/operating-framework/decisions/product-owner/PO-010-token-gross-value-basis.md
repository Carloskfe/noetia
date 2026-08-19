# PO-010 — Token Gross Value Basis

**Status:** `DECIDED` · **Domain:** Economics · **Authority:** Product Owner
**Resolves:** the open "gross value per token" question in [05-economic-framework](../../05-economic-framework.md)
**Implementation:** `NOT IMPLEMENTED` → [IG-02](../../governance/contradictions-and-gaps.md#implementation-gaps)
`ACCOUNTING REVIEW REQUIRED` for precision, currency, refunds, tax, and discount allocation

---

## Why this decision exists

[PO-007](PO-007-canonical-revenue-allocation.md) fixes *what share* each party receives.
[PO-008](PO-008-creator-obligation-accrual.md) fixes *when* the obligation is created.
Neither says **what the shares are a percentage of.** PO-010 supplies that basis, and with
it the last conceptual blocker to a creator settlement implementation.

## 1. Subscription-issued tokens

Gross value per token is derived from the **actual price attributable to the applicable
subscription period**, divided by the tokens issued for that period.

**Monthly plans**

```
monthly subscription price ÷ monthly token allocation = gross value per token
```

**Annual plans**

```
annual subscription price ÷ annual token allocation = gross value per token
```

Equivalently, where an annual plan issues tokens monthly:

```
annual price ÷ 12 ÷ monthly token allocation = gross value per token
```

### Illustrative values

Derived from [PO-006](PO-006-canonical-subscription-pricing.md) pricing and the current
per-cycle token allocations. **Illustrative, not prescriptive** — the formula governs, and
no rounding is applied (see §6).

| Plan | Monthly | Tokens/cycle | Gross value per token | Annual | Annual tokens | Gross value per token |
|---|---|---|---|---|---|---|
| Individual | $8.99 | 1 | $8.99 | $83.99 | 12 | $6.999166… |
| Duo | $13.99 | 2 | $6.995 | $129.99 | 24 | $5.41625 |
| Family | $18.99 | 3 | $6.33 | $179.99 | 36 | $4.999722… |

Note the annual basis is materially lower per token than the monthly basis — an annual
subscriber's tokens carry less gross value, and therefore a smaller creator allocation per
redemption. That is a direct consequence of the pricing, not a separate policy choice, but
it is a fact worth being deliberate about before it appears in a creator statement.

The Family seat count remains `CONFLICTING` (C-02); it does **not** affect this
calculation, which depends on token allocation, not seats.

## 2. Additional token packages

```
actual package price ÷ number of tokens purchased = gross value per token
```

## 3. Discounts and promotions

The basis must reflect the **actual consideration attributable to the tokens** — never an
artificial undiscounted list price. A token issued under a discounted subscription carries
the discounted basis.

`OPEN — implementation / accounting question:` where a discount applies to a bundle of
benefits rather than to tokens alone, no existing policy determines how it is allocated
across those benefits. **No rule is invented here.** This requires implementation design
and `ACCOUNTING REVIEW`.

Promotional and courtesy tokens are **not** qualifying paid redemptions and carry no
creator allocation (PO-007, PO-008) — the question above concerns discounted *paid*
subscriptions only.

## 4. Creator allocation

Once gross token value is established, [PO-007](PO-007-canonical-revenue-allocation.md)
applies unchanged:

| Allocation | Share |
|---|---|
| Noetia | 45% |
| Author / Publisher | 36% |
| Narrator | 9% |
| Marketing | 7.78% |
| Causas Noetia | 2.22% |

For a **self-narrated title**, the creator receives the 36% Author/Publisher allocation
**plus** the 9% Narrator allocation.

## 5. Accrual event

[PO-008](PO-008-creator-obligation-accrual.md) remains controlling: the **qualifying
redemption** creates the obligation. PO-010 determines the economic basis of the token
being redeemed at that moment.

This matters for tokens whose issuing period differs from their redemption period — the
basis travels with the token from issuance, not from the date it is spent.

## 6. Precision — deliberately not prescribed

**No rounding rules are established here.** The following require implementation design
and, where applicable, `ACCOUNTING REVIEW REQUIRED`:

storage and calculation precision · currency handling · fractional cents · payout rounding ·
refunds and reversals · taxes · accounting treatment and revenue recognition

Prescribing rounding prematurely would embed an accounting decision in a product document.
The illustrative values above are shown unrounded for exactly that reason.

## 7. Historical reconstruction

PO-010 is deliberately defined so a future creator-ledger implementation can **reconstruct
obligations for historical qualifying redemptions** where sufficient transaction and
redemption evidence exists.

The inputs are already recorded: `token_ledger` captures issuance (with type and
subscription), `user_books` captures redemption, and subscription/plan records carry the
price and allocation for the applicable period.

**No reconstruction is performed by this documentation task**, and its feasibility has not
been verified against the live data. That verification belongs to the settlement mission.

## 8. Scope

Documentation and governance only. No application code, schema, migration, Stripe
configuration, production data, or infrastructure change is authorized or performed.

## Related

[PO-006](PO-006-canonical-subscription-pricing.md) · [PO-007](PO-007-canonical-revenue-allocation.md) ·
[PO-008](PO-008-creator-obligation-accrual.md) · [05-economic-framework](../../05-economic-framework.md) ·
[07-creator-and-rights-framework](../../07-creator-and-rights-framework.md)
