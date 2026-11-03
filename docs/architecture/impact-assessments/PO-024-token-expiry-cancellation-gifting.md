# Impact Assessment — PO-024 Token Expiration, Cancellation, and Gifting

**Date:** 2026-10-30 (updated: 1-token purchase clarified by the PO) · **Nature:** documentation only — no code, migration, Stripe, data, or deployment change
**Decision:** [PO-024](../../operating-framework/decisions/product-owner/PO-024-token-expiration-cancellation-gifting.md)
**Code baseline:** `main` (production). Where the unmerged Release A branch (PR #14) differs, it is noted; Release A does not change any rule below.

> Repository note: the decision folder `docs/operating-framework/` exists on `main` only through this PR and PR #12; PO-005…PO-020 live on `nem-009-resilience-impl`.

## 1. What exists today

| Mechanism | Reality | Evidence |
|---|---|---|
| Token ledger | One row per token: `userId`, `subscriptionId?`, `type ∈ paid·promotional·courtesy`, `status ∈ active·redeemed·expired`, `issuedAt`, `expiresAt`, `redeemedAt`, `bookId`, free-text `reason` | `services/api/src/subscriptions/token-ledger.entity.ts` |
| Expiry | `paid` = **90 days** for every paid source; promotional 30; courtesy 30. Expired rows are marked lazily on read | `subscriptions.service.ts:27-29, 63-91` |
| Origin of a paid token | **Not modelled.** Subscription, 1/3/5/10 package, and gift-card tokens are all `type='paid'`; only `subscriptionId` (subscription) and the free-text `reason` (`Purchased 3 Tokens`, `Gift card <id>`) tell them apart | `subscriptions.service.ts:178-183, 282-284, 303-306`; `gifts.service.ts:137-147` |
| Redemption order | **FIFO by `issuedAt`**, own tokens first, then the household owner's pool (Release A makes it atomic; same order) | `subscriptions.service.ts:120, 135` |
| Gift cards | **Stripe purchase** of 1 or 3 tokens for an e-mail recipient ($9.99 / $24.99), claimable for **365 days**; on claim, **new** `paid` tokens are minted with **90 days from the claim**. No link from ledger rows to the gift card except `reason`; no "gifted" marker | `gifts.service.ts:13-14, 58-63, 92-163` |
| Peer-to-peer token gifting (from a balance) | **Not implemented** (backlog note 2026-05-20; contradictions register C-07) | — |
| Cancellation | `cancel_at_period_end` → status `canceling` → `subscription.deleted` → `canceled`. Tokens are not touched | `subscriptions.service.ts:482-490`; `webhooks.service.ts:170, 188-191` |
| Annual plans | `invoice.paid` once per year; a daily cron issues the monthly allocation every 30 days | `subscriptions.service.ts:157-191` |

## 2. Contradictions (reported, not resolved)

| # | Where | Conflict with PO-024 | Proposed amendment (needs approval) |
|---|---|---|---|
| T-1 | `docs/PRD.md` § Token Mechanics | "Paid tokens expire 90 days after issuance" applies to **all** paid tokens. PO-024 sets **six calendar months** for 3/5/10; the 1-token purchase stays at 90 days by **explicit PO decision** (rule 8), so the PRD is wrong only for 3/5/10 | "Subscription tokens and 1-token purchases expire 90 days after issuance; tokens from 3-, 5- and 10-token packages expire six calendar months after issuance; gifted tokens expire 90 days after the gift date (PO-024)." |
| T-2 | Terms of Service (`web/lib/legal/terms-of-service.ts:31, 128`) | "Tokens are valid for 90 days from issuance" | Legal update with T-1's wording + giftability + no re-gifting |
| T-3 | Web pricing copy (`web/lib/i18n/{en,es}.ts:371/373`) | "Additional tokens expire 90 days after purchase" — wrong for 3/5/10 | Per-package expiry copy |
| T-4 | Code: `TOKEN_EXPIRY_DAYS = 90` for every `paid` token; test `creates paid tokens with 90-day expiry` | 3/5/10 packages need six months | Source-aware expiry (mission M-3) |
| T-5 | **Annual plan drip** selects `status: 'active'` only (`subscriptions.service.ts:172`), while cancellation sets `canceling` for the rest of the paid year | **An annual subscriber who cancels stops receiving monthly tokens already paid for** — contradicts rule 5 *and* today's ToS ("cancellation takes effect at the end of the current billing period") | Include `canceling` in the drip until `currentPeriodEnd` (mission M-1) |
| T-6 | Household pool after cancellation: members redeem the owner's pool only while the subscription is `active·trialing·canceling` | Rule 6 says issued tokens stay usable until expiry; today the **owner** keeps them, **members** lose access once the status is `canceled` | Product decision Q-6 |
| T-7 | Informal rule of 2026-05-20 ("all tokens incl. unitary expire after 90 days") | Superseded for 3/5/10 | Recorded in PO-024 |
| T-8 | Gift-card copy "Valid for 90 days from today" | Consistent with rule 11 **only if** the claim date is the "gift date" | Q-2 |

## 3. Compliance matrix

| # | Rule (PO-024) | Current implementation | Gap | Mission |
|---|---|---|---|---|
| 1 | 1 token per monthly allocation (Individual) | ✅ `tokensPerCycle` on `invoice.paid`; annual via 30-day drip | Annual drip drifts (12 × 30 d = 360 d) — edge E-6 | M-1 |
| 2 | Subscription tokens not giftable | ✅ trivially (no gifting exists) | Needs an explicit **non-giftable** marker before gifting ships | M-2 |
| 3 | 90 days from own issuance | ✅ for subscription tokens | — | — |
| 4 | Accumulate; renewal never resets | ✅ each issuance is a new row | — | — |
| 5 | Cancel → no renewal after the paid cycle | ✅ monthly · ❌ **annual drip stops at `canceling`** (T-5) | Defect | **M-1** |
| 6 | Issued tokens usable until expiry after cancel | ✅ owner · ⚠️ household members lose pool access (T-6) | Decision | M-1 (after Q-6) |
| 7 | Acquired books permanent after cancel | ✅ guard checks ownership first; NEM-011 (Release A) protects rows | — | — |
| 8 | 1-token purchase giftable, **exactly 90 days** (explicit PO decision 2026-10-30) | ⚠️ 90 days ✅ (already `TOKEN_EXPIRY_DAYS`); giftable ❌ | Gifting not built; source must be recorded as a giftable package token (M-2) | M-2, M-4 |
| 9 | 3/5/10 giftable, **six calendar months** | ❌ 90 days; ❌ giftable | Expiry + gifting | M-3, M-4 |
| 10 | Only valid, eligible tokens giftable | ❌ | Eligibility needs origin data | M-2, M-4 |
| 11 | Gifted = 90 days from gift date | ⚠️ gift cards mint 90 days from **claim** | Definition (Q-2) | M-4 |
| 12 | No re-gifting | ❌ (no "gifted" marker) | Lineage | M-2, M-4 |
| 13 | No duplicate balance / double redemption | ✅ redemption atomic in Release A (NEM-011); transfer must reuse the same locking | — | M-4 |
| 14 | Auditable issuance → gift → recipient → redemption | ❌ only free-text `reason` | Lineage model | **M-2** |
| 15 | One token → one book | ✅ | — | — |
| 16 | Books survive cancellation / expiry | ✅ | — | — |

**Summary:** documented **and** implemented: 1, 3, 4, 7, 13 (Release A), 15, 16, and 5 for monthly plans. Documented but **not** implemented: 2 (explicitly), 8–12, 14. Contradicted by code or docs: 5 (annual), 6 (household), 9 (expiry), T-1…T-3.

## 4. Data-model and migration requirements (proposed; additive only)

| Need | Proposed field / table on `token_ledger` (or a companion table) |
|---|---|
| Origin | `source ∈ subscription · package · gift_card · peer_gift · promotional · courtesy` |
| Package size / reference | `tokenPackageId` (nullable), `giftCardId` (nullable) |
| Giftability | `giftable boolean` — derived from `source` at issuance (subscription/promo/courtesy/peer-gift = false) |
| Lineage | `parentTokenId` (the token a gifted token came from), `giftedAt`, `giftedByUserId` |
| Original token state after gifting | new status **`gifted`** (spent by transfer, never redeemable) |
| Creator-economics basis | `grossValueCents` (PO-010 basis, carried across a gift) — shared with the settlement work (IG-02) |
| Backfill | Existing rows: `subscriptionId` → `subscription`; `reason` `Purchased N Tokens` → `package`; `Gift card <id>` → `gift_card`. **Heuristic**; unparseable rows flagged, never guessed |

No migration is authorized by PO-024; this is the input for mission M-2. Existing rows must **not** have their `expiresAt` changed without a decision (Q-14).

## 5. Edge cases

| # | Case | Observation |
|---|---|---|
| E-1 | **FIFO with mixed expiries** | FIFO by `issuedAt` can spend a six-month package token before a 90-day subscription token issued later, so the customer loses value. Options: earliest-expiry-first; non-giftable first (Q-4) |
| E-2 | **Gifting a nearly expired token** | Rule 11 restarts 90 days, so gifting extends validity — and could be used to "refresh" tokens via a second account. A six-month token gifted early gets *shorter* (Q-3) |
| E-3 | Re-gift attempt | Must fail on the recipient's token (`source = peer_gift`, `giftable = false`) |
| E-4 | Concurrent gift + redeem of the same token | Needs the NEM-011 lock (`FOR UPDATE SKIP LOCKED`) on both paths |
| E-5 | Gift to a person without an account / unclaimed gift | Pending state; whether the 90 days start at gift or at claim (Q-2, Q-9) |
| E-6 | **Annual plans** | 30-day drip × 12 = 360 days (5–6 days short per year); cancel → drip stops early (T-5); a past-due annual plan also stops the drip |
| E-7 | **Household after cancellation** | Pool tokens belong to the owner; members lose access at `canceled` (T-6); member removal keeps their acquired books |
| E-8 | Refund / chargeback of a package after some tokens were gifted or redeemed | No refund handling exists (audit G7); ownership is permanent (PO-021); creator obligations (PO-008) — Q-8 |
| E-9 | Expiry boundary | "Six calendar months" from 31 Aug → 28/29 Feb; time zone (UTC); expiry at the instant vs end of day (Q-12) |
| E-10 | Promotional / courtesy tokens | Not mentioned by PO-024; recommended not giftable (Q-13) |
| E-11 | Creator economics | A gifted token must carry the original **purchase** basis (PO-010 §2); expiry of a gifted token = breakage (PO-012); Causas already arose at payment (PO-011) |
| E-12 | Release A copy | NEM-012's unlock screen deliberately omits expiry (B-5). With PO-024 it can show per-token expiry — a separate copy change, **not** folded into Release A |

## 6. Noetia+ independence

PO-024 is consistent with [PO-022](../../operating-framework/decisions/product-owner/PO-022-independent-noetia-plus-subscription.md): Noetia+ issues no book tokens; AI usage never consumes them (`BOOK TOKEN ≠ AI USAGE`, PO-001); cancelling Noetia+ affects no tokens or books; a Noetia+-only customer may buy, hold, gift (packages) and redeem tokens like a free account (PO-023). Requirement for later missions: "cancellation" logic must be **scoped to the book-token plan's product line** once multiple subscriptions per user exist (PO-022 impact assessment §4), so cancelling Noetia+ never stops a book-plan drip.

## 7. Unresolved questions (Product Owner)

| # | Question | Why it matters | Recommended default |
|---|---|---|---|
| ~~Q-1~~ | ~~Keep 90 days for the 1-token purchase?~~ | — | **Resolved 2026-10-30 (PO):** exactly 90 days from issuance, giftable |
| Q-2 | Are **gift-card** tokens "gifted tokens" (rules 11–12)? Is the "gift date" the purchase, the send, or the claim? | Expiry start and re-giftability | Yes, gifted; 90 days from **claim**; not re-giftable |
| Q-3 | Cap a gifted token's expiry at the original's remaining validity? | Prevents extension/refresh abuse (E-2) | Keep rule 11 (90 days from gift date) but allow gifting only while the original has **at least 30 days** left — no cap arithmetic, and no last-minute refresh. (Capping at the original expiry would amend rule 11 and needs explicit approval.) |
| Q-4 | Redemption order with mixed expiries | Customer value (E-1) | **Earliest-expiry first**, ties → non-giftable first |
| Q-5 | When gifting, does the customer choose which token, or does the system pick? | UX + fairness | System picks the giftable token with the **latest** expiry |
| Q-6 | May household members keep redeeming the owner's pool until expiry after cancellation? | Rule 6 vs current behaviour (T-6) | Owner only after `canceled` (current), stated explicitly |
| Q-7 | Annual plans: continue the monthly allocation through the paid year after cancellation? | T-5 | **Yes** (consistent with rule 5 and the ToS) |
| Q-8 | Refund/chargeback after gifting or redemption | Ownership vs reversal | No revocation of acquired books; reverse only unredeemed, un-gifted tokens; accounting review |
| Q-9 | Recipient flow (e-mail link, in-app), claim deadline, unclaimed gifts | Pending tokens and expiry | E-mail + in-app claim; claim within 30 days, else returns to gifter with its original expiry |
| Q-10 | Gifter notified when the recipient redeems (2026-05-20 backlog) | Privacy | Opt-in, title not disclosed |
| Q-11 | Limits / anti-resale on gifting | Abuse | e.g. N gifts per month |
| Q-12 | Definition of "six calendar months" and time zone | E-9 | Same day-of-month, clamped to month end, UTC, end of day |
| Q-13 | Promotional / courtesy tokens giftable? | E-10 | Not giftable |
| Q-14 | Existing package tokens (issued with 90 days) — extend to six months retroactively? | Customer fairness vs breakage already recognised | Apply to tokens **issued after** the release; optionally extend still-active ones (decision) |
| Q-15 | Creator basis for gifted and gift-card tokens | Settlement (IG-02) | Original purchase basis travels with the token; gift-card basis = gift price ÷ tokens |

## 8. Proposed implementation missions (ordered by dependency and risk)

| Order | Mission | Scope | Depends on | Risk |
|---|---|---|---|---|
| 1 | **M-1 Cancellation & drip correctness** | Annual drip includes `canceling` until `currentPeriodEnd` (T-5); optional calendar-month drip (E-6); explicit household rule (Q-6) | Q-6, Q-7 | Low; customer-impacting defect today |
| 2 | **M-2 Token provenance & lineage** | Additive migration (§4), issuance writes `source`/`giftable`/references, heuristic backfill with an unparseable-rows report | Q-14; coordination with the settlement mission (basis field) | Medium (migration on a financial ledger; additive only) |
| 3 | **M-3 Source-aware expiry & redemption order** | Six calendar months for 3/5/10; 90 days for subscription and 1-token purchases; redemption order per Q-4; tests | M-2; Q-4, Q-12, Q-14 | Medium (affects every redemption) |
| 4 | **M-4 Peer token gifting** | Transfer with eligibility, `gifted` status, new recipient token (90 days, non-giftable), atomic locking, audit trail, claim flow, notifications; gift-card alignment (Q-2) | M-2, M-3; Q-2, Q-3, Q-5, Q-9…Q-11 | High (new money-equivalent transfer path) |
| 5 | **M-5 Copy & legal** | PRD (T-1), ToS (T-2), pricing and gift copy (T-3, T-8), unlock-screen expiry display (E-12) | Decisions; legal review | Low (customer-facing, legal) |
| 6 | **Settlement linkage** (NEM-007 B / NEM-008) | Basis carried across gifts (E-11, Q-15) | M-2 | — |

None of these is combined with Release A. M-1 is independent and could be scheduled first.
