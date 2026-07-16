import { apiFetch } from './api';

export type OnboardingWelcomeStatus = 'not_started' | 'in_progress' | 'skipped' | 'completed';

export interface OnboardingState {
  welcome: OnboardingWelcomeStatus;
  welcomeStep: number;
  tours: Record<string, boolean>;
}

export const DEFAULT_ONBOARDING_STATE: OnboardingState = {
  welcome: 'not_started',
  welcomeStep: 0,
  tours: {},
};

/** Per-surface tour name → the legacy localStorage flag key it mirrors. The
 *  server is the source of truth; these flags stay as a synchronous, offline
 *  cache so the existing tutorial components can decide instantly on mount. */
export const TOUR_FLAG_KEYS: Record<string, string> = {
  reader: 'noetia_reader_tutorial_seen',
  audio: 'noetia_audio_tutorial_seen',
  fragments: 'noetia_fragments_tutorial_seen',
  clubs: 'noetia_clubs_tutorial_seen',
};

const WELCOME_FLAG_KEY = 'noetia_welcome_seen';

function isAuthed(): boolean {
  return typeof window !== 'undefined' && !!localStorage.getItem('access_token');
}

/** Coerce an arbitrary server value into a well-formed OnboardingState. */
export function normalizeState(raw: any): OnboardingState {
  const welcome: OnboardingWelcomeStatus =
    raw?.welcome === 'in_progress' || raw?.welcome === 'skipped' || raw?.welcome === 'completed'
      ? raw.welcome
      : 'not_started';
  return {
    welcome,
    welcomeStep: Number.isInteger(raw?.welcomeStep) ? raw.welcomeStep : 0,
    tours: raw?.tours && typeof raw.tours === 'object' ? { ...raw.tours } : {},
  };
}

export async function fetchOnboardingState(): Promise<OnboardingState> {
  const me = await apiFetch('/users/me');
  return normalizeState(me?.onboardingState);
}

export async function patchOnboarding(patch: {
  welcome?: OnboardingWelcomeStatus;
  welcomeStep?: number;
  tourSeen?: string;
}): Promise<OnboardingState> {
  const state = await apiFetch('/users/me/onboarding', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  return normalizeState(state);
}

/** Mirror server onboarding state into the local flag cache, so a returning
 *  user on a new device sees their real progress (tutorials they already
 *  dismissed elsewhere stay dismissed). No-op when logged out. */
export async function syncOnboardingToLocal(): Promise<void> {
  if (!isAuthed()) return;
  const state = await fetchOnboardingState();
  if (state.welcome === 'completed' || state.welcome === 'skipped') {
    localStorage.setItem(WELCOME_FLAG_KEY, '1');
  }
  for (const [tour, flagKey] of Object.entries(TOUR_FLAG_KEYS)) {
    if (state.tours[tour]) localStorage.setItem(flagKey, '1');
  }
}

// One shared sync per app session — many tutorial components mount and each
// awaits this before deciding whether to show, but only one /users/me fires.
let syncPromise: Promise<void> | null = null;

export function ensureOnboardingSynced(): Promise<void> {
  if (!syncPromise) syncPromise = syncOnboardingToLocal().catch(() => {});
  return syncPromise;
}

/** Test/logout hook — drop the memoized sync so the next call re-fetches. */
export function resetOnboardingSync(): void {
  syncPromise = null;
}

/** Fire-and-forget: record that a per-surface tutorial was dismissed. */
export function persistTourSeen(tour: string): void {
  if (!isAuthed()) return;
  patchOnboarding({ tourSeen: tour }).catch(() => {});
}

/** Fire-and-forget: record the welcome tour's lifecycle status. */
export function persistWelcomeStatus(welcome: OnboardingWelcomeStatus, welcomeStep?: number): void {
  if (!isAuthed()) return;
  patchOnboarding({ welcome, ...(welcomeStep !== undefined ? { welcomeStep } : {}) }).catch(() => {});
}
