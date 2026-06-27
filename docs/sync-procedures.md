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

*Last audited: 2026-06-27. Standard: `syncCoverage` ≥ 90%.*

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
| Cuentos de la Selva | 100.0% ✅ | story-order fix 2026-06-24 — §7 |
| Lazarillo de Tormes | 100.0% ✅ | Wikisource ordinal-word sort fix 2026-06-25 — §7 |
| Marianela | 99.8% ✅ | |
| Romeo y Julieta | 99.1% ✅ | |
| Don Juan Tenorio | 98.6% ✅ | |
| Platero y yo | 98.2% ✅ | "Grabado por" pattern + ÍNDICE trim 2026-06-25 — §2/§3 |
| Cuentos de Amor de Locura y de Muerte | 98.0% ✅ | |
| Pepita Jiménez | 96.8% ✅ | announcement patterns 2026-06-24 — §2 |
| Niebla | 88.0% | |
| Fábulas y Verdades | 85.3% | 16 audio sections vs. 11 catalogued fables — §7 count mismatch |
| El Gaucho Martín Fierro | 82.4% | stanza-number fix 2026-06-25 — §4; gap unexplained |
| Leyendas | 80.6% | story-order + 5 excluded chapters — §7 |
| Los Cuatro Jinetes del Apocalipsis | 76.4% | edition mismatch — §6 |
| El Sombrero de Tres Picos | 75.2% | sort fix applied — gap unexplained |
| Crimen y Castigo | 72.9% | same translator confirmed; root cause unexplained |
| Doña Perfecta | 71.6% | sort fix applied — gap unexplained |
| Viaje al Centro de la Tierra | 67.5% | edition mismatch confirmed — Anónimo vs. Ribot y Fonseré |
| La Divina Comedia | 66.0% | front/back-matter trim applied — still needs more |
| Orgullo y Prejuicio | 64.4% | sort fix correct; flat — unexplained |
| La Odisea | 60.6% | CRLF glossary fix applied — modest gain only |
| Don Quijote de la Mancha — Vol. II | 56.4% | shared `gutenbergId: 2000` with Vol. I — §8, not yet fixed |
| La Isla del Tesoro | 55.4% | sort fix correct; flat — unexplained |
| Don Quijote de la Mancha — Vol. I | 54.4% | shared `gutenbergId: 2000` with Vol. II — §8, not yet fixed |
| Salmos | 81.0% | suspected verse-number gluing §4 — unconfirmed |

**8 of 24 ES Narrative at ≥ 90%.**

**Before investigating any < 90% book**, read the troubleshooting guide. Most have a documented next step — do not assume edition mismatch without ruling out §2-5 and §7-8 first.

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
| Hechos | 89.8% | 0.2% below threshold |
| Juan | 89.7% | 0.3% below threshold |
| Salmos | 81.0% | verse-number gluing suspected — §4 |
| Éxodo | 84.3% | |
| 1 Corintios | 82.5% | |
| Mateo | 86.0% | |
| Isaías | 76.3% | |

**10 of 17 ES Bible at ≥ 90%.** Hechos (89.8%) and Juan (89.7%) are on the cusp — re-run after any VTT improvement may tip them over.

### English Narrative (14 books)

> ⚠️ **Numbers below reflect a re-merge on 2026-06-27 that introduced then fixed a `lastEndTime` bug in `merge-transcriptions.ts`** (see troubleshooting §10). Dracula's number is lower than it should be; all 14 books need a clean re-merge and re-align once the fix is confirmed. The Treasure Island win (+15.9%) is real and stable.

| Book | Coverage | Notes |
|------|----------|-------|
| Frankenstein | 80.6% | |
| Alice's Adventures in Wonderland | 77.3% | |
| The Time Machine | 76.1% | |
| Treasure Island | 71.3% | was 55.4% — chapter announcement stripping 2026-06-27 +15.9% |
| The Strange Case of Dr Jekyll and Mr Hyde | 70.2% | re-align pending (file copy failed in batch) |
| The Adventures of Tom Sawyer | 67.6% | |
| The Scarlet Letter | 65.9% | |
| Jane Eyre | 60.5% | |
| Dracula | 57.4% | ⚠️ regressed from 66.1% due to `lastEndTime` bug — re-align pending |
| Mark | 57.3% | chapter stripping did not help — different root cause |
| Anne of Green Gables | 56.9% | |
| The Picture of Dorian Gray | 54.5% | |
| Walden | 53.6% | ingested + aligned 2026-06-26 |
| Pride and Prejudice | 53.3% | |
| Luke | 48.4% | |
| Meditations | 45.1% | likely translation mismatch (Gutenberg #2680 = George Long) |
| Matthew | 44.7% | |
| John | 43.6% | |
| Revelation | 38.6% | |

**0 of 14 EN Narrative at ≥ 90%.** EN chapter announcement stripping (§2b in troubleshooting) helped Treasure Island significantly but the rest of EN Narrative needs §3-8 investigation — announcement stripping alone is not enough.

**5 EN books with no sync map yet (NULL coverage):** Ephesians, The Call of the Wild, Genesis (EN), Exodus (EN), Philippians — need VTT files.

### English Bible (13 books)

| Book | Coverage | Notes |
|------|----------|-------|
| Acts | 100.0% ✅ | |
| Proverbs | 96.3% ✅ | |
| Romans | 95.8% ✅ | |
| 1 Corinthians | 95.4% ✅ | |
| Hebrews | 94.7% ✅ | |
| James | 93.3% ✅ | |
| Psalms | 89.0% | |
| Isaiah | 87.3% | |
| Mark | 57.3% | |
| Luke | 48.4% | chapter stripping applied 2026-06-27 — no gain; investigate §6 |
| Matthew | 44.7% | chapter stripping applied — no gain; investigate §6 |
| John | 43.6% | chapter stripping applied — no gain; investigate §6 |
| Revelation | 38.6% | |

**6 of 13 EN Bible at ≥ 90%.** The Epistles (Acts, Romans, 1 Cor, Hebrews, James, Proverbs) all pass; the Gospels + Revelation remain very low after chapter stripping — root cause is not announcement noise (stripping is now confirmed clean), likely ASR quality or edition differences.

---

*Root-cause categories, diagnostic procedures, and worked examples for every book above: [`docs/whisper-sync-troubleshooting.md`](whisper-sync-troubleshooting.md).*
