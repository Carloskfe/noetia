import { act } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { io } from 'socket.io-client';
import { useClubSession } from '../../../src/hooks/useClubSession';
import { renderHook } from '../../support/render-hook';
import { flush } from '../../support/render';

// useClubSession rendered through react-test-renderer (CI-4.1). socket.io-client (an existing
// dependency) is replaced by a bounded in-memory fake: it records handlers registered with
// on(), emits from the hook, and disconnect() calls, and lets the test deliver server events.
// AsyncStorage is the existing mock. No network, no timers.

interface FakeSocket {
  handlers: Record<string, (payload?: unknown) => void>;
  on: jest.Mock;
  emit: jest.Mock;
  disconnect: jest.Mock;
  serverSends: (event: string, payload?: unknown) => void;
}

const mockSockets: FakeSocket[] = [];
jest.mock('socket.io-client', () => ({
  io: jest.fn(() => {
    const socket: FakeSocket = {
      handlers: {},
      on: jest.fn((event: string, fn: (payload?: unknown) => void) => { socket.handlers[event] = fn; return socket; }),
      emit: jest.fn(),
      disconnect: jest.fn(),
      serverSends: (event, payload) => socket.handlers[event]?.(payload),
    };
    mockSockets.push(socket);
    return socket;
  }),
}));

const ioMock = io as unknown as jest.Mock;
const EXPECTED_BASE = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000').replace('/api', '');

beforeEach(async () => {
  mockSockets.length = 0;
  ioMock.mockClear();
  await AsyncStorage.setItem('noetia_access_token', 'access-test');
  await AsyncStorage.setItem('noetia_user_id', 'u-me');
});

async function mount(sessionId: string | null = 's-1') {
  const hook = renderHook(({ id }: { id: string | null }) => useClubSession(id), { id: sessionId });
  await flush();
  return { ...hook, socket: mockSockets[mockSockets.length - 1] };
}

function server(socket: FakeSocket, event: string, payload?: unknown) {
  act(() => socket.serverSends(event, payload));
}

describe('useClubSession — connection', () => {
  it('opens an authenticated websocket to the sessions namespace', async () => {
    await mount();
    expect(ioMock).toHaveBeenCalledTimes(1);
    expect(ioMock).toHaveBeenCalledWith(`${EXPECTED_BASE}/sessions`, {
      auth: { token: 'Bearer access-test' },
      transports: ['websocket'],
    });
  });

  it('does not connect without a session id', async () => {
    const { result } = await mount(null);
    expect(ioMock).not.toHaveBeenCalled();
    expect(result.current.connected).toBe(false);
  });

  it('does not connect when signed out (no access token)', async () => {
    await AsyncStorage.removeItem('noetia_access_token');
    const { result } = await mount();
    expect(ioMock).not.toHaveBeenCalled();
    expect(result.current.connected).toBe(false);
  });

  it('joins the session on connect and tracks connection state', async () => {
    const { result, socket } = await mount();
    expect(result.current.connected).toBe(false);
    server(socket, 'connect');
    expect(result.current.connected).toBe(true);
    expect(socket.emit).toHaveBeenCalledWith('join-session', { sessionId: 's-1' });
    server(socket, 'disconnect');
    expect(result.current.connected).toBe(false);
  });

  it('disconnects on unmount', async () => {
    const { unmount, socket } = await mount();
    unmount();
    expect(socket.disconnect).toHaveBeenCalledTimes(1);
  });

  it('switching session disconnects the old socket and joins the new one', async () => {
    const { rerender, socket } = await mount('s-1');
    rerender({ id: 's-2' });
    expect(socket.disconnect).toHaveBeenCalledTimes(1);
    await flush();
    expect(mockSockets).toHaveLength(2);
    server(mockSockets[1], 'connect');
    expect(mockSockets[1].emit).toHaveBeenCalledWith('join-session', { sessionId: 's-2' });
  });

  // Regression M-D6 (fixed in PR-A; pinned with `it.failing` by CI-4.1). If the session closes
  // (unmount / sessionId change) before AsyncStorage returns the token, cleanup runs while
  // `socket` is still undefined; the token callback must not then open a socket nobody owns.
  it('M-D6: no socket is opened after unmount, so none is left connected', async () => {
    const hook = renderHook(({ id }: { id: string | null }) => useClubSession(id), { id: 's-1' });
    hook.unmount();
    await flush();
    const leaked = mockSockets.filter((s) => s.disconnect.mock.calls.length === 0);
    expect(leaked).toHaveLength(0);
    expect(ioMock).not.toHaveBeenCalled();
  });

  it('M-D6: leaving the session (id → null) before the token resolves opens no socket', async () => {
    const hook = renderHook(({ id }: { id: string | null }) => useClubSession(id), { id: 's-1' as string | null });
    hook.rerender({ id: null });
    await flush();
    expect(ioMock).not.toHaveBeenCalled();
    expect(hook.result.current.connected).toBe(false);
  });

  it('M-D6: switching session before the token resolves opens exactly one socket, for the new session', async () => {
    const hook = renderHook(({ id }: { id: string | null }) => useClubSession(id), { id: 's-1' });
    hook.rerender({ id: 's-2' });
    await flush();
    expect(ioMock).toHaveBeenCalledTimes(1);
    expect(mockSockets).toHaveLength(1);
    server(mockSockets[0], 'connect');
    expect(mockSockets[0].emit).toHaveBeenCalledWith('join-session', { sessionId: 's-2' });
    expect(mockSockets[0].emit).not.toHaveBeenCalledWith('join-session', { sessionId: 's-1' });
  });
});

