# Stripe Setup Guide

This document describes how to create products in Stripe, register the webhook endpoint, and configure environment variables for production.

---

## 0. Payment activation gate (`PAYMENTS_ENABLED`) — read first

Configuring a Stripe key **does not** activate payments. The API builds a Stripe client only when **both**:

1. `PAYMENTS_ENABLED` is exactly `true` (whitespace ignored, case-sensitive — `TRUE`, `1`, `yes` are **off**), and
2. `STRIPE_SECRET_KEY` is a Stripe secret or restricted key (`sk_test_…`, `sk_live_…`, `rk_test_…`, `rk_live_…`).

Otherwise every Stripe path fails closed with its existing error — checkout for subscriptions, token packages,
books and **anonymous gifts**, the billing portal, cancel/resume/sync (`400 {"error":"payments_not_configured"}`),
and `POST /api/webhooks/stripe` (`400 Stripe is not configured`, nothing fulfilled). The API logs one line at boot:
`[payments] disabled (...)` or `[payments] ENABLED (Stripe test|live mode)` — never the key.
Implementation: `services/api/src/common/payments-activation.ts`.

**Production state until the financial release:** `PAYMENTS_ENABLED` unset or `false`.

### Financial-release activation procedure (requires its own Product Owner authorization)

Setting `PAYMENTS_ENABLED=true` in production **is** the financial release. It is never part of an infrastructure,
public-site or other deploy. Prerequisites (all recorded and accepted first):

