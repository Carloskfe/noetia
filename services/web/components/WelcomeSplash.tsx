'use client';

import { useEffect, useState } from 'react';
import { hasSeenWelcome, markWelcomeSeen } from '@/lib/tutorial-flags';
import { ensureOnboardingSynced } from '@/lib/onboarding';
import { useTranslation } from '@/lib/i18n';

export default function WelcomeSplash() {
  const [show, setShow] = useState(false);
  const { t } = useTranslation();
  const tw = t.tutorials.welcome;

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    // Reconcile with server state first, so a returning user who already
    // completed onboarding on another device never sees the splash again.
    ensureOnboardingSynced().then(() => {
      if (!hasSeenWelcome()) setShow(true);
    });
  }, []);

  if (!show) return null;

  function dismiss() {
    markWelcomeSeen();
    setShow(false);
  }

  const ICONS = ['📖', '🎧', '✍️', '📲', '👥'];

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#0D1B2A] px-6 text-center"
      role="dialog"
      aria-modal="true"
      aria-label={tw.ariaLabel}
    >
      <h1 className="text-4xl font-bold tracking-widest text-white mb-2">NOETIA</h1>
      <p className="text-slate-400 text-sm mb-12">{tw.tagline}</p>

      <p className="text-white text-xl font-semibold leading-snug max-w-xs mb-4">
        {tw.headline}
      </p>
      <p className="text-slate-300 text-sm leading-relaxed max-w-xs mb-12">
        {tw.description}
      </p>

      <div className="flex flex-col gap-3 w-full max-w-xs mb-12">
        {tw.features.map((label, i) => (
          <div key={i} className="flex items-center gap-3 text-left">
            <span className="text-xl w-8 shrink-0">{ICONS[i]}</span>
            <span className="text-slate-300 text-sm">{label}</span>
          </div>
        ))}
      </div>

      <button
        onClick={dismiss}
        className="w-full max-w-xs bg-white text-[#0D1B2A] font-semibold py-3.5 rounded-xl hover:bg-slate-100 transition"
      >
        {tw.cta}
      </button>
    </div>
  );
}
