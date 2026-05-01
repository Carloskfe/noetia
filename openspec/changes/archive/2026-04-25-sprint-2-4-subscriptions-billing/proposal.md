## Why

Noetia has authentication, reading, fragments, and legal groundwork in place — but no way to monetise. Without a billing layer, users can access all content for free and the platform cannot sustain itself. Stripe integration is the prerequisite for every paid feature downstream.

## What Changes

- Stripe customer and subscription lifecycle management in the API (create, upgrade, downgrade, cancel, resume)
- Webhook handler for Stripe events (invoice paid, payment failed, subscription updated/deleted)
- Subscription plans seeded in the database (Individual and Dual Reader, monthly + annual)
- Billing portal session endpoint (redirect to Stripe-hosted portal for self-service)
- Subscription status guard — middleware that gates access to premium content
- Web billing UI: pricing page, plan selection, checkout redirect, post-checkout success/cancel pages
- Account settings billing section: current plan, next renewal date, manage/cancel link
- Trial support: free-trial period tracked and enforced server-side
- Mobile paywall screen: shown when a non-subscriber tries to access premium content

## Capabilities

### New Capabilities

- `subscriptions`: Stripe subscription lifecycle — create, upgrade, downgrade, cancel, resume; maps Stripe plans to internal plan IDs; exposes subscription status to the rest of the API
- `billing-portal`: Stripe Billing Portal session creation; lets users self-manage payment method, invoices, and cancellation without custom UI
- `subscription-guard`: Middleware/guard that checks active subscription status before allowing access to premium API endpoints and content
- `pricing-page`: Web pricing page with plan cards, feature comparison, and checkout CTA; handles post-checkout redirect flow
- `billing-settings`: Account settings billing section — shows current plan, renewal date, and link to Billing Portal
- `mobile-paywall`: React Native paywall screen shown to non-subscribers; links to web checkout or in-app purchase stub

### Modified Capabilities

- `reading-progress`: Reading access must be gated behind an active subscription; unauthenticated or free users are redirected to the paywall

## Impact

- **API**: new `subscriptions` module (NestJS), Stripe SDK dependency, webhook endpoint, subscription guard applied to books/reading routes
- **DB**: `subscriptions` table, `stripe_customer_id` column on users, `plans` seed data
- **Web**: new routes `/pricing`, `/billing/success`, `/billing/cancel`, billing section in `/account`; Stripe.js client dependency
- **Mobile**: new `PaywallScreen`, navigation guard update
- **Env vars**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_*` (4 price IDs)
- **Worker**: no changes in this sprint
- **image-gen**: no changes
