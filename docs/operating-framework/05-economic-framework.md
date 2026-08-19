# Economic Framework

**v0.1** · NOF-001 · Where the money goes. `ACCOUNTING REVIEW REQUIRED` throughout for
classification, recognition, and tax treatment — this document records **allocation
policy**, not accounting policy.

---

## Allocation per qualifying token redemption

**DECIDED — [PO-007](decisions/product-owner/PO-007-canonical-revenue-allocation.md)**

| Allocation | Share |
|---|---|
| Noetia | **45%** |
| Author / Publisher | **36%** |
| Narrator | **9%** |
| Marketing | **7.78%** |
| Causas Noetia | **2.22%** |
| **Total** | **100%** |

### Naming rule

"45%" is ambiguous and must never stand alone:

- **Noetia's share = 45%.**
- **Creator share = 45% only when author/publisher and narrator are combined**, i.e. a
  self-narrated title (36% + 9%).

Where the narrator is a separate party: author/publisher **36%**, narrator **9%**.

| Title type | Author/Publisher | Narrator | Combined creator |
|---|---|---|---|
| Self-narrated | 36% | 9% | **45%** |
| Separate narrator | 36% | 9% (to narrator) | 36% + 9% to two parties |

## When each allocation arises

**DECIDED — [PO-011](decisions/product-owner/PO-011-causas-recognition-basis.md) ·
[PO-012](decisions/product-owner/PO-012-marketing-and-breakage-treatment.md)**

```
PAYMENT       Causas 2.22%  +  Marketing 7.78%      from qualifying collected revenue
   ↓
REDEMPTION    Author/Publisher 36%  +  Narrator 9%  only on a qualifying paid redemption
   ↓
RESIDUAL      Noetia — BREAKAGE / RETAINED ECONOMIC VALUE
```

Causas and Marketing do **not** disappear when a token goes unused or expires — they attach
to money collected. Creator allocations do not arise at all without a qualifying redemption.
Residual value is retained by Noetia and is **never** called profit: it is gross value before
payment fees, app-store commission, hosting, support, and taxes, none of which are known.

## Obligation accrual

**DECIDED — [PO-008](decisions/product-owner/PO-008-creator-obligation-accrual.md)**

> A qualifying paid redemption creates the creator obligation **when the redemption
> occurs.** No settlement engine does not mean no obligation.

```
EARNED → PENDING → PAYABLE → PAID        (+ ADJUSTED / REVERSED)
```

Traceability a future implementation must preserve: gross token value · author/publisher
allocation · narrator allocation · self-narrated combination · redemption identity · book ·
creator · earning date · payout status · adjustments.

## Where value comes from

| Source | Treatment |
|---|---|
| **Plan-derived tokens** | Subscription revenue; `tokensPerCycle` per plan. Gross value per token per **[PO-010](decisions/product-owner/PO-010-token-gross-value-basis.md)** |
| **Purchased token packages** | Direct purchase, type `paid` |
| **Promotional / courtesy tokens** | Non-purchased grants. **No creator allocation** — these are not qualifying paid redemptions |
| **Gift cards** | Stripe purchase; allocation follows redemption, not purchase |
| **Free-library access** | Public domain; no allocation |

## Gross value per token

**DECIDED — [PO-010](decisions/product-owner/PO-010-token-gross-value-basis.md)**

```
subscription:  price attributable to the period ÷ tokens issued for that period
annual:        annual price ÷ 12 ÷ monthly token allocation
packages:      package price ÷ tokens purchased
```

The basis is the **actual consideration**, never an undiscounted list price, and it travels
with the token from issuance rather than being recomputed at redemption.

Illustrative, unrounded, from PO-006 pricing:

| Plan | Monthly basis | Annual basis |
|---|---|---|
| Individual | $8.99 | $6.999166… |
| Duo | $6.995 | $5.41625 |
| Family | $6.33 | $4.999722… |

An annual subscriber's tokens therefore carry a **lower** gross value — and a smaller
creator allocation per redemption — than a monthly subscriber's. A consequence of the
pricing, not a separate policy, but one that will be visible on creator statements.

**Discounts — [PO-013](decisions/product-owner/PO-013-discount-attribution.md):** an
unambiguous subscription or package discount follows PO-010 on actual consideration. A bundle
whose token portion cannot be objectively determined must declare its allocation **before
activation** or stay **out of creator-economic processing** — never a runtime guess.

**No rounding is prescribed.** Precision, currency, fractional cents, payout rounding,
refunds, and tax treatment are implementation and accounting decisions (PO-010 §6).

## Historical reconstruction

PO-010 is defined so a future creator ledger can reconstruct obligations for historical
qualifying redemptions where evidence permits — `token_ledger` holds issuance,
`user_books` holds redemption, and plan records hold the period price and allocation.
Feasibility against live data is **unverified**; that belongs to the settlement mission.

## Breakage

`OPEN` — paid tokens expire at 90 days. Whether unredeemed paid tokens constitute breakage
revenue, and how that is recognized, has no decision. [NOF-002](analysis/creator-economics-stress-test.md)
§6 models it at **25% of gross cash** under a 75% redemption rate, and found that no policy
states whether Marketing and Causas allocations arise at payment or at redemption (C-11).
`ACCOUNTING REVIEW REQUIRED`.

## Stress-test result

[NOF-002](analysis/creator-economics-stress-test.md) established the model's key structural
property: because a token's basis *is* the cash attributable to it, **creator obligation is
capped at 45% × redemption rate of gross cash** — Model A cannot promise more than it
collected. Cash also always precedes the obligation, so there is no structural liquidity
risk. The identified risk is channel cost, not allocation: standard app-store commission
would leave Noetia ~15% of gross before operating costs.

## Cost control

**DECIDED as guardrails (PO-001):** Noetia+ AI/infra COGS target ≤ ~$1.50/user/month;
COGS bands Excellent ≤15% / Healthy 15–25% / Caution 25–35% / Intervention >35%.
Configurable, not hard-coded into product behavior.

Infrastructure cost is a single Contabo VPS (8 vCPU / 24 GB / 400 GB) hosting production
and staging — a deliberate low-fixed-cost posture.

## Implementation reality

**Nothing in this document is computed by software.** → [IG-02](governance/contradictions-and-gaps.md#implementation-gaps)

Redemption events *are* captured (`token_ledger`, `user_books`), so reconstruction is
likely possible — but has never been performed or verified. Every qualifying redemption
since launch has created an obligation that no system has recorded as such.

## Review markers

`ACCOUNTING REVIEW REQUIRED` — accounting classification · revenue recognition · tax
treatment · refund treatment · liability treatment · Causas Noetia treatment · payout
reporting · breakage.
