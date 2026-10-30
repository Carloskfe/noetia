# NOETIA ENGINEERING MISSION — NEM-015
## Retire Direct Per-Title Purchase (B-1)

**Status:** IN PROGRESS — implementation authorized by the Product Owner (Release A preparation, 2026-10-29)
**Mission type:** REMEDIATION
**Implementation authorization:** LIMITED (§5)
**Schema changes:** NOT AUTHORIZED (none needed)
**Infrastructure changes:** NOT AUTHORIZED
**Production deployment:** NOT AUTHORIZED — separate explicit Product Owner approval required; when approved, only inside Release A (NEM-011 + NEM-012 + NEM-014 + NEM-015)
**Product Owner approval:** GRANTED for implementation within §5 (2026-10-29). Merging and deployment are **not** authorized.

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
3. **Webhook fulfilment kept, permanently, and payment-aware** (PO safeguard 4 — obligations do not end 24 h after creation):
   - `checkout.session.completed` with `metadata.bookId` → ownership only when `payment_status` is `paid` or `no_payment_required`; `unpaid` (a delayed payment method) is logged and waits.
   - `checkout.session.async_payment_succeeded` → ownership (idempotent); `async_payment_failed` → nothing granted, logged.
   - Each late fulfilment logs `late_title_purchase_fulfilled session=<id> via=<completed|async_succeeded>` — session id only.
   - Token-pack and gift handling unchanged.
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

## 15a. Pending-obligation timeline (investigation, 2026-10-29)

| Window | Source of a late event | Handling |
|---|---|---|
| ≤ 24 h after creation | An **open** Checkout Session can still complete (Stripe's maximum session expiry; the code sets none, so the default applies) | Fulfilled on `checkout.session.completed` (paid) |
| ≤ ~3 days | Stripe **retries** a webhook delivery that failed | Same handler; `stripe_processed_events` + idempotent insert make redelivery safe |
| Days | **Delayed payment methods** report the outcome via `async_payment_succeeded/failed`. The code requests `payment_method_types: ['card']`, so this should not occur — handled anyway | Fulfil on success, nothing on failure |
| Months | **Refunds and disputes** on historical purchases | **Not handled by the application** (audit G7); ownership is never revoked automatically. Operator cross-check in the reconciliation runbook; accounting treatment is B-11 |

Implication: the webhook path for `metadata.bookId` stays in the code permanently (O-1 default), and the retirement is safe at any time — no session can be *created* after deploy, and every session created before it is honoured on confirmed payment.

## 16. Open decisions

| # | Question | Recommended default |
|---|---|---|
| **O-1** | Keep the late-fulfilment webhook path permanently, or remove it after a grace period? | Keep permanently — it is idempotent and only reacts to sessions Stripe actually completed |
| **B-11** | Settlement basis for historical purchases | Stripe-sourced actual amount; accounting review (impact assessment §2b) |

## 17. Stop conditions

STOP if retirement requires changing any `user_books` row, a schema change, or a Stripe configuration change; or if the Stripe check shows open per-title sessions whose completion cannot be honoured.

## 18. Completion report (2026-10-29)

**Status:** implemented on `release/acquisition-a` (draft PR #14) — not merged, not deployed.

| Criterion | Evidence |
|---|---|
| 1 — 410 for any book, no Stripe call | `subscriptions.controller.spec.ts` (410 body, no service/Stripe call); route keeps `JwtAuthGuard` only (unconfirmed-email users also get 410) |
| 2 — pre-retirement session fulfilled once | Integration: duplicate + redelivered `checkout.session.completed` → one `purchase` row; unit: paid / `no_payment_required` |
| 2a — delayed payment | Integration: `unpaid` grants nothing; `async_payment_succeeded` grants once; unit: `async_payment_failed` grants nothing |
| 3 — token packs and gifts unchanged | Existing webhook unit tests pass; async events for packs/gifts are ignored (unit) |
| 4 — existing purchases readable, not removable | Integration: purchase ownership survives subscription cancellation; `removeBook` → 409 |
| 5 — no new `purchase` rows after retirement | Only source is the webhook for pre-existing sessions; verified by the reconciliation §5b post-deploy run |

**Changed files:** `services/api/src/subscriptions/subscriptions.controller.ts`, `subscriptions.service.ts` (removed `createPurchaseSession`), `webhooks.service.ts`; tests `tests/unit/subscriptions/{subscriptions.controller,subscriptions.service,webhooks.service}.spec.ts`, `tests/integration/subscriptions/ownership-integrity.int-spec.ts`; docs `docs/PRD.md`, `docs/technical-baseline/{05-api,08-subscriptions}.md`.

## 19. Product Architecture review

Per `REVIEW-CHECKLIST.md`. Verdict: _pending_.
