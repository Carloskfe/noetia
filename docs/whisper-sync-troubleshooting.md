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

**Caveat — coverage depends entirely on whether your pattern list actually
covers that book's reader's vocabulary.** In a 13-book batch test
(2026-06-24) using only the original pattern set (capítulo/canto/parte/
volumen, librivox, traducido), this fix moved coverage by less than 1.5
points for 10 of 11 affected books — not because announcements weren't the
problem, but because the pattern list was incomplete (missing "sección",
reader-credit lines, Amara.org subtitling credits). Once those patterns were
added (same day), **re-testing Pepita Jiménez alone — no other change —
jumped coverage from 71.1% to 96.8% and confidence from 54% to 95%.** The
takeaway: don't conclude "announcements aren't the problem for this book"
until you've confirmed §2's residual-noise grep is clean. If it isn't, fix
the pattern gap before moving on to §3-8.

### §2b. English LibriVox chapter announcements (different pattern vocabulary)

English LibriVox readers use a completely different announcement vocabulary
from Spanish readers. The ES patterns above do **not** help EN books at all.

**Five distinct EN announcement shapes (all added 2026-06-27):**

1. **Standalone chapter heading as its own cue** — "CHAPTER ONE", "CHAPTER XIV." — dropped entirely if the remainder after stripping the chapter marker is empty or all-caps (chapter title with no real prose). Pattern: `CHAPTER_HEADING_PREFIX`.

2. **Chapter heading prefix before real prose** — "Chapter VII My first quarter at Lowood…" — strip the prefix, keep the sentence if it has lowercase letters. If the remainder is all-caps (e.g., "MENA HARKER'S JOURNAL"), keep the entire original cue intact — that all-caps text IS in the book as a chapter title and should align. Dropping it causes a measurable regression (see `lastEndTime` bug note in §10).

3. **Inline chapter marker after a period** — "peace. Chapter 8. And it came to pass…" → replace `. Chapter 8.` with `. `. Pattern: `CHAPTER_INLINE` (`/\.\s+[Cc]hapters?\s+[IVXLCDMivxlcdm0-9]+[.,]?\s+/g`).

4. **Arabic-numeral inline without preceding period** — "chapter 15 I am the true vine…" → strip "chapter 15 ". Pattern: `CHAPTER_DIGIT_INLINE` (`/\bchapter\s+\d+\s+/gi`).

5. **Trailing chapter marker at end of real sentence** — "…made whole. CHAPTER XIV" — strip the trailer. Pattern: `CHAPTER_TRAILING` (`/[.,?!]\s+CHAPTERS?\s+...[.,]?$/i`).

**Gospel/KJV-specific patterns also added:**
- `The Gospel of Mark` / `The Gospel According to Luke` → drop whole cue
- `King James Version` / `King James' Version` → drop whole cue
- `[BookName] chapter N` → drop (e.g. "John chapter 11", "Matthew chapter 5")
- `In the Authorized Version` → drop

**Verify EN noise is clean with:**
```bash
grep -in "chapter [ivx0-9]\|king james\|gospel of\|authorized version\|recording by\|read by\|as read by" transcriptions/<book>.merged.vtt | head -20
```

**Results from the 2026-06-27 batch (27 EN books re-merged + `lastEndTime` fix applied):**
| Book | Before | Final | Notes |
|------|--------|-------|-------|
| Treasure Island | 55.4% | **71.3%** | +15.9% — biggest EN win; chapter announcement stripping |
| Dracula | 66.1% | **66.5%** | net +0.4% — regressed to 57.4% from `lastEndTime` bug then recovered |
| Walden | ~54% | 55.5% | +1.9% from `lastEndTime` fix |
| Pride and Prejudice | 53.3% | 54.7% | +1.4% from `lastEndTime` fix |
| Anne of Green Gables | 56.9% | 58.3% | +1.4% from `lastEndTime` fix |
| The Adventures of Tom Sawyer | 67.2% | 64.1% | **−3.1% net** — +0.4% from stripping, −3.5% from `lastEndTime` fix (see §10) |
| Frankenstein | 80.5% | 80.5% | negligible change |
| Most other EN Narrative | varies | ~same | chapter stripping + `lastEndTime` fix combined < ±0.2% |
| EN Epistles (Acts, Romans, etc.) | already passing | unchanged | no chapter intros to strip |
| EN Gospels (Matthew, Mark, Luke, John, Revelation) | 38-57% | 38-57% | stripping did not help — different root cause |

