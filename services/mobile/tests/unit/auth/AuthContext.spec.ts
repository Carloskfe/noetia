import React from 'react';
import { act } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider, useAuth } from '../../../src/auth/AuthContext';
import { render, flush, texts, jsonResponse } from '../../support/render';

// AuthProvider / useAuth rendered through react-test-renderer (CI-4.1). The real provider,
// real apiClient and real token-storage run; only global fetch and AsyncStorage (existing
// mock) are replaced. Synthetic tokens only.

const API = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';
const fetchMock = jest.fn();

type Auth = ReturnType<typeof useAuth>;
let captured: Auth[] = [];
function Consumer({ label = 'child' }: { label?: string }) {
  captured.push(useAuth());
  return React.createElement('Text', null, label);
}

function mount(onLogout: () => void) {
  return render(React.createElement(AuthProvider, { onLogout, children: React.createElement(Consumer) }));
}

const latest = () => captured[captured.length - 1];

beforeEach(async () => {
  captured = [];
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(jsonResponse(200, {}));
  (global as unknown as { fetch: jest.Mock }).fetch = fetchMock;
  await AsyncStorage.setItem('noetia_access_token', 'access-test');
  await AsyncStorage.setItem('noetia_refresh_token', 'refresh-test');
  await AsyncStorage.setItem('noetia_user_type', 'reader');
});

async function storedTokens() {
  return Promise.all(
    ['noetia_access_token', 'noetia_refresh_token', 'noetia_user_type'].map((k) => AsyncStorage.getItem(k)),
  );
}

describe('AuthProvider', () => {
  it('renders its children', () => {
    const renderer = mount(jest.fn());
    expect(texts(renderer)).toEqual(['child']);
  });

  it('logout revokes the refresh token server-side, clears local tokens, then notifies', async () => {
    const order: string[] = [];
    const onLogout = jest.fn(() => order.push('onLogout'));
    const removeItem = AsyncStorage.removeItem as jest.Mock;
    const realRemove = removeItem.getMockImplementation() as (k: string) => Promise<void>;
    removeItem.mockImplementationOnce((k: string) => {
      order.push('clear');
      return realRemove(k);
    });
    mount(onLogout);
    await act(async () => { await latest().logout(); });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${API}/auth/logout`);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ refreshToken: 'refresh-test' });
    expect(onLogout).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['clear', 'onLogout']);
    expect(await storedTokens()).toEqual([null, null, null]);
  });

  it('logout without a stored refresh token sends no body', async () => {
    await AsyncStorage.removeItem('noetia_refresh_token');
    const onLogout = jest.fn();
    mount(onLogout);
    await act(async () => { await latest().logout(); });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBeUndefined();
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it('still signs out locally when the server rejects the logout', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(500, { message: 'down' }));
    const onLogout = jest.fn();
    mount(onLogout);
    await act(async () => { await latest().logout(); });
    expect(await storedTokens()).toEqual([null, null, null]);
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it('still signs out locally when the device is offline', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'));
    const onLogout = jest.fn();
    mount(onLogout);
    await act(async () => { await latest().logout(); });
    expect(await storedTokens()).toEqual([null, null, null]);
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it('keeps a stable logout across re-renders and rebinds when onLogout changes', async () => {
    const first = jest.fn();
    const renderer = mount(first);
    const initial = latest().logout;
    act(() => renderer.update(React.createElement(AuthProvider, { onLogout: first, children: React.createElement(Consumer) })));
    expect(latest().logout).toBe(initial);

    const second = jest.fn();
    act(() => renderer.update(React.createElement(AuthProvider, { onLogout: second, children: React.createElement(Consumer) })));
    expect(latest().logout).not.toBe(initial);
    await act(async () => { await latest().logout(); });
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });
});

describe('useAuth outside a provider', () => {
  it('returns a harmless no-op logout', async () => {
    render(React.createElement(Consumer));
    await act(async () => { await latest().logout(); });
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem('noetia_access_token')).toBe('access-test');
  });
});
