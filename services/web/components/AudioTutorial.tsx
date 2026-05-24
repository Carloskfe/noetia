'use client';

import { markAudioTutorialSeen } from '@/lib/tutorial-flags';
import { useTranslation } from '@/lib/i18n';

interface Props {
  onDismiss: () => void;
}

export default function AudioTutorial({ onDismiss }: Props) {
  const { t } = useTranslation();
  const ta = t.tutorials.audio;

  function dismiss() {
    markAudioTutorialSeen();
    onDismiss();
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 px-4 pb-6 sm:pb-0"
      role="dialog"
      aria-modal="true"
      aria-label={ta.ariaLabel}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">{ta.title}</h2>
            <p className="text-xs text-gray-400">{ta.subtitle}</p>
          </div>
        </div>

        <div className="space-y-4 mb-7">
          {ta.items.map(({ title, body }, i) => (
            <div key={i} className="flex gap-3">
              <span className="text-base mt-0.5 w-6 shrink-0">
                {['🔵', '👆', '⚡'][i]}
              </span>
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
          {ta.cta}
        </button>
      </div>
    </div>
  );
}
