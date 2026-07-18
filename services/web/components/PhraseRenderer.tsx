'use client';

import { useMemo } from 'react';
import { Phrase } from '@/lib/reader-utils';

export type PhraseRendererProps = {
  phrases: Phrase[];
  phraseRefs: React.MutableRefObject<(HTMLElement | null)[]>;
  getSpanClass: (i: number) => string;
  onPhraseClick: (i: number) => void;
  onPhraseContextMenu: (i: number, e: React.MouseEvent) => void;
  dark: boolean;
  tapToSyncActive?: boolean;
};

/**
 * Renders the book's phrases as headings + paragraphs of tappable spans, wiring
 * each span's ref into `phraseRefs` by phrase index. Shared by the continuous
 * scroll view and the paged (column) view so click-to-seek, fragment capture,
 * and highlighting behave identically in both.
 */
export default function PhraseRenderer({
  phrases,
  phraseRefs,
  getSpanClass,
  onPhraseClick,
  onPhraseContextMenu,
  dark,
  tapToSyncActive,
}: PhraseRendererProps) {
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
