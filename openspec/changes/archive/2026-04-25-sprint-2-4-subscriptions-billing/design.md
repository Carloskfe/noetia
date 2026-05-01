## Context

Noetia currently has no billing layer. All API routes are publicly accessible to authenticated users regardless of subscription status. The platform uses Stripe as its payment processor (already identified in the PRD and legal documents). This sprint wires Stripe into the NestJS API, adds subscription state to the database, and surfaces billing UI on web and mobile.

The API runs on NestJS. Payments are handled entirely by Stripe — we never store card data. The web app is Next.js 14. The mobile app is React Native (Expo). PostgreSQL 16 is the database.

## Goals / Non-Goals

**Goals:**
- Stripe customer + subscription lifecycle (create, cancel, resume, upgrade/downgrade)
- Webhook handler for billing events (invoice paid/failed, subscription status changes)
- Subscription guard middleware gating premium API endpoints
- Web pricing page and checkout flow
- Web billing settings (current plan, renewal date, manage link)
- Mobile paywall screen for non-subscribers
- Free trial enforcement server-side

**Non-Goals:**
- In-app purchases (Apple/Google Play billing) — out of scope for this sprint; PaywallScreen links to web checkout
- Coupon/promo code UI — Stripe handles this natively if codes are applied at checkout
- Invoice history UI — available via Stripe Billing Portal, not custom-built
- Metered billing or usage-based plans

## Decisions

### 1. Stripe as the sole payment processor
Stripe was chosen in the PRD and is referenced in the Terms of Service and Privacy Policy. No alternative considered. All subscription state is mirrored locally but Stripe is the source of truth.

### 2. Stripe Billing Portal for self-service management
Rather than building custom cancel/upgrade/payment-method UI, we redirect users to the Stripe-hosted Billing Portal. This reduces surface area, keeps PCI scope minimal, and gets us a fully featured billing management UI for free.
- **Alternative considered**: custom cancel/upgrade flows — rejected due to complexity and maintenance cost at this stage.

### 3. Mirror subscription state locally in PostgreSQL
We store `stripe_customer_id`, `stripe_subscription_id`, `plan_id`, `status`, `current_period_end`, and `trial_end` in a `subscriptions` table. This avoids a Stripe API call on every request to check subscription status.
- Kept in sync via Stripe webhooks.
- **Alternative considered**: query Stripe on every request — rejected due to latency and rate limit risk.

### 4. NestJS Guard for subscription enforcement
A `SubscriptionGuard` is applied at the route level to premium endpoints (books content, reader). It reads subscription status from the local DB. Returns 403 with `{ error: "subscription_required" }` for non-subscribers.
- **Alternative considered**: middleware — Guard is more idiomatic in NestJS and composable with existing AuthGuard.

### 5. Checkout via Stripe Checkout (hosted)
We create a Stripe Checkout Session server-side and redirect the client. This keeps card data entirely off our servers.
- Success/cancel redirect URLs point to `/billing/success` and `/billing/cancel` on the web app.

### 6. Plan IDs as environment variables
Stripe Price IDs vary between test and production environments. We inject them via env vars (`STRIPE_PRICE_ID_INDIVIDUAL_MONTHLY`, etc.) rather than hard-coding or storing in DB.

## Risks / Trade-offs

- **Webhook replay / race conditions** → Mitigation: process webhooks idempotently using `stripe_event_id`; skip already-processed events.
- **Subscription state drift** (webhook missed) → Mitigation: add a `/api/subscriptions/sync` endpoint that re-fetches from Stripe on demand; expose it in account settings as "Refresh status".
- **Mobile paywall links to web checkout** → Users on iOS must leave the app to subscribe. This is intentional to avoid Apple's 30% cut at MVP stage. Note: Apple guideline compliance must be reviewed before App Store submission.
- **Trial abuse** → Stripe handles trial-per-customer enforcement; we trust Stripe's `trial_end` field.

## Migration Plan

1. Run DB migration: add `stripe_customer_id` to `users`, create `subscriptions` and `plans` tables, seed plan records.
2. Deploy API with Stripe keys in env — no routes gated yet.
3. Register webhook endpoint in Stripe Dashboard (test mode first).
4. Enable `SubscriptionGuard` on premium routes after verifying webhook flow end-to-end in staging.
5. Deploy web pricing + billing UI.
6. Switch Stripe keys to live mode for production launch.

**Rollback**: Remove `SubscriptionGuard` from routes; all content becomes accessible again. No data is lost.

## Open Questions

- Do we offer a free tier (limited books/month) or hard paywall? — Assume hard paywall for MVP; free trial covers evaluation.
- Trial length? — Assume 14 days, configurable via Stripe product settings.
- Dual Reader plan: are the 2 profiles sub-accounts or just shared access? — Assume shared access (same login) for MVP; sub-accounts deferred.
