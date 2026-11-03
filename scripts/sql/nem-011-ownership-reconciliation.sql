-- NEM-011 — historical ownership reconciliation (READ-ONLY)
--
-- Purpose: size the impact of the two defects NEM-011 closes, so the Product
-- Owner can decide what (if anything) to do about existing rows.
--   G1  paid books added through POST /library/:bookId (recorded purchaseType='free')
--   G2  non-atomic token redemption (double spends, tokens spent with no book)
--   B-1 direct per-title purchases (discontinued by PO decision B-1): history and
--       current exposure of POST /subscriptions/books/:bookId/purchase
--
-- SAFETY
--   * Every statement is a SELECT inside a READ ONLY transaction that is rolled
--     back. Postgres rejects any write attempted inside it.
--   * Output carries UUIDs only — no emails, names or other PII.
--   * This script changes and revokes NOTHING. NEM-011 explicitly forbids
--     deleting or revoking ownership; any remediation is a separate PO decision.
--
-- HOW TO RUN (production: operator only, single-line command, see CLAUDE.md):
--   docker compose --env-file .env.production -f docker-compose.server.yml exec -T db \
--     psql -U noetia -d noetia -v ON_ERROR_STOP=1 -f - < scripts/sql/nem-011-ownership-reconciliation.sql
--
-- CAVEATS when reading the results
--   * books."isFree" is the CURRENT sync-quality gate (≥90%), not rights status
--     and not history. A free-library title can lose the flag after a re-audit,
--     so a 'free' row on a now-non-free CATALOGUE title (uploadedById IS NULL)
--     may have been legitimate when it was created.
--   * Until NEM-011, the web Discover/collection "+" button called the bypassed
--     endpoint for paid books too, so most G1 rows are likely ordinary clicks,
--     not abuse.
--   * Active subscribers can read every book regardless (current streaming
--     policy), so a G1 row only changes access once that subscription ends.

BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '60s';

-- ── 1. Overview: ownership rows by acquisition type and current book status ──
SELECT ub."purchaseType",
       b."isFree"                                    AS book_is_free_now,
       (b."uploadedById" IS NULL)                    AS catalogue_title,
       COUNT(*)                                      AS rows,
       COUNT(DISTINCT ub."userId")                   AS users
FROM user_books ub
JOIN books b ON b.id = ub."bookId"
GROUP BY 1, 2, 3
ORDER BY 1, 2, 3;

-- ── 2. G1 summary: 'free'-typed ownership of books that are not free now ─────
WITH g1 AS (
  SELECT ub.*, b."uploadedById", b."isPublished"
  FROM user_books ub
  JOIN books b ON b.id = ub."bookId"
  WHERE ub."purchaseType" = 'free' AND b."isFree" = false
)
SELECT CASE WHEN g1."uploadedById" IS NULL THEN 'catalogue_title (may have been free when added)'
            ELSE 'author_title (paid content, no payment recorded)' END AS category,
       COUNT(*)                                            AS rows,
       COUNT(DISTINCT g1."userId")                         AS users,
       COUNT(DISTINCT g1."bookId")                         AS books,
       MIN(g1."addedAt")                                   AS first_added,
       MAX(g1."addedAt")                                   AS last_added,
       COUNT(*) FILTER (WHERE s.status IN ('active', 'trialing', 'canceling')
                          OR owner_s.id IS NOT NULL)       AS users_currently_streaming_anyway
FROM g1
LEFT JOIN subscriptions s ON s."userId" = g1."userId"
LEFT JOIN subscriptions owner_s
       ON g1."userId" = ANY(owner_s."linkedUserIds")
      AND owner_s.status IN ('active', 'trialing', 'canceling')
GROUP BY 1
ORDER BY 1;

