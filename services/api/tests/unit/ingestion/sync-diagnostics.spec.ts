import { diagnoseSync } from '../../../src/ingestion/sync-diagnostics';
import { SyncPhrase } from '../../../src/books/sync-map.entity';
import { TimedWord } from '../../../src/ingestion/whisper-parser';

// ── Helpers ─────────────────────────────────────────────────────────────────

// Build a whisper stream: one TimedWord per word, 0.5s apart starting at `t0`.
function stream(words: string[], t0 = 0, gap = 0.5): TimedWord[] {
  return words.map((word, i) => ({
    word,
    start: t0 + i * gap,
    end: t0 + i * gap + gap,
  }));
}

// A book of N phrases, each `wordsPerPhrase` distinct words, so every phrase has
// a unique, unambiguous match in the audio.
function makeBook(n: number, wordsPerPhrase = 8) {
  const phraseWords: string[][] = [];
  const audioWords: string[] = [];
  for (let i = 0; i < n; i++) {
    const w = Array.from({ length: wordsPerPhrase }, (_, j) => `p${i}w${j}`);
    phraseWords.push(w);
    audioWords.push(...w);
  }
  return { phraseWords, audioWords };
}

// Turn phrase word-lists into stored SyncPhrases, assigning startTime from a
// caller-supplied word→time map so we can inject a deliberate offset.
function storedPhrases(phraseWords: string[][], timeFor: (globalWordIdx: number) => number): SyncPhrase[] {
  let g = 0;
  return phraseWords.map((w, i) => {
    const start = timeFor(g);
    const end = timeFor(g + w.length - 1) + 0.5;
    g += w.length;
    return { index: i, text: w.join(' '), startTime: start, endTime: end, type: 'text' as const };
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('diagnoseSync', () => {
  it('reports ~0 offset when stored times match the true onsets', () => {
    const { phraseWords, audioWords } = makeBook(40);
    const audio = stream(audioWords, 0);
    // Correct times: each phrase starts at its first word's true onset.
    const phrases = storedPhrases(phraseWords, (g) => audio[g].start);

    const d = diagnoseSync(phrases, audio, { anchors: 40 });

    expect(d.editionCoverage).toBe(1);
    expect(Math.abs(d.medianDeltaSeconds)).toBeLessThanOrEqual(0.5);
    expect(d.medianDeltaPhrases).toBe(0);
    expect(d.constantOffset).toBe(true);
  });

  it('detects a constant leading offset (highlight ahead of audio)', () => {
    const { phraseWords, audioWords } = makeBook(40);
    // Audio has a 10-word LibriVox-style announcement not in the text.
    const intro = Array.from({ length: 10 }, (_, i) => `intro${i}`);
    const audio = stream([...intro, ...audioWords], 0);

    // Buggy sync map: the WHOLE phrase interval (start and end) sits ≈2.5s too
    // early — i.e. the map ignored the intro, so every phrase points before its
    // real onset while keeping its true ~4s duration.
    let g = 0;
    const phrases: SyncPhrase[] = phraseWords.map((w, i) => {
      const trueOnset = audio[intro.length + g].start;
      const trueEnd = audio[intro.length + g + w.length - 1].end;
      g += w.length;
      return {
        index: i,
        text: w.join(' '),
        startTime: Math.max(0, trueOnset - 2.5),
        endTime: Math.max(0, trueEnd - 2.5),
        type: 'text' as const,
      };
    });

    const d = diagnoseSync(phrases, audio, { anchors: 40 });

    // True onsets are LATER than stored starts ⇒ positive delta ⇒ highlight ahead.
    expect(d.medianDeltaSeconds).toBeGreaterThan(1);
    expect(d.medianDeltaPhrases).toBeGreaterThanOrEqual(1);
    expect(d.constantOffset).toBe(true);
    // The intro shows up as leading extra words before phrase 0's true onset.
    expect(d.leadingExtraWords).toBeGreaterThanOrEqual(10);
  });

  it('flags an accumulating drift as NOT a constant offset', () => {
    const { phraseWords, audioWords } = makeBook(60);
    const audio = stream(audioWords, 0);
    // Stored start drifts further from truth as the book goes on.
    let g = 0;
    const phrases: SyncPhrase[] = phraseWords.map((w, i) => {
      const trueOnset = audio[g].start;
      const buggyStart = Math.max(0, trueOnset - i * 0.1); // grows with index
      const end = audio[g + w.length - 1].end;
      g += w.length;
      return { index: i, text: w.join(' '), startTime: buggyStart, endTime: end, type: 'text' as const };
    });

    const d = diagnoseSync(phrases, audio, { anchors: 60 });

    expect(d.driftSlope).toBeGreaterThan(0.02);
    expect(d.constantOffset).toBe(false);
  });

  it('detects an edition mismatch via low coverage', () => {
    const { phraseWords } = makeBook(30);
    // Audio is a completely different edition — none of the text words appear.
    const audioWords = Array.from({ length: 150 }, (_, i) => `other${i}`);
    const audio = stream(audioWords, 0);
    const phrases = storedPhrases(phraseWords, () => 0);

    const d = diagnoseSync(phrases, audio, { anchors: 30 });

    expect(d.editionCoverage).toBeLessThan(0.6);
  });

  it('ignores heading / paragraph-break phrases in the text-phrase count', () => {
    const { phraseWords, audioWords } = makeBook(10);
    const audio = stream(audioWords, 0);
    const phrases = storedPhrases(phraseWords, (g) => audio[g].start);
    phrases.push({ index: 999, text: 'CAPÍTULO I', startTime: 0, endTime: 0, type: 'heading' });

    const d = diagnoseSync(phrases, audio, { anchors: 10 });

    expect(d.textPhrases).toBe(10);
  });

  it('handles an empty phrase list without throwing', () => {
    const d = diagnoseSync([], stream(['a', 'b', 'c']), {});
    expect(d.textPhrases).toBe(0);
    expect(d.measured).toBe(0);
    expect(d.editionCoverage).toBe(0);
  });
});
