# NOF-003 — Commercial Viability Audit, Phase 1

**Date:** 2026-10-30 · **Nature:** read-only repository audit; documentation-only findings. No code, schema, Stripe, staging, or production change. No Product Owner decision record is altered. **No retail price is recommended** — that waits for market validation (§11).

**Evidence classes used throughout**

| Tag | Meaning |
|---|---|
| `POLICY` | Text of an approved Product Owner decision, quoted from its record |
| `CODE` | Read in the repository (file:line) |
| `PROD-OBS` | Observed in production by the 2026-10-29 subscription audit (public `GET /api/subscriptions/plans`) — not re-observed today |
| `DOC-EST` | An estimate written in a business document — **not** a measurement |
| `ASSUMPTION` | Illustrative input chosen for this analysis, replaceable |
| `MISSING` | No evidence exists; measurement method given in §10 |

**There are no `MEASURED` costs in this audit.** No invoice, Stripe balance report, monitoring export, or usage dataset is in the repository, and this audit had no production access.

---

## 1. Principal findings

1. **At 100% redemption, every token product leaves Noetia exactly 45% of gross before costs** (`POLICY` PO-007/010/011/012). After an illustrative card fee, that is **38.8%–41.9%** of the charge. Product mix changes *absolute* dollars and the per-redemption creator payout — not Noetia's share.
2. **What Noetia has left per month is small in absolute terms:** Individual monthly **$3.48**, Individual annual **$2.92**, Duo monthly $5.59, Family monthly $7.69 (per subscription, before delivery, support, fixed costs, taxes). **Per seat**, Family is the thinnest: **$1.54 monthly, $1.26 annual**.
3. **No operating cost has ever been measured.** The only cost evidence is a business-plan estimate (VPS ~$25/mo, fixed infrastructure "< $50/mo"); people, support, legal, and marketing costs are absent.
4. **The business plan's LTV:CAC (7–12:1) is computed on revenue.** On contribution (Individual monthly, the plan's own 5% churn), LTV is **$69.70**, and LTV:CAC against its own $15–25 CAC estimate is **2.8–4.6:1**, with a CAC payback of **4.3–7.2 months** — before delivery and fixed costs.
5. **The commercial model in production is not the approved model.**
   - `SubscriptionGuard` still lets any active, trialing, or canceling subscriber and every linked member read **any** paid book without owning it (`CODE` `subscription.guard.ts`, `main` and `release/acquisition-a`; ownership-only enforcement is NEM-013, not built).
   - **Consequences:** delivery costs are incurred on reads that create **no creator obligation**; redemption behaviour observed today **cannot** be used to estimate `r`; PO-021's "access = ownership" is not true in production.
6. **Production prices match no approved source.**
   - Production shows Individual **$9.99 / $89.00** and "Dual Reader" **$14.99 / $135.00** (`PROD-OBS`), because migration 039 matches zero rows (`CODE`).
   - PO-006 says $8.99/$83.99 and $13.99/$129.99. The Terms of Service say $80.99/$125.99/$170.99 annual. Stripe's charged amounts are **unverified** (IG-01).
7. **The 14-day trial issues `'paid'` tokens at $0 consideration** (`CODE` `subscriptions.service.ts:216`, `webhooks.service.ts:141`, `subscriptions.service.ts:303`; runtime unverified). A trial user can redeem, cancel, and keep a paid book permanently (PO-021). Under PO-010 the creator basis is **$0**; if it were settled at list price, Noetia would owe **$4.05** with no revenue. Either outcome needs a decision.
8. **Refunds, chargebacks, and taxes are unimplemented.**
   - No `charge.refunded` / dispute handling (`CODE` `webhooks.service.ts:56-72`).
   - No Stripe Tax, and USD only (`CODE` `subscriptions.service.ts:243`).
   - At an illustrative $15 dispute fee, **one chargeback erases 4.3 months** of an Individual subscriber's contribution.
