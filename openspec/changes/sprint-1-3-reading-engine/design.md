## Context

Auth (Sprint 1.1) and the book catalog (Sprint 1.2) are complete. Books are stored in MinIO; their text and audio file keys are persisted in PostgreSQL. `GET /books/:id` returns short-lived presigned URLs for both files. The reader page is a stub. There is no phrase-sync data, no reading progress tracking, and no reader UI.

The reading engine is the product's core differentiator. The technical challenge is two-way synchronization: audio time must drive text highlighting, and text clicks must seek audio — all in the browser with no server round-trips during playback.

## Goals / Non-Goals

**Goals:**
- Store phrase-to-timestamp mappings in PostgreSQL as JSONB (one row per book)
- Store per-user reading progress (last phrase index) in PostgreSQL
- Expose four new endpoints under `/books/:id/`
- Build a full reader page with phrase-span rendering, audio controls, bidirectional sync, mode toggle, and progress restore
- 100% mocked unit tests for all new services and web utilities

**Non-Goals:**
- DRM / encrypted streaming (future sprint)
- Meilisearch full-text search (future sprint)
- Mobile reader (future sprint)
- Real-time multi-device progress sync (future sprint)
- Generating sync maps automatically from audio (manual admin upload for MVP)

## Decisions

### 1. JSONB array for sync map — one row per book, not one row per phrase

**Decision:** `sync_maps` table has one row per book with a `phrases` JSONB column containing the full array of `{text, startTime, endTime, index}` objects.

**Rationale:** For MVP books (≤ several thousand phrases), a single JSONB load is faster than N individual row reads. Phrase arrays are always fetched in full (the reader needs all of them to render). JSONB avoids a join table and keeps the migration simple.

**Alternative considered:** One row per phrase in a `sync_map_phrases` table — rejected because it adds a join and complicates the admin upsert (delete-all + insert-all vs. a single JSONB update).

### 2. Active phrase detection entirely in the browser

**Decision:** The full sync map is fetched once on page load and stored in React state. The `timeupdate` event (fires ~4× per second in browsers) drives a `phraseAt(currentTime)` lookup against the in-memory array.

**Rationale:** Server-polling for the active phrase would introduce latency and unnecessary traffic. The sync map for a typical book fits easily in memory (< 1 MB JSON). Binary search on `startTime` makes `phraseAt` O(log n).

**Alternative considered:** WebSocket stream of phrase events — rejected as over-engineered for MVP; the `timeupdate` event is sufficient.

### 3. Progress saved on phrase change, debounced 2 s

**Decision:** When the active phrase index changes, a 2-second debounced `POST /books/:id/progress` is fired. The last phrase index is what gets saved.

**Rationale:** Saving on every `timeupdate` (4×/s) would generate ~240 API calls per minute. Saving only when the phrase changes reduces calls to O(phrases per minute). A 2 s debounce handles rapid scrubbing without a flood of requests.

**Alternative considered:** Saving on page unload — unreliable (unload event is not guaranteed to fire on mobile). Interval-based saving every 30 s — loses up to 30 s of progress. Phrase-change + debounce is the right balance.

### 4. Text rendered from textFileUrl as plain text split by phrase boundaries

**Decision:** The reader fetches the book's `textFileUrl` (presigned MinIO URL), treats the response as plain text, and aligns it to phrase spans using the sync map's `text` fields. Each phrase's text is wrapped in a `<span data-phrase-index="n">` element.

**Rationale:** EPUB parsing is out of scope for MVP. Storing plain text in MinIO and splitting by sync map phrases is the simplest path to a working reader. The sync map is the source of truth for phrase boundaries.

**Alternative considered:** HTML rendering of EPUB — rejected as requires a full EPUB parser; out of scope for MVP.

### 5. No new npm packages

**Decision:** Implement all reader functionality with React hooks and the browser's native `<audio>` element. No audio library (Howler, Wavesurfer) needed for MVP.

**Rationale:** Native `<audio>` covers all required controls (play/pause, currentTime, playbackRate, `timeupdate` event). Adding a library for MVP scope would increase bundle size without benefit.

## Risks / Trade-offs

- **Presigned URL expires mid-session** → `textFileUrl` and `audioFileUrl` have a 15-min TTL. If a user leaves the reader open > 15 min without interaction, audio may fail to load on resume. Mitigation: re-fetch book detail (and fresh URLs) when `<audio>` emits an error event.
- **`timeupdate` fires at ~4 Hz, not per-phrase** → Highlight updates are not perfectly instantaneous. Acceptable for MVP; Web Audio API's `currentTime` would give higher resolution but is out of scope.
- **Sync map must be manually uploaded by admin** → No tool to auto-generate phrase timestamps from audio. The admin must use the `POST /books/:id/sync-map` endpoint or a seed script. Acceptable for the initial 12-book catalog.
- **Plain text split may misalign if book text contains extra whitespace** → Phrase matching is done by index (not string search), so whitespace in source text is irrelevant — phrases are rendered directly from sync map `text` fields.

## Migration Plan

1. Run migration `1714000000005-CreateSyncMapsAndProgress` — creates `sync_maps` and `reading_progress` tables
2. No data migration needed — tables start empty; sync maps are uploaded by admin per book
3. Rollback: drop both tables; no foreign key dependencies from existing tables
