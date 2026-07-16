jest.mock('../../../lib/onboarding', () => ({ persistTourSeen: jest.fn() }));

import { hasSeenReaderTutorial, markReaderTutorialSeen, READER_TUTORIAL_STORAGE_KEY } from '../../../lib/reader-tutorial';
import { persistTourSeen } from '../../../lib/onboarding';

const mockStorage: Record<string, string> = {};
const localStorageMock = {
  getItem: jest.fn((key: string) => mockStorage[key] ?? null),
  setItem: jest.fn((key: string, value: string) => { mockStorage[key] = value; }),
  removeItem: jest.fn((key: string) => { delete mockStorage[key]; }),
};

beforeEach(() => {
  jest.clearAllMocks();
  Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  Object.defineProperty(global, 'localStorage', { value: localStorageMock, writable: true });
});

describe('hasSeenReaderTutorial', () => {
  it('returns false when the key is not set', () => {
    expect(hasSeenReaderTutorial()).toBe(false);
  });

  it('returns true when the key is set to "1"', () => {
    mockStorage[READER_TUTORIAL_STORAGE_KEY] = '1';
    expect(hasSeenReaderTutorial()).toBe(true);
  });

  it('returns false when the key has any other value', () => {
    mockStorage[READER_TUTORIAL_STORAGE_KEY] = 'true';
    expect(hasSeenReaderTutorial()).toBe(false);
  });

  it('returns true in a server-side (no window) context so tutorial never shows on SSR', () => {
    const windowSpy = jest.spyOn(global, 'window', 'get').mockReturnValue(undefined as any);
    expect(hasSeenReaderTutorial()).toBe(true);
    windowSpy.mockRestore();
  });
});

describe('markReaderTutorialSeen', () => {
  it('writes "1" under the storage key', () => {
    markReaderTutorialSeen();
    expect(localStorageMock.setItem).toHaveBeenCalledWith(READER_TUTORIAL_STORAGE_KEY, '1');
  });

  it('causes hasSeenReaderTutorial to return true afterward', () => {
    markReaderTutorialSeen();
    mockStorage[READER_TUTORIAL_STORAGE_KEY] = '1';
    expect(hasSeenReaderTutorial()).toBe(true);
  });

  it('persists the reader tour as seen server-side', () => {
    markReaderTutorialSeen();
    expect(persistTourSeen).toHaveBeenCalledWith('reader');
  });
});