-- ── 3. G1 detail (UUIDs only), most recent first ──────────────────────────────
SELECT ub.id            AS user_book_id,
       ub."userId",
       ub."bookId",
       ub."addedAt",
       (b."uploadedById" IS NULL) AS catalogue_title,
       EXISTS (SELECT 1 FROM token_ledger t
               WHERE t."bookId" = ub."bookId" AND t.status = 'redeemed'
                 AND (t."userId" = ub."userId"
                      OR ub."userId" = ANY(COALESCE((SELECT s."linkedUserIds" FROM subscriptions s
                                                     WHERE s."userId" = t."userId"), '{}'))))
                        AS has_matching_redeemed_token
FROM user_books ub
JOIN books b ON b.id = ub."bookId"
WHERE ub."purchaseType" = 'free' AND b."isFree" = false
ORDER BY ub."addedAt" DESC;

-- ── 4. G2 signatures ──────────────────────────────────────────────────────────
-- 4a. Token-typed ownership with NO redeemed token pointing at that book for the
--     user or their pool owner → one token unlocked several books.
SELECT 'token_ownership_without_spent_token' AS signature, COUNT(*) AS rows,
       COUNT(DISTINCT ub."userId") AS users
FROM user_books ub
WHERE ub."purchaseType" = 'token'
  AND NOT EXISTS (
    SELECT 1 FROM token_ledger t
    WHERE t."bookId" = ub."bookId" AND t.status = 'redeemed'
      AND (t."userId" = ub."userId"
           OR ub."userId" = ANY(COALESCE((SELECT s."linkedUserIds" FROM subscriptions s
                                          WHERE s."userId" = t."userId"), '{}'))))
UNION ALL
-- 4b. More than one redeemed token for the same owner pool + book → a book paid twice.
SELECT 'book_paid_with_multiple_tokens', COUNT(*), COUNT(DISTINCT "userId")
FROM (SELECT "userId", "bookId" FROM token_ledger
      WHERE status = 'redeemed' AND "bookId" IS NOT NULL
      GROUP BY 1, 2 HAVING COUNT(*) > 1) dup
UNION ALL
-- 4c. A redeemed token whose book is owned by nobody in the pool → token spent, no book.
SELECT 'token_spent_without_ownership', COUNT(*), COUNT(DISTINCT t."userId")
FROM token_ledger t
WHERE t.status = 'redeemed' AND t."bookId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM user_books ub
    WHERE ub."bookId" = t."bookId"
      AND (ub."userId" = t."userId"
           OR ub."userId" = ANY(COALESCE((SELECT s."linkedUserIds" FROM subscriptions s
                                          WHERE s."userId" = t."userId"), '{}'))));

-- ── 5. B-1 direct per-title purchases ─────────────────────────────────────────
-- 5a. Exposure: books the purchase endpoint would sell today (published + priced).
--     Nothing in the application sets priceCents; any row here was set by hand.
SELECT COUNT(*) FILTER (WHERE "isPublished")                    AS purchasable_now,
       COUNT(*)                                                 AS books_with_price,
       COUNT(*) FILTER (WHERE "isPublished" AND "isFree")       AS purchasable_but_free,
       MIN("priceCents") AS min_price_cents, MAX("priceCents") AS max_price_cents
FROM books
WHERE "priceCents" IS NOT NULL;

-- 5b. History: ownership acquired by direct purchase. The database stores NO
--     payment reference for these rows — Stripe (metadata bookId + userId) is the
--     only record of what was paid.
SELECT COUNT(*)                     AS purchase_rows,
       COUNT(DISTINCT ub."userId")  AS users,
       COUNT(DISTINCT ub."bookId")  AS books,
       MIN(ub."addedAt")            AS first_purchase,
       MAX(ub."addedAt")            AS last_purchase,
       COUNT(*) FILTER (WHERE b."isFree") AS on_books_free_now
FROM user_books ub
JOIN books b ON b.id = ub."bookId"
WHERE ub."purchaseType" = 'purchase';

-- 5c. Detail for Stripe cross-checking (UUIDs only).
SELECT ub."userId", ub."bookId", ub."addedAt", b."priceCents" AS current_price_cents
FROM user_books ub
JOIN books b ON b.id = ub."bookId"
WHERE ub."purchaseType" = 'purchase'
ORDER BY ub."addedAt" DESC;

ROLLBACK;
