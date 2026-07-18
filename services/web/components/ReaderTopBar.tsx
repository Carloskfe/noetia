'use client';

import Link from 'next/link';
import { FontSize, FONT_SIZES, ReadingLayout } from '@/lib/reader-preferences';
import { useTranslation } from '@/lib/i18n';

type Props = {
  title: string;
  dark: boolean;
  fontSize: FontSize;
  onFontDecrease: () => void;
  onFontIncrease: () => void;
  onDarkToggle: () => void;
  onFragmentsToggle: () => void;
  fragmentCount: number;
  hasAudio?: boolean;
  mode?: 'reading' | 'audio' | 'escucha-activa';
  onModeToggle?: () => void;
  hasChapters?: boolean;
  onChaptersToggle?: () => void;
  /** Reading progress through the book, 0–1. Renders a % label + a thin bar. */
  progress?: number;
  /** Current text layout; when onLayoutToggle is set a scroll/paged toggle shows. */
  readingLayout?: ReadingLayout;
  onLayoutToggle?: () => void;
};

export default function ReaderTopBar({
  title,
  dark,
  fontSize,
  onFontDecrease,
  onFontIncrease,
  onDarkToggle,
  onFragmentsToggle,
  fragmentCount,
  hasAudio,
  mode,
  onModeToggle,
  hasChapters,
  onChaptersToggle,
  progress,
  readingLayout,
  onLayoutToggle,
}: Props) {
  const { t } = useTranslation();
  const atMin = fontSize === FONT_SIZES[0];
  const atMax = fontSize === FONT_SIZES[FONT_SIZES.length - 1];
  const pct = progress != null ? Math.round(Math.min(1, Math.max(0, progress)) * 100) : null;

  const bar = dark
    ? 'bg-gray-900 border-gray-700 text-gray-100'
    : 'bg-white border-gray-200 text-gray-800';
  const btn = dark
    ? 'hover:bg-gray-800 text-gray-300'
    : 'hover:bg-gray-100 text-gray-500';
  const disabled = dark ? 'text-gray-700 cursor-not-allowed' : 'text-gray-300 cursor-not-allowed';

  return (
    <header className={`fixed top-0 left-0 right-0 h-12 z-40 flex items-center border-b px-3 gap-2 ${bar}`}>
      {/* Back to library */}
      <Link
        href="/library"
        className={`flex-shrink-0 flex items-center gap-1 px-2 h-8 rounded-lg transition ${btn}`}
        aria-label={t.nav.backToLibrary}
      >
        <ArrowLeftIcon />
        <span className="hidden sm:inline text-xs font-medium">{t.nav.myLibrary}</span>
      </Link>

      {/* General collection */}
      <Link
        href="/discover"
        className={`flex-shrink-0 flex items-center gap-1 px-2 h-8 rounded-lg transition ${btn}`}
        aria-label={t.nav.generalCollection}
      >
        <BooksIcon />
        <span className="hidden sm:inline text-xs font-medium">{t.nav.generalCollection}</span>
      </Link>

      {/* Clubs */}
      <Link
        href="/clubs"
        className={`flex-shrink-0 flex items-center gap-1 px-2 h-8 rounded-lg transition ${btn}`}
        aria-label={t.nav.clubs}
      >
        <PeopleIcon />
        <span className="hidden sm:inline text-xs font-medium">{t.nav.clubs}</span>
      </Link>

      {/* Book title */}
      <span className="flex-1 text-sm font-medium truncate text-center px-1">{title}</span>

      {/* Reading progress percentage (bar rendered at the header's bottom edge) */}
      {pct != null && (
        <span
          className="hidden sm:inline flex-shrink-0 w-9 text-right text-[11px] font-medium tabular-nums text-gray-400"
          aria-label={t.nav.readingProgress(pct)}
        >
          {pct}%
        </span>
      )}

      {/* Font size decrease */}
      <button
        onClick={onFontDecrease}
        disabled={atMin}
        aria-label={t.nav.decreaseFontSize}
        className={`flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-xs font-bold transition ${atMin ? disabled : btn}`}
      >
        A−
      </button>

      {/* Font size increase */}
      <button
        onClick={onFontIncrease}
        disabled={atMax}
        aria-label={t.nav.increaseFontSize}
        className={`flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-xs font-bold transition ${atMax ? disabled : btn}`}
      >
        A+
      </button>

      {/* Dark mode toggle */}
      <button
        onClick={onDarkToggle}
        aria-label={dark ? t.nav.lightMode : t.nav.darkMode}
        className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition ${btn}`}
      >
        {dark ? <SunIcon /> : <MoonIcon />}
      </button>

      {/* Audio mode button — nav bar activates Modo Audio (background/earbuds) */}
      {hasAudio && onModeToggle && (
        <button
          onClick={onModeToggle}
          aria-label={mode === 'audio' || mode === 'escucha-activa' ? t.nav.audioModeActive : t.nav.audioMode}
          title={mode === 'audio' ? t.nav.audioModeActive : mode === 'escucha-activa' ? t.nav.activeListeningMode : t.nav.audioMode}
          className={[
            'flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition',
            mode === 'audio' ? 'bg-blue-600 text-white'
            : mode === 'escucha-activa' ? 'bg-blue-600 text-white'
            : btn,
          ].join(' ')}
        >
          {mode === 'reading' ? <HeadphonesIcon /> : <BookIcon />}
        </button>
      )}

      {/* Reading layout toggle — scroll ↔ paged */}
      {onLayoutToggle && (
        <button
          onClick={onLayoutToggle}
          aria-label={t.reader.layoutToggle}
          title={readingLayout === 'paged' ? t.reader.layoutScroll : t.reader.layoutPaged}
          aria-pressed={readingLayout === 'paged'}
          className={[
            'flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition',
            readingLayout === 'paged' ? 'bg-blue-600 text-white' : btn,
          ].join(' ')}
        >
          {readingLayout === 'paged' ? <ScrollLayoutIcon /> : <PagedLayoutIcon />}
        </button>
      )}

      {/* Chapter list */}
      {hasChapters && onChaptersToggle && (
        <button
          onClick={onChaptersToggle}
          aria-label={t.nav.chapters}
          className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition ${btn}`}
        >
          <ListIcon />
        </button>
      )}

      {/* Fragments drawer */}
      <button
        onClick={onFragmentsToggle}
        aria-label={t.nav.fragments}
        className={`relative flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition ${btn}`}
      >
        <BookmarkIcon />
        {fragmentCount > 0 && (
          <span className="absolute top-0.5 right-0.5 bg-blue-600 text-white text-[9px] rounded-full w-3.5 h-3.5 flex items-center justify-center">
            {fragmentCount > 9 ? '9+' : fragmentCount}
          </span>
        )}
      </button>

      {/* Reading progress bar — pinned to the header's bottom edge */}
      {pct != null && (
        <div
          data-testid="reading-progress-bar"
          className="absolute bottom-0 left-0 h-[3px] bg-blue-500 transition-[width] duration-150 ease-out"
          style={{ width: `${pct}%` }}
          aria-hidden="true"
        />
      )}
    </header>
  );
}

function ArrowLeftIcon() {
  return (
    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5M12 5l-7 7 7 7" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="5" />
      <path strokeLinecap="round" d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

function BooksIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 19.5A2.5 2.5 0 016.5 17H20" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2 7h2M2 12h2M2 17h2" />
    </svg>
  );
}

function BookmarkIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
    </svg>
  );
}

function HeadphonesIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M3 18v-6a9 9 0 0118 0v6" />
      <path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3z" />
      <path d="M3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

function PagedLayoutIcon() {
  // Two facing pages — offering the paged view.
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v15" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 5C10 3.5 6.5 3.5 4 4.5v14c2.5-1 6-1 8 .5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 5c2-1.5 5.5-1.5 8-.5v14c-2.5-1-6-1-8 .5" />
    </svg>
  );
}

function ScrollLayoutIcon() {
  // Stacked lines — offering the continuous scroll view.
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <line x1="4" y1="6" x2="20" y2="6" strokeLinecap="round" />
      <line x1="4" y1="10" x2="20" y2="10" strokeLinecap="round" />
      <line x1="4" y1="14" x2="20" y2="14" strokeLinecap="round" />
      <line x1="4" y1="18" x2="14" y2="18" strokeLinecap="round" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}
