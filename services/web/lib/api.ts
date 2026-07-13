const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

async function fetchWithToken(path: string, init: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  return fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
}

// A single shared in-flight refresh. On app load, many requests 401 at once
// (the 15-min access token has expired but the refresh cookie is still valid).
// If each request hit /auth/refresh independently, the refresh-token ROTATION
// (server deletes the old token and issues a new one) would make every call
// after the first send an already-invalidated cookie → 401 → the user is
// bounced to /login despite a valid session. De-duping fixes that "app forgets
// me on return" bug: exactly one /auth/refresh runs, everyone else awaits it.
let refreshInFlight: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${API_URL}/auth/refresh`, { method: 'POST', credentials: 'include' })
      .then(async (r) => {
        if (!r.ok) return false;
        const d = await r.json().catch(() => null);
        if (!d?.accessToken) return false;
        saveToken(d.accessToken);
        return true;
      })
      .catch(() => false)
      .finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<any> {
  let res = await fetchWithToken(path, init);

  // Auto-refresh expired access token once (shared/de-duped), then retry.
  if (res.status === 401 && !path.startsWith('/auth/')) {
    if (await refreshAccessToken()) {
      res = await fetchWithToken(path, init);
    } else {
      if (typeof window !== 'undefined') window.location.href = '/login';
      throw Object.assign(new Error('Session expired'), { status: 401 });
    }
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.message ?? 'Request failed'), { status: res.status, data });
  return data;
}

export function saveToken(token: string) {
  localStorage.setItem('access_token', token);
}

export function clearToken() {
  localStorage.removeItem('access_token');
}

export function saveUserType(userType: string | null) {
  if (userType) localStorage.setItem('user_type', userType);
  else localStorage.removeItem('user_type');
}

export function getUserType(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem('user_type') : null;
}

export function saveEmailConfirmed(confirmed: boolean) {
  localStorage.setItem('email_confirmed', confirmed ? '1' : '0');
}

export function getEmailConfirmed(): boolean {
  if (typeof window === 'undefined') return true;
  const v = localStorage.getItem('email_confirmed');
  return v === null || v === '1';
}

export function postAuthRedirect(userType: string | null): string {
  return userType ? '/library' : '/onboarding';
}
