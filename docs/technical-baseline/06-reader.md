# 06 — Reader & Escucha Activa

The reader is the platform's core daily-use surface. This section is the most detailed by mandate.

## Components — CONFIRMED (web, `services/web`)
- `app/(reader)/reader/[id]/page.tsx` — reader page: audio element, playback state, active-phrase tracking, seek, heartbeat, bookmark.
- `components/PhraseRenderer.tsx` — shared phrase→span renderer (scroll + paged): click-to-seek, fragment capture, highlight.
- `components/PagedReader.tsx` — Kindle-style paged layout (default). Auto-flips to the narrated phrase in Escucha Activa.
- `components/ReaderTopBar.tsx`, `ChapterSheet.tsx`, `FragmentSheet.tsx`, `FragmentPopover.tsx` — controls & drawers.
- `lib/reader-utils.ts` — pure sync/geometry helpers (below).
- `lib/reader-preferences.ts` — `fontSize/darkMode/speed/readingLayout` in localStorage (default layout `paged`).
- `lib/use-reading-heartbeat.ts` — 60 s interval → `POST /stats/heartbeat`.

## Synchronization model — CONFIRMED

**Data:** a `SyncMap.phrases` jsonb array; each phrase `{index, text, startTime, endTime, type?, exception?}`. Times are in **seconds** (migration 062 converted legacy ms→s; the unit contract is documented in `whisper-sync-troubleshooting.md §13`).

**Active-phrase resolution** (`reader-utils.ts`, CONFIRMED):
- `phraseAt(phrases, t)` — linear scan returning the **last phrase that has started** (`startTime <= t`), skipping zero-duration structural markers (`heading`/`paragraph-break`, which carry `startTime==endTime==0`). This deliberately holds the highlight through inter-phrase gaps (e.g. LibriVox credits between chapters) rather than blinking to −1.
- `activePhraseForPlayback(phrases, t)` = `phraseAt(phrases, t − PHRASE_SYNC_OFFSET_SECONDS)`. `PHRASE_SYNC_OFFSET_SECONDS = 0.25` compensates for Whisper marking onset slightly early.
- `seekToPhrase(phrases, i)` returns `startTime + nudge` (nudge ≤ 0.25 s) so a seek to phrase *i* resolves back to *i* (highlight subtracts the offset, seek adds it — they cancel).
- `effectiveDuration(audioDuration, phrases)` = `max(audioDuration, lastPhraseEnd)` — corrects the progress bar for byte-concatenated MP3s whose VBR/Xing header under-reports duration.

## Offset / alignment pipeline — CONFIRMED (`services/api/src/ingestion`)
- `phrase-splitter.service.ts` — splits stored book text into phrases (`maxChars` default 200).
- `whisper-parser.ts` — parses word-level Whisper VTT/JSON into `TimedWord[]`.
- `phrase-aligner.ts` — aligns text phrases to timed words: proportion-based estimate + **EMA drift correction** + bounded local search (`MAX_DRIFT=150`), skip-and-continue for phrases not in audio (`exception=true`). **`matchSpan()` times each phrase from the first/last actually-matched word** (fixes a prior constant "highlight ahead of audio" bias). Verified this cycle.
- `alignment.service.ts` — chapter-linear fallback (`auto` source; **retired for new titles** — never ships below the quality gate).
- `merge-transcriptions.ts` — concatenates per-chapter VTTs using **real ffprobe audio durations** as offsets (fixes cumulative drift on multi-chapter books).
- Diagnostic tooling (this cycle): `diagnose-sync.ts` (`--realign`, `--profile`) measures highlight-vs-audio offset and localizes drift; `scripts/reseed-sync.sh` is a gated batch re-seed. See `whisper-sync-troubleshooting.md §14`.

**SRT processing** — CONFIRMED: authors can upload an SRT via `POST /books/:id/sync-map/srt`; `syncSource` supports `srt|vtt|manual|whisper|auto`. Image-gen exposes `GET /align/chapters` (chapter-alignment helper). Exact SRT→phrase parsing path **INFERRED** (endpoint exists; parser not line-read here).

## Quality gate — CONFIRMED
Standard: `syncCoverage ≥ 90%`. Enforced in discovery, collections, and search (`meetsStandard` flag). Books below the gate are hidden from discovery/search rather than shown-then-errored. `syncCoverage/syncExceptions/syncAvgConfidence` persisted on `sync_maps`.

## Playback state & progress tracking — CONFIRMED
- Reader tracks `currentTime`, `activePhraseIndex`, mode (`escucha-activa`), and persists position.
- **Reading position:** `reading_progress(userId, bookId, phraseIndex)`; audio resumes from saved phrase's `startTime`.
- **Heartbeat:** `use-reading-heartbeat` posts every 60 s with a `phraseDelta`; server `StatsService.heartbeat` UPSERTs into `reading_stats` (minutes/phrases per day). Drives streaks, 7-day chart, weekly goals.
- Presigned audio URL refresh: the reader preserves audio position when an expired (15-min) MinIO presigned URL is refreshed mid-listen (recent fix).

## Offline support — CONFIRMED (mobile, `services/mobile/src/offline`)
- `book-download.ts`, `book-storage.ts` — cache phrases/content for offline reading.
- `progress-storage.ts` — local reading position.
- `fragment-storage.ts` — offline fragments.
- `sync.ts` — reconciliation on reconnect (NetInfo offline→online triggers `syncOfflineData`).
- Storage backend: `@react-native-async-storage/async-storage` (no SQLite dependency present). **CONFIRMED** from deps.
- Web offline: **INFERRED none** beyond localStorage preferences (no service worker observed).

## Performance-sensitive code — INFERRED
- `phraseAt` is a linear scan over the phrase array on every `timeupdate`. For long books (thousands of phrases) this is O(n) per tick; acceptable at current sizes but a candidate for binary search if phrase counts grow. The code comments explicitly reject binary search due to non-monotonic zero-duration markers — a deliberate correctness-over-speed tradeoff.
- Audio is progressive-streamed MP3 from MinIO via presigned URLs (<2 s start per CLAUDE.md).

## Real-time co-listening — CONFIRMED
"Escucha Juntos" club sessions synchronize playback across members via the Socket.IO gateway (`club-session.gateway.ts`) + web `useClubSession.ts` / `EscuchaJuntosRoom.tsx`. Exact sync protocol **INFERRED**.
