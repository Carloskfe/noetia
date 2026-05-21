'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { clubsApi } from '@/lib/clubs';
import { useTranslation } from '@/lib/i18n';

function JoinContent() {
  const { t } = useTranslation();
  const c = t.clubs.join;
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const token  = search.get('token') ?? '';

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    if (!token) { setStatus('error'); return; }
    clubsApi.acceptInvite(params.id, token)
      .then(() => setStatus('success'))
      .catch(() => setStatus('error'));
  }, [params.id, token]);

  return (
    <main className="max-w-sm mx-auto px-4 py-20 text-center">
      <h1 className="text-xl font-bold mb-4">{c.title}</h1>
      {status === 'loading' && <p className="text-gray-500">{c.accepting}</p>}
      {status === 'success' && (
        <>
          <p className="text-green-600 font-medium mb-6">{c.success}</p>
          <Link href={`/clubs/${params.id}`} className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-medium">
            {c.goToClub}
          </Link>
        </>
      )}
      {status === 'error' && (
        <>
          <p className="text-red-500 mb-4">{c.error}</p>
          <Link href="/clubs" className="text-blue-600 text-sm hover:underline">{t.common.back}</Link>
        </>
      )}
    </main>
  );
}

export default function JoinClubPage() {
  return <Suspense><JoinContent /></Suspense>;
}
