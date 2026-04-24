## Why

Sprints 1.1 and 1.2 delivered auth and a book catalog, but there is still no reading experience — the reader page is a stub. The synchronized reading engine is Alexandria's core differentiator: users can read and listen at the same time, with the active phrase highlighted in the text as audio plays. Without it, the platform has no value.

## What Changes

- Introduce a `SyncMap` entity that stores a phrase-level JSON map (text, startTime, endTime, index) per book, persisted in PostgreSQL as JSONB
- Introduce a `ReadingProgress` entity that stores the last phrase index per user+book
- Add four new API endpoints under `/books/:id/`: `GET /sync-map`, `POST /sync-map` (admin), `GET /progress` (auth), `POST /progress` (auth)
- Replace the reader page stub with a full synchronized reader: two-column layout, phrase-span text rendering, audio player (play/pause/scrub/speed), phrase highlighting, click-to-seek, Reading/Listening mode toggle, and progress persistence
- Add unit tests for `sync-map.service`, `progress.service`, and web reader sync utilities

## Capabilities

### New Capabilities

- `synchronized-reader`: Full reader UI — phrase-span text rendering, audio player controls, phrase↔audio sync, click-to-seek, mode toggle, and progress restore
- `sync-map`: API resource for phrase-to-timestamp mappings per book (CRUD restricted to admin write, public read)
- `reading-progress`: API resource for per-user reading position per book (authenticated read/write)

### Modified Capabilities

- `book-catalog`: `GET /books/:id` response is unchanged, but the reader now consumes its `textFileUrl` and `audioFileUrl` presigned URLs — no spec-level requirement change

## Impact

- **api**: new migrations, two new services + controllers wired into `BooksModule`
- **web**: `app/(reader)/reader/page.tsx` fully replaced; new reader utility module for sync helpers; new unit tests under `tests/unit/reader/`
- **db**: two new tables: `sync_maps`, `reading_progress`
- **dependencies**: no new npm packages needed (TypeORM JSONB is supported natively)
