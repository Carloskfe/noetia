// Tests for pure logic extracted from the hook — no expo-av dependency
import type { SyncPhrase } from '../../../src/hooks/useAudioPlayer';

// findActivePhraseIndex — reimplemented here for isolated testing
function findActivePhraseIndex(phrases: SyncPhrase[], positionSecs: number): number {
  let idx = 0;
  for (let i = 0; i < phrases.length; i++) {
    if ((phrases[i].startTime ?? 0) <= positionSecs) idx = i;
    else break;
  }
  return idx;
}

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
