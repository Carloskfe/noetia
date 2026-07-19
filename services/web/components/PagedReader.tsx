'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Phrase, pageCount, clampPage, pageForOffset } from '@/lib/reader-utils';
import PhraseRenderer from './PhraseRenderer';
import { useTranslation } from '@/lib/i18n';

const GAP = 48;          // px gutter between pages (off-screen)
const MIN_PAD_X = 24;    // px minimum horizontal page margin (mobile)
const PAD_Y = 32;        // px vertical page margin — generous, book-like
const CONTROLS_H = 52;   // px bottom bar (progress track + page indicator)
const MAX_MEASURE = 620; // px — cap the text column to a comfortable line length

type Props = {
  phrases: Phrase[];
  phraseRefs: React.MutableRefObject<(HTMLElement | null)[]>;
  fontSizeClass: string;
  dark: boolean;
  getSpanClass: (i: number) => string;
  onPhraseClick: (i: number) => void;
  onPhraseContextMenu: (i: number, e: React.MouseEvent) => void;
  /** Page to open on first mount will contain this phrase (resume position). */
  initialPhraseIndex?: number;
  /** Fires with the first narratable phrase on the current page (progress + persistence). */
  onPagePhraseChange?: (phraseIndex: number) => void;
  /** When true (Escucha Activa), the page auto-flips to follow the narrated phrase. */
  followActive?: boolean;
  /** The currently narrated phrase; the page flips to keep it visible when followActive. */
  activePhraseIndex?: number;
};

