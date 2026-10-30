# Noetia+ Unit Economics & Pricing Feasibility — Individual + Noetia+ at ≤ $14.99

**Date:** 2026-10-30 · **Nature:** financial analysis and documentation only. No code, Stripe, data, or pricing change.
**Status of every figure:** *approved policy*, *planning target*, or *illustrative assumption*, labelled where used. Nothing here is approved pricing.

---

## 1. Executive summary

- **Viability: CONDITIONAL — viable on the documented inputs, unproven on costs Noetia has not measured.**
- **Company-retained portion of an $8.99 Individual payment:** policy gives Noetia **45% = $4.0455**. After an **illustrative** card fee ($0.5607), Noetia keeps **$3.4848 (38.76%)** at **full redemption**, *before* any delivery, hosting, support, or tax cost. Breakage would raise it, but it is excluded from the base case.
- **Noetia+ at $6.00** (separate charge, illustrative fee $0.474, AI/infra at the **$1.50 planning target**): incremental contribution **$4.026 (67.1%)**. **Break-even AI cost: $5.526** per subscriber per month.
- **Combined $14.99 at full redemption:** contribution **$7.51 (50.1%)** with separate charges; **$7.81 (52.1%)** with one charge. If Causas + Marketing apply to Noetia+ (open question), these become **$6.91 (46.1%)** / **$7.21 (48.1%)**. All figures are before fixed costs, basic-plan delivery costs, and taxes.
- **AI is the swing factor.** PO-001's bands put a $6.00 Noetia+ at **Healthy ≤ $1.50**, **Caution ≤ $2.10**, **Intervention > $2.10**. At an average of $5.00 the add-on contributes $0.53; at $8.00 it loses $2.47 per subscriber. **Fair-use caps are a precondition**, not an option.
- **Prices below $5 do not fit PO-001 at the $1.50 target** ($4 → 37.5%, $3 → 50% COGS ratio). They only work if average AI ≤ $1.00 (at $4) or ≤ $0.75 (at $3).
- **Policy conflict:** "Noetia+ requires an active basic subscription" contradicts **PO-022** and **PO-023 rule 7**. This is flagged for an **explicit amendment**, not applied (§9).
- **Proposal (not approved):** Noetia+ **$5.99/month** (combined **$14.98**), annual **$59.99**, with hard fair-use caps keeping average AI ≤ $1.50. Confirm with measured costs before any Stripe price exists.

## 2. Sources of truth (verified text, not titles)

