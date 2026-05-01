## ADDED Requirements

### Requirement: Plans seeded in database
The system SHALL seed a `plans` table with the four Noetia subscription plans on first deploy: Individual Monthly ($9.99), Individual Annual ($89), Dual Reader Monthly ($14.99), Dual Reader Annual ($135). Each plan record SHALL include `id`, `name`, `stripe_price_id`, `interval` (month/year), `amount_cents`, and `max_profiles`.

#### Scenario: Plans available on first boot
- **WHEN** the API starts with a fresh database
- **THEN** four plan records exist in the `plans` table with correct prices and Stripe Price IDs from env vars

### Requirement: Stripe customer created on first checkout
The system SHALL create a Stripe Customer for a user the first time they initiate checkout, and store the `stripe_customer_id` on the `users` table.

#### Scenario: New user initiates checkout
- **WHEN** a user with no `stripe_customer_id` calls `POST /api/subscriptions/checkout`
- **THEN** a Stripe Customer is created with the user's email and the resulting customer ID is saved to the user record

#### Scenario: Returning user initiates checkout
- **WHEN** a user with an existing `stripe_customer_id` calls `POST /api/subscriptions/checkout`
- **THEN** no new Stripe Customer is created; the existing customer ID is used

### Requirement: Checkout session creation
The system SHALL expose `POST /api/subscriptions/checkout` (authenticated) accepting `{ planId: string }`. It SHALL create a Stripe Checkout Session and return `{ url: string }` for client-side redirect.

#### Scenario: Valid plan checkout
- **WHEN** an authenticated user POSTs a valid `planId`
- **THEN** a Stripe Checkout Session is created with the correct `price_id`, `customer`, `success_url`, `cancel_url`, and `trial_period_days` (14)
- **AND** the response contains `{ url }` pointing to Stripe Checkout

#### Scenario: Invalid plan ID
- **WHEN** an authenticated user POSTs an unknown `planId`
- **THEN** the API returns 400 `{ error: "invalid_plan" }`

### Requirement: Subscription record stored after successful payment
The system SHALL maintain a `subscriptions` table with `user_id`, `stripe_customer_id`, `stripe_subscription_id`, `plan_id`, `status`, `current_period_end`, `trial_end`, `stripe_event_id` (last processed).

#### Scenario: Checkout completed
- **WHEN** Stripe fires `checkout.session.completed`
- **THEN** a subscription record is created or updated with `status = active` and correct `current_period_end`

### Requirement: Subscription cancellation
The system SHALL expose `POST /api/subscriptions/cancel` (authenticated). It SHALL cancel the subscription at period end via Stripe and update local status to `canceling`.

#### Scenario: User cancels subscription
- **WHEN** an authenticated subscriber calls `POST /api/subscriptions/cancel`
- **THEN** Stripe subscription is set to `cancel_at_period_end = true`
- **AND** local subscription status is updated to `canceling`
- **AND** the response returns `{ cancelAt: ISO8601_date }`

#### Scenario: Non-subscriber tries to cancel
- **WHEN** a user with no active subscription calls `POST /api/subscriptions/cancel`
- **THEN** the API returns 404 `{ error: "no_active_subscription" }`

### Requirement: Subscription resume
The system SHALL expose `POST /api/subscriptions/resume` (authenticated) to reactivate a `canceling` subscription before the period ends.

#### Scenario: User resumes canceling subscription
- **WHEN** an authenticated user with status `canceling` calls `POST /api/subscriptions/resume`
- **THEN** Stripe `cancel_at_period_end` is set to false
- **AND** local status reverts to `active`

### Requirement: Webhook event processing
The system SHALL expose `POST /api/webhooks/stripe` (unauthenticated, Stripe-signed). It SHALL verify the Stripe signature and process: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`. Events SHALL be processed idempotently using `stripe_event_id`.

#### Scenario: Invoice paid
- **WHEN** Stripe fires `invoice.paid`
- **THEN** `current_period_end` and `status = active` are updated on the local subscription

#### Scenario: Invoice payment failed
- **WHEN** Stripe fires `invoice.payment_failed`
- **THEN** local subscription status is updated to `past_due`

#### Scenario: Subscription deleted
- **WHEN** Stripe fires `customer.subscription.deleted`
- **THEN** local subscription status is updated to `canceled`

#### Scenario: Duplicate event
- **WHEN** the same `stripe_event_id` is received twice
- **THEN** the second event is acknowledged with 200 and no DB changes are made

#### Scenario: Invalid webhook signature
- **WHEN** a request arrives at the webhook endpoint with an invalid Stripe signature
- **THEN** the API returns 400 and logs the attempt

### Requirement: Subscription status endpoint
The system SHALL expose `GET /api/subscriptions/me` (authenticated) returning the current user's subscription status.

#### Scenario: Active subscriber
- **WHEN** an authenticated active subscriber calls `GET /api/subscriptions/me`
- **THEN** the response includes `{ status, planId, currentPeriodEnd, trialEnd }`

#### Scenario: No subscription
- **WHEN** an authenticated user with no subscription record calls `GET /api/subscriptions/me`
- **THEN** the response returns `{ status: "none" }`

### Requirement: Manual subscription sync
The system SHALL expose `POST /api/subscriptions/sync` (authenticated) that re-fetches the subscription from Stripe and updates the local record.

#### Scenario: Sync corrects stale status
- **WHEN** an authenticated user calls `POST /api/subscriptions/sync`
- **THEN** the subscription record is updated to match current Stripe state
- **AND** the response returns the updated subscription object
