import { apiClient } from '../api/client';
import { OfflinePhrase, saveBookMeta, saveChapter } from './book-storage';

interface BookData {
  id: string;
  title: string;
  author: string;
  textFileUrl?: string;
}

interface SyncMapResponse {
  phrases?: OfflinePhrase[];
}

function textToOfflinePhrases(text: string): OfflinePhrase[] {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((text, index) => ({ index, text, startTime: 0, endTime: 0 }));
}

export async function downloadBook(
  bookId: string,
  onProgress?: (status: 'fetching' | 'saving' | 'done' | 'error') => void,
): Promise<void> {
  onProgress?.('fetching');

  const [book, syncMap] = await Promise.all([
    apiClient.get<BookData>(`/books/${bookId}`),
    apiClient.get<SyncMapResponse>(`/books/${bookId}/sync-map`).catch(() => null),
  ]);

  let phrases: OfflinePhrase[];

  if (syncMap?.phrases?.length) {
    phrases = syncMap.phrases as OfflinePhrase[];
  } else if (book.textFileUrl) {
    const text = await fetch(book.textFileUrl).then((r) => r.text());
    phrases = textToOfflinePhrases(text);
  } else {
    onProgress?.('error');
    throw new Error('No content available to download');
  }

  onProgress?.('saving');

  await saveBookMeta({
    id: bookId,
    title: book.title,
    author: book.author,
    chaptersCount: 1,
    downloadedAt: Date.now(),
  });

  await saveChapter({ bookId, chapterIndex: 0, phrases });

  onProgress?.('done');
}
