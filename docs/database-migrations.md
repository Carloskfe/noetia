# Database Migrations

Migrations live in `services/api/src/migrations/` and are named `<timestamp>-<Description>.ts`.

---

## Running migrations

```bash
# Dev — inside the api container
docker compose exec api npm run migration:run

# Production
docker compose --env-file .env.production -f docker-compose.server.yml exec -T -e DB_HOST=db api npm run migration:run:prod

# Verify the last migrations ran
docker compose exec -T db psql -U noetia -d noetia \
  -c "SELECT name, timestamp FROM migrations ORDER BY timestamp DESC LIMIT 5;"
```

## Creating a new migration

```bash
docker compose exec api npm run migration:generate -- src/migrations/<Description>
```

TypeORM auto-diffs the entity definitions against the live schema and generates the `up()`/`down()` SQL.

---

## Golden rules

- **Never edit a migration that has been deployed.** TypeORM stores a checksum per migration; editing a shipped file causes `migration:run` to fail on all other environments. If a migration has a bug, write a new one to fix it (see migrations 060 → 061 for the canonical example).
- **Every schema change must be a migration.** Do not run raw `ALTER TABLE` on production. The `migrations` table is the source of truth for what schema is in place.
- **Test the migration on a local `docker compose` environment** before pushing. Include rollback (`down()`) logic for any destructive change.
- **Migrations that seed data** (`SeedPlans`, `SeedCollectionsFromBookField`) must be idempotent — use `INSERT ... ON CONFLICT DO NOTHING` or check existence first.

---

## Migration history

