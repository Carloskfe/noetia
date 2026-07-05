'use client';

import { useState } from 'react';
import { CONSENT_VERSION, loadConsent, saveConsent } from '@/lib/consent-utils';
import { useTranslation } from '@/lib/i18n';

type Props = {
  onClose: () => void;
  onSave: () => void;
};

export default function CookiePreferencesModal({ onClose, onSave }: Props) {
  const { t } = useTranslation();
  const c = t.cookies.preferences;
  const existing = loadConsent();
  const [analytics, setAnalytics] = useState(existing?.analytics ?? false);
  const [marketing, setMarketing] = useState(existing?.marketing ?? false);

  function handleSave() {
    saveConsent({ version: CONSENT_VERSION, analytics, marketing, timestamp: Date.now() });
    onSave();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-60 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">
            {c.title}
          </h2>
          <button onClick={onClose} aria-label={c.close} className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded">
            <XIcon aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Essential — always on */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-900">{c.essential}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {c.essentialDesc}
              </p>
            </div>
            <div className="mt-0.5 flex-shrink-0">
              <span className="text-xs text-gray-400 font-medium">{c.alwaysOn}</span>
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* Analytics */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-900">{c.analytics}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {c.analyticsDesc}
              </p>
            </div>
            <button
              role="switch"
              aria-checked={analytics}
              onClick={() => setAnalytics((v) => !v)}
              className={[
                'relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none',
                analytics ? 'bg-blue-600' : 'bg-gray-200',
                'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
              ].join(' ')}
            >
              <span
                className={[
                  'inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200',
                  analytics ? 'translate-x-5' : 'translate-x-0',
                ].join(' ')}
              />
            </button>
          </div>

          <hr className="border-gray-100" />

          {/* Marketing */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-900">{c.marketing}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {c.marketingDesc}
              </p>
            </div>
            <button
              role="switch"
              aria-checked={marketing}
              onClick={() => setMarketing((v) => !v)}
              className={[
                'relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none',
                marketing ? 'bg-blue-600' : 'bg-gray-200',
                'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
              ].join(' ')}
            >
              <span
                className={[
                  'inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200',
                  marketing ? 'translate-x-5' : 'translate-x-0',
                ].join(' ')}
              />
            </button>
          </div>
        </div>

        <button
          onClick={handleSave}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2.5 rounded-xl transition"
        >
          {c.save}
        </button>
      </div>
    </div>
  );
}

function XIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
