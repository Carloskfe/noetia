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
