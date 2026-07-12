'use client';

import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';

/**
 * Persistent top bar for the logged-in app shell (Library / Discover / Profile).
 * Gives the app a consistent brand header + quick access to profile and account
 * settings, complementing the bottom tab bar. Sticky so it stays while content
 * scrolls underneath.
 */
export default function AppTopBar() {
  const { t } = useTranslation();

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-gray-100">
      <div className="max-w-lg mx-auto px-4 h-12 flex items-center justify-between">
        <Link
          href="/discover"
          aria-label="Noetia"
          className="font-bold tracking-widest text-gray-900 text-sm hover:text-blue-600 transition"
        >
          NOETIA
        </Link>

        <div className="flex items-center gap-1">
          <Link
            href="/profile"
            aria-label={t.nav.profile}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:text-blue-600 hover:bg-gray-100 transition"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 19.5a7.5 7.5 0 0115 0v.75H4.5v-.75z" />
            </svg>
          </Link>

          <Link
            href="/account/billing"
            aria-label={t.account.title}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:text-blue-600 hover:bg-gray-100 transition"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a6.759 6.759 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </Link>
        </div>
      </div>
    </header>
  );
}
