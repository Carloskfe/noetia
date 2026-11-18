# Terms of Service §3 "Causas Noetia": Legal-Gate Diagnostic and Change Specification

**Status:** SPECIFICATION ONLY. The Terms of Service have **not** been edited. This document is **not legal advice** and records **no approval**.
**Authority:** PO publication-boundary decision, 2026-11-18, decision 4.
**Gate:** this reconciliation is a **hard prerequisite before payments can be activated**: API `PAYMENTS_ENABLED=true` and web `PURCHASES_AVAILABLE = true`. It is **not** a prerequisite for the information-only PR #59 release.
**Implementation path:** a separate, legal-gated Draft PR. Counsel review plus explicit PO authorization are required before it is merged or published.

## 1. Published source

The source below is verified identical on `main@a67afbd` and PR #59.
- **File:** `services/web/lib/legal/terms-of-service.ts`, rendered at `/legal/terms` by `services/web/app/(legal)/legal/terms/page.tsx`.
- **Live check:** `GET https://noetia.app/legal/terms` returned 200 on 2026-11-18, with the wording below and "Última actualización: 4 de junio de 2026 / June 4, 2026". The date comes from `LAST_UPDATED` in `cookie-policy.ts`, which the Terms share today.
- **Elsewhere:** mobile and the API contain no Causas legal text.

| Lang | Lines | Published wording |
|---|---|---|
| ES | 42–44 | `### Causas Noetia` — "El **2,22 % de cada pago** se destina automáticamente a causas sociales y medioambientales seleccionadas por Noetia. Al suscribirte, autorizas esta distribución." |
| EN | 139–141 | `### Noetia Causas` — "**2.22% of every payment** is automatically allocated to social and environmental causes selected by Noetia. By subscribing, you authorise this distribution." |
| ES / EN | 40 / 137 | Refunds: "se considerarán reembolsos en caso de fallo técnico demostrado imputable a Noetia…" / "refunds will be considered in the event of a proven technical failure attributable to Noetia…". No mention of the Causas share |

## 2. Conflicts with the approved policy (C-1…C-7)

| Rule | Terms say | Finding |
|---|---|---|
| C-1: 2.22% of eligible receipts after payment-processing fees | "2.22% of every payment" | Conflict: wrong base and scope |
| C-2: calculated and settled monthly | "automatically allocated" | Conflict by implication (reads as immediate, per payment) |
| C-3: refunded before settlement → excluded | Silent | Gap |
| C-4: refunded after settlement → Noetia absorbs | Silent | Gap |
| C-5: independent third-party charitable organizations | "causes selected by Noetia" | Conflict / gap |
| C-6: no partnership signed; nothing implied | Present tense; reads as an operating program | Conflict |
| C-7 (PO-053): one user-selected cause, else equal split across three | "selected by Noetia" | Conflict |
| Framing | "By subscribing, you authorise this distribution" | Implies the customer's funds are donated. Scope is subscriptions only, yet the clause says "every payment" |
| Naming | EN heading "Noetia Causas" | Inconsistent with "Causas Noetia" |

## 3. Change specification (requirements for counsel)

These are requirements, not final legal text. Counsel drafts the wording.

| # | Requirement | Source |
|---|---|---|
| T-1 | State the base as 2.22% of **eligible net receipts, after payment-processing fees** | C-1 |
| T-2 | State that the program is **planned and not yet started**, or the actual status at publication | C-6 |
| T-3 | Replace "selected by Noetia" with the **PO-053 rule**: one cause chosen by the user, otherwise an equal split across the three | C-7 |
| T-4 | State that recipients will be **independent charitable organizations**, not operated by Noetia | C-5 |
| T-5 | Remove "automatically" and "you authorise this distribution". Counsel decides how to say the allocation comes from Noetia's receipts and does not change the price | Framing; LQ-5 |
| T-6 | Address monthly settlement and the refund rules (C-2…C-4), directly or by reference to approved Causas program terms. Only reference program terms once they are approved and published | C-2, C-3, C-4 |
| T-7 | Rename the EN heading to "Causas Noetia" | Naming |
| T-8 | Make no change to any other Terms provision as part of this work | Scope |
| T-9 | Make no claim of a signed partnership, named beneficiary or completed contribution | C-6 |

**Open points counsel or the PO must close before the text is final:**
- eligible payment types (OP-A);
- taxes (OP-B);
- chargebacks (OP-C);
- app-store commissions as "fees" (OP-K, LQ-7);
- whether the Terms should restate the rules or reference program terms (T-6).

Also confirm the commercial co-venturer / charitable-sales-promotion requirements (LQ-3) and the beneficiary agreements (LQ-4), since they may dictate required wording.

## 4. Coordination with Draft PR #22

PR #22 (`fix/nof-004-terms-annual-prices`, head `d254eea`, NOF-004 PR B) is legal-gated as well.
- **Files:** it edits **the same file**, changing only the §3 annual-price column.
- **Revision date:** it adds `TERMS_LAST_UPDATED`, set to `PENDING_PUBLICATION_DATE`. A test fails on purpose until the real publication date is set.
- **Status of this mission:** PR #22 was **not modified** here.

Rules for the Causas Terms PR, to avoid overlapping changes and conflicting revision dates:
1. **One revision-date mechanism.** Reuse PR #22's `TERMS_LAST_UPDATED`; do not add a second date constant.
   - **Preferred:** stack the Causas PR on PR #22's branch.
   - **Alternative:** the PO merges both into one counsel package.
   - **If sequenced after PR #22 merges:** set a new date at the Causas publication.
2. **One publication event per date.** If both changes publish together, set `TERMS_LAST_UPDATED` once, to the real deploy day. If they publish separately, each one sets the date at its own publication.
3. **No line overlap.** PR #22 touches only the price table (ES rows L25–27, EN rows L122–124) plus the date lines. The Causas change touches only L42–44 / L139–141. Merge conflicts are possible only on the date lines, and rule 1 removes that risk.
4. **Customer notice.** Whether existing users need notice of changed Terms is already an open question in PR #22's legal package (`docs/legal/NOF-004-terms-legal-review.md`). Counsel should answer it once for both changes.

## 5. Approvals required before publication

1. Counsel approval of the final ES and EN text.
2. PO authorization naming the Causas Terms PR.
3. Independent PA review.
4. The publication date set to the actual production deploy day.

Until all four are complete, payments stay disabled. That means keeping the PR #63 API gate off and the web constant `PURCHASES_AVAILABLE = false`.
