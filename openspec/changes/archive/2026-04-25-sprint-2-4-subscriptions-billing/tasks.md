## 1. Database — Migration & Seed

- [x] 1.1 Add migration: create `plans` table with columns `id`, `name`, `stripe_price_id`, `interval`, `amount_cents`, `max_profiles`
- [x] 1.2 Add migration: add `stripe_customer_id VARCHAR` column to `users` table
- [x] 1.3 Add migration: create `subscriptions` table with columns `id`, `user_id`, `stripe_customer_id`, `stripe_subscription_id`, `plan_id`, `status`, `current_period_end`, `trial_end`, `stripe_event_id`, `created_at`, `updated_at`
- [x] 1.4 Add seed: insert four plan records (Individual Monthly $9.99, Individual Annual $89, Dual Reader Monthly $14.99, Dual Reader Annual $135) reading Stripe Price IDs from env vars
- [x] 1.5 Update `infra/postgres/init.sql` to include plans seed and new tables

## 2. API — Subscriptions Module

- [x] 2.1 Create `services/api/src/subscriptions/subscriptions.module.ts` — NestJS module wiring service, controller, and Stripe provider
- [x] 2.2 Create `services/api/src/subscriptions/subscriptions.service.ts` — implement `getOrCreateStripeCustomer`, `createCheckoutSession`, `createPortalSession`, `cancelSubscription`, `resumeSubscription`, `getSubscriptionStatus`, `syncSubscription`
- [x] 2.3 Create `services/api/src/subscriptions/subscriptions.controller.ts` — expose `POST /subscriptions/checkout`, `POST /subscriptions/cancel`, `POST /subscriptions/resume`, `POST /subscriptions/portal`, `GET /subscriptions/me`, `POST /subscriptions/sync`
- [x] 2.4 Create `services/api/src/subscriptions/dto/checkout.dto.ts` — `CreateCheckoutDto { planId: string }`
- [x] 2.5 Create `services/api/src/subscriptions/plans.service.ts` — load plan records from DB; expose `findById(id)` and `findAll()`
- [x] 2.6 Add Stripe SDK: `npm install stripe` in `services/api`; add `STRIPE_SECRET_KEY` and `STRIPE_PRICE_ID_*` to `.env.example`

## 3. API — Webhook Handler

- [x] 3.1 Create `services/api/src/subscriptions/webhooks.controller.ts` — expose `POST /webhooks/stripe` with raw body parsing; verify Stripe signature using `STRIPE_WEBHOOK_SECRET`
- [x] 3.2 Create `services/api/src/subscriptions/webhooks.service.ts` — handle `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`; enforce idempotency via `stripe_event_id`
- [x] 3.3 Disable global body parser for the webhook route (raw body required for signature verification)

## 4. API — Subscription Guard

- [x] 4.1 Create `services/api/src/subscriptions/subscription.guard.ts` — NestJS guard that reads subscription status from DB; allows `active`, `trialing`, `canceling`; returns 403 with `{ error: "subscription_required" }` or `{ error: "payment_required" }` for `past_due`
- [x] 4.2 Apply `SubscriptionGuard` (after `AuthGuard`) to books content routes and reader endpoints in `services/api/src/books/books.controller.ts`
- [x] 4.3 Apply `SubscriptionGuard` to `POST /books/:id/progress` in the reading-progress controller

## 5. API — Unit Tests

- [x] 5.1 Create `services/api/tests/unit/subscriptions/subscriptions.service.spec.ts` — mock Stripe SDK and DB; test `getOrCreateStripeCustomer` (new user, returning user), `createCheckoutSession` (valid plan, invalid plan), `cancelSubscription` (active, no subscription), `resumeSubscription`, `syncSubscription`
- [x] 5.2 Create `services/api/tests/unit/subscriptions/webhooks.service.spec.ts` — test each webhook event type, idempotency (duplicate event), invalid signature handling
- [x] 5.3 Create `services/api/tests/unit/subscriptions/subscription.guard.spec.ts` — test active subscriber allowed, non-subscriber 403, past_due 403, unauthenticated 401
- [x] 5.4 Run `npm run test` in `services/api` — all tests pass; run `npm run test:cov` — coverage ≥ 80%

