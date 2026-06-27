/**
 * Merges multiple ordered VTT transcription files into one, adjusting
 * timestamps so each file continues from where the previous one ended.
 *
 * Usage:
 *   npx ts-node merge-transcriptions.ts --dir <path> [--gap <seconds>] [--out <file>]
 *
 * Or from inside the API container pointing at a host path:
 *   docker compose exec api npx ts-node -r tsconfig-paths/register \
 *     src/ingestion/merge-transcriptions.ts \
 *     --dir /app/transcriptions/Lazarillo\ de\ Tormes \
 *     --out /app/transcriptions/lazarillo.merged.vtt
 *
 * Or pointing directly at the WSL-mounted Windows path:
 *   npx ts-node src/ingestion/merge-transcriptions.ts \
 *     --dir "/mnt/c/Users/carlo/OneDrive/Desktop/Carlos Fernando/Noetia/Free Library/Transcriptions/Lazarillo de Tormes" \
 *     --out /home/carloskfe/Noetia/transcriptions/lazarillo.merged.vtt
 *
 * File ordering: files are sorted by the first integer sequence found in
 * the filename (e.g. "01_prologo.vtt", "track_002.vtt", "bk01ch003.vtt").
 *
 * Gap: the offset for each file starts at (last_end_time_of_previous_file + gap).
 * Default gap is 2 seconds.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname, basename } from 'path';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Cue {
  id?: string;
  startTime: number;  // seconds
  endTime: number;    // seconds
  payload: string;    // raw text/html inside the cue
}

// ── Timestamp helpers ──────────────────────────────────────────────────────────

/** "HH:MM:SS.mmm" or "MM:SS.mmm" → seconds */
export function parseTimestamp(ts: string): number {
  const parts = ts.trim().split(':');
  if (parts.length === 3) {
    return parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseFloat(parts[2]);
  }
  return parseInt(parts[0], 10) * 60 + parseFloat(parts[1]);
}

/** seconds → "HH:MM:SS.mmm" */
export function formatTimestamp(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const ms = Math.round((s % 1) * 1000);
  return [
    String(h).padStart(2, '0'),
    String(m).padStart(2, '0'),
    `${String(Math.floor(s)).padStart(2, '0')}.${String(ms).padStart(3, '0')}`,
  ].join(':');
}

// ── VTT parser ─────────────────────────────────────────────────────────────────

const CUE_HEADER = /^(\d{2}:\d{2}:\d{2}\.\d{3}|\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3}|\d{2}:\d{2}\.\d{3})/;
const INLINE_TS  = /(<)(\d{2}:\d{2}:\d{2}\.\d{3}|\d{2}:\d{2}\.\d{3})(>)/g;

export function parseVttCues(content: string): Cue[] {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const cues: Cue[] = [];
  let i = 0;

  while (i < lines.length) {
    const m = CUE_HEADER.exec(lines[i]);
    if (m) {
      const startTime = parseTimestamp(m[1]);
      const endTime   = parseTimestamp(m[2]);
      const payload: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== '') {
        payload.push(lines[i]);
        i++;
      }
      cues.push({ startTime, endTime, payload: payload.join('\n') });
    } else {
      i++;
    }
  }

  return cues;
}

/** Return the last end-time across all cues (or 0 if empty). */
export function lastEndTime(cues: Cue[]): number {
  return cues.reduce((max, c) => Math.max(max, c.endTime), 0);
}

// ── LibriVox announcement stripping ─────────────────────────────────────────────
//
// LibriVox chapter recordings include reader announcements ("Fin del capítulo
// primero", "Capítulo 2 de...", "Esta es una grabación de LibriVox...",
// translator credit lines, "CHAPTER XIV", "King James Version, Chapter 1")
// that exist only in the audio, never in the stored book text. Left in, they
// inflate the audio-side word count at every chapter boundary, which breaks
// the aligner's proportional position estimate over many-chapter books
// (confirmed: La Divina Comedia, Orgullo y Prejuicio, Meditations, Don Quijote,
// Matthew, Luke, John, Jane Eyre — all carry these at every chapter file boundary).
//
// Three shapes:
//   1. Whole-cue announcements  → dropped entirely (ANNOUNCEMENT_WHOLE_CUE)
//   2. Chapter-heading prefix   → "CHAPTER VII My first quarter..." → strip prefix,
//      keep remainder if it contains lowercase (= real narrative); all-caps
//      remainder = chapter title only → drop  (CHAPTER_HEADING_PREFIX)
//   3. Inline / trailing        → chapter marker embedded mid-sentence or appended
//      at the end of a real sentence  (CHAPTER_INLINE, CHAPTER_TRAILING,
//      ANNOUNCEMENT_TRAILING, READER_CREDIT*)

