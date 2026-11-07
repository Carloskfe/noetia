# ADR-007 — Unified Pricing Catalog and Billing Architecture (DRAFT)

> **SA-003 Annex B.** Drafted under the Product Owner direction of 2026-11-07, *SA-003 Revisions and NEM-020 Preparation*.
> - Staged here as an annex of the SA-003 report. Its canonical location, `docs/architecture/adr/ADR-007-unified-pricing-catalog-and-billing.md`, and its row in `docs/architecture/adr/README.md` await Product Owner authorization. That README is also edited by PR #35.
> - **This draft is not approved and sets no product policy.**

- **Status:** Proposed (draft; not accepted)
- **Date:** 2026-11-07 (SA-003 Rev 6)
- **Decided by:** pending: Product Owner + Product Architecture
- **Relates:** ADR-005 (entitlement resolver; draft, PR #35) · ADR-006 (draft, PR #35) · PO-021 (ownership-only access) · PO-024 (token expiry) · PO-026 (prerequisite; draft) · SA-003 report §7.B, B.4, Rev 5 · NEM-020 (Annex A)
- **Evidence labels:** as in the SA-003 report. `[EXTERNAL]` facts were read on official Stripe pages on 2026-11-07 (§References).

## Context

Noetia is pre-launch: no paying subscribers, no active paid subscriptions (PO, 2026-11-07). The current billing model can't carry the approved three-tier structure [CODE; SA-003 §7.B.1]:
- one subscription row per user, upserted on `userId`;
- plan resolved from the first invoice item;
- tokens on every paid invoice;
- cancellation acting on the only Stripe subscription;
- subscription status unlocking paid books;
- prices defined in about eight places.

The Product Owner baseline [BASELINE, 2026-11-07]:
- Noetia+ $5/month and NoetiaX $8/month on top of a qualifying Individual, Duo, or Family plan.
- Premium is **personal**, including for household members; one premium tier per eligible person.
- Premium cancellation never cancels the base plan. Losing base eligibility ends premium and its future charges.
- 72-hour grace when the base plan is past due.
- Restoring the base doesn't reactivate premium.
- Plus→X immediately with proration; X→Plus at renewal.
- Prorated refund of unused premium time, subject to legal and technical verification.
- Book tokens are independent of AI usage.
- Separate Stripe subscriptions are **preferred, pending technical approval**.

## Decision (proposed)

### 1. One pricing catalog is the only price authority

- **`catalog_products`**:
  - a stable `code` (e.g. `noetia_individual`, `noetia_duo`, `noetia_family`, `noetia_plus`, `noetiax`, `token_pack_1|3|5|10`, `gift_1|3`);
  - a `kind`: `base_plan` · `premium_addon` · `token_package` · `gift`;
  - attributes: `max_members`, `tokens_per_cycle`, and `premium_tier` (`plus` | `x`).
- **AI limits and budgets are not stored here.** They live in ADR-005's versioned tier policies. The catalog only names the tier.
- **`catalog_prices`**, append-only: `product_code`, `version`, `amount_minor`, `currency`, `interval` (`month` · `year` · `one_time`), `effective_from`, `effective_to`, `stripe_price_id`, `stripe_lookup_key`, `livemode`, `status`. A price change is a new row, never an edit.
- **Eligibility is data:** `premium_addon` requires a qualifying base entitlement (§3).
- **Stripe mapping:**
  - Stripe Products carry `metadata.noetia_product_code`; prices are addressed by lookup key.
  - Code never interprets a display name or an item position.
  - A read-only reconciliation compares catalog and Stripe (amount, currency, interval, active, mode) and alerts on drift.
- **Consumers:** one read endpoint returns only what the requesting user may buy. Web pricing, mobile, gifts, SEO text, and the ToS snapshot (by catalog version) all read from it.
- Existing base and token prices are seeded **unchanged**. Premium prices are seeded **inactive** until the Product Owner activates them.

### 2. Separate Stripe subscriptions for base and premium (Option B)

- Every user who pays has their own `billing_customers` row (user ↔ Stripe customer, per mode).
- **`billing_subscriptions`**: one row per Stripe subscription.
  - Columns: payer `user_id`, `product_kind`, `product_code`, `catalog_price_id`, normalized `status`, `current_period_start` / `_end` (taken from the subscription **items** [EXTERNAL, basil]), `cancel_at_period_end`, `trial_end`, `past_due_since`, `livemode`, `last_synced_at`.
  - **Database invariants (partial unique indexes):** at most one non-terminal `base_plan` per payer; at most one non-terminal `premium_addon` per user.
- **Why B:** a household member's premium must be billed to the member, which a single subscription on the owner's customer can't do (SA-003 §7.B.3).
- **Accepted cost:** about +30¢ in fixed card fees per premium subscriber-month [EXTERNAL].
- The Stripe client and the webhook endpoint are pinned to **one explicit API version**, set in code and in the endpoint configuration. When no version is set, stripe-node "will use the latest version at the time of release" [EXTERNAL], and today's code sets none. Pinning makes this explicit.
- Every row carries `livemode`. An event or object whose mode differs from the configured mode is rejected and alerted.

### 3. Households and personal premium entitlements

- **`household_memberships`**: `base_subscription_id`, `member_user_id`, `role` (`owner` · `member`), `status`, `joined_at`, `left_at`.
  - Unique active membership per (base subscription, member). A user can't be an active member of two households.
  - Capacity comes from the product's `max_members`.
  - Replaces `subscriptions.linkedUserIds` and the invite flow's direct array writes.
- **Base entitlement** (`BaseEntitlementResolver`), for a user:
  - Qualifying if they pay for a non-terminal base plan, or are an active member of a household whose base plan is non-terminal.
  - `past_due` qualifies until `past_due_since + 72h`.
  - `trialing` and `canceling` are **[OPEN] D4**; until decided, they are configuration flags defaulting to *deny for premium* and *allow for base features*.
  - Unknown → `unknown`.
- **Premium entitlement** (production adapter of ADR-005's `QualifyingPlanPort`, plus a premium-tier port): the user's own non-terminal `premium_addon` **and** a qualifying base entitlement. `unknown` denies.
- **Book access is never decided by billing.** Ownership only (PO-021, NEM-013). Base entitlement grants tokens, household capacity, the club-creation gate (`clubs.service.ts:34` moves here), and premium eligibility. Nothing else.
- **Household events:** owner downgrade below current membership (for example Family → Individual), member removal, member leaving, or owner deletion each end the affected members' base entitlement. Their premium follows §4. Which members are removed on downgrade is **[OPEN] D11**.

### 4. Lifecycle

| Event | Effect |
|---|---|
| Premium checkout | Allowed only if base entitlement is `qualifying` at session creation **and** re-checked at completion (§5) |
| Premium cancel | Cancels the premium subscription only (`cancel_at_period_end`); the base is untouched |
| Base past due | Premium continues for 72 h from `past_due_since`, then the resolver denies it. Billing action per D6 |
| Base eligibility ends (canceled, unpaid after grace, member removed, household downgraded) | The **dependency job** cancels the dependent premium immediately and issues the prorated refund of unused time, subject to legal approval (D6). Refunds are manual API actions: negative prorations aren't refunded automatically [EXTERNAL] |
| Base restored | Premium **not** reactivated. The user must purchase again |
| Plus → X | Price swap on the premium subscription with `proration_behavior: always_invoice` [EXTERNAL] |
| X → Plus | Subscription schedule: a future phase with the lower price from the current phase end [EXTERNAL] |
| AI allowance period | The premium subscription's own `current_period_start` / `_end`, passed by the resolver to the ADR-005 budget ledger. No rollover |
| Account deletion | The non-atomic, idempotent deletion workflow of SA-003 §7.B.4. It covers every subscription of the user, including memberships |

The dependency job is idempotent (keyed by `billing_subscription_id` + cause), retried with backoff on the existing BullMQ worker, and escalates to `needs_review` when retries are exhausted.

### 5. Checkout idempotency

- **`checkout_intents`**: `id`, `user_id`, `product_code`, `kind_group` (`base` · `premium` · `one_time`), `status` (`open` · `completed` · `expired` · `abandoned`), `stripe_session_id`, `expires_at`.
  - A **partial unique index** allows one `open` intent per (`user_id`, `kind_group`) for recurring kinds.
  - A repeated request while an intent is open **returns the same Checkout Session URL** instead of creating a new one.
- The Checkout Session is created with an **idempotency key** derived from the intent id. Retries with the same key return the saved response; different parameters with the same key are rejected [EXTERNAL].
- `expires_at` is set explicitly (Stripe allows 30 minutes to 24 hours; the default is 24 hours [EXTERNAL]). Expiry or the `checkout.session.expired` event closes the intent.
- **Server-side eligibility before creation:**
  - Base: no non-terminal base as payer.
  - Premium: a qualifying base, and no non-terminal premium.
- **Race backstop at completion.** When a completed session would create a second non-terminal base, or premium without a qualifying base (for example two tabs, or the portal):
  - the database invariant rejects it;
  - the handler cancels the new Stripe subscription and refunds it in full;
  - the case is logged as `duplicate_checkout_reverted` and alerted.
- The Customer Portal is configured to disallow switches that would bypass these rules. That is Stripe configuration, so it needs authorization.

### 6. Webhook concurrency and ordering

Stripe may deliver an event more than once, doesn't guarantee order, and may send two events for one change [EXTERNAL].

1. **Authenticate:** verify the signature (existing).
2. **Deduplicate:** use the existing `stripe_processed_events` ledger. The ledger row is written **after** side effects succeed (the current retry-safe design, `webhooks.service.ts:19-31`), so every side effect must also be idempotent on its own.
3. **Fetch, then apply (no payload trust):**
   - For subscription, invoice, charge, and checkout events, retrieve the current object from Stripe at the pinned version, **outside** any database transaction (no network call while holding a lock, following ADR-006).
   - In a short transaction, take `SELECT … FOR UPDATE` on the `billing_subscriptions` row, or `pg_advisory_xact_lock` keyed on the Stripe subscription id when the row doesn't exist yet.
   - Apply the fetched state only if `fetched_at > last_synced_at`. This makes delivery order irrelevant and stops an older fetch from overwriting a newer one.
4. **Serialize** per Stripe subscription through that lock. Different subscriptions proceed in parallel.
5. **Derived actions** (token grants §7, dependency job §4, deletion workflow) run as idempotent jobs keyed by business identifiers, never by event id alone.
6. **Return 2xx only after the transaction commits.** On failure, return non-2xx so Stripe retries.
7. **Reconcile:** a periodic read-only job compares non-terminal Stripe subscriptions with `billing_subscriptions` and reports drift.

### 7. Billing-period token-grant idempotency

- **`billing_token_grants`**: `billing_subscription_id`, `grant_period_start`, `grant_period_end`, `token_count`, `source_invoice_id` (nullable), `created_at`.
  - **Unique (`billing_subscription_id`, `grant_period_start`).**
  - Ledger rows are written **in the same transaction** as the grant row, each `token_ledger` row referencing the grant.
- **Monthly base plans:** grant when a base-plan invoice is **paid** with `billing_reason` in {`subscription_create`, `subscription_cycle`} [EXTERNAL: enum values] and `amount_paid > 0`. The period comes from the base item's line period.
- **Annual base plans:** one grant per monthly sub-period derived from the subscription anchor; the daily job inserts the next sub-period. The unique key makes reruns harmless.
- **No grants** for premium invoices, proration invoices (`subscription_update`), or `manual` invoices. Trial / $0 invoices are **[OPEN] D4**. Whether Stripe emits `invoice.paid` for a $0 trial invoice is **[UNVERIFIED]**, so grants must not rely on it.
- **Plan change mid-period** (e.g. Duo → Family): no extra grant until the next cycle, unless the Product Owner decides otherwise.
- **Refund or dispute of a granting invoice:** unredeemed tokens from that grant are marked `revoked`; books already acquired stay owned (PO-021). This is a proposed rule, **[OPEN] D12**.
- Token **expiry** follows PO-024 (subscription tokens 90 days; purchased 1-token 90 days; 3/5/10 packs six calendar months), subject to TT-01's current status.

### 8. Legacy model retirement

`plans`, `subscriptions` (including `linkedUserIds`), `subscription_invites`, `SubscriptionGuard`, and `GET /subscriptions/me` are retired **after**:
1. the NEM-020 inventory;
2. the new model is live in test mode;
3. clients have switched;
4. a server snapshot has been taken.

Retirement uses forward migrations only. Deployed migrations are never edited (CLAUDE.md). `user_books` and `token_ledger` are preserved.

## Consequences

**Positive:**
- One price authority.
- Personal premium for every eligible member.
- Book ownership is structurally separated from billing.
- Duplicate subscriptions and double grants are prevented by database constraints, not by convention.
- Order-independent webhooks.
- All three tiers launch commercially together by catalog activation (Q4, decided 2026-11-07); premium is not a second rebuild. Private betas use test-mode or invitation/grant access only.

**Negative:**
- More tables and jobs: dependency, reconciliation, deletion, drip.
- An extra Stripe fetch per webhook.
- About 30¢ in extra fees per premium subscriber-month.
- A transition window with two pricing sources (keep it short).
- Manual refund logic.

## Alternatives considered

- **One subscription with several items (Option A):** rejected. It bills members' premium to the owner and forces a shared billing cycle.
- **Repair the current `plans` / `subscriptions` model:** rejected pre-launch. It carries forward the identity, first-item, and token defects for no compatibility benefit.
- **Trust webhook payloads in arrival order:** rejected. Stripe guarantees neither order nor single delivery [EXTERNAL].
- **Put tier limits in the catalog:** rejected. Limits are versioned AI policy (ADR-005), not price data.
- **Keep `linkedUserIds`:** rejected. No membership history, no constraints, and no eligibility semantics.

## Guardrails

- This ADR sets **no price, allowance, trial, refund, or household policy**. Those are Product Owner decisions.
- Test mode first. Live-mode products, prices, webhook endpoints, and portal settings require explicit authorization.
- Staging billing tests only after the S19 isolation fix (NEM-017).
- Every new service ships with unit tests at the mirrored path and 80% coverage (CLAUDE.md §Testing).

## Open decisions

- **D4:** trial policy; whether `trialing` / `canceling` qualify; trial grants.
- **D5:** Family member cap, 4 or 5.
- **D6:** refund rules and legal approval; past-due billing action after grace.
- **D7:** final approval of Option B.
- **D11:** which members lose access on household downgrade.
- **D12:** token treatment on refund or dispute.
- **TT-01:** status of token expiry.
- ~~**Q4:** launch base first, or all tiers together.~~ **DECIDED 2026-11-07 (Product Owner):** one coordinated commercial launch of all three tiers; see SA-003 Rev 7.

## References (accessed 2026-11-07)

- Webhook duplicates and ordering: https://docs.stripe.com/webhooks
- Idempotent requests: https://docs.stripe.com/api/idempotent_requests
- Checkout Session `expires_at`: https://docs.stripe.com/api/checkout/sessions/create
- Invoice `billing_reason`: https://docs.stripe.com/api/invoices/object
- Subscription schedules: https://docs.stripe.com/billing/subscriptions/subscription-schedules
- Prorations: https://docs.stripe.com/billing/subscriptions/prorations
- Period fields moved to items (basil): https://docs.stripe.com/changelog/basil/2025-03-31/deprecate-subscription-current-period-start-and-end
- stripe-node `apiVersion` default: https://github.com/stripe/stripe-node (README options table)
- **Not verified:** a $0 trial invoice and `invoice.paid` (https://docs.stripe.com/billing/subscriptions/trials doesn't say)

## Legal note

This is architecture, not legal advice. Refund, deletion, and retention rules require legal review.
