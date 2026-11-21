import { clubsApi } from '../../../lib/clubs';

// Exercises the clubs API wrapper through the REAL apiFetch (lib/api.ts); only the network
// boundary (global fetch) and localStorage are mocked. Each call is checked for the exact URL,
// HTTP method, JSON body, auth header and the value it resolves with.

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

const store: Record<string, string> = {};
const fetchMock = jest.fn();

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response;
}

beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);
  Object.defineProperty(global, 'localStorage', {
    value: {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
    },
    writable: true,
    configurable: true,
  });
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));
  (global as unknown as { fetch: jest.Mock }).fetch = fetchMock;
});

/** URL, method and parsed body of the single request that was made. */
function request() {
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  return {
    url,
    method: init.method ?? 'GET',
    body: init.body === undefined ? undefined : JSON.parse(init.body as string),
    headers: init.headers as Record<string, string>,
    credentials: init.credentials,
  };
}

type Case = [name: string, call: () => Promise<unknown>, path: string, method: string, body?: unknown];

const CASES: Case[] = [
  // Clubs
  ['get', () => clubsApi.get('c1'), '/clubs/c1', 'GET'],
  ['create', () => clubsApi.create({ name: 'Lectores', type: 'public', bookId: 'b1', approvalRequired: true }),
    '/clubs', 'POST', { name: 'Lectores', type: 'public', bookId: 'b1', approvalRequired: true }],
  ['update', () => clubsApi.update('c1', { name: 'Nuevo nombre' }), '/clubs/c1', 'PATCH', { name: 'Nuevo nombre' }],
  ['delete', () => clubsApi.delete('c1'), '/clubs/c1', 'DELETE'],
  // Members
  ['join', () => clubsApi.join('c1'), '/clubs/c1/join', 'POST'],
  ['leave', () => clubsApi.leave('c1'), '/clubs/c1/members/me', 'DELETE'],
  ['getMembers', () => clubsApi.getMembers('c1'), '/clubs/c1/members', 'GET'],
  ['generateInvite', () => clubsApi.generateInvite('c1'), '/clubs/c1/invite', 'POST'],
  ['acceptInvite', () => clubsApi.acceptInvite('c1', 'inv-tok'), '/clubs/c1/accept', 'POST', { token: 'inv-tok' }],
  ['updateRole', () => clubsApi.updateRole('c1', 'u2', 'moderator'), '/clubs/c1/members/u2/role', 'PATCH', { role: 'moderator' }],
  ['removeMember (ban)', () => clubsApi.removeMember('c1', 'u2', true), '/clubs/c1/members/u2', 'DELETE', { ban: true }],
  ['removeMember (no ban)', () => clubsApi.removeMember('c1', 'u2', false), '/clubs/c1/members/u2', 'DELETE', { ban: false }],
  ['updateNotifications', () => clubsApi.updateNotifications('c1', { notifNewBook: false, notifSession: true }),
    '/clubs/c1/notifications', 'PATCH', { notifNewBook: false, notifSession: true }],
  // Books
  ['getBooks', () => clubsApi.getBooks('c1'), '/clubs/c1/books', 'GET'],
  ['addBook', () => clubsApi.addBook('c1', 'b9'), '/clubs/c1/books', 'POST', { bookId: 'b9' }],
  ['activateBook', () => clubsApi.activateBook('c1', 'b9'), '/clubs/c1/books/b9/activate', 'PATCH'],
  // Messages
  ['sendMessage', () => clubsApi.sendMessage('c1', 'Hola a todos'), '/clubs/c1/messages', 'POST', { content: 'Hola a todos' }],
  ['deleteMessage', () => clubsApi.deleteMessage('c1', 'm7'), '/clubs/c1/messages/m7', 'DELETE'],
  // Discussions
  ['postDiscussion', () => clubsApi.postDiscussion('c1', { bookId: 'b1', phraseIndex: 42, content: 'Gran frase' }),
    '/clubs/c1/discussions', 'POST', { bookId: 'b1', phraseIndex: 42, content: 'Gran frase' }],
  ['deleteDiscussion', () => clubsApi.deleteDiscussion('c1', 'd3'), '/clubs/c1/discussions/d3', 'DELETE'],
  // Polls
  ['getPolls', () => clubsApi.getPolls('c1'), '/clubs/c1/polls', 'GET'],
  ['createPoll', () => clubsApi.createPoll('c1', { question: '¿Próximo libro?', bookIds: ['b1', 'b2'], closesAt: '2026-12-01T00:00:00Z' }),
    '/clubs/c1/polls', 'POST', { question: '¿Próximo libro?', bookIds: ['b1', 'b2'], closesAt: '2026-12-01T00:00:00Z' }],
  ['vote', () => clubsApi.vote('c1', 'p1', 'o2'), '/clubs/c1/polls/p1/vote', 'POST', { optionId: 'o2' }],
  ['closePoll', () => clubsApi.closePoll('c1', 'p1'), '/clubs/c1/polls/p1/close', 'POST'],
  // Sessions
  ['getSessions', () => clubsApi.getSessions('c1'), '/clubs/c1/sessions', 'GET'],
  ['createSession', () => clubsApi.createSession('c1', { bookId: 'b1', title: 'Escucha Juntos', scheduledAt: '2026-12-05T19:00:00Z', startPhraseIndex: 0, endPhraseIndex: 150 }),
    '/clubs/c1/sessions', 'POST', { bookId: 'b1', title: 'Escucha Juntos', scheduledAt: '2026-12-05T19:00:00Z', startPhraseIndex: 0, endPhraseIndex: 150 }],
  ['cancelSession', () => clubsApi.cancelSession('c1', 's4'), '/clubs/c1/sessions/s4', 'DELETE'],
];