const ANNOUNCEMENT_WHOLE_CUE: RegExp[] = [
  /\blibrivox\b/i,
  /\bamara\.org\b/i,
  /^subt[ií]tulos realizados por/i,
  /^fin (del|de la)\s+(\S+\s+){0,3}(cap[ií]tulo|canto|parte|libro|volumen|secci[oó]n)\b/i,
  /^(cap[ií]tulo|canto|chapter|secci[oó]n)\s+\S+\s+(del?|of)\b/i,
  /\btraducid[oa]\s+(al|por)\b/i,
  /\btranslated by\b/i,
  // Whisper sometimes segments "Leído por [reader] en [city], [region/country]."
  // into separate cues with no period in the first one (only in the last
  // fragment) — if the cue STARTS with "Leído por" drop it whole, regardless
  // of whether it ends with a period. (Mixed cues like "público. Leído por
  // X. Capítulo 1..." don't start with this and fall through to the
  // substring-based READER_CREDIT strip below instead.)
  /^le[ií]do por\b/i,
  // Same cross-cue-segmentation issue for "Grabado por [reader]." (recorded
  // by) — some readers credit themselves at every chapter, not just once,
  // so this is worth catching as both a whole-cue and substring pattern.
  /^grabado por\b/i,
  // English LibriVox reader credits — "Recording by [name].", "Read by [name].",
  // "Today's recording by [name].", "Today's reading [title]..., read by [name]."
  /^recording by\b/i,
  /^this recording\b/i,
  /^today's recording\b/i,
  /^today's reading\b/i,
  /^read by\b/i,
  /^as read by\b/i,
  // "This book, read by [name]." / "Authorized Version, read by [name]."
  /^(?:this book|authorized version),?\s*read by\b/i,
  // "57. Recording by Simon Wainwright." — verse/section stub + credit
  /^\d{1,3}\.\s+recording by\b/i,
  // English chapter-end announcements — "End of chapter N", "End of chapters N and M",
  // "End of chapter two of The Time Machine", "This is the end of chapter N".
  /^(?:this is (?:a |the )?)?end of chapters?\b/i,
  // Public domain notices mixed with recording credits
  /\bpublic domain\b.*\brecording by\b/i,
  // "Today's reading by [podcast/name]" embedded anywhere in cue
  /\btoday's reading by\b/i,
  // LibriVox chapter-intro format: "This is [Title] by [Author], Chapter N..."
  // Accept both comma and period separating title from "chapter".
  /^this is\s+\S+.*[.,]\s*chapter\s+\d+/i,
  // "This is Chapter 5." / "And this is Chapter 6." — simple Whisper chapter stubs
  /^(?:and\s+)?this is chapter\s+\S+\b/i,
  // EN Bible / Gospel version announcements — always standalone cues in LibriVox
  // KJV recordings: "The Gospel According to Saint Luke, Chapters 15 and 16.",
  // "In the Authorized Version Commonly Known as the King James Translation",
  // "End of the Gospel according to St. Matthew King James Version."
  /^the gospel\s+(of|according)\b/i,
  /^end of the gospel\b/i,
  /^in the authorized version\b/i,
  // "King James Version", "King James' Version", "King James Translation"
  /\bking james'?\s+(version|translation)\b/i,
  // "CHAPTERS XI AND XII Of the Gospel According to St. Luke" — multi-chapter Gospel intro
  /^chapters?\s+.{0,50}\bgospel\b/i,
  // "Jane Eyre by Charlotte Bronte, Chapter 22" / "by Mary Shelley. Chapter 11."
  /\bby [A-Z][a-z][\w ]+[.,]\s*chapter\s+\S+\b/i,
  // "John chapter 11." / "John chapter 12" — Bible book name + chapter stub
  /^(?:genesis|exodus|psalms?|proverbs?|isaiah|matthew|mark|luke|john|acts|revelation|romans|corinthians|galatians|ephesians|philippians|colossians|thessalonians|timothy|hebrews|james)\s+chapter\s+\d+\b/i,
];

