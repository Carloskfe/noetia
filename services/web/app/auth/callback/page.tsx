'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { saveToken } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';

function CallbackHandler() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const token = params.get('token');
    const next = params.get('next') ?? '/onboarding';
    if (token) {
      saveToken(token);
      router.replace(next);
    } else {
      router.replace('/login');
    }
  }, [params, router]);

  return null;
}

export default function AuthCallbackPage() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">{t.authCallback.signingIn}</p>
      <Suspense>
        <CallbackHandler />
      </Suspense>
    </div>
  );
}
