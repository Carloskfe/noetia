# Reader Persona Pipeline

Noetia builds a **derived reader profile** (persona) from behavioral signals — never from self-reported demographics. The pipeline has three layers.

---

## Layer 1 — Event stream (`events` table)

Append-only event log (migration 057). Two event types are currently captured:

| Event | Payload | Emitted in |
|-------|---------|-----------|
| `fragment_created` | `{ fragmentId, themes, textLength }` | `FragmentsService.create()` |
| `fragment_shared` | `{ fragmentId, platform, format, themes }` | `SharingController.share()` |

Events are fire-and-forget — errors are logged but never propagate to the user request.

---

## Layer 2 — Fragment theme tagging

`FragmentTaggerService` applies a **20-theme Spanish taxonomy** (`src/fragments/theme-taxonomy.ts`) at fragment creation time. Matching is case-insensitive keyword scoring; up to 3 themes per fragment are stored as JSONB on the `fragments.themes` column (migration 058).

**Themes:**
```
amor · aventura · belleza · conocimiento · destino · familia · fe · filosofia
heroismo · humanidad · identidad · justicia · libertad · muerte · naturaleza
poder · sufrimiento · tiempo · amistad · espiritualidad
```

---

## Layer 3 — Persona computation (`user_personas` table)

`PersonaComputerService` runs 8 parallel SQL aggregations per user and upserts the result into `user_personas` (migration 059).

| Field | Source | Logic |
|-------|--------|-------|
| `dominantThemes` | `fragments.themes` | Top 5 by frequency |
| `engagementArchetype` | fragments + events + clubs | `social_sharer > community > deep_reader > browser > reader` |
| `readingCadence` | `reading_stats` (60-day window) | `daily (≥40 days) > weekend (ratio ≥0.6) > binge (≤10 days, ≥45 min avg) > irregular` |
| `completionRate` | `reading_progress` + `sync_maps` | books at phraseIndex ≥ 80% / total started |
| `socialAmplification` | `events` | `fragment_shared` / `fragment_created` |
| `preferredPlatforms` | `events` | Top 4 platforms by `fragment_shared` count |
| `topGenres` | `fragments` + `books` | Top 3 book categories by fragment count |
| `avgSessionMinutes` | `reading_stats` | Average minutesRead on active days (60-day window) |

**Nightly cron:** `@Cron(EVERY_DAY_AT_2AM)` — skips users with `allowInsights = FALSE`.

---

## Admin endpoints

```
POST /api/admin/personas/recompute            # Full recompute — all opted-in users
POST /api/admin/personas/:userId/recompute    # Recompute a single user
GET  /api/admin/personas/:userId              # Inspect a user's current persona
```

---

## Opt-out

Users disable persona computation from **Profile → Privacy → Contribute to Noetia Insights** (`users.allowInsights`). Opted-out users are excluded from `computeAll()` and their existing persona row is not refreshed.

The `allowInsights` column was added by migration 060 with a snake_case naming bug; migration 061 corrected it. See [`docs/database-migrations.md`](database-migrations.md) for the canonical example of how to fix a broken migration.
