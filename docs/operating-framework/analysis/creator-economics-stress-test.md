# Creator Economics Stress Test — Model A (Actual Consideration)

**NOF-002** · Analysis only · Dataset: [`creator-economics-scenarios.csv`](creator-economics-scenarios.csv) ·
Model: [`creator-economics-model.py`](creator-economics-model.py)

The purpose was to **attempt to falsify Model A**, not to validate it. Where it holds up,
the reason is stated; where it fails, the failure is stated without softening.

---

## 1. The structural result

**Creator obligation can never exceed 45% of gross cash collected. Ever.**

Under PO-010 a token's basis *is* the cash attributable to it, so the sum of all token bases
equals the cash collected. Allocation percentages therefore partition actual money rather
than an abstract list price:

```
creator obligation  =  45% × redemption rate  × gross cash
Noetia retained     =  (45% × r) + (1 − r)    × gross cash      [before operating costs]
```

This is visible across every scenario: creator share of gross cash is **exactly 45 × r**,
independent of plan mix, cadence, add-on penetration, or catalog composition. S1, S2, S3,
S6 and S11 all land on 33.75% because they share r = 0.75, despite very different mixes.

**Model A cannot over-commit Noetia.** It is structurally incapable of promising creators
more than the money that came in. That is a genuine strength and the single most important
finding.

## 2. Per-token gross basis (PO-010)

| Source | Basis | Creator @45% | Author 36% | Narrator 9% |
|---|---|---|---|---|
| Add-on 1 token ($9.99) | $9.990000 | **$4.4955** | $3.5964 | $0.8991 |
| Individual monthly | $8.990000 | $4.0455 | $3.2364 | $0.8091 |
| Add-on 3 ($24.99) | $8.330000 | $3.7485 | $2.9988 | $0.7497 |
| Add-on 5 ($39.99) | $7.998000 | $3.5991 | $2.8793 | $0.7198 |
| Add-on 10 ($74.99) | $7.499000 | $3.3746 | $2.6996 | $0.6749 |
| Individual annual | $6.999167 | $3.1496 | $2.5197 | $0.6299 |
| Duo monthly | $6.995000 | $3.1478 | $2.5182 | $0.6296 |
| Family monthly | $6.330000 | $2.8485 | $2.2788 | $0.5697 |
| Duo annual | $5.416250 | $2.4373 | $1.9498 | $0.4875 |
| **Family annual** | **$4.999722** | **$2.2499** | $1.7999 | $0.4500 |

Displayed to 4dp for readability. **Not rounding rules** (PO-010 §6).

## 3. Distribution — the communication problem

| Metric | Value |
|---|---|
| Minimum creator per redemption | **$2.2499** (Family annual) |
| Maximum | **$4.4955** (single add-on token) |
| Spread | **99.8%** — the top basis is very nearly double the bottom |
| Weighted average (S11 balanced) | $3.1941 |
| Range across scenarios | $2.2499 (S8) → $3.5701 (S1) |

**The same title, same creator, earns 2× more from one reader than another** purely
because of how the reader subscribes. Family-annual is the compressed extreme; single
add-on tokens the generous one.

This is intentional under Model A. It is also the finding most likely to cause a creator
dispute, because it is invisible to the creator and outside their control.

## 4. Scenarios

10,000 subscribers, annual basis. Full dataset in the CSV.

| Scenario | r | Gross cash | Creator obligation | % of cash | $/redemption | Noetia + breakage |
|---|---|---|---|---|---|---|
| S1 individual-heavy | 0.75 | $1,228,114 | $414,488 | 33.75% | $3.5701 | 58.75% |
| S2 annual-heavy | 0.75 | $1,228,352 | $414,569 | 33.75% | $2.8971 | 58.75% |
| S3 family-heavy | 0.75 | $1,831,490 | $618,128 | 33.75% | $2.8148 | 58.75% |
| S4 high redemption | 0.95 | $1,379,857 | $589,889 | 42.75% | $3.1941 | 47.75% |
| S5 high breakage | 0.50 | $1,379,857 | $310,468 | 22.50% | $3.1941 | 72.50% |
| S6 add-on intensive | 0.75 | $1,471,697 | $496,698 | 33.75% | $3.2211 | 58.75% |
| S7 creator-intensive | 0.95 | $1,379,857 | $589,889 | 42.75% | $3.1941 | 47.75% |
| **S8 lowest-basis** | 1.00 | $1,799,900 | $809,955 | **45.00%** | **$2.2499** | 45.00% |
| **S9 max creator load** | 1.00 | $1,471,697 | $662,264 | **45.00%** | $3.2211 | 45.00% |
| S10 noetia-favorable | 0.40 | $1,471,697 | $264,905 | 18.00% | $3.2211 | 78.00% |
| S11 balanced base | 0.75 | $1,379,857 | $465,702 | 33.75% | $3.1941 | 58.75% |

