'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { phraseAt, seekToPhrase, effectiveDuration, Phrase, Fragment, extractChapters } from '@/lib/reader-utils';
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
import ChapterSheet from '@/components/ChapterSheet';
import ReaderTopBar from '@/components/ReaderTopBar';
import ReaderTutorial, { hasSeenReaderTutorial } from '@/components/ReaderTutorial';
import AudioTutorial from '@/components/AudioTutorial';
import { hasSeenAudioTutorial } from '@/lib/tutorial-flags';
import { useReadingHeartbeat } from '@/lib/use-reading-heartbeat';

const FONT_SIZE_CLASSES: Record<FontSize, string> = {
  sm: 'text-base',
  md: 'text-lg',
  lg: 'text-xl',
  xl: 'text-2xl',
};

type Book = {
  id: string;
  title: string;
  author: string;
  collection: string | null;
  audioFileUrl: string | null;
  audioStreamUrl: string | null;
  textFileUrl: string | null;
  isFree: boolean;
};

type Mode = 'reading' | 'audio' | 'escucha-activa';

type AudioBookmark = { phraseIndex: number };

const SPEEDS = [0.75, 1, 1.25, 1.5];

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

  useReadingHeartbeat(bookId ?? null, activePhraseIndex);
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
  const [showChapterDrawer, setShowChapterDrawer] = useState(false);

  // Audio bookmark — set when user taps "Citar" in listening mode
  const [audioBookmark, setAudioBookmark] = useState<AudioBookmark | null>(null);
  const [showQuoteChoice, setShowQuoteChoice] = useState(false);

  // First-open tutorial
  const [showTutorial, setShowTutorial] = useState(false);
  const [showAudioTutorial, setShowAudioTutorial] = useState(false);

  // Play confirmation — shown when user hits play with saved progress
  const [showPlayConfirm, setShowPlayConfirm] = useState(false);
  // Which mode the play confirm is for (affects whether "Toca donde vas leyendo" is offered)
  const [playConfirmTargetMode, setPlayConfirmTargetMode] = useState<'audio' | 'escucha-activa'>('escucha-activa');

  // Tap-to-sync — user taps a phrase to set audio start position
  const [tapToSyncActive, setTapToSyncActive] = useState(false);
  // Phrase the user tapped while narration is playing — pending a confirm so an
  // accidental tap doesn't yank them away from their place (null = no pending).
  const [pendingJumpIndex, setPendingJumpIndex] = useState<number | null>(null);

  const audioRef = useRef<HTMLAudioElement>(null);
  const progressDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phraseRefs = useRef<(HTMLElement | null)[]>([]);

  // ── Reading preferences ───────────────────────────────────────────────────

  useEffect(() => {
    const prefs = loadPreferences();
    setFontSize(prefs.fontSize);
    setDarkMode(prefs.darkMode);
    setSpeed(prefs.speed);
    if (audioRef.current) audioRef.current.playbackRate = prefs.speed;
  }, []);

  useEffect(() => {
    savePreferences({ fontSize, darkMode, speed });
  }, [fontSize, darkMode, speed]);

  // Re-apply the restored speed whenever the audio element (re)loads its source,
  // since a fresh HTMLAudioElement resets playbackRate to 1.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const apply = () => { audio.playbackRate = speed; };
    audio.addEventListener('loadedmetadata', apply);
    return () => audio.removeEventListener('loadedmetadata', apply);
  }, [speed]);

  // ── Data fetching ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!bookId) return;

    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;

    Promise.all([
      apiFetch(`/books/${bookId}`),
      apiFetch(`/books/${bookId}/sync-map`).catch(() => null),
      apiFetch(`/books/${bookId}/progress`).catch(() => ({ phraseIndex: 0 })),
      token ? apiFetch(`/books/${bookId}/fragments`).catch(() => []) : Promise.resolve([]),
    ])
      .then(([bookData, syncMapData, progressData, fragmentsData]) => {
        setBook(bookData);
        if (bookData.isFree) {
          apiFetch(`/library/${bookId}`, { method: 'POST' }).catch(() => {});
        }
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
      .finally(() => {
        setLoading(false);
        if (!hasSeenReaderTutorial()) setShowTutorial(true);
      });
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
      // Use audio.currentTime directly — no stale closure on activePhraseIndex.
      // React 18 bails out if setActivePhraseIndex receives the same value.
      setCurrentTime(audio.currentTime);
      setActivePhraseIndex(phraseAt(phrases, audio.currentTime));
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
  }, [phrases, bookId]); // activePhraseIndex removed — avoids re-registering listener on every frame

  // ── Auto-scroll in Escucha Activa mode ────────────────────────────────────

  useEffect(() => {
    if (mode === 'escucha-activa' && activePhraseIndex >= 0) {
      phraseRefs.current[activePhraseIndex]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [mode, activePhraseIndex]);

  // ── Progress persistence ──────────────────────────────────────────────────

  useEffect(() => {
    if (activePhraseIndex < 0) return;
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
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

  // Seek to `target` seconds, then optionally play. Defers the seek until the
  // audio has metadata: setting currentTime on an element that hasn't loaded is
  // silently discarded by the browser, so playback would start at 0 — the
  // "resume jumps back to the beginning" bug, especially on a freshly-loaded
  // MinIO MP3 whose metadata is still in flight when the user taps resume.
  const seekAndMaybePlay = useCallback((target: number, play: boolean) => {
    const audio = audioRef.current;
    if (!audio) return;
    const apply = () => {
      audio.currentTime = target;
      if (play) void audio.play();
    };
    if (audio.readyState >= 1 /* HAVE_METADATA */) apply();
    else audio.addEventListener('loadedmetadata', apply, { once: true });
  }, []);

  const seekToIndex = useCallback((idx: number) => {
    if (!phrases.length) return;
    seekAndMaybePlay(seekToPhrase(phrases, idx), false);
  }, [phrases, seekAndMaybePlay]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) audio.play();
    else audio.pause();
  }, []);

  // FAB: dedicated to Modo Escucha Activa (text visible + audio highlighted).
  // In audio mode it brings the text back. In escucha-activa it toggles play/pause.
  const handleFabClick = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (mode === 'escucha-activa') {
      if (audio.paused) audio.play();
      else audio.pause();
      return;
    }
    if (mode === 'audio') {
      // Bring text back without stopping audio
      setMode('escucha-activa');
      return;
    }
    // Reading mode → open Escucha Activa + ask where to start
    if (!audio.paused) audio.pause();
    setPlayConfirmTargetMode('escucha-activa');
    setMode('escucha-activa');
    if (!hasSeenAudioTutorial()) {
      setShowAudioTutorial(true);
    } else {
      setShowPlayConfirm(true);
    }
  }, [mode]);

  const handlePlayFromProgress = useCallback(() => {
    setShowPlayConfirm(false);
    if (!phrases.length) return;
    seekAndMaybePlay(seekToPhrase(phrases, savedPhraseIndex), true);
  }, [savedPhraseIndex, phrases, seekAndMaybePlay]);

  const handlePlayFromStart = useCallback(() => {
    setShowPlayConfirm(false);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
    }
  }, []);

  // User chose to tap the phrase where they are reading
  const handlePlayFromTap = useCallback(() => {
    setShowPlayConfirm(false);
    setMode('escucha-activa'); // ensure text is visible for tapping
    setTapToSyncActive(true);
  }, []);

  // Called when user taps a phrase in tap-to-sync mode
  const handleTapToSync = useCallback((idx: number) => {
    setTapToSyncActive(false);
    setMode('escucha-activa');
    if (!phrases.length) return;
    seekAndMaybePlay(seekToPhrase(phrases, idx), true);
  }, [phrases, seekAndMaybePlay]);

  const handleScrub = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Number(e.target.value);
  }, []);

  // Nav bar button: opens the audio experience. Defaults to Escucha Activa
  // (full text + moving highlight) — readers reported the old text-hidden
  // "Now Playing" default was disorienting ("shows only the active part, can't
  // come back"). The text-hidden player is still available via the "Solo audio"
  // toggle inside the Escucha Activa panel. From any audio mode → back to reading.
  const handleNavAudioButton = useCallback(() => {
    if (mode === 'reading') {
      if (audioRef.current && !audioRef.current.paused) audioRef.current.pause();
      setPlayConfirmTargetMode('escucha-activa');
      setMode('escucha-activa');
      if (!hasSeenAudioTutorial()) {
        setShowAudioTutorial(true);
      } else {
        setShowPlayConfirm(true);
      }
    } else {
      setMode('reading');
    }
  }, [mode]);

  // ── Quote from audio ──────────────────────────────────────────────────────

  const handleQuoteFromAudio = useCallback(() => {
    audioRef.current?.pause();
    setAudioBookmark({ phraseIndex: activePhraseIndex >= 0 ? activePhraseIndex : 0 });
    setShowQuoteChoice(true);
  }, [activePhraseIndex]);

  const handleOpenInReading = useCallback(() => {
    setShowQuoteChoice(false);
    setMode('reading'); // always go to reading so user can select text
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
    if (!audioBookmark || !phrases.length) return;
    setMode('escucha-activa');
    const target = seekToPhrase(phrases, audioBookmark.phraseIndex);
    setAudioBookmark(null);
    seekAndMaybePlay(target, true);
  }, [audioBookmark, phrases, seekAndMaybePlay]);

  // ── Text selection handler ────────────────────────────────────────────────

  const handleTextPointerDown = useCallback(() => {
    // Clear stale selection before a new gesture so the old popover
    // doesn't block the user from making a fresh selection on mobile.
    if (selection.showPopover) {
      setSelection(EMPTY_SELECTION);
      window.getSelection()?.removeAllRanges();
    }
  }, [selection.showPopover]);

  const handleTextPointerUp = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button === 2) return;

    const checkSelection = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) return;
      const text = sel.toString();
      setSelection(applyTextSelection(text));
    };

    // Touch browsers finalise the selection range ~50ms after pointerup.
    if (e.pointerType === 'touch') {
      setTimeout(checkSelection, 50);
    } else {
      checkSelection();
    }
  }, []);

  const handlePhraseClick = useCallback((idx: number) => {
    if (tapToSyncActive) {
      handleTapToSync(idx);
      return;
    }
    // Once narration is playing, confirm before jumping — an accidental tap
    // shouldn't move the listener away from where they are.
    if (audioRef.current && !audioRef.current.paused) {
      setPendingJumpIndex(idx);
      return;
    }
    seekToIndex(idx);
  }, [tapToSyncActive, handleTapToSync, seekToIndex]);

  const handleConfirmJump = useCallback(() => {
    if (pendingJumpIndex !== null) {
      seekAndMaybePlay(seekToPhrase(phrases, pendingJumpIndex), true);
    }
    setPendingJumpIndex(null);
  }, [pendingJumpIndex, phrases, seekAndMaybePlay]);

  const handleCancelJump = useCallback(() => setPendingJumpIndex(null), []);

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

  // ── Chapters ──────────────────────────────────────────────────────────────

  const chapters = useMemo(() => extractChapters(phrases), [phrases]);

  const handleChapterSelect = useCallback((phraseIndex: number) => {
    phraseRefs.current[phraseIndex]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // ── Span CSS helper ───────────────────────────────────────────────────────

  const getSpanClass = useCallback((i: number) => {
    // Yellow reads well on the dark reading background but washes out on the light
    // one — use a clear blue highlight in light mode.
    if (activePhraseIndex === i)
      return darkMode ? 'bg-yellow-200 text-gray-900' : 'bg-sky-300 text-gray-900';
    if (audioBookmark?.phraseIndex === i) return 'ring-2 ring-orange-400 rounded';
    if (tapToSyncActive) return 'cursor-pointer hover:bg-blue-100 hover:text-blue-900 transition-colors';
    return '';
  }, [activePhraseIndex, audioBookmark, tapToSyncActive, darkMode]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) return <LoadingScreen />;
  if (error || !book) return <ErrorScreen message={error || 'Book not found'} />;

  const audioUrl = book.audioStreamUrl ?? book.audioFileUrl;
  const hasAudio = Boolean(audioUrl);
  const hasSync = phrases.length > 0;
  // audio.duration under-reports on byte-concatenated multi-chapter MP3s (stale
  // header) — drive the progress bar off the true full-book length instead.
  const effDuration = effectiveDuration(duration, phrases);
  const fontSizeClass = FONT_SIZE_CLASSES[fontSize];

  return (
    <div className={['flex flex-col md:flex-row min-h-screen', darkMode ? 'bg-gray-950 text-gray-100' : 'bg-white text-gray-800'].join(' ')}>
      {showTutorial && <ReaderTutorial onDismiss={() => setShowTutorial(false)} />}
      {showAudioTutorial && (
        <AudioTutorial
          onDismiss={() => {
            setShowAudioTutorial(false);
            setShowPlayConfirm(true);
          }}
        />
      )}

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
        onModeToggle={handleNavAudioButton}
        hasChapters={chapters.length > 0}
        onChaptersToggle={() => setShowChapterDrawer((v) => !v)}
      />

      {/* Hidden audio element — uses M4B stream URL for browser-native playback */}
      {audioUrl && (
        <audio ref={audioRef} src={audioUrl} preload="metadata" />
      )}

      {/* ── Tap-to-sync overlay instruction ─────────────────────────────── */}
      {tapToSyncActive && (
        <div className="fixed top-14 left-0 right-0 z-40 bg-blue-600 text-white px-4 py-2.5 flex items-center justify-between shadow-md">
          <span className="text-sm font-medium flex items-center gap-2">
            <TouchIcon />
            Toca la frase donde estás leyendo para iniciar el audio desde allí
          </span>
          <button
            onClick={() => { setTapToSyncActive(false); setMode('reading'); }}
            className="text-blue-200 hover:text-white text-xs underline ml-4"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* ── Modo Audio: Now Playing (text hidden) ───────────────────────── */}
      {mode === 'audio' && hasAudio && (
        <main className="flex-1 flex flex-col items-center justify-center min-h-screen px-6 pt-14 pb-10">
          <div className={['w-36 h-36 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl', darkMode ? 'bg-blue-900' : 'bg-blue-600'].join(' ')}>
            <svg className="w-16 h-16 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path d="M3 18v-6a9 9 0 0118 0v6" />
              <path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3z" />
              <path d="M3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z" />
            </svg>
          </div>
          <h1 className={['text-xl font-bold text-center mb-1', darkMode ? 'text-white' : 'text-gray-900'].join(' ')}>{book.title}</h1>
          <p className="text-sm text-gray-500 mb-8 text-center">{book.author}</p>
          <div className="w-full max-w-xs">
            <div className="flex items-center gap-1 mb-5 bg-gray-100 rounded-xl p-1">
              {SPEEDS.map((s) => (
                <button key={s} onClick={() => { setSpeed(s); if (audioRef.current) audioRef.current.playbackRate = s; }}
                  className={['flex-1 text-xs font-medium py-1.5 rounded-lg transition', speed === s ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-800'].join(' ')}>
                  {s}×
                </button>
              ))}
            </div>
            <div className="flex items-center justify-center gap-5 mb-5">
              <button onClick={() => { if (audioRef.current) audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10); }}
                aria-label="Retroceder 10 segundos" className="flex flex-col items-center gap-0.5 text-gray-500 hover:text-blue-600 transition">
                <ReplayIcon /><span className="text-[10px]">10s</span>
              </button>
              <button onClick={togglePlay} className="w-16 h-16 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-md transition" aria-label={playing ? 'Pausar' : 'Reproducir'}>
                {playing ? <PauseIcon /> : <PlayIcon />}
              </button>
              <button onClick={() => { if (audioRef.current) audioRef.current.currentTime = Math.min(effDuration, audioRef.current.currentTime + 10); }}
                aria-label="Avanzar 10 segundos" className="flex flex-col items-center gap-0.5 text-gray-500 hover:text-blue-600 transition">
                <ForwardIcon /><span className="text-[10px]">10s</span>
              </button>
            </div>
            <div className="mb-5">
              <input type="range" min={0} max={effDuration || 0} value={currentTime} step={0.1} onChange={handleScrub} className="w-full accent-blue-600" />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>{formatTime(currentTime)}</span><span>{formatTime(effDuration)}</span>
              </div>
            </div>
            <button onClick={() => setMode('escucha-activa')}
              className="w-full border border-gray-300 hover:border-blue-400 hover:text-blue-600 text-gray-600 py-2.5 rounded-xl text-sm font-medium transition">
              Ver texto — Escucha Activa
            </button>
          </div>
        </main>
      )}

      {/* ── Text column (Lectura + Escucha Activa) ──────────────────────── */}
      <main className={['flex-1 max-w-2xl mx-auto px-6 pt-14 pb-10 md:pb-16 md:pt-16', mode === 'audio' ? 'hidden' : ''].join(' ')}>
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">{book.title}</h1>
          <p className="text-gray-500 text-sm mt-1">{book.author}</p>
        </header>

        <div
          className={['leading-relaxed', fontSizeClass, mode !== 'reading' ? 'select-none' : ''].join(' ')}
          onPointerDown={mode !== 'reading' ? undefined : handleTextPointerDown}
          onPointerUp={mode !== 'reading' ? undefined : handleTextPointerUp}
        >
          {hasSync ? (
            <PhraseRenderer
              phrases={phrases}
              phraseRefs={phraseRefs}
              getSpanClass={getSpanClass}
              onPhraseClick={handlePhraseClick}
              onPhraseContextMenu={handleStartSelection}
              dark={darkMode}
              tapToSyncActive={tapToSyncActive}
            />
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
          {/* FAB — dedicated to Modo Escucha Activa. Hidden in audio mode (background). */}
          {mode !== 'audio' && (
            <button
              onClick={handleFabClick}
              className={[
                'fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg flex items-center justify-center z-50 transition bg-blue-600 text-white',
                mode === 'escucha-activa' ? 'md:hidden' : '',
              ].join(' ')}
              aria-label={
                mode === 'reading' ? 'Abrir Modo Escucha Activa'
                : playing ? 'Pausar' : 'Reproducir'
              }
            >
              {mode === 'reading' ? <HeadphonesSmIcon /> : playing ? <PauseIcon /> : <PlayIcon />}
            </button>
          )}

          {/* Play confirmation card — appears above the floating button */}
          {showPlayConfirm && (
            <div className="fixed bottom-24 right-4 z-50 bg-white rounded-2xl shadow-2xl border border-gray-100 w-72 p-4">
              <p className="text-sm font-semibold text-gray-900 mb-1">¿Dónde empezamos?</p>
              <p className="text-xs text-gray-500 mb-4">
                Elige desde dónde iniciar el audio.
              </p>
              <div className="flex flex-col gap-2">
                {hasSync && playConfirmTargetMode === 'escucha-activa' && (
                  <button
                    onClick={handlePlayFromTap}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2"
                  >
                    <TouchIcon />
                    Toca donde vas leyendo
                  </button>
                )}
                {savedPhraseIndex > 0 && (
                  <button
                    onClick={handlePlayFromProgress}
                    className="w-full border border-blue-200 hover:border-blue-400 text-blue-700 py-2.5 rounded-xl text-sm font-medium transition"
                  >
                    Continuar desde frase {savedPhraseIndex + 1}
                  </button>
                )}
                <button
                  onClick={handlePlayFromStart}
                  className="w-full border border-gray-200 hover:border-gray-300 text-gray-700 py-2.5 rounded-xl text-sm font-medium transition"
                >
                  Desde el principio
                </button>
                <button
                  onClick={() => { setShowPlayConfirm(false); setMode('reading'); setTapToSyncActive(false); }}
                  className="text-gray-400 hover:text-gray-600 text-xs py-1 transition"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Confirm before jumping the narration mid-playback */}
          {pendingJumpIndex !== null && (
            <div className="fixed bottom-24 right-4 z-50 bg-white rounded-2xl shadow-2xl border border-gray-100 w-72 p-4">
              <p className="text-sm font-semibold text-gray-900 mb-1">¿Mover la narración aquí?</p>
              <p className="text-xs text-gray-500 mb-4">
                Vas por la frase {activePhraseIndex >= 0 ? activePhraseIndex + 1 : 1}. Saltarás a la frase {pendingJumpIndex + 1}.
              </p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleConfirmJump}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl text-sm font-medium transition"
                >
                  Mover aquí
                </button>
                <button
                  onClick={handleCancelJump}
                  className="text-gray-400 hover:text-gray-600 text-xs py-1 transition"
                >
                  Seguir escuchando
                </button>
              </div>
            </div>
          )}

          {/* Full controls sidebar */}
          <aside
            className={[
              'border-t md:border-t-0 md:border-l border-gray-200 bg-gray-50',
              'md:w-72 md:flex-shrink-0',
              mode === 'escucha-activa' ? 'block' : 'hidden',
            ].join(' ')}
          >
            <div className="p-6 sticky top-12">
              {/* Header: mode label + close button */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-0.5">
                    Modo Escucha Activa
                  </p>
                  <p className="text-sm font-semibold text-gray-900 truncate">{book.title}</p>
                  <p className="text-xs text-gray-500 truncate">{book.author}</p>
                </div>
                <button
                  onClick={() => setMode('reading')}
                  aria-label="Cerrar panel de audio"
                  className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition ml-2"
                >
                  <CloseIcon />
                </button>
              </div>

              {/* No sync map warning */}
              {!hasSync && (
                <div className="mb-4 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs text-amber-700">
                    Este libro aún no tiene sincronización texto-audio. El audio se reproduce pero las frases no se resaltarán.
                  </p>
                </div>
              )}

              {/* Speed selector — top of panel for easy access */}
              <div className="flex items-center gap-1 mb-4 bg-gray-100 rounded-xl p-1">
                {SPEEDS.map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setSpeed(s);
                      if (audioRef.current) audioRef.current.playbackRate = s;
                    }}
                    className={[
                      'flex-1 text-xs font-medium py-1.5 rounded-lg transition',
                      speed === s
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-500 hover:text-gray-800',
                    ].join(' ')}
                  >
                    {s}×
                  </button>
                ))}
              </div>

              {/* Transport controls: −10s / play-pause / +10s */}
              <div className="flex items-center justify-center gap-4 mb-4">
                <button
                  onClick={() => {
                    if (audioRef.current) audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10);
                  }}
                  aria-label="Retroceder 10 segundos"
                  className="flex flex-col items-center gap-0.5 text-gray-500 hover:text-blue-600 transition"
                >
                  <ReplayIcon />
                  <span className="text-[10px]">10s</span>
                </button>

                <button
                  onClick={togglePlay}
                  className="w-16 h-16 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-md transition"
                  aria-label={playing ? 'Pausar' : 'Reproducir'}
                >
                  {playing ? <PauseIcon /> : <PlayIcon />}
                </button>

                <button
                  onClick={() => {
                    if (audioRef.current) audioRef.current.currentTime = Math.min(effDuration, audioRef.current.currentTime + 10);
                  }}
                  aria-label="Avanzar 10 segundos"
                  className="flex flex-col items-center gap-0.5 text-gray-500 hover:text-blue-600 transition"
                >
                  <ForwardIcon />
                  <span className="text-[10px]">10s</span>
                </button>
              </div>

              <div className="mb-6">
                <input
                  type="range"
                  min={0}
                  max={effDuration || 0}
                  value={currentTime}
                  step={0.1}
                  onChange={handleScrub}
                  className="w-full accent-blue-600"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(effDuration)}</span>
                </div>
              </div>

              {/* Quote button */}
              <button
                onClick={handleQuoteFromAudio}
                className="w-full flex items-center justify-center gap-2 border border-gray-300 hover:border-blue-400 hover:text-blue-600 text-gray-700 py-2.5 rounded-xl text-sm font-medium transition"
              >
                <QuoteIcon />
                Crear cita
              </button>

              {/* Solo audio: hide the text for screen-off / earbud listening.
                  Audio keeps playing; "Ver texto" in that mode brings it back. */}
              <button
                onClick={() => setMode('audio')}
                className="mt-3 w-full text-xs text-gray-500 hover:text-blue-600 py-1.5 transition"
              >
                Solo audio — ocultar texto
              </button>
            </div>
          </aside>
        </>
      )}

      {/* ── Audio bookmark banner ────────────────────────────────────────── */}
      {audioBookmark && mode === 'reading' && !showQuoteChoice && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-blue-600 text-white px-4 py-3 flex items-center justify-between shadow-lg">
          <span className="text-sm font-medium">
            🔖 Cita marcada en frase {audioBookmark.phraseIndex + 1}
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
              Ir al audio
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
          bookCollection={book.collection}
          onClose={() => setShowDrawer(false)}
          onDelete={handleDeleteFragment}
          onCombine={handleCombineFragments}
          dark={darkMode}
        />
      )}

      {/* ── Chapter Sheet Drawer ─────────────────────────────────────────── */}
      {showChapterDrawer && (
        <ChapterSheet
          chapters={chapters}
          onChapterSelect={handleChapterSelect}
          onClose={() => setShowChapterDrawer(false)}
          dark={darkMode}
        />
      )}
    </div>
  );
}

