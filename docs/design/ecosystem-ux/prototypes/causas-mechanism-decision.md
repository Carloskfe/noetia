# Causas Noetia — Distribution-Mechanism Decision Recommendation

> **SUPERSEDED — final policy approved by the Product Owner on 2026-11-12: [PO-053](../../../operating-framework/decisions/product-owner/PO-053-causas-noetia-distribution-policy.md).**
> - **One cause per user**, receiving 100% of that payment's 2.22% allocation.
> - **No selection** means an equal, deterministic split across all three causes.
> - **No other options.**
>
> The M2 recommendation below (up to two causes, or an equal split across three) is **not** the approved policy. §1–§4 are kept unchanged as the historical analysis that preceded the decision. The alignment of code and documents is planned in [causas-policy-alignment-plan.md](causas-policy-alignment-plan.md).

**Original status (before PO-053):** recommendation for the Product Owner; no mechanism selected. The 2.22% commitment and the three priorities are PO-confirmed and unchanged. Prepared under the Visual Design Phase authorization (2026-11-12).

## 1. Confirmed facts (Product Owner)

- 2.22% of every payment is an established financial commitment.
- No sales have occurred, so no sales-funded contributions have been made yet.
- Causas Noetia stays on the homepage.
- The three priorities are animal welfare, children and youth, and environment.

## 2. What the product says and does today (VERIFIED, `main@6a5e5c0`)

| Surface | Mechanism described or implemented | Source |
|---|---|---|
| Landing | "**You choose the cause**" / "Tú eliges la causa" (singular) | `services/web/app/LandingContent.tsx:237-240` |
| `/causas` page | "choose **up to two** strategic lines… or distribute your contribution **randomly** across all three" | `services/web/app/causas/page.tsx:74-75` |
| Cause selector (pricing) | Pick up to 2 causes **or** "Distribuir aleatoriamente", whose description says the 2.22% is "split **equally** among the three causes" | `services/web/components/CauseSelector.tsx:68,79,110-121` |
| API data model | `cause1Id`, `cause2Id` (both optional) + `randomDistribution: boolean` | `services/api/src/causes/dto/*.ts`; `user-cause-preference.entity.ts:15-25` |
| Allocation or payout | **None found.** No ledger or calculation links payments to causes (subscriptions and webhooks don't reference causes) | `services/api/src/causes/*`, `services/api/src/subscriptions/*` |
| Business plan | 2.22% → Causas Noetia in the revenue split (sums to 100%). Cause names listed as **Environment, Education, Health**, which differ from the confirmed priorities | `docs/business/{en,es}/01-*.md:47,186` |
| Terms of Service | "2,22 % de cada pago" | `services/web/lib/legal/terms-of-service.ts:44` / `:141` |

## 3. Inconsistencies to resolve

1. **Singular vs plural choice:** the landing page says one cause; the `/causas` page, the selector and the data model allow up to two.
2. **"Random" vs "equal":** the selector labels the option "random" but describes it as an equal split. Random and equal are different mechanisms.
3. **Two-cause split undefined:** no ratio is stated anywhere (50/50 is implied, but not written).
4. **Default undefined:** what happens to a user who never opens the selector isn't stated.
5. **Base wording:** "purchase/compra" (landing) vs "payment/pago" (Terms, business plan, billing, selector).
6. **Business-plan cause names** differ from the confirmed priorities.
7. **Execution tense:** "supports", "has operated from day one" and "donado automáticamente" (milestones) describe contributions that haven't occurred (no sales yet).

## 4. Options

| | M1 — Single choice | M2 — Up to two, or equal across three (closest to the implemented model) | M3 — Fixed equal split for everyone |
|---|---|---|---|
| User message | "Elige una causa." | "Elige hasta dos causas o reparte por igual entre las tres." | "Tu aporte se reparte por igual entre las tres causas." |
| Matches current data model | partially (`cause2Id` unused) | **yes** (replace "random" with "equal") | no (preferences ignored) |
| Matches current UI | landing only | `/causas` and selector (after the random/equal fix) | none |
| Allocation clarity | simple | needs a stated two-cause ratio (e.g., 50/50) and a default | simplest; most auditable |
| User agency | medium | **high** | none |
| User-facing effort (copy / UI) | copy + selector change | copy only (labels, two-cause ratio, default) | copy + selector removal |
| Allocation, payout and audit effort (all options) | **Engineering and finance work required.** Today no allocation, payout or reporting exists (§2). Any option needs: a per-payment allocation calculation (incl. refunds and chargebacks), a contribution ledger, reconciliation with Stripe and accounting, audit trail and reporting of executed contributions, and controls on preference changes over time. M1 and M3 make the calculation simpler; M2 needs a two-cause ratio and a default | same | simplest calculation, but still needs the ledger and audit |
| Risk | contradicts the existing selector | low, once the ratio and default are defined | contradicts "Tú decides" messaging |

## 5. Option recommended for PO consideration (not selected) — SUPERSEDED by PO-053

**No mechanism is selected by this document.** For consideration: **M2, with three definitions added:**

- **(a)** Rename "Distribuir aleatoriamente" to **"Repartir por igual entre las tres"** / **"Split equally across all three"**. Equal, not random, is deterministic and auditable.
- **(b)** When two causes are chosen, the split is **50/50**.
- **(c)** **Default** for users without a preference: equal across all three.

Then use one sentence everywhere: landing, `/causas`, selector and, after legal review, the Terms.

> ES: "Destinamos el 2,22% de cada pago a Causas Noetia. Puedes elegir hasta dos causas o repartirlo por igual entre las tres."
> EN: "We commit 2.22% of every payment to Causas Noetia. You can choose up to two causes or split it equally across all three."

**Commitment-vs-execution wording** (applies to every option):
- ES: "Forma parte del modelo financiero de Noetia desde el primer día."
- EN: "It has been part of Noetia's financial model from day one."

Avoid "apoya / supports" in the present tense and "donado" until contributions exist. Once they do, publish actual amounts.

**Effort correction (PA review of `7bdc013`):** the earlier "copy only" assessment applied only to user-facing wording. The final allocation and payout behaviour, under any option, requires accounting logic and auditability controls (row "Allocation, payout and audit effort" in §4). That work is not designed here and needs its own authorization.

**Required before publishing:**
- the PO selects the mechanism;
- the PO authorizes correcting the business-plan cause names;
- legal review of any Terms wording;
- (separately) allocation, ledger, reconciliation and audit design, so that executed contributions can be calculated and reported. Not designed here. No financial policy, percentage, business plan or payment service is changed by this document.

**Prototype treatment:** the homepage prototype shows the commitment sentence and a labelled placeholder "[Mecanismo de distribución — pendiente de decisión del PO (LPD-6)]".
