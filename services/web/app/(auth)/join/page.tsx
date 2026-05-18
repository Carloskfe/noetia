'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

type State = 'loading' | 'ready' | 'accepting' | 'success' | 'error';

export default function JoinPage() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') ?? '';

  const [state, setState] = useState<State>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token) {
      setState('error');
      setErrorMsg('Enlace de invitación inválido.');
      return;
    }

    // Check if logged in
    fetch('/api/auth/me').then(res => {
      if (res.status === 401) {
        router.replace(`/login?returnUrl=${encodeURIComponent(`/join?token=${token}`)}`);
      } else {
        setState('ready');
      }
    });
  }, [token, router]);

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
      const code = data?.error ?? 'unknown';
      const messages: Record<string, string> = {
        invite_invalid_or_expired: 'Esta invitación ha expirado o ya no es válida.',
        subscription_no_longer_active: 'La suscripción del invitante ya no está activa.',
        plan_full: 'El plan ya alcanzó el número máximo de usuarios.',
        already_linked: 'Ya eres miembro de este plan.',
        cannot_join_own_plan: 'No puedes unirte a tu propio plan.',
      };
      setErrorMsg(messages[code] ?? 'Ocurrió un error. Intenta de nuevo.');
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
          <div className="text-4xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">¡Ya eres parte del plan!</h1>
          <p className="text-gray-500 mb-6">
            Ahora compartes acceso y tokens con los demás miembros del plan.
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
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invitación no válida</h1>
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
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Invitación a Noetia</h1>
        <p className="text-gray-500 mb-8">
          Alguien te ha invitado a unirte a su plan. Al aceptar, compartirás tokens para desbloquear libros
          y tendrás tu propia biblioteca personal.
        </p>
        <button
          onClick={handleAccept}
          disabled={state === 'accepting'}
          className="w-full py-3 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 disabled:opacity-50"
        >
          {state === 'accepting' ? 'Aceptando…' : 'Aceptar invitación'}
        </button>
      </div>
    </main>
  );
}
