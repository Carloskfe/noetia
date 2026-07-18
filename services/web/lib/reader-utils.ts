export interface Phrase {
  index: number;
  text: string;
  startTime: number;
  endTime: number;
  type?: 'text' | 'heading' | 'paragraph-break';
}

export interface Fragment {
  id: string;
  bookId: string;
  userId: string;
  text: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Chapter {
  index: number;
  title: string;
}

export function extractChapters(phrases: Phrase[]): Chapter[] {
  return phrases
    .filter((p) => p.type === 'heading' && p.text.trim())
    .map((p) => ({ index: p.index, title: p.text }));
}

/**
 * Returns the ARRAY index of the phrase being narrated at `currentTime`, or -1
 * before the first timed phrase begins.
 *
 * The phrases array interleaves timed 'text' phrases with zero-duration
 * structural markers ('heading' / 'paragraph-break', which carry
 * startTime === endTime === 0 — see phrase-splitter.service.ts). Those markers
 * make the array's startTimes NON-monotonic, so a plain binary search misfires:
 * a marker landing on the search midpoint sends it the wrong way and it returns
 * a neighbouring phrase or -1 (the root cause of the highlight jumping to the
 * wrong phrase, dropping out, and the auto-scroll — gated on index >= 0 — not
 * advancing in Escucha Activa / hybrid mode).
 *
 * We instead scan the timed phrases in order and return the last one that has
 * started (startTime <= currentTime). Skipping the zero-duration markers keeps
 * the sequence monotonic, and "last started" keeps a phrase highlighted through
 * the small gaps Whisper leaves between phrases (and after the final phrase),
 * rather than blinking to nothing.
 */
export function phraseAt(phrases: Phrase[], currentTime: number): number {
  let active = -1;

  for (let i = 0; i < phrases.length; i++) {
    const p = phrases[i];
    if (p.endTime <= p.startTime) continue; // skip zero-duration structural markers
    if (currentTime < p.startTime) break;   // timed phrases are sorted — we're past it
    active = i;                              // last timed phrase that has started
    if (currentTime < p.endTime) return i;  // exact interval hit
  }

  return active;
}

/**
 * The gap (seconds) between a phrase's marked `startTime` and its audible onset.
 *
 * Whisper marks `startTime` at the earliest onset of the phrase's first word,
 * which lands a fraction of a second BEFORE the narrator is audibly into the
 * phrase. Two symptoms fall out of that early marking, and both are the SAME
 * quantity, so we model it with one offset and apply it consistently:
 *
 *  1. Highlight leads the audio — resolving the active phrase at exactly
 *     `currentTime` flips the highlight to the next phrase before you hear it,
 *     so text and audio drift a beat apart. Fix: resolve the highlight at
 *     `currentTime - offset` so the current phrase stays lit until the next one
 *     is actually being spoken (see activePhraseForPlayback).
 *  2. Seek lands one phrase early — MP3 seek snaps to the nearest frame, often a
 *     hair before `startTime`, so a raw seek resolves to the PREVIOUS phrase.
 *     Fix: land the seek at `startTime + offset`, on the audible onset.
 *
 * Because highlighting subtracts the offset and seeking adds it, a seek to
 * phrase i (playing OR paused) resolves straight back to i — no flash to the
 * neighbour. ~250ms firmly corrects the lead while staying below the threshold
 * where a highlight lag becomes noticeable in the other direction.
 */
export const PHRASE_SYNC_OFFSET_SECONDS = 0.25;

/**
 * The phrase to highlight for a live playback position. Applies
 * PHRASE_SYNC_OFFSET_SECONDS so the highlight tracks the phrase being *heard*,
 * not the one just entered. Highlighting only — the scrubber and timecode keep
 * the true `currentTime`.
 */
export function activePhraseForPlayback(phrases: Phrase[], currentTime: number): number {
  return phraseAt(phrases, currentTime - PHRASE_SYNC_OFFSET_SECONDS);
}

export function seekToPhrase(phrases: Phrase[], index: number): number {
  if (index < 0 || index >= phrases.length) return 0;
  const p = phrases[index];
  const nudge = Math.min(PHRASE_SYNC_OFFSET_SECONDS, Math.max(0, (p.endTime - p.startTime) / 2));
  return p.startTime + nudge;
}

/**
 * The true full-book audio length to drive the progress bar.
 *
 * Multi-chapter audio is byte-concatenated from per-chapter MP3s, so the merged
 * file keeps the FIRST chapter's VBR/Xing duration header — browsers then report
 * `audio.duration` as roughly one chapter, making the scrubber fill up within
 * the first chapter instead of tracking the whole book. The sync map's last
 * phrase end time is the real full-book length, so use whichever is larger
 * (falls back cleanly to audio.duration for single-file / un-synced books).
 */
export function effectiveDuration(audioDuration: number, phrases: Phrase[]): number {
  const lastEnd = phrases.length ? phrases[phrases.length - 1].endTime : 0;
  return Math.max(audioDuration || 0, lastEnd);
}

/**
 * Format an audio position/length for the player timeline.
 *
 * Audiobooks run for hours, so when the reference length has an hours component
 * we show HH:MM:SS; shorter content stays M:SS. Pass the SAME `withHours` for
 * the current position and the total so the two labels stay aligned. Guards
 * against NaN / negative / Infinity (metadata not loaded yet) by clamping to 0.
 */
export function formatTimecode(seconds: number, withHours: boolean): string {
  const total = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return withHours ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
