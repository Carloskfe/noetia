# NOETIA ENGINEERING MISSION — NEM-012
## "Unlock with Token" — Book Acquisition Customer Experience

**Status:** IN PROGRESS — implementation authorized by the Product Owner (Product Architecture review of PR #13, 2026-10-29)
**Mission type:** IMPLEMENTATION
**Implementation authorization:** LIMITED (§5)
**Schema changes:** NOT AUTHORIZED (none expected)
**Infrastructure changes:** NOT AUTHORIZED
**Production deployment:** NOT AUTHORIZED — separate Product Owner approval required
**Product Owner approval:** GRANTED for implementation within §5 (2026-10-29). Merging and deployment are **not** authorized.

> Reminder: **APPROVED ≠ EXECUTE.** Executed only on an explicit Product Owner instruction naming NEM-012.

---

## 1. Context

NEM-011 (PR #11) closes the paid-book acquisition bypass and makes redemption atomic. But **no screen calls token redemption**: `POST /subscriptions/books/:bookId/redeem` exists and no web or mobile client uses it. Customers can buy token packs (`/pricing`) and claim gift tokens, yet cannot spend them. The bypassed "+" button was the de-facto acquisition path. PO decision D1: **NEM-011 is not deployed until this flow is ready and validated.**

PO-021 / PO-023 (PR #12) make ownership the only route to paid content and allow subscription-free acquisition, so this flow is the core customer path, not an add-on.

## 1a. Conditions set at authorization (2026-10-29)

1. Deployment **not authorized** — separate PO approval.
2. **Active subscribers must see a visible unlock action** for a paid book they do not own, even while legacy streaming still lets them read it.
3. **Free accounts see their own available token balance.**
4. The mobile app is accessible to **free accounts and users with canceled subscriptions**.
5. **Owned-book reading, progress, highlights, and Escucha Activa are preserved.**
6. NEM-013 (ownership-only enforcement) stays DRAFT — this mission changes nobody's read access.
7. Strictly token-based acquisition (B-1): **no per-title purchase is offered anywhere.**
8. No stacked branch is merged into `main` without explicit approval; no production Stripe products, prices, secrets, or data are created or changed.

## 2. Objective

Any signed-in customer — free account, subscriber, or household member — can see a paid book, see their token balance, unlock it with one token, and immediately read it, on web and mobile.

## 3. Dependencies

- **NEM-011** — this work is built **on top of the NEM-011 branch** (stacked), because it relies on its ownership rules and the hidden "+" on paid books. The two are merged and deployed **as one release** (§14).
- PO-021 / PO-023 recorded (PR #12) — the policy this implements.
- **Validation environment** — see open decision O-1.

## 4. Source-of-truth references

PO-021, PO-023 · NEM-011 · audit 2026-10-29 · [impact assessment](../../architecture/impact-assessments/PO-021-023-acquisition-and-noetia-plus.md) C-02, C-03 · CLAUDE.md Voice & Style Guide (i18n 4-file rule, canonical terms: **Token**, **Biblioteca**, **Fragmento**).

## 5. In scope

**API (small, additive)**
1. `GET /subscriptions/me` returns `tokenBalance` for users **without** a subscription row (today it returns `{ status: 'none' }` only — free-account buyers cannot see their tokens). Linked members see own tokens and the shared pool separately.
2. When the content guard denies a paid book, the 403 body includes `{ error, bookId, acquisition: { tokenBalance } }` so clients can render the unlock screen without a second call. Book metadata comes from the existing public `GET /books` listing / a new public `GET /books/:id/summary` (title, author, cover, `isFree` — **no file URLs**).
3. No change to who may read what (that is NEM-013).

**Web**
4. Acquisition screen when the reader receives a paid-book denial: cover, title, author, balance, **"Unlock with 1 token"**, **"Get tokens"** (→ `/pricing` token packs), sign-in prompt when logged out.
5. Paid-book cards in Discover / collections / search show an **unlock** affordance (not the free-book "+").
6. Post-unlock: reader opens at the start; the book appears in Biblioteca.
7. Error states: `no_tokens_remaining` → Get tokens · `already_owned` → open reader · email not confirmed (`EmailConfirmedGuard`) → confirm-email prompt · network/5xx → retry.
8. Gift-claim success → "Choose a book to unlock" CTA.

**Mobile**
9. Remove the **app-level subscription paywall** (`requiresPaywall` / `RootNavigator`): the app is usable without a subscription (PO-023.1). The paywall screen becomes the per-book acquisition screen with the same states as web.
10. Same unlock flow and error states as web.

**Copy** — all new strings in `services/web/lib/i18n/{en,es}.ts` **and** `services/mobile/src/i18n/{en,es}.ts` (shared copy), tú register, sentence case, `…` for loading.

## 6. Out of scope

Removing subscription all-access streaming (NEM-013) · free samples · per-title purchase (discontinued — PO-021 Amendment 1 / B-1; endpoint retired by NEM-015) · pricing, Stripe, plans · token expiry rules · Noetia+ · schema changes.

## 7. Product rules

- One token unlocks one book permanently (PO-021, PO-023).
- Redemption order unchanged: own tokens first (oldest), then the household pool (NEM-011).
- Never show raw error codes; never imply a subscription is required to read an owned book.

## 8. Protected systems

Reader rendering, Escucha Activa, sync, progress — no behavioural change for owned and free books. Mobile OTA eligibility: JS-only changes (no native modules) so the mobile part can ship by EAS update.

## 9. Technical requirements

- Redemption is a single API call; clients never pre-decrement balances locally (server is the source of truth; refresh balance after the call).
- Double-tap safe: button disabled while pending; a repeated call returns `already_owned`, handled as success.
- The 403 contract is additive; existing `error` values stay unchanged (compatibility with NEM-013 and older clients).

## 10. Security / privacy

No new data exposure: the summary endpoint returns public catalogue metadata only. No tokens or entitlements are granted client-side.

## 11. Acceptance criteria

1. A free account that buys a token pack can unlock a paid book and read it, on web and on mobile.
2. A subscriber with tokens can unlock a paid book; balance decreases by exactly one.
3. A household member unlocks from the shared pool when they have no own tokens.
4. `no_tokens_remaining`, `already_owned`, unconfirmed email and logged-out states each show the specified screen.
5. A free account opens the mobile app, its Biblioteca, and free books without seeing a subscription wall.
6. Owned and free books open exactly as before (no regression).
7. en/es parity test passes on web; mobile en/es keys added in lockstep.

## 12. Required tests

- **API unit:** `getSubscriptionStatus` balance for no-subscription users and linked members; 403 payload shape; summary endpoint returns no file URLs.
- **API integration (real PostgreSQL, NEM-011 harness):** unlock end-to-end through the controller path for free account / subscriber / household member; concurrent double-tap → one deduction.
- **Web unit:** acquisition screen states; card affordance (free "+" vs paid unlock).
- **Web E2E (Playwright, mocked API as today):** `free account → buy-tokens redirect`, `subscriber → unlock → read`, `no tokens → Get tokens`, `owned book → reader (regression)`.
- **Mobile unit:** paywall removal routing; acquisition screen states; API client calls.
- **Negative:** unlock of a free book is not offered; logged-out unlock → sign-in.

## 13. Observability

Log/metric counters for unlock attempts by outcome (`success`, `no_tokens_remaining`, `already_owned`, `error`) — counts only, no user identifiers in metrics.

## 14. Deployment / rollout

**Not authorized.** When approved, ships together with NEM-011 and NEM-015 as Release A (coordinated rollout plan). Validation (O-1) before merge. Rollback: revert the combined merge; no schema change.

## 15. Documentation deliverables

Update `docs/technical-baseline/05-api.md` (new/changed endpoints) and the NEM-011 mission record (deploy gate cleared).

## 16. Open decisions

| # | Question | Recommended default |
|---|---|---|
| **O-1** | Validation environment: staging (`staging.noetia.app`, Stripe **test** mode) requires the unmerged NEM-006A/006C staging work; otherwise validation is local + E2E against mocks only | Use staging; decide NEM-006A/006C merge (also blocks NEM-010 D1) |
| **O-2** | Should paid-book cards show a "Read sample" action now? | No — samples are a later mission (rights-dependent) |
| ~~O-3~~ | ~~Per-title purchase button~~ | **Resolved by B-1:** never shown — token redemption is the only acquisition path |

## 17. Stop conditions

STOP if: the flow needs a schema change; an owned-book reading path must change; any change to who can read what (that is NEM-013); a native module is needed on mobile (breaks OTA).

## 18–19. Completion report and review

Per README Completion Report Standard; Product Architecture review per `REVIEW-CHECKLIST.md`.
