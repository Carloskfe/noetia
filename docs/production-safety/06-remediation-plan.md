# 06 — Smallest Safe Remediation Plan

Ordered by **(risk reduced) ÷ (change size × change risk)** — do the cheapest, highest-safety items first. Each is scoped to the **minimum** change. No Noetia+ work. Fixes are proposed; none are implemented in NEM-002 except where already shipped.

## Priority 0 — Verify Stripe mode (no code) — TEAM ACTION
- **What:** run the safe prefix + Dashboard checks in [02](02-stripe-mode-verification.md); record the verdict.
- **Why first:** it's zero-risk, zero-code, and it gates the meaning of everything else in billing. A wrong mode is itself a CRITICAL.
- **Size:** minutes. **Risk:** none.
- **Exit:** one of {live-correct, test-only, mismatch}. If mismatch → fix env/webhook before selling.

## Priority 1 — Fix `admin/tokens` authorization (one line) — CONFIRMED bug
- **What:** in `admin-tokens.controller.ts`, change `assertAdmin` from `req.user?.userType !== 'admin'` to `!req.user?.isAdmin`.
- **Why:** the current check can never pass (no `'admin'` in the `UserType` enum) → admin token tools are unusable. Aligns with every other admin route.
- **Size:** 1 line + 1–2 unit tests. **Risk:** very low — it currently **fails closed**, so the change only *restores* intended admin access; non-admins still get 403.
- **Guardrail:** do **not** "fix" by adding `'admin'` to `UserType` (that risks opening token-minting to the wrong users). Use `isAdmin`.

## Priority 2 — Make Stripe webhook processing idempotent — CONFIRMED gap
- **What:** add a `stripe_processed_events(event_id PK, type, processed_at)` table (additive migration) and an early-return guard at the top of `WebhooksService.handleEvent` that inserts the `event.id` and skips on unique-violation. See [03](03-webhook-idempotency.md).
- **Why:** prevents token over-issuance on Stripe's at-least-once redelivery (`invoice.paid` renewals and token-package purchases are currently unguarded).
- **Size:** one migration + ~10 lines + unit tests (first delivery processes, duplicate no-ops). **Risk:** low — additive, no change to first-delivery behavior.
- **Optional companion (team):** audit `token_ledger` for past duplicate issuance to size any historical impact (UNKNOWN until checked). No automatic reversal.

## Priority 3 — Confirm the annual-token cron post-deploy — SHIPPED, verify
- **What:** confirm `issueAnnualPlanTokensCron` is registered/running after the `1a6f695` deploy (see [01](01-annual-token-issuance.md)); re-check when the first annual subscription exists.
- **Size:** verification only. **Risk:** none.

## Priority 4 — Stand up staging (design approved → implement) — DESIGN in [05](05-staging-strategy.md)
- **What:** implement the chosen option (recommended: separate small VPS + `staging` branch gate) with separate data stores, Stripe **test** mode, separate secrets, noindex.
- **Why:** removes the "every push redeploys prod" risk and gives migrations a dry run.
- **Size:** meaningful infra/CI work — **the largest item**; deliberately last and out of NEM-002 implementation scope.
- **Risk:** medium (new infra) but isolated from prod if the non-negotiables in [05](05-staging-strategy.md) are followed.

## Priority 5 — Centralize admin authorization (structural) — FUTURE
- **What:** introduce a single `AdminGuard`/`@Roles('admin')` and migrate inline `isAdmin` checks to it (NEM-001 H2).
- **Why:** prevents recurrence of the P1-class drift.
- **Size:** medium refactor across ~5 controllers. **Risk:** low-medium (well-tested guard + route-by-route migration). Not urgent given P1 closes the one active inconsistency.

## Sequencing summary
```
P0 verify Stripe mode        (team, now, no code)
P1 admin/tokens one-liner    (tiny, fails-closed → safe)
P2 webhook idempotency table (small, additive)
P3 confirm annual cron       (verify only)
P4 staging environment       (design → implement, largest)
P5 AdminGuard centralization (structural, later)
```

## What NEM-002 deliberately does NOT do
- No Noetia+ code.
- No staging implementation (design only).
- No code changes beyond the already-shipped annual-token cron; P1/P2 are **proposed** and await explicit approval before implementation.
