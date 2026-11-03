import { entryState } from '../../../src/auth/entry-state';

describe('entryState — no subscription gate (NEM-012, PO-023)', () => {
  it('opens the app for any signed-in user, whatever their subscription', () => {
    // Free accounts and canceled subscribers reach the app; the old paywall is gone.
    expect(entryState({ hasLanguage: true, consentCurrent: true, loggedIn: true })).toBe('app');
  });

  it('asks for language, then consent, then sign-in, in that order', () => {
    expect(entryState({ hasLanguage: false, consentCurrent: false, loggedIn: false })).toBe('language');
    expect(entryState({ hasLanguage: true, consentCurrent: false, loggedIn: true })).toBe('consent');
    expect(entryState({ hasLanguage: true, consentCurrent: true, loggedIn: false })).toBe('login');
  });
});
