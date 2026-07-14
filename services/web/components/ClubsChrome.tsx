'use client';

import { usePathname } from 'next/navigation';
import AppTopBar from './AppTopBar';
import BottomNav from './BottomNav';
import EmailVerificationBanner from './EmailVerificationBanner';

/**
 * App shell for the Clubes de Lectura section, matching the rest of the app
 * (top bar + bottom tabs). The `(clubs)` route group previously had no chrome
 * at all — tapping the Clubs tab dropped the whole nav shell.
 *
 * Exception: the Escucha Juntos **live session** is a focused, full-screen
 * real-time experience — it renders bare so the nav bars can't cover the live
 * UI or let a user wander off mid-session.
 */
export default function ClubsChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  const isLiveSession = /\/sessions\/[^/]+\/live$/.test(pathname);

  if (isLiveSession) return <>{children}</>;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <AppTopBar />
      <EmailVerificationBanner />
      <main className="flex-1 pb-20">{children}</main>
      <BottomNav />
    </div>
  );
}