**S10 is not the expected case.** It assumes 60% of paid tokens expire unused, which would
be a poor product outcome — readers paying and not reading.

Scale sweep (S11 at 2,500 / 10,000 / 50,000 / 100,000) confirms unit economics are
scale-invariant; only absolute obligations move ($116K → $4.66M creator obligation/yr).

## 5. Sensitivity ranking

1. **Redemption rate — dominant.** The only variable that moves creator share of cash
   (linearly, 45 × r). Moving r from 0.40 to 1.00 shifts creator obligation 18% → 45% of
   gross, and Noetia's retained economics 78% → 45%.
2. **Plan/cadence mix — dollars per redemption only.** Alters what a creator earns per
   redemption (−30% from individual-heavy to family-heavy) but **never** the aggregate
   percentage.
3. **Add-on penetration — mildly creator-positive.** Add-on bases are higher than most
   subscription bases, so add-ons raise average dollars per redemption while leaving the
   percentage untouched.
4. **Self-narrated share — distribution only.** Moves money between author and narrator
   lines; the 45% combined total is unchanged. S7 and S4 are numerically identical.
5. **Scale — no unit effect.**

The counter-intuitive result: **plan mix, annual adoption, and Family adoption do not
threaten Noetia's economics at all.** They only compress what creators earn per redemption.

## 6. Breakage

Breakage is economic value from paid tokens that expire unredeemed (90-day rolling).

At S11 (r = 0.75), **25% of gross cash — $344,964/yr at 10,000 subscribers** — is token
value that expires without creating any creator obligation, per PO-008.

`OPEN — POLICY INCOMPLETE:` **no decision states how expired token value is allocated.**
PO-007 allocates *per qualifying redemption*; PO-008 confirms no creator obligation arises
without one. But nothing says whether Marketing (7.78%) and Causas (2.22%) arise at
redemption or at payment. The model treats expired value as unallocated and retained by
Noetia, which is an **assumption, not a policy**.

This interacts with a contradiction found during analysis — see §7.

`ACCOUNTING REVIEW REQUIRED` — breakage recognition and whether unredeemed value is
revenue, deferred revenue, or a liability.

## 7. New contradiction found: the Causas basis

| Source | Basis |
|---|---|
| [`business/en/01-business-plan.md:14`](../../business/en/01-business-plan.md) | "2.22% of **every payment**" |
| [`business/en/01-business-plan.md:47,85`](../../business/en/01-business-plan.md) | "2.22% of **every payment**" |
| [PO-007](../decisions/product-owner/PO-007-canonical-revenue-allocation.md) | 2.22% per **qualifying token redemption** |

These fund Causas differently. At S11 with 10,000 subscribers:

| Basis | Causas funding/yr |
|---|---|
| Per payment | **$30,633** |
| Per redemption (PO-007) | **$22,975** |

