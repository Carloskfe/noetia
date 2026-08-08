# 08 — Subscriptions & Payments

Provider: **Stripe** (`stripe` SDK). Module: `services/api/src/subscriptions`.

## Products & plans — CONFIRMED
- **Plans** (`plans` table): recurring subscription tiers — `stripePriceId`, `interval`, `amountCents`, `maxProfiles` (Duo/Family seats), `tokensPerCycle`. Seeded/updated via migrations (010, 039, 041). Project state: Individual / Duo / Family.
- **Token packages** (`token_packages`): one-time token bundles — `tokenCount`, `amountCents`, `stripePriceId`, `active`.
- Price IDs live in the DB, not hardcoded. **CONFIRMED**.

## Checkout — CONFIRMED
`SubscriptionsService` creates Stripe Checkout Sessions for three purchase types:
- `createCheckoutSession(userId, planId)` — subscription.
- `createTokenPackageSession(userId, packageId)` — token bundle (metadata `tokenPackageId`).
- `createPurchaseSession(userId, bookId)` — single paid book (metadata `bookId`).
- `createPortalSession(userId)` — Stripe billing portal.
Customer resolution: `getOrCreateStripeCustomer` persists `stripeCustomerId` on the user. Gift-card checkout is handled by `GiftsService` (`POST /gifts/checkout`).

## Webhooks — CONFIRMED (`webhooks.controller.ts` / `webhooks.service.ts`)
- Endpoint `POST /webhooks/stripe`. **Signature verified** via `stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET)`; failures are rejected and logged (no processing). `rawBody: true` is enabled globally to make this possible.
- Handled events:
  | Event | Handler action |
  |-------|----------------|
  | `checkout.session.completed` | Fulfill purchase — issue tokens for a token package, add a purchased book, or complete a gift, by session `metadata.type`. |
  | `invoice.paid` | Activate/renew subscription; `issueTokensForNewSubscription` grants `tokensPerCycle`. |
  | `invoice.payment_failed` | Mark subscription past-due (failure handling). |
  | `customer.subscription.updated` | Sync plan/status/period. |
  | `customer.subscription.deleted` | Cancel subscription. |
- **Idempotency:** `subscriptions.stripeEventId` column exists to record the last processed event. **INFERRED** it guards against double-processing; exact dedup logic not line-verified → **INFERRED**.

## Subscription state — CONFIRMED
`Subscription` mirrors Stripe: `status` (`none|trialing|active|past_due|canceled` — mapped in `mapStripeStatus`), `currentPeriodEnd`, `trialEnd`, `planId`, `tokenBalance`, `linkedUserIds[]`, `nextTokenIssuanceAt`. `GET /subscriptions/me` returns entitlement + token balance (resolving shared pools for linked members).

## Duo / Family — CONFIRMED
- Owner invites members: `inviteUser(ownerId, email)` creates a `subscription_invites` row (unique token, 48 h expiry), capped at `maxProfiles − 1` seats.
- Accept: `POST /subscriptions/invite/accept` links the member into `linkedUserIds[]`.
- Members share the owner's token pool (`getActiveTokenCount(ownerSub.userId)`), and can redeem against it (`redeemToken` resolves the pool owner via `:userId = ANY(linkedUserIds)`).

## Billing / invoices — CONFIRMED / INFERRED
- Invoices are handled implicitly via `invoice.paid` / `invoice.payment_failed` webhooks; invoice records themselves live in Stripe, not mirrored locally. **INFERRED** (no invoice table).
- Annual plans: `issueMonthlyTokensForAnnualPlans()` re-issues `tokensPerCycle` monthly for annual subscribers. **CONFIRMED** method exists; scheduling of it → **UNKNOWN** (only the daily persona cron was found via `@Cron`; token-issuance scheduling may be triggered elsewhere or manually).

## Refunds & retries — UNKNOWN / INFERRED
- **No explicit refund handling** found (no `charge.refunded` / `refund` handler). **INFERRED:** refunds are managed manually in the Stripe dashboard.
- **Retries:** dunning/retry is delegated to Stripe (standard smart retries) — the code reacts to `invoice.payment_failed` but does not implement its own retry loop. **INFERRED**.

## Live vs test — UNKNOWN
Stripe keys are environment-provided (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, names only). Whether production runs **live or test** keys is not determinable from code — flagged for verification.
