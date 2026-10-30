# NOETIA ENGINEERING MISSION — NEM-013
## Ownership-Based Entitlement Enforcement (end of all-access streaming)

**Status:** DRAFT
**Mission type:** IMPLEMENTATION
**Implementation authorization:** LIMITED (§5)
**Schema changes:** NOT AUTHORIZED (none expected)
**Infrastructure changes:** NOT AUTHORIZED (an environment flag only, §9)
**Production deployment:** AUTHORIZED WITH CONDITIONS (§14)
**Product Owner approval:** REQUIRED (requirement approved 2026-10-29; this specification not yet approved)

> Reminder: **APPROVED ≠ EXECUTE.** Executed only on an explicit Product Owner instruction naming NEM-013.

---

## 1. Context

[PO-021](../../operating-framework/decisions/product-owner/PO-021-token-based-book-acquisition.md) (H1): Noetia is not an unlimited-access streaming platform. Today `SubscriptionGuard` (`subscription.guard.ts:37-54`) lets any active/trialing/canceling subscriber — or any linked household member — read **every** paid book. This mission makes full content access depend on ownership only, consistently across API, web and mobile.

## 2. Objective

For every content path: **access = free book OR ownership entitlement**. Subscription status never grants, and never removes, access to book content.

## 3. Dependencies

| Dependency | Why |
|---|---|
| **NEM-011 + NEM-012 deployed** | Customers must be able to acquire books before streaming ends |
| **Decision B-2** — transition for current subscribers reading non-owned books | Determines notice period / grandfathering |
| **Decision B-3** — household access to other members' acquisitions | Determines the household rule below |
| **Decision B-10** — historical bypass rows (after the reconciliation baseline) | They become the only access path for those books |
| **Terms of Service update + customer notice** (C-16, legal review) | The product changes for existing subscribers |
| **Copy approval** — plan highlights (C-11) | "Full library access" becomes false |
| NEM-014 (recommended) | Real-database tests run in CI before this ships |

## 4. Source-of-truth references

PO-021, PO-023 · [impact assessment](../../architecture/impact-assessments/PO-021-023-acquisition-and-noetia-plus.md) C-01, C-02, C-04, C-07, C-10, C-11, C-12 · NEM-011, NEM-012.

## 5. In scope

1. **Content guard** — remove the subscription and linked-member branches; access = `isFree` OR `user_books`. Applies to `GET /books/:id` (text + audio URLs), `GET /books/:id/sync-map`, `GET/POST /books/:id/progress`. `past_due` never blocks owned content.
2. **Enforcement flag** — `CONTENT_ACCESS_MODE = legacy | ownership` (environment, default `legacy`) so the cut-over and its rollback are a configuration switch, not a deploy.
3. **Clubs** — paid-book club creation gated on ownership (`clubs.service.ts:34-37`), matching the existing join/discuss ownership gates.
4. **Mobile offline copies** — on opening a downloaded paid book while online, re-check entitlement; delete the local copy if it is not owned (policy for offline-only use: decision O-2).
5. **Copy** — plan highlights (C-11) on web and mobile; reader denial copy points to unlocking, never to subscribing.
6. **E2E** — `subscribe-to-unlock.spec.ts` re-scoped to "acquire → read".
7. **Docs** — PRD C-07, technical baseline C-10 (after the code lands).

## 6. Out of scope

Free samples (rights-dependent, separate mission) · per-title purchase (B-1) · multi-subscription schema (M-C) · Noetia+ · pricing · revoking or editing any ownership row · fragments/notes data (kept as is).

## 7. Product rules

- Owned books stay readable after cancellation, past-due, or plan removal (PO-021.6).
- Free books unchanged (PO-021.7).
- **Household (pending B-3):** default assumption for the design — each member reads only books in their **own** library; pool tokens acquire into the redeeming member's library (current NEM-011 behaviour).
- Personal records (progress, fragments, notes) on books the user no longer has access to are **retained**, not deleted (PO-022 principle; access returns on acquisition).

## 8. Protected systems

Reader, Escucha Activa, sync maps: behaviour for owned and free books must be byte-identical (regression suite §12). Production data: no writes.

