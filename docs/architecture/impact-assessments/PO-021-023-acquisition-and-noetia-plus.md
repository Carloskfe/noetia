# Impact Assessment — PO-021 / PO-022 / PO-023

**Book acquisition by ownership · Independent Noetia+ · Subscription-free acquisition**
**Date:** 2026-10-29 · **Nature:** analysis only — no code, Stripe, migration, or production change
**Decisions:** [PO-021](../../operating-framework/decisions/product-owner/PO-021-token-based-book-acquisition.md) (H1) · [PO-022](../../operating-framework/decisions/product-owner/PO-022-independent-noetia-plus-subscription.md) (H2) · [PO-023](../../operating-framework/decisions/product-owner/PO-023-subscription-free-book-acquisition.md) (H3)

> **Repository note.** PO-005 … PO-020 and the Decision Registry (`docs/operating-framework/`) live on the unmerged branch `nem-009-resilience-impl`. PO-021 … PO-023 are written at the same path so they join that registry on merge; links to PO-006 … PO-013 resolve once it lands. Registry rows to add are in §8.

---

## 1. Summary

The decisions are coherent with each other and with the creator-economics policy. The code is not:

| Finding | Where | Decision broken |
|---|---|---|
| Any active subscriber (or linked member) reads **every** paid book | `services/api/src/subscriptions/subscription.guard.ts:37-54` | PO-021.4/.5, PO-023.5 |
| The **whole mobile app** is behind a subscription paywall — free accounts and canceled subscribers cannot open it, including books they own | `services/mobile/src/api/subscriptions.ts:24-26`, `navigation/RootNavigator.tsx:60` | PO-021.6, PO-023.1/.4/.6 |
| **No UI redeems tokens** (web or mobile) — the API endpoint exists, nothing calls it | `POST /subscriptions/books/:bookId/redeem`; no client caller | PO-021.3, PO-023.3 |
| **One subscription per user** at the database level | migration `1714000000009` `uq_subscriptions_user UNIQUE ("userId")`; webhook upsert `conflictPaths: ['userId']`; 11 `userId`-only lookups | PO-022, PO-023.8 |
| Paid-book club creation requires a subscription, not ownership | `services/api/src/clubs/clubs.service.ts:34-37` | PO-021, PO-023.6 |
| No free-sample mechanism | — | PO-021.1 |

What already works for PO-023: token packages are bought with a one-time Stripe Checkout (`mode: 'payment'`), guarded only by login + confirmed email; gift cards are claimed without a subscription; the API's redemption needs no subscription; the reader guard checks ownership **before** subscription status, so web access to owned books survives cancellation.

## 2. Conflicts (reported, not resolved)

Each entry: where · what conflicts · proposed precise update. **Policy and product-copy updates need Product Owner approval; code updates need a mission.**

