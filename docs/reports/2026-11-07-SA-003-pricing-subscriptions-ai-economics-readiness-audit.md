# SA-003: Pricing, Subscriptions and AI Economics Readiness Audit

**Evidence labels**

| Label | Meaning |
|---|---|
| **[CODE]** | Verified in application code at the commit in §3 |
| **[POLICY]** | Accepted and merged on `main` |
| **[UNMERGED]** | Recorded as `DECIDED`, but only on a branch or PR |
| **[DRAFT]** | Draft record or proposed ADR, not accepted |
| **[BASELINE]** | Product Owner planning baseline of 2026-11-07, *Three-Tier Product & AI Economics Specification v1.0* (not yet published in the repository) |
| **[EXTERNAL]** | Read on an official external page, URL and date in §8 |
| **[CALC]** | Arithmetic from the stated inputs. Illustrative, **not measured** |
| **[ASSUMPTION]** / **[UNVERIFIED]** | Not established by evidence in this audit |
| **[OPEN]** | Needs a Product Owner decision |

---

## 1. Mission and objective

| | |
|---|---|
| **Mission** | SA-003 — Pricing, Subscriptions and AI Economics Readiness Audit (identifier approved by the Product Owner, 2026-11-07) |
| **Type** | Read-only technical audit, then documentation-only publication |
| **Authorization** | (1) PO mission brief *Technical Readiness Audit: Pricing, Subscription Architecture & AI Unit Economics*, 2026-11-07: analysis only, no repository writes. (2) PO authorization *SA-003 Audit Completion and Reporting Governance Consolidation*, 2026-11-07: one documentation-only branch and Draft PR |
| **Objective** | Find (1) the current sources of truth for subscription prices; (2) the technical changes needed to support premium AI subscriptions safely; (3) the infrastructure needed to measure and control AI cost; (4) conflicts between repository documents and the PO baseline; (5) the safest implementation sequence |

## 2. Date and status

| | |
|---|---|
| **Dates** | Audit and publication 2026-11-07 |
| **Lifecycle status** | **Review**: complete, awaiting Product Owner review |
| **Delivery state** | **Not merged.** Nothing deployed |
| **This report authorizes** | **Nothing.** Its recommendations are not approved engineering instructions |

### Revision history

| Rev | Date | Change |
|---|---|---|
| 1 | 2026-11-07 | Audits A, B, C and a partial D, delivered in the agent response only (repository writes were prohibited) |
| 2 | 2026-11-07 | Audit D completed, Audit E added, risks rated, mission information added; published under the documentation-only authorization |

## 3. Repository baseline

