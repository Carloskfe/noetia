'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { phraseAt, seekToPhrase, Phrase, Fragment } from '@/lib/reader-utils';
import {
  applyTextSelection,
  addFragment,
  removeFragment,
  replaceFragments,
  EMPTY_SELECTION,
  SelectionState,
} from '@/lib/fragment-selection';
import { loadPreferences, savePreferences, FontSize, FONT_SIZES } from '@/lib/reader-preferences';
import FragmentPopover from '@/components/FragmentPopover';
import FragmentSheet from '@/components/FragmentSheet';
import ReaderTopBar from '@/components/ReaderTopBar';

const FONT_SIZE_CLASSES: Record<FontSize, string> = {
  sm: 'text-base',
  md: 'text-lg',
  lg: 'text-xl',
};

type Book = {
  id: string;
  title: string;
  author: string;
  audioFileUrl: string | null;
  audioStreamUrl: string | null;
  textFileUrl: string | null;
};

type Mode = 'reading' | 'listening';

type AudioBookmark = { phraseIndex: number };

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

function formatTime(s: number): string {
  if (!isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function ReaderPage() {
  const { id: bookId } = useParams<{ id: string }>();

  const [book, setBook] = useState<Book | null>(null);
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [rawText, setRawText] = useState('');
  const [activePhraseIndex, setActivePhraseIndex] = useState(-1);
  const [savedPhraseIndex, setSavedPhraseIndex] = useState(0);
  const [mode, setMode] = useState<Mode>('reading');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);

  // Reading preferences
  const [fontSize, setFontSize] = useState<FontSize>('md');
  const [darkMode, setDarkMode] = useState(false);

  // Fragment state
  const [fragments, setFragments] = useState<Fragment[]>([]);
  const [selection, setSelection] = useState<SelectionState>(EMPTY_SELECTION);
  const [showDrawer, setShowDrawer] = useState(false);

  // Audio bookmark — set when user taps "Citar" in listening mode
  const [audioBookmark, setAudioBookmark] = useState<AudioBookmark | null>(null);
  const [showQuoteChoice, setShowQuoteChoice] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const progressDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phraseRefs = useRef<(HTMLSpanElement | null)[]>([]);

  // ── Reading preferences ───────────────────────────────────────────────────

  useEffect(() => {
    const prefs = loadPreferences();
    setFontSize(prefs.fontSize);
    setDarkMode(prefs.darkMode);
  }, []);

  useEffect(() => {
    savePreferences({ fontSize, darkMode });
  }, [fontSize, darkMode]);

  // ── Data fetching ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!bookId) return;

    const token = typeof window !== 'undefined' ? sessionStorage.getItem('access_token') : null;

    Promise.all([
      apiFetch(`/books/${bookId}`),
      apiFetch(`/books/${bookId}/sync-map`).catch(() => null),
      apiFetch(`/books/${bookId}/progress`).catch(() => ({ phraseIndex: 0 })),
      token ? apiFetch(`/books/${bookId}/fragments`).catch(() => []) : Promise.resolve([]),
    ])
      .then(([bookData, syncMapData, progressData, fragmentsData]) => {
        setBook(bookData);
        if (syncMapData?.phrases) setPhrases(syncMapData.phrases);
        const saved = progressData?.phraseIndex ?? 0;
        setSavedPhraseIndex(saved);
        setFragments(fragmentsData ?? []);

        if (bookData.textFileUrl && !syncMapData?.phrases?.length) {
          fetch(bookData.textFileUrl)
            .then((r) => r.text())
            .then(setRawText)
            .catch(() => {});
        }
      })
      .catch((err) => setError(err.message ?? 'Error loading book'))
      .finally(() => setLoading(false));
  }, [bookId]);

  // ── Scroll to saved phrase on load ────────────────────────────────────────

  useEffect(() => {
    if (savedPhraseIndex > 0 && phrases.length > 0) {
      phraseRefs.current[savedPhraseIndex]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [savedPhraseIndex, phrases]);

  // ── Audio event listeners ─────────────────────────────────────────────────

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      const t = audio.currentTime;
      setCurrentTime(t);
      const idx = phraseAt(phrases, t);
      if (idx !== activePhraseIndex) {
        setActivePhraseIndex(idx);
      }
    };

    const onDurationChange = () => setDuration(audio.duration);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onError = () => {
      apiFetch(`/books/${bookId}`)
        .then((data) => setBook(data))
        .catch(() => {});
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('error', onError);
    };
  }, [phrases, activePhraseIndex, bookId]);

  // ── Auto-scroll in Listening mode ─────────────────────────────────────────

  useEffect(() => {
    if (mode === 'listening' && activePhraseIndex >= 0) {
      phraseRefs.current[activePhraseIndex]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [mode, activePhraseIndex]);

  // ── Progress persistence ──────────────────────────────────────────────────

  useEffect(() => {
    if (activePhraseIndex < 0) return;
    const token = typeof window !== 'undefined' ? sessionStorage.getItem('access_token') : null;
    if (!token) return;

    if (progressDebounceRef.current) clearTimeout(progressDebounceRef.current);
    progressDebounceRef.current = setTimeout(() => {
      apiFetch(`/books/${bookId}/progress`, {
        method: 'POST',
        body: JSON.stringify({ phraseIndex: activePhraseIndex }),
      }).catch(() => {});
    }, 2000);

    return () => {
      if (progressDebounceRef.current) clearTimeout(progressDebounceRef.current);
    };
  }, [activePhraseIndex, bookId]);

  // ── Controls ──────────────────────────────────────────────────────────────

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) audio.play();
    else audio.pause();
  }, []);

  const handleScrub = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Number(e.target.value);
  }, []);

  const handleSpeedChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const s = Number(e.target.value);
    setSpeed(s);
    if (audioRef.current) audioRef.current.playbackRate = s;
  }, []);

  const seekToIndex = useCallback((idx: number) => {
    const audio = audioRef.current;
    if (!audio || !phrases.length) return;
    audio.currentTime = seekToPhrase(phrases, idx);
  }, [phrases]);

  const handleModeToggle = useCallback(() => {
    setMode((m) => m === 'reading' ? 'listening' : 'reading');
  }, []);

  // ── Quote from audio ──────────────────────────────────────────────────────

  const handleQuoteFromAudio = useCallback(() => {
    audioRef.current?.pause();
    setAudioBookmark({ phraseIndex: activePhraseIndex >= 0 ? activePhraseIndex : 0 });
    setShowQuoteChoice(true);
  }, [activePhraseIndex]);

  const handleOpenInReading = useCallback(() => {
    setShowQuoteChoice(false);
    setMode('reading');
    const idx = audioBookmark?.phraseIndex ?? 0;
    setTimeout(() => {
      phraseRefs.current[idx]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }, [audioBookmark]);

  const handleBookmarkAndContinue = useCallback(() => {
    setShowQuoteChoice(false);
    audioRef.current?.play();
  }, []);

  const handleResumeAudio = useCallback(() => {
    if (!audioBookmark) return;
    seekToIndex(audioBookmark.phraseIndex);
    setMode('listening');
    setAudioBookmark(null);
    audioRef.current?.play();
  }, [audioBookmark, seekToIndex]);

  // ── Text selection handler ────────────────────────────────────────────────

  const handleTextMouseUp = useCallback((e: React.MouseEvent) => {
    if (e.button === 2) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const text = sel.toString();
    setSelection(applyTextSelection(text));
  }, []);

  const handlePhraseClick = useCallback((idx: number) => {
    seekToIndex(idx);
  }, [seekToIndex]);

  const handleStartSelection = useCallback((idx: number, e: React.MouseEvent) => {
    e.preventDefault();
    seekToIndex(idx);
  }, [seekToIndex]);

  // ── Fragment CRUD callbacks ───────────────────────────────────────────────

  const handleSaveFragment = useCallback(async () => {
    if (!selection.text || !bookId) return;
    try {
      const created = await apiFetch('/fragments', {
        method: 'POST',
        body: JSON.stringify({ bookId, text: selection.text }),
      });
      setFragments((prev) => addFragment(prev, created));
    } catch {}
    setSelection(EMPTY_SELECTION);
    window.getSelection()?.removeAllRanges();
  }, [selection.text, bookId]);

  const handleCancelPopover = useCallback(() => {
    setSelection(EMPTY_SELECTION);
    window.getSelection()?.removeAllRanges();
  }, []);

  const handleDeleteFragment = useCallback(async (id: string) => {
    try {
      await apiFetch(`/fragments/${id}`, { method: 'DELETE' });
      setFragments((prev) => removeFragment(prev, id));
    } catch {}
  }, []);

  const handleCombineFragments = useCallback(async (ids: string[]) => {
    try {
      const combined = await apiFetch('/fragments/combine', {
        method: 'POST',
        body: JSON.stringify({ fragmentIds: ids }),
      });
      setFragments((prev) => replaceFragments(prev, ids, combined));
    } catch {}
  }, []);

  const handleNoteUpdate = useCallback(async (id: string, note: string) => {
    try {
      const updated = await apiFetch(`/fragments/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ note }),
      });
      setFragments((prev) => prev.map((f) => (f.id === id ? updated : f)));
    } catch {}
  }, []);

  // ── Span CSS helper ───────────────────────────────────────────────────────

  const getSpanClass = useCallback((i: number) => {
    if (activePhraseIndex === i) return 'bg-yellow-200 text-gray-900';
    return '';
  }, [activePhraseIndex]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) return <LoadingScreen />;
  if (error || !book) return <ErrorScreen message={error || 'Book not found'} />;

  const audioUrl = book.audioStreamUrl ?? book.audioFileUrl;
  const hasAudio = Boolean(audioUrl);
  const hasSync = phrases.length > 0;
  const fontSizeClass = FONT_SIZE_CLASSES[fontSize];

  return (
    <div className={['flex flex-col md:flex-row min-h-screen', darkMode ? 'bg-gray-950 text-gray-100' : 'bg-white text-gray-800'].join(' ')}>
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <ReaderTopBar
        title={book.title}
        dark={darkMode}
        fontSize={fontSize}
        onFontDecrease={() => {
          const idx = FONT_SIZES.indexOf(fontSize);
          if (idx > 0) setFontSize(FONT_SIZES[idx - 1]);
        }}
        onFontIncrease={() => {
          const idx = FONT_SIZES.indexOf(fontSize);
          if (idx < FONT_SIZES.length - 1) setFontSize(FONT_SIZES[idx + 1]);
        }}
        onDarkToggle={() => setDarkMode((d) => !d)}
        onFragmentsToggle={() => setShowDrawer((v) => !v)}
        fragmentCount={fragments.length}
        hasAudio={hasAudio}
        mode={mode}
        onModeToggle={handleModeToggle}
      />

      {/* Hidden audio element — uses M4B stream URL for browser-native playback */}
      {audioUrl && (
        <audio ref={audioRef} src={audioUrl} preload="metadata" />
      )}

      {/* ── Text column ─────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-2xl mx-auto px-6 pt-14 pb-10 md:pb-16 md:pt-16">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">{book.title}</h1>
          <p className="text-gray-500 text-sm mt-1">{book.author}</p>
        </header>

        <div className={`leading-relaxed ${fontSizeClass}`} onMouseUp={handleTextMouseUp}>
          {hasSync ? (
            phrases.map((phrase, i) => (
              <span
                key={i}
                ref={(el) => { phraseRefs.current[i] = el; }}
                data-phrase-index={i}
                onClick={() => handlePhraseClick(i)}
                onContextMenu={(e) => handleStartSelection(i, e)}
                className={[
                  'rounded px-0.5 transition-colors',
                  getSpanClass(i),
                ].join(' ')}
              >
                {phrase.text}{' '}
              </span>
            ))
          ) : rawText ? (
            <p className="whitespace-pre-wrap">{rawText}</p>
          ) : (
            <p className="text-gray-400 italic">No hay contenido disponible para este libro.</p>
          )}
        </div>
      </main>

      {/* ── Audio sidebar ────────────────────────────────────────────────── */}
      {hasAudio && (
        <>
          {/* Floating play button — visible when no sidebar shown */}
          <button
            onClick={togglePlay}
            className={[
              'fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg flex items-center justify-center z-50 transition bg-blue-600 text-white',
              mode === 'listening' ? 'md:hidden' : '',
            ].join(' ')}
            aria-label={playing ? 'Pausar' : 'Reproducir'}
          >
            {playing ? <PauseIcon /> : <PlayIcon />}
          </button>

          {/* Full controls sidebar */}
          <aside
            className={[
              'border-t md:border-t-0 md:border-l border-gray-200 bg-gray-50',
              'md:w-72 md:flex-shrink-0',
              mode === 'listening' ? 'block' : 'hidden',
            ].join(' ')}
          >
            <div className="p-6 sticky top-12">
              <div className="mb-4">
                <p className="text-sm font-semibold text-gray-900 truncate">{book.title}</p>
                <p className="text-xs text-gray-500 truncate">{book.author}</p>
              </div>

              <button
                onClick={togglePlay}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-medium transition mb-4"
              >
                {playing ? <PauseIcon /> : <PlayIcon />}
                {playing ? 'Pausar' : 'Reproducir'}
              </button>

              <div className="mb-4">
                <input
                  type="range"
                  min={0}
                  max={duration || 0}
                  value={currentTime}
                  step={0.1}
                  onChange={handleScrub}
                  className="w-full accent-blue-600"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-6">
                <span className="text-xs text-gray-500">Velocidad</span>
                <select
                  value={speed}
                  onChange={handleSpeedChange}
                  className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1 bg-white"
                >
                  {SPEEDS.map((s) => (
                    <option key={s} value={s}>{s}×</option>
                  ))}
                </select>
              </div>

              {/* Quote button */}
              <button
                onClick={handleQuoteFromAudio}
                className="w-full flex items-center justify-center gap-2 border border-gray-300 hover:border-blue-400 hover:text-blue-600 text-gray-700 py-2.5 rounded-xl text-sm font-medium transition"
              >
                <QuoteIcon />
                Crear cita
              </button>
            </div>
          </aside>
        </>
      )}

      {/* ── Audio bookmark banner ────────────────────────────────────────── */}
      {audioBookmark && mode === 'reading' && !showQuoteChoice && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-blue-600 text-white px-4 py-3 flex items-center justify-between shadow-lg">
          <span className="text-sm font-medium">
            ▶ Audio pausado en la frase {audioBookmark.phraseIndex + 1}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAudioBookmark(null)}
              className="text-blue-200 hover:text-white text-xs underline"
            >
              Descartar
            </button>
            <button
              onClick={handleResumeAudio}
              className="bg-white text-blue-600 text-sm font-semibold px-3 py-1 rounded-lg hover:bg-blue-50 transition"
            >
              Reanudar
            </button>
          </div>
        </div>
      )}

      {/* ── Quote choice modal ───────────────────────────────────────────── */}
      {showQuoteChoice && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-gray-900 mb-1">Crear cita</h3>
            <p className="text-sm text-gray-500 mb-5">
              El audio está pausado. ¿Qué quieres hacer?
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleOpenInReading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-medium transition text-sm"
              >
                Abrir en modo lectura
              </button>
              <button
                onClick={handleBookmarkAndContinue}
                className="w-full border border-gray-300 hover:border-gray-400 text-gray-700 py-3 rounded-xl font-medium transition text-sm"
              >
                Marcar posición y continuar
              </button>
              <button
                onClick={() => {
                  setShowQuoteChoice(false);
                  audioRef.current?.play();
                }}
                className="w-full text-gray-400 hover:text-gray-600 py-2 text-sm transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Fragment Popover ─────────────────────────────────────────────── */}
      {selection.showPopover && selection.text && (
        <FragmentPopover
          text={selection.text}
          onSave={handleSaveFragment}
          onCancel={handleCancelPopover}
          dark={darkMode}
        />
      )}

      {/* ── Fragment Sheet Drawer ────────────────────────────────────────── */}
      {showDrawer && (
        <FragmentSheet
          fragments={fragments}
          bookAuthor={book.author}
          bookTitle={book.title}
          onClose={() => setShowDrawer(false)}
          onDelete={handleDeleteFragment}
          onCombine={handleCombineFragments}
          onNoteUpdate={handleNoteUpdate}
          dark={darkMode}
        />
      )}
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
    </div>
  );
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center min-h-screen px-4">
      <div className="text-center">
        <p className="text-gray-500 text-sm">{message}</p>
      </div>
    </div>
  );
}

function PlayIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
  );
}

function QuoteIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}