## 9. Technical requirements

- One authoritative access check (`ContentAccessService.canRead(userId, bookId)`), used by the guard, clubs, and the mobile offline check endpoint — no duplicated rules.
- **Compatibility:** the 403 body keeps an `error` field; new value `acquisition_required`, plus NEM-012's `acquisition` payload. Clients from NEM-012 handle both `acquisition_required` and the legacy `subscription_required`; older mobile builds receive a generic but non-crashing error (verified in §12).
- Flag read once per request from config; no restart-free toggling is required.

## 10. Security / privacy

Narrows access; no new data exposed. Offline deletion happens on device only.

## 11. Acceptance criteria

The access matrix (§12) passes in `ownership` mode, and in `legacy` mode reproduces today's behaviour exactly; switching the flag needs no deploy; no owned-book regression; reconciliation run shows no ownership rows changed.

## 12. Required tests

**Access matrix — real PostgreSQL integration** (NEM-011 harness), both modes:

| User state ↓ / book → | Free | Paid, owned (`token`/`purchase`/`courtesy`) | Paid, legacy `'free'` row (bypass era) | Paid, not owned | Paid, owned by another household member |
|---|---|---|---|---|---|
| Anonymous | 401 | 401 | 401 | 401 | 401 |
| Free account | ✅ | ✅ | ✅ | ❌ 403 | ❌ 403 |
| Individual active / trialing / canceling | ✅ | ✅ | ✅ | ❌ (legacy: ✅) | ❌ |
| Past due | ✅ | ✅ | ✅ | ❌ (legacy: 403 payment) | ❌ |
| Canceled | ✅ | ✅ | ✅ | ❌ | ❌ |
| Duo/Family owner | ✅ | ✅ | ✅ | ❌ (legacy: ✅) | per B-3 |
| Duo/Family linked member | ✅ | ✅ | ✅ | ❌ (legacy: ✅) | per B-3 |
| Removed member | ✅ | ✅ | ✅ | ❌ | ❌ |

Each cell × endpoints: `GET /books/:id`, sync map, progress GET + POST, club create.

**Compatibility:** 403 payload contract (`error`, `bookId`, `acquisition`); NEM-012 clients render both error values; an older mobile build (pre-NEM-012) fixture shows a non-crashing error.
**Regression:** owned-book reader E2E (web), `/reader/:id?phrase=N` deep link, Escucha Activa start on an owned book, progress save, fragment create on owned book; free-book auto-add unchanged.
**Mobile:** offline revalidation — owned copy kept, non-owned copy removed, offline-without-network behaviour per O-2.

## 13. Observability

Counter of content denials by reason and mode; alert threshold agreed before cut-over (sudden spike = misconfiguration). Counts only.

## 14. Deployment / rollout

1. Deploy with `CONTENT_ACCESS_MODE=legacy` (no behaviour change) — verify.
2. Reconciliation run (read-only) — confirm B-10 handling is in place.
3. Customer notice per B-2 / ToS; wait the agreed period.
4. Switch to `ownership`; verify the matrix spot-checks in production with designated test accounts; monitor denials.
5. **Rollback:** switch back to `legacy` (container recreate, no code deploy); full rollback = revert.

## 15. Documentation deliverables

PRD (C-07), technical baseline 05/07 (C-10), ToS (with legal), this record.

## 16. Open decisions

| # | Question |
|---|---|
| **B-2** | Transition for current subscribers (notice period, grandfathering, conversion offer) |
| **B-3** | Household access to other members' acquisitions |
| **B-10** | Historical bypass rows |
| **O-1** | Who approves the final plan-highlight copy and ToS text (legal) |
| **O-2** | Offline: may a downloaded non-owned book stay readable while the device has no network? (recommended: no — downloads require ownership from the cut-over) |

## 17. Stop conditions

STOP if: any owned-book path changes behaviour; a schema change appears necessary; B-2/B-3/B-10 are undecided at cut-over time; the ToS/notice step has not happened.

## 18–19. Completion report and review

Per README Completion Report Standard; Product Architecture review per `REVIEW-CHECKLIST.md`.
