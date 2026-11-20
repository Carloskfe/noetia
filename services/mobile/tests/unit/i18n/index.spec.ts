import React from 'react';
import { act } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  LanguageProvider,
  useTranslation,
  getStoredLanguage,
  hasStoredLanguage,
} from '../../../src/i18n';
import { en } from '../../../src/i18n/en';
import { es } from '../../../src/i18n/es';
import { render, flush, jsonResponse } from '../../support/render';
import { deferred } from '../../support/render-hook';

// LanguageProvider / useTranslation rendered through react-test-renderer (CI-4.1). The real
// provider and apiClient run; only global fetch and AsyncStorage (existing mock) are replaced.

const API = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';
const ME_URL = `${API}/users/me`;
const KEY = 'noetia_lang';

type Ctx = ReturnType<typeof useTranslation>;
let captured: Ctx[] = [];
function Consumer() {
  captured.push(useTranslation());
  return null;
}
const latest = () => captured[captured.length - 1];

type Reply = Response | Error | Promise<Response>;
let meReply: Reply;
const fetchMock = jest.fn();

beforeEach(async () => {
  captured = [];
  meReply = jsonResponse(401, { message: 'Unauthorized' });
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (url === ME_URL && (init?.method ?? 'GET') === 'GET') {
      if (meReply instanceof Error) throw meReply;
      return meReply;
    }
    if (url === ME_URL && init?.method === 'PATCH') return jsonResponse(200, {});
    throw new Error(`Unexpected request: ${init?.method} ${url}`);
  });
  (global as unknown as { fetch: jest.Mock }).fetch = fetchMock;
  await AsyncStorage.removeItem(KEY);
  await AsyncStorage.removeItem('noetia_access_token');
  await AsyncStorage.removeItem('noetia_refresh_token');
  (AsyncStorage.setItem as jest.Mock).mockClear();
});

async function mount() {
  const renderer = render(React.createElement(LanguageProvider, null, React.createElement(Consumer)));
  await flush();
  await flush();
  return renderer;
}

function patchCalls() {
  return fetchMock.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === 'PATCH');
}

describe('useTranslation outside a provider', () => {
  it('defaults to Spanish, not loaded, with a no-op setter', async () => {
    render(React.createElement(Consumer));
    expect(latest()).toMatchObject({ language: 'es', isLoaded: false });
    expect(latest().t).toBe(es);
    await act(async () => { await latest().setLanguage('en'); });
    expect(latest().language).toBe('es');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('LanguageProvider', () => {
  it('defaults to Spanish when nothing is stored and the user is signed out', async () => {
    await mount();
    expect(latest()).toMatchObject({ language: 'es', isLoaded: true });
    expect(latest().t).toBe(es);
  });

  it('starts unloaded until the stored preference is read', async () => {
    render(React.createElement(LanguageProvider, null, React.createElement(Consumer)));
    expect(captured[0].isLoaded).toBe(false);
    await flush();
    await flush();
    expect(latest().isLoaded).toBe(true);
  });

  it('restores a stored English preference', async () => {
    await AsyncStorage.setItem(KEY, 'en');
    await mount();
    expect(latest().language).toBe('en');
    expect(latest().t).toBe(en);
  });

  it('ignores an unsupported stored value', async () => {
    await AsyncStorage.setItem(KEY, 'fr');
    await mount();
    expect(latest()).toMatchObject({ language: 'es', isLoaded: true });
  });

  it('marks itself loaded from local storage before the server answers', async () => {
    await AsyncStorage.setItem(KEY, 'en');
    const pending = deferred<Response>();
    meReply = pending.promise;
    await mount();
    expect(latest()).toMatchObject({ language: 'en', isLoaded: true });
    await act(async () => { pending.resolve(jsonResponse(200, { uiLanguage: 'es' })); });
    await flush();
    expect(latest().language).toBe('es');
  });

  it('lets the server preference win over local storage and persists it', async () => {
    await AsyncStorage.setItem(KEY, 'es');
    meReply = jsonResponse(200, { uiLanguage: 'en' });
    await mount();
    expect(latest().language).toBe('en');
    expect(latest().t).toBe(en);
    expect(await AsyncStorage.getItem(KEY)).toBe('en');
  });

  it('keeps the local preference when the server returns an unsupported language', async () => {
    await AsyncStorage.setItem(KEY, 'en');
    meReply = jsonResponse(200, { uiLanguage: 'de' });
    await mount();
    expect(latest().language).toBe('en');
    expect(await AsyncStorage.getItem(KEY)).toBe('en');
  });

  it('keeps the local preference when the server profile has no language', async () => {
    await AsyncStorage.setItem(KEY, 'en');
    meReply = jsonResponse(200, {});
    await mount();
    expect(latest().language).toBe('en');
  });

  it('keeps the local preference when offline', async () => {
    await AsyncStorage.setItem(KEY, 'en');
    meReply = new TypeError('Network request failed');
    await mount();
    expect(latest()).toMatchObject({ language: 'en', isLoaded: true });
  });

  it('setLanguage switches immediately, persists locally and syncs to the server', async () => {
    await mount();
    await act(async () => { await latest().setLanguage('en'); });
    expect(latest().language).toBe('en');
    expect(latest().t).toBe(en);
    expect(await AsyncStorage.getItem(KEY)).toBe('en');
    await flush();
    const patches = patchCalls();
    expect(patches).toHaveLength(1);
    expect(patches[0][0]).toBe(ME_URL);
    expect(JSON.parse((patches[0][1] as RequestInit).body as string)).toEqual({ uiLanguage: 'en' });
  });

  it('setLanguage keeps the local choice when the server sync fails', async () => {
    await mount();
    fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'));
    await act(async () => { await latest().setLanguage('en'); });
    await flush();
    expect(latest().language).toBe('en');
    expect(await AsyncStorage.getItem(KEY)).toBe('en');
  });
});

describe('stored language helpers', () => {
  it('getStoredLanguage returns en only when English is stored', async () => {
    expect(await getStoredLanguage()).toBe('es');
    await AsyncStorage.setItem(KEY, 'en');
    expect(await getStoredLanguage()).toBe('en');
    await AsyncStorage.setItem(KEY, 'fr');
    expect(await getStoredLanguage()).toBe('es');
  });

  it('hasStoredLanguage is true only for a supported stored value', async () => {
    expect(await hasStoredLanguage()).toBe(false);
    await AsyncStorage.setItem(KEY, 'es');
    expect(await hasStoredLanguage()).toBe(true);
    await AsyncStorage.setItem(KEY, 'en');
    expect(await hasStoredLanguage()).toBe(true);
    await AsyncStorage.setItem(KEY, 'fr');
    expect(await hasStoredLanguage()).toBe(false);
  });
});
