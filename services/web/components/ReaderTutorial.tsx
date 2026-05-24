'use client';

import { useState } from 'react';
import { markReaderTutorialSeen } from '@/lib/reader-tutorial';
import { useTranslation } from '@/lib/i18n';

export { hasSeenReaderTutorial } from '@/lib/reader-tutorial';

const ICONS = [
  <svg key="0" className="w-10 h-10 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>,
  <svg key="1" className="w-10 h-10 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 3H7a2 2 0 00-2 2v16l7-3 7 3V5a2 2 0 00-2-2z" />
  </svg>,
  <svg key="2" className="w-10 h-10 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>,
  <svg key="3" className="w-10 h-10 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
  </svg>,
];

interface Props {
  onDismiss: () => void;
}

export default function ReaderTutorial({ onDismiss }: Props) {
  const [step, setStep] = useState(0);
  const { t } = useTranslation();
  const tr = t.tutorials.reader;

  function dismiss() {
    markReaderTutorialSeen();
    onDismiss();
  }

  const current = tr.steps[step];
  const isLast = step === tr.steps.length - 1;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 px-4"
      role="dialog"
      aria-modal="true"
      aria-label={tr.ariaLabel}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
        <div className="flex justify-center gap-1.5 mb-6">
          {tr.steps.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-blue-600' : 'w-1.5 bg-gray-200'}`}
            />
          ))}
        </div>

        <div className="flex justify-center mb-4">{ICONS[step]}</div>

        <h2 className="text-lg font-bold text-gray-900 mb-2">{current.title}</h2>
        <p className="text-sm text-gray-500 leading-relaxed mb-8">{current.body}</p>

        <div className="flex gap-3">
          <button
            onClick={dismiss}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition"
          >
            {tr.skip}
          </button>
          <button
            onClick={isLast ? dismiss : () => setStep((s) => s + 1)}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition"
          >
            {isLast ? tr.done : tr.next}
          </button>
        </div>
      </div>
    </div>
  );
}
