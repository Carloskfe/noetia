'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch, saveToken, saveUserType, saveEmailConfirmed, postAuthRedirect } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';

type State = 'verifying' | 'success' | 'error';

export default function ConfirmEmailPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useSearchParams();
  const [state, setState] = useState<State>('verifying');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      setState('error');
      setMessage(t.auth.confirmEmailPage.noToken);
      return;
    }

    apiFetch(`/auth/confirm-email?token=${encodeURIComponent(token)}`, { method: 'GET' })
      .then((data: any) => {
        saveToken(data.accessToken);
        if (data.user?.userType) saveUserType(data.user.userType);
        saveEmailConfirmed(true);
        setState('success');
        setTimeout(() => router.push(postAuthRedirect(data.user?.userType ?? null)), 1500);
      })
      .catch((err: any) => {
        setState('error');
        setMessage(err?.message ?? t.auth.confirmEmailPage.expiredOrInvalid);
      });
  }, [params, router, t]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center space-y-4">
        {state === 'verifying' && (
          <>
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-muted-foreground">{t.auth.confirmEmailPage.verifying}</p>
          </>
        )}
        {state === 'success' && (
          <>
            <div className="text-4xl">✓</div>
            <h1 className="text-xl font-semibold">{t.auth.confirmEmailPage.confirmed}</h1>
            <p className="text-muted-foreground">{t.auth.confirmEmailPage.redirecting}</p>
          </>
        )}
        {state === 'error' && (
          <>
            <div className="text-4xl">✗</div>
            <h1 className="text-xl font-semibold">{t.auth.confirmEmailPage.failed}</h1>
            <p className="text-muted-foreground">{message}</p>
            <a href="/login" className="text-primary underline text-sm">
              {t.auth.confirmEmailPage.backToLogin}
            </a>
          </>
        )}
      </div>
    </main>
  );
}
