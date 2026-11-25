'use client';

import { useEffect, useState } from 'react';
import { apiFetch, getEmailConfirmed } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';

export default function EmailVerificationBanner() {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token && !getEmailConfirmed()) setShow(true);
  }, []);

  if (!show) return null;

  async function resend() {
    setLoading(true);
    try {
      await apiFetch('/auth/resend-confirmation', { method: 'POST' });
      setSent(true);
    } catch {
      // ignore — user can try again
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between gap-4 text-sm">
      <p className="text-amber-800">
        {t.emailBanner.message}
        {sent && <span className="ml-2 font-medium">{t.emailBanner.sent}</span>}
      </p>
      <div className="flex items-center gap-3 shrink-0">
        {!sent && (
          <button
            onClick={resend}
            disabled={loading}
            className="text-amber-900 font-medium underline underline-offset-2 disabled:opacity-50"
          >
            {loading ? t.emailBanner.sending : t.emailBanner.resend}
          </button>
        )}
        <button
          onClick={() => setShow(false)}
          aria-label={t.emailBanner.close}
          className="text-amber-600 hover:text-amber-900"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
