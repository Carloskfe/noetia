'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { clubsApi, ClubBook, ClubSession } from '@/lib/clubs';
import { useTranslation } from '@/lib/i18n';

export default function ClubSessionCard({ clubId, activeBook, isAdmin }: {
  clubId: string;
  activeBook: ClubBook | null;
  isAdmin: boolean;
}) {
  const { t } = useTranslation();
  const c = t.clubs.sessions;

  const [sessions, setSessions]   = useState<ClubSession[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm]           = useState({ title: '', scheduledAt: '', startPhraseIndex: '', endPhraseIndex: '' });
  const [creating, setCreating]   = useState(false);

  useEffect(() => { load(); }, [clubId]);

  async function load() {
    setLoading(true);
    try { setSessions(await clubsApi.getSessions(clubId)); }
    finally { setLoading(false); }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!activeBook) return;
    setCreating(true);
    try {
      await clubsApi.createSession(clubId, {
        bookId: activeBook.bookId,
        title: form.title,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        startPhraseIndex: parseInt(form.startPhraseIndex),
        endPhraseIndex: parseInt(form.endPhraseIndex),
      });
      setForm({ title: '', scheduledAt: '', startPhraseIndex: '', endPhraseIndex: '' });
      setShowCreate(false);
      await load();
    } finally {
      setCreating(false);
    }
  }

  async function cancel(sessionId: string) {
    if (!confirm('¿Cancelar esta sesión?')) return;
    await clubsApi.cancelSession(clubId, sessionId);
    await load();
  }

  const statusLabel: Record<string, string> = {
    scheduled: c.upcoming, live: c.live, completed: c.completed, cancelled: c.cancelled,
  };

  const statusColor: Record<string, string> = {
    scheduled: 'bg-blue-100 text-blue-700',
    live:      'bg-green-100 text-green-700',
    completed: 'bg-gray-100 text-gray-500',
    cancelled: 'bg-red-100 text-red-500',
  };

  if (loading) return <div className="h-40 flex items-center justify-center"><div className="w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {isAdmin && activeBook && (
        <button onClick={() => setShowCreate(!showCreate)} className="text-sm text-blue-600 hover:underline">
          + {c.schedule}
        </button>
      )}

      {showCreate && (
        <form onSubmit={create} className="border rounded-xl p-4 space-y-3 bg-blue-50">
          <input
            value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder={c.title} required maxLength={150}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div>
            <label className="text-xs text-gray-500 block mb-1">{c.scheduledAt}</label>
            <input
              type="datetime-local" value={form.scheduledAt} onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))}
              required min={new Date().toISOString().slice(0, 16)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-gray-500 block mb-1">{c.from}</label>
              <input type="number" value={form.startPhraseIndex} onChange={e => setForm(f => ({ ...f, startPhraseIndex: e.target.value }))}
                min={0} required placeholder="0"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-500 block mb-1">{c.to}</label>
              <input type="number" value={form.endPhraseIndex} onChange={e => setForm(f => ({ ...f, endPhraseIndex: e.target.value }))}
                min={1} required placeholder="100"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={creating} className="bg-blue-600 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition">
              {creating ? '…' : c.schedule}
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="text-sm text-gray-500">{t.common.cancel}</button>
          </div>
        </form>
      )}

      {sessions.length === 0 ? (
        <p className="text-center text-gray-400 py-10 text-sm">{c.empty}</p>
      ) : (
        sessions.map(s => (
          <div key={s.id} className="border rounded-xl p-4">
            <div className="flex items-start justify-between mb-1">
              <p className="text-sm font-semibold">{s.title}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor[s.status]}`}>
                {statusLabel[s.status]}
              </span>
            </div>
            <p className="text-xs text-gray-400 mb-1">{new Date(s.scheduledAt).toLocaleString()}</p>
            <p className="text-xs text-gray-400">Frases {s.startPhraseIndex}–{s.endPhraseIndex} · {s.book?.title}</p>
            {(s.status === 'scheduled' || s.status === 'live') && (
              <Link
                href={`/clubs/${clubId}/sessions/${s.id}/live`}
                className="inline-block mt-2 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition"
              >
                {s.status === 'live' ? '🔴 ' : ''}{c.join}
              </Link>
            )}
            {isAdmin && s.status === 'scheduled' && (
              <button onClick={() => cancel(s.id)} className="text-xs text-red-500 hover:underline mt-2 ml-2">{c.cancel}</button>
            )}
          </div>
        ))
      )}
    </div>
  );
}
