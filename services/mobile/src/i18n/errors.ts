import type { MobileTranslations } from './en';

// Client-side mapping of server error signals to localized messages (NEM-025 B1-B).
// The server's raw text is used only as a signal and is never shown to the user.

/** Live-session socket errors. The club-session gateway emits these English messages. */
export function liveSessionErrorMessage(t: MobileTranslations, raw: string | null | undefined): string {
  if (!raw) return '';
  const e = t.clubs.live.errors;
  switch (raw) {
    case 'Session not found':
    case 'Room not found':
      return e.sessionNotFound;
    case 'Not a club member':
      return e.notMember;
    default:
      return e.generic;
  }
}
