import { phraseAt, seekToPhrase, effectiveDuration, extractChapters, Phrase } from '../../../lib/reader-utils';

const phrases: Phrase[] = [
  { index: 0, text: 'Hello world.', startTime: 0, endTime: 2.5 },
  { index: 1, text: 'Second phrase.', startTime: 2.5, endTime: 5.0 },
  { index: 2, text: 'Third phrase.', startTime: 5.0, endTime: 8.0 },
  { index: 3, text: 'Last phrase.', startTime: 8.0, endTime: 12.0 },
];

describe('extractChapters', () => {
  it('returns an empty array when there are no heading phrases', () => {
    const flat: Phrase[] = [
      { index: 0, text: 'First sentence.', startTime: 0, endTime: 2 },
      { index: 1, text: 'Second sentence.', startTime: 2, endTime: 4 },
    ];
    expect(extractChapters(flat)).toEqual([]);
  });

  it('returns one chapter per heading phrase in order', () => {
    const mixed: Phrase[] = [
      { index: 0, text: 'CAPÍTULO I', startTime: 0, endTime: 0, type: 'heading' },
      { index: 1, text: 'Texto del capítulo uno.', startTime: 0, endTime: 0, type: 'text' },
      { index: 2, text: 'CAPÍTULO II', startTime: 0, endTime: 0, type: 'heading' },
      { index: 3, text: 'Texto del capítulo dos.', startTime: 0, endTime: 0, type: 'text' },
    ];
    const chapters = extractChapters(mixed);
    expect(chapters).toHaveLength(2);
    expect(chapters[0]).toEqual({ index: 0, title: 'CAPÍTULO I' });
    expect(chapters[1]).toEqual({ index: 2, title: 'CAPÍTULO II' });
  });

  it('maps phrase index correctly so the caller can scroll to the right position', () => {
    const phrases: Phrase[] = [
      { index: 0, text: 'Intro text here.', startTime: 0, endTime: 0, type: 'text' },
      { index: 1, text: '', startTime: 0, endTime: 0, type: 'paragraph-break' },
      { index: 2, text: 'PARTE I', startTime: 0, endTime: 0, type: 'heading' },
      { index: 3, text: 'Primer párrafo.', startTime: 0, endTime: 0, type: 'text' },
    ];
    const chapters = extractChapters(phrases);
    expect(chapters).toHaveLength(1);
    expect(chapters[0].index).toBe(2);
  });

  it('skips heading phrases with empty text', () => {
    const phrases: Phrase[] = [
      { index: 0, text: '', startTime: 0, endTime: 0, type: 'heading' },
      { index: 1, text: 'CAPÍTULO I', startTime: 0, endTime: 0, type: 'heading' },
    ];
    const chapters = extractChapters(phrases);
    expect(chapters).toHaveLength(1);
    expect(chapters[0].title).toBe('CAPÍTULO I');
  });

  it('returns an empty array for an empty phrases list', () => {
    expect(extractChapters([])).toEqual([]);
  });
});

