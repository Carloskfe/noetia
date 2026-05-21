'use client';

import { useEffect, useState } from 'react';
import { clubsApi, ClubBook, ClubDiscussion as Discussion } from '@/lib/clubs';
import { useTranslation } from '@/lib/i18n';

export default function ClubDiscussion({ clubId, activeBook, canWrite, isAdmin }: {
  clubId: string;
  activeBook: ClubBook | null;
  canWrite: boolean;
  isAdmin: boolean;
}) {
  const { t } = useTranslation();
  const c = t.clubs.discussion;

  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [loading, setLoading]         = useState(false);
  const [newContent, setNewContent]   = useState('');
  const [newPhrase, setNewPhrase]     = useState('');
  const [posting, setPosting]         = useState(false);
  const [showForm, setShowForm]       = useState(false);

  const myUserId = typeof window !== 'undefined' ? localStorage.getItem('user_id') ?? '' : '';

  useEffect(() => {
    if (!activeBook) return;
    load();
  }, [clubId, activeBook?.bookId]);

  async function load() {
    if (!activeBook) return;
    setLoading(true);
    try {
      const data = await clubsApi.getDiscussions(clubId, activeBook.bookId);
      setDiscussions(data.filter(d => !d.deletedAt));
    } finally {
      setLoading(false);
    }
  }

  async function post(e: React.FormEvent) {
    e.preventDefault();
    if (!activeBook || !newContent.trim()) return;
    const phraseIdx = parseInt(newPhrase, 10);
    if (isNaN(phraseIdx) || phraseIdx < 0) return;
    setPosting(true);
    try {
      const disc = await clubsApi.postDiscussion(clubId, { bookId: activeBook.bookId, phraseIndex: phraseIdx, content: newContent.trim() });
      setDiscussions(prev => [...prev, disc].sort((a, b) => a.phraseIndex - b.phraseIndex));
      setNewContent(''); setNewPhrase(''); setShowForm(false);
    } finally {
      setPosting(false);
    }
  }

  async function remove(id: string) {
    await clubsApi.deleteDiscussion(clubId, id);
    setDiscussions(prev => prev.filter(d => d.id !== id));
  }

  if (!activeBook) return <p className="text-center text-gray-400 py-10 text-sm">{c.noBook}</p>;
  if (loading) return <div className="h-40 flex items-center justify-center"><div className="w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 font-medium">{activeBook.book?.title}</p>
        {canWrite && (
          <button onClick={() => setShowForm(!showForm)} className="text-sm text-blue-600 hover:underline">
            + {c.commentOn}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={post} className="border rounded-xl p-4 space-y-3 bg-blue-50">
          <div className="flex gap-2">
            <input
              type="number"
              value={newPhrase}
              onChange={e => setNewPhrase(e.target.value)}
              placeholder="Frase #"
              min={0}
              className="w-28 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <textarea
            value={newContent}
            onChange={e => setNewContent(e.target.value)}
            placeholder={c.placeholder}
            rows={3} maxLength={2000} required
            className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex gap-2">
            <button type="submit" disabled={posting} className="bg-blue-600 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition">
              {posting ? '…' : c.post}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="text-sm text-gray-500 hover:text-gray-700">{t.common.cancel}</button>
          </div>
        </form>
      )}

      {discussions.length === 0 ? (
        <p className="text-center text-gray-400 py-10 text-sm">{c.empty}</p>
      ) : (
        <div className="space-y-3">
          {discussions.map(d => (
            <div key={d.id} className="border rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono bg-gray-100 text-gray-500 px-2 py-0.5 rounded">#{d.phraseIndex}</span>
                  <span className="text-xs font-medium text-gray-700">{d.user?.name}</span>
                </div>
                {(d.userId === myUserId || isAdmin) && (
                  <button onClick={() => remove(d.id)} className="text-xs text-gray-300 hover:text-red-400" aria-label="Delete">✕</button>
                )}
              </div>
              <p className="text-sm text-gray-800">{d.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
