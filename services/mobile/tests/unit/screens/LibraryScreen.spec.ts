import React from 'react';
import { act } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LibraryScreen } from '../../../src/screens/library/LibraryScreen';
import { LanguageProvider } from '../../../src/i18n';
import { render, flush, texts, hosts, pressableWithText, fire, jsonResponse } from '../../support/render';

// LibraryScreen rendered through react-test-renderer (CI-4.0). The real component, the real
// apiClient (src/api/client.ts) and the real i18n layer run; only the network boundary
// (global fetch), AsyncStorage (existing mock) and the navigation hook are replaced.

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

const API = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';
const LIBRARY_URL = `${API}/library`;
const BOOKS_URL = `${API}/books?published=true`;

// Synthetic catalogue (no real user data).
const OWNED = [
  { id: 'b-owned-1', title: 'cien años de soledad', author: 'Gabriel García Márquez', coverUrl: null, isFree: false },
  { id: 'b-owned-2', title: 'Rayuela', author: 'Julio Cortázar', coverUrl: 'https://cdn.test/rayuela.png', isFree: false },
];
const CATALOGUE = [
  { id: 'b-free-1', title: 'Don Juan Tenorio', author: 'José Zorrilla', coverUrl: null, isFree: true },
  { id: 'b-paid-1', title: 'Libro de Pago', author: 'Autora Ficticia', coverUrl: null, isFree: false },
  { id: 'b-free-2', title: 'Marianela', author: 'Benito Pérez Galdós', coverUrl: null, isFree: true },
];

type Reply = Response | Error | Promise<Response>;
let routes: Record<string, Reply | (() => Reply)>;
const fetchMock = jest.fn();

beforeEach(async () => {
  mockNavigate.mockReset();
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string) => {
    const route = routes[url];
    if (route === undefined) throw new Error(`Unexpected request: ${url}`);
    const reply = typeof route === 'function' ? route() : route;
    if (reply instanceof Error) throw reply;
    return reply;
  });
  (global as unknown as { fetch: jest.Mock }).fetch = fetchMock;
  routes = {};
  await AsyncStorage.removeItem('noetia_access_token');
  await AsyncStorage.removeItem('noetia_refresh_token');
  await AsyncStorage.removeItem('noetia_lang');
});

function requestedUrls(): string[] {
  return fetchMock.mock.calls.map(([url]) => url as string);
}

describe('LibraryScreen', () => {
  it('exports a React function component', () => {
    expect(typeof LibraryScreen).toBe('function');
  });
});

describe('LibraryScreen — rendering and loading', () => {
  it('shows only a spinner while both library requests are pending', async () => {
    let resolveLibrary!: (r: Response) => void;
    let resolveBooks!: (r: Response) => void;
    routes[LIBRARY_URL] = () => new Promise<Response>((r) => { resolveLibrary = r; });
    routes[BOOKS_URL] = () => new Promise<Response>((r) => { resolveBooks = r; });

    const screen = render(React.createElement(LibraryScreen));
    await flush();

    expect(hosts(screen, 'ActivityIndicator')).toHaveLength(1);
    expect(hosts(screen, 'SectionList')).toHaveLength(0);
    expect(texts(screen)).toEqual([]);

    resolveLibrary(jsonResponse(200, OWNED));
    resolveBooks(jsonResponse(200, CATALOGUE));
    await flush();

    expect(hosts(screen, 'ActivityIndicator')).toHaveLength(0);
    expect(texts(screen)).toContain('Rayuela');
  });

  it('requests the user library and the published catalogue as the mobile client, with the stored token', async () => {
    await AsyncStorage.setItem('noetia_access_token', 'synthetic-access-token');
    routes[LIBRARY_URL] = jsonResponse(200, []);
    routes[BOOKS_URL] = jsonResponse(200, []);

    render(React.createElement(LibraryScreen));
    await flush();

    expect(requestedUrls().sort()).toEqual([BOOKS_URL, LIBRARY_URL].sort());
    for (const [, init] of fetchMock.mock.calls as [string, RequestInit][]) {
      expect(init.method).toBe('GET');
      expect(init.headers).toEqual({ 'X-Client-Type': 'mobile', Authorization: 'Bearer synthetic-access-token' });
    }
  });
});

