import NetInfo from '@react-native-community/netinfo';
import * as sync from '../../../src/offline/sync';
import { useNetworkSync } from '../../../src/hooks/useNetworkSync';
import type { SyncClient } from '../../../src/offline/sync';
import { renderHook } from '../../support/render-hook';
import { flush, jsonResponse } from '../../support/render';
import { act } from 'react-test-renderer';

jest.mock('../../../src/offline/sync', () => ({ syncOfflineData: jest.fn() }));

const mockSyncOfflineData = sync.syncOfflineData as jest.Mock;

// Simulate the event handler logic directly — same logic as useNetworkSync.ts
// but without needing a React renderer.
function makeHandler(onSync: () => void) {
  let wasOffline: boolean | null = null;
  return (state: { isConnected: boolean | null; isInternetReachable: boolean | null }) => {
    const isOnline = !!(state.isConnected && state.isInternetReachable);
    if (wasOffline === true && isOnline) onSync();
    wasOffline = !isOnline;
  };
}

describe('network sync handler logic', () => {
  beforeEach(() => jest.clearAllMocks());

  it('does not sync on first event (no prior state)', () => {
    const onSync = jest.fn();
    const handler = makeHandler(onSync);
    handler({ isConnected: true, isInternetReachable: true });
    expect(onSync).not.toHaveBeenCalled();
  });

  it('triggers sync on offline → online transition', () => {
    const onSync = jest.fn();
    const handler = makeHandler(onSync);
    handler({ isConnected: false, isInternetReachable: false });
    handler({ isConnected: true, isInternetReachable: true });
    expect(onSync).toHaveBeenCalledTimes(1);
  });

  it('does not sync when staying online', () => {
    const onSync = jest.fn();
    const handler = makeHandler(onSync);
    handler({ isConnected: true, isInternetReachable: true });
    handler({ isConnected: true, isInternetReachable: true });
    expect(onSync).not.toHaveBeenCalled();
  });

  it('syncs again on second offline → online cycle', () => {
    const onSync = jest.fn();
    const handler = makeHandler(onSync);
    handler({ isConnected: false, isInternetReachable: false });
    handler({ isConnected: true, isInternetReachable: true });
    handler({ isConnected: false, isInternetReachable: false });
    handler({ isConnected: true, isInternetReachable: true });
    expect(onSync).toHaveBeenCalledTimes(2);
  });

  it('treats null connectivity as offline', () => {
    const onSync = jest.fn();
    const handler = makeHandler(onSync);
    handler({ isConnected: null, isInternetReachable: null });
    handler({ isConnected: true, isInternetReachable: true });
    expect(onSync).toHaveBeenCalledTimes(1);
  });
});

// ── useNetworkSync hook behaviour (CI-4.1) ───────────────────────────────────────────────
// The real hook renders through react-test-renderer. NetInfo is the existing mock; the
// listener the hook registers is captured and driven directly. syncOfflineData is mocked
// above, so the SyncClient the hook builds is captured and exercised against the real
// apiClient with only global fetch replaced.

type NetState = { isConnected: boolean | null; isInternetReachable: boolean | null };
const addEventListener = NetInfo.addEventListener as unknown as jest.Mock;
const API = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';
const ONLINE: NetState = { isConnected: true, isInternetReachable: true };
const OFFLINE: NetState = { isConnected: false, isInternetReachable: false };

