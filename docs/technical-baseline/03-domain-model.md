# 03 — Domain Model

All entities below are **CONFIRMED** from `services/api/src/**/*.entity.ts` (TypeORM). Field lists are the actual persisted columns. IDs are UUID unless noted.

## Identity & access

### User (`users`)
- **Purpose:** account holder (reader, author, or editorial/publisher).
- **Key fields:** `email` (unique, nullable — OAuth), `passwordHash` (nullable), `provider` (`local|google|facebook|apple`), `providerId`, `name`, `avatarUrl`, `userType` (`personal|author|editorial`, nullable), `country`, `languages[]`, `interests[]`, `stripeCustomerId`, `hostingTier` (`basic|starter|pro`), `emailConfirmed`, `uiLanguage` (default `es`), `isAdmin`, privacy toggles (`shareReadingProgress`, `shareLibrary`, `shareProfile`, `shareFragments`, `allowInsights`), goals (`goalWeeklyMinutes`, `goalWeeklyBooks`), `onboardingState` (jsonb), `lastLoginAt`.
- **Relationships:** referenced by nearly every entity via `userId`.
- **Lifecycle:** created at register or first OAuth login; `emailConfirmed` gates confirmation-required routes; soft roles via `userType`/`isAdmin`. **INFERRED:** account deletion exists (web `DeleteAccountModal.tsx`, mobile account screens) but cascade behavior is per-entity `onDelete: CASCADE`.

## Content

### Book (`books`)
- **Purpose:** catalog item (free-library or author-submitted).
- **Key fields:** `title`, `author`, `isbn`, `language` (default `es`), `category` (enum `BookCategory`), `description`, `coverUrl`, `textFileKey`, `audioFileKey`, `audioStreamKey`, `textFileSizeBytes`, `audioFileSizeBytes`, `shareCount`, `collection`, `isFree`, `priceCents`, `isPublished`, `uploadedById` → `User`.
- **Relationships:** 1—1 `SyncMap`; 1—* `Fragment`, `ReadingProgress`, `UserBook`, club associations, shares.
- **Lifecycle:** ingested (free library) or uploaded by author → reviewed → published (`isPublished`). Free vs paid via `isFree`/`priceCents`.

### SyncMap (`sync_maps`)
- **Purpose:** phrase-level text↔audio alignment for Escucha Activa.
- **Key fields:** `bookId` → `Book`, `phrases` (jsonb array of `{index,text,startTime,endTime,type?,exception?}`), `syncSource` (`auto|srt|vtt|manual|whisper`), `syncCoverage`, `syncExceptions`, `syncAvgConfidence`.
- **Lifecycle:** produced by ingestion/alignment pipeline; quality gated ≥ 90% coverage. See [06-reader.md](06-reader.md).

### ReadingProgress (`reading_progress`)
- **Purpose:** last reading position per user+book.
- **Key fields:** `userId`, `bookId`, `phraseIndex` (default 0). One row per user/book. **INFERRED** uniqueness by usage.

### Collection (`collections`) & BookCollection (`book_collections`)
- **Purpose:** curated groupings of books.
- `Collection`: `name`, `slug` (unique), `description`, cover. `BookCollection`: join `bookId`↔`collectionId` with `sortOrder`.

## Reader-generated

### Fragment (`fragments`)
- **Purpose:** user highlight (a captured passage), optionally with a note.
- **Key fields:** `userId`, `bookId`, `startPhraseIndex`, `endPhraseIndex`, `text`, `note`, `themes[]` (jsonb) — auto-tagged (see [15-analytics.md](15-analytics.md)).
- **Lifecycle:** created from reader selection; feeds sharing (quote cards) and persona theme aggregation.

### Share (`shares`)
- **Purpose:** persisted public quote-card share → powers `/s/<id>` invite page.
- **Key fields:** `id` (varchar(16) — short slug, **not** UUID), `bookId`, `fragmentId`, `quote`, `author`, `title`, `citation`, `imageUrl`, `platform`, `createdById`, `visitCount`.
- **Lifecycle:** created on "copy link"; public `GET /shares/:id`; `visitCount` increments on view.

## Subscriptions & token economy
*(Detailed in [08](08-subscriptions.md) / [09](09-token-economy.md).)*

