# 02 — Stripe Live/Test Configuration (Safe Verification)

**Status: CANNOT be determined from source code.** Stripe keys are environment-provided (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) and never committed. The seeded price IDs (`price_1…`) share the same format in both live and test mode, so they don't disambiguate. This document is a **safe procedure** for the team to run — it never prints or transmits a secret.

## Why it matters — INFERRED
- If production runs **test** keys: real money is never captured — subscriptions/purchases appear to work but no revenue lands, and webhooks come from Stripe test mode.
- If production runs **live** keys: everything is real — a mistaken test action (refund, cancel) affects real customers.
- A new engineer assuming the wrong mode could mis-handle billing. Confirming mode is a prerequisite for any billing change.

## Safe checks (no secret exposure)

### A. Key mode by prefix — reveals mode without revealing the secret
Stripe secret keys are prefixed `sk_live_…` or `sk_test_…`. Read **only the prefix**, never the full value:
```bash
# On the server, from /opt/noetia — prints ONLY the mode word, not the key:
grep -E '^STRIPE_SECRET_KEY=' .env.production | sed -E 's/.*sk_(live|test)_.*/STRIPE MODE: \1/'
grep -E '^STRIPE_WEBHOOK_SECRET=' .env.production | sed -E 's/.*(whsec_).*/WEBHOOK SECRET: present/'
```
Expected: one line `STRIPE MODE: live` or `STRIPE MODE: test`. If it prints the raw line instead, the key isn't in the expected format — stop and inspect manually (do not paste the value anywhere).

### B. Confirm against Stripe (authoritative) — Stripe Dashboard
- Log into the Stripe Dashboard. The **Test mode** toggle (top-right) shows which mode you're in.
- Under **Developers → Webhooks**, confirm an endpoint pointing at `https://noetia.app/api/webhooks/stripe` exists **in the same mode** as the running key, and that its signing secret matches `STRIPE_WEBHOOK_SECRET`. A live key with a test webhook (or vice-versa) silently drops events.
- Under **Payments**, a live account shows real charges; test mode shows test charges only.

### C. Cross-check the price IDs
- In the Dashboard (in the confirmed mode), verify the price IDs stored in `plans.stripePriceId` exist. A live key with test price IDs (or vice-versa) makes checkout fail with "No such price".
```bash
# List the price IDs the app will hand to Stripe (no secrets):
docker compose --env-file .env.production -f docker-compose.server.yml exec -T db \
  psql -U noetia -d noetia -c "SELECT name, interval, \"stripePriceId\" FROM plans;"
```
Then confirm each ID resolves in the Dashboard's matching mode.

## Decision matrix
| Key mode | Webhook mode | Price IDs mode | Verdict |
|----------|--------------|----------------|---------|
| live | live | live | ✅ Production-correct |
| test | test | test | ⚠️ Not capturing real revenue — intended only if pre-launch |
| any mismatch | — | — | ❌ Broken — checkout or webhooks silently fail; fix before selling |

## What NOT to do — SAFETY
- Do not paste the full `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` into chat, logs, tickets, or a screen share.
- Do not run a Stripe API call that echoes the key.
- The prefix check (A) is sufficient to determine mode without exposure.

## Deliverable
Record the outcome (one of the three verdicts above) in the remediation plan. This is the one open must-verify item carried over from NEM-001 (C2).