9. **Family token allocation conflicts:** code issues **4** tokens per cycle, PO-010's illustration assumes **3**. Noetia's share is unchanged, but the creator payout per redemption falls from $2.85 to $2.14 (monthly) and from $2.25 to $1.69 (annual), and the number of books to deliver rises by a third.
10. **Viability: CONDITIONAL / UNPROVEN.** The allocation policy leaves positive unit contribution on the web channel. Whether that covers delivery, support, fixed costs, taxes, and acquisition **cannot be determined** from the evidence in the repository.

## 2. Verified price and allocation matrix

### 2.1 Price sources

| Source | Individual mo / yr | Duo mo / yr | Family mo / yr · seats · tokens | Packs 1 / 3 / 5 / 10 | Tag |
|---|---|---|---|---|---|
| **PO-006** (`nem-009-resilience-impl`) | **$8.99 / $83.99** | **$13.99 / $129.99** | **$18.99 / $179.99** · seats `CONFLICTING` (C-02) | not covered | `POLICY` |
| PO-010 §1 illustration | 1 token | 2 tokens | **3 tokens** | §2 formula only | `POLICY` (illustrative) |
| Migration `1714000000039` | $8.99 / $83.99 | $13.99 / $129.99 | $18.99 / $179.99 · 5 · **4** | $9.99 / $24.99 / $39.99 / $74.99 | `CODE` (intent) |
| Migration `1714000000010` (seed) | $9.99 / $89.00 ("Individual Monthly/Annual") | $14.99 / $135.00 ("Dual Reader") | — | — | `CODE` |
| **Production display** | **$9.99 / $89.00** | **"Dual Reader" $14.99 / $135.00** | $18.99 / $179.99 · 5 · 4 | $9.99 / $24.99 / $39.99 / $74.99 | `PROD-OBS` |
| **Stripe charged amount** | ? | ? | ? | ? | `MISSING` (IG-01) |
| Terms of Service (`terms-of-service.ts:122-124`) | $8.99 / **$80.99** | $13.99 / **$125.99** · "up to 2" | $18.99 / **$170.99** · "up to 4" | not listed | `CODE` (public) |
| Pricing page metadata (`pricing/layout.tsx:6`) | "desde **$9.99**/mes" | — | — | — | `CODE` (public) |
| Mobile copy (`mobile/src/i18n/en.ts:104-106`) | $8.99 | $13.99 · "up to 2" | $18.99 · "4 shared tokens" · "up to 5" | — | `CODE` (public) |
| Business plan (`01-business-plan.md:166-168`) | $8.99 / $89.99 | $13.99 / $139.99 | $18.99 / $189.99 | $3.99 / $9.99 / $14.99 / $29.99 (audit) | `DOC-EST`, `SUPERSEDED BY PO-006` |
| Per-title purchase (`subscriptions.service.ts:242-244`) | `book.priceCents`, inline `price_data` | | | | `CODE`; PO-021 Amendment 1 (B-1) makes acquisition token-only — unmerged |

### 2.2 Allocation and timing (approved policy)

| Allocation | Share | Arises at | Source |
|---|---|---|---|
| Causas Noetia | 2.22% | **payment** (qualifying collected revenue) | PO-007, **PO-011** |
| Marketing | 7.78% | **payment** | PO-007, **PO-012** |
| Author / Publisher | 36% | **qualifying redemption** | PO-007, PO-008, PO-012 |
| Narrator | 9% | **qualifying redemption** | PO-007, PO-008, PO-012 |
| Noetia | 45% | — | PO-007 |
| Breakage residual | creator 45% of unredeemed tokens | expiry | PO-012 — "retained economic value", **never profit** |
| Token basis | period price ÷ tokens issued; package price ÷ tokens | issuance | PO-010 §1–2 |
| Discounts | actual consideration; ambiguous bundles pre-allocated or excluded | — | PO-010 §3, PO-013 |
| Promotional / courtesy tokens | **no creator allocation** | — | PO-007 scope, PO-010 §3 |

### 2.3 Token rules bearing on economics (`POLICY` PO-024, unmerged PR #17)

