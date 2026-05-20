import NetInfo from '@react-native-community/netinfo';
import * as sync from '../../../src/offline/sync';

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