| Item | Value |
|---|---|
| Application code examined | `fix/nof-004-terms-annual-prices` at `d254eea` = `origin/main` `6a5e5c0` + two commits that touch only `services/web/lib/legal/terms-of-service.ts`, its spec, and `docs/legal/NOF-004-terms-legal-review.md` (PR #22). All other code citations are identical on `origin/main` `6a5e5c0` |
| Decision branches read with `git show` (local refs equal to `origin` on 2026-11-07) | `docs/t0-decision-closure` `b05a213` (PR #35: PO-025…029, ADR-005/006, three-tier docs, SA-002 reports) · `docs/po-021-023-acquisition-noetia-plus` `1f420ef` (PR #12) · `docs/po-024-token-expiry-gifting` `373bdad` (PR #17) · `docs/noetia-plus-unit-economics` `329db17` (PR #18) · `nem-007-creator-rights` `735abf2` (PO-005…013) · `docs/three-tier-architecture-reconciliation` `223fabd` (PR #34) |
| Installed dependency inspected | `services/api/node_modules/stripe` 22.2.0, pinned API version `2026-05-27.dahlia` (`node_modules/stripe/cjs/apiVersion.js:5`) |
| Branch created for this report | `docs/sa-003-readiness-audit-reporting-governance` from `origin/main` `6a5e5c0` |

## 4. Scope and exclusions

**In scope:** static inspection of the API, web, mobile, and migrations for pricing, billing, and entitlement; Product Owner and architecture records on all branches; public pricing and documentation pages of Stripe, Google, OpenAI, and Anthropic.

**Excluded by the mission:** any code, database, migration, Stripe, environment, or infrastructure change; running tests, builds, scripts, or migrations; paid API calls; production or staging access; the Stripe dashboard.

**Brief truncation.** The original brief ended mid-sentence in Audit D ("…ADR-001 through ADR-006. Three"). Its later sections were never received. Audit D was completed from the documents named in §6 of the brief plus the three-tier architecture package, which is the most likely referent of "Three…" **[ASSUMPTION]**. Audit E was defined by the PO authorization of 2026-11-07 as including the proposed implementation sequence; its original wording is unknown.

## 5. Executive summary

1. **Billing cannot safely carry a premium subscription today [CODE].** A Noetia+ or NoetiaX Stripe subscription processed by the current webhooks would overwrite the user's subscription row, erase their base plan, issue them book tokens, and could mark their reading access `canceled`.
2. **Several defects affect current customers, whether or not premium ships [CODE]:**
   - account deletion leaves Stripe billing running;
   - a second checkout creates a second, untracked Stripe subscription;
   - refunds and disputes aren't handled;
   - trial invoices issue paid tokens;
   - token expiry is 90 days for everything, while PO-024 sets six months for 3/5/10 packs.
3. **There is no pricing authority [CODE].** Prices are defined in about eight places; the database amount is display-only; Stripe charges by price ID; and the Stripe price IDs of the legacy Individual and Duo rows can't be traced from the repository.
4. **No AI capability exists in code [CODE].** There is no gateway, metering, budget ledger, reservation, rights record, or vector store. Everything is documented or proposed.
5. **Economics depend on routing [CALC, not measured].** At 55–65% contribution margin, the monthly AI budget is about **$0.81–$1.81** per Noetia+ subscriber and **$1.47–$3.07** per NoetiaX subscriber, depending on whether Causas/Marketing allocations apply. A single Opus-class Research Brief costs about $0.80 as one call.
6. **Option B (separate base and premium Stripe subscriptions) is the recommended architecture**, because personal premium for Duo/Family members can't be billed correctly on the owner's subscription. It costs about **$0.30 per premium subscriber-month** in extra fixed card fees.
7. **The governing records conflict with the baseline.** PO-022 and PO-023, both `DECIDED` but unmerged, allow a standalone Noetia+. Draft PO-026 and ADR-005 deny household eligibility. None of PO-005…029 or ADR-005/006 is on `main`.

## 6. Work completed

| Iteration | Work |
|---|---|
| Rev 1 | Audits A (pricing), B (billing), C (AI readiness and economics), D (partial). External verification of Stripe and model pricing via a web-fetch subagent. Delivered in the response |
| Rev 2 | Read the three-tier package (`README`, `01`, `04`, `05`, `06`, `07`), PO-021…024, PO-028, ToS Causas and household text on `main`, NEM-003 `07`. Completed Audit D, wrote Audit E, rated risks, and published this report |

## 7. Verified findings and evidence

### 7.A Pricing architecture

#### A.1 Where prices come from today [CODE]

| # | Source | Values | Kind | Evidence |
|---|---|---|---|---|
| 1 | **Stripe Price objects** | **The amount actually charged** for plans and token packs | Stripe | `services/api/src/subscriptions/subscriptions.service.ts:214, 267` charge by `stripePriceId` |
| 2 | `plans` table | Individual 899 / 8399; "Dual Reader" (Duo) 1399 / 12999; Family 1899 / 17999 cents (monthly / annual) | Database (migration seeds) | `migrations/1714000000010-SeedPlans.ts`, `…039-RestructurePlansAndTokenPackages.ts`, `…067-ReconcilePlanDisplayPrices.ts` |
| 3 | `token_packages` table | 999 / 2499 / 3999 / 7499 cents | Database | `…039:65-68` |
| 4 | Gift cards | 999 / 2499 cents, charged inline with `price_data` (no Stripe price) | **Hardcoded** twice | `services/api/src/gifts/gifts.service.ts:63`; `services/web/app/(billing)/gift/page.tsx:8-9` |
| 5 | Direct book purchase | `books.priceCents`, inline `price_data`, currency `'usd'` | Database + hardcoded currency | `subscriptions.service.ts:241-246` |
| 6 | Mobile paywall | $8.99 / $13.99 / $18.99 monthly | **Hardcoded i18n** | `services/mobile/src/i18n/en.ts:104-106`, `es.ts:106-108` |
| 7 | Terms of Service | Plan table | **Hardcoded** | `services/web/lib/legal/terms-of-service.ts:124` on `main` (Family annual $170.99; PR #22 proposes $179.99) |
| 8 | Pricing page SEO description | "desde $9.99/mes" (**stale**) | **Hardcoded** | `services/web/app/(billing)/pricing/layout.tsx:6` |
| — | 14-day trial on every checkout | — | **Hardcoded** | `subscriptions.service.ts:216` |

#### A.2 Assessment

- **There is no central pricing authority.** The web pricing page reads the database (`pricing/page.tsx:43-44`). Stripe decides the charge. Mobile, ToS, gifts, and SEO text hold their own copies.
- **Backend and Stripe can disagree undetected.** Migration `067` states `amountCents` is display-only ("Stripe charges by price ID, not by `amountCents`"). No check compares the two.
- **The Stripe price IDs of the legacy rows can't be traced [CODE].**
  - Migration `041` updates `WHERE "name" = 'Individual'` / `'Duo'` (`…041-UpdateStripeProductIds.ts:16-23`). The legacy rows are named `'Individual Monthly'`, `'Dual Reader Monthly'`, etc. (`…010:15-18`), so it matches none of them, the same defect `067` documents for `039`. It does match the `'Family'` rows and the token packages.
  - Individual and Duo therefore keep the IDs `010` set from `STRIPE_PRICE_INDIVIDUAL_*` / `STRIPE_PRICE_DUAL_*`, or `price_changeme`.
  - `docs/stripe-setup.md:24-29, 99` tells operators to set `STRIPE_PRICE_ID_*` and run `041`, which has no effect on those rows.
  - Live values are **[UNVERIFIED]**: they need a production read.
- **Household size disagrees [CODE].** "Up to 4 members" in the ToS (`terms-of-service.ts:124`, Spanish `:27`) · `maxProfiles = 5` in the database (`…039:44-45`) · "Up to 5 users" on mobile (`en.ts:106`) · "5 users" in the business plan (`docs/business/en/01-business-plan.md:168`).
- **Price history is lost.** Plan rows are edited in place (`039`, `067`). There are no currency, effective-date, version, product-kind, or active fields on `plans` (`plan.entity.ts`). Existing subscribers are protected only because Stripe Price objects can't be edited.
- **Premium can't be added without affecting book tokens.** A premium row in `plans` would:
  - inherit `tokensPerCycle` (default 1, `plan.entity.ts:23`) and issue tokens on every paid invoice;
  - be listed publicly (`plans.service.ts:15` returns every row, including `stripePriceId`);
  - be sold with a 14-day trial and no eligibility check.

#### A.3 Recommended target (recommendation, not approved)

- **A versioned catalog**, separate from the token tables:
  - `catalog_products`: a stable `code` and a `kind` (`base_plan` · `premium_addon` · `token_package` · `gift`).
  - `catalog_prices`: append-only. Amount, currency, interval, `effective_from` / `effective_to`, `stripe_price_id`, Stripe `lookup_key`, environment, status.
  - `catalog_eligibility`: for example, `premium_addon` requires an active `base_plan`.
- **One read endpoint** returning only what the current user may buy. Web, mobile, and gifts consume it. The ToS keeps a legal snapshot referencing a catalog version.
- **A read-only reconciliation** in CI or at startup comparing the catalog with Stripe (amount, currency, interval, active) and alerting on mismatch.
- **Match on stable codes, never display names** (the `039`/`041` lesson).
- **No existing price changes.**

### 7.B Subscription and billing compatibility

#### B.1 Known hazards, re-verified [CODE]

The first six rows confirm the T0 closure report's "Billing hazards" table (PR #35, which also found them unchanged in Release A, PR #14).

| Hazard | Evidence | Consequence for a premium subscription |
|---|---|---|
| One row per user, upserted on `userId` | `uq_subscriptions_user` (`…009-CreateSubscriptions.ts:20`); `subscriptions.service.ts:529-532` | Premium events **overwrite the base row's `stripeSubscriptionId`** |
| Plan taken from the first item only | `webhooks.service.ts:130, 176` | A premium price matches no plan → `planId = null` → **base plan erased** |
| Tokens on every paid invoice | `webhooks.service.ts:141` → `subscriptions.service.ts:296-306` | The premium invoice issues the **base plan's** tokens, because the upsert keeps `planId` |
| Cancel acts on the only Stripe subscription | `subscriptions.service.ts:482-490` | "Cancel premium" cancels reading |
| Premium deletion | `cancelFromWebhook` (`subscriptions.service.ts:535-537`), keyed on the overwritten ID | **Base row marked `canceled`**; reading access lost |
| Any active row unlocks paid books | `subscription.guard.ts:41-56` (also contradicts PO-021) | A premium-only state unlocks the catalogue |
| No eligibility check, public listing, unconditional trial | `subscriptions.service.ts:207-216`; `plans.service.ts:15` | Premium on trial, without a base plan |

#### B.2 New findings (not in the T0 report)

| # | Finding | Evidence | Verified? |
|---|---|---|---|
| N1 | **Stripe API version mismatch.** The SDK pins `2026-05-27.dahlia`. Since `2025-03-31.basil`, `current_period_end` is on subscription items and `invoice.subscription` is replaced by `invoice.parent.subscription_details.subscription` | `subscriptions.service.ts:503-507` reads `stripeSub.current_period_end` on an SDK call → Invalid Date. `webhooks.service.ts:121-128, 186` read the old fields | SDK path **[CODE] + [EXTERNAL]**. Webhook impact **[UNVERIFIED]**: payloads follow the webhook endpoint's own API version, which can't be seen from the repository. If basil or later, `invoice.paid` returns at `:128` (no tokens, no status) |
| N2 | `customer.subscription.updated` with `status: 'canceled'` is recorded as `'none'` | `webhooks.service.ts:170-174` | [CODE] |
| N3 | No `charge.refunded` or `charge.dispute.*` handling: tokens and access survive refunds and disputes | `webhooks.service.ts:55-77` | [CODE] |
| N4 | The $0 trial invoice fires `invoice.paid` and issues tokens typed `'paid'`. No prior-trial check, so trials repeat | `webhooks.service.ts:141`; `subscriptions.service.ts:216` | [CODE]. Stripe's $0 trial invoice behaviour is from documentation knowledge, **[UNVERIFIED]** this session |
| N5 | A second checkout while subscribed creates a second Stripe subscription; the upsert overwrites the row; the first keeps billing, untracked | `subscriptions.service.ts:207-221` (no existing-subscription check) | [CODE] |
| N6 | **Account deletion leaves Stripe billing running.** The `subscriptions` row is deleted without a Stripe cancel; the deletes aren't transactional; the user stays in the owner's `linkedUserIds` | `services/api/src/users/users.service.ts:54-66` | [CODE]. Whether any deleted account is still being charged is **[UNVERIFIED]** |
| N7 | No grace period. An owner is blocked immediately on `past_due`; linked members fall to `subscription_required` | `subscription.guard.ts:43-56` | [CODE] |
| N8 | All tokens typed `'paid'` expire in 90 days, including 3/5/10 packs that PO-024 sets at six calendar months | `subscriptions.service.ts:27, 70-75, 282` vs PO-024 rule 9 [UNMERGED] | [CODE]. Already tracked as PO-024 remediation M-1…M-5 (PR #17) |

#### B.3 Option A vs Option B

| Requirement [BASELINE] | A: one subscription, several items | B: separate base and premium subscriptions |
|---|---|---|
| Premium is personal for Duo/Family members | **Fails.** The member's add-on is billed on the owner's subscription and card | **Works.** The premium is on the member's own Stripe customer |
| Independent premium cancellation | Remove the item (prorates by default) | Cancel that subscription only |
| Premium ends with base eligibility | Implicit for the owner | Noetia must enforce it (dependency job) |
| 72-hour grace on base `past_due` | All-or-nothing on one invoice | The resolver reads base status plus a timestamp |
| Restoring base doesn't restore premium | Ambiguous | Natural |
| Plus→X immediately with proration; X→Plus at renewal | Item swap with `always_invoice`; a schedule for the downgrade | Same mechanics on a single-purpose subscription |
| Prorated refund of unused premium | Negative prorations are **not refunded automatically** [EXTERNAL] | Same; a manual refund either way |
| Allowance reset on the individual premium anniversary | Forced onto the base cycle | **Native** |
| Future annual billing | Mixed-interval subscription needed | Independent intervals |
| Financial reporting (PO-022 revenue separation) | Line-level split; webhooks read one item | Separate invoices |
| Card fees [EXTERNAL] (2.9% + 30¢ domestic; +1.5% international; +1% conversion) | One fixed 30¢ | **+30¢ per month**: 6.0% of $5, 3.75% of $8 |
| Stripe Billing fee | ~0.7% of Billing volume **[UNVERIFIED]** | Same |
| Implementation and reliability | Fewer objects, but every handler must become item-aware | More objects, each with one purpose; needs reconciliation and a dependency job |

**Recommendation (engineering, not a decision): Option B for every user.** The deciding reason is the household rule. B also fits the individual anniversary, grace, and independent-cancellation rules. The fee cost belongs in the price model. Final architecture approval remains with the Product Owner [BASELINE].

**Prerequisites before any premium Stripe object exists:**
1. Billing identity per Stripe subscription, not per user. Needs a migration dropping `uq_subscriptions_user`, and a server snapshot first.
2. Item-aware, product-kind-aware webhooks on the current API shapes, after confirming the endpoint version (N1).
3. Tokens only for base-plan invoices, and never for trials (decision needed).
4. A dependency job: when the base ends, cancel the premium and refund unused time.
5. Refund and dispute handlers (N3).
6. Account deletion that cancels every Stripe subscription, in a transaction (N6).
7. NEM-013 ownership enforcement, so no subscription state unlocks books.
8. The ADR-005 entitlement resolver.
9. Legal review of the prorated-refund rule.

### 7.C AI economics and metering readiness

#### C.1 Readiness matrix

| Capability | Status | Evidence |
|---|---|---|
| Provider gateway, model routing | **Documented only** | ADR-001 [POLICY]; PO-005 [UNMERGED]. No AI SDK in any `package.json` [CODE] |
| Token / cost / cache metering, rate cards | **Documented / proposed** | `docs/noetia-plus/07-cost-and-usage-model.md` (historical NEM-003); ADR-005 [DRAFT] |
| Retrieval, embeddings, pgvector | **Documented only** | ADR-004 [POLICY]. No vector migration in `services/api/src/migrations` [CODE]. pgvector validated in staging infrastructure only (NEM-006A, per PO-005) |
| Per-user budgets, reservation, settlement, hard limits | **Proposed** | ADR-005; three-tier `04` |
| Concurrent-request protection, session book lock | **Proposed** | ADR-006 (`SELECT … FOR UPDATE`) |
| Rate limiting | **Partial.** Global 120 requests/min only, not per user or AI-aware | `services/api/src/app.module.ts:35` |
| Cost observability | **Absent** (HTTP counters and latency histograms only) | `services/api/src/metrics/metrics.middleware.ts` |
| Rights-aware retrieval | **Absent**: `books` has no rights fields | `book.entity.ts`; PO-029, three-tier `07` §1 |
| Research sessions, Research Briefs | **Absent** | — |
| Reusable infrastructure | **Implemented** | Redis, BullMQ worker, Sentry, Prometheus/Grafana |

#### C.2 Model prices read on 2026-11-07 [EXTERNAL]

USD per 1M tokens, input / output, standard tier. Retrieved by a web-fetch subagent from the official pages in §8. Items marked † came from a summary of the page rather than its verbatim text, and need re-reading before use.

| Provider | Model | Input / output | Notes |
|---|---|---|---|
| Google | `gemini-3.5-flash-lite` (PO-005 default) | $0.30 / $2.50 | Cached $0.03 plus hourly storage |
| Google | `gemini-3.1-flash-lite` | $0.25 / $1.50 | |
| Google | `gemini-3.8-flash` | $0.75 / $3.75 | **Rises to $1.50 / $7.50 on 2027-01-01** |
| Google | `gemini-4-argon` (Pro) | $2.00 / $10.00 | **Rises to $4.00 / $20.00 on 2026-12-01** |
| Google | `gemini-embedding-001` | $0.15 input † | |
| OpenAI | `gpt-5.6-luna` (PO-005 fallback) | $0.20 / $1.20 | |
| OpenAI | `gpt-6-luna` | $0.10 / $0.50 | Batch −50% |
| OpenAI | `gpt-6-astra` (flagship) | $10.00 / $50.00 | |
| OpenAI | `gpt-5.6-terra` (PO-005 advanced candidate) | **[UNVERIFIED]**, not retrieved | |
| Anthropic | Haiku 5.5 | $0.10 / $0.50 (prompts ≤100K); $0.50 / $2.50 above | Cache read $0.01 |
| Anthropic | Sonnet 5.5 | $2.00 / $10.00 | Cache read $0.10 |
| Anthropic | Opus 5.5 | $4.00 / $20.00 | Cache read $0.20 |

#### C.3 Single-call cost per workload [CALC]

**These are not validated production economics.** One call, expected volume, no cache. Real workflows make several calls, add retrieval and reranking, and retry. At 50% / 200% volume, multiply by 0.5 / 2.

| Workload [BASELINE hypothesis] | Haiku 5.5 / gpt-6-luna | gpt-5.6-luna | gemini-3.5-flash-lite | gemini-3.8-flash | Sonnet 5.5 | Opus 5.5 |
|---|---|---|---|---|---|---|
| Book question (8k / 0.8k) | $0.0012 | $0.0026 | $0.0044 | $0.0090 | $0.024 | $0.048 |
| Three-book comparison (30k / 3k) | $0.0045 | $0.0096 | $0.0165 | $0.0338 | $0.090 | $0.180 |
| Ten-book research (100k / 6k) | $0.013 (luna) – $0.065 (Haiku >100K) | $0.027 | $0.045 | $0.098 | $0.260 | $0.520 |
| Complex Research Brief (150k / 10k) | $0.020 (luna) – $0.100 (Haiku >100K) | $0.042 | $0.070 | $0.150 | $0.400 | $0.800 |

#### C.4 AI budget per subscriber-month at the margin target [CALC]

Contribution margin = (price − card fee − allocation − AI cost) ÷ price.
- Card fee: domestic 2.9% + 30¢ on a separate charge (Option B).
- Not included: taxes, Stripe Billing fee, international surcharge, infrastructure, embeddings, storage, support, refunds, app-store commission.

| Tier | Allocation assumption | AI budget at 55% | AI budget at 65% |
|---|---|---|---|
| Noetia+ $5 | None | $1.81 | $1.31 |
| Noetia+ $5 | Causas 2.22% only (ToS promises 2.22% "of every payment", `terms-of-service.ts:141`) | $1.69 | $1.19 |
| Noetia+ $5 | Causas + Marketing 10% (PO-011, PO-012 [UNMERGED]) | $1.31 | **$0.81** |
| NoetiaX $8 | None | $3.07 | $2.27 |
| NoetiaX $8 | Causas 2.22% only | $2.89 | $2.09 |
| NoetiaX $8 | Causas + Marketing 10% | $2.27 | **$1.47** |

What this implies [CALC]:
- At the tightest budgets, a NoetiaX subscriber can afford about **1.8 Opus-class Briefs** or about 3.7 Sonnet-class Briefs a month.
- A Noetia+ subscriber can afford about 34 Sonnet-class questions or about 670 Haiku-class questions a month.
- PO-001's "≤ ~$1.50 average" guideline gives a Noetia+ margin of 51% with the 10% allocation, 59% with Causas only, and 61% with none. **It satisfies the 55% floor only if Marketing is not allocated.**
- A deeper NoetiaX fits the margin only with small allowances, heavy prompt caching (cache reads cost 90–95% less), or orchestration where the frontier model only synthesises.
- PO-005's default model now costs 3–5× more than Haiku 5.5 or gpt-6-luna. Two Gemini prices double within eight weeks. Both support ADR-005's budgets in internal units, with costs held in versioned rate cards.

#### C.5 Instrumentation and prototype tests required (none performed)

- **Per-call records:** provider, model, route reason, input / cached / output tokens, retries, latency, rate-card version, micro-USD cost. Aggregated per workflow ID.
- **Matrix:** the 4 baseline workloads × 3 volumes (50 / 100 / 200%) × cold and warm cache × at least 3 routing configurations, including multi-call orchestration and retrieval/reranking. Verified public-domain corpus only (PO-029).
- **Quality:** citation precision and recall against source passages, faithfulness, latency P50/P95, failure and retry rate.
- **Usage profiles:** light, typical, heavy, and extreme monthly mixes per tier → P50 / P90 / P99 cost against C.4.
- **Gate:** paid API calls require separate Product Owner authorization (three-tier `06` phase T4).

#### C.6 Unresolved cost assumptions

- Calls per workflow; retrieval and reranking cost.
- Cache hit rate and Gemini cache storage charges.
- Whether Causas and Marketing apply to premium revenue (TT-09).
- Tax-inclusive markets, international card mix, Stripe Billing fee.
- App-store commission if premium is sold in mobile apps (TT-20).
- `gpt-5.6-terra` price; † items in C.2.

### 7.D Documentation reconciliation

**Where the records live.** `main` holds PO-001…004 (as text in `docs/noetia-plus/PRODUCT-DECISIONS.md`) and ADR-001…004 only. Every other record cited below exists only on a branch. The baseline itself is not yet in the repository.

| Record | State and location | Relation to the baseline | Recommended resolution (recommendation only) |
|---|---|---|---|
| PO-001 (AI economics) | [POLICY] `docs/noetia-plus/PRODUCT-DECISIONS.md:9-17` | Bands measure AI ÷ revenue (Healthy ≤25%); the baseline measures contribution margin 55–65%. The ≤ ~$1.50 guideline breaks 55% for Noetia+ if Marketing is allocated (C.4) | PO to state which metric governs, or define bands per tier (TT-09) |
| PO-002…004, ADR-001…004 | [POLICY] | Consistent (provider-agnostic routing, permission before retrieval, modes, pgvector) | None |
| PO-005 (initial models) | [UNMERGED] `nem-007-creator-rights`, `nem-009-resilience-impl` | Consistent in principle; its default model is no longer cost-competitive (C.2) | Revisit after measurement; no ADR change needed (PO-005 says so) |
| PO-006 (canonical prices) | [UNMERGED] | Matches the database and `stripe-setup.md`; ToS on `main` shows Family annual $170.99 (PR #22 pending) | Already tracked (PR #22) |
| PO-010…012 (token value, Causas, Marketing) | [UNMERGED]; read via PR #18 summary only | Determine the allocation rows in C.4 | TT-09 |
| PO-021 (token-based acquisition) | [UNMERGED] PR #12, `DECIDED` | Consistent; **code still unlocks paid books for any subscriber** (B.1) | NEM-013 |
| **PO-022** (independent Noetia+) | [UNMERGED] PR #12, **`DECIDED`** | **Conflicts.** "Purchasable independently… does not require a book-token subscription" vs the baseline prerequisite | Accept PO-022 Amendment 1 (PR #18 / PR #35 drafts) or supersede by publishing the baseline |
| **PO-023** (subscription-free acquisition) | [UNMERGED] PR #12, **`DECIDED`** | **Conflicts** on rules 6–8 (rule 7: "Noetia+ without a book-token plan") | Accept PO-023 Amendment 1 |
| PO-024 (token expiry) | [UNMERGED] PR #17, `DECIDED` | Consistent with "tokens independent of AI". **Code conflicts**: 90 days for all purchased tokens (N8) | PO-024 remediation M-1…M-5 |
| PO-025 (three tiers) | [DRAFT] PR #35 | Invariant 7 "prices not set" is superseded by $5 / $8. Open TT-16 "premium includes tokens?" is implicitly *no* | Update before acceptance; confirm *no tokens* |
| **PO-026** (prerequisite) | [DRAFT] PR #35 | **Conflicts:** "`linkedUserIds` grants nothing", states and lifecycle open. The baseline: personal premium for eligible members, 72-hour `past_due` grace, Option B preferred, prorated refunds, no auto-reactivation | Revise PO-026 to carry the baseline; `trialing` and `canceling` remain open |
| PO-027, PO-028, PO-029 | [DRAFT] PR #35 | Consistent. PO-029 means **no book is eligible today** (three-tier `07` §1) | Accept; TT-26 blocks any pilot corpus |
| **ADR-005** | [DRAFT] PR #35 | Consistent on resolver, units vs micro-USD, reservation and settlement. **Conflicts** on household ("`linkedUserIds` grants nothing unless TT-15") | Amend once PO-026 is revised |
| ADR-006 | [DRAFT] PR #35 | Consistent | None |
| NEM-003 `07`, `08` | [POLICY] historical design | `07` lists "optional future AI-credit add-ons" (`07:64`), consistent with "none at launch". `08`'s standalone Noetia+ quadrant is superseded | Leave as historical (TT-21 ruling) |
| Three-tier `05` TT-10, TT-11 | [PROPOSED] PR #34/#35 | **Decided by the baseline:** % remaining, progress, renewal date; reset on the premium anniversary; no rollover, overage, or add-ons; notifications at 70/85/95/100%; hard limit | Record as PO decisions when the baseline is published |
| Three-tier `05` TT-07, TT-14, TT-17, TT-20, TT-22, TT-23, TT-26 | [OPEN] | Not addressed by the baseline | Remain open (§16) |
| Unit economics (PR #18) | Analysis | W-2 (Noetia+ ≤ $6) is consistent with $5. No ceiling existed for NoetiaX | None |
| ToS on `main` | [CODE] | Causas "2.22% of every payment" applies to premium unless amended. Family "up to 4 members" | TT-09; household-size decision |
| `docs/stripe-setup.md` | [POLICY] doc | Its `041` procedure does not update legacy rows (A.2) | Correct with the pricing-catalog mission |

The T0 report (PR #35) also lists conflicts in PR #12's impact assessment (C-08), PR #17's impact assessment §6, and PR #18's amendment wording. They were **not re-read** for this report.

### 7.E Implementation sequence (recommendation only)

Each step needs its own approved mission and an explicit Product Owner execution instruction. Reader work keeps priority (CLAUDE.md, Product Hierarchy). The phase codes T1–T9 are those of three-tier `06`. This sequence adds the base-billing work that `06` does not cover.

| Step | Work | Depends on | Why in this position | Authorization needed |
|---|---|---|---|---|
| **E0** | Read-only operations checks: Stripe webhook endpoint API version (N1); live Stripe prices vs `plans` rows (A.2); count of deleted accounts with active Stripe subscriptions (N6) | — | Converts the three largest unknowns into facts; no writes | Read-only production and Stripe access |
| **E1** | **Base billing integrity:** deletion cancels Stripe in a transaction; duplicate-checkout guard; `canceled` mapping; refund and dispute handling; trial token rule; current API field shapes; PO-024 expiry remediation (PR #17 M-1…M-5) | E0 | Affects **current** customers whether or not premium ships | New NEM; code + tests; deploy authorization |
| **E2** | Release A (PR #14: NEM-011/012/014/015) and **NEM-013** ownership enforcement | E1 can run in parallel | Premium must never unlock books (PO-021) | Existing missions |
| **E3** | **Pricing catalog** (M-C product lines) and the read-only Stripe reconciliation; web, mobile, and gifts read from it; no price changes | E0 | A single authority must exist before new prices | New NEM; migration |
| **E4** | **Billing foundation** (M-D): identity per Stripe subscription; product-kind-aware, item-aware webhooks; tokens only for base-plan invoices | E1, E3 | Removes the B.1 hazards | New NEM; migration that drops a constraint → server snapshot |
| **E5** | **T1 control plane, dark** (NEM-019 draft): resolver, tier policies, budget ledger with reservation and settlement, fake provider | Can start in parallel with E1–E4 (no billing, no AI spend) | Lets the limits be tested before any cost is incurred | NEM-019 approval |
| **E6** | T2 evaluation methodology; T3 semantic foundation; rights records and the verified public-domain pilot set | E5; TT-26 | No book is eligible today | NEM(s); legal input |
| **E7** | **T4 gateway with metering and shadow measurement**; the C.5 prototype matrix | E5, E6 | The only way to validate allowances | **Paid API authorization** |
| **E8** | PO sets allowances and confirms the $5 / $8 viability from measured P50–P99; T5 Noetia+ beta, T6 Brief MVP, T7 NoetiaX beta | E7 | Allowances stay unapproved until measured [BASELINE] | PO decisions; beta missions |
| **E9** | **T8 premium billing (Option B, after technical approval):** premium products and prices in the catalog; dependency job; 72-hour grace; upgrade proration and downgrade schedules; prorated refunds; then T9 release and mobile (TT-20) | E2, E4, E8; legal review of refunds; TT-22 Terms/Privacy | Billing last, on a safe foundation | Stripe configuration; deployment |

## 8. External references

All accessed **2026-11-07** by a read-only web-fetch subagent of this session.

| Topic | URL | Result |
|---|---|---|
| Stripe card fees | https://stripe.com/pricing | 2.9% + 30¢ domestic; +1.5% international; +1% conversion: verbatim. Billing ~0.7%: **not verified** (page truncated) |
| Subscription period fields moved (basil) | https://docs.stripe.com/changelog/basil/2025-03-31/deprecate-subscription-current-period-start-and-end | Verified |
| `invoice.subscription` replaced by `invoice.parent…` (basil) | https://docs.stripe.com/changelog/basil/2025-03-31/adds-new-parent-field-to-invoicing-objects | Verified |
| Multiple products per subscription | https://docs.stripe.com/billing/subscriptions/multiple-products | Single combined invoice; same currency; mixed-interval option. Removing items: see prorations |
| Prorations | https://docs.stripe.com/billing/subscriptions/prorations | `always_invoice` for immediate upgrade billing; item removal prorates; `cancel_at_period_end` does not; negative prorations are not refunded automatically |
| Webhook versioning | https://docs.stripe.com/webhooks/versioning | Each endpoint has its own API version that shapes its payloads |
| Gemini pricing | https://aistudio.google.com/docs/pricing (redirected from ai.google.dev/gemini-api/docs/pricing) | Flash / Flash-Lite verbatim; Pro and embedding partly summary (†) |
| OpenAI pricing | https://developers.openai.com/api/docs/pricing (redirected from platform.openai.com/docs/pricing; openai.com/api/pricing returned 403) | Verified |
| Anthropic pricing | https://platform.claude.com/docs/en/about-claude/pricing (redirected from docs.claude.com) | Verified |

## 9. Risks

| ID | Rating | Risk | Ref |
|---|---|---|---|
| R1 | **Critical** | Any premium Stripe subscription on current code overwrites or erases the base plan, mints book tokens, and can cancel reading access | B.1 |
| R2 | **Critical** | Deleted accounts may still be charged by Stripe (live extent unverified) | N6 |
| R3 | **High** | Duplicate checkout creates an untracked, still-billing Stripe subscription | N5 |
| R4 | **High** | Stripe API version mismatch: `syncSubscription` writes an Invalid Date; webhook processing could silently stop if the endpoint is on basil or later (unverified) | N1 |
| R5 | **High** | Refunds and disputes leave tokens and access in place | N3 |
| R6 | **High** | Legacy plan Stripe price IDs can't be traced, and the documented procedure doesn't fix them | A.2 |
| R7 | **High** | No AI cost controls exist; NoetiaX depth on frontier models can exceed the margin; provider prices are rising | C.1–C.4 |
| R8 | **High** | No rights records: the eligible AI corpus is empty | 7.D (PO-029) |
| R9 | **High** | Governing decisions are unmerged, and two `DECIDED` records contradict the baseline | 7.D |
| R10 | Medium | Trial invoices issue paid tokens; trials repeat | N4 |
| R11 | Medium | 90-day expiry on all purchased tokens contradicts PO-024 | N8 |
| R12 | Medium | No `past_due` grace; linked members lose access silently | N7 |
| R13 | Medium | `canceled` recorded as `none` | N2 |
| R14 | Medium | Family size 4 vs 5 across ToS, database, and mobile | A.2 |
| R15 | Medium | App-store commission for premium in mobile apps is unmodelled | TT-20 |
| R16 | Medium | Option B adds about $0.30/month per premium subscriber in fixed card fees | B.3 |
| R17 | Low | Stale "$9.99/mes" SEO text; hardcoded gift and mobile prices | A.1 |
| R18 | Low | `GET /subscriptions/plans` exposes every row including `stripePriceId` | A.2 |
| R19 | Low | Account deletion is not transactional and leaves orphaned `linkedUserIds` | N6 |

## 10. Decisions

### 10.a Made under existing authority (engineering and reporting choices, not product decisions)

- Report path and identifier as approved by the PO.
- Audit E interpreted as the implementation sequence with prerequisites (§4).
- Branch based on `origin/main` through a separate worktree, so the operator's checkout and its local `.claude/settings.local.json` change are untouched.
- No product decision, price, or policy was changed.

### 10.b Product Owner decisions in force for this audit [BASELINE, approved planning decisions]

- Noetia+ $5/month and NoetiaX $8/month, each on top of a qualifying Noetia subscription.
- Premium is personal for eligible Individual, Duo, and Family members.
- AI allowances are independent of book tokens.
- Target premium contribution margin 55–65%.
- Adaptive, provider-agnostic routing.
- Monthly allowances remain **unapproved** pending economic validation.
- Separate Stripe subscriptions are **preferred, pending final technical approval**.

### 10.c Decisions requiring the Product Owner

See §16.

## 11. Recommendations

**Required before any premium launch:** §7.B.3 prerequisites 1–9; E0–E4 and E7 of §7.E; publishing the baseline and resolving the PO-022 / PO-023 / PO-026 / ADR-005 conflicts.

**Required regardless of premium (current customers):** N1, N3, N5, N6 (E0–E1), and PO-024 remediation.

**Optional improvements:** remove `stripePriceId` from the public plans response; replace the stale SEO price; move gift and mobile prices to the catalog once it exists; add AI-cost dashboards when the gateway exists.

## 12. Changes made

| Item | Change |
|---|---|
| Files | **Created** `docs/reports/2026-11-07-SA-003-pricing-subscriptions-ai-economics-readiness-audit.md` (this report). The governance files of the same PR are listed in its description |
| Application code, tests | None |
| Database, migrations, backfills | None |
| Configuration, environment, secrets | None. `.claude/settings.local.json` not staged |
| External services (Stripe, AI providers, DNS) | None. No paid API call |
| Deployment | None |
| Commit | Recorded in the PR |

## 13. Tests and validation

- **No tests, builds, migrations, or scripts were run.** No paid API experiment was performed.
- Validation was static: code reading with `file:line` references, `git show` / `git ls-tree` on the refs in §3, `gh pr list` (read-only), and official web pages (§8).
- All AI cost figures are arithmetic on published prices and the baseline's hypothetical workloads. They are not measurements.

## 14. Deviations and discoveries

- **Deviation:** Rev 1 was delivered without stopping to escalate the conflict between the brief's no-write restriction and the reporting protocol's Draft-PR rule; the conflict was only mentioned. This is corrected by the consolidated protocol (`docs/reports/README.md` §6).
- **Discoveries outside the original question:** N5 (duplicate checkout), N6 (deletion billing), and the Causas "every payment" ToS clause affecting premium economics.

## 15. Protected-systems confirmation

Not modified: the reader and Escucha Activa, book ownership and the token ledger, subscriptions and billing code, Stripe, the database and migrations, production and staging infrastructure, business-rule engines, and existing PRs #16, #23, #34, #35.

## 16. Open questions and unresolved items

**Product Owner decisions**

| # | Question | Tracker |
|---|---|---|
| D1 | Publish *Three-Tier Product & AI Economics Specification v1.0* and amend or supersede PO-022, PO-023, PO-025, PO-026, ADR-005 | — |
| D2 | Do Causas (2.22%) and Marketing (7.78%) apply to premium revenue? Does the creator share? | TT-09 |
| D3 | Which metric governs: PO-001 cost bands or the 55–65% contribution margin? | TT-09 |
| D4 | Does a `trialing` or `canceling` base plan qualify? Does premium have a trial? Do trial invoices issue tokens? | TT-15, TT-16 |
| D5 | Family member cap: 4 or 5 | — |
| D6 | Prorated premium refunds: legal sign-off and mechanism | TT-16 |
| D7 | Final approval of Option B | TT-16 |
| D8 | NoetiaX depth capabilities and their acceptance benchmark | TT-07 |
| D9 | Retention after cancellation or downgrade; Brief format; mobile store billing; AI Terms/Privacy; pilot participants; rights evidence standard | TT-14, TT-17, TT-20, TT-22, TT-23, TT-26 |
| D10 | Authorization for E0 read-only production/Stripe checks and for any later step of §7.E | — |

**Unverified items:** live Stripe price IDs and amounts; webhook endpoint API version; deleted accounts still being charged; Stripe Billing fee; `gpt-5.6-terra` price; Gemini Pro and embedding figures marked †; Stripe's $0 trial invoice behaviour.

## 17. Next recommended action

Product Owner review of this report and of the reporting-protocol consolidation in the same Draft PR. Then, if approved, authorize **E0** (read-only Stripe and production checks), which would turn R2, R4, and R6 from unverified into measured. *Recommendation only; nothing is executed without explicit authorization.*
