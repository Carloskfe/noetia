'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTranslation } from '@/lib/i18n';

type State = 'loading' | 'ready' | 'accepting' | 'success' | 'error';

export default function JoinPage() {
  const { t } = useTranslation();
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') ?? '';

  const [state, setState] = useState<State>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token) {
      setState('error');
      setErrorMsg(t.join.invalidLink);
      return;
    }
    fetch('/api/auth/me').then(res => {
      if (res.status === 401) {
        router.replace(`/login?returnUrl=${encodeURIComponent(`/join?token=${token}`)}`);
      } else {
        setState('ready');
      }
    });
  }, [token, router, t]);

  async function handleAccept() {
    setState('accepting');
    const res = await fetch('/api/subscriptions/invite/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    if (res.ok) {
      setState('success');
    } else {
      const data = await res.json().catch(() => ({}));
      const code = data?.error ?? 'generic';
      const msg = (t.join.error as Record<string, string>)[code] ?? t.join.error.generic;
      setErrorMsg(msg);
      setState('error');
    }
  }

  if (state === 'loading') {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">{t.join.loading}</div>;
  }

  if (state === 'success') {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border p-8 text-center">
          <div className="text-4xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{t.join.success.title}</h1>
          <p className="text-gray-500 mb-6">{t.join.success.body}</p>
          <button onClick={() => router.push('/')} className="w-full py-3 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800">
            {t.join.success.cta}
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
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{t.join.error.title}</h1>
          <p className="text-gray-500 mb-6">{errorMsg}</p>
          <button onClick={() => router.push('/')} className="w-full py-3 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800">
            {t.join.error.cta}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{t.join.title}</h1>
        <p className="text-gray-500 mb-8">{t.join.body}</p>
        <button
          onClick={handleAccept}
          disabled={state === 'accepting'}
          className="w-full py-3 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 disabled:opacity-50"
        >
          {state === 'accepting' ? t.join.accepting : t.join.accept}
        </button>
      </div>
    </main>
  );
}
