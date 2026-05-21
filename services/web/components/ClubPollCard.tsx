'use client';

import { useEffect, useState } from 'react';
import { clubsApi, ClubPoll } from '@/lib/clubs';
import { useTranslation } from '@/lib/i18n';

export default function ClubPollCard({ clubId, isAdmin }: { clubId: string; isAdmin: boolean }) {
  const { t } = useTranslation();
  const c = t.clubs.polls;

  const [polls, setPolls]       = useState<ClubPoll[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [question, setQuestion] = useState('');
  const [closesAt, setClosesAt] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => { load(); }, [clubId]);

  async function load() {
    setLoading(true);
    try { setPolls(await clubsApi.getPolls(clubId)); }
    finally { setLoading(false); }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await clubsApi.createPoll(clubId, { question, bookIds: [], closesAt });
      setQuestion(''); setClosesAt(''); setShowCreate(false);
      await load();
    } finally {
      setCreating(false);
    }
  }

  async function close(pollId: string) {
    await clubsApi.closePoll(clubId, pollId);
    await load();
  }

  if (loading) return <div className="h-40 flex items-center justify-center"><div className="w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {isAdmin && (
        <button onClick={() => setShowCreate(!showCreate)} className="text-sm text-blue-600 hover:underline">
          + {c.create}
        </button>
      )}

      {showCreate && (
        <form onSubmit={create} className="border rounded-xl p-4 space-y-3 bg-blue-50">
          <input
            value={question} onChange={e => setQuestion(e.target.value)}
            placeholder={c.question} required maxLength={255}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div>
            <label className="text-xs text-gray-500 block mb-1">{c.closesAt}</label>
            <input
              type="datetime-local" value={closesAt} onChange={e => setClosesAt(e.target.value)}
              required min={new Date().toISOString().slice(0, 16)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={creating} className="bg-blue-600 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition">
              {creating ? '…' : c.create}
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="text-sm text-gray-500">{t.common.cancel}</button>
          </div>
        </form>
      )}

      {polls.length === 0 ? (
        <p className="text-center text-gray-400 py-10 text-sm">{c.empty}</p>
      ) : (
        polls.map(poll => (
          <div key={poll.id} className="border rounded-xl p-4">
            <div className="flex items-start justify-between mb-3">
              <p className="text-sm font-semibold">{poll.question}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full ${poll.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {poll.status === 'open' ? c.open : c.closed}
              </span>
            </div>
            <p className="text-xs text-gray-400 mb-3">{c.closesAt}: {new Date(poll.closesAt).toLocaleString()}</p>
            {isAdmin && poll.status === 'open' && (
              <button onClick={() => close(poll.id)} className="text-xs text-red-500 hover:underline">{c.close}</button>
            )}
            {poll.winnerOptionId && (
              <p className="text-xs text-green-600 font-medium">🏆 {c.winner}</p>
            )}
          </div>
        ))
      )}
    </div>
  );
}
