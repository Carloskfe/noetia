'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { clubsApi, ClubSession } from '@/lib/clubs';
import EscuchaJuntosRoom from '@/components/EscuchaJuntosRoom';
import { useTranslation } from '@/lib/i18n';

export default function LiveSessionPage() {
  const params = useParams<{ id: string; sessionId: string }>();
  const { t } = useTranslation();
  const [session,  setSession]  = useState<ClubSession | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loading,  setLoading]  = useState(true);
  // Error kind, resolved to text at render time so a language change never shows stale copy.
  const [error,    setError]    = useState<'' | 'notFound' | 'loadError'>('');

  useEffect(() => {
    async function load() {
      try {
        const sessions = await clubsApi.getSessions(params.id);
        const s = sessions.find(s => s.id === params.sessionId);
        if (!s) { setError('notFound'); return; }
        setSession(s);

        const book = await apiFetch(`/books/${s.bookId}`).catch(() => null);
        if (book?.audioStreamKey) setAudioUrl(book.audioStreamKey);
      } catch {
        setError('loadError');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.id, params.sessionId]);

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error || !session) return <p className="text-center text-red-500 py-20">{error ? t.clubs.sessions[error] : null}</p>;

  return (
    <main className="max-w-5xl mx-auto px-4 py-6">
      <EscuchaJuntosRoom session={session} audioUrl={audioUrl} />
    </main>
  );
}