| # | Where | Conflict | Proposed update |
|---|---|---|---|
| **C-01** | `subscription.guard.ts:37-54` (code) | Active / trialing / canceling subscription — or being in `linkedUserIds` — grants full access to non-owned paid books | Access = `book.isFree` OR `user_books` row [OR authorized sample]. Remove the subscription branch; keep `past_due` only for subscription-service endpoints, never for owned content |
| **C-02** | Mobile `requiresPaywall` + `RootNavigator` (code) | App-level paywall for `none / canceled / past_due` | No app-level paywall. Library, owned books, free books always reachable; acquisition prompt per paid book |
| **C-03** | Web + mobile (code) | No redemption UI; gift-claim copy promises "use your tokens to unlock books in your library" | Book page / reader 403 → "Unlock with 1 token" (balance shown) or "Get tokens" → `/pricing` token packs |
| **C-04** | `clubs.service.ts:34-37` (code) | `subscription_required_for_paid_book_club` | Gate on ownership of the club book (matches the existing join/discuss ownership gates in `club-members.service.ts:126-131`, `club-discussions.service.ts:35`) |
| **C-05** | DB + `subscriptions.service.ts`, `webhooks.service.ts`, `subscription.guard.ts`, `users.service.ts`, `clubs.service.ts` (code/schema) | One subscription row per user | Product-line model (§4) — migration required |
| **C-06** | `docs/PRD.md` § Monetization ("Pay-per-Title … permanently unlocks"; "Subscribers can also purchase titles at list price without spending a token") + code `createPurchaseSession` | PO-021 names token acquisition; silent on direct per-title purchase | **PO ruling required.** If retained: amend PO-021.2 to "acquisition using a token **or a direct title purchase**", and extend PO-007/PO-008/PO-010 to define the per-title gross value and accrual. If retired: disable the endpoint in a mission and mark the PRD section `SUPERSEDED BY PO-021` |
| **C-07** | `docs/PRD.md:228-229` | "JWT-authenticated access to all book content"; "SubscriptionGuard enforces entitlement on every content endpoint" | "Content endpoints require an ownership entitlement (or free status); subscriptions never unlock content (PO-021)." |
| **C-08** | NEM-003 [`08-entitlements-and-subscription.md`](../../noetia-plus/08-entitlements-and-subscription.md) §"Reusing existing billing" | "add a Noetia+ plan as new rows … a Noetia+ subscription is just another `Subscription`/`Plan`" — impossible under `uq_subscriptions_user`, and would let a Noetia+ checkout overwrite a book-plan row | Replace with: "Noetia+ is a separate Stripe Subscription and a separate `subscriptions` row with `productLine = 'plus'` (PO-022); a customer may hold one active row per product line." |
| **C-09** | NEM-003 `08` §Feature-entitlement + [`02-current-integration-surface.md`](../../noetia-plus/02-current-integration-surface.md) row `SubscriptionGuard` | `PlusEntitlementGuard` "composed on the existing `SubscriptionGuard`" — that guard is the book-content gate | "`PlusEntitlementGuard` resolves the **Noetia+** product-line entitlement only; it never composes with, or is consulted by, the ownership-based content guard." |
| **C-10** | [`technical-baseline/05-api.md:75`](../../technical-baseline/05-api.md), `07-authentication.md:36` | Describes guarded routes as "Must have active subscription/entitlement" | Baseline describes code — update when the C-01 mission lands, not before |
| **C-11** | Web `lib/i18n/{en,es}.ts:352-354`, mobile `src/i18n/{en,es}.ts:104-106` (copy) | Plan highlight "Full library access" / "Acceso completo a la biblioteca" | Proposed: "Unlock books you keep forever" / "Desbloquea libros que conservas para siempre" — **PO/marketing approval**; ship with C-01 |
| **C-12** | `services/web/tests/e2e/subscribe-to-unlock.spec.ts` | Encodes "subscribe → unlock" | Rename/re-scope to "acquire → read" with C-01 |
| **C-13** | [PO-010](../../operating-framework/decisions/product-owner/PO-010-token-gross-value-basis.md) §1 | "monthly subscription price ÷ monthly token allocation" — ambiguous once a customer also pays for Noetia+ | Clarify: "the price of the **book-token plan** only; Noetia+ and any other product line are excluded (PO-022)." |
| **C-14** | [PO-011](../../operating-framework/decisions/product-owner/PO-011-causas-recognition-basis.md) + Terms of Service ("2.22% of **every payment**") | Does Noetia+ revenue qualify? Do token packages? | **PO clarification required.** Engineering default pending a ruling: record the product line on every payment so either answer is computable |
| **C-15** | [PO-012](../../operating-framework/decisions/product-owner/PO-012-marketing-and-breakage-treatment.md) | 7.78% Marketing is payment-level — same question for Noetia+ | **PO clarification required** (same mechanism as C-14) |
| **C-16** | Terms of Service (`web/lib/legal/terms-of-service.ts`) | Silent on: subscription ≠ catalogue access, free-account token purchase, Noetia+, independent cancellation; annual prices already conflict (audit) | **Legal review + update before C-01 ships**; customer notice of the access change |
| **C-17** | `docs/PRD.md` Family "3 tokens … up to 6 users" vs code 4 tokens / 5 seats vs ToS 4 members | Pre-existing (audit C-02); unaffected by H1–H3 but blocks plan copy | PO ruling (existing open item) |

**No conflict** with PO-001 … PO-004, ADR-001 … ADR-004, PO-007, PO-008, PO-012's creator rule, or PO-013. PO-021 *strengthens* ADR-002's "owned/licensed-by-user" content class and makes PO-008's "every qualifying paid redemption" the only paid-read path.

