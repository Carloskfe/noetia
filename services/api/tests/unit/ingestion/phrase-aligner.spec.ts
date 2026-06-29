import { alignPhrases, normalizeWord } from '../../../src/ingestion/phrase-aligner';
import { SyncPhrase } from '../../../src/books/sync-map.entity';
import { TimedWord } from '../../../src/ingestion/whisper-parser';

// ── normalizeWord ─────────────────────────────────────────────────────────────

describe('normalizeWord', () => {
  it('lowercases and removes punctuation', () => {
    expect(normalizeWord('Mancha,')).toBe('mancha');
    expect(normalizeWord('¡Hola!')).toBe('hola');
  });

  it('strips accent marks', () => {
    expect(normalizeWord('están')).toBe('estan');
    expect(normalizeWord('Córdoba')).toBe('cordoba');
  });

  it('returns empty string for punctuation-only tokens', () => {
    expect(normalizeWord('...')).toBe('');
    expect(normalizeWord(',;')).toBe('');
  });
});

// ── alignPhrases ──────────────────────────────────────────────────────────────

function makePhrase(index: number, text: string, type: SyncPhrase['type'] = 'text'): SyncPhrase {
  return { index, text, type: type ?? 'text', startTime: 0, endTime: 0 };
}

function makeWord(word: string, start: number, end: number): TimedWord {
  return { word, start, end };
}

