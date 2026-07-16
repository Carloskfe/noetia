import { persistTourSeen } from './onboarding';

export const READER_TUTORIAL_STORAGE_KEY = 'noetia_reader_tutorial_seen';

export function hasSeenReaderTutorial(): boolean {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(READER_TUTORIAL_STORAGE_KEY) === '1';
}

export function markReaderTutorialSeen(): void {
  localStorage.setItem(READER_TUTORIAL_STORAGE_KEY, '1');
  persistTourSeen('reader');
}
