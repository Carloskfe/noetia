import {
  toggleSelection,
  buildFragmentFromSelection,
  SelectablePhrase,
} from '../../../src/lib/fragment-selection';

describe('toggleSelection', () => {
  it('adds an index when not present', () => {
    expect(toggleSelection([], 3)).toEqual([3]);
  });

  it('removes an index when already present', () => {
    expect(toggleSelection([1, 3, 5], 3)).toEqual([1, 5]);
  });

  it('keeps the selection sorted ascending regardless of tap order', () => {
    expect(toggleSelection([5, 1], 3)).toEqual([1, 3, 5]);
  });

  it('does not mutate the input array', () => {
    const input = [1, 2];
    toggleSelection(input, 3);
    expect(input).toEqual([1, 2]);
  });
});

describe('buildFragmentFromSelection', () => {
  const phrases: SelectablePhrase[] = [
    { index: 0, text: 'First phrase.', type: 'text' },
    { index: 1, text: 'CHAPTER II', type: 'heading' },
    { index: 2, text: 'Second phrase.', type: 'text' },
    { index: 3, text: '', type: 'paragraph-break' },
    { index: 4, text: 'Third phrase.', type: 'text' },
  ];

  it('returns null for an empty selection', () => {
    expect(buildFragmentFromSelection(phrases, [])).toBeNull();
  });

  it('builds a single-phrase fragment', () => {
    expect(buildFragmentFromSelection(phrases, [2])).toEqual({
      text: 'Second phrase.',
      startPhraseIndex: 2,
      endPhraseIndex: 2,
    });
  });

  it('joins multiple phrases in document order and spans their indices', () => {
    expect(buildFragmentFromSelection(phrases, [4, 0, 2])).toEqual({
      text: 'First phrase. Second phrase. Third phrase.',
      startPhraseIndex: 0,
      endPhraseIndex: 4,
    });
  });

  it('skips paragraph-break markers but still spans the selected range', () => {
    expect(buildFragmentFromSelection(phrases, [2, 3, 4])).toEqual({
      text: 'Second phrase. Third phrase.',
      startPhraseIndex: 2,
      endPhraseIndex: 4,
    });
  });

  it('returns null when only markers / blank phrases are selected', () => {
    expect(buildFragmentFromSelection(phrases, [1, 3])).toBeNull();
  });
});
