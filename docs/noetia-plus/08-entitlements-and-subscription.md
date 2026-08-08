# 08 — Entitlements & Subscription

## The two independent axes (must stay technically separate)
```
Book ownership  (permanent)          Noetia+ subscription (recurring)
= user_books rows                    = an active Noetia+ plan entitlement
→ read, listen, progress,            → intelligence services AROUND
  fragments, notes, bookmarks          owned/eligible content
FOREVER, cancellation-proof          on/off with billing
```
These are **orthogonal**. A user can be in any quadrant:

| | Owns books | No books |
|--|-----------|----------|
| **Has Noetia+** | full experience | intelligence over public-domain + previews |
| **No Noetia+** | **full permanent reading** (unchanged) | free/public tier |

**Architectural guarantee:** owned-book reading paths (reader, audio, progress, fragments) must **never** call a Noetia+ entitlement check. Cancelling Noetia+ changes only `knowledge/*` access. This is what makes "Books are permanent" true in code.

## Feature-entitlement system (no scattered plan checks)
**Recommendation:** a small **entitlement service** + a **`PlusEntitlementGuard`** composed on the existing `SubscriptionGuard` — not `if (plan === …)` sprinkled through controllers.

Design:
- A **plan → feature-set map** (config/DB): each Noetia+ plan grants a named set of **capabilities** (`plus.ask_book`, `plus.ask_library`, `plus.compare`, `plus.create`, `plus.memory`, `plus.maps`, …).
- **User-level overrides:** beta grants, admin overrides, per-capability flags ([18](18-feature-flags-rollout.md)).
- **`@RequiresCapability('plus.ask_book')`** decorator + `PlusEntitlementGuard` resolves: *authenticated?* (JwtAuthGuard) → *active Noetia+?* (subscription) → *capability granted by plan?* → *capability flag enabled?* → allow/deny. One guard, declarative per route.
- The guard returns a typed 402/403 ("Noetia+ required" / "not in your plan") that the UI turns into an **upgrade prompt**, not a hard error.

This mirrors the existing `SubscriptionGuard` pattern (already in the codebase) and the just-fixed inline-admin-check lesson (NEM-002A): **centralize the check, don't scatter it.**

## Reusing existing billing
- **Stripe/Plan/Subscription/webhooks:** add a **Noetia+ plan** (or plans) as new rows + Stripe prices *(not created in this mission)*. Reuse the (now idempotent — NEM-002A) webhook path; a Noetia+ subscription is just another `Subscription`/`Plan` with a feature-set mapping. No pricing/plan changes here.
- **Entitlement resolution:** `Subscription.status ∈ active|trialing` + plan feature-set → capabilities. Duo/Family: Noetia+ entitlement can be per-member or shared — an **OPEN DECISION** ([20](20-open-product-decisions.md)); default recommendation: **per-member** (intelligence is personal; shared book-token pools do **not** imply shared Noetia+).
- **`token_ledger` is NOT touched.** Book tokens = acquisition. Noetia+ = service. AI usage metered separately ([07](07-cost-and-usage-model.md), [09](09-data-model.md)).

## Cancellation behavior (design)
On Noetia+ cancellation (`customer.subscription.deleted` / period end):
- Owned books, fragments, notes, progress: **untouched**.
- Noetia+ capabilities: revoked at period end (guard denies).
- **AI conversations & knowledge assets after cancellation:** retained-read-only? deleted after grace? → **OPEN DECISION** ([20](20-open-product-decisions.md)). Recommended default: **retain read-only** (user's own intellectual work) with export; re-enable on resubscribe.

## ADR candidates
- **Feature-entitlement architecture** (capability map + guard + overrides).
- **Duo/Family Noetia+ model** (per-member vs shared).
- **Post-cancellation knowledge-asset retention.**
