## 1. Database — Migrations & Entities

- [x] 1.1 Create migration `1714000000005-CreateSyncMapsAndProgress` — creates `sync_maps` table (id UUID PK, bookId UUID FK → books.id ON DELETE CASCADE, phrases JSONB NOT NULL DEFAULT '[]', createdAt, updatedAt) and `reading_progress` table (id UUID PK, userId UUID FK → users.id ON DELETE CASCADE, bookId UUID FK → books.id ON DELETE CASCADE, phraseIndex int NOT NULL DEFAULT 0, updatedAt; UNIQUE on userId+bookId)
- [x] 1.2 Create `src/books/sync-map.entity.ts` with TypeORM columns matching the migration (use `simple-json` or `jsonb` column type for `phrases`)
- [x] 1.3 Create `src/books/reading-progress.entity.ts` with TypeORM columns matching the migration

## 2. API — SyncMap Service & Endpoints

- [x] 2.1 Create `src/books/sync-map.service.ts` with methods: `findByBook(bookId): Promise<SyncMap | null>` and `upsert(bookId, phrases): Promise<SyncMap>`
- [x] 2.2 Add sync map endpoints to `src/books/books.controller.ts`:
  - `GET /books/:id/sync-map` — public, calls `syncMapService.findByBook(id)`, returns 404 if null
  - `POST /books/:id/sync-map` — JwtAuthGuard + isAdmin check (ForbiddenException if not admin), calls `syncMapService.upsert(id, body.phrases)`, returns 201
- [x] 2.3 Register `SyncMap` entity in `TypeOrmModule.forFeature` inside `BooksModule`; inject `SyncMapService`

## 3. API — ReadingProgress Service & Endpoints

- [x] 3.1 Create `src/books/reading-progress.service.ts` with methods: `findByUserAndBook(userId, bookId): Promise<ReadingProgress | null>` and `upsert(userId, bookId, phraseIndex): Promise<ReadingProgress>`
- [x] 3.2 Add progress endpoints to `src/books/books.controller.ts`:
  - `GET /books/:id/progress` — JwtAuthGuard, calls `progressService.findByUserAndBook(req.user.id, id)`, returns `{ phraseIndex: 0 }` if null
  - `POST /books/:id/progress` — JwtAuthGuard, calls `progressService.upsert(req.user.id, id, body.phraseIndex)`, returns 201 on create or 200 on update
- [x] 3.3 Register `ReadingProgress` entity in `TypeOrmModule.forFeature` inside `BooksModule`; inject `ReadingProgressService`

## 4. API — Unit Tests

- [x] 4.1 Create `tests/unit/books/sync-map.service.spec.ts` — mock TypeORM repository; test `findByBook` (found, not found) and `upsert` (insert new, replace existing); cover happy path + error scenarios; no real DB
- [x] 4.2 Create `tests/unit/books/reading-progress.service.spec.ts` — mock TypeORM repository; test `findByUserAndBook` (found, not found) and `upsert` (create, update); cover happy path + error scenarios; no real DB
- [x] 4.3 Run `npm run test` in `services/api` — all tests must pass; run `npm run test:cov` and confirm coverage ≥ 80%

## 5. Web — Reader Sync Utilities

- [x] 5.1 Create `services/web/lib/reader-utils.ts` exporting:
  - `phraseAt(phrases: Phrase[], currentTime: number): number` — binary search returning the index of the active phrase (-1 if none)
  - `seekToPhrase(phrases: Phrase[], index: number): number` — returns `phrases[index].startTime` (or 0 if out of bounds)
- [x] 5.2 Create `services/web/tests/unit/reader/reader-utils.spec.ts` — test `phraseAt` (time before all phrases → -1, time in middle phrase, time after last phrase, empty array) and `seekToPhrase` (valid index, out of bounds); no DOM, no fetch

## 6. Web — Reader Page

- [x] 6.1 Replace `services/web/app/(reader)/reader/page.tsx` stub with a full `'use client'` component that:
  - Reads `?bookId=` from `useSearchParams()`
  - On mount fetches: `GET /books/:id` (book detail), `GET /books/:id/sync-map`, `GET /books/:id/progress`; stores results in state
  - Shows a loading spinner while fetching; shows error message if book fetch fails
- [x] 6.2 Render text column: map over sync map phrases and render each as `<span data-phrase-index={i} key={i} onClick={() => seekToIndex(i)}>{phrase.text} </span>`; if no sync map, render raw text as a single paragraph
- [x] 6.3 Create audio ref (`useRef<HTMLAudioElement>(null)`) pointing to `book.audioFileUrl`; attach `timeupdate` listener that calls `phraseAt(phrases, audio.currentTime)` and updates `activePhraseIndex` state; scroll active span into view when it changes
- [x] 6.4 Build the audio controls panel (rendered as right sidebar on ≥ md screens, bottom bar on mobile):
  - Play/pause button toggling `audio.paused`
  - Scrub `<input type="range">` bound to `audio.currentTime` / `audio.duration`
  - Speed selector `<select>` with options 0.75, 1, 1.25, 1.5, 2 setting `audio.playbackRate`
  - Current time / duration display formatted as `m:ss`
- [x] 6.5 Apply active phrase CSS: phrase spans get `className={activePhraseIndex === i ? 'bg-yellow-200 rounded' : ''}` (or Tailwind equivalent)
- [x] 6.6 Add mode toggle button (Reading / Listening): in Reading Mode hide the full controls panel and show only a floating play button; in Listening Mode show full panel and auto-scroll to active phrase on every phrase change
- [x] 6.7 Progress persistence: `useEffect` watching `activePhraseIndex` — debounce 2 s, then `POST /books/:id/progress` with `{ phraseIndex: activePhraseIndex }` if user token exists in `sessionStorage`
- [x] 6.8 On mount, after progress fetch resolves, scroll to the saved phrase span (use `document.querySelector(`[data-phrase-index="${savedIndex}"]`)?.scrollIntoView()`)

## 7. Web — Unit Tests

- [x] 7.1 Confirm `services/web/tests/unit/reader/reader-utils.spec.ts` from task 5.2 passes with `npm run test` in `services/web`
- [x] 7.2 Run `npm run test:cov` in `services/web` — confirm overall coverage ≥ 80%

## 8. Verification

- [x] 8.1 Run `pnpm --filter @alexandria/api migration:run` against the dev database — confirm `sync_maps` and `reading_progress` tables exist
- [ ] 8.2 Seed one book's sync map via `POST /books/:id/sync-map` with admin JWT and a sample phrases array
- [ ] 8.3 Open `http://localhost:3000/reader?bookId=<id>` — confirm phrases render, audio plays, active phrase highlights
- [ ] 8.4 Click a phrase — confirm audio seeks to that timestamp
- [ ] 8.5 Toggle Reading / Listening mode — confirm panel shows/hides correctly
- [ ] 8.6 Let audio play for a few phrases, reload the page — confirm reader restores to the saved phrase
- [x] 8.7 All `api` and `web` tests still pass after all changes
- [x] 8.8 Commit and push all changes to GitHub
