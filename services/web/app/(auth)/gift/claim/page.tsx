'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTranslation } from '@/lib/i18n';

type PreviewState = 'loading' | 'ready' | 'claiming' | 'success' | 'error';

interface GiftPreview {
  tokenCount: number;
  message: string | null;
  occasion: string | null;
  status: string;
}

export default function GiftClaimPage() {
  const { t } = useTranslation();
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') ?? '';

  const [state, setState] = useState<PreviewState>('loading');
  const [preview, setPreview] = useState<GiftPreview | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token) {
      setState('error');
      setErrorMsg(t.giftCard.claim.invalidLink);
      return;
    }

    Promise.all([
      fetch(`/api/gifts/preview/${token}`),
      fetch('/api/auth/me'),
    ]).then(async ([previewRes, authRes]) => {
      if (!previewRes.ok) {
        setState('error');
        setErrorMsg(t.giftCard.claim.error.invalid);
        return;
      }
      if (authRes.status === 401) {
        router.replace(`/login?returnUrl=${encodeURIComponent(`/gift/claim?token=${token}`)}`);
        return;
      }
      const data = await previewRes.json();
      setPreview(data);
      if (data.status === 'claimed') {
        setState('error');
        setErrorMsg(t.giftCard.claim.error.claimed);
      } else if (data.status === 'expired') {
        setState('error');
        setErrorMsg(t.giftCard.claim.error.expired);
      } else {
        setState('ready');
      }
    });
  }, [token, router, t]);

  async function handleClaim() {
    setState('claiming');
    const res = await fetch('/api/gifts/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    if (res.ok) {
      setState('success');
    } else {
      const data = await res.json().catch(() => ({}));
      const code = data?.error ?? 'generic';
      const msg = (t.giftCard.claim.error as Record<string, string>)[code] ?? t.giftCard.claim.error.generic;
      setErrorMsg(msg);
      setState('error');
    }
  }

  if (state === 'loading') {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">{t.giftCard.claim.loading}</div>;
  }

  if (state === 'success') {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border p-8 text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {t.giftCard.claim.success.title(preview?.tokenCount ?? 0)}
          </h1>
          <p className="text-gray-500 mb-6">{t.giftCard.claim.success.body}</p>
          <button onClick={() => router.push('/')} className="w-full py-3 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800">
            {t.giftCard.claim.success.cta}
          </button>
        </div>
      </main>
    );
  }

  if (state === 'error') {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border p-8 text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{t.giftCard.claim.error.title}</h1>
          <p className="text-gray-500 mb-6">{errorMsg}</p>
          <button onClick={() => router.push('/')} className="w-full py-3 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800">
            {t.giftCard.claim.error.cta}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border p-8">
        <div className="text-center mb-6">
          <p className="text-4xl mb-3">🎁</p>
          {preview?.occasion && <p className="text-2xl mb-1">{preview.occasion}</p>}
          <h1 className="text-2xl font-bold text-gray-900 mb-1">{t.giftCard.claim.title}</h1>
          <div className="inline-flex items-center gap-2 bg-slate-100 rounded-full px-4 py-2 mt-2">
            <span className="text-2xl font-black text-slate-900">{preview?.tokenCount}</span>
            <span className="text-sm text-slate-600">{t.giftCard.claim.tokenLabel(preview?.tokenCount ?? 0)}</span>
          </div>
        </div>
        {preview?.message && (
          <div className="border-l-4 border-slate-900 bg-slate-50 rounded-r-xl px-4 py-3 mb-6">
            <p className="text-gray-700 text-sm italic">&ldquo;{preview.message}&rdquo;</p>
          </div>
        )}
        <p className="text-sm text-gray-500 text-center mb-6">{t.giftCard.claim.body}</p>
        <button
          onClick={handleClaim}
          disabled={state === 'claiming'}
          className="w-full py-3 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 disabled:opacity-50"
        >
          {state === 'claiming' ? t.giftCard.claim.claiming : t.giftCard.claim.cta}
        </button>
      </div>
    </main>
  );
}