## 3. Implementation impact matrix

| Area | PO-021 (ownership access) | PO-022 (independent Noetia+) | PO-023 (subscription-free) |
|---|---|---|---|
| **API** | Remove subscription branch in `SubscriptionGuard` (C-01); club creation gate (C-04); per-book 403 payload `acquisition_required` + token balance; future sample-range endpoints | Product-line-aware entitlement service; `PlusEntitlementGuard`; webhook routing by `stripeSubscriptionId` + plan product line; token issuance only for book-plan invoices | Already supports token purchase + redemption; ensure no `ACTIVE_STATUSES` check sits on any owned-content path (verified for `GET /books/:id`, sync map, progress) |
| **Web** | Reader 403 → acquisition screen; book page "Unlock with token"; hide "+" on paid books (done in NEM-011); copy (C-11); E2E (C-12) | Separate Noetia+ purchase/manage surface; pricing page shows two independent product lines | Token-pack purchase without a plan exists on `/pricing`; add redemption UI (C-03) |
| **Mobile** | Remove app-level paywall (C-02); per-book acquisition prompt; **offline copies of non-owned books** downloaded under the old behaviour need revalidation | Noetia+ entry point (web checkout link, as today) | Free accounts must be able to use the app (C-02); redemption UI (C-03) |
| **Stripe** | None | New Product + Prices for Noetia+ (**not now**); a customer holds **separate Subscription objects** per product line — independent periods, trials, `cancel_at_period_end`; Billing Portal configured to manage multiple subscriptions | One-time `payment` Checkout already used for token packs; unchanged |
| **Database** | None for access (ownership already in `user_books`); samples may need per-title sample metadata (rights-dependent) | **Migration:** drop `uq_subscriptions_user`; add `productLine` to `plans` and `subscriptions`; unique `(userId, productLine)` for non-terminal rows; webhook upserts keyed by `stripeSubscriptionId`. Existing rows backfilled `productLine = 'books'` | None |
| **Creator settlement** | Every paid read = an acquisition → obligation per PO-007/008 at acquisition; per-title purchases need a basis if retained (C-06) | Revenue category on every payment (`books_plan` / `token_pack` / `title_purchase` / `plus` / `gift`) so Noetia+ is excluded from creator allocation and PO-010 basis by construction | Token-pack tokens carry PO-010 §2 basis; free-account acquisitions accrue like any other |
| **Docs / legal** | PRD (C-07), baseline (C-10), ToS (C-16) | NEM-003 08/02 (C-08, C-09), PO-010 (C-13) | ToS (C-16) |

## 4. Noetia+ in Stripe and the schema (assessment)

- **Stripe:** a Customer can hold several Subscriptions at once; each has its own price, billing anchor, trial, cancellation, invoices and webhooks. That satisfies PO-022 and PO-023.8 natively. A **multi-item** subscription (one Subscription, two prices) is **not** suitable: items share one billing cycle and one cancellation, contradicting "own billing lifecycle … cancellation handling".
- **Today's code cannot hold two:** `uq_subscriptions_user`, `upsertFromWebhook(... conflictPaths: ['userId'])`, and `findOneBy({ userId })` everywhere mean a second Stripe subscription would **overwrite** the first row. This is already latent: `createCheckoutSession` does not stop a user with one plan from checking out another.
- **Proposed model:** `plans.productLine ∈ {books, plus}`; `subscriptions.productLine` copied from the plan; one non-terminal row per `(userId, productLine)`; webhooks resolve the row by `stripeSubscriptionId` and the product line by price → plan; every reader of "the subscription" names its product line. Book-plan logic (tokens, seats, `linkedUserIds`, annual drip) is scoped to `books`.

## 5. Recommended mission boundaries

Numbers are assigned at approval; letters avoid reserving IDs.

