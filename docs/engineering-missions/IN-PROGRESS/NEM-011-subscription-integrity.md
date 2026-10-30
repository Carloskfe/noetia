# NOETIA ENGINEERING MISSION — NEM-011
## P0 Subscription Integrity: Paid-Book Acquisition & Atomic Token Redemption

**Status:** IN PROGRESS → implementation complete; **deploy BLOCKED until NEM-012 ("Unlock with token") is ready and validated** (PO decision D1). Not merged, not deployed.
**Mission type:** REMEDIATION
**Implementation authorization:** FULL-WITHIN-SCOPE (§5)
**Schema changes:** NOT AUTHORIZED — none required (see §9)
**Infrastructure changes:** NOT AUTHORIZED — none made (CI unchanged)
**Production deployment:** NOT AUTHORIZED — requires explicit PO approval after review
**Product Owner approval:** GRANTED 2026-10-29 ("Authorization: P0 Subscription Integrity Mission")

> Executed on the PO's explicit instruction. Stop at PR; merge and deploy only on a further explicit approval.

---

## 1. Context

The 2026-10-29 subscription audit found two integrity defects (audit G1, G2):

- **G1 — paid-book acquisition bypass.** `POST /library/:bookId` (`JwtAuthGuard` only) inserted a `user_books` row for **any** published book with the column default `purchaseType = 'free'`. `SubscriptionGuard` treats any `user_books` row as permanent ownership, so a free account could obtain any paid book's text and audio. The web Discover / collection "+" button offered this on **paid** books, so the bypass was a normal UI action, not only an API one.
- **G2 — non-atomic token redemption.** `redeemToken` did `findOne(token)` → `update(token)` → `insert(user_books)` with no transaction or lock. Concurrent requests (or Duo/Family members sharing a pool) could spend one token on several books; a failed insert left a token spent with no book; concurrent redemptions of the same book spent extra tokens.

## 2. Objective

No ownership row can be created for a paid book without a token or a payment; token redemption is atomic, idempotent and concurrency-safe — without changing pricing, Stripe, streaming policy, or any existing ownership row.

## 3. Dependencies

None blocking. Builds on the existing `UNIQUE ("userId","bookId")` constraint (migration `1714000000015`).

## 4. Source-of-truth references

- Audit (2026-10-29) — findings G1, G2; ownership principle (books are acquired permanently).
- `engineering-missions/README.md` — governance; PO-009 (missions committed at approval).
- CLAUDE.md — Development Safety Rules, Testing rules.

## 5. In scope

1. `LibraryService.addBook` — free books only; `purchaseType: 'free'` written explicitly.
2. `LibraryService.removeBook` — never deletes acquired ownership (token / purchase / courtesy) or any row on a paid book.
3. `SubscriptionsService.redeemToken` — single transaction; `SELECT … FOR UPDATE SKIP LOCKED` on the oldest active token; `INSERT … ON CONFLICT DO NOTHING` for ownership; status-guarded token update.
4. Web `BookGrid` — "+" only on free books (fails closed when the flag is missing).
5. Unit tests (mocked) + **integration tests on a real PostgreSQL** (transactions, locks, rollback, concurrency, cancellation).
6. Read-only historical reconciliation query.
7. Risk assessment, deployment and rollback plan (this document).

## 6. Out of scope

Pricing, Stripe configuration, plans/token packages, streaming policy (`SubscriptionGuard` all-access is **unchanged**), revoking or editing existing ownership rows, admin book deletion cascades (audit G6), refunds, webhook ordering, a token-redemption UI, CI configuration, coverage thresholds, mobile.

## 7. Product rules

- Acquired books are permanent: no code path in this mission deletes or revokes ownership.
- Free-library books remain freely addable.
- Streaming policy unchanged: active subscribers and linked members can still read non-owned books.

## 8. Protected systems

- **Reader / Escucha Activa:** untouched. The reader still auto-adds free books (`reader/[id]/page.tsx` already gates on `isFree`). `SubscriptionGuard` unchanged.
- **Production data:** untouched; reconciliation is read-only.
- **Business-rule engines:** token expiry, FIFO, household pooling preserved.

## 9. Technical design