**EN Narrative root-cause is NOT fully explained by announcements.** After clean stripping, coverage on most EN novels is still 50-80%, not 90%+. Run the decision tree (§11) against exception phrases before assuming more pattern work will help.

**Critical implementation rule — do not drop all-caps chapter-title remainders.** The current `CHAPTER_HEADING_PREFIX` logic keeps the remainder if it has ANY lowercase letter, and drops if it's empty OR all-caps. The all-caps case should be KEPT (not dropped), because Victorian novel chapter titles like "JONATHAN HARKER'S JOURNAL" or "MENA HARKER'S JOURNAL" ARE in the book text and serve as valid alignment anchors. Dropping them loses those alignment points and reduces coverage. If you ever revisit this logic, test against Dracula before shipping.

**Worked example (Pepita Jiménez, Gutenberg #17223):** front/back matter and
illustrations/footnotes were already confirmed clean (this book has almost
none). The residual problem was entirely missed announcement vocabulary:
*"Fin de la sección 22. Fin de Pepita Jiménez. De Juan Valera."* and
*"Leído por Luje Calderón."* embedded mid-cue. Adding `secci[oó]n` to the
chapter-noun pattern list and a dedicated `READER_CREDIT` regex for "Leído
por [name]." fixed it completely — no catalogue/text changes needed at all.

**Counter-example — don't assume the fix is universal.** Re-tested Platero y
yo and Orgullo y Prejuicio (different books, different LibriVox readers)
with the same extended pattern set: **zero change for either** (Platero y
yo stayed at 89.0%/94% confidence, Orgullo y Prejuicio at 65.0%/27%
confidence — both confirmed clean of residual announcement noise via the
grep in this section). Announcement vocabulary is per-reader, not universal
— a pattern extension that fixes one book may do nothing for the next one.
Always confirm with the residual-noise grep before assuming a re-test is
worth running; if it's already clean, the bottleneck is elsewhere (§3-8).
Platero y yo specifically is now only 1 point under threshold and never had
its exception phrases inspected — likely a quick front/back-matter win
(§3), not yet investigated. Orgullo y Prejuicio's confidence (27%) staying
flat alongside zero coverage change suggests something more systemic,
possibly §6.

**§2c — Wikisource Bible chapter-navigation block (Reina-Valera, KJV, and likely others)**

**Symptom:** ES Bible books (Hechos, Juan, Mateo, etc.) have many exceptions. Each chapter in the Wikisource Reina-Valera source includes a chapter-list navbox at the top of the page, rendered as:

```
Biblia Reina-Valera, Revisión 1909 : Hechos
1 -
2 -
...
28
```

This entire block arrives as one paragraph and becomes one phrase that never aligns. For a 28-chapter book, that's 28 wasted exceptions. **Hechos went from 89.8% → 100.0% and Juan from 89.7% → 99.9% after stripping this pattern** (2026-06-27).

**Fix:** `isNavigationNoise()` in `phrase-splitter.service.ts` strips any block matching `/Biblia\s+Reina-Valera[^\n]*Revisión/i`. No VTT change needed — just re-align.

**Two Wikisource formats exist (both now caught):**
- `"Biblia Reina-Valera, Revisión 1909 : Hechos\n1 -\n2 -\n..."` — book name after colon (most NT books)
- `"Salmos de Biblia Reina-Valera, Revisión 1909\n1 -\n2 -\n..."` — book name before "de Biblia" (Salmos; possibly other OT books)

The original regex had a `^` anchor so only the first format was caught. Removing `^` catches both. **Salmos went from 81.1% → 99.96%** after this second fix (2026-06-27).

**Status as of 2026-06-27:** All 16 of 17 ES Bible books at ≥ 90%. Isaías (87%) is the remaining holdout — §6 edition mismatch in Wikisource chapters 32–66, not a nav-block issue.

**Secondary noise — `"La Biblia\n[BookName]"` headers:** Each chapter page also includes a low-level page-title header "La Biblia / Juan" (rendered as `La Biblia\nJuan`). These DO align (at ~33% confidence) so they don't cause exceptions — but they inflate the total phrase count and drag down avg confidence. Not worth fixing until books are otherwise at 90%+.

**§2d — Wikisource KJV editorial/navigation noise (English Bible)**

**Symptom:** EN KJV books have many exceptions that are not announcement noise (which `merge-transcriptions.ts` already strips) but editorial artifacts leaked from the heavily-annotated English Wikisource KJV edition. For Psalms, `[ edit ]` section-edit links alone were ~150 of ~300 exceptions.

**Distinct noise shapes (all stripped in `isNavigationNoise()`, `phrase-splitter.service.ts`, 2026-06-27):**
- `[ edit ]` — inline section-edit links leaked as their own phrase → `/^\[\s*edit\s*\]$/i`
- `↑ r ch. 16. 21. & 20. 17. Mark 8. 31. ...` — cross-reference footnote blocks → `/^↑\s*[a-z]\b/i`
- `Anno DOMINI ...` — editorial year annotations → `/^Anno DOMINI\b/i`
- `(Upload an image ...)` — placeholder text → `/^\(Upload an image\b/i`
- OT/NT/Deuterocanon table-of-contents book lists (Genesis…Exodus…Leviticus; Matthew…Mark…Luke…John…Acts; 1 Esdras…2 Esdras…Tobit) → three `\b…\b.*\b…\b` sequence patterns

**Result: Psalms 89.0% → 94.3% (+5.3%)** — clears the 90% gate. No VTT change needed, just re-align.

**Did NOT help the Gospels** — but a different fix did. These nav-block filters left Matthew (44.7%), Mark (57.3%), Luke (48.4%), John (43.6%), Revelation (38.6%) untouched because their bottleneck was embedded marginal verse/cross-reference numbers fused into prose (e.g. `"2 4 Abraham begat... and 5 Isaac begat..."`, `"23 704 Then..."`). That turned out to be an alignment-scoring problem, not a text problem — see §2e.

**§2e — Verse/marginal-reference numbers sink KJV alignment scores (English Bible)**

**Symptom:** The KJV Gospels + Revelation aligned at 38–57% despite clean announcement/nav stripping (§2b, §2d). Exception phrases were ordinary verses that clearly ARE read aloud.

**Root cause — the alignment tokenizer, not the text.** The Wikisource KJV edition embeds verse numbers and marginal cross-reference numbers inline:
```
2 4 Abraham begat Isaac; and 5 Isaac begat Jacob; and 6 Jacob begat Judas...
23 704 Then said Mary...
```
LibriVox readers speak none of these digits. `normalizeWord()` in `phrase-aligner.ts` kept `[a-z0-9]`, so every number became a token that could only miss. Scoring is `matches / n`, and in Matthew **~20% of all tokens were pure digits** — inflating every verse's denominator and pushing it under `SKIP_THRESHOLD` (0.20).

**Fix:** `tokenize()` now drops pure-digit tokens (`/^\d+$/`). Alignment-only — the stored/displayed `phrase.text` is untouched, so **no re-ingest is needed, just re-align**. A smaller denominator can only raise scores, so already-passing books cannot regress. Mixed alphanumerics (`2nd`) and Roman numerals are preserved.

**Results (2026-06-27, re-align only):**
| Book | Before | After | Δ |
|------|--------|-------|---|
| Revelation | 38.6% | **99.6%** | +61.0 |
| John | 43.6% | **91.0%** | +47.4 |
| Mark | 57.3% | **90.6%** | +33.3 |
| Luke | 48.4% | 88.8% | +40.4 |
| Matthew | 44.7% | 87.4% | +42.7 |

3 of 5 now pass. **Luke and Matthew remain ~1–2% short** — their residual is unspoken `‖`-marked marginal notes (e.g. `‖ ‖ Or, his name shall be called .`) and running chronology headers (`The Fifth Year before the Common Account called Anno Dom.`). These are real *words*, not numbers, so the tokenizer can't drop them; closing the gap would need a text-level clean that strips `‖ … ` note spans during ingestion. Not pursued yet — both books are already past the practical reading threshold and the free library is not a priority surface (see CLAUDE.md product hierarchy).

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

   **This bug was silently shipping in production before this guide
   existed.** Auditing every `narrativeStartPattern`/`narrativeEndPattern`
   in `catalogue.ts` on 2026-06-24 found 4 pre-existing entries broken this
   exact way — all written before the CRLF issue was understood:
   - **La Odisea**: `'\nFIN\n'` never matched → the entire ~276,000-character,
     1700-entry glossary had been attached to the stored text the whole
     time. Fixed to `'FIN'` (confirmed unique, no embedded newline).
   - **Niebla**: `'\nPRÓLOGO\n'` never matched → ~800 chars of title
     page/transcriber's note left attached. Fixed by anchoring on the real
     opening sentence instead (the bare word "PRÓLOGO" also isn't safe —
     it appears 4 more times: once on the title page, twice in a
     back-of-book table of contents).
   - **Meditations**: `'\nAPPENDIX\n'` never matched. Also wouldn't have
     been safe even fixed naively — "APPENDIX" appears in a front-of-book
     table of contents before the real appendix heading. Fixed by anchoring
     on the real closing sentence of Book Twelve instead.
   - **Walden** (not yet Whisper-attempted): same pattern, same fix
     approach, applied proactively before anyone hits it.

   **Takeaway: if you inherit a catalogue entry with a multi-line pattern,
   don't trust it — verify it actually matches the live source before
   assuming the trim is working,** even for books that already look
   "handled." A passing-looking coverage number doesn't prove the trim
   fired; it might be passing *despite* an inert trim, with a much higher
   score available once it's fixed (La Odisea's case).

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