describe('useClubSession — server events', () => {
  it('applies the full session state on join', async () => {
    const { result, socket } = await mount();
    server(socket, 'session:state', {
      isPlaying: true, positionMs: 42_000, hostId: 'u-host',
      members: [{ userId: 'u-host', socketId: 'sk-1' }, { userId: 'u-me', socketId: 'sk-2' }],
    });
    expect(result.current.playback).toEqual({ isPlaying: true, positionMs: 42_000, hostId: 'u-host' });
    expect(result.current.members).toHaveLength(2);
  });

  it('merges playback updates without losing the host', async () => {
    const { result, socket } = await mount();
    server(socket, 'session:state', { isPlaying: false, positionMs: 0, hostId: 'u-host', members: [] });
    server(socket, 'playback:state', { isPlaying: true, positionMs: 15_000 });
    expect(result.current.playback).toEqual({ isPlaying: true, positionMs: 15_000, hostId: 'u-host' });
  });

  it('replaces the member list on membership changes', async () => {
    const { result, socket } = await mount();
    server(socket, 'session:members', [{ userId: 'u-2', socketId: 'sk-9' }]);
    expect(result.current.members).toEqual([{ userId: 'u-2', socketId: 'sk-9' }]);
  });

  it('appends chat messages in arrival order', async () => {
    const { result, socket } = await mount();
    const m1 = { id: 'm1', userId: 'u-2', content: 'Hola', createdAt: '2026-11-20T10:00:00Z' };
    const m2 = { id: 'm2', userId: 'u-me', content: '¿Seguimos?', createdAt: '2026-11-20T10:00:05Z' };
    server(socket, 'chat:message', m1);
    server(socket, 'chat:message', m2);
    expect(result.current.messages).toEqual([m1, m2]);
  });

  it('surfaces server errors', async () => {
    const { result, socket } = await mount();
    expect(result.current.error).toBe('');
    server(socket, 'error', { message: 'Session is full' });
    expect(result.current.error).toBe('Session is full');
  });
});

describe('useClubSession — host and controls', () => {
  it('identifies the host by the stored user id', async () => {
    const { result, socket } = await mount();
    expect(result.current.myUserId).toBe('u-me');
    server(socket, 'session:state', { isPlaying: false, positionMs: 0, hostId: 'u-me', members: [] });
    expect(result.current.isHost).toBe(true);
    server(socket, 'session:state', { isPlaying: false, positionMs: 0, hostId: 'u-other', members: [] });
    expect(result.current.isHost).toBe(false);
  });

  it('has an empty user id when none is stored', async () => {
    await AsyncStorage.removeItem('noetia_user_id');
    const { result } = await mount();
    expect(result.current.myUserId).toBe('');
  });

  // DEFECT M-D7 (documented, not fixed in CI-4.1). No mobile code ever writes
  // 'noetia_user_id' (only reads exist: useClubSession, ClubScreen), so in the app myUserId is
  // always ''. Since the initial playback.hostId is also '', every participant is reported as
  // host until session:state arrives — and afterwards nobody is, including the real host
  // (LiveSessionScreen gates host controls on isHost). The hook-level symptom is asserted here.
  it.failing('M-D7: without a known user id, nobody is reported as host before session state', async () => {
    await AsyncStorage.removeItem('noetia_user_id');
    const { result } = await mount();
    expect(result.current.isHost).toBe(false);
  });

  it('play, pause, seek and sendMessage emit scoped to the session', async () => {
    const { result, socket } = await mount();
    act(() => {
      result.current.play(1000);
      result.current.pause(2000);
      result.current.seek(3000);
      result.current.sendMessage('Qué capítulo');
    });
    expect(socket.emit.mock.calls).toEqual([
      ['playback:play', { sessionId: 's-1', positionMs: 1000 }],
      ['playback:pause', { sessionId: 's-1', positionMs: 2000 }],
      ['playback:seek', { sessionId: 's-1', positionMs: 3000 }],
      ['chat:message', { sessionId: 's-1', content: 'Qué capítulo' }],
    ]);
  });

  it('controls are no-ops when there is no socket', async () => {
    await AsyncStorage.removeItem('noetia_access_token');
    const { result } = await mount();
    expect(() => act(() => {
      result.current.play();
      result.current.pause();
      result.current.seek(0);
      result.current.sendMessage('x');
    })).not.toThrow();
  });
});