| Concern | Mechanism |
|---|---|
| Paid book via library | `addBook` → `403 { error: 'acquisition_required' }` unless `books.isFree` |
| Ownership never removed | `removeBook` → `409 { error: 'acquired_book_cannot_be_removed' }` unless the row is `'free'` **and** the book is free |
| Double spend | Token row locked `FOR UPDATE SKIP LOCKED` inside the transaction — concurrent requests take different tokens or none |
| Same book twice | `INSERT … ON CONFLICT DO NOTHING`; no row inserted ⇒ throw `already_owned` ⇒ rollback ⇒ no deduction |
| Partial failure | Ownership insert and token spend in one transaction; any error rolls both back |
| Invariant | Token update filtered on `status = 'active'`; `affected !== 1` ⇒ `409 token_unavailable` + rollback |

**No migration:** the DB already enforces `UNIQUE ("userId","bookId")`; atomicity needs only a transaction and row locks. The `purchaseType` column default (`'free'`) is left as is — changing it would be a schema change; the code now always writes the type explicitly.

**`isFree` semantics:** the same flag `SubscriptionGuard` uses for free access (the ≥90% sync-quality gate), so "may add for free" and "may read for free" stay identical.

## 10. Security / privacy

- Closes an entitlement-bypass (authorization) defect.
- Reconciliation output carries UUIDs only — no emails or names.
- Integration test helper refuses non-loopback database hosts.

## 11. Acceptance criteria

| # | Criterion | Evidence |
|---|---|---|
| 1 | A free account cannot acquire a paid book via the library endpoint; nothing is written | integration `DEFECT G1`, unit `rejects a paid book…` |
| 2 | Free-book add still works and is idempotent, recorded as `'free'` | integration + unit |
| 3 | One token can never unlock more than one book under concurrency | integration `DEFECT G2` (5 rounds × 8 parallel requests) |
| 4 | Concurrent redemptions of the same book deduct exactly one token | integration `DEFECT G2b` |
| 5 | A failed ownership insert leaves the token unspent | integration `DEFECT G2c` (DB trigger forces the failure) |
| 6 | Household pool raced by owner + member spends one token | integration `household…` |
| 7 | FIFO preserved; already-owned redemption deducts nothing | integration |
| 8 | Acquired ownership survives subscription cancellation; non-owned paid books are then denied | integration `ownership after cancellation` |
| 9 | Pre-existing rows (incl. bypass rows) are untouched and still grant access | integration `preserves pre-existing ownership rows` |
| 10 | Coverage thresholds unchanged; no metric decreases | api branches 68.83% → 69.03%; all others ≥ baseline |

## 12. Tests

**Defect reproduction (pre-fix code):** the integration suite run against the original implementation failed 5/12 tests (G1, G1b, G2b, G2c, pre-existing-rows). The G2 race reproduced in **30/30** rounds on a warm database (one token unlocked 2–7 books per round); the committed G2 test therefore repeats 5 rounds.

**Post-fix:** integration 16/16 (stable over 4 consecutive runs); api unit 939/939; web unit 303/303.

| Suite | File |
|---|---|
| Integration (real PostgreSQL 16, every migration applied) | `services/api/tests/integration/subscriptions/ownership-integrity.int-spec.ts` |
| Integration harness | `services/api/tests/integration/helpers/test-db.ts`, `services/api/jest.integration.config.js` |
| Unit — library | `services/api/tests/unit/library/library.service.spec.ts` |
| Unit — redemption | `services/api/tests/unit/subscriptions/subscriptions.service.spec.ts` |
| Unit — web | `services/web/tests/unit/components/BookGrid.spec.tsx` |

Run integration tests (throwaway server only):
```bash
docker run -d --rm --name nem-it-pg -e POSTGRES_PASSWORD=it -e POSTGRES_USER=it -e POSTGRES_DB=it -p 127.0.0.1:55432:5432 postgres:16-alpine
cd services/api && INTEGRATION_DATABASE_URL=postgres://it:it@127.0.0.1:55432/it npm run test:integration
docker stop nem-it-pg
```

## 13. Observability

No new metrics. Rejections surface as typed 403/409 errors (`acquisition_required`, `acquired_book_cannot_be_removed`, `no_tokens_remaining`, `already_owned`, `token_unavailable`).

## 14. Deployment / rollback

**Pre-deploy (PO decisions — see §16):** D1 (redemption UI gap) and D2 (reconciliation follow-up) decided; confirm no CD run is in progress (`gh run list --workflow CD --limit 1`).

1. **Baseline:** operator runs `scripts/sql/nem-011-ownership-reconciliation.sql` on production (read-only) and records the counts.
2. **Merge** the PR to `main` → CD rebuilds `api` and `web` (≈10–25 s of downtime with the current deploy flow; NEM-010). No migration runs.
3. **Verify** (prefer a test account; on production only with an account the PO designates):
   - `docker ps` — all healthy; `SELECT name FROM migrations ORDER BY timestamp DESC LIMIT 3;` unchanged.
   - `POST /api/library/<paid book id>` → **403** `acquisition_required`; `POST /api/library/<free book id>` → 200.
   - Discover: no "+" on paid books; "+" on free books still works; an owned paid book still opens in the reader.
