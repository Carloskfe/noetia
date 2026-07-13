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
 * Small forward offset (seconds) so a seek lands INSIDE the target phrase.
 * MP3 seeking snaps to the nearest frame — often a hair before startTime — which
 * makes phraseAt() resolve to the PREVIOUS phrase, i.e. narration "starts one
 * phrase early". Nudging past startTime (but never past the phrase's own end)
 * keeps the intended phrase active. 150ms is imperceptible.
 */
export const SEEK_NUDGE_SECONDS = 0.15;

export function seekToPhrase(phrases: Phrase[], index: number): number {
  if (index < 0 || index >= phrases.length) return 0;
  const p = phrases[index];
  const nudge = Math.min(SEEK_NUDGE_SECONDS, Math.max(0, (p.endTime - p.startTime) / 2));
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
