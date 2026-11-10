import { saveToken, clearToken, saveUserType, getUserType, saveEmailConfirmed, getEmailConfirmed, postAuthRedirect } from '../../../lib/api';

const mockStorage: Record<string, string> = {};
const localStorageMock = {
  getItem: jest.fn((key: string) => mockStorage[key] ?? null),
  setItem: jest.fn((key: string, value: string) => { mockStorage[key] = value; }),
  removeItem: jest.fn((key: string) => { delete mockStorage[key]; }),
};

beforeEach(() => {
  jest.clearAllMocks();
  Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
  Object.defineProperty(global, 'localStorage', { value: localStorageMock, writable: true });
});

describe('saveToken', () => {
  it('stores the token under "access_token" in localStorage', () => {
    saveToken('tok-abc');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('access_token', 'tok-abc');
  });
});

describe('clearToken', () => {
  it('removes "access_token" from localStorage', () => {
    clearToken();
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('access_token');
  });
});

describe('saveUserType', () => {
  it('stores a non-null userType in localStorage', () => {
    saveUserType('personal');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('user_type', 'personal');
  });

  it('removes "user_type" when null is passed', () => {
    saveUserType(null);
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('user_type');
  });
});

describe('getUserType', () => {
  it('returns the stored userType when window is defined', () => {
    mockStorage['user_type'] = 'author';
    expect(getUserType()).toBe('author');
  });

  it('returns null when no userType is stored', () => {
    expect(getUserType()).toBeNull();
  });

  it('returns null in a server-side (no window) context', () => {
    const windowSpy = jest.spyOn(global, 'window', 'get').mockReturnValue(undefined as any);
    expect(getUserType()).toBeNull();
    windowSpy.mockRestore();
  });
});

describe('saveEmailConfirmed / getEmailConfirmed', () => {
  it('stores "1" when confirmed is true', () => {
    saveEmailConfirmed(true);
    expect(localStorageMock.setItem).toHaveBeenCalledWith('email_confirmed', '1');
  });

  it('stores "0" when confirmed is false', () => {
    saveEmailConfirmed(false);
    expect(localStorageMock.setItem).toHaveBeenCalledWith('email_confirmed', '0');
  });

  it('returns true when value is "1"', () => {
    mockStorage['email_confirmed'] = '1';
    expect(getEmailConfirmed()).toBe(true);
  });

  it('returns false when value is "0"', () => {
    mockStorage['email_confirmed'] = '0';
    expect(getEmailConfirmed()).toBe(false);
  });

  it('returns true when key is absent (default for existing users)', () => {
    expect(getEmailConfirmed()).toBe(true);
  });

  it('returns true in a server-side (no window) context', () => {
    const windowSpy = jest.spyOn(global, 'window', 'get').mockReturnValue(undefined as any);
    expect(getEmailConfirmed()).toBe(true);
    windowSpy.mockRestore();
  });
});

describe('postAuthRedirect', () => {
  it('returns "/library" when a userType is present', () => {
    expect(postAuthRedirect('personal')).toBe('/library');
    expect(postAuthRedirect('author')).toBe('/library');
    expect(postAuthRedirect('editorial')).toBe('/library');
  });

  it('returns "/onboarding" when userType is null', () => {
    expect(postAuthRedirect(null)).toBe('/onboarding');
  });
});

