# 09 — Token Economy

Tokens are Noetia's unit of book access (renamed from "credits" in migration 038). A token is redeemed to unlock a book permanently.

## Ledger model — CONFIRMED (`token_ledger`)
Each token is a row: `userId`, `subscriptionId`, `type` (`paid | promotional | courtesy`), `status` (`active | redeemed | expired`), `issuedAt`, `expiresAt`, `activatedAt`, `redeemedAt`, `bookId`, `reason`. This is an **append-only ledger** — issuance and redemption are recorded per-token, not as a mutable balance counter (though `subscriptions.tokenBalance` also exists as a cached figure).

## Issuance — CONFIRMED (`SubscriptionsService.issueTokens`)
- Central mint: `issueTokens(userId, count, type, opts)` inserts N ledger rows with `expiresAt = now + expiryDays`.
- **Expiry: `TOKEN_EXPIRY_DAYS = 90`** (constant). Promotional tokens use a shorter window per admin issuance (project notes: 30 d) — **INFERRED** the caller passes a different `expiryDays`.
- Issuance sources:
  - Subscription cycle: `issueTokensForNewSubscription` / `issueMonthlyTokensForAnnualPlans` grant `plan.tokensPerCycle`.
  - Token package purchase: `issueTokensForPurchasedPackage` (type `paid`).
  - Promotional: `POST /admin/tokens/promotional`.
  - Courtesy: `POST /admin/tokens/courtesy/issue` (see below).
  - Gift cards (see below).

## Redemption — CONFIRMED (`redeemToken`)
- `redeemToken(userId, bookId)` selects the **oldest active, non-expired** token (`order: issuedAt ASC`) and marks it `redeemed` with `redeemedAt` + `bookId`.
- **Shared pools:** if the user has no own tokens, it resolves the subscription owner via `:userId = ANY(sub.linkedUserIds)` and redeems from the owner's pool. Duo/Family members draw from one shared balance.
- `getActiveTokenCount(userId)` counts `status='active' AND expiresAt > now`.
- `expireStaleTokens(userId)` lazily flips expired active tokens to `expired` on read.

## Book access resolution — CONFIRMED
`user_books(userId, bookId, purchaseType)` records access, where `purchaseType ∈ free | token | courtesy | purchase`. Redeeming a token or completing a paid checkout adds a `user_books` row (`addPurchasedBook`). Free-library books are accessible without a token.

## Courtesy tokens — CONFIRMED
`courtesy_token_quotas(userId, grantedById, role, granted, used)` where `role ∈ author | publisher | narrator`. Admins set quotas (`POST /admin/tokens/courtesy/quotas`) and issue courtesy tokens (`/courtesy/issue`) — non-purchased grants for content contributors.

## Gift cards — CONFIRMED (`gifts` module, `gift_cards`)
- Buyer purchases a gift via Stripe (`POST /gifts/checkout`) with `recipientEmail`, `message`, `occasion`, `tokenCount`.
- `claimToken` (unique) delivered to recipient; `GET /gifts/preview/:token` previews; `POST /gifts/claim` credits tokens to the claimer (`claimedByUserId`, `claimedAt`, status `sent→claimed`), `expiresAt` bounded.

## Redemption codes & waitlist — CONFIRMED
- `upload_codes` — single-use codes (`/admin/codes`), tied to a user, with `usedAt`. Used for author upload entitlement / access grants (**INFERRED** exact semantics).
- `waitlist_entries` — pre-launch capture with invite flow (`/waitlist`).

## Economics (business rules) — INFERRED from code + docs
- 90-day paid-token expiry is enforced in code (`TOKEN_EXPIRY_DAYS`). Promo/courtesy expirations vary by caller.
- Revenue-split percentages, narrator payouts, and "Causas Noetia" allocations are **business rules documented in project memory**, only partially represented in code (`causes`, `courtesy_token_quotas`). Payout computation is **UNKNOWN** at the code level (no payout/settlement engine found) — see [19-technical-debt.md](19-technical-debt.md).

## Peer token gifting vs gift cards — CONFIRMED distinction
Gift cards (`gift_cards`) are Stripe purchases delivered by email. Project notes also describe peer-to-peer token gifting from an existing balance; at the code level the **gift-card** path is what is implemented and confirmed here.
