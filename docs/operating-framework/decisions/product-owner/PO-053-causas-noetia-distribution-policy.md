# PO-053 — Causas Noetia Distribution Policy (Approved Product Policy)

**Status:** `DECIDED` — Product Owner, 2026-11-12 (*NOETIA — Final Product Owner Decision: Causas Distribution*, which supersedes the same day's *Causas Default Distribution* clarification and is consistent with it).
**Domain:** Social impact (Causas Noetia), Product policy · **Authority:** Product Owner · **Review:** independent Product Architecture
**Date:** 2026-11-12 · **Recording agent:** Claude Code · **Recorded on:** documentation-only branch `docs/causas-distribution-policy-20261112` (stacked on Draft PR #57's branch)
**Related:**
- [Causas mechanism comparison](../../../design/ecosystem-ux/prototypes/causas-mechanism-decision.md) (its M2 recommendation is **superseded**);
- Appendix G LP-07 ([report](../../../reports/noetia-ecosystem-ux-audit/G-published-landing-visual-assessment.md));
- business plans `docs/business/{en,es}/01-*.md`.

> Identifier: `PO-053` verified unused on all remote branches, in the commit history and in the governance trees on 2026-11-12. PO-001 to PO-052 exist on other branches. This governance directory isn't on `main` yet; the register entry is in `docs/noetia-plus/PRODUCT-DECISIONS.md`, following the convention noted there.

## Decision — approved rules

1. Noetia allocates **2.22% of each qualifying payment** to Causas Noetia.
2. Each user may select **one cause only**:
   - Animal Welfare / Bienestar animal;
   - Children and Youth / Niñez y juventud;
   - Environment / Medio ambiente.
3. When one cause is selected, **100%** of that payment's 2.22% allocation goes to the selected cause.
4. When **no cause is selected**, the allocation is divided **equally among all three** causes.
5. There are **no other** distribution options.
6. The default distribution is **deterministic, not random**.

**Superseded:** the M2 recommendation (up to two causes, or an equal split across three) and every earlier description allowing two causes or a "random" distribution.

## Approved public wording

| Language | Text |
|---|---|
| Español | "Destinamos el 2,22% de cada pago a Causas Noetia. Tú eliges una causa para recibir ese aporte. Si no eliges ninguna, se distribuye por igual entre las tres." |
| English | "We commit 2.22% of every payment to Causas Noetia. You choose one cause to receive that contribution. If you don't choose one, it is distributed equally among all three." |

Social-impact wording must remain commitment-based. **No sales have occurred**, so no contribution has been paid; public copy must not claim executed or "donated" contributions.

## Unchanged

- The 2.22% commitment and the three causes.
- Financial policy otherwise.
- Production allocation, Stripe integration, subscription logic and published legal documents. No changes are authorized here.

## Not authorized by this record

- Modifying production financial allocation, Stripe, subscription logic, the preference API or published legal documents.
- Creating or deploying an accounting or payout system without a separately approved engineering design.
- Merge or deployment.
- Any change to NEM-024 restrictions. E-1 remains OPEN and BLOCKED; Checkpoint E remains NOT QUALIFIED; release remains BLOCKED.

## Open points recorded (not decided here)

| # | Point | Why it matters |
|---|---|---|
| OP-1 | **"Qualifying payment" definition.** Rule 1 says "each qualifying payment"; the approved public wording says "every payment" | Which payments count (subscriptions, token packs, gifts; trials; refunded or charged-back payments) must be defined before allocation logic and before counsel reviews the wording |
| OP-2 | **Legacy preferences.** Records saved under the old selector may hold two causes or `randomDistribution = true` | The alignment migration needs a PO rule. Proposed for decision: treat `randomDistribution` as "no preference" (equal split). For two-cause records: either keep the first cause or reset to no preference |
| OP-3 | **Terms of Service §3** describes the 2.22% ("autorizas esta distribución") | Any mechanism description in the Terms requires qualified legal review (DL-03) |
| OP-4 | **Allocation, ledger, reconciliation, refunds and reporting of executed contributions** | Requires a separately approved engineering design |

## STOP gate

This is a documentation-only Draft PR for independent Product Architecture review. No merge or deployment.
