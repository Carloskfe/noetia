jest.mock('@react-native-async-storage/async-storage');

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  saveProgress,
  loadProgress,
  markProgressSynced,
  getUnsyncedProgress,
  type ReadingProgress,
} from '../../../src/offline/progress-storage';

const mockGet = AsyncStorage.getItem as jest.Mock;
const mockSet = AsyncStorage.setItem as jest.Mock;

const PROGRESS_A: ReadingProgress = {
  bookId: 'book-1',
  chapterIndex: 3,
  phraseIndex: 12,
  updatedAt: 1714000000000,
  synced: false,
};

const PROGRESS_B: ReadingProgress = {
  bookId: 'book-2',
  chapterIndex: 0,
  phraseIndex: 0,
  updatedAt: 1714000001000,
  synced: true,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGet.mockResolvedValue(null);
  mockSet.mockResolvedValue(undefined);
});

describe('saveProgress', () => {
  it('writes progress to its per-book key', async () => {
    mockGet.mockResolvedValueOnce(null); // unsynced ids

    await saveProgress(PROGRESS_A);

    expect(mockSet).toHaveBeenCalledWith(
      'noetia_progress_book-1',
      JSON.stringify(PROGRESS_A),
    );
  });

  it('adds bookId to unsynced list when progress is not synced', async () => {
    mockGet.mockResolvedValueOnce(null); // no existing unsynced ids

    await saveProgress(PROGRESS_A);

    expect(mockSet).toHaveBeenCalledWith(
      'noetia_unsynced_progress',
      JSON.stringify(['book-1']),
    );
  });

  it('does not duplicate bookId in unsynced list', async () => {
    mockGet.mockResolvedValueOnce(JSON.stringify(['book-1']));

    await saveProgress(PROGRESS_A);

    const unsyncedCalls = mockSet.mock.calls.filter(
      ([key]) => key === 'noetia_unsynced_progress',
    );
    expect(unsyncedCalls).toHaveLength(0);
  });

  it('does not add to unsynced list when progress is already synced', async () => {
    await saveProgress(PROGRESS_B);

    const unsyncedCalls = mockSet.mock.calls.filter(
      ([key]) => key === 'noetia_unsynced_progress',
    );
    expect(unsyncedCalls).toHaveLength(0);
  });
});

describe('loadProgress', () => {
  it('returns null when no progress is stored', async () => {
    mockGet.mockResolvedValueOnce(null);
    expect(await loadProgress('book-1')).toBeNull();
  });

  it('returns parsed progress when stored', async () => {
    mockGet.mockResolvedValueOnce(JSON.stringify(PROGRESS_A));
    const result = await loadProgress('book-1');
    expect(result).toMatchObject({ bookId: 'book-1', chapterIndex: 3, phraseIndex: 12 });
  });

  it('returns null on corrupted JSON', async () => {
    mockGet.mockResolvedValueOnce('{invalid');
    expect(await loadProgress('book-1')).toBeNull();
  });
});

describe('markProgressSynced', () => {
  it('updates synced flag and removes bookId from unsynced list', async () => {
    // loadProgress call
    mockGet.mockResolvedValueOnce(JSON.stringify(PROGRESS_A));
    // getUnsyncedProgressIds call
    mockGet.mockResolvedValueOnce(JSON.stringify(['book-1', 'book-2']));

    await markProgressSynced('book-1');

    const progressWrite = mockSet.mock.calls.find(([key]) => key === 'noetia_progress_book-1');
    expect(progressWrite).toBeDefined();
    expect(JSON.parse(progressWrite![1]).synced).toBe(true);

    const unsyncedWrite = mockSet.mock.calls.find(([key]) => key === 'noetia_unsynced_progress');
    expect(JSON.parse(unsyncedWrite![1])).toEqual(['book-2']);
  });

  it('only removes from unsynced list when no progress record exists', async () => {
    mockGet.mockResolvedValueOnce(null); // loadProgress → no record
    mockGet.mockResolvedValueOnce(JSON.stringify(['book-1'])); // unsynced ids

    await markProgressSynced('book-1');

    const unsyncedWrite = mockSet.mock.calls.find(([key]) => key === 'noetia_unsynced_progress');
    expect(JSON.parse(unsyncedWrite![1])).toEqual([]);
  });
});

describe('getUnsyncedProgress', () => {
  it('returns progress records for all unsynced bookIds', async () => {
    // getUnsyncedProgressIds
    mockGet.mockResolvedValueOnce(JSON.stringify(['book-1', 'book-2']));
    // loadProgress('book-1')
    mockGet.mockResolvedValueOnce(JSON.stringify(PROGRESS_A));
    // loadProgress('book-2')
    mockGet.mockResolvedValueOnce(JSON.stringify(PROGRESS_B));

    const result = await getUnsyncedProgress();
    expect(result).toHaveLength(2);
  });

  it('skips bookIds with no stored progress', async () => {
    mockGet.mockResolvedValueOnce(JSON.stringify(['book-1', 'book-ghost']));
    mockGet.mockResolvedValueOnce(JSON.stringify(PROGRESS_A));
    mockGet.mockResolvedValueOnce(null); // book-ghost has no record

    const result = await getUnsyncedProgress();
    expect(result).toHaveLength(1);
    expect(result[0].bookId).toBe('book-1');
  });

  it('returns empty array when no unsynced ids are stored', async () => {
    mockGet.mockResolvedValueOnce(null);
    expect(await getUnsyncedProgress()).toEqual([]);
  });
});
