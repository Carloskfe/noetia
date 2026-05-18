'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

type PreviewState = 'loading' | 'ready' | 'claiming' | 'success' | 'error';

interface GiftPreview {
  tokenCount: number;
  message: string | null;
  occasion: string | null;
  status: string;
}

export default function GiftClaimPage() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') ?? '';

  const [state, setState] = useState<PreviewState>('loading');
  const [preview, setPreview] = useState<GiftPreview | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token) {
      setState('error');
      setErrorMsg('Enlace de regalo inválido.');
      return;
    }

    Promise.all([
      fetch(`/api/gifts/preview/${token}`),
      fetch('/api/auth/me'),
    ]).then(async ([previewRes, authRes]) => {
      if (!previewRes.ok) {
        setState('error');
        setErrorMsg('Este regalo no existe o ya no es válido.');
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
        setErrorMsg('Este regalo ya fue reclamado.');
      } else if (data.status === 'expired') {
        setState('error');
        setErrorMsg('Este regalo ha expirado.');
      } else {
        setState('ready');
      }
    });
  }, [token, router]);

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
      const messages: Record<string, string> = {
        gift_already_claimed: 'Este regalo ya fue reclamado.',
        gift_expired: 'Este regalo ha expirado.',
        gift_not_found: 'No encontramos este regalo.',
      };
      setErrorMsg(messages[data?.error] ?? 'Ocurrió un error. Intenta de nuevo.');
      setState('error');
    }
  }

  if (state === 'loading') {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">Cargando…</div>;
  }

  if (state === 'success') {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border p-8 text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            ¡{preview?.tokenCount} {preview?.tokenCount === 1 ? 'token recibido' : 'tokens recibidos'}!
          </h1>
          <p className="text-gray-500 mb-6">
            Ya puedes usar tus tokens para desbloquear libros en tu biblioteca.
          </p>
          <button
            onClick={() => router.push('/')}
            className="w-full py-3 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800"
          >
            Ir a mi biblioteca
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
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Regalo no válido</h1>
          <p className="text-gray-500 mb-6">{errorMsg}</p>
          <button
            onClick={() => router.push('/')}
            className="w-full py-3 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800"
          >
            Ir al inicio
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
          {preview?.occasion && (
            <p className="text-2xl mb-1">{preview.occasion}</p>
          )}
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Tienes un regalo</h1>
          <div className="inline-flex items-center gap-2 bg-slate-100 rounded-full px-4 py-2 mt-2">
            <span className="text-2xl font-black text-slate-900">{preview?.tokenCount}</span>
            <span className="text-sm text-slate-600">
              {preview?.tokenCount === 1 ? 'Token Noetia' : 'Tokens Noetia'}
            </span>
          </div>
        </div>

        {preview?.message && (
          <div className="border-l-4 border-slate-900 bg-slate-50 rounded-r-xl px-4 py-3 mb-6">
            <p className="text-gray-700 text-sm italic">"{preview.message}"</p>
          </div>
        )}

        <p className="text-sm text-gray-500 text-center mb-6">
          Cada token desbloquea un libro de tu elección. Válidos por 90 días desde hoy.
        </p>

        <button
          onClick={handleClaim}
          disabled={state === 'claiming'}
          className="w-full py-3 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 disabled:opacity-50"
        >
          {state === 'claiming' ? 'Reclamando…' : 'Reclamar mi regalo'}
        </button>
      </div>
    </main>
  );
}
