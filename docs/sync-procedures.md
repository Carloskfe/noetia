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
| Niebla | 88.0% | §6 edition mismatch — Gutenberg #49836 diverges from LibriVox recording ~57% through (ch. 20+) |
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

**8 of 23 ES Narrative at ≥ 90%.** (Salmos is categorised as ES Bible — see table below.)

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
| Hechos | 100.0% ✅ | was 89.8% — Wikisource nav-block fix 2026-06-27 |
| Juan | 99.9% ✅ | was 89.7% — Wikisource nav-block fix 2026-06-27 |
| Éxodo | 100.0% ✅ | was 84.3% — Wikisource nav-block fix 2026-06-27 |
| Mateo | 99.9% ✅ | was 86.0% — Wikisource nav-block fix 2026-06-27 |
| 1 Corintios | 99.8% ✅ | was 82.5% — Wikisource nav-block fix 2026-06-27 |
| Isaías | 87.0% | was 76.3% — nav-block fix +10.7%, 180 exceptions remain. "§6 edition mismatch" label **disproven** (see below); true cause still unconfirmed |
| Salmos | 99.96% ✅ | was 81.1% — §2b Salmos-format nav block ("Salmos de Biblia Reina-Valera, Revisión 1909") fixed 2026-06-27 |

**16 of 17 ES Bible at ≥ 90%.** Isaías (87%) is the only holdout. Its old "§6 edition mismatch (ch. 32–66)" tag was **never directly evidenced and is now disproven**: the LibriVox reader's source text is BibleGateway `version=RVA` (Reina-Valera Antigua) vs. our Wikisource RV1909 — but the *passing* books Mateo (99.9%) and Salmos (99.96%) were recorded from that **same RVA edition** against the same RV1909 text, so the RVA↔1909 difference cannot be the cause. Real cause unconfirmed — needs a fresh exception-distribution re-test (contiguous chapter range = real divergence; scattered = apparatus/recording).

### English Narrative (14 books)

| Book | Coverage | Notes |
|------|----------|-------|
| Frankenstein | 80.5% | |
| Alice's Adventures in Wonderland | 77.3% | |
| The Time Machine | 76.1% | |
| Treasure Island | 71.3% | was 55.4% — chapter announcement stripping 2026-06-27 +15.9% |
| The Strange Case of Dr Jekyll and Mr Hyde | 70.2% | first clean align 2026-06-27 |
| Dracula | 66.5% | was 57.4% (lastEndTime bug) → recovered +9.1% after fix 2026-06-27 |
| The Scarlet Letter | 65.8% | |
| The Adventures of Tom Sawyer | 64.1% | was 67.6% — regressed -3.5% after lastEndTime re-merge; needs investigation |
| Jane Eyre | 60.6% | |
| Anne of Green Gables | 58.3% | +1.4% from lastEndTime fix |
| Walden | 55.5% | +1.9% from lastEndTime fix |
| Pride and Prejudice | 54.7% | +1.4% from lastEndTime fix |
| The Picture of Dorian Gray | 54.5% | |
| Meditations | 45.0% | likely translation mismatch (Gutenberg #2680 = George Long) |

*(KJV books Matthew, Mark, Luke, John, Revelation moved to the English Bible table below, where they belong.)*

**0 of 14 EN Narrative at ≥ 90%.** EN chapter announcement stripping helped Treasure Island (+15.9%). The `lastEndTime` fix recovered Dracula (+9.1%) but regressed Tom Sawyer (-3.5%) — see troubleshooting for investigation. Most EN Narrative needs §3-8 investigation.

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

**17 of 17 EN Bible at ≥ 90% — all pass.** The digit-token fix (§2e) cleared Revelation, John, and Mark; the chapter-argument + nav strip (§2f) then closed Matthew, Luke, **and Isaiah** — all three carried the same un-narrated per-chapter "argument" summaries. Isaiah's prior "§6 edition mismatch" label was inherited/assumed; re-ingesting with §2f took it to 99.9% (1327/1328 aligned, 96% confidence), so it was apparatus all along, not a real edition divergence. **Gap A (2026-06-28):** Genesis, Exodus, Ephesians, Philippians were the last 4 EN Bible books without sync maps; all now pass. Genesis additionally exposed two reusable bugs — the KJV small-caps `L<span>ORD</span>` token split (§2g) and the nonlinear text↔audio drift that the proportion-only aligner couldn't follow on a 4h book (§2g, EMA drift correction). Note: the Spanish *Isaías* (ES Bible, 87%) is a **separate** book with a genuine, directly-evidenced §6 mismatch in ch. 32–66 — KJV-specific markup fixes do not apply to it.

---

*Root-cause categories, diagnostic procedures, and worked examples for every book above: [`docs/whisper-sync-troubleshooting.md`](whisper-sync-troubleshooting.md).*