const ANNOUNCEMENT_TRAILING =
  /\s*(?:fin (del|de la)\s+(?:\S+\s+){0,3}(?:cap[ií]tulo|canto|parte|libro|volumen|secci[oó]n)|(?:this is (?:a |the )?)?end of chapters?\s+[\w][\w\s,]*).*$/i;

// Reader-attribution credit — stripped as a substring when embedded mid-cue.
// Spanish: "Leído por Milton Muñoz.", "Grabado por Claudia Barrett."
const READER_CREDIT = /\s*(le[ií]do|grabado) por [^.]*\.\s*/gi;
// English: ". Recording by Simon Wainwright." / ", recording by Eric Conover."
// Capital after "by" is intentional — guards against false positives in narrative.
const READER_CREDIT_EN = /\s*[.,]\s*[Rr]ecording by [A-Z][^.]*\.\s*/g;

// English chapter heading at the START of a cue.
// Matches: "CHAPTER I", "CHAPTER 14", "Chapter One", "CHAPTERS XI AND XII", etc.
// After stripping this prefix, stripAnnouncement checks the remainder:
//   - empty or all-caps (chapter title only like "MENA HARKER'S JOURNAL") → drop cue
//   - contains lowercase (real narrative) → keep remainder
const CHAPTER_HEADING_PREFIX =
  /^CHAPTERS?\s+(?:[IVXLCDM]+|[0-9]+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|thirteenth|fourteenth|fifteenth|sixteenth|seventeenth|eighteenth|nineteenth|twentieth|thirtieth)\b(?:\s+(?:and|to|through|&)\s+(?:[IVXLCDM]+|[0-9]+|one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|twentieth|thirtieth)\b)?[.,]?\s*/i;

// Mid-cue chapter marker: "...sentence. Chapter 8. Next sentence..."
// The reader announces the next chapter inline within the same breath.
const CHAPTER_INLINE = /\.\s+[Cc]hapters?\s+(?:[IVXLCDMivxlcdm]+|[0-9]+)[.,]?\s+/g;

// Trailing chapter heading appended at the end of a real sentence:
// "as touched were made perfectly whole. CHAPTER XIV"
// "back, is fit for the kingdom of God. Chapter 10"
// "how shall ye believe my words? Chapter 6"
const CHAPTER_TRAILING = /[.,?!]\s+CHAPTERS?\s+(?:[IVXLCDMivxlcdm]+|[0-9]+)[.,]?$/i;

// Mid-sentence Arabic chapter number without a leading period:
// "arise let us go hence chapter 15 I am the true vine..."
// Digits only (not Roman numerals) to avoid false-positives in narrative prose.
const CHAPTER_DIGIT_INLINE = /\bchapter\s+\d+\s+/gi;

/** Strip LibriVox reader announcements from a cue. Returns null if the cue is
 *  entirely an announcement (should be dropped), or a cleaned cue otherwise. */
export function stripAnnouncement(cue: Cue): Cue | null {
  const text = cue.payload.trim();
  if (ANNOUNCEMENT_WHOLE_CUE.some((re) => re.test(text))) return null;

  // English chapter heading at start of cue.
  // "CHAPTER XIV MENA HARKER'S JOURNAL" → all-caps remainder → drop
  // "CHAPTER VII My first quarter at Lowood seemed an age," → has lowercase → strip prefix, keep rest
  const chMatch = CHAPTER_HEADING_PREFIX.exec(text);
  if (chMatch) {
    const rest = text.slice(chMatch[0].length).trim();
    if (rest.length === 0 || !/[a-z]/.test(rest)) return null;
    const cleaned = rest
      .replace(READER_CREDIT, ' ').replace(READER_CREDIT_EN, ' ').trim()
      .replace(ANNOUNCEMENT_TRAILING, '').trim();
    return cleaned.length > 0 ? { ...cue, payload: cleaned } : null;
  }

  // Mid-cue and trailing chapter markers.
  const working = text
    .replace(CHAPTER_INLINE, '. ')
    .replace(CHAPTER_DIGIT_INLINE, '')
    .replace(CHAPTER_TRAILING, '')
    .trim();

  const withoutCredit = working.replace(READER_CREDIT, ' ').replace(READER_CREDIT_EN, ' ').trim();
  const stripped = withoutCredit.replace(ANNOUNCEMENT_TRAILING, '').trim();
  if (stripped === '') return null;
  return stripped !== text ? { ...cue, payload: stripped } : cue;
}