| # | Migration | Description |
|---|-----------|-------------|
| 000 | `CreateUsersTable` | users table with auth fields |
| 001 | `AddUserType` | userType enum (personal, author, editorial) |
| 002 | `AddUserPreferences` | country, languages, interests |
| 003 | `AddUpdatedAt` | updatedAt timestamp |
| 004 | `CreateBooksTable` | books with category, audio/text keys |
| 005 | `CreateSyncMapsAndProgress` | phrase sync maps + reading progress |
| 006 | `CreateFragments` | user highlights |
| 007 | `CreatePlansTable` | subscription plans |
| 008 | `AddStripeCustomerId` | stripeCustomerId on users |
| 009 | `CreateSubscriptions` | subscriptions + book_purchases |
| 010 | `SeedPlans` | Individual + Reader plan seed data |
| 011 | `MakeFragmentPhraseIndicesNullable` | |
| 012 | `AddFreeLibrary` | isFree flag on books |
| 013 | `AddAudioStreamKey` | audioStreamKey on books |
| 014 | `AddUploadedBy` | uploadedById foreign key |
| 015 | `CreateUserBooksTable` | user library ownership |
| 016 | `CreateCollectionsTable` | book collections/series |
| 017 | `AddBookPriceCents` | per-title price in cents |
| 018 | `AddUserBookPurchaseType` | purchase vs credit redemption |
| 019 | `AddSubscriptionCredits` | creditBalance on subscriptions |
| 020 | `AddPlanCreditsPerCycle` | creditsPerCycle on plans |
| 021 | `AddHostingTier` | hostingTier enum on users |
| 022 | `AddBookAnalytics` | shareCount on books |
| 023 | `AddEmailConfirmed` | emailConfirmed boolean (default true for existing; new local registrations start false) |
| 024 | `AddBookCollection` | collection varchar on books; auto-seeds Bible books with collection='Biblia' |
| 025 | `SeedCollectionsFromBookField` | Populates collections table from existing books.collection values |
| 026 | `FixCollectionsAndCovers` | Corrects collection slugs and adds themed cover URLs |
| 027 | `FixCollectionDataFinal` | Normalizes empty string → NULL, canonical Bible order, excludes Blasco Ibáñez |
| 028 | `UpdateThemedCoverUrls` | Sets /covers/*.png paths for 10 books + 2 collections |
| 029 | `LiteraturaInfantilCoverUrls` | Cover URLs for Literatura Infantil books (superseded by 030) |
| 030 | `CleanupLiteraturaInfantil` | Removes La Edad de Oro and Literatura Infantil collection; Pombo/Quiroga → standalone |
| 031 | `FixCuentosSelvaLanguage` | Deletes English Gutenberg text; re-ingested from Spanish Wikisource |
| 032 | `AddMissingIndexes` | idx_books_published_free, idx_books_collection, idx_books_category, idx_books_uploaded_by, idx_subscriptions_plan |
| 033 | `AddSyncSource` | syncSource VARCHAR on sync_maps ('auto'\|'srt'\|'vtt'\|'manual') |
| 034 | `CreateUploadCodes` | upload_codes table — admin-issued single-use courtesy upload codes |
| 035 | `CreateWaitlist` | waitlist_entries table — email, name, isAuthor, invitedAt |
| 036 | `CreateCausesAndPreferences` | causes table (3 seeded) + user_cause_preferences (up to 2 causes per user) |
| 037 | `RenameCausaToMedioAmbiente` | Renames "Conservación Ambiental" → "Medio Ambiente" in causes table |
| 038 | `RenameCreditsToTokens` | creditsRemaining → tokenBalance on subscriptions; creditsPerCycle → tokensPerCycle on plans |
| 039 | `RestructurePlansAndTokenPackages` | Plans: Individual $8.99, Duo $13.99, Family $18.99 (monthly+annual); token_packages table seeded |
| 040 | `CreateTokenLedgerAndCourtesy` | token_ledger (90-day paid, 30-day promo/courtesy, FIFO); courtesy_token_quotas; books.narratorId; subscriptions.linkedUserIds + nextTokenIssuanceAt |
| 041 | `UpdateStripeProductIds` | Sets real Stripe price IDs on plans and token_packages from env vars |
| 042 | `CreateSubscriptionInvites` | subscription_invites table for Duo/Family plan invite flow |
| 043 | `CreateGiftCards` | gift_cards table — token gifts with personal message, 1-year expiry |
| 044 | `AddUiLanguage` | uiLanguage VARCHAR(5) DEFAULT 'es' on users |
| 045 | `CreatePushTokens` | push_tokens table — Expo push tokens per user |
| 046 | `CreateClubs` | clubs table — name, description, type (public/private/author_event), owner, approval/token flags |
| 047 | `CreateClubMembers` | club_members — role, status (active/banned), ban tracking, per-member notification prefs |
| 048 | `CreateClubBooks` | club_books — reading list per club, status (active/completed/queued) |
| 049 | `CreateClubMessages` | club_messages — general chat (not phrase-anchored), soft delete |
| 050 | `CreateClubDiscussions` | club_discussions — phrase-anchored comments tied to sync map phraseIndex |
| 051 | `CreateClubPollsAndVotes` | club_polls + club_poll_options + club_poll_votes — book nomination voting |
| 052 | `CreateClubSessions` | club_sessions — Escucha Juntos scheduled live listening sessions |
| 053 | `AddPrivacySettings` | shareReadingProgress/Library/Profile/Fragments booleans on users |
| 054 | `CreateReadingStats` | reading_stats table — daily minutesRead + phrasesRead per user, unique (userId, date) |
| 055 | `AddReadingGoals` | goalWeeklyMinutes + goalWeeklyBooks nullable integers on users |
| 056 | `AddSyncCoverage` | syncCoverage (float), syncExceptions (int), syncAvgConfidence (float) on sync_maps |
| 057 | `CreateEventsTable` | append-only events (userId, bookId, eventType VARCHAR(50), payload JSONB, createdAt); 5 indexes |
| 058 | `AddFragmentThemes` | themes JSONB on fragments — auto-tagged with up to 3 labels from 20-theme taxonomy |
| 059 | `CreateUserPersonas` | user_personas — dominantThemes, engagementArchetype, readingCadence, completionRate, socialAmplification, preferredPlatforms, topGenres, avgSessionMinutes, computedAt |
| 060 | `AddAllowInsights` | allowInsights BOOLEAN DEFAULT TRUE on users. **Bug:** added snake_case `allow_insights` instead of camelCase, breaking all User queries until 061 |
| 061 | `FixAllowInsightsColumnName` | Renames `users.allow_insights` → `"allowInsights"` to match the User entity |
| 062 | `ConvertSyncMapTimingsToSeconds` | Data fix: rescales `sync_maps.phrases` timings from milliseconds → **seconds** for legacy chapter-linear (`auto`) maps (non-whisper maps whose max `endTime` > 86 400). Escucha Activa reads phrase times as seconds; the old alignment path emitted ms (~1000× off). Idempotent; `down` is a no-op. See [whisper-sync-troubleshooting.md §13](whisper-sync-troubleshooting.md#13-phrase-timing-units-and-why-chapter-linear-alignment-is-retired) |
| 063 | `ConfirmOAuthUserEmails` | Data fix: sets `users."emailConfirmed" = true` for all `provider <> 'local'` accounts. OAuth emails are provider-verified, but users created before that was enforced were trapped behind the email-confirmation gate with no confirmation email to receive. Idempotent; `down` is a no-op |
