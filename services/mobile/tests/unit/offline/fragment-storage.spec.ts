jest.mock('@react-native-async-storage/async-storage');

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  saveFragment,
  loadFragments,
  markFragmentSynced,
  deleteFragment,
  purgeFragment,
  getUnsyncedFragments,
  type OfflineFragment,
} from '../../../src/offline/fragment-storage';

const mockGet = AsyncStorage.getItem as jest.Mock;
const mockSet = AsyncStorage.setItem as jest.Mock;

const FRAGMENT_A: OfflineFragment = {
  localId: 'local-1',
  bookId: 'book-1',
  text: 'Vivir sin leer es peligroso.',
  chapterIndex: 2,
  createdAt: 1714000000000,
  synced: false,
};

const FRAGMENT_B: OfflineFragment = {
  localId: 'local-2',
  bookId: 'book-2',
  text: 'La lectura es un viaje.',
  chapterIndex: 0,
  createdAt: 1714000001000,
  synced: true,
};

beforeEach(() => {
  mockGet.mockReset();
  mockSet.mockReset();
  mockGet.mockResolvedValue(null);
  mockSet.mockResolvedValue(undefined);
});

describe('saveFragment', () => {
  it('appends a new fragment to an empty store', async () => {
    mockGet.mockResolvedValueOnce(null);
    await saveFragment(FRAGMENT_A);
    expect(mockSet).toHaveBeenCalledWith(
      'noetia_offline_fragments',
      JSON.stringify([FRAGMENT_A]),
    );
  });

  it('updates an existing fragment with the same localId', async () => {
    const updated = { ...FRAGMENT_A, synced: true, serverId: 'srv-1' };
    mockGet.mockResolvedValueOnce(JSON.stringify([FRAGMENT_A]));
    await saveFragment(updated);
    const written = JSON.parse(mockSet.mock.calls[0][1]);
    expect(written).toHaveLength(1);
    expect(written[0].synced).toBe(true);
    expect(written[0].serverId).toBe('srv-1');
  });

  it('appends when localId does not already exist', async () => {
    mockGet.mockResolvedValueOnce(JSON.stringify([FRAGMENT_A]));
    await saveFragment(FRAGMENT_B);
    const written = JSON.parse(mockSet.mock.calls[0][1]);
    expect(written).toHaveLength(2);
  });
});

describe('loadFragments', () => {
  it('returns empty array when nothing is stored', async () => {
    mockGet.mockResolvedValueOnce(null);
    expect(await loadFragments()).toEqual([]);
  });

  it('excludes deleted fragments', async () => {
    const deleted = { ...FRAGMENT_A, deleted: true };
    mockGet.mockResolvedValueOnce(JSON.stringify([deleted, FRAGMENT_B]));
    const result = await loadFragments();
    expect(result).toHaveLength(1);
    expect(result[0].localId).toBe('local-2');
  });

  it('filters by bookId when provided', async () => {
    mockGet.mockResolvedValueOnce(JSON.stringify([FRAGMENT_A, FRAGMENT_B]));
    const result = await loadFragments('book-1');
    expect(result).toHaveLength(1);
    expect(result[0].localId).toBe('local-1');
  });

  it('returns all non-deleted when no bookId provided', async () => {
    mockGet.mockResolvedValueOnce(JSON.stringify([FRAGMENT_A, FRAGMENT_B]));
    expect(await loadFragments()).toHaveLength(2);
  });
});

describe('markFragmentSynced', () => {
  it('sets synced=true and serverId on the matching fragment', async () => {
    mockGet.mockResolvedValueOnce(JSON.stringify([FRAGMENT_A]));
    await markFragmentSynced('local-1', 'srv-99');
    const written = JSON.parse(mockSet.mock.calls[0][1]);
    expect(written[0].synced).toBe(true);
    expect(written[0].serverId).toBe('srv-99');
  });

  it('does nothing when localId is not found', async () => {
    mockGet.mockResolvedValueOnce(JSON.stringify([FRAGMENT_A]));
    await markFragmentSynced('no-such-id', 'srv-99');
    expect(mockSet).not.toHaveBeenCalled();
  });
});

describe('deleteFragment', () => {
  it('marks fragment as deleted and unsynced', async () => {
    const synced = { ...FRAGMENT_A, synced: true, serverId: 'srv-1' };
    mockGet.mockResolvedValueOnce(JSON.stringify([synced]));
    await deleteFragment('local-1');
    const written = JSON.parse(mockSet.mock.calls[0][1]);
    expect(written[0].deleted).toBe(true);
    expect(written[0].synced).toBe(false);
  });

  it('does nothing when localId is not found', async () => {
    mockGet.mockResolvedValueOnce(JSON.stringify([FRAGMENT_A]));
    await deleteFragment('ghost-id');
    expect(mockSet).not.toHaveBeenCalled();
  });
});

describe('purgeFragment', () => {
  it('removes the fragment from the store entirely', async () => {
    mockGet.mockResolvedValueOnce(JSON.stringify([FRAGMENT_A, FRAGMENT_B]));
    await purgeFragment('local-1');
    const written = JSON.parse(mockSet.mock.calls[0][1]);
    expect(written).toHaveLength(1);
    expect(written[0].localId).toBe('local-2');
  });

  it('is a no-op when localId is not found', async () => {
    mockGet.mockResolvedValueOnce(JSON.stringify([FRAGMENT_A]));
    await purgeFragment('ghost-id');
    const written = JSON.parse(mockSet.mock.calls[0][1]);
    expect(written).toHaveLength(1);
  });
});

describe('getUnsyncedFragments', () => {
  it('returns only fragments where synced=false', async () => {
    mockGet.mockResolvedValueOnce(JSON.stringify([FRAGMENT_A, FRAGMENT_B]));
    const result = await getUnsyncedFragments();
    expect(result).toHaveLength(1);
    expect(result[0].localId).toBe('local-1');
  });

  it('includes deleted+unsynced fragments (pending server delete)', async () => {
    const deletedUnsynced = { ...FRAGMENT_A, deleted: true, synced: false };
    mockGet.mockResolvedValueOnce(JSON.stringify([deletedUnsynced]));
    const result = await getUnsyncedFragments();
    expect(result).toHaveLength(1);
    expect(result[0].deleted).toBe(true);
  });

  it('returns empty when all fragments are synced', async () => {
    mockGet.mockResolvedValueOnce(JSON.stringify([FRAGMENT_B]));
    expect(await getUnsyncedFragments()).toEqual([]);
  });
});