| Token | Expiry | Giftable | Economic effect |
|---|---|---|---|
| Subscription (all plans) | 90 days from own issuance; accumulate | No | ≤ 3 live per Individual subscriber → creator exposure ≤ **$12.14** after cancellation |
| 1-token purchase | 90 days | Yes | — |
| 3/5/10 packages | **6 calendar months** | Yes | Longer liability window |
| Gifted token | **90 days from gift date**; not re-giftable | — | A package token gifted late can extend the obligation window beyond 6 months |
| Promotional | 30 days (`C-06`: inferred, not confirmed) | — | No creator allocation |

## 3. Contribution per product at 100% redemption

Formula per charge `x` with `t` tokens (`fee(x) = 0.029x + $0.30` — `ASSUMPTION`, from NOF-002; Noetia's actual Stripe rate is `MISSING`):

```
Causas = 0.0222x   Marketing = 0.0778x   Creators = 0.45x   Noetia gross = 0.45x
Noetia after fee = 0.45x − fee(x)            (before delivery D, support, fixed F, taxes)
```

| Product | Price | Tokens | Basis/token | Creators (45%) | Noetia gross | Fee | Fee % | **Noetia after fee** | % | **Per month** | **Per seat-month** |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Individual monthly | $8.99 | 1 | $8.9900 | $4.0455 | $4.0455 | $0.5607 | 6.24% | **$3.4848** | 38.76% | **$3.4848** | $3.4848 |
| Duo monthly | $13.99 | 2 | $6.9950 | $6.2955 | $6.2955 | $0.7057 | 5.04% | **$5.5898** | 39.96% | **$5.5898** | $2.7949 |
| Family monthly | $18.99 | 3 (PO-010) / 4 (code) | $6.3300 / $4.7475 | $8.5455 | $8.5455 | $0.8507 | 4.48% | **$7.6948** | 40.52% | **$7.6948** | **$1.5390** (5 seats) |
| Individual annual | $83.99 | 12 | $6.9992 | $37.7955 | $37.7955 | $2.7357 | 3.26% | $35.0598 | 41.74% | **$2.9216** | $2.9216 |
| Duo annual | $129.99 | 24 | $5.4163 | $58.4955 | $58.4955 | $4.0697 | 3.13% | $54.4258 | 41.87% | **$4.5355** | $2.2677 |
| Family annual | $179.99 | 36 / 48 | $4.9997 / $3.7498 | $80.9955 | $80.9955 | $5.5197 | 3.07% | $75.4758 | 41.93% | **$6.2896** | **$1.2579** |
| Pack 1 | $9.99 | 1 | $9.9900 | $4.4955 | $4.4955 | $0.5897 | 5.90% | **$3.9058** | 39.10% | — | per token $3.9058 |
| Pack 3 | $24.99 | 3 | $8.3300 | $11.2455 | $11.2455 | $1.0247 | 4.10% | **$10.2208** | 40.90% | — | per token $3.4069 |
| Pack 5 | $39.99 | 5 | $7.9980 | $17.9955 | $17.9955 | $1.4597 | 3.65% | **$16.5358** | 41.35% | — | per token $3.3072 |
| Pack 10 | $74.99 | 10 | $7.4990 | $33.7455 | $33.7455 | $2.4747 | 3.30% | **$31.2708** | 41.70% | — | per token $3.1271 |

**If Stripe charges what production displays** (`PROD-OBS`, unverified): Individual $9.99 → $3.9058/mo; Individual annual $89.00 → $3.0974/mo; Dual Reader $14.99 → $6.0108/mo; Dual Reader annual $135.00 → $4.7112/mo.

**Reading the table**
- Noetia's share is invariant at 45% gross; the fee's fixed $0.30 is the only thing that differs, so small charges (1-token pack, Individual monthly) carry the highest fee percentage.
- **Token count does not change Noetia's dollars** — it changes the creator payout per book and the **number of books Noetia must deliver**. Family with 4 tokens delivers 33% more books for the same money.
- **Per-seat contribution** is the binding figure for delivery cost, because streaming cost scales with active listeners, not subscriptions. Family annual leaves **$1.26 per seat-month**.
- **Noetia+** (incremental and combined) is analysed in [PR #18](https://github.com/Carloskfe/noetia/pull/18) — conservative case at $14.99: **$6.91** with two charges / **$7.21** with one, before unmeasured costs, fixed overhead, and taxes.

## 4. Monthly vs annual

| Plan | 12 × monthly | PO-006 annual | Discount | ToS annual | ToS discount | Production annual | Prod. discount | Business plan claims |
|---|---|---|---|---|---|---|---|---|
| Individual | $107.88 | $83.99 | **22.1%** | $80.99 | 24.9% | $89.00 | 17.5%¹ | "16–17% savings" (`01-business-plan.md:382`) |
| Duo | $167.88 | $129.99 | **22.6%** | $125.99 | 25.0% | $135.00 | 19.6%¹ | 16.6% at $139.99 |
| Family | $227.88 | $179.99 | **21.0%** | $170.99 | 25.0% | $179.99 | 21.0% | 16.6% at $189.99 |

¹ Against production's own monthly ($9.99 / $14.99): Individual 25.8%, Dual Reader 24.9%.

**Economic effect of annual (PO-006 prices, per month):** Individual $3.48 → **$2.92 (−16.2%)**; Duo $5.59 → $4.54 (−18.9%); Family $7.69 → $6.29 (−18.3%). The fee saving (one charge a year) recovers only part of the discount. Annual also brings 12 months of cash up front with a **deferred token obligation** (`ACCOUNTING REVIEW REQUIRED`) and, under "no partial refunds" (ToS), no refund exposure on cancellation — but see the annual-drip defect: the drip skips `canceling` subscriptions (PO-024 assessment T-5), so a cancelling annual subscriber can receive **fewer** tokens than paid for.

## 5. Payment processing, refunds, chargebacks, taxes

| Item | Implementation | Economic exposure (Individual monthly) | Tag |
|---|---|---|---|
| Card fee | Stripe; rate not recorded | 6.24% at 2.9% + $0.30; at 4.4% + $0.30 (international cards, illustrative) Noetia after fee falls to **$3.3499** | `ASSUMPTION` |
| Refund | **Not handled** (no `charge.refunded`); ToS: only for proven technical failure | Full refund **after** redemption: Noetia returns $8.99, the fee is typically not returned, the creator obligation $4.0455 survives if PO-008 is read literally, and Causas/Marketing $0.899 stand unless reversed → **−$4.61 to −$5.51** | `CODE`, `ASSUMPTION` (fee retention), refund policy `MISSING` |
| Chargeback | **Not handled** | Dispute fee (illustrative **$15**, Stripe's published US rate — verify) = **4.3 months** of contribution, plus the refund effect above | `ASSUMPTION` |
| Tax | **No Stripe Tax; USD only** | Tax-inclusive (illustrative): 16% → Individual **$2.93**/mo, Family $6.52; 19% → $2.84 / $6.33 | `MISSING` regime |
| App stores | Mobile opens web pricing (`PaywallScreen.tsx:60`); no IAP | If in-app billing were required, NOF-002 F-1: commission alone leaves Noetia ~15% of gross at full redemption | Policy/legal `MISSING` |
| Trial | 14 days hard-coded (`subscriptions.service.ts:216`); ToS: "when available" | `'paid'` tokens at $0; permanent book ownership possible at $0 (finding 7); 14 days of all-access streaming at $0 (finding 5) | `CODE` |

## 6. Delivery, streaming, storage, hosting, infrastructure

| Cost | Evidence | Status |
|---|---|---|
| VPS (Contabo Cloud VPS 30: 8 vCPU, 24 GB, 400 GB, 600 Mbit/s, unlimited traffic) | "~$25/mo" (`01-business-plan.md:450`) | `DOC-EST` — invoice not seen |
| Total fixed infrastructure | "< $50/mo" (`01-business-plan.md:455`) | `DOC-EST` |
| Email (Resend free tier), DNS, EAS ($0–29) | `01-business-plan.md:451-454` | `DOC-EST` |
| Offsite backup | $0 now; paid object storage ~$1–5/mo deferred (`resilience/cost-and-maturity-plan.md:35`) | `DOC-EST` |
| Audio bandwidth | Self-hosted MinIO on a VPS with unlimited traffic → near-zero **marginal** cost until the 600 Mbit/s port or disk saturates, then a **step cost** (a second server/CDN) | Bitrate, concurrency, audio hours per user `MISSING` |
| Staging | Colocated on the same VPS (`noetia_staging`) | Shares capacity, $0 incremental |
| Monitoring, search, cache | Self-hosted on the VPS | Included in VPS |
| AI (Noetia+) | Not built; $1.50/mo target (PO-001) | See PR #18 |
| People, support, legal, accounting | **Absent** from every document except the publisher-licence legal estimate ($3,000–8,000 one-off, `01-business-plan.md:256`) | `MISSING` — almost certainly the dominant cost |

**Implication:** at current scale the delivery cost per subscriber is plausibly small, because the server is a fixed cost. The unit question is really **when capacity runs out** (step costs), and **what people cost**. Neither is documented.

## 7. Sensitivity scenarios

**7.1 Processing fees** (Noetia after fee, per month)

| Product | 2.9% + $0.30 | 4.4% + $0.30 |
|---|---|---|
| Individual monthly | $3.4848 | $3.3499 |
| Individual annual | $2.9216 | $2.8167 |
| Family monthly | $7.6948 | $7.4099 |
| Pack 1 (per token) | $3.9058 | $3.7559 |

**7.2 Taxes** (tax-inclusive pricing, allocations on net-of-tax revenue — basis `MISSING`)

| Product | t = 0 | 16% | 19% |
|---|---|---|---|
| Individual monthly | $3.4848 | $2.9268 | $2.8389 |
| Individual annual (per month) | $2.9216 | $2.4872 | $2.4188 |
| Family monthly | $7.6948 | $6.5161 | $6.3304 |
| Pack 1 | $3.9058 | $3.2857 | $3.1880 |

**7.3 AI usage** — Noetia+ only; see PR #18 §7C (break-even AI $4.926 at a $6.00 planning price with 10% allocations).

**7.4 Operating cost per subscriber `D`** (`ASSUMPTION` grid; Individual monthly)

| D per subscriber-month | $0 | $0.25 | $0.50 | $1.00 | $2.00 | $3.48 |
|---|---|---|---|---|---|---|
| Unit contribution | $3.48 | $3.23 | $2.98 | $2.48 | $1.48 | **$0 (break-even)** |

**7.5 Redemption** — fixed at 100% by instruction. For reference, breakage would raise Noetia's *retained value* (never profit, PO-012); it is not counted.

## 8. Break-even formulas and subscriber-volume scenarios

```
unit_op(p)        = 0.45·x_p − fee(x_p)  [per month]  − D_p − S_p − tax_p
monthly_net       = Σ_p N_p · unit_op(p) − F − CAC_spend
break-even N      = F ÷ weighted unit_op
CAC payback (mo)  = CAC ÷ unit_op
LTV (contribution) = unit_op ÷ monthly churn
```

**Subscribers needed to cover fixed cost F** (no CAC; `F` values are `ASSUMPTION` levels except the $50 business-plan estimate):

| F per month | Individual monthly, D = 0 | D = $0.25 | D = $0.50 | D = $1.00 | Individual annual | Family monthly |
|---|---|---|---|---|---|---|
| $50 (`DOC-EST` infra only) | 14 | 15 | 17 | 20 | 17 | 6 |
| $1,000 | 287 | 309 | 335 | 402 | 342 | 130 |
| $5,000 | 1,435 | 1,546 | 1,675 | 2,012 | 1,711 | 650 |
| $20,000 | 5,739 | 6,183 | 6,701 | 8,049 | 6,845 | 2,599 |

**Acquisition (business-plan inputs, all `DOC-EST`):** churn 5%/mo, blended CAC $15–25 (`01-business-plan.md:191-193`).

| Metric | Business plan | On contribution (Individual monthly, D = 0) |
|---|---|---|
| LTV | $179.80 (revenue) | **$69.70** |
| LTV:CAC | 7–12:1 | **2.8–4.6:1** |
| CAC payback | — | **4.3–7.2 months** |

## 9. Contradictions — decisions, implementation, Stripe, public pricing

| # | Contradiction | Sources | Severity |
|---|---|---|---|
| K-1 | Production prices ≠ PO-006 (migration 039 matches zero rows) | `PROD-OBS`, `CODE`, PO-006 | HIGH |
| K-2 | Stripe charged amounts unverified | IG-01 | HIGH |
| K-3 | ToS annual prices ($80.99/$125.99/$170.99) ≠ PO-006 ≠ production | `terms-of-service.ts:122-124` | HIGH (public, contractual) |
| K-4 | Pricing-page metadata "desde $9.99/mes" ≠ PO-006 $8.99 | `pricing/layout.tsx:6` | MEDIUM |
| K-5 | Family tokens: code 4 vs PO-010 illustration 3 | migration 039, PO-010 | HIGH (creator payout basis) |
| K-6 | Family seats: code 5, ToS 4, PRD 6 | C-02 | HIGH (unresolved) |
| K-7 | **All-access streaming** for subscribers vs PO-021 ownership access | `subscription.guard.ts` | **CRITICAL** — the economic model in production is not the approved one |
| K-8 | **Trial tokens typed `'paid'` at $0** vs PO-010 actual consideration | `subscriptions.service.ts:216,303`, `webhooks.service.ts:141` | HIGH |
| K-9 | Per-title purchase still live vs PO-021 Amendment 1 (token-only) | `subscriptions.service.ts:242` | MEDIUM (unmerged decision) |
| K-10 | ToS "tokens valid 90 days" vs PO-024 (6 months for 3/5/10 packs) | ToS, PO-024 | MEDIUM |
| K-11 | ToS "2.22% of **every** payment" vs PO-022 leaving Noetia+ pending | ToS, PO-022 | MEDIUM |
| K-12 | Business-plan annual "16–17% savings" vs PO-006's 21–23% | `01-business-plan.md:382` | LOW (superseded doc) |
| K-13 | Business-plan LTV:CAC uses revenue, not contribution | `01-business-plan.md:192-194` | MEDIUM (decision risk) |
| K-14 | ToS "free trial when available" vs a hard-coded 14-day trial | ToS, `subscriptions.service.ts:216` | MEDIUM |
| K-15 | Annual drip skips `canceling` subscriptions | PO-024 assessment T-5 | MEDIUM |
| K-16 | No refund, dispute, or tax implementation vs PO-008/011 accounting review markers | `webhooks.service.ts` | HIGH |
| K-17 | Promotional/courtesy redemptions of paid books create no creator allocation; referral plan gives free tokens | PO-007 scope, `01-business-plan.md:365` | MEDIUM (rights/licensing question) |

## 10. Missing financial measurements — prioritized, with method

| P | Measurement | Why it matters | Method (read-only) |
|---|---|---|---|
| **1** | **Stripe price objects** — amount, interval, currency, live/test mode, per price ID | Every figure depends on what is actually charged (K-1/K-2) | Stripe Dashboard or a read-only restricted key: list Prices for the configured IDs; record amounts, never secrets |
| **2** | **Actual Stripe fee rate and card mix** | Fee is 3–6% of every charge | Stripe balance-transaction export: fee ÷ amount, by card country |
| **3** | **People and operating cost F** (founder time, contractors, support, legal, accounting) | Probably the dominant cost; break-even depends on it | PO-provided budget; accounting ledger |
| **4** | **VPS and service invoices** | Replaces `DOC-EST` | Contabo, EAS, domain invoices |
| **5** | **Delivery cost and capacity:** audio bitrate, audio hours per active user, peak concurrent streams, egress bytes | Determines when step costs arrive; per-seat cost for Family | Prometheus/node-exporter network TX, MinIO metrics, `stats` heartbeat minutes per user |
| **6** | **Redemption behaviour under ownership-only access** | `r` is meaningless while all-access streaming exists (K-7) | Measure after NEM-013, from `token_ledger` redemption vs issuance |
| **7** | **Tax regime and markets** | 16–19% lower contribution in tax-inclusive markets (illustrative 16–19% VAT) | Tax advisor; customer country distribution from Stripe |
| **8** | **Refund and chargeback rates** | One chargeback ≈ 4 months of contribution | Stripe disputes and refunds report |
| **9** | **Churn, trial conversion, trial-redemption abuse** | LTV, payback; finding 7 | Subscription status history; tokens redeemed during trial |
| **10** | **CAC by channel** | LTV:CAC is the business plan's main claim | Spend ÷ attributed sign-ups (UTM, referral codes) |
| **11** | **Plan and channel mix** | Weighted unit contribution | Active subscriptions by plan/interval |
| **12** | **Noetia+ AI cost** | PR #18 viability | AI benchmark mission on staging (PR #18 §13) |

## 11. Recommendation for the next market-validation phase (no prices recommended)

**Prerequisites before any market test produces usable data**
1. Reconcile what is charged: verify Stripe (P1) and align production and the ToS to whichever price the PO confirms — a separate, authorized mission.
2. Enforce ownership-only access (NEM-013), or results on redemption and value will measure an all-access product that is not the approved one.
3. Decide trial token treatment (K-8) and instrument refunds/disputes (K-16).

**Phase 2 — measure, don't assume (read-only, low cost)**
- Collect measurements P1–P5 and P8–P11 for the existing beta base. Build the parameterised model (NOF-002's script plus this document's formulas) on measured inputs.

**Phase 3 — market validation design (for PO approval; no live price change implied)**
- **Willingness-to-pay research** before price tests: Van Westendorp / Gabor-Granger surveys of beta users and the waitlist, segmented by market (LATAM vs US) and household type.
- **Plan-mix validation:** is Family's $1.26–1.54 per seat-month acceptable once per-seat delivery is measured? Does a 4-token Family hold up?
- **Annual-discount test** on the measured monthly baseline (the 21–23% PO-006 discount costs 16–19% of monthly contribution).
- **Token-pack demand** among free accounts (PO-023) — the highest-margin product per token.
- **Noetia+ interest and price sensitivity** inside the $14.99 ceiling, before any Stripe price exists (PR #18).
- **Success criteria to define with the PO first:** target contribution after D, CAC payback ceiling, minimum LTV:CAC on contribution.

## 12. Unresolved questions for the Product Owner

| # | Question |
|---|---|
| V-1 | Which prices are canonical for production now: PO-006 or what production displays? (K-1–K-4) |
| V-2 | Family: 3 or 4 tokens per cycle; 4, 5 or 6 seats? (K-5, K-6) |
| V-3 | Trial: issue tokens during trial? If so, what basis and creator treatment? (K-8) |
| V-4 | Refund and chargeback treatment of creator, Causas, and Marketing allocations after redemption (PO-008/011/012 accounting review) |
| V-5 | Who bears payment fees in the PO-007 split? |
| V-6 | Tax: tax-inclusive or exclusive pricing; target markets; allocations on gross or net of tax? |
| V-7 | Operating budget F (people, support, legal) to use as the fixed-cost basis |
| V-8 | Are free promotional/referral tokens allowed to acquire paid books with no creator allocation? (K-17) |
| V-9 | Success thresholds for market validation (contribution, payback, LTV:CAC) |
| V-10 | Authorize Phase 2 measurement (read-only) — including a read-only Stripe price check |

## 13. Sources

PO-006, PO-007, PO-008, PO-010, PO-011, PO-012, PO-013 and NOF-002 (`creator-economics-stress-test.md`, `contradictions-and-gaps.md`) on `nem-009-resilience-impl` · PO-021–023 on PR #12 · PO-024 on PR #17 · Noetia+ economics on PR #18 · the 2026-10-29 subscription audit (production observations) · `services/api/src/migrations/1714000000010`, `…020`, `…039`, `…041` · `services/api/src/subscriptions/{subscriptions.service.ts, webhooks.service.ts, subscription.guard.ts}` · `services/web/lib/legal/terms-of-service.ts` · `services/web/app/(billing)/pricing/layout.tsx` · `services/mobile/src/i18n/en.ts` · `services/mobile/src/screens/PaywallScreen.tsx` · `docs/business/en/01-business-plan.md` · `docs/operating-framework/resilience/cost-and-maturity-plan.md`.
