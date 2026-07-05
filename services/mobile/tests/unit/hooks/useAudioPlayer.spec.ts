// Tests for pure logic extracted from the hook — no expo-av dependency.
// Import the REAL findActivePhraseIndex (previously reimplemented here, which
// hid the interleaved zero-duration marker bug from the test suite).
import { findActivePhraseIndex, type SyncPhrase } from '../../../src/hooks/useAudioPlayer';

const PHRASES: SyncPhrase[] = [
  { index: 0, startTime: 0,  endTime: 5  },
  { index: 1, startTime: 5,  endTime: 12 },
  { index: 2, startTime: 12, endTime: 20 },
  { index: 3, startTime: 20, endTime: 30 },
];

describe('findActivePhraseIndex', () => {
  it('returns 0 at position 0', () => {
    expect(findActivePhraseIndex(PHRASES, 0)).toBe(0);
  });

  it('returns 1 at exact startTime of second phrase', () => {
    expect(findActivePhraseIndex(PHRASES, 5)).toBe(1);
  });

  it('returns 1 in the middle of second phrase', () => {
    expect(findActivePhraseIndex(PHRASES, 8)).toBe(1);
  });

  it('returns 2 at startTime 12', () => {
    expect(findActivePhraseIndex(PHRASES, 12)).toBe(2);
  });

  it('returns last phrase for position past all phrases', () => {
    expect(findActivePhraseIndex(PHRASES, 999)).toBe(3);
  });

  it('returns 0 for empty phrases', () => {
    expect(findActivePhraseIndex([], 5)).toBe(0);
  });

  it('returns 0 for single phrase', () => {
    const single = [{ index: 0, startTime: 0, endTime: 100 }];
    expect(findActivePhraseIndex(single, 50)).toBe(0);
  });

  // Regression: heading / paragraph-break markers carry startTime===endTime===0
  // and are interleaved with timed phrases. Their startTime (0) always satisfies
  // "startTime <= position", so the old logic drifted the active index onto the
  // marker after the real phrase — highlighting the wrong/empty phrase.
  it('ignores interleaved zero-duration markers (heading / paragraph-break)', () => {
    const mixed: SyncPhrase[] = [
      { index: 0, startTime: 0,  endTime: 5,  type: 'text' },
      { index: 1, startTime: 0,  endTime: 0,  type: 'heading' },
      { index: 2, startTime: 5,  endTime: 12, type: 'text' },
      { index: 3, startTime: 0,  endTime: 0,  type: 'paragraph-break' },
      { index: 4, startTime: 12, endTime: 20, type: 'text' },
    ];
    expect(findActivePhraseIndex(mixed, 2)).toBe(0);  // inside first text phrase
    expect(findActivePhraseIndex(mixed, 8)).toBe(2);  // inside second — NOT the break at idx 3
    expect(findActivePhraseIndex(mixed, 15)).toBe(4);
  });

  it('keeps the current phrase highlighted through an inter-phrase gap', () => {
    const gapped: SyncPhrase[] = [
      { index: 0, startTime: 0, endTime: 2, type: 'text' },
      { index: 1, startTime: 5, endTime: 7, type: 'text' }, // 3s gap after phrase 0
    ];
    expect(findActivePhraseIndex(gapped, 3.5)).toBe(0); // in the gap → stay on 0
    expect(findActivePhraseIndex(gapped, 5)).toBe(1);
  });
});

describe('useAudioPlayer exports', () => {
  it('exports useAudioPlayer as a function', () => {
    // Dynamically import to avoid expo-av loading in test environment
    const mod = require('../../../src/hooks/useAudioPlayer');
    expect(typeof mod.useAudioPlayer).toBe('function');
  });
});

// seek-on-load logic — pure helper tests for the ReaderScreen fix
// When audio mode is first enabled and the file loads, the reader must seek
// to the user's saved reading position rather than starting at 0.
describe('seek-on-load: phrase selection logic', () => {
  function pickSeekTarget(phrases: SyncPhrase[], savedIndex: number): SyncPhrase | null {
    if (savedIndex <= 0 || phrases.length === 0) return null;
    const idx = Math.min(savedIndex, phrases.length - 1);
    const phrase = phrases[idx];
    return phrase?.startTime ? phrase : null;
  }

  it('returns null when savedIndex is 0 — no seek needed', () => {
    expect(pickSeekTarget(PHRASES, 0)).toBeNull();
  });

  it('returns null when phrases array is empty', () => {
    expect(pickSeekTarget([], 2)).toBeNull();
  });

  it('returns null when the target phrase has startTime 0 (already at start)', () => {
    const phrasesAtZero: SyncPhrase[] = [{ index: 0, startTime: 0, endTime: 5 }];
    expect(pickSeekTarget(phrasesAtZero, 0)).toBeNull();
  });

  it('returns the phrase at savedIndex when it has a non-zero startTime', () => {
    const result = pickSeekTarget(PHRASES, 2);
    expect(result).not.toBeNull();
    expect(result?.index).toBe(2);
    expect(result?.startTime).toBe(12);
  });

  it('clamps to last phrase when savedIndex exceeds array length', () => {
    const result = pickSeekTarget(PHRASES, 999);
    expect(result).not.toBeNull();
    expect(result?.index).toBe(3);
    expect(result?.startTime).toBe(20);
  });

  it('seeks to position 1 (first non-start phrase) correctly', () => {
    const result = pickSeekTarget(PHRASES, 1);
    expect(result?.startTime).toBe(5);
  });
});
