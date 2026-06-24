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
// translator credit lines) that exist only in the audio, never in the stored
// book text. Left in, they inflate the audio-side word count at every chapter
// boundary, which breaks the aligner's proportional position estimate over
// many-chapter books (confirmed: La Divina Comedia, Orgullo y Prejuicio,
// Meditations, Don Quijote all carry this at every chapter file boundary).
//
// Some announcements are their own cue (dropped whole); others are appended
// to the end of the last real sentence with no cue break (trailing strip).

const ANNOUNCEMENT_WHOLE_CUE: RegExp[] = [
  /\blibrivox\b/i,
  /\bamara\.org\b/i,
  /^subt[ií]tulos realizados por/i,
  /^fin (del|de la)\s+(\S+\s+){0,3}(cap[ií]tulo|canto|parte|libro|volumen|secci[oó]n)\b/i,
  /^(cap[ií]tulo|canto|chapter|secci[oó]n)\s+\S+\s+(del?|of)\b/i,
  /\btraducid[oa]\s+(al|por)\b/i,
  /\btranslated by\b/i,
];

const ANNOUNCEMENT_TRAILING =
  /\s*fin (del|de la)\s+(\S+\s+){0,3}(cap[ií]tulo|canto|parte|libro|volumen|secci[oó]n)\b.*$/i;

// Reader-attribution credit ("Leído por Milton Muñoz.") can appear embedded
// mid-cue, not just at a cue boundary — stripped as a substring, not a
// whole-cue/trailing match.
const READER_CREDIT = /\s*le[ií]do por [^.]*\.\s*/gi;

/** Strip LibriVox reader announcements from a cue. Returns null if the cue is
 *  entirely an announcement (should be dropped), or a cleaned cue otherwise. */
export function stripAnnouncement(cue: Cue): Cue | null {
  const text = cue.payload.trim();
  if (ANNOUNCEMENT_WHOLE_CUE.some((re) => re.test(text))) return null;

  const withoutCredit = text.replace(READER_CREDIT, ' ').trim();
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