describe('clubsApi endpoints', () => {
  // Rest parameters: rows without a body have 4 elements, and a fixed 5-parameter callback would be
  // mistaken by Jest for a `done`-style test.
  it.each(CASES)('%s → exact URL, method and JSON body', async (...row: Case) => {
    const [, call, path, method, body] = row;
    await call();
    const req = request();
    expect(req.url).toBe(`${API_URL}${path}`);
    expect(req.method).toBe(method);
    expect(req.body).toEqual(body);
    expect(req.headers['Content-Type']).toBe('application/json');
    expect(req.credentials).toBe('include');
  });
});

describe('clubsApi query strings', () => {
  it('list() without params requests /clubs with no query string', async () => {
    await clubsApi.list();
    expect(request().url).toBe(`${API_URL}/clubs`);
  });

  it('list() URL-encodes every provided filter', async () => {
    await clubsApi.list({ search: 'Cien años & más', bookId: 'b1', sort: 'members' });
    const url = new URL(request().url);
    expect(url.pathname).toBe('/clubs');
    expect(url.searchParams.get('search')).toBe('Cien años & más');
    expect(url.searchParams.get('bookId')).toBe('b1');
    expect(url.searchParams.get('sort')).toBe('members');
    expect(url.search).toBe('?search=Cien+a%C3%B1os+%26+m%C3%A1s&bookId=b1&sort=members');
  });

  it('getMessages() pages backwards only when a cursor is given', async () => {
    await clubsApi.getMessages('c1');
    expect(request().url).toBe(`${API_URL}/clubs/c1/messages`);
    fetchMock.mockClear();
    await clubsApi.getMessages('c1', '2026-11-19T10:00:00.000Z');
    expect(request().url).toBe(`${API_URL}/clubs/c1/messages?before=2026-11-19T10:00:00.000Z`);
  });

  it('getDiscussions() adds only the phrase bounds that are provided (0 is a valid bound)', async () => {
    await clubsApi.getDiscussions('c1', 'b1');
    expect(request().url).toBe(`${API_URL}/clubs/c1/discussions/b1`);

    fetchMock.mockClear();
    await clubsApi.getDiscussions('c1', 'b1', 0, 25);
    expect(request().url).toBe(`${API_URL}/clubs/c1/discussions/b1?phraseFrom=0&phraseTo=25`);

    fetchMock.mockClear();
    await clubsApi.getDiscussions('c1', 'b1', 10);
    expect(request().url).toBe(`${API_URL}/clubs/c1/discussions/b1?phraseFrom=10`);

    fetchMock.mockClear();
    await clubsApi.getDiscussions('c1', 'b1', undefined, 30);
    expect(request().url).toBe(`${API_URL}/clubs/c1/discussions/b1?phraseTo=30`);
  });
});

describe('clubsApi responses and errors', () => {
  it('resolves with the parsed JSON body from the API', async () => {
    const club = { id: 'c1', name: 'Lectores', type: 'public', owner: { id: 'u1', name: 'Ana' } };
    fetchMock.mockResolvedValueOnce(jsonResponse(200, club));
    await expect(clubsApi.get('c1')).resolves.toEqual(club);

    const members = [{ id: 'm1', role: 'admin', user: { id: 'u1', name: 'Ana' } }];
    fetchMock.mockResolvedValueOnce(jsonResponse(200, members));
    await expect(clubsApi.getMembers('c1')).resolves.toEqual(members);

    fetchMock.mockResolvedValueOnce(jsonResponse(201, { url: 'https://noetia.test/clubs/c1/join?token=t' }));
    await expect(clubsApi.generateInvite('c1')).resolves.toEqual({ url: 'https://noetia.test/clubs/c1/join?token=t' });
  });

  it('sends the stored access token as a Bearer header', async () => {
    store.access_token = 'synthetic-access-token';
    await clubsApi.join('c1');
    expect(request().headers.Authorization).toBe('Bearer synthetic-access-token');
  });

  it('propagates API errors with the server message, status and payload', async () => {
    const payload = { message: 'Club is full', statusCode: 409 };
    fetchMock.mockResolvedValueOnce(jsonResponse(409, payload));
    await expect(clubsApi.join('c1')).rejects.toMatchObject({ message: 'Club is full', status: 409, data: payload });
  });

  it('propagates a generic error when the API returns no message', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(500, {}));
    await expect(clubsApi.vote('c1', 'p1', 'o1')).rejects.toMatchObject({ message: 'Request failed', status: 500 });
  });

  it('propagates network failures unchanged', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(clubsApi.getPolls('c1')).rejects.toThrow('Failed to fetch');
  });
});