### Standalone verse/stanza/line numbers (verse poetry only)

**Symptom:** A numbered-verse poem (each stanza prefixed with its number,
e.g. "392") shows widespread low-confidence exceptions even with clean
front/back matter.

**Root cause:** `phrase-splitter.service.ts`'s `isHeading()` recognizes
standalone Roman numerals but not Arabic digits, so a bare number line
isn't filtered out as a heading. **Whether it becomes its own failing
phrase or gets silently glued onto the next sentence depends on the
exact whitespace**: La Odisea's Greek line numbers are followed by a
*space* on the same line ("1 Háblame") — already handled by
`cleaned.replace(/^\d{1,4} /gm, '')`. El Gaucho Martín Fierro's stanza
numbers are followed by a *newline*, no blank line ("392\nY cuando..."),
which that regex does NOT match (no space character) — the number stays
glued as a prefix to the next sentence, guaranteed to never align since
the reader doesn't speak "trescientos noventa y dos" aloud.

**Fix:** match the actual whitespace structure, don't assume it's the same
as a previously-fixed book:
```ts
textPostProcess: (text: string) => text.replace(/^\d{1,3}\r?\n/gm, ''),
```

**Worked example (El Gaucho Martín Fierro):** 395 standalone stanza
numbers, confirmed via `raw.match(/^\d{1,3}\r?\n/gm)` before writing the
fix. **Result: 55.4% → 82.4% coverage** — the single largest contributor
found for this book, bigger than the Wikisource-sort fixes in §7.