| Mission | Scope | Depends on | Blocks |
|---|---|---|---|
| **NEM-011** (PR #11, unchanged) | Acquisition bypass + atomic redemption | — | everything that relies on trustworthy ownership |
| **M-A Acquisition UX** | Redemption UI (web + mobile), reader/book 403 → acquisition screen, gift-claim → redeem, mobile app-level paywall removed (C-02, C-03) | NEM-011 | M-B |
| **M-B Ownership-based access** | C-01, C-04, offline revalidation, copy (C-11), E2E (C-12), transition policy, baseline docs (C-10) | M-A; decisions B-1, B-2, B-3; ToS update (C-16) | — |
| **M-C Subscription product lines** | Migration + webhook/guard/service refactor (§4); no Noetia+ product | NEM-011 merged (same files) | M-F |
| **M-D Billing foundation** | Audit G7 refunds/disputes, G8 event ordering + `planId`, G9 deletion cancels Stripe, G13 payment records with revenue category | — (pairs with M-C) | settlement, M-F |
| **M-E Free samples** | Sample ranges, sample narration, rights gating | Rights metadata (NEM-007 Phase B / IG-04), decision B-4 | — |
| **M-F Noetia+ billing & entitlement** | Stripe product/prices, checkout, `PlusEntitlementGuard`, cancellation | M-C, M-D; price / trial / household decisions | NEM-003 Phase 0 |
| **NEM-007 B / NEM-008** (reserved) | Creator attribution + settlement, accrual at acquisition, Noetia+ excluded by revenue category | M-D payment records | — |

**Coordination with NEM-011:** its scope is not expanded. Its open decision D1 (no redemption UI) is now structural — M-A is the remedy and should ship with or immediately after NEM-011. M-B must **not** ship before M-A: removing streaming before a redemption path exists would leave subscribers with tokens and no way to use them.

## 6. Revised subscription development roadmap

1. **Now** — review/merge NEM-011 (P0); operations: Stripe live/test mode check + canonical prices; merge this decision record.
2. **M-A Acquisition UX** — with or right after NEM-011.
3. **M-C + M-D** — in parallel once NEM-011 is merged (shared files).
4. **M-B Ownership-based access** — after M-A, the transition decision, and the ToS update.
5. **Creator attribution + settlement** (NEM-007 B / NEM-008) — parallel track, needs M-D payment records.
6. **M-E Free samples** — after rights metadata.
7. **M-F Noetia+ billing** — after M-C/M-D and pricing decisions; then NEM-003 Phase 0 on staging; then Noetia Brain.
8. **Household Noetia+** — after the D8 decision.

## 7. Unresolved business decisions

| # | Decision | Needed by |
|---|---|---|
| **B-1** | Direct per-title purchase: retain or retire? (C-06) | M-B; settlement |
| **B-2** | Transition for current subscribers who read non-owned books: notice period, grandfathering, conversion offer; what happens to their progress and highlights on those books | M-B |
| **B-3** | Household: may Duo/Family members read books acquired by another member, or only their own acquisitions? | M-B |
| **B-4** | Free samples: length, narration availability, rights-holder permissions | M-E |
| **B-5** | 90-day expiry for tokens bought by free accounts and gift tokens: unchanged? | M-A copy |
| **B-6** | Causas 2.22% and Marketing 7.78% on Noetia+ payments and token packages (C-14, C-15) | M-D, settlement |
| **B-7** | Book-plan value proposition and copy once catalogue access is gone (C-11) | M-B |
| **B-8** | Noetia+ catalogue, AI limits, price, trial, household (pending per PO-022) | M-F |
| **B-9** | Canonical plan and token-pack prices; Family seats/tokens (audit H3–H5, C-17) | M-B copy, M-F |
| **B-10** | Historical bypass rows (NEM-011 D2) — now the *only* access path for those books after M-B | before M-B |

## 8. Decision Registry rows to add (when `docs/operating-framework/` lands on `main`)

```
| PO-021 | PO | Token-based book acquisition (ownership-based access) | DECIDED | Business, access | [PO-021](decisions/product-owner/PO-021-token-based-book-acquisition.md) | NOT IMPLEMENTED |
| PO-022 | PO | Independent Noetia+ subscription | DECIDED | Business, billing | [PO-022](decisions/product-owner/PO-022-independent-noetia-plus-subscription.md) | NOT IMPLEMENTED |
| PO-023 | PO | Subscription-free book acquisition | DECIDED | Business, billing | [PO-023](decisions/product-owner/PO-023-subscription-free-book-acquisition.md) | PARTIAL |
```
