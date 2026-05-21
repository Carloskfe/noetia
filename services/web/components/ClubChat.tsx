'use client';

import { useEffect, useRef, useState } from 'react';
import { clubsApi, ClubMessage } from '@/lib/clubs';
import { useTranslation } from '@/lib/i18n';

export default function ClubChat({ clubId, canWrite }: { clubId: string; canWrite: boolean }) {
  const { t } = useTranslation();
  const c = t.clubs.chat;

  const [messages, setMessages] = useState<ClubMessage[]>([]);
  const [text, setText]         = useState('');
  const [sending, setSending]   = useState(false);
  const [loading, setLoading]   = useState(true);
  const bottomRef               = useRef<HTMLDivElement>(null);

  const myUserId = typeof window !== 'undefined' ? localStorage.getItem('user_id') ?? '' : '';

  useEffect(() => { load(); }, [clubId]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function load() {
    setLoading(true);
    try {
      const data = await clubsApi.getMessages(clubId);
      setMessages([...data].reverse());
    } finally {
      setLoading(false);
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    try {
      const msg = await clubsApi.sendMessage(clubId, text.trim());
      setMessages(prev => [...prev, msg]);
      setText('');
    } finally {
      setSending(false);
    }
  }

  async function remove(msgId: string) {
    await clubsApi.deleteMessage(clubId, msgId);
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, deletedAt: new Date().toISOString() } : m));
  }

  if (loading) return <div className="h-40 flex items-center justify-center"><div className="w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="flex flex-col h-[500px]">
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {messages.length === 0 && <p className="text-center text-gray-400 py-10 text-sm">{c.empty}</p>}
        {messages.map(msg => {
          const isMe = msg.userId === myUserId;
          return (
            <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
              <div className={`max-w-xs rounded-2xl px-3 py-2 text-sm ${isMe ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
                {!isMe && <p className="text-xs font-medium mb-0.5 opacity-70">{msg.user?.name}</p>}
                {msg.deletedAt
                  ? <span className="italic opacity-50">{c.deleted}</span>
                  : <span>{msg.content}</span>
                }
              </div>
              {!msg.deletedAt && (
                <button
                  onClick={() => remove(msg.id)}
                  className="opacity-0 group-hover:opacity-100 text-xs text-gray-300 hover:text-red-400 self-center"
                  aria-label="Delete"
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {canWrite && (
        <form onSubmit={send} className="flex gap-2 mt-3 border-t pt-3">
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={c.placeholder}
            maxLength={2000}
            className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label={c.placeholder}
          />
          <button
            type="submit"
            disabled={sending || !text.trim()}
            className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {c.send}
          </button>
        </form>
      )}
    </div>
  );
}