4. **Re-run** the reconciliation query: G1 author/catalogue counts must not grow after the deploy timestamp.

**Rollback:** `git revert <merge commit>` → push → CD. No schema or data change was made, so the revert is clean; ownership rows created after deploy are valid under both versions.

## 15. Documentation deliverables

- This mission record.
- `scripts/sql/nem-011-ownership-reconciliation.sql` (read-only, validated against seeded scenarios: each defect signature counted exactly; a write inside it is rejected by Postgres).

## 16. Product Owner decisions (2026-10-29)

| # | Decision | Effect on NEM-011 |
|---|---|---|
| **D1** | **Approved** — a follow-up mission implements "Unlock with token" in the customer experience. **Do not deploy NEM-011 until that acquisition flow is ready and validated.** | Deploy gated on NEM-012; NEM-011 ships in the same release (see the coordinated rollout plan) |
| **D2** | **Approved** — a read-only production reconciliation procedure; historical ownership records are not changed, deleted, or revoked | Procedure: [`docs/operations/nem-011-ownership-reconciliation.md`](../../operations/nem-011-ownership-reconciliation.md) (validated, two read-only layers) |
| **D3** | **Approved in principle** — CI integration of the real-PostgreSQL tests on isolated, ephemeral infrastructure, only within an explicitly scoped mission | Prepared as NEM-014 (DRAFT); no CI change in NEM-011 |

Original analysis, kept for the record:

| # | Decision | Why it matters | Recommendation |
|---|---|---|---|
| **D1** | **No UI calls token redemption.** `POST /subscriptions/books/:bookId/redeem` exists, but neither web nor mobile uses it. Non-subscribers can buy token packs (`/pricing`) but, after this fix, have **no UI path** to unlock a paid book (the bypass was the de-facto path). Subscribers are unaffected (streaming policy). | Deploying closes the hole but unmasks a dead-end for token buyers | Decide before deploy: (a) ship now and accept the gap, or (b) a small follow-up mission adds an "Unlock with token" action and ships with/before this |
| **D2** | What to do with historical bypass rows (if any) | Ownership principle vs revenue/creator obligations | Run the reconciliation first; no revocation without a decision (this mission revokes nothing) |
| **D3** | Run integration tests in CI | They currently run only on demand | Add a `postgres` service + `npm run test:integration` job (CI change → needs approval) |

## 17. Risks

| Risk | Likelihood / impact | Mitigation |
|---|---|---|
| Token buyers without a subscription can no longer get paid books in the UI (D1) | High / business | PO decision D1 before deploy |
| Users used "+" on paid books as "save for later" | Medium / UX | "+" hidden on paid books; reading list is a separate feature if wanted |
| `SKIP LOCKED` fallback: a linked member whose own tokens are all locked by a concurrent own redemption falls back to the owner's pool | Low / small | Only under self-concurrency; still never double-spends |
| A free-library title that falls below the 90% gate can no longer be added | Low | Such titles are already hidden from discovery; existing rows are kept |
| `removeBook` now returns 409 for acquired rows | Low | No client calls `DELETE /library/:bookId` |
| Integration tests not in CI → regression risk | Medium | D3 |
| Old mobile builds | None | Mobile never calls the library add endpoint |

## Deviations

- **Test location:** integration tests live in `services/api/tests/integration/` (with their own Jest config), not `tests/unit/`. CLAUDE.md's unit-test rules forbid real databases in unit tests, and this mission requires real-database tests; the separate directory keeps both rules (precedent: `services/web/tests/e2e/`). Flagged for review.
- **Duplicate `describe('redeemToken')` blocks** in `subscriptions.service.spec.ts` were consolidated into one suite covering the new transaction.

## 18. Completion report

See the PR description (Mission · Status · Changed Files · Database · Tests · Verification · Deployment · Deviations · Risks · Discoveries · Protected Systems · Commit SHAs · Next Step).

## 19. Product Architecture review

Reviewer: Product Architecture — [`REVIEW-CHECKLIST.md`](../REVIEW-CHECKLIST.md). Verdict: _pending_.

---

> **STOP after completing authorized work. Do not begin another mission without explicit Product Owner authorization.**
