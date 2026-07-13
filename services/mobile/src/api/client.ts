import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveToken, saveRefreshToken, getRefreshToken } from '../auth/token-storage';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

async function buildHeaders(withBody = false): Promise<Record<string, string>> {
  const token = await AsyncStorage.getItem('noetia_access_token');
  return {
    // Identifies this as a native client so the API returns the (rotating)
    // refresh token in the body instead of an httpOnly cookie.
    'X-Client-Type': 'mobile',
    ...(withBody ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// De-dupe concurrent refreshes: on launch several requests can 401 at once with
// the expired access token; the refresh token rotates on use, so independent
// refreshes would invalidate each other — share one in-flight refresh instead.
let refreshInFlight: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) return false;
      const res = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Client-Type': 'mobile' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;
      const data = (await res.json().catch(() => null)) as { accessToken?: string; refreshToken?: string } | null;
      if (!data?.accessToken) return false;
      await saveToken(data.accessToken);
      if (data.refreshToken) await saveRefreshToken(data.refreshToken);
      return true;
    })()
      .catch(() => false)
      .finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

async function handle<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({})) as Record<string, unknown>;
  if (!res.ok) {
    throw Object.assign(new Error((data['message'] as string) ?? 'Request failed'), {
      status: res.status,
      data,
    });
  }
  return data as T;
}

async function request<T>(path: string, method: string, body?: unknown, withBody = false): Promise<T> {
  const doFetch = async () =>
    fetch(`${BASE_URL}${path}`, {
      method,
      headers: await buildHeaders(withBody),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

  let res = await doFetch();
  // Access token expired but the session is still valid → silently refresh once
  // and retry, so the user stays signed in without being bounced to login.
  if (res.status === 401 && !path.startsWith('/auth/')) {
    if (await tryRefresh()) res = await doFetch();
  }
  return handle<T>(res);
}

export const apiClient = {
  get<T = unknown>(path: string): Promise<T> {
    return request<T>(path, 'GET');
  },

  post<T = unknown>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, 'POST', body, true);
  },

  patch<T = unknown>(path: string, body: unknown): Promise<T> {
    return request<T>(path, 'PATCH', body, true);
  },

  delete<T = unknown>(path: string): Promise<T> {
    return request<T>(path, 'DELETE');
  },
};