describe('LibraryScreen — successful responses', () => {
  it('lists owned books under "Mi Biblioteca" and only free catalogue books under "Colección General"', async () => {
    routes[LIBRARY_URL] = jsonResponse(200, OWNED);
    routes[BOOKS_URL] = jsonResponse(200, CATALOGUE);

    const screen = render(React.createElement(LibraryScreen));
    await flush();

    const visible = texts(screen);
    const mine = visible.indexOf('Mi Biblioteca');
    const general = visible.indexOf('Colección General');
    expect(mine).toBeGreaterThan(-1);
    expect(general).toBeGreaterThan(mine);

    // Each card shows the title initials (first two words), the title and the author.
    expect(visible.slice(mine + 1, general)).toEqual([
      'CA', 'cien años de soledad', 'Gabriel García Márquez',
      'R', 'Rayuela', 'Julio Cortázar',
    ]);
    expect(visible.slice(general + 1)).toEqual([
      'DJ', 'Don Juan Tenorio', 'José Zorrilla',
      'M', 'Marianela', 'Benito Pérez Galdós',
    ]);
    expect(visible).not.toContain('Libro de Pago');
    expect(visible).not.toContain('No hay libros disponibles.');
    expect(visible).not.toContain('No se pudo cargar la biblioteca.');
  });

  it('also accepts a library payload wrapped as { books: [...] }', async () => {
    routes[LIBRARY_URL] = jsonResponse(200, { books: [OWNED[1]] });
    routes[BOOKS_URL] = jsonResponse(200, []);

    const screen = render(React.createElement(LibraryScreen));
    await flush();

    expect(texts(screen)).toEqual(['Biblioteca', 'Mi Biblioteca', 'R', 'Rayuela', 'Julio Cortázar']);
  });

  it('opens the Reader for the tapped book', async () => {
    routes[LIBRARY_URL] = jsonResponse(200, OWNED);
    routes[BOOKS_URL] = jsonResponse(200, CATALOGUE);

    const screen = render(React.createElement(LibraryScreen));
    await flush();
    await fire(pressableWithText(screen, 'Marianela'), 'onPress');

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('Reader', { bookId: 'b-free-2', bookTitle: 'Marianela' });
  });

  it('pull-to-refresh reloads both lists and shows the new content', async () => {
    routes[LIBRARY_URL] = jsonResponse(200, []);
    routes[BOOKS_URL] = jsonResponse(200, []);
    const screen = render(React.createElement(LibraryScreen));
    await flush();
    expect(texts(screen)).toContain('No hay libros disponibles.');

    routes[LIBRARY_URL] = jsonResponse(200, [OWNED[0]]);
    const refresh = hosts(screen, 'RefreshControl')[0];
    expect(refresh.props.refreshing).toBe(false);
    await fire(refresh, 'onRefresh');

    expect(requestedUrls()).toHaveLength(4);
    expect(texts(screen)).toContain('cien años de soledad');
    expect(texts(screen)).not.toContain('No hay libros disponibles.');
    expect(hosts(screen, 'RefreshControl')[0].props.refreshing).toBe(false);
  });

  it('marks the list as refreshing while a pull-to-refresh is in flight', async () => {
    routes[LIBRARY_URL] = jsonResponse(200, OWNED);
    routes[BOOKS_URL] = jsonResponse(200, CATALOGUE);
    const screen = render(React.createElement(LibraryScreen));
    await flush();

    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    routes[LIBRARY_URL] = () => gate.then(() => jsonResponse(200, OWNED));

    // Start the refresh without awaiting it, so the in-flight state can be observed.
    let refreshDone!: Promise<void>;
    await act(async () => {
      refreshDone = hosts(screen, 'RefreshControl')[0].props.onRefresh();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(hosts(screen, 'RefreshControl')[0].props.refreshing).toBe(true);

    await act(async () => {
      release();
      await refreshDone;
    });
    expect(hosts(screen, 'RefreshControl')[0].props.refreshing).toBe(false);
    expect(requestedUrls()).toHaveLength(4);
  });
});

describe('LibraryScreen — empty responses', () => {
  it('shows the empty state and no section headers when both lists are empty', async () => {
    routes[LIBRARY_URL] = jsonResponse(200, []);
    routes[BOOKS_URL] = jsonResponse(200, []);

    const screen = render(React.createElement(LibraryScreen));
    await flush();

    expect(texts(screen)).toEqual(['Biblioteca', 'No hay libros disponibles.']);
  });

  it('treats a catalogue with no free books as empty when the user owns nothing', async () => {
    routes[LIBRARY_URL] = jsonResponse(200, []);
    routes[BOOKS_URL] = jsonResponse(200, [CATALOGUE[1]]);

    const screen = render(React.createElement(LibraryScreen));
    await flush();

    expect(texts(screen)).toEqual(['Biblioteca', 'No hay libros disponibles.']);
  });

  it('falls back to the empty state when the payloads carry no list (wrapper without books, null catalogue)', async () => {
    routes[LIBRARY_URL] = jsonResponse(200, {});
    routes[BOOKS_URL] = jsonResponse(200, null);

    const screen = render(React.createElement(LibraryScreen));
    await flush();

    expect(texts(screen)).toEqual(['Biblioteca', 'No hay libros disponibles.']);
  });
});

describe('LibraryScreen — failed requests', () => {
  it('shows the load error (and not the empty state) when both requests fail', async () => {
    routes[LIBRARY_URL] = jsonResponse(500, { message: 'Internal server error' });
    routes[BOOKS_URL] = new TypeError('Network request failed');

    const screen = render(React.createElement(LibraryScreen));
    await flush();

    expect(hosts(screen, 'ActivityIndicator')).toHaveLength(0);
    expect(texts(screen)).toEqual(['Biblioteca', 'No se pudo cargar la biblioteca.']);
  });

  it('still renders the catalogue, without the error banner, when only the library request fails', async () => {
    routes[LIBRARY_URL] = jsonResponse(500, {});
    routes[BOOKS_URL] = jsonResponse(200, CATALOGUE);

    const screen = render(React.createElement(LibraryScreen));
    await flush();

    const visible = texts(screen);
    expect(visible).not.toContain('Mi Biblioteca');
    expect(visible).toContain('Colección General');
    expect(visible).toContain('Don Juan Tenorio');
    // Existing design: the error banner appears only when BOTH requests fail (see PR notes, O-1).
    expect(visible).not.toContain('No se pudo cargar la biblioteca.');
  });

  it('still renders owned books, without the error banner, when only the catalogue request fails', async () => {
    routes[LIBRARY_URL] = jsonResponse(200, OWNED);
    routes[BOOKS_URL] = new TypeError('Network request failed');

    const screen = render(React.createElement(LibraryScreen));
    await flush();

    const visible = texts(screen);
    expect(visible).toContain('Mi Biblioteca');
    expect(visible).not.toContain('Colección General');
    expect(visible).toContain('Rayuela');
    expect(visible).not.toContain('No se pudo cargar la biblioteca.');
  });

  it('clears the error once a pull-to-refresh succeeds', async () => {
    routes[LIBRARY_URL] = new TypeError('Network request failed');
    routes[BOOKS_URL] = new TypeError('Network request failed');
    const screen = render(React.createElement(LibraryScreen));
    await flush();
    expect(texts(screen)).toContain('No se pudo cargar la biblioteca.');

    routes[LIBRARY_URL] = jsonResponse(200, OWNED);
    routes[BOOKS_URL] = jsonResponse(200, []);
    await fire(hosts(screen, 'RefreshControl')[0], 'onRefresh');

    const visible = texts(screen);
    expect(visible).not.toContain('No se pudo cargar la biblioteca.');
    expect(visible).toContain('Rayuela');
  });
});

describe('LibraryScreen — English UI (real LanguageProvider)', () => {
  it('renders the section titles in English when the stored language is en', async () => {
    await AsyncStorage.setItem('noetia_lang', 'en');
    routes[`${API}/users/me`] = jsonResponse(401, {});
    routes[LIBRARY_URL] = jsonResponse(200, OWNED);
    routes[BOOKS_URL] = jsonResponse(200, CATALOGUE);

    const screen = render(React.createElement(LanguageProvider, null, React.createElement(LibraryScreen)));
    await flush();

    const visible = texts(screen);
    expect(visible).toContain('My Library');
    expect(visible).toContain('General Collection');
    expect(visible).not.toContain('Mi Biblioteca');
  });

  it('renders the empty state in English when the stored language is en', async () => {
    await AsyncStorage.setItem('noetia_lang', 'en');
    routes[`${API}/users/me`] = jsonResponse(401, {});
    routes[LIBRARY_URL] = jsonResponse(200, []);
    routes[BOOKS_URL] = jsonResponse(200, []);

    const screen = render(React.createElement(LanguageProvider, null, React.createElement(LibraryScreen)));
    await flush();

    expect(texts(screen)).toContain('No books available.');
  });
});
