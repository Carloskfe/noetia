# Release A — Validation Evidence

**Release:** NEM-011 + NEM-012 + NEM-014 + NEM-015 on `release/acquisition-a` (draft PR #14) · **Date:** 2026-10-29
**Status:** local real-stack validation **done**; **staging validation with Stripe test mode NOT yet done** — required by the Product Owner before deployment approval is requested.

## 1. Local real-stack validation (done)

Environment: local Docker dev stack serving the release branch (API container mounts `services/api/src`; web mounts `app/`, `components/`, `lib/`), local PostgreSQL at the current migration (`…066`), Stripe **test** key in the API container (prefix verified, value never printed). No route mocks. Throwaway accounts `nem012-*@example.test` in the **local** database only.

| # | Check | Result |
|---|---|---|
| 1 | Free account (no subscription) balance | `GET /subscriptions/me` → `{status:'none', tokenBalance:0, availableTokens:0}` |
| 2 | Paid book, not owned | `GET /books/:id` → 403 `{error:'subscription_required', bookId}` |
| 3 | Retired per-title purchase (NEM-015) | `POST /subscriptions/books/:id/purchase` → **410** `{error:'title_purchase_discontinued'}` |
| 4 | Library bypass (NEM-011) | `POST /library/:paidId` → **403** |
| 5 | Public summary | `GET /books/:id/summary` → 200, fields `author, category, coverUrl, description, id, isFree, language, title` only |
| 6 | Webhook signature | Wrongly signed `checkout.session.completed` → **400**; correctly signed (same scheme as Stripe, signed inside the API container) → 201 |
| 7 | Token-pack fulfilment, duplicate delivery | Same event delivered twice → balance **1** (not 2) |
| 8 | Free account unlocks in a real browser | Unlock screen (cover, title, "You have 1 token", "Unlock with 1 token", "Get tokens", no purchase option) → unlock → reader renders the book; balance 0; `GET /books/:id` 200; ownership `token` |
| 9 | Household member, legacy streaming | Member reads via owner's plan (200), sees **Unlock** in the top bar; dialog shows plan copy + pooled "1 token"; unlock spends the **owner's pool** (both balances 0); ownership recorded on the **member** |

## 2. Automated evidence

| Suite | Result |
|---|---|
| api unit | 952/952 |
| api integration (real PostgreSQL) | 21/21 locally; CI job green on PR #14 |
| NEM-014 revert check | pre-NEM-011 code fails 9/18 in CI (throwaway PR #15, closed) |
| web unit | 337/337 |
| web E2E | 13/13 ×3 locally against the branch (4 new acquisition flows); production run skips the new flows until deployed |
| mobile unit | 195/195 |

Coverage thresholds (80%) remain unmet for api branches, web, and mobile — pre-existing, unchanged policy.

## 3. Not yet validated — release blockers

| Gap | Why it matters | How to close |
|---|---|---|
| **Stripe-hosted Checkout + real Stripe webhook delivery (test mode)** | Proves the token-pack price IDs, the hosted payment page, and Stripe→endpoint delivery end to end | On staging (below). Locally, token packs carry placeholder price IDs, and creating test-mode prices was not authorized |
| **Staging run** | PO requirement before requesting deployment approval | Procedure below |
| **Mobile on a device / simulator** | Mobile changes are unit-tested only (no renderer in the test setup) | Expo build against staging API |
| **Reconciliation baseline + Stripe open/async/failed-delivery check** | B-10, B-11 inputs; no in-flight per-title purchase lost | Operator runbook `nem-011-ownership-reconciliation.md` |

## 4. Minimum safe staging path (NEM-006A / 006C — not merged, per PO)

1. **Operator checks on the host** (read-only, one line each): staging stack healthy (`docker ps` for `noetia_staging-*`), which branch `/opt/noetia-staging` has checked out, `.env.staging` holds a `sk_test_` key (prefix check, as in `production-safety/02`), a **test-mode** webhook endpoint for `https://staging.noetia.app/api/webhooks/stripe` exists.
2. **Validation branch** — `release/acquisition-a` + `nem-006c-staging-content` (dry-run merge: clean, 21 files). Created and checked out **only on the staging host checkout**; never merged into `main` or the release branch; staging auto-deploy stays unarmed (no `staging` branch).
3. **Deploy staging manually** per `docs/staging/RUNBOOK.md` (`-p noetia_staging -f docker-compose.staging.yml`).
4. **Test-mode token packs on staging** — staging `token_packages` need **test-mode** Stripe price IDs (staging-only configuration; PO action in Stripe test mode).
5. **Run the flows** with Stripe test cards: buy a pack (free account) → webhook → balance → unlock → read; subscriber unlock; household member unlock; per-title endpoint 410; owned-book regression; mobile against the staging API.
6. Record results here; then request deployment approval.

## 5. Regression review (2026-10-30) — authorization, payment, entitlement

Full source diff `main..release/acquisition-a` reviewed (API, web, mobile).

| # | Finding | Severity | Outcome |
|---|---|---|---|
| RV-1 | **Mobile downloaded copies:** removing the app-level paywall let a canceled subscriber open the app and read downloaded copies of paid books never acquired — the reader loaded the offline copy before any check | **High (entitlement regression introduced by NEM-012)** | **Fixed** (`5363b6f`): online, the reader re-checks access and shows the unlock panel on denial; 3 unit tests. Offline, the copy still opens → open decision NEM-013 O-2 |
| RV-2 | Webhook granted per-title ownership without checking `payment_status` | Medium (pre-existing) | **Fixed in NEM-015**: `paid` / `no_payment_required` or `async_payment_succeeded` only |
| RV-3 | Token-pack and gift fulfilment also ignore `payment_status` | Low (pre-existing; card-only checkouts complete as `paid`) | **Not changed** (out of scope; protected behaviour). Recommend the billing-foundation mission |
| RV-4 | `POST /subscriptions/books/:id/redeem` accepts a **free** book, spending a token for nothing | Low (pre-existing; no UI offers it) | Not changed; recommend rejecting free books in a follow-up |
| RV-5 | Content-access decision (`SubscriptionGuard`) | — | Unchanged except `bookId` on denials — legacy streaming intact (NEM-013 still DRAFT) |
| RV-6 | Retired purchase route | — | 410 before any service or Stripe call; JWT still required |
| RV-7 | Redemption transaction | — | Single transaction, `FOR UPDATE SKIP LOCKED`, `ON CONFLICT DO NOTHING`, status-guarded spend; proven by the real-DB suite and the CI revert check |
| RV-8 | Mobile `DownloadButton` lets legacy-streaming subscribers download non-owned books | Pre-existing | Belongs to NEM-013 (offline revalidation) |

Agent permissions: no change to `.claude/settings.local.json` is part of any PR; no permission was expanded. That file is tracked in the repository (it was accidentally committed once and reverted on PR #12) — recommend `.gitignore` + untracking it, with PO approval.

## 6. Final-approval evidence checklist

| Evidence | Status |
|---|---|
| Staging W1–W11, M1–M4 (`release-a-staging-validation-plan.md` §3) | ⏳ operator |
| Reconciliation baseline counts (§4 of the plan) | ⏳ operator |
| PR reviews #11, #12, #13, #14 (Product Architecture) | ⏳ |
| Recovery drill (`release-a-recovery-plan.md` §2) | ✅ local drill passed |
| Real-DB integration in CI + revert check | ✅ |
| Local real-stack validation (§1) | ✅ |
| Merge method agreed: merge commit, not squash | ⏳ PO |
| Open decisions B-2, B-3, B-5, B-10, B-11 | Not blocking Release A, except B-5 if expiry copy is wanted |
