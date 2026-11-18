# PR #59 — Causas and Premium Public-Language Alignment · Report

**Authorization:** Product Owner, *NOETIA — PR #59 Causas and Premium Public-Language Alignment* (decisions approved 2026-11-18).
**Branch:** `feat/public-ecosystem-site-20261112` (Draft PR #59), from `fb970b5`. **Status:** Draft; **not merged, not deployed.** STOP for independent PA review.
**Companion documents:**
- [`causas-program-policy.md`](causas-program-policy.md): the decided rules, public-language rules and open points;
- [`causas-program-terms-draft.md`](causas-program-terms-draft.md): the draft program terms, **NOT APPROVED / NOT IN EFFECT**. This is now the only copy; it is no longer published by the app (§8);
- [`terms-of-service-legal-gate-spec.md`](terms-of-service-legal-gate-spec.md): the separate legal-gated Terms §3 specification (§8).

> **Superseded in part by §8 (publication-boundary correction, 2026-11-18).** The `/causas/terms` route and its link, described in §2.2, §2.6, §3 and §4, were removed. The Company revenue breakdown in §2.5 was removed.

## 1. Summary

- Every Causas surface in PR #59 now describes a **planned** program. Each states that the **2.22% is calculated on eligible net receipts after payment-processing fees** and that **charitable partnerships are pending**.
- The superseded wording is gone: "every payment", "calculated on the total payment, not on profits", and present-tense "supports".
- PO-053 (one cause, or an equal split across all three) is unchanged, now in future tense.
- The homepage stays concise. Calculation, monthly settlement and refund rules live in a new, clearly labelled draft at **`/causas/terms`**, linked from `/causas`. The page has a bilingual "Draft for legal review — not in effect" banner, `noindex, nofollow`, and is not in the sitemap.
- Noetia+ / NoetiaX copy is unchanged. Tests now also check the Spanish version.
- No financial calculation, payment, API, entitlement or subscription code changed. The PR #63 backend gate and PR #59's `purchase-availability` control are untouched.

## 2. Exact copy changes

### 2.1 Homepage — `landing.causas` (`lib/i18n/{en,es}.ts`, `app/LandingContent.tsx`)

| Key | Before | After |
|---|---|---|
| `status` (new badge) | — | EN **Planned program** · ES **Programa en preparación** |
| `body` EN | We commit 2.22% of every payment to Causas Noetia. You choose one cause to receive that contribution. If you don't choose one, it is distributed equally among all three. | Causas Noetia is a planned program. We plan to allocate 2.22% of eligible net receipts, after payment-processing fees, to independent charitable organizations. You'll choose one cause; if you don't, it will be split equally among all three. Charitable partnerships are pending. |
| `body` ES | Destinamos el 2,22% de cada pago a Causas Noetia. Tú eliges una causa para recibir ese aporte. Si no eliges ninguna, se distribuye por igual entre las tres. | Causas Noetia es un programa en preparación. Planeamos destinar el 2,22% de los ingresos netos elegibles, después de las comisiones de procesamiento de pago, a organizaciones benéficas independientes. Podrás elegir una causa; si no eliges ninguna, se repartirá por igual entre las tres. Las alianzas con organizaciones benéficas aún están pendientes. |

Unchanged: eyebrow, title ("Sharing is also helping." / "Compartir también es ayudar."), CTA, and the three cause-area cards.

### 2.2 `/causas` (`app/causas/page.tsx`)

| Element | Before | After |
|---|---|---|
| Status badge (new) | — | EN **Planned program** · ES **Programa en preparación** |
| Hero paragraph EN | …We commit **2.22%** of every payment to Causas Noetia. You choose one cause to receive that contribution. If you don't choose one, it is distributed equally among all three. | …Causas Noetia is a planned program: we plan to allocate **2.22%** of eligible net receipts, after payment-processing fees, to independent charitable organizations across three causes. |
| Hero paragraph ES | …Destinamos el **2,22%** de cada pago a Causas Noetia. Tú eliges una causa para recibir ese aporte. Si no eliges ninguna, se distribuye por igual entre las tres. | …Causas Noetia es un programa en preparación: planeamos destinar el **2,22%** de los ingresos netos elegibles, después de las comisiones de procesamiento de pago, a organizaciones benéficas independientes en tres causas. |
| Disclosure box (new) EN | — | Causas Noetia has not started yet. Charitable partnerships are pending: no agreement has been signed and no contribution has been made. We will name organizations only after agreements are signed. |
| Disclosure box (new) ES | — | Causas Noetia aún no ha comenzado. Las alianzas con organizaciones benéficas están pendientes: no se ha firmado ningún acuerdo y no se ha realizado ninguna contribución. Nombraremos a las organizaciones solo después de firmar los acuerdos. |
| Cause-area cards | "A line dedicated to …" / "Línea dedicada a …" | "Planned focus: …" / "Enfoque previsto: …" (rest of each sentence unchanged) |
| How it works 01 EN | Every payment on Noetia carries the Causas Noetia commitment. | Once the program starts, we plan to allocate 2.22% of eligible net receipts: what Noetia receives after payment-processing fees. |
| How it works 01 ES | Cada pago en Noetia incluye el compromiso de Causas Noetia. | Cuando el programa comience, planeamos destinar el 2,22% de los ingresos netos elegibles: lo que Noetia recibe después de las comisiones de procesamiento de pago. |
| How it works 02 EN | We commit 2.22% of that payment to Causas Noetia, calculated on the total payment, not on profits. | You'll be able to choose one cause to receive that allocation. If you don't choose one, it will be split equally among all three. |
| How it works 02 ES | Destinamos el 2,22% de ese pago a Causas Noetia, calculado sobre el total del pago y no sobre las ganancias. | Podrás elegir una causa para recibir esa asignación. Si no eliges ninguna, se repartirá por igual entre las tres. |
| How it works 03 EN | You choose one cause to receive that contribution. If you don't choose one, it is distributed equally among all three. | The allocation will go to independent charitable organizations, not to causes operated by Noetia. |
| How it works 03 ES | Tú eliges una causa para recibir ese aporte. Si no eliges ninguna, se distribuye por igual entre las tres. | La asignación irá a organizaciones benéficas independientes, no a causas operadas por Noetia. |
| Terms link (new) | — | EN **Program terms (draft, pending legal review)** · ES **Términos del programa (borrador, pendiente de revisión legal)** → `/causas/terms` |
| Alliance eyebrow | For social organizations / Para organizaciones sociales | For charitable organizations / Para organizaciones benéficas |
| Alliance body EN | We seek strategic partners in animal welfare, children and youth, and environment. If your organization works with purpose, transparency, and demonstrable impact, we want to meet you and amplify the reach of your work together. | We are looking for independent charitable organizations in animal welfare, children and youth, and the environment for the program's first partnerships. If your organization works with purpose, transparency, and demonstrable impact, we want to meet you. |
| Alliance body ES | Buscamos aliados estratégicos en bienestar animal, niñez y juventud, y medio ambiente. Si tu organización trabaja con propósito, con transparencia y con impacto demostrable, queremos conocerte y potenciar juntos el alcance de tu trabajo. | Buscamos organizaciones benéficas independientes en bienestar animal, niñez y juventud, y medio ambiente para las primeras alianzas del programa. Si tu organización trabaja con propósito, con transparencia y con impacto demostrable, queremos conocerte. |

Unchanged: hero quote and headline, cause names, alliance criteria, and the `causas@noetia.app` contact.

### 2.3 CauseSelector — `causeSelector` (shown before checkout, which is currently disabled)

| Key | Before | After |
|---|---|---|
| `title` | Choose where your 2.22% goes / Elige a dónde va tu 2,22% | Choose where your 2.22% will go / Elige a dónde irá tu 2,22% |
| `body` EN | We commit 2.22% of every payment to Causas Noetia. Choose one cause to receive that contribution. | Causas Noetia is a planned program, and charitable partnerships are pending. We plan to allocate 2.22% of eligible net receipts, after payment-processing fees. Choose one cause to receive that allocation. |
| `body` ES | Destinamos el 2,22% de cada pago a Causas Noetia. Elige una causa para recibir ese aporte. | Causas Noetia es un programa en preparación y las alianzas con organizaciones benéficas aún están pendientes. Planeamos destinar el 2,22% de los ingresos netos elegibles, después de las comisiones de procesamiento de pago. Elige una causa para recibir esa asignación. |
| `defaultNote` | If you don't choose one, it is distributed equally among all three. / Si no eliges ninguna, se distribuye por igual entre las tres. | If you don't choose one, it will be split equally among all three. / Si no eliges ninguna, se repartirá por igual entre las tres. |

The selector's behaviour and API payload are unchanged (one cause, `cause2Id: null`, `randomDistribution: false`, skip makes no API call).

### 2.4 `/pricing` line — `pricing.causasText` + `pricing.causasLink`

| | Before | After |
|---|---|---|
| EN | 2.22% of every payment supports **Noetia Causes**. | Planned, with charitable partnerships pending: 2.22% of eligible net receipts, after payment-processing fees, for **Causas Noetia**. |
| ES | El 2,22% de cada pago apoya **Causas Noetia**. | En preparación, con alianzas benéficas pendientes: el 2,22% de los ingresos netos elegibles, después de las comisiones de procesamiento de pago, para **Causas Noetia**. |

The `/pricing` page file is not modified. Only its i18n strings changed.

### 2.5 Other surfaces

| Surface | Before | After |
|---|---|---|
| Account billing link (`app/(account)/account/billing/page.tsx`; Spanish-only, hard-coded) | 🌿 Ver Causas Noetia — el 2,22% de tu pago apoya causas sociales | 🌿 Causas Noetia — programa en preparación; alianzas con organizaciones benéficas pendientes |
| `billing.causas` i18n key (same text; currently unused by the page) | EN 🌿 See Noetia Causes — 2.22% of your payment supports social causes | EN 🌿 Causas Noetia — a planned program; charitable partnerships pending · ES as the row above |
| Footer label (EN) | Noetia Causes | Causas Noetia (proper noun, as in the PO-053 English wording) |
| About — "Sharing is helping" EN | …We commit 2.22% of every payment to Causas Noetia: animal welfare, children and youth, and the environment. | …Through Causas Noetia, a planned program, we plan to allocate 2.22% of eligible net receipts, after payment-processing fees, to independent charitable organizations in animal welfare, children and youth, and the environment. Partnerships are pending. |
| About ES | …Destinamos el 2,22% de cada pago a Causas Noetia: bienestar animal, niñez y juventud, y medio ambiente. | …Con Causas Noetia, un programa en preparación, planeamos destinar el 2,22% de los ingresos netos elegibles, después de las comisiones de procesamiento de pago, a organizaciones benéficas independientes en bienestar animal, niñez y juventud, y medio ambiente. Las alianzas aún están pendientes. |
| Milestones EN | A 2.22% commitment of every payment to Causas Noetia, built into the financial model from the start. | A planned program: 2.22% of eligible net receipts, after payment-processing fees, designed into the financial model from the start. Partnerships pending. |
| Milestones ES | Compromiso del 2,22% de cada pago con Causas Noetia, parte del modelo financiero desde el inicio. | Programa en preparación: el 2,22% de los ingresos netos elegibles, después de las comisiones de procesamiento de pago, incorporado al modelo financiero desde el inicio. Alianzas pendientes. |
| Company — operations | Social impact — Causas Noetia (2.22% of every payment) / (2,22% de cada pago) | Social impact — Causas Noetia (planned program; partnerships pending) / (programa en preparación; alianzas pendientes) |
| Company — revenue split | 2.22% → Causas Noetia | 2.22% → Causas Noetia\*. Footnote EN: "\* Planned program. The 2.22% is calculated on eligible net receipts, after payment-processing fees, and will go to independent charitable organizations. Partnerships are pending." (ES equivalent). **Numbers unchanged** (see policy OP-I) |

### 2.6 New — draft program terms at `/causas/terms`

Source: `services/web/lib/legal/causas-program-terms-draft.ts`; review mirror: [`causas-program-terms-draft.md`](causas-program-terms-draft.md). The draft has 10 sections in ES and EN:
1. what the program is (independent charities, not operated by Noetia; not started);
2. the 2.22% of eligible net receipts after processing fees;
3. one cause, or an equal split;
4. monthly calculation and settlement;
5. refunds before settlement excluded; after settlement Noetia absorbs the cost;
6. beneficiaries (none signed; named only after signing);
7. what the terms do not claim;
8. reporting (open);
9. changes and termination (open);
10. contact.

There are nine bracketed open points per language. None is filled with invented policy.

### 2.7 Noetia+ / NoetiaX — no copy change

The following is kept verbatim in both languages: 3 / 10 eligible books selected **per session**; "Will require an active Noetia subscription." / "Requerirá una suscripción Noetia activa."; **Coming Soon / Próximamente** with no links, buttons, prices or dates; "…may change…" / "…pueden cambiar…". The Spanish version is now asserted in tests as well.

### 2.8 Mobile

`services/mobile/src/i18n` has no Causas or 2.22% copy (checked with grep). These are web-only surfaces, so no mobile change is needed.

## 3. Files

| File | Change |
|---|---|
| `services/web/lib/i18n/en.ts`, `es.ts` | §2.1, §2.3, §2.4, §2.5 strings; new `landing.causas.status` (parity kept) |
| `services/web/app/LandingContent.tsx` | Status badge; comment |
| `services/web/app/causas/page.tsx` | §2.2 |
| `services/web/app/causas/terms/page.tsx` (new) | Draft-terms page: banner, ES/EN side by side, `robots: noindex, nofollow`, only link `/causas` |
| `services/web/lib/legal/causas-program-terms-draft.ts` (new) | Draft terms + status strings |
| `services/web/app/(corporate)/{about,milestones,company}/content.tsx` | §2.5 |
| `services/web/app/(account)/account/billing/page.tsx` | One hard-coded string (§2.5); no logic |
| Tests: `tests/unit/app/{LandingContent,causas,corporate-causas-copy}.spec.tsx`, `tests/unit/components/CauseSelector.spec.tsx` (updated); `tests/unit/app/causas/terms.spec.tsx`, `tests/unit/lib/legal/causas-program-terms-draft.spec.ts` (new) | See §4 |

**Not changed:** payment, checkout, Stripe, `purchase-availability.ts`, `/pricing` and `/gift` logic, API, `CauseSelector` behaviour, migrations, entitlements, subscription policy, Terms of Service / Privacy / Cookies, PR #60, PR #62, PR #63's backend gate.

## 4. Validation (local, 2026-11-18)

| Check | Result |
|---|---|
| Web unit tests (`jest --maxWorkers=2`) | **419 / 419 passed, 29 suites** (2 new suites; i18n en/es parity included) |
| Type-check (`tsc --noEmit`) | **pass** |
| Lint (`next lint`) | **0 errors**; no warnings in changed files (remaining warnings are pre-existing in unrelated files) |
| Production build (`next build`) | **pass**; `/causas` and `/causas/terms` prerendered static |
| `/causas/terms` built HTML | `<meta name="robots" content="noindex, nofollow"/>` present; draft banner text present |
| Coverage of touched files | LandingContent 97.6% lines, `causas/page` 100%, `causas/terms/page` 100%, draft-terms module 100%, CauseSelector 100% lines |
| Copy guards (tests) | Homepage: planned badge, net-of-fees basis, partnerships pending, PO-053 rule; **no** settlement/refund wording; no "every payment / cada pago / donated / partnered". `/causas`: badge, disclosure box, future-tense rule, labelled terms link, no "total payment" basis. Corporate: no "every payment"; revenue numbers unchanged. Selector: planned/pending/net-of-fees; no present-tense commitment. Draft terms: every C-1…C-7 rule, draft labels, structural ES/EN parity, open points left open, no beneficiary names or donation claims |
| Noetia+ / NoetiaX | 3 / 10 per session, subscription prerequisite, Coming Soon, may-change disclaimer: asserted in ES and EN |

**Not run:**
- screenshots and browser pass (Playwright) for the new copy;
- axe/Lighthouse;
- CI (PR #59 CI runs on push; results to be read in review).

## 5. Legal questions for professional review

| # | Question | Why it matters |
|---|---|---|
| LQ-1 | **Cause-marketing advertising disclosure.** Is "2.22% of eligible net receipts, after payment-processing fees" a sufficiently clear and conspicuous disclosure of the amount benefiting charity at the point of sale (`/pricing`, CauseSelector)? Should it also give a per-purchase amount or example, and an explanation of "eligible"? | Consumer-protection and charity regulators expect cause-marketing claims to tell the buyer how much of a purchase benefits charity. A percentage of a net, undefined-eligibility base may not satisfy that |
| LQ-2 | **"Planned" representations before launch.** Can Noetia advertise a planned charitable program, by cause area, before any beneficiary agreement is signed? If so, with what wording? | Some charitable-solicitation regimes require a written agreement with the charity before a promotion is advertised. Publishing even future-tense copy could be treated as the start of the promotion |
| LQ-3 | **Multistate commercial co-venturer / charitable sales promotion rules.** Which U.S. states require registration, bonding, filing of the charity contract, specific disclosures or post-campaign accounting? Counsel should confirm the current list (Massachusetts, Alabama, Hawaii and Illinois are commonly cited). Are there equivalents in the Latin American jurisdictions the causes target, or where Spanish-speaking readers live? | Determines whether launch needs filings and, per state, the disclosure text. Also affects the "independent charitable organizations" requirement (status checks, foreign charities) |
| LQ-4 | **Beneficiary agreements.** What must each agreement contain: use of the charity's name and logo, approval of copy, allocation method (user choice / equal split), monthly settlement, the refund-absorption rule, reporting to the charity, termination and reallocation? | C-5/C-6. No beneficiary may be named until signed. OP-F (withdrawal) and OP-G (reporting) depend on it |
| LQ-5 | **Customer's tax position and receipts.** Must the copy say the payment is not a tax-deductible donation by the customer? The draft carries this as a bracketed "to be confirmed" line. How is Noetia's own contribution treated, including cross-border giving? | Avoids implying a deductible donation by the reader; affects how Noetia's contribution is booked |
| LQ-6 | **Terms of Service §3 conflict (not modified).** The published ToS says "2.22% of every payment is automatically allocated to social and environmental causes selected by Noetia. By subscribing, you authorise this distribution." That conflicts with C-1 (net base), C-5 (independent charities), PO-053 (user choice) and the planned status | The ToS is legal-gated (NOF-004 / Draft PR #22) and outside this mission's authority. Counsel should reconcile it with the program terms before any of this copy goes live |
| LQ-7 | **Fee definition.** Do app-store commissions (Apple/Google), currency conversion and dispute fees count as "payment-processing fees"? (policy OP-K, OP-C) | Changes the base materially and must be stated consistently in ads and terms |
| LQ-8 | **Publishing the draft terms.** Should a draft (bannered, `noindex`) be publicly reachable at all before review, or only shared privately? | The page is built and linked but not deployed. Counsel or PO can ask for the link to be hidden until approval |
| LQ-9 | **Refund-absorption wording.** Is "Noetia absorbs that cost, and your refund is not reduced because of it" appropriate, and is any consumer notice needed when a refunded payment's share was already disbursed? | C-4 |

## 6. Questions for PA / PO (non-legal)

1. **OP-I:** the Company page split (45/36/9/2.22/7.78 = 100%) now has a net-of-fees footnote on Causas only. Confirm whether the other shares should state their base, or whether the table should be reworded. I left the numbers alone (no financial-calculation changes).
2. The account billing page is Spanish-only (hard-coded). I aligned only its Causas sentence. Wiring it to `t.billing.causas` would be a separate i18n fix.
3. Business plans `docs/business/{en,es}/01-*.md` and the technical baseline still describe "2.22% of each payment". They are outside PR #59's public copy and were left for a follow-up.

## 8. Publication-boundary correction (PO 2026-11-18, all five decisions approved)

| Decision | Done |
|---|---|
| 1. Preserve Causas | No change to the homepage Causas section, `/causas` copy, the three causes, the 2.22% eligible-net-receipts model, the independent-charity / agreements-pending disclosure, or PO-053 |
| 2. Remove draft terms from the app | Deleted `app/causas/terms/page.tsx`, `lib/legal/causas-program-terms-draft.ts` and their two specs. Removed the `/causas` link. New regression test `tests/unit/app/causas-terms-absent.spec.ts` checks: no route directory; no draft module; no `causas/terms` / draft reference in `app`, `components` or `lib`; and the docs copy exists with the NOT APPROVED / NOT IN EFFECT label. `causas.spec.tsx` now asserts that `/causas` has no terms link |
| 3. Company page | Removed the five-row 45/36/9/2.22/7.78 list, its heading ("Distribución de ingresos" / "Revenue distribution") and its footnote, in ES and EN. Kept the qualitative paragraph, "What we offer authors" and the Causas social-impact line. No replacement figures. The section title "Publishing ecosystem and revenue model" is unchanged, to avoid redesign |
| 4. Terms legal gate | [`terms-of-service-legal-gate-spec.md`](terms-of-service-legal-gate-spec.md): source, conflicts, requirements T-1…T-9, and coordination with #22 (one `TERMS_LAST_UPDATED`). Recorded as a **hard prerequisite before payment activation** (policy §4a). Terms not edited |
| 5. Legal draft handling | The draft stays in this public repository, headed NOT APPROVED / NOT IN EFFECT (EN and ES). No history rewrite or force-push. Future confidential legal material goes through a private channel |

## 9. STOP

Draft PR only. **No merge, no deployment, no production change.** PR #60 and PR #62 untouched. Awaiting independent Product Architecture review.