describe('useNetworkSync hook', () => {
  let unsubscribe: jest.Mock;
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    unsubscribe = jest.fn();
    addEventListener.mockImplementation(() => unsubscribe);
    mockSyncOfflineData.mockResolvedValue({ fragmentsSynced: 0, progressSynced: 0, errors: [] });
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(jsonResponse(200, { id: 'srv-1' }));
    (global as unknown as { fetch: jest.Mock }).fetch = fetchMock;
  });

  function mount() {
    const hook = renderHook(() => useNetworkSync(), undefined);
    const listener = addEventListener.mock.calls[0][0] as (s: NetState) => void;
    const emit = (s: NetState) => act(() => listener(s));
    return { ...hook, emit };
  }

  it('subscribes to connectivity once and keeps the subscription across re-renders', () => {
    const { rerender } = mount();
    rerender(undefined);
    expect(addEventListener).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes on unmount', () => {
    const { unmount } = mount();
    expect(unsubscribe).not.toHaveBeenCalled();
    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('does not sync when the app starts online', () => {
    const { emit } = mount();
    emit(ONLINE);
    emit(ONLINE);
    expect(mockSyncOfflineData).not.toHaveBeenCalled();
  });

  it('syncs exactly once on each offline → online transition', () => {
    const { emit } = mount();
    emit(OFFLINE);
    emit(OFFLINE);
    expect(mockSyncOfflineData).not.toHaveBeenCalled();
    emit(ONLINE);
    expect(mockSyncOfflineData).toHaveBeenCalledTimes(1);
    emit(ONLINE);
    expect(mockSyncOfflineData).toHaveBeenCalledTimes(1);
    emit(OFFLINE);
    emit(ONLINE);
    expect(mockSyncOfflineData).toHaveBeenCalledTimes(2);
  });

  it('treats connected-but-unreachable (captive portal) as offline', () => {
    const { emit } = mount();
    emit({ isConnected: true, isInternetReachable: false });
    expect(mockSyncOfflineData).not.toHaveBeenCalled();
    emit(ONLINE);
    expect(mockSyncOfflineData).toHaveBeenCalledTimes(1);
  });

  it('treats unknown reachability (null) as offline, not as online', () => {
    const { emit } = mount();
    emit(OFFLINE);
    emit({ isConnected: true, isInternetReachable: null });
    expect(mockSyncOfflineData).not.toHaveBeenCalled();
  });

  it('swallows a failed sync so the listener keeps working', async () => {
    mockSyncOfflineData.mockRejectedValueOnce(new Error('server down'));
    const { emit } = mount();
    emit(OFFLINE);
    emit(ONLINE);
    await flush();
    emit(OFFLINE);
    emit(ONLINE);
    expect(mockSyncOfflineData).toHaveBeenCalledTimes(2);
  });

  describe('sync client wiring', () => {
    async function capturedClient(): Promise<SyncClient> {
      const { emit } = mount();
      emit(OFFLINE);
      emit(ONLINE);
      return mockSyncOfflineData.mock.calls[0][0] as SyncClient;
    }

    function lastRequest() {
      const [url, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1] as [string, RequestInit];
      return { url, method: init.method, body: init.body ? JSON.parse(init.body as string) : undefined };
    }

    it('createFragment POSTs the fragment and returns the server id', async () => {
      const client = await capturedClient();
      const payload = { bookId: 'b-1', text: 'En un lugar de la Mancha', chapterIndex: 0, createdAt: 1700000000000 };
      await expect(client.createFragment(payload)).resolves.toEqual({ id: 'srv-1' });
      expect(lastRequest()).toEqual({ url: `${API}/fragments`, method: 'POST', body: payload });
    });

    it('deleteFragment DELETEs by server id', async () => {
      const client = await capturedClient();
      await client.deleteFragment('srv-42');
      expect(lastRequest()).toEqual({ url: `${API}/fragments/srv-42`, method: 'DELETE', body: undefined });
    });

    it('updateProgress POSTs only chapter and phrase to the book progress endpoint', async () => {
      const client = await capturedClient();
      await client.updateProgress({ bookId: 'b-7', chapterIndex: 3, phraseIndex: 120, updatedAt: 1700000000000 });
      expect(lastRequest()).toEqual({
        url: `${API}/books/b-7/progress`,
        method: 'POST',
        body: { chapterIndex: 3, phraseIndex: 120 },
      });
    });

    it('propagates API failures to the sync engine (which records them per item)', async () => {
      const client = await capturedClient();
      fetchMock.mockResolvedValueOnce(jsonResponse(500, { message: 'Internal error' }));
      await expect(client.deleteFragment('srv-9')).rejects.toThrow('Internal error');
    });
  });
});
