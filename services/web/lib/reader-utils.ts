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

export function seekToPhrase(phrases: Phrase[], index: number): number {
  if (index < 0 || index >= phrases.length) return 0;
  return phrases[index].startTime;
}
