# SA-002: Three-Tier Product Architecture Reconciliation

## 1. Mission and objective

Reconcile the customer-facing structure **Noetia, Noetia+, NoetiaX** (Product Owner scope update, 2026-11-06) with the approved architecture, and deliver six documents for Product Architecture review. The assignment carried no ID; `SA-002` is **provisional**, following the SA-001 pattern (TT-21).

## 2. Date and status

2026-11-06. **Complete; awaiting Product Architecture review.** Nothing in this report is approved or deployed.

## 3. Scope and exclusions

**In scope:** documentation and analysis of tiers, research architecture, rights, economics, entitlements, Research Brief, and roadmap.

**Excluded:** application code, database, infrastructure, Stripe, deployment, final prices, final AI limits, model prices, and any change to NEM-003, ADRs, or PO records.

**Sources read:** `CLAUDE.md`; `docs/PRD.md`; all of `docs/noetia-plus/` including `PRODUCT-DECISIONS.md`; ADR-001…004; `docs/engineering-missions/` README and template; `technical-baseline/21`; PO-005 and the AI governance framework (`nem-009-resilience-impl`); PO-021…023 and impact assessment (PR #12); PO-024 (PR #17); unit economics (PR #18); NEM-006 record; relevant code on `origin/main` `6a5e5c0`.

## 4. Executive summary

The approved architecture can absorb three tiers without replacing an ADR. Three additions do the work: a tier resolver, a session book set, and separate per-tier budgets.

Eleven conflicts are raised for the Product Owner, six of them High. The most urgent is token expiry: the new invariant says 90 days, and PO-024 rule 9 says six calendar months for 3/5/10-token packages.

Two facts constrain timing. Adding a premium plan on today's billing code would list it publicly, mint book tokens, unlock all paid books, and overwrite the user's plan. And `books` has no rights or edition data, so default-deny eligibility leaves nothing to analyse until that is addressed.

The proposed next mission (NEM-019, draft) builds limit enforcement, tier resolution, and budget accounting with a fake provider: no AI spend, no billing, no deployment.

**Deliverables:** [`docs/architecture/three-tier-intelligence/`](../architecture/three-tier-intelligence/README.md) and [NEM-019 draft](../engineering-missions/APPROVED/NEM-019-tier-aware-intelligence-control-plane.md).

## 5. Verified findings

### Facts (code on `origin/main` `6a5e5c0`)

| # | Finding | Reference |
|---|---|---|
| 1 | One subscription row per user; webhook upsert conflicts on `userId` | `migrations/1714000000009-CreateSubscriptions.ts:20`; `subscriptions.service.ts:531` |
| 2 | Webhooks read only the first invoice line and item | `webhooks.service.ts:130,176` |
| 3 | Each paid invoice issues tokens; `tokensPerCycle` defaults to 1 | `webhooks.service.ts:141`; `subscriptions.service.ts:303`; `plan.entity.ts:23-24` |
| 4 | Public plans endpoint returns all rows; pricing page filters by interval only | `plans.service.ts`; `pricing/page.tsx:55` |
| 5 | Any active subscription row unlocks all paid books | `subscription.guard.ts:13,41` |
| 6 | `POST /library/:bookId` inserts any published book | `library.service.ts:19` |
| 7 | Token expiry is 90 days for all `paid` tokens in code and ToS | `subscriptions.service.ts:27`; `terms-of-service.ts:31,128` |
| 8 | No intelligence module on any remote branch | Tree check of all remote refs |
| 9 | `books` has no rights, edition, translator, or AI fields | `book.entity.ts`; no match in migrations |
| 10 | Reader has no `?phrase=` deep link | No match under `services/web` |
| 11 | Worker: 0.5 CPU, 256 MB; DB: 1 CPU, 512 MB; production DB image has no pgvector | `docker-compose.server.yml:169-218` |
| 12 | Legal pages contain no AI references | `services/web/lib/legal/*` |
| 13 | Public `GET /api/subscriptions/token-packages` returned 999, 2499, 3999, 7499 cents, all active | Read-only request, 2026-11-06 |
| 14 | PO-022/023 records state independence; the 2026-10-30 direction requires a book plan, amendment wording not applied | PR #12; PR #18 |
| 15 | PO-024 rule 9: six calendar months for 3/5/10 packages | PR #17 |

### Interpretations

- The token-expiry statement may be a deliberate supersession of PO-024 or a shorthand. This report does not choose.
- One Stripe Subscription with line items fits the approved dependency better; final choice stays with the PO.
- Depth cannot be credibly claimed without a same-books benchmark.
- Fixed context spreads thin at ten books, so per-book maps are the likely key to quality and cost.

### Unverified assumptions

- Stripe behaviour for tier swaps and intervals; carried from PR #18 and not checked against current Stripe documentation.
- Stripe Dashboard prices; only Noetia's public endpoint was read.
- Staging pgvector status: taken from project documents and a compose-file match, not tested.
- `DELETE /users/me` not cancelling Stripe, and refund handling gaps: carried from NOF-003/NOF-004, not re-verified.
- All cost-shape statements are qualitative. **No measured AI cost exists.**

## 6. External references

No external web sources were consulted. One read-only request was made to Noetia's own public endpoint `https://noetia.app/api/subscriptions/token-packages` and `/plans` (accessed 2026-11-06); Stripe price IDs in the response were not recorded.

## 7. Risks

| Level | Risk |
|---|---|
| **Critical** | Premium plan added before billing prerequisites (findings 1–5): minted tokens, unlocked catalogue, overwritten plan |
| **Critical** | AI cost above revenue, especially heavy NoetiaX use; no measured data yet |
| **High** | Token-expiry conflict reaching customers or legal text without a ruling |
| **High** | Reconstruction through multiple sessions and exported Briefs; residual risks stated in `03` §5 |
| **High** | Reader regression through a shared database and API process |
| **High** | Empty launch corpus (finding 9) |
| **High** | NoetiaX perceived as only a higher limit |
| **High** | AI eligibility trusting `user_books` rows of doubtful origin (finding 6) |
| **Medium** | Legal pages silent on AI; decisions scattered across unmerged branches; Stripe structure unsettled |
| **Low** | Author "Básico" label confused with a premium tier |

## 8. Recommendations

**Required before implementation**
1. Rule on P0 decisions: TT-01, TT-02, TT-04, TT-05, TT-12, TT-21.
2. No premium plan row until M-C, M-D, and NEM-013 land.
3. AI eligibility stays default-deny and does not trust `user_books` alone until NEM-011 and B-10 are resolved.
4. No budget or price value without measurement and PO approval.
5. Terms and Privacy updates before real user data reaches a provider.

**Optional**
1. Neutral `intelligence` naming instead of `plus` for internals.
2. Record the result as PO-025+ and ADR-005/006.
3. Update the PRD after approval.

## 9. Tests and verification performed

Documentation only; no test suite was run because no code changed. Verified: code citations via `git show` and `grep` on `origin/main`; absence of intelligence code across all remote refs; availability of the `NEM-019` and `SA-002` identifiers across refs and PR titles; `cd.yml` triggers only on `main`.

**Limitations:** no provider, Stripe, production database, or staging access. Line numbers may drift after future merges.

## 10. Open questions and Product Owner decisions required

22 decisions are listed in [`05-open-decisions.md`](../architecture/three-tier-intelligence/05-open-decisions.md). P0: **TT-01** token expiry · **TT-02** premium prerequisite · **TT-04** limit semantics · **TT-05** My Knowledge and Ask My Highlights · **TT-12** launch corpus · **TT-21** adoption and governance.

## 11. Changes made

**No application changes.** Only new documentation:
- `docs/architecture/three-tier-intelligence/` (7 files)
- `docs/engineering-missions/DRAFT/NEM-019-tier-aware-intelligence-control-plane.md`
- this report

No existing file was modified.

**Protocol deviation:** `docs/reports/README.md` exists only on open PRs #23 and #24, not on `main`. To avoid stacking on legal-review work or creating a conflict, the index is not edited here (NEM-018 precedent). Proposed row for when the index lands:

```
| 2026-11-06 | SA-002 | [Three-tier product architecture reconciliation](2026-11-06-SA-002-three-tier-architecture-reconciliation.md) | Report PR: [#34](https://github.com/Carloskfe/noetia/pull/34) (Draft) | Complete; awaiting Product Architecture review |
```

## 12. Next recommended action

**Product Architecture review**, then Product Owner rulings on the P0 decisions. Work stops here. NEM-019 is a draft and is not to be executed without approval and an explicit instruction naming it.
