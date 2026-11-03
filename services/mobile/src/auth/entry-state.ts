export type EntryState = 'language' | 'consent' | 'login' | 'app';

/**
 * Where the app opens. There is deliberately no subscription gate: free accounts
 * and customers whose plan was canceled use the app, read their owned and free
 * books, and unlock paid books with tokens (PO-021, PO-023, NEM-012).
 */
export function entryState(opts: { hasLanguage: boolean; consentCurrent: boolean; loggedIn: boolean }): EntryState {
  if (!opts.hasLanguage) return 'language';
  if (!opts.consentCurrent) return 'consent';
  if (!opts.loggedIn) return 'login';
  return 'app';
}
