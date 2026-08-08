# 12 — Author / Publisher System

Authors and publishers are the content supply chain. Represented by `User.userType ∈ author | editorial` plus `hostingTier`.

## Author endpoints — CONFIRMED
- `GET /authors/me/books` — the author's own catalog.
- `GET /authors/me/analytics` — per-author analytics.
- `GET /authors/me/quota` — remaining upload quota.
- Book lifecycle (shared `/books` controller, author-scoped by JWT):
  - `POST /books` — upload a new book (multipart; `@types/multer` present).
  - `POST /books/:id/sync-map` / `POST /books/:id/sync-map/srt` — attach a sync map (SRT upload path).
  - `PATCH /books/:id/publish` — publish (review→live).
  - `DELETE /books/:id`.
  - `GET /books/pending` — review queue.

## Upload limits — CONFIRMED
`HostingTier` gates how many books an author may host:
`HOSTING_TIER_LIMITS = { basic: 1, starter: 3, pro: 12 }` (`user.entity.ts`). `GET /authors/me/quota` surfaces remaining allowance.

## Review workflow — CONFIRMED / INFERRED
- `Book.isPublished` gates visibility; `GET /books/pending` + `PATCH :id/publish` imply a **submit → review → publish** flow.
- Whether review is admin-gated or author-self-publish is **INFERRED**: publish/delete/pending routes carry `isAdmin` inline checks in the books controller, suggesting **admin approval** for publication.

## Author dashboard (web) — CONFIRMED
`services/web/app/(admin)/author/page.tsx` is a **real, API-backed** dashboard: it fetches `/api/authors/me/books`, `/analytics`, `/quota`, uploads via `/api/books` (with progress), and posts sync maps via `/api/books/:id/sync-map/srt`. Includes a book-submission form (title/author/description/ISBN) and messaging that "all books pass review before publishing." No mocked data.

## Courtesy tokens for contributors — CONFIRMED
Authors/publishers/narrators can receive **courtesy token quotas** (`courtesy_token_quotas`, role-scoped) — non-purchased grants. Admin-issued (see [09](09-token-economy.md)).

## Content ingestion (free library) — CONFIRMED
Separate from author uploads, the free library is populated by ingestion CLIs (`services/api/src/ingestion/*`): fetch text (Gutenberg / Spanish Wikisource), audio (LibriVox / archive.org), covers (Open Library), and generate sync maps (Whisper). Catalog defined in `ingestion/catalogue.ts`. Run manually inside the api container.

## Narrator system — CONFIRMED (partial)
- `CourtesyRole` includes `narrator`, so narrators exist as a courtesy-token role.
- **No narrator dashboard** and **no payout/royalty engine** exist in code (narrator payment schemes are backlog). **CONFIRMED absence.**

## Gaps — CONFIRMED absence
- No author **persona-analytics** dashboard (reader-archetype breakdown per book) — data exists (`user_personas`) but no aggregate author view.
- Author analytics endpoint returns book-level metrics (shareCount, etc.); depth **INFERRED**.
