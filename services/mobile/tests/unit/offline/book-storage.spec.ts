jest.mock('@react-native-async-storage/async-storage');

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  saveBookMeta,
  loadBookMeta,
  saveChapter,
  loadChapter,
  getDownloadedBookIds,
  removeBook,
  type BookMeta,
  type ChapterContent,
} from '../../../src/offline/book-storage';

const mockGet = AsyncStorage.getItem as jest.Mock;
const mockSet = AsyncStorage.setItem as jest.Mock;
const mockRemove = AsyncStorage.removeItem as jest.Mock;

const META: BookMeta = {
  id: 'book-1',
  title: 'Don Quijote',
  author: 'Cervantes',
  chaptersCount: 10,
  downloadedAt: 1714000000000,
};

const CHAPTER: ChapterContent = {
  bookId: 'book-1',
  chapterIndex: 0,
  phrases: ['En un lugar de la Mancha', 'de cuyo nombre no quiero acordarme'],
};

beforeEach(() => {
  mockGet.mockReset();
  mockSet.mockReset();
  mockRemove.mockReset();
  mockGet.mockResolvedValue(null);
  mockSet.mockResolvedValue(undefined);
  mockRemove.mockResolvedValue(undefined);
});

describe('saveBookMeta', () => {
  it('writes meta and adds id to downloaded list when list is empty', async () => {
    mockGet.mockResolvedValueOnce(null); // getDownloadedBookIds

    await saveBookMeta(META);

    expect(mockSet).toHaveBeenCalledWith(
      `noetia_book_meta_${META.id}`,
      JSON.stringify(META),
    );
    expect(mockSet).toHaveBeenCalledWith(
      'noetia_downloaded_books',
      JSON.stringify([META.id]),
    );
  });

  it('does not duplicate id in downloaded list when already present', async () => {
    mockGet.mockResolvedValueOnce(JSON.stringify([META.id])); // getDownloadedBookIds

    await saveBookMeta(META);

    const idSetCalls = mockSet.mock.calls.filter(
      ([key]) => key === 'noetia_downloaded_books',
    );
    expect(idSetCalls).toHaveLength(0);
  });
});

describe('loadBookMeta', () => {
  it('returns null when no meta is stored', async () => {
    mockGet.mockResolvedValueOnce(null);
    expect(await loadBookMeta('book-1')).toBeNull();
  });

  it('returns parsed meta when stored', async () => {
    mockGet.mockResolvedValueOnce(JSON.stringify(META));
    expect(await loadBookMeta('book-1')).toMatchObject({ id: 'book-1', title: 'Don Quijote' });
  });

  it('returns null on corrupted JSON', async () => {
    mockGet.mockResolvedValueOnce('{bad json');
    expect(await loadBookMeta('book-1')).toBeNull();
  });
});

describe('saveChapter / loadChapter', () => {
  it('saves chapter under the correct key', async () => {
    await saveChapter(CHAPTER);
    expect(mockSet).toHaveBeenCalledWith(
      `noetia_chapter_book-1_0`,
      JSON.stringify(CHAPTER),
    );
  });

  it('returns parsed chapter when stored', async () => {
    mockGet.mockResolvedValueOnce(JSON.stringify(CHAPTER));
    const result = await loadChapter('book-1', 0);
    expect(result).toMatchObject({ bookId: 'book-1', chapterIndex: 0 });
    expect(result?.phrases).toHaveLength(2);
  });

  it('returns null when chapter is not stored', async () => {
    mockGet.mockResolvedValueOnce(null);
    expect(await loadChapter('book-1', 99)).toBeNull();
  });

  it('returns null on corrupted chapter JSON', async () => {
    mockGet.mockResolvedValueOnce('not-json');
    expect(await loadChapter('book-1', 0)).toBeNull();
  });
});

describe('getDownloadedBookIds', () => {
  it('returns empty array when nothing is stored', async () => {
    mockGet.mockResolvedValueOnce(null);
    expect(await getDownloadedBookIds()).toEqual([]);
  });

  it('returns parsed array', async () => {
    mockGet.mockResolvedValueOnce(JSON.stringify(['book-1', 'book-2']));
    expect(await getDownloadedBookIds()).toEqual(['book-1', 'book-2']);
  });

  it('returns empty array on corrupted JSON', async () => {
    mockGet.mockResolvedValueOnce('!!invalid');
    expect(await getDownloadedBookIds()).toEqual([]);
  });
});

describe('removeBook', () => {
  it('removes meta key and filters id from downloaded list', async () => {
    mockGet.mockResolvedValueOnce(JSON.stringify(['book-1', 'book-2'])); // getDownloadedBookIds

    await removeBook('book-1');

    expect(mockRemove).toHaveBeenCalledWith('noetia_book_meta_book-1');
    expect(mockSet).toHaveBeenCalledWith(
      'noetia_downloaded_books',
      JSON.stringify(['book-2']),
    );
  });

  it('handles removing a book not in the downloaded list gracefully', async () => {
    mockGet.mockResolvedValueOnce(JSON.stringify(['book-2'])); // getDownloadedBookIds

    await removeBook('book-1');

    expect(mockSet).toHaveBeenCalledWith('noetia_downloaded_books', JSON.stringify(['book-2']));
  });
});