## 6. Web — Pricing Page

- [x] 6.1 Create `services/web/app/(billing)/pricing/page.tsx` — server component fetching plans from `GET /api/subscriptions/me`; renders four plan cards with prices, features, and CTA buttons
- [x] 6.2 Create `services/web/components/PlanCard.tsx` — client component; accepts `plan`, `isCurrentPlan`, `onSelect`; shows savings badge for annual plans; triggers checkout on CTA click
- [x] 6.3 Create `services/web/app/(billing)/billing/success/page.tsx` — calls `POST /api/subscriptions/sync` on mount; displays confirmation message and "Start reading" link
- [x] 6.4 Create `services/web/app/(billing)/billing/cancel/page.tsx` — displays "No charge was made" and "View plans" link to `/pricing`

## 7. Web — Billing Settings

- [x] 7.1 Create `services/web/app/(account)/account/billing/page.tsx` — fetches subscription status from `GET /api/subscriptions/me`; renders current plan, status badge, renewal date; "Manage billing" and "Refresh status" actions
- [x] 7.2 Add billing link to account navigation / settings layout

## 8. Web — Unit Tests

- [x] 8.1 Create `services/web/tests/unit/components/PlanCard.spec.ts` — test renders correct price, savings badge for annual plans, calls onSelect on CTA click
- [x] 8.2 Create `services/web/tests/unit/app/billing/success.spec.ts` — mock fetch; test that sync is called on mount and confirmation is shown
- [x] 8.3 Run `npm run test` in `services/web` — all tests pass; run `npm run test:cov` — coverage ≥ 80%

## 9. Mobile — Paywall Screen

- [x] 9.1 Create `services/mobile/src/screens/PaywallScreen.tsx` — React Native screen; displays plan summary (Individual $9.99/mo, Dual Reader $14.99/mo) and feature list; "Subscribe now" button calls `Linking.openURL('https://noetia.app/pricing')`
- [x] 9.2 Update root navigator (`services/mobile/src/screens/`) — on app start, call `GET /api/subscriptions/me`; if `status` is `none` or `canceled`, render `PaywallScreen`; if `active` or `trialing`, render main stack
- [x] 9.3 Create `services/mobile/src/screens/PaywallScreen.tsx` subscription status hook — `useSubscriptionStatus()` returning `{ status, isLoading }`; caches result in memory for the session

## 10. Mobile — Unit Tests

- [x] 10.1 Create `services/mobile/tests/unit/screens/PaywallScreen.spec.ts` — mock `Linking`; test plan info renders, "Subscribe now" calls `Linking.openURL` with correct URL
- [x] 10.2 Run `npm run test` in `services/mobile` — all tests pass

## 11. Environment & Configuration

- [x] 11.1 Add to `.env.example`: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_INDIVIDUAL_MONTHLY`, `STRIPE_PRICE_ID_INDIVIDUAL_ANNUAL`, `STRIPE_PRICE_ID_DUAL_MONTHLY`, `STRIPE_PRICE_ID_DUAL_ANNUAL`
- [x] 11.2 Add Stripe webhook endpoint registration instructions to `docs/stripe-setup.md` (test mode and live mode)

## 12. Verification

- [ ] 12.1 Run full checkout flow: sign in → `/pricing` → select plan → Stripe Checkout → `/billing/success`; verify subscription record created in DB
- [ ] 12.2 Verify webhook events processed: trigger test webhook from Stripe Dashboard CLI; confirm local subscription status updates
- [ ] 12.3 Verify subscription guard: call a premium route without subscription; confirm 403 returned
- [ ] 12.4 Open `/account/billing`; verify plan name, renewal date, "Manage billing" redirects to Stripe portal
- [ ] 12.5 Test cancel flow: cancel from Stripe portal; verify status updates to `canceling` or `canceled` after webhook
- [x] 12.6 All API, web, and mobile tests pass
- [x] 12.7 Commit and push all changes to GitHub