**A 25% difference**, and it grows as redemption falls — exactly when breakage is highest.
Causas Noetia is a public commitment ("2.22% of every payment supports partner social
causes"). If the implemented basis is per-redemption, the public claim overstates funding.

Registered as **C-11** and **Q-15**. `ACCOUNTING REVIEW REQUIRED`.

## 8. Failure conditions

### F-1 — App-store commission is the one real failure mode · HIGH

Allocations are computed on **gross list price**, but on iOS/Android in-app purchase
Noetia never receives gross. Illustrative — **assumption, not measured data**:

| Channel | Commission | Noetia receives | Pays out (55%) | Noetia retains, r=1.0 |
|---|---|---|---|---|
| Web (Stripe ~2.9%+$0.30) | ~6.2% on $8.99 | 93.8% | 55% | **38.8%** |
| App store, small-business | 15% | 85% | 55% | **30.0%** |
| App store, standard | **30%** | 70% | 55% | **15.0%** |

At full redemption on standard app-store terms Noetia retains **15% of gross before a
single operating cost** — hosting, support, bandwidth, payment fees, taxes, refunds. That
is the scenario where the model stops working, and it is a plausible one for a mobile-first
reading product.

Note it is *not* an allocation failure: creators still get exactly their 45%. It is a
channel-cost failure that lands entirely on Noetia's share.

`OPERATING COST DATA REQUIRED` — no channel mix, commission tier, or cost data exists in
the repository. The table above must not be treated as a finding about Noetia's actual
economics.

### F-2 — Refund after redemption · MEDIUM
A qualifying redemption creates an obligation (PO-008). If the payment is later refunded or
charged back, the cash is gone but the obligation was created and the book remains in the
user's library permanently (P2). PO-008 provides `ADJUSTED / REVERSED` states but **no
policy says whether a refund reverses a creator obligation.** `ACCOUNTING REVIEW REQUIRED`.

### F-3 — Creator-facing spread · MEDIUM
The 2× spread (§3) is defensible but not self-evident. The current marketing claim "45%
royalty — highest in the category" invites a creator to expect ~$4.05 on an $8.99 plan and
receive $2.25 from a Family-annual reader.

### F-4 — Not a failure: high redemption
High redemption raises creator obligation to 45% of cash and removes breakage — but never
beyond cash collected. It compresses Noetia's share to its floor of 45%, it does not break
the model.

## 9. Liquidity

Cash **always precedes** the obligation:

| Plan | Cash timing | Obligation timing |
|---|---|---|
| Monthly | Month 1 | At redemption, ≤90 days later |
| Annual | **Full year upfront** | Tokens issued monthly, redeemed ≤90 days after each issuance |

Annual plans are strongly working-capital positive — up to 12 months of cash held against
obligations that accrue over the following year. Model A therefore has **no structural
liquidity risk**: the money is collected before the obligation exists.

The exposure is **operational**, not structural: obligations accrue continuously while no
system records them (IG-02). Every month without a ledger increases the size of the eventual
reconciliation. `ACCOUNTING REVIEW REQUIRED` for payout timing, thresholds, and whether
accrued obligations are a balance-sheet liability.

## 10. Q-14 (bundled discounts) — materiality

Q-14 remains **OPEN**; no discount allocation was modelled.

Materiality is **high**. Basis is proportional to consideration, so a 20% subscription
discount reduces every token's basis by 20% and creator earnings by 20% — a Family-annual
token at 20% off yields **$1.80** to a self-narrated creator, against $4.50 from a full-price
add-on token: a **150% spread**. If a discount applies to a bundle including Noetia+, the
allocation rule directly determines what creators are owed.

**No rule was fabricated.** Until Q-14 is resolved, any settlement implementation must
either refuse discounted-subscription tokens or apply a documented interim rule.

## 11. Noetia+ separation

`SEPARATE ECONOMIC SYSTEM.` No Noetia+ revenue enters this analysis. `BOOK TOKEN ≠ AI
USAGE` (PO-001). Book economics stand or fall on their own here, and the F-1 channel risk
is **not** offset by hypothetical Noetia+ revenue.

## 12. Historical reconstruction — data checklist for NEM-007

| Required | Available today | Source |
|---|---|---|
| Token issuance record (id, user, type, issuedAt, expiresAt) | ✅ | `token_ledger` |
| Subscription linkage per token | ✅ | `token_ledger.subscriptionId` |
| Redemption event (redeemedAt, bookId) | ✅ | `token_ledger` |
| Book access record | ✅ | `user_books` (purchaseType) |
| Plan price + token allocation at issuance | ⚠️ **AT RISK** | `plans` is mutable (migrations 010, 039, 041) — historical price at time of issuance may not be recoverable |
| Actual amount paid (discounts applied) | ⚠️ **AT RISK** | Requires Stripe invoice reconciliation; not evidenced in-repo |
| Package price for add-on tokens | ⚠️ | Needs verification |
| Rights holder / narrator per book | ❌ **MISSING** | No creator-attribution or contract table found |
| Self-narrated flag per title | ❌ **MISSING** | Not represented in the schema |
| Refunds / chargebacks | ⚠️ | Stripe-side; `stripe_processed_events` exists (migration 066) |
| Gifting / transfers | ✅ partial | `gift_cards` |

**Two hard blockers for reconstruction:** no creator attribution per book, and no
self-narrated flag. Without them, the *amount* can be computed but **not who is owed it**.
The historical price-at-issuance risk is third: if `plans` rows were updated in place,
PO-010's basis may not be recoverable for older tokens.

Reconstruction feasibility is **unverified against live data** — this checklist is derived
from documentation, not from querying production.

---

## Decision gates

### GATE A — Economically sustainable? **CONDITIONAL**

The allocation model itself is sound and self-limiting: creator obligation is capped at 45%
of actual cash by construction, across every scenario tested, and cash always precedes the
obligation. **Conditional on channel economics** — F-1 shows standard app-store commission
leaves Noetia 15% of gross before any operating cost. That is a cost-structure problem, not
an allocation problem, but it is the condition on which sustainability rests.

### GATE B — Understandable and defensible to creators? **CONDITIONAL**

Defensible: creators share actual money, transparently, with no hidden deduction.
Conditional: the 2× spread must be communicated deliberately, and the current "45% royalty
— highest in the category" claim needs the PO-007 qualification attached wherever it
appears. A creator statement showing $2.25 and $4.50 for the same title needs to explain
itself on the page.

### GATE C — Is a creator floor necessary? **NOT CURRENTLY INDICATED**

No scenario produces negative, unfundable, or absurd creator economics. The lowest case is
$2.25 per redemption at 45% of a real $5.00 of consideration — low, but proportionate. A
floor would also **contradict Model A**, since it would pay creators more than the token
was worth, with Noetia funding the difference from breakage or its own share. If the
Family-annual basis is considered too low, the cleaner lever is pricing or token allocation,
not a floor.

### GATE D — Is NEM-007 ready to begin? **NO**

Four blockers, in order of severity:

1. **No creator attribution in the schema** (§12) — no rights holder, narrator, or
   self-narrated flag per book. A settlement engine cannot determine *who* is owed.
   Requires a product/schema decision before implementation design.
2. **Causas basis contradiction** (C-11 / Q-15) — payment vs redemption changes a public
   commitment and every allocation total.
3. **Breakage residual policy** (§6) — unstated whether Marketing/Causas arise at payment
   or redemption; the model assumed Noetia retains expired value.
4. **Q-14 discount allocation** — up to 20%+ swings in creator earnings, unresolved.

Blockers 2, 3, and 4 are Product Owner decisions answerable quickly. Blocker 1 is design
work and is the real gate.

---

## Assumptions (explicitly labelled)

- Add-on buyers purchase **1 package per year**; penetration is the share of subscribers
  who buy. No evidence exists for purchase frequency.
- Package mix 40/35/15/10 across 1/3/5/10-token packages. No evidence; illustrative.
- Duo/Family modelled as **one subscription** with a shared pool, per the token model.
- Redemption rates are stress points, **not forecasts**. No historical redemption data was
  used.
- Expired token value is retained by Noetia — an assumption standing in for missing policy.
- Channel commissions in F-1 are illustrative rates, **not** Noetia's measured mix.
- Promotional and courtesy tokens are excluded (not qualifying redemptions).

## Review markers

`ACCOUNTING REVIEW REQUIRED` — breakage recognition · refund/chargeback reversal of accrued
obligations · Causas basis · payout timing and thresholds · whether accrued obligations are
a balance-sheet liability.
`OPERATING COST DATA REQUIRED` — channel mix, app-store commission tier, payment fees,
hosting, support, taxes. No contribution margin or net profit is calculated in this
analysis, and none should be inferred from it.
