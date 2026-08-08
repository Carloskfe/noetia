# 15 — Analytics, Events & Personas

Three layers: an **event stream**, **daily reading rollups**, and a **nightly persona computation**.

## Event stream — CONFIRMED (`events` module)
- `Event(userId, bookId, eventType, payload jsonb, createdAt)`; indexed on `userId`, `bookId`, `eventType`, `createdAt`.
- Emission API: `EventsService.emit(eventType, {userId, bookId, payload})` — best-effort (failures are caught/logged, never block the request).
- **Event types actually emitted (CONFIRMED via call sites):**
  - `fragment_created`
  - `fragment_shared`
  - (plus internal `error` logging)
- **INFERRED:** the `events` table is a general-purpose sink capable of more event types, but only fragment lifecycle events are currently written through `EventsService.emit`. Reading activity is captured via the separate stats path, not `events`.

## Reading stats — CONFIRMED (`stats` module)
- `reading_stats(userId, date, minutesRead, phrasesRead)`, unique per `(userId, date)`.
- `POST /stats/heartbeat` (every 60 s from the reader) → `StatsService.heartbeat(userId, phraseDelta)` UPSERTs the day's row.
- `GET /stats/me` — totals, 7-day chart data, **streak** (computed from consecutive active dates), and weekly-goal progress (`goalWeeklyMinutes/Books`).
- `GET /stats/history` — daily minutes/phrases/activeDays series.

## Fragment theme tagging — CONFIRMED (`fragments/theme-taxonomy.ts`, `fragment-tagger.service.ts`)
- **20-theme taxonomy** (`Theme` union): `amor, aventura, belleza, conocimiento, destino, familia, fe, filosofia, heroismo, humanidad, identidad, justicia, libertad, muerte, naturaleza, poder, sufrimiento, tiempo, amistad, espiritualidad`.
- Keyword-based tagger (`THEME_KEYWORDS`, a large Spanish keyword→theme map). On fragment create, `FragmentTagger.tag(text)` returns up to **`MAX_THEMES = 3`** themes, stored in `fragments.themes[]`.

## Persona computation — CONFIRMED (`personas/persona-computer.service.ts`)
- **Nightly cron `@Cron(EVERY_DAY_AT_2AM)`** → `computeAll()` → `computeForUser(userId)` for eligible users.
- Writes `user_personas` (1:1 with user) with an UPSERT. Fields: `dominantThemes[]`, `engagementArchetype`, `readingCadence` (`daily|weekend|binge|irregular`), `completionRate`, `socialAmplification`, `preferredPlatforms[]`, `topGenres[]`, `avgSessionMinutes`, `computedAt`.
- Computed from **~8 SQL aggregations** (CONFIRMED private query methods): `queryDominantThemes`, `querySocialAmplification`, `queryPreferredPlatforms`, `queryReadingStats`, `queryProgressRows`, `queryTopGenres`, `queryClubDiscussions`, `queryFragmentStats`.
- **Opt-out:** `User.allowInsights` (migration 060) — the cron skips users who opted out. **CONFIRMED** (field exists; skip behavior INFERRED from design notes).
- Admin can force recompute (`/admin/personas/recompute`).

## Metrics currently captured (inventory) — CONFIRMED
| Signal | Source | Where |
|--------|--------|-------|
| Fragment created / shared | `events` | `events` table |
| Minutes read / day | heartbeat | `reading_stats.minutesRead` |
| Phrases read / day | heartbeat | `reading_stats.phrasesRead` |
| Reading streak | derived | `stats.getMyStats` |
| Book share count | counter | `books.shareCount` |
| Share visit count | counter | `shares.visitCount` |
| Reading position | progress | `reading_progress.phraseIndex` |
| Dominant themes | fragments | `fragments.themes[]` → persona |
| Engagement archetype / cadence | persona | `user_personas` |
| Completion rate / avg session | persona | `user_personas` |
| Social amplification | persona | `user_personas` |
| HTTP request rate/latency | Prometheus | `metrics` (see [17](17-observability.md)) |

## Notable — CONFIRMED / INFERRED
- No third-party product analytics (no Segment/Amplitude/GA in api deps). Analytics are **first-party** only.
- The event stream is under-utilized (only fragment events emitted) relative to the schema's generality — a latent opportunity (see [20](20-opportunities.md)).
