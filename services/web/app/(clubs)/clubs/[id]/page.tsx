'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { clubsApi, Club, ClubBook, ClubMember } from '@/lib/clubs';
import { useTranslation } from '@/lib/i18n';
import ClubChat from '@/components/ClubChat';
import ClubDiscussion from '@/components/ClubDiscussion';
import ClubMembersPanel from '@/components/ClubMembersPanel';
import ClubPollCard from '@/components/ClubPollCard';
import ClubSessionCard from '@/components/ClubSessionCard';

type Tab = 'chat' | 'discussion' | 'polls' | 'sessions';

function ClubPageContent() {
  const { t } = useTranslation();
  const c = t.clubs.page;
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const search = useSearchParams();
  const tab = (search.get('tab') as Tab) ?? 'chat';

  const [club, setClub]           = useState<Club | null>(null);
  const [me, setMe]               = useState<ClubMember | null>(null);
  const [activeBook, setActiveBook] = useState<ClubBook | null>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [showMembers, setShowMembers] = useState(false);
  const [joining, setJoining]     = useState(false);

  const myUserId = typeof window !== 'undefined' ? localStorage.getItem('user_id') ?? '' : '';
  const isAdmin  = me?.role === 'admin' || me?.role === 'moderator';

  useEffect(() => { loadAll(); }, [params.id]);

  async function loadAll() {
    setLoading(true);
    try {
      const [clubData, members, books] = await Promise.all([
        clubsApi.get(params.id),
        clubsApi.getMembers(params.id).catch(() => [] as ClubMember[]),
        clubsApi.getBooks(params.id).catch(() => [] as ClubBook[]),
      ]);
      setClub(clubData);
      setMemberCount(members.length);
      const hasToken = typeof window !== 'undefined' && !!localStorage.getItem('access_token');
      if (hasToken) {
        const found = members.find(m => m.userId === myUserId && m.status === 'active');
        setMe(found ?? null);
      }
      setActiveBook(books.find(b => b.status === 'active') ?? null);
    } catch {
      setError(t.common.error);
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin() {
    setJoining(true);
    try {
      await clubsApi.join(params.id);
      await loadAll();
    } catch (err: any) {
      const code = err?.data?.error;
      const errors = t.clubs.errors;
      if (code === 'already_a_member') setError(errors.alreadyMember);
      else if (code === 'club_full')   setError(errors.clubFull);
      else if (code === 'must_own_active_book_to_join') setError(errors.mustOwnBook);
      else if (code === 'user_banned_from_club')        setError(errors.banned);
      else setError(t.common.error);
    } finally {
      setJoining(false);
    }
  }

  async function handleLeave() {
    if (!confirm('¿Salir del club?')) return;
    await clubsApi.leave(params.id);
    router.push('/clubs');
  }

  async function handleInvite() {
    try {
      const { url } = await clubsApi.generateInvite(params.id);
      await navigator.clipboard.writeText(url);
      alert('Enlace copiado al portapapeles');
    } catch { setError(t.common.error); }
  }

  function setTab(newTab: Tab) {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', newTab);
    router.replace(url.pathname + url.search);
  }

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>;
  if (error && !club) return <p className="text-center text-red-500 py-20">{error}</p>;
  if (!club) return null;

  const tabs: { key: Tab; label: string }[] = [
    { key: 'chat',       label: c.tabs.chat },
    { key: 'discussion', label: c.tabs.discussion },
    { key: 'polls',      label: c.tabs.polls },
    { key: 'sessions',   label: c.tabs.sessions },
  ];

  return (
    <main className="max-w-3xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex gap-4 mb-6">
        {club.coverUrl && (
          <img src={club.coverUrl} alt={club.name} className="w-20 h-20 rounded-xl object-cover flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h1 className="text-xl font-bold truncate">{club.name}</h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 flex-shrink-0">
              {club.type === 'public' ? '🌐' : '🔒'}
            </span>
          </div>
          {club.description && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{club.description}</p>}
          <button
            onClick={() => setShowMembers(!showMembers)}
            className="text-xs text-blue-600 mt-1 hover:underline"
          >
            {memberCount} {c.members}
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {!me ? (
          <button
            onClick={handleJoin}
            disabled={joining}
            className="bg-blue-600 text-white text-sm font-medium px-4 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {joining ? '…' : c.join}
          </button>
        ) : (
          <>
            {isAdmin && (
              <button
                onClick={handleInvite}
                className="text-sm border px-3 py-1.5 rounded-lg hover:bg-gray-50 transition"
              >
                {c.invite}
              </button>
            )}
            {me.role !== 'admin' && (
              <button onClick={handleLeave} className="text-sm text-red-500 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 transition">
                {c.leave}
              </button>
            )}
          </>
        )}
      </div>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      {/* Members panel */}
      {showMembers && (
        <div className="mb-5 border rounded-xl p-4">
          <ClubMembersPanel clubId={params.id} myUserId={myUserId} isAdmin={isAdmin} onClose={() => setShowMembers(false)} />
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b mb-4 gap-1">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition -mb-px ${
              tab === key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'chat'       && <ClubChat clubId={params.id} canWrite={!!me} />}
      {tab === 'discussion' && <ClubDiscussion clubId={params.id} activeBook={activeBook} canWrite={!!me} isAdmin={isAdmin} />}
      {tab === 'polls'      && <ClubPollCard clubId={params.id} isAdmin={isAdmin} />}
      {tab === 'sessions'   && <ClubSessionCard clubId={params.id} activeBook={activeBook} isAdmin={isAdmin} />}
    </main>
  );
}

export default function ClubPage() {
  return <Suspense><ClubPageContent /></Suspense>;
}