describe('phraseAt', () => {
  it('returns -1 for an empty phrases array', () => {
    expect(phraseAt([], 3.0)).toBe(-1);
  });

  it('returns -1 when currentTime is before all phrases', () => {
    const withGap: Phrase[] = [{ index: 0, text: 'Hi', startTime: 5.0, endTime: 8.0 }];
    expect(phraseAt(withGap, 2.0)).toBe(-1);
  });

  it('returns 0 for the first phrase at its startTime', () => {
    expect(phraseAt(phrases, 0)).toBe(0);
  });

  it('returns the index of a phrase in the middle of the array', () => {
    expect(phraseAt(phrases, 2.5)).toBe(1);
    expect(phraseAt(phrases, 4.9)).toBe(1);
  });

  it('returns the index of the last phrase', () => {
    expect(phraseAt(phrases, 8.0)).toBe(3);
    expect(phraseAt(phrases, 11.99)).toBe(3);
  });

  it('stays on the last phrase once its endTime passes (gap-tolerant, no blink to -1)', () => {
    // Whisper leaves trailing silence after the last phrase; the highlight should
    // remain on the last sentence rather than clearing.
    expect(phraseAt(phrases, 12.0)).toBe(3);
    expect(phraseAt(phrases, 100)).toBe(3);
  });

  it('returns correct index at phrase boundary (endTime of one = startTime of next)', () => {
    expect(phraseAt(phrases, 5.0)).toBe(2);
  });

  // Regression: heading / paragraph-break markers carry startTime===endTime===0
  // (phrase-splitter.service.ts) and are interleaved with timed text phrases,
  // making the array non-monotonic. The old binary search returned the wrong
  // phrase or -1 here.
  it('ignores interleaved zero-duration markers (heading / paragraph-break)', () => {
    const mixed: Phrase[] = [
      { index: 0, text: 'First.',  startTime: 0,   endTime: 3.5, type: 'text' },
      { index: 1, text: 'PARTE I', startTime: 0,   endTime: 0,   type: 'heading' },
      { index: 2, text: '',        startTime: 0,   endTime: 0,   type: 'paragraph-break' },
      { index: 3, text: 'Second.', startTime: 3.5, endTime: 7.2, type: 'text' },
      { index: 4, text: 'Third.',  startTime: 7.2, endTime: 11,  type: 'text' },
    ];
    expect(phraseAt(mixed, 2.0)).toBe(0);   // inside First. — old search returned -1
    expect(phraseAt(mixed, 5.0)).toBe(3);   // inside Second. — array index, not timed-order
    expect(phraseAt(mixed, 9.0)).toBe(4);
    expect(phraseAt(mixed, -1)).toBe(-1);   // before the first timed phrase
  });

  it('keeps the current phrase highlighted through an inter-phrase gap', () => {
    const gapped: Phrase[] = [
      { index: 0, text: 'A.', startTime: 0, endTime: 2, type: 'text' },
      { index: 1, text: 'B.', startTime: 5, endTime: 7, type: 'text' }, // 3s gap after A
    ];
    expect(phraseAt(gapped, 3.5)).toBe(0); // in the gap → stay on A, not -1
    expect(phraseAt(gapped, 5.0)).toBe(1);
  });
});

describe('seekToPhrase', () => {
  it('returns a time nudged just INTO the phrase (not its exact startTime)', () => {
    // +0.15s so MP3 seek imprecision doesn't land before startTime and highlight
    // the previous phrase ("starts one phrase early").
    expect(seekToPhrase(phrases, 0)).toBeCloseTo(0.15);
    expect(seekToPhrase(phrases, 1)).toBeCloseTo(2.65);
    expect(seekToPhrase(phrases, 3)).toBeCloseTo(8.15);
  });

  it('the nudged seek target resolves back to the SAME phrase via phraseAt', () => {
    // The whole point: seeking to start phrase i must keep phrase i active.
    for (let i = 0; i < phrases.length; i++) {
      expect(phraseAt(phrases, seekToPhrase(phrases, i))).toBe(i);
    }
  });

  it('never nudges past a short phrase\'s own endTime', () => {
    const short: Phrase[] = [{ index: 0, text: 'Hi.', startTime: 10, endTime: 10.1, type: 'text' }];
    // duration 0.1 → nudge capped at half (0.05), so target 10.05 stays inside
    expect(seekToPhrase(short, 0)).toBeCloseTo(10.05);
    expect(phraseAt(short, seekToPhrase(short, 0))).toBe(0);
  });

  it('returns 0 for a negative index', () => {
    expect(seekToPhrase(phrases, -1)).toBe(0);
  });

  it('returns 0 for an index beyond the array length', () => {
    expect(seekToPhrase(phrases, 99)).toBe(0);
  });

  it('returns 0 for an empty phrases array', () => {
    expect(seekToPhrase([], 0)).toBe(0);
  });
});

describe('effectiveDuration', () => {
  it('uses the last phrase end when audio.duration under-reports (concatenated MP3 header)', () => {
    // Byte-concatenated multi-chapter MP3: the header reports only chapter 1
    // (here 5s) but the sync map runs to 12s → the bar must span the whole book.
    expect(effectiveDuration(5, phrases)).toBe(12.0); // phrases fixture ends at 12.0
  });

  it('uses audio.duration when it already exceeds the sync map (single-file book)', () => {
    expect(effectiveDuration(3600, phrases)).toBe(3600);
  });

  it('falls back to audio.duration when there are no phrases', () => {
    expect(effectiveDuration(500, [])).toBe(500);
  });

  it('handles NaN/0 audio.duration by using the sync map', () => {
    expect(effectiveDuration(NaN, phrases)).toBe(12.0);
    expect(effectiveDuration(0, phrases)).toBe(12.0);
  });

  it('returns 0 when there is neither audio duration nor phrases', () => {
    expect(effectiveDuration(0, [])).toBe(0);
  });
});
