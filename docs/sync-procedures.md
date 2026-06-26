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

*Last audited: 2026-06-25. Standard: `syncCoverage` ≥ 90%.*

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

### Spanish (40 books total)

| Status | Count | Books |
|--------|-------|-------|
| Whisper ≥ 90% ✅ | 8 | Marianela 99.8%, Romeo y Julieta 99.1%, Don Juan Tenorio 98.6%, Cuentos de Amor 98.0%, **Cuentos de la Selva 100%** (story-order fix 2026-06-24 — §7), **Lazarillo de Tormes 100%** (Wikisource ordinal-word sort fix 2026-06-25 — §7), **Platero y yo 98.2%** ("Grabado por" pattern + ÍNDICE trim 2026-06-25 — §2/§3), **Pepita Jiménez 96.8%** (announcement patterns 2026-06-24 — §2) |
| Whisper < 90% ❌ | 16 | El Gaucho Martín Fierro 82.4% (stanza-number §4 fix 2026-06-25 — not yet over threshold), Leyendas 80.6% (story-order + 5 excluded chapters — §7), Niebla 88.0%, Fábulas y Verdades 85.3% (16 audio sections vs. 11 catalogued fables — §7 count mismatch), Salmos 81.0% (suspected verse-number gluing §4 — unconfirmed), Los Cuatro Jinetes 76.4% (edition mismatch — §6), El Sombrero de Tres Picos 75.2% (sort fix applied — gap unexplained), Doña Perfecta 71.6% (sort fix applied — gap unexplained), Crimen y Castigo 72.9% (same translator confirmed; root cause unexplained), Orgullo y Prejuicio 64.4% (sort fix correct; flat — unexplained), Viaje al Centro 67.5% (edition mismatch confirmed — Anónimo vs. Ribot y Fonseré), La Divina Comedia 66.0% (front/back-matter trim applied — still needs more), Don Quijote Vol. II 56.4%, Don Quijote Vol. I 54.4% (shared `gutenbergId: 2000` — §8, not yet fixed), La Odisea 60.6% (CRLF glossary fix applied — modest gain only), La Isla del Tesoro 55.4% (sort fix correct; flat — unexplained) |
| Auto sync only | 16 | 16 Bible books (ES) |

**Before investigating any < 90% book**, read the troubleshooting guide. Most have a documented next step — do not assume edition mismatch without ruling out §2-5 and §7-8 first.

### English (31 books total)

30 of 31 on `auto` sync — Whisper not yet run. Next priority: **Jane Eyre** (39 sections).

| Book | Coverage | Notes |
|------|----------|-------|
| Meditations | 45.1% | CRLF appendix bug fixed 2026-06-24. Confidence stuck at 25% — likely translation mismatch (Gutenberg #2680 = George Long; not yet compared to LibriVox reader's edition) |
| Walden | *(not yet run)* | CRLF bug fixed proactively 2026-06-24 |
| All others | *(not yet run)* | |

---

*Root-cause categories, diagnostic procedures, and worked examples for every book above: [`docs/whisper-sync-troubleshooting.md`](whisper-sync-troubleshooting.md).*