describe('alignPhrases', () => {
  it('assigns correct timestamps to a perfect match', () => {
    const phrases = [makePhrase(0, 'En un lugar de la Mancha')];
    const words = [
      makeWord('En', 0, 0.5),
      makeWord('un', 0.5, 0.9),
      makeWord('lugar', 0.9, 1.4),
      makeWord('de', 1.4, 1.7),
      makeWord('la', 1.7, 2.0),
      makeWord('Mancha', 2.0, 3.0),
    ];

    const { phrases: result, stats } = alignPhrases(phrases, words);
    expect(result[0].startTime).toBe(0);
    expect(result[0].endTime).toBe(3.0);
    expect(stats.avgConfidence).toBe(1);
  });

  it('ignores verse and marginal-reference numbers (Wikisource KJV) when scoring', () => {
    // "23 704 Then said Mary" — leading verse number + large marginal cross-ref
    // number, neither read aloud. With digits counted the score would be 3/5 = 0.6;
    // dropping pure-digit tokens gives a perfect 3/3 match.
    const phrases = [makePhrase(0, '23 704 Then said Mary')];
    const words = [
      makeWord('Then', 0, 0.4),
      makeWord('said', 0.4, 0.8),
      makeWord('Mary', 0.8, 1.5),
    ];

    const { phrases: result, stats } = alignPhrases(phrases, words);
    expect(result[0].startTime).toBe(0);
    expect(result[0].endTime).toBe(1.5);
    expect(stats.avgConfidence).toBe(1);
  });

  it('handles slight word mismatches (Whisper errors) gracefully', () => {
    const phrases = [makePhrase(0, 'de cuyo nombre no quiero acordarme')];
    // Whisper mishears "cuyo" as "cuio"
    const words = [
      makeWord('de', 4.0, 4.3),
      makeWord('cuio', 4.3, 4.7),   // mishear
      makeWord('nombre', 4.7, 5.2),
      makeWord('no', 5.2, 5.4),
      makeWord('quiero', 5.4, 5.9),
      makeWord('acordarme', 5.9, 6.8),
    ];

    const { phrases: result } = alignPhrases(phrases, words);
    expect(result[0].startTime).toBe(4.0);
    expect(result[0].endTime).toBe(6.8);
  });

  it('aligns multiple sequential phrases correctly', () => {
    // Use enough padding words so the scoring window at pos 0 does not inadvertently
    // span the second phrase (window size = ceil(3*1.5)+5 = 10, so pad > 10 words).
    const pad = Array.from({ length: 12 }, (_, i) => makeWord(`x${i}`, 1.4 + i * 0.1, 1.4 + (i + 1) * 0.1));
    const phrases = [
      makePhrase(0, 'En un lugar'),
      makePhrase(1, 'de la Mancha'),
    ];
    const words = [
      makeWord('En', 0, 0.5),
      makeWord('un', 0.5, 0.9),
      makeWord('lugar', 0.9, 1.4),
      ...pad,   // 12 filler words — ensures pos-0 window never reaches 'de la Mancha'
      makeWord('de', 2.6, 2.9),
      makeWord('la', 2.9, 3.2),
      makeWord('Mancha', 3.2, 4.0),
    ];

    const { phrases: result, stats } = alignPhrases(phrases, words);
    // Both phrases found — no exceptions, both aligned
    expect(result[0].exception).toBeFalsy();
    expect(result[1].exception).toBeFalsy();
    expect(stats.aligned).toBe(2);
    expect(stats.exceptions).toBe(0);
    // Both phrases get timestamps in the audio range (not 0)
    expect(result[0].startTime).toBeGreaterThanOrEqual(0);
    expect(result[1].startTime).toBeGreaterThan(0);
    // Phrase 0 starts before phrase 1
    expect(result[0].startTime).toBeLessThan(result[1].startTime);
  });

  it('skips heading and paragraph-break phrases', () => {
    const phrases = [
      makePhrase(0, 'CAPÍTULO I', 'heading'),
      makePhrase(1, '', 'paragraph-break'),
      makePhrase(2, 'En un lugar'),
    ];
    const words = [makeWord('En', 1.0, 1.5), makeWord('un', 1.5, 1.8), makeWord('lugar', 1.8, 2.5)];

    const { phrases: result, stats } = alignPhrases(phrases, words);
    // Heading and paragraph-break keep startTime 0
    expect(result[0].startTime).toBe(0);
    expect(result[1].startTime).toBe(0);
    // Text phrase gets aligned
    expect(result[2].startTime).toBe(1.0);
    expect(stats.total).toBe(1);
  });

  it('reports low-confidence phrases', () => {
    const phrases = [makePhrase(0, 'palabra completamente diferente aqui')];
    const words = [
      makeWord('xyzzy', 0, 1),
      makeWord('foo', 1, 2),
      makeWord('bar', 2, 3),
      makeWord('baz', 3, 4),
    ];

    const { stats } = alignPhrases(phrases, words);
    // Score is 0 → falls below SKIP_THRESHOLD → treated as exception, not low-confidence
    expect(stats.exceptions).toBe(1);
    expect(stats.aligned).toBe(0);
  });

  it('returns empty stats for empty phrase list', () => {
    const { stats } = alignPhrases([], []);
    expect(stats.total).toBe(0);
    expect(stats.aligned).toBe(0);
    expect(stats.exceptions).toBe(0);
  });

  // ── Exception / skip-and-continue ─────────────────────────────────────────

  it('marks phrases with no audio content as exceptions', () => {
    // Simulate a book where phrases 0 and 2 are narrative (in audio)
    // but phrase 1 is a glossary entry whose words don't appear in the audio.
    // The audio contains only the narrative words — "xyzzy/zzz/etc" are NOT present.
    const phrases = [
      makePhrase(0, 'el veloz murcielago hindu'),  // in audio
      makePhrase(1, 'xyzzy zzz blorble flarb'),    // glossary — NOT in audio
      makePhrase(2, 'comia feliz cardillo kiwi'),   // in audio
    ];
    // Build a large enough audio so window size doesn't inadvertently span phrase 2.
    // Use 30+ words so MAX_DRIFT is the binding constraint, not array length.
    const pad = (start: number) =>
      Array.from({ length: 20 }, (_, i) => makeWord(`pad${i}`, start + i, start + i + 0.9));

    const words = [
      makeWord('el', 0, 0.3), makeWord('veloz', 0.3, 0.7), makeWord('murcielago', 0.7, 1.3), makeWord('hindu', 1.3, 1.8),
      ...pad(2),   // 20 padding words — keep phrases far apart
      makeWord('comia', 22, 22.4), makeWord('feliz', 22.4, 22.8), makeWord('cardillo', 22.8, 23.3), makeWord('kiwi', 23.3, 24),
    ];

    const { phrases: result, stats } = alignPhrases(phrases, words);

    // Phrase 0 — aligned
    expect(result[0].exception).toBe(false);
    expect(result[0].startTime).toBeGreaterThanOrEqual(0);

    // Phrase 1 — exception: none of its words exist in the audio
    expect(result[1].exception).toBe(true);
    expect(result[1].startTime).toBe(0);
    expect(result[1].endTime).toBe(0);

    // Phrase 2 — aligned (cursor was NOT advanced for phrase 1)
    expect(result[2].exception).toBe(false);
    expect(result[2].startTime).toBeGreaterThan(0);

    expect(stats.exceptions).toBe(1);
    expect(stats.aligned).toBe(2);
    expect(stats.exceptionPhrases[0].index).toBe(1);
  });

  it('cursor is not advanced for exception phrases so subsequent phrases still align', () => {
    // Multiple consecutive exceptions followed by a phrase that IS in the audio.
    // Pad the audio with enough words so the window never inadvertently spans from
    // the narrative start all the way to the end-narrative phrase.
    const pad = (start: number, n = 20) =>
      Array.from({ length: n }, (_, i) => makeWord(`p${start}x${i}`, start + i * 0.1, start + i * 0.1 + 0.09));

    const words = [
      makeWord('hola', 0, 0.5), makeWord('mundo', 0.5, 1.0),
      ...pad(1.1),      // 20 padding words between narrative phrases
      makeWord('fin', 3.1, 3.5), makeWord('del', 3.5, 3.8), makeWord('libro', 3.8, 4.5),
    ];

    const phrases = [
      makePhrase(0, 'hola mundo'),
      makePhrase(1, 'zzz yyy xxx'),    // not in audio
      makePhrase(2, 'qqq ppp ooo'),    // not in audio
      makePhrase(3, 'fin del libro'),  // back in audio
    ];

    const { phrases: result, stats } = alignPhrases(phrases, words);

    expect(result[0].exception).toBe(false);
    expect(result[1].exception).toBe(true);
    expect(result[2].exception).toBe(true);
    expect(result[3].exception).toBe(false);
    expect(result[3].startTime).toBeGreaterThan(0);  // correctly found in audio

    expect(stats.exceptions).toBe(2);
    expect(stats.aligned).toBe(2);
  });

  // ── Nonlinear drift correction ────────────────────────────────────────────
  // A long recording where un-narrated filler accumulates unevenly makes the true
  // audio position of each verse drift away from the flat proportional estimate.
  // On real books (Genesis: 4h, 38k words) this reaches ~1100+ words — far past
  // MAX_DRIFT — and used to sink confidence to ~67%. The EMA drift correction
  // tracks the smooth drift so phrases beyond MAX_DRIFT of the flat estimate still
  // align. Construct that signature with quadratically-growing filler gaps.
  it('follows smooth nonlinear drift beyond MAX_DRIFT via the EMA correction', () => {
    const N = 30;
    const words: TimedWord[] = [];
    const phrases: SyncPhrase[] = [];
    let t = 0;
    const truePos: number[] = [];
    for (let i = 0; i < N; i++) {
      // Filler before phrase i grows with i → cumulative gap is quadratic, so the
      // mid-book drift between true position and flat estimate exceeds MAX_DRIFT.
      const gap = 3 * i;
      for (let g = 0; g < gap; g++) {
        words.push(makeWord(`fill_${i}_${g}`, t, t + 0.1));
        t += 0.1;
      }
      truePos.push(words.length);
      const phraseWords = [`w${i}a`, `w${i}b`, `w${i}c`, `w${i}d`, `w${i}e`];
      for (const pw of phraseWords) {
        words.push(makeWord(pw, t, t + 0.1));
        t += 0.1;
      }
      phrases.push(makePhrase(i, phraseWords.join(' ')));
    }

    const { phrases: result, stats } = alignPhrases(phrases, words);

    // Every phrase must align despite the drift, with high confidence and no exceptions.
    expect(stats.exceptions).toBe(0);
    expect(stats.aligned).toBe(N);
    expect(stats.avgConfidence).toBeGreaterThan(0.95);

    // A mid-book phrase, whose true position is hundreds of words past its flat
    // proportional estimate, lands within a scoring window of its real audio
    // timestamp — not in a wrong region (the flat estimate would be ~25s off here).
    const mid = 15;
    const trueStart = words[truePos[mid]].start;
    expect(result[mid].exception).toBe(false);
    expect(Math.abs(result[mid].startTime - trueStart)).toBeLessThan(1.5);
  });
});
