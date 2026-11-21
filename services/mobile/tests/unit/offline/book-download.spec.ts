import AsyncStorage from '@react-native-async-storage/async-storage';
import { downloadBook } from '../../../src/offline/book-download';
import { loadBookMeta, loadChapter, isBookDownloaded } from '../../../src/offline/book-storage';
import { jsonResponse } from '../../support/render';

// downloadBook with the real apiClient and real book-storage (CI-4.1). Only global fetch and
// AsyncStorage (existing mock) are replaced. Synthetic book data.

const API = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';
const BOOK_ID = 'b-dl-1';
const BOOK_URL = `${API}/books/${BOOK_ID}`;
const SYNC_URL = `${API}/books/${BOOK_ID}/sync-map`;
const TEXT_URL = 'https://storage.test/books/b-dl-1.txt';

type Reply = Response | Error;
let routes: Record<string, Reply>;
const fetchMock = jest.fn();

function textResponse(body: string): Response {
  return { ok: true, status: 200, text: async () => body } as unknown as Response;
}

beforeEach(async () => {
  routes = {};
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string) => {
    const reply = routes[url];
    if (reply === undefined) throw new Error(`Unexpected request: ${url}`);
    if (reply instanceof Error) throw reply;
    return reply;
  });
  (global as unknown as { fetch: jest.Mock }).fetch = fetchMock;
  await AsyncStorage.removeItem(`noetia_book_meta_${BOOK_ID}`);
  await AsyncStorage.removeItem(`noetia_chapter_${BOOK_ID}_0`);
  jest.spyOn(Date, 'now').mockReturnValue(1_750_000_000_000);
});

afterEach(() => jest.restoreAllMocks());

const BOOK = { id: BOOK_ID, title: 'Marianela', author: 'Benito Pérez Galdós', textFileUrl: TEXT_URL };
const SYNC_PHRASES = [
  { index: 0, text: 'Se puso el sol.', startTime: 0, endTime: 2.5 },
  { index: 1, text: 'Tras el breve crepúsculo…', startTime: 2.5, endTime: 6 },
];

describe('downloadBook', () => {
  it('stores the timed sync-map phrases and reports fetching → saving → done', async () => {
    routes[BOOK_URL] = jsonResponse(200, BOOK);
    routes[SYNC_URL] = jsonResponse(200, { phrases: SYNC_PHRASES });
    const progress = jest.fn();

    await downloadBook(BOOK_ID, progress);

    expect(progress.mock.calls.map(([s]) => s)).toEqual(['fetching', 'saving', 'done']);
    expect(await loadBookMeta(BOOK_ID)).toEqual({
      id: BOOK_ID, title: 'Marianela', author: 'Benito Pérez Galdós', chaptersCount: 1, downloadedAt: 1_750_000_000_000,
    });
    expect(await loadChapter(BOOK_ID, 0)).toEqual({ bookId: BOOK_ID, chapterIndex: 0, phrases: SYNC_PHRASES });
    expect(fetchMock.mock.calls.map(([u]) => u)).not.toContain(TEXT_URL);
  });

  it('falls back to the plain text, split into paragraphs, when the sync map is empty', async () => {
    routes[BOOK_URL] = jsonResponse(200, BOOK);
    routes[SYNC_URL] = jsonResponse(200, { phrases: [] });
    routes[TEXT_URL] = textResponse('  Primer párrafo.  \n\n\n\nSegundo\npárrafo.\n\n   \n\nTercero.\n');

    await downloadBook(BOOK_ID);

    const chapter = await loadChapter(BOOK_ID, 0);
    expect(chapter?.phrases).toEqual([
      { index: 0, text: 'Primer párrafo.', startTime: 0, endTime: 0 },
      { index: 1, text: 'Segundo\npárrafo.', startTime: 0, endTime: 0 },
      { index: 2, text: 'Tercero.', startTime: 0, endTime: 0 },
    ]);
  });

  it('falls back to the plain text when the sync map request fails', async () => {
    routes[BOOK_URL] = jsonResponse(200, BOOK);
    routes[SYNC_URL] = jsonResponse(404, { message: 'Not found' });
    routes[TEXT_URL] = textResponse('Único párrafo.');

    await downloadBook(BOOK_ID);

    expect((await loadChapter(BOOK_ID, 0))?.phrases).toEqual([
      { index: 0, text: 'Único párrafo.', startTime: 0, endTime: 0 },
    ]);
  });

  it('falls back to the plain text when the sync map has no phrases field', async () => {
    routes[BOOK_URL] = jsonResponse(200, BOOK);
    routes[SYNC_URL] = jsonResponse(200, {});
    routes[TEXT_URL] = textResponse('Texto.');
    await downloadBook(BOOK_ID);
    expect((await loadChapter(BOOK_ID, 0))?.phrases).toHaveLength(1);
  });

  it('fails with an error status and saves nothing when no content exists', async () => {
    routes[BOOK_URL] = jsonResponse(200, { id: BOOK_ID, title: 'Sin texto', author: 'Anónimo' });
    routes[SYNC_URL] = jsonResponse(200, { phrases: [] });
    const progress = jest.fn();

    await expect(downloadBook(BOOK_ID, progress)).rejects.toThrow('No content available to download');

    expect(progress.mock.calls.map(([s]) => s)).toEqual(['fetching', 'error']);
    expect(await isBookDownloaded(BOOK_ID)).toBe(false);
  });

  it('rejects and saves nothing when the book itself cannot be fetched', async () => {
    routes[BOOK_URL] = jsonResponse(403, { message: 'Forbidden' });
    routes[SYNC_URL] = jsonResponse(200, { phrases: SYNC_PHRASES });

    await expect(downloadBook(BOOK_ID)).rejects.toThrow('Forbidden');
    expect(await isBookDownloaded(BOOK_ID)).toBe(false);
  });

  it('works without a progress callback', async () => {
    routes[BOOK_URL] = jsonResponse(200, BOOK);
    routes[SYNC_URL] = jsonResponse(200, { phrases: SYNC_PHRASES });
    await expect(downloadBook(BOOK_ID)).resolves.toBeUndefined();
    expect(await isBookDownloaded(BOOK_ID)).toBe(true);
  });
});
