import React from 'react';
import { act } from 'react-test-renderer';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DownloadButton } from '../../../src/components/DownloadButton';
import { loadBookMeta, saveBookMeta, isBookDownloaded } from '../../../src/offline/book-storage';
import { es } from '../../../src/i18n/es';
import { render, flush, hosts, fire, jsonResponse } from '../../support/render';
import { deferred } from '../../support/render-hook';

// DownloadButton rendered through react-test-renderer (CI-4.1) with the real downloadBook,
// book-storage and apiClient. Only global fetch, AsyncStorage and Alert (existing mocks) are
// replaced. No LanguageProvider → the default (Spanish) translations apply.

const API = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';
const BOOK_ID = 'b-btn-1';
const alertMock = Alert.alert as jest.Mock;
const fetchMock = jest.fn();
let bookReply: Response | Promise<Response>;

beforeEach(async () => {
  alertMock.mockReset();
  bookReply = jsonResponse(200, { id: BOOK_ID, title: 'Rayuela', author: 'Julio Cortázar' });
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string) => {
    if (url === `${API}/books/${BOOK_ID}`) return bookReply;
    if (url === `${API}/books/${BOOK_ID}/sync-map`)
      return jsonResponse(200, { phrases: [{ index: 0, text: 'Andábamos sin buscarnos.', startTime: 0, endTime: 3 }] });
    throw new Error(`Unexpected request: ${url}`);
  });
  (global as unknown as { fetch: jest.Mock }).fetch = fetchMock;
  await AsyncStorage.removeItem(`noetia_book_meta_${BOOK_ID}`);
  await AsyncStorage.removeItem(`noetia_chapter_${BOOK_ID}_0`);
});

async function mount() {
  const renderer = render(React.createElement(DownloadButton, { bookId: BOOK_ID }));
  await flush();
  return renderer;
}

const button = (r: ReturnType<typeof render>) => {
  const [b] = hosts(r, 'TouchableOpacity');
  return b;
};

describe('DownloadButton', () => {
  it('offers a download when the book is not on the device', async () => {
    const r = await mount();
    expect(button(r).props.accessibilityLabel).toBe(es.download.download);
  });

  it('shows the downloaded state when the book is already stored', async () => {
    await saveBookMeta({ id: BOOK_ID, title: 'Rayuela', author: 'Julio Cortázar', chaptersCount: 1, downloadedAt: 1 });
    const r = await mount();
    expect(button(r).props.accessibilityLabel).toBe(es.download.downloaded);
  });

  it('shows a spinner while downloading, then the downloaded state', async () => {
    const pending = deferred<Response>();
    bookReply = pending.promise;
    const r = await mount();
    const press = fire(button(r), 'onPress');
    await flush();
    expect(hosts(r, 'ActivityIndicator')).toHaveLength(1);
    expect(hosts(r, 'TouchableOpacity')).toHaveLength(0);

    pending.resolve(jsonResponse(200, { id: BOOK_ID, title: 'Rayuela', author: 'Julio Cortázar' }));
    await press;
    await flush();
    expect(hosts(r, 'ActivityIndicator')).toHaveLength(0);
    expect(button(r).props.accessibilityLabel).toBe(es.download.downloaded);
    expect(await isBookDownloaded(BOOK_ID)).toBe(true);
  });

  it('shows the error state when the download fails, and allows a retry', async () => {
    bookReply = jsonResponse(500, { message: 'down' });
    const r = await mount();
    await fire(button(r), 'onPress');
    await flush();
    expect(button(r).props.accessibilityLabel).toBe(es.download.error);

    bookReply = jsonResponse(200, { id: BOOK_ID, title: 'Rayuela', author: 'Julio Cortázar' });
    await fire(button(r), 'onPress');
    await flush();
    expect(button(r).props.accessibilityLabel).toBe(es.download.downloaded);
  });

  it('asks before deleting a download, and cancelling keeps it', async () => {
    await saveBookMeta({ id: BOOK_ID, title: 'Rayuela', author: 'Julio Cortázar', chaptersCount: 1, downloadedAt: 1 });
    const r = await mount();
    await fire(button(r), 'onPress');
    expect(alertMock).toHaveBeenCalledTimes(1);
    const [title, message, buttons] = alertMock.mock.calls[0] as [string, string, Array<{ text: string; style: string; onPress?: () => Promise<void> }>];
    expect(title).toBe(es.download.deleteTitle);
    expect(message).toBe(es.download.deleteConfirm);
    expect(buttons.map((b) => [b.text, b.style])).toEqual([
      [es.download.cancel, 'cancel'],
      [es.download.delete, 'destructive'],
    ]);
    expect(buttons[0].onPress).toBeUndefined();
    expect(await loadBookMeta(BOOK_ID)).not.toBeNull();
  });

  it('confirming the delete removes the book and returns to the download state', async () => {
    await saveBookMeta({ id: BOOK_ID, title: 'Rayuela', author: 'Julio Cortázar', chaptersCount: 1, downloadedAt: 1 });
    const r = await mount();
    await fire(button(r), 'onPress');
    const buttons = alertMock.mock.calls[0][2] as Array<{ onPress?: () => Promise<void> }>;
    await act(async () => { await buttons[1].onPress?.(); });
    expect(await isBookDownloaded(BOOK_ID)).toBe(false);
    expect(button(r).props.accessibilityLabel).toBe(es.download.download);
  });
});
