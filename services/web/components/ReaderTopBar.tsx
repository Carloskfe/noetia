'use client';

import Link from 'next/link';
import { FontSize, FONT_SIZES } from '@/lib/reader-preferences';

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
  mode?: 'reading' | 'listening';
  onModeToggle?: () => void;
  hasChapters?: boolean;
  onChaptersToggle?: () => void;
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
}: Props) {
  const atMin = fontSize === FONT_SIZES[0];
  const atMax = fontSize === FONT_SIZES[FONT_SIZES.length - 1];

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
        aria-label="Volver a biblioteca"
      >
        <ArrowLeftIcon />
        <span className="hidden sm:inline text-xs font-medium">Biblioteca</span>
      </Link>

      {/* Book title */}
      <span className="flex-1 text-sm font-medium truncate text-center px-1">{title}</span>

      {/* Font size decrease */}
      <button
        onClick={onFontDecrease}
        disabled={atMin}
        aria-label="Reducir tamaño de letra"
        className={`flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-xs font-bold transition ${atMin ? disabled : btn}`}
      >
        A−
      </button>

      {/* Font size increase */}
      <button
        onClick={onFontIncrease}
        disabled={atMax}
        aria-label="Aumentar tamaño de letra"
        className={`flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-xs font-bold transition ${atMax ? disabled : btn}`}
      >
        A+
      </button>

      {/* Dark mode toggle */}
      <button
        onClick={onDarkToggle}
        aria-label={dark ? 'Activar modo claro' : 'Activar modo oscuro'}
        className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition ${btn}`}
      >
        {dark ? <SunIcon /> : <MoonIcon />}
      </button>

      {/* Discover / Search */}
      <Link
        href="/discover"
        className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition ${btn}`}
        aria-label="Descubrir libros"
      >
        <MagnifierIcon />
      </Link>

      {/* Audio mode toggle */}
      {hasAudio && onModeToggle && (
        <button
          onClick={onModeToggle}
          aria-label={mode === 'listening' ? 'Cambiar a modo lectura' : 'Cambiar a modo escucha'}
          title={mode === 'listening' ? 'Modo lectura' : 'Modo escucha'}
          className={[
            'flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition',
            mode === 'listening' ? 'bg-blue-600 text-white' : btn,
          ].join(' ')}
        >
          {mode === 'listening' ? <BookIcon /> : <HeadphonesIcon />}
        </button>
      )}

      {/* Chapter list */}
      {hasChapters && onChaptersToggle && (
        <button
          onClick={onChaptersToggle}
          aria-label="Capítulos"
          className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition ${btn}`}
        >
          <ListIcon />
        </button>
      )}

      {/* Fragments drawer */}
      <button
        onClick={onFragmentsToggle}
        aria-label="Fragmentos"
        className={`relative flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition ${btn}`}
      >
        <BookmarkIcon />
        {fragmentCount > 0 && (
          <span className="absolute top-0.5 right-0.5 bg-blue-600 text-white text-[9px] rounded-full w-3.5 h-3.5 flex items-center justify-center">
            {fragmentCount > 9 ? '9+' : fragmentCount}
          </span>
        )}
      </button>
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

function MagnifierIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803 7.5 7.5 0 0015.803 15.803z" />
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
