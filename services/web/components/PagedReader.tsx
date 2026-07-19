'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Phrase, pageCount, clampPage, pageForOffset } from '@/lib/reader-utils';
import PhraseRenderer from './PhraseRenderer';
import { useTranslation } from '@/lib/i18n';

const GAP = 48;               // px gutter between pages (off-screen)
const MAX_MEASURE = 720;      // px — cap the text column to a comfortable line length
const FRAME_BREAKPOINT = 640; // px — below this the page is full-bleed (mobile); above, framed
const INNER_X_DESKTOP = 44;   // px horizontal text inset inside a framed page
const INNER_X_MOBILE = 24;    // px horizontal text inset on full-bleed mobile
const INNER_Y = 30;           // px vertical text inset inside the page
const OUTER_Y = 28;           // px space above/below the page card (framed only)
const CONTROLS_H = 52;        // px bottom bar (progress track + page indicator)
const SWIPE_MIN = 45;         // px minimum horizontal travel to count as a page swipe

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
  const frameRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const [pageWidth, setPageWidth] = useState(0);       // content-box width of one page (the text measure)
  const [frameWidth, setFrameWidth] = useState(0);     // outer width of the page card (measure + insets)
  const [innerX, setInnerX] = useState(INNER_X_MOBILE); // horizontal text inset
  const [framed, setFramed] = useState(false);          // draw the page as a bordered sheet (wide screens)
  const [total, setTotal] = useState(1);
  const [page, setPage] = useState(0);

  // Refs mirror state so event handlers / observers read fresh values.
  const pageRef = useRef(0);
  const totalRef = useRef(1);
  const pageWidthRef = useRef(0);
  const innerXRef = useRef(INNER_X_MOBILE);
  const anchorRef = useRef(initialPhraseIndex); // phrase kept visible across reflow
  const didInitRef = useRef(false);
  pageRef.current = page;
  totalRef.current = total;
  pageWidthRef.current = pageWidth;
  innerXRef.current = innerX;

  const pitch = pageWidth + GAP;

  // The page a phrase sits on. Its rect.left is relative to the CURRENT (already
  // translated) page, so recover the absolute content offset first, then floor.
  const pageOfPhrase = useCallback((i: number): number | null => {
    const frame = frameRef.current;
    const el = phraseRefs.current[i];
    if (!frame || !el || pageWidthRef.current <= 0) return null;
    const leftEdge = frame.getBoundingClientRect().left + innerXRef.current;
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
    const frame = frameRef.current;
    if (!frame || pageWidthRef.current <= 0) return -1;
    const leftEdge = frame.getBoundingClientRect().left + innerXRef.current;
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
    const isFramed = cw >= FRAME_BREAKPOINT;
    const ix = isFramed ? INNER_X_DESKTOP : INNER_X_MOBILE;
    // The page card is at most one comfortable measure wide (plus its insets);
    // narrower viewports go full-bleed. Text measure = card width − insets.
    const frameW = Math.min(cw, MAX_MEASURE + 2 * ix);
    setFramed(isFramed);
    setInnerX(ix);
    setFrameWidth(frameW);
    setPageWidth(Math.max(0, frameW - 2 * ix));
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

  // ── Touch swipe (mobile page turn) ────────────────────────────────────────
  // A quick horizontal drag turns the page (left → next, right → prev), so the
  // existing slide transition plays. Ignored while listening (audio drives the
  // page) and when a text selection is in progress, so it never fights fragment
  // capture.
  const touchStartRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t0 = e.touches[0];
    touchStartRef.current = { x: t0.clientX, y: t0.clientY, t: Date.now() };
  }, []);
  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    const s = touchStartRef.current;
    touchStartRef.current = null;
    if (!s || followActive) return;
    const sel = typeof window !== 'undefined' ? window.getSelection() : null;
    if (sel && !sel.isCollapsed) return; // user is selecting text → don't turn
    const t1 = e.changedTouches[0];
    const dx = t1.clientX - s.x;
    const dy = t1.clientY - s.y;
    if (Date.now() - s.t > 600) return;                         // too slow to be a flick
    if (Math.abs(dx) < SWIPE_MIN || Math.abs(dx) < Math.abs(dy) * 1.4) return; // not horizontal enough
    turn(dx < 0 ? 1 : -1);
  }, [followActive, turn]);

  const atStart = page <= 0;
  const atEnd = page >= total - 1;
  const zoneBtn = dark ? 'text-gray-600 hover:text-gray-300' : 'text-gray-300 hover:text-gray-600';
  // Reading position through the book (0 on the first page, 1 on the last).
  const progress = total > 1 ? page / (total - 1) : 1;
  // Translucent so it stays visible on both the paper card and the surround.
  const trackBg = dark ? 'bg-white/10' : 'bg-black/10';
  const trackFill = 'bg-gray-400';
  const paperBg = dark ? '#111827' : '#FBFAF7';
  const frameBorder = dark ? '#1F2937' : '#E7E4DC';
  // Framed pages sit on a cool neutral-gray surround so the sheet pops. In dark
  // mode the reader background is already darker than the card, so leave it.
  const surroundBg = framed && !dark ? '#E3E6EB' : undefined;

  return (
    <div className="h-full flex flex-col" style={{ background: surroundBg }}>
      {/* Reading area — centres the page card horizontally. */}
      <div
        ref={viewportRef}
        className="relative flex-1 min-h-0 flex justify-center overflow-hidden"
        style={{ paddingTop: framed ? OUTER_Y : 0, paddingBottom: framed ? OUTER_Y : 0 }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* The page — a bordered sheet on wide screens, full-bleed on mobile.
            Its inner width is the text measure; other pages overflow and are
            translated + clipped here. */}
        <div
          ref={frameRef}
          className={['relative h-full overflow-hidden', framed ? 'rounded-2xl border shadow-[0_4px_24px_rgba(0,0,0,0.10)]' : ''].join(' ')}
          style={{
            width: frameWidth || '100%',
            paddingLeft: innerX,
            paddingRight: innerX,
            paddingTop: INNER_Y,
            paddingBottom: INNER_Y,
            background: framed ? paperBg : undefined,
            borderColor: framed ? frameBorder : undefined,
          }}
        >
          <div
            ref={contentRef}
            className={[
              'h-full max-w-none',
              fontSizeClass,
              'leading-relaxed',
              // Book-like block: justified, hyphenated, first-line indents and no
              // inter-paragraph gap — so a page reads like a printed page.
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

          {/* Edge tap zones — confined to the page's side inset so they never
              steal a phrase tap (seek / fragment capture) from the text. */}
          {!atStart && (
            <button
              type="button"
              aria-label={t.reader.paged.prev}
              onClick={() => turn(-1)}
              className="absolute inset-y-0 left-0 z-10 flex items-center justify-center cursor-pointer"
              style={{ width: innerX }}
            >
              <ChevronLeft className={zoneBtn} />
            </button>
          )}
          {!atEnd && (
            <button
              type="button"
              aria-label={t.reader.paged.next}
              onClick={() => turn(1)}
              className="absolute inset-y-0 right-0 z-10 flex items-center justify-center cursor-pointer"
              style={{ width: innerX }}
            >
              <ChevronRight className={zoneBtn} />
            </button>
          )}
        </div>
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
