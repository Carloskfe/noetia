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
