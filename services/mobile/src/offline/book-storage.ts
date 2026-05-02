import AsyncStorage from '@react-native-async-storage/async-storage';

export interface BookMeta {
  id: string;
  title: string;
  author: string;
  chaptersCount: number;
  downloadedAt: number;
}

export interface ChapterContent {
  bookId: string;
  chapterIndex: number;
  phrases: string[];
}

const BOOK_META_KEY = (bookId: string) => `noetia_book_meta_${bookId}`;
const CHAPTER_KEY = (bookId: string, index: number) => `noetia_chapter_${bookId}_${index}`;
const DOWNLOADED_IDS_KEY = 'noetia_downloaded_books';

export async function saveBookMeta(meta: BookMeta): Promise<void> {
  await AsyncStorage.setItem(BOOK_META_KEY(meta.id), JSON.stringify(meta));
  const ids = await getDownloadedBookIds();
  if (!ids.includes(meta.id)) {
    await AsyncStorage.setItem(DOWNLOADED_IDS_KEY, JSON.stringify([...ids, meta.id]));
  }
}

export async function loadBookMeta(bookId: string): Promise<BookMeta | null> {
  try {
    const raw = await AsyncStorage.getItem(BOOK_META_KEY(bookId));
    if (!raw) return null;
    return JSON.parse(raw) as BookMeta;
  } catch {
    return null;
  }
}

export async function saveChapter(chapter: ChapterContent): Promise<void> {
  await AsyncStorage.setItem(
    CHAPTER_KEY(chapter.bookId, chapter.chapterIndex),
    JSON.stringify(chapter),
  );
}

export async function loadChapter(
  bookId: string,
  chapterIndex: number,
): Promise<ChapterContent | null> {
  try {
    const raw = await AsyncStorage.getItem(CHAPTER_KEY(bookId, chapterIndex));
    if (!raw) return null;
    return JSON.parse(raw) as ChapterContent;
  } catch {
    return null;
  }
}

export async function getDownloadedBookIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(DOWNLOADED_IDS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

export async function removeBook(bookId: string): Promise<void> {
  await AsyncStorage.removeItem(BOOK_META_KEY(bookId));
  const ids = await getDownloadedBookIds();
  await AsyncStorage.setItem(
    DOWNLOADED_IDS_KEY,
    JSON.stringify(ids.filter((id) => id !== bookId)),
  );
}
