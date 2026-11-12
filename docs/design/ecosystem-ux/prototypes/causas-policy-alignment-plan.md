# Causas Noetia — PO-053 Alignment: Inconsistency Inventory and Implementation Plan

**Policy:** [PO-053](../../../operating-framework/decisions/product-owner/PO-053-causas-noetia-distribution-policy.md), approved 2026-11-12.

| Rule | Behaviour |
|---|---|
| Base | 2.22% of each qualifying payment |
| One cause selected | Animal Welfare / Children and Youth / Environment; the chosen cause receives 100% of the allocation |
| No selection | equal, deterministic split across all three |
| Other options | none |

**Status:** documentation and plan only. **Nothing here is implemented.** Every step below needs its own authorization: code, migration, legal-text and accounting work are all excluded from this PR.

## 1. Inconsistency inventory (`main@6a5e5c0`, VERIFIED)

| # | Surface | Current behaviour or text | Conflict with PO-053 |
|---|---|---|---|
| I-1 | `services/web/components/CauseSelector.tsx:30-36,79` | Toggle allows **up to 2** selected causes (`prev.length < 2`; disables others at `selected.length >= 2`) | One cause only |
| I-2 | `CauseSelector.tsx:110-121` | "Distribuir aleatoriamente" option described as "Tu 2,22% se reparte equitativamente entre las tres causas" | The default is equal and deterministic, and it is the **absence** of a choice, not a selectable "random" option. The label and description contradict each other |
| I-3 | `CauseSelector.tsx:66-68` | Hard-coded Spanish: "Elige hasta 2 causas…, o distribúyelo aleatoriamente entre las tres." No English | Two causes, "random"; not bilingual |
| I-4 | `services/api/src/causes/dto/save-preferences.dto.ts` | `cause1Id?`, `cause2Id?`, `randomDistribution: boolean` | A second cause and a random flag are not part of the policy |
| I-5 | `services/api/src/causes/user-cause-preference.entity.ts:15-25` | Columns `cause1Id`, `cause2Id`, `randomDistribution` (migration `1714000000036`) | Same (schema; changes need a new corrective migration, never an edit) |
| I-6 | `services/api/tests/unit/causes/causes.service.spec.ts` | Tests encode the two-cause/random model | Must follow the API change |
| I-7 | `services/web/app/causas/page.tsx:74-75` | "elige hasta dos líneas estratégicas… o distribuye tu aporte de forma aleatoria entre las tres" / "choose up to two… or distribute… randomly" | Two causes, random |
| I-8 | `services/web/app/causas/page.tsx:147,153` | "apoya proyectos sociales reales — desde el primer día, sin excepción" / "supports real social projects — from day one, without exception" | Execution tense (no contributions paid yet) |
| I-9 | `services/web/app/LandingContent.tsx:237-240` | "2,22% de cada compra apoya proyectos sociales reales… desde el primer día. Tú eliges la causa." | Base "compra" vs "pago"; execution tense. "Tú eliges la causa" (singular) happens to match PO-053 but lacks the default rule |
| I-10 | `services/web/app/(corporate)/milestones/content.tsx:15` | "2,22% de cada pago donado automáticamente a causas aliadas desde el primer día" | "donado" claims executed contributions |
| I-11 | `services/web/app/(corporate)/about/content.tsx:25-26` | "El 2,22% de cada compra apoya causas sociales…" | Execution tense; "compra" vs "pago" |
| I-12 | `docs/business/en/01-business-plan.md:47`, `docs/business/es/01-plan-de-negocio.md:47` | Causes listed as "Medio Ambiente, Educación, Salud" (Environment, Education, Health) | Confirmed causes are Animal Welfare, Children and Youth, Environment |
| I-13 | `docs/business/{en,es}/01-*.md:14,85,186` | "2.22% of every payment" | Rule 1 says "qualifying payment" (open point OP-1) |
| I-14 | `services/web/lib/legal/terms-of-service.ts:44` / `:141` | "El 2,22 % de cada pago… Al suscribirte, autorizas esta distribución." | Legal text: alignment only through counsel (OP-3); not changed here |
| I-15 | Design documents (Draft PR #57): `causas-mechanism-decision.md` (M2) and Appendix G LP-07 (mechanism "pending") | Pre-decision analysis | Marked superseded (this PR). Appendix G is left as historical; this plan records the relationship |
| I-16 | Prototype homepage (`tools/build_prototypes.py`) | Placeholder "[Mecanismo de distribución — pendiente de decisión del PO (LPD-6)]" | Replaced with the approved wording (this PR) |

Mobile (`services/mobile/src`) has no cause-selection surface (searched; no matches).

## 2. Implementation plan (proposed sequence; each step separately authorized)

| Step | Change | Files | Dependencies | Acceptance |
|---|---|---|---|---|
| **S1. Public copy** | Approved PO-053 wording on the landing page; commitment tense; "pago" base | `LandingContent.tsx` (done in the separate public-website Draft PR), `causas/page.tsx:74-75,147,153`, `(corporate)/milestones/content.tsx:15`, `(corporate)/about/content.tsx:25-26` | none (copy) | No "random", "two", "donado", "apoya… desde el primer día"; ES/EN parity |
| **S2. Selector UI** | Single-choice radio group of the three causes, plus a separate explanatory line: "Si no eliges ninguna, tu aporte se reparte por igual entre las tres." Remove the "random" option. Bilingual through i18n | `components/CauseSelector.tsx`, `lib/i18n/{es,en}.ts`, new `tests/unit/components/CauseSelector.spec.tsx` | S3 (API contract) | At most one cause selectable; saving with none selected stores "no preference"; ES/EN |
| **S3. API contract** | `SavePreferencesDto` → `{ causeId: uuid \| null }`. Stop accepting `cause2Id` and `randomDistribution` (or accept and ignore during a transition window) | `causes/dto/*`, `causes.service.ts`, `causes.controller.ts`, `tests/unit/causes/*` | PO rule for legacy data (OP-2) | Unit tests: one cause; null means no preference; legacy fields rejected or ignored |
| **S4. Schema migration** | New corrective migration: map `randomDistribution = true` to no preference; map two-cause rows per the OP-2 decision; later drop `cause2Id` and `randomDistribution` in a follow-up migration | `services/api/src/migrations/<new>` (never edit `…036`) | OP-2; production snapshot per CLAUDE.md before migration | Count before and after; idempotent |
| **S5. Business-plan documents** | Correct cause names (I-12); align "payment" vs "qualifying payment" after OP-1 | `docs/business/{en,es}/01-*.md` | PO authorization to edit the business plans; OP-1 | Names match PO-053 |
| **S6. Legal** | Counsel reviews any mechanism description in Terms §3 | `lib/legal/terms-of-service.ts` | qualified counsel; PO | Counsel-approved wording only |
| **S7. Allocation and reporting** | Engineering design: per-qualifying-payment calculation (one cause → 100%; none → one third each, with a rounding rule), refunds and chargebacks, ledger, reconciliation with Stripe and accounting, audit trail, public reporting of executed contributions | new design document → separate mission | OP-1, OP-4; PO authorization | Design approved before any code |

**Suggested grouping:**
- S1 can ship with the public-website PR.
- S2, S3 and S4 form one bounded engineering change, after OP-2.
- S5 and S6 are documentation and legal tracks.
- S7 is a separate mission.

## 3. Decisions still needed

| # | Question |
|---|---|
| OP-1 | What counts as a "qualifying payment", and should the public wording keep "every payment"? |
| OP-2 | How should legacy two-cause or random preferences be migrated? |
| OP-3 | Counsel wording for Terms §3. |
| OP-4 | Authorization for an allocation and reporting design. |
| Rounding | How should the equal split handle cents (a three-way split of 2.22% of an amount)? |