/** Shift all timestamps in a cue by `offset` seconds. */
function shiftCue(cue: Cue, offset: number): Cue {
  const payload = cue.payload.replace(INLINE_TS, (_, open, ts, close) =>
    `${open}${formatTimestamp(parseTimestamp(ts) + offset)}${close}`,
  );
  return {
    ...cue,
    startTime: cue.startTime + offset,
    endTime:   cue.endTime   + offset,
    payload,
  };
}

/** Render a list of cues back to VTT text. */
export function renderVtt(cues: Cue[]): string {
  const lines = ['WEBVTT', ''];
  for (const cue of cues) {
    lines.push(`${formatTimestamp(cue.startTime)} --> ${formatTimestamp(cue.endTime)}`);
    lines.push(cue.payload);
    lines.push('');
  }
  return lines.join('\n');
}

// ── File sorting ───────────────────────────────────────────────────────────────

/** Extract the first integer sequence from a filename for ordering. */
export function extractSequenceNumber(filename: string): number {
  const m = /(\d+)/.exec(basename(filename));
  return m ? parseInt(m[1], 10) : 0;
}

function sortedVttFiles(dir: string): string[] {
  const files = readdirSync(dir)
    .filter((f) => extname(f).toLowerCase() === '.vtt')
    .map((f) => join(dir, f));

  return files.sort((a, b) => {
    const diff = extractSequenceNumber(a) - extractSequenceNumber(b);
    // Numeric tie (e.g. 04a vs 04b) → fall back to alphabetical
    return diff !== 0 ? diff : basename(a).localeCompare(basename(b));
  });
}

// ── Main merge ─────────────────────────────────────────────────────────────────

export function mergeVttDirectory(dir: string, gapSeconds = 2): Cue[] {
  const files = sortedVttFiles(dir);
  if (files.length === 0) throw new Error(`No .vtt files found in: ${dir}`);

  console.log(`Found ${files.length} files (sorted by sequence number):`);

  const merged: Cue[] = [];
  let offset = 0;

  for (const file of files) {
    const content  = readFileSync(file, 'utf-8');
    const rawCues  = parseVttCues(content);
    const cues     = rawCues.map(stripAnnouncement).filter((c): c is Cue => c !== null);
    const stripped = rawCues.length - cues.length;
    const last     = lastEndTime(cues);

    console.log(
      `  ${basename(file)} → ${cues.length} cues` +
      (stripped > 0 ? ` (${stripped} announcement${stripped > 1 ? 's' : ''} stripped)` : '') +
      `, ends at ${formatTimestamp(last)}, offset ${formatTimestamp(offset)}`,
    );

    for (const cue of cues) {
      merged.push(shiftCue(cue, offset));
    }

    offset += last + gapSeconds;
  }

  return merged;
}

// ── CLI entry ──────────────────────────────────────────────────────────────────

function parseArgs(): { dir: string; out: string; gap: number } {
  const args = process.argv.slice(2);
  const get = (flag: string) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : undefined; };
  const dir = get('--dir');
  if (!dir) {
    console.error('Usage: merge-transcriptions.ts --dir <directory> [--out <file>] [--gap <seconds>]');
    process.exit(1);
  }
  const gap  = parseFloat(get('--gap') ?? '2');
  const out  = get('--out') ?? join(dir, '..', `${basename(dir)}.merged.vtt`);
  return { dir, out, gap };
}

if (require.main === module) {
  const { dir, out, gap } = parseArgs();

  console.log(`\nMerging transcriptions from: ${dir}`);
  console.log(`Gap between files: ${gap}s\n`);

  const cues   = mergeVttDirectory(dir, gap);
  const output = renderVtt(cues);
  writeFileSync(out, output, 'utf-8');

  const totalDuration = cues.length > 0 ? cues[cues.length - 1].endTime : 0;
  console.log(`\n✓ Merged ${cues.length} cues — total duration: ${formatTimestamp(totalDuration)}`);
  console.log(`✓ Written to: ${out}\n`);
}
