# 03 — Stripe Webhook Idempotency

**Status: CONFIRMED partial gap.** Subscription *state* is idempotent; *token issuance* and *token-package purchase* are **not** — a redelivered Stripe event double-issues tokens.

## Background — CONFIRMED
Stripe guarantees **at-least-once** delivery and will **redeliver the same event** (same `event.id`) on retries (e.g. when the endpoint is slow, returns non-2xx, or on Stripe's own retry schedule). Handlers must therefore be idempotent per `event.id`.

## What IS idempotent — CONFIRMED
- **Subscription state** (`upsertFromWebhook`): guards with `if (existing?.stripeEventId === stripeEventId) return;` and upserts on `userId` conflict. A redelivered `customer.subscription.updated/deleted`, `checkout.session.completed` (subscription mode), or `invoice.payment_failed` will not corrupt state. ✅
- **Book purchase** (`addPurchasedBook`): `user_books` insert catches the unique-violation (`23505`) and returns — safe against redelivery. ✅

## What is NOT idempotent — CONFIRMED
The `stripeEventId` dedup lives **inside `upsertFromWebhook`**, but token issuance is called **separately and unconditionally** afterward:

1. **`invoice.paid` → token issuance.** `handleInvoicePaid` calls `upsertFromWebhook(event.id, …)` (deduped) **then** `issueTokensForNewSubscription(subId)` **unconditionally**. `issueTokensForNewSubscription` has **no `event.id` guard** → it issues `tokensPerCycle` every time the event is delivered.
   - **Redelivery of the same `invoice.paid` → tokens issued again.** (Distinct, legitimate monthly invoices are different events and *should* issue — the bug is only on **duplicate delivery of the same event**.)

2. **`checkout.session.completed` (payment mode) → token package.** `handlePaymentCompleted` calls `issueTokensForPurchasedPackage(...)` with **no `event.id` guard** → redelivery double-issues package tokens.

3. **Gift fulfillment** (`fulfillGift`): **INFERRED** likely guarded by gift-card `status` (`sent → claimed`); not line-verified here → treat as **INFERRED safe**, confirm during fix.

## Impact — INFERRED
- **Over-crediting:** users receive extra tokens on webhook redelivery → book-access value given away / entitlement inflation.
- **Frequency:** only on actual redelivery (retries / at-least-once duplicates), so intermittent — but real, and silent (no error, no log).
- No *under*-crediting risk from this (that was the separate, now-fixed annual-plan issue, doc 01).

## Smallest safe fix (DESIGN — not implemented)
**One comprehensive guard beats per-path patches.** Record processed event IDs and skip duplicates at the entry point:

- New table `stripe_processed_events(event_id varchar PRIMARY KEY, type varchar, processed_at timestamptz default now())` (additive migration).
- At the **top of `WebhooksService.handleEvent`**: attempt `INSERT ... event_id`; on unique-violation (`23505`), **skip the event entirely** (already processed). Only proceed to the `switch` on a fresh insert.
- This makes **every** path idempotent (issuance, state, gift, book) regardless of internal logic, with one small change and no behavioral change for first-delivery.

Alternative (larger, not recommended): add `event.id` guards to each issuance method individually — more code, easy to miss a path.

**Safety of the fix:** additive table + an early-return guard; no change to first-delivery behavior; fully unit-testable (first call processes, second call no-ops). No backfill needed (past over-issuance, if any, is not reversed by this — see plan for optional audit).

## Optional audit (to size any past impact) — team action
Look for duplicate issuance signatures, e.g. multiple `token_ledger` rows with identical `(userId, reason, issuedAt≈)` within seconds, or compare issued token counts against expected per subscription/purchase. This quantifies whether redelivery has actually occurred in production (**UNKNOWN** until checked).