1. The payment-lifecycle corrections (PR #60 scope) are merged and deployed, and every financial gate is closed or
   explicitly accepted by the PO: G-1, G-4, G-5, W-1, W-2/SG-PM, USD-1, D4 portal configuration, gift-email recovery,
   Terms / legal disclosures.
2. Stripe live products/prices verified (§3), the live webhook registered (§4) and `STRIPE_WEBHOOK_SECRET` set.
3. An explicit PO instruction naming the activation, an operator present, a backup confirmed, no CD running.

Steps (single-line edits on the server — never paste multi-line content):

1. `nano /opt/noetia/.env.production` → set `STRIPE_SECRET_KEY=sk_live_…` and `PAYMENTS_ENABLED=true`.
2. Recreate the API through the normal deploy path (the env file is read only at container creation).
3. `docker logs noetia-api-1 2>&1 | grep '\[payments\]'` → `[payments] ENABLED (Stripe live mode)`.
4. Acceptance per the financial-release plan (Stripe test-mode rehearsal first; one controlled live transaction only
   if the PO authorizes it).

**Rollback (kill switch):** set `PAYMENTS_ENABLED=false` (or remove it) and recreate the API. All new checkouts and
billing calls stop immediately with `payments_not_configured`. Note: while disabled, Stripe webhook deliveries are
rejected and Stripe retries them for up to 3 days; re-enable within that window or replay events from the Stripe
Dashboard so already-paid sessions are fulfilled.

---

## 1. Prerequisites

- A Stripe account (test mode for development, live mode for production)
- The Noetia API running and publicly reachable
- The Stripe CLI installed (optional, for local testing): `brew install stripe/stripe-cli/stripe`

---

## 2. Environment Variables

Add the following to `.env.production` on the server:

```env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Subscription plans
STRIPE_PRICE_ID_INDIVIDUAL_MONTHLY=price_...
STRIPE_PRICE_ID_INDIVIDUAL_ANNUAL=price_...
STRIPE_PRICE_ID_DUO_MONTHLY=price_...
STRIPE_PRICE_ID_DUO_ANNUAL=price_...
STRIPE_PRICE_ID_FAMILY_MONTHLY=price_...
STRIPE_PRICE_ID_FAMILY_ANNUAL=price_...

# Token packages (one-time payments)
STRIPE_PRICE_ID_TOKEN_1=price_...
STRIPE_PRICE_ID_TOKEN_3=price_...
STRIPE_PRICE_ID_TOKEN_5=price_...
STRIPE_PRICE_ID_TOKEN_10=price_...
```

---

## 3. Create Products and Prices in Stripe Dashboard

Go to **Products → Add product** for each row below. All subscription plans use **recurring** billing. Token packages use **one-time** payment.

### Subscription Plans (recurring)

| Product name   | Price     | Interval | Env var                              |
|----------------|-----------|----------|--------------------------------------|
| Individual     | $8.99     | Monthly  | `STRIPE_PRICE_ID_INDIVIDUAL_MONTHLY` |
| Individual     | $83.99    | Yearly   | `STRIPE_PRICE_ID_INDIVIDUAL_ANNUAL`  |
| Duo            | $13.99    | Monthly  | `STRIPE_PRICE_ID_DUO_MONTHLY`        |
| Duo            | $129.99   | Yearly   | `STRIPE_PRICE_ID_DUO_ANNUAL`         |
| Family         | $18.99    | Monthly  | `STRIPE_PRICE_ID_FAMILY_MONTHLY`     |
| Family         | $179.99   | Yearly   | `STRIPE_PRICE_ID_FAMILY_ANNUAL`      |

### Token Packages (one-time)

| Product name | Price   | Tokens | Env var                    |
|--------------|---------|--------|----------------------------|
| 1 Token      | $9.99   | 1      | `STRIPE_PRICE_ID_TOKEN_1`  |
| 3 Tokens     | $24.99  | 3      | `STRIPE_PRICE_ID_TOKEN_3`  |
| 5 Tokens     | $39.99  | 5      | `STRIPE_PRICE_ID_TOKEN_5`  |
| 10 Tokens    | $74.99  | 10     | `STRIPE_PRICE_ID_TOKEN_10` |

After creating each price, copy the Price ID (`price_...`) into the corresponding env var in `.env.production`.

---

## 4. Register the Live Webhook

1. In the Stripe Dashboard, switch to **Live mode** (toggle top-left).
2. Go to **Developers → Webhooks → Add endpoint**.
3. Set the endpoint URL to: `https://noetia.app/api/webhooks/stripe`
4. Select these events:
   - `checkout.session.completed`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Click **Add endpoint**.
6. Copy the **Signing secret** (`whsec_...`) into `STRIPE_WEBHOOK_SECRET` in `.env.production`.

---

## 5. Deploy and Run Migration

After setting all env vars in `.env.production`:

```bash
# SSH into server
ssh -p 222 root@84.247.140.175
cd /opt/noetia

# CURRENT procedure. After DEP-1 activation use docs/operations/production-rollback.md §6 instead
# of the pull/build/migrate commands below.
# Pull latest code (includes migration 041)
git pull origin main

# Rebuild and restart containers
docker compose --env-file .env.production -f docker-compose.server.yml up -d --build

# Run migration 041 — updates all stripePriceId values from env vars
docker compose --env-file .env.production -f docker-compose.server.yml exec -T -e DB_HOST=db api npm run migration:run:prod
```

---

## 6. Local Development (test mode)

Use the Stripe CLI to forward events to your local API:

```bash
stripe login
stripe listen --forward-to http://localhost:3001/webhooks/stripe
# Copy the printed whsec_... into STRIPE_WEBHOOK_SECRET in .env
```

Trigger test events manually:

```bash
stripe trigger checkout.session.completed
stripe trigger invoice.paid
stripe trigger invoice.payment_failed
stripe trigger customer.subscription.updated
stripe trigger customer.subscription.deleted
```

---

## 7. Verifying the Setup

1. Start the API: `docker compose up api`
2. Trigger a test checkout from the pricing page.
3. Confirm the API logs show the event received and processed.
4. Query the database to verify:

```sql
-- Check subscription plan price IDs
SELECT name, interval, "stripePriceId" FROM plans ORDER BY name, interval;

-- Check token package price IDs
SELECT name, "tokenCount", "amountCents", "stripePriceId" FROM token_packages ORDER BY "tokenCount";

-- Verify a subscription was created after checkout
SELECT * FROM subscriptions ORDER BY created_at DESC LIMIT 1;
```
