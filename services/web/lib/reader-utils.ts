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

export function phraseAt(phrases: Phrase[], currentTime: number): number {
  if (!phrases.length) return -1;

  let lo = 0;
  let hi = phrases.length - 1;

  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const p = phrases[mid];
    if (currentTime < p.startTime) {
      hi = mid - 1;
    } else if (currentTime >= p.endTime) {
      lo = mid + 1;
    } else {
      return mid;
    }
  }

  return -1;
}

export function seekToPhrase(phrases: Phrase[], index: number): number {
  if (index < 0 || index >= phrases.length) return 0;
  return phrases[index].startTime;
}