**Suspected but not yet confirmed: Salmos** (Reina-Valera Psalms,
Wikisource). Re-tested with the Grabado-por pattern alone (§2) and stayed
flat at ~81% with confidence stuck at 30% — the same symptom profile.
Bible chapter:verse numbering is exactly the kind of standalone-number
structure this section describes; not yet inspected for the exact
whitespace pattern.

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

**Best diagnostic — check the translator credit on both sides directly,
don't just infer from exception content.** The LibriVox chapter
announcements usually state the translator by name (*"traducido por
[Name]"*); compare that against whatever your Gutenberg/Wikisource source
states. **Worked example (Viaje al Centro de la Tierra):** the Wikisource
page's own metadata says `traducción de Anónimo`, while every LibriVox
chapter explicitly credits *"traducido por Antonio Ribot y Fonseré"* — two
different translators, confirmed directly, not inferred. This is much
stronger evidence than "the exceptions look like real prose."

**Caveat — a matching translator doesn't guarantee the book is fixable.**
Crimen y Castigo's Gutenberg text and its LibriVox recording **both**
credit the exact same translator (*"Pedro Pedraza y Páez"*), yet after
confirming front/back matter and footnotes were already clean (§3-5
verified, fixed 2026-06-24) and re-syncing, coverage didn't move at all
(73.0% → 72.9%). Possible explanations not yet investigated: different
print editions of the same translation, an abridged/revised edition, or
ASR transcription quality specific to this LibriVox reader. Don't assume
"same translator named" settles the question — it rules out the easy case
but the book can still be stuck for an unexplained reason.

**Status as of 2026-06-24:**
- **Confirmed via direct evidence** (mismatched translator credit): Viaje
  al Centro de la Tierra.
- **Confirmed clean of noise, root cause still unexplained**: Crimen y
  Castigo (translator matches — see caveat above), Los Cuatro Jinetes del
  Apocalipsis (exceptions are genuine scattered narrative, translator
  credit not yet checked).
- **Partially improved, not yet explained**: La Odisea (CRLF-bug glossary
  fix gave +2pts; remaining gap may be the archaic 1910 Spanish your notes
  already flagged, or an undetected translator mismatch — not yet
  checked), Meditations (CRLF-bug appendix fix gave +2.5pts; confidence
  stuck flat at 25%, translator not yet checked against the English
  LibriVox reader).

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

**Worked example #2 — extra unmatched chapters, not just wrong order
(Leyendas, Gustavo Adolfo Bécquer):** the LibriVox "Leyendas" recording has
**21 chapters**, but the catalogue only lists 16 legends. Checking each
chapter's spoken title announcement revealed 5 chapters are *other* Bécquer
works not in this catalogue entry at all — *"Es raro"*, *"La Arquitectura
Árabe en Toledo"*, *"La creación"*, *"Las hojas secas"*, *"3 fechas"*
(likely Rimas/poems or prose essays, scattered between the legends, not
clustered at start/end like front/back matter). Reordering alone isn't
enough here — the 5 unmatched chapter **files** must be excluded from the
merge entirely (copy the valid subset into a clean directory before running
`merge-transcriptions.ts`; the tool has no include/exclude-file flag), in
addition to reordering `wikisourceTitles` to match the remaining 16 chapters'
confirmed sequence. **Always count audio chapters against catalogued titles
first** — a count mismatch (here 21 vs. 16) is the tell that you need
exclusion, not just reordering.

This investigation also surfaced a §2 gap: a reader-credit line Whisper
segmented across 3 cues (*"Leído por Gabriela Cahuen en Kingston,"* /
*"Ontario,"* / *"Canadá."*) had no period in the first cue, so the
substring-based `READER_CREDIT` strip didn't catch it. Added a whole-cue
pattern (`/^le[ií]do por\b/i`) to drop any cue that *starts* with "Leído
por" regardless of whether it ends with a period in that same cue — the
two trailing fragments ("Ontario," / "Canadá.") are left as harmless orphan
exceptions (2 phrases, negligible).

**Result: 58.8% → 80.6% coverage, 71.0% confidence.** A big improvement,
but not yet over threshold (1,703/2,112 aligned, 406 exceptions) — the
remaining gap hasn't been investigated yet (next step: inspect the
exception phrases the same way as §6 to see whether it's residual noise
or a genuine edition mismatch for one or more of the 16 legends).

