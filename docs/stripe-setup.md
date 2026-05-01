# Stripe Setup Guide

This document describes how to register the Stripe webhook endpoint and configure environment variables for both test and live modes.

---

## 1. Prerequisites

- A Stripe account (test mode for development, live mode for production)
- The Noetia API running and publicly reachable (use [ngrok](https://ngrok.com) for local development)
- The Stripe CLI installed: `brew install stripe/stripe-cli/stripe`

---

## 2. Environment Variables

Add the following to your `.env` (copy from `.env.example`):

```env
STRIPE_SECRET_KEY=sk_test_...          # sk_live_... in production
STRIPE_WEBHOOK_SECRET=whsec_...        # from Stripe Dashboard or CLI
STRIPE_PRICE_ID_INDIVIDUAL_MONTHLY=price_...
STRIPE_PRICE_ID_INDIVIDUAL_ANNUAL=price_...
STRIPE_PRICE_ID_DUAL_MONTHLY=price_...
STRIPE_PRICE_ID_DUAL_ANNUAL=price_...
```

---

## 3. Test Mode Webhook (local development)

Use the Stripe CLI to forward events to your local API without needing a public URL.

```bash
stripe login
stripe listen --forward-to http://localhost:3001/webhooks/stripe
```

The CLI will print your **webhook signing secret** (`whsec_...`). Copy it into `STRIPE_WEBHOOK_SECRET` in your `.env`.

To trigger test events manually:

```bash
stripe trigger checkout.session.completed
stripe trigger invoice.paid
stripe trigger invoice.payment_failed
stripe trigger customer.subscription.updated
stripe trigger customer.subscription.deleted
```

---

## 4. Test Mode Webhook (Stripe Dashboard)

For a shared staging environment:

1. Go to **Developers → Webhooks** in the [Stripe Dashboard](https://dashboard.stripe.com/test/webhooks).
2. Click **Add endpoint**.
3. Set the endpoint URL to `https://<your-staging-host>/webhooks/stripe`.
4. Select the following events to listen for:
   - `checkout.session.completed`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Click **Add endpoint**.
6. Copy the **Signing secret** from the endpoint details page into `STRIPE_WEBHOOK_SECRET`.

---

## 5. Live Mode Webhook (production)

1. Switch to **Live mode** in the Stripe Dashboard (toggle top-left).
2. Go to **Developers → Webhooks → Add endpoint**.
3. Set the endpoint URL to `https://api.noetia.app/webhooks/stripe` (replace with your production domain).
4. Select the same five events as above.
5. Copy the **Signing secret** into the production `STRIPE_WEBHOOK_SECRET` environment variable.
6. Replace `STRIPE_SECRET_KEY` with your live secret key (`sk_live_...`).
7. Update all `STRIPE_PRICE_ID_*` vars with the live-mode Price IDs from **Products → Prices**.

---

## 6. Creating Products and Prices in Stripe

If you haven't created the products yet, run the following in the Stripe Dashboard (**Products → Add product**):

| Product        | Price       | Interval | ID env var                          |
|----------------|-------------|----------|-------------------------------------|
| Individual     | $9.99       | Monthly  | `STRIPE_PRICE_ID_INDIVIDUAL_MONTHLY` |
| Individual     | $89.00      | Yearly   | `STRIPE_PRICE_ID_INDIVIDUAL_ANNUAL`  |
| Dual Reader    | $14.99      | Monthly  | `STRIPE_PRICE_ID_DUAL_MONTHLY`       |
| Dual Reader    | $135.00     | Yearly   | `STRIPE_PRICE_ID_DUAL_ANNUAL`        |

After creating each price, copy the Price ID (`price_...`) into the corresponding env var.

---

## 7. Verifying the Setup

1. Start the API: `docker-compose up api`
2. Start the Stripe CLI forwarding (see §3) or use a real webhook endpoint (see §4).
3. In a separate terminal, trigger a test checkout:
   ```bash
   stripe trigger checkout.session.completed
   ```
4. Confirm the API logs show the event received and processed.
5. Query the database to verify the subscription record was created:
   ```sql
   SELECT * FROM subscriptions ORDER BY created_at DESC LIMIT 1;
   ```