| Source | Exact provision used | Status |
|---|---|---|
| **PO-006** | Individual **$8.99/mo**, **$83.99/yr** | DECIDED; Stripe **unverified** (IG-01) |
| **PO-007** | Of gross value per **qualifying token redemption**: Noetia 45% · Author/Publisher 36% · Narrator 9% · Marketing 7.78% · Causas 2.22% | DECIDED; not implemented |
| **PO-008** | Creator obligation arises **at qualifying redemption**; lifecycle EARNED→PENDING→PAYABLE→PAID | DECIDED; `ACCOUNTING REVIEW REQUIRED` |
| **PO-010** | Gross value per token = **period price ÷ tokens issued** (monthly $8.99 ÷ 1; annual $83.99 ÷ 12 = $6.999167); basis travels with the token | DECIDED; precision and recognition not prescribed |
| **PO-011** | Causas 2.22% arises from **qualifying collected revenue at payment**, not redemption | DECIDED; `ACCOUNTING REVIEW REQUIRED` |
| **PO-012** | Marketing 7.78% **at payment**; creator 36% + 9% **only at redemption**; expired value = **breakage / retained economic value, "never profit"**; payment fees, app-store commission, hosting, support, taxes **not modelled** | DECIDED |
| **PO-013** | Discount attribution: actual consideration; ambiguous bundles excluded from creator processing | DECIDED |
| PO-009 | Engineering-mission traceability — **no financial content** (the instruction's label differs) | — |
| PO-017 | Financial retention — boundary only; legal retention undetermined | DECIDED (boundary) |
| *No record* | A "financial integrity and accounting controls" decision (as labelled for PO-013) **does not exist** | Gap |
| **PO-001** | AI/infra COGS target **≤ ~$1.50/mo** normal-user average; bands on AI COGS ÷ Noetia+ revenue: **Excellent ≤15% · Healthy 15–25% · Caution 25–35% · Intervention >35%**; `BOOK TOKEN ≠ AI USAGE` | DECIDED (target, not a billing rule) |
| PO-005 | Initial models (Gemini embedding / flash-lite, GPT fallbacks); **no prices recorded** | DECIDED (configuration) |
| NEM-003 `07-cost-and-usage-model.md` | Cost formula; personas Light/Normal/Heavy/Extreme; **all prices are placeholders** | Design |
| **PO-021…023** (PR #12) | Token-only acquisition; Noetia+ **independent** and purchasable **without** a book plan | DECIDED; unmerged |
| **PO-024** (PR #17) | Expiry/gifting rules used in §5 | DECIDED; unmerged |
| NOF-002 stress test | Illustrative card fee "**Stripe ~2.9% + $0.30**" and r = 0.75 — "assumption, not measured data" | Analysis |

PO-005…PO-020 and NOF-002 live on the unmerged branch `nem-009-resilience-impl`.

### Conflicts and gaps found
| # | Finding |
|---|---|
| X-1 | **Noetia+ dependency** (this instruction) vs **PO-022** ("does **not** require a book-token subscription") and **PO-023 rule 7** → needs an explicit amendment (§9) |
| X-2 | **COGS bands differ across documents:** PO-001 (15/25/35) vs the NEM-003 executive summary (15/30/45, "Unsustainable") and D1 ("Healthy ≤30%"). **PO-001 governs**; the NEM-003 text is stale |
| X-3 | **Annual price:** PO-006 $83.99 vs production display **$89.00** vs ToS **$80.99** vs business plan $89.99 (audit) |
| X-4 | **Causas on Noetia+:** the ToS promises "2.22% of **every** payment"; PO-022 leaves Noetia+ applicability open (impact assessment C-14) |
| X-5 | **Who bears payment fees** is undefined: PO-007 splits gross; this analysis assumes fees come from Noetia's share (creators are paid on gross per PO-010 "actual price") |
| X-6 | **Revenue recognition** (deferred revenue, breakage timing) is explicitly undetermined: `ACCOUNTING REVIEW REQUIRED` throughout |
| X-7 | No measured costs exist for: payment fees, hosting, bandwidth, storage, support, AI prices, AI usage, taxes, channel mix |

## 3. Notation and assumptions

| Symbol | Meaning | Value used | Status |
|---|---|---|---|
| `B` | Individual monthly price | $8.99 | PO-006 |
| `P` | Noetia+ monthly price | $6.00 (and $3–5) | **Ceiling under evaluation** |
| `fee(x)` | card processing on a charge `x` | `0.029·x + 0.30` | **Illustrative** (NOF-002); replace with Noetia's actual Stripe rate |
| `r` | share of subscription tokens redeemed | 1.00 (base), 0.95, 0.75 | **Illustrative**; no measured rate |
| `AI` | Noetia+ AI + infrastructure cost per subscriber-month | $1.50 | **Planning target** (PO-001), not observed |
| `U` | other Noetia+ incremental cost (support, storage, monitoring share) | unknown | **Missing input** |
| `D` | basic-plan delivery cost per subscriber (bandwidth, storage, reader hosting share) | unknown | **Missing input** |
| `F` | fixed monthly costs (VPS, tooling, people) | unknown | **Missing input** |
| `t` | tax rate where prices are tax-inclusive | unknown | **Missing input** |

All amounts are USD per subscriber-month, unrounded where it matters (PO-010 §6).

## 4. Individual subscription — verified allocation waterfall ($8.99, one token)

| Line | Basis | Arises at | Amount | % of $8.99 | Nature |
|---|---|---|---|---|---|
| Cash received | — | payment | **$8.9900** | 100% | cash |
| Causas | 2.22% × B | **payment** (PO-011) | $0.1996 | 2.22% | commitment from collected revenue |
| Marketing | 7.78% × B | **payment** (PO-012) | $0.6994 | 7.78% | internal allocation from collected revenue |
| Author / publisher | 36% × B | **redemption** (PO-008/012) | $3.2364 | 36.00% | creator obligation once redeemed |
| Narrator | 9% × B | **redemption** | $0.8091 | 9.00% | creator obligation once redeemed |
| Noetia | 45% × B | — | $4.0455 | 45.00% | company share (gross) |
| Card fee | `fee(B)` | payment | −$0.5607 | 6.24% | **illustrative** processor cost |
| **Noetia after fee, full redemption** | 45%·B − fee(B) | — | **$3.4848** | **38.76%** | **before D, F, U, taxes** |

**Breakage sensitivity** (PO-012: retained value, **never profit**, not guaranteed):
`Noetia_after_fee(r) = 0.45·B + (1 − r)·0.45·B − fee(B)` → r = 1.00: **$3.4848** · r = 0.95: $3.6871 · r = 0.75: $4.4962.
Profitability is evaluated at **r = 1.00**. The breakage uplift is upside only.

**Cash vs revenue vs liability** (classification for review, `ACCOUNTING REVIEW REQUIRED`):
- At payment: cash $8.99. Causas and Marketing allocations arise (PO-011/012). The token-related consideration is plausibly **deferred** until redemption or expiry (performance obligation: book access).
- At redemption: the creator obligation ($4.0455) becomes a liability (PO-008); the token portion is earned.
- At expiry without redemption: no creator obligation; residual value is retained (PO-012).
- **Available operating contribution** = Noetia's share after fees, delivery costs, and taxes — never the gross $8.99.

**Token rules (PO-024) as they bear on Individual:** one token/month, 90-day expiry per token, not giftable. At most **3** valid unredeemed subscription tokens exist at once, so the maximum creator exposure per subscriber if all are redeemed is 3 × 0.45 × B = **$12.1365**. That exposure survives cancellation (PO-024 rules 5–6).

## 5. Noetia+ incremental contribution ($6.00, separate charge)

```
contribution⁺ = P − fee(P) − a·P − AI − U        a = payment-level allocations applied to Noetia+ (0 or 0.10)
break-even AI = P − fee(P) − a·P − U
```

| Case | fee(P) | a·P | Before AI, U | AI = $1.50 | Margin | Break-even AI (U = 0) |
|---|---|---|---|---|---|---|
| No Causas/Marketing on Noetia+ | $0.4740 | $0 | $5.5260 | **$4.0260** | **67.1%** | **$5.5260** |
| Causas + Marketing apply (10%) | $0.4740 | $0.6000 | $4.9260 | **$3.4260** | 57.1% | $4.9260 |

No creator allocation is applied to Noetia+ (PO-022: not assumed). Whether Causas/Marketing apply is an **open decision** (X-4).

## 6. Combined Individual + Noetia+ (≤ $14.99), full redemption

```
combined = 0.45·B + P − a·P − fees − AI − U − D
fees = fee(B) + fee(P)   (two Stripe subscriptions)   or   fee(B + P)   (one charge)
```

| Noetia+ allocations | Billing | Fees | Contribution (AI $1.50; U = D = 0) | % of $14.99 |
|---|---|---|---|---|
| none | two charges | $1.0347 | **$7.5108** | **50.1%** |
| none | one charge | $0.7347 | $7.8108 | 52.1% |
| 10% | two charges | $1.0347 | $6.9108 | 46.1% |
| 10% | one charge | $0.7347 | $7.2108 | 48.1% |

A single charge saves the per-charge fixed fee (~$0.30/month, illustrative). That is relevant to the billing design in §9.

## 7. Scenarios

**A — Target usage** ($8.99 + $6.00 = $14.99; AI $1.50; "normal" redemption): there is no measured "normal" rate. At r = 0.75 (NOF-002 illustrative), the combined contribution is $7.5108 + 0.25·0.45·$8.99 = **$8.5222**. The base case below uses r = 1.

**B — Full redemption, no breakage:** **$7.5108 (50.1%)**, as in §6. This is the case profitability must survive. It does, before fixed costs, D, U and taxes.

**C — High AI usage** (Noetia+ $6.00, no allocations, two charges):

| Avg AI | AI ÷ Noetia+ revenue | PO-001 band | Noetia+ contribution | Combined | Combined % |
|---|---|---|---|---|---|
| $1.50 | 25% | Healthy (edge) | $4.0260 | $7.5108 | 50.1% |
| $2.10 | 35% | Caution (edge) | $3.4260 | $6.9108 | 46.1% |
| $3.00 | 50% | **Intervention** | $2.5260 | $6.0108 | 40.1% |
| $5.00 | 83% | **Intervention** | $0.5260 | $4.0108 | 26.8% |
| $8.00 | 133% | **Intervention (loss)** | **−$2.4740** | $1.0108 | 6.7% |

Above ~$5.53 average, Noetia+ starts consuming the basic plan's company share. Required protections (PO-001 / NEM-003 §07, not yet designed): **hard monthly caps by workload class** (scarce "deep analysis", cheap default routing), a **global budget guard / kill switch**, live **COGS ÷ revenue** telemetry, and caps sized so that the **heavy persona** stays within roughly $3–4 while the **average** stays ≤ $1.50.

**D — Lower Noetia+ price** (AI $1.50, no allocations):

| P | fee(P) | Contribution | Margin | AI ÷ P | Max AI at 25% (Healthy) | Max AI at 35% | Break-even AI |
|---|---|---|---|---|---|---|---|
| $3 | $0.387 | $1.113 | 37.1% | **50%** | $0.75 | $1.05 | $2.613 |
| $4 | $0.416 | $2.084 | 52.1% | **37.5%** | $1.00 | $1.40 | $3.584 |
| $5 | $0.445 | $3.055 | 61.1% | 30% | $1.25 | $1.75 | $4.555 |
| $6 | $0.474 | $4.026 | 67.1% | 25% | **$1.50** | $2.10 | $5.526 |

Only **$6** keeps the $1.50 target inside "Healthy". $5 is "Caution". $3–4 require AI far below the planning target.

**E — Annual** (Individual **$83.99**/yr per PO-006, conflicts X-3):
- PO-010 token basis: $83.99 ÷ 12 = **$6.999167**/token → creator 45% = $3.1496/token (lower than monthly's $4.0455: a direct consequence of the price, not a new policy).
- Monthly-equivalent: revenue $6.9992; Noetia 45% $3.1496; fee $2.7357/yr = $0.2280/mo → **Noetia after fee $2.9216/mo** at full redemption. The annual discount is **22.1%** (0.7786 × monthly).
- Noetia+ annual (illustrative, AI $1.50/mo):

| Noetia+ annual | Monthly-eq. | Fee/mo | Noetia+ contrib/mo | Combined/mo | On revenue/mo |
|---|---|---|---|---|---|
| $55.99 (same 22% discount) | $4.6658 | $0.1603 | $3.0055 | $5.9272 | $11.6650 |
| **$59.99** | $4.9992 | $0.1700 | $3.3292 | $6.2508 | $11.9983 |
| $64.99 | $5.4158 | $0.1821 | $3.7338 | $6.6554 | $12.4150 |

Annual billing changes no token rule (PO-024): monthly allocation via the drip, 90-day expiry. **Known defect:** the annual drip stops for `canceling` subscribers (PO-024 T-5).

**F — Basic plan cancelled while Noetia+ is billed:** under the stated dependency, Noetia+ **must not keep billing without entitlement**. Required behaviour (to decide and implement):
1. Cancelling the basic plan **schedules Noetia+ to end at the same period end** (no orphan charge); if Noetia+ is prepaid annually beyond that date, the refund or credit policy must be decided.
2. **Outstanding obligations after cancellation:** up to 3 unexpired subscription tokens stay redeemable (creator exposure ≤ $12.1365), and books stay owned. Noetia+ artefacts (conversations, knowledge assets) follow the post-cancellation retention decision (NEM-003 D5: read-only + export recommended), which costs storage after revenue ends.
3. **Basic plan `past_due`:** the Noetia+ entitlement is suspended after the same grace period. Billing of Noetia+ during suspension must be decided (pause collection vs cancel).

## 8. Required outputs — consolidated

| # | Output | Result |
|---|---|---|
| 1 | Individual waterfall | §4: Noetia **$4.0455** gross; **$3.4848** after illustrative fee, full redemption |
| 2 | Noetia+ incremental | §5: **$4.026** (67.1%) at $6 / AI $1.50; $3.426 if 10% allocations apply |
| 3 | Combined model | §6: **$7.51** (50.1%) two charges; $7.81 (52.1%) one charge |
| 4 | Contribution $ / % | §5–7 tables |
| 5 | Break-even AI per Noetia+ subscriber | **$5.526** (no allocations) · $4.926 (10%), before U |
| 6 | Sensitivity — redemption & AI | §4 (r), §7C (AI) |
| 7 | Monthly vs annual | §7E: annual Individual leaves **$2.92/mo** vs **$3.48/mo** monthly (after fee) |
| 8 | Max sustainable Noetia+ operating budget under $14.99 | **Self-funding:** $5.526/mo (AI + U) at break-even; **policy-sustainable:** AI ≤ **$1.50** (Healthy) or ≤ $2.10 (Caution) at $6. Drawing on the basic plan's company share would raise the theoretical ceiling to $9.01, which is **not recommended**: that share must also fund D, F and taxes |
| 9 | Fixed, shared costs, taxes | §10 |
| 10 | Recommendation | §11 |

## 9. Product and architecture implications of "Noetia+ requires an active basic subscription"

| Area | Implication |
|---|---|
| **PO-022 / PO-023** | Contradicts "independently purchasable" and "Noetia+ without a book plan" (rule 7). **Requires an explicit PO amendment.** Free accounts (PO-023) could no longer buy Noetia+ |
| **Stripe structure** | The dependency favours **one Stripe subscription with two items** (basic + Noetia+): aligned periods, one cancellation path for the dependency, one charge (≈ $0.30/mo fee saving, illustrative), and the add-on can still be removed on its own. The earlier PO-022 assessment recommended separate subscriptions *because* of independence; that recommendation should be revisited if the dependency is adopted |
| **Entitlements** | Noetia+ active ⇔ basic active/trialing/canceling **and** Noetia+ item active; suspension on basic `past_due`; end at basic end |
| **Payment failure** | One combined invoice → one failure state; separate subscriptions → two states to reconcile |
| **Monthly vs annual** | Noetia+'s interval must match the basic plan's (mixed intervals break "ends with basic") |
| **Revenue split** | Per invoice line/price: book-plan revenue feeds PO-010 token basis and PO-011/012 allocations; Noetia+ revenue is separate and **never** enters the token basis (PO-022) |
| **Financial reporting** | Product-line tagging on every payment line (book plan · token pack · gift card · Noetia+), the same need as PO-022 assessment C-14/M-D |
| **Duo / Family** | Do linked members (who hold no basic subscription of their own) qualify? Open (NEM-003 D8) |

## 10. Fixed costs, shared costs, taxes, missing inputs

- **Fixed costs F** (VPS, monitoring, tooling, people) are not documented in the repository. Break-even subscriber count: **N = F ÷ unit contribution**. For example, every **$1,000/month** of fixed cost needs ≈ **133** combined subscribers at $7.51, or ≈ **287** Individual-only subscribers at $3.48. Normalised, not a cost estimate.
- **Shared costs:** reader hosting, audio bandwidth, storage and search (D) serve both lines; allocation keys are undecided.
- **Taxes:** where prices are tax-inclusive (likely in LATAM markets), net revenue = `price ÷ (1 + t)`, which reduces every line above proportionally. Where tax-exclusive (typical US), tax is a pass-through liability. **Market mix and tax regime are unknown.**
- **App stores:** today purchases happen on the web (no in-app purchase). If store billing became mandatory, NOF-002 F-1 shows commission alone would leave ~15% of gross. It is the largest unmodelled risk.
- **Missing inputs:** actual Stripe rate; AI provider prices and measured usage; D, U, F; redemption rate; refund/chargeback rate; channel mix; tax regime; accounting treatment.

## 11. Recommended pricing strategy — PROPOSAL, not approved

1. **Noetia+ $5.99/month** (combined **$14.98**, under the ceiling), **annual $59.99** (≈ $5.00/mo).
2. **Fair use as a launch requirement:** average AI ≤ **$1.50**, Caution alarm at **$2.10**, hard caps per workload class, a global budget guard.
3. **Billing:** if the dependency is adopted, one Stripe subscription with two items, matched intervals, and the add-on ending with the basic plan.
4. **Do not price below $5** unless measured AI cost is ≤ $1.00 per subscriber-month.
5. **Before any Stripe price:** measure the actual fee rate, D, U, F, the tax regime, and real AI cost in a staged beta.

**Verdict on $14.99: CONDITIONAL.** On the documented policy and the illustrative fee, $14.99 leaves ~$7.51 per combined subscriber (50%) at full redemption **before** fixed costs, basic-plan delivery costs and taxes. That is healthy, provided average AI stays ≈ $1.50 and fair use is enforced. It becomes unviable if average AI exceeds ~$5.5, if app-store commission applies, or if unmeasured costs (D + U + share of F + tax) exceed ~$7.5 per subscriber.

## 12. Accounting, legal and Product Owner questions

| # | Question | Owner |
|---|---|---|
| Q-E1 | Amend PO-022 / PO-023 to make Noetia+ require an active basic subscription? (X-1) | PO |
| Q-E2 | Do Causas (2.22%) and Marketing (7.78%) apply to Noetia+ payments? (X-4; ToS says "every payment") | PO + legal |
| Q-E3 | Who bears payment fees in the PO-007 split? (X-5) | PO + accounting |
| Q-E4 | Revenue recognition: deferral of token consideration, breakage timing, Noetia+ ratable recognition | Accounting |
| Q-E5 | Canonical annual price (X-3) | PO |
| Q-E6 | Noetia+ refund/credit when the basic plan ends mid-period; billing during `past_due` suspension | PO |
| Q-E7 | Duo/Family members' Noetia+ eligibility under the dependency | PO |
| Q-E8 | Fair-use limits and customer-facing units (NEM-003 D2/D10) | PO |
| Q-E9 | Tax regime and target markets (inclusive vs exclusive pricing) | PO + tax |
| Q-E10 | Retire the stale COGS bands in the NEM-003 docs in favour of PO-001 (X-2) | Product Architecture |

## 13. Proposed follow-up missions (none authorized)

| Mission | Purpose |
|---|---|
| **Cost-measurement mission** | Actual Stripe fees, per-subscriber delivery cost D, fixed cost F, support U, from invoices and monitoring (read-only) |
| **AI cost benchmark** | Verified provider prices × measured token volumes for the PO-005 models on the NEM-003 personas, run on staging |
| **Financial model (spreadsheet/script)** | This document's formulas as a parameterised model with the measured inputs, reviewed by accounting |
| **Product-line revenue tagging** | Payment records with product line (shared with PO-022 assessment M-D and settlement IG-02) |
| **Noetia+ billing design** | Dependency-aware subscription structure (§9), after Q-E1 |
