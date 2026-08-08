# NEM-002 — Production Safety & Business-Critical Verification

> Deliberately small scope. **Verify and design only** — no Noetia+ code, no staging implementation, no feature work. Fixes are *designed* in the remediation plan and await explicit approval before any code change.
> Labels: **CONFIRMED** (from source) · **INFERRED** · **UNKNOWN** · **OUT OF SCOPE**. Code is source of truth.

## Scope

1. Verify annual-plan monthly token issuance.
2. Verify Stripe live/test configuration — safely (no secret exposure).
3. Verify Stripe webhook idempotency.
4. Design a staging strategy (design only — do not implement).
5. Inventory every admin route and verify authorization.
6. Identify the smallest safe remediation plan.

## Documents

| # | Document | Result |
|---|----------|--------|
| 01 | [01-annual-token-issuance.md](01-annual-token-issuance.md) | **RESOLVED** — was unscheduled; fix shipped this cycle (`1a6f695`). |
| 02 | [02-stripe-mode-verification.md](02-stripe-mode-verification.md) | **PROCEDURE** — safe steps for the team to confirm live/test (can't be read from code). |
| 03 | [03-webhook-idempotency.md](03-webhook-idempotency.md) | **FINDING** — state is idempotent; **token issuance is NOT** (double-issue on redelivery). |
| 04 | [04-admin-authorization.md](04-admin-authorization.md) | **FINDING** — all admin routes gated **except** `admin/tokens` uses a broken check (deny-all, wrong field). |
| 05 | [05-staging-strategy.md](05-staging-strategy.md) | **DESIGN** — options + recommendation, not implemented. |
| 06 | [06-remediation-plan.md](06-remediation-plan.md) | **PLAN** — smallest safe remediation, prioritized. |

## Verdict summary

| Item | Status | Severity | Customer impact today |
|------|--------|----------|-----------------------|
| Annual token issuance | ✅ Fixed | was CRITICAL | none (0 annual subs; latent) |
| Stripe live/test mode | ⏳ Needs team check | CRITICAL if wrong | unknown until verified |
| Webhook idempotency (token issuance) | ⚠️ Confirmed gap | HIGH | intermittent over-crediting on Stripe redelivery |
| Admin authorization (`admin/tokens`) | ⚠️ Confirmed bug | MEDIUM (fails **closed**) | admin token tools unusable via API |
| Staging | 📋 Designed | — | — |

## Constraint compliance
No secrets, keys, credentials, env-var values, or PII appear in these documents. No source code was changed as part of NEM-002. No Noetia+ code was written.
