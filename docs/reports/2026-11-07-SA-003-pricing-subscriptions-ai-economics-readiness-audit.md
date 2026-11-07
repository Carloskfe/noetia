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

> **Current recommendation status (Rev 7).**
> - Noetia is **pre-launch** (Product Owner, 2026-11-07).
> - The **current** roadmap and architecture recommendation is **[Revision 5](#revision-5--pre-launch-architecture-reassessment-2026-11-07)**, accepted by the Product Owner as the working pre-launch recommendation. It is subject to Product Owner clarifications, and it is **not approved policy**.
> - §7.E, §11, and §17 below are preserved as written in Rev 1–3 and marked **SUPERSEDED**. Their findings (§7.A–§7.D, §9) remain valid evidence unless a later revision says otherwise.
> - **Q4 DECIDED (Product Owner, 2026-11-07):** Noetia, Noetia+, and NoetiaX launch commercially **together**; readiness of all three tiers is a mandatory public-launch gate. See **[Revision 7](#revision-7--q4-decided-coordinated-commercial-launch-2026-11-07)**.
> - Annexes: **[A — NEM-020 mission draft](2026-11-07-SA-003-annex-A-NEM-020-mission-draft.md)** · **[B — ADR-007 draft](2026-11-07-SA-003-annex-B-ADR-007-draft.md)**.

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
| **Lifecycle status** | **Review**: Rev 7, awaiting Product Owner review. Q4 decided (coordinated launch, 2026-11-07). Rev 5 accepted as the working pre-launch recommendation (2026-11-07) |
| **Delivery state** | **Not merged.** Nothing deployed |
| **This report authorizes** | **Nothing.** Its recommendations are not approved engineering instructions |

### Revision history

| Rev | Date | Change |
|---|---|---|
| 1 | 2026-11-07 | Audits A, B, C and a partial D, delivered in the agent response only (repository writes were prohibited) |
| 2 | 2026-11-07 | Audit D completed, Audit E added, risks rated, mission information added; published under the documentation-only authorization |
| 3 | 2026-11-07 | Product Owner review corrections, documentation only. (1) C.4 restated as **preliminary upper-bound spending envelopes before omitted variable costs**, with the omitted costs listed; explicitly not allowances or guaranteed margins. (2) New B.4: Stripe cancellation and database deletion **cannot be atomic through a database transaction**; requirements for an idempotent, retryable, recoverable, reconciled workflow (not implemented); prerequisite 6 and E1 reworded. (3) Evidence status made explicit: per-price status in C.2, an N1 evidence chain, and the §16 verification register. No new research; no paid API call; no production access |
| 4 | 2026-11-07 | Pre-launch context correction (Product Owner: no paying subscribers, no active paid subscriptions). First revised roadmap P0–P10 and a simplification list. Delivered in the response as *pending publication*; published here in Rev 6. **Partly superseded by Rev 5** (its "E0 dropped" is withdrawn) |
| 5 | 2026-11-07 | Pre-launch architecture reassessment: eliminations, target architecture, household entitlements, implementation order, launch blockers, dependencies, first mission NEM-020. Delivered in the response as *pending publication*; published here in Rev 6. **Accepted by the Product Owner as the working pre-launch recommendation**, subject to clarifications |
| 6 | 2026-11-07 | Publication of Rev 4 and Rev 5. Annex A (NEM-020 draft) and Annex B (ADR-007 draft). Dependency and conflict register for PRs #34 / #35, including NEM-019 household eligibility. Verification register updated (V3 and V7 now verified). No new code reading beyond that listed in Rev 6 §R6.3 |
| 7 | 2026-11-07 | Product Owner decision **Q4 recorded as DECIDED**: one coordinated commercial launch for Noetia, Noetia+, and NoetiaX; independent private betas; unified mandatory launch gate; roadmap updated; conflicts C13–C14 with #34 / #35 identified (not modified). Annex B touched up. Planning only |

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
5. **Economics depend on routing [CALC, not measured].** At 55–65% contribution margin, the **preliminary upper-bound AI spending envelope** is about **$0.81–$1.81** per Noetia+ subscriber-month and **$1.47–$3.07** per NoetiaX subscriber-month, depending on whether Causas/Marketing allocations apply. These are ceilings **before** taxes, infrastructure, embeddings, storage, support, refunds, international and Billing fees, and app-store commission, all of which reduce them. They are **not** AI allowances, and they guarantee no contribution margin (§7.C.4). A single Opus-class Research Brief costs about $0.80 as one call.
6. **Option B (separate base and premium Stripe subscriptions) is the recommended architecture**, because personal premium for Duo/Family members can't be billed correctly on the owner's subscription. It costs about **$0.30 per premium subscriber-month** in extra fixed card fees.
7. **The governing records conflict with the baseline.** PO-022 and PO-023, both `DECIDED` but unmerged, allow a standalone Noetia+. Draft PO-026 and ADR-005 deny household eligibility. None of PO-005…029 or ADR-005/006 is on `main`.

## 6. Work completed

| Iteration | Work |
|---|---|
| Rev 1 | Audits A (pricing), B (billing), C (AI readiness and economics), D (partial). External verification of Stripe and model pricing via a web-fetch subagent. Delivered in the response |
| Rev 2 | Read the three-tier package (`README`, `01`, `04`, `05`, `06`, `07`), PO-021…024, PO-028, ToS Causas and household text on `main`, NEM-003 `07`. Completed Audit D, wrote Audit E, rated risks, and published this report |
| Rev 3 | Applied three PO review corrections (see revision history). Re-read the Stripe client constructors (`subscriptions.service.ts:57`, `webhooks.controller.ts:28`, `gifts.service.ts:42`) and `CLAUDE.md` §Infrastructure & Vendors; no other new evidence |

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
| N1 | **Stripe API version mismatch.** The code reads pre-`basil` field shapes, while the installed SDK pins a later API version | Code: `subscriptions.service.ts:503-507` reads `stripeSub.current_period_end`; `webhooks.service.ts:121-128, 186` read `invoice.subscription` and `sub.current_period_end`. Clients are built as `new Stripe(key)` with no `apiVersion` (`subscriptions.service.ts:57`, `webhooks.controller.ts:28`, `gifts.service.ts:42`) | See the evidence chain below |

**N1 evidence chain**, each link with its own status:

| # | Claim | Status | Evidence |
|---|---|---|---|
| 1 | The installed SDK is `stripe` 22.2.0 and declares `ApiVersion = '2026-05-27.dahlia'` | **[CODE]** | `services/api/node_modules/stripe/cjs/apiVersion.js:5`; `package-lock.json` |
| 2 | No `apiVersion` is passed when the clients are constructed | **[CODE]** | Constructor calls above |
| 3 | With no `apiVersion`, the SDK sends its pinned version on API requests | **Rev 6: verified as the documented default** (stripe-node README: "If not set, stripe-node will use the latest version at the time of release", accessed 2026-11-07). The per-request header is not stated on that page | stripe-node README |
| 4 | Since `2025-03-31.basil`, `current_period_start`/`_end` are no longer on the Subscription resource but on subscription items | **[EXTERNAL]**, verified 2026-11-07 | basil changelog (§8) |
| 5 | Since basil, `invoice.subscription` is replaced by `invoice.parent.subscription_details.subscription`. The page calls it "deprecated" in its body and "Removed" in its change table | **[EXTERNAL]**, verified 2026-11-07 | basil changelog (§8) |
| 6 | Webhook payloads are shaped by **the webhook endpoint's own API version** | **[EXTERNAL]**, verified 2026-11-07 | Webhook versioning page (§8) |
| 7 | The API version of Noetia's production webhook endpoint | **[UNVERIFIED]**. Visible only in the Stripe dashboard or API, which this audit could not access | Needs E0 |
| 8 | Stripe is live in production at all | **[UNVERIFIED]**. `CLAUDE.md` §Infrastructure & Vendors states "Keys not yet in `.env.production`" (documentation, possibly stale) | Needs E0 |

**Conclusions:**
- **If 3 holds:** `syncSubscription` writes an Invalid Date. This is an inference from links 1–4, not an observed failure.
- **If 7 is basil or later:** `invoice.paid` returns at `webhooks.service.ts:128` (no status update, no tokens), and `subscription.updated` reads an undefined period end.
- **If 7 is earlier:** the webhooks keep working, and only the SDK path is affected.
- **If 8 is false:** none of this affects customers today.
| N2 | `customer.subscription.updated` with `status: 'canceled'` is recorded as `'none'` | `webhooks.service.ts:170-174` | [CODE] |
| N3 | No `charge.refunded` or `charge.dispute.*` handling: tokens and access survive refunds and disputes | `webhooks.service.ts:55-77` | [CODE] |
| N4 | The $0 trial invoice fires `invoice.paid` and issues tokens typed `'paid'`. No prior-trial check, so trials repeat | `webhooks.service.ts:141`; `subscriptions.service.ts:216` | [CODE]. Stripe's $0 trial invoice behaviour is from documentation knowledge, **[UNVERIFIED]** this session |
| N5 | A second checkout while subscribed creates a second Stripe subscription; the upsert overwrites the row; the first keeps billing, untracked | `subscriptions.service.ts:207-221` (no existing-subscription check) | [CODE] |
| N6 | **Account deletion leaves Stripe billing running.** The `subscriptions` row is deleted without a Stripe cancel; the database deletes aren't wrapped in a transaction; the user stays in the owner's `linkedUserIds`. A database transaction alone cannot fix the Stripe part (see B.4) | `services/api/src/users/users.service.ts:54-66` | Code path **[CODE]**. Whether any deleted account is still being charged is **[UNVERIFIED]** and depends on N1 link 8 |
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
6. Account deletion that reliably cancels every Stripe subscription, through the idempotent, recoverable, reconciled workflow in B.4. A database transaction covers only the database part (N6).
7. NEM-013 ownership enforcement, so no subscription state unlocks books.
8. The ADR-005 entitlement resolver.
9. Legal review of the prorated-refund rule.

#### B.4 Account deletion and Stripe cancellation cannot be atomic (requirements only; not implemented)

**Why a transaction is not enough.** Stripe is an external system. A PostgreSQL transaction can make the local deletes all-or-nothing, but it cannot include, roll back, or guarantee a Stripe API call. Every ordering has a failure window:

| Order | Failure | Result |
|---|---|---|
| Delete the database rows, then cancel in Stripe | Stripe call fails, times out, or the process crashes | **The customer keeps being charged**, and Noetia no longer holds the identifiers needed to find the subscription (today's behaviour, minus even the attempt) |
| Cancel in Stripe inside an open database transaction | The commit fails after Stripe succeeded | Stripe is canceled but the account still exists; the transaction also holds locks during a network call |
| Cancel in Stripe, then delete the database rows | The deletion fails after the cancel | The account remains with billing ended. **The safest failure**: it is recoverable by retry |

**Requirements for a future mission** (design direction only; mechanism and wording to be approved):

1. **Durable deletion request.** Deletion is recorded as a request with a state, for example `requested → billing_canceled → data_deleted`, with `failed` / `needs_review` states. The user's session ends and access stops immediately, but the minimum billing identifiers (`stripeCustomerId`, subscription IDs) are kept until Stripe cancellation is confirmed.
2. **Cancel before erase.** Stripe cancellation, plus any refund decision, must succeed or be confirmed before the identifiers are destroyed.
3. **Idempotency.** Every step can be repeated safely: cancelling an already-canceled subscription counts as success, and Stripe requests carry idempotency keys derived from the deletion request. *Rev 6: Stripe request idempotency keys are verified (https://docs.stripe.com/api/idempotent_requests, accessed 2026-11-07): POST requests accept them; a retry with the same key returns the saved response; different parameters with the same key error.*
4. **Retries.** Asynchronous, with backoff and a retry ceiling (for example on the existing BullMQ worker). Exhausted retries move the request to `needs_review` and alert an operator. They never silently drop it.
5. **Failure recovery.** A crash at any point resumes from the recorded state. No step depends on in-memory state.
6. **Confirmation.** The `customer.subscription.deleted` webhook, or a Stripe read-back, confirms the cancel before the request advances.
7. **Reconciliation.** A periodic read-only job compares Stripe subscriptions still active against Noetia's accounts, for example by the `noetiaUserId` customer metadata set at `subscriptions.service.ts:199-202`. It reports orphans, including any left by past deletions (R2), for operator action.
8. **Coverage.** All of the user's subscriptions: base, premium (Option B), and any duplicates from N5. Linked memberships are cleaned up as well.
9. **Open policy questions:** refunds for unused paid time at deletion (D6); how long minimal billing identifiers may be retained under privacy and financial-retention rules (PO-017, [UNMERGED], not read in this audit).

None of this is implemented or authorized. It belongs to step **E1** (§7.E).

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

USD per 1M tokens, input / output, standard tier.

**How these were obtained.**
- A read-only web-fetch subagent of this session read the official pages in §8 on **2026-11-07**. The report author did not independently re-read them.
- **No paid API call was made**, so no price was confirmed against an invoice or a billed request.
- Provider prices change without notice (two scheduled increases are listed below). Re-verify every figure on the day it is used.

**Status key:** **V** = read from the page's verbatim text · **S** = taken from an automated summary of part of the page; re-read before use · **U** = not retrieved.

| Provider | Model | Input / output | Notes | Status |
|---|---|---|---|---|
| Google | `gemini-3.5-flash-lite` (PO-005 default) | $0.30 / $2.50 | Cached $0.03 plus hourly storage. The page summary wrongly said this model was absent; the verbatim table lists it | V |
| Google | `gemini-3.1-flash-lite` | $0.25 / $1.50 | | V |
| Google | `gemini-3.8-flash` | $0.75 / $3.75 | **Rises to $1.50 / $7.50 on 2027-01-01** | V |
| Google | `gemini-4-argon` (Pro) | $2.00 / $10.00 | **Rises to $4.00 / $20.00 on 2026-12-01** | V |
| Google | `gemini-3.1-pro-preview` | $2.00 / $12.00 (≤200K) | Not used in C.3 | S |
| Google | `gemini-embedding-001` | $0.15 input | | S |
| OpenAI | `gpt-5.6-luna` (PO-005 fallback) | $0.20 / $1.20 | | V |
| OpenAI | `gpt-6-luna` | $0.10 / $0.50 | Batch −50%; higher above 272K context | V |
| OpenAI | `gpt-6-astra` (flagship) | $10.00 / $50.00 | | V |
| OpenAI | `gpt-5.6-terra` (PO-005 advanced candidate) | — | Not retrieved | **U** |
| Anthropic | Haiku 5.5 | $0.10 / $0.50 (prompts ≤100K); $0.50 / $2.50 above | Cache read $0.01 | V |
| Anthropic | Sonnet 5.5 | $2.00 / $10.00 | Cache read $0.10 | V |
| Anthropic | Opus 5.5 | $4.00 / $20.00 | Cache read $0.20 | V |

The C.3 costs inherit these statuses. Any figure built on an **S** or **U** price is unverified.

#### C.3 Single-call cost per workload [CALC]

**These are not validated production economics.** One call, expected volume, no cache. Real workflows make several calls, add retrieval and reranking, and retry. At 50% / 200% volume, multiply by 0.5 / 2.

| Workload [BASELINE hypothesis] | Haiku 5.5 / gpt-6-luna | gpt-5.6-luna | gemini-3.5-flash-lite | gemini-3.8-flash | Sonnet 5.5 | Opus 5.5 |
|---|---|---|---|---|---|---|
| Book question (8k / 0.8k) | $0.0012 | $0.0026 | $0.0044 | $0.0090 | $0.024 | $0.048 |
| Three-book comparison (30k / 3k) | $0.0045 | $0.0096 | $0.0165 | $0.0338 | $0.090 | $0.180 |
| Ten-book research (100k / 6k) | $0.013 (luna) – $0.065 (Haiku >100K) | $0.027 | $0.045 | $0.098 | $0.260 | $0.520 |
| Complex Research Brief (150k / 10k) | $0.020 (luna) – $0.100 (Haiku >100K) | $0.042 | $0.070 | $0.150 | $0.400 | $0.800 |

#### C.4 Preliminary AI spending envelopes: upper bounds before omitted variable costs [CALC]

> **Read this first.** The figures below are **preliminary upper bounds**: the most that could be spent on AI per subscriber-month if the omitted costs listed below were zero.
> - They are **not AI allowances**. Allowances remain unapproved pending measurement [BASELINE].
> - They are **not guaranteed contribution margins**. Every omitted cost lowers the envelope one-for-one, so the real envelope is smaller by an amount not yet measured.
> - Neither the realised margin nor a safe allowance can be stated until those costs are measured (§7.C.5) and the Product Owner approves the allocation basis (TT-09).

Formula: envelope = price − card fee − allocation − (target margin × price). The same formula gives contribution margin = (price − card fee − allocation − AI cost) ÷ price.

| Input | Value used | Evidence status |
|---|---|---|
| Prices | $5 / $8 | [BASELINE], approved planning values |
| Card fee | Domestic 2.9% + 30¢ on a separate charge (Option B) | [EXTERNAL] verbatim, stripe.com/pricing, 2026-11-07 |
| Causas 2.22% | Applied in the second and third rows | [CODE] ToS text on `main`. Whether it applies to premium is [OPEN] (TT-09) |
| Marketing 7.78% | Applied in the third row | [UNMERGED] PO-012, read through the PR #18 summary only. Application to premium [OPEN] |

**Omitted variable costs** (each one lowers the envelope; none is measured):

| Omitted cost | Illustrative effect | Status |
|---|---|---|
| Stripe Billing fee (~0.7% of Billing volume) | −$0.035 on $5; −$0.056 on $8 | **[UNVERIFIED]**; the figure came from a truncated page summary |
| International card surcharge (+1.5%) | −$0.075 on $5; −$0.12 on $8, per international charge | [EXTERNAL] verbatim; card mix unknown |
| Currency conversion (+1%) | −$0.05 / −$0.08 where it applies | [EXTERNAL] verbatim; currency mix unknown |
| Taxes in tax-inclusive markets | Potentially larger than all the others combined (PR #18 illustrates 16–19%) | [ASSUMPTION]; markets undecided |
| Embeddings, retrieval, reranking, vector storage | Unknown | Not measured |
| Infrastructure, Brief storage, retention after cancel | Unknown | Not measured |
| Retries, failed workflows, abuse | Unknown | Not measured |
| Refunds, prorated refunds, disputes | Unknown | Not measured; refund policy [OPEN] (D6) |
| Support | Unknown | Not measured |
| App-store commission, if sold in mobile apps | Could exceed the entire envelope | [OPEN] (TT-20) |

| Tier | Allocation assumption | Upper-bound envelope at 55% | Upper-bound envelope at 65% |
|---|---|---|---|
| Noetia+ $5 | None | $1.81 | $1.31 |
| Noetia+ $5 | Causas 2.22% only (ToS promises 2.22% "of every payment", `terms-of-service.ts:141`) | $1.69 | $1.19 |
| Noetia+ $5 | Causas + Marketing 10% (PO-011, PO-012 [UNMERGED]) | $1.31 | **$0.81** |
| NoetiaX $8 | None | $3.07 | $2.27 |
| NoetiaX $8 | Causas 2.22% only | $2.89 | $2.09 |
| NoetiaX $8 | Causas + Marketing 10% | $2.27 | **$1.47** |

What this implies [CALC]. Every figure below is an **upper bound** that omitted costs reduce:
- At the tightest envelopes, a NoetiaX subscriber could afford **at most** about **1.8 Opus-class Briefs** or about 3.7 Sonnet-class Briefs a month, as single calls.
- A Noetia+ subscriber could afford **at most** about 34 Sonnet-class questions or about 670 Haiku-class questions a month.
- PO-001's "≤ ~$1.50 average" guideline gives a Noetia+ margin, **before omitted costs**, of 51% with the 10% allocation, 59% with Causas only, and 61% with none. **It cannot reach the 55% floor if Marketing is allocated.** With omitted costs included, the margins are lower than these figures by an unmeasured amount.
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

> **SUPERSEDED by Revision 5 (§R5.4).** Kept for traceability. E1–E9 assumed a post-launch repair path. Under the pre-launch context, E3, E4, and E9 merge into a single billing design and rebuild. E0 returns as the NEM-020 inventory.

Each step needs its own approved mission and an explicit Product Owner execution instruction. Reader work keeps priority (CLAUDE.md, Product Hierarchy). The phase codes T1–T9 are those of three-tier `06`. This sequence adds the base-billing work that `06` does not cover.

| Step | Work | Depends on | Why in this position | Authorization needed |
|---|---|---|---|---|
| **E0** | Read-only operations checks: Stripe webhook endpoint API version (N1); live Stripe prices vs `plans` rows (A.2); count of deleted accounts with active Stripe subscriptions (N6) | — | Converts the three largest unknowns into facts; no writes | Read-only production and Stripe access |
| **E1** | **Base billing integrity:** idempotent, retryable, reconciled deletion-cancellation workflow (§7.B.4); duplicate-checkout guard; `canceled` mapping; refund and dispute handling; trial token rule; current API field shapes; PO-024 expiry remediation (PR #17 M-1…M-5) | E0 | Affects **current** customers whether or not premium ships | New NEM; code + tests; deploy authorization |
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
| R2 | **Critical** | Deleted accounts may still be charged by Stripe. The code path is verified; the live extent is unverified and depends on Stripe being live (V1, V5) | N6, B.4 |
| R3 | **High** | Duplicate checkout creates an untracked, still-billing Stripe subscription | N5 |
| R4 | **High** | Stripe API version mismatch: `syncSubscription` is inferred to write an Invalid Date (V3), and webhook processing could silently stop if the endpoint is on basil or later (V2). Both depend on Stripe being live (V1) | N1 |
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

> **SUPERSEDED by Revision 5 (§R5.10).** Kept for traceability.

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
| Commit | `6c06467` (initial), `2d8beaa` (index link), and the Rev 3 correction commit, all on PR [#36](https://github.com/Carloskfe/noetia/pull/36) |

## 13. Tests and validation

- **No tests, builds, migrations, or scripts were run.** No paid API experiment was performed.
- Validation was static: code reading with `file:line` references, `git show` / `git ls-tree` on the refs in §3, `gh pr list` (read-only), and official web pages (§8).
- All AI cost figures are arithmetic on published prices and the baseline's hypothetical workloads. They are not measurements. The C.4 envelopes are upper bounds before omitted costs.
- Rev 3 added no new external research and accessed no production system or paid API. The status of each unverified claim is in the §16 verification register.

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

**Verification register.** Every claim this report depends on but could not verify. Nothing here was checked against production or a paid API.

| # | Claim or assumption | Status | Basis in this report | How it would be verified | Authorization needed |
|---|---|---|---|---|---|
| V1 | Stripe is live in production | **[UNVERIFIED]**; `CLAUDE.md` says keys are not yet in `.env.production` | N1 link 8 | Read production configuration (presence only, never values) | E0 |
| V2 | API version of the production webhook endpoint | **[UNVERIFIED]** | N1 link 7 | Stripe dashboard or API read | E0 |
| V3 | The SDK sends its pinned `dahlia` version when none is configured | **Rev 6: VERIFIED (documented default)**. stripe-node README: "If not set, stripe-node will use the latest version at the time of release" (accessed 2026-11-07). The per-request header is not stated | N1 link 3 | Read the SDK source or Stripe's SDK versioning docs | None (static read) |
| V4 | Live Stripe price IDs and amounts on the `plans` rows | **[UNVERIFIED]** | A.2 | Read-only production query, plus Stripe price reads | E0 |
| V5 | Deleted accounts still being charged, and how many | **[UNVERIFIED]** | N6, R2 | Stripe active subscriptions vs existing users (counts only) | E0 |
| V6 | Stripe's $0 trial invoice fires `invoice.paid` | **[UNVERIFIED]**. Rev 6: the trials page read on 2026-11-07 does not say | N4 | Stripe documentation read | None (public docs) |
| V7 | Stripe request idempotency keys | **Rev 6: VERIFIED.** https://docs.stripe.com/api/idempotent_requests (accessed 2026-11-07) | B.4 item 3 | Stripe documentation read | None (public docs) |
| V8 | Stripe Billing fee ~0.7% | **[UNVERIFIED]** (truncated page summary) | B.3, C.4 | Re-read stripe.com/pricing | None (public page) |
| V9 | `gpt-5.6-terra` price | **U**, not retrieved | C.2 | Read the OpenAI pricing page | None (public page) |
| V10 | `gemini-3.1-pro-preview` and `gemini-embedding-001` prices | **S**, summary only | C.2 | Re-read the Gemini pricing page | None (public page) |
| V11 | All **V** provider prices | Verified **only as of 2026-11-07**, by a subagent, without a billed request | C.2, C.3 | Re-read on the day of use; confirm with metered calls in E7 | E7 needs paid-API authorization |
| V12 | Workload token sizes (8k/0.8k … 150k/10k) | [BASELINE] hypotheses, not measurements | C.3 | E7 measurement | Paid-API authorization |
| V13 | Envelope figures in C.4 | [CALC] upper bounds; omitted costs unmeasured | C.4 | E7 measurement plus TT-09 | Paid-API authorization; PO decision |

## 17. Next recommended action

> **SUPERSEDED by [Revision 6 §R6.8](#r68-next-recommended-action).**

Product Owner review of this report and of the reporting-protocol consolidation in the same Draft PR. Then, if approved, authorize **E0** (read-only Stripe and production checks), which would turn R2, R4, and R6 from unverified into measured. *Recommendation only; nothing is executed without explicit authorization.*

---

## Revision 4 — Pre-launch context correction (2026-11-07)

> **Status:**
> - Delivered in the agent response on 2026-11-07, marked *pending publication*, and published here in Rev 6 without change of substance.
> - **Partly superseded by Revision 5.** Rev 4's statement that E0 can be dropped is **withdrawn**: production must not be assumed empty (§R5.0). Its other simplifications are carried into Rev 5 §R5.1.

**Product Owner context [PO, 2026-11-07]:**
- No paying subscribers and no active paid subscriptions.
- Billing may be redesigned before launch.
- No compatibility is owed to nonexistent paid contracts.

This is the Product Owner's confirmation, not verified by this audit. It is consistent with CLAUDE.md §Infrastructure & Vendors ("Keys not yet in `.env.production`").

### R4.1 Revised roadmap (superseded by R5.4)

| Step | Work |
|---|---|
| P0 | PO decisions D1–D7 plus Q1 |
| P1 | Billing architecture ADR (documentation only) |
| P2 | Release A (#14) + NEM-013 |
| P3 | Single billing rebuild (new additive tables, pinned API version, product-kind-aware webhooks, base-only token grants, one base subscription per account, deletion workflow, PO-024 expiry, test mode, staging after S19) |
| P4 | Clients read the catalog; ToS and copy updates |
| P5 | NEM-019 dark control plane, in parallel |
| P6 | Evaluation, semantic foundation, rights pilot |
| P7 | Gateway + measurement (paid-API authorization) |
| P8 | PO sets allowances; betas |
| P9 | Premium go-live as catalog configuration |
| P10 | Live-mode Stripe + launch (authorization) |

### R4.2 Simplifications (carried into R5.1, with corrections)

| Rev 3 item | Rev 4 treatment | Rev 5 status |
|---|---|---|
| E0 production checks | "Dropped" | **Withdrawn**: E0 returns as the NEM-020 inventory |
| N1 field patching | Dropped; pin one version | Carried |
| R6 legacy price-ID tracing | Dropped; fresh test-mode products | Carried |
| Reworking the one-row-per-user constraint | Simplified: new tables | Carried |
| Grandfathering and price history for subscribers | Dropped | Carried |
| Orphan reconciliation from past deletions | Dropped | **Corrected**: reduced to the inventory result |
| PO-024 re-dating of issued tokens | Simplified | Carried (Q3) |
| Option A vs B | B kept | Carried |
| Drip, duplicate guard, refunds, trials | Folded into the rebuild | Carried |

**Risk re-rating (Rev 4).** R2, R3, R4, and R5 become launch blockers rather than live-harm risks. R6 is closed. R1 is closed by design. All of this is carried into Rev 5.

**Safeguards (Rev 4, carried):**
- No database reset; forward-only migrations; snapshot before drops.
- Preserve users, `user_books`, `token_ledger`, fragments, progress, sync maps, causes preferences.
- Stripe test mode until launch.
- Staging billing tests after S19.
- No merge or deploy without authorization.

**Questions (Rev 4):**
- **Q1:** what to do with bypass-acquired ownership rows (B-10).
- **Q2:** read-only counts (now NEM-020).
- **Q3:** expiry of existing promotional and courtesy tokens.

---

## Revision 5 — Pre-launch architecture reassessment (2026-11-07)

> **Status:**
> - Delivered in the agent response on 2026-11-07, marked *pending publication*, and published here in Rev 6.
> - **Accepted by the Product Owner as the working pre-launch architecture recommendation**, subject to clarifications.
> - Acceptance does **not** approve ADR-007, any mission, or any product policy.

**Baseline examined:** `origin/main` `6a5e5c0`; `origin/release/acquisition-a` (PR #14) diffed against it; `origin/docs/t0-decision-closure` `b05a213`; `origin/docs/reporting-protocol`; PR #36 head `e7d6736`.

### R5.0 Assumption correction

Production must **not** be assumed empty of test data or Stripe objects:
- Release A was validated with a Stripe **test** key (PR #14 §2).
- Production key mode "CANNOT be determined from source code" (`docs/production-safety/02-stripe-mode-verification.md`).
- Real accounts and ownership rows exist.

E0 therefore returns as an **inventory**, to preserve, migrate, archive, or retire. It is not remediation.

### R5.1 Eliminated or simplified requirements

| Rev 3 requirement | Pre-launch treatment |
|---|---|
| N1 legacy field fixes | **Eliminated.** Pin one API version in code and on the webhook endpoint |
| R6 legacy price-ID traceability (`041`) | **Eliminated.** Fresh products and prices by lookup key; legacy IDs recorded once in NEM-020 |
| Rework of `uq_subscriptions_user` | **Eliminated.** New tables alongside; legacy retired later |
| Price history and grandfathering | **Eliminated as remediation.** Versioned from day one |
| Orphan reconciliation from past deletions | **Reduced to the NEM-020 result.** The ongoing reconciliation job stays |
| PO-024 re-dating of issued tokens | **Simplified.** Correct new issuance; existing tokens per Q3 |
| Customer communication | **Eliminated** |
| Drip, duplicate guard, trial tokens, refund and dispute handling | **Simplified:** designed once in the rebuild |
| Release A's legacy title-purchase honouring (NEM-015) | **Possibly simplifiable** if NEM-020 shows no pending purchases. PO decision; Release A unchanged |
| Inventory, data preservation, snapshots, forward-only migrations, test-mode first, staging isolation | **Not eliminated** |

### R5.2 Target architecture (detailed in Annex B, ADR-007 draft)

- **Catalog:** `catalog_products` (stable `code`, `kind`, attributes) and append-only `catalog_prices` (minor units, currency, interval, version, effective dates, Stripe price id, lookup key, mode, status). Premium requires a qualifying base. Lookup keys plus product metadata map to Stripe. One purchasable-items endpoint. AI limits stay in ADR-005 policies.
- **Billing (Option B):** `billing_customers`; `billing_subscriptions` (one row per Stripe subscription; period dates from items; partial unique indexes: one active base per payer, one active premium per user); `household_memberships` (replaces `linkedUserIds`); `billing_token_grants` (unique per subscription period); `account_deletion_requests`.
- **Resolvers:**
  - Base: payer of an active base, or active member of an active household; 72 h `past_due` grace; trialing/canceling per D4; unknown denies.
  - Premium: own active premium plus qualifying base. These are the production adapters for ADR-005.
  - Book access stays ownership-only (PO-021, NEM-013).
- **Lifecycle:** dependency job (premium ends with base, prorated refund); no auto-reactivation; Plus→X `always_invoice`; X→Plus by schedule; allowance period = premium subscription period.
- **Webhooks:** existing processed-events ledger; fetch-and-sync at the pinned version; refunds and disputes; tokens only on paid base invoices.
- **Checkout:** server-side eligibility; database-level duplicate prevention; portal restrictions (Stripe configuration, needs authorization).
- **Code coupled to the legacy model** [CODE, `origin/main`]:
  - `SubscriptionGuard` on `books.controller.ts:98, 222, 275`;
  - club-creation gate `clubs.service.ts:34` (checks `status: 'active'` only);
  - account deletion `users.service.ts:65`;
  - invite flow `subscriptions.service.ts:355-480`;
  - mobile paywall `mobile/src/api/subscriptions.ts:24` (Release A removes it);
  - web pricing;
  - `GET /subscriptions/me`.

### R5.3 Personal premium for household members

- A member buys premium on their own Stripe customer and subscription, with a personal allowance.
- Eligibility comes from an active `household_memberships` row on a qualifying base. Payers on Individual, Duo, or Family plans qualify.
- One premium tier per person, enforced by the database.
- **Conflict:** NEM-019 and ADR-005 currently deny linked members. See §R6.2.

### R5.4 Implementation order

```
M0  NEM-020 inventory (read-only) ─┐
D   PO decisions + ADR-007 billing ┤
                                   ├─▶ M3 NEM-021 Pricing catalog
M1  Release A (#14) → NEM-013 ─────┤         │
                                   │         ▼
M2  NEM-019 dark control plane ────┤   M4 NEM-022 Billing core (test mode; all three tiers)
    (resolver, metering, rights    │         │
     default-deny) — parallel      │         ▼
                                   └─▶ M5 NEM-023 Adapters + client cutover + legacy retirement
M6  Rights records + pilot corpus (TT-26) ─▶ M7 Semantic retrieval (ADR-004; NEM-006B)
                                             ─▶ M8 Real gateway + metering + measurement (paid-API auth)
M9  PO approves allowances → betas → premium products active (test) ─▶ M10 Live-mode Stripe + launch
```

> **Final line SUPERSEDED by Rev 7 §R7.2** (private betas → unified launch-gate review → one coordinated launch). M0–M8 unchanged.

| Order | Component | Why |
|---|---|---|
| 1 | Inventory (NEM-020) | Facts before preserve/retire decisions |
| 2 | Entitlement resolver and AI metering, dark (NEM-019) | No billing or AI-spend dependency |
| 3 | Pricing catalog (NEM-021) | One authority before billing and clients. Existing prices unchanged; premium inactive |
| 4 | Stripe subscriptions (NEM-022) | On the catalog, after NEM-013. Premium lifecycle included, activated by flag |
| 5 | Production adapters (NEM-023) | Billing → resolver; clubs gate; clients; legacy retirement |
| 6 | Rights-aware retrieval | Rights records first (default deny), then pgvector and retrieval |
| 7 | Real metering | After rights and retrieval; paid-API authorization |

NEM-021, NEM-022, and NEM-023 are proposed identifiers only.

### R5.5 Launch blockers vs optional

| Category | Items |
|---|---|
| **Blocks any commercial launch** | Catalog as single authority · billing core with once-only webhooks and a pinned version · duplicate prevention · deletion workflow · refund and dispute handling · token issuance and expiry (PO-024) · ownership-only access (Release A + NEM-013) · Stripe key / webhook / prices in the same mode (doc 02) · ToS, pricing, and Family cap consistent · staging billing tests after S19 · 80% coverage on changed services |
| **Also blocks premium launch** | Household and premium resolvers · premium lifecycle (dependency, 72 h grace, upgrade and downgrade, prorated refunds) · metering with reservations, hard limits, 70/85/95/100% notifications, usage indicator · advance confirmation for expensive operations · kill switch · verified rights records · real gateway · **measured, approved allowances** · AI terms and privacy (TT-22) · NoetiaX depth defined (TT-07) |
| **Optional** | Annual premium · caching optimization · reconciliation dashboard · extra Brief formats · semantic highlight search · in-app mobile purchase (TT-20) · coupons · author hosting tiers in the catalog · financial exports |

**Q4:** launch base first, or all three tiers together? The architecture supports either.

> **DECIDED by the Product Owner, 2026-11-07 (Rev 7 §R7.1): all three tiers launch commercially together.** The two blocker rows above are merged into one mandatory gate in §R7.3.

### R5.6 Dependencies on existing work

Expanded in §R6.2. Summary:
- **#14:** edits the same billing files (`subscriptions.service.ts` +120/−60, `webhooks.service.ts` +48, `subscription.guard.ts`). NEM-022 must come after #14 is settled.
- **NEM-013:** ownership-only access first.
- **#12:** M-C and M-D are absorbed into ADR-007 / NEM-021 / NEM-022; PO-022/023 amendments still needed.
- **#17:** PO-024 expiry.
- **#18:** allocation basis.
- **#21 / #22:** legal text, prices, Family cap.
- **#26 / #27:** S19 isolation before staging billing tests.
- **NEM-006B, NEM-007 Phase B:** retrieval and rights.
- **#16 / #23:** governance only.
- **NEM-016 PRs:** independent; reader priority.

### R5.7 First executable mission

**NEM-020, pre-launch billing and commercial data inventory (read-only).** The full specification is in **[Annex A](2026-11-07-SA-003-annex-A-NEM-020-mission-draft.md)**.

In parallel: ADR-007 (**[Annex B](2026-11-07-SA-003-annex-B-ADR-007-draft.md)**) and the NEM-019 household amendment.

First code missions:
- **NEM-021, pricing catalog.** Needs ADR-007 approval, the NEM-020 report, and D4/D5.
- **NEM-022, billing core.** Needs NEM-021, #14 settled, NEM-013, and S19.

### R5.8 Risks

| Rating | Risk |
|---|---|
| High | Unknown Stripe mode and objects in production (mitigated by NEM-020) |
| High | NEM-022 conflicts with Release A's edits if sequenced wrongly |
| High | NEM-019's household rule contradicts the baseline |
| Medium | Legacy retirement without an inventory and snapshot loses development data |
| Medium | Staging billing tests before S19 could reach production services |
| Low | Two pricing sources during the transition |

### R5.9 Decisions needed (Rev 5)

D1–D9 (§16), plus Q1, Q3, ~~Q4~~ *(decided 2026-11-07, Rev 7)*, TT-01, NEM-020 approval, and ADR-007 drafting. ADR-007 drafting is now authorized: done in Annex B, **not approved**.

### R5.10 Recommendations

**Required:** NEM-020 → ADR-007 and the NEM-019 amendment → NEM-021 → NEM-022 → NEM-023, with Release A and NEM-013 ahead of NEM-022.

**Optional:** the R5.5 optional row.

---

## Revision 6 — Publication, annexes, and dependency/conflict register (2026-11-07)

### R6.1 Authorization and work completed

- **Authorized by:** the Product Owner direction *SA-003 Revisions and NEM-020 Preparation* (2026-11-07), items 1–5.
- **Work done:**
  - published Rev 4 and Rev 5 (above);
  - prepared the NEM-020 draft (Annex A);
  - drafted ADR-007 (Annex B);
  - documented the dependencies and conflicts below;
  - updated the report index.
- **Not authorized and not done:** executing NEM-020; production or Stripe access; code or schema changes; migrations; deployment; merging; approving ADR-007 or policy; modifying #34 or #35.

**Placement decision, escalated for confirmation.** The NEM-020 draft and the ADR-007 draft are staged as **SA-003 annexes in `docs/reports/`**, not in their canonical locations. The reasons:
- `docs/engineering-missions/DRAFT/` and `docs/architecture/adr/`, plus its README index, would widen PR #36 beyond a report and governance PR.
- PR #35 edits the same ADR README index.

Moving them to their canonical locations, in #36 or a new PR, awaits Product Owner authorization.

### R6.2 Dependency and conflict register: PRs #34 and #35

Evidence: `origin/docs/t0-decision-closure` `b05a213` (PR #35, stacked on #34 at `223fabd`). Read only; **neither PR was modified**.

| # | Record (PR) | Location | Current text | Conflict with the accepted baseline / Rev 5 | Needed change (recommendation; PO or Product Architecture decides) |
|---|---|---|---|---|---|
| C1 | **NEM-019** draft (#35) | `docs/engineering-missions/DRAFT/NEM-019-…md` §7, line 65 | "No plan, state, or linked member is assumed to qualify (TT-15)." | Baseline: premium is personal for eligible Duo/Family members | Replace with: members qualify through an active household membership on a qualifying base; states per D4; 72 h past-due grace |
| C2 | NEM-019 (#35) | same, §9 (line 90) | "All data keyed by individual `userId`; `linkedUserIds` grants nothing." | Keying by `userId` stays correct. "`linkedUserIds` grants nothing" becomes obsolete: ADR-007 retires `linkedUserIds` in favour of `household_memberships`, which **does** confer base eligibility | Keep the `userId` keying. Replace the second clause with "eligibility comes only from the `QualifyingPlanPort`; household membership is resolved by billing (ADR-007), never by AI code" |
| C3 | NEM-019 (#35) | same, acceptance item 9 (line 109) | "A linked-member fixture is denied." | Contradicts the baseline | Invert: an eligible-member fixture with its own premium entitlement is **allowed**; an ineligible member is denied |
| C4 | NEM-019 (#35) | same, open decisions (line 156) | TT-15 open; "port has no adapter; `unknown` denies" | TT-15 is partly resolved by the baseline (households, 72 h grace). The "no adapter" design remains correct for NEM-019 | Record TT-15 as partly decided. The adapter stays out of NEM-019 (NEM-023 per Rev 5) |
| C5 | NEM-019 (#35) | same, dependencies (line 24) | Requires "PO-024 Confirmation 1" | TT-01 (token expiry) may still be open (SA-003 §16) | PO to confirm TT-01's status before NEM-019 approval |
| C6 | **ADR-005** (#35) | `docs/architecture/adr/ADR-005-…md`, Boundaries "Household" (line 27) | "`linkedUserIds` grants nothing unless TT-15 says otherwise" | The baseline is the "otherwise" | Amend to the ADR-007 household rule; keep the resolver keyed by `userId` |
| C7 | ADR-005 (#35) | same, open decisions (line 48) | TT-15, TT-16 open | TT-16 partly decided (Option B preferred; grace; refunds pending legal) | Reference ADR-007 for billing structure |
| C8 | **PO-026** (#35) | `…/PO-026-premium-subscription-prerequisite.md`, lines 32-36 | Linked members "Not assumed"; states not assumed; lifecycle, grace, refunds, structure open | The baseline decides household, grace, no auto-reactivation, preferred structure | PO to revise PO-026 text, or supersede by publishing the baseline (D1) |
| C9 | PO-025 (#35) | invariant 7 | "Premium subscription prices are **not** set by this record" | $5 / $8 are approved planning prices | Update before acceptance |
| C10 | **Three-tier `06` roadmap** (#34/#35) | `docs/architecture/three-tier-intelligence/06-implementation-roadmap.md`, lines 19, 31-32, 53, 138-143 | Billing integration is **T8**, after M-C/M-D (PR #12), late in the sequence | Rev 5 moves the base billing rebuild **earlier** (NEM-021/022), leaving only premium activation late. M-C/M-D are absorbed into ADR-007 | Amend the roadmap to reference ADR-007 and Rev 5's order |
| C11 | Three-tier `04` (#34/#35) | `04-entitlements-and-budgets.md`, line 81 | "`linkedUserIds` grants no tier or data visibility" | Tier: conflicts. **Data visibility: remains correct**, since members never see each other's sessions | Split the rule: membership can confer *eligibility*, never *data visibility* |
| C12 | Three-tier `05` (#34/#35) | TT-10, TT-11, TT-15, TT-16 rows | Open | TT-10 and TT-11 decided by the baseline; TT-15 and TT-16 partly | Record the decisions |

**Dependencies (not conflicts):**
- NEM-019 needs no billing and can proceed once C1–C5 are resolved.
- ADR-007 depends on ADR-005's port design (consistent).
- ADR-006 is unaffected.
- The ADR README index (#35) and the ADR-007 placement need sequencing (§R6.1).

### R6.3 Evidence added in Rev 6

- Read on `b05a213`: NEM-019 draft lines 24, 36, 65, 90, 109, 156; ADR-005 lines 17, 27, 48; PO-026 lines 32-36; three-tier `06` lines 19, 31-32, 53, 138-143, 172; `04` lines 81, 111; ADR README index.
- Read on `origin/main`: entity columns of `token_ledger`, `user_books`, `gift_cards`, `subscription_invites`, `courtesy_token_quotas` (for the Annex A queries); `MISSION-TEMPLATE.md` headings.
- Stripe pages read by a read-only web-fetch subagent on 2026-11-07:
  - webhooks: duplicates and no ordering guarantee — **verified**;
  - idempotent requests — **verified**;
  - Checkout `expires_at` (30 min – 24 h, default 24 h) — **verified**;
  - invoice `billing_reason` values — **verified**;
  - subscription schedules for downgrades — **verified** (phase-based wording);
  - stripe-node default API version — **verified** as documented default;
  - $0 trial invoice and `invoice.paid` — **not verified**.
  - URLs are in Annex B §References.

### R6.4 Risks (new in Rev 6)

| Rating | Risk |
|---|---|
| High | If NEM-019 is approved without C1–C3, household members are denied premium, contradicting the baseline |
| Medium | ADR-007 and ADR-005 are drafted on different branches. Divergence risk until both are reviewed together |
| Low | Annex placement is temporary. The documents must be moved, not copied, when canonical placement is authorized |

### R6.5 Changes made

| File | Change |
|---|---|
| `docs/reports/2026-11-07-SA-003-pricing-subscriptions-ai-economics-readiness-audit.md` | Status banner; revision history rows 4–6; SUPERSEDED markers on §7.E, §11, §17; V3/V6/V7 register updates; Rev 4, Rev 5, Rev 6 sections |
| `docs/reports/2026-11-07-SA-003-annex-A-NEM-020-mission-draft.md` | **New.** NEM-020 draft |
| `docs/reports/2026-11-07-SA-003-annex-B-ADR-007-draft.md` | **New.** ADR-007 draft |
| `docs/reports/README.md` | SA-003 index row updated (revision, annexes, status) |

No application code, schema, migration, Stripe, production, staging, infrastructure, or deployment change. PRs #34 and #35 untouched. `.claude/settings.local.json` not included.

### R6.6 Tests and validation

No tests run. The Annex A SQL was **not executed** anywhere; its validation (V-1…V-4) is part of NEM-020. Column names were checked against the entity files on `origin/main`.

### R6.7 Remaining decisions

| # | Decision | Owner |
|---|---|---|
| 1 | Canonical placement of the NEM-020 and ADR-007 drafts (in #36, or a new PR) | PO |
| 2 | NEM-020 approval, its access options (§16 of Annex A), and the execution instruction | PO |
| 3 | ADR-007 review and acceptance | PO + Product Architecture |
| 4 | Amendments C1–C12 to #34 / #35 records | PO (records) · Product Architecture (ADRs, roadmap) |
| 5 | D1–D9, D11 (household downgrade), D12 (tokens on refund/dispute), Q1, Q3, ~~Q4~~ *(decided 2026-11-07, Rev 7)*, TT-01 | PO |

### R6.8 Next recommended action

1. Product Owner review of Rev 6 and Annexes A and B.
2. Then authorize canonical placement (decision 1).
3. Then approve and instruct execution of **NEM-020**.

*Recommendation only.*

---

## Revision 7 — Q4 decided: coordinated commercial launch (2026-11-07)

### R7.1 Decision record

| | |
|---|---|
| **Decision** | **Q4 — DECIDED** |
| **Date** | 2026-11-07 |
| **Authority** | Product Owner (*Close Product Decision Q4*, 2026-11-07; preceded by *Product Owner Decision Q4: Coordinated Commercial Launch*, same date) |
| **Ruling** | Noetia, Noetia+, and NoetiaX **must launch commercially together**, in one coordinated public commercial launch |

Rules that follow from the decision:
1. **One public commercial launch** for all three tiers.
2. **Internal testing and private betas may run independently** for each tier before launch, where appropriate (test mode, invitation-only or grant-based access, no public sale).
3. **The base product may not launch commercially ahead of Noetia+ and NoetiaX** without a new Product Owner decision.
4. **Readiness of all three tiers is a mandatory public-launch gate** (§R7.3).
5. Planning prices stay at **$5/month (Noetia+)** and **$8/month (NoetiaX)**, as monthly add-ons. They remain planning prices; C9 (PO-025 invariant 7) is still open.
6. The NEM-020 → ADR-007 → NEM-021 / NEM-022 / NEM-023 dependencies are preserved, with NEM-019 and AI development in parallel where safe.

This is a **planning** decision. It authorizes no code, Stripe, database, infrastructure, or deployment work, and does not approve ADR-007, NEM-020, or any mission.

Supersedes: the Q4 question in §R5.5 and the Q4 entries in §R5.9, §R6.7, and Annex B. Earlier text is preserved and marked.

### R7.2 Roadmap update

Replaces the last line of the §R5.4 diagram. Everything before M9 is unchanged.

```
M0  NEM-020 inventory (read-only) ─┐
D   PO decisions + ADR-007 billing ┤
                                   ├─▶ M3 NEM-021 Pricing catalog
M1  Release A (#14) → NEM-013 ─────┤         │
                                   │         ▼
M2  NEM-019 dark control plane ────┤   M4 NEM-022 Billing core (test mode; all three tiers,
    (parallel)                     │         │                 premium lifecycle complete)
                                   │         ▼
                                   └─▶ M5 NEM-023 Adapters + client cutover + legacy retirement
M6  Rights records + pilot corpus (TT-26) ─▶ M7 Semantic retrieval (ADR-004; NEM-006B)
    (parallel, no billing dependency)        ─▶ M8 Real gateway + metering + measurement (paid-API auth)

M9   Private betas, per tier, independent (test mode / invitation or grant; NO public sale)
M10  Unified launch-gate review (§R7.3) ── Product Owner approval
M11  Live-mode Stripe + ONE coordinated commercial launch: Noetia + Noetia+ + NoetiaX
```

Planning consequences:
- **The critical path is now the AI track** (M6 → M7 → M8 → measured allowances), not billing. Base billing (M3–M5) can be finished and validated in test mode, then held dark until the whole gate passes.
- **NEM-022 must deliver the premium lifecycle complete and tested at launch**, not as a later flag-activated step. ADR-007's catalog activation still applies: all three tiers are activated together at M11.
- Rights records (M6) have no billing dependency and should start as early as TT-12 / TT-26 allow, since they gate the critical path.
- Production deploys of base fixes (Release A, NEM-013, NEM-021–023 run dark) are **not** a commercial launch as long as nothing is offered for sale. This reading needs Product Owner confirmation (L3).

### R7.3 Mandatory public-launch gate (all three tiers)

Merges the two §R5.5 blocker rows into one gate. **Every item must pass for all three tiers before any tier launches commercially.** The §R5.5 optional row stays optional.

| Gate item | Evidence required | Open inputs |
|---|---|---|
| **Validated billing** | Catalog as single price authority; once-only webhooks on a pinned API version; duplicate-checkout prevention; deletion workflow; refund and dispute handling; token grants once per billing period; Stripe key, webhook, and prices in the same mode; staging billing tests after S19 | D4, D6, D12, TT-01 |
| **Personal premium entitlements** | Household and premium resolvers; premium lifecycle (dependency, 72 h grace, upgrade and downgrade, prorated refunds); one premium tier per person | D11; amendments C1–C8 |
| **AI usage limits** | Metering with reservations and hard limits; 70/85/95/100% notifications; usage indicator; advance confirmation for expensive operations; kill switch | Allowances (unapproved) |
| **Rights-aware retrieval** | Verified rights records, default deny; retrieval only over eligible content | TT-12, TT-26 |
| **AI quality** | Per-tier evaluation passed (T2 benchmark: citation accuracy, grounding, origin labelling, extraction refusal); NoetiaX depth defined (TT-07) | **L1** acceptance thresholds and owner |
| **Measured unit economics** | Per-tier contribution margin measured from metered beta usage, including the costs omitted from the C.4 envelopes, against the 55–65% target | Allowance and margin approval |
| **Legal readiness** | ToS, pricing, and Family cap consistent (#21 / #22); AI terms and privacy (TT-22); refund terms (D6); legal sign-off | Legal review |
| **Production safety** | Server snapshot; S19 isolation; kill switch and rollback tested; 80% coverage on changed services; post-deploy verification | — |

### R7.4 Conflicting language in PRs #34 and #35

Evidence: `origin/docs/three-tier-architecture-reconciliation` `223fabd` (#34) and `origin/docs/t0-decision-closure` `b05a213` (#35). Read only; **neither PR was modified**.

| # | Record (PR) | Location | Current text | Conflict with Q4 | Needed change (recommendation) |
|---|---|---|---|---|---|
| C13 | **Three-tier `06` roadmap** (#34 / #35) | `06-implementation-roadmap.md`: diagram (#34 line 52; #35 line 53) and **T9** (#34 lines 146-151; #35 lines 148-153) | "T8 Billing ─▶ T9 Progressive release"; T9 scope "Percentage rollout"; T8 cost safeguard "Rollout bucket … before each expansion" | Read as post-launch staged availability of premium, this lets the base product sell before premium is generally available, contradicting rules 1 and 3 | Confine percentage rollout and expansion steps to **pre-launch private betas**, or obtain a Product Owner ruling that a staged rollout *within* the coordinated launch is allowed |
| C14 | Three-tier `06` (#34 / #35) | §2 prerequisites (#34 lines 31-32; #35 lines 31-32) and T8 | Roadmap treats base billing and catalog access as an existing prerequisite and premium billing as an add-on phase | Assumes a base product already on sale; under Q4 base and premium go live together at one gate | Extends **C10**: reference ADR-007, Rev 5's order, and the §R7.3 gate |

Consistent (not conflicts): `06` T5 (Noetia+ closed beta) and T7 (NoetiaX closed beta), "grants only, no billing", match rule 2. NEM-019 §14 (no deployment) and the `02` "launch control" gap (premium plans not auto-listed) are consistent. No launch-sequencing language was found in PO-025 – PO-029, ADR-005, or ADR-006.

### R7.5 Risks (new in Rev 7)

| Rating | Risk | Mitigation |
|---|---|---|
| Medium | No base revenue until the AI track passes the gate | Accepted by the Product Owner decision |
| Medium | Base billing built early goes stale while held dark | Re-validate at the M10 gate review |
| Medium | Accidental base launch: live-mode keys reach production, or the live pricing page is treated as open for sale | Keep live keys out until M11; NEM-020 checks Stripe mode; **L2** |
| Medium | C13 left unamended lets a future mission stage premium after base | Amend `06` before T8 / NEM-022 approval |
| Low | AI quality cannot be gated without thresholds | **L1** |

### R7.6 Changes made

| File | Change |
|---|---|
| `docs/reports/2026-11-07-SA-003-pricing-subscriptions-ai-economics-readiness-audit.md` | Status banner and lifecycle row; revision row 7; Q4 marked decided in §R5.5, §R5.9, §R6.7 (original text preserved); §R5.4 final line marked superseded; this section |
| `docs/reports/2026-11-07-SA-003-annex-B-ADR-007-draft.md` | Positive consequence reworded for coordinated launch; Q4 marked decided. Still a draft, **not approved** |
| `docs/reports/README.md` | SA-003 index row: Rev 7, Q4 decided |

Annex A (NEM-020) unchanged: its "Q4" is a query identifier, not this decision. Reporting protocol (`docs/reports/README.md` §1–§9) unchanged. No application code, Stripe, database, infrastructure, production, or deployment change. PRs #34 and #35 untouched.

### R7.7 Tests and validation

No tests run (documentation only). Conflict search: `git diff origin/main...<branch>` and `git show` of `06-implementation-roadmap.md`, `PO-025`, and NEM-019 on both PR heads.

### R7.8 Remaining decisions

| # | Decision | Owner |
|---|---|---|
| 1–4 | §R6.7 rows 1–4 (placement, NEM-020, ADR-007, C1–C12), plus C13–C14 | PO · Product Architecture |
| 5 | D1–D9, D11, D12, Q1, Q3, TT-01 (Q4 now decided) | PO |
| L1 | AI quality acceptance thresholds and owner | PO + Product Architecture |
| L2 | Whether public pricing and sign-up must hide purchase until M11 | PO |
| L3 | Confirm that dark production deploys of base fixes are not a commercial launch | PO |

### R7.9 Next recommended action

Unchanged from §R6.8: Product Owner review, then canonical placement of the drafts, then approval and execution instruction for **NEM-020**.

*Recommendation only.*
