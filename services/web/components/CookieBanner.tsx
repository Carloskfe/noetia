'use client';

import { useEffect, useState } from 'react';
import {
  CONSENT_VERSION,
  needsConsent,
  saveConsent,
} from '@/lib/consent-utils';
import { useTranslation } from '@/lib/i18n';
import CookiePreferencesModal from './CookiePreferencesModal';

export default function CookieBanner() {
  const { t } = useTranslation();
  const c = t.cookies.banner;
  const [visible, setVisible] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    setVisible(needsConsent());
  }, []);

  if (!visible) return null;

  function acceptAll() {
    saveConsent({ version: CONSENT_VERSION, analytics: true, marketing: true, timestamp: Date.now() });
    setVisible(false);
  }

  function acceptEssentials() {
    saveConsent({ version: CONSENT_VERSION, analytics: false, marketing: false, timestamp: Date.now() });
    setVisible(false);
  }

  function handleModalSave() {
    setShowModal(false);
    setVisible(false);
  }

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white shadow-lg border-t border-gray-100 px-4 py-4 sm:px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-700">
              <span className="font-medium">{c.title}</span>{' '}
              {c.body}{' '}
              <a href="/legal/cookies" className="underline text-blue-600 hover:text-blue-800 whitespace-nowrap">
                {c.learnMore}
              </a>
            </p>
          </div>
          <div className="flex flex-wrap gap-2 flex-shrink-0">
            <button
              onClick={acceptAll}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
            >
              {c.acceptAll}
            </button>
            <button
              onClick={acceptEssentials}
              className="border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg transition"
            >
              {c.essentialsOnly}
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="text-gray-500 hover:text-gray-700 text-sm underline px-2 py-2 transition"
            >
              {c.manage}
            </button>
          </div>
        </div>
      </div>

      {showModal && (
        <CookiePreferencesModal
          onClose={() => setShowModal(false)}
          onSave={handleModalSave}
        />
      )}
    </>
  );
}
