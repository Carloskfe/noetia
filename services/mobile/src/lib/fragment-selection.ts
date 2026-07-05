// Pure logic for multi-phrase fragment selection in the mobile reader.
//
// The reader's "select text" mode used React Native's <Text selectable>, which
// pops the phone's native selection menu (copy / share / …) with no way to save
// a Noetia fragment — the reported bug. Instead we let the user tap phrases to
// build a selection and save them as one fragment, entirely in JS (OTA-safe, no
// native module). These helpers hold the testable logic.

export interface SelectablePhrase {
  index: number;
  text: string;
  type?: 'text' | 'heading' | 'paragraph-break';
}

/** Toggle a phrase index in/out of the selection, kept sorted ascending so the
 *  saved quote reads in document order regardless of tap order. */
export function toggleSelection(selected: number[], index: number): number[] {
  if (selected.includes(index)) return selected.filter((i) => i !== index);
  return [...selected, index].sort((a, b) => a - b);
}

export interface SelectionFragment {
  text: string;
  startPhraseIndex: number;
  endPhraseIndex: number;
}

/**
 * Build one fragment from the selected phrase indices. Joins the chosen phrases'
 * text in reading (index) order — skipping structural markers and blanks — and
 * spans from the lowest to the highest selected index. Returns null when nothing
 * usable is selected (empty selection, or only markers/blank phrases).
 */
export function buildFragmentFromSelection(
  phrases: SelectablePhrase[],
  selectedIndices: number[],
): SelectionFragment | null {
  if (!selectedIndices.length) return null;
  const wanted = new Set(selectedIndices);
  const chosen = phrases.filter(
    (p) =>
      wanted.has(p.index) &&
      p.type !== 'paragraph-break' &&
      p.type !== 'heading' &&
      (p.text ?? '').trim().length > 0,
  );
  if (!chosen.length) return null;

  const text = chosen.map((p) => p.text.trim()).join(' ');
  const indices = chosen.map((p) => p.index);
  return {
    text,
    startPhraseIndex: Math.min(...indices),
    endPhraseIndex: Math.max(...indices),
  };
}