### §7 continued: this bug class also lives in the ingestion CODE, not just catalogue data

Everything above is about `wikisourceTitles` array ordering (catalogue
data). A **separate, more dangerous version of the same bug lives inside
`wikisource-fetcher.service.ts` itself** — `listSubpages()`'s chapter
sort, used for every book with a single `wikisourceTitle` and
auto-detected numbered subpages (Viaje al Centro's "Capítulo N" pattern
is one example that already worked). Confirmed broken for two other
numbering conventions on 2026-06-25:

- **Roman numerals** ("I", "II", "IX"...): the sort only recognized
  Arabic-digit suffixes; Roman numerals fell through to alphabetical
  string sort, which is wrong for anything past III — "IX" sorts before
  "V", "XIX" sorts before "XV". Affected **La Isla del Tesoro** (34
  chapters), **Doña Perfecta** (33), and, combined with a prefix
  ("Capítulo I", "Capítulo IX"...), **El Sombrero de Tres Picos** (37)
  and **Orgullo y Prejuicio** (61).
- **Spelled-out Spanish ordinal words** ("Tratado primero", "Tratado
  segundo", "Tratado cuarto"...): not numerals at all, no chance of
  matching either numeral pattern. Affected **Lazarillo de Tormes** (8
  subpages: Prólogo + 7 Tratados, sorted as cuarto/primero/quinto/
  segundo/sexto/séptimo/tercero — completely scrambled).
- **Un-numbered front/back-matter subpages** ("Prefacio", "Índice"...):
  match no pattern at all, so plain alphabetical sort places them
  wherever their first letter happens to fall — "Prefacio" (P) sorts
  *after* "Capítulo XXXVI" (C), appending the preface at the very END of
  the book. Affected **El Sombrero de Tres Picos**.

Fixed by adding `romanToInt()` (strict regex, validated subtractive
notation), a small Spanish-ordinal-word lookup table (1st-30th), and a
front/back-matter keyword list, all feeding a single
`extractTrailingNumber()` / `frontOrBackMatterRank()` pair used by the
sort comparator. See `wikisource-fetcher.service.ts` and its test file
for the full pattern catalog — extend both when a new numbering
convention surfaces.

**Diagnosing this for a new book:** query the live Wikisource API
directly rather than guessing:
```bash
curl -s "https://es.wikisource.org/w/api.php?action=parse&page=<URL-encoded title>&prop=links&format=json&formatversion=2" \
  -H 'User-Agent: Noetia-Ingestion/1.0' | python3 -c "
import json, sys
d = json.load(sys.stdin)
title = '<exact title>'
subs = [l['title'].split('/')[-1] for l in d['parse']['links'] if l.get('title','').startswith(title + '/')]
print(subs)
"
```
Then mentally check: does this list contain anything that *isn't* a
plain Arabic numeral? If yes, verify the shipped sort actually produces
correct order for it before assuming it's fine.

**Results after fixing (2026-06-25):**
| Book | Bug | Before | After |
|---|---|---|---|
| Lazarillo de Tormes | ordinal words | 84.1% | **100.0%**, 0 exceptions, 94% confidence |
| El Gaucho Martín Fierro | (see §4 — verse numbers, different bug) | 55.4% | 82.4% |
| Doña Perfecta | bare Roman numerals | 69.0% | 71.6% |
| El Sombrero de Tres Picos | "Capítulo + Roman" + misplaced Prefacio | 70.6% | 75.2% |
| La Isla del Tesoro | bare Roman numerals | 55.7% | 55.4% (flat) |
| Orgullo y Prejuicio | "Capítulo + Roman" | 65.0% | 64.4% (flat) |

**Two of six showed no improvement despite the fix being independently
verified correct against the live API.** La Isla del Tesoro and Orgullo
y Prejuicio's translator credits were checked and **match** the audio
(ruling out §6's easy case) — same unexplained-but-not-edition-mismatch
situation as Crimen y Castigo. Don't assume "the order bug must be the
whole story" for every Roman-numeral book; verify the actual coverage
number after fixing, the same way every fix in this guide was validated.

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

- **`lastEndTime` must use `rawCues`, not stripped cues.** In
  `mergeVttDirectory()`, the chapter-boundary offset is calculated as
  `offset += last + gapSeconds`, where `last` is the end timestamp of the
  final cue in the file. If `last = lastEndTime(cues)` (stripped cues)
  instead of `last = lastEndTime(rawCues)`, stripping an end-of-chapter
  announcement cue (e.g. "Read by Kevin McLeod." at the tail of a chapter
  file) shortens `last` by however long that cue was. Every subsequent
  chapter's offset is then calculated from the wrong boundary, and all their
  timestamps shift slightly earlier than the actual audio. With 27 chapters
  in Dracula, this compounded into a **−8.7% regression** (66.1% → 57.4%)
  when EN chapter announcements were first added (2026-06-27) — because those
  new patterns started stripping tail cues that the old ES patterns never
  touched. The fix is one line: `const last = lastEndTime(rawCues)`. Always
  use the raw pre-strip boundary so audio timing is preserved regardless of
  what's stripped. The bug is fixed in `merge-transcriptions.ts` as of
  2026-06-27; this note exists so you never re-introduce it.

- **After any `merge-transcriptions.ts` logic change, spot-check a book
  that has many tail-stripped cues.** Dracula (27 chapters, each ending with
  "Read by X.") is the canonical regression detector — run it through merge
  and check that its merged VTT's total duration matches the sum of the raw
  chapter durations ± 2s-per-chapter gap before aligning anything.

- **`lastEndTime` fix result (2026-06-27 full EN re-align):** After the
  `rawCues` fix was applied and all 13 EN Narrative books were re-aligned:
  Dracula recovered from 57.4% → **66.5%** (+9.1% — confirms the bug was the
  root cause). Tom Sawyer regressed from 67.6% → **64.1%** (−3.5%). The
  regression is unexpected — Tom Sawyer should not have been hurt by using the
  correct raw boundary. Possible cause: Tom Sawyer has tail announcements that
  when included in `lastEndTime` push the chapter offset forward enough to
  misalign phrases in the next chapter. Investigate by diffing the merged VTT
  timestamps before/after the fix and comparing against the raw chapter-file
  durations. All other EN Narrative books changed ±0.2% or less (noise).

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