describe('apiFetch', () => {
  const originalFetch = global.fetch;

  afterAll(() => { global.fetch = originalFetch; });

  it('makes a fetch call with the correct URL', async () => {
    const { apiFetch } = await import('../../../lib/api');
    const mockRes = { ok: true, json: jest.fn().mockResolvedValue({ id: 1 }) };
    global.fetch = jest.fn().mockResolvedValue(mockRes);
    localStorageMock.getItem.mockReturnValue(null as unknown as string);

    const result = await apiFetch('/books');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/books'),
      expect.objectContaining({ credentials: 'include' }),
    );
    expect(result).toEqual({ id: 1 });
  });

  it('attaches Authorization header when a token is stored', async () => {
    const { apiFetch } = await import('../../../lib/api');
    const mockRes = { ok: true, json: jest.fn().mockResolvedValue({}) };
    global.fetch = jest.fn().mockResolvedValue(mockRes);
    localStorageMock.getItem.mockReturnValue('my-access-token');

    await apiFetch('/protected');

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer my-access-token' });
  });

  it('throws an error with the response status when the response is not ok', async () => {
    const { apiFetch } = await import('../../../lib/api');
    const mockRes = { ok: false, status: 401, json: jest.fn().mockResolvedValue({ message: 'Unauthorized' }) };
    global.fetch = jest.fn().mockResolvedValue(mockRes);
    localStorageMock.getItem.mockReturnValue(null as unknown as string);

    await expect(apiFetch('/secure')).rejects.toMatchObject({ status: 401 });
  });

  it('de-dupes concurrent refreshes — one /auth/refresh for many simultaneous 401s', async () => {
    // Reset the module so the shared in-flight refresh state starts clean.
    jest.resetModules();
    const { apiFetch } = await import('../../../lib/api');
    localStorageMock.getItem.mockImplementation((k: string) => mockStorage[k] ?? null);
    mockStorage['access_token'] = 'expired';

    let refreshCalls = 0;
    global.fetch = jest.fn((url: string, init?: any) => {
      if (typeof url === 'string' && url.includes('/auth/refresh')) {
        refreshCalls++;
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ accessToken: 'fresh' }) });
      }
      // Protected endpoint: 401 with the stale token, 200 once refreshed.
      const auth = init?.headers?.Authorization;
      if (auth === 'Bearer fresh') {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: 1 }) });
      }
      return Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({}) });
    }) as unknown as typeof fetch;

    const results = await Promise.all([apiFetch('/a'), apiFetch('/b'), apiFetch('/c'), apiFetch('/d')]);

    expect(refreshCalls).toBe(1);                       // the whole point
    results.forEach((r) => expect(r).toEqual({ ok: 1 })); // all retried successfully
  });
});

// NEM-024 Checkpoint D: raw-Response variant for SSE (same token + shared refresh; never parses or throws on non-2xx).
describe('apiStream', () => {
  const originalFetch = global.fetch;
  afterAll(() => { global.fetch = originalFetch; });

  it('returns the raw Response (even non-2xx) with the bearer token and JSON content type', async () => {
    jest.resetModules();
    const { apiStream } = await import('../../../lib/api');
    localStorageMock.getItem.mockImplementation(((k: string) => (k === 'access_token' ? 'tok' : null)) as (key: string) => string);
    const res = { ok: false, status: 409, json: jest.fn() };
    global.fetch = jest.fn().mockResolvedValue(res);
    expect(await apiStream('/knowledge/sessions/s/turns/stream', { method: 'POST', body: '{}' })).toBe(res);
    expect(res.json).not.toHaveBeenCalled();
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toMatch(/\/knowledge\/sessions\/s\/turns\/stream$/);
    expect(init.headers).toMatchObject({ Authorization: 'Bearer tok', 'Content-Type': 'application/json' });
  });

  it('on 401 refreshes once and retries with the new token', async () => {
    jest.resetModules();
    const { apiStream } = await import('../../../lib/api');
    localStorageMock.getItem.mockImplementation((k: string) => mockStorage[k] ?? null);
    mockStorage['access_token'] = 'expired';
    global.fetch = jest.fn((url: string, init?: any) => {
      if (url.includes('/auth/refresh')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ accessToken: 'fresh' }) });
      return Promise.resolve(init?.headers?.Authorization === 'Bearer fresh' ? { ok: true, status: 200 } : { ok: false, status: 401 });
    }) as unknown as typeof fetch;
    expect((await apiStream('/x')).status).toBe(200);
  });

  it('on 401 with a failed refresh → redirects to /login and throws status 401', async () => {
    jest.resetModules();
    const { apiStream } = await import('../../../lib/api');
    global.fetch = jest.fn((url: string) => Promise.resolve(url.includes('/auth/refresh') ? { ok: false } : { ok: false, status: 401 })) as unknown as typeof fetch;
    await expect(apiStream('/x')).rejects.toMatchObject({ status: 401 });
  });
});
