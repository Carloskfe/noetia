import * as Notifications from 'expo-notifications';
import { usePushNotifications } from '../../../src/hooks/usePushNotifications';
import { renderHook } from '../../support/render-hook';
import { flush, jsonResponse } from '../../support/render';

// usePushNotifications rendered through react-test-renderer (CI-4.1). expo-notifications is
// the existing mock; the real apiClient runs with only global fetch replaced.

const API = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';
const N = Notifications as unknown as Record<
  'requestPermissionsAsync' | 'getExpoPushTokenAsync' | 'setNotificationHandler' | 'addNotificationResponseReceivedListener',
  jest.Mock
>;

// Captured before any test clears mocks: the handler is installed once at module load.
const handlerInstall = N.setNotificationHandler.mock.calls.slice();
const fetchMock = jest.fn();
let remove: jest.Mock;

beforeEach(() => {
  N.requestPermissionsAsync.mockReset().mockResolvedValue({ granted: true, status: 'granted' });
  N.getExpoPushTokenAsync.mockReset().mockResolvedValue({ data: 'ExponentPushToken[test-device]', type: 'expo' });
  remove = jest.fn();
  N.addNotificationResponseReceivedListener.mockReset().mockImplementation(() => ({ remove }));
  fetchMock.mockReset().mockResolvedValue(jsonResponse(201, {}));
  (global as unknown as { fetch: jest.Mock }).fetch = fetchMock;
});

async function mount() {
  const hook = renderHook(() => usePushNotifications(), undefined);
  await flush();
  return hook;
}

describe('foreground notification handler', () => {
  it('is installed once at module load and shows alerts with sound but no badge', async () => {
    expect(handlerInstall).toHaveLength(1);
    const { handleNotification } = handlerInstall[0][0] as {
      handleNotification: (n: unknown) => Promise<Record<string, boolean>>;
    };
    await expect(handleNotification({ request: { content: {} } })).resolves.toEqual({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    });
  });
});

describe('usePushNotifications', () => {
  it('registers the device push token with its platform when permission is granted', async () => {
    await mount();
    expect(N.getExpoPushTokenAsync).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${API}/push/register`);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ token: 'ExponentPushToken[test-device]', platform: 'ios' });
  });

  it('does not request a token or call the API when permission is denied', async () => {
    N.requestPermissionsAsync.mockResolvedValueOnce({ granted: false, status: 'denied' });
    await mount();
    expect(N.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('swallows a registration API failure', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(500, { message: 'down' }));
    await expect(mount()).resolves.toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('listens for notification taps while mounted and stops on unmount', async () => {
    const { unmount } = await mount();
    expect(N.addNotificationResponseReceivedListener).toHaveBeenCalledTimes(1);
    const onTap = N.addNotificationResponseReceivedListener.mock.calls[0][0] as (r: unknown) => void;
    expect(() => onTap({ notification: { request: { content: { data: { type: 'club' } } } } })).not.toThrow();
    expect(remove).not.toHaveBeenCalled();
    unmount();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('registers only once per mount', async () => {
    const { rerender } = await mount();
    rerender(undefined);
    await flush();
    expect(N.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  });
});
