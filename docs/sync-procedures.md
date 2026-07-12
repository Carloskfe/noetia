# Sync Procedures

Operational guide for running and validating Whisper sync maps — free-library titles and author-submitted books.

> **Standard:** `syncCoverage` ≥ **90%**. Below this, phrase highlighting breaks for readers.
> If coverage comes back below 90%, do NOT re-run Whisper blind — follow the decision tree in [`docs/whisper-sync-troubleshooting.md`](whisper-sync-troubleshooting.md) first.

---

## Table of Contents

1. [Running Whisper on Google Colab](#1-running-whisper-on-google-colab)
2. [Adding a Sync Map: Step-by-Step](#2-adding-a-sync-map-step-by-step)
3. [Sync Quality Status](#3-sync-quality-status)

---

## 1. Running Whisper on Google Colab

The production server (8 vCPU, no GPU) is too slow for Whisper. Use Google Colab with a T4 GPU.

**Notebook:** `scripts/whisper-colab.ipynb`

- Runtime: T4 GPU (Colab free tier — 12 h session)
- A regex bug was fixed 2026-06-21 (commit c7dac23) — always pull latest before a new batch
- **Validate early:** spot-check VTTs for the first 1–2 books before letting the full batch run; this caught all-11-broken merges before the rest of a 57-book batch ran

```bash
# Per chapter file — run inside Colab
whisper chapter_01.mp3 --language es --word_timestamps True --output_format vtt
whisper chapter_02.mp3 --language es --word_timestamps True --output_format vtt
```

Name output files with a numeric prefix (`01_prologue.vtt`, `02_chapter.vtt`). The merge tool orders by the first integer it finds in each filename.

---

## 2. Adding a Sync Map: Step-by-Step

Use this after you have per-chapter VTT files for a book currently on `syncSource = 'auto'`.

### Step 1 — Place VTTs in the transcriptions directory

```
transcriptions/
└── Book Title/           ← directory named exactly as the book title
    ├── 01_chapter.vtt
    ├── 02_chapter.vtt
    └── ...
```

### Step 2 — Merge into a single VTT

Run from the repo root (requires ts-node):

```bash
npx ts-node services/api/src/ingestion/merge-transcriptions.ts \
  --dir "transcriptions/Book Title" \
  --out "transcriptions/book-slug.merged.vtt"
```

Stitches all VTTs into one file with adjusted timestamps and 2 s gaps between chapters. Also strips LibriVox announcements via `stripAnnouncement()` — extend patterns in `merge-transcriptions.ts` when new ones surface (see troubleshooting §2).

Verify no announcement noise remains before committing:
```bash
grep -in "librivox\|amara\.org\|le[ií]do por\|traducid[oa] \(al\|por\)\|fin de la secci" \
  transcriptions/book-slug.merged.vtt
```
No output = clean.

### Step 3 — Commit and push

```bash
git add transcriptions/
git commit -m "chore: add Whisper VTT for Book Title"
git push
```

### Step 4 — Copy to server and run alignment

```bash
# On the server
cd /opt/noetia && git pull

# ALWAYS mkdir first — docker cp silently "succeeds" even if destination is missing
docker exec noetia-api-1 mkdir -p /app/transcriptions

# Copy in
docker cp transcriptions/book-slug.merged.vtt noetia-api-1:/app/transcriptions/book-slug.merged.vtt

# Verify
docker exec noetia-api-1 ls -la /app/transcriptions/

# Run alignment
docker compose --env-file .env.production -f docker-compose.server.yml exec -T -e DB_HOST=db api \
  node dist/ingestion/seed-sync-whisper.js \
  --book "Book Title" \
  --transcript /app/transcriptions/book-slug.merged.vtt
```

> **`/app/transcriptions` is not a persistent volume.** Every deploy wipes it. Before copying, confirm the container is stable:
> ```bash
> docker ps -a --format '{{.Names}}\t{{.Status}}' | grep noetia-api
> ```
> Wait for `Up (healthy)` for at least a minute.

### Step 5 — Read the summary and decide

```
Phrases aligned: 2301 / 3485   ← coverage = aligned/total
Exceptions:      1184
Avg confidence:  46.0%
```

- **≥ 90%** → done. Update the status table below and push a `docs:` commit.
- **< 90%** → stop. Read the exception phrase text, then follow [`docs/whisper-sync-troubleshooting.md §11`](whisper-sync-troubleshooting.md#11-decision-tree-for-a-new-book-free-library-or-author-submitted) decision tree. Do not re-run Whisper until the root cause is understood.

---

## 3. Sync Quality Status

*Last audited: **2026-07-12** (post drift-fix re-align of all 76 multi-chapter books; syncCoverage = aligned/total). Standard: `syncCoverage` ≥ 90%.*

### 2026-07-12 re-align audit (drift fix)

The drift fix (merge now offsets each chapter by its **real ffprobed audio duration**, not `last_cue_end + 2s`) was applied to all 76 books and re-aligned on prod. Because coverage = text↔cue matching, the timeline shift left coverage essentially unchanged **except** where the new merge went wrong — which surfaced a bug:

- **Regression found + fixed — Apocalipsis & Salmos.** The audio-id for these two ES Bible books resolved to a **bundled** archive item, so `fetchChapterDurations` returned undersized per-chapter durations → the merge **compressed** the timeline (Apocalipsis 1h25m→9m52s, Salmos 5h20m→1h22m) → alignment collapsed (91.9%→38.5%, 99.96%→25.0%). Fixed by reverting both to their pre-drift gap-based VTTs (`2a5fa86`) and adding a **merge guardrail** (`01d7a21`): a chapter's audio duration can never be shorter than its own last cue; if it is, the durations are rejected and the whole book falls back to gap offsets. **Detection recipe** for future re-merges: compare each merged VTT's last timestamp before/after — a large drop (`ratio < 70%`) means compression.
- **Verified final state (full library, `--all`): 66 PASS · 17 FAIL · 1 no-sync** (84 books). Every one of the 17 fails is already `isFree=false`, so no reader is served broken sync. **No cull was needed.**
  - **Free library grown 57 → 66** (2026-07-12): the 9 books that passed ≥90% but were held back (culled pre-fix, never re-promoted) were promoted via a guarded `UPDATE ... isFree=true` (gated on `syncCoverage ≥ 0.90`): As a Man Thinketh, How to Live on 24 Hours a Day, The Game of Life, The Science of Getting Rich, Up from Slavery (EN); La Edad de Oro, Lazarillo de Tormes, Pepita Jiménez, Platero y yo (ES). Free library is now **66 books, 100% passing ≥90%.**
  - **The Call of the Wild** — the only free-eligible EN book with no VTT (`auto` source); needs a transcription before it can be synced/offered.

**The 18 below 90% (demote), by root-cause class:**

| Book | Cov | Class |
|------|-----|-------|
| Salmos | **99.96%** ✅ (recovered) | was compression regression; reverted VTT + re-aligned 2026-07-12 → 2734/2735, 92% conf |
| Apocalipsis | **100.0%** ✅ (recovered) | was compression regression; reverted VTT + re-aligned 2026-07-12 → 436/436, 95% conf |

> **Cosmetic residual (Salmos, Apocalipsis, Isaías):** Wikisource running-header crumbs `"La Biblia / <Book>"` leak in as ~33%-confidence phrases at chapter boundaries — a reader sees a stray header fragment highlight. Doesn't threaten the gate. Optional `isNavigationNoise` cleanup in the splitter if revisited (§2b/§2c pattern).
| Salmos/Apocalipsis excepted, the genuine fails: | | |
| Orgullo y Prejuicio | 49.4% | partial/abridged ES audio (EN twin Pride & Prejudice passes 93.9%) |
| María | 67.5% | partial/abridged ES audio |
| Cartas a Lucilio | 56.5% | selección — audio covers a subset of the letters |
| El Príncipe | 60.2% | translation mismatch (audio ≠ Wikisource edition) |
| Don Quijote Vol. I / II | 59.4% / 56.9% | phrase-granularity ceiling + edition mismatch (deferred, §8) |
| Meditaciones / Meditations | 50.9% / 45.1% | translation mismatch + verse-number/footnote text noise (both langs) |
| The Art of War | 66.7% | translator commentary/footnotes interleaved (Giles ed.) |
| The Picture of Dorian Gray | 71.6% | edition mismatch — 13-ch magazine audio vs 20-ch book text |
| The Time Machine | 75.6% | low-conf text/edition mismatch |
| Viaje al Centro de la Tierra | 68.6% | edition mismatch (Anónimo vs Ribot y Fonseré) |
| El Sombrero de Tres Picos | 75.6% | text/edition mismatch (28% conf) |
| Rimas | 79.1% | audio is a selección of the Rimas, not all |
| La Odisea | 81.5% | grouped transcription (24 audio vs 19 VTT) + missing Cantos XX–XXIV |
| Fábulas y Verdades | 83.3% | 28 audio sections vs 16 catalogued fables — count mismatch |

**Key cross-language tells this audit confirmed:** when a book fails in one language but its twin passes (Orgullo 49% vs Pride 94%; Salmos-was vs Psalms 99.7%), the fault is that language's **audio/text**, not the aligner. When *both* langs fail (Meditaciones 51% / Meditations 45%), suspect shared **text-structural noise** (verse numbers, footnotes) or a translation both editions diverge from.

---

*Historical audit below predates 2026-07-12 for the drift-fixed books; numbers above are authoritative where they differ.*

*Last audited: 2026-06-29 (post EMA re-align sweep). Standard: `syncCoverage` ≥ 90%.*

Refresh numbers any time with the diagnostic SQL (see troubleshooting §9):

```sql
SELECT b.title,
       sm."syncSource" AS source,
       round((sm."syncCoverage" * 100)::numeric, 1) AS coverage_pct,
       round((sm."syncAvgConfidence" * 100)::numeric, 1) AS confidence_pct,
       sm."syncExceptions" AS exceptions,
       CASE WHEN sm."syncCoverage" >= 0.90 THEN 'PASS' ELSE 'BELOW' END AS status
FROM books b
JOIN sync_maps sm ON sm."bookId" = b.id
ORDER BY coverage_pct ASC NULLS FIRST;
```

Run via:
```bash
docker compose --env-file .env.production -f docker-compose.server.yml exec -T db \
  psql -U noetia -d noetia -c "..."
```

### Spanish Narrative (24 books)

| Book | Coverage | Notes |
|------|----------|-------|
| Niebla | 100.0% ✅ | was 88.0% — EMA re-align sweep 2026-06-29 (§2g); prior "§6 edition mismatch" disproven |
| Doña Perfecta | 99.9% ✅ | was 71.6% — EMA re-align sweep 2026-06-29 (§2g) +28.3% |
| Los Cuatro Jinetes del Apocalipsis | 99.9% ✅ | was 76.4% — EMA re-align sweep 2026-06-29 (§2g) +23.5%; prior "§6 edition mismatch" disproven |
| Crimen y Castigo | 99.8% ✅ | was 72.9% — EMA re-align sweep 2026-06-29 (§2g) +26.9% |
| Marianela | 99.8% ✅ | |
| El Gaucho Martín Fierro | 99.5% ✅ | was 82.4% — EMA re-align sweep 2026-06-29 (§2g) +17.1% |
| Romeo y Julieta | 99.1% ✅ | |
| La Isla del Tesoro | 98.7% ✅ | was 55.4% — EMA re-align sweep 2026-06-29 (§2g) +43.3% |
| Don Juan Tenorio | 98.6% ✅ | |
| Platero y yo | 98.2% ✅ | "Grabado por" pattern + ÍNDICE trim 2026-06-25 — §2/§3 |
| Cuentos de Amor de Locura y de Muerte | 98.0% ✅ | |
| Pepita Jiménez | 96.8% ✅ | announcement patterns 2026-06-24 — §2 |
| La Divina Comedia | 91.4% ✅ | was 66.0% — EMA re-align sweep 2026-06-29 (§2g) +25.4% |
| La Odisea | 81.5% | was 60.6% — EMA sweep +20.9%; **94% conf / 578 exc = audio missing Cantos XX–XXIV**. Only 19 of 24 cantos were ever transcribed (`odisea_19_homero.vtt` ends "Fin del Canto XIX"; text continues to the real ending at Book XXIV). Hard ceiling ~80% until the final 5 cantos are sourced + Whisper-transcribed + re-merged. NOT a text/trim/align fix |
| Leyendas | 81.3% | story-order + 5 excluded chapters — §7 |
| El Sombrero de Tres Picos | 75.0% | low conf (28%), unchanged by EMA sweep — genuine §6 text/edition mismatch |
| Fábulas y Verdades | 83.1% | 16 audio sections vs. 11 catalogued fables — §7 count mismatch (unchanged by EMA sweep) |
| Viaje al Centro de la Tierra | 68.4% | edition mismatch confirmed — Anónimo vs. Ribot y Fonseré (unchanged by EMA sweep, §6) |
| Don Quijote de la Mancha — Vol. I | 59.5% | **DEFERRED** (2026-06-30). Part I/II split + mirror fallback + front-matter inclusion lifted it 52%→59.5% / 25%→42% conf, but it hits a **phrase-granularity ceiling**: ~43-word Cervantes phrases vs ~13-word cues → uniform ~30% conf even on verbatim text. Only aligner phrase-splitter tuning clears it — §8 |
| Don Quijote de la Mancha — Vol. II | 55.6% | **DEFERRED** — shared `gutenbergId: 2000`, split applied; same granularity ceiling as Vol. I expected (front-matter fix not separately re-run). §8 |
| Orgullo y Prejuicio | 49.4% | **94% conf / 2119 exc** — ES audiobook is partial/abridged (EN twin passes at 94%); needs audio-completeness check, NOT re-align |

**15 of 23 ES Narrative at ≥ 90%** (was 8 — the EMA re-align sweep added Niebla, Doña Perfecta, Los Cuatro Jinetes, Crimen y Castigo, El Gaucho Martín Fierro, La Isla del Tesoro, La Divina Comedia). Cuentos de la Selva and Lazarillo de Tormes are ES but tracked elsewhere; Salmos is ES Bible. The remaining 8 below-gate did **not** move on re-align (or need text, not alignment) — see notes.

**Before investigating any < 90% book**, read the troubleshooting guide. The EMA sweep (§2g) already cleared every drift case — what's left is genuine text/edition/audio work. Use the conf/coverage split: high-conf + many exceptions = missing/abridged audio (trim or re-source), not re-alignment.

### Spanish Bible (17 books)

| Book | Coverage | Notes |
|------|----------|-------|
| Efesios | 96.4% ✅ | |
| Santiago | 95.8% ✅ | |
| Filipenses | 93.8% ✅ | |
| Hebreos | 92.4% ✅ | |
| Apocalipsis | 91.9% ✅ | |
| Proverbios | 91.7% ✅ | |
| Marcos | 91.0% ✅ | |
| Romanos | 91.0% ✅ | |
| Lucas | 90.8% ✅ | |
| Génesis | 90.3% ✅ | |
| Hechos | 100.0% ✅ | was 89.8% — Wikisource nav-block fix 2026-06-27 |
| Juan | 99.9% ✅ | was 89.7% — Wikisource nav-block fix 2026-06-27 |
| Éxodo | 100.0% ✅ | was 84.3% — Wikisource nav-block fix 2026-06-27 |
| Mateo | 99.9% ✅ | was 86.0% — Wikisource nav-block fix 2026-06-27 |
| 1 Corintios | 99.8% ✅ | was 82.5% — Wikisource nav-block fix 2026-06-27 |
| Isaías | 99.2% ✅ | was 87.0% — nonlinear-drift EMA aligner fix (§2g) 2026-06-29 +12.2%. "§6 edition mismatch" label fully disproven — real cause was aligner drift, not a translation divergence |
| Salmos | 99.96% ✅ | was 81.1% — §2b Salmos-format nav block ("Salmos de Biblia Reina-Valera, Revisión 1909") fixed 2026-06-27 |

**17 of 17 ES Bible at ≥ 90% — all pass.** Isaías was the last holdout. Its old "§6 edition mismatch (ch. 32–66)" tag was never directly evidenced and is now **fully disproven**: re-aligning with the new EMA drift-correction aligner (§2g) — *no text change, no re-ingest* — took it from 87% straight to 99.2% (1377/1388 aligned, 90% confidence, 11 scattered exceptions). The shortfall was the same nonlinear text↔audio drift that hit Genesis, not a translation divergence (a real ch. 32–66 mismatch would have shown a *contiguous* exception block; the exceptions are scattered single verses). Minor residual: ~30 `"La Biblia / Isaías"` page-header crumbs leak in as low-confidence phrases — cosmetic, doesn't threaten the gate; optional `isNavigationNoise` cleanup if revisited.

### English Narrative (14 books)

| Book | Coverage | Notes |
|------|----------|-------|
| The Strange Case of Dr Jekyll and Mr Hyde | 99.8% ✅ | was 70.2% — EMA re-align sweep 2026-06-29 (§2g) +29.6% |
| Treasure Island | 99.8% ✅ | was 71.3% — EMA re-align sweep 2026-06-29 (§2g) +28.5% |
| Frankenstein | 99.8% ✅ | was 80.5% — EMA re-align sweep 2026-06-29 (§2g) +19.3% |
| Jane Eyre | 99.7% ✅ | was 60.6% — EMA re-align sweep 2026-06-29 (§2g) +39.1% |
| Anne of Green Gables | 99.6% ✅ | was 58.3% — EMA re-align sweep 2026-06-29 (§2g) +41.3% |
| Walden | 99.6% ✅ | was 55.5% — EMA re-align sweep 2026-06-29 (§2g) +44.1% |
| Alice's Adventures in Wonderland | 98.5% ✅ | was 77.3% — EMA re-align sweep 2026-06-29 (§2g) +21.2% |
| Tom Sawyer | 97.4% ✅ | was 64.1% — EMA re-align sweep 2026-06-29 (§2g) +33.3% |
| The Scarlet Letter | 97.4% ✅ | was 65.8% — EMA re-align sweep 2026-06-29 (§2g) +31.6% |
| Dracula | 96.7% ✅ | was 66.5% — EMA re-align sweep 2026-06-29 (§2g) +30.2% |
| Pride and Prejudice | 94.0% ✅ | was 54.7% — EMA re-align sweep 2026-06-29 (§2g) +39.3% |
| The Time Machine | 75.6% | low conf (35%), unchanged by EMA sweep — genuine §6 text/edition mismatch |
| The Picture of Dorian Gray | 71.6% | was 54.5% — EMA sweep +17.1% but stalls at 58% conf; partial mismatch, needs §6 |
| Meditations | 45.4% | translation mismatch (Gutenberg #2680 = George Long); unchanged by EMA sweep |

*(KJV books Matthew, Mark, Luke, John, Revelation moved to the English Bible table below, where they belong.)*

**11 of 14 EN Narrative at ≥ 90%** (was 0 — the EMA re-align sweep 2026-06-29 cleared all of them in one pass). The 3 remaining are genuine text/edition cases the aligner can't fix: The Time Machine and Meditations (low-conf mismatch), Dorian Gray (partial, 58% conf).

**1 EN book with no sync map yet (NULL coverage):** The Call of the Wild — needs a VTT file. (Ephesians, Genesis, Exodus, Philippians now synced — see English Bible table.)

### English Bible (17 books)

| Book | Coverage | Notes |
|------|----------|-------|
| Philippians | 100.0% ✅ | Gap A 2026-06-28 |
| Acts | 100.0% ✅ | |
| Isaiah | 99.9% ✅ | was 87.3% — chapter-argument + nav strip 2026-06-28 +12.6% (§2f) |
| Luke | 99.7% ✅ | was 88.8% — chapter-argument + nav strip 2026-06-28 +10.9% (§2f) |
| Matthew | 99.6% ✅ | was 87.4% — chapter-argument + nav strip 2026-06-28 +12.2% (§2f) |
| Revelation | 99.6% ✅ | was 38.6% — digit-token fix 2026-06-27 +61.0% (§2e) |
| Exodus | 99.3% ✅ | Gap A 2026-06-28 |
| Genesis | 98.8% ✅ | Gap A 2026-06-28 — first align 96.3%/67% conf; nonlinear-drift EMA aligner fix (§2g) → 98.8%/95% conf |
| Ephesians | 98.7% ✅ | Gap A 2026-06-28 |
| Proverbs | 96.3% ✅ | |
| Romans | 95.8% ✅ | |
| 1 Corinthians | 95.4% ✅ | |
| Hebrews | 94.7% ✅ | |
| Psalms | 94.3% ✅ | was 89.0% — Wikisource `[ edit ]` + TOC nav-block fix 2026-06-27 +5.3% |
| James | 93.3% ✅ | |
| John | 91.0% ✅ | was 43.6% — digit-token fix 2026-06-27 +47.4% (§2e) |
| Mark | 90.6% ✅ | was 57.3% — digit-token fix 2026-06-27 +33.3% (§2e) |

**17 of 17 EN Bible at ≥ 90% — all pass.** The digit-token fix (§2e) cleared Revelation, John, and Mark; the chapter-argument + nav strip (§2f) then closed Matthew, Luke, **and Isaiah** — all three carried the same un-narrated per-chapter "argument" summaries. Isaiah's prior "§6 edition mismatch" label was inherited/assumed; re-ingesting with §2f took it to 99.9% (1327/1328 aligned, 96% confidence), so it was apparatus all along, not a real edition divergence. **Gap A (2026-06-28):** Genesis, Exodus, Ephesians, Philippians were the last 4 EN Bible books without sync maps; all now pass. Genesis additionally exposed two reusable bugs — the KJV small-caps `L<span>ORD</span>` token split (§2g) and the nonlinear text↔audio drift that the proportion-only aligner couldn't follow on a 4h book (§2g, EMA drift correction). Note: the Spanish *Isaías* (ES Bible) is a **separate** book — its 87%→99.2% recovery came from the same §2g EMA aligner fix (its "§6 mismatch" tag was also a mislabel), not from KJV-specific markup fixes.

---

*Root-cause categories, diagnostic procedures, and worked examples for every book above: [`docs/whisper-sync-troubleshooting.md`](whisper-sync-troubleshooting.md).*
