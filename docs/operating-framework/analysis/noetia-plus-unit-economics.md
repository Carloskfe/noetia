# Noetia+ Unit Economics & Pricing Feasibility — Individual + Noetia+ at ≤ $14.99

**Date:** 2026-10-30 (rev. 2: conservative-allocation primary case) · **Nature:** financial analysis and documentation only. No code, Stripe, data, or pricing change.
**Status of every figure:** *approved policy*, *PO working requirement*, *planning assumption*, or *illustrative assumption*, labelled where used. **Nothing here is approved pricing.** No Noetia+ retail price is recommended for approval; §11 presents options for decision.

---

## 0. Product Owner working requirements (2026-10-30)

| # | Requirement | How this assessment treats it |
|---|---|---|
| W-1 | Noetia+ is a premium add-on that **requires an active basic subscription** | **Direction APPROVED by the Product Owner (2026-10-30)**: no standalone Noetia+ for free or token-pack-only accounts; cancelling Noetia+ never cancels basic; Noetia+ entitlement ends when basic ends. Billing, refunds, grace periods, and synchronization **pending**. Amendment wording for PO-022 / PO-023 in [`noetia-plus-po-022-023-amendment-drafts.md`](noetia-plus-po-022-023-amendment-drafts.md); records not yet amended |
| W-2 | Combined Individual + Noetia+ monthly price **≤ $14.99** | Noetia+ monthly price `P ≤ $6.00` |
| W-3 | Causas 2.22% + Marketing 7.78% **also apply to Noetia+** revenue | **Primary case** (`a = 10%`). The 0% case is kept only as a reference column |
| W-4 | W-3 is a **planning assumption** pending financial-policy approval and accounting/legal review | Not an amendment to PO-011/PO-012; PO-022 leaves the question open |
| W-5 | The Individual retained portion may contribute, but **no double counting** and **not entirely available** before operating costs | Each line bears its own costs (§3.2); the basic share is shown only after its own fee and delivery cost; Noetia+ must be **self-funding** |
| W-6 | **Full token redemption**, no reliance on breakage | `r = 1.00` everywhere; breakage appears only as a labelled reference note |

## 1. Executive summary

- **Viability: CONDITIONAL.** Viable on documented policy and illustrative fees; unproven on costs Noetia has not measured (delivery D, Noetia+ support U, fixed F, taxes, real AI cost).
- **Individual $8.99, full redemption:** gross contribution to Noetia **$4.0455 (45%)**; operating contribution **$3.4848 − D** after the illustrative card fee. This is the *whole* basic-plan contribution available to Noetia — it must first cover the basic plan's own delivery, its share of fixed costs, and taxes.
- **Noetia+ at the $6.00 ceiling, conservative 10% allocations:** gross contribution **$5.40**; operating contribution **$3.426 − U** at the $1.50 AI planning target (57.1%). **Break-even AI: $4.926 − U** per subscriber-month.
- **Combined $14.99 (conservative):** operating contribution **$6.9108 − D − U (46.1%)** with two charges; **$7.2108 − D − U (48.1%)** with one combined Stripe subscription. Net profitability is not computable: F and taxes are unmeasured (§8).
- **The ceiling is tight.** At the $1.50 target, any Noetia+ price below $6.00 pushes AI ÷ revenue above PO-001's Healthy limit (25%): $5.99 is 25.04% — Caution by $0.0025. On *net-of-allocation* revenue, $1.50 at $6.00 is already 27.8% (Caution) — the denominator needs a PO decision (Q-E11).
- **AI is still the swing factor.** Above **$4.926** average AI, Noetia+ stops funding itself and begins consuming the basic plan's contribution. Fair-use caps and a budget guard are preconditions.
- **Tax-inclusive markets** (illustrative 16–19% VAT) cut the combined operating contribution to **$5.40–5.61**, and Noetia+ break-even AI to **$4.06–4.18**.
- **Dependency:** favours **one Stripe subscription with two line items**; this preserves PO-010 token valuation and separates Noetia+ revenue **only if** discounts, fees, refunds and taxes are attributed per line (§9.2). Today's webhook reads only the first item/line — implementation needed.

## 2. Sources of truth (verified text, not titles)

