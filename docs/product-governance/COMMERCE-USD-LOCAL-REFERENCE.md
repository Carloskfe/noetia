# USD-LOCAL-REFERENCE: USD transactions with informational local-currency equivalents

**Status:** **Final Product Owner policy.** Recorded 2026-11-22 from the PO mission "FR-CA Governance Alignment and USD Informational Currency Policy". A change needs a new, explicit PO decision.

**Relationship to existing decisions:** this addendum **extends** the PO decision *"USD as Noetia's commercial and financial currency"* (2026-11-13), recorded in `docs/product-governance/COMMERCE-DECISIONS.md` (Draft PR #74, not merged at the time of writing).
- It does **not** modify or reopen T-1, D1–D6, F-01 Option B, W-1/W-2 (COMMERCE-W1-W2), subscription, token, royalty or book-ownership decisions.
- **Precedence (corrected per PA review of PR #76):** the **latest explicit PO decision governs the specific matter it addresses**. This addendum is the latest PO decision on transaction currency and informational local-currency display, so it governs those matters. **All unrelated earlier commerce decisions remain fully in force.**

> **Decision status (PO decision update FR-CA-USD-P1-P2, 2026-11-22):**
>
> | | Decision | Status |
> |---|---|---|
> | **P-1** | CAD scope | **FINAL** (§3A) |
> | **P-2** | Currency-selection behaviour | **FINAL** (§3B) |
> | **P-3** | Legal clearance of Bank of Canada reference-rate reuse, and approval of customer-facing conversion disclosures | **PENDING** (§9) |
>
> **Until P-3 is granted, no CAD equivalents may be publicly displayed.** Every publicly displayed price shows the authoritative USD amount only.

**Authorization:** documentation only. Implementation, Stripe changes, payment activation, merge and deployment are **not authorized** by this record.

---

## 1. Rule

**USD is Noetia's exclusive transaction currency.** It applies to subscriptions, books, tokens, gifts and **every present or future commercial offering**, including Noetia+ and NoetiaX.

| | Authoritative USD price | Informational local equivalent |
|---|---|---|
| **What it is** | The price Noetia charges | An approximate conversion, shown for the customer's convenience |
| **Source** | Noetia's commerce configuration (plans, token packages, book prices, gift prices) and the Stripe objects they reference | A published reference exchange rate applied to the USD price |
| **Used for charging, invoicing, refunds, accounting, royalties, Causas, tokens and entitlements** | **Yes, exclusively** | **Never** |
| **Required on screen** | Always, wherever a price is shown | Optional; omitted when no fresh rate is available |
| **Can change what the customer pays** | Yes (it *is* what they pay) | No |

## 2. Authoritative USD prices

1. Every price, charge, Stripe Checkout amount, Stripe Price object, invoice, refund and accounting record is in **USD**, in integer US cents, as today.
2. Every displayed price is **explicitly marked as US dollars**, in every interface language (USD decision, rule 2; a bare `$` is not allowed):
   - EN: `US$8.99` (legal text: `$8.99 USD`)
   - ES: `US$8.99` (legal text: `$8,99 USD` per the existing Terms style)
   - FR-CA: `8,99 $ US` (Canadian French convention; PO example)
3. Displayed USD amounts are always read from the commerce configuration. **An example price in documentation or copy never replaces the configured price.**

## 3. Informational local-currency equivalents

1. **Optional, CAD only, by explicit user preference** (§3A, §3B), and **not publicly before P-3 clearance**: a screen may show an approximate CAD equivalent next to the authoritative USD price, **never instead of it**, and always visually subordinate to it.
2. **No alternative price:** an equivalent does not create a price, a quote, an offer or an entitlement. It does not modify tokens, royalties, subscriptions, Causas contributions or any commercial term.
3. **Always labelled as an estimate**, with the reference-rate publication date.
4. **Explicit currency marking for the equivalent too:** for example `≈ 12,88 $ CA`, never a bare `$`, which would collide with the USD rule. *(Engineering note: `Intl.NumberFormat('fr-CA', {currency: 'CAD'})` renders a bare `12,88 $`; the `CA` marker must be added explicitly.)*

## 3A. P-1: CAD scope (FINAL, PO 2026-11-22)

- **CAD is the only authorized informational currency for the initial French pilot.**
- Every actual price, charge, invoice, refund and financial record remains **USD**.
- **No other informational currencies are authorized.**

## 3B. P-2: currency-selection behaviour (FINAL, PO 2026-11-22)

1. **The default display is USD only.**
2. **CAD may be displayed only following an explicit user preference.**
3. **Currency preference is independent of interface language.** A user who selects English, Spanish or Canadian French can independently choose CAD.
4. **Currency preference never modifies Stripe Checkout or subscription currency.**
5. A **missing, invalid, stale or unavailable** reference rate produces **USD-only display**.
6. **No IP-based automatic currency selection.**

*Engineering notes for NEM-025 (not decisions):*
- Where the preference is stored is an implementation question: on the device for visitors, and on the account for signed-in users. Account storage would be a schema change, which needs NEM-025 schema authorization.
- The preference must never be read by any commerce module (§8.4).

## 4. Reference-rate sourcing

1. **Verifiable reference source only:** a published, publicly checkable rate from an identified institution, with its **publication date disclosed** to the user.
2. **CAD: the Bank of Canada is the candidate evaluated at the PO's request** (findings, 2026-11-22). CAD scope is now FINAL (P-1). **The source is not cleared: legal clearance is PENDING (P-3).**
   - daily average rates are published **once each business day by 16:30 ET**, and publication may be delayed;
   - available free through the Valet API (`https://www.bankofcanada.ca/valet/observations/FXUSDCAD/json?recent=1`), with **no API key** (tested: HTTP 200, observation 2026-11-20 = 1.4325 CAD per USD);
   - the Bank describes its rates as **"indicative rates only"**, "released for statistical and analytical purposes only and … not intended to be used as the benchmark rate for executing foreign exchange trades". This fits informational display, where Noetia executes no FX;
   - the Bank's Terms require **attribution** ("You must attribute the Bank of Canada as the source of the content, and indicate if changes were made") and contain a **paid-services clause** (§1.3), a request-limit clause (§3) and a third-party-content clause (§2.3; the rates are described as sourced from LSEG). **Legal confirmation of reuse on Noetia's pages is a prerequisite and is PENDING** (P-3, §9 U-1).
3. **Other currencies: not authorized (P-1 FINAL).** *Background only:* the Bank of Canada also publishes MXN, BRL, PEN and EUR as CAD rates, and does not publish COP, CLP or ARS. Any other informational currency would need a new PO decision.
4. **Never described as guaranteed or legally mandated.** No published reference rate is presented as the rate a customer will be charged, as a guaranteed rate or as a legally required conversion rate.

## 5. Freshness and unavailable rates

1. **Rate date shown:** the equivalent always states the publication date of the rate used.
2. **Stale or unavailable → no estimate:** if no rate can be obtained, or the most recent observation is **older than the freshness limit**, the screen shows **only the authoritative USD price**, with no estimate and no error to the user.
3. **Freshness limit:** an engineering parameter, to be fixed in NEM-025. It must tolerate normal gaps of weekends and statutory holidays (no publication) without showing an old rate after a real outage. Proposed: the most recent observation must be **no more than 5 calendar days old**.
4. **Fail toward USD:** any error in retrieving, parsing or validating a rate (non-numeric, zero, negative or implausible values) results in USD-only display.

## 6. User disclosures

> **Approval PENDING (P-3):** customer-facing conversion disclosures require approval. The FR wording below is the PO's example, and the EN/ES wording is a draft; neither is approved customer copy until P-3 is granted.

Wherever an equivalent is shown, the screen must:
1. **distinguish** the informational estimate from the actual USD charge;
2. state that **payment is made in US dollars**;
3. state that the **card issuer, bank or payment network may apply a different exchange rate and additional fees**;
4. name the **reference-rate source and publication date**.

**FR-CA (PO-approved example; the price is illustrative):**

> **Abonnement mensuel : 8,99 $ US**
> Environ XX,XX $ CA — estimation fondée sur un taux de référence publié le [date].
> *Le paiement est effectué en dollars américains (USD). Le montant en dollars canadiens est fourni à titre indicatif seulement. Le taux de conversion et les frais appliqués par votre institution financière peuvent varier.*

**EN and ES equivalents (draft, for PA/PO review; the price is illustrative):**

> **Monthly subscription: US$8.99**
> About CA$XX.XX — estimate based on a reference rate published on [date].
> *You are charged in US dollars (USD). The Canadian-dollar amount is for information only. Your financial institution's exchange rate and fees may differ.*

> **Suscripción mensual: US$8.99**
> Aproximadamente XX,XX $ CA — estimación basada en un tipo de cambio de referencia publicado el [fecha].
> *El cobro se realiza en dólares estadounidenses (USD). El monto en dólares canadienses es solo informativo. El tipo de cambio y las comisiones de tu institución financiera pueden variar.*

Source attribution (for example *"Taux de référence : Banque du Canada"* / *"Reference rate: Bank of Canada"*) is part of the disclosure, subject to §4.2 and the legal check.

## 7. Prohibited

- Charging, invoicing or refunding in any currency other than USD.
- Creating non-USD Stripe Price objects, Checkout currencies, multi-currency presentment, Adaptive Pricing or FX settlement.
- Using a converted amount as, or to derive, a charge, a refund, a token quantity, a royalty, a Causas amount, a discount or any entitlement.
- Showing an equivalent **without** the USD price, **without** the estimate label and date, or with a bare `$`.
- Presenting a reference rate as guaranteed, binding or legally mandated.

**None of the following is approved by this policy:** additional payment currencies, Stripe price objects, FX settlement or financial activation.

## 8. Safeguards that keep equivalents out of transaction amounts (requirements for implementation)

1. **Presentation-only:** equivalents are computed only in the display layer, or in a read-only, display-only endpoint. The result is a **formatted string or a display object**, never a value stored in, or passed to, any commerce module.
2. **Server-side amounts only:** checkout continues to use **server-side** prices only (Stripe Price IDs for plans and token packages; `book.priceCents` and the gift price table for ad-hoc USD amounts). No checkout endpoint accepts an amount or currency from the client. *(Today the global `ValidationPipe({ whitelist: true })` strips unknown DTO fields; that must be kept.)*
3. **Hard-coded `usd`:** every Checkout `price_data.currency` stays `'usd'`. Any webhook amount or currency verification (W-2) continues to compare against USD.
4. **Module isolation:** neither the rate module **nor the user's currency preference** is imported or read by the subscription, gift, webhook, token, royalty or Causas modules, and this is enforced by a test.
5. **Tests prove** that rate availability, staleness or value has **no effect** on any Stripe call parameter or ledger entry (see the report's test list).

## 9. Open items and decision log

| # | Item | Owner |
|---|---|---|
| U-1 (P-3) | **PENDING. Legal-source clearance:** that showing Bank of Canada-derived equivalents with attribution on Noetia's pages is permitted under the Bank's Terms (§1.1, §1.3, §2.3 LSEG third-party content, §3 request limits), and review of the FR/EN/ES disclosure copy | PO / legal |
| U-2 (P-1, P-2) | **DECIDED (FINAL, 2026-11-22):** CAD only; USD default; CAD only by explicit user preference, independent of interface language; no IP-based selection (§3A, §3B) | PO |
| U-3 | **CLOSED by P-1:** no other informational currencies are authorized, so COP, CLP, ARS and any other currency get no estimate | PO |
| U-4 | The exact freshness limit (proposed 5 calendar days) | NEM-025 / PA |
| U-5 (P-3) | **For PA:** P-3 says "no CAD equivalents may be **publicly** displayed" before clearance. Whether a **non-public** display (private pilot or staging) is permitted before clearance is **not assumed**; it is treated as not permitted until PA/PO confirm | PA / PO |
