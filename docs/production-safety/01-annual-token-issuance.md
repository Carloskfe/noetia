# 01 — Annual-Plan Monthly Token Issuance

**Status: RESOLVED this cycle (`1a6f695`).**

## What was verified — CONFIRMED
- Annual subscriptions are billed once per year, so Stripe fires `invoice.paid` **once**; months 2–12 of token grants must come from an internal scheduler.
- `SubscriptionsService.issueMonthlyTokensForAnnualPlans()` implements that drip (finds `active` subs with `nextTokenIssuanceAt < now`, issues `tokensPerCycle`, advances +30 days).
- **The method had zero callers** — no `@Cron`, controller, worker, or script (verified by exhaustive repo grep). `ScheduleModule.forRoot()` is registered (cron infra works); the trigger was simply never attached.
- Effect: annual subscribers would have received ~**1/12** of their token entitlement.

## Blast radius — CONFIRMED (prod, this cycle)
- Active annual subscriptions on production: **0** → defect was **latent**, no customer harmed, **no backfill required**.
- Annual plans carry real Stripe price IDs (`price_1…`) and are sellable, so the defect would flip to **active** on the first annual purchase.

## Fix shipped — CONFIRMED
- Added `@Cron(EVERY_DAY_AT_1AM) issueAnnualPlanTokensCron()` — an error-isolated wrapper around the existing (unchanged) method. Idempotent via the `nextTokenIssuanceAt < now` guard (daily runs cannot double-issue within a 30-day window). Runs at 01:00, distinct from the 02:00 persona cron.
- 5 unit tests added (`subscriptions.service.spec.ts`); suite 66/66 green.
- Committed `1a6f695`, deploys via CD on `main`.

## Residual verification — recommended after deploy
- Confirm the cron is registered/running (API logs around 01:00; it logs only on error). Optional: temporarily reduce interval in a controlled check, or add a one-line "issued N for M subs" info log if you want positive confirmation.
- Re-check when the first annual subscription is created: after ~30 days, that subscriber should have received a second token grant.

## Interaction with idempotency (see [03](03-webhook-idempotency.md)) — NOTE
`issueMonthlyTokensForAnnualPlans` is self-idempotent (its `nextTokenIssuanceAt` guard advances the pointer), so this cron is **not** part of the webhook double-issue concern in doc 03. They are independent.
