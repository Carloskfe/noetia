'use client';

import { useEffect, useState } from 'react';
import { hasSeenFragmentsTutorial, markFragmentsTutorialSeen } from '@/lib/tutorial-flags';
import { ensureOnboardingSynced } from '@/lib/onboarding';
import { useTranslation } from '@/lib/i18n';

export default function FragmentsTutorial() {
  const [show, setShow] = useState(false);
  const { t } = useTranslation();
  const tf = t.tutorials.fragments;

  useEffect(() => {
    ensureOnboardingSynced().then(() => {
      if (!hasSeenFragmentsTutorial()) setShow(true);
    });
  }, []);

  if (!show) return null;

  function dismiss() {
    markFragmentsTutorialSeen();
    setShow(false);
  }

  const ICONS = ['✍️', '✏️', '📲'];

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/40" onClick={dismiss} aria-hidden="true" />

      <div
        className="fixed bottom-0 left-0 right-0 z-[61] bg-white rounded-t-2xl shadow-2xl px-6 pt-5 pb-8 max-w-lg mx-auto"
        role="dialog"
        aria-modal="true"
        aria-label={tf.ariaLabel}
      >
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />

        <h2 className="text-lg font-bold text-gray-900 mb-1">{tf.title}</h2>
        <p className="text-sm text-gray-500 leading-relaxed mb-6">{tf.subtitle}</p>

        <div className="space-y-4 mb-8">
          {tf.items.map(({ title, body }, i) => (
            <div key={i} className="flex gap-3">
              <span className="text-xl mt-0.5 w-7 shrink-0">{ICONS[i]}</span>
              <div>
                <p className="text-sm font-semibold text-gray-900">{title}</p>
                <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">{body}</p>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={dismiss}
          className="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl hover:bg-blue-700 transition"
        >
          {tf.cta}
        </button>
      </div>
    </>
  );
}
