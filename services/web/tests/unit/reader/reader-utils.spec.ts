import { phraseAt, seekToPhrase, Phrase } from '../../../lib/reader-utils';

const phrases: Phrase[] = [
  { index: 0, text: 'Hello world.', startTime: 0, endTime: 2.5 },
  { index: 1, text: 'Second phrase.', startTime: 2.5, endTime: 5.0 },
  { index: 2, text: 'Third phrase.', startTime: 5.0, endTime: 8.0 },
  { index: 3, text: 'Last phrase.', startTime: 8.0, endTime: 12.0 },
];

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

  it('returns -1 when currentTime equals or exceeds the last phrase endTime', () => {
    expect(phraseAt(phrases, 12.0)).toBe(-1);
    expect(phraseAt(phrases, 100)).toBe(-1);
  });

  it('returns correct index at phrase boundary (endTime of one = startTime of next)', () => {
    expect(phraseAt(phrases, 5.0)).toBe(2);
  });
});

describe('seekToPhrase', () => {
  it('returns the startTime of the phrase at the given index', () => {
    expect(seekToPhrase(phrases, 0)).toBe(0);
    expect(seekToPhrase(phrases, 1)).toBe(2.5);
    expect(seekToPhrase(phrases, 3)).toBe(8.0);
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
