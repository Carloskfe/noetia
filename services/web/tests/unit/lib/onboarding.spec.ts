jest.mock('../../../lib/api', () => ({ apiFetch: jest.fn() }));

import { apiFetch } from '../../../lib/api';
import {
  normalizeState,
  fetchOnboardingState,
  patchOnboarding,
  syncOnboardingToLocal,
  ensureOnboardingSynced,
  resetOnboardingSync,
  persistTourSeen,
  persistWelcomeStatus,
  DEFAULT_ONBOARDING_STATE,
} from '../../../lib/onboarding';

const mockApi = apiFetch as jest.Mock;

const mockStorage: Record<string, string> = {};
const localStorageMock = {
  getItem: jest.fn((k: string) => mockStorage[k] ?? null),
  setItem: jest.fn((k: string, v: string) => { mockStorage[k] = v; }),
  removeItem: jest.fn((k: string) => { delete mockStorage[k]; }),
};

beforeEach(() => {
  jest.clearAllMocks();
  Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  Object.defineProperty(global, 'localStorage', { value: localStorageMock, writable: true });
  resetOnboardingSync();
});

const authed = () => { mockStorage['access_token'] = 'jwt'; };

describe('normalizeState', () => {
  it('returns the default for null / garbage input', () => {
    expect(normalizeState(null)).toEqual(DEFAULT_ONBOARDING_STATE);
    expect(normalizeState({ welcome: 'bogus', welcomeStep: 'x', tours: 5 })).toEqual(DEFAULT_ONBOARDING_STATE);
  });
  it('preserves a valid state and copies the tours object', () => {
    const raw = { welcome: 'in_progress', welcomeStep: 2, tours: { reader: true } };
    const out = normalizeState(raw);
    expect(out).toEqual(raw);
    expect(out.tours).not.toBe(raw.tours);
  });
  it('coerces a non-integer welcomeStep to 0', () => {
    expect(normalizeState({ welcome: 'completed', welcomeStep: 1.5, tours: {} }).welcomeStep).toBe(0);
  });
});

describe('fetchOnboardingState', () => {
  it('reads /users/me and normalizes onboardingState', async () => {
    mockApi.mockResolvedValue({ onboardingState: { welcome: 'skipped', welcomeStep: 0, tours: {} } });
    const state = await fetchOnboardingState();
    expect(mockApi).toHaveBeenCalledWith('/users/me');
    expect(state.welcome).toBe('skipped');
  });
});

describe('patchOnboarding', () => {
  it('PATCHes the onboarding endpoint with the patch body', async () => {
    mockApi.mockResolvedValue({ welcome: 'in_progress', welcomeStep: 1, tours: {} });
    const state = await patchOnboarding({ welcome: 'in_progress', welcomeStep: 1 });
    expect(mockApi).toHaveBeenCalledWith('/users/me/onboarding', {
      method: 'PATCH',
      body: JSON.stringify({ welcome: 'in_progress', welcomeStep: 1 }),
    });
    expect(state.welcome).toBe('in_progress');
  });
});

describe('persist helpers (fire-and-forget, auth-gated)', () => {
  it('persistTourSeen does nothing when logged out', () => {
    persistTourSeen('reader');
    expect(mockApi).not.toHaveBeenCalled();
  });
  it('persistTourSeen PATCHes tourSeen when authed', () => {
    authed();
    mockApi.mockResolvedValue({});
    persistTourSeen('clubs');
    expect(mockApi).toHaveBeenCalledWith('/users/me/onboarding', {
      method: 'PATCH',
      body: JSON.stringify({ tourSeen: 'clubs' }),
    });
  });
  it('persistWelcomeStatus PATCHes the welcome status when authed', () => {
    authed();
    mockApi.mockResolvedValue({});
    persistWelcomeStatus('completed');
    expect(mockApi).toHaveBeenCalledWith('/users/me/onboarding', {
      method: 'PATCH',
      body: JSON.stringify({ welcome: 'completed' }),
    });
  });
});

describe('syncOnboardingToLocal', () => {
  it('is a no-op when logged out', async () => {
    await syncOnboardingToLocal();
    expect(mockApi).not.toHaveBeenCalled();
  });
  it('mirrors completed welcome + seen tours into local flags', async () => {
    authed();
    mockApi.mockResolvedValue({
      onboardingState: { welcome: 'completed', welcomeStep: 0, tours: { reader: true, clubs: true } },
    });
    await syncOnboardingToLocal();
    expect(mockStorage['noetia_welcome_seen']).toBe('1');
    expect(mockStorage['noetia_reader_tutorial_seen']).toBe('1');
    expect(mockStorage['noetia_clubs_tutorial_seen']).toBe('1');
    expect(mockStorage['noetia_audio_tutorial_seen']).toBeUndefined();
  });
  it('does not mark welcome seen while still in progress', async () => {
    authed();
    mockApi.mockResolvedValue({
      onboardingState: { welcome: 'in_progress', welcomeStep: 1, tours: {} },
    });
    await syncOnboardingToLocal();
    expect(mockStorage['noetia_welcome_seen']).toBeUndefined();
  });
});

describe('ensureOnboardingSynced', () => {
  it('runs the sync only once for concurrent callers', async () => {
    authed();
    mockApi.mockResolvedValue({ onboardingState: DEFAULT_ONBOARDING_STATE });
    await Promise.all([ensureOnboardingSynced(), ensureOnboardingSynced()]);
    expect(mockApi).toHaveBeenCalledTimes(1);
  });
  it('re-fetches after resetOnboardingSync', async () => {
    authed();
    mockApi.mockResolvedValue({ onboardingState: DEFAULT_ONBOARDING_STATE });
    await ensureOnboardingSynced();
    resetOnboardingSync();
    await ensureOnboardingSynced();
    expect(mockApi).toHaveBeenCalledTimes(2);
  });
});