type PhraseRendererProps = {
  phrases: Phrase[];
  phraseRefs: React.MutableRefObject<(HTMLElement | null)[]>;
  getSpanClass: (i: number) => string;
  onPhraseClick: (i: number) => void;
  onPhraseContextMenu: (i: number, e: React.MouseEvent) => void;
  dark: boolean;
  tapToSyncActive?: boolean;
};

function PhraseRenderer({ phrases, phraseRefs, getSpanClass, onPhraseClick, onPhraseContextMenu, dark, tapToSyncActive }: PhraseRendererProps) {
  type Block =
    | { kind: 'heading'; i: number; phrase: Phrase }
    | { kind: 'paragraph'; items: Array<{ i: number; phrase: Phrase }> };

  const blocks = useMemo<Block[]>(() => {
    const result: Block[] = [];
    let currentPara: Array<{ i: number; phrase: Phrase }> = [];

    phrases.forEach((phrase, i) => {
      if (phrase.type === 'heading') {
        if (currentPara.length) { result.push({ kind: 'paragraph', items: currentPara }); currentPara = []; }
        result.push({ kind: 'heading', i, phrase });
      } else if (phrase.type === 'paragraph-break') {
        if (currentPara.length) { result.push({ kind: 'paragraph', items: currentPara }); currentPara = []; }
      } else {
        currentPara.push({ i, phrase });
      }
    });
    if (currentPara.length) result.push({ kind: 'paragraph', items: currentPara });
    return result;
  }, [phrases]);

  const headingClass = dark
    ? 'text-xl font-bold mt-10 mb-3 text-gray-100'
    : 'text-xl font-bold mt-10 mb-3 text-gray-900';

  return (
    <>
      {blocks.map((block, bi) =>
        block.kind === 'heading' ? (
          <h2
            key={bi}
            ref={(el) => { phraseRefs.current[block.i] = el; }}
            data-phrase-index={block.i}
            className={headingClass}
          >
            {block.phrase.text}
          </h2>
        ) : (
          <p key={bi} className="mb-5">
            {block.items.map(({ i, phrase }) => (
              <span
                key={i}
                ref={(el) => { phraseRefs.current[i] = el; }}
                data-phrase-index={i}
                onClick={() => onPhraseClick(i)}
                onContextMenu={(e) => onPhraseContextMenu(i, e)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onPhraseClick(i)}
                role={tapToSyncActive ? 'button' : undefined}
                tabIndex={tapToSyncActive ? 0 : undefined}
                className={['rounded px-0.5 transition-colors', getSpanClass(i)].join(' ')}
              >
                {phrase.text}{' '}
              </span>
            ))}
          </p>
        )
      )}
    </>
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

// Rotate-CCW (Lucide style) — replay / rewind
function ReplayIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v5h5" />
    </svg>
  );
}

// Rotate-CW (Lucide style) — forward
function ForwardIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 3v5h-5" />
    </svg>
  );
}

function HeadphonesSmIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M3 18v-6a9 9 0 0118 0v6" />
      <path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3z" />
      <path d="M3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function TouchIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 11V7a3 3 0 016 0v4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 11H7a1 1 0 00-1 1v6a5 5 0 0010 0v-3a1 1 0 00-1-1h-2" />
    </svg>
  );
}
