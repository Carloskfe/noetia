jest.mock('../../../src/offline/fragment-storage');
jest.mock('../../../src/offline/progress-storage');

import {
  getUnsyncedFragments,
  markFragmentSynced,
  purgeFragment,
} from '../../../src/offline/fragment-storage';
import {
  getUnsyncedProgress,
  markProgressSynced,
} from '../../../src/offline/progress-storage';
import { syncOfflineData, type SyncClient } from '../../../src/offline/sync';
import type { OfflineFragment } from '../../../src/offline/fragment-storage';
import type { ReadingProgress } from '../../../src/offline/progress-storage';

const mockGetUnsyncedFragments = getUnsyncedFragments as jest.Mock;
const mockMarkFragmentSynced = markFragmentSynced as jest.Mock;
const mockPurgeFragment = purgeFragment as jest.Mock;
const mockGetUnsyncedProgress = getUnsyncedProgress as jest.Mock;
const mockMarkProgressSynced = markProgressSynced as jest.Mock;

const makeClient = (overrides: Partial<SyncClient> = {}): SyncClient => ({
  createFragment: jest.fn().mockResolvedValue({ id: 'srv-1' }),
  deleteFragment: jest.fn().mockResolvedValue(undefined),
  updateProgress: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

const FRAGMENT: OfflineFragment = {
  localId: 'local-1',
  bookId: 'book-1',
  text: 'quote text',
  chapterIndex: 1,
  createdAt: 1714000000000,
  synced: false,
};

const PROGRESS: ReadingProgress = {
  bookId: 'book-1',
  chapterIndex: 2,
  phraseIndex: 5,
  updatedAt: 1714000000000,
  synced: false,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUnsyncedFragments.mockResolvedValue([]);
  mockGetUnsyncedProgress.mockResolvedValue([]);
  mockMarkFragmentSynced.mockResolvedValue(undefined);
  mockPurgeFragment.mockResolvedValue(undefined);
  mockMarkProgressSynced.mockResolvedValue(undefined);
});

describe('syncOfflineData — fragments', () => {
  it('creates fragment on server and marks it synced', async () => {
    mockGetUnsyncedFragments.mockResolvedValueOnce([FRAGMENT]);
    const client = makeClient();

    const result = await syncOfflineData(client);

    expect(client.createFragment).toHaveBeenCalledWith({
      bookId: 'book-1',
      text: 'quote text',
      chapterIndex: 1,
      createdAt: 1714000000000,
    });
    expect(mockMarkFragmentSynced).toHaveBeenCalledWith('local-1', 'srv-1');
    expect(result.fragmentsSynced).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  it('deletes fragment on server and purges locally when it has a serverId', async () => {
    const deletedFragment = { ...FRAGMENT, deleted: true, serverId: 'srv-old' };
    mockGetUnsyncedFragments.mockResolvedValueOnce([deletedFragment]);
    const client = makeClient();

    const result = await syncOfflineData(client);

    expect(client.deleteFragment).toHaveBeenCalledWith('srv-old');
    expect(mockPurgeFragment).toHaveBeenCalledWith('local-1');
    expect(result.fragmentsSynced).toBe(0);
  });

  it('purges locally without calling server when deleted fragment has no serverId', async () => {
    const deletedFragment = { ...FRAGMENT, deleted: true };
    mockGetUnsyncedFragments.mockResolvedValueOnce([deletedFragment]);
    const client = makeClient();

    await syncOfflineData(client);

    expect(client.deleteFragment).not.toHaveBeenCalled();
    expect(mockPurgeFragment).toHaveBeenCalledWith('local-1');
  });

  it('records error and continues when createFragment throws', async () => {
    const secondFragment: OfflineFragment = {
      ...FRAGMENT,
      localId: 'local-2',
      text: 'second quote',
    };
    mockGetUnsyncedFragments.mockResolvedValueOnce([FRAGMENT, secondFragment]);
    const client = makeClient({
      createFragment: jest
        .fn()
        .mockRejectedValueOnce(new Error('network error'))
        .mockResolvedValueOnce({ id: 'srv-2' }),
    });

    const result = await syncOfflineData(client);

    expect(result.fragmentsSynced).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('local-1');
    expect(result.errors[0]).toContain('network error');
  });
});

describe('syncOfflineData — progress', () => {
  it('pushes progress to server and marks it synced', async () => {
    mockGetUnsyncedProgress.mockResolvedValueOnce([PROGRESS]);
    const client = makeClient();

    const result = await syncOfflineData(client);

    expect(client.updateProgress).toHaveBeenCalledWith({
      bookId: 'book-1',
      chapterIndex: 2,
      phraseIndex: 5,
      updatedAt: 1714000000000,
    });
    expect(mockMarkProgressSynced).toHaveBeenCalledWith('book-1');
    expect(result.progressSynced).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  it('records error and continues when updateProgress throws', async () => {
    const secondProgress: ReadingProgress = { ...PROGRESS, bookId: 'book-2' };
    mockGetUnsyncedProgress.mockResolvedValueOnce([PROGRESS, secondProgress]);
    const client = makeClient({
      updateProgress: jest
        .fn()
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValueOnce(undefined),
    });

    const result = await syncOfflineData(client);

    expect(result.progressSynced).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('book-1');
    expect(result.errors[0]).toContain('timeout');
  });
});

describe('syncOfflineData — empty queues', () => {
  it('returns zero counts when nothing is queued', async () => {
    const client = makeClient();
    const result = await syncOfflineData(client);

    expect(result).toEqual({ fragmentsSynced: 0, progressSynced: 0, errors: [] });
    expect(client.createFragment).not.toHaveBeenCalled();
    expect(client.updateProgress).not.toHaveBeenCalled();
  });
});
