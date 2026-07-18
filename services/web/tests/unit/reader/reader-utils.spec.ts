import { phraseAt, activePhraseForPlayback, seekToPhrase, resumePhraseIndex, pageCount, clampPage, deltaPages, effectiveDuration, extractChapters, Phrase } from '../../../lib/reader-utils';

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

describe('activePhraseForPlayback', () => {
  it('holds the current phrase past the next phrase\'s marked start (no lead)', () => {
    // Phrase 1 is marked to start at 2.5. Within the sync offset of that mark the
    // narrator is still finishing phrase 0, so the highlight must stay on 0.
    expect(activePhraseForPlayback(phrases, 2.5)).toBe(0);  // exactly at the mark
    expect(activePhraseForPlayback(phrases, 2.7)).toBe(0);  // within the 0.25s offset
    expect(activePhraseForPlayback(phrases, 2.76)).toBe(1); // past the offset → advance
  });

  it('does not highlight until the first phrase is audibly underway', () => {
    expect(activePhraseForPlayback(phrases, 0)).toBe(-1);
    expect(activePhraseForPlayback(phrases, 0.24)).toBe(-1);
    expect(activePhraseForPlayback(phrases, 0.25)).toBe(0);
  });

  it('a seek to phrase i resolves back to i under the playback offset (playing or paused)', () => {
    // Guards the regression the shared offset is designed to avoid: seeking adds
    // the offset, the highlight subtracts it, so they cancel to the exact phrase.
    for (let i = 0; i < phrases.length; i++) {
      expect(activePhraseForPlayback(phrases, seekToPhrase(phrases, i))).toBe(i);
    }
  });
});

describe('seekToPhrase', () => {
  it('returns a time nudged just INTO the phrase (not its exact startTime)', () => {
    // +0.25s (the sync offset) so MP3 seek imprecision doesn't land before
    // startTime and highlight the previous phrase ("starts one phrase early").
    expect(seekToPhrase(phrases, 0)).toBeCloseTo(0.25);
    expect(seekToPhrase(phrases, 1)).toBeCloseTo(2.75);
    expect(seekToPhrase(phrases, 3)).toBeCloseTo(8.25);
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

describe('resumePhraseIndex', () => {
  // 4 timed phrases (each 60px tall in these scenarios) + a heading marker.
  const timed: Phrase[] = [
    { index: 0, text: 'A.', startTime: 0, endTime: 2.5 },
    { index: 1, text: 'B.', startTime: 2.5, endTime: 5.0 },
    { index: 2, text: 'C.', startTime: 5.0, endTime: 8.0 },
    { index: 3, text: 'D.', startTime: 8.0, endTime: 12.0 },
  ];

  it('returns -1 when no phrase is rendered', () => {
    expect(resumePhraseIndex(timed, () => null)).toBe(-1);
  });

  it('returns the topmost phrase still below the header offset', () => {
    // phrase 0 scrolled above the header (bottom 40 <= 64), phrase 1 straddles it.
    const bottoms = [40, 100, 160, 220];
    expect(resumePhraseIndex(timed, (i) => bottoms[i], 64)).toBe(1);
  });

  it('returns phrase 0 at the top of the book (nothing scrolled past)', () => {
    const bottoms = [80, 140, 200, 260];
    expect(resumePhraseIndex(timed, (i) => bottoms[i], 64)).toBe(0);
  });

  it('returns the last timed phrase once everything is scrolled past', () => {
    const bottoms = [-300, -240, -180, -120]; // all above the header
    expect(resumePhraseIndex(timed, (i) => bottoms[i], 64)).toBe(3);
  });

  it('skips zero-duration markers (headings / paragraph breaks)', () => {
    const withMarker: Phrase[] = [
      { index: 0, text: 'CAP. I', startTime: 0, endTime: 0, type: 'heading' }, // marker
      { index: 1, text: 'First.', startTime: 0, endTime: 3, type: 'text' },
      { index: 2, text: 'Second.', startTime: 3, endTime: 6, type: 'text' },
    ];
    // The heading straddles the header but must be skipped → returns the timed phrase.
    const bottoms = [70, 130, 190];
    expect(resumePhraseIndex(withMarker, (i) => bottoms[i], 64)).toBe(1);
  });

  it('skips phrases with no element and picks the next rendered one', () => {
    const bottoms: (number | null)[] = [null, 100, 160, 220];
    expect(resumePhraseIndex(timed, (i) => bottoms[i], 64)).toBe(1);
  });
});

describe('pageCount', () => {
  it('returns 1 when content fits one page (no overflow)', () => {
    expect(pageCount(300, 300, 40)).toBe(1);
  });

  it('counts pages from total laid-out width including gaps', () => {
    // 3 columns of 300 with two 40px gaps = 900 + 80 = 980
    expect(pageCount(980, 300, 40)).toBe(3);
    // 5 columns: 5*300 + 4*40 = 1660
    expect(pageCount(1660, 300, 40)).toBe(5);
  });

  it('returns 1 for zero or negative geometry', () => {
    expect(pageCount(0, 300, 40)).toBe(1);
    expect(pageCount(980, 0, 0)).toBe(1);
  });
});

describe('clampPage', () => {
  it('clamps into [0, total-1]', () => {
    expect(clampPage(5, 3)).toBe(2);
    expect(clampPage(-1, 3)).toBe(0);
    expect(clampPage(1, 3)).toBe(1);
  });

  it('rounds fractional pages', () => {
    expect(clampPage(1.4, 5)).toBe(1);
    expect(clampPage(1.6, 5)).toBe(2);
  });

  it('handles empty/NaN safely', () => {
    expect(clampPage(2, 0)).toBe(0);
    expect(clampPage(NaN, 5)).toBe(0);
  });
});

describe('deltaPages', () => {
  it('converts a pixel delta into a page offset', () => {
    expect(deltaPages(680, 300, 40)).toBe(2);   // 2 * 340
    expect(deltaPages(340, 300, 40)).toBe(1);
    expect(deltaPages(50, 300, 40)).toBe(0);     // same page
    expect(deltaPages(-340, 300, 40)).toBe(-1);  // one page back
  });

  it('returns 0 for degenerate pitch', () => {
    expect(deltaPages(100, 0, 0)).toBe(0);
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
