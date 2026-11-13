'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';

/**
 * Causas Noetia preference (PO-053): the user picks ONE cause, or continues without choosing — in which case
 * the 2.22% allocation is distributed equally among all three. No random option, no second cause.
 *
 * `onSave` fires ONLY after the preference was persisted. A failed save keeps the selection, shows an error
 * with retry, and never proceeds on its own. `onSkip` makes no API call (an existing preference is untouched).
 */

type Cause = { id: string; slug: string; name: string; description: string };

interface Props {
  onSave: () => void;
  onSkip: () => void;
}

type LoadState = 'loading' | 'error' | 'ready';
type SaveState = 'idle' | 'saving' | 'error' | 'saved';

const ICON_PATHS: Record<string, string> = {
  // paw
  'bienestar-animal':
    'M12 14c-2.5 0-4.5 2-4.5 3.8 0 1.2 1 1.7 2 1.7.9 0 1.6-.5 2.5-.5s1.6.5 2.5.5c1 0 2-.5 2-1.7C16.5 16 14.5 14 12 14ZM6.5 11.5a1.75 2.25 0 1 0 0-.01M17.5 11.5a1.75 2.25 0 1 0 0-.01M9.5 7.5a1.75 2.25 0 1 0 0-.01M14.5 7.5a1.75 2.25 0 1 0 0-.01',
  // open book
  'ninez-y-juventud': 'M12 6.5C10.5 5.5 8.3 5 5 5v12.5c3.3 0 5.5.5 7 1.5m0-12.5c1.5-1 3.7-1.5 7-1.5v12.5c-3.3 0-5.5.5-7 1.5m0-12.5V19',
  // leaf
  'medio-ambiente': 'M5 19c0-8 5-13 14-14 0 9-5 14-13 14m0 0c2-4 5-7 9-9',
};

function CauseIcon({ slug }: { slug: string }) {
  const d = ICON_PATHS[slug];
  if (!d) return null;
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="w-6 h-6 shrink-0 text-emerald-700" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

export default function CauseSelector({ onSave, onSkip }: Props) {
  const { t } = useTranslation();
  const c = t.causeSelector;
  const localized = c.causes as Record<string, { name: string; description: string } | undefined>;

  const [causes, setCauses] = useState<Cause[]>([]);
  const [load, setLoad] = useState<LoadState>('loading');
  const [selected, setSelected] = useState<string | null>(null);
  const [save, setSave] = useState<SaveState>('idle');
  const titleId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);

  const loadCauses = useCallback(() => {
    setLoad('loading');
    apiFetch('/causes')
      .then((list: Cause[]) => {
        setCauses(Array.isArray(list) ? list : []);
        setLoad(Array.isArray(list) && list.length > 0 ? 'ready' : 'error');
      })
      .catch(() => setLoad('error'));
  }, []);

  useEffect(() => { loadCauses(); }, [loadCauses]);
  useEffect(() => { headingRef.current?.focus(); }, []);

  function choose(id: string) {
    setSelected(id);
    if (save === 'error') setSave('idle');
  }

  async function handleSave() {
    if (!selected || save === 'saving' || save === 'saved') return;
    setSave('saving');
    try {
      await apiFetch('/causes/preferences', {
        method: 'POST',
        body: JSON.stringify({ cause1Id: selected, cause2Id: null, randomDistribution: false }),
      });
    } catch {
      setSave('error'); // keep the selection; do not proceed
      return;
    }
    setSave('saved');
    onSave();
  }

  const busy = save === 'saving' || save === 'saved';

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/50 px-4 pb-4 sm:pb-0">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] overflow-y-auto p-5 sm:p-6"
      >
        <p className="text-xs font-semibold tracking-widest text-emerald-700 uppercase mb-1">{c.eyebrow}</p>
        <h2 id={titleId} ref={headingRef} tabIndex={-1} className="font-display text-xl text-gray-900 mb-2 outline-none">
          {c.title}
        </h2>
        <p className="text-sm text-gray-600 leading-relaxed">{c.body}</p>
        <p className="text-sm text-gray-600 leading-relaxed mt-1 mb-4" data-testid="default-note">{c.defaultNote}</p>

        {load === 'loading' && (
          <div role="status" className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500">
            <span aria-hidden="true" className="w-4 h-4 border-2 border-gray-200 border-t-emerald-700 rounded-full animate-spin" />
            {c.loading}
          </div>
        )}

        {load === 'error' && (
          <div role="alert" className="rounded-xl border border-gray-200 p-4 mb-4 text-sm text-gray-700">
            <p className="mb-2">{c.loadError}</p>
            <button type="button" onClick={loadCauses} className="font-semibold text-emerald-700 underline underline-offset-2">
              {c.retryLoad}
            </button>
          </div>
        )}

        {load === 'ready' && (
          <fieldset className="mb-4" disabled={busy}>
            <legend className="sr-only">{c.groupLabel}</legend>
            <div className="space-y-2">
              {causes.map((cause) => {
                const copy = localized[cause.slug];
                const isSelected = selected === cause.id;
                return (
                  <label
                    key={cause.id}
                    className={[
                      'flex items-start gap-3 p-3 min-h-[56px] rounded-xl border-2 cursor-pointer transition focus-within:ring-2 focus-within:ring-emerald-700 focus-within:ring-offset-1',
                      isSelected ? 'border-emerald-700 bg-emerald-50' : 'border-gray-200 bg-white hover:border-gray-300',
                    ].join(' ')}
                  >
                    <input
                      type="radio"
                      name="causas-noetia"
                      value={cause.id}
                      checked={isSelected}
                      onChange={() => choose(cause.id)}
                      className="sr-only"
                    />
                    <CauseIcon slug={cause.slug} />
                    <span className="flex-1">
                      <span className="block text-sm font-semibold text-gray-900">{copy?.name ?? cause.name}</span>
                      <span className="block text-xs text-gray-600 leading-snug mt-0.5">{copy?.description ?? cause.description}</span>
                    </span>
                    <span
                      aria-hidden="true"
                      className={[
                        'mt-0.5 w-5 h-5 shrink-0 rounded-full border-2 flex items-center justify-center',
                        isSelected ? 'border-emerald-700' : 'border-gray-300',
                      ].join(' ')}
                    >
                      {isSelected && <span className="w-2.5 h-2.5 rounded-full bg-emerald-700" />}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}

        {save === 'error' && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 mb-4 text-sm text-red-800">
            {c.saveError}
          </div>
        )}
        {save === 'saved' && (
          <p role="status" className="rounded-xl bg-emerald-50 p-3 mb-4 text-sm text-emerald-800 font-medium">
            {c.saved}
          </p>
        )}

        <div className="flex flex-col-reverse sm:flex-row gap-3">
          <button
            type="button"
            onClick={onSkip}
            disabled={busy}
            className="flex-1 py-3 rounded-xl border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition"
          >
            {c.skip}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!selected || busy || load !== 'ready'}
            className="flex-1 py-3 rounded-xl bg-emerald-700 text-white text-sm font-semibold hover:bg-emerald-800 disabled:opacity-50 transition"
          >
            {save === 'saving' ? c.saving : save === 'error' ? c.retrySave : c.confirm}
          </button>
        </div>
      </div>
    </div>
  );
}
