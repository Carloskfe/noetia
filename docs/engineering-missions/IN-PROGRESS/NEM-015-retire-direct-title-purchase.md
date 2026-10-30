# NOETIA ENGINEERING MISSION — NEM-015
## Retire Direct Per-Title Purchase (B-1)

**Status:** DRAFT
**Mission type:** REMEDIATION
**Implementation authorization:** LIMITED (§5)
**Schema changes:** NOT AUTHORIZED (none needed)
**Infrastructure changes:** NOT AUTHORIZED
**Production deployment:** AUTHORIZED WITH CONDITIONS — only inside Release A (NEM-011 + NEM-012 + NEM-015), see the coordinated rollout plan
**Product Owner approval:** REQUIRED (B-1 approved 2026-10-29; this specification not yet approved)

> Reminder: **APPROVED ≠ EXECUTE.** Executed only on an explicit Product Owner instruction naming NEM-015.

---

## 1. Context

PO decision **B-1** ([PO-021 Amendment 1](../../operating-framework/decisions/product-owner/PO-021-token-based-book-acquisition.md)): paid books are acquired only through token redemption; direct per-title purchase is discontinued; existing purchases stay owned; `POST /subscriptions/books/:bookId/purchase` is retired by a separately approved mission — this one.

The endpoint creates a Stripe Checkout Session with **inline `price_data`** from `books.priceCents` (`subscriptions.service.ts` `createPurchaseSession`). There is no Stripe Product or Price to archive, so only code can close it. No client calls it today; any published book with a `priceCents` is purchasable through the API.

## 2. Objective

No new direct title purchase can start; any purchase already in flight completes; every existing purchase stays permanent ownership.

## 3. Dependencies

NEM-011 (same release branch). Pre-deploy: reconciliation §5 + Stripe open-session check ([runbook](../../operations/nem-011-ownership-reconciliation.md)).

## 5. In scope

1. `POST /subscriptions/books/:bookId/purchase` → **`410 Gone { error: 'title_purchase_discontinued' }`**, before any Stripe call. The route stays registered (a clear error, not a 404).
2. `createPurchaseSession` removed from the service; no new Checkout Sessions with `metadata.bookId`.
3. **Webhook fulfilment kept:** `checkout.session.completed` with `metadata.bookId` still calls `addPurchasedBook` (idempotent), so a session created before retirement — which can complete up to Stripe's default 24 h later — is honoured. Each such late fulfilment logs one line (`late_title_purchase_fulfilled`, session id only).
4. `docs/PRD.md` § Monetization updated per the impact assessment §2b; `docs/technical-baseline/05-api.md` / `08-subscriptions.md` updated.
5. `books.priceCents` left in the schema (column removal would be a schema change; out of scope) — documented as unused.

## 6. Out of scope

Refunds of historical purchases · settlement of historical purchases (B-11, NEM-008) · any change to `user_books` rows · Stripe configuration · token flows (NEM-011/012) · schema changes.

## 7. Product rules

Existing `purchase` ownership is permanent and indistinguishable in access from token ownership (PO-021 Amendment 1 §4).

## 8. Protected systems

Reader/Escucha Activa untouched; token-pack and gift checkouts (`mode: payment` with `tokenPackageId` / `type: gift`) must keep working exactly as today.

## 11. Acceptance criteria

1. `POST /subscriptions/books/:id/purchase` returns 410 for any book, logged-in or not-yet-confirmed users included, and makes **no** Stripe call.
2. A `checkout.session.completed` event with `metadata.bookId` (pre-retirement session) still creates `purchaseType = 'purchase'` ownership, once (idempotent on redelivery).
3. Token-pack and gift webhook fulfilment unchanged.
4. Existing `purchase` ownership still opens in the reader (guard) and cannot be removed (NEM-011).
5. Reconciliation §5b shows no `purchase` rows newer than the retirement time + 24 h.

## 12. Required tests

- Unit: controller returns 410 without touching Stripe; webhook branches (bookId → ownership, tokenPackageId → tokens, gift → gift) unchanged; late-fulfilment log line.
- Integration (real PostgreSQL): replayed `checkout.session.completed` for a book creates exactly one `purchase` row; existing `purchase` row grants access and survives subscription cancellation.
- Negative: no code path creates a Checkout Session with `metadata.bookId`.

## 14. Deployment / rollout

Inside Release A only. Rollback = revert the release (would re-open the endpoint — emergency only).

## 16. Open decisions

| # | Question | Recommended default |
|---|---|---|
| **O-1** | Keep the late-fulfilment webhook path permanently, or remove it after a grace period? | Keep permanently — it is idempotent and only reacts to sessions Stripe actually completed |
| **B-11** | Settlement basis for historical purchases | Stripe-sourced actual amount; accounting review (impact assessment §2b) |

## 17. Stop conditions

STOP if retirement requires changing any `user_books` row, a schema change, or a Stripe configuration change; or if the Stripe check shows open per-title sessions whose completion cannot be honoured.

## 18–19. Completion report and review

Per README Completion Report Standard; Product Architecture review per `REVIEW-CHECKLIST.md`.