export default function PagedReader({
  phrases, phraseRefs, fontSizeClass, dark, getSpanClass,
  onPhraseClick, onPhraseContextMenu, initialPhraseIndex = 0, onPagePhraseChange,
  followActive = false, activePhraseIndex = -1,
}: Props) {
  const { t } = useTranslation();
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const [pageWidth, setPageWidth] = useState(0); // content-box width of one page
  const [padX, setPadX] = useState(MIN_PAD_X);   // horizontal margin; widens on large screens to centre the column
  const [total, setTotal] = useState(1);
  const [page, setPage] = useState(0);

  // Refs mirror state so event handlers / observers read fresh values.
  const pageRef = useRef(0);
  const totalRef = useRef(1);
  const pageWidthRef = useRef(0);
  const padXRef = useRef(MIN_PAD_X);
  const anchorRef = useRef(initialPhraseIndex); // phrase kept visible across reflow
  const didInitRef = useRef(false);
  pageRef.current = page;
  totalRef.current = total;
  pageWidthRef.current = pageWidth;
  padXRef.current = padX;

  const pitch = pageWidth + GAP;

  // The page a phrase sits on. Its rect.left is relative to the CURRENT (already
  // translated) page, so recover the absolute content offset first, then floor.
  const pageOfPhrase = useCallback((i: number): number | null => {
    const vp = viewportRef.current;
    const el = phraseRefs.current[i];
    if (!vp || !el || pageWidthRef.current <= 0) return null;
    const leftEdge = vp.getBoundingClientRect().left + padXRef.current;
    const pitchNow = pageWidthRef.current + GAP;
    const absoluteLeft = pageRef.current * pitchNow + (el.getBoundingClientRect().left - leftEdge);
    return clampPage(pageForOffset(absoluteLeft, pageWidthRef.current, GAP), totalRef.current);
  }, [phraseRefs]);

  const goToPhrase = useCallback((i: number) => {
    const p = pageOfPhrase(i);
    if (p != null) setPage(p);
  }, [pageOfPhrase]);

  // First narratable phrase visible on the current page.
  const firstPhraseOnPage = useCallback((): number => {
    const vp = viewportRef.current;
    if (!vp || pageWidthRef.current <= 0) return -1;
    const leftEdge = vp.getBoundingClientRect().left + padXRef.current;
    for (let i = 0; i < phrases.length; i++) {
      const ph = phrases[i];
      if (ph.endTime <= ph.startTime) continue; // skip headings / markers
      const el = phraseRefs.current[i];
      if (!el) continue;
      const left = el.getBoundingClientRect().left;
      if (left >= leftEdge - 2 && left < leftEdge + pageWidthRef.current) return i;
    }
    return -1;
  }, [phrases, phraseRefs]);

  // ── Measure & paginate ──────────────────────────────────────────────────
  const measure = useCallback(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const cw = vp.clientWidth;
    // Widen the side margins on large screens so the text column keeps a
    // comfortable book measure (~620px) and sits centred, like a Kindle page.
    const px = Math.max(MIN_PAD_X, Math.round((cw - MAX_MEASURE) / 2));
    setPadX(px);
    setPageWidth(Math.max(0, cw - 2 * px));
  }, []);

  useEffect(() => {
    measure();
    const vp = viewportRef.current;
    if (!vp || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(vp);
    return () => ro.disconnect();
  }, [measure, fontSizeClass, phrases]);

  // Once a page width is known, count pages and (re)anchor to the tracked phrase.
  useEffect(() => {
    const content = contentRef.current;
    if (!content || pageWidth <= 0) return;
    // rAF: let the browser lay the columns out at the new width before measuring.
    const raf = requestAnimationFrame(() => {
      const count = pageCount(content.scrollWidth, pageWidth, GAP);
      setTotal(count);
      totalRef.current = count;
      const target = didInitRef.current ? anchorRef.current : initialPhraseIndex;
      didInitRef.current = true;
      const p = pageOfPhrase(target);
      setPage(p ?? 0);
    });
    return () => cancelAnimationFrame(raf);
  }, [pageWidth, phrases, initialPhraseIndex, pageOfPhrase]);

  // Report the current page's first phrase up (progress + persistence).
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const idx = firstPhraseOnPage();
      if (idx >= 0) {
        anchorRef.current = idx;
        onPagePhraseChange?.(idx);
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [page, total, firstPhraseOnPage, onPagePhraseChange]);

  // Auto-flip to follow the narrated phrase during Escucha Activa. Also keeps it
  // as the reflow anchor so a resize/font change lands back on the spoken page.
  useEffect(() => {
    if (!followActive || activePhraseIndex < 0) return;
    anchorRef.current = activePhraseIndex;
    goToPhrase(activePhraseIndex);
  }, [followActive, activePhraseIndex, goToPhrase]);

  const turn = useCallback((dir: -1 | 1) => {
    setPage((p) => clampPage(p + dir, totalRef.current));
  }, []);

  // ── Keyboard navigation ─────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); turn(1); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); turn(-1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [turn]);

  const atStart = page <= 0;
  const atEnd = page >= total - 1;
  const zoneBtn = dark ? 'text-gray-600 hover:text-gray-300' : 'text-gray-300 hover:text-gray-600';
  // Reading position through the book (0 on the first page, 1 on the last).
  const progress = total > 1 ? page / (total - 1) : 1;
  const trackBg = dark ? 'bg-gray-700/70' : 'bg-gray-200';
  const trackFill = dark ? 'bg-gray-400' : 'bg-gray-400';

  return (
    <div className="h-full flex flex-col">
      {/* Page viewport — one column wide, columns overflow & are translated */}
      <div
        ref={viewportRef}
        className="relative flex-1 overflow-hidden"
        style={{ paddingLeft: padX, paddingRight: padX, paddingTop: PAD_Y, paddingBottom: PAD_Y }}
      >
        <div
          ref={contentRef}
          className={[
            'h-full max-w-none',
            fontSizeClass,
            'leading-relaxed',
            // Book-like block: justified, hyphenated, first-line indents and no
            // inter-paragraph gap — so a page reads like a printed page, not a
            // web article. Scoped to the paged column; scroll view is untouched.
            'text-justify',
            '[&_p]:indent-8 [&_p]:mb-0',
          ].join(' ')}
          style={{
            columnWidth: pageWidth > 0 ? `${pageWidth}px` : undefined,
            columnGap: `${GAP}px`,
            columnFill: 'auto',
            transform: `translateX(-${page * pitch}px)`,
            transition: 'transform 250ms ease',
            willChange: 'transform',
            hyphens: 'auto',
            WebkitHyphens: 'auto',
          }}
        >
          <PhraseRenderer
            phrases={phrases}
            phraseRefs={phraseRefs}
            getSpanClass={getSpanClass}
            onPhraseClick={onPhraseClick}
            onPhraseContextMenu={onPhraseContextMenu}
            dark={dark}
          />
        </div>

        {/* Edge tap zones — confined to the page margin so they never steal a
            phrase tap (seek / fragment capture) from the text column. */}
        {!atStart && (
          <button
            type="button"
            aria-label={t.reader.paged.prev}
            onClick={() => turn(-1)}
            className="absolute inset-y-0 left-0 flex items-center justify-center cursor-pointer"
            style={{ width: padX }}
          >
            <ChevronLeft className={zoneBtn} />
          </button>
        )}
        {!atEnd && (
          <button
            type="button"
            aria-label={t.reader.paged.next}
            onClick={() => turn(1)}
            className="absolute inset-y-0 right-0 flex items-center justify-center cursor-pointer"
            style={{ width: padX }}
          >
            <ChevronRight className={zoneBtn} />
          </button>
        )}
      </div>

      {/* Bottom bar — slim progress track + page indicator. Hidden while
          following audio: the page auto-flips and the audio controls own
          transport, so it would only collide with them. */}
      <div
        className={['flex-shrink-0 flex flex-col items-center justify-center gap-2 px-6', followActive ? 'hidden' : ''].join(' ')}
        style={{ height: CONTROLS_H }}
      >
        <div className={['w-full h-[3px] rounded-full overflow-hidden', trackBg].join(' ')} style={{ maxWidth: MAX_MEASURE }}>
          <div
            className={['h-full rounded-full transition-[width] duration-300 ease-out', trackFill].join(' ')}
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
        <div className={['flex items-center justify-center gap-5 text-[11px] tracking-wide', dark ? 'text-gray-500' : 'text-gray-400'].join(' ')}>
          <button
            type="button"
            onClick={() => turn(-1)}
            disabled={atStart}
            aria-label={t.reader.paged.prev}
            className="px-2 py-0.5 rounded disabled:opacity-30 hover:opacity-80 transition"
          >
            ‹
          </button>
          <span data-testid="page-indicator" className="tabular-nums">
            {t.reader.paged.pageOf(page + 1, total)}
          </span>
          <button
            type="button"
            onClick={() => turn(1)}
            disabled={atEnd}
            aria-label={t.reader.paged.next}
            className="px-2 py-0.5 rounded disabled:opacity-30 hover:opacity-80 transition"
          >
            ›
          </button>
        </div>
      </div>
    </div>
  );
}

function ChevronLeft({ className }: { className?: string }) {
  return (
    <svg className={`w-6 h-6 ${className ?? ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg className={`w-6 h-6 ${className ?? ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
    </svg>
  );
}
