'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';
import { Citation, readerHref } from '@/lib/research';

/**
 * NEM-024 Checkpoint D — excerpt dialog for one citation. Accessible modal: `role="dialog"`, `aria-modal`, labelled
 * by its title, focus moves inside on open, Tab/Shift+Tab are trapped, Esc closes, and focus returns to the citation
 * button (handled by the caller through `onClose`). Shows the verified excerpt only when `sourceState` is `available`
 * or `position_unavailable`; otherwise only the state text (D-10: a revoked/changed/missing source never shows text).
 */
export default function CitationDialog({ n, citation, bookTitle, onClose }: { n: number; citation: Citation; bookTitle: string; onClose: () => void }) {
  const { t } = useTranslation();
  const tr = t.research.citation;
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab' || !ref.current) return;
    const focusable = Array.from(ref.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'));
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const showsText = (citation.sourceState === 'available' || citation.sourceState === 'position_unavailable') && citation.excerpt !== null;
  const titleId = `citation-dialog-title-${n}`;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
        className="w-full max-w-lg rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-xl p-5 space-y-3"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="text-base font-semibold">{tr.dialogTitle(n)}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">{bookTitle}</p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} className="rounded px-2 py-1 text-sm underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
            {tr.close}
          </button>
        </div>
        {showsText ? (
          <figure className="space-y-2">
            <figcaption className="text-xs font-medium uppercase tracking-wide text-gray-600 dark:text-gray-300">{tr.excerptLabel}</figcaption>
            <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-3 text-sm leading-relaxed whitespace-pre-wrap">{citation.excerpt}</blockquote>
          </figure>
        ) : null}
        {citation.sourceState !== 'available' ? <p className="text-sm" data-testid="source-state">{tr.state[citation.sourceState]}</p> : null}
        {citation.bookId ? (
          <p>
            <Link href={readerHref(citation.bookId)} className="text-sm font-medium underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
              {tr.openBook}
            </Link>
            <span className="block text-xs text-gray-600 dark:text-gray-300">{tr.openBookHint}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}
