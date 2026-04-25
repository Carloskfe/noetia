import {
  applyTextSelection,
  addFragment,
  removeFragment,
  replaceFragments,
  EMPTY_SELECTION,
  SelectionState,
} from '../../../lib/fragment-selection';
import { Fragment } from '../../../lib/reader-utils';

// ── helpers ──────────────────────────────────────────────────────────────────

const makeFragment = (id: string, text = 'sample'): Fragment => ({
  id,
  bookId: 'book-1',
  userId: 'user-1',
  text,
  note: null,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
});

// ── applyTextSelection ────────────────────────────────────────────────────────

describe('applyTextSelection', () => {
  it('returns a selection with the trimmed text and showPopover true', () => {
    const result = applyTextSelection('  hello world  ');
    expect(result).toEqual({ text: 'hello world', showPopover: true });
  });

  it('returns EMPTY_SELECTION for blank text', () => {
    expect(applyTextSelection('')).toEqual(EMPTY_SELECTION);
    expect(applyTextSelection('   ')).toEqual(EMPTY_SELECTION);
  });

  it('preserves internal whitespace while trimming edges', () => {
    const result = applyTextSelection('  foo  bar  ');
    expect(result.text).toBe('foo  bar');
  });
});

// ── addFragment ───────────────────────────────────────────────────────────────

describe('addFragment', () => {
  it('appends the new fragment to the list', () => {
    const existing = [makeFragment('a'), makeFragment('b')];
    const result = addFragment(existing, makeFragment('c'));
    expect(result.map((f) => f.id)).toEqual(['a', 'b', 'c']);
  });

  it('handles adding to an empty list', () => {
    const result = addFragment([], makeFragment('a'));
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a');
  });

  it('does not mutate the original array', () => {
    const existing = [makeFragment('a')];
    addFragment(existing, makeFragment('b'));
    expect(existing).toHaveLength(1);
  });
});

// ── removeFragment ────────────────────────────────────────────────────────────

describe('removeFragment', () => {
  it('removes the fragment with the given id', () => {
    const fragments = [makeFragment('a'), makeFragment('b')];
    const result = removeFragment(fragments, 'a');
    expect(result.map((f) => f.id)).toEqual(['b']);
  });

  it('returns the same list when id is not found', () => {
    const fragments = [makeFragment('a')];
    const result = removeFragment(fragments, 'nonexistent');
    expect(result).toHaveLength(1);
  });

  it('handles an empty list gracefully', () => {
    expect(removeFragment([], 'x')).toEqual([]);
  });

  it('does not mutate the original array', () => {
    const fragments = [makeFragment('a'), makeFragment('b')];
    removeFragment(fragments, 'a');
    expect(fragments).toHaveLength(2);
  });
});

// ── replaceFragments ──────────────────────────────────────────────────────────

describe('replaceFragments', () => {
  it('removes combined ids and appends the new fragment', () => {
    const fragments = [makeFragment('a'), makeFragment('b'), makeFragment('c')];
    const combined = makeFragment('d', 'combined');
    const result = replaceFragments(fragments, ['a', 'b'], combined);
    expect(result.map((f) => f.id)).toEqual(['c', 'd']);
  });

  it('handles combining all fragments', () => {
    const fragments = [makeFragment('a'), makeFragment('b')];
    const combined = makeFragment('c', 'combined');
    const result = replaceFragments(fragments, ['a', 'b'], combined);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('c');
  });

  it('does not mutate the original array', () => {
    const fragments = [makeFragment('a'), makeFragment('b')];
    replaceFragments(fragments, ['a', 'b'], makeFragment('c'));
    expect(fragments).toHaveLength(2);
  });
});
