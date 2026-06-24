# Whisper Sync Troubleshooting Guide

Reference playbook for diagnosing and fixing low Whisper sync coverage on any
book — free-library titles re-synced from LibriVox, or books received
directly from authors/publishers with their own narration. Use this *after*
following the basic procedure in [`CLAUDE.md` § Adding a Whisper Sync Map for
a Book](../CLAUDE.md#adding-a-whisper-sync-map-for-a-book) — this doc is for
when coverage comes back low and you need to find out why.

**Standard:** Whisper `syncCoverage` ≥ **90%** (raised from 85% — see
[Why 90%](#why-90).

---

## 1. Read the alignment summary first

`seed-sync-whisper.js` prints (and `sync_maps.syncCoverage` /
`syncAvgConfidence` / `syncExceptions` store) everything you need to triage:

```
Phrases aligned: 2301 / 3485   ← coverage = aligned/total
Exceptions:      1184          ← phrases with NO match in audio at all
Avg confidence:  46.0%         ← average match quality of phrases that DID align
```

**The exception phrases are the diagnostic gold.** Always read the actual
text of the first 10-20 exception phrases (printed in the summary, or query
`sync_maps.phrases` for `exception: true` entries). They tell you which bug
category you're dealing with:

| Exception phrase content looks like... | Likely cause | Section |
|---|---|---|
| Typographic legends, "Letras itálicas son denotadas...", translator essays, table-of-contents entries, printer's colophons | **Untrimmed front/back matter** | [§3](#3-untrimmed-frontback-matter) |
| `[Ilustración]`, footnote text, bracketed reference numbers `[220]` | **Scattered in-body noise** | [§4](#4-scattered-illustrations-and-footnotes) |
| Genuine narrative/dialogue scattered evenly throughout the book, not clustered at start/end | **Edition/translation mismatch** | [§6](#6-editiontranslation-mismatch-hardest-to-fix) |
| Low-index exceptions for ALL early chapters of a multi-story collection, looks like a different story than expected | **Story-order mismatch** | [§7](#7-story-order-mismatch-in-multi-piece-collections) |
| Two sibling books (e.g. two volumes) showing identical or near-identical `phrase_count` | **Shared/duplicate source text** | [§8](#8-shareddupliate-source-text-across-volumes) |

If confidence is uniformly low (25-35%) across nearly every aligned phrase,
suspect a **systemic** issue (announcements, encoding) rather than a localized
one — check §2 first regardless of what the exceptions look like.

---

## 2. LibriVox chapter-boundary announcements (fixed generically — keep extending)

**Symptom:** Coverage and confidence both depressed roughly in proportion to
chapter count — books with 8 chapters barely affected, books with 100
chapters hit hard. Confidence stuck in the 25-35% range across the board.

**Root cause:** Every LibriVox chapter recording includes reader-spoken
announcements that exist only in the audio, never in the stored book text:
- Chapter/section boundary: *"Fin del canto primero del infierno."*, *"Capítulo 2 de Don Quijote de Cervantes."*, *"Sección 1 de Fábulas y Verdades."*
- Legal boilerplate: *"Esta es una grabación de LibriVox. Todas las grabaciones de LibriVox están en el dominio público."*
- Reader/translator attribution: *"Leído por Milton Muñoz en Guánica, Puerto Rico."*, *"Traducido por José Jordán de Urríez y Azara."*
- Third-party subtitling credits: *"Subtítulos realizados por la comunidad de Amara.org"*

The aligner (`phrase-aligner.ts`) estimates each phrase's expected audio
position **proportionally**: `wordsSoFar / totalPhraseWords * totalWordSlots`.
Every unstripped announcement adds words to the audio side with zero
counterpart in the text, so the position estimate drifts a little more at
every chapter boundary. With a ±150-word search window, drift eventually
exceeds the window and alignment fails for everything downstream.

**Fix:** `stripAnnouncement()` in
`services/api/src/ingestion/merge-transcriptions.ts` runs on every cue before
merging, and either drops the cue entirely (whole-cue announcement) or strips
a trailing/embedded announcement fragment while keeping real content on
either side. Current pattern coverage (extend this list as new LibriVox
reader conventions surface):

- Any cue containing `librivox` or `amara.org`
- `Fin (del|de la) [optional ordinal words] (capítulo|canto|parte|libro|volumen|sección)...`
- `(Capítulo|Canto|Chapter|Sección) N (de|of)...`
- `traducid[oa] (al|por)...` / `translated by...`
- `Leído por [name].` (embedded anywhere in a cue, not just at boundaries)

**Diagnosing whether this fix already applied:** check whether the merged
`.vtt` still contains any of the patterns above:
```bash
grep -in "librivox\|amara\.org\|le[ií]do por\|traducid[oa] \(al\|por\)\|fin de la secci" transcriptions/<book>.merged.vtt
```
No output = clean. If you find a new announcement phrasing not covered above,
add it to `ANNOUNCEMENT_WHOLE_CUE` / `ANNOUNCEMENT_TRAILING` / `READER_CREDIT`
in `merge-transcriptions.ts`, add a test case, then re-merge and re-sync.

**Caveat — this alone is rarely sufficient.** In a 13-book batch test
(2026-06-24), this fix alone moved coverage by less than 1.5 points for 10 of
11 affected books. It's necessary but usually not sufficient — keep going to
§3 onward.

---

## 3. Untrimmed front/back matter

**Symptom:** Exceptions cluster at low phrase indices (front matter) and/or
high indices (back matter). Real narrative phrases align fine once you get
past the first few hundred / before the last few hundred.

**Root cause:** Gutenberg/Wikisource digitizations include transcriber's
notes, title pages, copyright pages, translator critical essays, and
tables of contents — none of which are narrated. `gutenberg-fetcher.service.ts`
only strips Project Gutenberg's own `*** START/END OF...` boilerplate; it does
**not** know where the actual narrative begins within that.

**Fix:** Set `narrativeStartPattern` / `narrativeEndPattern` on the catalogue
entry (`services/api/src/ingestion/catalogue.ts`). Both are matched via plain
**literal substring `indexOf`** (not regex) in `trimNarrative()`:
```ts
if (startPattern) { const idx = result.indexOf(startPattern); if (idx >= 0) result = result.slice(idx); }
if (endPattern)   { const idx = result.indexOf(endPattern);   if (idx >= 0) result = result.slice(0, idx + endPattern.length); }
```

### Procedure to find the right patterns

1. Fetch the actual source the ingestion pipeline uses:
   ```bash
   curl -sL "https://www.gutenberg.org/cache/epub/<id>/pg<id>.txt" -o /tmp/book.txt
   ```
   (For Wikisource books, fetch each page via
   `https://es.wikisource.org/w/api.php?action=parse&page=<title>&prop=text&format=json&formatversion=2`
   and run it through the same `stripHtml()` logic as
   `wikisource-fetcher.service.ts` — Wikisource pages are usually much
   cleaner than Gutenberg, see §5.)

2. Find the real narrative start — search for the first chapter/canto/part
   heading, but verify it's not ALSO the index/table-of-contents wording
   first:
   ```bash
   grep -n "CANTO\|CAPÍTULO\|PRIMERA PARTE" /tmp/book.txt
   ```
   If the same heading text appears twice (once in an index, once as the
   real heading), **don't anchor on the heading text alone** — `indexOf`
   finds the *first* occurrence, which would be the index. Anchor on a
   verbatim slice of the **opening narrative sentence** instead (guaranteed
   unique), or a multi-word block that includes the heading immediately
   followed by real prose.

3. Find the real narrative end — search backward from Gutenberg's own
   `*** END OF...` marker for the last real sentence before any table of
   contents / colophon / index appears.

4. **CRITICAL: avoid embedded newlines in your pattern (CRLF gotcha).**
   Gutenberg text fetched via `fetch().text()` preserves the source's literal
   line endings — often `\r\n`, not `\n`. If your pattern spans multiple
   lines (e.g. `'CANTO PRIMERO\n\nA la mitad...'`), `indexOf` will silently
   **fail to match** if the real file uses `\r\n`, and the trim will appear
   to do nothing (no error — it just keeps the untrimmed text). **Always
   prefer a single physical line as the pattern** — no embedded `\n` at all.
   Verify with Node directly (not Python — Python's text-mode file reading
   silently normalizes `\r\n` → `\n` and will mask this exact bug):
   ```js
   const raw = require('fs').readFileSync('/tmp/book.txt', 'utf-8');
   console.log('Has CRLF:', raw.includes('\r\n'));
   console.log('Pattern found:', raw.includes('your candidate pattern'));
   ```

5. **Verify the full pipeline before touching the catalogue**, by mirroring
   `stripHeaders()` + `trimNarrative()` + your planned `textPostProcess` in a
   throwaway Node script against the real fetched text. Check:
   - First/last ~100 chars of the result land exactly where expected
   - Any known noise markers (`Ilustración`, footnote brackets, `ÍNDICE`) are
     gone
   - The character count is sane (you'll use this to cross-check the
     production `reIngestText` log line, which prints exact char count)

6. Only then patch `catalogue.ts`, run tests, push, and on the server run
   `seed-reingest-text.js --book "Title"` followed by `seed-sync-whisper.js`.

**Worked example (La Divina Comedia, Gutenberg #57303):** front matter was a
transcriber's note + title pages + a full Francesco De Sanctis critical essay
about Dante; back matter was a complete canto-by-canto table of contents +
printer's colophon. Fix: `narrativeStartPattern: 'CANTO PRIMERO'` (single
token, safe),  `narrativeEndPattern: 'por el Amor que mueve el Sol y las
demás estrellas.'` (the poem's literal last sentence, single line). Result:
coverage 56.0% → 66.0%, confidence 33% → 46%.

**Worked example (Los Cuatro Jinetes del Apocalipsis, Gutenberg #24536):**
front matter was a transcriber's note, title/copyright page, and a full
ÍNDICE listing every part and chapter (with the heading text "PRIMERA PARTE"
appearing twice — once in the index, once as the real heading, which is why
the start pattern anchors on the opening narrative sentence instead). Fix
applied correctly (verified: index gone, real headings appear once each) but
**coverage didn't move** (76.6% → 76.4%) — this book's real problem turned
out to be §6 (edition mismatch), not front/back matter. Don't assume a clean
trim implies a coverage win; verify against the re-synced numbers.

---

## 4. Scattered illustrations and footnotes

**Symptom:** Exceptions/low-confidence phrases scattered evenly throughout
the whole book (not just front/back), each one short and isolated.

**Root cause:** `[Ilustración]` captions and translator footnotes (inline
reference markers like `[220]` plus their definition-block text) appear
throughout digitized 19th/early-20th-century editions and are never narrated.

**Fix:** `textPostProcess` on the catalogue entry, applied *after*
`narrativeStartPattern`/`EndPattern` trimming (confirmed via
`ingestion.service.ts`'s `fetchText()`: trim happens inside the
source-specific fetcher, postProcess runs on the result afterward).

```ts
textPostProcess: (text: string) => {
  // [Ilustración] captions — may span multiple lines
  let cleaned = text.replace(/\[Ilustración[^\[]*?\]/g, '');
  // Footnote definition blocks: "       [220] Los ojos de la Virgen María."
  // — may wrap onto further indented lines before the next blank line
  cleaned = cleaned.replace(/^[ \t]+\[\d+\][^\n]*(\n[ \t]+\S[^\n]*)*\n?/gm, '');
  // Remaining inline footnote reference markers, e.g. "venera,[220] fijos"
  cleaned = cleaned.replace(/\[\d{1,3}\]/g, '');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  return cleaned.trim();
},
```

Count occurrences before writing the regex (`grep -c "Ilustración"`,
`grep -cE "^\s+\[[0-9]+\] "`) so you know whether this is worth doing — a
book with 2 illustrations isn't worth the regex risk; one with 176 (La Divina
Comedia) clearly is.

---

## 5. Wikisource sources are usually already clean

Unlike raw Gutenberg `.txt` dumps, `wikisource-fetcher.service.ts`'s
`stripHtml()` already removes navigation templates, footer templates,
`ws-data` blocks, and `class="notes"` divs, and converts headings to
`##HEADING##` markers. When investigating a Wikisource-sourced book, fetch one
page and run it through `stripHtml()` (copy the function into a throwaway
script) before assuming you need a textPostProcess fix — often you don't.
The one defect found so far in this category: a decorative drop-cap initial
letter rendered as an image gets stripped along with its containing tag,
sometimes eating the first letter of the opening word (e.g. "abía una vez"
instead of "Había una vez") — cosmetic, costs at most one phrase per
occurrence, not worth fixing.

---

## 6. Edition/translation mismatch (hardest to fix)

**Symptom:** Front/back matter and scattered noise are confirmed clean (you
did §3-5 and verified zero residual noise), but coverage still doesn't move,
and the exception phrases are **genuine, well-formed narrative content**
scattered evenly throughout the book — not clustered, not malformed.

**Root cause:** The specific digitization (Gutenberg/Wikisource edition) and
the specific LibriVox recording were translated/transcribed independently and
simply use different wording, different paragraph breaks, or are different
editions entirely (common for classics with multiple public-domain Spanish
translations — Dante, Cervantes, Dostoyevsky all have several).

**This is NOT generically fixable by code changes.** The only real fixes are:
1. Find the LibriVox page's `url_text_source` (usually listed on the
   LibriVox catalog page) and check which edition/translation the reader
   actually used — try to source that exact text instead.
2. Accept the book as `auto` sync (no phrase-level highlighting) rather than
   shipping a broken `whisper` sync map.
3. If no matching public-domain text exists, this book may simply not be a
   good candidate for phrase-level sync until a different recording exists.

**Confirmed cases (as of 2026-06-24):** Crimen y Castigo, La Odisea, Los
Cuatro Jinetes del Apocalipsis, Viaje al Centro de la Tierra. Don't re-attempt
the noise-stripping fixes on these without first re-verifying §3-5 are
already clean — they are, for at least Cuatro Jinetes (verified directly).

---

## 7. Story-order mismatch in multi-piece collections

**Symptom:** A book ingested via `wikisourceTitles: [...]` (multiple
separate Wikisource pages concatenated into one text, e.g. a short-story or
fable collection) shows poor coverage despite each individual page being
clean. This is a **different bug class** from everything above — much more
severe, and much higher value to check first for any multi-piece book.

**Root cause:** `wikisourceTitles` arrays are typically populated in
publication order. The LibriVox recording's chapter order is **unrelated**
to publication order and can be completely different. If the text is
concatenated in the wrong order, the aligner is comparing entirely different
stories against each other from the very first phrase — catastrophic, not a
gradual drift.

**Diagnosis — always check this FIRST for any multi-piece collection:**
```bash
for f in "transcriptions-source-dir"/*.vtt; do
  echo "=== $(basename "$f") ==="
  head -5 "$f" | grep -v "^WEBVTT\|^00:\|^$" | head -1
done
```
Each chapter file's first spoken line is almost always the reader announcing
the story/poem title (e.g. *"La abeja haragana de cuentos de la selva por
Horacio Quiroga"*). Compare this sequence against the `wikisourceTitles`
array order. If they don't match 1:1, that's the bug.

**Fix:** Reorder `wikisourceTitles` to match the confirmed audio sequence
exactly. No textPostProcess or trim pattern needed — `fetchMultiple()`
concatenates in array order, so reordering the array is the entire fix.

**Worked example (Cuentos de la Selva):** catalogue listed stories in their
usual published order (`La tortuga gigante` first); the LibriVox recording's
actual chapter 1 is `La abeja haragana` (catalogue's story #5). Every single
story was being aligned against the wrong audio. Fix: reorder the array to
match. **Result: 71.5% → 100% coverage, 28% → 96% confidence, zero
exceptions.** This was the single highest-impact fix found in this entire
investigation — always check this first for any multi-piece book.

**Caveat — not every multi-piece mismatch is this clean.** Fábulas y
Verdades (Rafael Pombo, 11 catalogued fables) has a LibriVox recording split
into 16 generic *"Sección N"* announcements that don't name the fable —
count mismatch (16 audio sections vs. 11 catalogued texts) suggests the
recording may cover a larger/different edition than what's catalogued. This
requires actually listening to or transcribing each section to identify
which fable(s) it contains — a much bigger task. Since this book was already
passing the (old 85%) threshold, it was left alone rather than risk
regressing a working sync. Re-evaluate under the new 90% threshold.

---

## 8. Shared/duplicate source text across volumes

**Symptom:** Two sibling books (e.g. two volumes of the same work) show
**identical or near-identical `phrase_count`** in the diagnostic query (§9),
and both cap out around 50% coverage.

**Root cause:** Both catalogue entries point at the same `gutenbergId`
because Project Gutenberg often hosts a multi-volume classic as a single
combined ebook. Each volume's ingestion fetches the *same* full combined
text, so each volume's audio (which only covers its own half of the story)
is being aligned against the *entire* combined text — coverage caps at ~50%
by construction, no amount of re-running Whisper fixes this.

**Confirmed case:** Don Quijote Vol. I and Vol. II both use
`gutenbergId: 2000` (catalogue.ts lines ~216-231). Both sit at ~54-56%
coverage, consistent with each volume's audio covering roughly half of the
combined text. **Not yet fixed** — requires either finding separate
Gutenberg IDs for each volume, or splitting Gutenberg #2000's text by volume
boundary and using `narrativeStartPattern`/`EndPattern` per catalogue entry
to slice out just that volume's portion.

---

## 9. Diagnostic SQL — coverage report across a batch

```sql
SELECT
  b.title,
  sm."syncSource" AS source,
  round((sm."syncCoverage" * 100)::numeric, 1) AS coverage_pct,
  round((sm."syncAvgConfidence" * 100)::numeric, 1) AS confidence_pct,
  sm."syncExceptions" AS exceptions,
  jsonb_array_length(sm.phrases) AS phrase_count,
  CASE WHEN sm."syncCoverage" >= 0.90 THEN 'PASS' ELSE 'BELOW THRESHOLD' END AS status
FROM books b
JOIN sync_maps sm ON sm."bookId" = b.id
WHERE b.title IN ('Title 1', 'Title 2', ...)
ORDER BY coverage_pct ASC NULLS FIRST;
```

Run via:
```bash
docker compose --env-file .env.production -f docker-compose.server.yml exec -T db \
  psql -U noetia -d noetia -c "..."
```

A near-identical `phrase_count` between two different books is itself a
diagnostic signal (§8) — check it even when not actively debugging.

---

## 10. Operational gotchas (server-side)

These aren't sync-quality bugs, but will burn an hour if you don't know them:

- **`docker cp` into a non-existent destination directory silently
  "succeeds" without writing anything.** It prints `Successfully copied X
  (transferred Y)` based on bytes sent over the wire, not confirmed
  server-side extraction — the real error (`Could not find the file
  /app/transcriptions in container...` / `io: read/write on closed pipe`) is
  easy to miss in a busy terminal. **Always run
  `docker exec <container> mkdir -p /app/transcriptions` before `docker cp`,
  every time**, and verify with `docker exec <container> ls -la
  /app/transcriptions/` afterward — don't trust the "Successfully copied"
  message alone.

- **`/app/transcriptions` is not a persistent volume.** Every deploy
  (`docker compose up -d --build`, triggered automatically by any push to
  `main`) recreates the `api` container from scratch, wiping anything
  manually `docker cp`'d in. If you push a fix and then immediately try to
  copy a transcript in, you're racing the auto-deploy — the copy can land in
  a container that's about to be destroyed. **Always check container
  stability before copying:**
  ```bash
  docker ps -a --format '{{.Names}}\t{{.Status}}' | grep noetia-api
  ```
  Wait for `Up` + `(healthy)` for at least a minute (not `health: starting`,
  not freshly recreated) before copying files in or running alignment.

- **Validate on one small book before batching.** Every fix in this guide
  was validated on a single book first (Platero y yo for the original
  regex fix; La Divina Comedia for front/back-matter trimming; Cuentos de la
  Selva for the story-order bug) before being applied across a batch. This
  caught the CRLF pattern-matching bug (§3) before it shipped silently
  broken to 12 books.

---

## 11. Decision tree for a new book (free library OR author-submitted)

1. Run `seed-sync-whisper.js` once, read the summary (§1).
2. Coverage/confidence uniformly low across the board, scales with chapter
   count? → §2 (announcements). Check residual noise with the grep command;
   extend patterns if you find a new phrasing.
3. Multi-piece collection (`wikisourceTitles` with 2+ entries)? → **Check §7
   FIRST**, before anything else. Highest ROI fix in this entire guide.
4. Exceptions clustered at low/high phrase indices? → §3 (front/back matter).
   Fetch the real source, find genuine start/end anchors, watch for the CRLF
   trap, verify with a throwaway script before touching the catalogue.
5. Exceptions scattered but each isolated/short, illustration or
   footnote-shaped? → §4.
6. Two sibling volumes with suspiciously similar phrase counts? → §8.
7. Did all of the above, residual noise confirmed zero, and exceptions are
   still genuine scattered narrative? → §6 (edition mismatch) — this is a
   sourcing problem, not a code problem. Flag it and move on; don't keep
   tuning regexes against a book whose underlying text is simply a different
   edition than the audio.

For **author/publisher-submitted books**, the same diagnostic tree applies,
but skip straight to whichever section matches what their narration actually
sounds like — author-submitted audio won't have LibriVox boilerplate (§2),
but may have studio/producer announcements with their own conventions worth
adding to the pattern list, and is far less likely to have edition-mismatch
issues (§6) since the author controls both the text and the narration.

---

## <a name="why-90"></a>Why 90%, not 85%

Raised from 85% on 2026-06-24 after this investigation showed that most
books in the 70-85% range turned out to have a clearly identifiable,
fixable root cause (not just noise near the margin) — meaning 85% was
masking fixable problems rather than representing a true ceiling. 90% sets a
higher bar that better separates "genuinely well-aligned" from "good enough
to pass the old bar by accident." Re-audit any book currently passing in the
85-90% range under the new standard (see `CLAUDE.md` § Sync Quality Status).