| Source | Exact provision used | Status |
|---|---|---|
| **PO-006** | Individual **$8.99/mo**, **$83.99/yr** | DECIDED; Stripe **unverified** (IG-01) |
| **PO-007** | Of gross value per **qualifying token redemption**: Noetia 45% · Author/Publisher 36% · Narrator 9% · Marketing 7.78% · Causas 2.22% | DECIDED; not implemented |
| **PO-008** | Creator obligation arises **at qualifying redemption** | DECIDED; `ACCOUNTING REVIEW REQUIRED` |
| **PO-010** | Gross value per token = **period price ÷ tokens issued**; basis travels with the token | DECIDED |
| **PO-011** | Causas 2.22% from **qualifying collected revenue at payment** | DECIDED; `ACCOUNTING REVIEW REQUIRED` |
| **PO-012** | Marketing 7.78% at payment; creator 36% + 9% only at redemption; residual = **breakage / retained economic value, "never profit"**, before payment fees, app-store commission, hosting, support, taxes | DECIDED |
| **PO-013** | Unambiguous discounts → actual consideration under PO-010; **ambiguous bundles** must define token allocation **before activation** or stay **excluded from creator processing** | DECIDED — directly relevant to a combined invoice (§9.2) |
| PO-009 | Engineering-mission traceability — **no financial content** | — |
| PO-017 | Financial retention — boundary only | DECIDED (boundary) |
| **PO-001** | AI/infra COGS target **≤ ~$1.50/mo** average; bands on AI COGS ÷ Noetia+ revenue: **Excellent ≤15% · Healthy 15–25% · Caution 25–35% · Intervention >35%**; `BOOK TOKEN ≠ AI USAGE` | DECIDED (target) |
| **PO-022** (PR #12) | Noetia+ "**does not require a book-token subscription**", own billing lifecycle and cancellation; revenue separately identifiable; no creator allocation assumed; never in token basis; **Causas/Marketing applicability pending** | DECIDED; unmerged |
| **PO-023** (PR #12) | Rule 6: all subscriptions optional · Rule 7: Noetia+ **without** a book-token plan · Rule 8: independent entitlements and cancellation | DECIDED; unmerged |
| **PO-024** (PR #17) | Token expiry/gifting rules used in §7F | DECIDED; unmerged |
| NOF-002 | Illustrative fee "Stripe ~2.9% + $0.30" — "assumption, not measured data" | Analysis |
| Code | `webhooks.service.ts:130` reads `invoice.lines.data[0]`; `:176` reads `sub.items.data[0]` | Fact (current `main`) |

PO-005…PO-020 and NOF-002 live on the unmerged branch `nem-009-resilience-impl`; PO-021…023 on PR #12.

### Conflicts and gaps

| # | Finding |
|---|---|
| X-1 | **W-1 dependency (approved direction)** vs **PO-022** and **PO-023 rules 6–8** → amendment wording drafted for PO review; records not yet amended. Related documents to reconcile: amendment drafts C-3…C-6 |
| X-2 | COGS bands differ: PO-001 (15/25/35) vs NEM-003 summary (15/30/45). **PO-001 governs** |
| X-3 | Annual price: PO-006 $83.99 vs production display $89.00 vs ToS $80.99 |
| X-4 | **Causas/Marketing on Noetia+**: W-3 assumes yes (planning only); PO-022 leaves it pending; ToS promises Causas on "every payment" |
| X-5 | **Who bears payment fees** is undefined; this analysis charges them to Noetia's share |
| X-6 | Revenue recognition undetermined: `ACCOUNTING REVIEW REQUIRED` |
| X-7 | No measured costs: fees, hosting, bandwidth, storage, support, AI, taxes, channel mix |
| X-8 | **PO-001 band denominator** — gross Noetia+ revenue or revenue net of the 10% allocations — becomes material once W-3 applies |

## 3. Notation, assumptions, and contribution tiers

### 3.1 Inputs

| Symbol | Meaning | Value | Status |
|---|---|---|---|
| `B` | Individual monthly price | $8.99 | PO-006 |
| `P` | Noetia+ monthly price | ≤ $6.00 (grid $3–6) | W-2 ceiling; **not a decided price** |
| `a` | payment-level allocations on Noetia+ | **10%** (primary) · 0% (reference) | W-3 planning assumption |
| `fee(x)` | card processing per charge | `0.029·x + 0.30` | **Illustrative**; §7G uses 4.4% + $0.30 |
| `r` | token redemption | **1.00** | W-6 |
| `AI` | Noetia+ AI + infrastructure per subscriber-month | $1.50 | PO-001 planning target |
| `U` | other Noetia+ variable cost (support, storage, monitoring) | unknown | Missing |
| `D` | basic-plan delivery cost (audio bandwidth, storage, reader hosting) | unknown | Missing |
| `F` | fixed monthly cost | unknown | Missing |
| `t` | tax rate where prices are tax-inclusive | unknown (0 / 16% / 19% illustrative) | Missing |

### 3.2 Three tiers — never mixed

| Tier | Definition | Basic line | Noetia+ line |
|---|---|---|---|
| **Gross contribution** | Revenue − policy allocations (Causas, Marketing, creators at full redemption) | `0.45·B` | `(1 − a)·P` |
| **Operating contribution** | Gross − variable operating costs | `0.45·B − fee_B − D` | `(1 − a)·P − fee_P − AI − U` |
| **Net profitability** | Σ operating over subscribers − fixed costs − taxes on income | `N·(op_B + op_P) − F − tax` | — |

**No-double-counting rules (W-5):**
1. Each line carries **its own** fee (one-charge fees are split pro rata by line amount), delivery, and AI costs.
2. The basic line's operating contribution is reported **after** its own costs; it is **not** an AI budget.
3. Noetia+ is **self-funding**: its AI/U budget is bounded by its own gross contribution minus its fee. Any excess AI is shown explicitly as a **draw on the basic line** (§7C), never netted silently.
4. Combined contribution = op_B + op_P, nothing more. Creator obligations at full redemption are never counted as Noetia's.

## 4. Individual subscription — waterfall ($8.99, one token, r = 1)

| Line | Basis | Arises at | Amount | % |
|---|---|---|---|---|
| Cash | — | payment | **$8.9900** | 100% |
| Causas | 2.22% | payment (PO-011) | $0.1996 | 2.22% |
| Marketing | 7.78% | payment (PO-012) | $0.6994 | 7.78% |
| Author / publisher | 36% | redemption | $3.2364 | 36.00% |
| Narrator | 9% | redemption | $0.8091 | 9.00% |
| **Gross contribution (Noetia)** | 45% | — | **$4.0455** | 45.00% |
| Card fee (separate charge) | `fee(B)` | payment | −$0.5607 | 6.24% |
| **Operating contribution** | — | — | **$3.4848 − D** | 38.76% before D |

Breakage (PO-012, never profit) is **excluded** per W-6. For reference only: each unredeemed token would leave $4.0455 of retained value with Noetia; it is not used anywhere below.

**Liability:** at most 3 valid unredeemed subscription tokens per subscriber (PO-024), so creator exposure ≤ 3 × $4.0455 = **$12.1365**, surviving cancellation.

## 5. Noetia+ incremental contribution — conservative primary case (`a = 10%`, AI $1.50, U = 0)

```
gross_P       = 0.90 · P
operating_P   = 0.90 · P − fee(P) − AI − U
break-even AI = 0.90 · P − fee(P) − U
```

| P | Combined | Causas + Mkt | Gross | fee(P) | **Operating** | Op. % | **Break-even AI** | AI ÷ P at $1.50 | Band | AI ÷ net |
|---|---|---|---|---|---|---|---|---|---|---|
| $3.00 | $11.99 | $0.30 | $2.70 | $0.387 | **$0.813** | 27.1% | $2.313 | 50.0% | Intervention | 55.6% |
| $4.00 | $12.99 | $0.40 | $3.60 | $0.416 | **$1.684** | 42.1% | $3.184 | 37.5% | Intervention | 41.7% |
| $5.00 | $13.99 | $0.50 | $4.50 | $0.445 | **$2.555** | 51.1% | $4.055 | 30.0% | Caution | 33.3% |
| $5.50 | $14.49 | $0.55 | $4.95 | $0.460 | **$2.991** | 54.4% | $4.491 | 27.3% | Caution | 30.3% |
| $5.99 | $14.98 | $0.599 | $5.391 | $0.474 | **$3.417** | 57.0% | $4.917 | 25.04% | Caution (edge) | 27.8% |
| $6.00 | $14.99 | $0.60 | $5.40 | $0.474 | **$3.426** | 57.1% | $4.926 | 25.0% | Healthy (edge) | 27.8% |

**AI budgets by PO-001 band** (on gross P): $6.00 → Excellent ≤ $0.90 · Healthy ≤ $1.50 · Caution ≤ $2.10. $5.00 → $0.75 / $1.25 / $1.75. $4.00 → $0.60 / $1.00 / $1.40. $3.00 → $0.45 / $0.75 / $1.05.

Reference (`a = 0`, not the planning case): at $6.00 operating $4.026, break-even $5.526. W-3 costs Noetia **$0.60** per subscriber-month at the ceiling.

## 6. Combined Individual + Noetia+ — conservative, full redemption (AI $1.50; D, U shown symbolically)

| P | Price | Gross (basic + N+) | Fees, two charges | **Operating, two charges** | % | Fees, one charge | **Operating, one charge** | % |
|---|---|---|---|---|---|---|---|---|
| $6.00 | $14.99 | $9.4455 | $1.0347 | **$6.9108 − D − U** | 46.1% | $0.7347 | **$7.2108 − D − U** | 48.1% |
| $5.99 | $14.98 | $9.4365 | $1.0344 | $6.9021 − D − U | 46.1% | $0.7344 | $7.2021 − D − U | 48.1% |
| $5.00 | $13.99 | $8.5455 | $1.0057 | $6.0398 − D − U | 43.2% | $0.7057 | $6.3398 − D − U | 45.3% |
| $4.00 | $12.99 | $7.6455 | $0.9767 | $5.1688 − D − U | 39.8% | $0.6767 | $5.4688 − D − U | 42.1% |
| $3.00 | $11.99 | $6.7455 | $0.9477 | $4.2978 − D − U | 35.8% | $0.6477 | $4.5978 − D − U | 38.3% |

**Decomposition at $14.99, one charge** (fee split pro rata): basic line $4.0455 − $0.4406 − D = **$3.6049 − D**; Noetia+ line $5.40 − $0.2941 − $1.50 − U = **$3.6059 − U**. The one-charge saving (≈ $0.30, illustrative) is a billing effect, not new revenue.

**Headroom for unmeasured variable costs** at $14.99: combined operating stays positive while **D + U < $6.91** (two charges) or **< $7.21** (one charge). Neither D nor U has been measured.

## 7. Scenarios and sensitivities (conservative case unless stated)

**A — Target usage** ($14.99; AI $1.50; r = 1): **$6.9108 − D − U** (two charges) / **$7.2108 − D − U** (one). Under W-6 the "normal" case equals full redemption; no breakage is credited.

**B — Full redemption:** identical to A. Profitability must and does survive it, before D, U, F, taxes.

**C — AI sensitivity** ($6.00, two charges, U = D = 0):

| Avg AI | AI ÷ P | PO-001 band | Noetia+ operating | Draw on basic line | Combined operating | % |
|---|---|---|---|---|---|---|
| $1.00 | 16.7% | Healthy | $3.926 | — | $7.4108 | 49.4% |
| **$1.50** | 25.0% | Healthy (edge) | **$3.426** | — | **$6.9108** | 46.1% |
| $2.10 | 35.0% | Caution (edge) | $2.826 | — | $6.3108 | 42.1% |
| $3.00 | 50.0% | Intervention | $1.926 | — | $5.4108 | 36.1% |
| **$4.926** | 82.1% | Intervention | **$0.000** | — | $3.4848 | 23.2% |
| $5.00 | 83.3% | Intervention | −$0.074 | **$0.074** | $3.4108 | 22.8% |
| $8.00 | 133.3% | Intervention | −$3.074 | **$3.074** | $0.4108 | 2.7% |

Beyond $4.926 the add-on is cross-subsidised by the basic plan, which W-5 does not permit as a planning basis. Protections required before launch: hard per-workload caps, cheap default routing, a global budget guard / kill switch, live AI ÷ revenue telemetry, caps sized so the heavy persona stays ≤ ~$3 and the average ≤ $1.50.

**D — Lower Noetia+ price:** see §5. Below $6.00 the $1.50 target leaves the Healthy band; at $3–4 it is in Intervention. Lower prices require measured average AI of ≤ $1.25 ($5), ≤ $1.00 ($4), ≤ $0.75 ($3) to stay Healthy.

**E — Annual** (Individual $83.99/yr per PO-006; X-3 open). Basic line: token basis $6.9992; gross $3.1496/mo; fee $0.2280/mo → **operating $2.9216 − D per month** (vs $3.4848 − D monthly). Noetia+ annual options (illustrative, `a = 10%`, AI $1.50/mo, **intervals matched** as the dependency requires):

| Noetia+ annual | Discount vs 12 × $6 | Monthly-eq. | AI ÷ revenue | Gross/mo | Fee/mo | N+ operating/mo | Break-even AI/mo | Combined op./mo, two charges | one charge |
|---|---|---|---|---|---|---|---|---|---|
| $55.99 | 22.2% (≈ Individual's) | $4.666 | 32.1% Caution | $4.199 | $0.160 | $2.539 | $4.039 | $5.461 | $5.486 |
| $59.99 | 16.7% | $4.999 | 30.0% Caution | $4.499 | $0.170 | $2.829 | $4.329 | $5.751 | $5.776 |
| $64.99 | 9.7% | $5.416 | 27.7% Caution | $4.874 | $0.182 | $3.192 | $4.692 | $6.114 | $6.139 |
| $71.99 | 0% | $5.999 | 25.0% Healthy (edge) | $5.399 | $0.199 | $3.700 | $5.200 | $6.622 | $6.647 |

Every discounted annual Noetia+ price puts the $1.50 target in Caution. Annual Noetia+ is also prepaid AI exposure for 12 months; mid-term basic cancellation (F) needs a refund/credit rule.

**F — Basic plan cancelled while Noetia+ is billed:**
1. Noetia+ must not continue billing without entitlement → cancelling the basic plan **schedules Noetia+ to end at the same period end**.
2. Obligations that survive: ≤ 3 unexpired tokens (creator exposure ≤ $12.1365), owned books, Noetia+ artefacts under the post-cancellation retention rule (NEM-003 D5) — storage cost with no revenue.
3. Basic `past_due`: Noetia+ entitlement suspends with it; billing during suspension undecided (Q-E6).
4. Prepaid annual Noetia+ with a monthly basic plan is inconsistent with the dependency → matched intervals required.

**G — Fee sensitivity** ($14.99): at an illustrative 4.4% + $0.30 (international cards), operating falls to **$6.6859** (two charges) / **$6.9859** (one); Noetia+ break-even AI falls to $4.836.

**H — Tax-inclusive pricing** (illustrative; assumes allocations computed on net-of-tax revenue — itself an open question, Q-E9):

| t | Basic net | Basic operating | N+ operating | N+ break-even AI | Combined (two charges) | % of $14.99 |
|---|---|---|---|---|---|---|
| 0% | $8.990 | $3.4848 | $3.426 | $4.926 | **$6.9108** | 46.1% |
| 16% | $7.750 | $2.9268 | $2.681 | $4.181 | **$5.6080** | 37.4% |
| 19% | $7.555 | $2.8389 | $2.564 | $4.064 | **$5.4027** | 36.0% |

## 8. Required outputs — consolidated

| # | Output | Result (conservative, r = 1) |
|---|---|---|
| 1 | Individual waterfall | Gross **$4.0455**; operating **$3.4848 − D** |
| 2 | Noetia+ incremental at $6.00 | Gross $5.40; operating **$3.426 − U** (57.1%) |
| 3 | Combined at $14.99 | **$6.9108 − D − U** (two charges) · **$7.2108 − D − U** (one) |
| 4 | Contribution tiers | Gross §5–6 · operating §5–7 · **net not computable** (F, tax unknown) |
| 5 | Break-even AI | **$4.926 − U** at $6.00; $4.917 at $5.99; $4.055 at $5.00 |
| 6 | Sensitivities | AI §7C · fees §7G · tax §7H · price §5 · annual §7E |
| 7 | Monthly vs annual | Basic operating $3.48 → $2.92/mo; discounted annual Noetia+ lands in Caution at $1.50 |
| 8 | Max sustainable Noetia+ budget | Self-funding ceiling **$4.926/mo (AI + U)** at $6.00; policy ceiling **$1.50** (Healthy) / **$2.10** (Caution) |
| 9 | Net profitability | `N · op_unit − F − tax`. Per **$1,000/mo** of F: ≈ **145** combined subscribers (two charges) / **139** (one) / **287** Individual-only — **before** D and U |
| 10 | Pricing | Options only (§11); no price recommended for approval |

## 9. Subscription dependency — implications

### 9.1 Product, policy, architecture

| Area | Implication |
|---|---|
| **Policy** | Direction **approved** (2026-10-30). PO-022 / PO-023 records still state independence until the drafted amendments are applied |
| **Addressable market** | Shrinks to basic subscribers (which plans qualify — Individual, Duo/Family — is **pending**). Free accounts and token-pack-only buyers cannot purchase or maintain Noetia+ (**approved**) |
| **Entitlement** | Noetia+ requires an active basic subscription and ends when basic ends (**approved**). Which states count as "active", and behaviour during `past_due`, are **pending**; the analysis models suspension as one option |
| **Book ownership** | Unchanged: owned books, notes, highlights, fragments, and issued tokens survive any cancellation (PO-021/022/024 preserved) |
| **Cancellation** | Noetia+ cancellation leaves basic untouched (**approved**). Basic ending ends Noetia+ entitlement (**approved**); exact timing and billing synchronization **pending** |
| **Interval** | Matching intervals are the analysis's working model; **not decided** |
| **Schema** | One combined Stripe subscription fits the existing one-subscription-per-user constraint (`uq_subscriptions_user`) better than two subscriptions, but **entitlements must be modelled per item** |
| **Webhook** | `webhooks.service.ts` reads only `items.data[0]` and `lines.data[0]` → a two-item subscription would be misread today. Implementation mission required |
| **Duo / Family** | Whether linked members (no own subscription) qualify is open (Q-E7) |
| **Terms of Service** | Dependency, cascade, refund, and Causas wording ("every payment") need legal review |

### 9.2 One Stripe subscription, separate line items — preserving token valuation and Noetia+ accounting

| Concern | Mechanism | Rule needed |
|---|---|---|
| **Separate prices** | Two Products/Prices (basic, Noetia+), each tagged `product_line` metadata | — |
| **PO-010 token basis** | Basis = **basic line amount actually paid** (after its own line-level discount) ÷ tokens issued for that period. The Noetia+ line never enters it (PO-022) | Settlement reads the basic line by price ID, never the invoice total |
| **Discounts (PO-013)** | Coupons restricted to one product (`applies_to.products`) are **unambiguous** → PO-010 actual consideration. An invoice-level coupon spanning both lines is a **heterogeneous bundle** → must have a token allocation defined **before activation**, or the basic line's tokens are **excluded from creator processing** | PO decision: forbid cross-line coupons, or pre-approve an allocation key (e.g. pro rata by list price) — Q-E12 |
| **Prorations** | Adding/removing Noetia+ mid-cycle creates Noetia+-only proration lines; the basic line, and thus token basis, is unaffected | Proration lines classified by price ID |
| **Causas / Marketing** | Computed **per line** on collected amount, so the 10% on Noetia+ (W-3) can be reported, reversed, or switched off independently if policy decides otherwise | Per-line allocation records |
| **Payment fees** | Stripe reports the fee per charge, not per line | Accounting-approved allocation key (pro rata by amount used here) — Q-E3 |
| **Refunds / credits** | Charge-level refunds do not say which line was refunded | Use line-level credit notes; reverse allocations per line — Q-E4 |
| **Failed payment** | One invoice → one state for both lines; consistent with the dependency | Dunning applies to both |
| **Taxes** | Per-line tax amounts; book access and AI services may carry different tax codes | Tax review — Q-E9 |
| **Reporting** | Revenue, deferral, and recognition per `product_line`; Noetia+ ratable, token consideration deferred to redemption/expiry (for review) | `ACCOUNTING REVIEW REQUIRED` |

## 10. Fixed costs, shared costs, taxes, missing inputs

- **Fixed costs F:** undocumented. Normalised break-even only (§8 #9).
- **Shared costs:** reader hosting, audio bandwidth, storage and search serve both lines; allocation keys undecided. This analysis charges them to D (basic) and U (Noetia+) and never to both.
- **Taxes:** tax-inclusive markets reduce every line (§7H); tax-exclusive markets pass tax through. Market mix unknown.
- **App stores:** purchases are web-only today. If store billing applied, NOF-002 F-1 shows commission alone would leave ~15% of gross at full redemption — the largest unmodelled risk.
- **Missing inputs:** actual Stripe rate and card mix; AI prices and measured usage; D, U, F; refund/chargeback rate; tax regime; accounting treatment.

## 11. Pricing options — for Product Owner decision (none recommended for approval)

| Option | Noetia+ monthly | Combined | Operating (one charge) | AI ÷ P at $1.50 | Trade-off |
|---|---|---|---|---|---|
| A | $6.00 | $14.99 | $7.2108 − D − U | 25.0% Healthy (edge) | Uses the full ceiling; only option inside Healthy at $1.50 on gross revenue |
| B | $5.99 | $14.98 | $7.2021 − D − U | 25.04% Caution (edge) | Charm price; $0.01 less; formally Caution unless average AI ≤ $1.4975 |
| C | $5.00 | $13.99 | $6.3398 − D − U | 30.0% Caution | Lower barrier; requires average AI ≤ $1.25 for Healthy |
| D | ≤ $4.00 | ≤ $12.99 | ≤ $5.4688 − D − U | ≥ 37.5% Intervention | Requires average AI ≤ $1.00; not supportable on current targets |

**Prerequisites for any option:** measured AI cost in a staged beta; enforced fair-use caps; measured fee rate, D, U, F; tax regime; accounting review; decision on W-3; amendment of PO-022/PO-023.

**Verdict on $14.99: CONDITIONAL.** Under the conservative case and full redemption, $14.99 leaves **$6.91–7.21 per combined subscriber (46–48%) before D, U, F, and taxes.** It remains viable if average AI ≈ $1.50 and fair use is enforced. It becomes unviable if average AI exceeds ~$4.9, if app-store commission applies, or if D + U + share of F + tax exceed ~$7 per subscriber.

## 12. Product Owner, accounting, and legal questions

| # | Question | Owner |
|---|---|---|
| Q-E1 | Dependency direction **approved 2026-10-30**. Remaining: approve the amendment **wording** and its application to the PO-022 / PO-023 records | PO |
| Q-E2 | Confirm Causas 2.22% + Marketing 7.78% on Noetia+ as policy (W-3 → decision), with legal review of the ToS "every payment" wording | PO + legal |
| Q-E3 | Who bears payment fees; fee allocation key for a combined charge | PO + accounting |
| Q-E4 | Revenue recognition: token deferral, Noetia+ ratable recognition, line-level refunds | Accounting |
| Q-E5 | Canonical annual price (X-3) | PO |
| Q-E6 | Noetia+ refund/credit when basic ends mid-period; billing during `past_due` | PO |
| Q-E7 | Which plans count as "basic subscription" (Individual; Duo/Family owners; linked members) and which states count as "active" | PO |
| Q-E8 | Fair-use limits and customer-facing units | PO |
| Q-E9 | Tax regime and markets; are allocations computed on tax-inclusive or net revenue? | PO + tax |
| Q-E10 | Retire stale NEM-003 COGS bands in favour of PO-001 | Product Architecture |
| Q-E11 | PO-001 band denominator: gross Noetia+ revenue or net of payment-level allocations (X-8) | PO |
| Q-E12 | Combined-invoice discounts: forbid cross-line coupons, or pre-approve a token allocation key (PO-013) | PO + accounting |
| Q-E13 | Noetia+ retail price (monthly, annual) and whether annual Noetia+ is offered at launch | PO |
| Q-E14 | One combined Stripe subscription with two items vs two subscriptions | PO + Product Architecture |

## 13. Proposed follow-up missions (none authorized)

| Mission | Purpose |
|---|---|
| Cost measurement | Actual Stripe fees, D, U, F from invoices and monitoring (read-only) |
| AI cost benchmark | Provider prices × measured volumes for PO-005 models on NEM-003 personas, on staging |
| Parameterised financial model | This document's formulas with measured inputs, reviewed by accounting |
| Product-line revenue tagging | Per-line payment records (shared with PO-022 assessment M-D and settlement IG-02) |
| Noetia+ billing design | Multi-item subscription, per-item entitlements, cascade cancellation, webhook multi-line handling — after Q-E1, Q-E12, Q-E14 |
