# 04 — Database

## Engine — CONFIRMED
- **PostgreSQL 16** (`postgres:16-alpine`), accessed via **TypeORM** with `synchronize: false` (migrations only).
- CLI datasource: `services/api/src/data-source.ts`. Migration commands run via `npm run migration:run` (dev) / `migration:run:prod` (server), invoked by CD after deploy.

## Migration history — CONFIRMED
**66 migration files** in `services/api/src/migrations/`, timestamp-prefixed and applied in order. Notable milestones (**CONFIRMED** from filenames):

| Range | Theme |
|-------|-------|
| 000–011 | Users, books, sync maps, reading progress, fragments, plans, subscriptions |
| 012–018 | Free library, audio stream key, uploads, user-books, collections, book pricing |
| 019–021 | Subscription credits, plan credits-per-cycle, hosting tier |
| 022–033 | Book analytics, email-confirmed, collections cleanup, indexes, `syncSource` |
| 034–045 | Upload codes, waitlist, causes, **credits→tokens rename (038)**, plan/token-package restructure, token ledger + courtesy (040), stripe product IDs, subscription invites, gift cards, ui-language, push tokens |
| 046–052 | Clubs (members, books, messages, discussions, polls, sessions) |
| 053–056 | Privacy settings, reading stats, reading goals, sync coverage |
| 057–065 | Events, fragment themes, user personas, allow-insights, **sync-map ms→seconds conversion (062)**, OAuth email confirm backfill (063), onboarding state (064), **shares (065)** |

**CONFIRMED critical rule (CLAUDE.md, enforced by TypeORM checksums):** deployed migrations are never edited; corrections ship as new migrations (canonical example 060→061).

## Tables — CONFIRMED (derived from entities + migrations)

Identity/content: `users`, `books`, `sync_maps`, `reading_progress`, `collections`, `book_collections`, `user_books`.
Reader: `fragments`, `shares`.
Billing: `plans`, `subscriptions`, `subscription_invites`, `token_ledger`, `token_packages`, `courtesy_token_quotas`, `gift_cards`, `upload_codes`, `waitlist_entries`.
Clubs: `clubs`, `club_members`, `club_books`, `club_messages`, `club_discussions`, `club_polls`, `club_poll_options`, `club_poll_votes`, `club_sessions`.
Giving: `causes`, `user_cause_preferences`.
Analytics: `events`, `reading_stats`, `user_personas`.
Notifications: `push_tokens`.

## Data types & conventions — CONFIRMED
- Primary keys: UUID (`@PrimaryGeneratedColumn('uuid')`), except `shares.id` (varchar(16) short slug) and `user_personas.userId` (UUID PK, 1:1 with user).
- JSONB used for: `sync_maps.phrases`, `fragments.themes`, `events.payload`, `user_personas.*[]`, `users.onboardingState`.
- Timestamps: mix of `timestamptz` (newer tables) and default `@CreateDateColumn/@UpdateDateColumn`.
- Arrays: Postgres arrays (`subscriptions.linkedUserIds uuid[]`), `simple-array` (`users.languages/interests`).

## Indexes — CONFIRMED (partial)
- `events`: indexes on `userId`, `bookId`, `eventType`, `createdAt`.
- `reading_stats`: **unique** composite `(userId, date)`.
- `user_personas`: indexes on `engagementArchetype`, `readingCadence`.
- `shares`: index on `bookId`.
- Migration 032 (`AddMissingIndexes`) added further indexes. **UNKNOWN:** full index coverage across all FKs was not exhaustively verified — a targeted index audit is recommended (see [19-technical-debt.md](19-technical-debt.md)).

## Backups & data safety — CONFIRMED (from CLAUDE.md + ops)
- Nightly Postgres backup (2 AM cron, 7-day daily + 4-week Sunday retention).
- Weekly MinIO backup (Sunday 3 AM, 4-copy retention).
- Contabo server snapshots taken before schema-changing migrations / infra changes (operational discipline, documented).

## Production data to preserve — CONFIRMED
Production holds live records: beta users, ~60–84 books with sync maps, Stripe products/price IDs (persisted in `plans`/`token_packages`), clubs, fragments, reading stats, personas, subscriptions, token ledger. All must be preserved. Schema changes go **only** through migrations.

## Seed data — CONFIRMED
Several migrations seed reference data (plans, collections, causes). Ingestion CLIs (`services/api/src/ingestion/*`) seed books, covers, audio, sync maps, and search (run manually inside the api container).