- **Plan (`plans`):** `name`, `stripePriceId`, `interval`, `amountCents`, `maxProfiles`, `tokensPerCycle`.
- **Subscription (`subscriptions`):** `userId`, `stripeCustomerId`, `stripeSubscriptionId`, `planId`, `status`, `currentPeriodEnd`, `trialEnd`, `stripeEventId`, `tokenBalance`, `linkedUserIds[]` (Duo/Family shared pool), `nextTokenIssuanceAt`.
- **TokenLedger (`token_ledger`):** `userId`, `subscriptionId`, `type` (`paid|promotional|courtesy`), `status` (`active|redeemed|expired`), `issuedAt`, `expiresAt`, `activatedAt`, `redeemedAt`, `bookId`, `reason`.
- **TokenPackage (`token_packages`):** one-time token bundles (`tokenCount`, `amountCents`, `stripePriceId`, `active`).
- **SubscriptionInvite (`subscription_invites`):** Duo/Family invite (`email`, `token` unique, `status`, `expiresAt`).
- **CourtesyTokenQuota (`courtesy_token_quotas`):** per-role courtesy token grants (`role` `author|publisher|narrator`, `granted`, `used`).
- **GiftCard (`gift_cards`):** token gift (`recipientEmail`, `message`, `occasion`, `tokenCount`, `claimToken` unique, `status` `sent|claimed|expired`, `expiresAt`, `stripeSessionId`).
- **UploadCode (`upload_codes`) / WaitlistEntry (`waitlist_entries`):** redemption codes and waitlist capture.

## Community — Clubs
*(Detailed in [05-api.md](05-api.md).)* Seven entities:
- **Club (`clubs`):** `name`, `description`, `type` (`public|private|author_event`), `ownerId`, flags, `maxMembers`.
- **ClubMember (`club_members`):** `role` (`admin|moderator|member`), `status` (`active|banned`), notification prefs, `bannedById`.
- **ClubBook (`club_books`):** `status` (`active|completed|queued`), `addedById`, activate/complete timestamps.
- **ClubMessage (`club_messages`):** chat.
- **ClubDiscussion (`club_discussions`):** phrase-anchored discussion (`phraseIndex`, `bookId`).
- **ClubPoll / ClubPollOption / ClubPollVote (`club_polls`…):** book-selection polls.
- **ClubSession (`club_sessions`):** scheduled/live "Escucha Juntos" sessions (`status` `scheduled|live|completed|cancelled`, `hostId`, `scheduledFor`, phrase range).

## Social giving

### Cause (`causes`) & UserCausePreference (`user_cause_preferences`)
- **Purpose:** "Causas Noetia" — a per-payment social-giving allocation.
- `Cause`: `slug` (unique), `name`, description fields, `emoji`, `active`. `UserCausePreference`: primary/secondary cause per user.

## Analytics & engagement

- **Event (`events`):** append-only telemetry — `userId`, `bookId`, `eventType` (indexed), `payload` (jsonb), `createdAt` (indexed). See [15-analytics.md](15-analytics.md).
- **ReadingStat (`reading_stats`):** per-user-per-day rollup — unique `(userId, date)`, `minutesRead`, `phrasesRead`.
- **UserPersona (`user_personas`):** computed profile — `userId` (PK), `dominantThemes[]`, `engagementArchetype`, `readingCadence`, `completionRate`, `socialAmplification`, `preferredPlatforms[]`, `topGenres[]`, `avgSessionMinutes`, `computedAt`.

## Notifications

- **PushToken (`push_tokens`):** `userId`, `token`, `platform` — Expo push registration.

## Entity relationship summary — INFERRED (from FKs)

```
User 1─* Fragment ─* Share
User 1─* ReadingProgress *─1 Book 1─1 SyncMap
User 1─* UserBook *─1 Book
User 1─1 Subscription 1─* TokenLedger
User 1─* Event / ReadingStat / PushToken / UserPersona(1─1)
Club 1─* {Member, Book, Message, Discussion, Poll, Session}
Collection *─* Book (via BookCollection)
```
Most child→parent relations use `onDelete: CASCADE` (**CONFIRMED** per entity decorators); `Book.uploadedBy` uses `SET NULL`.
