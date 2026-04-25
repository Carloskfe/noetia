import { Fragment } from './reader-utils';

export type SelectionState = {
  text: string | null;
  showPopover: boolean;
};

export const EMPTY_SELECTION: SelectionState = {
  text: null,
  showPopover: false,
};

export function applyTextSelection(rawText: string): SelectionState {
  const text = rawText.trim();
  if (!text) return EMPTY_SELECTION;
  return { text, showPopover: true };
}

export function addFragment(fragments: Fragment[], created: Fragment): Fragment[] {
  return [...fragments, created];
}

export function removeFragment(fragments: Fragment[], id: string): Fragment[] {
  return fragments.filter((f) => f.id !== id);
}

export function replaceFragments(fragments: Fragment[], ids: string[], combined: Fragment): Fragment[] {
  return [...fragments.filter((f) => !ids.includes(f.id)), combined];
}
