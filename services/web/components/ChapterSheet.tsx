'use client';

import { Chapter } from '@/lib/reader-utils';
import { useTranslation } from '@/lib/i18n';

type Props = {
  chapters: Chapter[];
  onChapterSelect: (phraseIndex: number) => void;
  onClose: () => void;
  dark?: boolean;
};

export default function ChapterSheet({ chapters, onChapterSelect, onClose, dark = false }: Props) {
  const { t } = useTranslation();
  const tc = t.reader.chapters;
  const drawer = dark ? 'bg-gray-900 text-gray-100' : 'bg-white';
  const border = dark ? 'border-gray-700' : 'border-gray-100';
  const heading = dark ? 'text-gray-100' : 'text-gray-900';
  const item = dark
    ? 'text-gray-200 hover:bg-gray-800'
    : 'text-gray-800 hover:bg-gray-50';
  const empty = dark ? 'text-gray-500' : 'text-gray-400';

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={tc.ariaLabel}
        onKeyDown={handleKeyDown}
        className={['fixed top-0 right-0 h-full w-80 shadow-xl z-50 flex flex-col', drawer].join(' ')}
      >
        <div className={['flex items-center justify-between px-5 py-4 border-b', border].join(' ')}>
          <h2 className={['text-base font-semibold', heading].join(' ')}>{tc.title}</h2>
          <button onClick={onClose} aria-label={tc.close} className="text-gray-400 hover:text-gray-600 transition focus:outline-none focus:ring-2 focus:ring-blue-500 rounded">
            <XIcon aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {chapters.length === 0 ? (
            <p className={['text-sm text-center mt-8 px-5', empty].join(' ')}>
              {tc.empty}
            </p>
          ) : (
            chapters.map((ch, i) => (
              <button
                key={ch.index}
                onClick={() => { onChapterSelect(ch.index); onClose(); }}
                className={['w-full text-left px-5 py-3 flex items-start gap-3 transition', item].join(' ')}
              >
                <span className={['text-xs font-mono mt-0.5 w-5 flex-shrink-0 text-right', dark ? 'text-gray-500' : 'text-gray-400'].join(' ')}>
                  {i + 1}
                </span>
                <span className="text-sm leading-snug">{ch.title}</span>
              </button>
            ))
          )}
        </div>
      </aside>
    </>
  );
}

function XIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
